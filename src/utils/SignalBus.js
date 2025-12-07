// src/utils/SignalBus.js

/**
 * A lightweight, dependency-free Event Emitter (Pub/Sub) singleton.
 * Used for high-frequency data (Audio, MIDI, Crossfader, Animation Frames)
 * to bypass the React Render Cycle and the DOM Event system.
 */
class SignalBus {
  constructor() {
    this.events = {};
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
   * Emit an event with data.
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
   * Clear all listeners (Useful for app reset/HMR)
   */
  clear() {
    this.events = {};
  }
}

// Export as a Singleton
const bus = new SignalBus();
export default bus;