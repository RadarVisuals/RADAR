// src/services/TokenService.js
import { isAddress, getAddress } from "viem";
import { ERC725YDataKeys } from "@lukso/lsp-smart-contracts";
import { 
    decodeVerifiableUri, 
    fetchMetadata, 
    extractImageFromMetadata, 
    resolveLsp4Metadata 
} from '../utils/erc725.js';

// LSP8 minimal ABI
const LSP8_MINIMAL_ABI = [
  { inputs: [{ name: "interfaceId", type: "bytes4" }], name: "supportsInterface", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "tokenId", type: "bytes32" }], name: "tokenOwnerOf", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "tokenOwner", type: "address" }], name: "tokenIdsOf", outputs: [{ name: "", type: "bytes32[]" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "dataKey", type: "bytes32" }], name: "getData", outputs: [{ name: "dataValue", type: "bytes" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "tokenId", type: "bytes32" }, { name: "dataKey", type: "bytes32" }], name: "getDataForTokenId", outputs: [{ name: "data", type: "bytes" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalSupply", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "index", type: "uint256" }], name: "tokenByIndex", outputs: [{ name: "", type: "bytes32" }], stateMutability: "view", type: "function" }
];

const MULTICALL_BATCH_SIZE = 100;

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

  async getAllLSP8TokenIdsForCollection(collectionAddress) {
      const checksummedAddr = collectionAddress ? getAddress(collectionAddress) : this.collectionAddress;
      if (!this.publicClient || !checksummedAddr) return [];

      try {
          const total = await this.publicClient.readContract({
              address: checksummedAddr,
              abi: LSP8_MINIMAL_ABI,
              functionName: "totalSupply",
          });
          const totalAsNumber = Number(total);
          
          if (totalAsNumber === 0) return [];

          const contractCalls = [];
          for (let i = 0; i < totalAsNumber; i++) {
              contractCalls.push({
                  address: checksummedAddr,
                  abi: LSP8_MINIMAL_ABI,
                  functionName: "tokenByIndex",
                  args: [BigInt(i)],
              });
          }

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
          return allTokenIds;
      } catch (error) {
          if (import.meta.env.DEV) console.error(`[TS] Multicall failed:`, error);
          return [];
      }
  }

  async getTokensMetadataByIds(tokenIds) {
    if (!this.publicClient || !Array.isArray(tokenIds) || tokenIds.length === 0) return [];

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

    for (const [addr, ids] of Object.entries(tokensByCollection)) {
        const contractCalls = ids.map(id => ({
            address: addr,
            abi: LSP8_MINIMAL_ABI,
            functionName: "getDataForTokenId",
            args: [id, ERC725YDataKeys.LSP4.LSP4Metadata]
        }));

        const chunks = chunkArray(contractCalls, MULTICALL_BATCH_SIZE);
        const metadataBytesMap = {}; 

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const results = await this.publicClient.multicall({ contracts: chunk });
            
            results.forEach((res, idx) => {
                const originalIndex = (i * MULTICALL_BATCH_SIZE) + idx;
                const tokenId = ids[originalIndex];
                if (res.status === 'success') {
                    metadataBytesMap[tokenId] = res.result;
                }
            });
        }

        const resolutionPromises = ids.map(async (tokenId) => {
            const bytes = metadataBytesMap[tokenId];
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

  // --- REFACTORED INTERNAL HELPER ---
  async _resolveMetadataFromBytes(collectionAddress, tokenId, metadataUriBytes) {
      if (!metadataUriBytes || metadataUriBytes === "0x") {
          return await this.fetchTokenMetadata(tokenId); 
      }

      // Use centralized decoder
      const url = decodeVerifiableUri(metadataUriBytes);
      if (url) {
          const metadataJson = await fetchMetadata(url);
          if (metadataJson) {
              const image = extractImageFromMetadata(metadataJson);
              return {
                  name: metadataJson.LSP4Metadata?.name || metadataJson.name,
                  description: metadataJson.LSP4Metadata?.description || metadataJson.description,
                  image: image,
                  attributes: metadataJson.attributes,
              };
          }
      }
      return null;
  }

  async fetchTokenMetadata(tokenId) {
    if (!tokenId || !this.collectionAddress) return null;
    const cacheKey = `metadata_${this.collectionAddress}_${tokenId}`;
    if (this.metadataCache.has(cacheKey)) return this.metadataCache.get(cacheKey);

    try {
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