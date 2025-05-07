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
*   [Roadmap](#roadmap)
*   [MIDI Control Setup](#midi-control-setup)
*   [Audio Reactivity Setup](#audio-reactivity-setup-using-virtual-audio-cable--voicemeeter)


## The RADAR Vision: From Collector to Creator

RADAR challenges the notion of NFTs as static collectibles. We believe true digital ownership, powered by LUKSO's Universal Profiles, unleashes a new universe of dynamic use-cases and ignites the imagination for what NFT 2.0 can truly become. With this approach, RADAR aims to set a new standard for interactive digital asset utility.

*   **Your NFTs, Your Engine:** Don't let your assets gather virtual dust. RADAR treats your LSP8 NFTs as potent visual engines, ready to be manipulated and brought to life.
*   **Ownership is Control & Creation:** Go beyond just holding. Layer, glitch, blend, and animate your assets. Save an infinite number of unique visual setups directly onto your Universal Profile.
*   **Decentralized & Composable:** All your creations – visual presets, MIDI mapping, custom color-coded event reactions – are stored on *your* UP using standard ERC725Y keys. It's *your* data, ready for a future of shared, community-driven visual experiences.

## The RADAR Genesis Collection & The Future of Asset Utility

Following this hackathon and feedback from the team, the official **RADAR 1.0 Beta** will launch, headlined by the **RADAR Genesis Collection**: a massive 8,000-piece LSP8 NFT collection designed *by the founder / creator of RADAR, VXCTXR, specifically for RADAR*.

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
    *   **Global MIDI Map:** Your controller mapping is saved to `RADAR.MIDI.ParameterMap` on your Universal Profile, ensuring consistent control across all presets.

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
    *   If you have a MIDI controller, *your* global MIDI map (from *your* UP) can control the parameters of *their* presets, enabling an unprecedented live, cross-profile VJing experience.
    *   See their on-chain events trigger their personally configured visual reactions.
*   **Future of Whitelist & Community Curation:** Post-hackathon, activating the whitelist panel *within* RADAR (as a MiniApp on a user's UP) could empower trusted community members or "Layer Creators" to curate and propose collections, further decentralizing the artistic ecosystem.

This interplay of personal creation, shared experiences, and on-chain identity begins to scratch the surface of the possibilities achievable with LUKSO's architecture.

## A Note from the Creator aka VXCTXR

RADAR is more than just an application; it's the culmination of a deeply personal, year-long artistic endeavor undertaken by a single creator. It represents a journey into the heart of my drive for self-expression, fueled by a relentless curiosity to understand and harness the decentralized mindset that LUKSO pioneers. This truly has opened my eyes. Learning to code and conceptualize within this new framework has been a profound experience.

I am immensely grateful for the foundational work and philosophical inspiration provided by the LUKSO team throughout. Your vision for Universal Profiles and a truly composable digital future has been the bedrock upon which RADAR is built.

This project is born from a lifelong passion for music production, visual art, and asset creation, all converging with a steadfast belief in the transformative power of the LUKSO ecosystem. For me, RADAR is a personal benchmark for how digital assets *should* be experienced, how my art *could* be perceived. Not as static images, but as living, breathing components of an interactive and deeply personal creative world. There's a whole new universe of potential to explore here, and I'm thrilled to push this concept, quite literally, out of this world.

## Roadmap

*   **Visual Effect Expansion:** Introduce a wider array of dynamic visual effects.
*   Further polish & introduce parameter object interpolation, now visible on the x/y axis and rotation (mainly implemented to cover up the limited 127 step allocation inhereted by MIDI).
*   Interpolate between presets. 
*   Another thing where I'm excited about to dive in is something that is called Parameter Locking, or "P-locking". This is a concept borrowed from my hardware sequencer / drumcomputer, the Elektron Analog Rytm MKII, where it could serve as a powerful creative tool in addition to RADAR + MIDI functionality. In its original form, P-locking allows you to "record" parameter changes—like filter sweeps, volume tweaks, or pitch shifts—step-by-step across a looping 16-step sequence. Every knob twist is remembered and retriggered at the end of the 16 step loop, giving your sound dynamic variation without ever having to touch the controller again. So imagine this for RADAR like recording a 5 seconds loop over and over again. Overwriting and retriggering continuously when you move a parameter. Ie. moving an asset over the X axis during a 5 second window would just retrigger this movement over and over again.

*   **Advanced MIDI Capabilities:**
*   Implement MIDI clock synchronization for tempo-based effects and rhythmic precision.
*   Allow mapping of MIDI controls to specific value ranges within parameters.
*   Support toggle actions for MIDI button/pad presses.
*   **LSP8 Collection Onboarding:** Streamline the process for community members to propose and for admins/curators to whitelist new, compatible LSP8 NFT collections.
*   **Performance Optimization:** Continuously refine and optimize the custom 2D rendering engine to ensure smooth performance across a diverse range of devices and browsers. Possibly check pixiJS/threeJS/collaborate with others on this. With potentially mobile optimization in
*   **Open Source Strategy:** Evaluate and potentially open-source key components, because only now I understand the true potential of creating an open system where others could just create new effects to add to RADAR.
*   **Deeper LUKSO Integration:** Actively integrate with new and maturing LUKSO Standard Proposals (LSPs) as they become widely adopted, further enhancing RADAR's capabilities within the ecosystem.
*   **(Future Idea) Theme Customization:** Allow users to customize the RADAR UI theme (colors, fonts) and save these preferences to their UP.
*   **(Future Idea) Layer Preparation:** Allow users to manipulate their owned assets prior to using them as layers within RADAR (as shown on the RADAR grid > tab > Layer Prep with some examples in the "Room 725" threeJS showroom) 
**(Future Idea) AR Integration:** I have already been playing around with the idea of scanning the UP QR code and overlaying the default radar key on top of it and it seems like this is not even a far fetched achievement. I have to look deeper into this but this is where LSP2 + reusable components are literally made for. 


## MIDI Control Setup

RADAR offers intuitive MIDI control over its visual parameters, allowing for a tactile and expressive performance experience. Your MIDI mappings are saved globally to your Universal Profile.

**Steps to Map Your MIDI Controller:**

1.  **Connect Your MIDI Controller:**
    *   Plug your MIDI controller (keyboard, knob/fader controller, drum pads, etc.) into your computer, typically via USB.
    *   Most modern MIDI controllers are class-compliant and should be automatically detected by your operating system and browser.
2.  **Enable MIDI in RADAR:**
    *   Locate the **Global MIDI Status button** in the RADAR interface (usually in the bottom-right corner, often represented by a MIDI plug icon).
    *   Click this button. It should indicate a "Connected" state if your controller is detected.
    *   *If it says "Disconnected" or shows an error, ensure your controller is properly connected and recognized by your system. You may need to click it again to initiate the connection.*
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
    *   Once you're satisfied with your mappings:
        *   Open the **Save Panel** (usually triggered by a write/disk icon).
        *   Look for an option like **"Save Global MIDI Map"** or an option to include MIDI settings when saving a visual preset.
        *   Click to save. This action writes your entire MIDI mapping configuration to the `RADAR.MIDI.ParameterMap` key on your Universal Profile.

**Key Benefits of RADAR's MIDI System:**

*   **Global & Persistent:** Your MIDI map is saved once to your UP and applies across *all* visual presets.
*   **Intuitive Learn Mode:** No manual entry of CC numbers or channels needed; just click and move.
*   **Cross-Profile Compatibility:** When viewing someone else's RADAR setup, *your* saved MIDI map controls *their* visual parameters.

Now your MIDI controller is your hands-on interface for sculpting visuals in RADAR!

## Audio Reactivity Setup (Using Virtual Audio Cable & Voicemeeter)

To make RADAR's visuals react to the audio playing on your computer (e.g., from your browser or music player), you can route your audio through Voicemeeter using a Virtual Audio Cable. This gives you fine-grained control.

**Prerequisites:**

*   **Voicemeeter** (Standard version or Banana/Potato) installed. Get it from [vb-audio.com/Voicemeeter/](https://vb-audio.com/Voicemeeter/).
*   **Restart your computer** after installing these.

**Steps:**

1.  **Route Desired Audio to Virtual Cable (Recommended for Browser/App Audio):**
    *   In Windows Sound settings ("Open Sound settings" -> "App volume and device preferences"):
        *   Find your web browser.
        *   Change its **Output** device to **"CABLE Input (VB-Audio Virtual Cable)"**.
    *   *Alternatively, for simpler system-wide audio capture (less granular), set "CABLE Input" as your Default Playback Device in Windows Sound settings (Playback tab).*

2.  **Configure Voicemeeter:**
    *   Open Voicemeeter.
    *   **Hardware Input 1 (Stereo Input 1 or 2):** Click its name and select **"CABLE Output (VB-Audio Virtual Cable)"**. This brings audio from the virtual cable *into* Voicemeeter.
        *   Ensure this channel is active (fader up, not muted). Enable its output to A1 (or your main hardware out) if you want to monitor this source through Voicemeeter.
    *   **Hardware Out (A1 is the MAIN OUT):** Click "A1" (last channel strip) and select your main speakers/headphones. Done.

4.  **Browser Permissions for RADAR:**
    *   When enabling Audio Reactivity in RADAR, your browser will ask for microphone permission.
    *   Select **"Voicemeeter Output"** (from step 3) as the microphone source.

**How it Works:** Your application sends sound to "CABLE Input." "CABLE Output" feeds this into Voicemeeter. Voicemeeter processes it, sends it to your speakers (via A1) AND to its own virtual "Voicemeeter Output." RADAR listens to "Voicemeeter Output" as a microphone.

This method allows selective audio routing for the visualizer.

Don't forget to manually add the application because you will need to allow following attributes:  <iframe src="https://radar725.netlify.app/" allow="microphone, midi, fullscreen"></iframe>

---
**A DETAILED VIDEO DEMO WILL FOLLOW SHORTLY.**
---

---
**725 PROBLEMS BUT MY DAPP AIN'T ONE. (But my coding might have some issues tho. Thanks for checking out RADAR!)**
---