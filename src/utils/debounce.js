// src/utils/debounce.js

/**
 * Creates a debounced function that delays invoking `func` until `wait` ms have elapsed.
 * Includes a `flush()` method to execute any pending call immediately.
 *
 * @param {Function} func The function to debounce.
 * @param {number} wait The number of milliseconds to delay execution.
 * @returns {Function & { flush: () => void, cancel: () => void }}
 */
function debounce(func, wait) {
  let timeout = null;
  let args = null;
  let context = null;

  function executedFunction(...params) {
    context = this;
    args = params;

    const later = () => {
      timeout = null;
      if (args) {
        func.apply(context, args);
        context = args = null;
      }
    };

    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  }

  executedFunction.cancel = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
      context = args = null;
    }
  };

  executedFunction.flush = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
      if (args) {
        func.apply(context, args);
        context = args = null;
      }
    }
  };

  return executedFunction;
}

export default debounce;