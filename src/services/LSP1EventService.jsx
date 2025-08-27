// src/services/LSP1EventService.jsx
import {
  createPublicClient,
  webSocket,
  isAddress,
  decodeEventLog,
  // slice, // Intentionally removed as unused
  getAddress,
  decodeAbiParameters,
  parseAbiParameters,
} from "viem";
import { lukso } from "viem/chains";

import { EVENT_TYPE_MAP, TYPE_ID_TO_EVENT_MAP } from "../config/global-config";

// LSP1 ABI definition for UniversalReceiver event
const LSP1_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "uint256", name: "value", type: "uint256" },
      { indexed: true, internalType: "bytes32", name: "typeId", type: "bytes32" },
      { internalType: "bytes", name: "receivedData", type: "bytes" },
      { internalType: "bytes", name: "returnedValue", type: "bytes" },
    ],
    name: "UniversalReceiver",
    type: "event",
  },
];

// ABI parameter definitions for decoding specific event data payloads
const LSP7_RECEIVED_DATA_ABI = parseAbiParameters('address caller, address from, address to, uint256 amount, bytes data');
const LSP8_RECEIVED_DATA_ABI = parseAbiParameters('address caller, address from, address to, bytes32 tokenId, bytes data');

const DEFAULT_LUKSO_WSS_RPC_URL = "wss://ws-rpc.mainnet.lukso.network";
const WSS_RPC_URL = import.meta.env.VITE_LUKSO_WSS_RPC_URL || DEFAULT_LUKSO_WSS_RPC_URL;
const MAX_RECENT_EVENTS = 10; // For duplicate detection

/**
 * @typedef {object} DecodedLsp1EventArgs
 * @property {string} from - Address of the sender of the transaction.
 * @property {bigint} value - Value sent with the transaction (in Wei).
 * @property {string} typeId - Bytes32 type identifier of the received data.
 * @property {string} receivedData - Bytes data received by the Universal Profile.
 * @property {string} returnedValue - Bytes data returned by the Universal Profile.
 */

/**
 * @typedef {object} ProcessedLsp1Event
 * @property {string} id - Unique identifier for the processed event.
 * @property {number} timestamp - Timestamp when the event was processed.
 * @property {string} type - Human-readable event type name (e.g., 'lsp7_received', 'follower_gained').
 * @property {string} typeId - The original bytes32 typeId of the event.
 * @property {string} data - The raw `receivedData` from the event.
 * @property {string} sender - The actual sender address, potentially decoded from `receivedData`.
 * @property {string} value - The value from the event, converted to a string.
 * @property {boolean} read - Read status, defaults to false.
 * @property {object} decodedPayload - Additional decoded data, e.g., `followerAddress`.
 */


/**
 * Service class responsible for connecting to the LUKSO network via WebSocket,
 * listening for `UniversalReceiver` events on a specific profile address using
 * Viem's `watchContractEvent`, decoding the event arguments, and notifying
 * registered callbacks. Includes logic to decode sender addresses from LSP7/LSP8
 * `receivedData` and follower addresses from custom follower event data.
 * Also provides basic duplicate event detection and event simulation.
 */
class LSP1EventService {
  /** @type {Array<(event: ProcessedLsp1Event) => void>} */
  eventCallbacks = [];
  /** @type {import('viem').PublicClient | null} */
  viemClient = null;
  /** @type {(() => void) | null} Function returned by watchContractEvent to stop watching */
  unwatchEvent = null;
  /** @type {string | null} The address currently being listened to */
  listeningAddress = null;
  /** @type {boolean} */
  initialized = false;
  /** @type {boolean} Indicates if setupEventListeners is currently running */
  isSettingUp = false;
  /** @type {boolean} Flag indicating if the service *should* be connected (based on valid address) */
  shouldBeConnected = false;
  /** @type {string[]} Stores identifiers of recent events to prevent duplicates */
  recentEvents = [];

  constructor() {
    this.eventCallbacks = [];
    this.viemClient = null;
    this.unwatchEvent = null;
    this.listeningAddress = null;
    this.initialized = false;
    this.isSettingUp = false;
    this.shouldBeConnected = false;
    this.recentEvents = [];
  }

  /**
   * Initializes the service (currently just sets a flag).
   * @async
   * @returns {Promise<boolean>} True if initialized.
   */
  async initialize() {
    if (this.initialized) return true;
    this.initialized = true;
    return true;
  }

  /**
   * Sets up the Viem WebSocket client and starts watching for UniversalReceiver events
   * on the specified address. Cleans up any previous listeners first.
   * @param {string} address - The Universal Profile address to listen on.
   * @returns {Promise<boolean>} True if setup was successful, false otherwise.
   */
  async setupEventListeners(address) {
    const logPrefix = `[LSP1 viem setup Addr:${address?.slice(0, 6)}]`;
    if (this.isSettingUp) {
      if (import.meta.env.DEV) {
        console.warn(`${logPrefix} Setup already in progress. Aborting.`);
      }
      return false;
    }
    if (!address || !isAddress(address)) {
      if (import.meta.env.DEV) {
        console.warn(`${logPrefix} Invalid address provided. Aborting setup.`);
      }
      this.shouldBeConnected = false;
      return false;
    }

    // If already listening to the same address and watcher exists, consider it setup.
    if (this.listeningAddress?.toLowerCase() === address.toLowerCase() && this.unwatchEvent) {
      this.shouldBeConnected = true;
      return true;
    }

    this.isSettingUp = true;
    this.shouldBeConnected = true; // Assume connection will be successful until proven otherwise
    this.cleanupListeners(); // Clean up previous before setting up new
    this.listeningAddress = address;

    try {
      const client = createPublicClient({
        chain: lukso,
        transport: webSocket(WSS_RPC_URL, {
            // Optional: Add retry logic or other WebSocket options here if needed
            // e.g., retryCount: 5, retryDelay: 2000
        }),
      });
      this.viemClient = client;

      this.unwatchEvent = this.viemClient.watchContractEvent({
        address: this.listeningAddress, // Viem expects checksummed address or will checksum it
        abi: LSP1_ABI,
        eventName: "UniversalReceiver",
        onLogs: (logs) => {
          if (import.meta.env.DEV) {
            console.log(`%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%`);
            console.log(`%%% VIEM watchContractEvent RECEIVED ${logs.length} LOG(S)! %%%`);
            console.log(`%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%`);
          }
          logs.forEach((log) => {
            if (import.meta.env.DEV) {
                console.log(`--- Processing Log ---`);
                console.log(`  TX Hash: ${log.transactionHash}`);
                console.log(`  Block: ${log.blockNumber}`);
                console.log(`  Removed: ${log.removed}`);
                // console.log(`  Raw Data: ${log.data}`); // Usually very long
                // console.log(`  Raw Topics:`, log.topics);
            }

            if (log.removed) {
              if (import.meta.env.DEV) {
                console.warn(`${logPrefix} Log marked as removed (reorg), skipping processing.`);
              }
              return;
            }

            try {
              const decodedLog = decodeEventLog({ abi: LSP1_ABI, data: log.data, topics: log.topics });
              if (import.meta.env.DEV) {
                console.log(`  Decoded Event Name: ${decodedLog.eventName}`);
                // console.log(`  Decoded Args Object:`, decodedLog.args);
              }

              if (decodedLog.eventName === "UniversalReceiver" && decodedLog.args) {
                this.handleUniversalReceiver(/** @type {DecodedLsp1EventArgs} */ (decodedLog.args));
              } else if (import.meta.env.DEV) {
                console.warn(`${logPrefix} Decoded log name mismatch or args missing.`);
              }
            } catch (e) {
              if (import.meta.env.DEV) {
                console.error(`%%% Error decoding filter log:`, e);
              }
            }
            if (import.meta.env.DEV) {
                console.log(`--- End Log ---`);
            }
          });
        },
        onError: (error) => {
          if (import.meta.env.DEV) {
            console.error(`❌ [LSP1 viem watchContractEvent] Error on address ${this.listeningAddress}:`, error);
          }
          this.shouldBeConnected = false;
          // Consider attempting to re-establish listener after a delay, or notify higher level
        },
      });
      if (import.meta.env.DEV) {
        console.log(`${logPrefix} Successfully started watching events.`);
      }
      this.isSettingUp = false;
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`${logPrefix} Error during viem client creation or watch setup:`, error);
      }
      this.cleanupListeners(); // Ensure cleanup on error
      this.isSettingUp = false;
      this.shouldBeConnected = false;
      return false;
    }
  }

  /** Cleans up the Viem client and event listener. */
  cleanupListeners() {
    const logPrefix = "[LSP1 viem cleanup]";
    this.shouldBeConnected = false; // Mark as not intended to be connected
    this.isSettingUp = false; // Reset setup flag

    if (this.unwatchEvent) {
      try {
        this.unwatchEvent();
        if (import.meta.env.DEV) {
            // console.log(`${logPrefix} Called unwatch function.`);
        }
      } catch (e) {
        if (import.meta.env.DEV) {
            console.error(`${logPrefix} Error calling unwatch function:`, e);
        }
      }
      this.unwatchEvent = null;
    }
    // Note: Viem's public client does not have an explicit close/disconnect for WebSocket transport.
    // It should be garbage collected when no longer referenced.
    this.viemClient = null;
    this.listeningAddress = null;
    this.recentEvents = []; // Clear recent events on cleanup
    if (import.meta.env.DEV) {
        // console.log(`${logPrefix} Listeners cleaned up.`);
    }
  }

  /**
   * Handles decoded UniversalReceiver event arguments, decodes additional data if necessary,
   * checks for duplicates, and notifies listeners.
   * @param {DecodedLsp1EventArgs} eventArgs - The decoded arguments from the UniversalReceiver event.
   */
  handleUniversalReceiver(eventArgs) {
    if (!eventArgs || typeof eventArgs !== "object" || !eventArgs.typeId) {
      if (import.meta.env.DEV) {
        console.warn("‼️ [LSP1 handleUniversalReceiver - viem] Invalid or incomplete args received:", eventArgs);
      }
      return;
    }
    const { from, value, typeId, receivedData, returnedValue } = eventArgs;
    const lowerCaseTypeId = typeId?.toLowerCase();

    if (!lowerCaseTypeId) {
      if (import.meta.env.DEV) {
        console.warn("‼️ [LSP1 handleUniversalReceiver - viem] Missing typeId in args:", eventArgs);
      }
      return;
    }

    const stringValue = value?.toString() ?? "0";
    const eventTypeName = TYPE_ID_TO_EVENT_MAP[lowerCaseTypeId] || "unknown_event";

    // --- ADD DEBUG LOGGING FOR FOLLOWER_GAINED ---
    if (eventTypeName === "follower_gained" && import.meta.env.DEV) {
        console.log("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
        console.log("DEBUG: Follower Gained Event Received by LSP1EventService");
        console.log("  eventArgs.from (caller of universalReceiver):", from);
        console.log("  eventArgs.value:", stringValue);
        console.log("  eventArgs.typeId:", typeId);
        console.log("  eventArgs.receivedData:", receivedData);
        console.log("  eventArgs.returnedValue:", returnedValue);
        console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
    }
    // --- END DEBUG LOGGING ---


    if (this.isDuplicateEvent(typeId, from, stringValue, receivedData)) {
      if (import.meta.env.DEV) {
        console.warn(`[LSP1 handleUniversalReceiver - viem] Duplicate event detected, ignoring: Type=${eventTypeName}`);
      }
      return;
    }
    if (import.meta.env.DEV) {
        console.log(`✅ [LSP1 handleUniversalReceiver - viem] Processing Unique Event: Type=${eventTypeName}, From=${from?.slice(0, 6)}, Value=${stringValue}, TypeId=${lowerCaseTypeId.slice(0, 8)}...`);
    }

    let actualSender = from || "0xUNKNOWN"; 
    let decodedPayload = {};

    if ((eventTypeName === "lsp7_received" || eventTypeName === "lsp8_received") && typeof receivedData === "string" && receivedData !== "0x") {
        const abiToUse = eventTypeName === "lsp7_received" ? LSP7_RECEIVED_DATA_ABI : LSP8_RECEIVED_DATA_ABI;
        try {
            const decodedDataArray = decodeAbiParameters(abiToUse, receivedData);
            if (decodedDataArray && decodedDataArray.length > 1 && typeof decodedDataArray[1] === 'string' && isAddress(decodedDataArray[1])) {
                actualSender = getAddress(decodedDataArray[1]); 
                if (import.meta.env.DEV) {
                    console.log(`   Decoded actual sender from receivedData (${eventTypeName}): ${actualSender}`);
                }
            } else if (import.meta.env.DEV) {
                console.warn(`[LSP1 viem] Failed to decode sender from receivedData or decoded data invalid for ${eventTypeName}. Data: ${receivedData}`);
            }
        } catch (decodeError) {
            if (import.meta.env.DEV) {
                console.error(`[LSP1 viem] Error decoding receivedData for ${eventTypeName}:`, decodeError, `Data: ${receivedData}`);
            }
        }
    }

    if ((eventTypeName === "follower_gained" || eventTypeName === "follower_lost")) {
        const logCtx = `[LSP1 ${eventTypeName}]`;

        if (typeof receivedData === "string" && isAddress(receivedData)) {
            // Per LSP26, receivedData is the follower's address. This is the only reliable source.
            const followerAddress = getAddress(receivedData);
            decodedPayload.followerAddress = followerAddress;
            if (import.meta.env.DEV) {
                console.log(`${logCtx} Decoded follower address from receivedData: ${followerAddress}`);
            }
        } else if (import.meta.env.DEV) {
            console.warn(`${logCtx} Could not determine follower address. 'receivedData' was not a valid address. Data:`, receivedData);
        }
    }


    const eventObj = {
      id: `event_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      timestamp: Date.now(),
      type: eventTypeName, // Human-readable name from TYPE_ID_TO_EVENT_MAP
      typeId: lowerCaseTypeId, // The actual on-chain typeId, lowercased
      data: receivedData || "0x",
      sender: actualSender, 
      value: stringValue,
      read: false,
      decodedPayload: decodedPayload, 
    };
    this.notifyEventListeners(eventObj);
  }

  /**
   * Basic duplicate event detection based on recent event identifiers.
   * @param {string} typeId - The typeId of the event.
   * @param {string} from - The 'from' address of the event.
   * @param {string} value - The 'value' of the event.
   * @param {string} data - The 'receivedData' of the event.
   * @returns {boolean} True if the event is considered a duplicate, false otherwise.
   */
  isDuplicateEvent(typeId, from, value, data) {
    const eventIdentifier = `${typeId}-${from}-${value}-${data || "0x"}`;
    if (this.recentEvents.includes(eventIdentifier)) {
      return true;
    }
    this.recentEvents.push(eventIdentifier);
    if (this.recentEvents.length > MAX_RECENT_EVENTS) {
      this.recentEvents.shift(); // Keep the list bounded
    }
    return false;
  }

  /**
   * Registers a callback function to be executed when an event is received.
   * @param {(event: ProcessedLsp1Event) => void} callback - The function to register.
   * @returns {() => void} An unsubscribe function.
   */
  onEvent(callback) {
    if (typeof callback === "function") {
      if (!this.eventCallbacks.includes(callback)) {
        this.eventCallbacks.push(callback);
      } else if (import.meta.env.DEV) {
        console.warn("[LSP1 viem] Attempted duplicate event callback registration.");
      }
    } else if (import.meta.env.DEV) {
      console.error("[LSP1 viem] Invalid callback type passed to onEvent:", typeof callback);
    }
    return () => {
      this.eventCallbacks = this.eventCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Notifies all registered listeners about a new event.
   * @param {ProcessedLsp1Event} event - The processed event object.
   */
  notifyEventListeners(event) {
    if (!event || !event.type) {
      if (import.meta.env.DEV) {
        console.error("[LSP1 viem notifyEventListeners] Attempted to notify with invalid event object:", event);
      }
      return;
    }
    if (this.eventCallbacks.length === 0 && import.meta.env.DEV) {
      console.warn(`[LSP1 viem] No listeners registered to notify about event type '${event.type}'.`);
      // return; // Allow to proceed even if no listeners, for consistency
    }
    if (import.meta.env.DEV) {
        console.log(`[LSP1 viem] Notifying ${this.eventCallbacks.length} listeners about event type '${event.type}'. Event ID: ${event.id}, TypeId: ${event.typeId}`);
    }
    // Iterate over a copy in case a callback modifies the array (e.g., unsubscribes)
    this.eventCallbacks.slice().forEach((callback) => {
      try {
        callback(event);
      } catch (e) {
        if (import.meta.env.DEV) {
            console.error(`[LSP1 viem] Error executing callback for event type ${event.type} (ID: ${event.id}):`, e);
        }
      }
    });
  }

  /**
   * Simulates receiving an event for testing purposes.
   * @async
   * @param {string} eventType - The human-readable event type or typeId to simulate.
   * @returns {Promise<boolean>} True if simulation was processed, false on error.
   */
  async simulateEvent(eventType) {
    if (!eventType || typeof eventType !== "string") {
      if (import.meta.env.DEV) {
        console.error("[LSP1 Sim - viem] Invalid eventType:", eventType);
      }
      return false;
    }
    const normalizedEventType = eventType.toLowerCase().replace(/[-_\s]/g, "");

    let typeId;
    let readableName;

    // Try to find by human-readable name first
    const typeIdEntryByName = Object.entries(EVENT_TYPE_MAP).find(
      ([key]) => key.toLowerCase().replace(/[-_\s]/g, "") === normalizedEventType
    );

    if (typeIdEntryByName) {
      readableName = typeIdEntryByName[0];
      typeId = typeIdEntryByName[1];
    } else {
      // Try to find by typeId
      const typeIdEntryById = Object.entries(TYPE_ID_TO_EVENT_MAP).find(
        ([id]) => id.toLowerCase() === normalizedEventType // Assuming normalizedEventType could be a typeId
      );
      if (typeIdEntryById) {
        typeId = typeIdEntryById[0];
        readableName = typeIdEntryById[1];
      } else {
        if (import.meta.env.DEV) {
            console.error("[LSP1 Sim - viem] Unknown event type/ID:", eventType);
        }
        return false;
      }
    }

    const mockValue = readableName.includes("lyx") ? 1000000000000000000n : 0n; // 1 LYX or 0
    // For simulating follower gained, the 'from' address should be the Follower Registry
    const mockFromField = (readableName === "follower_gained" || readableName === "follower_lost")
        ? "0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA" // LSP26 Follower Registry
        : "0xSimulationSender0000000000000000000000"; // Placeholder for other events
    
    let mockReceivedData = "0x";
    if (readableName === "follower_gained" || readableName === "follower_lost") {
      const mockFollowerAddress = "0xd8dA6Bf26964AF9D7eed9e03e53415D37aA96045"; // Actual follower/unfollower
      mockReceivedData = mockFollowerAddress.toLowerCase(); // LSP26: receivedData is the follower's address
    }

    const simulatedArgs = {
      from: mockFromField, 
      value: mockValue,
      typeId: typeId,
      receivedData: mockReceivedData, 
      returnedValue: "0x", 
    };

    try {
      this.handleUniversalReceiver(simulatedArgs);
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`[LSP1 Sim - viem] Error during handleUniversalReceiver call:`, error);
      }
      return false;
    }
  }
}

export default LSP1EventService;