import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";
import { createClientUPProvider } from "@lukso/up-provider";
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  numberToHex,
} from "viem";
import { lukso, luksoTestnet } from "viem/chains";

// Helper to normalize chain IDs to hex strings
const normalizeChainId = (chainId) => {
  if (!chainId) return null;
  if (typeof chainId === "number") {
    return numberToHex(chainId);
  }
  if (typeof chainId === "string") {
    const lower = chainId.toLowerCase();
    if (/^0x[0-9a-f]+$/.test(lower)) return lower;
    try {
      const num = parseInt(lower, 10);
      if (!isNaN(num)) return numberToHex(num);
    // eslint-disable-next-line no-unused-vars
    } catch (_) { // Changed 'e' to '_'
      /* ignore */
    }
    if (/^[0-9a-f]+$/.test(lower)) return `0x${lower}`; // Handle hex without 0x prefix
  }
  console.warn("[UpProvider] Invalid chainId format:", chainId);
  return null;
};

// Supported chains configuration
const VIEM_CHAINS = {
  [normalizeChainId(lukso.id)]: lukso,
  [normalizeChainId(luksoTestnet.id)]: luksoTestnet,
};

// Load RPC URLs from environment variables with fallbacks
const LUKSO_MAINNET_RPC = import.meta.env.VITE_LUKSO_MAINNET_RPC_URL || "https://rpc.mainnet.lukso.network";
const LUKSO_TESTNET_RPC = import.meta.env.VITE_LUKSO_TESTNET_RPC_URL || "https://rpc.testnet.lukso.network";

const RPC_URLS = {
  [normalizeChainId(lukso.id)]: LUKSO_MAINNET_RPC,
  [normalizeChainId(luksoTestnet.id)]: LUKSO_TESTNET_RPC,
};

const SUPPORTED_CHAINS = {
  [normalizeChainId(lukso.id)]: VIEM_CHAINS[normalizeChainId(lukso.id)],
  [normalizeChainId(luksoTestnet.id)]: VIEM_CHAINS[normalizeChainId(luksoTestnet.id)],
};

// Context Definition
const UpContext = createContext(undefined);

// UP Provider Instance Creation (outside component to avoid recreation)
let upProviderInstance = null;
let upProviderInitializationError = null;
if (typeof window !== "undefined") {
  try {
    upProviderInstance = createClientUPProvider();
  } catch (error) {
    console.error("[UpProvider] CRITICAL: Error creating Client UP Provider instance:", error);
    upProviderInitializationError = error;
  }
}

/**
 * Hook to consume the UpContext.
 * Provides access to the UP Provider instance, Viem clients, connection state,
 * accounts (EOA and UP), chain ID, and errors.
 * Throws an error if used outside of an UpProvider.
 */
export function useUpProvider() {
  const context = useContext(UpContext);
  if (context === undefined) {
    throw new Error("useUpProvider must be used within an UpProvider");
  }
  return context;
}

/**
 * UpProvider: Manages the connection to the Universal Profile extension via
 * `@lukso/up-provider`. It initializes Viem public and wallet clients,
 * tracks connection status, accounts (EOA and UP context), chain ID,
 * and handles provider events.
 */
export function UpProvider({ children }) {
  const [provider] = useState(upProviderInstance);
  const [initializationError] = useState(upProviderInitializationError);
  const [chainId, setChainId] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [contextAccounts, setContextAccounts] = useState([]);
  const [walletConnected, setWalletConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [fetchStateError, setFetchStateError] = useState(null);

  // Derived State
  const hasCriticalError = useMemo(() => !!initializationError, [initializationError]);
  const currentChain = useMemo(() => chainId && SUPPORTED_CHAINS[chainId] ? SUPPORTED_CHAINS[chainId] : null, [chainId]);
  const connectedEOA = useMemo(() => (accounts?.length > 0 ? accounts[0] : null), [accounts]);

  // Viem Client Creation
  const publicClient = useMemo(() => {
    if (!currentChain) return null;
    try {
      const rpcUrl = RPC_URLS[chainId];
      if (!rpcUrl) throw new Error(`No configured RPC URL found for supported chain ${currentChain.name} (${chainId})`);
      const transport = http(rpcUrl, { retryCount: 3 });
      return createPublicClient({ chain: currentChain, transport: transport });
    } catch (error) {
      console.error("[UpProvider publicClient Memo] Error creating public client:", error);
      setFetchStateError(error);
      return null;
    }
  }, [currentChain, chainId]);

  const walletClient = useMemo(() => {
    if (hasCriticalError || !provider || !currentChain || !connectedEOA) return null;
    try {
      return createWalletClient({ chain: currentChain, transport: custom(provider), account: connectedEOA });
    } catch (error) {
      console.error("[UpProvider walletClient Memo] Error creating wallet client:", error);
      setFetchStateError(error);
      return null;
    }
  }, [provider, currentChain, connectedEOA, hasCriticalError]);

  // Effect for Initial State Fetch and Listeners
  useEffect(() => {
    if (initializationError) {
      console.error("[UpProvider Setup Effect] Skipped due to initialization error.");
      setIsConnecting(false);
      setWalletConnected(false);
      return;
    }
    if (!provider) {
      console.warn("[UpProvider Setup Effect] Skipped, Client UP Provider instance not available.");
      setIsConnecting(false);
      return;
    }

    const mountedRef = { current: true };
    let isFetching = false;

    const fetchFullState = async () => {
      if (!provider || !mountedRef.current || isFetching) return false;
      isFetching = true;
      setFetchStateError(null);
      let fetchedAccounts = []; let fetchedContextAccounts = []; let fetchedChainId = null;
      let isValidChain = false; let connected = false;

      try {
        const rawChainId = await provider.request({ method: "eth_chainId" });
        if (!mountedRef.current) { isFetching = false; return false; }

        fetchedChainId = normalizeChainId(rawChainId);
        isValidChain = !!fetchedChainId && fetchedChainId !== "0x0" && !!SUPPORTED_CHAINS[fetchedChainId];

        if (isValidChain) {
          const [_accounts, _contextAccounts] = await Promise.all([
            provider.request({ method: "eth_accounts" }).catch((e) => { console.error("[UpProvider fetchFullState] Acc fetch err:", e); return []; }),
            Promise.resolve(provider.contextAccounts || []),
          ]);
          if (!mountedRef.current) { isFetching = false; return false; }
          fetchedAccounts = _accounts || [];
          fetchedContextAccounts = _contextAccounts || [];
        } else {
          fetchedAccounts = []; fetchedContextAccounts = [];
        }

        connected = isValidChain && fetchedAccounts.length > 0 && fetchedContextAccounts.length > 0;

        if (mountedRef.current) {
          setChainId(fetchedChainId); setAccounts(fetchedAccounts);
          setContextAccounts(fetchedContextAccounts); setWalletConnected(connected);
        }
        isFetching = false; return true;
      } catch (error) {
        console.error("[UpProvider fetchFullState] Error:", error);
        if (mountedRef.current) {
          setChainId(null); setAccounts([]); setContextAccounts([]);
          setWalletConnected(false); setFetchStateError(error);
        }
        isFetching = false; return false;
      } finally {
        if (mountedRef.current) { setIsConnecting(false); }
      }
    };

    setIsConnecting(true);
    fetchFullState();

    // Event Handlers
    const handleAccountsChanged = (_accounts) => {
      if (!mountedRef.current) return;
      const newAccounts = _accounts || [];
      setAccounts(newAccounts);
      setWalletConnected(!!chainId && !!SUPPORTED_CHAINS[chainId] && newAccounts.length > 0 && contextAccounts.length > 0);
    };

    const handleChainChanged = (rawChainId) => {
      if (!mountedRef.current) return;
      const normalizedId = normalizeChainId(rawChainId);
      const isValidChain = !!normalizedId && normalizedId !== "0x0" && !!SUPPORTED_CHAINS[normalizedId];
      setFetchStateError(null);

      setChainId((currentId) => {
        const newChainIdValue = isValidChain ? normalizedId : null;
        if (isValidChain && currentId !== newChainIdValue) {
          setIsConnecting(true);
          queueMicrotask(fetchFullState);
          return newChainIdValue;
        } else if (!isValidChain && currentId !== null) {
          console.warn("[UpProvider] Chain invalid/unsupported, clearing accounts & connection state.");
          setAccounts([]); setContextAccounts([]); setWalletConnected(false);
          setIsConnecting(false); return null;
        } else {
          if (!isValidChain) setIsConnecting(false);
          return currentId;
        }
      });
    };

    const handleContextAccountsChanged = (_accounts) => {
      if (!mountedRef.current) return;
      const newContextAccounts = _accounts || [];
      setContextAccounts(newContextAccounts);
      setWalletConnected(!!chainId && !!SUPPORTED_CHAINS[chainId] && accounts.length > 0 && newContextAccounts.length > 0);
    };

    // Setup Listeners
    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);
    provider.on("contextAccountsChanged", handleContextAccountsChanged);

    // Cleanup
    return () => {
      mountedRef.current = false;
      if (provider?.removeListener) {
        provider.removeListener("accountsChanged", handleAccountsChanged);
        provider.removeListener("chainChanged", handleChainChanged);
        provider.removeListener("contextAccountsChanged", handleContextAccountsChanged);
      }
    };
  }, [provider, initializationError, chainId, accounts.length, contextAccounts.length]);

  // Memoized Context Value
  const contextValue = useMemo(
    () => ({
      provider, walletClient, publicClient, chainId, accounts, contextAccounts,
      walletConnected, isConnecting, initializationError, fetchStateError, hasCriticalError,
    }),
    [
      provider, walletClient, publicClient, chainId, accounts, contextAccounts,
      walletConnected, isConnecting, initializationError, fetchStateError, hasCriticalError,
    ],
  );

  return (
    <UpContext.Provider value={contextValue}>{children}</UpContext.Provider>
  );
}