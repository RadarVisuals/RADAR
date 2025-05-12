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
 * Decodes ERC725Y data items based on a schema hint.
 * Currently supports decoding the RadarWhitelist address array (both ABI-encoded and legacy JSON format).
 * Falls back to returning raw data items (keyName, value) for unknown schema hints or if decoding fails.
 *
 * @param {Array<{keyName: string, value: string}>} dataItems - Array of data items fetched from ERC725Y storage. Expected to contain the relevant key for the schemaHint.
 * @param {string} schemaHint - A hint indicating the expected schema (e.g., 'SupportedStandards:RadarWhitelist').
 * @returns {Array<string> | Array<{keyName: string, value: string}>} Decoded data (e.g., array of addresses for RadarWhitelist) or the original items if decoding fails or hint is unknown. Returns an empty array if input is invalid or decoding yields no results.
 */
export function decodeData(dataItems, schemaHint) {
    if (!dataItems || dataItems.length === 0) return [];

    try {
        if (schemaHint === 'SupportedStandards:RadarWhitelist' && dataItems[0]?.value) {
            const rawData = dataItems[0].value;
            if (rawData && rawData !== '0x') {
                try {
                    // Try ABI decoding first (assuming address[])
                    const types = parseAbiParameters('address[]');
                    const decoded = decodeAbiParameters(types, rawData);
                    return decoded[0] || []; // Return the decoded array or empty if null/undefined
                } catch (abiError) {
                    if (import.meta.env.DEV) {
                        console.warn(`decodeData: Failed ABI decode for ${schemaHint}. Trying JSON decode...`, abiError);
                    }
                    try {
                        // Fallback to JSON decoding for legacy format
                        const jsonString = hexToString(rawData);
                        const parsed = JSON.parse(jsonString);
                        if (Array.isArray(parsed)) {
                            // Assuming legacy format was [{address: '0x...'}, ...]
                            return parsed.map(item => item?.address).filter(Boolean);
                        } else {
                             if (import.meta.env.DEV) {
                                 console.warn(`decodeData: Decoded JSON is not an array for ${schemaHint}.`);
                             }
                             return [];
                        }
                    } catch (jsonError) {
                        if (import.meta.env.DEV) {
                            console.error(`decodeData: Failed both ABI and JSON decoding for ${schemaHint}:`, jsonError, 'Data:', rawData);
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
            console.warn(`decodeData: No specific decoding logic for schemaHint: ${schemaHint}. Returning raw items.`);
        }
        return dataItems.map(item => ({ keyName: item.keyName, value: item.value }));
    } catch (error) {
        if (import.meta.env.DEV) {
            console.error(`Error decoding data for schema ${schemaHint}:`, error, 'Data:', dataItems);
        }
        return []; // Return empty array on general error
    }
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

    if (!configService || !checksummedAddress) {
        if (import.meta.env.DEV) {
            console.error(`${logPrefix} Missing configService or contractAddress`);
        }
        return null;
    }

    try {
        const lsp4Key = ERC725YDataKeys.LSP4.LSP4Metadata;
        const rawValue = await configService.loadDataFromKey(checksummedAddress, lsp4Key);

        if (!rawValue || rawValue === '0x') {
            // No metadata key set
            return null;
        }

        let potentialUrl = null;
        let extractedJsonDirectly = null;
        const HASH_FUNC_OFFSET = 2 + 2 * 2; // '0x' + 2 bytes for length prefix of hash function
        const HASH_OFFSET = HASH_FUNC_OFFSET + 32 * 2; // + 32 bytes for hash function itself
        // Hex representation of "data:" prefix
        const DATA_URI_HEX_PREFIX_RAW = Buffer.from('data:').toString('hex');

        // Check if it looks like a VerifiableURI (has hash function and hash)
        if (rawValue.length >= HASH_OFFSET + 2) { // +2 for at least one byte of URL
             const urlBytesHexWithPrefix = ('0x' + rawValue.substring(HASH_OFFSET)); // Ensure 0x prefix for viem hexToString
             const urlBytesHexOnly = rawValue.substring(HASH_OFFSET); // Original hex string for prefix search

             // Try decoding the URL part strictly first
             try {
                 let decodedString = hexToString(urlBytesHexWithPrefix); // Strict UTF-8 decoding
                 // Check for standard URL prefixes
                 if (decodedString.startsWith('ipfs://') || decodedString.startsWith('http')) {
                      potentialUrl = decodedString;
                 } else {
                     // Sometimes the URL might be embedded within junk bytes, try finding known prefixes
                     const ipfsIndex = decodedString.indexOf('ipfs://');
                     const httpIndex = decodedString.indexOf('http://');
                     const httpsIndex = decodedString.indexOf('https://');
                     // Find the earliest occurrence of any valid prefix
                     let foundIndex = [ipfsIndex, httpIndex, httpsIndex].filter(i => i !== -1).reduce((min, cur) => Math.min(min, cur), Infinity);
                     if (foundIndex !== Infinity && foundIndex !== -1) {
                        potentialUrl = decodedString.substring(foundIndex);
                     }
                 }
             } catch { // If strict decode failed, try lenient decoding for prefix search
                 try {
                    // Use lenient decoding (replace invalid sequences) just for finding the prefix
                    let decodedStringLenient = hexToString(urlBytesHexWithPrefix, { onError: 'replace' });
                    const ipfsIndex = decodedStringLenient.indexOf('ipfs://');
                    const httpIndex = decodedStringLenient.indexOf('http://');
                    const httpsIndex = decodedStringLenient.indexOf('https://');
                    let foundIndex = [ipfsIndex, httpIndex, httpsIndex].filter(i => i !== -1).reduce((min, cur) => Math.min(min, cur), Infinity);
                    if (foundIndex !== Infinity && foundIndex !== -1) {
                       potentialUrl = decodedStringLenient.substring(foundIndex);
                       // Note: We found the start, but the rest might still be messy. Fetching handles this.
                    }
                 } catch (lenientError){
                    if (import.meta.env.DEV) {
                        console.error(`${logPrefix} Error during lenient UTF-8 decode for search: ${lenientError.message}`);
                    }
                 }
             }

             // Check for Data URI hex prefix if no standard URL was found
             if (!potentialUrl && urlBytesHexOnly.length > DATA_URI_HEX_PREFIX_RAW.length) {
                const dataUriStartIndex = urlBytesHexOnly.indexOf(DATA_URI_HEX_PREFIX_RAW);
                if (dataUriStartIndex !== -1) {
                    // Found "data:" hex prefix within the URL bytes
                    const dataUriFullHex = '0x' + urlBytesHexOnly.substring(dataUriStartIndex); // Add '0x' for hexToString
                    try {
                        const dataUriString = hexToString(dataUriFullHex); // Decode the data URI string
                        const { mimeType, isBase64, data } = parseDataUri(dataUriString);
                        if (mimeType.includes('json')) {
                            // Decode JSON data based on encoding (base64 or URL-encoded)
                            let jsonDataString = isBase64 ? Buffer.from(data, 'base64').toString('utf8') : decodeURIComponent(data);
                            extractedJsonDirectly = JSON.parse(jsonDataString);
                        } else {
                            if (import.meta.env.DEV) {
                                console.warn(`${logPrefix} Data URI has non-JSON mime type: ${mimeType}. Ignoring content.`);
                            }
                        }
                    } catch(e) {
                        if (import.meta.env.DEV) {
                            console.error(`${logPrefix} Failed to decode/parse Data URI content: ${e.message}`);
                        }
                    }
                }
             }
        } else if (rawValue.startsWith('0x') && rawValue.length > 2) {
             // Fallback: Value doesn't look like VerifiableURI, try decoding entire value as a plain URL
             try {
                 const decodedEntireValue = hexToString(rawValue);
                  if (decodedEntireValue.startsWith('http') || decodedEntireValue.startsWith('ipfs')) {
                     potentialUrl = decodedEntireValue; // Treat the whole thing as a URL
                 } else {
                     if (import.meta.env.DEV) {
                         console.warn(`${logPrefix} Direct decode of entire value is not a valid URL.`);
                     }
                 }
             } catch (e) {
                 if (import.meta.env.DEV) {
                     console.warn(`${logPrefix} Could not decode entire raw value directly as URL. Raw: ${rawValue.substring(0, 50)}... Error: ${e.message}`);
                 }
             }
        } else {
            // Raw value is too short or invalid format
            if (import.meta.env.DEV) {
                console.warn(`${logPrefix} Raw value is too short or invalid to be VerifiableURI or direct URL: ${rawValue}`);
            }
        }

        // --- Process results: Prioritize directly extracted JSON, then fetched URL ---
        if (extractedJsonDirectly) {
            // Check if the JSON is already wrapped or needs wrapping
            if (extractedJsonDirectly.LSP4Metadata) {
                 return extractedJsonDirectly; // Already has the standard top-level key
            } else if (extractedJsonDirectly.name || extractedJsonDirectly.icon || extractedJsonDirectly.images || extractedJsonDirectly.assets) {
                 // Contains expected metadata fields but lacks the wrapper key
                 if (import.meta.env.DEV) {
                     console.warn(`${logPrefix} JSON from Data URI lacks 'LSP4Metadata' key, wrapping content.`);
                 }
                 return { LSP4Metadata: extractedJsonDirectly };
            } else {
                 // JSON structure is unexpected
                 if (import.meta.env.DEV) {
                     console.error(`${logPrefix} JSON from Data URI has unexpected structure.`, extractedJsonDirectly);
                 }
                 return null;
            }
        }

        if (potentialUrl) {
            let fetchUrl = potentialUrl;
            // Resolve IPFS URLs using the configured gateway
            if (fetchUrl.startsWith('ipfs://')) {
                fetchUrl = `${IPFS_GATEWAY}${fetchUrl.substring(7)}`;
            }

            if (!fetchUrl.startsWith('http')) {
                // Should only happen if IPFS gateway is misconfigured or URL is invalid
                if (import.meta.env.DEV) {
                    console.error(`${logPrefix} Invalid fetch URL derived after potential IPFS resolution: ${fetchUrl}`);
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
                        console.error(`${logPrefix} Failed to parse JSON response from ${fetchUrl}. Error: ${parseError.message}. Response text: ${rawResponseText.substring(0, 200)}...`);
                    }
                    throw new Error(`JSON Parse Error: ${parseError.message}`);
                }

                // Check if the fetched JSON is already wrapped or needs wrapping
                if (metadata && metadata.LSP4Metadata) {
                    return metadata; // Already has the standard top-level key
                } else if (metadata && (metadata.name || metadata.icon || metadata.images || metadata.assets)) {
                    // Contains expected metadata fields but lacks the wrapper key
                    if (import.meta.env.DEV) {
                        console.warn(`${logPrefix} Fetched JSON lacks 'LSP4Metadata' key, wrapping content.`);
                    }
                    return { LSP4Metadata: metadata };
                } else {
                    // Fetched JSON structure is unexpected
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

        // If we reach here, no valid URL or direct JSON was found
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

/**
 * Parses a Data URI string into its components: mime type, base64 encoding status, and data payload.
 * Follows the standard Data URI format (RFC 2397).
 *
 * @param {string} uri - The Data URI string (e.g., "data:application/json;base64,eyJ...").
 * @returns {{ mimeType: string, isBase64: boolean, data: string }} An object containing the parsed components.
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