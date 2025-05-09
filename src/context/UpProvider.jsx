// src/context/UpProvider.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import PropTypes from 'prop-types';
import { createClientUPProvider } from "@lukso/up-provider";
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  numberToHex,
} from "viem";
import { lukso, luksoTestnet } from "viem/chains";

/**
 * Normalizes a chain ID to its hexadecimal string representation.
 * @param {string|number|null|undefined} chainId - The chain ID to normalize.
 * @returns {string|null} The normalized hex chain ID or null if invalid.
 */
const normalizeChainId = (chainId) => {
  if (!chainId) return null;
  if (typeof chainId === "number") {
    return numberToHex(chainId);
  }
  if (typeof chainId === "string") {
    const lower = chainId.toLowerCase();
    if (/^0x[0-9a-f]+$/.test(lower)) return lower; // Already hex
    try {
      const num = parseInt(lower, 10); // Try parsing as decimal
      if (!isNaN(num)) return numberToHex(num);
    // eslint-disable-next-line no-unused-vars
    } catch (_) {
      /* ignore parse error */
    }
    if (/^[0-9a-f]+$/.test(lower)) return `0x${lower}`; // Add 0x if missing
  }
  console.warn("[UpProvider] Invalid chainId format provided:", chainId);
  return null;
};

// Supported chains configuration
const VIEM_CHAINS = {
  [normalizeChainId(lukso.id)]: lukso,
  [normalizeChainId(luksoTestnet.id)]: luksoTestnet,
};

// RPC URLs from environment variables with fallbacks
const LUKSO_MAINNET_RPC = import.meta.env.VITE_LUKSO_MAINNET_RPC_URL || "https://rpc.mainnet.lukso.network";
const LUKSO_TESTNET_RPC = import.meta.env.VITE_LUKSO_TESTNET_RPC_URL || "https://rpc.testnet.lukso.network";

const RPC_URLS = {
  [normalizeChainId(lukso.id)]: LUKSO_MAINNET_RPC,
  [normalizeChainId(luksoTestnet.id)]: LUKSO_TESTNET_RPC,
};

// Map of supported chain objects, keyed by normalized chain ID
const SUPPORTED_CHAINS = {
  [normalizeChainId(lukso.id)]: VIEM_CHAINS[normalizeChainId(lukso.id)],
  [normalizeChainId(luksoTestnet.id)]: VIEM_CHAINS[normalizeChainId(luksoTestnet.id)],
};

// --- Context Definition ---
/**
 * @typedef {object} UpProviderState
 * @property {object|null} provider - The raw EIP-1193 UP Provider instance from `@lukso/up-provider`.
 * @property {import('viem').WalletClient|null} walletClient - Viem Wallet Client configured for the UP.
 * @property {import('viem').PublicClient|null} publicClient - Viem Public Client for the current chain.
 * @property {string|null} chainId - The current hexadecimal chain ID (e.g., '0x2a' for LUKSO Mainnet).
 * @property {Array<string>} accounts - Array of EOA addresses controlled by the user, provided by the UP extension. `accounts[0]` is typically the active EOA.
 * @property {Array<string>} contextAccounts - Array of UP addresses relevant to the current context (e.g., the profile being viewed). `contextAccounts[0]` is the primary context UP.
 * @property {boolean} walletConnected - True if the provider is considered connected (valid chain, accounts, and contextAccounts are present).
 * @property {boolean} isConnecting - Always false; connection is event-driven. Kept for API consistency if needed.
 * @property {Error|null} initializationError - Error object if `createClientUPProvider` failed.
 * @property {Error|null} fetchStateError - Error object from Viem client creation attempts.
 * @property {boolean} hasCriticalError - True if `initializationError` is present.
 */

const UpContext = createContext(undefined);

// --- UP Provider Instance Creation ---
// This is done once when the module loads.
let upProviderInstance = null;
let upProviderInitializationError = null;
if (typeof window !== "undefined") { // Ensure it runs only in the browser
  try {
    upProviderInstance = createClientUPProvider();
  } catch (error) {
    console.error("[UpProvider] CRITICAL: Error creating Client UP Provider instance:", error);
    upProviderInitializationError = error;
  }
}

/**
 * Custom hook `useUpProvider` to consume `UpContext`.
 * Provides access to the UP Provider instance, Viem clients, connection state,
 * accounts (EOA and UP context), chain ID, and errors.
 * @returns {UpProviderState} The current state of the UpProvider.
 * @throws {Error} If used outside of an `UpProvider`.
 */
export function useUpProvider() {
  const context = useContext(UpContext);
  if (context === undefined) {
    throw new Error("useUpProvider must be used within an UpProvider");
  }
  return context;
}

/**
 * `UpProvider` component.
 * Manages the connection to a Universal Profile extension via `@lukso/up-provider`.
 * It initializes Viem public and wallet clients, tracks connection status,
 * EOA accounts, context UP accounts, chain ID, and handles provider events
 * according to EIP-1193 best practices for mini-apps.
 *
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Child components that will consume this context.
 */
export function UpProvider({ children }) {
  const [provider] = useState(upProviderInstance);
  const [initializationError] = useState(upProviderInitializationError);
  const [chainId, setChainId] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [contextAccounts, setContextAccounts] = useState([]);
  const [walletConnected, setWalletConnected] = useState(false);
  const [fetchStateError, setFetchStateError] = useState(null);

  const hasCriticalError = useMemo(() => !!initializationError, [initializationError]);
  const currentChain = useMemo(() => chainId && SUPPORTED_CHAINS[chainId] ? SUPPORTED_CHAINS[chainId] : null, [chainId]);
  const connectedEOA = useMemo(() => (accounts?.length > 0 ? accounts[0] : null), [accounts]);

  const publicClient = useMemo(() => {
    if (!currentChain) return null;
    try {
      const rpcUrl = RPC_URLS[chainId];
      if (!rpcUrl) throw new Error(`No configured RPC URL for chain ${chainId}`);
      const transport = http(rpcUrl, { retryCount: 3 });
      return createPublicClient({ chain: currentChain, transport });
    } catch (error) {
      console.error("[UpProvider] Error creating public client:", error);
      setFetchStateError(error);
      return null;
    }
  }, [currentChain, chainId]);

  const walletClient = useMemo(() => {
    if (hasCriticalError || !provider || !currentChain || !connectedEOA) return null;
    try {
      return createWalletClient({ chain: currentChain, transport: custom(provider), account: connectedEOA });
    } catch (error) {
      console.error("[UpProvider] Error creating wallet client:", error);
      setFetchStateError(error);
      return null;
    }
  }, [provider, currentChain, connectedEOA, hasCriticalError]);

  const updateConnectedStatus = useCallback(() => {
    const connected = !!chainId &&
                      !!SUPPORTED_CHAINS[chainId] &&
                      accounts.length > 0 &&
                      contextAccounts.length > 0;
    setWalletConnected(connected);
  }, [chainId, accounts, contextAccounts]);

  useEffect(() => {
    if (initializationError) {
      console.error("[UpProvider] Setup skipped due to initialization error.");
      return;
    }
    if (!provider) {
      console.warn("[UpProvider] Setup skipped: Client UP Provider instance not available.");
      return;
    }

    const mountedRef = { current: true };
    // console.log("[UpProvider] Setting up listeners and attempting initial state read...");

    try {
      const _initialAccounts = provider.accounts || [];
      const _initialContextAccounts = provider.contextAccounts || [];
      if (mountedRef.current) {
        setAccounts(_initialAccounts);
        setContextAccounts(_initialContextAccounts);
        // console.log(`[UpProvider] Initial sync accounts:`, _initialAccounts);
        // console.log(`[UpProvider] Initial sync contextAccounts:`, _initialContextAccounts);
      }

      provider.request({ method: "eth_chainId" })
        .then(rawChainId => {
          if (!mountedRef.current) return;
          const normalizedId = normalizeChainId(rawChainId);
          const isValid = !!normalizedId && normalizedId !== "0x0" && !!SUPPORTED_CHAINS[normalizedId];
          setChainId(isValid ? normalizedId : null);
          // console.log(`[UpProvider] Initial async chainId: ${isValid ? normalizedId : 'Invalid/Unsupported'}`);
          updateConnectedStatus();
        })
        .catch(err => console.warn("[UpProvider] Error fetching initial chainId:", err));

      updateConnectedStatus();
    } catch (err) {
      console.error("[UpProvider] Error accessing initial provider properties:", err);
      provider.request({ method: "eth_accounts" })
        .then(_fallbackAccounts => {
          if (!mountedRef.current) return;
          setAccounts(_fallbackAccounts || []);
          updateConnectedStatus();
        })
        .catch(fallbackErr => console.warn("[UpProvider] Error fetching initial accounts (fallback):", fallbackErr));
    }

    const handleAccountsChanged = (_newAccounts) => {
      if (!mountedRef.current) return;
      const newAccs = _newAccounts || [];
      // console.log("[UpProvider Event] accountsChanged:", newAccs);
      setAccounts(newAccs);
      updateConnectedStatus();
    };

    const handleChainChanged = (rawChainId) => {
      if (!mountedRef.current) return;
      const normalizedId = normalizeChainId(rawChainId);
      const isValidChain = !!normalizedId && normalizedId !== "0x0" && !!SUPPORTED_CHAINS[normalizedId];
      // console.log(`[UpProvider Event] chainChanged: Raw=${rawChainId}, Normalized=${normalizedId}, IsValid=${isValidChain}`);
      setChainId(isValidChain ? normalizedId : null);
      if (!isValidChain) {
          console.warn("[UpProvider Event] Chain changed to invalid/unsupported. Clearing accounts.");
          setAccounts([]);
          setContextAccounts([]);
      }
      updateConnectedStatus();
    };

    const handleContextAccountsChanged = (_newContextAccounts) => {
      if (!mountedRef.current) return;
      const newContextAccs = _newContextAccounts || [];
      // console.log("[UpProvider Event] contextAccountsChanged:", newContextAccs);
      setContextAccounts(newContextAccs);
      updateConnectedStatus();
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);
    provider.on("contextAccountsChanged", handleContextAccountsChanged);
    // console.log("[UpProvider] Event listeners attached.");

    return () => {
      mountedRef.current = false;
      // console.log("[UpProvider] Removing listeners.");
      if (provider?.removeListener) {
        provider.removeListener("accountsChanged", handleAccountsChanged);
        provider.removeListener("chainChanged", handleChainChanged);
        provider.removeListener("contextAccountsChanged", handleContextAccountsChanged);
      }
    };
  }, [provider, initializationError, updateConnectedStatus]);

  const contextValue = useMemo(
    () => ({
      provider, walletClient, publicClient, chainId, accounts, contextAccounts,
      walletConnected,
      isConnecting: false, // Consistently false as connection is event-driven
      initializationError, fetchStateError, hasCriticalError,
    }),
    [
      provider, walletClient, publicClient, chainId, accounts, contextAccounts,
      walletConnected, initializationError, fetchStateError, hasCriticalError,
    ],
  );

  return (
    <UpContext.Provider value={contextValue}>{children}</UpContext.Provider>
  );
}

UpProvider.propTypes = {
    children: PropTypes.node.isRequired,
};