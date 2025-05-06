import { keccak256, stringToBytes, numberToHex, bytesToHex } from "viem";
import { LSP1_TYPE_IDS as StandardLSP1TypeIds } from "@lukso/lsp-smart-contracts";

/**
 * Global configuration constants and helper functions for the RADAR application.
 * Defines ERC725Y storage keys, IPFS gateway, LSP1 event type mappings,
 * blend modes, user roles, and key generation functions.
 */

// IPFS Gateway Configuration
export const IPFS_GATEWAY =
  import.meta.env.VITE_IPFS_GATEWAY ||
  "https://api.universalprofile.cloud/ipfs/";

// RADAR Application Specific ERC725Y Storage Keys
export const RADAR_NAMED_CONFIG_MAP_KEY_PREFIX = "0x44f0a644f86a60b95927";
export const RADAR_SAVED_CONFIG_LIST_KEY =
  "0xb705191a8b41d1f6b4bd88156334f8218a5d70f6a579c9c5a0a6871d2e398a9a";
export const RADAR_DEFAULT_CONFIG_NAME_KEY =
  "0xaf9518865d704640a115a21518b109f9a37c0ab1f6865c84d6a150f5f6693e19";
export const RADAR_MIDI_MAP_KEY =
  "0x9e5e3b0c7c8a4f6d1d9d63429a9743e3f38270f5a8c2633e7e6dfb01fc17e3bd";
export const RADAR_EVENT_REACTIONS_KEY =
  "0x0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b";
// Keep if ConfigurationService still uses it for loading, otherwise remove
export const RADAR_WHITELIST_KEY =
  "0x5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b";

// Helper Functions for Dynamic ERC725Y Keys
export function getRadarConfigListElementKey(index) {
  if (typeof index !== "number" || index < 0 || !Number.isInteger(index))
    throw new Error("Invalid index for Radar Config List");
  const arrayKeyPrefix = RADAR_SAVED_CONFIG_LIST_KEY.substring(0, 34);
  const hexIndex = numberToHex(BigInt(index), { size: 16 }).slice(2);
  return `${arrayKeyPrefix}${hexIndex}`;
}

export function getNamedConfigMapKey(configName) {
  if (!configName || typeof configName !== "string") {
    throw new Error("Invalid configName");
  }
  const nameBytes = stringToBytes(configName);
  const nameHashBytes = keccak256(nameBytes, "bytes");
  const nameHashHex = bytesToHex(nameHashBytes);
  const nameHashPart = nameHashHex.slice(2, 42); // Get first 20 bytes (40 hex chars)
  const mapKey = `${RADAR_NAMED_CONFIG_MAP_KEY_PREFIX}0000${nameHashPart}`;
  if (mapKey.length !== 66 || !mapKey.startsWith("0x")) {
    throw new Error(`Generated mapKey is invalid (length/prefix): ${mapKey}`);
  }
  if (!/^[0-9a-fA-F]+$/.test(nameHashPart)) {
    throw new Error(
      `Generated nameHashPart contains invalid characters: ${nameHashPart}`,
    );
  }
  return mapKey;
}

// LSP1 Event Type Mappings
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

// Canvas Blend Modes
export const BLEND_MODES = [
  "normal", "multiply", "screen", "overlay", "darken",
  "lighten", "color-dodge", "color-burn", "difference", "exclusion",
];

// User Roles
export const USER_ROLES = {
  PROFILE_OWNER: "profile_owner", // User owns the profile being viewed
  VISITOR: "visitor", // User does not own the profile being viewed
};