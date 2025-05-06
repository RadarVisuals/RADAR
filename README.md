# RADAR - Reactive Asset Driven Audio Receiver

<p align="center">
  <img src="./src/assets/branding/radarwordmarkblue.svg" alt="RADAR Logo" width="400"/>
</p>

**RADAR is determined to set the bar for NFT interaction on the LUKSO blockchain. It's a dynamic, multi-layer visual synthesizer that transforms your LSP8 NFTs into living art, reacting in real-time to audio, MIDI, and on-chain Universal Profile events. RADAR empowers you to move beyond passive collection and become an active creator and performer with your digital assets.**

---

## Table of Contents
*   [The RADAR Vision: From Collector to Creator](#the-radar-vision-from-collector-to-creator)
*   [RADAR Genesis & The Future of Asset Utility](#radar-genesis--the-future-of-asset-utility)
*   [Core Features & Technologies](#core-features--technologies)
*   [The Universal Profile as a Creative Hub](#the-universal-profile-as-a-creative-hub)
*   [A Note from the Creator](#a-note-from-the-creator)
*   [Technical Stack](#technical-stack)
*   [Getting Started](#getting-started)
*   [Usage Brief](#usage-brief)
*   [Roadmap](#roadmap)
*   [Contributing](#contributing)
*   [License](#license)

## The RADAR Vision: From Collector to Creator

RADAR challenges the notion of NFTs as static collectibles. We believe true digital ownership, powered by LUKSO's Universal Profiles, unleashes a new universe of dynamic use-cases and ignites the imagination for what NFT 2.0 can truly become. With this approach, RADAR aims to set a new standard for interactive digital asset utility.

*   **Your NFTs, Your Engine:** Don't let your assets gather virtual dust. RADAR treats your LSP8 NFTs as potent visual engines, ready to be manipulated and brought to life.
*   **Ownership is Control & Creation:** Go beyond just holding. Layer, glitch, blend, and animate your assets. Save an infinite number of unique visual setups directly onto *your* Universal Profile.
*   **Decentralized & Composable:** All your creations – visual presets, MIDI mapping, custom color coded event reactions – are stored on *your* UP using standard ERC725Y keys. It's *your* data, ready for a future of shared, community-driven visual experiences.

## RADAR Genesis & The Future of Asset Utility

Following this hackathon and feedback from the team, the official **RADAR 1.0 Beta** will launch, headlined by the **RADAR Genesis Collection**: a massive 8,000-piece LSP8 NFT collection designed *by the creator of RADAR, specifically for RADAR*.

*   **Benchmark for Asset Design:** The RADAR Genesis Collection will set the standard for how assets should be prepared for optimal use within the visualizer. This isn't about random generation; it's about intentional artistry.
*   **The Value of Artistic Preparation:**
    *   **Isolation & Whitespace:** Assets must be properly isolated within their "NFT canvas." They cannot touch the borders, which would result in undesirable straight lines during rotation and scaling.
    *   **Intentional Gaps:** Optimal designs incorporate "gaps" or negative space, allowing underlying layers to show through, creating depth and intricate visual interplay.
    *   **Anti-AI Tampering Layer:** RADAR inherently values thoughtful design. Lazy, mass-generated, or AI-created assets that are simply fully colored squares will appear as just that – rotating squares – offering little dynamic value and blocking interaction with other layers.
*   **Redefining Value Beyond Traits:** RADAR shifts the focus from randomly allocated traits to intrinsic artistic merit. For the first time, you can collect an asset purely for its color palette, an intricate detail you admire, or its potential within the RADAR engine, not just its "rarity score."
*   **Artistic Effort Rewarded:** In a space often dominated by mass-generated collections, RADAR champions the time, skill, and artistic vision invested in creating assets truly suited for dynamic visual experiences.

## Core Features & Technologies

RADAR integrates deeply with LUKSO's philosophy and innovative architecture:

*   **Dynamic NFT Visualization (3-Layer Engine):**
    *   Assign LSP8 NFTs (initially from the 40 pre-loaded demo tokens, and later from the RADAR Genesis collection and other whitelisted collections) to three distinct visual layers.
    *   Manipulate each layer's `Speed`, `Size`, `Opacity`, `X/Y Position`, `Drift`, `Angle`, `Direction`, and `Blend Mode`.
    *   **Note (Hackathon Version):** For the scope of this hackathon, the on-chain whitelist management panel for adding new LSP7/LSP8 collections is temporarily disabled. To facilitate immediate experimentation, RADAR includes 40 pre-loaded demo tokens. The underlying ERC725Y data storage (`RADAR.WhitelistedCollections`) and retrieval mechanisms for whitelists are implemented but need feedback on the implementation of this.

*   **Audio Reactivity (Web Audio API):**
    *   Layers pulsate and resize in response to audio frequencies (Bass -> Bottom Layer, Mid -> Middle Layer, Treble -> Top Layer) and overall beat detection.
    *   A custom Sawtooth-Sinewave hybrid algorithm smoothly blends audio-driven layer interactions.

*   **Tactile MIDI Control (Web MIDI API):**
    *   Intuitive **MIDI Learn** for all visual parameters.
    *   **Global MIDI Map:** Your controller mapping is saved to `RADAR.MIDI.ParameterMap` on *your* Universal Profile, ensuring consistent control across all presets.

*   **On-Chain Event Reactions (LSP1 UniversalReceiver):**
    *   Visual effects triggered by on-chain events on your UP (e.g., receiving LYX, tokens).
    *   **Global Event Reactions:** Ruleset stored on *your* UP via `RADAR.EventReactions`.

*   **Decentralized Configuration Storage (ERC725Y):**
    RADAR leverages your Universal Profile for true data ownership:
    1.  **Visual Presets (Map: `RADAR.NamedConfiguration:<nameHash>`):** Store infinite unique visual setups.
    2.  **Preset Index (Array: `RADAR.SavedConfigurationList[]`):** Lists your saved presets.
    3.  **Default Preset (Singleton: `RADAR.DefaultConfigurationName`):** Designates your profile's default RADAR experience.

## The Universal Profile as a Creative Hub

RADAR pushes the concept of the Universal Profile beyond a mere wallet or identity layer, transforming it into a dynamic canvas and creative launchpad.

*   **Collector Becomes Creator:** By loading an asset into RADAR and manipulating its parameters, *you* become the artist. The visual configurations you save to your UP are new, derived creations. This is your unique way of "minting" new visual experiences from the assets you hold.
*   **Cross-Profile VJing & Spectating:** This is where the power of decentralized, on-chain configurations truly shines:
    *   Visit another user's Universal Profile running RADAR.
    *   Load *their* saved visual presets and witness *their* unique artistic interpretations of their assets.
    *   If you have a MIDI controller, *your* global MIDI map (from your UP) can control the parameters of *their* presets, enabling an unprecedented live, cross-profile VJing experience.
    *   See their on-chain events trigger their personally configured visual reactions.
*   **Future of Whitelist & Community Curation:** Post-hackathon, activating the whitelist panel *within* RADAR (as a MiniApp on a user's UP) could empower trusted community members or "Layer Creators" to curate and propose collections, further decentralizing the artistic ecosystem.

This interplay of personal creation, shared experiences, and on-chain identity begins to scratch the surface of the possibilities achievable with LUKSO's architecture.

## A Note from the Creator

RADAR is the culmination of a personal artistic vision, developed by a single creator over thousands of hours. It's born from a passion for music production, visual art, and asset creation, and a deep belief in the transformative potential of the LUKSO ecosystem.

For me, RADAR represents a personal standard for how digital assets can be experienced – not as static images, but as living, breathing components of an interactive and deeply personal creative world. This project is where all my passions converge, and there's an immense amount of potential I'm excited to explore to push this concept, quite literally, out of this world.

### MIDI Control Setup

RADAR offers intuitive MIDI control over its visual parameters, allowing for a tactile and expressive performance experience. Your MIDI mappings are saved globally to your Universal Profile.

**Steps to Map Your MIDI Controller:**

1.  **Connect Your MIDI Controller:**
    *   Plug your MIDI controller (keyboard, knob/fader controller, drum pads, etc.) into your computer, typically via USB.
    *   Most modern MIDI controllers are class-compliant and should be automatically detected by your operating system and browser.

2.  **Enable MIDI in RADAR:**
    *   Locate the **Global MIDI Status button** in the RADAR interface (usually in the bottom-right corner, often represented by a MIDI plug icon).
    *   Click this button. It should indicate a "Connected" state if your controller is detected.
        *   If it says "Disconnected" or shows an error, ensure your controller is properly connected and recognized by your system. You may need to click it again to initiate the connection.

3.  **Access Layer Controls:**
    *   Open the main **Controls Panel** (usually triggered by a sliders icon in the vertical toolbar).
    *   Select the visual layer (Top, Middle, or Bottom) you wish to map controls for.

4.  **Initiate MIDI Learn for a Parameter:**
    *   For each parameter you want to control (e.g., `Size`, `Speed`, `X Position`, `Opacity`), you'll see a small **'M' (MIDI Learn) button** next to its slider or value display.
    *   Click the 'M' button for the specific parameter you want to map. The button will typically change appearance (e.g., highlight, show "...") to indicate it's now "listening" for a MIDI message.

5.  **Assign Your MIDI Control:**
    *   On your connected MIDI controller, **move the physical knob, fader, or press the pad/key** you want to assign to the selected parameter.
    *   RADAR will detect the incoming MIDI message (e.g., a Control Change (CC) from a knob, or a Note On from a pad).
    *   The parameter will automatically be mapped to that MIDI control. The 'M' button should return to its normal state, and the UI might display the new mapping (e.g., "CC 21").

6.  **Repeat for All Desired Parameters & Layers:**
    *   Continue this process (Steps 3-5) for all other parameters you wish to control across all three visual layers.

7.  **Save Your Global MIDI Map:**
    *   Once you're satisfied with your mappings for all desired parameters and layers:
    *   Open the **Save Panel** (usually triggered by a write/disk icon).
    *   Look for an option like **"Save Global MIDI Map"** or an option to include MIDI settings when saving a visual preset.
    *   Click to save. This action writes your entire MIDI mapping configuration to the `RADAR.MIDI.ParameterMap` key on your Universal Profile.

**Key Benefits of RADAR's MIDI System:**

*   **Global & Persistent:** Your MIDI map is saved once to your UP and applies across *all* visual presets you load or create. You don't need to remap for each new visual setup.
*   **Intuitive Learn Mode:** No manual entry of CC numbers or channels needed; just click and move.
*   **Cross-Profile Compatibility:** When viewing someone else's RADAR setup, *your* saved MIDI map will still control *their* visual parameters, enabling unique cross-profile VJing experiences.

Now your MIDI controller is your hands-on interface for sculpting visuals in RADAR!

### Audio Reactivity Setup (Using Virtual Audio Cable & Voicemeeter)

To make RADAR's visuals react to the audio playing on your computer (e.g., from your browser or music player), you can route your audio through Voicemeeter using a Virtual Audio Cable. This gives you fine-grained control.

**Prerequisites:**
*   **Voicemeeter** (or Voicemeeter Banana/Potato) installed. Get it from [vb-audio.com/Voicemeeter/](https://vb-audio.com/Voicemeeter/).
*   **Restart your computer** after installing both.

**Steps:**

1.  **Route Desired Audio to Virtual Cable:**
    *   **For Browser Audio (e.g., Spotify Web, YouTube):**
        *   In Windows Sound settings (right-click speaker icon -> "Open Sound settings" -> "App volume and device preferences" or similar advanced options):
        *   Find your web browser in the list of apps.
        *   Change its **Output** device to **"CABLE Input (VB-Audio Virtual Cable)"**.
    *   **For System-Wide Audio (Simpler, but less granular):**
        *   In Windows Sound settings (Playback tab), set **"CABLE Input (VB-Audio Virtual Cable)"** as your **Default Device**. (Be aware this routes *all* system sound initially).

2.  **Configure Voicemeeter:**
    *   Open Voicemeeter.
    *   **Hardware Input 1 (or any available input strip):**
        *   Click the channel name (e.g., "Hardware Input 1").
        *   Select **"CABLE Output (VB-Audio Virtual Cable)"**. This brings the audio from the virtual cable *into* Voicemeeter.
        *   Ensure this channel strip is active (not muted, fader up). If you want to hear this audio also through your speakers/headphones directly from Voicemeeter, enable its output to A1 (or your main hardware out).
    *   **Hardware Out (A1):**
        *   Click "A1" (usually top-right).
        *   Select your main speakers or headphones (e.g., "WDM: Speakers (Your Soundcard)"). This is where you'll hear the final mixed audio.

3.  **Set Voicemeeter Output as Default Recording Device (for RADAR):**
    *   In Windows Sound settings (Recording tab).
    *   Find **"Voicemeeter Output (VB-Audio Voicemeeter VAIO)"** (or similar, like "Voicemeeter Aux Output" if using Banana/Potato and routing to AUX).
    *   Right-click and set it as **"Default Device"** and **"Default Communication Device"**.

4.  **Browser Permissions for RADAR:**
    *   When you open RADAR and enable the Audio Visualizer:
    *   Your browser will ask for microphone permission.
    *   Ensure you select **"Voicemeeter Output"** (or the equivalent from step 3) as the microphone source.

**How it Works:**
Your application audio (e.g., browser) sends sound to the "CABLE Input." The "CABLE Output" then feeds this sound into a Voicemeeter input strip. Voicemeeter processes it and sends it to both your physical speakers/headphones (via A1 Hardware Out) AND its own virtual output ("Voicemeeter Output"). RADAR then listens to "Voicemeeter Output" as if it were a microphone.

This method is great because you can selectively route only the audio sources you want into the visualizer.

## Technical Stack

*   **Stack:** React, Vite
*   **Standards:** LUKSO (Universal Profiles, LSP1 LSP4, LSP7, LSP8, ERC725Y)
    *   `@lukso/up-provider`
    *   `@erc725/erc725.js`
    *   `@lukso/lsp-smart-contracts`
    *   Viem
*   **Web APIs:** Web MIDI, Web Audio, HTML5 Canvas
*   **Styling:** CSS

A DETAILED VIDEO DEMO WILL FOLLOW SHORTLY.