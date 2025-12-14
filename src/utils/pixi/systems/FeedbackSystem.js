// src/utils/pixi/systems/FeedbackSystem.js
import { RenderTexture, Sprite } from 'pixi.js';
import { useEngineStore } from '../../../store/useEngineStore';

export class FeedbackSystem {
    constructor(app) {
        this.app = app;
        this.config = { enabled: false, amount: 0.9, scale: 1.01, rotation: 0, xOffset: 0, yOffset: 0 };
        
        // Resources
        this.rt1 = null; // Buffer A
        this.rt2 = null; // Buffer B
        this.feedbackSprite = null; // History
        this.outputSprite = null;   // Output
        
        this.init();
    }

    init() {
        if (!this.app || !this.app.renderer) return;

        const { width, height } = this.app.screen;
        const res = this.app.renderer.resolution;

        // Use 'linear' scaleMode for smooth trails
        const rtOptions = { 
            width, 
            height, 
            resolution: res,
            scaleMode: 'linear',
            antialias: false
        };

        this.rt1 = RenderTexture.create(rtOptions);
        this.rt2 = RenderTexture.create(rtOptions);

        // Feedback Sprite (The "History")
        this.feedbackSprite = new Sprite(this.rt1);
        this.feedbackSprite.anchor.set(0.5);
        this.feedbackSprite.position.set(width / 2, height / 2);
        
        // FIX: Add to stage so transforms update automatically, preventing the crash.
        // Set renderable=false so it doesn't draw to the main screen, only to our buffer.
        this.feedbackSprite.renderable = false;
        this.app.stage.addChild(this.feedbackSprite);

        // Output Sprite (The Result displayed on screen)
        this.outputSprite = new Sprite(this.rt2);
        this.outputSprite.visible = false; // Visibility controlled by config
        
        this.app.stage.addChild(this.outputSprite);
    }

    resize(width, height) {
        if (this.rt1) this.rt1.resize(width, height);
        if (this.rt2) this.rt2.resize(width, height);
        if (this.feedbackSprite) this.feedbackSprite.position.set(width / 2, height / 2);
    }

    updateConfig(param, value) {
        if (param === null) {
            // Full sync from store
            const state = useEngineStore.getState();
            if (state.effectsConfig?.feedback) {
                this.config = { ...state.effectsConfig.feedback };
            }
        } else {
            this.config[param] = value;
        }
        
        if (this.outputSprite) {
            this.outputSprite.visible = this.config.enabled;
        }
        return this.config.enabled;
    }

    render(sourceContainer) {
        if (!this.config.enabled || !this.rt1 || !this.rt2 || !this.feedbackSprite || !this.outputSprite) return;
        if (this.feedbackSprite.destroyed || this.outputSprite.destroyed) return;

        try {
            // Apply Config
            this.feedbackSprite.scale.set(this.config.scale);
            this.feedbackSprite.rotation = this.config.rotation;
            this.feedbackSprite.alpha = this.config.amount;
            
            // Center the feedback sprite
            const screenW = this.app.screen.width;
            const screenH = this.app.screen.height;
            this.feedbackSprite.position.set(
                (screenW / 2) + this.config.xOffset, 
                (screenH / 2) + this.config.yOffset
            );

            // --- 1. Render HISTORY (feedbackSprite) into Buffer B (rt2) ---
            
            // Temporarily enable renderable so the renderer processes it
            this.feedbackSprite.renderable = true;
            
            this.app.renderer.render({
                container: this.feedbackSprite,
                target: this.rt2,
                clear: true // Clear buffer before drawing history
            });
            
            this.feedbackSprite.renderable = false; // Hide again

            // --- 2. Render NEW CONTENT (sourceContainer) into Buffer B (rt2) ---
            
            // sourceContainer is 'renderable = false' in PixiEngine (to hide from main screen)
            // We temporarily enable it for this manual render pass.
            const wasRenderable = sourceContainer.renderable;
            sourceContainer.renderable = true; 
            
            // Force transform update. Safe now because it is attached to stage (in PixiEngine).
            // This ensures geometry is generated before the draw call.
            if (sourceContainer.updateTransform) {
                sourceContainer.updateTransform();
            }

            this.app.renderer.render({
                container: sourceContainer,
                target: this.rt2,
                clear: false // Draw ON TOP of history
            });
            
            sourceContainer.renderable = wasRenderable; // Restore state

            // --- 3. Swap Buffers ---
            const temp = this.rt1;
            this.rt1 = this.rt2;
            this.rt2 = temp;

            // --- 4. Update Display Textures ---
            this.feedbackSprite.texture = this.rt1; // History for next frame
            this.outputSprite.texture = this.rt1;   // Result on screen

        } catch (e) {
            console.warn('[FeedbackSystem] Render error:', e);
            this.config.enabled = false; 
            if (this.outputSprite) this.outputSprite.visible = false;
            // Emergency restore to prevent source disappearing forever
            if (sourceContainer) sourceContainer.renderable = true;
        }
    }

    destroy() {
        if (this.rt1) { this.rt1.destroy(true); this.rt1 = null; }
        if (this.rt2) { this.rt2.destroy(true); this.rt2 = null; }
        if (this.feedbackSprite) { this.feedbackSprite.destroy(); this.feedbackSprite = null; }
        if (this.outputSprite) { this.outputSprite.destroy(); this.outputSprite = null; }
    }
}