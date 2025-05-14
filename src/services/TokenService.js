// src/services/TokenService.js
import { isAddress, hexToString, getAddress } from "viem"; // Removed unused: slice, decodeAbiParameters, parseAbiParameters
import { ERC725YDataKeys } from "@lukso/lsp-smart-contracts";

// LSP8 minimal ABI needed for token interactions
const LSP8_MINIMAL_ABI = [
  { inputs: [{ name: "interfaceId", type: "bytes4" }], name: "supportsInterface", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "tokenId", type: "bytes32" }], name: "tokenOwnerOf", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "tokenOwner", type: "address" }], name: "tokenIdsOf", outputs: [{ name: "", type: "bytes32[]" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "dataKey", type: "bytes32" }], name: "getData", outputs: [{ name: "dataValue", type: "bytes" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "dataKeys", type: "bytes32[]" }], name: "getDataBatch", outputs: [{ name: "dataValues", type: "bytes[]" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "tokenId", type: "bytes32" }, { name: "dataKey", type: "bytes32" }], name: "getDataForTokenId", outputs: [{ name: "data", type: "bytes" }], stateMutability: "view", type: "function" },
];

/**
 * Safely decodes hex to UTF-8 string, returning null on error.
 * @param {string | null | undefined} hex - The hex string to decode.
 * @returns {string | null} The decoded string or null.
 */
function hexToUtf8Safe(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("0x") || hex === "0x") return null;
  try { return hexToString(hex); }
  catch (e) {
    if (import.meta.env.DEV) {
        console.warn("[TS] Failed hexToString:", hex, e);
    }
    return null;
  }
}

/**
 * Safely parses bytes32 hex string to a number, returning NaN on error.
 * @param {string | null | undefined} tokenIdBytes32 - The bytes32 token ID.
 * @returns {number} The parsed number or NaN.
 */
function parseTokenIdNum(tokenIdBytes32) {
  if (!tokenIdBytes32 || typeof tokenIdBytes32 !== "string" || !tokenIdBytes32.startsWith("0x")) return NaN;
  try { return Number(BigInt(tokenIdBytes32)); }
  catch (e) {
    if (import.meta.env.DEV) {
        console.warn(`[TS] Could not parse tokenId ${tokenIdBytes32} as number:`, e);
    }
    return NaN;
  }
}

/**
 * @typedef {object} DecodedVerifiableUri
 * @property {string} url - The decoded URL.
 * @property {string|null} hashFunction - The hash function identifier (e.g., 'keccak256(utf8)'), or null.
 * @property {string|null} hash - The hash value, or null.
 */

/**
 * @typedef {object} TokenMetadata
 * @property {string} name - The name of the token.
 * @property {string} [description] - The description of the token.
 * @property {string|null} image - The resolved image URL for the token.
 * @property {any} [attributes] - Other attributes from the metadata.
 */


/**
 * Service class for interacting with LSP8 NFT collections.
 * Handles fetching owned token IDs and resolving token metadata (including images)
 * using a Viem Public Client. Includes internal caching for metadata.
 */
class TokenService {
  /** @type {import('viem').PublicClient | null} */
  publicClient = null;
  /** @type {string | null} */
  collectionAddress = null;
  /** @type {Map<string, TokenMetadata>} */
  metadataCache = new Map();
  /** @type {boolean} */
  initialized = false;
  /** @type {string} */
  ipfsGateway = "https://api.universalprofile.cloud/ipfs/"; // Default, can be overridden by env var

  /**
   * Creates an instance of TokenService.
   * @param {import('viem').PublicClient | null} publicClient - The Viem Public Client instance.
   * @param {string | null} collectionAddress - The address of the LSP8 collection contract.
   */
  constructor(publicClient, collectionAddress) {
    this.publicClient = publicClient;
    this.collectionAddress = collectionAddress ? (isAddress(collectionAddress) ? getAddress(collectionAddress) : null) : null;
    this.metadataCache = new Map();
    this.initialized = !!publicClient && !!this.collectionAddress;
    if (import.meta.env.VITE_IPFS_GATEWAY) {
        this.ipfsGateway = import.meta.env.VITE_IPFS_GATEWAY;
    }
  }

  /**
   * Initializes the service, checking for client and valid collection address.
   * @async
   * @returns {Promise<boolean>} True if ready, false otherwise.
   */
  async initialize() {
    this.initialized = !!this.publicClient;
    if (!this.collectionAddress || !isAddress(this.collectionAddress)) {
      if (import.meta.env.DEV) {
        console.error("TokenService: Invalid or missing collection address during initialization.");
      }
      this.initialized = false;
    }
    return this.initialized;
  }

  /**
   * Checks if the Viem Public Client is available and connected.
   * @async
   * @returns {Promise<boolean>} True if client is ready, false otherwise.
   */
  async checkClientReady() {
    if (!this.publicClient) {
      if (import.meta.env.DEV) {
        console.warn("TokenService: Public Client not available.");
      }
      return false;
    }
    try {
      const chainId = await this.publicClient.getChainId();
      return !!chainId; // Basic check to see if client can communicate
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("[TokenService] Error checking public client:", error);
      }
      return false;
    }
  }

  /**
   * Retrieves the token IDs owned by a specific user within this collection.
   * @param {string} userAddress - The address of the user.
   * @returns {Promise<string[]>} An array of bytes32 token IDs. Returns empty array on error or if none found.
   */
  async getOwnedTokenIds(userAddress) {
    if (!userAddress || !isAddress(userAddress)) {
      if (import.meta.env.DEV) {
        console.warn("[TS] getOwnedTokenIds: Invalid userAddress.");
      }
      return [];
    }
    if (!this.collectionAddress) { // Already checked for isAddress in constructor/initialize
      if (import.meta.env.DEV) {
        console.warn("[TS] getOwnedTokenIds: Invalid or uninitialized collectionAddress.");
      }
      return [];
    }
    if (!(await this.checkClientReady())) {
      if (import.meta.env.DEV) {
        console.warn("[TS] getOwnedTokenIds: Client not ready.");
      }
      return [];
    }

    try {
      const tokenIds = await this.publicClient.readContract({
        address: this.collectionAddress,
        abi: LSP8_MINIMAL_ABI,
        functionName: "tokenIdsOf",
        args: [getAddress(userAddress)], // Ensure checksummed
      });
      return Array.isArray(tokenIds) ? tokenIds : [];
    } catch (error) {
      if (import.meta.env.DEV) {
        if (error?.message?.includes("InvalidArgumentsError") || error?.message?.includes("call exception")) {
          console.warn(`[TS] Contract ${this.collectionAddress} likely doesn't support tokenIdsOf or address ${userAddress} has no tokens.`);
        } else {
          console.error("[TS] Error calling tokenIdsOf:", error);
        }
      }
      return [];
    }
  }

  /**
   * Decodes VerifiableURI bytes according to LSP2 specification.
   * @param {string} verifiableUriBytes - The hex string (0x...) representing the VerifiableURI.
   * @returns {DecodedVerifiableUri | null} Decoded data or null on failure.
   */
  decodeVerifiableUri(verifiableUriBytes) {
    if (!verifiableUriBytes || typeof verifiableUriBytes !== "string" || !verifiableUriBytes.startsWith("0x")) return null;

    if (verifiableUriBytes.startsWith("0x0000") && verifiableUriBytes.length >= (2 + 4 + 2 + 0 + 0) * 2) {
      try {
        const hexString = verifiableUriBytes.substring(2);
        const methodId = `0x${hexString.substring(4, 12)}`;
        const lengthHex = `0x${hexString.substring(12, 16)}`;
        const hashLengthBytes = parseInt(lengthHex, 16);

        if (isNaN(hashLengthBytes)) throw new Error("Invalid hash length bytes in VerifiableURI");

        const hashLengthChars = hashLengthBytes * 2;
        const hashStartOffsetChars = 16;
        const hashEndOffsetChars = hashStartOffsetChars + hashLengthChars;

        if (hexString.length < hashEndOffsetChars) throw new Error("Byte string too short for declared hash length");

        const hash = `0x${hexString.substring(hashStartOffsetChars, hashEndOffsetChars)}`;
        const uriHex = `0x${hexString.substring(hashEndOffsetChars)}`;
        const url = hexToUtf8Safe(uriHex);

        if (!url) throw new Error("Failed to decode URL part of VerifiableURI");

        let hashFunction = null;
        if (methodId === "0x6f357c6a") hashFunction = "keccak256(utf8)";
        else if (methodId === "0x8019f9b1") hashFunction = "keccak256(bytes)";

        return { url, hashFunction, hash };
      } catch (e) {
        if (import.meta.env.DEV) {
            console.error("[TS] Error decoding VerifiableURI:", verifiableUriBytes, e);
        }
      }
    }

    const plainUrl = hexToUtf8Safe(verifiableUriBytes);
    if (plainUrl) {
      return { url: plainUrl, hashFunction: null, hash: null };
    }

    if (import.meta.env.DEV) {
        console.warn("[TS] Could not decode URI bytes as VerifiableURI or plain URL:", verifiableUriBytes);
    }
    return null;
  }

  /**
   * Fetches JSON data from a given URI (resolving IPFS URIs).
   * @param {string} uri - The URI (http, https, or ipfs) to fetch from.
   * @returns {Promise<object|null>} The parsed JSON object or null on error.
   * @async
   */
  async fetchJsonFromUri(uri) {
    if (!uri || typeof uri !== "string") return null;
    let fetchUrl = uri;

    if (uri.startsWith("ipfs://")) {
      fetchUrl = `${this.ipfsGateway.endsWith('/') ? this.ipfsGateway : this.ipfsGateway + '/'}${uri.slice(7)}`;
    } else if (!uri.startsWith("http")) {
      if (import.meta.env.DEV) {
        console.warn(`[TS] Skipping fetch for unknown scheme: ${uri}`);
      }
      return null;
    }

    try {
      const response = await fetch(fetchUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${fetchUrl}`);
      }
      return await response.json();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`[TS] Fetch/Parse JSON Error from ${fetchUrl}:`, error);
      }
      return null;
    }
  }

  /**
   * Resolves an IPFS or HTTP URL string to a fetchable URL.
   * @param {string | null | undefined} url - The URL to resolve.
   * @returns {string | null} The fetchable URL or null.
   */
  resolveImageUrl(url) {
    if (!url || typeof url !== "string") return null;
    if (url.startsWith("ipfs://")) {
        return `${this.ipfsGateway.endsWith('/') ? this.ipfsGateway : this.ipfsGateway + '/'}${url.slice(7)}`;
    }
    if (url.startsWith("http")) return url;
    return null;
  }

  /**
   * Extracts the primary image URL from potentially nested LSP3/LSP4 metadata.
   * @param {object | null} metadata - The metadata object.
   * @returns {string | null} The resolved image URL or null.
   */
  getImageUrlFromMetadata(metadata) {
    if (!metadata || typeof metadata !== "object") return null;
    let imageUrl = null;

    imageUrl = this.resolveImageUrl(metadata.image);
    if (imageUrl) return imageUrl;

    if (metadata.LSP4Metadata) {
        imageUrl = this.resolveImageUrl(metadata.LSP4Metadata.images?.[0]?.[0]?.url);
        if (imageUrl) return imageUrl;
        imageUrl = this.resolveImageUrl(metadata.LSP4Metadata.icon?.[0]?.url);
        if (imageUrl) return imageUrl;
        imageUrl = this.resolveImageUrl(metadata.LSP4Metadata.assets?.[0]?.url);
        if (imageUrl) return imageUrl;
    }

    if (metadata.LSP3Profile) {
        imageUrl = this.resolveImageUrl(metadata.LSP3Profile.profileImage?.[0]?.url);
        if (imageUrl) return imageUrl;
        imageUrl = this.resolveImageUrl(metadata.LSP3Profile.backgroundImage?.[0]?.url);
        if (imageUrl) return imageUrl;
    }
    return null;
  }

  /**
   * Fetches, processes, and caches metadata for a specific token ID within the collection.
   * @param {string} tokenId - The bytes32 token ID.
   * @returns {Promise<TokenMetadata|null>} Processed metadata or a fallback object on error. Returns null for invalid input.
   * @async
   */
  async fetchTokenMetadata(tokenId) {
    if (!tokenId || typeof tokenId !== "string" || !tokenId.startsWith("0x") || !this.collectionAddress) {
        if(import.meta.env.DEV) console.warn("[TS fetchTokenMetadata] Invalid tokenId or uninitialized collectionAddress.");
        return null;
    }

    const cacheKey = `metadata_${this.collectionAddress}_${tokenId}`;
    if (this.metadataCache.has(cacheKey)) {
      return this.metadataCache.get(cacheKey) || null;
    }

    if (!(await this.checkClientReady())) {
      if (import.meta.env.DEV) {
        console.warn("[TS fetchTokenMetadata] Client not ready.");
      }
      return null;
    }

    const displayId = parseTokenIdNum(tokenId);
    const fallbackMeta = { name: `Token #${displayId || tokenId.slice(0, 8)}...`, description: "Metadata loading failed", image: null };

    try {
      const lsp4MetadataKey = ERC725YDataKeys.LSP4.LSP4Metadata;
      let metadataUriBytes = await this.publicClient.readContract({
          address: this.collectionAddress, abi: LSP8_MINIMAL_ABI, functionName: "getDataForTokenId", args: [tokenId, lsp4MetadataKey],
        }).catch(() => null);

      if (!metadataUriBytes || metadataUriBytes === "0x") {
        const baseUriKey = ERC725YDataKeys.LSP8.LSP8TokenMetadataBaseURI;
        metadataUriBytes = await this.publicClient.readContract({
            address: this.collectionAddress, abi: LSP8_MINIMAL_ABI, functionName: "getData", args: [baseUriKey],
          }).catch(() => null);
      }

      if (metadataUriBytes && metadataUriBytes !== "0x") {
        const decodedUriData = this.decodeVerifiableUri(metadataUriBytes);
        if (decodedUriData?.url) {
          let finalUrl = decodedUriData.url;
          const baseUriCheckBytes = await this.publicClient.readContract({
              address: this.collectionAddress, abi: LSP8_MINIMAL_ABI, functionName: "getData", args: [ERC725YDataKeys.LSP8.LSP8TokenMetadataBaseURI],
            }).catch(() => null);

          if (metadataUriBytes === baseUriCheckBytes && baseUriCheckBytes !== null) {
            const formattedTokenIdPart = parseTokenIdNum(tokenId).toString();
            if (!isNaN(Number(formattedTokenIdPart))) {
                finalUrl = finalUrl.endsWith("/") ? `${finalUrl}${formattedTokenIdPart}` : `${finalUrl}/${formattedTokenIdPart}`;
            } else if (import.meta.env.DEV) {
                console.warn(`[TS] Token ID ${tokenId} could not be parsed to a number for base URI construction. Using raw base URI: ${finalUrl}`);
            }
          }

          const metadataJson = await this.fetchJsonFromUri(finalUrl);
          if (metadataJson) {
            const processedMetadata = {
                name: metadataJson.name || fallbackMeta.name,
                description: metadataJson.description,
                image: this.getImageUrlFromMetadata(metadataJson),
                attributes: metadataJson.attributes,
            };
            this.metadataCache.set(cacheKey, processedMetadata);
            return processedMetadata;
          }
        }
      }

      if (import.meta.env.DEV) {
        console.warn(`[TS] No metadata URI resolved or fetched for ${tokenId} in collection ${this.collectionAddress}. Using fallback.`);
      }
      this.metadataCache.set(cacheKey, fallbackMeta);
      return fallbackMeta;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`[TS] Critical error fetching metadata for ${tokenId} in ${this.collectionAddress}:`, error);
      }
      this.metadataCache.set(cacheKey, fallbackMeta);
      return fallbackMeta;
    }
  }

  /**
   * Loads a token's image into a specific CanvasManager instance.
   * @param {string} tokenId - The bytes32 token ID.
   * @param {import('../utils/CanvasManager').default} canvasManager - The target CanvasManager instance.
   * @returns {Promise<boolean>} True if image was successfully set (or attempted with a valid URL), false otherwise.
   * @async
   */
  async loadTokenIntoCanvas(tokenId, canvasManager) {
    if (!tokenId || !canvasManager?.setImage || typeof canvasManager.setImage !== 'function') {
      if (import.meta.env.DEV) {
        console.error("TokenService: Invalid parameters for loadTokenIntoCanvas.");
      }
      return false;
    }

    const displayId = parseTokenIdNum(tokenId);
    const placeholderUrl = `https://via.placeholder.com/600x400/444444/cccccc.png?text=Loading...+(${displayId || tokenId.slice(0, 6)})`;
    const errorPlaceholder = `https://via.placeholder.com/600x400/cc3333/ffffff.png?text=Load+Error+(${displayId || tokenId.slice(0, 6)})`;

    try {
      await canvasManager.setImage(placeholderUrl);
      const metadata = await this.fetchTokenMetadata(tokenId);
      const imageUrl = metadata?.image;

      if (!imageUrl || typeof imageUrl !== "string") {
        if (import.meta.env.DEV) {
            console.warn(`[TS] No valid image URL found in metadata for token ${tokenId}. Using error placeholder.`);
        }
        await canvasManager.setImage(errorPlaceholder);
        return false;
      }

      await canvasManager.setImage(imageUrl);
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`[TS] Error loading token ${tokenId} into canvas:`, error);
      }
      try {
        await canvasManager.setImage(errorPlaceholder);
      } catch (fallbackError) {
        if (import.meta.env.DEV) {
            console.error("[TS] Failed to load error placeholder into canvas:", fallbackError);
        }
      }
      return false;
    }
  }

  /**
   * Applies multiple token assignments to their respective CanvasManager instances.
   * @param {Object.<string, string>} tokenAssignments - An object mapping layerId to tokenId (bytes32).
   * @param {Object.<string, import('../utils/CanvasManager').default>} canvasManagers - An object mapping layerId to CanvasManager instances.
   * @returns {Promise<Object.<string, {success: boolean, tokenId: string | null, error?: string}>>} An object detailing success/failure per layer.
   * @async
   */
  async applyTokenAssignments(tokenAssignments, canvasManagers) {
    /** @type {Object.<string, {success: boolean, tokenId: string | null, error?: string}>} */
    const results = {};
    if (!tokenAssignments || !canvasManagers) {
        if(import.meta.env.DEV) console.warn("[TS applyTokenAssignments] Missing tokenAssignments or canvasManagers.");
        return results;
    }
    if (!(await this.checkClientReady())) {
      if (import.meta.env.DEV) {
        console.warn("[TS applyTokenAssignments] Client not ready.");
      }
      Object.keys(tokenAssignments).forEach(layerId => {
        results[layerId] = { success: false, tokenId: tokenAssignments[layerId], error: "Client not ready" };
      });
      return results;
    }

    const promises = Object.entries(tokenAssignments).map(
      async ([layerId, tokenId]) => {
        results[layerId] = { success: false, tokenId: tokenId || null };
        if (!tokenId) {
          results[layerId].error = "No token ID provided for layer";
          return;
        }
        const manager = canvasManagers[layerId];
        if (!manager) {
          if (import.meta.env.DEV) {
            console.warn(`[TS applyTokenAssignments] No manager found for layer ${layerId}`);
          }
          results[layerId].error = "Canvas manager not found for layer";
          return;
        }
        try {
          const success = await this.loadTokenIntoCanvas(tokenId, manager);
          results[layerId].success = success;
          if (!success) {
            results[layerId].error = results[layerId].error || "Image load into canvas failed";
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error(`[TS applyTokenAssignments] Error applying token ${tokenId} to layer ${layerId}:`, error);
          }
          results[layerId].error = error.message || "Unknown error during token application";
        }
      },
    );

    await Promise.allSettled(promises);
    return results;
  }
}

export default TokenService;