// src/utils/SignalBus.js

/**
 * A lightweight, dependency-free Event Emitter (Pub/Sub) singleton.
 * Used for high-frequency data (Audio, MIDI, Crossfader, Animation Frames)
 * to bypass the React Render Cycle and the DOM Event system.
 */
class SignalBus {
  constructor() {
    this.events = {};
    // Cache for dirty checking to prevent redundant emissions
    this.lastState = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string} eventName - The name of the event (e.g., 'audio:analysis').
   * @param {Function} callback - The function to call when the event is emitted.
   * @returns {Function} - A cleanup function that removes this specific listener.
   */
  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = new Set();
    }
    this.events[eventName].add(callback);

    // Return unsubscriber for convenience
    return () => this.off(eventName, callback);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} eventName 
   * @param {Function} callback 
   */
  off(eventName, callback) {
    if (!this.events[eventName]) return;
    this.events[eventName].delete(callback);
    if (this.events[eventName].size === 0) {
      delete this.events[eventName];
    }
  }

  /**
   * Emit an event with data. Always fires.
   * @param {string} eventName 
   * @param {any} data 
   */
  emit(eventName, data) {
    if (!this.events[eventName]) return;
    this.events[eventName].forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`[SignalBus] Error in listener for '${eventName}':`, err);
      }
    });
  }

  /**
   * Only emit if the data is different from the last emission.
   * Best for primitive values (numbers, booleans, strings).
   * Do NOT use for Objects unless you want reference equality checking.
   * 
   * @param {string} eventName 
   * @param {any} data 
   */
  emitIfChanged(eventName, data) {
    const prev = this.lastState.get(eventName);
    
    // Strict equality check (fast)
    if (prev === data) return;
    
    // For floats, we might want a tiny epsilon check to avoid micro-jitters
    if (typeof data === 'number' && typeof prev === 'number') {
        if (Math.abs(data - prev) < 0.000001) return;
    }

    this.lastState.set(eventName, data);
    this.emit(eventName, data);
  }

  /**
   * Clear all listeners (Useful for app reset/HMR)
   */
  clear() {
    this.events = {};
    this.lastState.clear();
  }
}

// Export as a Singleton
const bus = new SignalBus();
export default bus;