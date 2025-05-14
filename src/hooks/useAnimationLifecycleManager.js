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
 * @param {object} params - Parameters for the animation lifecycle manager.
 * @param {boolean} params.isMounted - Indicates if the component consuming this hook is fully mounted.
 * @param {string} params.renderState - The current rendering state of the visual component (e.g., "rendered", "loading").
 * @param {boolean} params.isContainerObservedVisible - Flag indicating if the main visual container is visible, typically determined by an IntersectionObserver.
 * @param {boolean} params.isBenignOverlayActive - Flag indicating if a non-blocking overlay (e.g., toasts, temporary messages) is currently active, which might warrant continued animation.
 * @param {string | null} params.animatingPanel - Identifier of any UI panel that is currently undergoing an open/close animation. (Logged for debugging; not directly used in the core animation start/stop decision logic of this hook version).
 * @param {boolean} params.isAnimating - Current state flag indicating if canvas animations are actively running. This is usually managed by the consumer and read here.
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
  animatingPanel,
  isAnimating,
  isTransitioning,
  restartCanvasAnimations,
  stopCanvasAnimations,
}) {
  /** @type {React.RefObject<ReturnType<typeof setTimeout> | null>} */
  const animationStartTimerRef = useRef(null);

  useEffect(() => {
    // Log inputs at the start of the effect
    const timestamp = performance.now();
    if (import.meta.env.DEV) {
        console.log(`[AnimLC ${timestamp.toFixed(0)}] EFFECT RUN. isTokenSelectorOpening: ${globalAnimationFlags.isTokenSelectorOpening}, IOVisible: ${isContainerObservedVisible}, BenignActive: ${isBenignOverlayActive}, AnimPanel: ${animatingPanel}, IsAnimating: ${isAnimating}, IsTransitioning: ${isTransitioning}, RenderState: ${renderState}`);
    }

    // No Promise.resolve().then() here for now, to react more immediately.
    // We can add it back if this causes other issues.

    if (!isMounted || !restartCanvasAnimations || !stopCanvasAnimations) {
      if (import.meta.env.DEV) {
        console.log(`[AnimLC ${timestamp.toFixed(0)}] Aborting: Not mounted or animation functions missing.`);
      }
      return;
    }

    const animTimer = animationStartTimerRef.current;
    let shouldRunAnimations;

    // Decision logic for running animations
    if (globalAnimationFlags.isTokenSelectorOpening) {
      shouldRunAnimations = true;
      if (import.meta.env.DEV) {
        console.log(`[AnimLC ${timestamp.toFixed(0)}] Decision: RUN (GlobalFlag Override: isTokenSelectorOpening)`);
      }
    } else if (isTransitioning) {
      shouldRunAnimations = true;
      if (import.meta.env.DEV) {
        console.log(`[AnimLC ${timestamp.toFixed(0)}] Decision: RUN (Preset Transition active)`);
      }
    } else if (isBenignOverlayActive) {
      shouldRunAnimations = true;
      if (import.meta.env.DEV) {
        console.log(`[AnimLC ${timestamp.toFixed(0)}] Decision: RUN (Benign Overlay Active)`);
      }
    } else {
      shouldRunAnimations = renderState === "rendered" && isContainerObservedVisible;
      if (import.meta.env.DEV) {
        console.log(`[AnimLC ${timestamp.toFixed(0)}] Decision: ${shouldRunAnimations ? "RUN" : "MAYBE STOP"} (General: RenderState=${renderState}, IOVisible=${isContainerObservedVisible})`);
      }
    }
    
    // Decision logic for stopping animations (only if not in fullscreen)
    const shouldStopAnimations = !shouldRunAnimations && !document.fullscreenElement;
    if (import.meta.env.DEV) {
        if (shouldStopAnimations) { 
            console.log(`[AnimLC ${timestamp.toFixed(0)}] shouldStopAnimations evaluated to TRUE (animations should not run AND not fullscreen).`);
        } else if (!shouldRunAnimations && document.fullscreenElement) {
            console.log(`[AnimLC ${timestamp.toFixed(0)}] Animations should not run, but fullscreen is active, so NOT stopping.`);
        }
    }

    if (shouldRunAnimations && !isAnimating) {
      if (import.meta.env.DEV) {
        console.log(`[AnimLC ${timestamp.toFixed(0)}] Condition: shouldRun & !isAnimating -> Scheduling RESTART of animations.`);
      }
      if (animTimer) clearTimeout(animTimer);
      animationStartTimerRef.current = setTimeout(() => {
        // Re-check conditions before restarting, as state might have changed during the timeout
        let currentShouldRunAgain;
        if (globalAnimationFlags.isTokenSelectorOpening) {
          currentShouldRunAgain = true;
        } else if (isTransitioning) {
          currentShouldRunAgain = true;
        } else if (isBenignOverlayActive) {
          currentShouldRunAgain = true;
        } else {
          currentShouldRunAgain = renderState === "rendered" && isContainerObservedVisible;
        }

        if (isMounted && currentShouldRunAgain) {
          if (import.meta.env.DEV) {
            console.log(`[AnimLC ${performance.now().toFixed(0)}] setTimeout: RESTARTING animations (isMounted & currentShouldRunAgain).`);
          }
          restartCanvasAnimations();
        } else {
          if (import.meta.env.DEV) {
            console.log(`[AnimLC ${performance.now().toFixed(0)}] setTimeout: NOT RESTARTING (isMounted=${isMounted}, currentShouldRunAgain=${currentShouldRunAgain}). Conditions changed.`);
          }
        }
        animationStartTimerRef.current = null; 
      }, ANIMATION_RESTART_DELAY);
    } else if (shouldStopAnimations && isAnimating) {
      if (import.meta.env.DEV) {
        console.log(`[AnimLC ${timestamp.toFixed(0)}] Condition: shouldStop & isAnimating -> STOPPING animations.`);
      }
      stopCanvasAnimations();
      if (animTimer) { 
        clearTimeout(animTimer);
        animationStartTimerRef.current = null;
      }
    } else {
        // Log why no action was taken, only in DEV
        if (import.meta.env.DEV) {
            if (!shouldRunAnimations && !isAnimating) {
                // This state is common when animations are correctly paused. Verbose log commented out.
                // console.log(`[AnimLC ${timestamp.toFixed(0)}] No Action: Animations should not run and are already not running.`);
            } else if (shouldRunAnimations && isAnimating) {
                // This state is common when animations are correctly running. Verbose log commented out.
                // console.log(`[AnimLC ${timestamp.toFixed(0)}] No Action: Animations should run and are already running.`);
            } else if (!shouldStopAnimations && isAnimating) { // e.g. shouldRunAnimations is false, but fullscreen is active OR shouldRunAnimations is true and isAnimating is true
                console.log(`[AnimLC ${timestamp.toFixed(0)}] No Action: Animations are running, and conditions do not warrant stopping (e.g., fullscreen is active, or they are meant to be running and are).`);
            } else if (shouldStopAnimations && !isAnimating) {
                 // This state is common. Verbose log commented out.
                 // console.log(`[AnimLC ${timestamp.toFixed(0)}] No Action: Animations should stop, and are already not running.`);
            } else {
                // Fallback log for unhandled "no action" cases.
                console.log(`[AnimLC ${timestamp.toFixed(0)}] No Action: Uncategorized state (shouldRunAnimations: ${shouldRunAnimations}, isAnimating: ${isAnimating}, shouldStopAnimations: ${shouldStopAnimations}).`);
            }
        }
    }

    return () => {
      if (animationStartTimerRef.current) {
        clearTimeout(animationStartTimerRef.current);
        animationStartTimerRef.current = null; 
      }
    };
  }, [
    isMounted, renderState, isContainerObservedVisible, isBenignOverlayActive,
    animatingPanel, 
    isAnimating, isTransitioning,
    restartCanvasAnimations, stopCanvasAnimations,
    // globalAnimationFlags is an external mutable object, its changes won't trigger this effect directly.
    // The effect re-reads its properties when other dependencies change.
  ]);
}