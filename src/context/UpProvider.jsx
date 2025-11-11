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

import { createClientUPProvider } from "@lukso/up-provider"; // Lukso UP Provider
import {
  createWalletClient,
  createPublicClient,
  custom, // For Viem transport with EIP-1193 provider
  http,   // For Viem public client transport
  numberToHex,
  getAddress, // <<< ENSURED IMPORT
  isAddress,  // <<< ADDED IMPORT
} from "viem";
import { lukso, luksoTestnet } from "viem/chains"; // Supported Viem chain definitions

/**
 * Normalizes a chain ID to its hexadecimal string representation (e.g., "0x2a").
 * Handles number, decimal string, or hex string inputs.
 * @param {string|number|null|undefined} chainId - The chain ID to normalize.
 * @returns {string|null} The normalized hex chain ID (lowercase) or null if input is invalid.
 */
const normalizeChainId = (chainId) => {
  if (chainId === null || chainId === undefined) return null;
  if (typeof chainId === "number") {
    return numberToHex(chainId);
  }
  if (typeof chainId === "string") {
    const lower = chainId.toLowerCase().trim();
    if (/^0x[0-9a-f]+$/.test(lower)) return lower; // Already hex
    try {
      const num = parseInt(lower, 10); // Try parsing as decimal
      if (!isNaN(num) && num >= 0) return numberToHex(num);
    // eslint-disable-next-line no-unused-vars
    } catch (_) {
      // Ignore parse error, try hex without 0x
    }
    if (/^[0-9a-f]+$/.test(lower)) return `0x${lower}`; // Add 0x if missing
  }
  if (import.meta.env.DEV) {
    console.warn("[UpProvider] Invalid chainId format provided for normalization:", chainId);
  }
  return null;
};

// Supported chains configuration, keyed by normalized chain ID
const VIEM_CHAINS = {
  [/** @type {string} */ (normalizeChainId(lukso.id))]: lukso,
  [/** @type {string} */ (normalizeChainId(luksoTestnet.id))]: luksoTestnet,
};

// RPC URLs from environment variables with fallbacks
const LUKSO_MAINNET_RPC = import.meta.env.VITE_LUKSO_MAINNET_RPC_URL || "https://rpc.mainnet.lukso.network";
const LUKSO_TESTNET_RPC = import.meta.env.VITE_LUKSO_TESTNET_RPC_URL || "https://rpc.testnet.lukso.network";

const RPC_URLS = {
  [/** @type {string} */ (normalizeChainId(lukso.id))]: LUKSO_MAINNET_RPC,
  [/** @type {string} */ (normalizeChainId(luksoTestnet.id))]: LUKSO_TESTNET_RPC,
};

// Map of supported chain objects, keyed by normalized chain ID
const SUPPORTED_CHAINS = {
  [/** @type {string} */ (normalizeChainId(lukso.id))]: VIEM_CHAINS[/** @type {string} */ (normalizeChainId(lukso.id))],
  [/** @type {string} */ (normalizeChainId(luksoTestnet.id))]: VIEM_CHAINS[/** @type {string} */ (normalizeChainId(luksoTestnet.id))],
};

// --- Context Definition ---
/**
 * @typedef {object} UpProviderState
 * @property {object|null} provider - The raw EIP-1193 UP Provider instance from `@lukso/up-provider`. Null if `createClientUPProvider` fails.
 * @property {import('viem').WalletClient|null} walletClient - Viem Wallet Client configured for the UP. Null if provider, chain, or EOA is unavailable/invalid.
 * @property {import('viem').PublicClient|null} publicClient - Viem Public Client for the current chain. Null if chain is unsupported or RPC URL is missing.
 * @property {string|null} chainId - The current hexadecimal chain ID (e.g., '0x2a' for LUKSO Mainnet), or null if unsupported/disconnected.
 * @property {Array<string>} accounts - Array of EOA addresses controlled by the user, provided by the UP extension. `accounts[0]` is typically the active EOA.
 * @property {Array<string>} contextAccounts - Array of UP addresses relevant to the current context (e.g., the profile being viewed). `contextAccounts[0]` is the primary context UP.
 * @property {boolean} walletConnected - True if the provider is considered connected (valid chain, EOA accounts, and context UP accounts are present).
 * @property {boolean} isConnecting - Always false in this implementation; connection status is derived from events and available data. Kept for potential API consistency if other providers manage explicit connection states.
 * @property {Error|null} initializationError - Error object if `createClientUPProvider` failed during initial module load.
 * @property {Error|null} fetchStateError - Error object from Viem public or wallet client creation attempts.
 * @property {boolean} hasCriticalError - True if `initializationError` is present, indicating a fundamental issue with the UP provider setup.
 */

/** @type {React.Context<UpProviderState | undefined>} */
const UpContext = createContext(undefined);

// --- UP Provider Instance Creation ---
let upProviderInstance = null;
/** @type {Error | null} */
let upProviderInitializationError = null;

if (typeof window !== "undefined" && typeof window.ethereum !== "undefined") {
  try {
    upProviderInstance = createClientUPProvider();
  } catch (error) {
    if (import.meta.env.DEV) {
        console.error("[UpProvider] CRITICAL: Error creating Client UP Provider instance:", error);
    }
    upProviderInitializationError = error instanceof Error ? error : new Error(String(error));
  }
} else if (typeof window !== "undefined" && import.meta.env.DEV) {
    console.warn("[UpProvider] window.ethereum (Universal Profile Extension) not detected. UP Provider not initialized.");
    upProviderInitializationError = new Error("Universal Profile Extension (window.ethereum) not detected.");
}


/**
 * Custom hook `useUpProvider` to consume `UpContext`.
 * @returns {UpProviderState} The current state of the UpProvider.
 * @throws {Error} If used outside of an `UpProvider`.
 */
export function useUpProvider() {
  const context = useContext(UpContext);
  if (context === undefined) {
    const err = new Error("useUpProvider must be used within an UpProvider component.");
    if (import.meta.env.DEV) {
        console.error("useUpProvider context details: Attempted to use context but found undefined. This usually means UpProvider is missing as an ancestor.", err.stack);
    }
    throw err;
  }
  return context;
}

/**
 * `UpProvider` component.
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Child components that will consume this context.
 * @returns {JSX.Element} The UpProvider component.
 */
export function UpProvider({ children }) {
  const [provider] = useState(upProviderInstance);
  const [initializationError] = useState(upProviderInitializationError);
  /** @type {[string | null, React.Dispatch<React.SetStateAction<string | null>>]} */
  const [chainId, setChainId] = useState(null);
  /** @type {[Array<string>, React.Dispatch<React.SetStateAction<Array<string>>>]} */
  const [accounts, setAccounts] = useState([]);
  /** @type {[Array<string>, React.Dispatch<React.SetStateAction<Array<string>>>]} */
  const [contextAccounts, setContextAccounts] = useState([]);
  const [walletConnected, setWalletConnected] = useState(false);
  /** @type {[Error | null, React.Dispatch<React.SetStateAction<Error | null>>]} */
  const [fetchStateError, setFetchStateError] = useState(null);
  
  const hasCriticalError = useMemo(() => !!initializationError, [initializationError]);
  const currentChain = useMemo(() => chainId && SUPPORTED_CHAINS[chainId] ? SUPPORTED_CHAINS[chainId] : null, [chainId]);
  const connectedEOA = useMemo(() => (accounts?.length > 0 ? accounts[0] : null), [accounts]);

  const publicClient = useMemo(() => {
    if (!currentChain || !chainId) return null;
    try {
      const rpcUrl = RPC_URLS[chainId];
      if (!rpcUrl) {
        throw new Error(`No configured RPC URL for chain ${chainId}`);
      }
      const transport = http(rpcUrl, { retryCount: 3 });
      return createPublicClient({ chain: currentChain, transport });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("[UpProvider] Error creating public client:", error);
      }
      setFetchStateError(error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }, [currentChain, chainId]);

  const walletClient = useMemo(() => {
    if (hasCriticalError || !provider || !currentChain || !connectedEOA) return null;
    try {
      const eoaForClient = getAddress(/** @type {`0x${string}`} */ (connectedEOA)); // Ensure checksummed and cast for Viem
      return createWalletClient({ chain: currentChain, transport: custom(provider), account: eoaForClient });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("[UpProvider] Error creating wallet client:", error);
      }
      setFetchStateError(error instanceof Error ? error : new Error(String(error)));
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
  
  // Safely checksum an array of addresses
  const checksumAddressArray = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.map(addr => {
      try { return getAddress(addr); }
      catch { return null; }
    }).filter(Boolean);
  };

  useEffect(() => {
    if (initializationError) {
      if (import.meta.env.DEV) {
        console.error("[UpProvider] Setup skipped due to UP provider initialization error.");
      }
      setWalletConnected(false);
      return;
    }
    if (!provider) {
      if (import.meta.env.DEV) {
        console.warn("[UpProvider] Setup skipped: Client UP Provider instance not available (likely no UP extension).");
      }
      setWalletConnected(false);
      return;
    }

    /** @type {{ current: boolean }} */
    const mountedRef = { current: true };

    const fetchInitialData = async () => {
        try {
            const [_initialAccounts, _initialChainId] = await Promise.all([
                provider.request({ method: "eth_accounts" }),
                provider.request({ method: "eth_chainId" })
            ]);

            if (!mountedRef.current) return;

            const newAccs = checksumAddressArray(_initialAccounts || []);
            setAccounts(newAccs);
            
            setContextAccounts(checksumAddressArray(provider.contextAccounts || []));

            const normalizedId = normalizeChainId(_initialChainId);
            const isValid = !!normalizedId && normalizedId !== "0x0" && !!SUPPORTED_CHAINS[normalizedId];
            setChainId(isValid ? normalizedId : null);
            
            updateConnectedStatus();
        } catch (err) {
            if (import.meta.env.DEV) console.error("[UpProvider] Error during initial data fetch:", err);
        }
    };
    
    fetchInitialData();

    const handleAccountsChanged = async (_newAccounts) => {
      if (!mountedRef.current) return;
      const newAccs = checksumAddressArray(_newAccounts || []);
      setAccounts(newAccs);
      
      updateConnectedStatus();
    };

    const handleChainChanged = (rawChainId) => {
      if (!mountedRef.current) return;
      const normalizedId = normalizeChainId(rawChainId);
      const isValidChain = !!normalizedId && normalizedId !== "0x0" && !!SUPPORTED_CHAINS[normalizedId];
      setChainId(isValidChain ? normalizedId : null);
      if (!isValidChain) {
          if (import.meta.env.DEV) console.warn("[UpProvider Event] Chain changed to invalid/unsupported. Clearing accounts.");
          setAccounts([]);
          setContextAccounts([]);
      }
      updateConnectedStatus();
    };

    const handleContextAccountsChanged = (_newContextAccounts) => {
      if (!mountedRef.current) return;
      setContextAccounts(checksumAddressArray(_newContextAccounts || []));
      updateConnectedStatus();
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);
    provider.on("contextAccountsChanged", handleContextAccountsChanged);

    return () => {
      mountedRef.current = false;
      if (provider?.removeListener) {
        provider.removeListener("accountsChanged", handleAccountsChanged);
        provider.removeListener("chainChanged", handleChainChanged);
        provider.removeListener("contextAccountsChanged", handleContextAccountsChanged);
      }
    };
  }, [provider, initializationError, updateConnectedStatus]);


  const contextValue = useMemo(
    () => ({
      provider,
      walletClient,
      publicClient,
      chainId,
      accounts,
      contextAccounts,
      walletConnected,
      isConnecting: false,
      initializationError,
      fetchStateError,
      hasCriticalError,
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