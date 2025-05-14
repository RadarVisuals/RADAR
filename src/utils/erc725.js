// src/utils/erc725.js
import { getAddress, hexToString, decodeAbiParameters, parseAbiParameters } from 'viem';
import { ERC725YDataKeys } from '@lukso/lsp-smart-contracts';
import { Buffer } from 'buffer';

// Ensure Buffer is polyfilled in environments where it's not globally available (like browsers)
// This is often handled by build tools (like Vite/Webpack) based on configuration.
if (typeof window !== 'undefined' && typeof window.Buffer === 'undefined') {
  window.Buffer = Buffer;
}

const IPFS_GATEWAY = import.meta.env.VITE_IPFS_GATEWAY || 'https://api.universalprofile.cloud/ipfs/';

/**
 * @typedef {object} DecodedDataItem
 * @property {string} keyName - The original key name from the input.
 * @property {string} value - The original hex value from the input.
 */

/**
 * Decodes ERC725Y data items based on a schema hint.
 * Currently supports decoding the RadarWhitelist address array (both ABI-encoded and legacy JSON format).
 * Falls back to returning raw data items (keyName, value) for unknown schema hints or if decoding fails.
 *
 * @param {Array<{keyName: string, value: string}>} dataItems - Array of data items fetched from ERC725Y storage. Expected to contain the relevant key for the schemaHint.
 * @param {string} schemaHint - A hint indicating the expected schema (e.g., 'SupportedStandards:RadarWhitelist').
 * @returns {Array<string> | Array<DecodedDataItem>} Decoded data (e.g., array of addresses for RadarWhitelist) or the original items if decoding fails or hint is unknown. Returns an empty array if input is invalid or decoding yields no results.
 */
export function decodeData(dataItems, schemaHint) {
    if (!dataItems || !Array.isArray(dataItems) || dataItems.length === 0) return [];

    try {
        if (schemaHint === 'SupportedStandards:RadarWhitelist' && dataItems[0]?.value) {
            const rawData = dataItems[0].value;
            if (rawData && rawData !== '0x') {
                try {
                    // Try ABI decoding first (assuming address[])
                    const types = parseAbiParameters('address[]');
                    const decoded = decodeAbiParameters(types, /** @type {`0x${string}`} */ (rawData)); // Cast to satisfy viem
                    return decoded[0] || []; // Return the decoded array or empty if null/undefined
                } catch (abiError) {
                    if (import.meta.env.DEV) {
                        console.warn(`[decodeData] Failed ABI decode for ${schemaHint}. Trying JSON decode...`, abiError);
                    }
                    try {
                        // Fallback to JSON decoding for legacy format
                        const jsonString = hexToString(/** @type {`0x${string}`} */ (rawData)); // Cast to satisfy viem
                        const parsed = JSON.parse(jsonString);
                        if (Array.isArray(parsed)) {
                            // Assuming legacy format was [{address: '0x...'}, ...] or string array
                            return parsed.map(item => typeof item === 'string' ? item : item?.address).filter(Boolean);
                        } else {
                             if (import.meta.env.DEV) {
                                 console.warn(`[decodeData] Decoded JSON is not an array for ${schemaHint}.`);
                             }
                             return [];
                        }
                    } catch (jsonError) {
                        if (import.meta.env.DEV) {
                            console.error(`[decodeData] Failed both ABI and JSON decoding for ${schemaHint}:`, jsonError, 'Data:', rawData);
                        }
                        return []; // Return empty array on double failure
                    }
                }
            } else {
                return []; // Return empty array if rawData is empty or '0x'
            }
        }
        // If no specific logic for the schemaHint, return the raw items
        if (import.meta.env.DEV) {
            console.warn(`[decodeData] No specific decoding logic for schemaHint: ${schemaHint}. Returning raw items.`);
        }
        return dataItems.map(item => ({ keyName: item.keyName, value: item.value }));
    } catch (error) {
        if (import.meta.env.DEV) {
            console.error(`[decodeData] Error decoding data for schema ${schemaHint}:`, error, 'Data:', dataItems);
        }
        return []; // Return empty array on general error
    }
}

/**
 * @typedef {object} ParsedDataUri
 * @property {string} mimeType - The MIME type of the data.
 * @property {boolean} isBase64 - True if the data is base64 encoded.
 * @property {string} data - The actual data payload.
 */

/**
 * Parses a Data URI string into its components: mime type, base64 encoding status, and data payload.
 * Follows the standard Data URI format (RFC 2397).
 *
 * @param {string} uri - The Data URI string (e.g., "data:application/json;base64,eyJ...").
 * @returns {ParsedDataUri} An object containing the parsed components.
 * @throws {Error} If the input string is not a valid Data URI format.
 */
function parseDataUri(uri) {
    if (typeof uri !== 'string' || !uri.startsWith('data:')) {
        throw new Error('Invalid Data URI: input is not a string or does not start with "data:"');
    }
    const commaIndex = uri.indexOf(',');
    if (commaIndex === -1) {
        throw new Error('Invalid Data URI: missing comma separator');
    }
    // Extract the part between "data:" and ","
    const metaPart = uri.substring(5, commaIndex).trim();
    // Extract the part after ","
    const dataPart = uri.substring(commaIndex + 1);

    const metaParts = metaPart.split(';');
    // The first part is the mime type, default if empty
    const mimeType = metaParts[0] || 'text/plain;charset=US-ASCII';
    // Check if "base64" is present in the other parts
    const isBase64 = metaParts.slice(1).includes('base64');

    return { mimeType, isBase64, data: dataPart };
}


/**
 * Fetches and resolves LSP4 Metadata for a given asset contract address.
 * Handles VerifiableURI decoding (including Data URIs and plain URLs), IPFS URL resolution via a gateway,
 * and extracts the primary metadata object. Uses the provided ConfigurationService
 * instance for blockchain reads. It attempts to handle both standard VerifiableURI format
 * and direct URL storage in the LSP4Metadata key.
 *
 * @async
 * @param {import('../services/ConfigurationService').default} configService - An initialized instance of ConfigurationService.
 * @param {string} contractAddress - The address of the LSP7/LSP8 asset.
 * @returns {Promise<object | null>} - The parsed LSP4Metadata object (potentially wrapped in an {LSP4Metadata: ...} object if fetched directly) or null if not found or an error occurred.
 */
export async function resolveLsp4Metadata(configService, contractAddress) {
    let checksummedAddress;
    try {
        checksummedAddress = getAddress(contractAddress);
    } catch (e) {
        if (import.meta.env.DEV) {
            console.error(`[resolveLsp4Metadata Addr:${contractAddress}] Invalid address format. Error: ${e.message}`);
        }
        return null;
    }
    const logPrefix = `[resolveLsp4Metadata Addr:${checksummedAddress.slice(0, 6)}]`;

    if (!configService || typeof configService.loadDataFromKey !== 'function') {
        if (import.meta.env.DEV) {
            console.error(`${logPrefix} Invalid or missing configService.`);
        }
        return null;
    }

    try {
        const lsp4Key = ERC725YDataKeys.LSP4.LSP4Metadata;
        const rawValue = await configService.loadDataFromKey(checksummedAddress, lsp4Key);

        if (!rawValue || rawValue === '0x') {
            return null; // No metadata key set or empty
        }

        let potentialUrl = null;
        let extractedJsonDirectly = null;
        const VERIFIABLE_URI_PREFIX = "0x0000";
        const HASH_FUNCTION_ID_LENGTH_BYTES = 4;
        const HASH_LENGTH_BYTES_LENGTH = 2;

        // const DATA_URI_HEX_PREFIX_RAW = Buffer.from('data:').toString('hex'); // Not used in this revised logic

        if (rawValue.startsWith(VERIFIABLE_URI_PREFIX)) {
            const valueWithoutPrefix = rawValue.substring(VERIFIABLE_URI_PREFIX.length);
            // const hashFunctionIdHex = `0x${valueWithoutPrefix.substring(0, HASH_FUNCTION_ID_LENGTH_BYTES * 2)}`; // This was unused
            const hashLengthHex = `0x${valueWithoutPrefix.substring(HASH_FUNCTION_ID_LENGTH_BYTES * 2, (HASH_FUNCTION_ID_LENGTH_BYTES + HASH_LENGTH_BYTES_LENGTH) * 2)}`;
            const hashLength = parseInt(hashLengthHex, 16);

            if (!isNaN(hashLength)) {
                const hashStart = (HASH_FUNCTION_ID_LENGTH_BYTES + HASH_LENGTH_BYTES_LENGTH) * 2;
                const hashEnd = hashStart + hashLength * 2;
                const urlBytesHex = `0x${valueWithoutPrefix.substring(hashEnd)}`;

                try {
                    potentialUrl = hexToString(/** @type {`0x${string}`} */ (urlBytesHex));
                } catch (e) {
                    if (import.meta.env.DEV) {
                        console.warn(`${logPrefix} Failed to decode URL part of VerifiableURI: ${e.message}. Raw URL bytes: ${urlBytesHex}`);
                    }
                }
            } else if (import.meta.env.DEV) {
                console.warn(`${logPrefix} Invalid hash length in VerifiableURI.`);
            }
        } else {
            try {
                const decodedEntireValue = hexToString(/** @type {`0x${string}`} */ (rawValue));
                if (decodedEntireValue.startsWith('ipfs://') || decodedEntireValue.startsWith('http')) {
                    potentialUrl = decodedEntireValue;
                } else if (decodedEntireValue.startsWith('data:')) {
                    try {
                        const { mimeType, isBase64, data } = parseDataUri(decodedEntireValue);
                        if (mimeType.includes('json')) {
                            const jsonDataString = isBase64 ? Buffer.from(data, 'base64').toString('utf8') : decodeURIComponent(data);
                            extractedJsonDirectly = JSON.parse(jsonDataString);
                        } else if (import.meta.env.DEV) {
                            console.warn(`${logPrefix} Data URI has non-JSON mime type: ${mimeType}. Ignoring content.`);
                        }
                    } catch (e) {
                        if (import.meta.env.DEV) {
                            console.error(`${logPrefix} Failed to decode/parse Data URI content from direct value: ${e.message}`);
                        }
                    }
                } else if (import.meta.env.DEV) {
                    console.warn(`${logPrefix} Direct decode of raw value is not a standard URL or Data URI.`);
                }
            } catch (e) {
                if (import.meta.env.DEV) {
                    console.warn(`${logPrefix} Could not decode entire raw value as string. Raw: ${rawValue.substring(0, 50)}... Error: ${e.message}`);
                }
            }
        }


        if (extractedJsonDirectly) {
            if (extractedJsonDirectly.LSP4Metadata) {
                 return extractedJsonDirectly;
            } else if (extractedJsonDirectly.name || extractedJsonDirectly.icon || extractedJsonDirectly.images || extractedJsonDirectly.assets) {
                 if (import.meta.env.DEV) {
                     console.warn(`${logPrefix} JSON from Data URI lacks 'LSP4Metadata' key, wrapping content.`);
                 }
                 return { LSP4Metadata: extractedJsonDirectly };
            } else {
                 if (import.meta.env.DEV) {
                     console.error(`${logPrefix} JSON from Data URI has unexpected structure.`, extractedJsonDirectly);
                 }
                 return null;
            }
        }

        if (potentialUrl) {
            let fetchUrl = potentialUrl;
            if (fetchUrl.startsWith('ipfs://')) {
                fetchUrl = `${IPFS_GATEWAY.endsWith('/') ? IPFS_GATEWAY : IPFS_GATEWAY + '/'}${fetchUrl.substring(7)}`;
            }

            if (!fetchUrl.startsWith('http')) {
                if (import.meta.env.DEV) {
                    console.error(`${logPrefix} Invalid fetch URL derived: ${fetchUrl}`);
                }
                return null;
            }

            try {
                const response = await fetch(fetchUrl);
                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'Could not read error response body');
                    throw new Error(`HTTP error! status: ${response.status} for ${fetchUrl}. Body: ${errorText.substring(0, 200)}`);
                }
                const rawResponseText = await response.text();
                let metadata;
                try {
                    metadata = JSON.parse(rawResponseText);
                } catch (parseError) {
                    if (import.meta.env.DEV) {
                        console.error(`${logPrefix} Failed to parse JSON response from ${fetchUrl}. Error: ${parseError.message}. Response text (truncated): ${rawResponseText.substring(0, 200)}...`);
                    }
                    throw new Error(`JSON Parse Error: ${parseError.message}`);
                }

                if (metadata && metadata.LSP4Metadata) {
                    return metadata;
                } else if (metadata && (metadata.name || metadata.icon || metadata.images || metadata.assets)) {
                    if (import.meta.env.DEV) {
                        console.warn(`${logPrefix} Fetched JSON lacks 'LSP4Metadata' key, wrapping content.`);
                    }
                    return { LSP4Metadata: metadata };
                } else {
                    if (import.meta.env.DEV) {
                        console.warn(`${logPrefix} Fetched JSON from URL has unexpected structure.`, metadata);
                    }
                    return null;
                }
            } catch (fetchError) {
                if (import.meta.env.DEV) {
                    console.error(`${logPrefix} Failed to fetch or parse LSP4 JSON from ${fetchUrl}:`, fetchError.message);
                }
                return null;
            }
        }

        if (import.meta.env.DEV) {
            console.warn(`${logPrefix} Could not extract a valid JSON URL or parse JSON directly from LSP4Metadata value.`);
        }
        return null;

    } catch (error) {
        if (import.meta.env.DEV) {
            console.error(`${logPrefix} General error resolving LSP4 Metadata:`, error);
        }
        return null;
    }
}