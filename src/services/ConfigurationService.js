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
import { Buffer } from 'buffer'; // Needed for Data URI decoding

// Ensure Buffer is globally available if needed for Data URI parsing
if (typeof window !== 'undefined' && typeof window.Buffer === 'undefined') {
  window.Buffer = Buffer;
}

// Minimal ABI for ERC725Y interactions
const ERC725Y_ABI = [
    { inputs: [{ type: "bytes32", name: "dataKey" }], name: "getData", outputs: [{ type: "bytes", name: "dataValue" }], stateMutability: "view", type: "function" },
    { inputs: [{ type: "bytes32[]", name: "dataKeys" }], name: "getDataBatch", outputs: [{ type: "bytes[]", name: "dataValues" }], stateMutability: "view", type: "function" },
    { inputs: [{ type: "bytes32", name: "dataKey" }, { type: "bytes", name: "dataValue" }], name: "setData", outputs: [], stateMutability: "payable", type: "function" },
    { inputs: [{ type: "bytes32[]", name: "dataKeys" }, { type: "bytes[]", name: "dataValues" }], name: "setDataBatch", outputs: [], stateMutability: "payable", type: "function" },
    { name: "supportsInterface", inputs: [{ type: "bytes4", name: "interfaceId" }], outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
];

/**
 * Safely decodes hex to UTF-8 string, returning null on error.
 * @param {string | null | undefined} hex - The hex string to decode.
 * @returns {string | null} The decoded string or null.
 */
function hexToUtf8Safe(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("0x") || hex === "0x") return null;
  try { return hexToString(hex); }
  catch { return null; }
}

/**
 * Safely converts hex bytes to a number, clamping at MAX_SAFE_INTEGER. Returns 0 on error.
 * @param {string | null | undefined} hex - The hex string to convert.
 * @returns {number} The resulting number or 0.
 */
export function hexBytesToIntegerSafe(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("0x") || hex === "0x") return 0;
  try {
    const bigIntValue = BigInt(hex);
    if (bigIntValue > BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number.MAX_SAFE_INTEGER;
    }
    return Number(bigIntValue);
  } catch { return 0; }
}

/**
 * Safely gets a checksummed address from a string, returning null on error.
 * @param {string | null | undefined} address - The address string.
 * @returns {string | null} The checksummed address or null.
 */
function getChecksumAddressSafe(address) {
    if (typeof address !== 'string') return null;
    try { return getAddress(address.trim()); }
    catch { return null; }
}

/**
 * Service class for interacting with ERC725Y storage on Universal Profiles
 * to load, save, and manage RADAR application configurations (presets, reactions, MIDI maps).
 * Requires initialized Viem Public and Wallet Clients. Distinguishes between readiness
 * for read and write operations.
 */
class ConfigurationService {
  /** @type {import('viem').WalletClient | null} */
  walletClient = null;
  /** @type {import('viem').PublicClient | null} */
  publicClient = null;
  /** @type {boolean} Indicates if the service has basic requirements (public client) */
  readReady = false;
  /** @type {boolean} Indicates if the service has requirements for writing */
  writeReady = false;

  /**
   * Creates an instance of ConfigurationService.
   * @param {any} _provider - The EIP-1193 provider (currently unused).
   * @param {import('viem').WalletClient | null} walletClient - The Viem Wallet Client instance.
   * @param {import('viem').PublicClient | null} publicClient - The Viem Public Client instance.
   */
  constructor(_provider, walletClient, publicClient) {
    this.walletClient = walletClient;
    this.publicClient = publicClient;
    this.readReady = !!publicClient;
    this.writeReady = !!publicClient && !!walletClient?.account;
    // console.log(`[ConfigurationService] Created. ReadReady: ${this.readReady}, WriteReady: ${this.writeReady}`); // Keep for initial setup debug if needed
  }

  /**
   * Initializes the service by checking client availability.
   * @returns {Promise<boolean>} True if the service is ready for read operations.
   */
  async initialize() {
    this.readReady = !!this.publicClient;
    this.writeReady = this.readReady && !!this.walletClient?.account;
    return this.readReady;
  }

  /**
   * Gets the connected signer address.
   * @returns {string | null} The connected EOA address or null.
   */
  getUserAddress() {
    return this.walletClient?.account?.address ?? null;
  }

  /**
   * Checks if ready for read operations, updating internal state.
   * @returns {boolean} True if ready for reads.
   */
  checkReadyForRead() {
    this.readReady = !!this.publicClient;
    return this.readReady;
  }

  /**
   * Checks if ready for write operations, updating internal state.
   * @returns {boolean} True if ready for writes.
   */
  checkReadyForWrite() {
    this.readReady = !!this.publicClient;
    this.writeReady = this.readReady && !!this.walletClient?.account;
    return this.writeReady;
  }

  /**
   * Gets a default layer configuration template.
   * @private
   * @returns {Object} Default layer configuration object.
   */
  _getDefaultLayerConfigTemplate() {
    return {
      enabled: true,
      blendMode: 'normal',
      opacity: 1.0,
      size: 1.0,
      speed: 0.01,
      drift: 0,
      driftSpeed: 0.1,
      angle: 0,
      xaxis: 0,
      yaxis: 0,
      direction: 1,
      driftState: {
        x: 0,
        y: 0,
        phase: Math.random() * Math.PI * 2,
        enabled: false
      }
    };
  }

  /**
   * Loads configuration data (visual preset, global reactions, global MIDI map) for a profile.
   * Prioritizes customKey, then configNameToLoad, then the profile's default preset.
   * @param {string | null} profileAddress - Profile address to load from.
   * @param {string | null} [configNameToLoad=null] - Specific preset name to load. If null, attempts to load the default.
   * @param {string | null} [customKey=null] - Specific ERC725Y key override for the visual preset.
   * @returns {Promise<{config: object|null, reactions: object, midi: object, error: string|null}>} Loaded data or error state.
   */
  async loadConfiguration(profileAddress = null, configNameToLoad = null, customKey = null) {
    const defaultResult = { config: null, reactions: {}, midi: {}, error: null };

    if (!this.checkReadyForRead()) {
      return { ...defaultResult, error: "Public client not ready for reading." };
    }

    const checksummedProfileAddr = getChecksumAddressSafe(profileAddress);
    if (!checksummedProfileAddr) {
      return { ...defaultResult, error: "Invalid profile address format" };
    }

    const logPrefix = `[CS loadConfiguration Addr:${checksummedProfileAddr.slice(0, 6)}]`;
    // console.log(`${logPrefix} Starting load for Name:${configNameToLoad || (customKey ? 'CUSTOM' : 'DEFAULT')}`);

    try {
        let targetConfigKey = customKey;
        let configNameUsed = customKey ? "Custom Key" : configNameToLoad;
        let nameReadFromDefaultPointer = null;

        // Determine Target Config Key
        if (!targetConfigKey && !configNameToLoad) {
            let defaultNameBytes = null;
            try {
                defaultNameBytes = await this.loadDataFromKey(checksummedProfileAddr, RADAR_DEFAULT_CONFIG_NAME_KEY);
            } catch (e) {
                console.warn(`${logPrefix} Error reading default pointer key: ${e.message}`);
            }
            const nameFromPointer = hexToUtf8Safe(defaultNameBytes);
            if (nameFromPointer) {
                nameReadFromDefaultPointer = nameFromPointer;
                configNameUsed = nameFromPointer;
                targetConfigKey = getNamedConfigMapKey(nameFromPointer);
            } else {
                configNameUsed = null;
                targetConfigKey = null;
            }
        } else if (!targetConfigKey && configNameToLoad) {
            configNameUsed = configNameToLoad;
            targetConfigKey = getNamedConfigMapKey(configNameToLoad);
        }

        // Prepare Batch Read
        const dataKeysToFetch = [];
        const keyIndexMap = { config: -1, reactions: -1, midi: -1 };
        if (targetConfigKey) { keyIndexMap.config = dataKeysToFetch.push(targetConfigKey) - 1; }
        keyIndexMap.reactions = dataKeysToFetch.push(RADAR_EVENT_REACTIONS_KEY) - 1;
        keyIndexMap.midi = dataKeysToFetch.push(RADAR_MIDI_MAP_KEY) - 1;

        // Execute Batch Read
        let dataValues = [];
        if (dataKeysToFetch.length > 0) {
            try {
                const batchResults = await this.loadData(checksummedProfileAddr, dataKeysToFetch);
                dataValues = dataKeysToFetch.map(key => batchResults[key]);
            } catch (batchReadError) {
                console.error(`${logPrefix} Error during batch read via loadData:`, batchReadError);
                dataValues = dataKeysToFetch.map(() => null);
            }
        } else if (keyIndexMap.reactions !== -1 && keyIndexMap.midi !== -1) { // Handle globals only if no visual key
            try {
                const globalKeys = [RADAR_EVENT_REACTIONS_KEY, RADAR_MIDI_MAP_KEY];
                const globalResults = await this.loadData(checksummedProfileAddr, globalKeys);
                dataValues = globalKeys.map(key => globalResults[key]);
                keyIndexMap.reactions = 0; // Adjust indices
                keyIndexMap.midi = 1;
            } catch (batchReadError) {
                console.error(`${logPrefix} Error fetching globals only:`, batchReadError);
                dataValues = [null, null];
            }
        }

        // Parse Results
        let parsedConfig = null;
        let parsedReactions = {};
        let parsedMidi = {};

        // Parse Config
        if (keyIndexMap.config !== -1) {
            const configHex = dataValues[keyIndexMap.config];
            if (configHex && configHex !== "0x") {
                const configJson = hexToUtf8Safe(configHex);
                if (configJson) {
                    try {
                        const tempParsed = JSON.parse(configJson);
                        if (tempParsed && typeof tempParsed === "object" && typeof tempParsed.l === 'object' && typeof tempParsed.tA === 'object') {
                            const finalConfigName = nameReadFromDefaultPointer || tempParsed.name || configNameUsed || "Unnamed Config";
                            parsedConfig = { name: String(finalConfigName), ts: tempParsed.ts || 0, layers: tempParsed.l, tokenAssignments: tempParsed.tA };
                        } else { console.warn(`${logPrefix} Parsed config JSON has unexpected structure.`); }
                    } catch (parseError) { console.error(`${logPrefix} Error parsing config JSON:`, parseError); }
                } else { console.warn(`${logPrefix} Failed to decode config hex.`); }
            }
        }

        // Parse Reactions
        if (keyIndexMap.reactions !== -1) {
            const reactionsHex = dataValues[keyIndexMap.reactions];
             if (reactionsHex && reactionsHex !== "0x") {
                 const reactionsJson = hexToUtf8Safe(reactionsHex);
                 if (reactionsJson) {
                    try {
                        const tempParsed = JSON.parse(reactionsJson);
                        if (tempParsed && typeof tempParsed === "object") { parsedReactions = tempParsed; }
                        else { console.warn(`${logPrefix} Parsed reactions JSON is not an object.`); }
                    } catch (parseError) { console.error(`${logPrefix} Error parsing reactions JSON:`, parseError); }
                } else { console.warn(`${logPrefix} Failed to decode reactions hex.`); }
            }
        }

        // Parse MIDI
        if (keyIndexMap.midi !== -1) {
            const midiHex = dataValues[keyIndexMap.midi];
             if (midiHex && midiHex !== "0x") {
                 const midiJson = hexToUtf8Safe(midiHex);
                 if (midiJson) {
                    try {
                        const tempParsed = JSON.parse(midiJson);
                        if (tempParsed && typeof tempParsed === "object") { parsedMidi = tempParsed; }
                        else { console.warn(`${logPrefix} Parsed MIDI JSON is not an object.`); }
                    } catch (parseError) { console.error(`${logPrefix} Error parsing MIDI JSON:`, parseError); }
                } else { console.warn(`${logPrefix} Failed to decode MIDI hex.`); }
            }
        }

        // Ensure config is null if no specific target was loaded
        if (!targetConfigKey && !parsedConfig) {
            parsedConfig = null;
        }

        return { config: parsedConfig, reactions: parsedReactions, midi: parsedMidi, error: null };
    } catch (error) {
        console.error(`${logPrefix} Unexpected error in loadConfiguration:`, error);
        return { ...defaultResult, error: error.message || "Unknown loading error" };
    }
  }

  /**
   * Saves configuration data to the target profile using setData or setDataBatch.
   * Can save visual presets, global reactions, and global MIDI maps selectively.
   * Updates the saved configurations list and default pointer if necessary.
   * Requires the wallet client to be connected and own the target profile.
   *
   * @param {string} targetProfileAddress - The address of the profile to save data to.
   * @param {object} saveData - An object containing the data to save, structured as { layers, tokenAssignments, reactions, midi }.
   * @param {string} configName - The name for the visual preset (required if includeVisuals is true and customKey is null).
   * @param {boolean} [setAsDefault=false] - If true, sets this visual preset as the profile's default.
   * @param {boolean} [includeVisuals=false] - Whether to save the visual configuration (layers, tokenAssignments).
   * @param {boolean} [includeReactions=false] - Whether to save the global reactions configuration.
   * @param {boolean} [includeMidi=false] - Whether to save the global MIDI map configuration.
   * @param {string | null} [customKey=null] - A specific ERC725Y key to save the visual preset to, bypassing naming conventions and list updates.
   * @returns {Promise<{success: boolean, hash: string|null, error?: string}>} Result object indicating success/failure and transaction hash.
   */
  async saveConfiguration(targetProfileAddress, saveData, configName, setAsDefault = false, includeVisuals = false, includeReactions = false, includeMidi = false, customKey = null) {
    const logPrefix = `[CS saveConfiguration Addr:${targetProfileAddress?.slice(0, 6)}]`;

    if (!this.checkReadyForWrite()) throw new Error("Client not ready for writing.");
    const checksummedTargetAddr = getChecksumAddressSafe(targetProfileAddress);
    if (!checksummedTargetAddr) throw new Error("Invalid target profile address format.");
    if (!saveData || typeof saveData !== "object") throw new Error("Invalid saveData object.");
    if (includeVisuals && !configName?.trim() && !customKey) throw new Error("Configuration name required for visual presets.");
    if (!includeVisuals && !includeReactions && !includeMidi) {
      return { success: true, hash: null }; // Nothing to save
    }

    const userAddress = this.walletClient.account.address;
    if (userAddress?.toLowerCase() !== checksummedTargetAddr?.toLowerCase()) {
      throw new Error("Permission denied: Signer does not own the target profile.");
    }

    try {
        const dataKeys = [];
        const dataValues = [];
        const trimmedName = configName?.trim();

        if (includeVisuals) {
            if (!saveData.layers) throw new Error("'layers' data missing for visual save.");
            const configStorageKey = customKey || getNamedConfigMapKey(trimmedName);
            if (!configStorageKey) throw new Error("Could not determine storage key for visual config.");

            const visualConfigToStore = { name: String(trimmedName), ts: Date.now(), l: saveData.layers, tA: saveData.tokenAssignments || {} };
            let visualConfigHex;
            try { visualConfigHex = stringToHex(JSON.stringify(visualConfigToStore)); }
            catch (stringifyError) { throw new Error(`Failed to prepare visual config data: ${stringifyError.message}`); }
            dataKeys.push(configStorageKey); dataValues.push(visualConfigHex);

            // Update list and default pointer only if NOT using a custom key
            if (!customKey) {
                const currentList = await this.loadSavedConfigurations(checksummedTargetAddr);
                if (!currentList.includes(trimmedName)) {
                    const currentIndex = currentList.length;
                    dataKeys.push(getRadarConfigListElementKey(currentIndex)); dataValues.push(stringToHex(trimmedName));
                    dataKeys.push(RADAR_SAVED_CONFIG_LIST_KEY); dataValues.push(numberToHex(BigInt(currentIndex + 1), { size: 16 }));
                }
                if (setAsDefault) {
                    dataKeys.push(RADAR_DEFAULT_CONFIG_NAME_KEY); dataValues.push(stringToHex(trimmedName));
                }
            }
        }

        if (includeReactions) {
            if (saveData.reactions === undefined) throw new Error("'reactions' data missing for save.");
            let reactionsHex;
            try { reactionsHex = stringToHex(JSON.stringify(saveData.reactions || {})); }
            catch (stringifyError) { throw new Error(`Failed to prepare reactions data: ${stringifyError.message}`); }
            dataKeys.push(RADAR_EVENT_REACTIONS_KEY); dataValues.push(reactionsHex);
        }

        if (includeMidi) {
            if (saveData.midi === undefined) throw new Error("'midi' data missing for save.");
            let midiHex;
            try { midiHex = stringToHex(JSON.stringify(saveData.midi || {})); }
            catch (stringifyError) { throw new Error(`Failed to prepare MIDI map data: ${stringifyError.message}`); }
            dataKeys.push(RADAR_MIDI_MAP_KEY); dataValues.push(midiHex);
        }

        if (dataKeys.length === 0) return { success: true, hash: null };

        const isBatch = dataKeys.length > 1;
        const functionName = isBatch ? "setDataBatch" : "setData";
        const args = isBatch ? [dataKeys, dataValues] : [dataKeys[0], dataValues[0]];

        try {
            const hash = await this.walletClient.writeContract({
                address: checksummedTargetAddr, abi: ERC725Y_ABI, functionName, args, account: this.walletClient.account,
            });
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
   * Loads the list of saved configuration preset names from the profile.
   * Reads the array length and then fetches each element key.
   * @param {string} profileAddress - The profile address to read from.
   * @returns {Promise<string[]>} An array of saved preset names. Returns empty array on error or if none found.
   */
  async loadSavedConfigurations(profileAddress) {
    const checksummedProfileAddr = getChecksumAddressSafe(profileAddress);
    if (!this.checkReadyForRead() || !checksummedProfileAddr) {
      console.warn("[CS loadSavedList] Aborted: Client not ready or invalid address.");
      return [];
    }
    const logPrefix = `[CS loadSavedList Addr:${checksummedProfileAddr.slice(0, 6)}]`;
    // console.log(`${logPrefix} Fetching saved configuration list...`);
    try {
        let lengthBytes;
        try {
            lengthBytes = await this.loadDataFromKey(checksummedProfileAddr, RADAR_SAVED_CONFIG_LIST_KEY);
        } catch (readError) {
            if (lengthBytes === null) { return []; } // Handled by loadDataFromKey returning null
            console.error(`${logPrefix} Error reading list length:`, readError.message);
            return [];
        }

        const count = hexBytesToIntegerSafe(lengthBytes);
        if (count <= 0) return [];

        const elementKeys = Array.from({ length: count }, (_, i) => getRadarConfigListElementKey(i));
        let nameValuesBytes = [];
        try {
            const batchResults = await this.loadData(checksummedProfileAddr, elementKeys);
            nameValuesBytes = elementKeys.map(key => batchResults[key]);
        } catch (batchReadError) {
            console.error(`${logPrefix} Error reading list elements:`, batchReadError);
            return [];
        }

        const names = nameValuesBytes
            .map((hex, i) => {
                const name = hexToUtf8Safe(hex);
                if (name === null || name.trim() === "") {
                    console.warn(`${logPrefix} Found null or empty name at index ${i}. Key: ${elementKeys[i]}`);
                }
                return name;
            })
            .filter(name => name !== null && name.trim() !== "");

        // console.log(`${logPrefix} Successfully loaded list:`, names);
        return names;
    } catch (error) {
        console.error(`${logPrefix} Unexpected error loading list:`, error);
        return [];
    }
  }
/**
   * Deletes a named configuration preset from the profile.
   * Clears the preset's Map key, removes it from the Array (adjusting length and potentially moving the last element),
   * and clears the Default pointer if it matches the deleted name.
   * Requires the wallet client to be connected and own the target profile.
   * @param {string} targetProfileAddress - The address of the profile to modify.
   * @param {string} configNameToDelete - The name of the preset to delete.
   * @returns {Promise<{success: boolean, hash: string|null, error?: string}>} Result object indicating success/failure and transaction hash.
   */
async deleteConfiguration(targetProfileAddress, configNameToDelete) {
    const logPrefix = `[CS deleteConfiguration Addr:${targetProfileAddress?.slice(0, 6)} Name:${configNameToDelete}]`;
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

        dataKeysToUpdate.push(getNamedConfigMapKey(trimmedNameToDelete));
        dataValuesToUpdate.push("0x");

        const currentList = await this.loadSavedConfigurations(checksummedTargetAddr);
        const deleteIndex = currentList.findIndex((name) => name === trimmedNameToDelete);

        if (deleteIndex !== -1) {
            const lastIndex = currentList.length - 1;
            if (deleteIndex < lastIndex) {
                dataKeysToUpdate.push(getRadarConfigListElementKey(deleteIndex));
                dataValuesToUpdate.push(stringToHex(currentList[lastIndex]));
            }
            dataKeysToUpdate.push(getRadarConfigListElementKey(lastIndex)); dataValuesToUpdate.push("0x");
            const newLength = BigInt(currentList.length - 1);
            dataKeysToUpdate.push(RADAR_SAVED_CONFIG_LIST_KEY);
            dataValuesToUpdate.push(numberToHex(newLength >= 0 ? newLength : 0, { size: 16 }));
        }

        let defaultNameBytes = null;
        try { defaultNameBytes = await this.loadDataFromKey(checksummedTargetAddr, RADAR_DEFAULT_CONFIG_NAME_KEY); } catch { /* Ignore */ }
        if (defaultNameBytes && hexToUtf8Safe(defaultNameBytes) === trimmedNameToDelete) {
            dataKeysToUpdate.push(RADAR_DEFAULT_CONFIG_NAME_KEY); dataValuesToUpdate.push("0x");
        }

        if (dataKeysToUpdate.length === 0) return { success: true, hash: null };

        try {
            const hash = await this.walletClient.writeContract({ address: checksummedTargetAddr, abi: ERC725Y_ABI, functionName: "setDataBatch", args: [dataKeysToUpdate, dataValuesToUpdate], account: this.walletClient.account });
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
   * Saves arbitrary hex data to a specific ERC725Y key using setData.
   * Requires the wallet client to be connected and own the target profile.
   * @param {string} targetAddress - The profile address to save data to.
   * @param {string} key - The bytes32 data key (must start with '0x' and be 66 chars long).
   * @param {string} valueHex - Data value as a hex string (e.g., '0x123abc', or '0x' to clear).
   * @returns {Promise<{success: boolean, hash: string|null, error?: string}>} Result object indicating success/failure and transaction hash.
   */
  async saveDataToKey(targetAddress, key, valueHex) {
    const logPrefix = `[CS saveDataToKey Addr:${targetAddress?.slice(0, 6) ?? 'N/A'} Key:${key?.slice(0, 15) ?? 'N/A'}...]`;
    if (!this.checkReadyForWrite()) throw new Error("Client not ready for writing.");
    const checksummedTargetAddr = getChecksumAddressSafe(targetAddress);
    if (!checksummedTargetAddr) throw new Error("Invalid target address format.");

    const userAddress = this.walletClient.account.address;
    if (userAddress?.toLowerCase() !== checksummedTargetAddr?.toLowerCase()) {
       throw new Error("Permission denied: Signer does not own the target profile.");
    }

    if (!key || typeof key !== "string" || !key.startsWith("0x") || key.length !== 66) { throw new Error("Data key must be a valid bytes32 hex string."); }
    const finalValueHex = (valueHex === undefined || valueHex === null) ? "0x" : valueHex;
    if (typeof finalValueHex !== "string" || !finalValueHex.startsWith("0x")) { throw new Error("Value must be a valid hex string (0x...)."); }

    try {
        try {
            const hash = await this.walletClient.writeContract({ address: checksummedTargetAddr, abi: ERC725Y_ABI, functionName: "setData", args: [key, finalValueHex], account: this.walletClient.account });
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
   * @param {string} address - Profile address to read from.
   * @param {string} key - The bytes32 data key.
   * @returns {Promise<string|null>} Hex data value ('0x...') or null if not found or error.
   */
  async loadDataFromKey(address, key) {
    if (!this.checkReadyForRead()) {
      console.warn(`[CS loadDataFromKey] Public client not ready for read operations, returning null`);
      return null;
    }

    const checksummedAddress = getChecksumAddressSafe(address);
    if (!checksummedAddress) {
      console.warn(`[CS loadDataFromKey] Invalid address format: ${address}`);
      return null;
    }

    const isKeyValid = typeof key === "string" && key.startsWith("0x") && key.length === 66;
    if (!isKeyValid) {
      console.warn(`[CS loadDataFromKey] Invalid key format: ${key}`);
      return null;
    }

    try {
        const dataValueBytes = await this.publicClient.readContract({
          address: checksummedAddress,
          abi: ERC725Y_ABI,
          functionName: "getData",
          args: [key]
        });

        // Return null if value is '0x' or undefined/null
        if (!dataValueBytes || dataValueBytes === "0x") {
          return null;
        }
        return dataValueBytes;
    } catch (e) {
        // Handle contract read errors (e.g., key not found might revert)
        console.warn(`[CS loadDataFromKey] Error reading key ${key} for ${address.slice(0,6)}: ${e.message}`);
        return null;
    }
  }

  /**
   * Loads raw hex data from multiple ERC725Y keys using a batch call.
   * @param {string} profileAddress - Profile address to read from.
   * @param {string[]} dataKeys - Array of valid bytes32 data keys.
   * @returns {Promise<Object.<string, string|null>>} Object mapping requested keys to hex values (or null if not found/error).
   */
  async loadData(profileAddress, dataKeys = []) {
    const checksummedProfileAddr = getChecksumAddressSafe(profileAddress);
    if (!this.checkReadyForRead()) {
      console.warn(`[CS loadData] Public client not ready for read operations`);
      return {};
    }

    if (!checksummedProfileAddr) {
      console.warn(`[CS loadData] Invalid address format: ${profileAddress}`);
      return {};
    }

    if (!Array.isArray(dataKeys) || dataKeys.length === 0) {
      console.warn(`[CS loadData] No valid data keys provided`);
      return {};
    }

    const validKeys = dataKeys.filter(key => typeof key === "string" && key.startsWith("0x") && key.length === 66);
    if (validKeys.length === 0) {
      console.warn(`[CS loadData] No valid keys in provided array`);
      return {};
    }

    try {
      const dataValuesBytes = await this.publicClient.readContract({
        address: checksummedProfileAddr,
        abi: ERC725Y_ABI,
        functionName: "getDataBatch",
        args: [validKeys]
      });

      const results = {};
      validKeys.forEach((key, i) => {
        results[key] = dataValuesBytes[i] && dataValuesBytes[i] !== "0x" ? dataValuesBytes[i] : null;
      });

      return results;
    } catch (e) {
      console.error(`[CS loadData] readContract (batch) FAILED:`, e.message);
      const results = {};
      validKeys.forEach((key) => { results[key] = null; });
      return results;
    }
  }

  /**
   * Checks if a contract supports the ERC725Y interface (0x5a988c0f).
   * @param {string} address - The contract address.
   * @returns {Promise<boolean>} True if the interface is supported, false otherwise.
   */
  async checkSupportsERC725Y(address) {
    const checksummedAddr = getChecksumAddressSafe(address);
    if (!this.checkReadyForRead() || !checksummedAddr) return false;
    try { return await this.publicClient.readContract({ address: checksummedAddr, abi: ERC725Y_ABI, functionName: "supportsInterface", args: ["0x5a988c0f"] }); }
    catch { return false; }
  }

  /**
   * Retrieves the addresses of assets received by the profile (LSP5ReceivedAssets).
   * Reads the array length and then fetches all asset addresses via batch call.
   * @param {string} profileAddress - The profile address.
   * @returns {Promise<string[]>} Array of checksummed asset addresses. Returns empty array on error or if none found.
   */
  async getOwnedAssetAddresses(profileAddress) {
    const logPrefix = `[CS getOwnedAssetAddresses Addr:${profileAddress?.slice(0, 6) ?? 'N/A'}]`;
    const checksummedProfileAddr = getChecksumAddressSafe(profileAddress);
    if (!this.checkReadyForRead() || !checksummedProfileAddr) {
        console.error(`${logPrefix} Client not ready or invalid address.`); return [];
    }
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
            .map(data => { try { return getAddress(slice(data, 0, 20)); } catch { return null; } })
            .filter(address => address !== null);
        return addresses;
    } catch (error) { console.error(`${logPrefix} Error fetching owned assets:`, error); return []; }
  }

  /**
   * Resolves token assignments to image URLs by fetching LSP4 metadata and applies them to the provided CanvasManagers.
   * Handles different assignment types (demo keys, owned addresses, direct URLs).
   * Uses the ConfigurationService's internal public client for metadata resolution.
   *
   * @param {object} assignments - An object mapping layerId ('1', '2', '3') to assignment data (e.g., 'DEMO_LAYER_X', '0x...', { type: 'owned', iconUrl: '...' }, 'http://...').
   * @param {object} managers - An object mapping layerId ('1', '2', '3') to initialized CanvasManager instances.
   * @param {object} defaultLayerAssets - An object mapping layerId ('1', '2', '3') to default image source URLs used as fallback.
   * @param {object} demoAssetMap - An object mapping demo keys (e.g., 'DEMO_LAYER_1') to their image source URLs.
   * @returns {Promise<void>} A promise that resolves when all image applications have been attempted.
   */
  async applyTokenAssignmentsToManagers(assignments, managers, defaultLayerAssets, demoAssetMap) {
    const logPrefix = "[CS applyTokenAssignmentsToManagers]";
    if (!this.checkReadyForRead()) {
      console.warn(`${logPrefix} Aborted: Client not ready.`);
      return;
    }
    if (!managers || !assignments || !defaultLayerAssets || !demoAssetMap) {
      console.warn(`${logPrefix} Aborted: Missing required arguments.`);
      return;
    }

    const layerIdsToProcess = ['1', '2', '3'];
    const promises = layerIdsToProcess.map(async (layerId) => {
        const manager = managers[layerId];
        if (!manager) {
            console.warn(`${logPrefix} L${layerId}: No manager found.`);
            return;
        }

        const assignmentValue = assignments[layerId];
        const defaultAssetSrc = defaultLayerAssets[layerId];
        let imageSourceToApply = defaultAssetSrc; // Default to fallback

        try {
            if (typeof assignmentValue === 'string' && assignmentValue.startsWith("DEMO_LAYER_")) {
                const demoAssetSource = demoAssetMap[assignmentValue];
                if (demoAssetSource) { imageSourceToApply = demoAssetSource; }
                else { console.warn(`${logPrefix} L${layerId}: Demo key '${assignmentValue}' not found in map.`); }
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
                    else { console.warn(`${logPrefix} L${layerId}: Could not resolve image URL from LSP4 metadata for ${assignmentValue}`); }
                } catch (error) { console.error(`${logPrefix} L${layerId}: Error resolving LSP4 for ${assignmentValue}:`, error); }
            } else if (typeof assignmentValue === 'string' && (assignmentValue.includes('/') || assignmentValue.startsWith('data:'))) {
                 imageSourceToApply = assignmentValue;
            } else if (assignmentValue) {
                 console.warn(`${logPrefix} L${layerId}: Unhandled assignment type or value:`, assignmentValue);
            }

            // Apply the determined image source
            if (manager.setImage) {
                if (imageSourceToApply) {
                    await manager.setImage(imageSourceToApply);
                } else {
                    console.warn(`${logPrefix} L${layerId}: imageSourceToApply is null/undefined, applying default: ${defaultAssetSrc}`);
                    if (defaultAssetSrc) await manager.setImage(defaultAssetSrc);
                }
            } else {
                 console.warn(`${logPrefix} L${layerId}: manager.setImage is not available.`);
            }

        } catch (error) {
            console.error(`${logPrefix} L${layerId}: ERROR processing assignment '${JSON.stringify(assignmentValue)}': `, error);
            try {
                if (defaultAssetSrc && manager.setImage) {
                    console.warn(`${logPrefix} L${layerId}: Reverting to default image due to error.`);
                    await manager.setImage(defaultAssetSrc);
                }
            }
            catch (revertError) { console.error(`${logPrefix} Failed to revert L${layerId} to default after error:`, revertError); }
        }
    });

    await Promise.all(promises);
    // console.log(`${logPrefix} All token assignment applications attempted.`); // Optional: Keep if needed
  }
}

export default ConfigurationService;