import { getAddress, hexToString, decodeAbiParameters, parseAbiParameters } from 'viem';
import { ERC725YDataKeys } from '@lukso/lsp-smart-contracts';
import { Buffer } from 'buffer';

// Ensure Buffer is globally available if needed
if (typeof window !== 'undefined' && typeof window.Buffer === 'undefined') {
  window.Buffer = Buffer;
}

const IPFS_GATEWAY = import.meta.env.VITE_IPFS_GATEWAY || 'https://api.universalprofile.cloud/ipfs/';

/**
 * Decodes ERC725Y data items based on a schema hint.
 * Currently supports decoding the RadarWhitelist address array.
 * Falls back to returning raw data for unknown schema hints.
 * @param {Array<{keyName: string, value: string}>} dataItems - Array of data items.
 * @param {string} schemaHint - A hint indicating the expected schema (e.g., 'SupportedStandards:RadarWhitelist').
 * @returns {Array} Decoded data (e.g., array of addresses) or the original items if decoding fails or hint is unknown.
 */
export function decodeData(dataItems, schemaHint) {
    if (!dataItems || dataItems.length === 0) return [];

    try {
        if (schemaHint === 'SupportedStandards:RadarWhitelist' && dataItems[0]?.value) {
            const rawData = dataItems[0].value;
            if (rawData && rawData !== '0x') {
                try {
                    // Try ABI decoding first (assuming address[])
                    const types = parseAbiParameters('address[]'); // VIEM: Parse ABI string
                    const decoded = decodeAbiParameters(types, rawData); // VIEM: Decode parameters
                    return decoded[0] || [];
                } catch (abiError) {
                    console.warn(`decodeData: Failed ABI decode for ${schemaHint}. Trying JSON decode...`, abiError);
                    try {
                        // Fallback to JSON decoding
                        const jsonString = hexToString(rawData); // VIEM: hexToString
                        const parsed = JSON.parse(jsonString);
                        if (Array.isArray(parsed)) {
                            return parsed.map(item => item?.address).filter(Boolean);
                        } else {
                             console.warn(`decodeData: Decoded JSON is not an array for ${schemaHint}.`);
                             return [];
                        }
                    } catch (jsonError) {
                        console.error(`decodeData: Failed both ABI and JSON decoding for ${schemaHint}:`, jsonError, 'Data:', rawData);
                        return [];
                    }
                }
            }
        }
        console.warn(`decodeData: No specific decoding logic for schemaHint: ${schemaHint}`);
        return dataItems.map(item => ({ keyName: item.keyName, value: item.value }));
    } catch (error) {
        console.error(`Error decoding data for schema ${schemaHint}:`, error, 'Data:', dataItems);
        return [];
    }
}

/**
 * Fetches and resolves LSP4 Metadata for a given asset contract address.
 * Handles VerifiableURI decoding (including Data URIs), IPFS URL resolution,
 * and extracts the primary metadata object. Uses the provided ConfigurationService
 * instance for blockchain reads.
 *
 * @param {import('../services/ConfigurationService').default} configService - An initialized instance of ConfigurationService.
 * @param {string} contractAddress - The address of the LSP7/LSP8 asset.
 * @returns {Promise<object | null>} - The parsed LSP4Metadata object (potentially wrapped if fetched directly) or null if not found or an error occurred.
 */
export async function resolveLsp4Metadata(configService, contractAddress) {
    let checksummedAddress;
    try {
        checksummedAddress = getAddress(contractAddress); // VIEM: getAddress
    } catch (e) {
        console.error(`[resolveLsp4Metadata Addr:${contractAddress}] Invalid address format. Error: ${e.message}`);
        return null;
    }
    const logPrefix = `[resolveLsp4Metadata Addr:${checksummedAddress.slice(0, 6)}]`;

    if (!configService || !checksummedAddress) {
        console.error(`${logPrefix} Missing configService or contractAddress`);
        return null;
    }

    try {
        const lsp4Key = ERC725YDataKeys.LSP4.LSP4Metadata;
        const rawValue = await configService.loadDataFromKey(checksummedAddress, lsp4Key);

        if (!rawValue || rawValue === '0x') {
            return null;
        }

        let potentialUrl = null;
        let extractedJsonDirectly = null;
        const HASH_FUNC_OFFSET = 2 + 2 * 2; // '0x' + 2 bytes for length
        const HASH_OFFSET = HASH_FUNC_OFFSET + 32 * 2; // + 32 bytes for hash func
        // Hex for "data:", ensure 0x prefix for viem's hexToString if used on this part
        const DATA_URI_HEX_PREFIX_RAW = Buffer.from('data:').toString('hex');


        if (rawValue.length >= HASH_OFFSET + 2) {
             const urlBytes = ('0x' + rawValue.substring(HASH_OFFSET)); // Ensure 0x prefix for viem hexToString
             const urlBytesHexOnly = rawValue.substring(HASH_OFFSET); // Original hex string for prefix search

             try {
                 let decodedString = hexToString(urlBytes); // VIEM: hexToString (strict by default)
                 if (decodedString.startsWith('ipfs://') || decodedString.startsWith('http')) {
                      potentialUrl = decodedString;
                 } else {
                     // Attempt to find prefix in potentially messy string
                     const ipfsIndex = decodedString.indexOf('ipfs://');
                     const httpIndex = decodedString.indexOf('http://');
                     const httpsIndex = decodedString.indexOf('https://');
                     let foundIndex = [ipfsIndex, httpIndex, httpsIndex].filter(i => i !== -1).reduce((min, cur) => Math.min(min, cur), Infinity);
                     if (foundIndex !== Infinity && foundIndex !== -1) {
                        potentialUrl = decodedString.substring(foundIndex);
                     }
                 }
             } catch { // If strict decode failed
                 try {
                    // viem's hexToString with onError: 'replace' will replace invalid UTF-8 sequences.
                    let decodedStringLenient = hexToString(urlBytes, { onError: 'replace' });
                    const ipfsIndex = decodedStringLenient.indexOf('ipfs://');
                    const httpIndex = decodedStringLenient.indexOf('http://');
                    const httpsIndex = decodedStringLenient.indexOf('https://');
                    let foundIndex = [ipfsIndex, httpIndex, httpsIndex].filter(i => i !== -1).reduce((min, cur) => Math.min(min, cur), Infinity);
                    if (foundIndex !== Infinity && foundIndex !== -1) {
                       potentialUrl = decodedStringLenient.substring(foundIndex);
                    }
                 } catch (lenientError){
                    console.error(`${logPrefix} Error during lenient UTF-8 decode for search: ${lenientError.message}`);
                 }
             }

             // Check for Data URI hex prefix if no URL found yet
             if (!potentialUrl && urlBytesHexOnly.length > DATA_URI_HEX_PREFIX_RAW.length) {
                const dataUriStartIndex = urlBytesHexOnly.indexOf(DATA_URI_HEX_PREFIX_RAW);
                if (dataUriStartIndex !== -1) {
                    const dataUriFullHex = '0x' + urlBytesHexOnly.substring(dataUriStartIndex); // Add '0x' for hexToString
                    try {
                        const dataUriString = hexToString(dataUriFullHex);
                        const { mimeType, isBase64, data } = parseDataUri(dataUriString);
                        if (mimeType.includes('json')) {
                            let jsonDataString = isBase64 ? Buffer.from(data, 'base64').toString('utf8') : decodeURIComponent(data);
                            extractedJsonDirectly = JSON.parse(jsonDataString);
                        } else {
                            console.warn(`${logPrefix} Data URI has non-JSON mime type: ${mimeType}.`);
                        }
                    } catch(e) {
                        console.error(`${logPrefix} Failed to decode/parse Data URI content: ${e.message}`);
                    }
                }
             }
        } else if (rawValue.startsWith('0x') && rawValue.length > 2) {
             // Fallback: Try decoding entire value as plain URL
             try {
                 const decodedEntireValue = hexToString(rawValue); // VIEM: hexToString
                  if (decodedEntireValue.startsWith('http') || decodedEntireValue.startsWith('ipfs')) {
                     potentialUrl = decodedEntireValue;
                 } else {
                     console.warn(`${logPrefix} Direct decode of entire value is not a valid URL.`);
                 }
             } catch (e) {
                 console.warn(`${logPrefix} Could not decode entire raw value directly. Raw: ${rawValue.substring(0, 50)}...`, e.message);
             }
        } else {
            console.warn(`${logPrefix} Raw value is too short or invalid: ${rawValue}`);
        }

        // Process results: JSON from Data URI > Fetched JSON > null
        if (extractedJsonDirectly) {
            if (extractedJsonDirectly.LSP4Metadata) {
                 return extractedJsonDirectly;
            } else if (extractedJsonDirectly.name || extractedJsonDirectly.icon || extractedJsonDirectly.images || extractedJsonDirectly.assets) {
                 console.warn(`${logPrefix} Data URI JSON lacks 'LSP4Metadata' key, wrapping content.`);
                 return { LSP4Metadata: extractedJsonDirectly };
            } else {
                 console.error(`${logPrefix} JSON from Data URI has unexpected structure.`, extractedJsonDirectly);
                 return null;
            }
        }

        if (potentialUrl) {
            let fetchUrl = potentialUrl;
            if (fetchUrl.startsWith('ipfs://')) {
                fetchUrl = `${IPFS_GATEWAY}${fetchUrl.substring(7)}`;
            }

            if (!fetchUrl.startsWith('http')) {
                console.error(`${logPrefix} Invalid fetch URL derived: ${fetchUrl}`);
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
                    console.error(`${logPrefix} Failed to parse JSON response from ${fetchUrl}. Error: ${parseError.message}.`);
                    throw new Error(`JSON Parse Error: ${parseError.message}`);
                }

                if (metadata && metadata.LSP4Metadata) {
                    return metadata;
                } else if (metadata && (metadata.name || metadata.icon || metadata.images || metadata.assets)) {
                    console.warn(`${logPrefix} Fetched JSON lacks 'LSP4Metadata' key, wrapping content.`);
                    return { LSP4Metadata: metadata };
                } else {
                    console.warn(`${logPrefix} Fetched JSON from URL has unexpected structure.`, metadata);
                    return null;
                }
            } catch (fetchError) {
                console.error(`${logPrefix} Failed to fetch or parse LSP4 JSON from ${fetchUrl}:`, fetchError.message);
                return null;
            }
        }

        console.warn(`${logPrefix} Could not extract a valid JSON URL or parse JSON directly from LSP4Metadata.`);
        return null;

    } catch (error) {
        console.error(`${logPrefix} General error resolving LSP4 Metadata:`, error);
        return null;
    }
}

/**
 * Parses a Data URI string into its components.
 * @param {string} uri - The Data URI string (e.g., "data:application/json;base64,...").
 * @returns {{ mimeType: string, isBase64: boolean, data: string }} Parsed components.
 * @throws {Error} If the URI format is invalid.
 */
function parseDataUri(uri) {
    if (typeof uri !== 'string' || !uri.startsWith('data:')) {
        throw new Error('Invalid Data URI: input not a string or does not start with "data:"');
    }
    const commaIndex = uri.indexOf(',');
    if (commaIndex === -1) {
        throw new Error('Invalid Data URI: missing comma separator');
    }
    const metaPart = uri.substring(5, commaIndex);
    const dataPart = uri.substring(commaIndex + 1);
    const metaParts = metaPart.split(';');
    const mimeType = metaParts[0] || 'text/plain'; // Default mime type
    const isBase64 = metaParts.includes('base64');
    return { mimeType, isBase64, data: dataPart };
}