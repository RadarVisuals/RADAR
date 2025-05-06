import {
  createPublicClient,
  webSocket,
  isAddress,
  decodeEventLog,
  slice,
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
 * Service class responsible for connecting to the LUKSO network via WebSocket,
 * listening for `UniversalReceiver` events on a specific profile address using
 * Viem's `watchContractEvent`, decoding the event arguments, and notifying
 * registered callbacks. Includes logic to decode sender addresses from LSP7/LSP8
 * `receivedData` and follower addresses from custom follower event data.
 * Also provides basic duplicate event detection and event simulation.
 */
class LSP1EventService {
  /** @type {Array<Function>} */
  eventCallbacks = [];
  /** @type {import('viem').PublicClient | null} */
  viemClient = null;
  /** @type {Function | null} Function returned by watchContractEvent to stop watching */
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
      console.warn(`${logPrefix} Setup already in progress. Aborting.`);
      return false;
    }
    if (!address || !isAddress(address)) {
      console.warn(`${logPrefix} Invalid address provided. Aborting setup.`);
      this.shouldBeConnected = false;
      return false;
    }

    if (this.listeningAddress?.toLowerCase() === address.toLowerCase() && this.unwatchEvent) {
      this.shouldBeConnected = true;
      return true;
    }

    this.isSettingUp = true;
    this.shouldBeConnected = true;
    this.cleanupListeners();
    this.listeningAddress = address;

    try {
      const client = createPublicClient({
        chain: lukso,
        transport: webSocket(WSS_RPC_URL),
      });
      this.viemClient = client;

      this.unwatchEvent = this.viemClient.watchContractEvent({
        address: this.listeningAddress,
        abi: LSP1_ABI,
        eventName: "UniversalReceiver",
        onLogs: (logs) => {
          console.log(`%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%`);
          console.log(`%%% VIEM watchContractEvent RECEIVED ${logs.length} LOG(S)! %%%`);
          console.log(`%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%`);
          logs.forEach((log) => {
            console.log(`--- Processing Log ---`);
            console.log(`  TX Hash: ${log.transactionHash}`);
            console.log(`  Block: ${log.blockNumber}`);
            console.log(`  Removed: ${log.removed}`);
            console.log(`  Raw Data: ${log.data}`);
            console.log(`  Raw Topics:`, log.topics);

            if (log.removed) {
              console.warn(`${logPrefix} Log marked as removed (reorg), skipping processing.`);
              return;
            }

            try {
              const decodedLog = decodeEventLog({ abi: LSP1_ABI, data: log.data, topics: log.topics });
              console.log(`  Decoded Event Name: ${decodedLog.eventName}`);
              console.log(`  Decoded Args Object:`, decodedLog.args);

              if (decodedLog.eventName === "UniversalReceiver" && decodedLog.args) {
                this.handleUniversalReceiver(decodedLog.args);
              } else {
                console.warn(`${logPrefix} Decoded log name mismatch or args missing.`);
              }
            } catch (e) {
              console.error(`%%% Error decoding filter log:`, e);
            }
            console.log(`--- End Log ---`);
          });
        },
        onError: (error) => {
          console.error(`❌ [LSP1 viem watchContractEvent] Error:`, error);
          this.shouldBeConnected = false;
        },
      });

      this.isSettingUp = false;
      return true;
    } catch (error) {
      console.error(`${logPrefix} Error during viem client creation or watch setup:`, error);
      this.cleanupListeners();
      this.isSettingUp = false;
      this.shouldBeConnected = false;
      return false;
    }
  }

  /** Cleans up the Viem client and event listener. */
  cleanupListeners() {
    const logPrefix = "[LSP1 viem cleanup]";
    this.shouldBeConnected = false;
    this.isSettingUp = false;

    if (this.unwatchEvent) {
      try {
        this.unwatchEvent();
        this.unwatchEvent = null;
      } catch (e) {
        console.error(`${logPrefix} Error calling unwatch function:`, e);
      }
    }
    this.viemClient = null;
    this.listeningAddress = null;
    this.recentEvents = [];
  }

  /**
   * Handles decoded UniversalReceiver event arguments, decodes additional data if necessary,
   * checks for duplicates, and notifies listeners.
   * @param {object} eventArgs - The decoded arguments from the UniversalReceiver event.
   */
  handleUniversalReceiver(eventArgs) {
    if (!eventArgs || typeof eventArgs !== "object" || !eventArgs.typeId) {
      console.warn("‼️ [LSP1 handleUniversalReceiver - viem] Invalid or incomplete args received:", eventArgs);
      return;
    }
    const { from, value, typeId, receivedData } = eventArgs;
    const lowerCaseTypeId = typeId?.toLowerCase();
    if (!lowerCaseTypeId) {
      console.warn("‼️ [LSP1 handleUniversalReceiver - viem] Missing typeId in args:", eventArgs);
      return;
    }
    const stringValue = value?.toString() ?? "0";
    const eventTypeName = TYPE_ID_TO_EVENT_MAP[lowerCaseTypeId] || "unknown_event";

    if (this.isDuplicateEvent(typeId, from, stringValue, receivedData)) {
      console.warn(`[LSP1 handleUniversalReceiver - viem] Duplicate event detected, ignoring: Type=${eventTypeName}`);
      return;
    }

    console.log(`✅ [LSP1 handleUniversalReceiver - viem] Processing Unique Event: Type=${eventTypeName}, From=${from?.slice(0, 6)}, Value=${stringValue}, TypeId=${lowerCaseTypeId.slice(0, 8)}...`);

    let actualSender = from || "0xUNKNOWN";
    let decodedPayload = {};

    if ((eventTypeName === "lsp7_received" || eventTypeName === "lsp8_received") && typeof receivedData === "string" && receivedData !== "0x") {
        const abiToUse = eventTypeName === "lsp7_received" ? LSP7_RECEIVED_DATA_ABI : LSP8_RECEIVED_DATA_ABI;
        try {
            const decodedData = decodeAbiParameters(abiToUse, receivedData);
            if (decodedData && decodedData.length > 1 && isAddress(decodedData[1])) {
                actualSender = getAddress(decodedData[1]);
                console.log(`   Decoded actual sender from receivedData (${eventTypeName}): ${actualSender}`);
            } else {
                console.warn(`[LSP1 viem] Failed to decode sender from receivedData or decoded data invalid for ${eventTypeName}. Data: ${receivedData}`);
            }
        } catch (decodeError) {
            console.error(`[LSP1 viem] Error decoding receivedData for ${eventTypeName}:`, decodeError, `Data: ${receivedData}`);
        }
    }

    if ((eventTypeName === "follower_gained" || eventTypeName === "follower_lost") && typeof receivedData === "string" && receivedData.length >= 42) {
      try {
        const followerAddr = getAddress(slice(receivedData, -20));
        if (isAddress(followerAddr)) {
          decodedPayload.followerAddress = followerAddr;
          console.log(`   Decoded follower/unfollower address: ${followerAddr}`);
        } else {
          console.warn("[LSP1 viem] Follower event data format invalid or address extraction failed:", receivedData);
        }
      } catch (e) {
        console.error("[LSP1 viem] Follower address decode/checksum error:", e, "Data:", receivedData);
      }
    }

    const eventObj = {
      id: `event_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      timestamp: Date.now(),
      type: eventTypeName,
      typeId: lowerCaseTypeId,
      data: receivedData || "0x",
      sender: actualSender,
      value: stringValue,
      read: false,
      decodedPayload: decodedPayload,
    };
    this.notifyEventListeners(eventObj);
  }

  /** Basic duplicate event detection based on recent event identifiers. */
  isDuplicateEvent(typeId, from, value, data) {
    const eventIdentifier = `${typeId}-${from}-${value}-${data || "0x"}`;
    if (this.recentEvents.includes(eventIdentifier)) {
      return true;
    }
    this.recentEvents.push(eventIdentifier);
    if (this.recentEvents.length > MAX_RECENT_EVENTS) {
      this.recentEvents.shift();
    }
    return false;
  }

  /**
   * Registers a callback function to be executed when an event is received.
   * @param {Function} callback - The function to register.
   * @returns {Function} An unsubscribe function.
   */
  onEvent(callback) {
    if (typeof callback === "function") {
      if (!this.eventCallbacks.includes(callback)) {
        this.eventCallbacks.push(callback);
      } else {
        console.warn("[LSP1 viem] Attempted duplicate event callback registration.");
      }
    } else {
      console.error("[LSP1 viem] Invalid callback type passed to onEvent:", typeof callback);
    }
    return () => {
      this.eventCallbacks = this.eventCallbacks.filter((cb) => cb !== callback);
    };
  }

  /** Notifies all registered listeners about a new event. */
  notifyEventListeners(event) {
    if (!event || !event.type) {
      console.error("[LSP1 viem notifyEventListeners] Attempted to notify with invalid event object:", event);
      return;
    }
    if (this.eventCallbacks.length === 0) {
      console.warn(`[LSP1 viem] No listeners registered to notify about event type '${event.type}'.`);
      return;
    }
    console.log(`[LSP1 viem] Notifying ${this.eventCallbacks.length} listeners about event type '${event.type}'. Event ID: ${event.id}`);
    this.eventCallbacks.slice().forEach((callback) => {
      try {
        callback(event);
      } catch (e) {
        console.error(`[LSP1 viem] Error executing callback for event type ${event.type} (ID: ${event.id}):`, e);
      }
    });
  }

  /** Simulates receiving an event for testing purposes. */
  async simulateEvent(eventType) {
    if (!eventType || typeof eventType !== "string") {
      console.error("[LSP1 Sim - viem] Invalid eventType:", eventType);
      return false;
    }
    const normalizedEventType = eventType.toLowerCase().replace(/[-_\s]/g, "");
    let typeIdEntry = Object.entries(EVENT_TYPE_MAP).find(
      ([key]) => key.toLowerCase().replace(/[-_\s]/g, "") === normalizedEventType // Fixed: Only need key here
    );
    if (!typeIdEntry) {
      const foundByTypeId = Object.entries(TYPE_ID_TO_EVENT_MAP).find(
        ([id]) => id.toLowerCase() === normalizedEventType // Fixed: Only need id here
      );
      if (foundByTypeId) {
        typeIdEntry = [foundByTypeId[1], foundByTypeId[0]];
      } else {
        console.error("[LSP1 Sim - viem] Unknown event type/ID:", eventType);
        return false;
      }
    }
    const typeId = typeIdEntry[1];
    const readableName = typeIdEntry[0];
    const mockValue = readableName.includes("lyx") ? 1000000000000000000n : 0n;
    const mockSender = "0xSimulationSender0000000000000000000000";
    let mockReceivedData = "0x";
    if (readableName === "follower_gained" || readableName === "follower_lost") {
      const mockFollowerAddress = "0xd8dA6Bf26964AF9D7eed9e03e53415D37aA96045";
      mockReceivedData = mockFollowerAddress.toLowerCase();
    }

    const simulatedArgs = {
      from: mockSender, value: mockValue, typeId: typeId, receivedData: mockReceivedData, returnedValue: "0x",
    };
    try {
      this.handleUniversalReceiver(simulatedArgs);
      return true;
    } catch (error) {
      console.error(`[LSP1 Sim - viem] Error during handleUniversalReceiver call:`, error);
      return false;
    }
  }
}

export default LSP1EventService;