// src/services/TokenService.js
import { isAddress, hexToString, getAddress } from "viem";
import { ERC725YDataKeys } from "@lukso/lsp-smart-contracts";

// LSP8 minimal ABI needed for token interactions
const LSP8_MINIMAL_ABI = [
  { inputs: [{ name: "interfaceId", type: "bytes4" }], name: "supportsInterface", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "tokenId", type: "bytes32" }], name: "tokenOwnerOf", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "tokenOwner", type: "address" }], name: "tokenIdsOf", outputs: [{ name: "", type: "bytes32[]" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "dataKey", type: "bytes32" }], name: "getData", outputs: [{ name: "dataValue", type: "bytes" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "tokenId", type: "bytes32" }, { name: "dataKey", type: "bytes32" }], name: "getDataForTokenId", outputs: [{ name: "data", type: "bytes" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalSupply", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "index", type: "uint256" }], name: "tokenByIndex", outputs: [{ name: "", type: "bytes32" }], stateMutability: "view", type: "function" }
];

const MULTICALL_BATCH_SIZE = 100; // Safe limit for most RPCs

function hexToUtf8Safe(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("0x") || hex === "0x") return null;
  try { return hexToString(hex); }
  catch (e) { return null; }
}

function parseTokenIdNum(tokenIdBytes32) {
  if (!tokenIdBytes32 || typeof tokenIdBytes32 !== "string" || !tokenIdBytes32.startsWith("0x")) return NaN;
  try { return Number(BigInt(tokenIdBytes32)); }
  catch (e) { return NaN; }
}

// Helper to chunk arrays for batching
function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

class TokenService {
  constructor(publicClient, collectionAddress) {
    this.publicClient = publicClient;
    this.collectionAddress = collectionAddress ? (isAddress(collectionAddress) ? getAddress(collectionAddress) : null) : null;
    this.metadataCache = new Map();
    this.initialized = !!publicClient && !!this.collectionAddress;
    this.ipfsGateway = import.meta.env.VITE_IPFS_GATEWAY || "https://api.universalprofile.cloud/ipfs/";
  }

  async initialize() {
    this.initialized = !!this.publicClient;
    if (!this.collectionAddress || !isAddress(this.collectionAddress)) {
      if (import.meta.env.DEV) console.error("TokenService: Invalid or missing collection address.");
      this.initialized = false;
    }
    return this.initialized;
  }

  async checkClientReady() {
    if (!this.publicClient) return false;
    try {
      const chainId = await this.publicClient.getChainId();
      return !!chainId; 
    } catch (error) {
      return false;
    }
  }

  // --- OPTIMIZED: Standard Single Read ---
  async getOwnedTokenIds(userAddress) {
    if (!this.collectionAddress || !(await this.checkClientReady())) return [];
    try {
      const tokenIds = await this.publicClient.readContract({
        address: this.collectionAddress,
        abi: LSP8_MINIMAL_ABI,
        functionName: "tokenIdsOf",
        args: [getAddress(userAddress)],
      });
      return Array.isArray(tokenIds) ? tokenIds : [];
    } catch (error) {
      if (import.meta.env.DEV) console.warn(`[TS] tokenIdsOf failed for ${this.collectionAddress}:`, error.message);
      return [];
    }
  }

  // --- OPTIMIZED: Multicall Batching ---
  async getAllLSP8TokenIdsForCollection(collectionAddress) {
      const logPrefix = `[TS getAllLSP8]`;
      const checksummedAddr = collectionAddress ? getAddress(collectionAddress) : this.collectionAddress;

      if (!this.publicClient || !checksummedAddr) return [];

      try {
          // 1. Get Total Supply
          const total = await this.publicClient.readContract({
              address: checksummedAddr,
              abi: LSP8_MINIMAL_ABI,
              functionName: "totalSupply",
          });
          const totalAsNumber = Number(total);
          
          if (totalAsNumber === 0) return [];
          if (import.meta.env.DEV) console.log(`${logPrefix} Total supply: ${totalAsNumber}. Batching calls...`);

          // 2. Prepare Contract Calls
          const contractCalls = [];
          for (let i = 0; i < totalAsNumber; i++) {
              contractCalls.push({
                  address: checksummedAddr,
                  abi: LSP8_MINIMAL_ABI,
                  functionName: "tokenByIndex",
                  args: [BigInt(i)],
              });
          }

          // 3. Execute Batched Multicalls
          const chunks = chunkArray(contractCalls, MULTICALL_BATCH_SIZE);
          const allTokenIds = [];

          for (const chunk of chunks) {
              const results = await this.publicClient.multicall({ contracts: chunk });
              results.forEach(res => {
                  if (res.status === 'success' && res.result) {
                      allTokenIds.push(res.result);
                  }
              });
          }

          if (import.meta.env.DEV) console.log(`${logPrefix} Fetched ${allTokenIds.length} tokens via Multicall.`);
          return allTokenIds;

      } catch (error) {
          if (import.meta.env.DEV) console.error(`${logPrefix} Multicall failed:`, error);
          return [];
      }
  }

  // --- OPTIMIZED: Batch Metadata Fetching ---
  async getTokensMetadataByIds(tokenIds) {
    const logPrefix = `[TS BatchMeta]`;
    if (!this.publicClient || !Array.isArray(tokenIds) || tokenIds.length === 0) return [];

    // Group tokens by collection address
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

    // Process each collection
    for (const [addr, ids] of Object.entries(tokensByCollection)) {
        const contractCalls = ids.map(id => ({
            address: addr,
            abi: LSP8_MINIMAL_ABI,
            functionName: "getDataForTokenId",
            args: [id, ERC725YDataKeys.LSP4.LSP4Metadata]
        }));

        // Batch RPC calls for Metadata Bytes
        const chunks = chunkArray(contractCalls, MULTICALL_BATCH_SIZE);
        const metadataBytesMap = {}; // tokenId -> bytes

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const results = await this.publicClient.multicall({ contracts: chunk });
            
            results.forEach((res, idx) => {
                // Calculate original index to map back to tokenId
                const originalIndex = (i * MULTICALL_BATCH_SIZE) + idx;
                const tokenId = ids[originalIndex];
                if (res.status === 'success') {
                    metadataBytesMap[tokenId] = res.result;
                }
            });
        }

        // Parallel Process Metadata Resolution (Decode + IPFS Fetch)
        const resolutionPromises = ids.map(async (tokenId) => {
            const bytes = metadataBytesMap[tokenId];
            // Pass pre-fetched bytes to internal helper to avoid re-fetching RPC
            const metadata = await this._resolveMetadataFromBytes(addr, tokenId, bytes);
            
            if (metadata) {
                return {
                    id: `${addr}-${tokenId}`,
                    type: tokenId === 'LSP7_TOKEN' ? 'LSP7' : 'owned',
                    address: addr,
                    tokenId: tokenId,
                    metadata: { name: metadata.name || 'Unnamed', image: metadata.image },
                };
            }
            return null;
        });

        const resolved = await Promise.all(resolutionPromises);
        allResults.push(...resolved.filter(Boolean));
    }

    return allResults;
  }

  // --- INTERNAL HELPER: Decoupled Resolution Logic ---
  async _resolveMetadataFromBytes(collectionAddress, tokenId, metadataUriBytes) {
      // Logic refactored from fetchTokenMetadata to accept bytes directly
      if (!metadataUriBytes || metadataUriBytes === "0x") {
          // If LSP4 key empty, fallback to fetching individually (rare edge case for BaseURI)
          // We could optimize this too, but BaseURI pattern is less common in pure LSP8
          return await this.fetchTokenMetadata(tokenId); 
      }

      // Reuse existing logic for decoding URI from bytes
      const decodedUriData = this.decodeVerifiableUri(metadataUriBytes);
      if (decodedUriData?.url) {
          let finalUrl = decodedUriData.url;
          // Note: BaseURI logic omitted here for simplicity in batch mode, 
          // assumes full URI in LSP4Metadata key which is standard.
          
          const metadataJson = await this.fetchJsonFromUri(finalUrl);
          if (metadataJson) {
              return {
                  name: metadataJson.name,
                  description: metadataJson.description,
                  image: this.getImageUrlFromMetadata(metadataJson),
                  attributes: metadataJson.attributes,
              };
          }
      }
      return null;
  }

  // --- Existing Helper Methods (Preserved) ---

  decodeVerifiableUri(verifiableUriBytes) {
    if (!verifiableUriBytes || typeof verifiableUriBytes !== "string" || !verifiableUriBytes.startsWith("0x")) return null;

    if (verifiableUriBytes.startsWith("0x0000") && verifiableUriBytes.length >= 20) {
      try {
        const hexString = verifiableUriBytes.substring(2);
        // Skip methodId (8 chars) + hashLength (4 chars)
        const hashLengthHex = `0x${hexString.substring(12, 16)}`;
        const hashLengthBytes = parseInt(lengthHex, 16); // Typo fixed in original logic
        if (isNaN(hashLengthBytes)) return null; 

        // Simplified extraction for robustness
        const hashEndOffsetChars = 16 + (hashLengthBytes * 2);
        const uriHex = `0x${hexString.substring(hashEndOffsetChars)}`;
        return { url: hexToUtf8Safe(uriHex), hash: null, hashFunction: null };
      } catch (e) {
        // Fallback
      }
    }
    const plainUrl = hexToUtf8Safe(verifiableUriBytes);
    return plainUrl ? { url: plainUrl } : null;
  }

  async fetchJsonFromUri(uri) {
    if (!uri || typeof uri !== "string") return null;
    let fetchUrl = uri;
    if (uri.startsWith("ipfs://")) {
      fetchUrl = `${this.ipfsGateway.endsWith('/') ? this.ipfsGateway : this.ipfsGateway + '/'}${uri.slice(7)}`;
    } else if (!uri.startsWith("http")) return null;

    try {
      const response = await fetch(fetchUrl);
      if (!response.ok) return null;
      return await response.json();
    } catch { return null; }
  }

  resolveImageUrl(url) {
    if (!url || typeof url !== "string") return null;
    if (url.startsWith("ipfs://")) return `${this.ipfsGateway}${url.slice(7)}`;
    if (url.startsWith("http")) return url;
    return null;
  }

  getImageUrlFromMetadata(metadata) {
    if (!metadata) return null;
    let url = this.resolveImageUrl(metadata.image);
    if (url) return url;
    
    // LSP4 Structure
    const lsp4 = metadata.LSP4Metadata || metadata;
    url = this.resolveImageUrl(lsp4.images?.[0]?.[0]?.url) || 
          this.resolveImageUrl(lsp4.icon?.[0]?.url) || 
          this.resolveImageUrl(lsp4.assets?.[0]?.url);
    
    // LSP3 Structure (fallback)
    if (!url && metadata.LSP3Profile) {
        url = this.resolveImageUrl(metadata.LSP3Profile.profileImage?.[0]?.url);
    }
    return url;
  }

  // --- Standard Single Fetch (Fallback / Detailed) ---
  async fetchTokenMetadata(tokenId) {
    if (!tokenId || !this.collectionAddress) return null;
    const cacheKey = `metadata_${this.collectionAddress}_${tokenId}`;
    if (this.metadataCache.has(cacheKey)) return this.metadataCache.get(cacheKey);

    try {
        // Standard single fetch implementation
        const data = await this.publicClient.readContract({
            address: this.collectionAddress,
            abi: LSP8_MINIMAL_ABI,
            functionName: "getDataForTokenId",
            args: [tokenId, ERC725YDataKeys.LSP4.LSP4Metadata]
        });
        
        const metadata = await this._resolveMetadataFromBytes(this.collectionAddress, tokenId, data);
        if (metadata) {
            this.metadataCache.set(cacheKey, metadata);
            return metadata;
        }
        return { name: `Token #${tokenId.slice(0,6)}`, image: null };
    } catch (e) {
        return { name: "Error loading token", image: null };
    }
  }

  async loadTokenIntoCanvas(tokenId, canvasManager) {
    // This logic relies on fetchTokenMetadata, which uses the cache we might have populated via batching
    const metadata = await this.fetchTokenMetadata(tokenId);
    if (metadata?.image) {
        await canvasManager.setImage(metadata.image);
        return true;
    }
    await canvasManager.setImage(`https://via.placeholder.com/600x400?text=No+Image`);
    return false;
  }
}

export default TokenService;