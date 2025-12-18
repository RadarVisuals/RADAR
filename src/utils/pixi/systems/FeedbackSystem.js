// src/utils/pixi/systems/FeedbackSystem.js
import { RenderTexture, Sprite, ColorMatrixFilter } from 'pixi.js';
import { RGBSplitFilter } from 'pixi-filters';
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
            satShift: 0,
            contrast: 0,
            sway: 0, 
            chroma: 0,
            invert: false,
            renderOnTop: false 
        };
        
        this.buffers = [];
        this.activeBufferIndex = 0;
        
        this.feedbackSprite = null; 
        this.displaySprite = null;
        
        this.colorMatrix = new ColorMatrixFilter();
        this.rgbFilter = new RGBSplitFilter({ red: {x:0, y:0}, green: {x:0, y:0}, blue: {x:0, y:0} });
        
        this.isInitialized = false;
        
        this.render = this.render.bind(this);
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        if (!this.app || !this.app.renderer) return;

        const { width, height } = this.app.screen;
        
        // PERFORMANCE OPTIMIZATION: Cap feedback resolution to 1.0
        // Feedback loops accumulate noise, high resolution is wasted VRAM/Fillrate here.
        const res = Math.min(this.app.renderer.resolution, 1.0);

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
            
            // Chain: Color Effects -> Geometric/Warp Effects (RGB Split)
            this.feedbackSprite.filters = [this.colorMatrix, this.rgbFilter];
            
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
            const satShift = Number(this.config.satShift) || 0;
            const contrast = Number(this.config.contrast) || 0;
            const sway = Number(this.config.sway) || 0;
            const chroma = Number(this.config.chroma) || 0;
            const invert = Boolean(this.config.invert);
            const renderOnTop = this.config.renderOnTop;

            // 1. Configure Color Matrix
            this.colorMatrix.reset(); 

            if (Math.abs(hueShift) > 0.001) {
                this.colorMatrix.hue(hueShift * 30, false);
            }
            
            if (Math.abs(satShift) > 0.001) {
                this.colorMatrix.saturate(1 + satShift, true);
            }

            if (contrast > 0.001) {
                this.colorMatrix.contrast(contrast * 2, true);
            }

            if (invert) {
                this.colorMatrix.negative(true);
            }

            // 2. Configure Chroma Filter (RGB Split)
            if (Math.abs(chroma) > 0.001) {
                // Diagonal split for maximum visual impact
                this.rgbFilter.red = { x: chroma, y: chroma };
                this.rgbFilter.blue = { x: -chroma, y: -chroma };
                this.rgbFilter.enabled = true;
            } else {
                this.rgbFilter.enabled = false;
            }

            // 3. Setup Feedback Sprite (Previous Frame)
            this.feedbackSprite.texture = inputTexture;
            this.feedbackSprite.alpha = amt;
            this.feedbackSprite.rotation = rot;
            
            // Apply Sway (Sinusoidal Movement)
            let swayX = 0;
            let swayY = 0;
            if (sway > 0) {
                const t = Date.now() * 0.002; // Slow-ish time base
                swayX = Math.sin(t) * sway;
                swayY = Math.cos(t * 0.8) * sway; // Different freq for organic non-circle look
            }

            const targetX = (outputTexture.width / 2) + xOff + swayX;
            const targetY = (outputTexture.height / 2) + yOff + swayY;
            
            this.feedbackSprite.position.set(
                isNaN(targetX) ? 0 : targetX, 
                isNaN(targetY) ? 0 : targetY
            );
            
            this.feedbackSprite.scale.set(
                isNaN(scl) ? 1 : scl
            );

            // 4. Prepare Source for Rendering (Apply Glitch to Source too!)
            const originalFilters = sourceContainer.filters || [];
            
            const activeFilters = [];
            const hasColorGlitch = Math.abs(hueShift) > 0.001 || Math.abs(satShift) > 0.001 || contrast > 0.001 || invert;
            const hasChromaGlitch = Math.abs(chroma) > 0.001;

            if (hasColorGlitch) activeFilters.push(this.colorMatrix);
            if (hasChromaGlitch) activeFilters.push(this.rgbFilter);

            if (activeFilters.length > 0) {
                sourceContainer.filters = [...originalFilters, ...activeFilters];
            }

            // Ensure source is visible for the render pass
            const wasVisible = sourceContainer.visible;
            sourceContainer.visible = true;
            sourceContainer.renderable = true;

            // 5. Render Loop
            if (renderOnTop) {
                // "Upward Tunnel"
                renderer.render({
                    container: sourceContainer,
                    target: outputTexture,
                    clear: true
                });

                renderer.render({
                    container: this.feedbackSprite,
                    target: outputTexture,
                    clear: false
                });
            } else {
                // "Standard Tunnel"
                renderer.render({
                    container: this.feedbackSprite,
                    target: outputTexture,
                    clear: true
                });

                renderer.render({
                    container: sourceContainer,
                    target: outputTexture,
                    clear: false
                });
            }
            
            // 6. Restore Source State
            sourceContainer.visible = wasVisible; 
            if (activeFilters.length > 0) {
                sourceContainer.filters = originalFilters;
            }
            
            // 7. Update Display
            this.displaySprite.texture = outputTexture;

            // 8. Swap for next frame
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