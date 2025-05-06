import {
    hexToString, stringToHex, numberToHex,
    getAddress, slice, isAddress,
} from "viem";

import {
    RADAR_SAVED_CONFIG_LIST_KEY, RADAR_DEFAULT_CONFIG_NAME_KEY,
    RADAR_MIDI_MAP_KEY, RADAR_EVENT_REACTIONS_KEY,
    getNamedConfigMapKey, getRadarConfigListElementKey, IPFS_GATEWAY,
} from "../config/global-config";

import { ERC725YDataKeys } from '@lukso/lsp-smart-contracts';
import { resolveLsp4Metadata } from '../utils/erc725.js';

// Minimal ABI for ERC725Y interactions
const ERC725Y_ABI = [
    { inputs: [{ type: "bytes32", name: "dataKey" }], name: "getData", outputs: [{ type: "bytes", name: "dataValue" }], stateMutability: "view", type: "function" },
    { inputs: [{ type: "bytes32[]", name: "dataKeys" }], name: "getDataBatch", outputs: [{ type: "bytes[]", name: "dataValues" }], stateMutability: "view", type: "function" },
    { inputs: [{ type: "bytes32", name: "dataKey" }, { type: "bytes", name: "dataValue" }], name: "setData", outputs: [], stateMutability: "payable", type: "function" },
    { inputs: [{ type: "bytes32[]", name: "dataKeys" }, { type: "bytes[]", name: "dataValues" }], name: "setDataBatch", outputs: [], stateMutability: "payable", type: "function" },
    { name: "supportsInterface", inputs: [{ type: "bytes4", name: "interfaceId" }], outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
];

/** Safely decodes hex to UTF-8 string, returning null on error. */
function hexToUtf8Safe(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("0x") || hex === "0x") return null;
  try { return hexToString(hex); }
  catch (e) { console.warn(`[CS hexToUtf8Safe] Failed decode: "${hex.substring(0, 60)}...". Error:`, e.message || e); return null; }
}

/** Safely converts hex bytes to a number, clamping at MAX_SAFE_INTEGER. Returns 0 on error. */
export function hexBytesToIntegerSafe(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("0x") || hex === "0x") return 0;
  try {
    const bigIntValue = BigInt(hex);
    if (bigIntValue > BigInt(Number.MAX_SAFE_INTEGER)) {
      console.warn(`[CS hexBytesToIntegerSafe] Value ${hex} exceeds MAX_SAFE_INTEGER.`);
      return Number.MAX_SAFE_INTEGER;
    }
    return Number(bigIntValue);
  } catch (e) {
    console.warn(`[CS hexBytesToIntegerSafe] Failed convert: "${hex}". Error:`, e); return 0;
  }
}

/** Safely gets a checksummed address from a string, returning null on error. */
function getChecksumAddressSafe(address) {
    if (typeof address !== 'string') return null;
    try { return getAddress(address.trim()); }
    catch { return null; } // Removed unused '_' variable
}

/**
 * Service class for interacting with ERC725Y storage on Universal Profiles
 * to load, save, and manage RADAR application configurations (presets, reactions, MIDI maps).
 * Requires initialized Viem Public and Wallet Clients.
 */
class ConfigurationService {
  /** @type {import('viem').WalletClient | null} */
  walletClient = null;
  /** @type {import('viem').PublicClient | null} */
  publicClient = null;
  /** @type {boolean} */
  initialized = false;

  /**
   * Creates an instance of ConfigurationService.
   * @param {any} _provider - The EIP-1193 provider (unused).
   * @param {import('viem').WalletClient} walletClient - The Viem Wallet Client instance.
   * @param {import('viem').PublicClient} publicClient - The Viem Public Client instance.
   */
  constructor(_provider, walletClient, publicClient) {
    this.walletClient = walletClient;
    this.publicClient = publicClient;
    this.initialized = !!publicClient && !!walletClient;
  }

  /**
   * Initializes the service.
   * @returns {Promise<boolean>} True if clients are available.
   */
  async initialize() {
    this.initialized = !!this.publicClient && !!this.walletClient;
    return this.initialized;
  }

  /** Gets the connected signer address. */
  getUserAddress() {
    return this.walletClient?.account?.address ?? null;
  }

  /** Checks if ready for read operations. */
  checkReadyForRead() {
    return !!this.publicClient;
  }

  /** Checks if ready for write operations. */
  checkReadyForWrite() {
    return !!this.walletClient?.account && !!this.publicClient;
  }

  /**
   * Loads configuration data for a profile.
   * @param {string | null} profileAddress - Profile address.
   * @param {string | null} [configNameToLoad=null] - Preset name or null for default.
   * @param {string | null} [customKey=null] - Specific ERC725Y key override.
   * @returns {Promise<{config: object|null, reactions: object, midi: object, error: string|null}>} Loaded data or error.
   */
  async loadConfiguration(profileAddress = null, configNameToLoad = null, customKey = null) {
    const defaultResult = { config: null, reactions: {}, midi: {}, error: null };
    if (!this.checkReadyForRead()) return { ...defaultResult, error: "Public client not ready" };

    const checksummedProfileAddr = getChecksumAddressSafe(profileAddress);
    if (!checksummedProfileAddr) {
      console.error(`[CS loadConfiguration] Invalid input address format: ${profileAddress}`);
      return { ...defaultResult, error: "Invalid profile address format" };
    }

    const logPrefix = `[CS loadConfiguration Addr:${checksummedProfileAddr.slice(0, 6)} Name:${configNameToLoad || (customKey ? 'CUSTOM' : 'DEFAULT')}]`;
    try {
        let targetConfigKey = customKey;
        let configNameUsed = customKey ? "Custom Key" : configNameToLoad;

        if (!targetConfigKey && !configNameToLoad) {
            let defaultNameBytes = null;
            try {
                defaultNameBytes = await this.publicClient.readContract({ address: checksummedProfileAddr, abi: ERC725Y_ABI, functionName: "getData", args: [RADAR_DEFAULT_CONFIG_NAME_KEY] });
            } catch { /* Ignore */ }

            const nameFromPointer = hexToUtf8Safe(defaultNameBytes);
            if (nameFromPointer) {
                configNameUsed = nameFromPointer;
                targetConfigKey = getNamedConfigMapKey(nameFromPointer);
            }
        } else if (!targetConfigKey && configNameToLoad) {
            configNameUsed = configNameToLoad;
            targetConfigKey = getNamedConfigMapKey(configNameToLoad);
        }

        const dataKeysToFetch = [];
        const keyIndexMap = { config: -1, reactions: -1, midi: -1 };
        if (targetConfigKey) { keyIndexMap.config = dataKeysToFetch.push(targetConfigKey) - 1; }
        keyIndexMap.reactions = dataKeysToFetch.push(RADAR_EVENT_REACTIONS_KEY) - 1;
        keyIndexMap.midi = dataKeysToFetch.push(RADAR_MIDI_MAP_KEY) - 1;

        let dataValues = [];
        if (dataKeysToFetch.length > 0) {
            try {
                dataValues = await this.publicClient.readContract({ address: checksummedProfileAddr, abi: ERC725Y_ABI, functionName: "getDataBatch", args: [dataKeysToFetch] });
            } catch (batchReadError) {
                console.error(`${logPrefix} Error during getDataBatch:`, batchReadError);
                console.warn(`${logPrefix} getDataBatch potentially failed, treating missing keys as null.`);
                dataValues = dataKeysToFetch.map(() => null);
            }
        } else {
            console.warn(`${logPrefix} No keys to fetch.`);
            return { ...defaultResult };
        }

        let parsedConfig = null;
        let parsedReactions = {};
        let parsedMidi = {};

        if (keyIndexMap.config !== -1 && dataValues[keyIndexMap.config] && dataValues[keyIndexMap.config] !== "0x") {
            const configJson = hexToUtf8Safe(dataValues[keyIndexMap.config]);
            if (configJson) {
                try {
                    const tempParsed = JSON.parse(configJson);
                    if (tempParsed && typeof tempParsed === "object" && typeof tempParsed.l === 'object' && typeof tempParsed.tA === 'object') {
                        parsedConfig = { name: String(tempParsed.name || configNameUsed || "Unnamed Config"), ts: tempParsed.ts || 0, layers: tempParsed.l, tokenAssignments: tempParsed.tA };
                    } else { console.warn(`${logPrefix} Config JSON parsed but structure invalid.`); }
                } catch (parseError) { console.error(`${logPrefix} Error parsing config JSON:`, parseError); }
            } else { console.warn(`${logPrefix} Config data invalid hex or empty string.`); }
        }

        if (keyIndexMap.reactions !== -1 && dataValues[keyIndexMap.reactions] && dataValues[keyIndexMap.reactions] !== "0x") {
            const reactionsJson = hexToUtf8Safe(dataValues[keyIndexMap.reactions]);
            if (reactionsJson) {
                try {
                    const tempParsed = JSON.parse(reactionsJson);
                    if (tempParsed && typeof tempParsed === "object") { parsedReactions = tempParsed; }
                    else { console.warn(`${logPrefix} Reactions JSON parsed but not a valid object.`); }
                } catch (parseError) { console.error(`${logPrefix} Error parsing reactions JSON:`, parseError); }
            } else { console.warn(`${logPrefix} Reactions data was invalid hex or empty string.`); }
        }

        if (keyIndexMap.midi !== -1 && dataValues[keyIndexMap.midi] && dataValues[keyIndexMap.midi] !== "0x") {
            const midiJson = hexToUtf8Safe(dataValues[keyIndexMap.midi]);
            if (midiJson) {
                try {
                    const tempParsed = JSON.parse(midiJson);
                    if (tempParsed && typeof tempParsed === "object") { parsedMidi = tempParsed; }
                    else { console.warn(`${logPrefix} MIDI JSON parsed but not a valid object.`); }
                } catch (parseError) { console.error(`${logPrefix} Error parsing MIDI JSON:`, parseError); }
            } else { console.warn(`${logPrefix} MIDI data was invalid hex or empty string.`); }
        }

        return { config: parsedConfig, reactions: parsedReactions, midi: parsedMidi, error: null };
    } catch (error) {
        console.error(`${logPrefix} Unexpected error in loadConfiguration:`, error);
        return { ...defaultResult, error: error.message || "Unknown loading error" };
    }
  }

  /**
   * Saves configuration data to the target profile.
   * @param {string} targetProfileAddress - Profile address.
   * @param {object} saveData - Data object (layers, tokenAssignments, reactions, midi).
   * @param {string} configName - Preset name (required if includeVisuals).
   * @param {boolean} [setAsDefault=false] - Set as default preset.
   * @param {boolean} [includeVisuals=false] - Save visual preset data.
   * @param {boolean} [includeReactions=false] - Save global reactions.
   * @param {boolean} [includeMidi=false] - Save global MIDI map.
   * @param {string | null} [customKey=null] - Specific key override for visual preset.
   * @returns {Promise<{success: boolean, hash: string|null, error?: string}>} Result object.
   */
  async saveConfiguration(targetProfileAddress, saveData, configName, setAsDefault = false, includeVisuals = false, includeReactions = false, includeMidi = false, customKey = null) {
    const logPrefix = `[CS saveConfiguration Addr:${targetProfileAddress?.slice(0, 6)} Name:${configName || "N/A"} V:${includeVisuals} R:${includeReactions} M:${includeMidi}]`;

    if (!this.checkReadyForWrite()) throw new Error("Client not ready for writing.");
    const checksummedTargetAddr = getChecksumAddressSafe(targetProfileAddress);
    if (!checksummedTargetAddr) throw new Error("Invalid target profile address format.");
    if (!saveData || typeof saveData !== "object") throw new Error("Invalid saveData object.");
    if (includeVisuals && !configName?.trim() && !customKey) throw new Error("Configuration name required for visual presets.");
    if (!includeVisuals && !includeReactions && !includeMidi) {
      console.warn(`${logPrefix} No data types included. Nothing to save.`);
      return { success: true, hash: null };
    }

    const userAddress = this.walletClient.account.address;
    if (userAddress?.toLowerCase() !== checksummedTargetAddr?.toLowerCase()) {
      throw new Error("Permission denied: Signer does not own the target profile.");
    }

    try {
        const dataKeys = [];
        const dataValues = [];
        const preparedItemsLog = [];
        const trimmedName = configName?.trim();

        if (includeVisuals) {
            if (!saveData.layers) throw new Error("'layers' data missing for visual save.");
            const configStorageKey = customKey || getNamedConfigMapKey(trimmedName);
            if (!configStorageKey) throw new Error("Could not determine storage key for visual config.");

            const visualConfigToStore = { name: String(trimmedName), ts: Date.now(), l: saveData.layers, tA: saveData.tokenAssignments || {} };
            let visualConfigHex;
            try { visualConfigHex = stringToHex(JSON.stringify(visualConfigToStore)); }
            catch (stringifyError) { throw new Error(`Failed to prepare visual config data: ${stringifyError.message}`); }
            dataKeys.push(configStorageKey); dataValues.push(visualConfigHex); preparedItemsLog.push(`Visuals`);

            if (!customKey) {
                const currentList = await this.loadSavedConfigurations(checksummedTargetAddr);
                if (!currentList.includes(trimmedName)) {
                    const currentIndex = currentList.length;
                    dataKeys.push(getRadarConfigListElementKey(currentIndex)); dataValues.push(stringToHex(trimmedName)); preparedItemsLog.push(`ListAdd`);
                    dataKeys.push(RADAR_SAVED_CONFIG_LIST_KEY); dataValues.push(numberToHex(BigInt(currentIndex + 1), { size: 16 })); preparedItemsLog.push(`ListLen`);
                }
                if (setAsDefault) {
                    dataKeys.push(RADAR_DEFAULT_CONFIG_NAME_KEY); dataValues.push(stringToHex(trimmedName)); preparedItemsLog.push(`SetDefault`);
                }
            }
        }

        if (includeReactions) {
            if (saveData.reactions === undefined) throw new Error("'reactions' data missing for save.");
            let reactionsHex;
            try { reactionsHex = stringToHex(JSON.stringify(saveData.reactions || {})); }
            catch (stringifyError) { throw new Error(`Failed to prepare reactions data: ${stringifyError.message}`); }
            dataKeys.push(RADAR_EVENT_REACTIONS_KEY); dataValues.push(reactionsHex); preparedItemsLog.push(`Reactions`);
        }

        if (includeMidi) {
            if (saveData.midi === undefined) throw new Error("'midi' data missing for save.");
            let midiHex;
            try { midiHex = stringToHex(JSON.stringify(saveData.midi || {})); }
            catch (stringifyError) { throw new Error(`Failed to prepare MIDI map data: ${stringifyError.message}`); }
            dataKeys.push(RADAR_MIDI_MAP_KEY); dataValues.push(midiHex); preparedItemsLog.push(`MIDI`);
        }

        if (dataKeys.length === 0) {
            console.warn(`${logPrefix} No data keys prepared. Aborting save.`);
            return { success: true, hash: null };
        }

        console.log(`${logPrefix} Prepared ${dataKeys.length} operations: ${preparedItemsLog.join(', ')}`);
        const isBatch = dataKeys.length > 1;
        const functionName = isBatch ? "setDataBatch" : "setData";
        const args = isBatch ? [dataKeys, dataValues] : [dataKeys[0], dataValues[0]];
        console.warn(`${logPrefix} Attempting ${functionName}...`);

        try {
            const hash = await this.walletClient.writeContract({
                address: checksummedTargetAddr, abi: ERC725Y_ABI, functionName, args, account: this.walletClient.account,
            });
            console.log(`${logPrefix} ${functionName} successful! Hash:`, hash);
            return { success: true, hash };
        } catch (writeError) {
            console.error(`${logPrefix} ${functionName} FAILED:`, writeError);
            const baseError = writeError.cause || writeError;
            const message = baseError?.shortMessage || writeError.message || "Unknown write error";
            throw new Error(`Transaction failed: ${message}`);
        }
    } catch (error) {
        console.error(`${logPrefix} Error during saveConfiguration processing:`, error);
        throw new Error(error.message || "Unexpected error during save process.");
    }
  }

  /**
   * Loads the list of saved configuration preset names.
   * @param {string} profileAddress - Profile address.
   * @returns {Promise<string[]>} Array of preset names.
   */
  async loadSavedConfigurations(profileAddress) {
    const checksummedProfileAddr = getChecksumAddressSafe(profileAddress);
    if (!this.checkReadyForRead() || !checksummedProfileAddr) {
      console.error(`[CS loadSavedList] Client not ready or invalid address: ${profileAddress}`);
      return [];
    }
    const logPrefix = `[CS loadSavedList Addr:${checksummedProfileAddr.slice(0, 6)}]`;
    try {
        let lengthBytes;
        try {
            lengthBytes = await this.publicClient.readContract({ address: checksummedProfileAddr, abi: ERC725Y_ABI, functionName: "getData", args: [RADAR_SAVED_CONFIG_LIST_KEY] });
        } catch (readError) {
            if (readError.message.includes('ContractFunctionExecutionError') || readError.message.includes('reverted')) return [];
            console.error(`${logPrefix} Error reading list length:`, readError.message);
            return [];
        }

        const count = hexBytesToIntegerSafe(lengthBytes);
        if (count <= 0) return [];

        const elementKeys = Array.from({ length: count }, (_, i) => getRadarConfigListElementKey(i));
        let nameValuesBytes;
        try {
            nameValuesBytes = await this.publicClient.readContract({ address: checksummedProfileAddr, abi: ERC725Y_ABI, functionName: "getDataBatch", args: [elementKeys] });
        } catch (batchReadError) {
            console.error(`${logPrefix} Error reading list elements:`, batchReadError);
            return [];
        }

        const names = nameValuesBytes
            .map((hex, idx) => {
                const name = hexToUtf8Safe(hex);
                if (name === null) console.warn(`${logPrefix} Failed decode index ${idx}, key: ${elementKeys[idx]}, raw: ${hex}`);
                return name;
            })
            .filter(name => name !== null && name.trim() !== "");
        return names;
    } catch (error) {
        console.error(`${logPrefix} Unexpected error loading list:`, error);
        return [];
    }
  }

  /**
   * Deletes a named configuration preset.
   * @param {string} targetProfileAddress - Profile address.
   * @param {string} configNameToDelete - Name of the preset to delete.
   * @returns {Promise<{success: boolean, hash: string|null, error?: string}>} Result object.
   */
  async deleteConfiguration(targetProfileAddress, configNameToDelete) {
    const logPrefix = `[CS deleteConfiguration Addr:${targetProfileAddress?.slice(0, 6)} Name:${configNameToDelete}]`;
    console.warn(`${logPrefix} Attempting delete.`);
    if (!this.checkReadyForWrite()) throw new Error("Client not ready for writing.");
    const checksummedTargetAddr = getChecksumAddressSafe(targetProfileAddress);
    if (!checksummedTargetAddr) throw new Error("Invalid target profile address format.");
    if (!configNameToDelete?.trim()) throw new Error("Valid config name to delete is required.");
    const trimmedNameToDelete = configNameToDelete.trim();

    const userAddress = this.walletClient.account.address;
    if (userAddress?.toLowerCase() !== checksummedTargetAddr?.toLowerCase()) {
      throw new Error("Permission denied: Signer does not own the target profile.");
    }

    try {
        const dataKeysToUpdate = [];
        const dataValuesToUpdate = [];
        const preparedItemsLog = [];

        dataKeysToUpdate.push(getNamedConfigMapKey(trimmedNameToDelete)); dataValuesToUpdate.push("0x"); preparedItemsLog.push(`ClearPreset`);

        const currentList = await this.loadSavedConfigurations(checksummedTargetAddr);
        const deleteIndex = currentList.findIndex((name) => name === trimmedNameToDelete);

        if (deleteIndex !== -1) {
            const lastIndex = currentList.length - 1;
            if (deleteIndex < lastIndex) {
                dataKeysToUpdate.push(getRadarConfigListElementKey(deleteIndex));
                dataValuesToUpdate.push(stringToHex(currentList[lastIndex]));
                preparedItemsLog.push(`ListMove`);
            }
            dataKeysToUpdate.push(getRadarConfigListElementKey(lastIndex)); dataValuesToUpdate.push("0x"); preparedItemsLog.push(`ListClearLast`);
            const newLength = BigInt(currentList.length - 1);
            dataKeysToUpdate.push(RADAR_SAVED_CONFIG_LIST_KEY); dataValuesToUpdate.push(numberToHex(newLength >= 0 ? newLength : 0, { size: 16 })); preparedItemsLog.push(`ListLen`);
        } else { console.warn(`${logPrefix} Config "${trimmedNameToDelete}" not in list.`); }

        let defaultNameBytes = null;
        try { defaultNameBytes = await this.publicClient.readContract({ address: checksummedTargetAddr, abi: ERC725Y_ABI, functionName: "getData", args: [RADAR_DEFAULT_CONFIG_NAME_KEY] }); }
        catch { console.warn(`${logPrefix} Could not read default name pointer.`); }
        if (defaultNameBytes && hexToUtf8Safe(defaultNameBytes) === trimmedNameToDelete) {
            dataKeysToUpdate.push(RADAR_DEFAULT_CONFIG_NAME_KEY); dataValuesToUpdate.push("0x"); preparedItemsLog.push(`ClearDefault`);
        }

        if (dataKeysToUpdate.length === 0) { console.warn(`${logPrefix} No operations determined for delete.`); return { success: true, hash: null }; }

        console.warn(`${logPrefix} Attempting setDataBatch for delete... Ops: ${preparedItemsLog.join(', ')}`);
        try {
            const hash = await this.walletClient.writeContract({ address: checksummedTargetAddr, abi: ERC725Y_ABI, functionName: "setDataBatch", args: [dataKeysToUpdate, dataValuesToUpdate], account: this.walletClient.account });
            console.log(`${logPrefix} Delete (setDataBatch) successful! Hash:`, hash);
            return { success: true, hash };
        } catch (writeError) {
            console.error(`${logPrefix} Delete (setDataBatch) FAILED:`, writeError);
            const baseError = writeError.cause || writeError;
            const message = baseError?.shortMessage || writeError.message || "Unknown delete error";
            throw new Error(`Deletion transaction failed: ${message}`);
        }
    } catch (error) {
        console.error(`${logPrefix} Error deleting configuration:`, error);
        throw new Error(error.message || `Unexpected error during deletion.`);
    }
  }

  /**
   * Saves arbitrary data to a specific ERC725Y key.
   * @param {string} targetAddress - Profile address.
   * @param {string} key - The bytes32 data key.
   * @param {string} valueHex - Data value as hex ('0x...' or '0x' to clear).
   * @returns {Promise<{success: boolean, hash: string|null, error?: string}>} Result object.
   */
  async saveDataToKey(targetAddress, key, valueHex) {
    const logPrefix = `[CS saveDataToKey Addr:${targetAddress?.slice(0, 6) ?? 'N/A'} Key:${key?.slice(0, 15) ?? 'N/A'}...]`;
    if (!this.checkReadyForWrite()) throw new Error("Client not ready for writing.");
    const checksummedTargetAddr = getChecksumAddressSafe(targetAddress);
    if (!checksummedTargetAddr) { console.error(`${logPrefix} Validation failed. Invalid targetAddress:`, targetAddress); throw new Error("Invalid target address format."); }

    const userAddress = this.walletClient.account.address;
    if (userAddress?.toLowerCase() !== checksummedTargetAddr?.toLowerCase()) {
       throw new Error("Permission denied: Signer does not own the target profile.");
    }

    if (!key || typeof key !== "string" || !key.startsWith("0x") || key.length !== 66) { throw new Error("Data key must be a valid bytes32 hex string."); }
    const finalValueHex = (valueHex === undefined || valueHex === null) ? "0x" : valueHex;
    if (typeof finalValueHex !== "string" || !finalValueHex.startsWith("0x")) { console.error(`${logPrefix} Validation failed. Invalid valueHex:`, finalValueHex); throw new Error("Value must be a valid hex string (0x...)."); }

    try {
        console.warn(`${logPrefix} Attempting setData...`);
        try {
            const hash = await this.walletClient.writeContract({ address: checksummedTargetAddr, abi: ERC725Y_ABI, functionName: "setData", args: [key, finalValueHex], account: this.walletClient.account });
            console.log(`${logPrefix} setData successful! Hash:`, hash);
            return { success: true, hash };
        } catch (writeError) {
            console.error(`${logPrefix} setData FAILED:`, writeError);
            const baseError = writeError.cause || writeError;
            const message = baseError?.shortMessage || writeError.message || "Unknown setData error";
            throw new Error(`Set data transaction failed: ${message}`);
        }
    } catch (error) {
        console.error(`${logPrefix} Error saving data:`, error);
        throw new Error(error.message || `Unexpected error saving data to key ${key}.`);
    }
  }

  /**
   * Loads raw hex data from a single ERC725Y key.
   * @param {string} address - Profile address.
   * @param {string} key - The bytes32 data key.
   * @returns {Promise<string|null>} Hex data value or null.
   */
  async loadDataFromKey(address, key) {
    if (!this.checkReadyForRead()) return null;
    const checksummedAddress = getChecksumAddressSafe(address);
    if (!checksummedAddress) return null;
    const isKeyValid = typeof key === "string" && key.startsWith("0x") && key.length === 66;
    if (!isKeyValid) return null;
    try {
        const dataValueBytes = await this.publicClient.readContract({ address: checksummedAddress, abi: ERC725Y_ABI, functionName: "getData", args: [key] });
        return dataValueBytes && dataValueBytes !== "0x" ? dataValueBytes : null;
    } catch (e) { console.error(`[CS loadDataFromKey] readContract FAILED:`, e.message); return null; }
  }

  /**
   * Loads raw hex data from multiple ERC725Y keys using a batch call.
   * @param {string} profileAddress - Profile address.
   * @param {string[]} dataKeys - Array of bytes32 data keys.
   * @returns {Promise<Object.<string, string|null>>} Object mapping keys to hex values (or null).
   */
  async loadData(profileAddress, dataKeys = []) {
    const checksummedProfileAddr = getChecksumAddressSafe(profileAddress);
    if (!this.checkReadyForRead() || !checksummedProfileAddr || !Array.isArray(dataKeys) || dataKeys.length === 0) return {};
    const validKeys = dataKeys.filter(key => typeof key === "string" && key.startsWith("0x") && key.length === 66);
    if (validKeys.length === 0) return {};
    try {
      const dataValuesBytes = await this.publicClient.readContract({ address: checksummedProfileAddr, abi: ERC725Y_ABI, functionName: "getDataBatch", args: [validKeys] });
      const results = {};
      validKeys.forEach((key, i) => { results[key] = dataValuesBytes[i] && dataValuesBytes[i] !== "0x" ? dataValuesBytes[i] : null; });
      return results;
    } catch (e) {
      console.error(`[CS loadData] readContract (batch) FAILED:`, e.message);
      const results = {}; validKeys.forEach((key) => { results[key] = null; }); return results;
    }
  }

  /** Checks if a contract supports the ERC725Y interface. */
  async checkSupportsERC725Y(address) {
    const checksummedAddr = getChecksumAddressSafe(address);
    if (!this.checkReadyForRead() || !checksummedAddr) return false;
    try { return await this.publicClient.readContract({ address: checksummedAddr, abi: ERC725Y_ABI, functionName: "supportsInterface", args: ["0x5a988c0f"] }); }
    catch (e) { console.warn(`[CS checkSupportsERC725Y] Error checking interface: ${e.message}`); return false; }
  }

  /**
   * Retrieves the addresses of assets received by the profile (LSP5ReceivedAssets).
   * @param {string} profileAddress - The profile address.
   * @returns {Promise<string[]>} Array of checksummed asset addresses.
   */
  async getOwnedAssetAddresses(profileAddress) {
    const logPrefix = `[CS getOwnedAssetAddresses Addr:${profileAddress?.slice(0, 6) ?? 'N/A'}]`;
    const checksummedProfileAddr = getChecksumAddressSafe(profileAddress);
    if (!this.checkReadyForRead() || !checksummedProfileAddr) { console.error(`${logPrefix} Client not ready or invalid address.`); return []; }
    const lsp5ArrayLengthKey = ERC725YDataKeys.LSP5['LSP5ReceivedAssets[]'].length;
    const lsp5BaseIndexKey = ERC725YDataKeys.LSP5['LSP5ReceivedAssets[]'].index;
    try {
        const lengthDataMap = await this.loadData(checksummedProfileAddr, [lsp5ArrayLengthKey]);
        const arrayLength = hexBytesToIntegerSafe(lengthDataMap?.[lsp5ArrayLengthKey]);
        if (arrayLength === 0) return [];

        const elementKeys = Array.from({ length: arrayLength }, (_, i) => lsp5BaseIndexKey + numberToHex(BigInt(i), { size: 16 }).slice(2));
        const elementDataMap = await this.loadData(checksummedProfileAddr, elementKeys);
        const addresses = elementKeys
            .map(key => elementDataMap[key])
            .filter(data => data && data !== '0x')
            .map(data => { try { return getAddress(slice(data, 0, 20)); } catch (decodeError) { console.warn(`${logPrefix} Failed address decode: ${data}`, decodeError); return null; } })
            .filter(address => address !== null);
        return addresses;
    } catch (error) { console.error(`${logPrefix} Error fetching owned assets:`, error); return []; }
  }

  /**
   * Resolves token assignments to image URLs and applies them to CanvasManagers.
   * @param {object} assignments - Maps layerId to assignment data.
   * @param {object} managers - Maps layerId to CanvasManager instances.
   * @param {object} defaultLayerAssets - Maps layerId to default image sources.
   * @param {object} demoAssetMap - Maps demo keys to image sources.
   */
  async applyTokenAssignmentsToManagers(assignments, managers, defaultLayerAssets, demoAssetMap) {
    const logPrefix = "[CS applyTokenAssignmentsToManagers]";
    if (!managers || !assignments || !defaultLayerAssets || !demoAssetMap) { console.warn(`${logPrefix} Skipped (missing inputs)`); return; }

    const layerIdsToProcess = ['1', '2', '3'];
    const promises = layerIdsToProcess.map(async (layerId) => {
        const manager = managers[layerId];
        if (!manager) { console.warn(`${logPrefix} Missing manager for L${layerId}`); return; }

        const assignmentValue = assignments[layerId];
        const defaultAssetSrc = defaultLayerAssets[layerId];
        let imageSourceToApply = defaultAssetSrc;

        try {
            if (typeof assignmentValue === 'string' && assignmentValue.startsWith("DEMO_LAYER_")) {
                const demoAssetSource = demoAssetMap[assignmentValue];
                if (demoAssetSource) { imageSourceToApply = demoAssetSource; }
            } else if (typeof assignmentValue === 'object' && assignmentValue?.type === 'owned' && assignmentValue.iconUrl) {
                imageSourceToApply = assignmentValue.iconUrl;
            } else if (typeof assignmentValue === 'string' && isAddress(assignmentValue)) {
                try {
                    const metadata = await resolveLsp4Metadata(this, assignmentValue);
                    let resolvedImageUrl = null;
                    if (metadata?.LSP4Metadata) {
                        const meta = metadata.LSP4Metadata;
                        const url = meta.assets?.[0]?.url || meta.icon?.[0]?.url || meta.images?.[0]?.[0]?.url || null;
                        if (url && typeof url === 'string') {
                            const trimmedUrl = url.trim();
                            if (trimmedUrl.startsWith('ipfs://')) resolvedImageUrl = `${IPFS_GATEWAY}${trimmedUrl.slice(7)}`;
                            else if (trimmedUrl.startsWith('http') || trimmedUrl.startsWith('data:')) resolvedImageUrl = trimmedUrl;
                        }
                    }
                    if (resolvedImageUrl) { imageSourceToApply = resolvedImageUrl; }
                } catch (error) { console.error(`${logPrefix} L${layerId}: Error resolving LSP4:`, error); }
            } else if (typeof assignmentValue === 'string' && (assignmentValue.includes('/') || assignmentValue.startsWith('data:'))) {
                 imageSourceToApply = assignmentValue;
            }

            if (manager.setImage) {
                if (imageSourceToApply) {
                    await manager.setImage(imageSourceToApply);
                } else {
                    console.error(`${logPrefix} L${layerId}: CRITICAL - imageSourceToApply is null/undefined! Reverting.`);
                    if (defaultAssetSrc) await manager.setImage(defaultAssetSrc);
                }
            } else { console.warn(`${logPrefix} manager.setImage missing for L${layerId}`); }

        } catch (error) {
            console.error(`[CS applyTokens] L${layerId}: ERROR processing assignment '${JSON.stringify(assignmentValue)}': `, error);
            try { if (defaultAssetSrc && manager.setImage) await manager.setImage(defaultAssetSrc); }
            catch (revertError) { console.error(`${logPrefix} Failed to revert L${layerId} to default:`, revertError); }
        }
    });

    await Promise.all(promises);
  }

}

export default ConfigurationService;