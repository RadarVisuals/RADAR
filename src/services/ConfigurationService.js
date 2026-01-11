// src/services/ConfigurationService.js
import { hexToString, stringToHex, getAddress } from "viem";
import {
  RADAR_ROOT_STORAGE_POINTER_KEY,
  IPFS_GATEWAY,
} from "../config/global-config";
import { uploadJsonToPinata } from "./PinataService.js";
import { ERC725YDataKeys } from "@lukso/lsp-smart-contracts";
import { Buffer } from "buffer";
import { loadAssetsWithRetries } from "../utils/RobustLoader";

// --- IMPORT CENTRALIZED UTILITIES ---
import {
  resolveLsp4Metadata,
  decodeVerifiableUri,
  fetchMetadata,
  extractImageFromMetadata,
  resolveUrl,
} from "../utils/erc725.js";

// --- IMPORT ABIS ---
import {
  ERC725Y_ABI,
  LSP7_ABI,
  LSP8_ABI,
  LSP8_INTERFACE_ID,
  LSP7_INTERFACE_ID,
} from "../config/abis";

if (typeof window !== "undefined" && typeof window.Buffer === "undefined") {
  window.Buffer = Buffer;
}

const MULTICALL_BATCH_SIZE = 15;
const COLLECTION_CHUNK_SIZE = 3;
const DEFAULT_REQUEST_TIMEOUT = 25000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = DEFAULT_REQUEST_TIMEOUT } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export function hexToUtf8Safe(hex) {
  if (
    !hex ||
    typeof hex !== "string" ||
    !hex.startsWith("0x") ||
    hex === "0x"
  )
    return null;
  try {
    return hexToString(hex).replace(/\u0000/g, "");
  } catch {
    return null;
  }
}

function getChecksumAddressSafe(address) {
  if (typeof address !== "string") return null;
  try {
    return getAddress(address.trim());
  } catch {
    return null;
  }
}

function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

class ConfigurationService {
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

  checkReadyForRead() {
    return !!this.publicClient;
  }
  checkReadyForWrite() {
    return !!this.publicClient && !!this.walletClient?.account;
  }

  // --- INTERNAL HELPERS ---

  async _processMetadataBytes(metadataUriBytes, tokenId) {
    const url = decodeVerifiableUri(metadataUriBytes);
    if (!url) return null;

    // If SVG Data URI
    if (url.startsWith("data:image/svg+xml")) {
      return { name: `Token #${Number(BigInt(tokenId))}`, image: url };
    }

    const metadata = await fetchMetadata(url);
    if (!metadata) return null;

    // Handle direct image
    if (metadata.image && !metadata.LSP4Metadata && !metadata.name) {
      return {
        name: `Token #${Number(BigInt(tokenId))}`,
        image: resolveUrl(metadata.image),
      };
    }

    const name =
      metadata.LSP4Metadata?.name ||
      metadata.name ||
      `Token #${Number(BigInt(tokenId))}`;
    const image = extractImageFromMetadata(metadata);
    return image ? { name, image } : null;
  }

  async _processBaseUriBytes(baseUriBytes, tokenId) {
    const baseUrl = decodeVerifiableUri(baseUriBytes);
    if (!baseUrl) return null;

    const tokenIdAsString = BigInt(tokenId).toString();
    const finalUrl = baseUrl.endsWith("/")
      ? `${baseUrl}${tokenIdAsString}`
      : `${baseUrl}/${tokenIdAsString}`;

    const metadata = await fetchMetadata(finalUrl);
    if (!metadata) return null;

    const name =
      metadata.LSP4Metadata?.name ||
      metadata.name ||
      `Token #${tokenIdAsString}`;
    const image = extractImageFromMetadata(metadata);
    return image ? { name, image } : null;
  }

  // --- PUBLIC API ---

  async loadWorkspace(profileAddress) {
    const defaultSetlist = {
      defaultWorkspaceName: null,
      workspaces: {},
      globalUserMidiMap: {},
      personalCollectionLibrary: [],
      userPalettes: {},
      globalEventReactions: {},
    };
    if (!this.checkReadyForRead()) return defaultSetlist;
    const checksummedProfileAddr = getChecksumAddressSafe(profileAddress);
    if (!checksummedProfileAddr) return defaultSetlist;

    try {
      const pointerHex = await this.loadDataFromKey(
        checksummedProfileAddr,
        RADAR_ROOT_STORAGE_POINTER_KEY
      );
      // Use unified decoding logic
      const ipfsUri = decodeVerifiableUri(pointerHex);

      if (!ipfsUri) return defaultSetlist;

      const gatewayUrl = resolveUrl(ipfsUri);
      const response = await fetchWithTimeout(gatewayUrl);
      if (!response.ok)
        throw new Error(`Failed to fetch setlist: ${response.status}`);

      const setlist = await response.json();
      
      if (!setlist || !("workspaces" in setlist))
        throw new Error("Invalid setlist object.");

      if (setlist && !setlist.globalUserMidiMap) {
        const defaultWorkspaceName =
          setlist.defaultWorkspaceName || Object.keys(setlist.workspaces)[0];
        if (
          defaultWorkspaceName &&
          setlist.workspaces[defaultWorkspaceName]?.cid
        ) {
          const defaultWorkspace = await this._loadWorkspaceFromCID(
            setlist.workspaces[defaultWorkspaceName].cid
          );
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
    if (!response.ok)
      throw new Error(`Failed to fetch from IPFS: ${response.status}`);
    const workspaceData = await response.json();
    if (!workspaceData || !("presets" in workspaceData))
      throw new Error("Invalid workspace object.");
    return workspaceData;
  }

  async saveSetlist(targetProfileAddress, setlistObject) {
    if (!this.checkReadyForWrite())
      throw new Error("Client not ready for writing.");
    const checksummedTargetAddr = getChecksumAddressSafe(targetProfileAddress);
    const account = this.walletClient.account;
    const userAddress =
      typeof account === "string" ? account : account?.address;
    if (userAddress.toLowerCase() !== checksummedTargetAddr.toLowerCase())
      throw new Error("Permission denied.");

    let oldCidToUnpin = null;
    try {
      const oldPointerHex = await this.loadDataFromKey(
        checksummedTargetAddr,
        RADAR_ROOT_STORAGE_POINTER_KEY
      );
      const oldUrl = decodeVerifiableUri(oldPointerHex);
      if (oldUrl?.startsWith("ipfs://")) oldCidToUnpin = oldUrl.substring(7);
    } catch (e) {
      /* ignore */
    }

    try {
      const newIpfsCid = await uploadJsonToPinata(
        setlistObject,
        "RADAR_Setlist"
      );
      const newIpfsUri = `ipfs://${newIpfsCid}`;
      const valueHex = stringToHex(newIpfsUri);

      const result = await this.saveDataToKey(
        checksummedTargetAddr,
        RADAR_ROOT_STORAGE_POINTER_KEY,
        valueHex
      );

      if (oldCidToUnpin && oldCidToUnpin !== newIpfsCid) {
        fetch("/api/unpin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cid: oldCidToUnpin }),
        }).catch(() => {});
      }
      return result;
    } catch (error) {
      throw new Error(error.message || "Save failed.");
    }
  }

  async saveDataToKey(targetAddress, key, valueHex) {
    const checksummedTargetAddr = getChecksumAddressSafe(targetAddress);
    const account = this.walletClient.account;
    const userAddress =
      typeof account === "string" ? account : account?.address;
    try {
      const hash = await this.walletClient.writeContract({
        address: checksummedTargetAddr,
        abi: ERC725Y_ABI,
        functionName: "setData",
        args: [key, valueHex || "0x"],
        account: userAddress,
        value: 0n, // Value 0n for payable compatibility
      });
      return { success: true, hash };
    } catch (writeError) {
      throw new Error(`Transaction failed: ${writeError.message}`);
    }
  }

  async loadDataFromKey(address, key) {
    if (!this.checkReadyForRead()) return null;
    const checksummedAddress = getChecksumAddressSafe(address);
    try {
      return await this.publicClient.readContract({
        address: checksummedAddress,
        abi: ERC725Y_ABI,
        functionName: "getData",
        args: [key],
      });
    } catch (e) {
      throw e;
    }
  }

  async detectCollectionStandard(collectionAddress) {
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    if (!this.checkReadyForRead() || !checksummedCollectionAddr) return null;
    try {
      const [isLSP8, isLSP7] = await Promise.all([
        this.publicClient
          .readContract({
            address: checksummedCollectionAddr,
            abi: ERC725Y_ABI,
            functionName: "supportsInterface",
            args: [LSP8_INTERFACE_ID],
          })
          .catch(() => false),
        this.publicClient
          .readContract({
            address: checksummedCollectionAddr,
            abi: ERC725Y_ABI,
            functionName: "supportsInterface",
            args: [LSP7_INTERFACE_ID],
          })
          .catch(() => false),
      ]);
      if (isLSP8) return "LSP8";
      if (isLSP7) return "LSP7";
      return null;
    } catch (error) {
      return null;
    }
  }

  async getLSP7Balance(userAddress, collectionAddress) {
    const checksummedUserAddr = getChecksumAddressSafe(userAddress);
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    if (
      !this.checkReadyForRead() ||
      !checksummedUserAddr ||
      !checksummedCollectionAddr
    )
      return 0n;
    try {
      return await this.publicClient.readContract({
        address: checksummedCollectionAddr,
        abi: LSP7_ABI,
        functionName: "balanceOf",
        args: [checksummedUserAddr],
      });
    } catch (error) {
      return 0n;
    }
  }

  async getBatchCollectionData(userAddress, collections) {
    if (!this.checkReadyForRead() || !userAddress || collections.length === 0)
      return {};
    const checksummedUser = getChecksumAddressSafe(userAddress);
    const results = {};
    const collectionChunks = chunkArray(collections, COLLECTION_CHUNK_SIZE);

    for (const chunk of collectionChunks) {
      try {
        await sleep(200);
        const interfaceContracts = [];
        chunk.forEach((c) => {
          interfaceContracts.push(
            {
              address: c.address,
              abi: ERC725Y_ABI,
              functionName: "supportsInterface",
              args: [LSP8_INTERFACE_ID],
            },
            {
              address: c.address,
              abi: ERC725Y_ABI,
              functionName: "supportsInterface",
              args: [LSP7_INTERFACE_ID],
            }
          );
        });

        const interfaceResults = await this.publicClient.multicall({
          contracts: interfaceContracts,
          batchSize: MULTICALL_BATCH_SIZE,
        });
        const dataContracts = [];
        const chunkMeta = [];

        for (let i = 0; i < chunk.length; i++) {
          const addr = chunk[i].address;
          const isLSP8 = interfaceResults[i * 2]?.result;
          const isLSP7 = interfaceResults[i * 2 + 1]?.result;

          if (isLSP8) {
            chunkMeta.push({ address: addr, standard: "LSP8" });
            dataContracts.push({
              address: addr,
              abi: LSP8_ABI,
              functionName: "tokenIdsOf",
              args: [checksummedUser],
            });
          } else if (isLSP7) {
            chunkMeta.push({ address: addr, standard: "LSP7" });
            dataContracts.push({
              address: addr,
              abi: LSP7_ABI,
              functionName: "balanceOf",
              args: [checksummedUser],
            });
          }
        }

        if (dataContracts.length > 0) {
          const dataResults = await this.publicClient.multicall({
            contracts: dataContracts,
            batchSize: MULTICALL_BATCH_SIZE,
          });
          dataResults.forEach((res, index) => {
            const { address, standard } = chunkMeta[index];
            if (res.status === "success") {
              if (standard === "LSP8") {
                results[address] = Array.isArray(res.result) ? res.result : [];
              } else if (standard === "LSP7" && res.result > 0n) {
                results[address] = ["LSP7_TOKEN"];
              }
            }
          });
        }
      } catch (chunkError) {
        await sleep(500);
      }
    }
    return results;
  }

  async getLSP4CollectionMetadata(collectionAddress) {
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    if (!this.checkReadyForRead() || !checksummedCollectionAddr) return null;
    try {
      const metadata = await resolveLsp4Metadata(
        this,
        checksummedCollectionAddr
      );
      if (!metadata) return null;

      const name =
        metadata.LSP4Metadata?.name || metadata.name || "Unnamed Collection";
      const image = extractImageFromMetadata(metadata);

      return { name, image };
    } catch (error) {
      return null;
    }
  }

  async getOwnedLSP8TokenIdsForCollection(userAddress, collectionAddress) {
    const checksummedUserAddr = getChecksumAddressSafe(userAddress);
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    if (
      !this.checkReadyForRead() ||
      !checksummedUserAddr ||
      !checksummedCollectionAddr
    )
      return [];
    try {
      return await this.publicClient.readContract({
        address: checksummedCollectionAddr,
        abi: LSP8_ABI,
        functionName: "tokenIdsOf",
        args: [checksummedUserAddr],
      });
    } catch (error) {
      return [];
    }
  }

  async getAllLSP8TokenIdsForCollection(collectionAddress) {
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    if (!this.checkReadyForRead() || !checksummedCollectionAddr) return [];
    try {
      const total = await this.publicClient.readContract({
        address: checksummedCollectionAddr,
        abi: LSP8_ABI,
        functionName: "totalSupply",
      });
      const totalAsNumber = Number(total);
      if (totalAsNumber === 0) return [];
      const tokenByIndexPromises = [];
      for (let i = 0; i < totalAsNumber; i++) {
        tokenByIndexPromises.push(
          this.publicClient.readContract({
            address: checksummedCollectionAddr,
            abi: LSP8_ABI,
            functionName: "tokenByIndex",
            args: [BigInt(i)],
          })
        );
      }
      const tokenIds = await Promise.all(tokenByIndexPromises);
      return tokenIds.filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  async getTokenMetadata(collectionAddress, tokenId) {
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    if (!this.checkReadyForRead() || !checksummedCollectionAddr) return null;

    if (tokenId === "LSP7_TOKEN") {
      const metadata = await this.getLSP4CollectionMetadata(collectionAddress);
      return metadata
        ? { name: metadata.name || "LSP7 Token", image: metadata.image || null }
        : { name: "LSP7 Token", image: null };
    }

    try {
      const lsp4Key = ERC725YDataKeys.LSP4.LSP4Metadata;
      const metadataUriBytes = await this.publicClient
        .readContract({
          address: checksummedCollectionAddr,
          abi: LSP8_ABI,
          functionName: "getDataForTokenId",
          args: [tokenId, lsp4Key],
        })
        .catch(() => null);

      let metadata = await this._processMetadataBytes(
        metadataUriBytes,
        tokenId
      );
      if (metadata) return metadata;

      const baseUriKey = ERC725YDataKeys.LSP8.LSP8TokenMetadataBaseURI;
      const baseUriBytes = await this.publicClient
        .readContract({
          address: checksummedCollectionAddr,
          abi: LSP8_ABI,
          functionName: "getData",
          args: [baseUriKey],
        })
        .catch(() => null);

      return await this._processBaseUriBytes(baseUriBytes, tokenId);
    } catch (error) {
      return null;
    }
  }

  /**
   * --- ROBUST METADATA LOADING ---
   * Fetches metadata in parallel with concurrency limits and retries.
   * UNWRAPS RobustLoader results before returning.
   */
  async getTokensMetadataForPage(
    collectionAddress,
    identifiers,
    page,
    pageSize
  ) {
    if (!this.checkReadyForRead() || !identifiers || identifiers.length === 0)
      return [];

    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    const pageIdentifiers = identifiers.slice(startIndex, endIndex);

    if (pageIdentifiers.length === 0) return [];

    const checksummedCollection = getChecksumAddressSafe(collectionAddress);
    const lsp4Key = ERC725YDataKeys.LSP4.LSP4Metadata;
    const baseUriKey = ERC725YDataKeys.LSP8.LSP8TokenMetadataBaseURI;

    try {
      // 1. Batch Fetch Raw Data from Blockchain
      const contractCalls = pageIdentifiers.map((tokenId) => ({
        address: checksummedCollection,
        abi: LSP8_ABI,
        functionName: "getDataForTokenId",
        args: [tokenId, lsp4Key],
      }));

      // Append base URI request
      contractCalls.push({
        address: checksummedCollection,
        abi: LSP8_ABI,
        functionName: "getData",
        args: [baseUriKey],
      });

      const results = await this.publicClient.multicall({
        contracts: contractCalls,
        batchSize: MULTICALL_BATCH_SIZE,
      });
      
      const baseUriResult = results.pop();
      const baseUriBytes =
        baseUriResult.status === "success" ? baseUriResult.result : null;

      // 2. Prepare items for RobustLoader
      const tasks = results.map((res, index) => ({
        id: pageIdentifiers[index], 
        result: res,
        baseUriBytes: baseUriBytes
      }));

      // 3. Process with Retries (The "Robust" Part)
      const processSingleItem = async (task) => {
        const tokenId = task.id;
        const res = task.result;
        let metadata = null;

        if (res.status === "success" && res.result && res.result !== "0x") {
          metadata = await this._processMetadataBytes(res.result, tokenId);
        }

        if (!metadata && task.baseUriBytes && task.baseUriBytes !== "0x") {
          metadata = await this._processBaseUriBytes(task.baseUriBytes, tokenId);
        }

        if (!metadata || !metadata.image) {
            return null;
        }

        return {
          id: `${collectionAddress}-${tokenId}`,
          type: tokenId === "LSP7_TOKEN" ? "LSP7" : "owned",
          address: collectionAddress,
          tokenId: tokenId,
          metadata: {
            name: metadata.name || `Token #${tokenId}`,
            image: metadata.image,
          },
        };
      };

      // Limit concurrency
      const robustResults = await loadAssetsWithRetries(
          tasks, 
          processSingleItem, 
          6, // Concurrency
          2  // Retries
      );

      // --- CRITICAL FIX: Unwrap RobustLoader results ---
      // RobustLoader returns: [{ status: 'fulfilled', value: TOKEN_OBJECT }, ...]
      // We need just: [TOKEN_OBJECT, ...]
      const unwrappedItems = robustResults
        .filter(r => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);

      return unwrappedItems;

    } catch (e) {
      console.error("[CS] Batch metadata fetch failed:", e);
      return [];
    }
  }

  async getTokensMetadataByIds(tokenIds) {
    if (
      !this.checkReadyForRead() ||
      !Array.isArray(tokenIds) ||
      tokenIds.length === 0
    )
      return [];

    const tokensByCollection = tokenIds.reduce((acc, fullId) => {
      const parts = fullId.split("-");
      if (parts.length === 2) {
        const [addr, id] = parts;
        if (!acc[addr]) acc[addr] = [];
        acc[addr].push(id);
      }
      return acc;
    }, {});

    const allResults = [];
    for (const [collectionAddr, ids] of Object.entries(tokensByCollection)) {
      try {
        const res = await this.getTokensMetadataForPage(
          collectionAddr,
          ids,
          0,
          ids.length
        );
        allResults.push(...res);
      } catch (e) {
        /* ignore individual collection failures */
      }
    }
    return allResults;
  }

  // --- REFACTORED INTERNAL HELPER ---
  async _resolveMetadataFromBytes(
    collectionAddress,
    tokenId,
    metadataUriBytes
  ) {
    if (!metadataUriBytes || metadataUriBytes === "0x") {
      return await this.fetchTokenMetadata(tokenId);
    }

    const url = decodeVerifiableUri(metadataUriBytes);
    if (url) {
      const metadataJson = await fetchMetadata(url);
      if (metadataJson) {
        const image = extractImageFromMetadata(metadataJson);
        return {
          name: metadataJson.LSP4Metadata?.name || metadataJson.name,
          description:
            metadataJson.LSP4Metadata?.description || metadataJson.description,
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
    if (this.metadataCache.has(cacheKey))
      return this.metadataCache.get(cacheKey);

    try {
      const data = await this.publicClient.readContract({
        address: this.collectionAddress,
        abi: LSP8_ABI,
        functionName: "getDataForTokenId",
        args: [tokenId, ERC725YDataKeys.LSP4.LSP4Metadata],
      });

      const metadata = await this._resolveMetadataFromBytes(
        this.collectionAddress,
        tokenId,
        data
      );
      if (metadata) {
        this.metadataCache.set(cacheKey, metadata);
        return metadata;
      }
      return { name: `Token #${tokenId.slice(0, 6)}`, image: null };
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
    await canvasManager.setImage(
      `https://via.placeholder.com/600x400?text=No+Image`
    );
    return false;
  }
}

export default ConfigurationService;