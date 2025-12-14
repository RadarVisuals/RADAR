// src/utils/pixi/systems/FeedbackSystem.js
import { RenderTexture, Sprite } from 'pixi.js';
import { useEngineStore } from '../../../store/useEngineStore';

export class FeedbackSystem {
    constructor(app) {
        this.app = app;
        this.config = { enabled: false, amount: 0.9, scale: 1.01, rotation: 0, xOffset: 0, yOffset: 0 };
        
        this.rt1 = null; 
        this.rt2 = null; 
        this.feedbackSprite = null; 
        this.outputSprite = null; 
        
        this.init();
    }

    init() {
        if (!this.app || !this.app.renderer) return;

        const { width, height } = this.app.screen;
        const res = this.app.renderer.resolution;

        const rtOptions = { 
            width, 
            height, 
            resolution: res,
            scaleMode: 'linear',
            antialias: false
        };

        this.rt1 = RenderTexture.create(rtOptions);
        this.rt2 = RenderTexture.create(rtOptions);

        this.feedbackSprite = new Sprite(this.rt1);
        this.feedbackSprite.anchor.set(0.5);
        // NOTE: feedbackSprite is NOT added to stage. It exists only for off-screen rendering.

        this.outputSprite = new Sprite(this.rt2);
        this.outputSprite.visible = false;
        
        // Only the output sprite is added to the stage to display the final result
        this.app.stage.addChild(this.outputSprite);
    }

    resize(width, height) {
        if (this.rt1) this.rt1.resize(width, height);
        if (this.rt2) this.rt2.resize(width, height);
        // Center the sprite relative to the new dimensions
        if (this.feedbackSprite) this.feedbackSprite.position.set(width / 2, height / 2);
    }

    updateConfig(param, value) {
        if (param === null) {
            const state = useEngineStore.getState();
            const vals = state.baseValues || {};
            if (vals['feedback.enabled'] !== undefined) this.config.enabled = vals['feedback.enabled'] > 0.5;
            if (vals['feedback.amount'] !== undefined) this.config.amount = vals['feedback.amount'];
            if (vals['feedback.scale'] !== undefined) this.config.scale = vals['feedback.scale'];
            if (vals['feedback.rotation'] !== undefined) this.config.rotation = vals['feedback.rotation'];
            if (vals['feedback.xOffset'] !== undefined) this.config.xOffset = vals['feedback.xOffset'];
            if (vals['feedback.yOffset'] !== undefined) this.config.yOffset = vals['feedback.yOffset'];
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
            // Apply Config to the off-screen sprite
            this.feedbackSprite.scale.set(this.config.scale);
            this.feedbackSprite.rotation = this.config.rotation;
            this.feedbackSprite.alpha = this.config.amount;
            
            // Center it (in case screen size changed)
            const screenW = this.app.screen.width;
            const screenH = this.app.screen.height;
            const targetX = (screenW / 2) + (this.config.xOffset || 0);
            const targetY = (screenH / 2) + (this.config.yOffset || 0);
            this.feedbackSprite.position.set(targetX, targetY);

            // 1. Draw PREVIOUS FRAME (the feedback sprite) into Buffer B (rt2)
            // Since feedbackSprite is detached, render() acts as if it's the root.
            // Pixi handles the transforms relative to the texture automatically.
            this.app.renderer.render({
                container: this.feedbackSprite,
                target: this.rt2,
                clear: true // Clear buffer before drawing
            });

            // 2. Draw NEW CONTENT (Source Container) ON TOP into Buffer B (rt2)
            // Source Container (mainLayerGroup) should be DETACHED from stage by PixiEngine
            // when feedback is enabled.
            
            // Ensure source is visible for the render pass
            const wasVisible = sourceContainer.visible;
            sourceContainer.visible = true; 
            
            this.app.renderer.render({
                container: sourceContainer,
                target: this.rt2,
                clear: false // Do NOT clear, draw over the feedback trail
            });
            
            sourceContainer.visible = wasVisible; 

            // 3. Swap Buffers (Ping-Pong)
            const temp = this.rt1;
            this.rt1 = this.rt2;
            this.rt2 = temp;

            // 4. Update Textures for next frame
            this.feedbackSprite.texture = this.rt1; // History for next loop
            this.outputSprite.texture = this.rt1;   // Visible output

        } catch (e) {
            console.warn('[FeedbackSystem] Render error:', e);
            this.config.enabled = false; 
            if (this.outputSprite) this.outputSprite.visible = false;
        }
    }

    destroy() {
        if (this.rt1) { this.rt1.destroy(true); this.rt1 = null; }
        if (this.rt2) { this.rt2.destroy(true); this.rt2 = null; }
        if (this.feedbackSprite) { this.feedbackSprite.destroy(); this.feedbackSprite = null; }
        if (this.outputSprite) { this.outputSprite.destroy(); this.outputSprite = null; }
    }
}