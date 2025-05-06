import { useState, useCallback } from "react"; // Removed unused useRef
import { ERC725 } from "@erc725/erc725.js";
import lsp3ProfileSchema from "@erc725/erc725.js/schemas/LSP3ProfileMetadata.json";
import { isAddress } from "viem";

// Configuration
const RPC_URL = import.meta.env.VITE_LUKSO_MAINNET_RPC_URL || "https://rpc.mainnet.lukso.network";
const IPFS_GATEWAY = import.meta.env.VITE_IPFS_GATEWAY || "https://api.universalprofile.cloud/ipfs/";

// In-memory Cache (shared across hook instances within the session)
const profileCacheStore = {};
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Debounce mechanism to prevent fetch storms
const fetchDebounceMap = new Map();
const DEBOUNCE_DELAY_MS = 300;

/**
 * @typedef {object} ProfileData The structure of cached or fetched profile data.
 * @property {string} name - The profile name (or a fallback like 'UP (0x...)').
 * @property {string | null} profileImage - The resolved URL for the profile image, or null.
 * @property {string | null} backgroundImage - The resolved URL for the background image, or null.
 */

/**
 * @typedef {object} ProfileCacheResult The return value of the useProfileCache hook.
 * @property {(address: string | null) => Promise<ProfileData | null>} getProfileData - Fetches profile data, utilizing cache and debounce. Returns null on invalid address or error during fetch setup. Returns ProfileData object (potentially with error state name) on success or cached error.
 * @property {(address: string | null) => ProfileData | null} getCachedProfile - Synchronously retrieves profile data from cache if valid and not expired, otherwise null.
 * @property {string | null} isLoadingAddress - The address currently being fetched by this specific hook instance, or null if not loading.
 */

/**
 * Provides functions to fetch and cache LSP3 Profile data (name, images) for Lukso Universal Profiles.
 * It uses an in-memory cache with expiration and debounces requests for the same address
 * made in quick succession. It leverages erc725.js for efficient data fetching and decoding.
 *
 * @returns {ProfileCacheResult} An object containing functions to get profile data and the loading status.
 */
export function useProfileCache() {
  // State to track loading status for THIS hook instance
  const [isLoadingAddress, setIsLoadingAddress] = useState(null);

  // The refreshCacheState mechanism using cacheVersion was removed as it was unused
  // and didn't effectively trigger re-renders in consumers.
  // Re-renders happen naturally when the results of getProfileData/getCachedProfile change.

  /**
   * Fetches LSP3 Profile data for an address, checking cache first and debouncing requests.
   * Returns cached data immediately if valid. Otherwise, initiates a debounced fetch.
   * Handles VerifiableURI decoding and IPFS resolution via erc725.js.
   *
   * @param {string | null} address The Universal Profile address to fetch data for.
   * @returns {Promise<ProfileData | null>} A promise resolving to the profile data or null/error object.
   */
  const getProfileData = useCallback(
    async (address) => {
      if (!address || typeof address !== "string" || !isAddress(address)) {
        // Keep this warning - indicates bad input to the hook user
        console.warn(`[ProfileCache] Invalid address provided: ${address}`);
        return null;
      }
      const lowerAddress = address.toLowerCase();

      const now = Date.now();
      const cachedEntry = profileCacheStore[lowerAddress];

      // Return valid cache entry immediately
      if (cachedEntry && !cachedEntry.error && now - cachedEntry.timestamp < CACHE_DURATION_MS) {
        return cachedEntry.data;
      }
      // Return cached error state immediately
      if (cachedEntry?.error) {
        return cachedEntry.data;
      }

      // Debounce logic
      if (fetchDebounceMap.has(lowerAddress)) {
        return cachedEntry?.data || { name: "Loading...", profileImage: null, backgroundImage: null };
      }
      const timerId = setTimeout(() => { fetchDebounceMap.delete(lowerAddress); }, DEBOUNCE_DELAY_MS);
      fetchDebounceMap.set(lowerAddress, timerId);

      setIsLoadingAddress(lowerAddress);

      try {
        const erc725Instance = new ERC725(lsp3ProfileSchema, lowerAddress, RPC_URL, { ipfsGateway: IPFS_GATEWAY });
        const fetchedData = await erc725Instance.fetchData("LSP3Profile");

        if (fetchedData?.value?.LSP3Profile) {
          const profile = fetchedData.value.LSP3Profile;
          const defaultName = `UP (${lowerAddress.slice(0, 6)}...)`;
          const name = profile.name?.trim() ? profile.name.trim() : defaultName;

          const getImageUrl = (images) => {
            if (!Array.isArray(images) || images.length === 0) return null;
            const url = images[0]?.url;
            if (!url || typeof url !== "string") return null;
            if (url.startsWith("ipfs://")) {
              const hash = url.slice(7);
              const gateway = IPFS_GATEWAY.endsWith("/") ? IPFS_GATEWAY : IPFS_GATEWAY + "/";
              return `${gateway}${hash}`;
            }
            if (url.startsWith("http://") || url.startsWith("https://")) return url;
            console.warn(`[ProfileCache] Unknown image URL format: ${url}`); // Keep warning for unexpected formats
            return null;
          };

          const profileImageUrl = getImageUrl(profile.profileImage);
          const backgroundImageUrl = getImageUrl(profile.backgroundImage);

          const profileResult = { name, profileImage: profileImageUrl, backgroundImage: backgroundImageUrl };

          profileCacheStore[lowerAddress] = { data: profileResult, error: false, timestamp: Date.now() };
          // refreshCacheState(); // Removed call to unused function

          return profileResult;

        } else {
          // Keep warning for potentially valid key but invalid content
          console.warn(`[ProfileCache] LSP3Profile data key found but content invalid for ${lowerAddress}.`);
          throw new Error("LSP3Profile data key found but content invalid.");
        }
      } catch (error) {
        // Keep error log for fetch/processing failures
        console.error(`[ProfileCache] Error fetching profile data for ${lowerAddress}:`, error);
        const errorResult = { name: `Error (${lowerAddress.slice(0, 6)})`, profileImage: null, backgroundImage: null };
        profileCacheStore[lowerAddress] = { data: errorResult, error: true, timestamp: Date.now() };
        // refreshCacheState(); // Removed call to unused function
        return errorResult;
      } finally {
        clearTimeout(fetchDebounceMap.get(lowerAddress));
        fetchDebounceMap.delete(lowerAddress);
        // Clear loading state *only if* this instance was the one loading THIS address
        if (isLoadingAddress === lowerAddress) {
             setIsLoadingAddress(null);
        }
      }
    },
    [isLoadingAddress], // Removed refreshCacheState dependency
  );

  /**
   * Synchronously retrieves profile data from the cache if available and not expired.
   * Does NOT trigger a network fetch.
   * @param {string | null} address The Universal Profile address to check in the cache.
   * @returns {ProfileData | null} The cached profile data object, or null if not found/expired/invalid.
   */
  const getCachedProfile = useCallback((address) => {
    if (!address || typeof address !== "string" || !isAddress(address)) return null;
    const lowerAddress = address.toLowerCase();
    const cachedEntry = profileCacheStore[lowerAddress];
    if (cachedEntry && !cachedEntry.error && Date.now() - cachedEntry.timestamp < CACHE_DURATION_MS) {
      return cachedEntry.data;
    }
    return null;
  }, []);

  return { getProfileData, getCachedProfile, isLoadingAddress };
}