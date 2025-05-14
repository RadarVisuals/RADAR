// src/utils/upHostConnector.js (Example filename, adjust as needed)
import { createUPProviderConnector } from "@lukso/up-provider";

/**
 * Initializes the Universal Profile (UP) Provider Connector for the host environment (the main window).
 * This setup allows embedded iframes (MiniApps), which use the client-side UP Provider,
 * to securely connect and interact with the user's UP browser extension via this host application.
 *
 * This function should only be called when the application is determined to be running
 * in the top-level window context (i.e., not inside an iframe).
 *
 * The connector listens for new communication channels from MiniApps and enables them.
 * It relies on the standard EIP-1193 events (`chainChanged`, `accountsChanged`) being relayed
 * by the connector to inform MiniApps of state changes, rather than pushing initial state directly,
 * to prevent potential state conflicts or race conditions.
 *
 * @returns {void}
 */
export function initializeHostUPConnector() {
  try {
    // Attempt to get the host's EIP-1193 provider (typically the UP extension)
    const hostProvider = window.lukso || window.ethereum;
    if (!hostProvider) {
      // This is a critical issue if the host is expected to have a UP extension.
      if (import.meta.env.DEV) {
        console.error("[UP Host Connector] No host provider (window.lukso or window.ethereum) found. UP Connector cannot be initialized.");
      }
      return;
    }

    // The RPC URL provided here is a fallback or for specific configurations.
    // The hostProvider (UP extension) itself dictates the actual network connection.
    // Using a Mainnet RPC is a common default if no other specific network is targeted by the host setup.
    const connector = createUPProviderConnector(hostProvider, [
      "https://rpc.lukso.network", // LUKSO Mainnet RPC endpoint (can be made configurable if needed)
      // Add other RPCs if your host application might switch networks and needs to inform the connector.
    ]);

    // Listen for new channels created by MiniApps attempting to connect.
    connector.on("channelCreated", (id, channel) => {
      // When a MiniApp (identified by `id`) creates a channel, enable it.
      // The `channel.enable = true` step is crucial for establishing communication.
      //
      // IMPORTANT: Do NOT push initial state (like chainId or accounts) directly to the channel here.
      // The client UP Provider in the MiniApp should request this information using standard
      // EIP-1193 methods (e.g., `eth_chainId`, `eth_accounts`) after connection, or listen for
      // standard EIP-1193 events (`chainChanged`, `accountsChanged`) that the connector
      // should automatically relay from the hostProvider. Pushing state here can lead to
      // race conditions or state inconsistencies, potentially disabling the connect button
      // in the MiniApp or causing other unexpected behavior.
      try {
        channel.enable = true; // Enable the communication channel with the MiniApp.
        if (import.meta.env.DEV) {
          // console.log(`[UP Host Connector] Enabled communication channel for MiniApp ID: ${id}`);
        }
      } catch (error) {
        // This is a critical error if a channel cannot be enabled.
        if (import.meta.env.DEV) {
          console.error(`[UP Host Connector] CRITICAL: Error enabling channel for MiniApp ID ${id}:`, error);
        }
        // Consider additional error handling, e.g., attempting to disconnect the problematic channel
        // if (channel && typeof channel.disconnect === 'function') {
        //   channel.disconnect();
        // }
      }
    });

    if (import.meta.env.DEV) {
      // console.log("[UP Host Connector] Initialized successfully and listening for MiniApp connections.");
    }

  } catch (error) {
    // This indicates a fatal error during the connector's own initialization.
    if (import.meta.env.DEV) {
      console.error("[UP Host Connector] FATAL: Error initializing UPProviderConnector:", error);
    }
  }
}