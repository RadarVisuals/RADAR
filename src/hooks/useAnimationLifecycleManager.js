// src/hooks/useAnimationLifecycleManager.js
import { useEffect, useRef } from 'react';

const ANIMATION_RESTART_DELAY = 150;

/**
 * @typedef AnimationLifecycleOptions
 * @property {boolean} isMounted - Whether the parent component is mounted.
 * @property {string} renderState - The current state from useRenderLifecycle.
 * @property {boolean} isContainerObservedVisible - Visibility state from useCanvasContainer.
 * @property {boolean} isAnimating - Animation status from useRenderLifecycle.
 * @property {boolean} isTransitioning - Transition status from useRenderLifecycle.
 * @property {() => void | null} restartCanvasAnimations - Function to restart animations.
 * @property {() => void | null} stopCanvasAnimations - Function to stop animations.
 */

/**
 * Manages the lifecycle of canvas animations (starting and stopping) based on
 * component mount status, render state (e.g., 'rendered', 'error'),
 * container visibility, and fullscreen status. It uses the provided functions
 * `restartCanvasAnimations` and `stopCanvasAnimations` to control the animation loop.
 * Animations are generally stopped when the component isn't rendered or visible,
 * unless the application is in fullscreen mode or undergoing a visual transition.
 * A small delay is added before restarting animations to prevent flickering.
 *
 * @param {AnimationLifecycleOptions} options - An object containing dependencies and control functions.
 */
export function useAnimationLifecycleManager({
  isMounted,
  renderState,
  isContainerObservedVisible,
  isAnimating,
  isTransitioning,
  restartCanvasAnimations,
  stopCanvasAnimations,
}) {
  const animationStartTimerRef = useRef(null);

  useEffect(() => {
    if (!restartCanvasAnimations || !stopCanvasAnimations) {
      return;
    }

    const animTimer = animationStartTimerRef.current;
    const shouldBeAnimating = renderState === "rendered" && isContainerObservedVisible;

    if (shouldBeAnimating && !isAnimating) {
      if (animTimer) {
        clearTimeout(animTimer);
      }
      animationStartTimerRef.current = setTimeout(() => {
        if (isMounted && renderState === "rendered" && isContainerObservedVisible) {
          restartCanvasAnimations();
        }
        animationStartTimerRef.current = null;
      }, ANIMATION_RESTART_DELAY);
    } else if (!shouldBeAnimating && isAnimating) {
      const isFullScreen = !!document.fullscreenElement;

      if (!isTransitioning && !isFullScreen) {
        stopCanvasAnimations();
      }

      if (animTimer) {
        clearTimeout(animTimer);
        animationStartTimerRef.current = null;
      }
    }

    return () => {
      if (animationStartTimerRef.current) {
        clearTimeout(animationStartTimerRef.current);
        animationStartTimerRef.current = null;
      }
    };
  }, [
    isMounted,
    renderState,
    isContainerObservedVisible,
    isAnimating,
    isTransitioning,
    restartCanvasAnimations,
    stopCanvasAnimations,
  ]);
}