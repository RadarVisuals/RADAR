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
        const { width, height } = this.app.screen;
        const res = this.app.renderer.resolution;

        this.rt1 = RenderTexture.create({ width, height, resolution: res });
        this.rt2 = RenderTexture.create({ width, height, resolution: res });

        this.feedbackSprite = new Sprite(this.rt1);
        this.feedbackSprite.anchor.set(0.5);
        this.feedbackSprite.position.set(width / 2, height / 2);

        this.outputSprite = new Sprite(this.rt2);
        this.outputSprite.visible = false;
        
        // Add output sprite to stage immediately (visibility toggled later)
        this.app.stage.addChild(this.outputSprite);
    }

    resize(width, height) {
        if (this.rt1) this.rt1.resize(width, height);
        if (this.rt2) this.rt2.resize(width, height);
        if (this.feedbackSprite) this.feedbackSprite.position.set(width / 2, height / 2);
    }

    updateConfig(param, value) {
        // Full sync from store if param is null
        if (param === null) {
            const state = useEngineStore.getState();
            this.config = { ...state.effectsConfig.feedback };
        } else {
            this.config[param] = value;
        }
        
        this.outputSprite.visible = this.config.enabled;
        return this.config.enabled; // Return visibility state for parent to handle masking
    }

    render(sourceContainer) {
        if (!this.config.enabled || !this.rt1 || !this.rt2) return;

        // 1. Configure "History" sprite
        this.feedbackSprite.scale.set(this.config.scale);
        this.feedbackSprite.rotation = this.config.rotation * 0.05;
        this.feedbackSprite.alpha = this.config.amount;
        this.feedbackSprite.position.x = (this.app.screen.width / 2) + this.config.xOffset;
        this.feedbackSprite.position.y = (this.app.screen.height / 2) + this.config.yOffset;

        // 2. Render History -> Buffer B (Clear previous)
        this.app.renderer.render({
            container: this.feedbackSprite,
            target: this.rt2,
            clear: true
        });

        // 3. Render New Frame (Source) -> Buffer B (Don't clear, draw on top)
        sourceContainer.visible = true; // Briefly visible for internal render
        this.app.renderer.render({
            container: sourceContainer,
            target: this.rt2,
            clear: false
        });
        sourceContainer.visible = false; // Hide again to prevent double draw

        // 4. Swap Buffers
        const temp = this.rt1;
        this.rt1 = this.rt2;
        this.rt2 = temp;

        // 5. Update Sprites
        this.feedbackSprite.texture = this.rt1;
        this.outputSprite.texture = this.rt1;
    }

    destroy() {
        if (this.rt1) this.rt1.destroy(true);
        if (this.rt2) this.rt2.destroy(true);
        if (this.feedbackSprite) this.feedbackSprite.destroy();
        if (this.outputSprite) this.outputSprite.destroy();
    }
}