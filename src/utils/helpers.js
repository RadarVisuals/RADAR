/**
 * Scales a normalized value (0-1) to a specified min/max range.
 * Handles potential non-numeric inputs gracefully.
 *
 * @param {number|string} normalizedValue - The input value (0-1).
 * @param {number|string} min - The minimum value of the target range.
 * @param {number|string} max - The maximum value of the target range.
 * @returns {number} The scaled value, clamped within the range. Returns min on invalid input.
 */
export const scaleNormalizedValue = (normalizedValue, min, max) => {
  const norm = Number(normalizedValue);
  const minimum = Number(min);
  const maximum = Number(max);

  // Check for invalid inputs
  if (isNaN(norm) || isNaN(minimum) || isNaN(maximum)) {
    console.warn(`[scaleNormalizedValue] Invalid input: n=${normalizedValue}, min=${min}, max=${max}. Returning minimum.`);
    // Return minimum if any input is NaN, or default to 0 if minimum is also NaN
    return isNaN(minimum) ? 0 : minimum;
  }

  // Clamp the normalized value to the 0-1 range
  const clampedNorm = Math.max(0, Math.min(1, norm));

  // Perform the linear interpolation
  return minimum + clampedNorm * (maximum - minimum);
};
