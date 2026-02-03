// src/utils/pixi/RenderLoop.js
import SignalBus from '../SignalBus';

const FPS_REPORT_INTERVAL = 1000; // Report every 1000ms (1 second)

export class RenderLoop {
    constructor(app, systems) {
        this.app = app;
        
        // System References
        this.logic = systems.logic;
        this.audioReactor = systems.audioReactor;
        this.effectsManager = systems.effectsManager;
        this.layerManager = systems.layerManager;
        this.crossfaderSystem = systems.crossfaderSystem;
        this.feedbackSystem = systems.feedbackSystem;
        this.rootContainer = systems.rootContainer;

        // State
        this.isRunning = false;
        this.bootstrapped = false;
        
        // --- ADDED FPS TRACKING STATE ---
        this._frameCount = 0;
        this._lastTime = performance.now();
        // --- END ADDED FPS TRACKING STATE ---

        // Bind the loop function once to ensure 'this' context is correct
        this.tick = this.tick.bind(this);
    }

    start() {
        if (!this.isRunning && this.app && this.app.ticker) {
            this.app.ticker.add(this.tick);
            this.isRunning = true;
        }
    }

    stop() {
        if (this.isRunning && this.app && this.app.ticker) {
            this.app.ticker.remove(this.tick);
            this.isRunning = false;
        }
    }

    setBootstrapped(value) {
        this.bootstrapped = value;
    }

    /**
     * The Main Game Loop (60/120 FPS)
     */
    tick(ticker) {
        // Safety checks
        if (!this.app || !this.app.renderer) return;

        try {
            const now = performance.now();
            // Cap deltaTime to prevent huge jumps if tab was inactive
            const deltaTime = Math.min(ticker.deltaTime, 1.5);

            // --- ADDED FPS REPORTING LOGIC ---
            this._frameCount++;
            const deltaReport = now - this._lastTime;
            
            if (deltaReport >= FPS_REPORT_INTERVAL) {
                const actualFps = Math.round((this._frameCount * 1000) / deltaReport);
                // Broadcast the actual rate to the FpsDisplay component
                SignalBus.emit('engine:actual_fps', actualFps); 
                this._frameCount = 0;
                this._lastTime = now;
            }
            // --- END ADDED FPS REPORTING LOGIC ---

            // 1. Audio Processing
            const audioData = this.audioReactor.getAudioData();

            // 2. Logic & LFOs
            // Calculates new parameter values based on LFOs, Audio, and Patches
            const finalParams = this.logic.update(deltaTime, audioData);

            // 3. Apply Logic Results to Systems
            this.effectsManager.applyValues(finalParams);
            
            if (this.layerManager) {
                this.layerManager.applyModulations(finalParams);
            }

            // 4. UI Feedback (Smooth Sliders)
            // Only emit smoothed values if we are fully loaded to prevent UI jitter on load
            if (this.layerManager && this.bootstrapped) {
                const activeDeckSide = this.crossfaderSystem.crossfadeValue < 0.5 ? 'A' : 'B';
                ['1', '2', '3'].forEach(layerId => {
                    const deck = this.layerManager.getDeck(layerId, activeDeckSide);
                    if (deck) {
                        for (const prop in deck.interpolators) {
                            SignalBus.emitIfChanged(
                                `ui:smooth_update:${layerId}:${prop}`, 
                                deck.interpolators[prop].currentValue
                            );
                        }
                    }
                });
            }

            // 5. Update Feedback System Config
            let isFeedbackOn = false;
            if (this.feedbackSystem) {
                if (finalParams['feedback.enabled'] !== undefined) {
                    this.feedbackSystem.updateConfig('enabled', finalParams['feedback.enabled'] > 0.5);
                }
                
                // Batch update feedback params
                const feedbackParams = [
                    'amount', 'scale', 'rotation', 'xOffset', 'yOffset', 
                    'hueShift', 'satShift', 'contrast', 'sway', 'chroma', 
                    'invert', 'renderOnTop'
                ];
                
                feedbackParams.forEach(p => {
                    if (finalParams[`feedback.${p}`] !== undefined) {
                        this.feedbackSystem.updateConfig(p, finalParams[`feedback.${p}`]);
                    }
                });
                
                isFeedbackOn = this.feedbackSystem.config.enabled;
            }

            // 6. Physics & Transitions
            if (this.bootstrapped) {
                // Update Shaders (Time-based effects)
                this.effectsManager.update(ticker, this.app.renderer);
                
                // Update Crossfader, Drifts, and Geometry
                this.crossfaderSystem.update(deltaTime * 0.01666, now, this.app.screen);
            }

            // 7. Render Pipeline
            if (this.layerManager) {
                const mainGroup = this.layerManager.mainLayerGroup;
                
                // Apply modular effects (Bloom, ASCII, etc.) to the root container
                this.rootContainer.filters = this.effectsManager.getFilterList();
                
                // Ensure layer group is attached
                if (mainGroup.parent !== this.rootContainer) {
                    this.rootContainer.addChildAt(mainGroup, 0);
                }

                if (isFeedbackOn) {
                    // --- COMPLEX PIPELINE: FEEDBACK LOOP ---
                    
                    // 1. Render Root (Layers + Effects) into Feedback Buffer
                    this.feedbackSystem.render(this.rootContainer);
                    
                    // 2. Hide Root (so we don't render it twice)
                    this.rootContainer.visible = false;
                    
                    // 3. Show Feedback Output Sprite
                    this.feedbackSystem.displaySprite.visible = true;
                    
                    // Ensure Feedback Sprite is on Stage
                    if (this.feedbackSystem.displaySprite.parent !== this.app.stage) {
                        this.app.stage.addChild(this.feedbackSystem.displaySprite);
                    }
                } else {
                    // --- SIMPLE PIPELINE: STANDARD RENDER ---
                    this.rootContainer.visible = true;
                    
                    if (this.feedbackSystem.displaySprite.parent) {
                        this.feedbackSystem.displaySprite.visible = false;
                    }
                }
            }

        } catch (e) {
            if (import.meta.env.DEV) {
                console.error("[RenderLoop] Critical Tick Error:", e);
                // Optional: Stop loop to prevent console spam
                // this.stop(); 
            }
        }
    }
}