/** Color for the canvas click ping effect. */
export const PING_COLOR = "var(--color-primary, #00FFCC)";

/** Stroke width for the canvas click ping effect circle. */
export const PING_STROKE_WIDTH = 1.5;

/** CSS selectors for elements that should NOT trigger the canvas click ping effect. */
export const NO_PING_SELECTORS = ['.ui-container', '.status-display', '.fps-counter'].join(', ');