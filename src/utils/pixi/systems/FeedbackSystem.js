import { RenderTexture, Sprite } from 'pixi.js';
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
            yOffset: 0 
        };
        
        this.buffers = [];
        this.activeBufferIndex = 0;
        
        this.feedbackSprite = null; 
        this.displaySprite = null;  
        
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

            // 1. Setup Feedback Sprite (Previous Frame)
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

            // Render trail (Clear buffer)
            renderer.render({
                container: this.feedbackSprite,
                target: outputTexture,
                clear: true
            });

            // 2. Draw Source (Live Content)
            // FIX: Momentarily enable visibility to render, then disable.
            // We rely on the renderer to handle transforms now that it's attached.
            const wasVisible = sourceContainer.visible;
            sourceContainer.visible = true;
            sourceContainer.renderable = true;

            renderer.render({
                container: sourceContainer,
                target: outputTexture,
                clear: false // Draw over trails
            });
            
            sourceContainer.visible = wasVisible; // Restore original state (likely false from PixiEngine)
            
            // 3. Update Display
            this.displaySprite.texture = outputTexture;

            // 4. Swap for next frame
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