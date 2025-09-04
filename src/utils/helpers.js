// src/utils/helpers.js

/**
 * Scales a normalized value (expected to be between 0 and 1) to a specified
 * minimum and maximum range using linear interpolation.
 * Handles potential non-numeric inputs gracefully by attempting to convert them
 * to numbers and returning the minimum of the range if any input is invalid.
 * The normalized input value is clamped to the [0, 1] range before scaling.
 *
 * @param {number|string} normalizedValue - The input value, ideally between 0 and 1.
 * @param {number|string} min - The minimum value of the target range.
 * @param {number|string} max - The maximum value of the target range.
 * @returns {number} The scaled value, clamped to be within the [min, max] range.
 *                   Returns `min` (or 0 if `min` is also NaN) if any input is non-numeric.
 */
export const scaleNormalizedValue = (normalizedValue, min, max) => {
  const norm = Number(normalizedValue);
  const minimum = Number(min);
  const maximum = Number(max);

  // Check for invalid inputs
  if (isNaN(norm) || isNaN(minimum) || isNaN(maximum)) {
    if (import.meta.env.DEV) {
      console.warn(`[scaleNormalizedValue] Invalid input: normalizedValue=${normalizedValue}, min=${min}, max=${max}. Returning minimum.`);
    }
    // Return the numerical minimum if valid, otherwise 0 as a fallback.
    return isNaN(minimum) ? 0 : minimum;
  }

  // Clamp the normalized value to the 0-1 range to ensure correct scaling
  const clampedNorm = Math.max(0, Math.min(1, norm));

  // Perform the linear interpolation: result = min + (normalized_clamped * (max - min))
  const scaledValue = minimum + clampedNorm * (maximum - minimum);

  // Ensure the final result is also clamped within the min/max of the target range,
  // especially if min > max was provided (though logically incorrect, this handles it).
  if (minimum <= maximum) {
    return Math.max(minimum, Math.min(maximum, scaledValue));
  } else {
    // If min > max, the range is inverted. Clamp accordingly.
    return Math.max(maximum, Math.min(minimum, scaledValue));
  }
};

/**
 * Performs linear interpolation between two values.
 *
 * @param {number} a - The starting value (when t=0).
 * @param {number} b - The ending value (when t=1).
 * @param {number} t - The interpolation factor, clamped between 0 and 1.
 * @returns {number} The interpolated value.
 */
export const lerp = (a, b, t) => {
  return a * (1 - t) + b * t;
};