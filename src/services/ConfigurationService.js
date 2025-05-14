// src/services/ConfigurationService.js
import {
  hexToString, stringToHex, numberToHex,
  getAddress, slice, isAddress,
} from "viem";

import {
  RADAR_SAVED_CONFIG_LIST_KEY, RADAR_DEFAULT_CONFIG_NAME_KEY,
  RADAR_MIDI_MAP_KEY, RADAR_EVENT_REACTIONS_KEY,
  getNamedConfigMapKey, getRadarConfigListElementKey, IPFS_GATEWAY,
} from "../config/global-config";
import { resolveLsp4Metadata } from '../utils/erc725.js'; // Assuming this utility expects a ConfigurationService-like instance

import { ERC725YDataKeys } from '@lukso/lsp-smart-contracts';
import { Buffer } from 'buffer'; // Node.js Buffer for environments where it's not global

// Polyfill window.Buffer if it's not available (e.g., in some browser environments)
if (typeof window !== 'undefined' && typeof window.Buffer === 'undefined') {
  window.Buffer = Buffer;
}

const ERC725Y_ABI = [
  { inputs: [{ type: "bytes32", name: "dataKey" }], name: "getData", outputs: [{ type: "bytes", name: "dataValue" }], stateMutability: "view", type: "function" },
  { inputs: [{ type: "bytes32[]", name: "dataKeys" }], name: "getDataBatch", outputs: [{ type: "bytes[]", name: "dataValues" }], stateMutability: "view", type: "function" },
  { inputs: [{ type: "bytes32", name: "dataKey" }, { type: "bytes", name: "dataValue" }], name: "setData", outputs: [], stateMutability: "payable", type: "function" },
  { inputs: [{ type: "bytes32[]", name: "dataKeys" }, { type: "bytes[]", name: "dataValues" }], name: "setDataBatch", outputs: [], stateMutability: "payable", type: "function" },
  { name: "supportsInterface", inputs: [{ type: "bytes4", name: "interfaceId" }], outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
];

/**
 * Safely converts a hex string to a UTF-8 string.
 * Returns null if the hex is invalid, empty, or decoding fails.
 * @param {string | null | undefined} hex - The hex string to convert (e.g., "0x...").
 * @returns {string | null} The decoded UTF-8 string, or null on failure.
 */
export function hexToUtf8Safe(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("0x") || hex === "0x") return null;
  try { return hexToString(hex); }
  catch { return null; }
}

/**
 * Safely converts a hex string (bytes) to an integer.
 * Handles potential BigInt overflow by capping at Number.MAX_SAFE_INTEGER.
 * Returns 0 if the hex is invalid, empty, or conversion fails.
 * @param {string | null | undefined} hex - The hex string to convert (e.g., "0x...").
 * @returns {number} The converted integer, or 0 on failure/empty.
 */
export function hexBytesToIntegerSafe(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("0x") || hex === "0x") return 0;
  try {
    const bigIntValue = BigInt(hex);
    if (bigIntValue > BigInt(Number.MAX_SAFE_INTEGER)) {
      if (import.meta.env.DEV) {
        console.warn(`[hexBytesToIntegerSafe] Value ${hex} exceeds MAX_SAFE_INTEGER. Capping.`);
      }
      return Number.MAX_SAFE_INTEGER;
    }
    return Number(bigIntValue);
  } catch { return 0; }
}

/**
 * Safely gets a checksummed address.
 * Returns null if the address is not a string or invalid.
 * @param {string | null | undefined} address - The address string.
 * @returns {string | null} The checksummed address or null.
 */
function getChecksumAddressSafe(address) {
  if (typeof address !== 'string') return null;
  try { return getAddress(address.trim()); }
  catch { return null; }
}

/**
 * @typedef {object} ParsedVisualConfig
 * @property {string} name - Name of the configuration.
 * @property {number} ts - Timestamp of when the configuration was saved.
 * @property {object} layers - Layer configurations, keyed by layer ID. (Mapped from 'l')
 * @property {object} tokenAssignments - Token assignments, keyed by layer ID. (Mapped from 'tA')
 */

/**
 * @typedef {object} LoadedConfigurationData
 * @property {ParsedVisualConfig|null} config - The main visual configuration object. Null if not found or error.
 * @property {object} reactions - Global event reactions. Empty object if not found or error.
 * @property {object} midi - Global MIDI map. Empty object if not found or error.
 * @property {string|null} error - Error message if loading failed, null otherwise.
 */

/**
 * @typedef {object} SaveOperationResult
 * @property {boolean} success - True if the save operation (transaction submission) was successful.
 * @property {string|null} hash - The transaction hash if successful, null otherwise.
 */


/**
 * Service class for interacting with ERC725Y compatible smart contracts
 * to load and save application configurations (visual presets, reactions, MIDI maps)
 * stored on a Universal Profile.
 */
class ConfigurationService {
  /** @type {import('viem').WalletClient | null} */
  walletClient = null;
  /** @type {import('viem').PublicClient | null} */
  publicClient = null;
  /** @type {boolean} */
  readReady = false;
  /** @type {boolean} */
  writeReady = false;

  /**
   * Creates an instance of ConfigurationService.
   * @param {any} _provider - The underlying provider (e.g., from Ethers.js or Web3.js, currently unused directly but kept for historical reasons or future use).
   * @param {import('viem').WalletClient | null} walletClient - The Viem WalletClient for write operations.
   * @param {import('viem').PublicClient | null} publicClient - The Viem PublicClient for read operations.
   */
  constructor(_provider, walletClient, publicClient) {
    this.walletClient = walletClient;
    this.publicClient = publicClient;
    this.readReady = !!publicClient;
    this.writeReady = !!publicClient && !!walletClient?.account;
  }

  /**
   * Initializes or re-checks the readiness of the service.
   * @async
   * @returns {Promise<boolean>} True if the service is ready for read operations.
   */
  async initialize() {
    this.readReady = !!this.publicClient;
    this.writeReady = this.readReady && !!this.walletClient?.account;
    return this.readReady;
  }

  /**
   * Gets the address of the currently connected user via WalletClient.
   * @returns {string | null} The user's address, or null if not connected.
   */
  getUserAddress() {
    return this.walletClient?.account?.address ?? null;
  }

  /**
   * Checks and updates the service's readiness for read operations.
   * @returns {boolean} True if ready for reads, false otherwise.
   */
  checkReadyForRead() {
    this.readReady = !!this.publicClient;
    return this.readReady;
  }

  /**
   * Checks and updates the service's readiness for write operations.
   * @returns {boolean} True if ready for writes, false otherwise.
   */
  checkReadyForWrite() {
    this.readReady = !!this.publicClient; // Write readiness depends on read readiness
    this.writeReady = this.readReady && !!this.walletClient?.account;
    return this.writeReady;
  }

  /**
   * Loads a complete configuration set (visual preset, reactions, MIDI map) for a profile.
   * If `configNameToLoad` is null, it attempts to load the default configuration.
   * If `customKey` is provided, it loads the visual config from that specific key.
   * Always attempts to load global reactions and MIDI map.
   * @param {string | null} profileAddress - The address of the Universal Profile.
   * @param {string | null} [configNameToLoad=null] - The name of the visual preset to load.
   * @param {string | null} [customKey=null] - A specific ERC725Y data key to load the visual config from, bypassing name resolution.
   * @returns {Promise<LoadedConfigurationData>} The loaded configuration data.
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
    if (import.meta.env.DEV) {
        console.log(`${logPrefix} Starting load for Name:${configNameToLoad || (customKey ? 'CUSTOM KEY' : 'DEFAULT (or fallback)')}`);
    }

    try {
        let targetConfigKey = customKey;
        let configNameUsed = customKey ? "Custom Key" : configNameToLoad;
        let nameReadFromDefaultPointer = null;

        if (!targetConfigKey && !configNameToLoad) { // Attempt to load default
            let defaultNameBytes = null;
            try {
                defaultNameBytes = await this.loadDataFromKey(checksummedProfileAddr, RADAR_DEFAULT_CONFIG_NAME_KEY);
            } catch (e) {
                if (import.meta.env.DEV) {
                    console.warn(`${logPrefix} Error reading default pointer key: ${e.message}`);
                }
            }
            const nameFromPointer = hexToUtf8Safe(defaultNameBytes);
            if (nameFromPointer) {
                nameReadFromDefaultPointer = nameFromPointer;
                configNameUsed = nameFromPointer;
                targetConfigKey = getNamedConfigMapKey(nameFromPointer);
                if (import.meta.env.DEV) {
                    console.log(`${logPrefix} Found default pointer: '${nameFromPointer}', Target Key: ${targetConfigKey}`);
                }
            } else {
                if (import.meta.env.DEV) {
                    console.log(`${logPrefix} No default pointer found. Will attempt to load globals and return null for config.`);
                }
                configNameUsed = null;
                targetConfigKey = null;
            }
        } else if (!targetConfigKey && configNameToLoad) { // Load by specific name
            configNameUsed = configNameToLoad;
            targetConfigKey = getNamedConfigMapKey(configNameToLoad);
            if (import.meta.env.DEV) {
                console.log(`${logPrefix} Using provided name: '${configNameToLoad}', Target Key: ${targetConfigKey}`);
            }
        } else if (targetConfigKey && import.meta.env.DEV) { // Load by custom key
             console.log(`${logPrefix} Using custom key: ${targetConfigKey}`);
        }

        const dataKeysToFetch = [];
        const keyIndexMap = { config: -1, reactions: -1, midi: -1 };

        if (targetConfigKey) {
            keyIndexMap.config = dataKeysToFetch.push(targetConfigKey) - 1;
        }
        keyIndexMap.reactions = dataKeysToFetch.push(RADAR_EVENT_REACTIONS_KEY) - 1;
        keyIndexMap.midi = dataKeysToFetch.push(RADAR_MIDI_MAP_KEY) - 1;

        let dataValues = [];
        if (dataKeysToFetch.length > 0) {
            try {
                const batchResults = await this.loadData(checksummedProfileAddr, dataKeysToFetch);
                dataValues = dataKeysToFetch.map(key => batchResults[key]);
            } catch (batchReadError) {
                if (import.meta.env.DEV) {
                    console.error(`${logPrefix} Error during batch read via loadData:`, batchReadError);
                }
                return { ...defaultResult, error: `Batch read failed: ${batchReadError.message}` };
            }
        } else {
             if (import.meta.env.DEV) {
                console.warn(`${logPrefix} No keys prepared for fetching (this is unexpected).`);
             }
             return defaultResult;
        }

        let parsedConfig = null;
        let parsedReactions = {};
        let parsedMidi = {};

        if (keyIndexMap.config !== -1) {
            const configHex = dataValues[keyIndexMap.config];
            if (configHex && configHex !== "0x") {
                const configJson = hexToUtf8Safe(configHex);
                if (configJson) {
                    try {
                        const tempParsed = JSON.parse(configJson);
                        if (import.meta.env.DEV) {
                            console.log(`${logPrefix} Raw parsed JSON for config:`, JSON.stringify(tempParsed).substring(0, 500) + "...");
                        }
                        if (tempParsed && typeof tempParsed === "object" && typeof tempParsed.l === 'object' && typeof tempParsed.tA === 'object') {
                            const finalConfigName = nameReadFromDefaultPointer || tempParsed.name || configNameUsed || "Unnamed Config";
                            // ** CRITICAL: Map 'l' to 'layers' and 'tA' to 'tokenAssignments' **
                            // This matches the structure your "old correct log" implies the rest of the app expects.
                            parsedConfig = {
                                name: String(finalConfigName),
                                ts: tempParsed.ts || 0,
                                layers: tempParsed.l,          // Map 'l' to 'layers'
                                tokenAssignments: tempParsed.tA // Map 'tA' to 'tokenAssignments'
                            };
                            if (import.meta.env.DEV) {
                                console.log(`${logPrefix} Successfully parsed and structured config: '${parsedConfig.name}'`);
                            }
                        } else if (import.meta.env.DEV) {
                            console.warn(`${logPrefix} Parsed config JSON missing 'l' or 'tA' keys, or not an object. Structure:`, tempParsed);
                        }
                    } catch (parseError) {
                        if (import.meta.env.DEV) {
                            console.error(`${logPrefix} Error parsing config JSON:`, parseError);
                        }
                    }
                } else if (import.meta.env.DEV) {
                    console.warn(`${logPrefix} Failed to decode config hex to string.`);
                }
            } else if (import.meta.env.DEV) {
                 console.log(`${logPrefix} No data found for config key ${targetConfigKey}. Config will be null.`);
            }
        } else if (import.meta.env.DEV) {
             console.log(`${logPrefix} No targetConfigKey was determined. Config will be null.`);
        }

        if (keyIndexMap.reactions !== -1) {
            const reactionsHex = dataValues[keyIndexMap.reactions];
             if (reactionsHex && reactionsHex !== "0x") {
                 const reactionsJson = hexToUtf8Safe(reactionsHex);
                 if (reactionsJson) {
                    try {
                        const tempParsed = JSON.parse(reactionsJson);
                        if (tempParsed && typeof tempParsed === "object") {
                            parsedReactions = tempParsed;
                        } else if (import.meta.env.DEV) { console.warn(`${logPrefix} Parsed reactions JSON is not an object.`); }
                    } catch (parseError) { if (import.meta.env.DEV) console.error(`${logPrefix} Error parsing reactions JSON:`, parseError); }
                } else if (import.meta.env.DEV) { console.warn(`${logPrefix} Failed to decode reactions hex.`); }
            }
        }

        if (keyIndexMap.midi !== -1) {
            const midiHex = dataValues[keyIndexMap.midi];
             if (midiHex && midiHex !== "0x") {
                 const midiJson = hexToUtf8Safe(midiHex);
                 if (midiJson) {
                    try {
                        const tempParsed = JSON.parse(midiJson);
                        if (tempParsed && typeof tempParsed === "object") {
                            parsedMidi = tempParsed;
                        } else if (import.meta.env.DEV) { console.warn(`${logPrefix} Parsed MIDI JSON is not an object.`); }
                    } catch (parseError) { if (import.meta.env.DEV) console.error(`${logPrefix} Error parsing MIDI JSON:`, parseError); }
                } else if (import.meta.env.DEV) { console.warn(`${logPrefix} Failed to decode MIDI hex.`); }
            }
        }

        if (import.meta.env.DEV) {
            console.log(`${logPrefix} Load complete. Returning: config name: ${parsedConfig?.name || 'null'}, reactions keys: ${Object.keys(parsedReactions).length}, midi keys: ${Object.keys(parsedMidi).length}`);
        }
        return { config: parsedConfig, reactions: parsedReactions, midi: parsedMidi, error: null };

    } catch (error) {
        if (import.meta.env.DEV) {
            console.error(`${logPrefix} Unexpected error in loadConfiguration:`, error);
        }
        return { ...defaultResult, error: error.message || "Unknown loading error" };
    }
  }

  /**
   * Saves configuration data to a profile.
   * Can save visual preset, reactions, and/or MIDI map based on flags.
   * @param {string} targetProfileAddress - The address of the Universal Profile to save to.
   * @param {object} saveData - Object containing the data to save. Expected to have `saveData.layers` and `saveData.tokenAssignments` if `includeVisuals` is true.
   * @param {string} configName - Name of the visual preset (required if `includeVisuals` is true and no `customKey`).
   * @param {boolean} [setAsDefault=false] - If true, sets this visual preset as the default.
   * @param {boolean} [includeVisuals=false] - If true, saves visual preset data.
   * @param {boolean} [includeReactions=false] - If true, saves event reactions data.
   * @param {boolean} [includeMidi=false] - If true, saves MIDI map data.
   * @param {string | null} [customKey=null] - A specific ERC725Y data key to save the visual config to, bypassing name-based list management.
   * @returns {Promise<SaveOperationResult>} Result of the save operation.
   * @throws {Error} If client not ready, invalid input, or transaction fails.
   */
  async saveConfiguration(targetProfileAddress, saveData, configName, setAsDefault = false, includeVisuals = false, includeReactions = false, includeMidi = false, customKey = null) {
    const logPrefix = `[CS saveConfiguration Addr:${targetProfileAddress?.slice(0, 6)}]`;

    if (!this.checkReadyForWrite()) throw new Error("Client not ready for writing.");
    const checksummedTargetAddr = getChecksumAddressSafe(targetProfileAddress);
    if (!checksummedTargetAddr) throw new Error("Invalid target profile address format.");
    if (!saveData || typeof saveData !== "object") throw new Error("Invalid saveData object.");
    if (includeVisuals && !configName?.trim() && !customKey) throw new Error("Configuration name required for visual presets.");
    if (!includeVisuals && !includeReactions && !includeMidi) {
      return { success: true, hash: null };
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

            // Structure for on-chain storage uses 'l' and 'tA'
            const visualConfigToStore = {
                name: String(trimmedName),
                ts: Date.now(),
                l: saveData.layers, // Assumes saveData.layers is the correct structure
                tA: saveData.tokenAssignments || {} // Assumes saveData.tokenAssignments is correct
            };
            let visualConfigHex;
            try { visualConfigHex = stringToHex(JSON.stringify(visualConfigToStore)); }
            catch (stringifyError) { throw new Error(`Failed to prepare visual config data: ${stringifyError.message}`); }
            dataKeys.push(configStorageKey); dataValues.push(visualConfigHex);

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
            if (import.meta.env.DEV) {
                console.error(`${logPrefix} ${functionName} FAILED:`, writeError);
            }
            const baseError = writeError.cause || writeError;
            const message = baseError?.shortMessage || writeError.message || "Unknown write error";
            throw new Error(`Transaction failed: ${message}`);
        }
    } catch (error) {
        if (import.meta.env.DEV) {
            console.error(`${logPrefix} Error during saveConfiguration processing:`, error);
        }
        throw new Error(error.message || "Unexpected error during save process.");
    }
  }

  /**
   * Loads the list of saved visual preset names from a profile.
   * @param {string} profileAddress - The address of the Universal Profile.
   * @returns {Promise<string[]>} A list of saved configuration names. Returns empty array on error or if none found.
   */
  async loadSavedConfigurations(profileAddress) {
    const checksummedProfileAddr = getChecksumAddressSafe(profileAddress);
    if (!this.checkReadyForRead() || !checksummedProfileAddr) {
      if (import.meta.env.DEV) {
        console.warn("[CS loadSavedList] Aborted: Client not ready or invalid address.");
      }
      return [];
    }
    const logPrefix = `[CS loadSavedList Addr:${checksummedProfileAddr.slice(0, 6)}]`;
    try {
        let lengthBytes;
        try {
            lengthBytes = await this.loadDataFromKey(checksummedProfileAddr, RADAR_SAVED_CONFIG_LIST_KEY);
        } catch (readError) {
            if (import.meta.env.DEV) {
                console.error(`${logPrefix} Error reading list length:`, readError.message);
            }
            return [];
        }

        if (lengthBytes === null) {
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
            if (import.meta.env.DEV) {
                console.error(`${logPrefix} Error reading list elements:`, batchReadError);
            }
            return [];
        }

        const names = nameValuesBytes
            .map((hex, i) => {
                const name = hexToUtf8Safe(hex);
                if ((name === null || name.trim() === "") && import.meta.env.DEV) {
                    console.warn(`${logPrefix} Found null or empty name at index ${i}. Key: ${elementKeys[i]}`);
                }
                return name;
            })
            .filter(name => name !== null && name.trim() !== "");
        return names;
    } catch (error) {
        if (import.meta.env.DEV) {
            console.error(`${logPrefix} Unexpected error loading list:`, error);
        }
        return [];
    }
  }

  /**
   * Deletes a named visual preset from a profile.
   * @param {string} targetProfileAddress - The address of the Universal Profile.
   * @param {string} configNameToDelete - The name of the configuration to delete.
   * @returns {Promise<SaveOperationResult>} Result of the delete operation.
   * @throws {Error} If client not ready, invalid input, or transaction fails.
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
            if (import.meta.env.DEV) {
                console.error(`${logPrefix} Delete (setDataBatch) FAILED:`, writeError);
            }
            const baseError = writeError.cause || writeError;
            const message = baseError?.shortMessage || writeError.message || "Unknown delete error";
            throw new Error(`Deletion transaction failed: ${message}`);
        }
    } catch (error) {
        if (import.meta.env.DEV) {
            console.error(`${logPrefix} Error deleting configuration:`, error);
        }
        throw new Error(error.message || `Unexpected error during deletion.`);
    }
  }

  /**
   * Saves a single hex value to a specific data key on a profile.
   * @param {string} targetAddress - The address of the Universal Profile.
   * @param {string} key - The ERC725Y data key (bytes32 hex string).
   * @param {string} valueHex - The hex string value to save. Use "0x" to clear.
   * @returns {Promise<SaveOperationResult>} Result of the save operation.
   * @throws {Error} If client not ready, invalid input, or transaction fails.
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
        const hash = await this.walletClient.writeContract({ address: checksummedTargetAddr, abi: ERC725Y_ABI, functionName: "setData", args: [key, finalValueHex], account: this.walletClient.account });
        return { success: true, hash };
    } catch (writeError) {
        if (import.meta.env.DEV) {
            console.error(`${logPrefix} setData FAILED:`, writeError);
        }
        const baseError = writeError.cause || writeError;
        const message = baseError?.shortMessage || writeError.message || "Unknown setData error";
        throw new Error(`Set data transaction failed: ${message}`);
    }
  }

  /**
   * Loads a single hex value from a specific data key on a profile.
   * @param {string} address - The address of the Universal Profile.
   * @param {string} key - The ERC725Y data key (bytes32 hex string).
   * @returns {Promise<string | null>} The hex string value (could be "0x" for empty), or null if key not found, error, or invalid input.
   */
  async loadDataFromKey(address, key) {
    if (!this.checkReadyForRead()) {
      if (import.meta.env.DEV) {
        console.warn(`[CS loadDataFromKey] Public client not ready for read operations, returning null`);
      }
      return null;
    }

    const checksummedAddress = getChecksumAddressSafe(address);
    if (!checksummedAddress) {
      if (import.meta.env.DEV) {
        console.warn(`[CS loadDataFromKey] Invalid address format: ${address}`);
      }
      return null;
    }

    const isKeyValid = typeof key === "string" && key.startsWith("0x") && key.length === 66;
    if (!isKeyValid) {
      if (import.meta.env.DEV) {
        console.warn(`[CS loadDataFromKey] Invalid key format: ${key}`);
      }
      return null;
    }

    try {
        const dataValueBytes = await this.publicClient.readContract({
          address: checksummedAddress,
          abi: ERC725Y_ABI,
          functionName: "getData",
          args: [key]
        });
        if (dataValueBytes === undefined || dataValueBytes === null) {
            return null;
        }
        return dataValueBytes;
    } catch (e) {
        if (import.meta.env.DEV) {
            console.warn(`[CS loadDataFromKey] Error reading key ${key} for ${address.slice(0,6)}...: ${e.message}`);
        }
        return null;
    }
  }

  /**
   * Loads multiple hex values from a batch of data keys on a profile.
   * @param {string} profileAddress - The address of the Universal Profile.
   * @param {string[]} [dataKeys=[]] - An array of ERC725Y data keys (bytes32 hex strings).
   * @returns {Promise<Object.<string, string | null>>} An object mapping keys to their hex string values. Value is null if not found or error for that key. "0x" is a valid empty value.
   */
  async loadData(profileAddress, dataKeys = []) {
    const checksummedProfileAddr = getChecksumAddressSafe(profileAddress);
    if (!this.checkReadyForRead()) {
      if (import.meta.env.DEV) {
        console.warn(`[CS loadData] Public client not ready for read operations`);
      }
      return {};
    }

    if (!checksummedProfileAddr) {
      if (import.meta.env.DEV) {
        console.warn(`[CS loadData] Invalid address format: ${profileAddress}`);
      }
      return {};
    }

    if (!Array.isArray(dataKeys) || dataKeys.length === 0) {
      if (import.meta.env.DEV) {
        console.warn(`[CS loadData] No valid data keys provided`);
      }
      return {};
    }

    const validKeys = dataKeys.filter(key => typeof key === "string" && key.startsWith("0x") && key.length === 66);
    if (validKeys.length === 0) {
      if (import.meta.env.DEV) {
        console.warn(`[CS loadData] No valid keys in provided array`);
      }
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
        results[key] = (dataValuesBytes[i] === undefined || dataValuesBytes[i] === null) ? null : dataValuesBytes[i];
      });
      return results;
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error(`[CS loadData] readContract (getDataBatch) FAILED for ${checksummedProfileAddr}:`, e.message);
      }
      const results = {};
      validKeys.forEach((key) => { results[key] = null; });
      return results;
    }
  }

  /**
   * Checks if a contract at a given address supports the ERC725Y interface.
   * @param {string} address - The contract address.
   * @returns {Promise<boolean>} True if ERC725Y is supported, false otherwise or on error.
   */
  async checkSupportsERC725Y(address) {
    const checksummedAddr = getChecksumAddressSafe(address);
    if (!this.checkReadyForRead() || !checksummedAddr) return false;
    try {
        return await this.publicClient.readContract({
            address: checksummedAddr,
            abi: ERC725Y_ABI,
            functionName: "supportsInterface",
            args: ["0x5a988c0f"]
        });
    }
    catch { return false; }
  }

  /**
   * Retrieves a list of owned asset addresses (LSP5ReceivedAssets) from a profile.
   * @param {string} profileAddress - The address of the Universal Profile.
   * @returns {Promise<string[]>} A list of checksummed asset addresses. Returns empty array on error or if none found.
   */
  async getOwnedAssetAddresses(profileAddress) {
    const logPrefix = `[CS getOwnedAssetAddresses Addr:${profileAddress?.slice(0, 6) ?? 'N/A'}]`;
    const checksummedProfileAddr = getChecksumAddressSafe(profileAddress);
    if (!this.checkReadyForRead() || !checksummedProfileAddr) {
        if (import.meta.env.DEV) {
            console.error(`${logPrefix} Client not ready or invalid address.`);
        }
        return [];
    }
    const lsp5ArrayLengthKey = ERC725YDataKeys.LSP5['LSP5ReceivedAssets[]'].length;
    const lsp5BaseIndexKey = ERC725YDataKeys.LSP5['LSP5ReceivedAssets[]'].index;
    try {
        const lengthDataMap = await this.loadData(checksummedProfileAddr, [lsp5ArrayLengthKey]);
        const arrayLengthHex = lengthDataMap?.[lsp5ArrayLengthKey];
        const arrayLength = hexBytesToIntegerSafe(arrayLengthHex);

        if (arrayLength === 0) return [];

        const elementKeys = Array.from({ length: arrayLength }, (_, i) => {
            return lsp5BaseIndexKey + numberToHex(BigInt(i), { size: 16 }).slice(2);
        });

        const elementDataMap = await this.loadData(checksummedProfileAddr, elementKeys);
        const addresses = elementKeys
            .map(key => elementDataMap[key])
            .filter(data => data && data !== '0x')
            .map(data => {
                try {
                    return getAddress(slice(data, 0, 20));
                } catch { return null; }
            })
            .filter(address => address !== null);
        return addresses;
    } catch (error) {
        if (import.meta.env.DEV) {
            console.error(`${logPrefix} Error fetching owned assets:`, error);
        }
        return [];
    }
  }

  /**
   * Applies token assignments to a set of canvas managers.
   * @param {Object.<string, any>} assignments - An object mapping layer IDs to assignment values.
   * @param {Object.<string, {setImage: (src: string) => Promise<void>}>} managers - Canvas managers, keyed by layer ID.
   * @param {Object.<string, string>} defaultLayerAssets - Default asset URLs for layers, keyed by layer ID.
   * @param {Object.<string, string>} demoAssetMap - A map of demo asset keys to their URLs.
   * @returns {Promise<void>} A promise that resolves when all image setting attempts are settled.
   */
  async applyTokenAssignmentsToManagers(assignments, managers, defaultLayerAssets, demoAssetMap) {
    const logPrefix = "[CS applyTokenAssignmentsToManagers]";
    if (!this.checkReadyForRead()) {
      if (import.meta.env.DEV) {
        console.warn(`${logPrefix} Aborted: Client not ready.`);
      }
      return;
    }
    if (!managers || !assignments || !defaultLayerAssets || !demoAssetMap) {
      if (import.meta.env.DEV) {
        console.warn(`${logPrefix} Aborted: Missing required arguments.`);
      }
      return;
    }

    const layerIdsToProcess = ['1', '2', '3'];
    const promises = layerIdsToProcess.map(async (layerId) => {
        const manager = managers[layerId];
        if (!manager) {
            if (import.meta.env.DEV) {
                console.warn(`${logPrefix} L${layerId}: No manager found.`);
            }
            return;
        }

        const assignmentValue = assignments[layerId];
        const defaultAssetSrc = defaultLayerAssets[layerId];
        let imageSourceToApply = defaultAssetSrc;

        try {
            if (typeof assignmentValue === 'string' && assignmentValue.startsWith("DEMO_LAYER_")) {
                const demoAssetSource = demoAssetMap[assignmentValue];
                if (demoAssetSource) { imageSourceToApply = demoAssetSource; }
                else if (import.meta.env.DEV) { console.warn(`${logPrefix} L${layerId}: Demo key '${assignmentValue}' not found in map.`); }
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
                    else if (import.meta.env.DEV) { console.warn(`${logPrefix} L${layerId}: Could not resolve image URL from LSP4 metadata for ${assignmentValue}`); }
                } catch (error) {
                    if (import.meta.env.DEV) {
                        console.error(`${logPrefix} L${layerId}: Error resolving LSP4 for ${assignmentValue}:`, error);
                    }
                }
            } else if (typeof assignmentValue === 'string' && (assignmentValue.includes('/') || assignmentValue.startsWith('data:'))) {
                 imageSourceToApply = assignmentValue;
            } else if (assignmentValue === null || assignmentValue === undefined) {
                imageSourceToApply = defaultAssetSrc;
            } else if (assignmentValue && import.meta.env.DEV) {
                 console.warn(`${logPrefix} L${layerId}: Unhandled assignment type or value:`, assignmentValue);
            }

            if (manager.setImage && typeof manager.setImage === 'function') {
                if (imageSourceToApply) {
                    await manager.setImage(imageSourceToApply);
                } else if (import.meta.env.DEV) {
                    console.warn(`${logPrefix} L${layerId}: No image source to apply (neither from assignment nor default).`);
                }
            } else if (import.meta.env.DEV) {
                 console.warn(`${logPrefix} L${layerId}: manager.setImage is not available or not a function.`);
            }

        } catch (error) {
            if (import.meta.env.DEV) {
                console.error(`${logPrefix} L${layerId}: ERROR processing assignment '${JSON.stringify(assignmentValue)}': `, error);
            }
            try {
                if (defaultAssetSrc && manager.setImage && typeof manager.setImage === 'function') {
                    if (import.meta.env.DEV) {
                        console.warn(`${logPrefix} L${layerId}: Reverting to default image due to error.`);
                    }
                    await manager.setImage(defaultAssetSrc);
                }
            }
            catch (revertError) {
                if (import.meta.env.DEV) {
                    console.error(`${logPrefix} Failed to revert L${layerId} to default after error:`, revertError);
                }
            }
        }
    });
    await Promise.allSettled(promises);
  }
}

export default ConfigurationService;