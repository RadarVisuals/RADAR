// src/config/abis.js
import { parseAbiParameters } from "viem";

// --- INTERFACE IDs (ERC165) ---
export const LSP8_INTERFACE_ID = "0x3a271706";
export const LSP7_INTERFACE_ID = "0xc52d6008";

// --- ERC725Y ---
export const ERC725Y_ABI = [
  {
    inputs: [{ type: "bytes32", name: "dataKey" }],
    name: "getData",
    outputs: [{ type: "bytes", name: "dataValue" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "bytes32[]", name: "dataKeys" }],
    name: "getDataBatch",
    outputs: [{ type: "bytes[]", name: "dataValues" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { type: "bytes32", name: "dataKey" },
      { type: "bytes", name: "dataValue" },
    ],
    name: "setData",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    name: "supportsInterface",
    inputs: [{ type: "bytes4", name: "interfaceId" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
];

// --- LSP1 (Universal Receiver) ---
export const LSP1_ABI = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "bytes32",
        name: "typeId",
        type: "bytes32",
      },
      { internalType: "bytes", name: "receivedData", type: "bytes" },
      { internalType: "bytes", name: "returnedValue", type: "bytes" },
    ],
    name: "UniversalReceiver",
    type: "event",
  },
];

// --- LSP7 (Digital Asset) ---
export const LSP7_ABI = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "interfaceId", type: "bytes4" }],
    name: "supportsInterface",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
];

// --- LSP8 (Identifiable Digital Asset) ---
export const LSP8_ABI = [
  {
    inputs: [{ name: "interfaceId", type: "bytes4" }],
    name: "supportsInterface",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "bytes32" }],
    name: "tokenOwnerOf",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenOwner", type: "address" }],
    name: "tokenIdsOf",
    outputs: [{ name: "", type: "bytes32[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "dataKey", type: "bytes32" }],
    name: "getData",
    outputs: [{ name: "dataValue", type: "bytes" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "tokenId", type: "bytes32" },
      { name: "dataKey", type: "bytes32" },
    ],
    name: "getDataForTokenId",
    outputs: [{ name: "dataValue", type: "bytes" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "index", type: "uint256" }],
    name: "tokenByIndex",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
];

// --- DECODING PARAMETERS ---
export const LSP7_RECEIVED_DATA_ABI = parseAbiParameters(
  "address caller, address from, address to, uint256 amount, bytes data"
);

export const LSP8_RECEIVED_DATA_ABI = parseAbiParameters(
  "address caller, address from, address to, bytes32 tokenId, bytes data"
);