// src/services/ConfigurationService.js

import {
  hexToString, stringToHex,
  getAddress,
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
  }
];

const LSP8_INTERFACE_ID = "0x3a271706";
const LSP7_INTERFACE_ID = "0xc52d6008";

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

            if (valueWithoutPrefix.length < urlBytesStart) {
                return null;
            }

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

  async _loadWorkspaceFromCID(cid) {
    const logPrefix = `[CS _loadWorkspaceFromCID CID:${cid.slice(0, 10)}]`;
    if (!cid) return null;
    try {
        const gatewayUrl = `${IPFS_GATEWAY}${cid}`;
        if (import.meta.env.DEV) console.log(`${logPrefix} Fetching workspace from ${gatewayUrl}`);
        const response = await fetch(gatewayUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch from IPFS gateway: ${response.status} ${response.statusText}`);
        }
        const workspaceData = await response.json();
        if (typeof workspaceData !== 'object' || workspaceData === null || !('presets' in workspaceData)) {
            throw new Error('Fetched data is not a valid workspace object.');
        }
        return workspaceData;
    } catch (error) {
        if (import.meta.env.DEV) console.error(`${logPrefix} Failed to load workspace:`, error);
        return null;
    }
  }

  async loadWorkspace(profileAddress) {
    const defaultSetlist = { defaultWorkspaceName: null, workspaces: {}, globalUserMidiMap: {} };
    if (!this.checkReadyForRead()) return defaultSetlist;
    const checksummedProfileAddr = getChecksumAddressSafe(profileAddress);
    if (!checksummedProfileAddr) return defaultSetlist;

    const logPrefix = `[CS loadWorkspace(Setlist) Addr:${checksummedProfileAddr.slice(0, 6)}]`;
    try {
        const pointerHex = await this.loadDataFromKey(checksummedProfileAddr, RADAR_ROOT_STORAGE_POINTER_KEY);
        if (!pointerHex || pointerHex === '0x') return defaultSetlist;
        
        const ipfsUri = hexToUtf8Safe(pointerHex);
        if (!ipfsUri || !ipfsUri.startsWith('ipfs://')) return defaultSetlist;

        const cid = ipfsUri.substring(7);
        const gatewayUrl = `${IPFS_GATEWAY}${cid}`;
        if (import.meta.env.DEV) console.log(`${logPrefix} Fetching setlist from ${gatewayUrl}`);
        
        const response = await fetch(gatewayUrl);
        if (!response.ok) throw new Error(`Failed to fetch from IPFS gateway: ${response.status} ${response.statusText}`);

        const setlist = await response.json();
        if (typeof setlist !== 'object' || setlist === null || !('workspaces' in setlist)) {
            throw new Error('Fetched data is not a valid setlist object.');
        }

        // --- MIGRATION LOGIC ---
        if (typeof setlist === 'object' && setlist !== null && !setlist.globalUserMidiMap) {
          if (import.meta.env.DEV) console.log(`${logPrefix} Old setlist format detected. Attempting to migrate MIDI map.`);
          const defaultWorkspaceName = setlist.defaultWorkspaceName || Object.keys(setlist.workspaces)[0];
          if (defaultWorkspaceName && setlist.workspaces[defaultWorkspaceName]?.cid) {
              const defaultWorkspace = await this._loadWorkspaceFromCID(setlist.workspaces[defaultWorkspaceName].cid);
              if (defaultWorkspace?.globalMidiMap) {
                  if (import.meta.env.DEV) console.log(`${logPrefix} Found MIDI map in default workspace. Promoting to setlist level.`);
                  setlist.globalUserMidiMap = defaultWorkspace.globalMidiMap;
              }
          }
        }
        // --- END MIGRATION LOGIC ---

        if (import.meta.env.DEV) console.log(`${logPrefix} Successfully loaded and parsed setlist.`);
        return setlist;

    } catch (error) {
        if (import.meta.env.DEV) console.error(`${logPrefix} Failed to load setlist:`, error);
        return defaultSetlist;
    }
  }

  async saveSetlist(targetProfileAddress, setlistObject) {
    const logPrefix = `[CS saveSetlist Addr:${targetProfileAddress?.slice(0, 6)}]`;
    if (!this.checkReadyForWrite()) {
      throw new Error("Client not ready for writing.");
    }
    const checksummedTargetAddr = getChecksumAddressSafe(targetProfileAddress);
    if (!checksummedTargetAddr) {
      throw new Error("Invalid target profile address format.");
    }
    if (!setlistObject || typeof setlistObject !== 'object' || !('workspaces' in setlistObject)) {
      throw new Error("Invalid or malformed setlistObject provided.");
    }
    const userAddress = this.walletClient.account.address;
    if (userAddress?.toLowerCase() !== checksummedTargetAddr?.toLowerCase()) {
      throw new Error("Permission denied: Signer does not own the target profile.");
    }

    let oldCidToUnpin = null;
    try {
      const oldPointerHex = await this.loadDataFromKey(checksummedTargetAddr, RADAR_ROOT_STORAGE_POINTER_KEY);
      if (oldPointerHex && oldPointerHex !== '0x') {
        const oldIpfsUri = hexToUtf8Safe(oldPointerHex);
        if (oldIpfsUri && oldIpfsUri.startsWith('ipfs://')) {
          oldCidToUnpin = oldIpfsUri.substring(7);
          if (import.meta.env.DEV) console.log(`${logPrefix} Found old Setlist CID to unpin later: ${oldCidToUnpin}`);
        }
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn(`${logPrefix} Could not retrieve old Setlist CID, will proceed without unpinning. Error:`, e);
    }

    try {
      if (import.meta.env.DEV) console.log(`${logPrefix} Uploading new setlist JSON to IPFS...`);
      const newIpfsCid = await uploadJsonToPinata(setlistObject, 'RADAR_Setlist');
      if (!newIpfsCid) {
        throw new Error("IPFS upload failed: received no CID from PinataService.");
      }
      if (import.meta.env.DEV) console.log(`${logPrefix} IPFS upload successful. New Setlist CID: ${newIpfsCid}`);

      const newIpfsUri = `ipfs://${newIpfsCid}`;
      const valueHex = stringToHex(newIpfsUri);
      if (import.meta.env.DEV) console.log(`${logPrefix} Setting RADAR.RootStoragePointer on-chain to new value...`);
      const result = await this.saveDataToKey(checksummedTargetAddr, RADAR_ROOT_STORAGE_POINTER_KEY, valueHex);
      if (import.meta.env.DEV) console.log(`${logPrefix} On-chain update successful. TxHash: ${result.hash}`);
      
      if (oldCidToUnpin && oldCidToUnpin !== newIpfsCid) {
        if (import.meta.env.DEV) console.log(`${logPrefix} Triggering unpinning of old Setlist CID: ${oldCidToUnpin}`);
        
        fetch('/api/unpin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cid: oldCidToUnpin }),
        }).catch(unpinError => {
            if (import.meta.env.DEV) console.error(`${logPrefix} Call to the /api/unpin endpoint failed:`, unpinError);
        });
      }

      return result;

    } catch (error) {
      if (import.meta.env.DEV) { console.error(`${logPrefix} Error during saveSetlist:`, error); }
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
  
  async getOwnedLSP8TokenIdsForCollection(userAddress, collectionAddress) {
      const logPrefix = `[CS getOwnedLSP8]`;
      const checksummedUserAddr = getChecksumAddressSafe(userAddress);
      const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);

      if (!this.checkReadyForRead() || !checksummedUserAddr || !checksummedCollectionAddr) {
          if (import.meta.env.DEV) console.warn(`${logPrefix} Prereqs failed: ready=${this.readReady}, user=${!!checksummedUserAddr}, collection=${!!checksummedCollectionAddr}`);
          return [];
      }

      if (import.meta.env.DEV) console.log(`${logPrefix} Fetching owned tokens for: ${checksummedUserAddr}.`);
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

  async getAllLSP8TokenIdsForCollection(collectionAddress) {
      const logPrefix = `[CS getAllLSP8]`;
      const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);

      if (!this.checkReadyForRead() || !checksummedCollectionAddr) {
          if (import.meta.env.DEV) console.warn(`${logPrefix} Prereqs failed: ready=${this.readReady}, collection=${!!checksummedCollectionAddr}`);
          return [];
      }

      if (import.meta.env.DEV) console.log(`${logPrefix} Fetching ALL tokens for collection: ${checksummedCollectionAddr}.`);
      try {
          const total = await this.publicClient.readContract({
              address: checksummedCollectionAddr,
              abi: LSP8_ABI,
              functionName: "totalSupply",
          });
          const totalAsNumber = Number(total);
          
          const allTokenIndices = Array.from({ length: totalAsNumber }, (_, i) => i);
          
          if (import.meta.env.DEV) console.log(`${logPrefix} Found ${totalAsNumber} total tokens. Returning indices.`);
          return allTokenIndices;
      } catch (error) {
          if (import.meta.env.DEV) console.error(`${logPrefix} Failed to fetch all tokens. Does contract have 'totalSupply'?`, error);
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
      const metadataUriBytes = await this.publicClient.readContract({
          address: checksummedCollectionAddr, abi: LSP8_ABI, functionName: "getDataForTokenId", args: [tokenId, lsp4Key]
      }).catch(() => null);

      if (metadataUriBytes && metadataUriBytes !== '0x') {
        const decodedString = hexToUtf8Safe(metadataUriBytes);
        if (decodedString && decodedString.trim().startsWith('<svg')) {
          if (import.meta.env.DEV) console.log(`${logPrefix} Detected on-chain SVG for tokenId ${tokenId.slice(0,10)}...`);
          const base64Svg = Buffer.from(decodedString, 'utf8').toString('base64');
          const imageUrl = `data:image/svg+xml;base64,${base64Svg}`;
          const name = `Token #${Number(BigInt(tokenId))}`;
          return { name, image: imageUrl };
        }
      }

      let finalMetadataUrl = '';

      if (metadataUriBytes && metadataUriBytes !== '0x') {
        const decodedUri = decodeVerifiableUriBytes(metadataUriBytes);
        if (decodedUri) finalMetadataUrl = decodedUri;
      } else {
        const baseUriKey = ERC725YDataKeys.LSP8.LSP8TokenMetadataBaseURI;
        const baseUriBytes = await this.publicClient.readContract({
            address: checksummedCollectionAddr, abi: LSP8_ABI, functionName: "getData", args: [baseUriKey]
        }).catch(() => null);

        if (baseUriBytes && baseUriBytes !== '0x') {
          const decodedBaseUri = decodeVerifiableUriBytes(baseUriBytes);
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
      
      let fetchableUrl = finalMetadataUrl;
      if (fetchableUrl.startsWith('ipfs://')) {
          fetchableUrl = `${IPFS_GATEWAY}${fetchableUrl.substring(7)}`;
      } else if (!fetchableUrl.startsWith('http')) {
          fetchableUrl = `${IPFS_GATEWAY}${fetchableUrl}`;
      }
      
      if (!fetchableUrl.startsWith('http')) {
        if (import.meta.env.DEV) console.warn(`${logPrefix} Unsupported metadata URI scheme: ${fetchableUrl}`);
        return null;
      }

      const response = await fetch(fetchableUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${fetchableUrl}`);
      
      const contentType = response.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
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
      } else if (contentType && contentType.startsWith("image/")) {
          const tokenIdNum = Number(BigInt(tokenId));
          const name = `Token #${tokenIdNum}`;
          const imageUrl = fetchableUrl;
          return { name, image: imageUrl };
      } else {
          throw new Error(`Unsupported content type: ${contentType}`);
      }

    } catch (error) {
        if (import.meta.env.DEV) console.error(`${logPrefix} Error getting metadata for tokenId ${tokenId.slice(0,10)} in collection ${collectionAddress.slice(0,6)}...:`, error.message);
        return null;
    }
  }

  async getTokensMetadataForPage(collectionAddress, identifiers, page, pageSize) {
    const logPrefix = `[CS getTokensMetadataForPage]`;
    if (!this.checkReadyForRead() || !identifiers || identifiers.length === 0) {
        return [];
    }

    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    const pageIdentifiers = identifiers.slice(startIndex, endIndex);

    if (pageIdentifiers.length === 0) return [];

    const metadataFetchPromises = pageIdentifiers.map(async (identifier) => {
        const tokenId = typeof identifier === 'number'
            ? '0x' + identifier.toString(16).padStart(64, '0')
            : identifier;
        
        const metadata = await this.getTokenMetadata(collectionAddress, tokenId);
        return metadata ? { originalIdentifier: identifier, tokenId, metadata } : null;
    });

    if (import.meta.env.DEV) console.log(`${logPrefix} Fetching metadata for ${pageIdentifiers.length} tokens on page ${page}.`);
    const settledMetadataResults = await Promise.allSettled(metadataFetchPromises);
  
    const finalTokenData = settledMetadataResults.map((result) => {
      if (result.status === 'rejected' || !result.value) return null;
      
      const { tokenId, metadata } = result.value;
      if (!metadata?.image) return null;

      return {
          id: `${collectionAddress}-${tokenId}`,
          type: 'owned',
          address: collectionAddress,
          tokenId: tokenId,
          metadata: { name: metadata.name || 'Unnamed', image: metadata.image },
      };
    }).filter(Boolean);
  
    return finalTokenData;
  }
}

export default ConfigurationService;