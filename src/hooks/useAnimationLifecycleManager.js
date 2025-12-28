// src/hooks/useAnimationLifecycleManager.js
import { useEffect, useRef } from 'react';

import { globalAnimationFlags } from "../utils/globalAnimationFlags"; // Local utility

const ANIMATION_RESTART_DELAY = 16; // ms
const TRANSITION_GRACE_PERIOD = 1000; // 1 second of immunity from stopping

/**
 * Manages the lifecycle of canvas animations based on component mount state,
 * visibility, UI interactions (panels, overlays), and explicit transition states.
 * It decides when to start or stop animations to optimize performance and ensure
 * visual correctness during UI changes or when the canvas is not visible.
 * Uses a small delay before restarting animations to allow UI to settle.
 *
 * This version uses an internal ref (`lastActionRef`) to track its last commanded
 * state (start/stop), making its decision to issue a new command more robust
 * independently of an external `isAnimating` prop that might not be perfectly in sync.
 *
 * @param {object} params - Parameters for the animation lifecycle manager.
 * @param {boolean} params.isMounted - Indicates if the component consuming this hook is fully mounted.
 * @param {string} params.renderState - The current rendering state of the visual component (e.g., "rendered", "loading").
 * @param {boolean} params.isContainerObservedVisible - Flag indicating if the main visual container is visible, typically determined by an IntersectionObserver.
 * @param {boolean} params.isBenignOverlayActive - Flag indicating if a non-blocking overlay (e.g., toasts, temporary messages) is currently active, which might warrant continued animation.
 * @param {boolean} params.isMappingActive - Flag indicating if Video Mapping mode is active. If true, animation MUST run regardless of visibility observers (as projection might happen on a second screen or obscured window).
 * @param {string | null} params.animatingPanel - Identifier of any UI panel that is currently undergoing an open/close animation. (Logged for debugging; not directly used in the core animation start/stop decision logic of this hook version).
 * @param {boolean} params.isTransitioning - Flag indicating if a visual preset transition or an initial load animation sequence is active. Animations should generally run during transitions.
 * @param {() => void} params.restartCanvasAnimations - Callback function to be invoked when animations should (re)start.
 * @param {() => void} params.stopCanvasAnimations - Callback function to be invoked when animations should stop.
 * @returns {void} This hook does not return a value but manages side effects.
 */
export function useAnimationLifecycleManager({
  isMounted,
  renderState,
  isContainerObservedVisible,
  isBenignOverlayActive,
  isMappingActive,
  animatingPanel,
  isTransitioning,
  restartCanvasAnimations,
  stopCanvasAnimations,
}) {
  /** @type {React.RefObject<ReturnType<typeof setTimeout> | null>} */
  const animationStartTimerRef = useRef(null);
  /** @type {React.RefObject<'start' | 'stop' | null>} */
  const lastActionRef = useRef(null); // Tracks the last action taken by this hook
  
  // Track the last time a critical state changed to provide immunity
  const lastCriticalStateChangeRef = useRef(performance.now());

  // Reset immunity timer when critical states change
  useEffect(() => {
      lastCriticalStateChangeRef.current = performance.now();
  }, [isMappingActive, isTransitioning, renderState]);

  useEffect(() => {
    const timestamp = performance.now();
    const timeSinceCriticalChange = timestamp - lastCriticalStateChangeRef.current;
    const isInGracePeriod = timeSinceCriticalChange < TRANSITION_GRACE_PERIOD;

    if (import.meta.env.DEV) {
        // Updated log to show last commanded action by this hook
        console.log(`[AnimLC ${timestamp.toFixed(0)}] EFFECT RUN. LastCmd: ${lastActionRef.current}, Mapping: ${isMappingActive}, GracePeriod: ${isInGracePeriod}, IOVisible: ${isContainerObservedVisible}, RenderState: ${renderState}`);
    }

    if (!isMounted || !restartCanvasAnimations || !stopCanvasAnimations) {
      if (import.meta.env.DEV) {
        console.log(`[AnimLC ${timestamp.toFixed(0)}] Aborting: Not mounted or animation functions missing.`);
      }
      return;
    }

    // Clear any pending restart timeout from a previous run of this effect
    if (animationStartTimerRef.current) {
      clearTimeout(animationStartTimerRef.current);
      animationStartTimerRef.current = null;
    }

    let shouldRunAnimations;
    // Determine if animations should be running based on current state
    if (isMappingActive) {
      shouldRunAnimations = true; // Always run in mapping
      if (import.meta.env.DEV) console.log(`[AnimLC] Condition Eval: RUN (Mapping Mode Active)`);
    } else if (globalAnimationFlags.isTokenSelectorOpening) {
      shouldRunAnimations = true;
      if (import.meta.env.DEV) console.log(`[AnimLC] Condition Eval: RUN (GlobalFlag Override: isTokenSelectorOpening)`);
    } else if (isTransitioning) {
      shouldRunAnimations = true;
      if (import.meta.env.DEV) console.log(`[AnimLC] Condition Eval: RUN (Preset Transition active)`);
    } else if (isBenignOverlayActive) {
      shouldRunAnimations = true;
      if (import.meta.env.DEV) console.log(`[AnimLC] Condition Eval: RUN (Benign Overlay Active)`);
    } else {
      shouldRunAnimations = renderState === "rendered" && isContainerObservedVisible;
      if (import.meta.env.DEV && !shouldRunAnimations) {
          console.log(`[AnimLC] Condition Eval: STOP (General: RenderState=${renderState}, IOVisible=${isContainerObservedVisible})`);
      }
    }
    
    const isInFullscreen = !!document.fullscreenElement;
    
    // Logic to determine if animations should definitely stop:
    // They should stop if `shouldRunAnimations` is false AND we are not in fullscreen AND not in grace period.
    const shouldStopLogic = !shouldRunAnimations && !isInFullscreen && !isInGracePeriod;

    if (shouldRunAnimations) {
      // If animations should run, but this hook's last command wasn't 'start'
      if (lastActionRef.current !== 'start') {
        if (import.meta.env.DEV) console.log(`[AnimLC ${timestamp.toFixed(0)}] Action: Scheduling RESTART (last cmd: ${lastActionRef.current})`);
        
        animationStartTimerRef.current = setTimeout(() => {
          // Re-check conditions inside timeout as state might have changed during the delay
          let currentShouldRunAgain = false;
          if (isMappingActive) currentShouldRunAgain = true;
          else if (globalAnimationFlags.isTokenSelectorOpening) currentShouldRunAgain = true;
          else if (isTransitioning) currentShouldRunAgain = true;
          else if (isBenignOverlayActive) currentShouldRunAgain = true;
          else currentShouldRunAgain = renderState === "rendered" && isContainerObservedVisible;

          if (isMounted && currentShouldRunAgain) {
            if (import.meta.env.DEV) console.log(`[AnimLC ${performance.now().toFixed(0)}] setTimeout: EXECUTING RESTART (isMounted & currentShouldRunAgain).`);
            restartCanvasAnimations();
            lastActionRef.current = 'start'; // Update last action
          } else {
            if (import.meta.env.DEV) console.log(`[AnimLC ${performance.now().toFixed(0)}] setTimeout: Conditions changed, NOT RESTARTING. Last cmd remains: ${lastActionRef.current}`);
          }
          animationStartTimerRef.current = null; // Clear ref after execution or if not run
        }, ANIMATION_RESTART_DELAY);
      }
    } else if (shouldStopLogic) {
      // If animations should stop, but this hook's last command wasn't 'stop'
      if (lastActionRef.current !== 'stop') {
        if (import.meta.env.DEV) console.log(`[AnimLC ${timestamp.toFixed(0)}] Action: EXECUTING STOP (last cmd: ${lastActionRef.current})`);
        stopCanvasAnimations();
        lastActionRef.current = 'stop'; // Update last action
      }
    } else {
       // If we are here, it means we probably *should* stop, but Grace Period or Fullscreen is saving us.
       // Ensure we are running if we aren't already.
       if (lastActionRef.current !== 'start' && isInGracePeriod) {
           if (import.meta.env.DEV) console.log(`[AnimLC ${timestamp.toFixed(0)}] Grace Period Protection: Forcing Start.`);
           restartCanvasAnimations();
           lastActionRef.current = 'start';
       }
    }

    // Cleanup function for the useEffect
    return () => {
      if (animationStartTimerRef.current) {
        clearTimeout(animationStartTimerRef.current);
        animationStartTimerRef.current = null;
      }
    };
  }, [
    isMounted, renderState, isContainerObservedVisible, isBenignOverlayActive,
    isMappingActive,
    animatingPanel,
    isTransitioning,
    restartCanvasAnimations, stopCanvasAnimations,
  ]);
}