// src/hooks/useAnimationLifecycleManager.js
import { useEffect, useRef } from 'react';

import { globalAnimationFlags } from "../utils/globalAnimationFlags"; // Local utility

const ANIMATION_RESTART_DELAY = 16; // ms

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
  animatingPanel, // Keep for logging, though not in core logic here
  isTransitioning,
  restartCanvasAnimations,
  stopCanvasAnimations,
}) {
  /** @type {React.RefObject<ReturnType<typeof setTimeout> | null>} */
  const animationStartTimerRef = useRef(null);
  /** @type {React.RefObject<'start' | 'stop' | null>} */
  const lastActionRef = useRef(null); // Tracks the last action taken by this hook

  useEffect(() => {
    const timestamp = performance.now();
    if (import.meta.env.DEV) {
        // Updated log to show last commanded action by this hook
        console.log(`[AnimLC ${timestamp.toFixed(0)}] EFFECT RUN. LastCmd: ${lastActionRef.current}, isTokenSelectorOpening: ${globalAnimationFlags.isTokenSelectorOpening}, IOVisible: ${isContainerObservedVisible}, BenignActive: ${isBenignOverlayActive}, AnimPanel: ${animatingPanel}, IsTransitioning: ${isTransitioning}, RenderState: ${renderState}`);
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
    if (globalAnimationFlags.isTokenSelectorOpening) {
      shouldRunAnimations = true;
      if (import.meta.env.DEV) console.log(`[AnimLC ${timestamp.toFixed(0)}] Condition Eval: RUN (GlobalFlag Override: isTokenSelectorOpening)`);
    } else if (isTransitioning) {
      shouldRunAnimations = true;
      if (import.meta.env.DEV) console.log(`[AnimLC ${timestamp.toFixed(0)}] Condition Eval: RUN (Preset Transition active)`);
    } else if (isBenignOverlayActive) {
      shouldRunAnimations = true;
      if (import.meta.env.DEV) console.log(`[AnimLC ${timestamp.toFixed(0)}] Condition Eval: RUN (Benign Overlay Active)`);
    } else {
      shouldRunAnimations = renderState === "rendered" && isContainerObservedVisible;
      if (import.meta.env.DEV) console.log(`[AnimLC ${timestamp.toFixed(0)}] Condition Eval: ${shouldRunAnimations ? "RUN" : "STOP"} (General: RenderState=${renderState}, IOVisible=${isContainerObservedVisible})`);
    }
    
    const isInFullscreen = !!document.fullscreenElement;
    // Logic to determine if animations should definitely stop:
    // They should stop if `shouldRunAnimations` is false AND we are not in fullscreen.
    const shouldStopLogic = !shouldRunAnimations && !isInFullscreen;

    if (shouldRunAnimations) {
      // If animations should run, but this hook's last command wasn't 'start'
      if (lastActionRef.current !== 'start') {
        if (import.meta.env.DEV) console.log(`[AnimLC ${timestamp.toFixed(0)}] Action: Scheduling RESTART (last cmd: ${lastActionRef.current})`);
        
        animationStartTimerRef.current = setTimeout(() => {
          // Re-check conditions inside timeout as state might have changed during the delay
          let currentShouldRunAgain;
          if (globalAnimationFlags.isTokenSelectorOpening) currentShouldRunAgain = true;
          else if (isTransitioning) currentShouldRunAgain = true;
          else if (isBenignOverlayActive) currentShouldRunAgain = true;
          else currentShouldRunAgain = renderState === "rendered" && isContainerObservedVisible;

          if (isMounted && currentShouldRunAgain) {
            if (import.meta.env.DEV) console.log(`[AnimLC ${performance.now().toFixed(0)}] setTimeout: EXECUTING RESTART (isMounted & currentShouldRunAgain).`);
            restartCanvasAnimations();
            lastActionRef.current = 'start'; // Update last action
          } else {
            if (import.meta.env.DEV) console.log(`[AnimLC ${performance.now().toFixed(0)}] setTimeout: Conditions changed, NOT RESTARTING (isMounted=${isMounted}, currentShouldRunAgain=${currentShouldRunAgain}). Last cmd remains: ${lastActionRef.current}`);
          }
          animationStartTimerRef.current = null; // Clear ref after execution or if not run
        }, ANIMATION_RESTART_DELAY);
      } else {
          // Animations should run and last command was 'start', so do nothing.
          if (import.meta.env.DEV) console.log(`[AnimLC ${timestamp.toFixed(0)}] No Action: Conditions indicate RUN, and last command was 'start'.`);
      }
    } else if (shouldStopLogic) {
      // If animations should stop, but this hook's last command wasn't 'stop'
      if (lastActionRef.current !== 'stop') {
        if (import.meta.env.DEV) console.log(`[AnimLC ${timestamp.toFixed(0)}] Action: EXECUTING STOP (last cmd: ${lastActionRef.current})`);
        stopCanvasAnimations();
        lastActionRef.current = 'stop'; // Update last action
      } else {
        // Animations should stop and last command was 'stop', so do nothing.
        if (import.meta.env.DEV) console.log(`[AnimLC ${timestamp.toFixed(0)}] No Action: Conditions indicate STOP, and last command was 'stop'.`);
      }
    } else {
        // This block covers cases where:
        // 1. `shouldRunAnimations` is false, BUT `isInFullscreen` is true (so `shouldStopLogic` is false).
        //    In this case, we don't stop animations. `lastActionRef` remains what it was.
        //    If `lastActionRef` was 'start', animations continue (correct for fullscreen).
        //    If `lastActionRef` was 'stop' (e.g. from a previous non-fullscreen stop), and now it's fullscreen but conditions like IOVisible are false,
        //    it won't try to restart them here, which seems correct. The expectation is usually that fullscreen implies visible content.
        if (import.meta.env.DEV) {
            if (!shouldRunAnimations && isInFullscreen) {
                 console.log(`[AnimLC ${timestamp.toFixed(0)}] No Action: Conditions suggest STOP, but fullscreen is active. Last cmd: ${lastActionRef.current}. Animation continues if it was 'start'.`);
            } else {
                 // This case should ideally not be hit if logic is exhaustive.
                 // It might mean `shouldRunAnimations` is true, but `lastActionRef.current` was already 'start'. (Covered by specific log above)
                 // Or `shouldRunAnimations` is false, `isInFullscreen` is false (so `shouldStopLogic` is true), but `lastActionRef.current` was already 'stop'. (Covered by specific log above)
                 console.log(`[AnimLC ${timestamp.toFixed(0)}] No Action: Uncategorized state or conditions met current command. shouldRunAnimations: ${shouldRunAnimations}, shouldStopLogic: ${shouldStopLogic}, last cmd: ${lastActionRef.current}.`);
            }
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
    animatingPanel, // Kept for logging consistency, even if not in core decision logic
    isTransitioning,
    restartCanvasAnimations, stopCanvasAnimations,
    // lastActionRef is a ref, its changes don't re-trigger useEffect.
    // globalAnimationFlags is external, its changes don't re-trigger useEffect.
  ]);
}