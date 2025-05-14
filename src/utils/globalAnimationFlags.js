// src/utils/globalAnimationFlags.js

/**
 * @file Holds global flags that can be imperatively set to influence animation decisions.
 * Use with extreme caution and only for critical and very hard-to-solve race conditions
 * that are caused, in this case, by an initial image loading burst or similar complex UI interactions
 * where declarative state flow is insufficient or overly complex to manage.
 *
 * These flags are intended as a last resort. Prefer managing animation states through
 * React's declarative state and props model whenever possible.
 */

/**
 * @typedef {object} GlobalAnimationFlags
 * @property {boolean} isTokenSelectorOpening - Set to `true` when the token selector UI component
 * is in the process of opening or is open. This can be used by animation managers
 * (e.g., `useAnimationLifecycleManager`) to ensure animations continue or restart
 * if they were paused due to other conditions (like visibility changes) that might
 * incorrectly stop animations needed for the token selector's presentation.
 * Should be reset to `false` when the token selector is closed or its opening animation completes.
 */

/**
 * Global animation flags.
 * @type {GlobalAnimationFlags}
 */
export const globalAnimationFlags = {
  isTokenSelectorOpening: false,
};