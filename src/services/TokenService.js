import { isAddress, hexToString } from "viem"; // Removed unused numberToHex
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

/** Safely decodes hex to UTF-8 string, returning null on error. */
function hexToUtf8Safe(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("0x") || hex === "0x") return null;
  try { return hexToString(hex); }
  catch (e) { console.warn("[TS] Failed hexToString:", hex, e); return null; }
}

/** Safely parses bytes32 hex string to a number, returning NaN on error. */
function parseTokenIdNum(tokenIdBytes32) {
  if (!tokenIdBytes32 || typeof tokenIdBytes32 !== "string" || !tokenIdBytes32.startsWith("0x")) return NaN;
  try { return Number(BigInt(tokenIdBytes32)); }
  catch (e) { console.warn(`[TS] Could not parse tokenId ${tokenIdBytes32} as number:`, e); return NaN; }
}

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
  /** @type {Map<string, object>} */
  metadataCache = new Map();
  /** @type {boolean} */
  initialized = false;
  /** @type {string} */
  ipfsGateway = "https://api.universalprofile.cloud/ipfs/";

  /**
   * Creates an instance of TokenService.
   * @param {import('viem').PublicClient} publicClient - The Viem Public Client instance.
   * @param {string} collectionAddress - The address of the LSP8 collection contract.
   */
  constructor(publicClient, collectionAddress) {
    this.publicClient = publicClient;
    this.collectionAddress = collectionAddress;
    this.metadataCache = new Map();
    this.initialized = !!publicClient;
  }

  /**
   * Initializes the service, checking for client and valid collection address.
   * @returns {Promise<boolean>} True if ready, false otherwise.
   */
  async initialize() {
    this.initialized = !!this.publicClient;
    if (!this.collectionAddress || !isAddress(this.collectionAddress)) {
      console.error("TokenService: Invalid or missing collection address during initialization.");
      this.initialized = false;
    }
    return this.initialized;
  }

  /** Checks if the Viem Public Client is available and connected. */
  async checkClientReady() {
    if (!this.publicClient) {
      console.warn("TokenService: Public Client not available.");
      return false;
    }
    try {
      const chainId = await this.publicClient.getChainId();
      return !!chainId;
    } catch (error) {
      console.error("[TokenService] Error checking public client:", error);
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
      console.warn("[TS] getOwnedTokenIds: Invalid userAddress.");
      return [];
    }
    if (!this.collectionAddress || !isAddress(this.collectionAddress)) {
      console.warn("[TS] getOwnedTokenIds: Invalid collectionAddress.");
      return [];
    }
    if (!(await this.checkClientReady())) {
      console.warn("[TS] getOwnedTokenIds: Client not ready.");
      return [];
    }

    try {
      const tokenIds = await this.publicClient.readContract({
        address: this.collectionAddress,
        abi: LSP8_MINIMAL_ABI,
        functionName: "tokenIdsOf",
        args: [userAddress],
      });
      return Array.isArray(tokenIds) ? tokenIds : [];
    } catch (error) {
      if (error?.message?.includes("InvalidArgumentsError") || error?.message?.includes("call exception")) {
        console.warn(`[TS] Contract ${this.collectionAddress} likely doesn't support tokenIdsOf or address has no tokens.`);
      } else {
        console.error("[TS] Error calling tokenIdsOf:", error);
      }
      return [];
    }
  }

  /**
   * Decodes VerifiableURI bytes according to LSP2 specification.
   * @param {string} verifiableUriBytes - The hex string (0x...) representing the VerifiableURI.
   * @returns {{url: string, hashFunction: string|null, hash: string|null} | null} Decoded data or null on failure.
   */
  decodeVerifiableUri(verifiableUriBytes) {
    if (!verifiableUriBytes || typeof verifiableUriBytes !== "string" || !verifiableUriBytes.startsWith("0x")) return null;

    if (verifiableUriBytes.startsWith("0x0000") && verifiableUriBytes.length >= 14) {
      try {
        const hexString = verifiableUriBytes.substring(2);
        const method = `0x${hexString.substring(4, 12)}`;
        const lengthHex = `0x${hexString.substring(12, 16)}`;
        const verificationDataLengthBytes = parseInt(lengthHex, 16);
        if (isNaN(verificationDataLengthBytes)) throw new Error("Invalid length bytes");
        const verificationDataLengthChars = verificationDataLengthBytes * 2;
        const verificationDataStart = 16;
        const verificationDataEnd = verificationDataStart + verificationDataLengthChars;
        if (hexString.length < verificationDataEnd) throw new Error("Byte string too short for declared data length");
        const verificationData = `0x${hexString.substring(verificationDataStart, verificationDataEnd)}`;
        const uriHex = `0x${hexString.substring(verificationDataEnd)}`;
        const url = hexToUtf8Safe(uriHex);
        if (!url) throw new Error("Failed to decode URL part");

        let hashFunction = null;
        if (method === "0x6f357c6a") hashFunction = "keccak256(utf8)";
        else if (method === "0x8019f9b1") hashFunction = "keccak256(bytes)";

        return { url, hashFunction, hash: verificationData };
      } catch (e) {
        console.error("[TS] Error decoding VerifiableURI:", verifiableUriBytes, e);
      }
    }

    const plainUrl = hexToUtf8Safe(verifiableUriBytes);
    if (plainUrl) {
      return { url: plainUrl, hashFunction: null, hash: null };
    }

    console.warn("[TS] Could not decode URI bytes:", verifiableUriBytes);
    return null;
  }

  /**
   * Fetches JSON data from a given URI (resolving IPFS URIs).
   * @param {string} uri - The URI (http, https, or ipfs) to fetch from.
   * @returns {Promise<object|null>} The parsed JSON object or null on error.
   */
  async fetchJsonFromUri(uri) {
    if (!uri || typeof uri !== "string") return null;
    let fetchUrl = uri;
    if (uri.startsWith("ipfs://")) {
      fetchUrl = `${this.ipfsGateway}${uri.slice(7)}`;
    } else if (!uri.startsWith("http")) {
      console.warn(`[TS] Skipping fetch for unknown scheme: ${uri}`);
      return null;
    }

    try {
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${fetchUrl}`);
      return await response.json();
    } catch (error) {
      console.error(`[TS] Fetch/Parse JSON Error from ${fetchUrl}:`, error);
      return null;
    }
  }

  /** Resolves an IPFS or HTTP URL string to a fetchable URL. */
  resolveImageUrl(url) {
    if (!url || typeof url !== "string") return null;
    if (url.startsWith("ipfs://")) return `${this.ipfsGateway}${url.slice(7)}`;
    if (url.startsWith("http")) return url;
    return null;
  }

  /** Extracts the primary image URL from potentially nested LSP3/LSP4 metadata. */
  getImageUrlFromMetadata(metadata) {
    if (!metadata || typeof metadata !== "object") return null;
    let imageUrl = null;
    imageUrl = this.resolveImageUrl(metadata.image);
    if (imageUrl) return imageUrl;
    imageUrl = this.resolveImageUrl(metadata.LSP4Metadata?.images?.[0]?.[0]?.url);
    if (imageUrl) return imageUrl;
    imageUrl = this.resolveImageUrl(metadata.LSP4Metadata?.icon?.[0]?.url);
    if (imageUrl) return imageUrl;
    imageUrl = this.resolveImageUrl(metadata.LSP3Profile?.profileImage?.[0]?.url);
    if (imageUrl) return imageUrl;
    imageUrl = this.resolveImageUrl(metadata.LSP3Profile?.backgroundImage?.[0]?.url);
    if (imageUrl) return imageUrl;
    return null;
  }

  /**
   * Fetches, processes, and caches metadata for a specific token ID within the collection.
   * @param {string} tokenId - The bytes32 token ID.
   * @returns {Promise<object|null>} Processed metadata or a fallback object on error.
   */
  async fetchTokenMetadata(tokenId) {
    const cacheKey = `metadata_${this.collectionAddress}_${tokenId}`;
    if (this.metadataCache.has(cacheKey)) {
      return this.metadataCache.get(cacheKey);
    }
    if (!tokenId || typeof tokenId !== "string" || !tokenId.startsWith("0x")) return null;
    if (!(await this.checkClientReady())) {
      console.warn("TS: Client not ready for metadata fetch.");
      return null;
    }

    const displayId = parseTokenIdNum(tokenId);
    const fallbackMeta = { name: `Token #${displayId || tokenId.slice(0, 8)}`, description: "Metadata loading failed", image: null };

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
            finalUrl = finalUrl.endsWith("/") ? `${finalUrl}${formattedTokenIdPart}` : `${finalUrl}/${formattedTokenIdPart}`;
          }

          const metadata = await this.fetchJsonFromUri(finalUrl);
          if (metadata) {
            metadata.image = this.getImageUrlFromMetadata(metadata);
            this.metadataCache.set(cacheKey, metadata);
            return metadata;
          }
        }
      }

      console.warn(`[TS] No metadata URI resolved for ${tokenId}, returning fallback.`);
      this.metadataCache.set(cacheKey, fallbackMeta);
      return fallbackMeta;
    } catch (error) {
      console.error(`[TS] Critical error fetching metadata for ${tokenId}:`, error);
      this.metadataCache.set(cacheKey, fallbackMeta);
      return fallbackMeta;
    }
  }

  /**
   * Loads a token's image into a specific CanvasManager instance.
   * @param {string} tokenId - The bytes32 token ID.
   * @param {import('../utils/CanvasManager').default} canvasManager - The target CanvasManager.
   * @returns {Promise<boolean>} True if successful, false otherwise.
   */
  async loadTokenIntoCanvas(tokenId, canvasManager) {
    if (!tokenId || !canvasManager?.setImage) {
      console.error("TS: Invalid params for loadTokenIntoCanvas");
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
        console.warn(`[TS] No valid image URL for token ${tokenId}. Using error placeholder.`);
        await canvasManager.setImage(errorPlaceholder);
        return false;
      }

      await canvasManager.setImage(imageUrl);
      return true;
    } catch (error) {
      console.error(`[TS] Error loading token ${tokenId} into canvas:`, error);
      try { await canvasManager.setImage(errorPlaceholder); }
      catch (fallbackError) { console.error("[TS] Failed to load error placeholder:", fallbackError); }
      return false;
    }
  }

  /**
   * Applies multiple token assignments to their respective CanvasManager instances.
   * @param {Object.<string, string>} tokenAssignments - Maps layerId to tokenId.
   * @param {Object.<string, import('../utils/CanvasManager').default>} canvasManagers - Maps layerId to CanvasManager instances.
   * @returns {Promise<Object.<string, {success: boolean, tokenId: string, error?: string}>>} Object detailing success/failure per layer.
   */
  async applyTokenAssignments(tokenAssignments, canvasManagers) {
    const results = {};
    if (!tokenAssignments || !canvasManagers) return results;
    if (!(await this.checkClientReady())) {
      console.warn("TS: Client not ready for applyTokenAssignments");
      return results;
    }

    const promises = Object.entries(tokenAssignments).map(
      async ([layerId, tokenId]) => {
        results[layerId] = { success: false, tokenId };
        if (!tokenId) { results[layerId].error = "No token ID"; return; }
        const manager = canvasManagers[layerId];
        if (!manager) { console.warn(`No manager for layer ${layerId}`); results[layerId].error = "No manager"; return; }
        try {
          const success = await this.loadTokenIntoCanvas(tokenId, manager);
          results[layerId].success = success;
          if (!success) results[layerId].error = "Image load failed";
        } catch (error) { console.error(`Apply token error ${tokenId} -> L${layerId}:`, error); results[layerId].error = error.message; }
      },
    );

    await Promise.all(promises);
    return results;
  }
}

export default TokenService;