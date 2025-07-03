// src/services/ConfigurationService.js
import {
  hexToString, stringToHex, numberToHex,
  getAddress, slice, isAddress,
} from "viem";

import {
  RADAR_ROOT_STORAGE_POINTER_KEY,
  IPFS_GATEWAY,
} from "../config/global-config";
import { resolveLsp4Metadata } from '../utils/erc725.js';
import { uploadJsonToPinata } from './PinataService.js';
import { ERC725YDataKeys } from '@lukso/lsp-smart-contracts';
import { Buffer } from 'buffer';

if (typeof window !== 'undefined' && typeof window.Buffer === 'undefined') {
  window.Buffer = Buffer;
}

const ERC725Y_ABI = [
  { inputs: [{ type: "bytes32", name: "dataKey" }], name: "getData", outputs: [{ type: "bytes", name: "dataValue" }], stateMutability: "view", type: "function" },
  { inputs: [{ type: "bytes32[]", name: "dataKeys" }], name: "getDataBatch", outputs: [{ type: "bytes[]", name: "dataValues" }], stateMutability: "view", type: "function" },
  { inputs: [{ type: "bytes32", name: "dataKey" }, { type: "bytes", name: "dataValue" }], name: "setData", outputs: [], stateMutability: "payable", type: "function" },
  { inputs: [{ type: "bytes32[]", name: "dataKeys" }, { type: "bytes[]", name: "dataValues" }], name: "setDataBatch", outputs: [], stateMutability: "payable", type: "function" },
  { name: "supportsInterface", inputs: [{ type: "bytes4", name: "interfaceId" }], outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
];

// --- ADDED: Minimal ABI for required LSP7 interactions ---
const LSP7_ABI = [
  {
    "inputs": [{ "name": "owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

// --- ADDED: Minimal ABI for required LSP8 interactions ---
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
  }
];

// --- ADDED: LSP Interface IDs ---
const LSP8_INTERFACE_ID = "0x3a271706";
const LSP7_INTERFACE_ID = "0xc52d6008";

export function hexToUtf8Safe(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("0x") || hex === "0x") return null;
  try { return hexToString(hex); }
  catch { return null; }
}

export function hexBytesToIntegerSafe(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("0x") || hex === "0x") return 0;
  try {
    const bigIntValue = BigInt(hex);
    if (bigIntValue > BigInt(Number.MAX_SAFE_INTEGER)) {
      if (import.meta.env.DEV) {
        console.warn(`[hexBytesToIntegerSafe] Value ${hex} exceeds MAX_SAFE_INTEGER. Capping.`);
      }
      return Number.MAX_SAFE_INTEGER;
    }
    return Number(bigIntValue);
  } catch { return 0; }
}

function getChecksumAddressSafe(address) {
  if (typeof address !== 'string') return null;
  try { return getAddress(address.trim()); }
  catch { return null; }
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

  getUserAddress() {
    return this.walletClient?.account?.address ?? null;
  }

  checkReadyForRead() {
    this.readReady = !!this.publicClient;
    return this.readReady;
  }

  checkReadyForWrite() {
    this.readReady = !!this.publicClient;
    this.writeReady = this.readReady && !!this.walletClient?.account;
    return this.writeReady;
  }

  async loadWorkspace(profileAddress) {
    const defaultWorkspace = { presets: {}, defaultPresetName: null, globalMidiMap: {}, globalEventReactions: {} };
    if (!this.checkReadyForRead()) { return defaultWorkspace; }
    const checksummedProfileAddr = getChecksumAddressSafe(profileAddress);
    if (!checksummedProfileAddr) { return defaultWorkspace; }
    const logPrefix = `[CS loadWorkspace Addr:${checksummedProfileAddr.slice(0, 6)}]`;
    try {
      const pointerHex = await this.loadDataFromKey(checksummedProfileAddr, RADAR_ROOT_STORAGE_POINTER_KEY);
      if (!pointerHex || pointerHex === '0x') { return defaultWorkspace; }
      const ipfsUri = hexToUtf8Safe(pointerHex);
      if (!ipfsUri || !ipfsUri.startsWith('ipfs://')) { return defaultWorkspace; }
      const cid = ipfsUri.substring(7);
      const gatewayUrl = `${IPFS_GATEWAY}${cid}`;
      if (import.meta.env.DEV) console.log(`${logPrefix} Fetching workspace from ${gatewayUrl}`);
      const response = await fetch(gatewayUrl);
      if (!response.ok) { throw new Error(`Failed to fetch from IPFS gateway: ${response.status} ${response.statusText}`); }
      const workspace = await response.json();
      if (typeof workspace !== 'object' || workspace === null || !('presets' in workspace)) { throw new Error('Fetched data is not a valid workspace object.'); }
      if (import.meta.env.DEV) console.log(`${logPrefix} Successfully loaded and parsed workspace.`);
      return workspace;
    } catch (error) {
      if (import.meta.env.DEV) { console.error(`${logPrefix} Failed to load workspace:`, error); }
      return defaultWorkspace;
    }
  }

  async saveWorkspace(targetProfileAddress, workspaceObject) {
    const logPrefix = `[CS saveWorkspace Addr:${targetProfileAddress?.slice(0, 6)}]`;
    if (!this.checkReadyForWrite()) { throw new Error("Client not ready for writing."); }
    const checksummedTargetAddr = getChecksumAddressSafe(targetProfileAddress);
    if (!checksummedTargetAddr) { throw new Error("Invalid target profile address format."); }
    if (!workspaceObject || typeof workspaceObject !== 'object' || !('presets' in workspaceObject)) { throw new Error("Invalid or malformed workspaceObject provided."); }
    const userAddress = this.walletClient.account.address;
    if (userAddress?.toLowerCase() !== checksummedTargetAddr?.toLowerCase()) { throw new Error("Permission denied: Signer does not own the target profile."); }
    try {
      const jsonData = workspaceObject;
      if (import.meta.env.DEV) console.log(`${logPrefix} Uploading workspace JSON to IPFS...`);
      const ipfsCid = await uploadJsonToPinata(jsonData);
      if (!ipfsCid) { throw new Error("IPFS upload failed: received no CID from PinataService."); }
      if (import.meta.env.DEV) console.log(`${logPrefix} IPFS upload successful. CID: ${ipfsCid}`);
      const ipfsUri = `ipfs://${ipfsCid}`;
      const valueHex = stringToHex(ipfsUri);
      if (import.meta.env.DEV) console.log(`${logPrefix} Setting RADAR.RootStoragePointer on-chain...`);
      const result = await this.saveDataToKey( checksummedTargetAddr, RADAR_ROOT_STORAGE_POINTER_KEY, valueHex );
      if (import.meta.env.DEV) console.log(`${logPrefix} On-chain update successful. TxHash: ${result.hash}`);
      return result;
    } catch (error) {
      if (import.meta.env.DEV) { console.error(`${logPrefix} Error during saveWorkspace:`, error); }
      throw new Error(error.message || "An unexpected error occurred during the save process.");
    }
  }
  
  async saveDataToKey(targetAddress, key, valueHex) {
    if (!this.checkReadyForWrite()) throw new Error("Client not ready for writing.");
    const checksummedTargetAddr = getChecksumAddressSafe(targetAddress);
    if (!checksummedTargetAddr) throw new Error("Invalid target address format.");
    const userAddress = this.walletClient.account.address;
    if (userAddress?.toLowerCase() !== checksummedTargetAddr?.toLowerCase()) { throw new Error("Permission denied: Signer does not own the target profile."); }
    if (!key || typeof key !== "string" || !key.startsWith("0x") || key.length !== 66) { throw new Error("Data key must be a valid bytes32 hex string."); }
    const finalValueHex = (valueHex === undefined || valueHex === null) ? "0x" : valueHex;
    if (typeof finalValueHex !== "string" || !finalValueHex.startsWith("0x")) { throw new Error("Value must be a valid hex string (0x...)."); }
    try {
        const hash = await this.walletClient.writeContract({ address: checksummedTargetAddr, abi: ERC725Y_ABI, functionName: "setData", args: [key, finalValueHex], account: this.walletClient.account });
        return { success: true, hash };
    } catch (writeError) {
        const baseError = writeError.cause || writeError;
        const message = baseError?.shortMessage || writeError.message || "Unknown setData error";
        throw new Error(`Set data transaction failed: ${message}`);
    }
  }

  async loadDataFromKey(address, key) {
    if (!this.checkReadyForRead()) { return null; }
    const checksummedAddress = getChecksumAddressSafe(address);
    if (!checksummedAddress) { return null; }
    const isKeyValid = typeof key === "string" && key.startsWith("0x") && key.length === 66;
    if (!isKeyValid) { return null; }
    try {
        const dataValueBytes = await this.publicClient.readContract({ address: checksummedAddress, abi: ERC725Y_ABI, functionName: "getData", args: [key] });
        return (dataValueBytes === undefined || dataValueBytes === null) ? null : dataValueBytes;
    } catch (e) {
        return null;
    }
  }

  // --- NEW: INTERFACE DETECTION ---
  async detectCollectionStandard(collectionAddress) {
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    if (!this.checkReadyForRead() || !checksummedCollectionAddr) {
      return null;
    }
    try {
      const supportsLSP8 = await this.publicClient.readContract({
        address: checksummedCollectionAddr, abi: ERC725Y_ABI, functionName: "supportsInterface", args: [LSP8_INTERFACE_ID]
      }).catch(() => false);
      if (supportsLSP8) return 'LSP8';

      const supportsLSP7 = await this.publicClient.readContract({
        address: checksummedCollectionAddr, abi: ERC725Y_ABI, functionName: "supportsInterface", args: [LSP7_INTERFACE_ID]
      }).catch(() => false);
      if (supportsLSP7) return 'LSP7';

      return null;
    } catch (error) {
      if (import.meta.env.DEV) console.warn(`[CS detectStandard] Error detecting standard for ${collectionAddress.slice(0,10)}...:`, error.shortMessage || error.message);
      return null;
    }
  }

  // --- NEW: LSP7 TOKEN FETCHING METHODS ---
  async getLSP7Balance(userAddress, collectionAddress) {
    const checksummedUserAddr = getChecksumAddressSafe(userAddress);
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    if (!this.checkReadyForRead() || !checksummedUserAddr || !checksummedCollectionAddr) {
      return 0n;
    }
    try {
      const balance = await this.publicClient.readContract({
        address: checksummedCollectionAddr, abi: LSP7_ABI, functionName: "balanceOf", args: [checksummedUserAddr]
      });
      return balance || 0n;
    } catch (error) {
      if (import.meta.env.DEV) console.warn(`[CS getLSP7Balance] Failed for collection ${collectionAddress.slice(0,10)}...:`, error.shortMessage || error.message);
      return 0n;
    }
  }

  async getLSP4CollectionMetadata(collectionAddress) {
    const logPrefix = `[CS getLSP4CollectionMetadata]`;
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    if (!this.checkReadyForRead() || !checksummedCollectionAddr) {
      return null;
    }
    try {
      const metadata = await resolveLsp4Metadata(this, checksummedCollectionAddr);
      if (!metadata?.LSP4Metadata) {
        if (import.meta.env.DEV) console.log(`${logPrefix} No LSP4Metadata found for collection ${collectionAddress.slice(0,10)}...`);
        return null;
      }
      const lsp4Data = metadata.LSP4Metadata;
      const name = lsp4Data.name || 'Unnamed Collection';
      const rawUrl = lsp4Data.icon?.[0]?.url || lsp4Data.images?.[0]?.[0]?.url || lsp4Data.assets?.[0]?.url;
      let imageUrl = null;
      if (rawUrl && typeof rawUrl === 'string') {
        const trimmedUrl = rawUrl.trim();
        if (trimmedUrl.startsWith('ipfs://')) {
          imageUrl = `${IPFS_GATEWAY}${trimmedUrl.slice(7)}`;
        } else if (trimmedUrl.startsWith('http') || trimmedUrl.startsWith('data:')) {
          imageUrl = trimmedUrl;
        }
      }
      return { name, image: imageUrl };
    } catch (error) {
      if (import.meta.env.DEV) console.warn(`${logPrefix} Error for collection ${collectionAddress.slice(0,10)}...:`, error.message);
      return null;
    }
  }

  // --- LSP8 TOKEN FETCHING METHODS ---
  async getOwnedLSP8TokenIdsForCollection(userAddress, collectionAddress) {
      const logPrefix = `[CS getOwnedLSP8]`;
      const checksummedUserAddr = getChecksumAddressSafe(userAddress);
      const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);

      if (!this.checkReadyForRead() || !checksummedUserAddr || !checksummedCollectionAddr) {
          if (import.meta.env.DEV) console.warn(`${logPrefix} Prereqs failed: ready=${this.readReady}, user=${!!checksummedUserAddr}, collection=${!!checksummedCollectionAddr}`);
          return [];
      }

      try {
          const tokenIds = await this.publicClient.readContract({
              address: checksummedCollectionAddr,
              abi: LSP8_ABI,
              functionName: "tokenIdsOf",
              args: [checksummedUserAddr],
          });
          return tokenIds || [];
      } catch (error) {
          if (import.meta.env.DEV) console.warn(`${logPrefix} Failed to fetch token IDs for collection ${collectionAddress.slice(0, 10)}...:`, error.shortMessage || error.message);
          return [];
      }
  }

  async getTokenMetadata(collectionAddress, tokenId) {
    const logPrefix = `[CS getTokenMetadata]`;
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    
    if (!this.checkReadyForRead() || !checksummedCollectionAddr) {
        if (import.meta.env.DEV) console.warn(`${logPrefix} Client not ready or invalid collection address.`);
        return null;
    }

    try {
      const lsp4Key = ERC725YDataKeys.LSP4.LSP4Metadata;
      let metadataUriBytes = await this.publicClient.readContract({
          address: checksummedCollectionAddr, abi: LSP8_ABI, functionName: "getDataForTokenId", args: [tokenId, lsp4Key]
      }).catch(() => null);

      let finalMetadataUrl = '';

      if (metadataUriBytes && metadataUriBytes !== '0x') {
        const decodedUri = hexToUtf8Safe(metadataUriBytes);
        if (decodedUri) finalMetadataUrl = decodedUri;
      } else {
        const baseUriKey = ERC725YDataKeys.LSP8.LSP8TokenMetadataBaseURI;
        const baseUriBytes = await this.publicClient.readContract({
            address: checksummedCollectionAddr, abi: LSP8_ABI, functionName: "getData", args: [baseUriKey]
        }).catch(() => null);

        if (baseUriBytes && baseUriBytes !== '0x') {
          const decodedBaseUri = hexToUtf8Safe(baseUriBytes);
          if (decodedBaseUri) {
            const tokenIdAsString = BigInt(tokenId).toString();
            finalMetadataUrl = decodedBaseUri.endsWith('/') ? `${decodedBaseUri}${tokenIdAsString}` : `${decodedBaseUri}/${tokenIdAsString}`;
          }
        }
      }

      if (!finalMetadataUrl) {
        if (import.meta.env.DEV) console.log(`${logPrefix} No metadata URI found for tokenId ${tokenId.slice(0,10)}...`);
        return null;
      }

      let fetchableUrl = finalMetadataUrl.startsWith('ipfs://') ? `${IPFS_GATEWAY}${finalMetadataUrl.substring(7)}` : finalMetadataUrl;
      if (!fetchableUrl.startsWith('http')) {
        if (import.meta.env.DEV) console.warn(`${logPrefix} Unsupported metadata URI scheme: ${fetchableUrl}`);
        return null;
      }

      const response = await fetch(fetchableUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${fetchableUrl}`);

      const metadata = await response.json();
      const lsp4Data = metadata.LSP4Metadata || metadata;
      const name = lsp4Data.name || 'Unnamed Token';
      
      const rawUrl = lsp4Data.images?.[0]?.[0]?.url || lsp4Data.icon?.[0]?.url || lsp4Data.assets?.[0]?.url;
      let imageUrl = null;
      
      if (rawUrl && typeof rawUrl === 'string') {
        const trimmedUrl = rawUrl.trim();
        if (trimmedUrl.startsWith('ipfs://')) {
            imageUrl = `${IPFS_GATEWAY}${trimmedUrl.slice(7)}`;
        } else if (trimmedUrl.startsWith('http') || trimmedUrl.startsWith('data:')) {
            imageUrl = trimmedUrl;
        }
      }
      
      return { name, image: imageUrl };

    } catch (error) {
        if (import.meta.env.DEV) console.warn(`${logPrefix} Error getting metadata for tokenId ${tokenId.slice(0,10)} in collection ${collectionAddress.slice(0,6)}...:`, error.message);
        return null;
    }
  }
}

export default ConfigurationService;