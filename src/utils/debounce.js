/**
 * Creates a debounced function that delays invoking the provided function (`func`)
 * until `wait` milliseconds have elapsed since the last time the debounced function
 * was invoked. Useful for limiting the rate at which a function fires, e.g.,
 * on window resize or input events. The debounced function is invoked with the
 * arguments and `this` context of the last call.
 *
 * @param {Function} func The function to debounce.
 * @param {number} wait The number of milliseconds to delay execution.
 * @returns {Function} The new debounced function.
 */
function debounce(func, wait) {
  let timeout;

  return function executedFunction(...args) {
    const context = this;

    const later = () => {
      timeout = null; // Indicate debounce ended
      func.apply(context, args); // Execute original function
    };

    clearTimeout(timeout); // Clear previous timer
    timeout = setTimeout(later, wait); // Set new timer
  };
}

export default debounce;