import { createUPProviderConnector } from "@lukso/up-provider";

/**
 * Initializes the UP Provider Connector for the host environment (the main window).
 * This allows embedded iframes (MiniApps) using the client UP Provider
 * to connect and interact with the user's UP extension via the host.
 * This function should only be called when the application is NOT running inside an iframe.
 */
export function initializeHostUPConnector() {
  try {
    const hostProvider = window.lukso || window.ethereum;
    if (!hostProvider) {
      // Keep critical error log
      console.error("[UP Host] No host provider (window.lukso or window.ethereum) found!");
      return;
    }

    // Using Mainnet RPC is generally safe here as the host provider dictates the network.
    const connector = createUPProviderConnector(hostProvider, [
      "https://rpc.lukso.network", // LUKSO Mainnet RPC endpoint
    ]);

    connector.on("channelCreated", (id, channel) => {
      // Simply enable the communication channel.
      // Do NOT push initial state (chainId, accounts) here.
      // Let the client request this info or receive it via standard EIP-1193 events
      // ('chainChanged', 'accountsChanged') that the connector should relay.
      // This avoids potential state conflicts that might disable the connect button.
      try {
        channel.enable = true; // Set the documented 'enable' property
      } catch (error) {
        // Keep critical error log
        console.error(`[UP Host] Error enabling channel for MiniApp ${id}:`, error);
        // Consider channel.disconnect() or other error handling if needed
      }
    });

  } catch (error) {
    // Keep critical error log
    console.error("[UP Host] Fatal Error initializing UPProviderConnector:", error);
  }
}