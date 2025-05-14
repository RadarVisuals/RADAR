// src/utils/debounce.js

/**
 * Creates a debounced function that delays invoking the provided function (`func`)
 * until `wait` milliseconds have elapsed since the last time the debounced function
 * was invoked. Useful for limiting the rate at which a function fires, e.g.,
 * on window resize or input events. The debounced function is invoked with the
 * arguments and `this` context of the last call.
 *
 * @param {Function} func The function to debounce.
 * @param {number} wait The number of milliseconds to delay execution.
 * @returns {(...args: any[]) => void} The new debounced function.
 */
function debounce(func, wait) {
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timeout = null;

  /**
   * The debounced version of the input function.
   * @param  {...any} args Arguments to pass to the original function.
   */
  return function executedFunction(...args) {
    // `this` context will be preserved from where `executedFunction` is called.
    const context = this;

    const later = () => {
      timeout = null; // Indicate debounce ended, allowing next call to set a new timeout
      func.apply(context, args); // Execute original function with preserved context and arguments
    };

    if (timeout !== null) {
      clearTimeout(timeout); // Clear previous timer if one was set
    }
    timeout = setTimeout(later, wait); // Set new timer
  };
}

export default debounce;