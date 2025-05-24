// src/utils/helpers.test.js
import { describe, it, expect } from 'vitest';
import { scaleNormalizedValue } from './helpers';

describe('scaleNormalizedValue', () => {
  it('should correctly scale a value within the 0-1 range', () => {
    // Arrange
    const normalizedValue = 0.5;
    const min = 10;
    const max = 20;
    const expected = 15;

    // Act
    const result = scaleNormalizedValue(normalizedValue, min, max);

    // Assert
    expect(result).toBe(expected);
  });

  it('should clamp to min if normalizedValue is less than 0', () => {
    expect(scaleNormalizedValue(-0.5, 10, 20)).toBe(10);
  });

  it('should clamp to max if normalizedValue is greater than 1', () => {
    expect(scaleNormalizedValue(1.5, 10, 20)).toBe(20);
  });

  it('should handle min and max being the same', () => {
    expect(scaleNormalizedValue(0.5, 10, 10)).toBe(10);
  });

  it('should handle string inputs that are valid numbers', () => {
    expect(scaleNormalizedValue('0.25', '0', '100')).toBe(25);
  });

  it('should return min if inputs are NaN', () => {
    expect(scaleNormalizedValue('abc', 10, 20)).toBe(10);
    expect(scaleNormalizedValue(0.5, 'xyz', 20)).toBe(0); // min is NaN, defaults to 0
    expect(scaleNormalizedValue(0.5, 10, 'pqr')).toBe(10); // max is NaN, but min is valid
  });

  it('should handle inverted min/max range by clamping correctly', () => {
    expect(scaleNormalizedValue(0.5, 20, 10)).toBe(15); // Midpoint
    expect(scaleNormalizedValue(0, 20, 10)).toBe(20);   // Should be clamped to the "actual" min (which is 10 here)
    expect(scaleNormalizedValue(1, 20, 10)).toBe(10);   // Should be clamped to the "actual" max (which is 20 here)
  });
});