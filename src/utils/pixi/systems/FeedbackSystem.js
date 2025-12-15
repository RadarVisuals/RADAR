// src/utils/pixi/systems/FeedbackSystem.js
import { RenderTexture, Sprite, ColorMatrixFilter } from 'pixi.js';
import { useEngineStore } from '../../../store/useEngineStore';

export class FeedbackSystem {
    constructor(app, rootStage) {
        this.app = app;
        this.rootStage = rootStage; 
        
        this.config = { 
            enabled: false, 
            amount: 0.9, 
            scale: 1.01, 
            rotation: 0, 
            xOffset: 0, 
            yOffset: 0,
            hueShift: 0,
            renderOnTop: false 
        };
        
        this.buffers = [];
        this.activeBufferIndex = 0;
        
        this.feedbackSprite = null; 
        this.displaySprite = null;
        this.colorMatrix = new ColorMatrixFilter();
        
        this.isInitialized = false;
        
        this.render = this.render.bind(this);
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        if (!this.app || !this.app.renderer) return;

        const { width, height } = this.app.screen;
        const res = this.app.renderer.resolution;

        if (this.buffers.length > 0) {
            this.buffers.forEach(b => b.destroy(true));
            this.buffers = [];
        }

        const rtOptions = { 
            width, 
            height, 
            resolution: res,
            antialias: false,
            scaleMode: 'linear',
            depth: true,
            stencil: true
        };

        try {
            this.buffers = [
                RenderTexture.create(rtOptions),
                RenderTexture.create(rtOptions)
            ];

            this.feedbackSprite = new Sprite(this.buffers[0]);
            this.feedbackSprite.anchor.set(0.5);
            this.feedbackSprite.filters = [this.colorMatrix];
            
            this.displaySprite = new Sprite(this.buffers[1]);
            this.displaySprite.anchor.set(0.5);
            this.displaySprite.position.set(width / 2, height / 2);
            
            this.isInitialized = true;
        } catch (e) {
            console.error("[FeedbackSystem] Init Failed:", e);
        }
    }

    resize(width, height) {
        if (!this.isInitialized) return;
        if (this.buffers[0]) this.buffers[0].resize(width, height);
        if (this.buffers[1]) this.buffers[1].resize(width, height);
        if (this.displaySprite) this.displaySprite.position.set(width / 2, height / 2);
    }

    updateConfig(param, value) {
        if (!this.isInitialized) this.init();
        if (!this.isInitialized) return false;

        if (param === null) {
            const state = useEngineStore.getState();
            if (state.effectsConfig?.feedback) {
                this.config = { ...state.effectsConfig.feedback };
            }
        } else {
            this.config[param] = value;
        }

        return this.config.enabled;
    }

    render(sourceContainer) {
        if (!this.config.enabled || !this.isInitialized) return;
        if (!sourceContainer) return;
        
        if (!this.buffers || this.buffers.length < 2 || !this.buffers[0] || !this.buffers[1]) {
            return;
        }

        const renderer = this.app.renderer;
        
        const inputIndex = this.activeBufferIndex; 
        const outputIndex = (this.activeBufferIndex + 1) % 2;
        
        const inputTexture = this.buffers[inputIndex];
        const outputTexture = this.buffers[outputIndex];

        try {
            const amt = Number(this.config.amount) || 0.9;
            const scl = Number(this.config.scale) || 1.01;
            const rot = (Number(this.config.rotation) || 0) * 0.05;
            const xOff = Number(this.config.xOffset) || 0;
            const yOff = Number(this.config.yOffset) || 0;
            const hueShift = Number(this.config.hueShift) || 0;
            const renderOnTop = this.config.renderOnTop;

            // 1. Configure Color Matrix
            if (Math.abs(hueShift) > 0.001) {
                this.colorMatrix.hue(hueShift * 30, false);
            } else {
                this.colorMatrix.reset();
            }

            // 2. Setup Feedback Sprite (Previous Frame)
            this.feedbackSprite.texture = inputTexture;
            this.feedbackSprite.alpha = amt;
            this.feedbackSprite.rotation = rot;
            
            const targetX = (outputTexture.width / 2) + xOff;
            const targetY = (outputTexture.height / 2) + yOff;
            
            this.feedbackSprite.position.set(
                isNaN(targetX) ? 0 : targetX, 
                isNaN(targetY) ? 0 : targetY
            );
            
            this.feedbackSprite.scale.set(
                isNaN(scl) ? 1 : scl
            );

            // 3. Render Loop (Order Switching logic)
            // Ensure Source is momentarily visible for the render pass
            const wasVisible = sourceContainer.visible;
            sourceContainer.visible = true;
            sourceContainer.renderable = true;

            if (renderOnTop) {
                // "Upward Tunnel": Render Asset first, then Trails on Top
                
                // Draw Source (Clear Buffer)
                renderer.render({
                    container: sourceContainer,
                    target: outputTexture,
                    clear: true
                });

                // Draw Feedback Trails (No Clear)
                renderer.render({
                    container: this.feedbackSprite,
                    target: outputTexture,
                    clear: false
                });
            } else {
                // "Standard Tunnel": Render Trails first, then Asset on Top
                
                // Draw Feedback Trails (Clear Buffer)
                renderer.render({
                    container: this.feedbackSprite,
                    target: outputTexture,
                    clear: true
                });

                // Draw Source (No Clear)
                renderer.render({
                    container: sourceContainer,
                    target: outputTexture,
                    clear: false
                });
            }
            
            // Restore visibility state
            sourceContainer.visible = wasVisible; 
            
            // 4. Update Display
            this.displaySprite.texture = outputTexture;

            // 5. Swap for next frame
            this.activeBufferIndex = outputIndex;

        } catch (err) {
            console.error("[FeedbackSystem] Render Error:", err);
            this.config.enabled = false; 
        }
    }

    destroy() {
        this.isInitialized = false;
        if (this.displaySprite) this.displaySprite.destroy();
        if (this.feedbackSprite) this.feedbackSprite.destroy();
        this.buffers.forEach(b => b?.destroy(true));
        this.buffers = [];
    }
}