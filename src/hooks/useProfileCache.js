// src/hooks/useProfileCache.js
import { useState, useCallback, useMemo } from "react";
import { ERC725 } from "@erc725/erc725.js";
import lsp3ProfileSchema from "@erc725/erc725.js/schemas/LSP3ProfileMetadata.json";
import { isAddress } from "viem";
import { useUpProvider } from "../context/UpProvider"; // <-- IMPORT ADDED

// Configuration
const IPFS_GATEWAY = import.meta.env.VITE_IPFS_GATEWAY || "https://api.universalprofile.cloud/ipfs/";

// In-memory Cache (shared across hook instances within the session)
/** @type {Object.<string, {data: ProfileData, error: boolean, timestamp: number}>} */
const profileCacheStore = {};
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Debounce mechanism to prevent fetch storms
/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const fetchDebounceMap = new Map();
const DEBOUNCE_DELAY_MS = 300;

/**
 * @typedef {object} ProfileData The structure of cached or fetched profile data.
 * @property {string} name - The profile name (or a fallback like 'UP (0x...)', or an error indicator like 'Error (0x...)').
 * @property {string | null} profileImage - The resolved URL for the profile image, or null.
 * @property {string | null} backgroundImage - The resolved URL for the background image, or null.
 */

/**
 * @typedef {object} ProfileCacheResult The return value of the useProfileCache hook.
 * @property {(address: string | null) => Promise<ProfileData | null>} getProfileData - Asynchronously fetches profile data for a given address. It utilizes an in-memory cache with expiration and debounces requests for the same address. Returns `null` if the address is invalid or if an error occurs during the initial setup of the fetch. On successful fetch or cache hit, it returns a `ProfileData` object. If an error occurred during fetching or processing, the `name` property of `ProfileData` will indicate an error state (e.g., "Error (0x...)").
 * @property {(address: string | null) => ProfileData | null} getCachedProfile - Synchronously retrieves profile data from the cache if it's valid and not expired. Returns `null` if the address is invalid, or if the data is not in the cache, is expired, or represents a cached error state (use `getProfileData` to re-fetch errors).
 * @property {string | null} isLoadingAddress - The address currently being fetched by this specific hook instance, or `null` if no fetch is in progress for this instance.
 */

/**
 * Provides functions to fetch and cache LSP3 Profile data (name, images) for Lukso Universal Profiles.
 * It uses an in-memory cache with expiration and debounces requests for the same address
 * made in quick succession. It leverages erc725.js for efficient data fetching and decoding.
 *
 * @returns {ProfileCacheResult} An object containing functions to get profile data and the loading status.
 */
export function useProfileCache() {
  const { publicClient } = useUpProvider(); // <-- CLIENT FROM CONTEXT
  // State to track loading status for THIS hook instance
  const [isLoadingAddress, setIsLoadingAddress] = useState(null);

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
        if (import.meta.env.DEV) {
            console.warn(`[ProfileCache] Invalid address provided to getProfileData: ${address}`);
        }
        return null;
      }
      const lowerAddress = address.toLowerCase();

      const now = Date.now();
      const cachedEntry = profileCacheStore[lowerAddress];

      // Return valid, non-error cache entry immediately
      if (cachedEntry && !cachedEntry.error && now - cachedEntry.timestamp < CACHE_DURATION_MS) {
        return cachedEntry.data;
      }
      // Return cached error state immediately (allows UI to show error without re-fetching immediately)
      if (cachedEntry?.error) {
        // If error is stale, allow re-fetch by not returning here, otherwise return cached error.
        if (now - cachedEntry.timestamp < CACHE_DURATION_MS) {
            return cachedEntry.data;
        }
      }

      // Debounce logic
      if (fetchDebounceMap.has(lowerAddress)) {
        // If a fetch is already debounced for this address, return current cache or loading state
        return cachedEntry?.data || { name: "Loading...", profileImage: null, backgroundImage: null };
      }
      const timerId = setTimeout(() => { fetchDebounceMap.delete(lowerAddress); }, DEBOUNCE_DELAY_MS);
      fetchDebounceMap.set(lowerAddress, timerId);

      setIsLoadingAddress(lowerAddress);

      try {
        // Use the shared publicClient from the context instead of creating a new connection
        if (!publicClient) {
          throw new Error("Public client is not available.");
        }
        const erc725Instance = new ERC75(lsp3ProfileSchema, lowerAddress, publicClient.transport, { ipfsGateway: IPFS_GATEWAY });
        const fetchedData = await erc725Instance.fetchData("LSP3Profile");

        if (fetchedData?.value?.LSP3Profile) {
          const profile = fetchedData.value.LSP3Profile;
          const defaultName = `UP (${lowerAddress.slice(0, 6)}...)`;
          const name = profile.name?.trim() ? profile.name.trim() : defaultName;

          const getImageUrl = (images) => {
            if (!Array.isArray(images) || images.length === 0) return null;
            const url = images[0]?.url; // Assuming the first image is the primary one
            if (!url || typeof url !== "string") return null;

            if (url.startsWith("ipfs://")) {
              const hash = url.slice(7);
              const gateway = IPFS_GATEWAY.endsWith("/") ? IPFS_GATEWAY : IPFS_GATEWAY + "/";
              return `${gateway}${hash}`;
            }
            if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;

            if (import.meta.env.DEV) {
                console.warn(`[ProfileCache] Unknown image URL format for address ${lowerAddress}: ${url}`);
            }
            return null;
          };

          const profileImageUrl = getImageUrl(profile.profileImage);
          const backgroundImageUrl = getImageUrl(profile.backgroundImage);

          const profileResult = { name, profileImage: profileImageUrl, backgroundImage: backgroundImageUrl };

          profileCacheStore[lowerAddress] = { data: profileResult, error: false, timestamp: Date.now() };
          return profileResult;

        } else {
          if (import.meta.env.DEV) {
            console.warn(`[ProfileCache] LSP3Profile data key found but content invalid or missing for ${lowerAddress}. Fetched data:`, fetchedData);
          }
          // This case indicates that the LSP3Profile key might exist but doesn't contain the expected structure.
          throw new Error("LSP3Profile data key found but content invalid or missing.");
        }
      } catch (error) {
        if (import.meta.env.DEV) {
            console.error(`[ProfileCache] Error fetching or processing profile data for ${lowerAddress}:`, error);
        }
        const errorResult = { name: `Error (${lowerAddress.slice(0, 6)})`, profileImage: null, backgroundImage: null };
        profileCacheStore[lowerAddress] = { data: errorResult, error: true, timestamp: Date.now() };
        return errorResult;
      } finally {
        const currentTimerId = fetchDebounceMap.get(lowerAddress);
        if (currentTimerId === timerId) { // Ensure we only clear the timer we set
            clearTimeout(timerId);
            fetchDebounceMap.delete(lowerAddress);
        }
        // Clear loading state *only if* this instance was the one loading THIS address
        // and the address hasn't changed in the meantime by another call.
        if (isLoadingAddress === lowerAddress) {
             setIsLoadingAddress(null);
        }
      }
    },
    [isLoadingAddress, publicClient], // <-- DEPENDENCY ADDED
  );

  /**
   * Synchronously retrieves profile data from the cache if available, valid, and not an error state.
   * Does NOT trigger a network fetch.
   * @param {string | null} address The Universal Profile address to check in the cache.
   * @returns {ProfileData | null} The cached profile data object, or null if not found/expired/invalid/error.
   */
  const getCachedProfile = useCallback((address) => {
    if (!address || typeof address !== "string" || !isAddress(address)) return null;
    const lowerAddress = address.toLowerCase();
    const cachedEntry = profileCacheStore[lowerAddress];

    // Only return if cached, not an error, and not expired
    if (cachedEntry && !cachedEntry.error && Date.now() - cachedEntry.timestamp < CACHE_DURATION_MS) {
      return cachedEntry.data;
    }
    return null;
  }, []);

  return useMemo(() => ({
    getProfileData,
    getCachedProfile,
    isLoadingAddress
  }), [getProfileData, getCachedProfile, isLoadingAddress]);
}