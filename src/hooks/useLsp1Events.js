// src/hooks/useLsp1Events.js
import { useEffect, useRef } from 'react';
import LSP1EventService from '../services/LSP1EventService';
import { isAddress } from 'viem';

/**
 * HEARTBEAT_INTERVAL: 20 Minutes
 * Public RPC nodes often drop WebSocket connections if they remain idle.
 * This timer forces a service refresh to ensure we are always listening.
 */
const HEARTBEAT_INTERVAL = 1000 * 60 * 20; 

export function useLsp1Events(profileAddress, onEventReceived) {
  const eventServiceRef = useRef(null);
  const unsubscribeRef = useRef(() => {});
  const onEventReceivedRef = useRef(onEventReceived);

  // Keep the callback ref updated
  useEffect(() => {
    onEventReceivedRef.current = onEventReceived;
  }, [onEventReceived]);

  useEffect(() => {
    let isMounted = true;
    let heartbeatTimer = null;

    const initializeAndListen = async (address) => {
      // 1. Teardown existing instance
      if (eventServiceRef.current) {
        unsubscribeRef.current();
        eventServiceRef.current.cleanupListeners();
        eventServiceRef.current = null;
      }

      // 2. Create new Service instance
      const service = new LSP1EventService();
      eventServiceRef.current = service;

      try {
        await service.initialize();
        if (!isMounted) return;

        const success = await service.setupEventListeners(address);
        if (success && isMounted) {
          unsubscribeRef.current = service.onEvent((event) => {
            if (onEventReceivedRef.current) {
              onEventReceivedRef.current(event);
            }
          });
        }
      } catch (error) {
        if (import.meta.env.DEV) {
            console.error("[useLsp1Events] Failed to initialize/set up service:", error);
        }
      }
    };

    // 3. Execution Logic
    if (profileAddress && isAddress(profileAddress)) {
      initializeAndListen(profileAddress);

      // Start the heartbeat timer
      heartbeatTimer = setInterval(() => {
        if (isMounted && profileAddress) {
          if (import.meta.env.DEV) {
              console.log("[LSP1 Hook] Heartbeat: Rotating WebSocket connection to maintain health.");
          }
          initializeAndListen(profileAddress);
        }
      }, HEARTBEAT_INTERVAL);

    } else {
      // Address removed or invalid
      if (unsubscribeRef.current) unsubscribeRef.current();
      if (eventServiceRef.current) eventServiceRef.current.cleanupListeners();
    }

    // 4. Cleanup
    return () => {
      isMounted = false;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (unsubscribeRef.current) unsubscribeRef.current();
      if (eventServiceRef.current) eventServiceRef.current.cleanupListeners();
    };
  }, [profileAddress]);
}