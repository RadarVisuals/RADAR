// src/hooks/useLsp1Events.js
import { useEffect, useRef } from 'react';

import LSP1EventService from '../services/LSP1EventService'; // Local service

import { isAddress } from 'viem'; // Third-party library

/**
 * @typedef {object} Lsp1Event - Represents an event received from the LSP1EventService.
 * Structure depends on the specific event type.
 */

/**
 * Manages the lifecycle of an LSP1EventService instance, automatically
 * initializing, connecting, and cleaning up based on the provided profileAddress.
 * It subscribes to events from the service using the provided `onEventReceived`
 * callback, ensuring the callback reference is kept up-to-date without causing
 * unnecessary effect re-runs.
 *
 * @param {string | null} profileAddress - The address of the Universal Profile to listen to. The service will connect/disconnect as this address changes or becomes null/invalid.
 * @param {(event: Lsp1Event) => void} onEventReceived - Callback function executed when a new LSP1 event is received from the service.
 * @returns {void} This hook does not return a value but manages side effects.
 */
export function useLsp1Events(profileAddress, onEventReceived) {
  /** @type {React.RefObject<LSP1EventService | null>} */
  const eventServiceRef = useRef(null);
  /** @type {React.RefObject<() => void>} */
  const unsubscribeRef = useRef(() => {});
  /** @type {React.RefObject<(event: Lsp1Event) => void>} */
  const onEventReceivedRef = useRef(onEventReceived);

  // Keep the callback ref updated to avoid adding it to the main effect's dependencies
  useEffect(() => {
    onEventReceivedRef.current = onEventReceived;
  }, [onEventReceived]);

  // Effect to manage the service lifecycle based on profileAddress
  useEffect(() => {
    /** @type {boolean} - Tracks if the component is still mounted to prevent state updates on unmounted components. */
    let isMounted = true;

    const initializeAndListen = async (address) => {
      // Cleanup existing service before creating a new one
      if (eventServiceRef.current) {
        if (typeof unsubscribeRef.current === 'function') unsubscribeRef.current();
        eventServiceRef.current.cleanupListeners();
        eventServiceRef.current = null;
        unsubscribeRef.current = () => {};
      }

      const service = new LSP1EventService();
      eventServiceRef.current = service; // Store the instance immediately

      try {
        await service.initialize();
        if (!isMounted) {
          // Clean up the newly created service if unmounted during init
          service.cleanupListeners();
          eventServiceRef.current = null;
          return;
        }

        const success = await service.setupEventListeners(address);
        if (success && isMounted) {
          // Subscribe using the ref to the latest callback
          unsubscribeRef.current = service.onEvent((event) => {
            if (onEventReceivedRef.current) {
              onEventReceivedRef.current(event);
            }
          });
        } else if (!success && isMounted) {
          if (import.meta.env.DEV) {
            console.warn(`[useLsp1Events] Failed to set up listeners for ${address}.`);
          }
          service.cleanupListeners();
          eventServiceRef.current = null;
        } else if (!isMounted) {
           // Clean up if unmounted during listener setup
           service.cleanupListeners();
           eventServiceRef.current = null;
        }
      } catch (error) {
        if (import.meta.env.DEV) {
            console.error(`[useLsp1Events] Error initializing/setting up service for ${address}:`, error);
        }
        if (eventServiceRef.current) { // Check ref before cleanup
            eventServiceRef.current.cleanupListeners();
            eventServiceRef.current = null;
        }
        unsubscribeRef.current = () => {};
      }
    };

    const cleanupService = () => {
      if (typeof unsubscribeRef.current === 'function') {
        unsubscribeRef.current();
        unsubscribeRef.current = () => {};
      }
      if (eventServiceRef.current) {
        eventServiceRef.current.cleanupListeners();
        eventServiceRef.current = null;
      }
    };

    if (profileAddress && isAddress(profileAddress)) {
      initializeAndListen(profileAddress);
    } else {
      cleanupService();
    }

    // Cleanup function for when the hook unmounts or profileAddress changes
    return () => {
      isMounted = false;
      cleanupService();
    };
  }, [profileAddress]); // Only re-run when the profileAddress changes
}