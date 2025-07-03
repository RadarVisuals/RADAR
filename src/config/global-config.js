// src/config/global-config.js
import { keccak256, stringToBytes } from "viem";
import { LSP1_TYPE_IDS as StandardLSP1TypeIds } from "@lukso/lsp-smart-contracts";

/**
 * Global configuration constants and helper functions for the RADAR application.
 * Defines ERC725Y storage keys, IPFS gateway, LSP1 event type mappings,
 * and blend modes.
 */

// --- Core Configuration ---

/**
 * The IPFS Gateway used to resolve 'ipfs://' URIs to fetchable HTTP URLs.
 */
export const IPFS_GATEWAY =
  import.meta.env.VITE_IPFS_GATEWAY ||
  "https://api.universalprofile.cloud/ipfs/";

/**
 * The official admin address for the RADAR project. This address may have special
 * privileges, such as managing an official list of recommended collections.
 * @type {string}
 */
export const RADAR_OFFICIAL_ADMIN_ADDRESS = import.meta.env.VITE_RADAR_OFFICIAL_ADMIN_ADDRESS || "0x0000000000000000000000000000000000000000"; // Fallback to zero address

if (!import.meta.env.VITE_RADAR_OFFICIAL_ADMIN_ADDRESS && import.meta.env.DEV) {
  console.warn(
    "⚠️ [RADAR Config] VITE_RADAR_OFFICIAL_ADMIN_ADDRESS is not defined in your .env file. Admin-specific features will not be available. Please set this variable to your designated admin UP address."
  );
}


// --- Primary ERC725Y Storage Key (New Architecture) ---

/**
 * The single, primary on-chain key that points to the user's entire workspace
 * JSON file stored on IPFS. This is the cornerstone of the new scalable storage model.
 * @type {string}
 */
export const RADAR_ROOT_STORAGE_POINTER_KEY = keccak256(stringToBytes("RADAR.RootStoragePointer"));

// --- LSP1 Event Type Mappings ---

export const EVENT_TYPE_MAP = {
  lyx_received: StandardLSP1TypeIds.LSP0ValueReceived,
  follower_gained: "0x71e02f9f05bcd5816ec4f3134aa2e5a916669537ec6c77fe66ea595fabc2d51a", // Custom
  follower_lost: "0x9d3c0b4012b69658977b099bdaa51eff0f0460f421fba96d15669506c00d1c4f", // Custom
  lsp7_received: "0x20804611b3e2ea21c480dc465142210acf4a2485947541770ec1fb87dee4a55c", // Custom
  lsp8_received: "0x0b084a55ebf70fd3c06fd755269dac2212c4d3f0f4d09079780bfa50c1b2984d", // Custom
};

export const TYPE_ID_TO_EVENT_MAP = Object.fromEntries(
  Object.entries(EVENT_TYPE_MAP).map(([eventName, typeId]) => [
    typeId.toLowerCase(),
    eventName,
  ]),
);


// --- Application Constants ---

/**
 * A list of supported CSS `mix-blend-mode` values for the visualizer layers.
 */
export const BLEND_MODES = [
  "normal", "multiply", "screen", "overlay", "darken",
  "lighten", "color-dodge", "color-burn", "difference", "exclusion",
];