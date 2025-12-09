// src/utils/erc725.js
import { getAddress, hexToString, decodeAbiParameters, parseAbiParameters } from 'viem';
import { ERC725YDataKeys } from '@lukso/lsp-smart-contracts';
import { Buffer } from 'buffer';

// Ensure Buffer is polyfilled
if (typeof window !== 'undefined' && typeof window.Buffer === 'undefined') {
  window.Buffer = Buffer;
}

const IPFS_GATEWAY = import.meta.env.VITE_IPFS_GATEWAY || 'https://api.universalprofile.cloud/ipfs/';

/**
 * Resolves a raw URL (ipfs://, http://, etc.) to a fetchable HTTP URL.
 */
export function resolveUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (trimmed.startsWith('ipfs://')) {
        const hash = trimmed.slice(7);
        const gateway = IPFS_GATEWAY.endsWith('/') ? IPFS_GATEWAY : `${IPFS_GATEWAY}/`;
        return `${gateway}${hash}`;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
        return trimmed;
    }
    return null;
}

/**
 * Decodes a VerifiableURI (LSP4) hex string into a URL.
 * Handles the prefix (0x0000), hash info, and legacy formats.
 */
export function decodeVerifiableUri(hexBytes) {
    if (!hexBytes || typeof hexBytes !== 'string' || !hexBytes.startsWith('0x') || hexBytes === '0x') {
        return null;
    }

    // Standard VerifiableURI: 0x0000 (2 bytes) + Hash Algo (4 bytes) + Hash Length (2 bytes) + Hash + URL
    if (hexBytes.startsWith('0x0000') && hexBytes.length >= 18) {
        try {
            const hexBody = hexBytes.substring(2); // Remove '0x'
            
            // Hash Length is at index 12 to 16 (characters)
            const hashLengthHex = `0x${hexBody.substring(12, 16)}`;
            const hashLength = parseInt(hashLengthHex, 16);
            
            if (isNaN(hashLength)) return null;

            // Calculate start of URL: 16 chars (header) + (hashLength * 2 chars)
            const urlStart = 16 + (hashLength * 2);
            
            if (hexBody.length < urlStart) return null;
            
            const urlHex = `0x${hexBody.substring(urlStart)}`;
            const decoded = hexToString(urlHex);
            return decoded ? decoded.replace(/\u0000/g, '') : null;
        } catch (e) {
            console.warn("Failed to decode VerifiableURI:", e);
            return null;
        }
    }

    // Fallback: Direct UTF8 string (Legacy/Simple)
    try {
        const decoded = hexToString(hexBytes);
        const clean = decoded ? decoded.replace(/\u0000/g, '') : '';
        if (clean.startsWith('ipfs://') || clean.startsWith('http') || clean.startsWith('data:')) {
            return clean;
        }
        // Check for SVG data
        if (clean.trim().startsWith('<svg')) {
            return `data:image/svg+xml;base64,${Buffer.from(clean).toString('base64')}`;
        }
    } catch (e) { /* ignore */ }
    
    return null;
}

/**
 * Extracts the best image URL from a JSON metadata object (LSP4 or LSP3).
 */
export function extractImageFromMetadata(json) {
    if (!json) return null;
    const root = json.LSP4Metadata || json; 
    
    // 1. 'images' array (LSP4) - usually [[{url, ...}, ...], ...]
    if (Array.isArray(root.images) && root.images.length > 0) {
        const firstSet = root.images[0];
        if (Array.isArray(firstSet) && firstSet.length > 0) return resolveUrl(firstSet[0].url);
    }
    // 2. 'icon' (LSP4)
    if (Array.isArray(root.icon) && root.icon.length > 0) return resolveUrl(root.icon[0].url);
    
    // 3. 'assets' (Legacy)
    if (Array.isArray(root.assets) && root.assets.length > 0) return resolveUrl(root.assets[0].url);
    
    // 4. LSP3 ProfileImage
    if (json.LSP3Profile && Array.isArray(json.LSP3Profile.profileImage) && json.LSP3Profile.profileImage.length > 0) {
        return resolveUrl(json.LSP3Profile.profileImage[0].url);
    }

    return null;
}

/**
 * Fetches JSON metadata from a URL (handling IPFS).
 */
export async function fetchMetadata(url) {
    const fetchUrl = resolveUrl(url);
    if (!fetchUrl) return null;

    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        const res = await fetch(fetchUrl, { signal: controller.signal });
        clearTimeout(id);
        
        if (!res.ok) return null;
        
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            return await res.json();
        } 
        
        // Try parsing text as JSON anyway
        const text = await res.text();
        try { 
            return JSON.parse(text); 
        } catch { 
            // If it's an image file directly
            if ((contentType && contentType.startsWith("image/")) || fetchUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i)) {
                return { image: fetchUrl }; 
            }
            return null; 
        }
    } catch (e) {
        return null;
    }
}

/**
 * High-level helper to fetch and resolve LSP4 Metadata for a contract address.
 */
export async function resolveLsp4Metadata(configService, contractAddress) {
    if (!configService || !contractAddress) return null;
    let checksummedAddress;
    try { checksummedAddress = getAddress(contractAddress); } catch { return null; }

    const lsp4Key = ERC725YDataKeys.LSP4.LSP4Metadata;
    
    try {
        const rawValue = await configService.loadDataFromKey(checksummedAddress, lsp4Key);
        if (!rawValue || rawValue === '0x') return null;

        const url = decodeVerifiableUri(rawValue);
        if (url) {
            // If data URI, parse directly
            if (url.startsWith('data:application/json')) {
                const base64Part = url.split(',')[1];
                if (base64Part) {
                    try {
                        const jsonStr = Buffer.from(base64Part, 'base64').toString('utf-8');
                        return JSON.parse(jsonStr);
                    } catch (e) { return null; }
                }
            }
            return await fetchMetadata(url);
        }
        return null;
    } catch (e) {
        return null;
    }
}

// Keep existing decodeData for arrays
export function decodeData(dataItems, schemaHint) {
    if (!dataItems || !Array.isArray(dataItems) || dataItems.length === 0) return [];
    try {
        if (schemaHint === 'SupportedStandards:RadarWhitelist' && dataItems[0]?.value) {
            const rawData = dataItems[0].value;
            if (rawData && rawData !== '0x') {
                try {
                    const types = parseAbiParameters('address[]');
                    const decoded = decodeAbiParameters(types, rawData);
                    return decoded[0] || [];
                } catch (abiError) {
                    try {
                        const jsonString = hexToString(rawData);
                        const parsed = JSON.parse(jsonString);
                        if (Array.isArray(parsed)) return parsed.map(item => typeof item === 'string' ? item : item?.address).filter(Boolean);
                    } catch (jsonError) { return []; }
                }
            }
        }
        return dataItems.map(item => ({ keyName: item.keyName, value: item.value }));
    } catch (error) { return []; }
}