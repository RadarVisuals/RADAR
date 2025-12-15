// src/utils/EventSignalGenerator.js
import { EVENT_TYPE_MAP } from "../config/global-config";

export class EventSignalGenerator {
    constructor() {
        this.signals = {};
        
        // Initialize signals for all known event types with 0.0
        Object.keys(EVENT_TYPE_MAP).forEach(key => {
            const signalKey = `event.${key}`; // e.g., 'event.lyx_received'
            this.signals[signalKey] = 0.0;
        });

        // Add a generic 'any' signal for catch-all reactions
        this.signals['event.any'] = 0.0;
        
        // Configuration for decay speed (higher = faster fade out)
        // 2.0 means it fades out fully in roughly 0.5 seconds
        this.decayRate = 2.0; 
    }

    /**
     * Trigger a signal spike for a specific event type
     * @param {string} eventType - The human readable event type (e.g., 'lyx_received')
     */
    trigger(eventType) {
        const key = `event.${eventType}`;
        
        // Spike specific signal
        if (this.signals.hasOwnProperty(key)) {
            this.signals[key] = 1.0;
        } else {
            // Register new signal on the fly if unknown
            this.signals[key] = 1.0;
        }

        // Spike generic signal
        this.signals['event.any'] = 1.0;
    }

    /**
     * Updates signal values based on time delta (decays them towards 0)
     * @param {number} deltaTime - Time in seconds since last frame
     * @returns {Object} The current state of all signals
     */
    update(deltaTime) {
        for (const key in this.signals) {
            if (this.signals[key] > 0.001) {
                // Linear decay
                this.signals[key] -= this.decayRate * deltaTime;
                if (this.signals[key] < 0) this.signals[key] = 0;
            } else {
                this.signals[key] = 0;
            }
        }
        return this.signals;
    }
}