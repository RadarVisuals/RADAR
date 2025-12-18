// src/services/LSP1EventService.jsx
import {
  createPublicClient,
  webSocket,
  isAddress,
  decodeEventLog,
  getAddress,
  decodeAbiParameters,
} from "viem";
import { lukso } from "viem/chains";

import {
  EVENT_TYPE_MAP,
  TYPE_ID_TO_EVENT_MAP,
} from "../config/global-config";

// --- IMPORT ABIS ---
import {
  LSP1_ABI,
  LSP7_RECEIVED_DATA_ABI,
  LSP8_RECEIVED_DATA_ABI,
} from "../config/abis";

const DEFAULT_LUKSO_WSS_RPC_URL = "wss://ws-rpc.mainnet.lukso.network";
const WSS_RPC_URL =
  import.meta.env.VITE_LUKSO_WSS_RPC_URL || DEFAULT_LUKSO_WSS_RPC_URL;
const MAX_RECENT_EVENTS = 10; // For duplicate detection

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

  async initialize() {
    if (this.initialized) return true;
    this.initialized = true;
    return true;
  }

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

    if (
      this.listeningAddress?.toLowerCase() === address.toLowerCase() &&
      this.unwatchEvent
    ) {
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
        transport: webSocket(WSS_RPC_URL, {}),
      });
      this.viemClient = client;

      this.unwatchEvent = this.viemClient.watchContractEvent({
        address: this.listeningAddress,
        abi: LSP1_ABI,
        eventName: "UniversalReceiver",
        onLogs: (logs) => {
          if (import.meta.env.DEV) {
            console.log(
              `%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%`
            );
            console.log(
              `%%% VIEM watchContractEvent RECEIVED ${logs.length} LOG(S)! %%%`
            );
            console.log(
              `%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%`
            );
          }
          logs.forEach((log) => {
            if (log.removed) {
              return;
            }

            try {
              const decodedLog = decodeEventLog({
                abi: LSP1_ABI,
                data: log.data,
                topics: log.topics,
              });

              if (
                decodedLog.eventName === "UniversalReceiver" &&
                decodedLog.args
              ) {
                this.handleUniversalReceiver(decodedLog.args);
              } else if (import.meta.env.DEV) {
                console.warn(
                  `${logPrefix} Decoded log name mismatch or args missing.`
                );
              }
            } catch (e) {
              if (import.meta.env.DEV) {
                console.error(`%%% Error decoding filter log:`, e);
              }
            }
          });
        },
        onError: (error) => {
          if (import.meta.env.DEV) {
            console.error(
              `❌ [LSP1 viem watchContractEvent] Error on address ${this.listeningAddress}:`,
              error
            );
          }
          this.shouldBeConnected = false;
        },
      });
      if (import.meta.env.DEV) {
        console.log(`${logPrefix} Successfully started watching events.`);
      }
      this.isSettingUp = false;
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(
          `${logPrefix} Error during viem client creation or watch setup:`,
          error
        );
      }
      this.cleanupListeners();
      this.isSettingUp = false;
      this.shouldBeConnected = false;
      return false;
    }
  }

  cleanupListeners() {
    this.shouldBeConnected = false;
    this.isSettingUp = false;

    if (this.unwatchEvent) {
      try {
        this.unwatchEvent();
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error(`[LSP1 viem cleanup] Error calling unwatch function:`, e);
        }
      }
      this.unwatchEvent = null;
    }
    this.viemClient = null;
    this.listeningAddress = null;
    this.recentEvents = [];
  }

  handleUniversalReceiver(eventArgs) {
    if (!eventArgs || typeof eventArgs !== "object" || !eventArgs.typeId) {
      if (import.meta.env.DEV) {
        console.warn(
          "‼️ [LSP1 handleUniversalReceiver - viem] Invalid or incomplete args received:",
          eventArgs
        );
      }
      return;
    }
    const { from, value, typeId, receivedData, returnedValue } = eventArgs;
    const lowerCaseTypeId = typeId?.toLowerCase();

    if (!lowerCaseTypeId) {
      return;
    }

    const stringValue = value?.toString() ?? "0";
    const eventTypeName =
      TYPE_ID_TO_EVENT_MAP[lowerCaseTypeId] || "unknown_event";

    if (this.isDuplicateEvent(typeId, from, stringValue, receivedData)) {
      return;
    }

    let actualSender = from || "0xUNKNOWN";
    let decodedPayload = {};

    if (
      (eventTypeName === "lsp7_received" ||
        eventTypeName === "lsp8_received") &&
      typeof receivedData === "string" &&
      receivedData !== "0x"
    ) {
      const abiToUse =
        eventTypeName === "lsp7_received"
          ? LSP7_RECEIVED_DATA_ABI
          : LSP8_RECEIVED_DATA_ABI;
      try {
        const decodedDataArray = decodeAbiParameters(abiToUse, receivedData);
        if (
          decodedDataArray &&
          decodedDataArray.length > 1 &&
          typeof decodedDataArray[1] === "string" &&
          isAddress(decodedDataArray[1])
        ) {
          actualSender = getAddress(decodedDataArray[1]);
        }
      } catch (decodeError) {
        if (import.meta.env.DEV) {
          console.error(
            `[LSP1 viem] Error decoding receivedData for ${eventTypeName}:`,
            decodeError
          );
        }
      }
    }

    if (
      eventTypeName === "follower_gained" ||
      eventTypeName === "follower_lost"
    ) {
      if (typeof receivedData === "string" && isAddress(receivedData)) {
        const followerAddress = getAddress(receivedData);
        decodedPayload.followerAddress = followerAddress;
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

  onEvent(callback) {
    if (typeof callback === "function") {
      if (!this.eventCallbacks.includes(callback)) {
        this.eventCallbacks.push(callback);
      }
    }
    return () => {
      this.eventCallbacks = this.eventCallbacks.filter((cb) => cb !== callback);
    };
  }

  notifyEventListeners(event) {
    if (!event || !event.type) return;
    this.eventCallbacks.slice().forEach((callback) => {
      try {
        callback(event);
      } catch (e) {
        console.error(`Error in event callback:`, e);
      }
    });
  }

  async simulateEvent(eventType) {
    if (!eventType || typeof eventType !== "string") return false;
    const normalizedEventType = eventType.toLowerCase().replace(/[-_\s]/g, "");

    let typeId;
    let readableName;

    const typeIdEntryByName = Object.entries(EVENT_TYPE_MAP).find(
      ([key]) =>
        key.toLowerCase().replace(/[-_\s]/g, "") === normalizedEventType
    );

    if (typeIdEntryByName) {
      readableName = typeIdEntryByName[0];
      typeId = typeIdEntryByName[1];
    } else {
      const typeIdEntryById = Object.entries(TYPE_ID_TO_EVENT_MAP).find(
        ([id]) => id.toLowerCase() === normalizedEventType
      );
      if (typeIdEntryById) {
        typeId = typeIdEntryById[0];
        readableName = typeIdEntryById[1];
      } else {
        return false;
      }
    }

    const mockValue = readableName.includes("lyx") ? 1000000000000000000n : 0n;
    const mockFromField =
      readableName === "follower_gained" || readableName === "follower_lost"
        ? "0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA"
        : "0xSimulationSender0000000000000000000000";

    let mockReceivedData = "0x";
    if (
      readableName === "follower_gained" ||
      readableName === "follower_lost"
    ) {
      const mockFollowerAddress = "0xd8dA6Bf26964AF9D7eed9e03e53415D37aA96045";
      mockReceivedData = mockFollowerAddress.toLowerCase();
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
      return false;
    }
  }
}

export default LSP1EventService;