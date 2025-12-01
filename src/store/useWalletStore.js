// src/store/useWalletStore.js
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { createClientUPProvider } from "@lukso/up-provider";
import { createWalletClient, createPublicClient, custom, http, numberToHex, getAddress, isAddress } from "viem";
import { lukso, luksoTestnet } from "viem/chains";
import { ERC725 } from '@erc725/erc725.js';
import lsp3ProfileSchema from '@erc725/erc725.js/schemas/LSP3ProfileMetadata.json';
import { RADAR_OFFICIAL_ADMIN_ADDRESS, IPFS_GATEWAY } from '../config/global-config';

// --- CONFIG & HELPERS ---

const LUKSO_MAINNET_RPC = import.meta.env.VITE_LUKSO_MAINNET_RPC_URL || "https://rpc.mainnet.lukso.network";
const LUKSO_TESTNET_RPC = import.meta.env.VITE_LUKSO_TESTNET_RPC_URL || "https://rpc.testnet.lukso.network";

const normalizeChainId = (chainId) => {
  if (chainId === null || chainId === undefined) return null;
  if (typeof chainId === "number") return numberToHex(chainId);
  if (typeof chainId === "string") {
    const lower = chainId.toLowerCase().trim();
    if (/^0x[0-9a-f]+$/.test(lower)) return lower;
    try {
      const num = parseInt(lower, 10);
      if (!isNaN(num) && num >= 0) return numberToHex(num);
    } catch (_) {}
    if (/^[0-9a-f]+$/.test(lower)) return `0x${lower}`;
  }
  return null;
};

const VIEM_CHAINS = {
  [normalizeChainId(lukso.id)]: lukso,
  [normalizeChainId(luksoTestnet.id)]: luksoTestnet,
};

const RPC_URLS = {
  [normalizeChainId(lukso.id)]: LUKSO_MAINNET_RPC,
  [normalizeChainId(luksoTestnet.id)]: LUKSO_TESTNET_RPC,
};

export const useWalletStore = create(
  subscribeWithSelector(devtools((set, get) => ({
    // =========================================
    // 1. STATE
    // =========================================
    
    provider: null, // Raw UP Provider
    walletClient: null,
    publicClient: null,
    
    chainId: null,
    accounts: [], // Connected EOA accounts
    contextAccounts: [], // Profile currently being viewed (UP)
    
    // Derived Session State
    hostProfileAddress: null, // The UP address being viewed
    loggedInUserUPAddress: null, // The authenticated user's UP address (if they are the owner)
    
    // Flags
    isWalletConnected: false,
    isHostProfileOwner: false,
    isRadarProjectAdmin: false,
    isPreviewMode: false,
    
    // Errors
    initializationError: null,
    fetchStateError: null,

    // =========================================
    // 2. ACTIONS
    // =========================================

    initWallet: async () => {
      let upProviderInstance = null;
      
      // 1. Initialize Provider
      if (typeof window !== "undefined" && typeof window.ethereum !== "undefined") {
        try {
          upProviderInstance = createClientUPProvider();
          set({ provider: upProviderInstance });
        } catch (error) {
          console.error("[WalletStore] UP Provider Init Error:", error);
          set({ initializationError: error });
          return;
        }
      } else {
        set({ initializationError: new Error("Universal Profile Extension not detected.") });
        return;
      }

      const provider = upProviderInstance;

      // 2. Define Event Handlers
      const handleAccountsChanged = (rawAccounts) => {
        const newAccs = (rawAccounts || []).map(a => getAddress(a));
        set({ accounts: newAccs });
        get()._updateConnectionStatus();
      };

      const handleChainChanged = (rawChainId) => {
        const normalized = normalizeChainId(rawChainId);
        const isValid = !!normalized && !!VIEM_CHAINS[normalized];
        
        set({ chainId: isValid ? normalized : null });
        if (!isValid) set({ accounts: [], contextAccounts: [] });
        
        get()._recreateClients(); // Recreate public client for new chain
        get()._updateConnectionStatus();
      };

      const handleContextAccountsChanged = (rawContext) => {
        const newContext = (rawContext || []).map(a => getAddress(a));
        set({ contextAccounts: newContext });
        get()._updateConnectionStatus();
      };

      // 3. Attach Listeners
      provider.on("accountsChanged", handleAccountsChanged);
      provider.on("chainChanged", handleChainChanged);
      provider.on("contextAccountsChanged", handleContextAccountsChanged);

      // 4. Fetch Initial Data
      try {
        const [initialAccounts, initialChainId] = await Promise.all([
          provider.request({ method: "eth_accounts" }),
          provider.request({ method: "eth_chainId" })
        ]);

        const normalizedChainId = normalizeChainId(initialChainId);
        const isValidChain = !!normalizedChainId && !!VIEM_CHAINS[normalizedChainId];

        set({
          accounts: (initialAccounts || []).map(a => getAddress(a)),
          contextAccounts: (provider.contextAccounts || []).map(a => getAddress(a)),
          chainId: isValidChain ? normalizedChainId : null
        });

        get()._recreateClients();
        get()._updateConnectionStatus();

      } catch (err) {
        console.error("[WalletStore] Initial Fetch Error:", err);
      }
    },

    togglePreviewMode: () => set(state => ({ isPreviewMode: !state.isPreviewMode })),

    // =========================================
    // 3. INTERNAL HELPERS
    // =========================================

    _recreateClients: () => {
      const { provider, chainId, accounts, initializationError } = get();
      if (!chainId || !VIEM_CHAINS[chainId]) return;

      const currentChain = VIEM_CHAINS[chainId];
      const rpcUrl = RPC_URLS[chainId];

      // Public Client
      try {
        const publicClient = createPublicClient({
          chain: currentChain,
          // --- UPDATED TRANSPORT CONFIG FOR STABILITY ---
          transport: http(rpcUrl, { 
            timeout: 30_000,   // Increase timeout to 30s to handle slow batch responses
            retryCount: 3,     // Keep retries
            retryDelay: 2000,  // Wait 2s between retries (crucial for 429 errors)
            batch: { wait: 50 } // Small wait to allow auto-batching of simple calls
          })
        });
        set({ publicClient, fetchStateError: null });
      } catch (err) {
        set({ fetchStateError: err, publicClient: null });
      }

      // Wallet Client
      if (!initializationError && provider && accounts.length > 0) {
        try {
          const walletClient = createWalletClient({
            chain: currentChain,
            transport: custom(provider),
            account: accounts[0]
          });
          set({ walletClient });
        } catch (err) {
          set({ fetchStateError: err, walletClient: null });
        }
      } else {
        set({ walletClient: null });
      }
    },

    _updateConnectionStatus: async () => {
      const { chainId, accounts, contextAccounts, publicClient } = get();
      const isConnected = !!chainId && accounts.length > 0 && contextAccounts.length > 0;
      
      const hostProfileAddress = (contextAccounts && contextAccounts.length > 0) 
        ? contextAccounts[0] 
        : null;

      set({ 
        isWalletConnected: isConnected,
        hostProfileAddress 
      });

      // Trigger Permission Check
      await get()._checkPermissions();
    },

    _checkPermissions: async () => {
      const { accounts, hostProfileAddress, publicClient } = get();
      const controllerAddress = accounts[0];

      if (!controllerAddress || !hostProfileAddress || !publicClient) {
        set({ 
          isHostProfileOwner: false, 
          isRadarProjectAdmin: false, 
          loggedInUserUPAddress: null 
        });
        return;
      }

      let isOwner = false;

      // 1. Direct Equality Check
      if (controllerAddress.toLowerCase() === hostProfileAddress.toLowerCase()) {
        isOwner = true;
      } else {
        // 2. ERC725 Permissions Check
        try {
          const erc725 = new ERC725(
            lsp3ProfileSchema, 
            hostProfileAddress, 
            publicClient.transport.url, 
            { ipfsGateway: IPFS_GATEWAY }
          );
          const permissions = await erc725.getPermissions(controllerAddress);
          // Check for SUPER_SETDATA permission
          if (typeof permissions === 'string') {
             // Basic check if full permissions are needed, but usually we rely on the decode
             const decoded = ERC725.decodePermissions(permissions);
             isOwner = decoded.SUPER_SETDATA;
          } else if (typeof permissions === 'object') {
             // Handle if erc725 returns object directly
             isOwner = permissions.SUPER_SETDATA;
          }
        } catch (e) {
          isOwner = false;
        }
      }

      // 3. Admin Check
      let isAdmin = false;
      if (isOwner && isAddress(RADAR_OFFICIAL_ADMIN_ADDRESS)) {
        isAdmin = hostProfileAddress.toLowerCase() === RADAR_OFFICIAL_ADMIN_ADDRESS.toLowerCase();
      }

      set({ 
        isHostProfileOwner: isOwner, 
        isRadarProjectAdmin: isAdmin,
        loggedInUserUPAddress: isOwner ? hostProfileAddress : null
      });
    }

  })))
);