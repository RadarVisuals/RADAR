// src/services/ConfigurationService.js
import {
  hexToString, stringToHex,
  getAddress,
  decodeAbiParameters,
  parseAbiParameters
} from "viem";

import {
  RADAR_ROOT_STORAGE_POINTER_KEY,
  IPFS_GATEWAY,
  RADAR_OFFICIAL_ADMIN_ADDRESS,
} from "../config/global-config";
import { resolveLsp4Metadata } from '../utils/erc725.js';
import { uploadJsonToPinata } from './PinataService.js';
import { ERC725YDataKeys } from '@lukso/lsp-smart-contracts';
import { Buffer } from 'buffer';

if (typeof window !== 'undefined' && typeof window.Buffer === 'undefined') {
  window.Buffer = Buffer;
}

// --- CONSTANTS ---
const MULTICALL_BATCH_SIZE = 15; // Conservative batch size
const COLLECTION_CHUNK_SIZE = 3; // 3 Collections at a time (Better UX than 1, still safe)
const DEFAULT_REQUEST_TIMEOUT = 25000;

const ERC725Y_ABI = [
  { inputs: [{ type: "bytes32", name: "dataKey" }], name: "getData", outputs: [{ type: "bytes", name: "dataValue" }], stateMutability: "view", type: "function" },
  { inputs: [{ type: "bytes32[]", name: "dataKeys" }], name: "getDataBatch", outputs: [{ type: "bytes[]", name: "dataValues" }], stateMutability: "view", type: "function" },
  { inputs: [{ type: "bytes32", name: "dataKey" }, { type: "bytes", name: "dataValue" }], name: "setData", outputs: [], stateMutability: "payable", type: "function" },
  { inputs: [{ type: "bytes32[]", name: "dataKeys" }, { type: "bytes[]", name: "dataValues" }], name: "setDataBatch", outputs: [], stateMutability: "payable", type: "function" },
  { name: "supportsInterface", inputs: [{ type: "bytes4", name: "interfaceId" }], outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
];

const LSP7_ABI = [
  {
    "inputs": [{ "name": "owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

const LSP8_ABI = [
  {
    "inputs": [{ "name": "tokenOwner", "type": "address" }],
    "name": "tokenIdsOf",
    "outputs": [{ "name": "", "type": "bytes32[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
        { "name": "tokenId", "type": "bytes32" },
        { "name": "dataKey", "type": "bytes32" }
    ],
    "name": "getDataForTokenId",
    "outputs": [{ "name": "dataValue", "type": "bytes" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "dataKey", "type": "bytes32" }],
    "name": "getData",
    "outputs": [{ "name": "dataValue", "type": "bytes" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "index", "type": "uint256" }],
    "name": "tokenByIndex",
    "outputs": [{ "name": "", "type": "bytes32" }],
    "stateMutability": "view",
    "type": "function"
  }
];

const LSP8_INTERFACE_ID = "0x3a271706";
const LSP7_INTERFACE_ID = "0xc52d6008";

// --- HELPER FUNCTIONS ---

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = DEFAULT_REQUEST_TIMEOUT } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal  
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeout}ms`);
    }
    throw error;
  }
}

export function hexToUtf8Safe(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("0x") || hex === "0x") return null;
  try {
    const decodedString = hexToString(hex);
    return decodedString.replace(/\u0000/g, '');
  } catch {
    return null;
  }
}

function decodeVerifiableUriBytes(bytesValue) {
    if (!bytesValue || typeof bytesValue !== 'string' || !bytesValue.startsWith('0x') || bytesValue.length < 14) {
        return null; 
    }
    const valueWithoutPrefix = bytesValue.substring(2);
    if (valueWithoutPrefix.startsWith('0000')) {
        try {
            const hashLengthHex = `0x${valueWithoutPrefix.substring(12, 16)}`;
            const hashLength = parseInt(hashLengthHex, 16);
            const urlBytesStart = 16 + (hashLength * 2);
            if (valueWithoutPrefix.length < urlBytesStart) return null;
            const urlBytes = `0x${valueWithoutPrefix.substring(urlBytesStart)}`;
            return hexToUtf8Safe(urlBytes);
        } catch (e) {
            console.error("Error parsing VerifiableURI bytes:", e);
            return null;
        }
    } else {
        return hexToUtf8Safe(bytesValue);
    }
}

function getChecksumAddressSafe(address) {
  if (typeof address !== 'string') return null;
  try { return getAddress(address.trim()); }
  catch { return null; }
}

function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

class ConfigurationService {
  walletClient = null;
  publicClient = null;
  readReady = false;
  writeReady = false;

  constructor(_provider, walletClient, publicClient) {
    this.walletClient = walletClient;
    this.publicClient = publicClient;
    this.readReady = !!publicClient;
    this.writeReady = !!publicClient && !!walletClient?.account;
  }

  async initialize() {
    this.readReady = !!this.publicClient;
    this.writeReady = this.readReady && !!this.walletClient?.account;
    return this.readReady;
  }

  checkReadyForRead() { return !!this.publicClient; }
  checkReadyForWrite() { return !!this.publicClient && !!this.walletClient?.account; }

  // --- INTERNAL HELPERS ---

  async _processMetadataBytes(metadataUriBytes, tokenId) {
    if (!metadataUriBytes || metadataUriBytes === '0x') return null;

    const decodedString = hexToUtf8Safe(metadataUriBytes);
    if (decodedString && decodedString.trim().startsWith('<svg')) {
      const base64Svg = Buffer.from(decodedString, 'utf8').toString('base64');
      return { name: `Token #${Number(BigInt(tokenId))}`, image: `data:image/svg+xml;base64,${base64Svg}` };
    }

    const decodedUri = decodeVerifiableUriBytes(metadataUriBytes);
    if (!decodedUri) return null;

    return await this._fetchMetadataFromUrl(decodedUri, tokenId);
  }

  async _processBaseUriBytes(baseUriBytes, tokenId) {
    if (!baseUriBytes || baseUriBytes === '0x') return null;
    
    const decodedBaseUri = decodeVerifiableUriBytes(baseUriBytes);
    if (!decodedBaseUri) return null;

    const tokenIdAsString = BigInt(tokenId).toString();
    const finalUrl = decodedBaseUri.endsWith('/') 
        ? `${decodedBaseUri}${tokenIdAsString}` 
        : `${decodedBaseUri}/${tokenIdAsString}`;
    
    return await this._fetchMetadataFromUrl(finalUrl, tokenId);
  }

  async _fetchMetadataFromUrl(url, tokenId) {
    let fetchableUrl = url;
    if (fetchableUrl.startsWith('ipfs://')) fetchableUrl = `${IPFS_GATEWAY}${fetchableUrl.substring(7)}`;
    else if (!fetchableUrl.startsWith('http')) fetchableUrl = `${IPFS_GATEWAY}${fetchableUrl}`;
    
    if (!fetchableUrl.startsWith('http')) return null;

    try {
        const response = await fetchWithTimeout(fetchableUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
            const rawResponseText = await response.text();
            let metadata;
            try { metadata = JSON.parse(rawResponseText); } catch(e) { return null; }
            
            const lsp4Data = metadata.LSP4Metadata || metadata;
            const name = lsp4Data.name || `Token #${tokenId ? tokenId.toString().slice(0,6) : '?'}`;
            let imageUrl = null;
            const imageAsset = lsp4Data.images?.[0]?.[0] || lsp4Data.icon?.[0] || lsp4Data.assets?.[0];

            if (imageAsset && imageAsset.url) {
                let rawUrl = imageAsset.url.trim();
                if (rawUrl.startsWith('ipfs://')) imageUrl = `${IPFS_GATEWAY}${rawUrl.slice(7)}`;
                else if (rawUrl.startsWith('http') || rawUrl.startsWith('data:')) imageUrl = rawUrl;

                if (imageUrl && imageAsset.verification?.method && imageAsset.verification?.data) {
                    const params = new URLSearchParams();
                    params.append('method', imageAsset.verification.method);
                    params.append('data', imageAsset.verification.data);
                    imageUrl = `${imageUrl}?${params.toString()}`;
                }
            }
            return { name, image: imageUrl };

        } else if (contentType && contentType.startsWith("image/")) {
            const tokenIdNum = tokenId ? Number(BigInt(tokenId)) : 0;
            return { name: `Token #${tokenIdNum}`, image: fetchableUrl };
        } 
        return null;
    } catch (e) {
        return null;
    }
  }

  // --- PUBLIC API ---

  async loadWorkspace(profileAddress) {
    const defaultSetlist = { defaultWorkspaceName: null, workspaces: {}, globalUserMidiMap: {}, personalCollectionLibrary: [], userPalettes: {}, globalEventReactions: {} };
    if (!this.checkReadyForRead()) return defaultSetlist;
    const checksummedProfileAddr = getChecksumAddressSafe(profileAddress);
    if (!checksummedProfileAddr) return defaultSetlist;

    try {
        let pointerHex = null;
        try {
            pointerHex = await this.loadDataFromKey(checksummedProfileAddr, RADAR_ROOT_STORAGE_POINTER_KEY);
        } catch (rpcError) {
            console.warn(`[CS] RPC Error fetching root pointer:`, rpcError.message);
            return defaultSetlist; 
        }

        if (!pointerHex || pointerHex === '0x') return defaultSetlist;
        const ipfsUri = hexToUtf8Safe(pointerHex);
        if (!ipfsUri || !ipfsUri.startsWith('ipfs://')) return defaultSetlist;

        const cid = ipfsUri.substring(7);
        const gatewayUrl = `${IPFS_GATEWAY}${cid}`;
        
        const response = await fetchWithTimeout(gatewayUrl);
        if (!response.ok) throw new Error(`Failed to fetch setlist: ${response.status}`);

        const setlist = await response.json();
        if (!setlist || !('workspaces' in setlist)) throw new Error('Invalid setlist object.');

        if (setlist && !setlist.globalUserMidiMap) {
          const defaultWorkspaceName = setlist.defaultWorkspaceName || Object.keys(setlist.workspaces)[0];
          if (defaultWorkspaceName && setlist.workspaces[defaultWorkspaceName]?.cid) {
              const defaultWorkspace = await this._loadWorkspaceFromCID(setlist.workspaces[defaultWorkspaceName].cid);
              if (defaultWorkspace?.globalMidiMap) {
                  setlist.globalUserMidiMap = defaultWorkspace.globalMidiMap;
              }
          }
        }
        return setlist;
    } catch (error) {
        console.error(`[CS] Failed to load setlist:`, error);
        return defaultSetlist;
    }
  }

  async _loadWorkspaceFromCID(cid) {
    if (!cid) return null;
    const gatewayUrl = `${IPFS_GATEWAY}${cid}`;
    const response = await fetchWithTimeout(gatewayUrl);
    if (!response.ok) throw new Error(`Failed to fetch from IPFS: ${response.status}`);
    const workspaceData = await response.json();
    if (!workspaceData || !('presets' in workspaceData)) throw new Error('Invalid workspace object.');
    return workspaceData;
  }

  async saveSetlist(targetProfileAddress, setlistObject) {
    if (!this.checkReadyForWrite()) throw new Error("Client not ready for writing.");
    const checksummedTargetAddr = getChecksumAddressSafe(targetProfileAddress);
    if (!checksummedTargetAddr) throw new Error("Invalid target address.");
    
    const account = this.walletClient.account;
    const userAddress = typeof account === 'string' ? account : account?.address;
    if (userAddress.toLowerCase() !== checksummedTargetAddr.toLowerCase()) {
      throw new Error("Permission denied: Signer is not the profile owner.");
    }

    let oldCidToUnpin = null;
    try {
      const oldPointerHex = await this.loadDataFromKey(checksummedTargetAddr, RADAR_ROOT_STORAGE_POINTER_KEY);
      if (oldPointerHex && oldPointerHex !== '0x') {
        const oldIpfsUri = hexToUtf8Safe(oldPointerHex);
        if (oldIpfsUri?.startsWith('ipfs://')) oldCidToUnpin = oldIpfsUri.substring(7);
      }
    } catch (e) { /* ignore */ }

    try {
      const newIpfsCid = await uploadJsonToPinata(setlistObject, 'RADAR_Setlist');
      if (!newIpfsCid) throw new Error("IPFS upload failed.");

      const newIpfsUri = `ipfs://${newIpfsCid}`;
      const valueHex = stringToHex(newIpfsUri);
      
      const result = await this.saveDataToKey(checksummedTargetAddr, RADAR_ROOT_STORAGE_POINTER_KEY, valueHex);
      
      if (oldCidToUnpin && oldCidToUnpin !== newIpfsCid) {
        fetch('/api/unpin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cid: oldCidToUnpin }),
        }).catch(() => {});
      }
      return result;
    } catch (error) {
      throw new Error(error.message || "Save failed.");
    }
  }
  
  async saveDataToKey(targetAddress, key, valueHex) {
    if (!this.checkReadyForWrite()) throw new Error("Client not ready.");
    const checksummedTargetAddr = getChecksumAddressSafe(targetAddress);
    const account = this.walletClient.account;
    const userAddress = typeof account === 'string' ? account : account?.address;
    
    try {
        const hash = await this.walletClient.writeContract({ 
            address: checksummedTargetAddr, 
            abi: ERC725Y_ABI, 
            functionName: "setData", 
            args: [key, valueHex || "0x"], 
            account: userAddress 
        });
        return { success: true, hash };
    } catch (writeError) {
        const baseError = writeError.cause || writeError;
        throw new Error(`Transaction failed: ${baseError?.shortMessage || writeError.message}`);
    }
  }

  async loadDataFromKey(address, key) {
    if (!this.checkReadyForRead()) return null;
    const checksummedAddress = getChecksumAddressSafe(address);
    try {
        return await this.publicClient.readContract({ address: checksummedAddress, abi: ERC725Y_ABI, functionName: "getData", args: [key] });
    } catch (e) { throw e; }
  }

  async detectCollectionStandard(collectionAddress) {
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    if (!this.checkReadyForRead() || !checksummedCollectionAddr) return null;
    try {
      const [isLSP8, isLSP7] = await Promise.all([
          this.publicClient.readContract({ address: checksummedCollectionAddr, abi: ERC725Y_ABI, functionName: "supportsInterface", args: [LSP8_INTERFACE_ID] }).catch(() => false),
          this.publicClient.readContract({ address: checksummedCollectionAddr, abi: ERC725Y_ABI, functionName: "supportsInterface", args: [LSP7_INTERFACE_ID] }).catch(() => false)
      ]);
      if (isLSP8) return 'LSP8';
      if (isLSP7) return 'LSP7';
      return null;
    } catch (error) { return null; }
  }

  async getLSP7Balance(userAddress, collectionAddress) {
    const checksummedUserAddr = getChecksumAddressSafe(userAddress);
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    if (!this.checkReadyForRead() || !checksummedUserAddr || !checksummedCollectionAddr) return 0n;
    try {
      return await this.publicClient.readContract({
        address: checksummedCollectionAddr, abi: LSP7_ABI, functionName: "balanceOf", args: [checksummedUserAddr]
      });
    } catch (error) { return 0n; }
  }

  // === USER MODE: CHUNKED BATCH OWNED TOKENS ===
  // This function is STRICTLY for checking 'tokenIdsOf'. 
  // It should NEVER be used for 'totalSupply'.
  async getBatchCollectionData(userAddress, collections) {
    if (!this.checkReadyForRead() || !userAddress || collections.length === 0) return {};
    const checksummedUser = getChecksumAddressSafe(userAddress);
    const results = {};

    // Break collections into smaller chunks to prevent RPC limits
    const collectionChunks = chunkArray(collections, COLLECTION_CHUNK_SIZE);

    for (const chunk of collectionChunks) {
        try {
            // Add delay to prevent rate-limit
            await sleep(200); 

            const interfaceContracts = [];
            chunk.forEach(c => {
                interfaceContracts.push(
                    { address: c.address, abi: ERC725Y_ABI, functionName: 'supportsInterface', args: [LSP8_INTERFACE_ID] },
                    { address: c.address, abi: ERC725Y_ABI, functionName: 'supportsInterface', args: [LSP7_INTERFACE_ID] }
                );
            });

            // 1. Check Interfaces
            const interfaceResults = await this.publicClient.multicall({ 
                contracts: interfaceContracts,
                batchSize: MULTICALL_BATCH_SIZE 
            });
            
            const dataContracts = [];
            const chunkMeta = [];

            for (let i = 0; i < chunk.length; i++) {
                const addr = chunk[i].address;
                const isLSP8 = interfaceResults[i * 2]?.result;
                const isLSP7 = interfaceResults[i * 2 + 1]?.result;

                if (isLSP8) {
                    chunkMeta.push({ address: addr, standard: 'LSP8' });
                    // EXPLICIT: tokenIdsOf(user)
                    dataContracts.push({ address: addr, abi: LSP8_ABI, functionName: 'tokenIdsOf', args: [checksummedUser] });
                } else if (isLSP7) {
                    chunkMeta.push({ address: addr, standard: 'LSP7' });
                    // EXPLICIT: balanceOf(user)
                    dataContracts.push({ address: addr, abi: LSP7_ABI, functionName: 'balanceOf', args: [checksummedUser] });
                }
            }

            if (dataContracts.length > 0) {
                // 2. Fetch Data (Balances/TokenIds)
                const dataResults = await this.publicClient.multicall({ 
                    contracts: dataContracts,
                    batchSize: MULTICALL_BATCH_SIZE
                });
                
                dataResults.forEach((res, index) => {
                    const { address, standard } = chunkMeta[index];
                    if (res.status === 'success') {
                        if (standard === 'LSP8') {
                            results[address] = Array.isArray(res.result) ? res.result : [];
                        } else if (standard === 'LSP7' && res.result > 0n) {
                            results[address] = ['LSP7_TOKEN'];
                        }
                    }
                });
            }
        } catch (chunkError) {
            console.warn(`[CS] Error processing collection chunk. Skipping chunk.`, chunkError);
            await sleep(500);
        }
    }
    return results;
  }

  async getLSP4CollectionMetadata(collectionAddress) {
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    if (!this.checkReadyForRead() || !checksummedCollectionAddr) return null;
    try {
      const metadata = await resolveLsp4Metadata(this, checksummedCollectionAddr);
      if (!metadata?.LSP4Metadata) return null;
      
      const lsp4Data = metadata.LSP4Metadata;
      const name = lsp4Data.name || 'Unnamed Collection';
      const rawUrl = lsp4Data.icon?.[0]?.url || lsp4Data.images?.[0]?.[0]?.url || lsp4Data.assets?.[0]?.url;
      let imageUrl = null;
      if (rawUrl && typeof rawUrl === 'string') {
        const trimmedUrl = rawUrl.trim();
        if (trimmedUrl.startsWith('ipfs://')) imageUrl = `${IPFS_GATEWAY}${trimmedUrl.slice(7)}`;
        else if (trimmedUrl.startsWith('http') || trimmedUrl.startsWith('data:')) imageUrl = trimmedUrl;
      }
      return { name, image: imageUrl };
    } catch (error) { return null; }
  }
  
  async getOwnedLSP8TokenIdsForCollection(userAddress, collectionAddress) {
      const checksummedUserAddr = getChecksumAddressSafe(userAddress);
      const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
      if (!this.checkReadyForRead() || !checksummedUserAddr || !checksummedCollectionAddr) return [];
      try {
          return await this.publicClient.readContract({
              address: checksummedCollectionAddr, abi: LSP8_ABI, functionName: "tokenIdsOf", args: [checksummedUserAddr],
          });
      } catch (error) { return []; }
  }

  async getAllLSP8TokenIdsForCollection(collectionAddress) {
      const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
      if (!this.checkReadyForRead() || !checksummedCollectionAddr) return [];
      try {
          const total = await this.publicClient.readContract({ address: checksummedCollectionAddr, abi: LSP8_ABI, functionName: "totalSupply" });
          const totalAsNumber = Number(total);
          if (totalAsNumber === 0) return [];
          const tokenByIndexPromises = [];
          for (let i = 0; i < totalAsNumber; i++) {
              tokenByIndexPromises.push(
                  this.publicClient.readContract({ address: checksummedCollectionAddr, abi: LSP8_ABI, functionName: "tokenByIndex", args: [BigInt(i)] })
              );
          }
          const tokenIds = await Promise.all(tokenByIndexPromises);
          return tokenIds.filter(Boolean);
      } catch (error) { return []; }
  }

  async getTokenMetadata(collectionAddress, tokenId) {
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    if (!this.checkReadyForRead() || !checksummedCollectionAddr) return null;
    
    if (tokenId === 'LSP7_TOKEN') {
      const metadata = await this.getLSP4CollectionMetadata(collectionAddress);
      return metadata ? { name: metadata.name || 'LSP7 Token', image: metadata.image || null } : { name: 'LSP7 Token', image: null };
    }

    try {
      const lsp4Key = ERC725YDataKeys.LSP4.LSP4Metadata;
      const metadataUriBytes = await this.publicClient.readContract({
          address: checksummedCollectionAddr, abi: LSP8_ABI, functionName: "getDataForTokenId", args: [tokenId, lsp4Key]
      }).catch(() => null);

      let metadata = await this._processMetadataBytes(metadataUriBytes, tokenId);
      if (metadata) return metadata;

      // Fallback: Base URI
      const baseUriKey = ERC725YDataKeys.LSP8.LSP8TokenMetadataBaseURI;
      const baseUriBytes = await this.publicClient.readContract({
          address: checksummedCollectionAddr, abi: LSP8_ABI, functionName: "getData", args: [baseUriKey]
      }).catch(() => null);

      return await this._processBaseUriBytes(baseUriBytes, tokenId);

    } catch (error) { return null; }
  }

  // --- UPDATED: BATCH METADATA FETCH (Solves Metadata RPC Limits) ---
  async getTokensMetadataForPage(collectionAddress, identifiers, page, pageSize) {
    if (!this.checkReadyForRead() || !identifiers || identifiers.length === 0) return [];

    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    const pageIdentifiers = identifiers.slice(startIndex, endIndex);

    if (pageIdentifiers.length === 0) return [];

    const checksummedCollection = getChecksumAddressSafe(collectionAddress);
    const lsp4Key = ERC725YDataKeys.LSP4.LSP4Metadata;
    const baseUriKey = ERC725YDataKeys.LSP8.LSP8TokenMetadataBaseURI;

    try {
      // 1. Prepare Multicall
      const contractCalls = pageIdentifiers.map(tokenId => ({
        address: checksummedCollection,
        abi: LSP8_ABI,
        functionName: "getDataForTokenId",
        args: [tokenId, lsp4Key]
      }));

      contractCalls.push({
        address: checksummedCollection,
        abi: LSP8_ABI,
        functionName: "getData",
        args: [baseUriKey]
      });

      const results = await this.publicClient.multicall({ 
          contracts: contractCalls,
          batchSize: MULTICALL_BATCH_SIZE 
      });
      
      const baseUriResult = results.pop(); 
      const baseUriBytes = (baseUriResult.status === 'success') ? baseUriResult.result : null;

      // 2. Process results
      const metadataPromises = results.map(async (res, index) => {
        const tokenId = pageIdentifiers[index];
        let metadata = null;

        if (res.status === 'success' && res.result && res.result !== '0x') {
           metadata = await this._processMetadataBytes(res.result, tokenId);
        }

        if (!metadata && baseUriBytes && baseUriBytes !== '0x') {
           metadata = await this._processBaseUriBytes(baseUriBytes, tokenId);
        }

        if (!metadata || !metadata.image) return null;

        return {
            id: `${collectionAddress}-${tokenId}`,
            type: tokenId === 'LSP7_TOKEN' ? 'LSP7' : 'owned',
            address: collectionAddress,
            tokenId: tokenId,
            metadata: { name: metadata.name || `Token #${tokenId}`, image: metadata.image },
        };
      });

      const resolvedItems = await Promise.all(metadataPromises);
      return resolvedItems.filter(Boolean);

    } catch (e) {
      console.error("[CS] Batch metadata fetch failed:", e);
      return [];
    }
  }

  async getTokensMetadataByIds(tokenIds) {
    if (!this.checkReadyForRead() || !Array.isArray(tokenIds) || tokenIds.length === 0) return [];

    const tokensByCollection = tokenIds.reduce((acc, fullId) => {
        const parts = fullId.split('-');
        if (parts.length === 2) {
            const [addr, id] = parts;
            if (!acc[addr]) acc[addr] = [];
            acc[addr].push(id);
        }
        return acc;
    }, {});

    const allResults = [];

    // Process per collection
    for (const [collectionAddr, ids] of Object.entries(tokensByCollection)) {
        try {
            const res = await this.getTokensMetadataForPage(collectionAddr, ids, 0, ids.length);
            allResults.push(...res);
        } catch (e) { /* ignore individual collection failures */ }
    }
    return allResults;
  }
}

export default ConfigurationService;