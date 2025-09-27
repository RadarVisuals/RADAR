# 📦 Full Codebase Dump

---
### `eslint.config.js`
```js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import vitestPlugin from 'eslint-plugin-vitest'; // <--- Import the Vitest plugin

export default [
  { ignores: ["dist"] },
  { // General config for all JS/JSX files
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2020, // This can often be 'latest' too, matching parserOptions
      globals: {
        ...globals.browser, // Keep browser globals
        // Add any other custom globals for your main app code if needed
      },
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "no-unused-vars": ["error", { "varsIgnorePattern": "^[_A-Z]" }],
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Add any other general rules here
    },
  },
  { // Vitest specific configuration
    files: ['**/*.test.js', '**/*.test.jsx', '**/*.spec.js', '**/*.spec.jsx'], // Apply only to test files
    plugins: {
      vitest: vitestPlugin,
    },
    rules: {
      // You can include all recommended Vitest rules
      ...vitestPlugin.configs.recommended.rules,
      // Or pick specific rules if you prefer
      // e.g., 'vitest/expect-expect': 'error',

      // You might want to disable or adjust some general rules for test files
      // For example, if you use anonymous functions extensively in `it` blocks:
      // 'func-names': 'off',
    },
    languageOptions: {
      globals: {
        ...globals.browser, // It's good to keep browser globals if tests interact with DOM
        ...vitestPlugin.environments.globals.globals, // <--- Add Vitest globals
      }
    }
  }
];
```

---
### `index.html`
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React</title>
    <style>
      /* Ensure html and body take full height of the iframe's allocated space */
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: #000000; /* Base background */
        color: #00f3ff; /* Base text color */
        font-family: Arial, sans-serif;
        display: block; /* Explicitly block */
        /* --- ADDED: Prevent scroll chaining to parent page --- */
        overscroll-behavior: contain;
        /* ---------------------------------------------------- */
      }

      /* Ensure #root takes full height of the body */
      #root {
        width: 100%;
        height: 100%;
        margin: 0; /* Reset margin */
        padding: 0; /* Reset padding */
        overflow: hidden; /* Prevent scrollbars on root */
        display: block; /* Ensure it behaves as a block */
        position: relative; /* Needed if children use absolute positioning relative to root */
      }

      /* Style for the portal target - ensure it doesn't interfere */
      #portal-container {
        position: fixed; /* Or absolute, depending on need */
        top: 0;
        left: 0;
        width: 0; /* Takes no space */
        height: 0; /* Takes no space */
        z-index: 10000; /* High z-index for overlays */
        pointer-events: none; /* Allow clicks through container */
      }
      /* Allow pointer events on direct children */
      #portal-container > * {
         pointer-events: auto;
      }

    </style>
  </head>
  <body>
    <div id="root"></div>
    <!-- Add a dedicated container for portals outside the main app root -->
    <div id="portal-container"></div>
    <!-- The #decoded-image-pool div has been removed -->
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

---
### `netlify\functions\unpin.js`
```js
// netlify/functions/unpin.js

export const handler = async (event) => {
  // Netlify automatically provides the handler function with an 'event' object.

  // 1. Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  // 2. Parse the CID from the request body
  let cid;
  try {
    const body = JSON.parse(event.body);
    cid = body.cid;
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  // 3. Validate the CID format (CIDv0 or CIDv1)
  const cidRegex = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[A-Za-z2-7]{58,})$/;
  if (!cid || typeof cid !== 'string' || !cidRegex.test(cid)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid or missing CID format' }),
    };
  }

  // 4. Get your secret Pinata JWT from Netlify's environment variables
  const PINATA_JWT = process.env.PINATA_JWT; // Use a non-prefixed variable for backend secrets

  if (!PINATA_JWT) {
    console.error('Server Error: PINATA_JWT environment variable is not set on Netlify.');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  // 5. Call the Pinata API to unpin the file
  try {
    // Use the globally available fetch in the Netlify runtime
    const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Pinata API Error (${response.status}) for CID ${cid}: ${errorData}`);
      // Don't expose detailed Pinata errors to the client for security.
      return {
        statusCode: 502, // Bad Gateway, since we had an issue with an upstream service
        body: JSON.stringify({ error: 'Failed to communicate with pinning service.' }),
      };
    }

    // 6. Return a success response
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: `Unpin request for ${cid} successful.` }),
    };

  } catch (error) {
    console.error(`Internal error while trying to unpin CID ${cid}:`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'An internal server error occurred.' }),
    };
  }
};
```

---
### `package.json`
```json
{
  "name": "radar",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --open",
    "build": "vite build",
    "lint": "eslint . --ext .js,.jsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint . --ext .js,.jsx --fix",
    "format": "prettier --write \"src/**/*.{js,jsx,css,json,md}\" ./*.{js,json,md}",
    "preview": "vite preview",
    "audit": "npm audit --audit-level=high",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@erc725/erc725.js": "^0.27.2",
    "@heroicons/react": "^2.2.0",
    "@lukso/lsp-smart-contracts": "^0.16.3",
    "@lukso/up-provider": "^0.3.5",
    "@p5-wrapper/react": "^4.4.2",
    "buffer": "^6.0.3",
    "ethers": "^6.13.5",
    "lodash-es": "^4.17.21",
    "pixi.js": "^8.8.1",
    "prop-types": "^15.8.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "viem": "^2.27.0"
  },
  "devDependencies": {
    "@eslint/js": "^8.57.0",
    "@testing-library/jest-dom": "^6.4.6",
    "@testing-library/react": "^15.0.7",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "@vitest/coverage-v8": "^1.6.0",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-prettier": "^5.1.3",
    "eslint-plugin-react": "^7.34.2",
    "eslint-plugin-react-hooks": "^4.6.2",
    "eslint-plugin-react-refresh": "^0.4.7",
    "eslint-plugin-vitest": "^0.5.4",
    "globals": "^15.4.0",
    "jsdom": "^24.1.0",
    "prettier": "^3.3.2",
    "vite": "^5.3.1",
    "vitest": "^1.6.0"
  }
}
```

---
### `README.md`
```md
# RADAR - Reactive Asset Driven Audio Receiver

<p align="center">
  <img src="./src/assets/branding/radarwordmarkblue.svg" alt="RADAR Logo" width="400"/>
</p>

**RADAR is determined to set the bar for NFT interaction on the LUKSO blockchain. It's a dynamic, multi-layer visual synthesizer that transforms your LSP8 NFTs into living art, reacting in real-time to audio, MIDI, and on-chain Universal Profile events. RADAR empowers you to move beyond passive collection and become an active creator and performer with your digital assets.**

---

<p align="center">
  <a href="https://www.youtube.com/watch?v=eFxECO9I888&t=327s" target="_blank" rel="noopener noreferrer">
    <img src="./src/assets/branding/radar_demo_thumbnail.png" alt="Watch the RADAR Demo Video!" width="600" style="max-width: 100%;">
  </a>
  <br/>
  <em>Click the image above to watch the RADAR demo video!</em>
</p>

---

## The RADAR Vision: From Collector to Creator

RADAR challenges the notion of NFTs as static collectibles and believe that true digital ownership, powered by LUKSO's Universal Profiles, unleashes a new universe of dynamic use-cases and ignites the imagination for what NFT 2.0 can truly become.

*   **Your NFTs, Your Engine:** Don't let your assets gather virtual dust. RADAR treats your LSP8 NFTs as visual engines, ready to be manipulated and brought to life.
*   **Ownership is Control & Creation:** Go beyond just holding. Layer, glitch, blend, and animate your assets. Save an infinite number of unique visual setups directly onto your Universal Profile.
*   **Decentralized & Composable:** All your creations—visual presets, MIDI mappings, custom color-coded event reactions—are stored on your UP using ERC725Y keys. Your data, ready for a future of shared, community-driven visual experiences.

## The RADAR Genesis Collection & The Future of Asset Utility

Following this hackathon and team feedback, the official **RADAR 1.0 Beta** will launch, headlined by the **RADAR Genesis Collection**: a massive 8,000-piece LSP8 NFT collection designed by RADAR's founder/creator, VXCTXR, specifically to showcase what NFT 2.0 can offer.

*   **Benchmark for Asset Design:** The RADAR Genesis Collection will set the standard for how assets should be prepared for optimal use within the visualizer.
*   **The Value of Artistic Preparation:**
    *   **Isolation & Whitespace:** Assets must be properly isolated within their "NFT canvas," not touching borders, which prevents undesirable straight lines during rotation and scaling.
    *   **Intentional Gaps:** Optimal designs incorporate "gaps" or negative space, allowing underlying layers to show through, creating depth and intricate visual interplay.
    *   **Championing Thoughtful Design:** RADAR inherently values meticulous artistry. Simplistic, mass-generated, or AI-created assets (e.g., fully colored squares) will appear as just that – rotating squares – offering little dynamic value and obscuring interaction with underlying layers. This encourages more intricate and consciously prepared designs.
*   **Redefining Value Beyond Traits:** RADAR shifts the focus from randomly allocated traits dictating perceived value to intrinsic artistic merit. For the first time, collect an asset for its color palette, an admired detail, or its potential within the RADAR engine, not just its "rarity score." **Making ART about the ART again.**
*   **Artistic Effort Rewarded:** In a space often dominated by mass-generated collections, RADAR champions the time, skill, and artistic vision invested in creating assets truly suited for dynamic visual experiences.
*   **New Perspectives on Creation:** While the technology is cool, perception and creativity often hold us back. RADAR is one piece of the puzzle. A quick glance at the "layer preparation grid" tab reveals how I plan to overhaul conceptual blockers: by providing asset owners with tools to deconstruct and reconstruct, the collector immediately becomes a creator. This opens entirely new perspectives on asset interaction, potentially making RADAR the largest community-driven visualizer in existence. See a few transformations in the "Room725" tab.

---

> **Important Note on Embedding/Permissions:**
> If you plan to embed RADAR ensure you grant the necessary permissions for full functionality. You will need to allow the following attributes:
> ```html
> <iframe src="https://radar725.netlify.app/" allow="microphone; midi; fullscreen"></iframe>
> ```
> Failure to include these `allow` attributes will prevent microphone access (for audio reactivity) and MIDI access (for controller input).

---

## Core Features & Technologies

RADAR integrates deeply with LUKSO's philosophy and innovative architecture:

*   **Dynamic NFT Visualization (3-Layer Engine):**
    *   Assign LSP8 NFTs (initially from 40 pre-loaded demo tokens, later from the RADAR Genesis collection and other whitelisted collections) to three distinct visual layers.
    *   Manipulate each layer's `Speed`, `Size`, `Opacity`, `X/Y Position`, `Drift`, `Angle`, `Direction`, and `Blend Mode`.
    *   **Note (Hackathon Scope):** For this hackathon, the on-chain whitelist management panel for adding new LSP7/LSP8 collections is temporarily disabled. To facilitate immediate experimentation, RADAR includes 40 pre-loaded demo tokens. The underlying ERC725Y data storage (`RADAR.WhitelistedCollections`) and retrieval mechanisms for whitelists are implemented and await feedback.

*   **Audio Reactivity (Web Audio API):**
    *   Layers pulsate and resize in response to audio frequencies (Bass -> Bottom Layer, Mid -> Middle Layer, Treble -> Top Layer) and overall beat detection.
    *   A custom Sawtooth-Sinewave hybrid algorithm smoothly blends audio-driven layer interactions.

*   **Tactile MIDI Control (Web MIDI API):**
    *   Intuitive **MIDI Learn** for all visual parameters.
    *   **Global MIDI Map:** Your controller mapping is saved to `RADAR.MIDI.ParameterMap` on your Universal Profile, ensuring consistent control across all presets.

*   **On-Chain Event Reactions (LSP1 UniversalReceiver):**
    *   Visual effects triggered by on-chain events on your UP (e.g., receiving LYX, tokens).
    *   **Global Event Reactions:** Rulesets stored on *your* UP via `RADAR.EventReactions`.

*   **Decentralized Configuration Storage (ERC725Y):**
    RADAR leverages your Universal Profile for true data ownership:
    1.  **Visual Presets (Map: `RADAR.NamedConfiguration:<nameHash>`):** Store infinite unique visual setups.
    2.  **Preset Index (Array: `RADAR.SavedConfigurationList[]`):** Lists your saved presets.
    3.  **Default Preset (Singleton: `RADAR.DefaultConfigurationName`):** Designates your profile's default RADAR experience.

## The Universal Profile as a Creative Hub

RADAR transforms the Universal Profile from a mere wallet or identity layer into a dynamic canvas and creative launchpad.

*   **Collector Becomes Creator:** By loading an asset into RADAR and manipulating its parameters, you become the artist. The visual configurations you save to your UP are new, derived creations—your unique way of "minting" new visual experiences from the assets you hold.
*   **Cross-Profile VJing & Spectating:** This is where the power of decentralized, on-chain configurations truly shines:
    *   Visit another user's Universal Profile running RADAR.
    *   Load their saved visual presets and witness their unique artistic interpretations of their assets.
    *   If you have a MIDI controller, *your* global MIDI map (from your UP) can control the parameters of *their* presets, enabling unprecedented live, cross-profile VJing.
    *   See their on-chain events trigger their personally configured visual reactions.
*   **Future of Whitelist & Community Curation:** Post-hackathon, activating the whitelist panel within RADAR.

This interplay of personal creation, shared experiences, and on-chain identity only scratches the surface of the possibilities achievable with LUKSO's architecture.

---

## Bonus: Creative Suite Extensions (Testable in Grid Tabs)

Beyond the core visualizer, RADAR is expanding with tools that further empower your creative journey:

*   **RADAR Layer Prep Tool:**
    *   **Concept:** Don't just use your NFTs as-is; transform them! This experimental tool (available under the "Grid" -> "RADAR Layer Prep" tab) allows you to load your existing NFTs and deconstruct/reconstruct them into new visual components optimized for RADAR's layering engine.
    *   **Become the Artist:** Manipulate, crop, and combine elements from your NFTs to create entirely new, unique assets ready to be fed back into the RADAR visualizer. This truly puts the power of asset creation into your hands.
    *   *(See example outcomes in the "Room 725" tab after prepping an asset!)*

*   **Room 725 - 3D Showroom:**
    *   **Concept:** Experience your original NFTs and your newly created "prepped" assets in an immersive, first-person 3D environment.
    *   **Walkable Gallery:** Navigate this virtual space (available under the "Grid" -> "Room 725" tab) to see your digital art come to life in a new dimension. It's a unique way to appreciate the transformation from original asset to RADAR-ready component and then to dynamic visual synthesis.

These experimental features showcase the ongoing commitment to making RADAR the most comprehensive platform for NFT interaction, creation, and exhibition. Dive into the "Grid" section of the app to explore these powerful additions!

---

## Roadmap Highlights

*   **Visual Effect Expansion:** More effects, parameter interpolation, "P-locking" concepts.
*   **Advanced MIDI:** Clock sync, value range mapping, toggle actions.
*   **LSP8 Collection Onboarding:** Streamlined community whitelisting, artist onboarding guidelines.
*   **Performance Optimization:** Custom 2D engine refinement.
*   **AR Integration:** QR / AR art marker overlay directly integrating the UP QR.
*   **Open Source Strategy:** Evaluate open-sourcing key components.
*   **Deeper LUKSO Integration:** Continuously explore and implement new LUKSO standards and features.
*   **The Vision:** RADAR is an extremely well-aimed and positioned first step with a clear artistic direction and an innovative mindset, poised to redefine interactive asset utility.

---

## Setup Guides

### MIDI Control Setup

RADAR offers intuitive MIDI control over its visual parameters, allowing for a tactile and expressive performance experience. Your MIDI mappings are saved globally to your Universal Profile.
For reference, I use a Novation Launchcontrol XL MIDI controller, set up my complete mapping (24 parameters) and save it once to the global MIDI key. This one is accessible for me across all other profiles.

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

### Audio Reactivity Setup (Using Virtual Audio Cable & Voicemeeter)

To make RADAR's visuals react to the audio playing on your computer (e.g., from your browser or music player), you can route your audio through Voicemeeter using a Virtual Audio Cable. This gives you fine-grained control.

**Prerequisites:**

*   **Voicemeeter** (Standard version or Banana/Potato) installed. Get it from [vb-audio.com/Voicemeeter/](https://vb-audio.com/Voicemeeter/).
*   **VB-CABLE Virtual Audio Cable** installed. Get it from [vb-audio.com/Cable/](https://vb-audio.com/Cable/).
*   **Restart your computer** after installing these.

**Steps:**

1.  **Route Desired Audio to Virtual Cable (Recommended for Browser/App Audio):**
    *   In Windows Sound settings ("Open Sound settings" -> "App volume and device preferences"):
        *   Find your web browser (or the specific application whose audio you want to capture).
        *   Change its **Output** device to **"CABLE Input (VB-Audio Virtual Cable)"**.
    *   *Alternatively, for simpler system-wide audio capture (less granular), set "CABLE Input" as your Default Playback Device in Windows Sound settings (Playback tab).*

2.  **Configure Voicemeeter:**
    *   Open Voicemeeter.
    *   **Hardware Input 1 (Stereo Input 1 or 2):** Click its name (e.g., "Hardware Input 1") and select **"CABLE Output (VB-Audio Virtual Cable)"**. This brings audio from the virtual cable *into* Voicemeeter.
        *   Ensure this channel strip is active (fader is up, not muted - check A/B buttons if using Banana/Potato). Enable its output route to **A1** (your main hardware out) if you want to monitor this source through Voicemeeter.
    *   **Hardware Out (A1):** Click "A1" (under Hardware Out section) and select your main speakers/headphones (e.g., "WDM: Speakers (Realtek Audio)").

3.  **Browser Permissions for RADAR:**
    *   When enabling Audio Reactivity in RADAR for the first time, your browser will ask for microphone permission.
    *   In the permission prompt, select **"Voicemeeter Output (VB-Audio Voicemeeter VAIO)"** (or similar, depending on Voicemeeter version) as the microphone source. **Do not select CABLE Output or your physical microphone here.**

**How it Works:** Your target application (e.g., browser) sends its sound output to the virtual "CABLE Input". The other end of this virtual cable, "CABLE Output", is selected as an *input* in Voicemeeter. Voicemeeter processes this audio and sends it to two places: your speakers/headphones (via Hardware Out A1) and its own internal virtual output, "Voicemeeter Output". RADAR then listens to this "Voicemeeter Output" as if it were a microphone, capturing the audio you routed into Voicemeeter.

This method allows selective audio routing for the visualizer without needing to capture *all* system sound or use a physical loopback.
```

---
### `src\App.jsx`
```jsx
// src/App.jsx
import React, { useEffect, useState, useCallback } from "react";
import MainView from "./components/Main/Mainview";
import StartVeil from "./components/UI/StartVeil";
import { useWorkspaceContext } from "./context/WorkspaceContext"; // Import the hook

function App() {
  const [hasUserInitiated, setHasUserInitiated] = useState(false);
  
  // Get the context function to manually trigger the load
  const { startLoadingProcess } = useWorkspaceContext();

  useEffect(() => {
    const staticLoader = document.querySelector('.static-loader');
    if (staticLoader) {
      staticLoader.remove();
    }
  }, []);

  const handleStart = useCallback(() => {
    setHasUserInitiated(true);
    // When the user clicks "Enter", we explicitly tell the AppProvider to begin loading.
    if (startLoadingProcess) {
      startLoadingProcess();
    }
  }, [startLoadingProcess]);

  return (
    <div className="app">
      {!hasUserInitiated ? (
        <StartVeil onStart={handleStart} />
      ) : (
        <MainView />
      )}
    </div>
  );
}

export default App;
```

---
### `src\components\Audio\AudioAnalyzer.jsx`
```jsx
// src/components/Audio/AudioAnalyzer.jsx
import React, { useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";

// Default values for layer parameters if not provided by layerConfigs
const DEFAULT_LAYER_VALUES = {
    size: 1.0, // Default base size for layers if not specified in their config
};
const DEFAULT_SMOOTHING = 0.6; // Default smoothing factor for the AnalyserNode
const FFT_SIZE = 2048; // Standard FFT size for frequency analysis

/**
 * @typedef {object} AudioAnalyzerProps
 * @property {(data: import('../../hooks/useAudioVisualizer').RawAudioAnalyzerData) => void} [onAudioData] - Callback function invoked with new audio analysis data (level, frequency bands, timestamp).
 * @property {boolean} [isActive=false] - If true, the component attempts to access the microphone and start audio analysis.
 * @property {import('../../context/VisualConfigContext').AllLayerConfigs} [layerConfigs] - Current configurations for all visual layers. Used to get base values for audio-reactive parameters.
 * @property {import('../../hooks/useAudioVisualizer').AudioVisualizerSettings} [audioSettings] - Current settings for audio processing and analysis (e.g., intensity multipliers, smoothing factor).
 * @property {number} [configLoadNonce] - A nonce that changes when a new global configuration (scene) is loaded. Used to detect scene changes and potentially reset or adjust audio reactivity baselines.
 * @property {React.RefObject<Object.<string, import('../../utils/CanvasManager').default>>} managerInstancesRef - Ref to the canvas manager instances, used to apply audio-driven visual modifications directly.
 */

/**
 * AudioAnalyzer: A non-visual component responsible for capturing microphone input,
 * analyzing the audio stream to extract level and frequency band data, and then
 * applying these data to visual layers via `CanvasManager` instances.
 * It also calls `onAudioData` with the processed information for other consumers.
 * The component manages the lifecycle of the `AudioContext` and `AnalyserNode`.
 *
 * @param {AudioAnalyzerProps} props - The component's props.
 * @returns {null} This component does not render any visible UI.
 */
const AudioAnalyzer = ({
  onAudioData,
  isActive = false,
  layerConfigs: layerConfigsProp,
  audioSettings: audioSettingsProp,
  configLoadNonce,
  managerInstancesRef,
}) => {
  /** @type {React.RefObject<import('../../hooks/useAudioVisualizer').AudioVisualizerSettings | undefined>} */
  const audioSettingsRef = useRef(audioSettingsProp);
  /** @type {React.RefObject<Object.<string, {size: number}>>} */
  const baseLayerValuesRef = useRef({ // Stores base 'size' for each layer before audio modulation
      '1': { size: DEFAULT_LAYER_VALUES.size },
      '2': { size: DEFAULT_LAYER_VALUES.size },
      '3': { size: DEFAULT_LAYER_VALUES.size },
  });
  /** @type {React.RefObject<number>} */
  const capturedNonceRef = useRef(-1); // Tracks the last processed configLoadNonce
  
  /** @type {React.RefObject<AudioContext | null>} */
  const audioContextRef = useRef(null);
  /** @type {React.RefObject<AnalyserNode | null>} */
  const analyserRef = useRef(null);
  /** @type {React.RefObject<MediaStreamAudioSourceNode | null>} */
  const sourceRef = useRef(null);
  /** @type {React.RefObject<number | null>} */
  const animationFrameRef = useRef(null);
  /** @type {React.RefObject<Uint8Array | null>} */
  const dataArrayRef = useRef(null);
  /** @type {React.RefObject<MediaStream | null>} */
  const streamRef = useRef(null);
  /** @type {React.RefObject<boolean>} */
  const isCleanupScheduledRef = useRef(false); // Prevents redundant cleanup calls

  // Update audio settings ref and AnalyserNode smoothing when props change
  useEffect(() => {
    audioSettingsRef.current = audioSettingsProp;
    if (analyserRef.current && audioContextRef.current && audioContextRef.current.state === "running") {
        try {
            const smoothing = audioSettingsRef.current?.smoothingFactor ?? DEFAULT_SMOOTHING;
            analyserRef.current.smoothingTimeConstant = Math.max(0, Math.min(1, smoothing));
        }
        catch (e) {
            if (import.meta.env.DEV) console.warn("[AudioAnalyzer] Error setting smoothingTimeConstant:", e);
        }
    }
  }, [audioSettingsProp]);

  // Update base layer values when a new scene is loaded
  useEffect(() => {
    if (layerConfigsProp && configLoadNonce !== capturedNonceRef.current) {
        const newBaseValues = {};
        for (const layerIdStr of ['1', '2', '3']) { // Assuming fixed layer IDs
            const config = layerConfigsProp[layerIdStr] || {};
            newBaseValues[layerIdStr] = { size: config.size ?? DEFAULT_LAYER_VALUES.size };
        }
        baseLayerValuesRef.current = newBaseValues;
        capturedNonceRef.current = configLoadNonce;
    }
  }, [configLoadNonce, layerConfigsProp]);

  // Applies calculated audio data (bands, level) to canvas managers for visual effects
  const applyAudioToLayers = useCallback((bands, level) => {
    const managers = managerInstancesRef?.current;
    const currentSettings = audioSettingsRef.current;

    if (!managers || !currentSettings) {
        return;
    }

    const { bassIntensity = 1.0, midIntensity = 1.0, trebleIntensity = 1.0 } = currentSettings;

    // Apply bass frequency to layer 1 size
    const bassEffectMagnitude = bands.bass * 0.8 * bassIntensity;
    const finalBassFactor = 1 + bassEffectMagnitude;
    if (managers['1'] && typeof managers['1'].setAudioFrequencyFactor === 'function') {
        managers['1'].setAudioFrequencyFactor(Math.max(0.1, finalBassFactor));
    }

    // Apply mid frequency to layer 2 size
    const midEffectMagnitude = bands.mid * 1.0 * midIntensity;
    const finalMidFactor = 1 + midEffectMagnitude;
    if (managers['2'] && typeof managers['2'].setAudioFrequencyFactor === 'function') {
        managers['2'].setAudioFrequencyFactor(Math.max(0.1, finalMidFactor));
    }

    // Apply treble frequency to layer 3 size
    const trebleEffectMagnitude = bands.treble * 2.0 * trebleIntensity;
    const finalTrebleFactor = 1 + trebleEffectMagnitude;
    if (managers['3'] && typeof managers['3'].setAudioFrequencyFactor === 'function') {
        managers['3'].setAudioFrequencyFactor(Math.max(0.1, finalTrebleFactor));
    }

    // Trigger a beat pulse effect on all layers if conditions are met
    if (level > 0.4 && bands.bass > 0.6) {
      const pulseMultiplier = 1 + level * 0.8;
      Object.keys(managers).forEach(layerIdStr => {
        const manager = managers[layerIdStr];
        if (manager && typeof manager.triggerBeatPulse === 'function') {
          manager.triggerBeatPulse(Math.max(0.1, pulseMultiplier), 80);
        }
      });
    }
  }, [managerInstancesRef]);

  // Processes raw frequency data from AnalyserNode into level and bands
  const processAudioData = useCallback((dataArray) => {
    if (!dataArray || !analyserRef.current) return;
    const bufferLength = analyserRef.current.frequencyBinCount;
    if (bufferLength === 0) return;

    let sum = 0; for (let i = 0; i < bufferLength; i++) { sum += dataArray[i]; }
    const averageLevel = sum / bufferLength / 255;

    const bassEndIndex = Math.floor(bufferLength * 0.08);
    const midEndIndex = bassEndIndex + Math.floor(bufferLength * 0.35);

    let bassSum = 0, midSum = 0, trebleSum = 0;
    let bassCount = 0, midCount = 0, trebleCount = 0;

    for (let i = 0; i < bufferLength; i++) {
        if (i < bassEndIndex) { bassSum += dataArray[i]; bassCount++; }
        else if (i < midEndIndex) { midSum += dataArray[i]; midCount++; }
        else { trebleSum += dataArray[i]; trebleCount++; }
    }

    const bass = Math.min(1, bassCount > 0 ? (bassSum / bassCount / 255) : 0);
    const mid = Math.min(1, midCount > 0 ? (midSum / midCount / 255) : 0);
    const treble = Math.min(1, trebleCount > 0 ? (trebleSum / trebleCount / 255) : 0);
    
    const newFrequencyBands = { bass, mid, treble };
    applyAudioToLayers(newFrequencyBands, averageLevel);

    if (typeof onAudioData === "function") {
      onAudioData({ level: averageLevel, frequencyBands: newFrequencyBands, timestamp: Date.now() });
    }
  }, [onAudioData, applyAudioToLayers]);

  // Main audio analysis loop using requestAnimationFrame
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !isActive || !audioContextRef.current || audioContextRef.current.state !== 'running') {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }
    try {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        processAudioData(dataArrayRef.current);
    } catch (e) {
        if (import.meta.env.DEV) console.error("[AudioAnalyzer analyzeAudio] Error in getByteFrequencyData or processAudioData:", e);
    }
    if (typeof requestAnimationFrame === 'function') {
        animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    }
  }, [isActive, processAudioData]);

  // Sets up the AudioContext, AnalyserNode, and connects the microphone stream
  const setupAudioAnalyzer = useCallback(async (stream) => {
    if (import.meta.env.DEV) console.log("[AudioAnalyzer setupAudioAnalyzer] Attempting to set up audio analyzer...");
    try {
      if (!audioContextRef.current) {
        const AudioContextGlobal = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextGlobal) {
            if (import.meta.env.DEV) console.error("[AudioAnalyzer setupAudioAnalyzer] AudioContext not supported!");
            return;
        }
        audioContextRef.current = new AudioContextGlobal();
        if (import.meta.env.DEV) console.log("[AudioAnalyzer setupAudioAnalyzer] AudioContext created. Sample rate:", audioContextRef.current.sampleRate);
      }

      if (audioContextRef.current.state === "suspended") {
        if (import.meta.env.DEV) console.log("[AudioAnalyzer setupAudioAnalyzer] AudioContext is suspended, attempting to resume...");
        await audioContextRef.current.resume();
        if (import.meta.env.DEV) console.log(`[AudioAnalyzer setupAudioAnalyzer] AudioContext resumed. State: ${audioContextRef.current.state}`);
      }
      if (audioContextRef.current.state !== "running") {
          if (import.meta.env.DEV) console.error(`[AudioAnalyzer setupAudioAnalyzer] AudioContext not running after resume attempt. State: ${audioContextRef.current.state}`);
          return;
      }

      if (!analyserRef.current) {
        analyserRef.current = audioContextRef.current.createAnalyser();
        if (import.meta.env.DEV) console.log("[AudioAnalyzer setupAudioAnalyzer] AnalyserNode created.");
      }

      const initialSmoothing = audioSettingsRef.current?.smoothingFactor ?? DEFAULT_SMOOTHING;
      analyserRef.current.fftSize = FFT_SIZE;
      analyserRef.current.smoothingTimeConstant = Math.max(0, Math.min(1, initialSmoothing));
      analyserRef.current.minDecibels = -90;
      analyserRef.current.maxDecibels = -10;

      const bufferLength = analyserRef.current.frequencyBinCount;
      if (bufferLength === 0) {
          if (import.meta.env.DEV) console.error("[AudioAnalyzer setupAudioAnalyzer] Analyser frequencyBinCount is 0. FFT setup issue?");
          return;
      }
      dataArrayRef.current = new Uint8Array(bufferLength);
      if (import.meta.env.DEV) console.log(`[AudioAnalyzer setupAudioAnalyzer] Data array created with length: ${bufferLength}`);

      if (sourceRef.current) {
        try {
            sourceRef.current.disconnect();
            if (import.meta.env.DEV) console.log("[AudioAnalyzer setupAudioAnalyzer] Disconnected previous source.");
        } catch (disconnectError) {
            if (import.meta.env.DEV) console.warn("[AudioAnalyzer setupAudioAnalyzer] Error disconnecting previous source:", disconnectError);
        }
      }
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      if (import.meta.env.DEV) console.log("[AudioAnalyzer setupAudioAnalyzer] MediaStreamSource created and connected to analyser.");

      if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
      }
      if (typeof requestAnimationFrame === 'function') {
        animationFrameRef.current = requestAnimationFrame(analyzeAudio);
        if (import.meta.env.DEV) console.log("[AudioAnalyzer setupAudioAnalyzer] Audio analysis loop started.");
      }
      isCleanupScheduledRef.current = false;

    } catch (e) {
      if (import.meta.env.DEV) console.error("[AudioAnalyzer setupAudioAnalyzer] Error setting up audio analyzer:", e);
    }
  }, [analyzeAudio]);

  const requestMicrophoneAccess = useCallback(async () => {
    if (import.meta.env.DEV) console.log("[AudioAnalyzer requestMicrophoneAccess] Requesting microphone access...");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (import.meta.env.DEV) console.error("[AudioAnalyzer requestMicrophoneAccess] Microphone access not supported by this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
      if (import.meta.env.DEV) console.log("[AudioAnalyzer requestMicrophoneAccess] Microphone access granted.");
      streamRef.current = stream;
      await setupAudioAnalyzer(stream);
    } catch (err) {
      if (import.meta.env.DEV) console.error("[AudioAnalyzer requestMicrophoneAccess] Error accessing microphone:", err.name, err.message);
    }
  }, [setupAudioAnalyzer]);

  const cleanupAudio = useCallback(() => {
    if (isCleanupScheduledRef.current) return;
    isCleanupScheduledRef.current = true;
    if (import.meta.env.DEV) console.log("[AudioAnalyzer cleanupAudio] Initiating audio resources cleanup...");

    if (animationFrameRef.current && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      if (import.meta.env.DEV) console.log("[AudioAnalyzer cleanupAudio] Animation frame cancelled.");
    }

    const managers = managerInstancesRef?.current;
    if (managers) {
        Object.values(managers).forEach(manager => {
            if (manager && typeof manager.resetAudioModifications === 'function') {
                manager.resetAudioModifications();
            }
        });
        if (import.meta.env.DEV) console.log("[AudioAnalyzer cleanupAudio] Audio modifications reset on managers.");
    }

    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
        if (import.meta.env.DEV) console.log("[AudioAnalyzer cleanupAudio] Source node disconnected.");
      } catch (e) {
        if (import.meta.env.DEV) console.warn("[AudioAnalyzer cleanupAudio] Error disconnecting source node:", e.message);
      }
      sourceRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        if (import.meta.env.DEV) console.log(`[AudioAnalyzer cleanupAudio] MediaStreamTrack stopped: ${track.label || track.id}`);
      });
      streamRef.current = null;
    }

    if (audioContextRef.current) {
        if (audioContextRef.current.state === "running") {
            audioContextRef.current.suspend()
                .then(() => {
                    if (import.meta.env.DEV) console.log("[AudioAnalyzer cleanupAudio] AudioContext suspended.");
                })
                .catch((e) => {
                    if (import.meta.env.DEV) console.error("[AudioAnalyzer cleanupAudio] Error suspending AudioContext:", e);
                })
                .finally(() => {
                    isCleanupScheduledRef.current = false;
                });
        } else {
            if (import.meta.env.DEV) console.log(`[AudioAnalyzer cleanupAudio] AudioContext not running (state: ${audioContextRef.current.state}), no suspend needed.`);
            isCleanupScheduledRef.current = false;
        }
    } else {
        isCleanupScheduledRef.current = false;
    }
    if (import.meta.env.DEV) console.log("[AudioAnalyzer cleanupAudio] Cleanup process finished.");
  }, [managerInstancesRef]);

  useEffect(() => {
    if (isActive) {
      if (import.meta.env.DEV) console.log("[AudioAnalyzer] isActive is true. Requesting microphone access.");
      requestMicrophoneAccess();
    } else {
      if (import.meta.env.DEV) console.log("[AudioAnalyzer] isActive is false. Cleaning up audio.");
      cleanupAudio();
    }
    return () => {
        if (isActive) {
            cleanupAudio();
        }
    };
  }, [isActive, requestMicrophoneAccess, cleanupAudio]);

  useEffect(() => {
    return () => {
      if (import.meta.env.DEV) console.log("[AudioAnalyzer] Component unmounting. Performing final cleanup.");
      cleanupAudio();
      if (audioContextRef.current) {
        audioContextRef.current.close().then(() => {
            if (import.meta.env.DEV) console.log("[AudioAnalyzer] AudioContext closed on unmount.");
        }).catch(e => {
            if (import.meta.env.DEV) console.error("[AudioAnalyzer] Error closing AudioContext on unmount:", e);
        });
        audioContextRef.current = null;
      }
    };
  }, [cleanupAudio]);

  return null;
};

AudioAnalyzer.propTypes = {
  onAudioData: PropTypes.func,
  isActive: PropTypes.bool,
  layerConfigs: PropTypes.object,
  audioSettings: PropTypes.object,
  configLoadNonce: PropTypes.number,
  managerInstancesRef: PropTypes.object.isRequired,
};

export default AudioAnalyzer;
```

---
### `src\components\Audio\AudioAnalyzer.test.jsx`
```jsx
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import AudioAnalyzer from './AudioAnalyzer'; // Adjust path as necessary

// --- Mocks ---
const mockGetByteFrequencyData = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockStop = vi.fn();
const mockResume = vi.fn();
const mockSuspend = vi.fn();
const mockClose = vi.fn();

const mockAnalyserNode = {
  connect: mockConnect,
  disconnect: mockDisconnect,
  getByteFrequencyData: mockGetByteFrequencyData,
  smoothingTimeConstant: 0.8,
  fftSize: 2048,
  minDecibels: -100,
  maxDecibels: -30,
  frequencyBinCount: 1024, 
};

const mockAudioSourceNode = {
  connect: mockConnect,
  disconnect: mockDisconnect,
};

const mockAudioContextInstance = {
  createAnalyser: vi.fn(() => mockAnalyserNode),
  createMediaStreamSource: vi.fn(() => mockAudioSourceNode),
  resume: mockResume,
  suspend: mockSuspend,
  close: mockClose,
  state: 'suspended', 
  sampleRate: 48000,
};

const mockMediaStream = {
  getTracks: vi.fn(() => [{ stop: mockStop, label: 'mockAudioTrack' }]),
};

vi.stubGlobal('AudioContext', vi.fn(() => mockAudioContextInstance));
vi.stubGlobal('webkitAudioContext', vi.fn(() => mockAudioContextInstance));

vi.stubGlobal('navigator', {
  mediaDevices: {
    getUserMedia: vi.fn(),
  },
});

let rafCallback = null;
vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
  rafCallback = cb;
  return Date.now(); 
}));
vi.stubGlobal('cancelAnimationFrame', vi.fn());

const mockSetAudioFrequencyFactor = vi.fn();
const mockTriggerBeatPulse = vi.fn();
const mockResetAudioModifications = vi.fn();

const mockManagerInstancesRef = {
  current: {
    '1': {
      setAudioFrequencyFactor: mockSetAudioFrequencyFactor,
      triggerBeatPulse: mockTriggerBeatPulse,
      resetAudioModifications: mockResetAudioModifications,
    },
    '2': {
      setAudioFrequencyFactor: mockSetAudioFrequencyFactor,
      triggerBeatPulse: mockTriggerBeatPulse,
      resetAudioModifications: mockResetAudioModifications,
    },
    '3': {
      setAudioFrequencyFactor: mockSetAudioFrequencyFactor,
      triggerBeatPulse: mockTriggerBeatPulse,
      resetAudioModifications: mockResetAudioModifications,
    },
  },
};

const advanceRAF = () => {
  if (rafCallback) {
    const currentCb = rafCallback;
    rafCallback = null;
    act(() => {
      currentCb(performance.now());
    });
  }
};

describe('AudioAnalyzer', () => {
  let onAudioDataMock;

  beforeEach(() => {
    vi.useFakeTimers();
    onAudioDataMock = vi.fn();
    mockAudioContextInstance.state = 'suspended'; 

    mockGetByteFrequencyData.mockClear();
    mockGetByteFrequencyData.mockImplementation((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = (i % 2 === 0) ? 128 : 64;
      }
    });
    mockConnect.mockClear();
    mockDisconnect.mockClear();
    mockStop.mockClear();

    mockResume.mockClear();
    mockResume.mockImplementation(async () => {
        mockAudioContextInstance.state = 'running';
    });

    mockSuspend.mockClear().mockResolvedValue(undefined);
    mockClose.mockClear().mockResolvedValue(undefined);

    mockAudioContextInstance.createAnalyser.mockClear();
    mockAudioContextInstance.createMediaStreamSource.mockClear();
    
    global.navigator.mediaDevices.getUserMedia.mockClear().mockResolvedValue(mockMediaStream);

    rafCallback = null;
    global.requestAnimationFrame.mockClear();
    global.cancelAnimationFrame.mockClear();

    mockSetAudioFrequencyFactor.mockClear();
    mockTriggerBeatPulse.mockClear();
    mockResetAudioModifications.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('renders null', () => {
    const { container } = render(
      <AudioAnalyzer managerInstancesRef={mockManagerInstancesRef} />
    );
    expect(container.firstChild).toBeNull();
  });

  describe('Activation and Deactivation', () => {
    it('requests microphone access and sets up audio when isActive becomes true', async () => {
      const { rerender } = render(
        <AudioAnalyzer
          isActive={false}
          managerInstancesRef={mockManagerInstancesRef}
          onAudioData={onAudioDataMock}
        />
      );
      expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
      rerender(
        <AudioAnalyzer
          isActive={true}
          managerInstancesRef={mockManagerInstancesRef}
          onAudioData={onAudioDataMock}
        />
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      expect(mockAudioContextInstance.createAnalyser).toHaveBeenCalled();
      expect(mockAudioContextInstance.createMediaStreamSource).toHaveBeenCalledWith(mockMediaStream);
      expect(mockAudioSourceNode.connect).toHaveBeenCalledWith(mockAnalyserNode);
      expect(mockResume).toHaveBeenCalled();
      expect(requestAnimationFrame).toHaveBeenCalled();
      advanceRAF();
      expect(mockGetByteFrequencyData).toHaveBeenCalled();
      expect(onAudioDataMock).toHaveBeenCalled();
    });

    it('cleans up audio when isActive becomes false', async () => {
      const { rerender } = render(
        <AudioAnalyzer
          isActive={true}
          managerInstancesRef={mockManagerInstancesRef}
        />
      );
      await act(async () => {
        await Promise.resolve(); 
      });
      expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
      rerender(
        <AudioAnalyzer
          isActive={false}
          managerInstancesRef={mockManagerInstancesRef}
        />
      );
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      expect(cancelAnimationFrame).toHaveBeenCalled();
      expect(mockStop).toHaveBeenCalled();
      expect(mockAudioSourceNode.disconnect).toHaveBeenCalled();
      expect(mockSuspend).toHaveBeenCalled();
      expect(mockResetAudioModifications).toHaveBeenCalledTimes(3);
    });

    it('cleans up fully on unmount', async () => {
      const { unmount } = render(
        <AudioAnalyzer
          isActive={true}
          managerInstancesRef={mockManagerInstancesRef}
        />
      );
      await act(async () => {
        await Promise.resolve();
      });
      unmount();
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      expect(cancelAnimationFrame).toHaveBeenCalled();
      expect(mockStop).toHaveBeenCalled();
      expect(mockAudioSourceNode.disconnect).toHaveBeenCalled();
      expect(mockSuspend).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
      expect(mockResetAudioModifications).toHaveBeenCalledTimes(3);
    });

    it('handles getUserMedia failure gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
      render(
        <AudioAnalyzer
          isActive={true}
          managerInstancesRef={mockManagerInstancesRef}
        />
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
      expect(mockAudioContextInstance.createAnalyser).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[AudioAnalyzer requestMicrophoneAccess] Error accessing microphone:"),
        "Error",
        "Permission denied"
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Audio Processing and Callbacks', () => {
    it('calls onAudioData with processed data and applies to layers', async () => {
      const audioSettings = {
        smoothingFactor: 0.5,
        bassIntensity: 1.2,
        midIntensity: 1.0,
        trebleIntensity: 0.8,
      };
      render(
        <AudioAnalyzer
          isActive={true}
          onAudioData={onAudioDataMock}
          audioSettings={audioSettings}
          managerInstancesRef={mockManagerInstancesRef}
        />
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockAnalyserNode.smoothingTimeConstant).toBe(0.5);
      advanceRAF();
      expect(mockGetByteFrequencyData).toHaveBeenCalled();
      expect(onAudioDataMock).toHaveBeenCalledTimes(1);
      const { level, frequencyBands, timestamp } = onAudioDataMock.mock.calls[0][0];
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
      expect(frequencyBands).toEqual(
        expect.objectContaining({
          bass: expect.closeTo(0.3780, 4), 
          mid: expect.any(Number),
          treble: expect.any(Number),
        })
      );
      expect(timestamp).toBeCloseTo(Date.now(), -2);
      expect(mockSetAudioFrequencyFactor).toHaveBeenCalledTimes(3);
      expect(mockSetAudioFrequencyFactor).toHaveBeenNthCalledWith(1, expect.closeTo(1.3629, 4));

      mockGetByteFrequencyData.mockImplementationOnce((array) => {
         for (let i = 0; i < array.length; i++) { array[i] = 200; }
      });
      advanceRAF();
      expect(mockTriggerBeatPulse).toHaveBeenCalled();
    });
  });

  describe('Prop Changes', () => {
    it('updates AnalyserNode smoothingTimeConstant when audioSettings prop changes', async () => {
      const initialAudioSettings = { smoothingFactor: 0.6 };
      const { rerender } = render(
        <AudioAnalyzer
          isActive={true}
          audioSettings={initialAudioSettings}
          managerInstancesRef={mockManagerInstancesRef}
        />
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockAnalyserNode.smoothingTimeConstant).toBe(0.6);
      const newAudioSettings = { smoothingFactor: 0.3 };
      rerender(
        <AudioAnalyzer
          isActive={true}
          audioSettings={newAudioSettings}
          managerInstancesRef={mockManagerInstancesRef}
        />
      );
      expect(mockAnalyserNode.smoothingTimeConstant).toBe(0.3);
    });

    // --- REMOVED: Test for transition logic on configLoadNonce change ---
  });
});
```

---
### `src\components\Audio\AudioControlPanel.jsx`
```jsx
// src/components/Audio/AudioControlPanel.jsx
import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";

import Panel from "../Panels/Panel"; // Local component

import "./AudioStyles/AudioControlPanel.css"; // Local styles

// Tunable parameters for meter display intensity (visual only, does not affect actual analysis)
const DISPLAY_LEVEL_AMPLIFICATION = 1.8;
const DISPLAY_TREBLE_AMPLIFICATION = 2.5;
const DEFAULT_SMOOTHING = 0.6; // Define locally for this component's use

/**
 * @typedef {object} AudioDevice
 * @property {string} deviceId - Unique identifier for the audio device.
 * @property {string} label - Human-readable label for the device.
 * @property {string} kind - Type of device (e.g., "audioinput").
 */

/**
 * @typedef {object} AudioControlPanelProps
 * @property {() => void} onClose - Callback function to close the panel.
 * @property {boolean} isAudioActive - Whether audio analysis is currently active.
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setIsAudioActive - Function to toggle the audio analysis state.
 * @property {import('../../hooks/useAudioVisualizer').AudioVisualizerSettings} audioSettings - Current settings for audio reactivity (intensities, smoothing factor).
 * @property {React.Dispatch<React.SetStateAction<import('../../hooks/useAudioVisualizer').AudioVisualizerSettings>>} setAudioSettings - Function to update audio settings.
 * @property {import('../../hooks/useAudioVisualizer').RawAudioAnalyzerData} analyzerData - Data from the audio analyzer (level, frequency bands).
 */

/**
 * AudioControlPanel provides UI controls for managing audio reactivity.
 * It allows users to toggle audio analysis, view detected audio input devices (display-only),
 * observe real-time audio levels (overall, bass, mid, treble), and adjust
 * parameters like intensity of audio impact on layers and the smoothing algorithm.
 *
 * @param {AudioControlPanelProps} props - Component props.
 * @returns {JSX.Element} The rendered AudioControlPanel component.
 */
const AudioControlPanel = React.memo(({
  onClose,
  isAudioActive,
  setIsAudioActive,
  audioSettings,
  setAudioSettings,
  analyzerData,
}) => {
  /** @type {[AudioDevice[], React.Dispatch<React.SetStateAction<AudioDevice[]>>]} */
  const [audioDevices, setAudioDevices] = useState([]);

  useEffect(() => {
    let isMounted = true;
    if (isAudioActive && navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === "function") {
      navigator.mediaDevices.enumerateDevices()
        .then((devices) => {
          if (!isMounted) return;
          const audioInputs = devices.filter((d) => d.kind === "audioinput");
          setAudioDevices(audioInputs);
        })
        .catch((err) => {
          if (import.meta.env.DEV) {
            console.warn("[AudioControlPanel] Error enumerating audio devices:", err);
          }
        });
    } else if (!isAudioActive) {
        setAudioDevices([]);
    }
    return () => { isMounted = false; };
  }, [isAudioActive]);

  const toggleAnalyzer = useCallback(() => {
    if (typeof setIsAudioActive === 'function') {
        setIsAudioActive((prev) => !prev);
    }
  }, [setIsAudioActive]);

  const handleSettingChange = useCallback((setting, value) => {
    if (typeof setAudioSettings === 'function') {
        setAudioSettings((prev) => ({
          ...prev,
          [setting]: parseFloat(value),
        }));
    }
  }, [setAudioSettings]);

  const handleStopListening = useCallback(() => {
    if (typeof setIsAudioActive === 'function') {
        setIsAudioActive(false);
    }
  }, [setIsAudioActive]);

  const displayLevel = Math.min(1, (analyzerData?.level || 0) * DISPLAY_LEVEL_AMPLIFICATION);
  const displayBass = analyzerData?.frequencyBands?.bass || 0;
  const displayMid = analyzerData?.frequencyBands?.mid || 0;
  const displayTreble = Math.min(1, (analyzerData?.frequencyBands?.treble || 0) * DISPLAY_TREBLE_AMPLIFICATION);

  const currentSmoothing = audioSettings?.smoothingFactor ?? DEFAULT_SMOOTHING;

  return (
    <Panel
      title="AUDIO VISUALIZER"
      onClose={onClose}
      className="panel-from-toolbar audio-control-panel"
    >
      <div className="audio-control-content">
        <div className="audio-toggle-section section-box">
          <div className="toggle-description">
            <h3>Audio Responsive Layers</h3>
            <p>
              Make the visual layers respond to audio playing through your
              device. Requires microphone access.
            </p>
          </div>
          <div className="toggle-switch-wrapper">
            <label className="toggle-switch" htmlFor="audio-active-toggle" aria-label="Toggle Audio Reactivity">
              <input type="checkbox" id="audio-active-toggle" checked={isAudioActive} onChange={toggleAnalyzer} />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-state" aria-live="polite">{isAudioActive ? "ON" : "OFF"}</span>
          </div>
        </div>

        {isAudioActive && (
          <>
            <div className="device-selector-info section-box">
              <label htmlFor="audio-device-display">Detected Audio Inputs:</label>
              <select id="audio-device-display" disabled className="device-select custom-select">
                <option value="">System Default / Currently Granted Device</option>
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Input ${device.deviceId.substring(0, 8)}...`}
                  </option>
                ))}
              </select>
              <p className="device-note">Note: Actual input depends on browser permissions & system settings. This list is informational.</p>
            </div>

            <div className="audio-meters-display section-box">
              <div className="meters-header">
                <div className="listening-indicator">
                  <div className="signal-waves">
                    <span className="wave wave-1"></span>
                    <span className="wave wave-2"></span>
                    <span className="wave wave-3"></span>
                  </div>
                  <span>Listening to Audio</span>
                </div>
              </div>

              <div className="level-meter">
                <div className="meter-label">Level</div>
                <div className="meter-bar">
                  <div
                    className="meter-fill level"
                    style={{ width: `${Math.min(100, displayLevel * 100)}%` }}
                    aria-valuenow={Math.round(displayLevel * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    role="meter"
                  ></div>
                </div>
              </div>

              <div className="frequency-meters">
                <div className="frequency-meter">
                  <div className="meter-label">Bass</div>
                  <div className="meter-bar">
                    <div
                      className="meter-fill bass"
                      style={{ width: `${Math.min(100, displayBass * 100)}%` }}
                      aria-valuenow={Math.round(displayBass * 100)} aria-valuemin={0} aria-valuemax={100} role="meter"
                    ></div>
                  </div>
                </div>
                <div className="frequency-meter">
                  <div className="meter-label">Mid</div>
                  <div className="meter-bar">
                    <div
                      className="meter-fill mid"
                      style={{ width: `${Math.min(100, displayMid * 100)}%` }}
                      aria-valuenow={Math.round(displayMid * 100)} aria-valuemin={0} aria-valuemax={100} role="meter"
                    ></div>
                  </div>
                </div>
                <div className="frequency-meter">
                  <div className="meter-label">Treble</div>
                  <div className="meter-bar">
                    <div
                      className="meter-fill treble"
                      style={{ width: `${Math.min(100, displayTreble * 100)}%` }}
                      aria-valuenow={Math.round(displayTreble * 100)} aria-valuemin={0} aria-valuemax={100} role="meter"
                    ></div>
                  </div>
                </div>
              </div>
               <button
                 className="stop-listening-button btn btn-secondary"
                 onClick={handleStopListening}
                 aria-label="Stop listening to audio"
               >
                 Stop Listening
               </button>
            </div>

            <div className="audio-settings-section section-box">
              <h4 className="config-section-title">Audio Reactivity Settings</h4>
              <div className="slider-group">
                <div className="slider-container">
                  <div className="slider-header">
                    <span className="slider-label">Bass Impact (L1 Size)</span>
                    <span className="slider-value">{(audioSettings?.bassIntensity || 1.0).toFixed(1)}x</span>
                  </div>
                  <input type="range" min="0.1" max="3.0" step="0.1" value={audioSettings?.bassIntensity || 1.0} onChange={(e) => handleSettingChange("bassIntensity", e.target.value)} className="bass-slider intensity-slider horizontal-slider" aria-label="Bass impact intensity"/>
                </div>
                <div className="slider-container">
                  <div className="slider-header">
                    <span className="slider-label">Mid Impact (L2 Size)</span>
                    <span className="slider-value">{(audioSettings?.midIntensity || 1.0).toFixed(1)}x</span>
                  </div>
                  <input type="range" min="0.1" max="3.0" step="0.1" value={audioSettings?.midIntensity || 1.0} onChange={(e) => handleSettingChange("midIntensity", e.target.value)} className="mid-slider intensity-slider horizontal-slider" aria-label="Mid-range impact intensity"/>
                </div>
                <div className="slider-container">
                  <div className="slider-header">
                    <span className="slider-label">Treble Impact (L3 Size)</span>
                    <span className="slider-value">{(audioSettings?.trebleIntensity || 1.0).toFixed(1)}x</span>
                  </div>
                  <input type="range" min="0.1" max="3.0" step="0.1" value={audioSettings?.trebleIntensity || 1.0} onChange={(e) => handleSettingChange("trebleIntensity", e.target.value)} className="treble-slider intensity-slider horizontal-slider" aria-label="Treble impact intensity"/>
                </div>
                <div className="slider-container">
                  <div className="slider-header">
                    <span className="slider-label">Smoothing Algorithm</span>
                    <span className="slider-value">{currentSmoothing.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.95"
                    step="0.01"
                    value={currentSmoothing}
                    onChange={(e) => handleSettingChange("smoothingFactor", e.target.value)}
                    className="smoothness-slider intensity-slider horizontal-slider"
                    title="Adjust response smoothness (Left=Sharp/Sawtooth, Right=Smooth/Sine)"
                    aria-label="Audio response smoothing factor"
                  />
                   <div className="slider-labels">
                       <span>Sharp</span>
                       <span>Smooth</span>
                   </div>
                </div>
              </div>
            </div>
          </>
        )}

        {!isAudioActive && (
          <div className="inactive-state section-box">
            <div className="inactive-description">
              <div className="feature-description">
                <p>
                  Enable "Audio Responsive Layers" to make your visual configuration respond to music and onboard sound.
                </p>
                <ul>
                  <li>Bass influences the bottom layer's size.</li>
                  <li>Mid-range frequencies control the middle layer's size.</li>
                  <li>Treble affects the top layer's size.</li>
                  <li>A custom algorithm blends these influences for dynamic visuals.</li>
                </ul>
              </div>
              <div className="usage-note">
                <strong>Note:</strong> RADAR makes use of your microphone access
                to listen to the audio playing through your device. This is
                required for the visualizer to work. Please ensure you have
                granted microphone access to your browser for this site.
              </div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
});

AudioControlPanel.displayName = 'AudioControlPanel';

AudioControlPanel.propTypes = {
  onClose: PropTypes.func.isRequired,
  isAudioActive: PropTypes.bool.isRequired,
  setIsAudioActive: PropTypes.func.isRequired,
  audioSettings: PropTypes.shape({
      bassIntensity: PropTypes.number,
      midIntensity: PropTypes.number,
      trebleIntensity: PropTypes.number,
      smoothingFactor: PropTypes.number,
  }),
  setAudioSettings: PropTypes.func,
  analyzerData: PropTypes.shape({
      level: PropTypes.number,
      frequencyBands: PropTypes.shape({
          bass: PropTypes.number,
          mid: PropTypes.number,
          treble: PropTypes.number,
      }),
  }),
};

AudioControlPanel.defaultProps = {
  audioSettings: {
    bassIntensity: 1.0,
    midIntensity: 1.0,
    trebleIntensity: 1.0,
    smoothingFactor: DEFAULT_SMOOTHING, // Use the defined constant
  },
  setAudioSettings: () => {
    if (import.meta.env.DEV) console.warn("setAudioSettings called on default AudioControlPanel prop");
  },
  analyzerData: { level: 0, frequencyBands: { bass: 0, mid: 0, treble: 0 } },
};

export default AudioControlPanel;
```

---
### `src\components\Audio\AudioControlPanel.test.jsx`
```jsx
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AudioControlPanel from './AudioControlPanel';

vi.mock('../Panels/Panel', () => ({
  __esModule: true,
  default: ({ title, onClose, className, children }) => (
    <div data-testid="mock-panel" className={className}>
      <h2 data-testid="panel-title">{title}</h2>
      <button data-testid="panel-close-button" onClick={onClose}>Close Panel</button>
      {children}
    </div>
  ),
}));

const mockEnumerateDevices = vi.fn();
vi.stubGlobal('navigator', {
  mediaDevices: {
    enumerateDevices: mockEnumerateDevices,
  },
});

describe('AudioControlPanel', () => {
  let mockOnClose;
  let mockSetIsAudioActive;
  let mockSetAudioSettings;
  let baseProps; // Renamed from defaultProps to avoid confusion with component's defaultProps

  const mockAudioDevicesList = [ // Renamed for clarity
    { deviceId: 'dev1', label: 'Microphone 1', kind: 'audioinput' },
    { deviceId: 'dev2', label: 'Microphone 2', kind: 'audioinput' },
    { deviceId: 'dev3', label: 'Webcam Mic', kind: 'audioinput' },
    { deviceId: 'video1', label: 'Webcam Video', kind: 'videoinput' },
  ];

  beforeEach(() => {
    mockOnClose = vi.fn();
    mockSetIsAudioActive = vi.fn();
    mockSetAudioSettings = vi.fn();
    mockEnumerateDevices.mockClear();

    baseProps = {
      onClose: mockOnClose,
      isAudioActive: false,
      setIsAudioActive: mockSetIsAudioActive,
      // For tests checking defaults, audioSettings & analyzerData will be omitted
      // For other tests, they will be spread in or overridden
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const getFullProps = (overrides = {}) => ({
    ...baseProps,
    audioSettings: {
      bassIntensity: 1.0,
      midIntensity: 1.2,
      trebleIntensity: 0.8,
      smoothingFactor: 0.6,
      ...(overrides.audioSettings || {}),
    },
    setAudioSettings: mockSetAudioSettings,
    analyzerData: {
      level: 0,
      frequencyBands: { bass: 0, mid: 0, treble: 0 },
      ...(overrides.analyzerData || {}),
    },
    ...overrides, // General overrides for isAudioActive, etc.
  });


  test('renders correctly when audio is inactive', () => {
    render(<AudioControlPanel {...getFullProps({ isAudioActive: false })} />);
    // ... assertions remain the same
    expect(screen.getByTestId('panel-title')).toHaveTextContent('AUDIO VISUALIZER');
    expect(screen.getByRole('heading', { name: /Audio Responsive Layers/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Toggle Audio Reactivity/i })).not.toBeChecked();
    expect(screen.getByText('OFF')).toBeInTheDocument();
    expect(screen.getByText(/Enable "Audio Responsive Layers" to make your visual configuration respond/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Detected Audio Inputs:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Listening to Audio/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: /Audio Reactivity Settings/i})).not.toBeInTheDocument();
  });

  test('calls onClose when panel close button is clicked', () => {
    render(<AudioControlPanel {...getFullProps()} />);
    fireEvent.click(screen.getByTestId('panel-close-button'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('toggles audio active state when switch is clicked', () => {
    render(<AudioControlPanel {...getFullProps()} />);
    const toggle = screen.getByRole('checkbox', { name: /Toggle Audio Reactivity/i });
    fireEvent.click(toggle);
    expect(mockSetIsAudioActive).toHaveBeenCalledTimes(1);
  });

  describe('when audio is active', () => {
    beforeEach(() => {
      mockEnumerateDevices.mockResolvedValue(mockAudioDevicesList);
    });

    test('renders correctly and fetches devices', async () => {
      render(<AudioControlPanel {...getFullProps({ isAudioActive: true })} />);
      expect(screen.getByRole('checkbox', { name: /Toggle Audio Reactivity/i })).toBeChecked();
      expect(screen.getByText('ON')).toBeInTheDocument();
      expect(screen.getByLabelText(/Detected Audio Inputs:/i)).toBeInTheDocument();
      expect(screen.getByText(/Listening to Audio/i)).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: /Audio Reactivity Settings/i})).toBeInTheDocument();
      expect(screen.queryByText(/Enable "Audio Responsive Layers" to make your visual configuration respond/i)).not.toBeInTheDocument();
      expect(mockEnumerateDevices).toHaveBeenCalledTimes(1);
      expect(await screen.findByRole('option', { name: /Microphone 1/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Microphone 2/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Webcam Mic/i })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /Webcam Video/i })).not.toBeInTheDocument();
    });

    test('handles error during device enumeration', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockEnumerateDevices.mockRejectedValueOnce(new Error('Device enumeration failed'));
      render(<AudioControlPanel {...getFullProps({ isAudioActive: true })} />);
      await waitFor(() => expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[AudioControlPanel] Error enumerating audio devices:"),
        expect.any(Error)
      ));
      expect(screen.getByLabelText(/Detected Audio Inputs:/i).querySelectorAll('option').length).toBe(1);
      consoleWarnSpy.mockRestore();
    });

    test('clears devices when audio is toggled off', async () => {
        const { rerender } = render(<AudioControlPanel {...getFullProps({ isAudioActive: true })} />);
        expect(await screen.findByRole('option', { name: /Microphone 1/i })).toBeInTheDocument();
        rerender(<AudioControlPanel {...getFullProps({ isAudioActive: false })} />);
        expect(screen.queryByLabelText(/Detected Audio Inputs:/i)).not.toBeInTheDocument();
    });

    test('displays audio meters based on analyzerData', () => {
      const testAnalyzerData = {
        level: 0.5,
        frequencyBands: { bass: 0.8, mid: 0.4, treble: 0.3 },
      };
      render(<AudioControlPanel {...getFullProps({ isAudioActive: true, analyzerData: testAnalyzerData })} />);
      const levelMeter = screen.getAllByRole('meter').find(m => m.classList.contains('level'));
      const bassMeter = screen.getAllByRole('meter').find(m => m.classList.contains('bass'));
      const midMeter = screen.getAllByRole('meter').find(m => m.classList.contains('mid'));
      const trebleMeter = screen.getAllByRole('meter').find(m => m.classList.contains('treble'));
      expect(levelMeter).toHaveStyle('width: 90%');
      expect(bassMeter).toHaveStyle('width: 80%');
      expect(midMeter).toHaveStyle('width: 40%');
      expect(trebleMeter).toHaveStyle('width: 75%');
    });

    test('updates settings when sliders are changed', async () => {
      const initialSettings = {
        bassIntensity: 1.0, midIntensity: 1.2, trebleIntensity: 0.8, smoothingFactor: 0.6,
      };
      render(<AudioControlPanel {...getFullProps({ isAudioActive: true, audioSettings: initialSettings })} />);
      const bassSlider = screen.getByRole('slider', { name: /Bass impact intensity/i });
      const smoothingSlider = screen.getByRole('slider', { name: /Audio response smoothing factor/i });
      fireEvent.change(bassSlider, { target: { value: '2.5' } });
      expect(mockSetAudioSettings).toHaveBeenCalledWith(expect.any(Function));
      let lastCallUpdater = mockSetAudioSettings.mock.calls.pop()[0];
      expect(lastCallUpdater(initialSettings)).toEqual({ ...initialSettings, bassIntensity: 2.5 });

      fireEvent.change(smoothingSlider, { target: { value: '0.25' } });
      expect(mockSetAudioSettings).toHaveBeenCalledWith(expect.any(Function));
      lastCallUpdater = mockSetAudioSettings.mock.calls.pop()[0];
      expect(lastCallUpdater(initialSettings)).toEqual({ ...initialSettings, smoothingFactor: 0.25 });
    });
    
    test('calls setIsAudioActive(false) when "Stop Listening" button is clicked', () => {
        render(<AudioControlPanel {...getFullProps({ isAudioActive: true })} />);
        const stopButton = screen.getByRole('button', { name: /Stop listening to audio/i });
        fireEvent.click(stopButton);
        expect(mockSetIsAudioActive).toHaveBeenCalledWith(false);
    });
  });

  test('uses default smoothingFactor if not in audioSettings provided as prop', () => {
    // Simulating audioSettings prop being passed but without smoothingFactor
    const partialAudioSettings = { bassIntensity: 1.5 };
    render(<AudioControlPanel {...getFullProps({ isAudioActive: true, audioSettings: partialAudioSettings })} />);
    const smoothingSlider = screen.getByRole('slider', { name: /Audio response smoothing factor/i });
    // The component's default for smoothingFactor (0.6) should merge with provided partialAudioSettings
    expect(smoothingSlider.value).toBe("0.6"); 
    expect(screen.getByText("0.60")).toBeInTheDocument();
  });

  test('handles missing audioSettings and analyzerData gracefully with JS defaults', () => {
    // Here, audioSettings and analyzerData props are NOT passed to AudioControlPanel
    // So, it should use its internal JS default parameters
    render(
      <AudioControlPanel
        onClose={mockOnClose}
        isAudioActive={true} // Activate to show settings and meters
        setIsAudioActive={mockSetIsAudioActive}
        // audioSettings prop is omitted
        // setAudioSettings prop is omitted (will use default function from component)
        // analyzerData prop is omitted
      />
    );
    const bassSlider = screen.getByRole('slider', { name: /Bass impact intensity/i });
    expect(bassSlider.value).toBe("1"); // Corrected: 1.0 becomes "1"

    const levelMeter = screen.getAllByRole('meter').find(m => m.classList.contains('level'));
    expect(levelMeter).toHaveStyle('width: 0%');
  });
});
```

---
### `src\components\Audio\AudioStatusIcon.jsx`
```jsx
// src/components/Audio/AudioStatusIcon.jsx
import React from "react";
import PropTypes from "prop-types";

import "./AudioStyles/AudioStatusIcon.css"; // Local styles

/**
 * @typedef {object} AudioStatusIconProps
 * @property {boolean} [isActive=false] - If true, the icon is displayed and indicates that audio visualization is active.
 * @property {() => void} [onClick] - Optional callback function invoked when the icon is clicked. Typically used to open the audio control panel.
 */

/**
 * AudioStatusIcon: A small visual indicator, usually placed in a corner or toolbar,
 * to show that audio visualization/reactivity is currently active.
 * It only renders when `isActive` is true. Clicking the icon can trigger an action,
 * such as opening the audio control panel.
 *
 * @param {AudioStatusIconProps} props - The component's props.
 * @returns {JSX.Element | null} The rendered AudioStatusIcon button, or null if `isActive` is false.
 */
// MODIFIED LINE: Added default parameters directly in the function signature
const AudioStatusIcon = ({ isActive = false, onClick = () => {} }) => {
  // If audio visualization is not active, do not render the icon.
  if (!isActive) {
    return null;
  }

  return (
    <button
      className={`audio-status-icon ${isActive ? "active" : ""}`}
      onClick={onClick}
      aria-label="Audio Visualizer Active"
      title="Audio Visualizer is Active - Click to open settings"
    >
      <div className="audio-icon">
        <div className="wave-container">
          <span className="audio-wave"></span>
          <span className="audio-wave"></span>
          <span className="audio-wave"></span>
        </div>
      </div>
    </button>
  );
};

AudioStatusIcon.propTypes = {
  isActive: PropTypes.bool,
  onClick: PropTypes.func,
};

export default AudioStatusIcon;
```

---
### `src\components\Audio\AudioStatusIcon.test.jsx`
```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AudioStatusIcon from './AudioStatusIcon'; // Adjust path if necessary

describe('AudioStatusIcon', () => {
  it('should not render when isActive is false (default behavior)', () => {
    // Arrange: Render with default isActive (which is false)
    render(<AudioStatusIcon />);

    // Act & Assert
    // queryBy* returns null if not found, good for asserting absence
    const button = screen.queryByRole('button', { name: /Audio Visualizer Active/i });
    expect(button).not.toBeInTheDocument();
  });

  it('should not render when isActive is explicitly false', () => {
    // Arrange: Render with isActive explicitly false
    render(<AudioStatusIcon isActive={false} />);

    // Act & Assert
    const button = screen.queryByRole('button', { name: /Audio Visualizer Active/i });
    expect(button).not.toBeInTheDocument();
  });

  it('should render when isActive is true', () => {
    // Arrange: Render with isActive true
    render(<AudioStatusIcon isActive={true} />);

    // Act & Assert
    // getBy* throws an error if not found, good for asserting presence
    const button = screen.getByRole('button', { name: /Audio Visualizer Active/i });
    expect(button).toBeInTheDocument();
  });

  it('should have the "active" class when isActive is true', () => {
    // Arrange
    render(<AudioStatusIcon isActive={true} />);
    const button = screen.getByRole('button', { name: /Audio Visualizer Active/i });

    // Assert
    expect(button).toHaveClass('active');
  });

  it('should call onClick prop when clicked if isActive is true', () => {
    // Arrange
    const handleClickMock = vi.fn(); // Vitest's mock function
    render(<AudioStatusIcon isActive={true} onClick={handleClickMock} />);
    const button = screen.getByRole('button', { name: /Audio Visualizer Active/i });

    // Act
    fireEvent.click(button);

    // Assert
    expect(handleClickMock).toHaveBeenCalledTimes(1);
  });

  it('should have correct ARIA label and title when rendered', () => {
    // Arrange
    render(<AudioStatusIcon isActive={true} />);
    const button = screen.getByRole('button', { name: /Audio Visualizer Active/i });

    // Assert
    expect(button).toHaveAttribute('aria-label', 'Audio Visualizer Active');
    expect(button).toHaveAttribute('title', 'Audio Visualizer is Active - Click to open settings');
  });

  it('should render the inner wave elements when active', () => {
    // Arrange
    render(<AudioStatusIcon isActive={true} />);
    const button = screen.getByRole('button', { name: /Audio Visualizer Active/i });

    // Act
    const waveContainer = button.querySelector('.wave-container');
    const waves = button.querySelectorAll('.audio-wave');

    // Assert
    expect(waveContainer).toBeInTheDocument();
    expect(waves.length).toBe(3); // Assuming 3 wave spans as per your CSS
  });

  it('should use default onClick prop (no-op) if none is provided and not throw error', () => {
    // Arrange
    render(<AudioStatusIcon isActive={true} />); // No onClick prop passed
    const button = screen.getByRole('button', { name: /Audio Visualizer Active/i });

    // Act & Assert
    // We expect no error to be thrown when clicking
    expect(() => fireEvent.click(button)).not.toThrow();
  });
});
```

---
### `src\components\Audio\AudioStyles\AudioControlPanel.css`
```css
@import "../../../styles/variables.css";

.audio-control-panel .panel-content {
  /* Optional: Override default panel padding if needed */
}

.audio-control-content {
  padding: var(--space-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.audio-toggle-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-primary-a05);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  border: 1px solid var(--color-primary-a15);
}

.toggle-description h3 {
  font-size: var(--font-size-md);
  margin-bottom: var(--space-xs);
  color: var(--color-primary);
}

.toggle-description p {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0;
  max-width: 300px; /* Prevent text from pushing toggle too far */
}

.toggle-switch-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xxs);
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-bg-light);
  border: 1px solid var(--color-primary-a30);
  transition: var(--transition-normal);
  border-radius: 34px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 2px;
  bottom: 2px;
  background-color: var(--color-text);
  transition: var(--transition-normal);
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

input:checked + .toggle-slider {
  background-color: var(--color-primary-a30);
  border-color: var(--color-primary-a50);
}

input:checked + .toggle-slider:before {
  transform: translateX(24px);
  background-color: var(--color-primary);
}

.toggle-state {
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.device-selector-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-sm);
  background: var(--color-bg-inset);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-subtle);
}

.device-selector-info label {
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-text-muted);
}

.device-select {
  width: 100%;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-light);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  cursor: not-allowed;
  opacity: 0.7;
}

.device-note {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.4;
}

.audio-meters-display {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-sm);
  background: var(--color-bg-inset);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-subtle);
}

.meters-header {
  margin-bottom: var(--space-xs);
}

.listening-indicator {
  display: flex;
  align-items: center;
  color: var(--color-primary);
}

.signal-waves {
  display: flex;
  align-items: flex-end;
  margin-right: var(--space-sm);
  height: 16px;
}

.wave {
  display: inline-block;
  width: 3px;
  background-color: var(--color-primary);
  margin-right: 2px;
  animation: wave 1s infinite ease-in-out;
  border-radius: 1px;
}

.wave-1 { height: 60%; animation-delay: 0s; }
.wave-2 { height: 100%; animation-delay: 0.2s; }
.wave-3 { height: 80%; animation-delay: 0.4s; }

@keyframes wave {
  0%, 100% { transform: scaleY(0.5); opacity: 0.7; }
  50% { transform: scaleY(1); opacity: 1; }
}

.level-meter {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

/* --- THIS RULE IS KEY FOR THE LEVEL METER BAR --- */
.level-meter .meter-bar {
  flex-grow: 1; 
  min-width: 50px; 
}
/* --------------------------------------------- */

.frequency-meters {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-md);
}

.frequency-meter {
  display: flex;
  flex-direction: column;
  gap: var(--space-xxs);
}

.meter-label {
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-text-muted);
  text-align: left;
  text-transform: uppercase;
}

.meter-bar {
  width: 100%; 
  height: 10px;
  background-color: var(--color-primary-a05);
  border-radius: var(--radius-xs);
  overflow: hidden;
  border: 1px solid var(--color-primary-a15);
  position: relative; 
}

.meter-fill {
  height: 100%;
  background-color: var(--color-primary);
  border-radius: var(--radius-xs);
  transition: width 0.05s linear;
  will-change: width;
}

.meter-fill.level { background-color: var(--color-accent); }
.meter-fill.bass { background-color: var(--color-bass); }
.meter-fill.mid { background-color: var(--color-mid); }
.meter-fill.treble { background-color: var(--color-treble); }

.stop-listening-button {
  padding: var(--space-xs) var(--space-sm);
  background-color: var(--color-error-a30);
  color: var(--color-error-a90);
  border: 1px solid var(--color-error-a50);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: bold;
  margin-top: var(--space-sm);
  transition: all var(--transition-fast);
  text-transform: uppercase;
}

.stop-listening-button:hover {
  background-color: var(--color-error-a50);
  color: var(--color-text);
}

.slider-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs); 
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px; 
}
.slider-label {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  font-weight: 500;
}
.slider-value {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  background-color: var(--color-bg-inset);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-family: monospace;
}

.slider-labels {
    display: flex;
    justify-content: space-between;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    padding: 0 2px;
    margin-top: 2px; 
}

.intensity-slider {
  width: 100%;
  cursor: pointer;
  height: 6px;
  background: var(--color-primary-a15);
  border-radius: 3px;
  -webkit-appearance: none;
  appearance: none;
}
.intensity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--color-primary);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 4px rgba(var(--color-primary-rgb), 0.5);
}
.intensity-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: var(--color-primary);
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 0 4px rgba(var(--color-primary-rgb), 0.5);
}

.inactive-state {
  background: var(--color-glass-bg);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  border: 1px solid var(--color-border-subtle);
}

.inactive-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: 1.6;
}

.inactive-description h4 {
    font-size: var(--font-size-md);
    color: var(--color-text);
    margin-bottom: var(--space-sm);
}

.feature-description {
  margin-top: var(--space-sm);
}

.feature-description p {
    margin-bottom: var(--space-md);
    color: var(--color-text);
}

.feature-description ul {
  list-style: disc;
  padding-left: var(--space-lg);
  margin-bottom: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.feature-description li strong {
    color: var(--color-primary);
}

.usage-note {
  margin-top: var(--space-lg);
  background: var(--color-primary-a05);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--color-primary-a30);
  font-size: var(--font-size-xs);
}
.usage-note strong {
    color: var(--color-text);
}
```

---
### `src\components\Audio\AudioStyles\AudioStatusIcon.css`
```css
@import "../../../styles/variables.css";

.audio-status-icon {
  appearance: none; border: none; padding: 0; margin: 0; font-family: inherit;
  cursor: pointer; outline: none;
  width: var(--toolbar-button-size, 35px);
  height: var(--toolbar-button-size, 35px);
  display: flex; align-items: center; justify-content: center;
  background: var(--color-button-secondary-a80);
  backdrop-filter: blur(var(--blur-amount));
  -webkit-backdrop-filter: blur(var(--blur-amount));
  border: 1px solid var(--color-primary-a50);
  border-radius: var(--radius-sm);
  color: var(--color-primary);
  transition: all var(--transition-fast);
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}

.audio-status-icon:hover {
  background: var(--color-primary-a15);
  border-color: var(--color-primary);
  transform: translateY(-1px);
}
.audio-status-icon:active {
  background: var(--color-primary-a20);
  transform: translateY(0px);
}

@keyframes icon-active-pulse {
  0%, 100% { transform: scale(1); opacity: 0.8; filter: drop-shadow(0 0 4px var(--color-primary-a30)); }
  50% { transform: scale(1.08); opacity: 1; filter: drop-shadow(0 0 7px var(--color-primary-a70)); }
}

.audio-icon {
  width: 60%;
  height: 60%;
  display: flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 0 2px var(--color-primary-a15));
  transition: transform 0.3s ease, opacity 0.3s ease, filter 0.3s ease;
}

.audio-status-icon.active .audio-icon {
  animation: icon-active-pulse 1.8s infinite ease-in-out;
}

.wave-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
}

.audio-wave {
  display: inline-block;
  width: 5px;
  background-color: currentColor;
  margin: 0 1px;
  border-radius: 1px;
  animation: wave 1.5s infinite ease-in-out;
}
.audio-wave:first-child { margin-left: 0; }
.audio-wave:last-child { margin-right: 0; }

.audio-wave:nth-child(1) { height: 80%; animation-delay: 0s; }
.audio-wave:nth-child(2) { height: 95%; animation-delay: 0.2s; }
.audio-wave:nth-child(3) { height: 65%; animation-delay: 0.4s; }

@keyframes wave {
  0%, 100% {
    transform: scaleY(0.6);
  }
  50% {
    transform: scaleY(1.2);
  }
}
```

---
### `src\components\ErrorBoundary.jsx`
```jsx
// src/components/ErrorBoundary.jsx
import React from "react";
import PropTypes from "prop-types";

/**
 * ErrorBoundary: A React component that catches JavaScript errors anywhere
 * in its child component tree, logs those errors, and displays a fallback UI
 * instead of the crashed component tree.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error: error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to the console (or send to an error reporting service)
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // Render a user-friendly fallback UI
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            width: "100vw",
            padding: "20px",
            boxSizing: "border-box",
            backgroundColor: "#1a1a2e", // Match background
            color: "#ff5555", // Error color
            fontFamily: "Arial, sans-serif",
            textAlign: "center",
            border: "2px solid #ff5555",
          }}
        >
          <h1 style={{ color: "#ff5555", marginBottom: "15px" }}>
            Application Error
          </h1>
          <p style={{ color: "rgba(255,255,255,0.8)", marginBottom: "20px" }}>
            Sorry, something went wrong while rendering the application. Please
            try refreshing the page.
          </p>
          {/* Optionally show error details in development environments */}
          {import.meta.env.DEV && this.state.error && (
            <details
              style={{
                marginTop: "20px",
                padding: "15px",
                background: "rgba(0,0,0,0.2)",
                borderRadius: "5px",
                border: "1px solid #555",
                color: "rgba(255,255,255,0.7)",
                maxWidth: "80%",
                overflow: "auto",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: "bold",
                  color: "#ffa500",
                }}
              >
                Error Details (Development Mode)
              </summary>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  marginTop: "10px",
                  textAlign: "left",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  wordBreak: "break-all",
                }}
              >
                {this.state.error.toString()}
                {this.state.errorInfo &&
                  this.state.errorInfo.componentStack &&
                  `\n\nComponent Stack:\n${this.state.errorInfo.componentStack}`}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ErrorBoundary;
```

---
### `src\components\LayerConfiguration\LayerConfiguration.jsx`
```jsx
// src/components/LayerConfiguration.jsx
import React, { useEffect, useRef, useMemo, useCallback } from "react";
import PropTypes from "prop-types";

import { useProfileSessionState } from "../../hooks/configSelectors"; // Local hook
import { useMIDI } from "../../context/MIDIContext"; // Local context

// Import sliderParams from its direct source file
import { sliderParams } from "../../config/sliderParams";

import { midiIcon, rotateIcon } from "../../assets"; // Local assets

import "./LayerConfigurationStyles/LayerConfiguration.css"; // Local styles

/**
 * Formats a numerical value to a string with a specified number of decimal places.
 * Returns a default string if the input is not a valid number.
 * @param {number|string|null|undefined} value - The value to format.
 * @param {number} [decimals=1] - The number of decimal places to use.
 * @returns {string} The formatted string representation of the value.
 */
const formatValue = (value, decimals = 1) => {
  const numValue = Number(value);
  if (value === undefined || value === null || isNaN(numValue)) {
    return "0".padEnd(decimals > 0 ? decimals + 2 : 1, "0");
  }
  return numValue.toFixed(decimals);
};


/**
 * @typedef {object} LayerConfigValue
 * @property {number|string|boolean|object} [enabled] - Whether the layer is enabled.
 * @property {string} [blendMode] - CSS mix-blend-mode.
 * @property {number} [opacity] - Layer opacity (0-1).
 * @property {number} [size] - Size multiplier.
 * @property {number} [speed] - Animation speed.
 * @property {number} [drift] - Drift magnitude.
 * @property {number} [driftSpeed] - Drift oscillation speed.
 * @property {number} [angle] - Rotation angle in degrees.
 * @property {number} [xaxis] - X-axis offset.
 * @property {number} [yaxis] - Y-axis offset.
 * @property {number} [direction] - Animation direction (-1 or 1).
 * @property {object} [driftState] - Internal state for drift effect.
 */

/**
 * @typedef {object} LayerConfigurationProps
 * @property {Object.<string|number, LayerConfigValue>} layerConfigs - An object containing configurations for all layers, keyed by layer ID.
 * @property {(layerId: number, key: string, value: any) => void} onLayerConfigChange - Callback to update a layer's configuration property.
 * @property {string[]} [blendModes=[]] - Array of available blend mode strings for the blend mode selector.
 * @property {number} [activeLayer=1] - The ID of the currently active layer being controlled (e.g., 1, 2, or 3).
 * @property {boolean} [readOnly=false] - Prop to explicitly set read-only mode. This can be overridden by session state (e.g., if user is not owner or in preview mode).
 * @property {boolean} [showMidiConnect=true] - Whether to show the MIDI connection status and related controls.
 */

/**
 * LayerConfiguration component provides UI controls for manipulating parameters
 * of a single visual layer.
 *
 * @param {LayerConfigurationProps} props - Component props.
 * @returns {JSX.Element} The rendered LayerConfiguration panel.
 */
const LayerConfiguration = ({
  layerConfigs,
  onLayerConfigChange,
  blendModes = [],
  activeLayer = 1,
  readOnly: propReadOnly = false,
  showMidiConnect = true,
}) => {
  // isPreviewMode is not directly used, canInteract already considers it.
  const { isVisitor, isParentAdmin, canInteract } = useProfileSessionState();
  const {
    isConnected: midiConnected,
    connectMIDI,
    midiMap,
    layerMappings,
    midiLearning,
    learningLayer,
    selectedChannel,
    midiMonitorData,
    showMidiMonitor: displayMidiMonitor,
    setShowMidiMonitor,
    startMIDILearn,
    stopMIDILearn,
    startLayerMIDILearn,
    stopLayerMIDILearn,
    setChannelFilter,
    clearMIDIMonitor,
    clearAllMappings,
  } = useMIDI();

  /** @type {React.RefObject<HTMLDivElement | null>} */
  const midiMonitorRef = useRef(null);

  const effectiveReadOnly = useMemo(() => {
    if (!canInteract) return true;
    return propReadOnly;
  }, [canInteract, propReadOnly]);

  const config = useMemo(() => layerConfigs[activeLayer] || {}, [layerConfigs, activeLayer]);

  useEffect(() => {
    if (midiMonitorRef.current && displayMidiMonitor) {
      midiMonitorRef.current.scrollTop = midiMonitorRef.current.scrollHeight;
    }
  }, [midiMonitorData, displayMidiMonitor]);

  const handleSliderChange = useCallback((e) => {
    if (effectiveReadOnly) return;
    const { name, value } = e.target;
    if (typeof onLayerConfigChange === 'function') {
      onLayerConfigChange(activeLayer, name, parseFloat(value));
    } else if (import.meta.env.DEV) {
      console.warn("[LayerConfiguration] onLayerConfigChange is not a function.");
    }
  }, [effectiveReadOnly, onLayerConfigChange, activeLayer]);

  const handleBlendModeChange = useCallback((e) => {
    if (effectiveReadOnly) return;
    const { value } = e.target;
    if (typeof onLayerConfigChange === 'function') {
      onLayerConfigChange(activeLayer, "blendMode", value);
    } else if (import.meta.env.DEV) {
      console.warn("[LayerConfiguration] onLayerConfigChange is not a function.");
    }
  }, [effectiveReadOnly, onLayerConfigChange, activeLayer]);

  const handleDirectionToggle = useCallback(() => {
    if (effectiveReadOnly) return;
    const currentDirection = config.direction || 1;
    if (typeof onLayerConfigChange === 'function') {
      onLayerConfigChange(activeLayer, "direction", -currentDirection);
    } else if (import.meta.env.DEV) {
      console.warn("[LayerConfiguration] onLayerConfigChange is not a function.");
    }
  }, [effectiveReadOnly, config.direction, onLayerConfigChange, activeLayer]);

  const enterMIDILearnMode = useCallback((paramName) => {
    if (effectiveReadOnly) return;
    if (!midiConnected) {
      alert("Please connect your MIDI device first using the 'Connect MIDI' button.");
      return;
    }
    if (typeof startMIDILearn === 'function') {
      startMIDILearn(paramName, activeLayer);
    }
  }, [effectiveReadOnly, midiConnected, startMIDILearn, activeLayer]);

  const enterLayerMIDILearnMode = useCallback((layer) => {
    if (effectiveReadOnly) return;
    if (!midiConnected) {
      alert("Please connect your MIDI device first using the 'Connect MIDI' button.");
      return;
    }
    if (typeof startLayerMIDILearn === 'function') {
      startLayerMIDILearn(layer);
    }
  }, [effectiveReadOnly, midiConnected, startLayerMIDILearn]);

  const connectMidiCb = useCallback(() => {
    if (typeof connectMIDI === 'function') {
      connectMIDI().catch((err) => {
        alert(`Failed to access MIDI devices: ${err.message}`);
      });
    }
  }, [connectMIDI]);

  const handleMidiChannelChangeCb = useCallback((e) => {
    if (typeof setChannelFilter === 'function') {
      setChannelFilter(parseInt(e.target.value, 10));
    }
  }, [setChannelFilter]);

  const clearMidiMonitorDataCb = useCallback(() => {
    if (typeof clearMIDIMonitor === 'function') {
      clearMIDIMonitor();
    }
  }, [clearMIDIMonitor]);

  const resetAllMappingsDataCb = useCallback(() => {
    if (effectiveReadOnly) return;
    if (typeof clearAllMappings === 'function') {
      clearAllMappings();
    }
  }, [effectiveReadOnly, clearAllMappings]);

  const formatMidiMappingDisplay = useCallback((mapping) => {
    if (!mapping) return "None";
    const channelText = mapping.channel !== undefined ? ` (Ch ${mapping.channel + 1})` : "";
    if (mapping.type === "cc") return `CC ${mapping.number}${channelText}`;
    if (mapping.type === "note") return `Note ${mapping.number}${channelText}`;
    if (mapping.type === "pitchbend") return `Pitch${channelText}`;
    return "Unknown";
  }, []);

  const currentParamMidiMappings = useMemo(() => midiMap[activeLayer] || {}, [midiMap, activeLayer]);

  const visitorOnShowcaseMessage = isVisitor && isParentAdmin && !effectiveReadOnly && (
    <div className="visitor-message info">
      As an admin visitor, you can experiment with all controls on this demo page.
      Changes won't be saved permanently.
    </div>
  );

  return (
    <div className="layer-configuration">
      {showMidiConnect && (
        <div className="midi-status-section">
          <div className="midi-status-row">
            <span>MIDI: {midiConnected ? "Connected" : "Not Connected"}</span>
            {!midiConnected ? (
              <button type="button" className="midi-connect-btn" onClick={connectMidiCb} aria-label="Connect MIDI device">
                <img src={midiIcon} alt="" className="midi-icon" />
                Connect MIDI
              </button>
            ) : (
              <div className="midi-buttons">
                <button
                  type="button"
                  className="midi-tool-button"
                  onClick={() => setShowMidiMonitor && setShowMidiMonitor(!displayMidiMonitor)}
                >
                  {displayMidiMonitor ? "Hide Monitor" : "Show Monitor"}
                </button>
                <button
                  type="button"
                  className="midi-tool-button midi-reset-btn"
                  onClick={resetAllMappingsDataCb}
                  title="Reset all MIDI mappings for current controller"
                  disabled={effectiveReadOnly}
                  aria-label="Reset all MIDI mappings"
                >
                  Reset Mappings
                </button>
                <select
                  className="midi-channel-select custom-select"
                  value={selectedChannel}
                  onChange={handleMidiChannelChangeCb}
                  title="Filter MIDI messages by channel"
                  aria-label="Select MIDI channel filter"
                >
                  <option value="0">All Channels</option>
                  {[...Array(16)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Channel {i + 1}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {midiLearning && midiLearning.layer === activeLayer && (
            <div className="midi-learning-container">
              <span className="midi-learning-text">
                Mapping: {midiLearning.param.toUpperCase()}
              </span>
              <div className="midi-learning-instructions">
                Move a knob or press a button/pad on your MIDI controller
                <button
                  type="button"
                  className="midi-cancel-btn"
                  onClick={() => stopMIDILearn && stopMIDILearn()}
                  aria-label="Cancel MIDI learning for parameter"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {learningLayer !== null && (
            <div className="midi-learning-container layer-learning">
              <span className="midi-learning-text">
                Mapping: LAYER {learningLayer}
              </span>
              <div className="midi-learning-instructions">
                Press a key/pad on your MIDI controller
                <button
                  type="button"
                  className="midi-cancel-btn"
                  onClick={() => stopLayerMIDILearn && stopLayerMIDILearn()}
                  aria-label="Cancel MIDI learning for layer selection"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {displayMidiMonitor && midiConnected && (
        <div className="midi-monitor" ref={midiMonitorRef}>
          <div className="midi-monitor-header">
            <h4>MIDI Monitor</h4>
            <button type="button" className="midi-clear-btn small-action-button" onClick={clearMidiMonitorDataCb} aria-label="Clear MIDI Monitor">
              Clear
            </button>
          </div>
          <div className="midi-monitor-content">
            {midiMonitorData.length === 0 ? (
              <div className="midi-monitor-empty">
                No MIDI messages received yet. Try moving controls on your MIDI device.
              </div>
            ) : (
              midiMonitorData.map((msg, index) => (
                <div key={`${msg.timestamp}-${index}`} className="midi-monitor-msg">
                  <span className="midi-monitor-time">{msg.timestamp}</span>
                  <span className="midi-monitor-type">{msg.type}</span>
                  <span className="midi-monitor-channel">Ch{msg.channel}</span>
                  <span className="midi-monitor-data">D1:{msg.data1}</span>
                  <span className="midi-monitor-data">D2:{msg.data2}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="layer-mappings">
        <h4 className="section-title">LAYER SELECTION MAPPINGS</h4>
        <div className="layer-mapping-grid">
          {[1, 2, 3].map((layerNum) => (
            <div
              key={`layer_select_mapping_${layerNum}`}
              className={`layer-mapping-item ${learningLayer === layerNum ? "learning-active" : ""}`}
            >
              <div className="layer-mapping-label">Layer {layerNum}</div>
              <div className="layer-mapping-controls">
                <span className="layer-mapping-text" title={`Current MIDI mapping for Layer ${layerNum} selection`}>
                  {layerMappings[layerNum]?.layerSelect
                    ? formatMidiMappingDisplay(layerMappings[layerNum].layerSelect)
                    : "Not mapped"}
                </span>
                <button
                  type="button"
                  className={`midi-learn-btn small-action-button ${learningLayer === layerNum ? "learning" : ""}`}
                  onClick={() => enterLayerMIDILearnMode(layerNum)}
                  disabled={effectiveReadOnly || !midiConnected || (learningLayer !== null && learningLayer !== layerNum)}
                  aria-label={`Map MIDI to select Layer ${layerNum}`}
                >
                  {learningLayer === layerNum ? "..." : "Map"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="slider-group-container">
        {sliderParams.map(({prop, label, min, max, step, formatDecimals, defaultValue = 0}) => (
            <div className="slider-container" key={`${activeLayer}-${prop}`}>
                <div className="slider-header">
                    <span className="slider-label">{label}</span>
                    <span className="slider-value">
                        {formatValue(config[prop] !== undefined ? config[prop] : defaultValue, formatDecimals)}
                    </span>
                    {showMidiConnect && midiConnected && (
                        <div className="midi-mapping-info">
                            <span className="midi-mapping-text" title={`Current MIDI mapping for ${label}`}>
                                {formatMidiMappingDisplay(currentParamMidiMappings[prop])}
                            </span>
                            <button
                                type="button"
                                className={`midi-learn-btn small-action-button ${midiLearning?.param === prop && midiLearning?.layer === activeLayer ? "learning" : ""}`}
                                onClick={() => enterMIDILearnMode(prop)}
                                disabled={effectiveReadOnly || !midiConnected || (midiLearning !== null && !(midiLearning?.param === prop && midiLearning?.layer === activeLayer))}
                                title={`Click to map ${label} to a MIDI controller`}
                                aria-label={`Map MIDI to ${label}`}
                            >
                                {midiLearning?.param === prop && midiLearning?.layer === activeLayer ? "..." : "Map"}
                            </button>
                        </div>
                    )}
                </div>
                <input
                    type="range"
                    name={prop}
                    min={min}
                    max={max}
                    step={step}
                    value={config[prop] !== undefined ? config[prop] : defaultValue}
                    onChange={handleSliderChange}
                    disabled={effectiveReadOnly || (midiLearning?.param === prop && midiLearning?.layer === activeLayer)}
                    className="horizontal-slider"
                    aria-label={`${label} slider`}
                />
            </div>
        ))}
      </div>


      <div className="controls-footer">
        <div className="blendmode-container">
          <label htmlFor={`blendMode-${activeLayer}`}>BLEND MODE</label>
          <select
            id={`blendMode-${activeLayer}`}
            className="custom-select blend-mode-select"
            name="blendMode"
            value={config.blendMode || "normal"}
            onChange={handleBlendModeChange}
            disabled={effectiveReadOnly}
            aria-label="Select Blend Mode"
          >
            {blendModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="changerotation-btn icon-button"
          onClick={handleDirectionToggle}
          disabled={effectiveReadOnly}
          title="Change Rotation Direction"
          aria-label="Change Rotation Direction"
        >
          <img
            src={rotateIcon}
            alt="Change Rotation Direction"
            className="direction-icon"
          />
        </button>
      </div>
      {visitorOnShowcaseMessage}
    </div>
  );
};

LayerConfiguration.propTypes = {
  layerConfigs: PropTypes.object.isRequired,
  onLayerConfigChange: PropTypes.func.isRequired,
  blendModes: PropTypes.array,
  activeLayer: PropTypes.number,
  readOnly: PropTypes.bool,
  showMidiConnect: PropTypes.bool,
};

export default LayerConfiguration;
```

---
### `src\components\LayerConfiguration\LayerConfigurationStyles\LayerConfiguration.css`
```css
.slider-container {
  margin-bottom: var(--space-md);
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-xs);
}

.slider-label {
  font-weight: bold;
  color: var(--color-text);
}

.slider-value {
  font-family: monospace;
  color: var(--color-primary);
}

.midi-status {
  background: var(--color-bg-alt);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-md);
  display: flex;
  flex-direction: column;
}

.midi-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-sm);
}

.midi-buttons {
  display: flex;
  gap: var(--space-xs);
  align-items: center;
}

.midi-connect-btn,
.midi-monitor-btn,
.midi-clear-btn,
.midi-cancel-btn,
.midi-reset-btn {
  background: var(--color-primary-a15);
  color: var(--color-primary);
  border: 1px solid var(--color-primary-a30);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.midi-connect-btn:hover,
.midi-monitor-btn:hover,
.midi-clear-btn:hover,
.midi-cancel-btn:hover,
.midi-reset-btn:hover {
  background: var(--color-primary-a25);
  transform: translateY(-1px);
}

.midi-reset-btn {
  background: var(--color-warning-a15);
  color: var(--color-warning);
  border-color: var(--color-warning-a30);
}

.midi-reset-btn:hover {
  background: var(--color-warning-a25);
}

.midi-cancel-btn {
  background: var(--color-error-a15);
  color: var(--color-error);
  border-color: var(--color-error-a30);
  margin-left: var(--space-sm);
}

.midi-cancel-btn:hover {
  background: var(--color-error-a25);
}

.midi-channel-select {
  padding: 4px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: var(--font-size-xs);
}

.midi-learning-container {
  display: flex;
  flex-direction: column;
  margin-top: var(--space-xs);
  padding: var(--space-sm);
  background: var(--color-accent-a05);
  border: 1px solid var(--color-accent-a15);
  border-radius: var(--radius-md);
}

.midi-learning-container.layer-learning {
  background: var(--color-warning-a05);
  border: 1px solid var(--color-warning-a15);
}

.midi-learning {
  color: var(--color-accent);
  font-weight: bold;
  animation: blink 1s infinite;
}

.layer-learning .midi-learning {
  color: var(--color-warning);
}

.midi-learning-instructions {
  margin-top: var(--space-xs);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
}

.midi-mapping-info {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.midi-mapping-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  background: var(--color-bg-alt);
  padding: 2px 4px;
  border-radius: var(--radius-sm);
}

.midi-learn-btn {
  padding: 2px 6px;
  font-size: var(--font-size-xs);
  background: var(--color-primary-a10);
  border: 1px solid var(--color-primary-a20);
  border-radius: var(--radius-sm);
  color: var(--color-primary);
  cursor: pointer;
}

.midi-learn-btn:hover:not(:disabled) {
  background: var(--color-primary-a20);
}

.midi-learn-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.midi-monitor {
  margin-bottom: var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  max-height: 150px;
  display: flex;
  flex-direction: column;
}

.midi-monitor-header {
  background: var(--color-bg-alt);
  padding: var(--space-xs) var(--space-sm);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
}

.midi-monitor-header h4 {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.midi-monitor-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-xs);
  font-size: var(--font-size-xs);
  font-family: monospace;
  background: var(--color-bg);
}

.midi-monitor-empty {
  padding: var(--space-sm);
  text-align: center;
  color: var(--color-text-dim);
}

.midi-monitor-msg {
  padding: 2px 0;
  display: flex;
  border-bottom: 1px solid var(--color-border-light);
}

.midi-monitor-time {
  width: 70px;
  color: var(--color-text-dim);
}

.midi-monitor-type {
  width: 100px;
  color: var(--color-primary);
}

.midi-monitor-channel {
  width: 60px;
  color: var(--color-accent);
}

.midi-monitor-data {
  width: 40px;
  text-align: right;
  color: var(--color-text);
  margin-right: var(--space-sm);
}

.layer-mappings {
  margin-bottom: var(--space-md);
  background: var(--color-bg-alt);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
}

.section-title {
  margin: 0 0 var(--space-sm) 0;
  font-size: var(--font-size-md);
  color: var(--color-primary);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-xs);
}

.layer-mapping-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-sm);
}

.layer-mapping-item {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-xs);
}

.layer-mapping-item.active {
  border-color: var(--color-primary-a50);
  background: var(--color-primary-a10);
}

.layer-mapping-label {
  font-weight: bold;
  margin-bottom: var(--space-xs);
  font-size: var(--font-size-sm);
}

.layer-mapping-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.layer-mapping-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
}

.visitor-message {
  margin-top: var(--space-md);
  padding: var(--space-sm);
  background: var(--color-primary-a05);
  border: 1px solid var(--color-primary-a15);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-primary-a90);
  text-align: center;
}

@keyframes blink {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}

```

---
### `src\components\Main\Mainview.jsx`
```jsx
// src/components/Main/Mainview.jsx
import React, { useRef, useEffect, useMemo, useState, useCallback } from "react";
import PropTypes from "prop-types";

// Custom Hooks
import { useUpProvider } from "../../context/UpProvider.jsx";
import { useCoreApplicationStateAndLifecycle } from '../../hooks/useCoreApplicationStateAndLifecycle';
import { useAppInteractions } from '../../hooks/useAppInteractions';
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import { useVisualEngineContext } from "../../context/VisualEngineContext";

// UI Components
import ToastContainer from "../Notifications/ToastContainer";
import UIOverlay from '../UI/UIOverlay';
import CanvasContainerWrapper from '../MainViewParts/CanvasContainerWrapper';
import FpsDisplay from '../MainViewParts/FpsDisplay';
import StatusIndicator from '../MainViewParts/StatusIndicator';
import AudioAnalyzerWrapper from '../MainViewParts/AudioAnalyzerWrapper';
import CriticalErrorDisplay from '../MainViewParts/CriticalErrorDisplay';

// Config & Assets
import { BLEND_MODES } from "../../config/global-config";
import { PING_COLOR, PING_STROKE_WIDTH, NO_PING_SELECTORS } from "../../config/uiConstants";

// Styles
import "./MainviewStyles/Mainview.css";

const DEFAULT_CROSSFADE_DURATION = 1000;

const LoadingIndicatorPill = ({ message, isVisible }) => {
  return (
    <div className={`loading-indicator-pill ${isVisible ? 'visible' : ''}`}>
      <div className="loading-spinner"></div>
      <span className="loading-message">{message}</span>
    </div>
  );
};
LoadingIndicatorPill.propTypes = {
  message: PropTypes.string.isRequired,
  isVisible: PropTypes.bool.isRequired,
};

const portalContainerNode = typeof document !== 'undefined' ? document.getElementById('portal-container') : null;

const MainView = ({ blendModes = BLEND_MODES }) => {
  const { publicClient, walletClient, upInitializationError, upFetchStateError } = useUpProvider();

  const {
    isWorkspaceTransitioning,
    _executeLoadAfterFade,
    loadingMessage,
    stagedSetlist,
    loadWorkspace,
    activeWorkspaceName,
    fullSceneList, 
    activeSceneName, 
  } = useWorkspaceContext();

  const {
    registerManagerInstancesRef,
    registerCanvasUpdateFns,
    uiControlConfig,
    handleSceneSelect, 
  } = useVisualEngineContext();
  
  const rootRef = useRef(null);
  
  const canvasRef1A = useRef(null);
  const canvasRef1B = useRef(null);
  const canvasRef2A = useRef(null);
  const canvasRef2B = useRef(null);
  const canvasRef3A = useRef(null);
  const canvasRef3B = useRef(null);
  const canvasRefs = useMemo(() => ({
    "1": { A: canvasRef1A, B: canvasRef1B },
    "2": { A: canvasRef2A, B: canvasRef2B },
    "3": { A: canvasRef3A, B: canvasRef3B },
  }), []);

  const [isParallaxEnabled, setIsParallaxEnabled] = useState(false);
  const toggleParallax = useCallback(() => setIsParallaxEnabled(prev => !prev), []);
  const [crossfadeDurationMs, setCrossfadeDurationMs] = useState(DEFAULT_CROSSFADE_DURATION);

  const [localAnimatingPanel, setLocalAnimatingPanel] = useState(null);
  const [localIsBenignOverlayActive, setLocalIsBenignOverlayActive] = useState(false);
  
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const parallaxRafIdRef = useRef(null);

  useEffect(() => {
    let fadeOutTimer = null;
    if (isWorkspaceTransitioning) {
      fadeOutTimer = setTimeout(() => {
        if (_executeLoadAfterFade) {
          _executeLoadAfterFade();
        }
      }, 500);
    }
    return () => {
      if (fadeOutTimer) {
        clearTimeout(fadeOutTimer);
      }
    };
  }, [isWorkspaceTransitioning, _executeLoadAfterFade]);

  const coreApp = useCoreApplicationStateAndLifecycle({
    canvasRefs,
    animatingPanel: localAnimatingPanel, 
    isBenignOverlayActive: localIsBenignOverlayActive,
  });

  const {
    containerRef, managerInstancesRef, audioState,
    renderState, loadingStatusMessage: renderLifecycleMessage, isStatusFadingOut, showStatusDisplay,
    showRetryButton, isTransitioning, outgoingLayerIdsOnTransitionStart,
    makeIncomingCanvasVisible, 
    handleManualRetry,
    managersReady,
    setCanvasLayerImage,
    isContainerObservedVisible, isFullscreenActive, enterFullscreen,
    isMountedRef,
    sequencer, 
  } = coreApp;

  useEffect(() => {
    if (registerManagerInstancesRef) {
        registerManagerInstancesRef(managerInstancesRef);
    }
    if (registerCanvasUpdateFns) {
        registerCanvasUpdateFns({ setCanvasLayerImage });
    }
  }, [registerManagerInstancesRef, registerCanvasUpdateFns, managerInstancesRef, setCanvasLayerImage]);


  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      mousePositionRef.current = { x, y };
    };
  
    const updateParallax = () => {
      if (managerInstancesRef.current) {
        const { x, y } = isParallaxEnabled ? mousePositionRef.current : { x: 0, y: 0 };
        
        Object.values(managerInstancesRef.current).forEach(manager => {
          if (manager?.setParallaxOffset) {
            manager.setParallaxOffset(x, y);
          }
        });
      }
      parallaxRafIdRef.current = requestAnimationFrame(updateParallax);
    };
  
    window.addEventListener('mousemove', handleMouseMove);
    parallaxRafIdRef.current = requestAnimationFrame(updateParallax);
  
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (parallaxRafIdRef.current) {
        cancelAnimationFrame(parallaxRafIdRef.current);
      }
    };
  }, [managerInstancesRef, isParallaxEnabled]);

  const handleTogglePLock = useCallback(() => { sequencer.toggle(uiControlConfig?.layers); }, [sequencer, uiControlConfig]);

  const workspaceList = useMemo(() => {
    if (!stagedSetlist?.workspaces) return [];
    return Object.keys(stagedSetlist.workspaces)
      .map(name => ({ name }));
  }, [stagedSetlist]);

  const handleNextScene = useCallback(() => {
    if (!fullSceneList || fullSceneList.length < 2) return;
    const currentIndex = fullSceneList.findIndex(p => p.name === activeSceneName);
    const nextIndex = (currentIndex + 1) % fullSceneList.length;
    const nextScene = fullSceneList[nextIndex];
    if (nextScene?.name) {
      handleSceneSelect(nextScene.name, crossfadeDurationMs);
    }
  }, [fullSceneList, activeSceneName, handleSceneSelect, crossfadeDurationMs]);

  const handlePrevScene = useCallback(() => {
    if (!fullSceneList || fullSceneList.length < 2) return;
    const currentIndex = fullSceneList.findIndex(p => p.name === activeSceneName);
    const prevIndex = (currentIndex - 1 + fullSceneList.length) % fullSceneList.length;
    const prevScene = fullSceneList[prevIndex];
    if (prevScene?.name) {
      handleSceneSelect(prevScene.name, crossfadeDurationMs);
    }
  }, [fullSceneList, activeSceneName, handleSceneSelect, crossfadeDurationMs]);

  const handleNextWorkspace = useCallback(() => {
    if (!workspaceList || workspaceList.length < 2) return;
    const currentIndex = workspaceList.findIndex(w => w.name === activeWorkspaceName);
    const nextIndex = (currentIndex + 1) % workspaceList.length;
    const nextWorkspace = workspaceList[nextIndex];
    if (nextWorkspace?.name) {
        loadWorkspace(nextWorkspace.name);
    }
  }, [workspaceList, activeWorkspaceName, loadWorkspace]);

  const handlePrevWorkspace = useCallback(() => {
      if (!workspaceList || workspaceList.length < 2) return;
      const currentIndex = workspaceList.findIndex(w => w.name === activeWorkspaceName);
      const prevIndex = (currentIndex - 1 + workspaceList.length) % workspaceList.length;
      const prevWorkspace = workspaceList[prevIndex];
      if (prevWorkspace?.name) {
          loadWorkspace(prevWorkspace.name);
      }
  }, [workspaceList, activeWorkspaceName, loadWorkspace]);

  const appInteractions = useAppInteractions({
    managerInstancesRef, 
    isMountedRef, 
    onTogglePLock: handleTogglePLock,
    onNextScene: handleNextScene,
    onPrevScene: handlePrevScene,
    onNextWorkspace: handleNextWorkspace,
    onPrevWorkspace: handlePrevWorkspace,
  });

  const { uiStateHook } = appInteractions;

  useEffect(() => {
    setLocalAnimatingPanel(uiStateHook.animatingPanel);
    const newIsBenign = uiStateHook.animatingPanel === 'tokens' || uiStateHook.activePanel === 'tokens' || uiStateHook.infoOverlayOpen;
    setLocalIsBenignOverlayActive(newIsBenign);
  }, [ uiStateHook.animatingPanel, uiStateHook.activePanel, uiStateHook.infoOverlayOpen ]);

  const criticalErrorContent = (
    <CriticalErrorDisplay initializationError={upInitializationError} fetchStateError={upFetchStateError} publicClient={publicClient} walletClient={walletClient} />
  );
  if (criticalErrorContent.props.initializationError || (criticalErrorContent.props.fetchStateError && !criticalErrorContent.props.publicClient && !criticalErrorContent.props.walletClient)) {
    return criticalErrorContent;
  }
  
  const showFpsCounter = useMemo(() => renderState === 'rendered' && isContainerObservedVisible, [renderState, isContainerObservedVisible]);

  const actionsForUIOverlay = useMemo(() => ({
    onEnhancedView: enterFullscreen,
    onToggleParallax: toggleParallax,
    onPreviewEffect: appInteractions.processEffect,
  }), [enterFullscreen, toggleParallax, appInteractions.processEffect]);

  const pLockProps = useMemo(() => ({
    pLockState: sequencer.pLockState, loopProgress: sequencer.loopProgress, hasLockedParams: sequencer.hasLockedParams,
    onTogglePLock: handleTogglePLock, pLockSpeed: sequencer.pLockSpeed, onSetPLockSpeed: sequencer.setPLockSpeed,
    animationDataRef: sequencer.animationDataRef,
  }), [sequencer, handleTogglePLock]);

  const getCanvasClasses = useCallback((layerIdStr) => {
    let classes = `canvas layer-${layerIdStr}`;
    const isOutgoing = isTransitioning && outgoingLayerIdsOnTransitionStart?.has(layerIdStr);
    const isStableAndVisible = !isTransitioning && renderState === 'rendered';
    const isIncomingAndReadyToFadeIn = isTransitioning && makeIncomingCanvasVisible;
    if (isOutgoing) classes += ' visible is-fading-out';
    else if (isStableAndVisible) classes += ' visible';
    else if (isIncomingAndReadyToFadeIn) classes += ' visible is-fading-in';
    return classes;
  }, [isTransitioning, outgoingLayerIdsOnTransitionStart, renderState, makeIncomingCanvasVisible]);

  const containerClass = `canvas-container ${isTransitioning ? 'transitioning-active' : ''} ${isWorkspaceTransitioning ? 'workspace-fading-out' : ''}`;
  
  const isReadyToRender = renderState === 'rendered';
  
  const showLoadingIndicator = !!loadingMessage;

  return (
    <>
      <div id="fullscreen-root" ref={rootRef} className="main-view radar-cursor">
        
        <LoadingIndicatorPill message={loadingMessage} isVisible={showLoadingIndicator} />

        <CanvasContainerWrapper
          containerRef={containerRef}
          canvasRefs={{
            '1A': canvasRef1A, '1B': canvasRef1B,
            '2A': canvasRef2A, '2B': canvasRef2B,
            '3A': canvasRef3A, '3B': canvasRef3B,
          }}
          containerClass={containerClass}
          baseCanvasClass={getCanvasClasses}
          pingColor={PING_COLOR}
          pingStrokeWidth={PING_STROKE_WIDTH}
          noPingSelectors={NO_PING_SELECTORS}
        />

        {isReadyToRender && (
          <>
            <FpsDisplay showFpsCounter={showFpsCounter} isFullscreenActive={isFullscreenActive} portalContainer={portalContainerNode} />
            <ToastContainer />
            <UIOverlay
              uiState={uiStateHook}
              audioState={audioState}
              pLockProps={pLockProps}
              isReady={isReadyToRender}
              actions={actionsForUIOverlay}
              configData={{ 
                isParallaxEnabled,
                renderState,
              }}
              crossfadeDurationMs={crossfadeDurationMs}
              onSetCrossfadeDuration={setCrossfadeDurationMs}
            />
            <StatusIndicator
                showStatusDisplay={showStatusDisplay}
                isStatusFadingOut={isStatusFadingOut}
                renderState={renderState}
                loadingStatusMessage={renderLifecycleMessage}
                showRetryButton={showRetryButton}
                onManualRetry={handleManualRetry}
            />
            <AudioAnalyzerWrapper
              isAudioActive={audioState.isAudioActive}
              managersReady={managersReady}
              handleAudioDataUpdate={audioState.handleAudioDataUpdate}
              layerConfigs={uiControlConfig?.layers} 
              audioSettings={audioState.audioSettings}
              configLoadNonce={0}
              managerInstancesRef={managerInstancesRef}
            />
          </>
        )}
      </div>
    </>
  );
};
MainView.propTypes = { blendModes: PropTypes.arrayOf(PropTypes.string) };
export default MainView;
```

---
### `src\components\Main\MainviewStyles\FpsCounter.css`
```css
.fps-counter {
  position: fixed;
  bottom: var(--space-md, 16px);
  left: var(--space-md, 16px);
  background-color: rgba(0, 0, 0, 0.7);
  color: #00f3ff;
  padding: var(--space-xs, 8px) var(--space-sm, 12px);
  border-radius: var(--radius-sm, 4px);
  font-size: var(--font-size-lg, 16px);
  font-family: monospace;
  z-index: 10001;
  pointer-events: none;
  opacity: 0.9;
  border: 1px solid var(--color-primary-a30, rgba(0, 243, 255, 0.3));
}
```

---
### `src\components\Main\MainviewStyles\Mainview.css`
```css
/* src/components/Main/MainviewStyles/Mainview.css */
@import "../../../styles/variables.css";

.main-view {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #000000;
}

.canvas-container {
  position: relative;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: block;
  transform: translateZ(0);
  will-change: opacity;
  opacity: 1;
  visibility: visible;
  background: radial-gradient( circle at center, var(--color-bg-light) 0%, #000000 100% );
  z-index: 1;
  transition: opacity 0.5s ease-in-out; /* This is our fade duration */
}

/* New class for the workspace fade-out state */
.canvas-container.workspace-fading-out {
  opacity: 0;
}

.main-view.overlay-animating .canvas-container {
  opacity: 0.6;
  transition: opacity 0.05s linear; /* Fast dim when overlay appears */
}

.grid-overlay {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 20px 20px;
  z-index: 2;
  pointer-events: none;
}

/* --- START: PARALLAX BORDER FIX --- */
.canvas {
  position: absolute;
  /* Make the canvas larger than the viewport to create a bleed area */
  width: 110% !important;
  height: 110% !important;
  /* Reposition the oversized canvas so it's centered */
  top: -5%; 
  left: -5%;
  display: block;
  backface-visibility: hidden;
  will-change: transform, opacity;

  /* Default state: hidden, ready for transition-in */
  opacity: 0;
  visibility: hidden;
  /* The initial transform from the scene fade-in is now just scale */
  transform: scale(1.15); 
}
/* --- END: PARALLAX BORDER FIX --- */

/* --- START: Layering for A/B canvases --- */
.canvas.layer-1.canvas-deck-a { z-index: 3; }
.canvas.layer-1.canvas-deck-b { z-index: 4; }
.canvas.layer-2.canvas-deck-a { z-index: 5; }
.canvas.layer-2.canvas-deck-b { z-index: 6; }
.canvas.layer-3.canvas-deck-a { z-index: 7; }
.canvas.layer-3.canvas-deck-b { z-index: 8; }
/* --- END: Layering for A/B canvases --- */


/*
  Core transition applied when opacity or transform changes.
  This is the master duration for scene fades.
*/
.canvas {
  transition-property: opacity, transform;
  transition-duration: 500ms; /* This MUST match CANVAS_FADE_DURATION in JS */
  transition-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
}

/*
  .visible class is added by JS to set the final visible state.
  The transition to these properties is governed by the base .canvas transition.
*/
.canvas.visible {
  opacity: 1;
  visibility: visible;
  /* The final transform for a visible canvas is its external parallax position,
     which is handled by inline styles in CanvasManager.js.
     We set a base scale here. */
  transform: scale(1);
}

/*
  A fading-out canvas is one that is already `.visible` but needs to animate to hidden.
  This class overrides the opacity to trigger the transition defined on the base `.canvas` rule.
*/
.canvas.is-fading-out {
  opacity: 0 !important;
  transform: scale(0.95) !important;
  z-index: 100 !important; /* Keep on top during its fade out */
}


/* Applied to the canvas that is FADING IN */
.canvas.is-fading-in {
  visibility: visible !important;
}


/* Entity Logo */
.entity-logo {
  position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
  height: 40px; z-index: 150;
  opacity: 1; visibility: visible;
}

/* Status Display, FPS Counter, etc. */
.status-display {
  position: fixed;
  top: 75%; 
  left: 50%;
  transform: translate(-50%, -50%); 
  z-index: var(--z-top);
  backdrop-filter: blur(var(--blur-amount, 3px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 3px));
  box-shadow: var(--shadow-md);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-weight: 500;
  text-align: center;
  min-width: 250px;
  transition: opacity 1000ms cubic-bezier(0.2, 0.8, 0.2, 1); 
  opacity: 1;
  pointer-events: none;
}

.status-display.info-state {
  background: rgba(var(--color-warning-rgb), 0.25);
  border: 1px solid var(--color-warning-a50, rgba(255, 165, 0, 0.5));
  color: var(--color-warning, #ffa500);
  box-shadow: 0 0 12px rgba(var(--color-warning-rgb), 0.4);
}

.status-display.error-state {
  background: rgba(var(--color-error-rgb), 0.25);
  border: 1px solid var(--color-error-a50, rgba(255, 85, 85, 0.5));
  color: var(--color-error, #ff5555);
  box-shadow: 0 0 12px rgba(var(--color-error-rgb), 0.4);
}

.status-display.fade-out {
  opacity: 0;
}

.status-display .retry-render-button {
  display: block;
  margin: var(--space-sm) auto 0;
  padding: var(--space-xs) var(--space-md);
  background: var(--color-error-a30);
  color: var(--color-text);
  border: 1px solid var(--color-error-a50, rgba(255, 85, 85, 0.5));
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
  pointer-events: auto;
  font-size: var(--font-size-sm);
  font-family: var(--font-family);
  font-weight: bold;
  text-transform: uppercase;
}
.status-display .retry-render-button:hover:not(:disabled) {
  background: var(--color-error-a50, rgba(255, 165, 0, 0.5));
}
.status-display .retry-render-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hidden-audio-analyzer {
  position: absolute; left: -9999px; top: -9999px;
  opacity: 0; width: 0; height: 0; overflow: hidden; pointer-events: none;
}

.fps-counter {
  position: fixed;
  bottom: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.5);
  color: #00ff99;
  padding: 5px 10px;
  font-size: 12px;
  font-family: monospace;
  border-radius: 4px;
  z-index: 1000;
  pointer-events: none;
}

.maximize-button {
  position: fixed;
  bottom: 20px;
  left: 20px;
  z-index: 10000;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  backdrop-filter: blur(4px);
  transition: all 0.3s ease;
}
.maximize-button:hover {
  background: rgba(255, 255, 255, 0.2);
}

#fullscreen-root.radar-cursor {
  cursor: url('/assets/cursors/radar-dot.svg') 8 8, auto;
}

.click-ping-svg-container {
  position: fixed;
  transform: translate(-50%, -50%);
  width: 40px; 
  height: 40px;
  pointer-events: none;
  z-index: 10001;
  opacity: 1; 
  display: flex;
  justify-content: center;
  align-items: center;
}

.click-ping-svg {
  width: 100%;
  height: 100%;
  overflow: visible !important; 
}

.click-ping-svg circle {
  stroke-opacity: 1; 
  transform-origin: center; 
}

.ping-svg-animation .click-ping-svg circle {
  animation: ping-circle-anim-simple 0.7s linear forwards;
}

@keyframes ping-circle-anim-simple {
  0% {
    r: 2;
    stroke-opacity: 1;
    transform: scale(0.1);
  }
  100% {
    r: 30; 
    stroke-opacity: 0;
    transform: scale(2.5); 
  }
}
```

---
### `src\components\MainViewParts\AudioAnalyzerWrapper.jsx`
```jsx
import React from 'react';
import PropTypes from 'prop-types';

import AudioAnalyzer from '../Audio/AudioAnalyzer'; // Local component

const AudioAnalyzerWrapper = ({
  isAudioActive,
  managersReady,
  handleAudioDataUpdate,
  layerConfigs, // This can now be null initially
  audioSettings,
  configLoadNonce,
  managerInstancesRef,
}) => {
  // Do not render the AudioAnalyzer if audio is not active, managers are not ready,
  // or if the layerConfigs haven't been loaded yet.
  if (!isAudioActive || !managersReady || !layerConfigs) {
    return null;
  }

  return (
    <div className="hidden-audio-analyzer" aria-hidden="true">
      <AudioAnalyzer
        isActive={isAudioActive}
        onAudioData={handleAudioDataUpdate}
        layerConfigs={layerConfigs}
        audioSettings={audioSettings}
        configLoadNonce={configLoadNonce}
        managerInstancesRef={managerInstancesRef}
      />
    </div>
  );
};

AudioAnalyzerWrapper.propTypes = {
  isAudioActive: PropTypes.bool.isRequired,
  managersReady: PropTypes.bool.isRequired,
  handleAudioDataUpdate: PropTypes.func.isRequired,
  // --- THIS IS THE FIX: Changed from .isRequired to .object ---
  layerConfigs: PropTypes.object,
  // -----------------------------------------------------------
  audioSettings: PropTypes.object.isRequired,
  configLoadNonce: PropTypes.number.isRequired,
  managerInstancesRef: PropTypes.object.isRequired,
};

export default AudioAnalyzerWrapper;
```

---
### `src\components\MainViewParts\CanvasContainerWrapper.jsx`
```jsx
// src/components/MainViewParts/CanvasContainerWrapper.jsx (Assuming path based on context)
import React, { useCallback } from 'react';
import PropTypes from 'prop-types';

// Assuming styles are imported by a parent or a dedicated CSS file for this component.
// e.g., import './CanvasContainerWrapper.css';
// The original mentioned Mainview.css, so ensure relevant styles are accessible.

/**
 * @typedef {object} CanvasContainerWrapperProps
 * @property {React.RefObject<HTMLDivElement>} containerRef - Ref for the main container div that holds the canvases and grid overlay.
 * @property {Object.<string, React.RefObject<HTMLCanvasElement>>} canvasRefs - An object containing refs for all canvas elements, keyed by an identifier (e.g., '1A', '1B').
 * @property {string} containerClass - CSS class name(s) for the main container div.
 * @property {(layerId: string) => string} baseCanvasClass - A function that returns the base CSS class string for a given layer ID.
 * @property {string} pingColor - CSS color string for the click ping animation stroke.
 * @property {number} pingStrokeWidth - Stroke width for the click ping animation circle.
 * @property {string} noPingSelectors - A CSS selector string. Clicks on elements matching these selectors (or their children) within the container will not trigger the ping animation.
 */

/**
 * CanvasContainerWrapper: A component that sets up the main visual area,
 * containing canvas layers for visual rendering and a grid overlay.
 * It now renders a pair of canvases (A and B) for each visual layer to enable
 * true cross-dissolving between scenes with different blend modes.
 * It also implements a "click ping" animation effect.
 *
 * @param {CanvasContainerWrapperProps} props - The component's props.
 * @returns {JSX.Element} The rendered canvas container with its layers and click ping functionality.
 */
const CanvasContainerWrapper = ({
  containerRef,
  canvasRefs,
  containerClass,
  baseCanvasClass,
  pingColor,
  pingStrokeWidth,
  noPingSelectors,
}) => {

  const handleCanvasClick = useCallback((event) => {
    if (noPingSelectors && typeof noPingSelectors === 'string' && event.target.closest(noPingSelectors)) {
      return;
    }

    const containerElement = containerRef.current;
    if (!containerElement) {
      if (import.meta.env.DEV) {
        console.warn("[CanvasContainerWrapper] Container ref not available for ping effect.");
      }
      return;
    }

    const x = event.clientX;
    const y = event.clientY;

    const pingContainer = document.createElement('div');
    pingContainer.className = 'click-ping-svg-container';
    pingContainer.style.left = `${x}px`;
    pingContainer.style.top = `${y}px`;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "click-ping-svg");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.style.overflow = "visible";

    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", "10");
    circle.setAttribute("cy", "10");
    circle.setAttribute("r", "5");
    circle.setAttribute("stroke", pingColor);
    circle.setAttribute("stroke-width", String(pingStrokeWidth));
    circle.setAttribute("fill", "none");

    svg.appendChild(circle);
    pingContainer.appendChild(svg);

    try {
      containerElement.appendChild(pingContainer);
      requestAnimationFrame(() => {
        pingContainer.classList.add('ping-svg-animation');
      });

      pingContainer.addEventListener('animationend', () => {
        if (pingContainer.parentElement) {
            pingContainer.remove();
        }
      }, { once: true });

    } catch (e) {
      if (import.meta.env.DEV) {
        console.error("[CanvasContainerWrapper] Error creating or animating click ping:", e);
      }
      if (pingContainer.parentElement) {
        pingContainer.remove();
      }
    }
  }, [containerRef, noPingSelectors, pingColor, pingStrokeWidth]);

  return (
    <div ref={containerRef} className={containerClass} onClick={handleCanvasClick}>
      <div className="grid-overlay"></div>
      {/* --- START: Render a pair of canvases for each layer --- */}
      <canvas ref={canvasRefs['1A']} className={`${baseCanvasClass('1')} canvas-deck-a`} />
      <canvas ref={canvasRefs['1B']} className={`${baseCanvasClass('1')} canvas-deck-b`} />
      <canvas ref={canvasRefs['2A']} className={`${baseCanvasClass('2')} canvas-deck-a`} />
      <canvas ref={canvasRefs['2B']} className={`${baseCanvasClass('2')} canvas-deck-b`} />
      <canvas ref={canvasRefs['3A']} className={`${baseCanvasClass('3')} canvas-deck-a`} />
      <canvas ref={canvasRefs['3B']} className={`${baseCanvasClass('3')} canvas-deck-b`} />
      {/* --- END: Render a pair of canvases for each layer --- */}
    </div>
  );
};

CanvasContainerWrapper.propTypes = {
  containerRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(Element) })
  ]).isRequired,
  canvasRefs: PropTypes.objectOf(
    PropTypes.oneOfType([
      PropTypes.func,
      PropTypes.shape({ current: PropTypes.instanceOf(HTMLCanvasElement) })
    ])
  ).isRequired,
  containerClass: PropTypes.string.isRequired,
  baseCanvasClass: PropTypes.func.isRequired,
  pingColor: PropTypes.string.isRequired,
  pingStrokeWidth: PropTypes.number.isRequired,
  noPingSelectors: PropTypes.string.isRequired,
};

export default CanvasContainerWrapper;
```

---
### `src\components\MainViewParts\CriticalErrorDisplay.jsx`
```jsx
// src/components/MainViewParts/CriticalErrorDisplay.jsx
import React from 'react';
import PropTypes from 'prop-types';

// Assuming Viem types might be used for prop validation, though not strictly necessary for runtime.
// import { PublicClient, WalletClient } from 'viem';

/**
 * @typedef {object} CriticalErrorDisplayProps
 * @property {Error | null} initializationError - Error from Universal Profile Provider initialization.
 * @property {Error | null} fetchStateError - Error from blockchain client fetching state.
 * @property {object | null} publicClient - Viem PublicClient instance.
 * @property {object | null} walletClient - Viem WalletClient instance.
 */

/**
 * Displays a critical application error message if UP provider or Viem client issues occur.
 * If an error is displayed, this component renders the error UI. Otherwise, it renders null.
 * @param {CriticalErrorDisplayProps} props
 * @returns {JSX.Element | null}
 */
const CriticalErrorDisplay = ({ initializationError, fetchStateError, publicClient, walletClient }) => {
  if (initializationError || (fetchStateError && !publicClient && !walletClient)) {
    const errorSource = initializationError ? "Universal Profile Provider" : "Blockchain Client";
    const errorMessage = initializationError?.message || fetchStateError?.message || `Unknown critical error initialising ${errorSource}.`;

    return (
      <div id="fullscreen-root" className="main-view error-boundary-display" style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a', color: '#fff' }}>
        <div className="error-content" style={{ textAlign: 'center', padding: '20px', border: '1px solid #555', borderRadius: '8px', backgroundColor: '#2a2a2a' }}>
          <p style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#ff6b6b' }}>Critical Application Error</p>
          <p style={{ wordBreak: 'break-word', maxWidth: '400px', margin: '10px auto', color: '#ccc' }}>{errorMessage}</p>
          <p style={{ color: '#aaa' }}>Please ensure your Universal Profile browser extension is enabled and configured correctly, then try refreshing the page.</p>
        </div>
      </div>
    );
  }

  return null; // Render nothing if no critical error condition is met
};

CriticalErrorDisplay.propTypes = {
  initializationError: PropTypes.instanceOf(Error),
  fetchStateError: PropTypes.instanceOf(Error),
  publicClient: PropTypes.object,
  walletClient: PropTypes.object,
};

export default CriticalErrorDisplay;
```

---
### `src\components\MainViewParts\FpsDisplay.css`
```css
/* src/components/MainViewParts/FpsDisplay.css */
.fps-counter {
    position: absolute;
    bottom: 10px; /* Changed from top */
    left: 10px;   /* Changed from right */
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    padding: 5px 10px;
    border-radius: 3px;
    font-size: 12px;
    z-index: 10000; /* Ensure it's above most things */
    pointer-events: none; /* Allow clicks to pass through */
  }
  
  /* Specific styling for when FPS counter is in the portal-container (fullscreen) */
  #portal-container .fps-counter {
    position: fixed; /* Use fixed if #portal-container is at body level */
    bottom: 10px; /* Changed from top */
    left: 10px;   /* Changed from right */
  }
```

---
### `src\components\MainViewParts\FpsDisplay.jsx`
```jsx
// src/components/MainViewParts/FpsDisplay.jsx (Assuming path based on context)
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

import './FpsDisplay.css'; // Assuming specific styles for the FPS counter

/**
 * @typedef {object} FpsDisplayProps
 * @property {boolean} showFpsCounter - If true, the FPS counter is rendered and active.
 * @property {boolean} isFullscreenActive - Indicates if the application is currently in fullscreen mode. This is used to determine if the FPS counter should be portalled.
 * @property {Element | null} [portalContainer] - Optional DOM element to which the FPS counter should be portalled when in fullscreen mode. If null or not provided, the counter renders inline.
 */

// --- FIX: Added portalContainer = null to the function signature ---
const FpsDisplay = ({ showFpsCounter, isFullscreenActive, portalContainer = null }) => {
  const [currentFps, setCurrentFps] = useState(0);
  /** @type {React.RefObject<number>} */
  const fpsFrameCountRef = useRef(0);
  /** @type {React.RefObject<number>} */
  const fpsLastTimeRef = useRef(performance.now());
  /** @type {React.RefObject<number | null>} */
  const fpsRafId = useRef(null);

  useEffect(() => {
    /**
     * Calculates FPS based on frame counts over time.
     * This function is called recursively via `requestAnimationFrame`.
     */
    const updateFps = () => {
      const now = performance.now();
      const delta = now - fpsLastTimeRef.current;
      fpsFrameCountRef.current++;

      if (delta >= 1000) { // Update FPS display approximately every second
        const fps = Math.round((fpsFrameCountRef.current * 1000) / delta);
        setCurrentFps(fps);
        fpsFrameCountRef.current = 0; // Reset frame count for the next second
        fpsLastTimeRef.current = now; // Reset time for the next second
      }
      // Continue the loop
      if (typeof requestAnimationFrame === 'function') {
        fpsRafId.current = requestAnimationFrame(updateFps);
      }
    };

    if (showFpsCounter) {
      // Start FPS calculation if it's not already running
      if (!fpsRafId.current && typeof requestAnimationFrame === 'function') {
        fpsLastTimeRef.current = performance.now(); // Reset timer before starting
        fpsFrameCountRef.current = 0;
        fpsRafId.current = requestAnimationFrame(updateFps);
      }
    } else {
      // Stop FPS calculation if `showFpsCounter` becomes false
      if (fpsRafId.current && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(fpsRafId.current);
        fpsRafId.current = null;
      }
      setCurrentFps(0); // Reset displayed FPS when counter is hidden
    }

    // Cleanup function: stop the animation frame loop when the component unmounts
    // or when `showFpsCounter` changes, to prevent memory leaks.
    return () => {
      if (fpsRafId.current && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(fpsRafId.current);
        fpsRafId.current = null; // Ensure ref is cleared
      }
    };
  }, [showFpsCounter]); // Effect dependencies: only re-run if `showFpsCounter` changes

  // If the FPS counter is not meant to be shown, render nothing.
  if (!showFpsCounter) {
    return null;
  }

  const fpsCounterElement = (
    <div className="fps-counter" aria-live="off"> {/* aria-live="off" as it updates too frequently for assertive/polite */}
      FPS: {currentFps}
    </div>
  );

  // Use React Portal if a portalContainer is provided and fullscreen is active.
  if (portalContainer && isFullscreenActive && typeof ReactDOM.createPortal === 'function') {
    return ReactDOM.createPortal(fpsCounterElement, portalContainer);
  }

  // Otherwise, render the FPS counter inline.
  return fpsCounterElement;
};

FpsDisplay.propTypes = {
  showFpsCounter: PropTypes.bool.isRequired,
  isFullscreenActive: PropTypes.bool.isRequired,
  portalContainer: PropTypes.instanceOf(Element),
};

// --- FIX: Removed the deprecated FpsDisplay.defaultProps block ---

export default FpsDisplay;
```

---
### `src\components\MainViewParts\StatusIndicator.jsx`
```jsx
// src/components/MainViewParts/StatusIndicator.jsx (Assuming path based on context)
import React from 'react';
import PropTypes from 'prop-types';

// Assuming common styles for status display are in a shared or component-specific CSS file.
// For example: import './StatusIndicator.css';
// Or, if styles are in Mainview.css as hinted, ensure that's loaded by the parent.

/**
 * @typedef {'initializing' | 'waiting_layout' | 'initializing_managers' | 'loading_defaults' | 'resolving_initial_config' | 'fading_out' | 'applying_config' | 'rendered' | 'error' | 'prompt_connect'} RenderStateValue - Possible states of the render lifecycle, influencing the indicator's appearance.
 */

/**
 * @typedef {object} StatusIndicatorProps
 * @property {boolean} showStatusDisplay - Determines if the status indicator should be visible at all.
 * @property {boolean} isStatusFadingOut - If true, applies a fade-out animation class to the indicator.
 * @property {RenderStateValue} renderState - The current rendering lifecycle state, used to determine specific styling (e.g., for errors).
 * @property {string} loadingStatusMessage - The message to display within the indicator (e.g., "Loading...", "Error...", "Connecting...").
 * @property {boolean} showRetryButton - If true, a "Retry Render" button is displayed alongside the status message, typically in recoverable error states.
 * @property {() => void} onManualRetry - Callback function invoked when the "Retry Render" button is clicked.
 */

/**
 * StatusIndicator: A component that displays the current loading status, error messages,
 * or other informational messages related to the application's rendering lifecycle.
 * It can show a retry button in certain error states and supports fade-out animations.
 *
 * @param {StatusIndicatorProps} props - The component's props.
 * @returns {JSX.Element | null} The rendered StatusIndicator component, or null if `showStatusDisplay` is false.
 */
const StatusIndicator = ({
  showStatusDisplay,
  isStatusFadingOut,
  renderState,
  loadingStatusMessage,
  showRetryButton,
  onManualRetry,
}) => {
  // If the indicator should not be shown at all, render nothing.
  if (!showStatusDisplay) {
    return null;
  }

  /**
   * Determines the appropriate CSS class for the status display based on the renderState.
   * @returns {string} CSS class name (e.g., 'error-state', 'prompt-connect-state', 'info-state').
   */
  const getStatusDisplayClass = () => {
    if (renderState === 'error') return 'error-state'; // Specific styling for critical errors
    if (renderState === 'prompt_connect') return 'prompt-connect-state'; // Styling for connection prompts
    return 'info-state'; // Default styling for other informational messages
  };

  /**
   * Renders the content of the status display, which can include the status message
   * and an optional retry button.
   * @returns {JSX.Element} The content to be rendered inside the status display.
   */
  const renderStatusContent = () => {
    if (showRetryButton) {
      return (
        <>
          <span>{loadingStatusMessage}</span> {/* Wrap message in span for better structure */}
          <button onClick={onManualRetry} className="retry-render-button">
            Retry Render
          </button>
        </>
      );
    }
    return <span>{loadingStatusMessage}</span>; // Wrap message in span
  };

  return (
    <div
      className={`status-display ${getStatusDisplayClass()} ${
        isStatusFadingOut ? 'fade-out' : '' // Apply fade-out class for animations
      }`}
      role="status" // Accessibility: Indicates this region's content may change and is a status message
      aria-live="polite" // Accessibility: Announce changes politely
      aria-atomic="true" // Accessibility: Announce the entire region when it changes
    >
      {renderStatusContent()}
    </div>
  );
};

StatusIndicator.propTypes = {
  /** Determines if the status indicator should be visible. */
  showStatusDisplay: PropTypes.bool.isRequired,
  /** If true, applies a fade-out animation class. */
  isStatusFadingOut: PropTypes.bool.isRequired,
  /** The current rendering lifecycle state, influencing styling. */
  renderState: PropTypes.string.isRequired,
  /** The message to display. */
  loadingStatusMessage: PropTypes.string.isRequired,
  /** If true, a "Retry Render" button is displayed. */
  showRetryButton: PropTypes.bool.isRequired,
  /** Callback for the "Retry Render" button. */
  onManualRetry: PropTypes.func.isRequired,
};

// Default export is standard for React components.
export default StatusIndicator;
```

---
### `src\components\MIDI\GlobalMIDIStatus.jsx`
```jsx
// src/components/MIDI/GlobalMIDIStatus.jsx
import React from 'react';
import { useMIDI } from '../../context/MIDIContext';
import './MIDIStyles/GlobalMIDIStatus.css';
import { midiIcon } from '../../assets';

/**
 * GlobalMIDIStatus: Displays the current MIDI connection status.
 * Allows initiating connection, disconnecting, or retrying on error.
 * Also shows a small indicator when MIDI learn mode is active.
 */
const GlobalMIDIStatus = () => {
  const {
    isConnected,
    isConnecting,
    connectMIDI,
    disconnectMIDI, // Get disconnectMIDI from context
    error: midiError,
    midiLearning,
    learningLayer,
  } = useMIDI();

  const hasCriticalError = !!midiError;

  const handleConnectionClick = () => {
    if (isConnected) {
      // If connected, disconnect MIDI entirely
      disconnectMIDI(true); // Pass true for a user-initiated full disconnect
    } else if (!isConnecting) {
      // If disconnected and not currently connecting, try to connect
      connectMIDI()
        .catch(err => {
          console.error("[GlobalMIDIStatus] connectMIDI promise rejected:", err);
        });
    }
    // If isConnecting, do nothing (connection already in progress)
  };

  const buttonTitle = hasCriticalError ? `MIDI Error: ${midiError?.message || 'Click to retry connection'}`
                     : isConnecting ? "Connecting MIDI..."
                     : isConnected ? "MIDI Connected - Click to Disconnect"
                     : "MIDI Disconnected - Click to Connect";

  const buttonClass = `toolbar-icon ${hasCriticalError ? 'error' : isConnected ? 'connected' : 'disconnected'} ${isConnecting ? 'connecting' : ''}`;

  return (
    <div className="global-midi-status">
      <button
        className={buttonClass}
        onClick={handleConnectionClick}
        disabled={isConnecting && !isConnected} // Disable only if connecting and not yet connected
        title={buttonTitle}
      >
        {hasCriticalError ? (
           <span style={{color: 'var(--color-error, red)', fontSize: '1.2em', fontWeight: 'bold'}}>!</span>
        ) : isConnecting ? (
           <div className="connecting-spinner"></div>
        ) : (
          <img src={midiIcon} alt="MIDI" className="midi-icon" />
        )}
      </button>

      {(midiLearning || learningLayer !== null) && (
        <div className="midi-learning-indicator">
          {midiLearning ? (
            <span>Mapping: {midiLearning.param}</span>
          ) : (
            <span>Mapping: Layer {learningLayer}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalMIDIStatus;
```

---
### `src\components\MIDI\MIDIStyles\GlobalMIDIStatus.css`
```css
.global-midi-status {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  position: relative;
}

.global-midi-status .toolbar-icon {
  width: 35px;
  height: 35px;
  padding: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--color-primary-a15);
  border: 1px solid var(--color-primary-a30);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-normal);
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.global-midi-status .toolbar-icon:hover {
  background: var(--color-primary-a25);
  transform: translateY(-1px);
  box-shadow: var(--shadow-primary-md);
}

.global-midi-status .toolbar-icon.disconnected {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}
.global-midi-status .toolbar-icon.disconnected .midi-icon {
   opacity: 0.6;
   filter: grayscale(80%);
   animation: none;
}

.global-midi-status .toolbar-icon.connected {
  background: var(--color-primary-a15);
  border-color: var(--color-primary-a30);
}

.global-midi-status .toolbar-icon.connecting .connecting-spinner {
  display: block;
}
.global-midi-status .toolbar-icon.connecting .midi-icon {
    display: none;
}

.global-midi-status .toolbar-icon.error {
  background: var(--color-error-a10);
  border-color: var(--color-error-a30);
  color: var(--color-error);
  animation: error-pulse 1.5s infinite ease-in-out;
}
.global-midi-status .toolbar-icon.error .midi-icon {
    display: none;
}

.connecting-spinner {
  display: none;
  width: 20px;
  height: 20px;
  border: 3px solid var(--color-primary-a30);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

@keyframes midi-active-pulse {
  0%, 100% { transform: scale(1); opacity: 0.8; filter: drop-shadow(0 0 4px var(--color-primary-a30)); }
  50% { transform: scale(1.08); opacity: 1; filter: drop-shadow(0 0 7px var(--color-primary-a70)); }
}

.global-midi-status .toolbar-icon.connected .midi-icon {
  animation: midi-active-pulse 1.8s infinite ease-in-out;
}

.midi-learning-indicator {
  position: absolute;
  bottom: calc(100% + 4px);
  right: 0;
  background: var(--color-accent-a20);
  color: var(--color-accent);
  border: 1px solid var(--color-accent-a30);
  border-radius: var(--radius-sm);
  padding: 3px 8px;
  font-size: var(--font-size-xs);
  white-space: nowrap;
  animation: blink 1s infinite;
  box-shadow: var(--shadow-sm);
  z-index: 1;
}

.mini-midi-monitor {
  position: absolute;
  bottom: calc(100% + 4px);
  right: 0;
  width: 220px;
  background: var(--color-glass-bg-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  z-index: 0;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 10px;
  background: var(--color-primary-a05);
  border-bottom: 1px solid var(--color-border);
}

.monitor-header h4 {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-primary);
}

.close-monitor {
  background: none; border: none;
  color: var(--color-primary-a70);
  font-size: 16px; cursor: pointer; padding: 0; line-height: 1;
  transition: color var(--transition-fast);
}
.close-monitor:hover { color: var(--color-primary); }

.monitor-content {
  max-height: 150px; overflow-y: auto; padding: 5px;
  scrollbar-width: thin;
  scrollbar-color: var(--color-primary-a30) rgba(0, 0, 0, 0.1);
}
.monitor-content::-webkit-scrollbar { width: 6px; height: 6px; }
.monitor-content::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.1); border-radius: 3px; }
.monitor-content::-webkit-scrollbar-thumb { background: var(--color-primary-a30); border-radius: 3px; }
.monitor-content::-webkit-scrollbar-thumb:hover { background: var(--color-primary-a50); }

.no-activity {
  padding: 5px; color: var(--color-text-muted);
  text-align: center; font-size: var(--font-size-xs);
  font-style: italic;
}

.midi-message {
  display: flex; justify-content: space-between; font-family: monospace;
  font-size: 10px; padding: 2px 5px;
  border-bottom: 1px solid var(--color-border-light);
  white-space: nowrap;
}

.msg-type { color: var(--color-primary-a90); width: 70px; overflow: hidden; text-overflow: ellipsis; }
.msg-channel { color: var(--color-accent); width: 35px; }
.msg-data { color: var(--color-text); flex-grow: 1; text-align: right; }

@keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
@keyframes error-pulse { 0%, 100% { box-shadow: 0 0 3px var(--color-error-a30); } 50% { box-shadow: 0 0 8px var(--color-error-a70); } }

.midi-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  pointer-events: none;
  transition: opacity 0.3s ease, filter 0.3s ease;
}
```

---
### `src\components\Notifications\Toast.jsx`
```jsx
// src/components/Toast/Toast.jsx
import React, { useEffect, useState, useCallback } from 'react'; // Added useCallback
import PropTypes from 'prop-types';

import './ToastStyles.css'; // Local styles

/**
 * @typedef {'info' | 'success' | 'warning' | 'error'} ToastType - The type of the toast, influencing its appearance.
 */

/**
 * @typedef {object} ToastProps
 * @property {string|number} id - Unique identifier for the toast message.
 * @property {React.ReactNode} content - The content of the toast message. Can be a string or a React node.
 * @property {ToastType} [type='info'] - The type of the toast (e.g., 'info', 'success').
 * @property {number | null} [duration] - Optional: The duration in milliseconds for which the toast should be visible.
 *                                     If provided and positive, the toast will start fading out before this duration ends.
 *                                     If null or 0, it remains until manually dismissed.
 * @property {(id: string|number) => void} onDismiss - Callback function invoked when the toast requests to be dismissed, either manually or after its duration. It receives the toast's `id`.
 */

/**
 * Toast: Displays a single notification message.
 * It manages its own visibility state for fade-in/fade-out animations.
 * It can be dismissed manually via a close button or automatically after a specified `duration`.
 * The actual removal from the list of active toasts is handled by the `onDismiss` callback,
 * which is typically provided by a `ToastProvider` or a similar state management system.
 *
 * @param {ToastProps} props - The component's props.
 * @returns {JSX.Element} The rendered Toast component.
 */
const Toast = ({ id, content, type = 'info', duration, onDismiss }) => {
  // `isVisible` controls the CSS class for fade-in/fade-out animations.
  const [isVisible, setIsVisible] = useState(false);

  // Effect for managing the toast's lifecycle (fade-in and timed fade-out)
  useEffect(() => {
    // Trigger fade-in animation shortly after mount
    const fadeInTimer = setTimeout(() => {
      setIsVisible(true);
    }, 10); // Small delay to ensure CSS transition applies

    let fadeOutTimer = null;
    let dismissTimer = null;

    // If a positive duration is provided, set up automatic fade-out and dismissal
    if (duration && duration > 0) {
      // Start fade-out animation slightly before the full duration to allow for CSS transition
      const fadeOutStartTime = Math.max(0, duration - 300); // Ensure non-negative

      fadeOutTimer = setTimeout(() => {
        setIsVisible(false); // Trigger fade-out animation
      }, fadeOutStartTime);

      // Set timer to call onDismiss after the full duration (allowing fade-out to complete)
      dismissTimer = setTimeout(() => {
        if (typeof onDismiss === 'function') {
          onDismiss(id);
        }
      }, duration);
    }

    // Cleanup function: clear all timers when the component unmounts
    // or if `id` or `duration` changes (which would re-run this effect).
    return () => {
      clearTimeout(fadeInTimer);
      if (fadeOutTimer) clearTimeout(fadeOutTimer);
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, [id, duration, onDismiss]); // `onDismiss` is included as it's part of the effect's logic flow

  /**
   * Handles manual dismissal of the toast via the close button.
   * It first triggers the fade-out animation and then calls the `onDismiss` callback
   * after the animation duration.
   */
  const handleDismiss = useCallback(() => {
    setIsVisible(false); // Start fade-out animation
    // Call the actual removal function (onDismiss) after the fade animation (300ms) completes.
    setTimeout(() => {
      if (typeof onDismiss === 'function') {
        onDismiss(id);
      }
    }, 300); // This duration should match the CSS transition duration for opacity/transform
  }, [id, onDismiss]); // `id` and `onDismiss` are dependencies

  return (
    <div
      className={`toast toast-${type} ${isVisible ? 'visible' : 'hidden'}`}
      role="alert" // Accessibility: Indicates it's an alert
      aria-live="assertive" // Accessibility: Announce changes assertively
      aria-atomic="true"
    >
      <div className="toast-content">{content}</div>
      <button
        onClick={handleDismiss}
        className="toast-dismiss-button"
        aria-label="Dismiss notification" // Accessibility
        title="Dismiss" // Tooltip
      >
        × {/* Standard multiplication sign for 'close' */}
      </button>
    </div>
  );
};

Toast.propTypes = {
  /** Unique identifier for the toast message. */
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  /** The content of the toast message. Can be a string or any renderable React node. */
  content: PropTypes.node.isRequired,
  /** The type of the toast, influencing its visual style (e.g., 'info', 'success', 'warning', 'error'). */
  type: PropTypes.oneOf(['info', 'success', 'warning', 'error']),
  /**
   * Optional duration in milliseconds for the toast to be visible.
   * If provided and positive, the toast will auto-dismiss.
   * If null, 0, or not provided, it remains until manually dismissed.
   */
  duration: PropTypes.number,
  /** Callback function invoked when the toast requests to be dismissed (receives toast `id`). */
  onDismiss: PropTypes.func.isRequired,
};

// Default export is standard for React components.
export default Toast;
```

---
### `src\components\Notifications\Toast.test.jsx`
```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Toast from './Toast'; // Adjust path if necessary

describe('Toast Component', () => {
  // Setup fake timers before each test to control setTimeout
  beforeEach(() => {
    vi.useFakeTimers();
  });

  // Restore real timers after each test
  afterEach(() => {
    vi.restoreAllMocks(); // This also clears all timers
  });

  it('should render the toast content correctly', () => {
    const testContent = "This is a test toast message.";
    render(<Toast id="toast1" content={testContent} onDismiss={() => {}} />);
    expect(screen.getByText(testContent)).toBeInTheDocument();
  });

  it('should apply the default "info" class if no type is provided', () => {
    render(<Toast id="toast2" content="Info toast" onDismiss={() => {}} />);
    const toastElement = screen.getByRole('alert');
    expect(toastElement).toHaveClass('toast-info');
  });

  it('should apply the correct class based on the "type" prop (e.g., "error")', () => {
    render(<Toast id="toast3" content="Error toast" type="error" onDismiss={() => {}} />);
    const toastElement = screen.getByRole('alert');
    expect(toastElement).toHaveClass('toast-error');
  });

  it('should apply the "success" class for type "success"', () => {
    render(<Toast id="toast-success" content="Success!" type="success" onDismiss={() => {}} />);
    expect(screen.getByRole('alert')).toHaveClass('toast-success');
  });

  it('should apply the "warning" class for type "warning"', () => {
    render(<Toast id="toast-warning" content="Warning!" type="warning" onDismiss={() => {}} />);
    expect(screen.getByRole('alert')).toHaveClass('toast-warning');
  });

  it('should call onDismiss with the correct id when the dismiss button is clicked', () => {
    const mockOnDismiss = vi.fn();
    const toastId = "toast4";
    render(<Toast id={toastId} content="Dismiss me" onDismiss={mockOnDismiss} />);

    const dismissButton = screen.getByRole('button', { name: /Dismiss notification/i });
    fireEvent.click(dismissButton);

    // The Toast component has a 300ms setTimeout before calling onDismiss
    // We need to advance the timers for that setTimeout to execute
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    expect(mockOnDismiss).toHaveBeenCalledWith(toastId);
  });

  it('should call onDismiss after the specified duration if duration is positive', () => {
    const mockOnDismiss = vi.fn();
    const toastId = "toast5";
    const duration = 1500; // 1.5 seconds
    render(<Toast id={toastId} content="Auto dismiss" duration={duration} onDismiss={mockOnDismiss} />);

    // Check it hasn't been called immediately
    expect(mockOnDismiss).not.toHaveBeenCalled();

    // Advance timers by the full duration
    act(() => {
      vi.advanceTimersByTime(duration);
    });

    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    expect(mockOnDismiss).toHaveBeenCalledWith(toastId);
  });

  it('should NOT call onDismiss automatically if duration is null', () => {
    const mockOnDismiss = vi.fn();
    render(<Toast id="toast6" content="Manual dismiss (duration null)" duration={null} onDismiss={mockOnDismiss} />);

    // Advance timers by a long time, it shouldn't be called
    act(() => {
      vi.advanceTimersByTime(10000); // 10 seconds
    });

    expect(mockOnDismiss).not.toHaveBeenCalled();
  });

  it('should NOT call onDismiss automatically if duration is 0', () => {
    const mockOnDismiss = vi.fn();
    render(<Toast id="toast7" content="Manual dismiss (duration 0)" duration={0} onDismiss={mockOnDismiss} />);

    // Advance timers
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(mockOnDismiss).not.toHaveBeenCalled();
  });

  it('should apply "visible" class after a short delay for fade-in animation', () => {
    render(<Toast id="toast8" content="Fade in test" onDismiss={() => {}} />);
    const toastElement = screen.getByRole('alert');

    // Initially, it might not have 'visible' immediately due to the 10ms setTimeout in Toast.jsx
    // Depending on how fast the test runs, it might already be visible.
    // A more robust check is to advance time slightly.
    expect(toastElement).not.toHaveClass('visible'); // Or check opacity if styles are set up for it

    act(() => {
      vi.advanceTimersByTime(20); // Advance past the 10ms fadeInTimer
    });

    expect(toastElement).toHaveClass('visible');
  });

  it('should remove "visible" class when dismiss button is clicked (for fade-out animation)', () => {
    render(<Toast id="toast9" content="Fade out test" onDismiss={() => {}} />);
    const toastElement = screen.getByRole('alert');

    // Make it visible first
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(toastElement).toHaveClass('visible');

    // Click dismiss
    const dismissButton = screen.getByRole('button', { name: /Dismiss notification/i });
    fireEvent.click(dismissButton);

    // The 'visible' class should be removed immediately to start the fade-out CSS transition
    expect(toastElement).not.toHaveClass('visible');
    expect(toastElement).toHaveClass('hidden'); // Assuming 'hidden' is the opposite of 'visible'
  });

  it('should remove "visible" class when auto-dismissing (for fade-out animation)', () => {
    const duration = 500;
    render(<Toast id="toast10" content="Auto fade out" duration={duration} onDismiss={() => {}} />);
    const toastElement = screen.getByRole('alert');

    // Make it visible
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(toastElement).toHaveClass('visible');

    // Advance time to just before full duration (when fade-out starts)
    // fadeOutStartTime = Math.max(0, duration - 300); -> 500 - 300 = 200ms
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(toastElement).not.toHaveClass('visible');
    expect(toastElement).toHaveClass('hidden');
  });
});
```

---
### `src\components\Notifications\ToastContainer.jsx`
```jsx
// src/components/Toast/ToastContainer.jsx
import React from 'react';
// Removed PropTypes as it's not used in this specific file

import { useToast } from '../../context/ToastContext'; // Local context
import Toast from './Toast'; // Local component

import './ToastStyles.css'; // Local styles

/**
 * ToastContainer: A component responsible for rendering a list of active toast notifications.
 * It retrieves the current list of toasts and the `removeToast` function from the `ToastContext`.
 * Each toast is rendered using the `Toast` component. If there are no active toasts,
 * the container itself is not rendered to avoid an empty DOM element.
 *
 * @returns {JSX.Element | null} The rendered ToastContainer with active toasts, or null if no toasts are present.
 */
const ToastContainer = () => {
  const { toasts, removeToast } = useToast(); // Consume from ToastContext

  // Don't render the container at all if there are no toasts to display.
  // This keeps the DOM cleaner.
  if (!toasts || toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-container" role="status" aria-live="polite" aria-atomic="true">
      {/*
        Map over the active toasts and render a Toast component for each.
        - `key` is essential for React's list rendering.
        - `onDismiss` is passed down to allow individual toasts to trigger their removal.
      */}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id} // Pass id for the Toast component to use with onDismiss
          content={toast.content}
          type={toast.type}
          duration={toast.duration} // Duration is for information or if Toast handles its own timer
          onDismiss={removeToast} // Pass the removeToast function from context
        />
      ))}
    </div>
  );
};

// No PropTypes needed for ToastContainer itself as it takes no props.
// Default export is standard for React components.
export default ToastContainer;
```

---
### `src\components\Notifications\ToastContainer.test.jsx`
```jsx
import React from 'react';
import PropTypes from 'prop-types';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../../context/ToastContext'; // Adjust path if necessary
import ToastContainer from './ToastContainer';
// Toast component is implicitly tested as it's rendered by ToastContainer

// Helper component to add toasts for testing purposes
const ToastTrigger = ({ id, content, type, duration }) => {
  const { addToast } = useToast();

  // Use a button to trigger adding a toast so we can control when it happens in tests
  return (
    <button
      data-testid={`add-toast-${id}`}
      onClick={() => addToast(content, type, duration)}
    >
      Add Toast {id}
    </button>
  );
};

// PropTypes for the helper component
ToastTrigger.propTypes = {
  id: PropTypes.string.isRequired,
  content: PropTypes.node.isRequired,
  type: PropTypes.string,
  duration: PropTypes.number,
};


describe('ToastContainer Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render nothing if there are no toasts', () => {
    render(
      <ToastProvider>
        <ToastContainer />
      </ToastProvider>
    );
    // The container itself should not be in the document if no toasts
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('alert').length).toBe(0); // No individual toast alerts
  });

  it('should render a single toast when one is added', () => {
    render(
      <ToastProvider>
        <ToastTrigger id="t1" content="Single Toast Message" />
        <ToastContainer />
      </ToastProvider>
    );

    // Click the button to add the toast
    const addButton = screen.getByTestId('add-toast-t1');
    fireEvent.click(addButton);

    // Advance timers for the Toast component's internal fadeIn
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(screen.getByText('Single Toast Message')).toBeInTheDocument();
    expect(screen.getAllByRole('alert').length).toBe(1);
    expect(screen.getByRole('alert')).toHaveClass('toast-info'); // Default type
  });

  it('should render multiple toasts when multiple are added', () => {
    render(
      <ToastProvider>
        <ToastTrigger id="t1" content="First Toast" type="success" />
        <ToastTrigger id="t2" content="Second Toast" type="error" />
        <ToastContainer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('add-toast-t1'));
    fireEvent.click(screen.getByTestId('add-toast-t2'));

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(screen.getByText('First Toast')).toBeInTheDocument();
    expect(screen.getByText('Second Toast')).toBeInTheDocument();
    expect(screen.getAllByRole('alert').length).toBe(2);

    const firstToastElement = screen.getByText('First Toast').closest('.toast');
    const secondToastElement = screen.getByText('Second Toast').closest('.toast');

    expect(firstToastElement).toHaveClass('toast-success');
    expect(secondToastElement).toHaveClass('toast-error');
  });

  it('should remove a toast when its dismiss button is clicked', () => {
    render(
      <ToastProvider>
        <ToastTrigger id="t1" content="Toast to dismiss" />
        <ToastContainer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('add-toast-t1'));
    act(() => { vi.advanceTimersByTime(50); }); // For fade-in

    let toastElement = screen.getByText('Toast to dismiss');
    expect(toastElement).toBeInTheDocument();

    const dismissButton = screen.getByRole('button', { name: /Dismiss notification/i });
    fireEvent.click(dismissButton);

    // Advance timers for the Toast component's internal onDismiss setTimeout
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByText('Toast to dismiss')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('alert').length).toBe(0);
  });

  it('should remove a toast automatically after its duration', () => {
    const shortDuration = 500;
    render(
      <ToastProvider>
        <ToastTrigger id="t1" content="Auto-dismissing toast" duration={shortDuration} />
        <ToastContainer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('add-toast-t1'));
    act(() => { vi.advanceTimersByTime(50); }); // For fade-in

    expect(screen.getByText('Auto-dismissing toast')).toBeInTheDocument();

    // Advance timers past the toast's duration
    act(() => {
      vi.advanceTimersByTime(shortDuration + 100); // Add a small buffer
    });

    expect(screen.queryByText('Auto-dismissing toast')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('alert').length).toBe(0);
  });

  it('should render toasts in the order they are added (newest on top/bottom depending on CSS)', () => {
    // This test assumes newest toasts appear first in the DOM if prepended,
    // or last if appended. Your CSS determines visual order (top/bottom).
    // We'll check the order in the DOM.
    render(
      <ToastProvider>
        <ToastTrigger id="t1" content="Oldest Toast" />
        <ToastTrigger id="t2" content="Middle Toast" />
        <ToastTrigger id="t3" content="Newest Toast" />
        <ToastContainer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('add-toast-t1'));
    fireEvent.click(screen.getByTestId('add-toast-t2'));
    fireEvent.click(screen.getByTestId('add-toast-t3'));

    act(() => { vi.advanceTimersByTime(50); });

    const allToasts = screen.getAllByRole('alert');
    expect(allToasts.length).toBe(3);

    // Your ToastProvider appends new toasts, so "Oldest Toast" is first in the DOM list.
    expect(allToasts[0]).toHaveTextContent('Oldest Toast');
    expect(allToasts[1]).toHaveTextContent('Middle Toast');
    expect(allToasts[2]).toHaveTextContent('Newest Toast');
  });
});
```

---
### `src\components\Notifications\ToastStyles.css`
```css
@import "../../styles/variables.css";

.toast-container {
  position: fixed;
  bottom: var(--space-lg, 20px);
  right: var(--space-lg, 20px);
  z-index: var(--z-top, 2000);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-sm, 12px);
  pointer-events: none; /* Container doesn't block */
}

.toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm, 12px) var(--space-md, 16px);
  border-radius: var(--radius-md, 6px);
  box-shadow: var(--shadow-md, 0 4px 10px rgba(0, 0, 0, 0.3));
  color: var(--color-text, #eee);
  font-size: var(--font-size-md, 14px);
  min-width: 250px;
  max-width: 400px;
  pointer-events: auto; /* Toasts are interactive */
  opacity: 0;
  transform: translateX(100%);
  transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
  border: 1px solid transparent;
}

.toast.visible {
  opacity: 1;
  transform: translateX(0);
}

.toast-info {
  background-color: var(--color-primary-a15, rgba(0, 243, 255, 0.15));
  border-color: var(--color-primary-a30, rgba(0, 243, 255, 0.3));
  color: var(--color-primary, #00f3ff);
}

.toast-success {
  background-color: var(--color-success-a10, rgba(0, 255, 0, 0.1));
  border-color: var(--color-success-a30, rgba(0, 255, 0, 0.3));
  color: var(--color-success, #00ff00);
}

.toast-warning {
  background-color: var(--color-warning-a10, rgba(255, 165, 0, 0.1));
  border-color: var(--color-warning-a30, rgba(255, 165, 0, 0.3));
  color: var(--color-warning, #ffa500);
}

.toast-error {
  background-color: var(--color-error-a10, rgba(255, 85, 85, 0.1));
  border-color: var(--color-error-a30, rgba(255, 85, 85, 0.3));
  color: var(--color-error, #ff5555);
}

.toast-content {
  margin-right: var(--space-md, 16px);
  flex-grow: 1;
}

.toast-dismiss-button {
  background: none;
  border: none;
  color: inherit;
  opacity: 0.7;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 0 0 0 var(--space-xs);
  margin-left: var(--space-sm);
}

.toast-dismiss-button:hover {
  opacity: 1;
}
```

---
### `src\components\Panels\EnhancedControlPanel.jsx`
```jsx
// src/components/Panels/EnhancedControlPanel.jsx
import React, { useCallback, useMemo, useState, useEffect } from "react";
import PropTypes from "prop-types";

// Local Component Imports
import Panel from "./Panel";
import PLockController from './PLockController';

// Hook Imports
import { useProfileSessionState } from "../../hooks/configSelectors";
import { useMIDI } from "../../context/MIDIContext";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import { useVisualEngineContext } from "../../context/VisualEngineContext";
import { useToast } from "../../context/ToastContext";
import { BLEND_MODES } from "../../config/global-config";
import { sliderParams } from "../../config/sliderParams";

// Asset Imports
import {
  toplayerIcon,
  middlelayerIcon,
  bottomlayerIcon,
  rotateIcon,
} from "../../assets";

// Styles
import "./PanelStyles/EnhancedControlPanel.css";

const getDefaultLayerConfigTemplate = () => ({
  enabled: true, blendMode: "normal", opacity: 1.0, size: 1.0, speed: 0.01,
  drift: 0, driftSpeed: 0.1, angle: 0, xaxis: 0, yaxis: 0, direction: 1,
  driftState: { x: 0, y: 0, phase: Math.random() * Math.PI * 2, enabled: false },
});

const formatValue = (value, decimals = 1) => {
  const numValue = Number(value);
  if (value === undefined || value === null || isNaN(numValue)) return "0".padEnd(decimals > 0 ? decimals + 2 : 1, "0");
  return numValue.toFixed(decimals);
};

const tabToLayerIdMap = { tab1: 3, tab2: 2, tab3: 1 };

const EnhancedControlPanel = ({
  onToggleMinimize,
  activeTab = "tab1",
  onTabChange,
  pLockProps = {},
  sequencerIntervalMs,
  onSetSequencerInterval,
  crossfadeDurationMs,
  onSetCrossfadeDuration,
}) => {
  const { isProfileOwner } = useProfileSessionState();
  const { addToast } = useToast();
  const {
    stagedActiveWorkspace,
    fullSceneList: savedSceneList,
    activeSceneName,
    addNewSceneToStagedWorkspace,
    deleteSceneFromStagedWorkspace,
    setDefaultSceneInStagedWorkspace,
    isSaving,
  } = useWorkspaceContext();

  const {
    uiControlConfig,
    isAutoFading,
    handleSceneSelect: onSceneSelect,
    updateLayerConfig: onLayerConfigChange,
    managerInstancesRef,
    renderedCrossfaderValue,
    reloadSceneOntoInactiveDeck,
  } = useVisualEngineContext();

  const {
    isConnected: midiConnected, midiLearning, learningLayer,
    startMIDILearn, startLayerMIDILearn,
    midiMap, layerMappings,
    startGlobalMIDILearn,
  } = useMIDI();

  const [newSceneName, setNewSceneName] = useState("");
  const [localIntervalInput, setLocalIntervalInput] = useState(sequencerIntervalMs / 1000);
  const [localDurationInput, setLocalDurationInput] = useState(crossfadeDurationMs / 1000);

  useEffect(() => {
    setLocalIntervalInput(sequencerIntervalMs / 1000);
  }, [sequencerIntervalMs]);

  useEffect(() => {
    setLocalDurationInput(crossfadeDurationMs / 1000);
  }, [crossfadeDurationMs]);

  const handleSetInterval = () => {
    const newIntervalSeconds = parseFloat(localIntervalInput);
    if (isNaN(newIntervalSeconds) || newIntervalSeconds < 0) {
      addToast("Interval must be 0 or greater.", "error");
      setLocalIntervalInput(sequencerIntervalMs / 1000);
      return;
    }
    onSetSequencerInterval(newIntervalSeconds * 1000);
    addToast(`Sequencer interval set to ${newIntervalSeconds}s.`, "success");
  };

  const handleSetDuration = () => {
    const newDurationSeconds = parseFloat(localDurationInput);
    if (isNaN(newDurationSeconds) || newDurationSeconds < 0.1) {
      addToast("Crossfade duration must be at least 0.1 seconds.", "error");
      setLocalDurationInput(crossfadeDurationMs / 1000);
      return;
    }
    onSetCrossfadeDuration(newDurationSeconds * 1000);
    addToast(`Crossfade duration set to ${newDurationSeconds}s.`, "success");
  };

  const activeLayer = useMemo(() => String(tabToLayerIdMap[activeTab] || 3), [activeTab]);
  const activeLayerConfigs = uiControlConfig?.layers;
  const config = useMemo(() => activeLayerConfigs?.[activeLayer] || getDefaultLayerConfigTemplate(), [activeLayerConfigs, activeLayer]);
  
  const handleSliderChange = useCallback((e) => {
    const { name, value } = e.target;
    onLayerConfigChange(activeLayer, name, parseFloat(value), false);
  }, [onLayerConfigChange, activeLayer]);

  const handleCreateScene = useCallback(() => {
    const originalSceneName = activeSceneName;
    const name = newSceneName.trim();
    if (!name) {
      addToast("Scene name cannot be empty.", "warning");
      return;
    }
    if (savedSceneList.some(p => p.name === name)) {
      if (!window.confirm(`A scene named "${name}" already exists. Do you want to overwrite it?`)) {
        return;
      }
    }
    
    const managers = managerInstancesRef.current?.current;
    let liveLayersConfig = {};
    const activeDeckIsA = renderedCrossfaderValue < 0.5;

    if (managers) {
      for (const layerId in managers) {
        const manager = managers[layerId];
        const sourceConfig = activeDeckIsA ? manager.configA : manager.configB;
        const sourceRotation = activeDeckIsA ? manager.continuousRotationAngleA : manager.continuousRotationAngleB;
        const sourceDriftState = activeDeckIsA ? manager.driftStateA : manager.driftStateB;
        if (!sourceConfig) {
            console.warn(`[EnhancedControlPanel] Could not find source config for layer ${layerId} on the active deck. Skipping.`);
            continue;
        }
        const liveConfig = JSON.parse(JSON.stringify(sourceConfig));
        liveConfig.angle = (sourceConfig.angle + sourceRotation) % 360;
        liveConfig.driftState = JSON.parse(JSON.stringify(sourceDriftState));
        for (const key in manager.playbackValues) {
          liveConfig[key] = manager.playbackValues[key];
        }
        liveLayersConfig[layerId] = liveConfig;
      }
    } else {
      console.warn("[EnhancedControlPanel] CanvasManagers not found, creating scene from React state. This may not capture the exact live animation frame.");
      liveLayersConfig = JSON.parse(JSON.stringify(uiControlConfig.layers));
    }

    const newSceneData = {
      name,
      ts: Date.now(),
      layers: liveLayersConfig,
      tokenAssignments: JSON.parse(JSON.stringify(uiControlConfig.tokenAssignments)),
    };

    addNewSceneToStagedWorkspace(name, newSceneData);
    addToast(`Scene "${name}" created and staged.`, "success");
    setNewSceneName("");

    if (originalSceneName && originalSceneName !== name && reloadSceneOntoInactiveDeck) {
        reloadSceneOntoInactiveDeck(originalSceneName);
    }
    
  }, [newSceneName, savedSceneList, uiControlConfig, addNewSceneToStagedWorkspace, addToast, managerInstancesRef, renderedCrossfaderValue, activeSceneName, reloadSceneOntoInactiveDeck]);

  const handleDeleteScene = useCallback((nameToDelete) => {
    if (window.confirm(`Are you sure you want to delete the scene "${nameToDelete}"? This will be staged for the next save.`)) {
      deleteSceneFromStagedWorkspace(nameToDelete);
      addToast(`Scene "${nameToDelete}" was deleted. Save your workspace to confirm.`, "info");
    }
  }, [deleteSceneFromStagedWorkspace, addToast]);

  const handleEnterMIDILearnMode = useCallback((paramName) => {
    if (!isProfileOwner || !midiConnected) return;
    startMIDILearn(paramName, activeLayer);
  }, [isProfileOwner, midiConnected, startMIDILearn, activeLayer]);

  const handleEnterLayerMIDILearnMode = useCallback((layer) => {
    if (!isProfileOwner || !midiConnected) return;
    startLayerMIDILearn(layer);
  }, [isProfileOwner, midiConnected, startLayerMIDILearn]);

  const handleEnterGlobalMIDILearnMode = useCallback((controlName) => {
    if (!isProfileOwner || !midiConnected) return;
    startGlobalMIDILearn(controlName);
  }, [isProfileOwner, midiConnected, startGlobalMIDILearn]);

  const displayGlobalMidiMapping = useCallback((controlName) => {
    const mapping = midiMap?.global?.[controlName];
    if (!mapping) return "None";
    const ch = mapping.channel !== undefined ? ` (Ch ${mapping.channel + 1})` : "";
    if (mapping.type === "cc") return `CC ${mapping.number}${ch}`;
    if (mapping.type === "note") return `Note ${mapping.number}${ch}`;
    if (mapping.type === "pitchbend") return `Pitch${ch}`;
    return "Unknown";
  }, [midiMap]);

  const displayLayerMidiMapping = useCallback((layer) => {
    const mapping = layerMappings[String(layer)];
    if (!mapping?.type) return "-";
    const ch = mapping.channel !== undefined ? ` (Ch ${mapping.channel + 1})` : "";
    if (mapping.type === "note") return `Note ${mapping.number}${ch}`;
    return "Unknown";
  }, [layerMappings]);

  const handleBlendModeChange = useCallback((e) => onLayerConfigChange(activeLayer, "blendMode", e.target.value, false), [onLayerConfigChange, activeLayer]);
  const handleDirectionToggle = useCallback(() => onLayerConfigChange(activeLayer, "direction", - (config.direction || 1), false), [onLayerConfigChange, activeLayer, config.direction]);
  const handleEnabledToggle = useCallback((e) => onLayerConfigChange(activeLayer, "enabled", e.target.checked, false), [onLayerConfigChange, activeLayer]);
  
  const isLearning = (type, control) => midiLearning?.type === type && midiLearning?.control === control;

  return (
    <Panel title={`Layer ${activeLayer} Controls`} onClose={onToggleMinimize} className="panel-from-toolbar enhanced-control-panel">
      <div className="compact-panel-header">
        <div className="tab-navigation">
          {[3, 2, 1].map(layerNum => (
            <button key={layerNum} type="button" className={`tab-button ${activeLayer === String(layerNum) ? "active" : ""}`} onClick={() => onTabChange(Object.keys(tabToLayerIdMap).find(key => tabToLayerIdMap[key] === layerNum))} title={`Layer ${layerNum}`}>
              <img src={layerNum === 3 ? toplayerIcon : layerNum === 2 ? middlelayerIcon : bottomlayerIcon} alt={`L${layerNum}`} className="tab-icon" />
            </button>
          ))}
        </div>
      </div>

      <PLockController {...pLockProps} />

      <div className="vertical-layout control-panel-content">
        {sliderParams.map(({ prop, label, min, max, step, formatDecimals, defaultValue = 0 }) => {
            const isLearningThis = midiLearning?.type === 'param' && midiLearning?.param === prop && midiLearning?.layer === activeLayer;
            const isLocked = pLockProps.pLockState === 'playing' && pLockProps.animationDataRef?.current?.[activeLayer]?.[prop];
            return (
              <div key={prop} className="slider-container">
                <div className="slider-header">
                  <span className="slider-label">{isLocked && <span className="plock-indicator" title="Parameter Locked">●</span>}{label}</span>
                  <div className="slider-controls">
                    <span className="slider-value">{formatValue(config[prop] ?? defaultValue, formatDecimals)}</span>
                    {midiConnected && isProfileOwner && (<button type="button" className={`midi-btn small-action-button ${isLearningThis ? "learning" : ""}`} onClick={() => handleEnterMIDILearnMode(prop)} disabled={!midiConnected || !!learningLayer || (midiLearning !== null && !isLearningThis)} title={`Map MIDI to ${label}`}> {isLearningThis ? "..." : "M"} </button>)}
                  </div>
                </div>
                <input type="range" name={prop} min={min} max={max} step={step} value={config[prop] ?? defaultValue} onChange={handleSliderChange} disabled={isLearningThis || isLocked} className="horizontal-slider" aria-label={label} />
              </div>
            );
        })}

        <div className="controls-footer">
          <div className="blendmode-container">
            <label htmlFor={`blendModeVertical-${activeLayer}`}>BLEND MODE</label>
            <select id={`blendModeVertical-${activeLayer}`} className="custom-select blend-mode-select" name="blendMode" value={config.blendMode || "normal"} onChange={handleBlendModeChange} aria-label="Select Blend Mode">
              {BLEND_MODES.map((mode) => (<option key={mode} value={mode}>{mode.charAt(0).toUpperCase() + mode.slice(1).replace("-", " ")}</option>))}
            </select>
          </div>
          <button type="button" className="changerotation-btn icon-button" onClick={handleDirectionToggle} title="Change Rotation Direction" aria-label="Change Rotation Direction"><img src={rotateIcon} className="changerotation-icon" alt="Change Rotation" /></button>
          <div className="enabled-control-vertical">
            <label htmlFor={`enabled-v-${activeLayer}`}>Enabled</label>
            <input type="checkbox" id={`enabled-v-${activeLayer}`} name="enabled" checked={config.enabled ?? true} onChange={handleEnabledToggle} />
          </div>
        </div>
      </div>

      <div className="scene-management-section">
        <h4>Scene Management</h4>
        {isProfileOwner && (
          <div className="scene-create-form">
            <input type="text" value={newSceneName} onChange={(e) => setNewSceneName(e.target.value)} className="form-control" placeholder="New Scene Name" disabled={isSaving} />
            <button className="btn btn-sm" onClick={handleCreateScene} disabled={isSaving || !newSceneName.trim()}>Create</button>
          </div>
        )}
        {savedSceneList.length > 0 ? (
          <ul className="scene-list">
            {savedSceneList.map((scene) => (
              <li key={scene.name} className={scene.name === activeSceneName ? "active" : ""}>
                <div className="scene-main-content">
                  <button className="scene-name" onClick={() => onSceneSelect(scene.name, crossfadeDurationMs)} disabled={isSaving} title={`Load "${scene.name}"`}>
                    {scene.name}
                  </button>
                  {stagedActiveWorkspace?.defaultPresetName === scene.name && (<span className="default-scene-tag">(Default)</span>)}
                </div>
                {isProfileOwner && (
                  <div className="scene-actions">
                    <button className="btn-icon" onClick={() => setDefaultSceneInStagedWorkspace(scene.name)} disabled={isSaving || stagedActiveWorkspace?.defaultPresetName === scene.name} title="Set as Default">★</button>
                    <button 
                      className="btn-icon delete-scene" 
                      onClick={() => handleDeleteScene(scene.name)} 
                      disabled={isSaving || savedSceneList.length <= 1} 
                      title={savedSceneList.length <= 1 ? "Cannot delete the last scene" : `Delete "${scene.name}"`}
                    >×</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="no-scenes-message">No scenes saved in this workspace.</p>}
      </div>

      <div className="sequencer-settings-section">
        <h4 className="midi-section-title">Scene Sequencer Settings</h4>
        <div className="sequencer-interval-form">
            <label htmlFor="crossfade-duration-input">Crossfade Duration:</label>
            <input
                id="crossfade-duration-input"
                type="number"
                className="form-control interval-input"
                value={localDurationInput}
                onChange={(e) => setLocalDurationInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSetDuration()}
                min="0.1"
                step="0.1"
                disabled={isAutoFading}
            />
            <span className="interval-unit">s</span>
            <button className="btn btn-sm interval-set-button" onClick={handleSetDuration} disabled={isAutoFading}>Set</button>
        </div>
        <div className="sequencer-interval-form">
            <label htmlFor="sequencer-interval-input">Interval Between Fades:</label>
            <input
                id="sequencer-interval-input"
                type="number"
                className="form-control interval-input"
                value={localIntervalInput}
                onChange={(e) => setLocalIntervalInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSetInterval()}
                min="0"
                step="0.1"
                disabled={isAutoFading}
            />
            <span className="interval-unit">s</span>
            <button className="btn btn-sm interval-set-button" onClick={handleSetInterval} disabled={isAutoFading}>Set</button>
        </div>
      </div>

      {midiConnected && (
        <div className="midi-mappings-section">
          <h4 className="midi-section-title">Global & Layer MIDI Mappings</h4>
          <div className="global-mapping-grid">
            <div className="global-mapping-item">
              <div className="global-mapping-label">Crossfader</div>
              <div className="global-mapping-controls">
                <span className="layer-mapping-text" title={displayGlobalMidiMapping('crossfader')}>{displayGlobalMidiMapping('crossfader')}</span>
                <button type="button" className={`midi-learn-btn small-action-button ${isLearning('global', 'crossfader') ? "learning" : ""}`} onClick={() => handleEnterGlobalMIDILearnMode('crossfader')} disabled={!midiConnected || !!midiLearning || !!learningLayer} title="Map MIDI to Crossfader">{isLearning('global', 'crossfader') ? "..." : "Map"}</button>
              </div>
            </div>
            <div className="global-mapping-item">
              <div className="global-mapping-label">P-Lock Toggle</div>
              <div className="global-mapping-controls">
                <span className="layer-mapping-text" title={displayGlobalMidiMapping('pLockToggle')}>{displayGlobalMidiMapping('pLockToggle')}</span>
                <button type="button" className={`midi-learn-btn small-action-button ${isLearning('global', 'pLockToggle') ? "learning" : ""}`} onClick={() => handleEnterGlobalMIDILearnMode('pLockToggle')} disabled={!midiConnected || !!midiLearning || !!learningLayer} title="Map MIDI to P-Lock Toggle">{isLearning('global', 'pLockToggle') ? "..." : "Map"}</button>
              </div>
            </div>
            <div className="global-mapping-item">
              <div className="global-mapping-label">Previous Scene</div>
              <div className="global-mapping-controls">
                <span className="layer-mapping-text" title={displayGlobalMidiMapping('prevScene')}>{displayGlobalMidiMapping('prevScene')}</span>
                <button type="button" className={`midi-learn-btn small-action-button ${isLearning('global', 'prevScene') ? "learning" : ""}`} onClick={() => handleEnterGlobalMIDILearnMode('prevScene')} disabled={!midiConnected || !!midiLearning || !!learningLayer} title="Map MIDI to Previous Scene">{isLearning('global', 'prevScene') ? "..." : "Map"}</button>
              </div>
            </div>
            <div className="global-mapping-item">
              <div className="global-mapping-label">Next Scene</div>
              <div className="global-mapping-controls">
                <span className="layer-mapping-text" title={displayGlobalMidiMapping('nextScene')}>{displayGlobalMidiMapping('nextScene')}</span>
                <button type="button" className={`midi-learn-btn small-action-button ${isLearning('global', 'nextScene') ? "learning" : ""}`} onClick={() => handleEnterGlobalMIDILearnMode('nextScene')} disabled={!midiConnected || !!midiLearning || !!learningLayer} title="Map MIDI to Next Scene">{isLearning('global', 'nextScene') ? "..." : "Map"}</button>
              </div>
            </div>
            <div className="global-mapping-item">
              <div className="global-mapping-label">Previous Workspace</div>
              <div className="global-mapping-controls">
                <span className="layer-mapping-text" title={displayGlobalMidiMapping('prevWorkspace')}>{displayGlobalMidiMapping('prevWorkspace')}</span>
                <button type="button" className={`midi-learn-btn small-action-button ${isLearning('global', 'prevWorkspace') ? "learning" : ""}`} onClick={() => handleEnterGlobalMIDILearnMode('prevWorkspace')} disabled={!midiConnected || !!midiLearning || !!learningLayer} title="Map MIDI to Previous Workspace">{isLearning('global', 'prevWorkspace') ? "..." : "Map"}</button>
              </div>
            </div>
            <div className="global-mapping-item">
              <div className="global-mapping-label">Next Workspace</div>
              <div className="global-mapping-controls">
                <span className="layer-mapping-text" title={displayGlobalMidiMapping('nextWorkspace')}>{displayGlobalMidiMapping('nextWorkspace')}</span>
                <button type="button" className={`midi-learn-btn small-action-button ${isLearning('global', 'nextWorkspace') ? "learning" : ""}`} onClick={() => handleEnterGlobalMIDILearnMode('nextWorkspace')} disabled={!midiConnected || !!midiLearning || !!learningLayer} title="Map MIDI to Next Workspace">{isLearning('global', 'nextWorkspace') ? "..." : "Map"}</button>
              </div>
            </div>
          </div>
          <div className="layer-mapping-grid">
            {[3, 2, 1].map((layerNum) => (
              <div key={`layer_mapping_${layerNum}`} className={`layer-mapping-item ${activeLayer === String(layerNum) ? "active" : ""}`}>
                <div className="layer-mapping-label">Layer {layerNum} Select</div>
                <div className="layer-mapping-controls">
                  <span className="layer-mapping-text" title={displayLayerMidiMapping(String(layerNum))}>{displayLayerMidiMapping(String(layerNum))}</span>
                  {isProfileOwner && (<button type="button" className={`midi-learn-btn small-action-button ${learningLayer === layerNum ? "learning" : ""}`} onClick={() => handleEnterLayerMIDILearnMode(layerNum)} disabled={!midiConnected || !!midiLearning || (learningLayer !== null && learningLayer !== layerNum)} title={`Map MIDI to select Layer ${layerNum}`}> {learningLayer === layerNum ? "..." : "Map"} </button>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
};

EnhancedControlPanel.propTypes = {
  onToggleMinimize: PropTypes.func.isRequired,
  activeTab: PropTypes.string,
  onTabChange: PropTypes.func,
  pLockProps: PropTypes.object,
  sequencerIntervalMs: PropTypes.number,
  onSetSequencerInterval: PropTypes.func,
  crossfadeDurationMs: PropTypes.number,
  onSetCrossfadeDuration: PropTypes.func,
};

export default React.memo(EnhancedControlPanel);
```

---
### `src\components\Panels\EnhancedSavePanel.jsx`
```jsx
// src/components/Panels/EnhancedSavePanel.jsx
import React, { useCallback } from "react";
import PropTypes from "prop-types";

import Panel from "./Panel";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import { useUserSession } from "../../context/UserSessionContext";

import "./PanelStyles/EnhancedSavePanel.css";

const formatAddress = (address) => {
  if (!address || typeof address !== "string" || !address.startsWith("0x")) return "N/A";
  if (address.length <= 11) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

const EnhancedSavePanel = ({ onClose }) => {
  const { hostProfileAddress, isPreviewMode, isHostProfileOwner, canSaveToHostProfile } = useUserSession();
  const {
    activeWorkspaceName,
    saveChanges,
    duplicateActiveWorkspace,
    isLoading: isWorkspaceLoading,
    isSaving,
    hasPendingChanges,
  } = useWorkspaceContext();
  
  const canSave = canSaveToHostProfile;
  const isFirstSave = !activeWorkspaceName;

  const handleDuplicateWorkspace = useCallback(async () => {
    if (!canSave || isSaving) return;
    const newName = window.prompt("Enter a name for the duplicated workspace:");
    if (newName && newName.trim()) {
      const result = await duplicateActiveWorkspace(newName.trim());
      if (result.success) {
        onClose();
      }
    }
  }, [canSave, isSaving, duplicateActiveWorkspace, onClose]);

  const handleSaveChanges = useCallback(async () => {
    if (!canSave || isSaving) return;

    if (isFirstSave) {
      // On a first save, the action is more like creating than duplicating.
      const newName = window.prompt("Enter a name for your first workspace:");
      if (newName && newName.trim()) {
        const result = await duplicateActiveWorkspace(newName.trim()); // It duplicates the "blank" state
        if (result.success) {
          onClose();
        }
      }
      return;
    }

    const result = await saveChanges();
    if (result.success) {
      onClose();
    }
  }, [canSave, isSaving, saveChanges, onClose, isFirstSave, duplicateActiveWorkspace]);

  const getPanelTitle = () => {
    if (isPreviewMode) return "VISITOR PREVIEW";
    if (!hostProfileAddress) return "CONNECT PROFILE";
    if (canSave) return "SAVE MANAGEMENT";
    return `VIEWING PROFILE (${formatAddress(hostProfileAddress)})`;
  };

  const renderStatusIndicator = () => {
    if (isSaving) return <div className="status-indicator saving">Saving Changes...</div>;
    if (hasPendingChanges && canSave) return <div className="status-indicator pending">Unsaved changes</div>;
    if (!canSave && hostProfileAddress && !isPreviewMode) return <div className="status-indicator idle">Viewing mode. Changes are not saved.</div>;
    return <div className="status-indicator idle">Workspace is in sync</div>;
  };

  const isUpdateDisabled = !hasPendingChanges || isSaving || !canSave || isWorkspaceLoading;
  const isSaveAsDisabled = isSaving || !canSave || isWorkspaceLoading;

  return (
    <Panel title={getPanelTitle()} onClose={onClose} className="panel-from-toolbar enhanced-save-panel">
      {canSave && hostProfileAddress && (
        <>
          <div className="config-section save-workspace-section">
            {renderStatusIndicator()}
            <button className="btn btn-block btn-primary" onClick={handleSaveChanges} disabled={isUpdateDisabled}>
              {isSaving ? "SAVING..." : (isFirstSave ? "Save Workspace..." : "Update Current Workspace")}
            </button>
            <p className="form-help-text">
              {isFirstSave
                ? "Save your current scenes and settings as your first workspace."
                : "Commit all changes in the current workspace (scenes, MIDI maps, etc.) to your profile."}
            </p>
          </div>
          <div className="config-section">
            <button className="btn btn-block btn-secondary" onClick={handleDuplicateWorkspace} disabled={isSaveAsDisabled}>
              Duplicate Workspace...
            </button>
            <p className="form-help-text">
              Saves a copy of the current workspace with a new name in your Setlist.
            </p>
          </div>
        </>
      )}
      {!isHostProfileOwner && hostProfileAddress && (
        <div className="save-info visitor-banner">
            <span aria-hidden="true">👤</span>
            <div>
              <div className="title">Viewing Mode</div>
              <div className="desc">
                You are viewing another user's profile. You can load and experiment with their scenes. Saving is disabled.
              </div>
            </div>
          </div>
      )}
    </Panel>
  );
};

EnhancedSavePanel.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default EnhancedSavePanel;
```

---
### `src\components\Panels\EventsPanel.jsx`
```jsx
// src/components/Panels/EventsPanel.jsx
import React, { useState, useCallback, useEffect, useMemo } from "react";
import PropTypes from "prop-types";

import Panel from "./Panel";
import { EVENT_TYPE_MAP } from "../../config/global-config";
import { useToast } from "../../context/ToastContext";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import { useUserSession } from "../../context/UserSessionContext";

import "./PanelStyles/Eventspanel.css";

const generateEventOptions = () => {
    const optionsMap = new Map();
    Object.keys(EVENT_TYPE_MAP).forEach((readableKey) => {
        const typeId = EVENT_TYPE_MAP[readableKey];
        if (!optionsMap.has(typeId)) {
            optionsMap.set(typeId, {
                value: typeId,
                label: readableKey.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
            });
        }
    });

    return Array.from(optionsMap.values()).sort((a, b) => a.label.localeCompare(b.label));
};

const EventsPanel = ({
  onClose,
  onPreviewEffect,
}) => {
  const { addToast } = useToast();
  const { canSaveToHostProfile } = useUserSession();
  const {
    stagedActiveWorkspace,
    updateGlobalEventReactions,
    deleteGlobalEventReaction,
  } = useWorkspaceContext();

  const readOnly = !canSaveToHostProfile;
  const reactions = useMemo(() => stagedActiveWorkspace?.globalEventReactions || {}, [stagedActiveWorkspace]);
  const onSaveReaction = updateGlobalEventReactions;
  const onRemoveReaction = deleteGlobalEventReaction;

  const allEventOptions = useMemo(() => generateEventOptions(), []);

  const [selectedEvent, setSelectedEvent] = useState(allEventOptions[0]?.value || "");
  const [selectedEffect, setSelectedEffect] = useState("color_overlay");
  const [effectConfig, setEffectConfig] = useState({
    color: "rgba(255, 165, 0, 0.4)", pulseCount: 2, duration: 2500,
    r: 255, g: 165, b: 0, a: 0.4,
  });
  const [previewStatus, setPreviewStatus] = useState("");

  useEffect(() => {
    const existingReaction = reactions[selectedEvent];
    if (existingReaction) {
      setSelectedEffect(existingReaction.effect || "color_overlay");
      if (existingReaction.effect === "color_overlay" && existingReaction.config) {
        const colorString = existingReaction.config.color || "rgba(255, 165, 0, 0.4)";
        const rgbaMatch = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        const [r, g, b, a] = rgbaMatch
          ? [ parseInt(rgbaMatch[1],10), parseInt(rgbaMatch[2],10), parseInt(rgbaMatch[3],10), parseFloat(rgbaMatch[4] ?? 1) ]
          : [255, 165, 0, 0.4];
        setEffectConfig({
          color: colorString,
          pulseCount: existingReaction.config.pulseCount || 2,
          duration: existingReaction.config.duration || 2500,
          r, g, b, a,
        });
      } else {
        setEffectConfig({ color: "rgba(255, 165, 0, 0.4)", pulseCount: 2, duration: 2500, r: 255, g: 165, b: 0, a: 0.4 });
      }
    } else {
      setSelectedEffect("color_overlay");
      setEffectConfig({ color: "rgba(255, 165, 0, 0.4)", pulseCount: 2, duration: 2500, r: 255, g: 165, b: 0, a: 0.4 });
    }
  }, [selectedEvent, reactions]);

  const handleEventChange = useCallback((e) => setSelectedEvent(e.target.value), []);

  const handleEffectChange = useCallback((e) => {
    const newEffectType = e.target.value;
    setSelectedEffect(newEffectType);
    if (newEffectType === "color_overlay") {
      setEffectConfig({ color: "rgba(255, 165, 0, 0.4)", pulseCount: 2, duration: 2500, r: 255, g: 165, b: 0, a: 0.4 });
    } else {
      setEffectConfig({});
    }
  }, []);

  const handleColorChange = useCallback((component, value) => {
    setEffectConfig((prevConfig) => {
      const updatedConfig = { ...prevConfig, [component]: Number(value) };
      const { r = 0, g = 0, b = 0, a = 1 } = updatedConfig;
      updatedConfig.color = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Number(a).toFixed(2)})`;
      return updatedConfig;
    });
  }, []);

  const handleConfigChange = useCallback((field, value) => {
    const numericValue = ["pulseCount", "duration"].includes(field) ? parseInt(value, 10) : value;
    setEffectConfig((prev) => ({ ...prev, [field]: numericValue }));
  }, []);

  const handleStageLocally = useCallback(() => {
    if (readOnly) { addToast("Read-only mode: Cannot stage changes.", "warning"); return; }
    if (typeof onSaveReaction !== "function") { addToast("Error: Staging function unavailable.", "error"); return; }
    if (!selectedEvent) { addToast("Please select an event type.", "warning"); return; }

    const reactionId = selectedEvent;
    const reactionConfigToStage = {
      event: selectedEvent,
      layer: "global",
      effect: selectedEffect,
      config: selectedEffect === "color_overlay" ? {
          color: effectConfig.color,
          pulseCount: Number(effectConfig.pulseCount),
          duration: Number(effectConfig.duration),
        } : {},
    };

    try {
      onSaveReaction(reactionId, reactionConfigToStage);
      const eventLabel = allEventOptions.find(opt => opt.value === selectedEvent)?.label || selectedEvent;
      addToast(`Reaction for '${eventLabel}' staged. Save globally via Save Panel.`, "success");
    } catch (error) {
      if (import.meta.env.DEV) console.error("[EventsPanel] Error during onSaveReaction call:", error);
      addToast(`Error staging reaction: ${error.message || "Unknown error"}`, "error");
    }
  }, [ readOnly, selectedEvent, selectedEffect, effectConfig, onSaveReaction, addToast, allEventOptions ]);

  const handleRemoveStagedReaction = useCallback((typeIdToRemove) => {
    if (readOnly) { addToast("Read-only mode: Cannot unstage changes.", "warning"); return; }
    if (typeof onRemoveReaction !== "function") { addToast("Error: Unstaging function unavailable.", "error"); return; }
    if (!typeIdToRemove) { addToast("No event type specified to unstage.", "warning"); return; }

    const eventLabel = allEventOptions.find(opt => opt.value === typeIdToRemove)?.label || typeIdToRemove;
    if (window.confirm(`Are you sure you want to unstage the reaction for "${eventLabel}"? This will remove it from the current pending changes.`)) {
        try {
            onRemoveReaction(typeIdToRemove);
            addToast(`Reaction for "${eventLabel}" unstaged.`, "info");
            if (selectedEvent === typeIdToRemove) {
                setSelectedEvent(allEventOptions[0]?.value || "");
            }
        } catch (error) {
            if (import.meta.env.DEV) console.error("[EventsPanel] Error during onRemoveReaction call:", error);
            addToast(`Error unstaging reaction: ${error.message || "Unknown error"}`, "error");
        }
    }
  }, [readOnly, onRemoveReaction, addToast, selectedEvent, allEventOptions]);


  const handlePreview = useCallback(() => {
    setPreviewStatus("");
    if (typeof onPreviewEffect !== "function") {
      setPreviewStatus("Preview function unavailable.");
      setTimeout(() => setPreviewStatus(""), 3000);
      return;
    }
    const effectToPreview = {
      layer: "global",
      type: selectedEffect,
      config: selectedEffect === "color_overlay" ? {
          color: effectConfig.color,
          pulseCount: Number(effectConfig.pulseCount),
          duration: Number(effectConfig.duration),
        } : {},
      effectId: `preview_${Date.now()}`,
    };
    onPreviewEffect(effectToPreview)
      .then((effectId) => {
        setPreviewStatus(effectId ? "Preview triggered!" : "Preview failed to apply.");
        setTimeout(() => setPreviewStatus(""), 2000);
      })
      .catch((error) => {
        if (import.meta.env.DEV) console.error("[EventsPanel] Error triggering preview effect:", error);
        setPreviewStatus("Preview error occurred.");
        setTimeout(() => setPreviewStatus(""), 3000);
      });
  }, [onPreviewEffect, selectedEffect, effectConfig]);

  return (
    <Panel
      title="EVENT REACTIONS"
      onClose={onClose}
      className="panel-from-toolbar events-panel-custom-scroll"
    >
      <div className="reaction-form section-box">
        <h3 className="section-title">Configure New Reaction / Edit Existing</h3>
        <p className="form-help-text">
          Select an event to configure its visual reaction. Click "Stage Reaction" to add your changes.
          Finally, use the main Save Panel to persist all staged reactions globally to this profile.
        </p>
        <div className="form-group">
          <label htmlFor="event-select">Event Type</label>
          <select id="event-select" value={selectedEvent} onChange={handleEventChange} className="custom-select" disabled={readOnly} aria-label="Select Event Type">
            {allEventOptions.map((opt) => (
              <option key={opt.value} value={opt.value}> {opt.label} </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="effect-select">Visual Effect</label>
          <select id="effect-select" value={selectedEffect} onChange={handleEffectChange} className="custom-select" disabled={readOnly} aria-label="Select Visual Effect">
            <option value="color_overlay">Color Overlay Pulse</option>
          </select>
        </div>

        {selectedEffect === "color_overlay" && (
          <div className="color-config-section">
            <h4 className="config-section-title">Effect Settings: Color Overlay</h4>
            <div className="color-preview-container">
              <span className="color-preview-label">Preview:</span>
              <div className="color-preview" style={{ backgroundColor: effectConfig.color }} title={`Current color: ${effectConfig.color}`} ></div>
            </div>
            <div className="slider-group">
              <div className="slider-container"><div className="slider-header"> <span className="slider-label">Red</span> <span className="slider-value">{effectConfig.r || 0}</span> </div><input type="range" min="0" max="255" step="1" value={effectConfig.r || 0} onChange={(e) => handleColorChange("r", parseInt(e.target.value,10))} className="color-slider red-slider" disabled={readOnly} aria-label="Red color component"/></div>
              <div className="slider-container"><div className="slider-header"> <span className="slider-label">Green</span> <span className="slider-value">{effectConfig.g || 0}</span> </div><input type="range" min="0" max="255" step="1" value={effectConfig.g || 0} onChange={(e) => handleColorChange("g", parseInt(e.target.value,10))} className="color-slider green-slider" disabled={readOnly} aria-label="Green color component"/></div>
              <div className="slider-container"><div className="slider-header"> <span className="slider-label">Blue</span> <span className="slider-value">{effectConfig.b || 0}</span> </div><input type="range" min="0" max="255" step="1" value={effectConfig.b || 0} onChange={(e) => handleColorChange("b", parseInt(e.target.value,10))} className="color-slider blue-slider" disabled={readOnly} aria-label="Blue color component"/></div>
              <div className="slider-container"><div className="slider-header"> <span className="slider-label">Opacity</span> <span className="slider-value">{(Number(effectConfig.a) || 0).toFixed(2)}</span> </div><input type="range" min="0" max="1" step="0.01" value={effectConfig.a || 0} onChange={(e) => handleColorChange("a", parseFloat(e.target.value))} className="color-slider alpha-slider" disabled={readOnly} aria-label="Color opacity"/></div>
            </div>
            <div className="slider-group">
              <div className="slider-container"><div className="slider-header"> <span className="slider-label">Pulse Count</span> <span className="slider-value">{effectConfig.pulseCount || 1}</span> </div><input type="range" min="1" max="10" step="1" value={effectConfig.pulseCount || 1} onChange={(e) => handleConfigChange("pulseCount", e.target.value)} disabled={readOnly} aria-label="Number of pulses"/></div>
              <div className="slider-container"><div className="slider-header"> <span className="slider-label">Total Duration (ms)</span> <span className="slider-value">{effectConfig.duration || 500}</span> </div><input type="range" min="500" max="10000" step="100" value={effectConfig.duration || 500} onChange={(e) => handleConfigChange("duration", e.target.value)} disabled={readOnly} aria-label="Total effect duration in milliseconds"/></div>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button className="btn btn-secondary btn-preview" onClick={handlePreview} disabled={typeof onPreviewEffect !== "function"} title="Trigger a preview of the current effect settings" > PREVIEW EFFECT </button>
          <button className="btn btn-primary btn-save-reaction" onClick={handleStageLocally} disabled={readOnly || typeof onSaveReaction !== "function"} title={ readOnly ? "Cannot stage in read-only mode" : "Stage this reaction (must save globally via Save Panel)" } > STAGE REACTION </button>
        </div>

        {previewStatus && ( <div className="status-message preview-status">{previewStatus}</div> )}
      </div>

      <div className="active-reactions section-box">
        <h3 className="section-title">Current Global Event Reactions (Profile)</h3>
        {Object.keys(reactions).length === 0 ? (
          <div className="no-reactions">No global reactions currently saved for this profile.</div>
        ) : (
          <div className="reactions-list">
            {Object.entries(reactions).map(([typeId, reaction]) => {
              const eventLabel = allEventOptions.find((opt) => opt.value === typeId)?.label || typeId.slice(0,10)+"...";
              return (
                <div key={typeId} className="reaction-item" id={'reaction-' + typeId} >
                  <div className="reaction-details">
                    <span className="reaction-event" title={typeId}>
                      {eventLabel}
                    </span>
                    <span className="reaction-effect-type"> ({reaction.effect === "color_overlay" ? "Color Pulse" : reaction.effect}) </span>
                    {reaction.effect === "color_overlay" && reaction.config?.color && (
                        <span className="color-pill" style={{ backgroundColor: reaction.config.color }} title={`Color: ${reaction.config.color}`} ></span>
                    )}
                  </div>
                  {!readOnly && typeof onRemoveReaction === 'function' && (
                      <button
                          className="btn-icon delete-reaction"
                          onClick={() => handleRemoveStagedReaction(typeId)}
                          title={`Unstage reaction for ${eventLabel}`}
                          aria-label={`Unstage reaction for ${eventLabel}`}
                      >
                          ×
                      </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {readOnly && ( <p className="read-only-hint">Viewing in read-only mode. Staging or unstaging reactions is disabled.</p> )}
        {!readOnly && ( <p className="save-hint"> Use the main Save Panel to persist staged changes globally to your profile. </p> )}
      </div>
    </Panel>
  );
};

EventsPanel.propTypes = {
  onClose: PropTypes.func.isRequired,
  onPreviewEffect: PropTypes.func,
};

export default React.memo(EventsPanel);
```

---
### `src\components\Panels\InfoOverlay.jsx`
```jsx
// src/components/Panels/InfoOverlay.jsx
import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";

import "./PanelStyles/InfoOverlay.css"; // Local styles
import radarWordmarkBlue from "../../assets/branding/radarwordmarkblue.svg"; // Local asset

/**
 * @typedef {'initial' | 'fadeToContent' | 'exiting'} TransitionState - Possible transition states for the overlay.
 */

/**
 * @typedef {'about' | 'controls' | 'notifications' | 'tokens' | 'saving' | 'library' | 'audioReactivity' | 'collections' | 'contributors' | 'roadmap'} InfoTabId - Valid identifiers for tabs within the info overlay.
 */

/**
 * @typedef {object} InfoOverlayProps
 * @property {boolean} isOpen - Controls whether the overlay is currently open or closed.
 * @property {() => void} onClose - Callback function invoked when the overlay requests to be closed (e.g., by clicking the close button or background).
 */

/**
 * InfoOverlay: A modal-like component that displays detailed information about the RADAR application.
 * It features tabbed navigation to organize content into sections like About, Controls, etc.
 * The overlay includes fade-in and fade-out transitions for a smoother user experience.
 *
 * @param {InfoOverlayProps} props - The component's props.
 * @returns {JSX.Element | null} The rendered InfoOverlay component, or null if it's not open and not transitioning out.
 */
const InfoOverlay = ({ isOpen, onClose }) => {
  /** @type {[TransitionState, React.Dispatch<React.SetStateAction<TransitionState>>]} */
  const [transitionState, setTransitionState] = useState("initial");
  /** @type {[InfoTabId, React.Dispatch<React.SetStateAction<InfoTabId>>]} */
  const [activeTab, setActiveTab] = useState("about"); // Default active tab

  // Effect to manage transition states based on the `isOpen` prop
  useEffect(() => {
    if (isOpen) {
      // When isOpen becomes true, start the fade-in transition
      setTransitionState("fadeToContent");
    } else {
      // When isOpen becomes false, start the fade-out transition
      setTransitionState("exiting");
      // After the fade-out duration, reset to initial state (fully hidden)
      const timer = setTimeout(() => setTransitionState("initial"), 300); // Matches CSS transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  /**
   * Handles the close action, initiating the fade-out transition and then calling the `onClose` prop.
   */
  const handleClose = useCallback(() => {
    setTransitionState("exiting");
    // Call the parent's onClose after the CSS transition duration
    setTimeout(onClose, 300);
  }, [onClose]);

  /**
   * Handles clicks on the overlay background, triggering a close action.
   * Ensures that clicks within the content area do not close the overlay.
   * @param {React.MouseEvent<HTMLDivElement>} e - The mouse event.
   */
  const handleBackgroundClick = useCallback((e) => {
    if (e.target === e.currentTarget) { // Only close if the click is directly on the background
      handleClose();
    }
  }, [handleClose]);

  /**
   * Renders the content for the currently active tab.
   * @returns {JSX.Element} The JSX content for the active tab.
   */
  const renderTabContent = useCallback(() => {
    // Content for each tab is defined here.
    switch (activeTab) {
      case "about":
        return (
          <div className="tab-pane">
            <div className="info-card">
              <h4>What is RADAR?</h4>
              <p>
                RADAR is a creative playground. A visual synthesizer that transforms static images into interactive, audio-reactive, remixable instruments.
              </p>
            </div>
            <div className="info-card">
              <h4>Who is it for?</h4>
              <p>
                 RADAR doesn’t fit into a box. It's not just one tool, one use case, or one type of user.
                 It’s for anyone who wants to experience digital art differently.
                 Artists. Collectors. Builders. Performers. Viewers. Remixers.
                 Whether you want to create, perform, showcase or simply watch. It’s yours to explore.
              </p>
            </div>
            <div className="info-card">
              <h4>From collector to creator</h4>
              <p>
                RADAR hands you the keys to the visual kingdom. That unique NFT
                becomes a Generative Art Motor. You're not just a collector;
                you're a VJ, a digital sculptor, unleashing the dormant power
                within your assets. Make something new. Make something yours.
              </p>
            </div>
          </div>
        );
      case "controls":
        return (
          <div className="tab-pane">
            <h3>Layer Controls</h3>
            <p>
              RADAR's power lies in its three-layer system. Think of them as
              channels on a visual mixer, each driven by an NFT and fine-tuned
              with these controls:
            </p>
            <div className="info-card">
              <h4>Layer Parameters:</h4>
              <p>
                <strong>Layer Selection:</strong> Use the Top/Middle/Bottom
                tabs to target a specific layer.
              </p>
              <p>
                <strong>Core Visuals:</strong> Control `Speed`, `Size`,
                `Angle`, `Direction`, and `Opacity`.
              </p>
              <p>
                <strong>Positioning:</strong> Manually shift the layer's
                origin with `X/Y Position`.
              </p>
              <p>
                <strong>Organic Movement:</strong> Add subtle, flowing motion
                with `Drift` and `Drift Speed`.
              </p>
              <p>
                <strong>Visual Interaction:</strong> Define how layers blend
                using `Blend Mode`.
              </p>
              <p>
                <strong>Visibility:</strong> Toggle layers on/off with
                `Enabled`.
              </p>
            </div>
          </div>
        );
      case "notifications":
        return (
          <div className="tab-pane">
            <h3>Notification Center & Event Reactions</h3>
            <div className="info-card">
              <h4>Visualizing Your On-Chain Life</h4>
              <p>
                The Notification Panel is your window into the on-chain activity of the currently viewed Universal Profile. Using LUKSO's LSP1 standard, RADAR listens for real-time events like receiving LYX, tokens, or new followers, and displays them in a clean, human-readable list.
              </p>
            </div>
            <div className="info-card">
              <h4>Custom Color-Coded Pulses</h4>
              <p>
                Go beyond simple text notifications. The "Event Reactions" panel lets you turn these on-chain events into visual feedback. You can assign a unique color pulse to any event type. For example, set "LYX Received" to trigger a bright orange pulse, and "Follower Gained" to trigger a purple one. This allows you to see what's happening on your profile at a glance, turning blockchain data into a personalized, ambient visual experience.
              </p>
            </div>
          </div>
        );
      case "tokens":
        return (
          <div className="tab-pane">
            <h3>The Token Selector</h3>
            <p>
              The Token Selector is where you fuel the visual engine. It's an overlay that allows you to assign your digital assets—both fungible (LSP7) and non-fungible (LSP8)—to any of the three visual layers.
            </p>
            <div className="info-card">
              <h4>How It Works</h4>
              <p>
                Simply open the selector, choose your target layer (Top, Middle, or Bottom), and click on an asset from your library. The visualizer will instantly load that asset onto the selected layer, ready for you to manipulate. The selector is split into "My Owned Tokens," which shows assets from collections in your personal library, and "Demo Tokens" for immediate experimentation.
              </p>
            </div>
          </div>
        );
      case "saving":
        return (
          <div className="tab-pane">
            <h3>Saving Your Workspace</h3>
            <div className="info-card">
              <h4>Staging Scenes</h4>
              <p>
                The Save Panel is your studio's control room. When you find a visual configuration you like, you can create a "Scene" by giving it a name. This doesn't save it on-chain immediately; instead, it's "staged." You can create, update, and delete multiple scenes in this staging area. Your list of staged scenes will appear in the Scene Selector Bar at the bottom of the screen for quick access.
              </p>
            </div>
            <div className="info-card">
              <h4>The Workspace: Your Public Gallery</h4>
              <p>
                RADAR treats your entire setup as a single "Workspace." This isn't just your scenes; it includes your personal library of collections, your global MIDI mappings, and your custom event reactions. When you're ready, you hit "Save Workspace." This single action bundles everything into one file, uploads it to a decentralized network (IPFS), and updates a single pointer on your Universal Profile. Your profile doesn't get cluttered with data; it just holds the key to your entire creative studio, making it efficient, portable, and truly yours.
              </p>
            </div>
          </div>
        );
      case "library":
        return (
          <div className="tab-pane">
            <h3>Your Public Library</h3>
            <div className="info-card">
              <h4>Curate and Share</h4>
              <p>
                The Library Panel is where you manage the collections of assets available in your Token Selector. You are in full control. You can add any LSP7 or LSP8 collection from the LUKSO ecosystem to your personal library. This list is saved as part of your public Workspace.
              </p>
            </div>
            <div className="info-card">
              <h4>Cross-Profile Performance</h4>
              <p>
                Because your library is public, anyone who visits your Universal Profile in RADAR can see and use the assets from your curated collections. They can load your scenes and "perform" with your setup using their own audio or MIDI controllers. This turns every profile into a potential gallery and a stage for collaborative, cross-profile visual experiences.
              </p>
            </div>
          </div>
        );
      case "audioReactivity":
        return (
          <div className="tab-pane">
            <h3>Audio Reactivity</h3>
            <p>
              Enable audio reactivity to make RADAR's visuals come alive with sound. When active, the application listens to audio from your device and uses it to modulate the visual layers in real-time.
            </p>
            <div className="info-card">
              <h4>How It Works</h4>
              <p>
                The audio stream is analyzed and split into three main frequency bands. Each band is mapped to a specific layer, creating a synchronized audio-visual experience:
              </p>
              <ul>
                <li><strong>Bass:</strong> The low-end frequencies primarily influence the size and pulse of the <strong>Bottom Layer (1)</strong>.</li>
                <li><strong>Mids:</strong> The mid-range frequencies control the <strong>Middle Layer (2)</strong>.</li>
                <li><strong>Treble:</strong> The high-end frequencies affect the <strong>Top Layer (3)</strong>.</li>
              </ul>
              <p>
                A custom algorithm smoothly blends these influences, and strong beats can trigger a pulse effect across all layers, creating a dynamic and immersive performance.
              </p>
            </div>
          </div>
        );
      case "collections":
        return (
          <div className="tab-pane">
            <h3>Self-Curated Collections</h3>
            <p>
              RADAR is designed as an open standard, not a walled garden. You decide which assets you want to use.
            </p>
            <div className="info-card">
              <h4>Your Personal Asset Library</h4>
              <p>
                Using the Library Panel, you curate your own list of trusted "Seed" collections (LSP7 or LSP8 assets). You simply add the collection's on-chain address, and RADAR will automatically detect any assets you own from that collection and make them available in your Token Selector.
              </p>
              <p>
                This empowers you to pull any compatible creative asset from across the LUKSO ecosystem directly into your studio, making RADAR a truly universal visualizer. Your curated list is saved as part of your Workspace, making your creative toolkit entirely portable and tied to your profile.
              </p>
            </div>
          </div>
        );
      case "contributors":
        return (
          <div className="tab-pane">
            <h3>An Open System for Creators & Coders</h3>
            <p>
              RADAR is built as an open system to experience digital art in dynamic new ways. It's hard to categorize because it's not just one thing: it's a showcase, a performance tool, a VJ instrument, and a visualizer. Its true potential will be unlocked when the community starts to experiment with it.
            </p>
            <div className="info-card">
              <h4>Preparing Assets for Performance</h4>
              <p>
                While RADAR is an open system, you'll quickly notice that not all assets perform equally well. The best results come from assets designed for layering and motion. The demo assets and the official RADAR Genesis collection follow two simple but powerful rules:
              </p>
              <ul>
                <li>
                  <strong>Transparency & Gaps:</strong> Assets with transparent backgrounds and intentional gaps in their design allow the layers underneath to show through, creating beautiful and complex interplay.
                </li>
                <li>
                  <strong>Isolation:</strong> Art that is isolated within its "NFT canvas" and doesn't touch the borders will rotate and scale smoothly, avoiding harsh, straight lines.
                </li>
              </ul>
              <p>
                A fully colored NFT, for example, will simply block the visibility of any layers beneath it, limiting its creative potential within the visualizer.
              </p>
            </div>
            <div className="info-card">
              <h4>A Playground for Developers</h4>
              <p>
                This isn't just for visual artists. RADAR is also a call to creative coders and developers. The "Event Reactions" system is a prime example. Right now, it features a simple color overlay pulse, but the vision is to expand this into a full-fledged FX library. We invite developers to contribute new visual effects that can be triggered by on-chain events, turning every Universal Profile into an even more unique and reactive canvas.
              </p>
            </div>
          </div>
        );
      case "roadmap":
        return (
          <div className="tab-pane">
            <h3>The Journey Ahead</h3>
            <p>
              This application is a foundational piece, built out of a personal passion for art, performance, and the potential of LUKSO. Its purpose is to showcase what a performable, programmable, and creative hub can be, breaking Universal Profiles out of their web3 confinements and into the realm of live, interactive experiences.
            </p>
            <p>
              As an artist and performer who uses RADAR for live VJing, I will be constantly tweaking and improving it based on real-world use. This is a living project.
            </p>
            <div className="info-card">
              <h4>The Next Level: Minting Scenes</h4>
              <p>
                The most exciting step on the horizon is the ability to mint your creations. A "Scene" is essentially a layered recipe of assets and their parameters. We are eagerly awaiting the evolution of tools on LUKSO, like an official token generator, to explore how we can wire this up internally.
              </p>
              <p>
                Imagine being able to take a visual setup you've perfected and minting it as its own unique, standalone, programmable asset. This is the feature that will truly propel RADAR to the next level, turning collectors into creators and fostering a collaborative movement of sharing, remixing, and collecting these new forms of generative art.
              </p>
            </div>
            <div className="info-card">
              <h4>Other Future Directions:</h4>
              <p>
                <strong>Visual Effect Expansion:</strong> Adding more diverse and controllable visual effects triggered by LSP1 events or MIDI signals, built by the community.
              </p>
              <p>
                <strong>Advanced MIDI Capabilities:</strong> Investigating features like MIDI clock synchronization for tempo-based effects.
              </p>
              <p>
                <strong>Performance & Optimization:</strong> Continuously refining the rendering engine for maximum efficiency across devices.
              </p>
              <p>
                <strong>Open Source Strategy:</strong> Evaluating which parts of RADAR could be open-sourced to serve as examples and building blocks for other LUKSO developers.
              </p>
            </div>
          </div>
        );
      default:
        return (
          <div className="tab-pane">
            <p>Select a tab to view information.</p>
          </div>
        );
    }
  }, [activeTab]); // Dependency on activeTab to re-render content when tab changes

  // Do not render the overlay at all if it's closed and not in the process of exiting.
  // This prevents an invisible DOM element from potentially interfering with interactions.
  if (!isOpen && transitionState === "initial") {
    return null;
  }

  return (
    <div
      className={`overlay ${transitionState}`} // CSS classes control visibility and transitions
      onClick={handleBackgroundClick}
      role="dialog" // Accessibility: Indicate it's a dialog
      aria-modal="true" // Accessibility: Indicate it's a modal dialog
      aria-labelledby="info-overlay-title" // Accessibility: Link to title
    >
      <div className="overlay-content" role="document"> {/* Accessibility: Content container */}
        <div className="overlay-header">
          <h2 className="overlay-title" id="info-overlay-title">
            <img
              src={radarWordmarkBlue}
              alt="RADAR Application Information" // More descriptive alt text
              className="radar-logo-image"
            />
          </h2>
          <button
            className="close-button"
            onClick={handleClose}
            aria-label="Close Information Overlay" // Accessibility
            title="Close" // Tooltip
          >
            ✕
          </button>
        </div>
        <div className="overlay-body">
          <div className="info-overlay-tab-navigation" role="tablist" aria-orientation="vertical">
            {/* Tab buttons with ARIA roles and properties for accessibility */}
            <button className={`info-overlay-tab-button ${activeTab === "about" ? "active" : ""}`} onClick={() => setActiveTab("about")} role="tab" aria-selected={activeTab === "about"} aria-controls="tab-panel-about">About</button>
            <button className={`info-overlay-tab-button ${activeTab === "controls" ? "active" : ""}`} onClick={() => setActiveTab("controls")} role="tab" aria-selected={activeTab === "controls"} aria-controls="tab-panel-controls">Controls</button>
            <button className={`info-overlay-tab-button ${activeTab === "notifications" ? "active" : ""}`} onClick={() => setActiveTab("notifications")} role="tab" aria-selected={activeTab === "notifications"} aria-controls="tab-panel-notifications">Notifications</button>
            <button className={`info-overlay-tab-button ${activeTab === "tokens" ? "active" : ""}`} onClick={() => setActiveTab("tokens")} role="tab" aria-selected={activeTab === "tokens"} aria-controls="tab-panel-tokens">Tokens</button>
            <button className={`info-overlay-tab-button ${activeTab === "saving" ? "active" : ""}`} onClick={() => setActiveTab("saving")} role="tab" aria-selected={activeTab === "saving"} aria-controls="tab-panel-saving">Saving</button>
            <button className={`info-overlay-tab-button ${activeTab === "library" ? "active" : ""}`} onClick={() => setActiveTab("library")} role="tab" aria-selected={activeTab === "library"} aria-controls="tab-panel-library">Library</button>
            <button className={`info-overlay-tab-button ${activeTab === "audioReactivity" ? "active" : ""}`} onClick={() => setActiveTab("audioReactivity")} role="tab" aria-selected={activeTab === "audioReactivity"} aria-controls="tab-panel-audioReactivity">Audio Reactivity</button>
            <button className={`info-overlay-tab-button ${activeTab === "collections" ? "active" : ""}`} onClick={() => setActiveTab("collections")} role="tab" aria-selected={activeTab === "collections"} aria-controls="tab-panel-collections">Collections</button>
            <button className={`info-overlay-tab-button ${activeTab === "contributors" ? "active" : ""}`} onClick={() => setActiveTab("contributors")} role="tab" aria-selected={activeTab === "contributors"} aria-controls="tab-panel-contributors">Contributors</button>
            <button className={`info-overlay-tab-button ${activeTab === "roadmap" ? "active" : ""}`} onClick={() => setActiveTab("roadmap")} role="tab" aria-selected={activeTab === "roadmap"} aria-controls="tab-panel-roadmap">Roadmap</button>
          </div>

          {/* Tab content panels with ARIA properties */}
          <div className="tab-content" id={`tab-panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-button-${activeTab}`}>
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

InfoOverlay.propTypes = {
  /** Controls whether the overlay is currently open or closed. */
  isOpen: PropTypes.bool.isRequired,
  /** Callback function invoked when the overlay requests to be closed. */
  onClose: PropTypes.func.isRequired,
};

export default React.memo(InfoOverlay); // Memoize for performance if props are stable
```

---
### `src\components\Panels\LazyLoadImage.jsx`
```jsx
// src/components/Panels/LazyLoadImage.jsx
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

const observerOptions = {
  root: null, // observes intersections relative to the viewport
  rootMargin: '0px 0px 200px 0px', // Start loading images 200px before they enter the viewport
  threshold: 0.01, // Trigger as soon as a tiny part is visible
};

const LazyLoadImage = ({ src, alt, className }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        // When the placeholder comes into view, set isVisible to true
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Stop observing this element once it's visible
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    const currentRef = imgRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  // Only set the src attribute if the component is visible
  const imageSource = isVisible ? src : '';

  return (
    <div ref={imgRef} className={`lazy-image-container ${isLoaded ? 'loaded' : ''}`}>
      <img
        src={imageSource}
        alt={alt}
        className={className}
        onLoad={() => setIsLoaded(true)}
        style={{ opacity: isLoaded ? 1 : 0 }} // Fade in the image when loaded
        draggable="false"
        decoding="async"
      />
      {/* Show a shimmer placeholder while the image is loading */}
      {!isLoaded && <div className="placeholder-shimmer"></div>}
    </div>
  );
};

LazyLoadImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
  className: PropTypes.string,
};

export default LazyLoadImage;
```

---
### `src\components\Panels\LibraryPanel.jsx`
```jsx
// src/components/Panels/LibraryPanel.jsx
import React, { useState, useCallback, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import Panel from "./Panel";
import { useUserSession } from "../../context/UserSessionContext";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import { useAssetContext } from "../../context/AssetContext";
import { useToast } from "../../context/ToastContext";
import { isAddress, stringToHex } from "viem";
import { uploadJsonToPinata } from "../../services/PinataService";
import { RADAR_OFFICIAL_ADMIN_ADDRESS } from "../../config/global-config";
import { keccak256, stringToBytes } from "viem";
import "./PanelStyles/LibraryPanel.css";

const OFFICIAL_WHITELIST_KEY = keccak256(stringToBytes("RADAR.OfficialWhitelist"));

const formatAddress = (address, length = 4) => {
  if (!address || typeof address !== "string" || !address.startsWith("0x")) return "N/A";
  const displayLength = Math.max(2, Math.min(10, length));
  if (address.length <= displayLength * 2 + 2) return address;
  return `${address.substring(0, displayLength + 2)}...${address.substring(address.length - displayLength)}`;
};

const LibraryPanel = ({ onClose }) => {
  const { isRadarProjectAdmin } = useUserSession();
  const { configServiceRef } = useWorkspaceContext();
  const { officialWhitelist, refreshOfficialWhitelist } = useAssetContext();
  const { addToast } = useToast();

  const [stagedWhitelist, setStagedWhitelist] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newCollection, setNewCollection] = useState({ address: "", name: "", imageUrl: "" });
  const [error, setError] = useState("");
  const statusTimerRef = useRef(null);

  useEffect(() => {
    setStagedWhitelist(officialWhitelist || []);
    setHasChanges(false);
  }, [officialWhitelist]);

  const displayError = useCallback((message, duration = 4000) => {
    setError(message);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    if (duration > 0) {
      statusTimerRef.current = setTimeout(() => setError(""), duration);
    }
  }, []);

  useEffect(() => () => { if (statusTimerRef.current) clearTimeout(statusTimerRef.current) }, []);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setNewCollection((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleAddCollection = useCallback(() => {
    const addressToAdd = newCollection.address.trim();
    const nameToAdd = newCollection.name.trim();

    if (!addressToAdd || !nameToAdd) { displayError("Address and Name are required."); return; }
    if (!isAddress(addressToAdd)) { displayError("Invalid address format."); return; }
    if ((stagedWhitelist || []).some(c => c.address.toLowerCase() === addressToAdd.toLowerCase())) {
        displayError("This collection is already in the whitelist.");
        return;
    }
    
    setStagedWhitelist(prev => [...(prev || []), {
      address: addressToAdd,
      name: nameToAdd,
      imageUrl: newCollection.imageUrl.trim() || null,
    }]);
    setNewCollection({ address: "", name: "", imageUrl: "" });
    setHasChanges(true);
  }, [newCollection, stagedWhitelist, displayError]);

  const handleRemoveCollection = useCallback((addressToRemove) => {
    setStagedWhitelist(prev => (prev || []).filter(c => c.address.toLowerCase() !== addressToRemove.toLowerCase()));
    setHasChanges(true);
  }, []);

  const handleSaveWhitelist = async () => {
    if (!isRadarProjectAdmin || isSaving) return;
    
    setIsSaving(true);
    addToast("Saving whitelist...", "info");

    try {
        const service = configServiceRef.current;
        if (!service || !service.checkReadyForWrite()) {
            throw new Error("Configuration Service is not ready for writing.");
        }

        const newCid = await uploadJsonToPinata(stagedWhitelist, 'RADAR_OfficialWhitelist');
        const newIpfsUri = `ipfs://${newCid}`;
        const valueHex = stringToHex(newIpfsUri);

        await service.saveDataToKey(RADAR_OFFICIAL_ADMIN_ADDRESS, OFFICIAL_WHITELIST_KEY, valueHex);
        
        await refreshOfficialWhitelist();
        
        addToast("Official whitelist saved successfully!", "success");
        setHasChanges(false);
        onClose(); 

    } catch (error) {
        console.error("Failed to save whitelist:", error);
        addToast(`Error: ${error.message}`, "error");
    } finally {
        setIsSaving(false);
    }
  };
  
  if (!isRadarProjectAdmin) {
    return (
        <Panel title="Collections" onClose={onClose} className="panel-from-toolbar library-panel">
            <div className="collections-section section-box">
                <h3 className="section-title">Official Collections</h3>
                {(officialWhitelist || []).length > 0 ? (
                  <div className="collections-grid">
                    {(officialWhitelist || []).map((collection) => (
                      <div key={collection.address} className="collection-card">
                        <div className="collection-image">
                          <img src={collection.imageUrl || `https://via.placeholder.com/80/252525/00f3ff.png?text=${collection.name?.charAt(0)?.toUpperCase() || "?"}`} alt={collection.name || "Collection"}/>
                        </div>
                        <div className="collection-info">
                          <h4 className="collection-name" title={collection.name}>{collection.name || "Unnamed"}</h4>
                          <div className="collection-address" title={collection.address}>{formatAddress(collection.address)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-message">No official collections have been whitelisted yet.</div>
                )}
            </div>
        </Panel>
    );
  }

  // Admin View:
  return (
    <Panel
      title="Manage Whitelist"
      onClose={onClose}
      className="panel-from-toolbar library-panel events-panel-custom-scroll"
    >
      <div className="admin-header">
        <div className="admin-badge">Admin Mode</div>
        <p className="admin-description">
          Add or remove collections from the official RADAR whitelist. Changes here will affect all users after saving.
        </p>
      </div>

      {error && <div className="status-message error">{error}</div>}

      <div className="add-collection-section section-box">
        <h3 className="section-title">Add New Collection</h3>
        <div className="form-group">
          <label htmlFor="address">Collection Address*</label>
          <input type="text" id="address" name="address" className="form-control" value={newCollection.address} onChange={handleInputChange} placeholder="0x..." disabled={isSaving} aria-required="true" />
        </div>
        <div className="form-group">
          <label htmlFor="name">Collection Name*</label>
          <input type="text" id="name" name="name" className="form-control" value={newCollection.name} onChange={handleInputChange} placeholder="Name of the Collection" disabled={isSaving} aria-required="true" />
        </div>
        <div className="form-group">
          <label htmlFor="imageUrl">Image URL</label>
          <input type="text" id="imageUrl" name="imageUrl" className="form-control" value={newCollection.imageUrl} onChange={handleInputChange} placeholder="https://... (optional)" disabled={isSaving}/>
        </div>
        <button className="btn btn-block btn-secondary" onClick={handleAddCollection} disabled={isSaving || !newCollection.address.trim() || !newCollection.name.trim() || !isAddress(newCollection.address.trim())}>
          Add to Staged List
        </button>
      </div>

      <div className="collections-section section-box">
        <h3 className="section-title">Staged Whitelist</h3>
        {(stagedWhitelist || []).length === 0 && <div className="empty-message">The whitelist is currently empty.</div>}
        
        {(stagedWhitelist || []).length > 0 && (
          <div className="collections-grid">
            {(stagedWhitelist || []).map((collection) => (
              <div key={collection.address} className="collection-card">
                <div className="collection-image">
                  <img src={collection.imageUrl || `https://via.placeholder.com/80/252525/00f3ff.png?text=${collection.name?.charAt(0)?.toUpperCase() || "?"}`} alt={collection.name || "Collection"}/>
                </div>
                <div className="collection-info">
                  <h4 className="collection-name" title={collection.name}>{collection.name || "Unnamed"}</h4>
                  <div className="collection-address" title={collection.address}>{formatAddress(collection.address)}</div>
                </div>
                <button className="remove-button btn-icon" onClick={() => handleRemoveCollection(collection.address)} title="Remove from Whitelist" disabled={isSaving}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="config-section save-workspace-section">
        {hasChanges && <div className="status-indicator pending">Whitelist has unsaved changes</div>}
        <button className="btn btn-block btn-primary" onClick={handleSaveWhitelist} disabled={isSaving || !hasChanges}>
          {isSaving ? "SAVING..." : "Save Official Whitelist"}
        </button>
      </div>
    </Panel>
  );
};

LibraryPanel.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default React.memo(LibraryPanel);
```

---
### `src\components\Panels\NotificationPanel.jsx`
```jsx
// src/components/Panels/NotificationPanel.jsx
import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";

import Panel from "./Panel"; // Local component
import { useProfileCache } from "../../hooks/useProfileCache"; // Local hook
import { useNotificationContext } from "../../context/NotificationContext"; // Local context

import { isAddress } from "viem"; // Third-party utility

import "./PanelStyles/NotificationPanel.css"; // Local styles

/**
 * Formats an Ethereum address for display by showing the beginning and end.
 * Returns "Unknown Address" if the input is invalid.
 * @param {string | null | undefined} address - The address string.
 * @param {number} [length=6] - The number of characters to show from the start and end.
 * @returns {string} The formatted address or "Unknown Address".
 */
const formatAddress = (address, length = 6) => {
  if (!address || typeof address !== "string" || !address.startsWith("0x")) {
    return "Unknown Address";
  }
  if (address.length <= length * 2 + 2) {
    return address;
  }
  return `${address.substring(0, length + 2)}...${address.substring(address.length - length)}`;
};

/**
 * @typedef {object} Notification
 * @property {string|number} id - Unique ID of the notification.
 * @property {string} type - Type of the event (e.g., 'lyx_received', 'follower_gained').
 * @property {string} sender - Address of the transaction sender or relevant party.
 * @property {object} [decodedPayload] - Additional decoded data, e.g., `followerAddress`.
 * @property {number} [timestamp] - Timestamp of the notification.
 * @property {boolean} [read] - Whether the notification has been marked as read.
 * @property {string|React.ReactNode} [content] - Custom content if not using default message generation.
 */

/**
 * @typedef {object} NotificationItemProps
 * @property {Notification} notification - The notification object to display.
 * @property {(id: string|number) => void} [onMarkAsRead] - Callback function to mark the notification as read.
 */

/**
 * NotificationItem: Displays a single notification.
 * It resolves sender and follower addresses to profile names using `useProfileCache`
 * for better readability. Allows marking as read on click.
 *
 * @param {NotificationItemProps} props - The component's props.
 * @returns {JSX.Element} The rendered NotificationItem component.
 */
const NotificationItem = ({ notification, onMarkAsRead }) => {
  const { getCachedProfile, getProfileData } = useProfileCache();
  const itemLogPrefix = `[NotifItem ID:${String(notification.id).slice(-5)} Type:${notification.type}]`;


  const [senderName, setSenderName] = useState(() => {
    const initialName = notification.sender ? formatAddress(notification.sender) : "Unknown Sender";
    if (import.meta.env.DEV) console.log(`${itemLogPrefix} Initial senderName set to: ${initialName}`);
    return initialName;
  });

  const [followerName, setFollowerName] = useState(() => {
      const addr = notification.decodedPayload?.followerAddress;
      const initialName = addr && isAddress(addr) ? formatAddress(addr) : null;
      if (import.meta.env.DEV) console.log(`${itemLogPrefix} Initial followerName set to: ${initialName} (from followerAddress: ${addr})`);
      return initialName;
  });

  // Effect to fetch and update sender's profile name
  useEffect(() => {
    const senderAddress = notification.sender;
    if (import.meta.env.DEV) console.log(`${itemLogPrefix} SENDER effect. Address: ${senderAddress}`);

    if (senderAddress && isAddress(senderAddress)) {
      const cachedProfile = getCachedProfile(senderAddress);
      if (import.meta.env.DEV) console.log(`${itemLogPrefix} SENDER cachedProfile for ${senderAddress}:`, cachedProfile);

      if (cachedProfile?.name) {
        setSenderName(cachedProfile.name);
      } else if (cachedProfile?.error) {
        setSenderName(`Error (${formatAddress(senderAddress, 4)})`);
      } else {
        // Set a default/loading state immediately
        const initialName = formatAddress(senderAddress);
        setSenderName(initialName);
        if (import.meta.env.DEV) console.log(`${itemLogPrefix} SENDER no cache, set name to default: ${initialName}`);
        
        // Then, initiate the async fetch
        getProfileData(senderAddress).then((profileData) => {
          if (import.meta.env.DEV) console.log(`${itemLogPrefix} SENDER getProfileData response for ${senderAddress}:`, profileData);
          if (profileData?.name) {
            setSenderName(profileData.name);
            if (import.meta.env.DEV) console.log(`${itemLogPrefix} SENDER setSenderName from FETCH: ${profileData.name}`);
          }
          // If fetch fails or returns no name, the formatted address remains.
        }).catch(err => {
            if(import.meta.env.DEV) console.error(`${itemLogPrefix} SENDER Error in getProfileData promise for ${senderAddress}:`, err);
        });
      }
    } else {
      setSenderName("Unknown Sender");
    }
  }, [notification.sender, getProfileData, getCachedProfile]);

  // Effect to fetch and update follower's profile name
  useEffect(() => {
    const followerAddr = notification.decodedPayload?.followerAddress;
    const isFollowerEvent = notification.type === "follower_gained" || notification.type === "follower_lost";
    if (import.meta.env.DEV) console.log(`${itemLogPrefix} FOLLOWER effect. Address: ${followerAddr}, isFollowerEvent: ${isFollowerEvent}`);

    if (isFollowerEvent && followerAddr && isAddress(followerAddr)) {
      const cachedProfile = getCachedProfile(followerAddr);
      if (import.meta.env.DEV) console.log(`${itemLogPrefix} FOLLOWER cachedProfile for ${followerAddr}:`, cachedProfile);

      if (cachedProfile?.name) {
        setFollowerName(cachedProfile.name);
      } else if (cachedProfile?.error) {
        setFollowerName(`Error (${formatAddress(followerAddr, 4)})`);
      } else {
        // Set default/loading state
        const initialName = formatAddress(followerAddr);
        setFollowerName(initialName);
        if (import.meta.env.DEV) console.log(`${itemLogPrefix} FOLLOWER no cache, set name to default: ${initialName}`);
        
        // Then fetch
        getProfileData(followerAddr).then((profileData) => {
          if (import.meta.env.DEV) console.log(`${itemLogPrefix} FOLLOWER getProfileData response for ${followerAddr}:`, profileData);
          if (profileData?.name) {
            setFollowerName(profileData.name);
            if (import.meta.env.DEV) console.log(`${itemLogPrefix} FOLLOWER setFollowerName from FETCH: ${profileData.name}`);
          }
          // If no name, the formatted address remains.
        }).catch(err => {
            if(import.meta.env.DEV) console.error(`${itemLogPrefix} FOLLOWER Error in getProfileData promise for ${followerAddr}:`, err);
            const errorName = `Error (${formatAddress(followerAddr, 4)})`;
            if (import.meta.env.DEV) console.log(`${itemLogPrefix} FOLLOWER setFollowerName to FETCH ERROR: ${errorName}`);
            setFollowerName(errorName);
        });
      }
    } else {
      // Not a follower event or no valid address
      setFollowerName(null);
    }
  }, [notification.type, notification.decodedPayload, getProfileData, getCachedProfile]);

  const getEventTypeClass = (eventType) => {
    if (typeof eventType !== "string") return "contract";
    const lower = eventType.toLowerCase();
    if (lower.includes("lyx")) return "lyx";
    if (lower.includes("token") || lower.includes("lsp7") || lower.includes("lsp8")) return "token";
    if (lower.includes("follower")) return "social";
    return "contract";
  };

  const displayMessage = useMemo(() => {
    if (notification.content) return notification.content;
    const currentFollowerName = followerName || "Someone"; // Use "Someone" if followerName is null/empty

    switch (notification.type) {
      case "lyx_received":
        return <>Received LYX from <strong>{senderName}</strong></>;
      case "follower_gained":
        return <>{currentFollowerName} started following you</>;
      case "follower_lost":
        return <>{currentFollowerName} unfollowed you</>;
      case "lsp7_received":
         return <>Received LSP7 Token from <strong>{senderName}</strong></>;
      case "lsp8_received":
         return <>Received LSP8 NFT from <strong>{senderName}</strong></>;
      default: {
        const typeLabel = (notification.type || "Event")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        return <>{typeLabel} detected from <strong>{senderName}</strong></>;
      }
    }
  }, [notification.type, notification.content, senderName, followerName]);

  const handleItemClick = () => {
    if (onMarkAsRead && !notification.read) {
      onMarkAsRead(notification.id);
    }
  };

  return (
    <div
      className={`notification-item ${!notification.read ? "new" : ""} type-${getEventTypeClass(notification.type)}`}
      onClick={handleItemClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleItemClick();}}
      aria-live="polite"
      aria-label={`Notification: ${typeof displayMessage === 'string' ? displayMessage : 'Event details'}. Status: ${notification.read ? 'Read' : 'Unread'}.`}
    >
      <div className="notification-header">
        <span className="notification-timestamp">
          {notification.timestamp
            ? new Date(notification.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : "Unknown time"}
        </span>
        <span
          className={`notification-type-tag type-${getEventTypeClass(notification.type)}`}
        >
          {(notification.type || "EVENT").replace(/_/g, " ").toUpperCase()}
        </span>
      </div>
      <div className="notification-content">
        <div className="notification-message">{displayMessage}</div>
      </div>
    </div>
  );
};

NotificationItem.propTypes = {
  notification: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    type: PropTypes.string.isRequired,
    sender: PropTypes.string,
    decodedPayload: PropTypes.object,
    timestamp: PropTypes.number,
    read: PropTypes.bool,
    content: PropTypes.node,
  }).isRequired,
  onMarkAsRead: PropTypes.func,
};

const MemoizedNotificationItem = React.memo(NotificationItem);


/**
 * @typedef {object} NotificationPanelProps
 * @property {() => void} onClose - Callback function to close the panel.
 */

/**
 * NotificationPanel: Displays a list of notifications.
 * @param {NotificationPanelProps} props - The component's props.
 * @returns {JSX.Element} The rendered NotificationPanel component.
 */
const NotificationPanel = ({ onClose }) => {
  const { notifications, onMarkNotificationRead: onMarkAsRead, onClearAllNotifications: onClearAll } = useNotificationContext();

  return (
    <Panel
      title="NOTIFICATIONS"
      onClose={onClose}
      className="panel-from-toolbar notification-panel"
    >
      <div className="panel-header-actions">
        <button
          className="btn btn-sm btn-clear-all"
          onClick={onClearAll}
          disabled={notifications.length === 0 || typeof onClearAll !== 'function'}
          aria-label="Clear all notifications"
        >
          CLEAR ALL
        </button>
      </div>

      <div className="notification-list">
        {notifications.length === 0 ? (
          <div className="notification-empty">No notifications yet.</div>
        ) : (
          notifications.map((notification) => (
            <MemoizedNotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={onMarkAsRead}
            />
          ))
        )}
      </div>
    </Panel>
  );
};

NotificationPanel.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default React.memo(NotificationPanel);
```

---
### `src\components\Panels\Panel.jsx`
```jsx
// src/components/Panels/Panel.jsx
import React from "react";
import PropTypes from "prop-types";
import "./PanelStyles/PanelStyles.css"; // Local styles

/**
 * @typedef {object} PanelProps
 * @property {string} title - The title to be displayed in the panel header.
 * @property {(() => void)} [onClose] - Optional callback function to handle the close action. If provided, a close button will be rendered.
 * @property {React.ReactNode} children - The content to be rendered within the panel's body.
 * @property {string} [className=""] - Optional additional CSS class names to apply to the panel's root element for custom styling.
 * @property {string | null} [width=null] - Optional CSS width override for the panel (e.g., "300px", "50%"). If null, it defaults to a CSS variable `--panel-width`.
 */

/**
 * Base Panel component used by all panel types in the application.
 * It provides a consistent structure with a header (containing a title and an optional close button)
 * and a content area for child elements. The panel's width can be customized.
 *
 * @param {PanelProps} props - The component's props.
 * @returns {JSX.Element} The rendered Panel component.
 */
const Panel = ({ title, onClose, children, className = "", width = null }) => {
  return (
    <div
      className={`panel ${className}`} // Apply base class and any additional classes
      style={{ width: width || "var(--panel-width)" }} // Allow overriding default width via prop, fallback to CSS variable
      role="dialog" // Assuming panels are dialog-like; adjust if not always modal
      aria-labelledby="panel-title-id" // Link to title for accessibility
      // aria-modal={!!onClose} // Consider if it's always modal when closable
    >
      <div className="panel-header">
        <h2 className="panel-title" id="panel-title-id">{title}</h2>
        {onClose && ( // Conditionally render close button if onClose callback is provided
          <button
            className="close-button" // Standard class for styling
            onClick={onClose}
            aria-label={`Close ${title} panel`} // More specific accessible name
            title="Close" // Tooltip
          >
            ✕ {/* Standard multiplication sign for 'close' */}
          </button>
        )}
      </div>

      <div className="panel-content">
        {children}
      </div>
    </div>
  );
};

Panel.propTypes = {
  title: PropTypes.string.isRequired,
  onClose: PropTypes.func,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  width: PropTypes.string,
};

// Default export is standard for React components.
export default Panel;
```

---
### `src\components\Panels\PanelStyles\EnhancedControlPanel.css`
```css
/* src/components/Panels/PanelStyles/EnhancedControlPanel.css */
@import "../../../styles/variables.css";

/* --- ADDED FOR CONSISTENT GLASSMORPHISM --- */
.enhanced-control-panel.panel {
  background: var(--color-glass-bg-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: var(--shadow-primary-lg);
}
/* --- END ADDITION --- */

/* Styles for the tab container in THIS panel */
.compact-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-sm);
}
.panel-actions {
  display: flex;
  gap: var(--space-xs);
}
.tab-navigation {
  display: flex;
  gap: var(--space-xs);
}
/* Styles for the tab buttons in THIS panel */
.tab-button {
  width: var(--icon-size-lg);
  height: var(--icon-size-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-a05);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-normal);
  padding: 0;
  outline: none;
  flex-shrink: 0;
}
.tab-button:focus {
  outline: none;
  box-shadow: none;
}
.tab-button:hover {
  background: var(--color-primary-a15);
  border-color: var(--color-primary-a30);
  transform: translateY(-2px);
  box-shadow: var(--shadow-primary-sm);
}
.tab-button.active {
  background: var(--color-primary-a15);
  border-color: var(--color-primary-a50);
  box-shadow: var(--shadow-primary-md);
}
.tab-icon {
  width: var(--icon-size-md);
  height: var(--icon-size-md);
  opacity: 0.8;
  transition: all var(--transition-fast);
}
.tab-button:hover .tab-icon,
.tab-button.active .tab-icon {
  opacity: 1;
  filter: drop-shadow(0 0 5px var(--color-primary-a30));
}

.vertical-layout {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.slider-container {
  margin-bottom: 3px;
}
.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1px;
}
.slider-controls {
  display: flex;
  align-items: center;
  gap: 3px;
}
.slider-label {
  font-weight: bold;
  color: var(--color-text);
  font-size: 9px;
  text-transform: uppercase;
  opacity: 0.9;
  flex-shrink: 0;
  margin-right: var(--space-xs);
}
.slider-value {
  font-size: 10px;
  color: var(--color-primary-a90);
  font-weight: bold;
  min-width: 30px;
  text-align: right;
  font-family: monospace;
}
.horizontal-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  background: var(--color-primary-a15);
  border-radius: 2px;
  outline: none;
  border: none;
  box-shadow: none;
  cursor: pointer;
  margin-top: 2px;
}
.horizontal-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-primary);
  cursor: pointer;
  border: none;
  box-shadow: 0 0 4px rgba(0, 243, 255, 0.4);
  margin-top: -4px;
}
.horizontal-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-primary);
  cursor: pointer;
  border: none;
  box-shadow: 0 0 4px rgba(0, 243, 255, 0.4);
}

.midi-btn {
  padding: 0 2px;
  font-size: 8px;
  background: var(--color-warning-a15);
  border: 1px solid var(--color-warning-a30);
  border-radius: 3px;
  color: var(--color-warning);
  cursor: pointer;
  outline: none;
  line-height: 1;
  min-width: 12px;
  height: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  margin-left: 2px;
}
.midi-btn:focus {
  outline: none;
  box-shadow: none;
}
.midi-btn:hover:not(:disabled) {
  background: var(--color-warning-a25);
  border-color: var(--color-warning-a30);
  color: var(--color-warning);
}
.midi-btn.learning {
  background: var(--color-accent-a20);
  border-color: var(--color-accent);
  color: var(--color-accent);
  animation: blink 1s infinite;
}

.controls-footer {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: end;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
  padding-top: var(--space-xs);
  border-top: 1px solid var(--color-border);
}
.blendmode-container {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-grow: 1;
}
.blendmode-container label {
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  text-transform: uppercase;
  font-weight: bold;
  margin: 0;
}
.enabled-control-vertical {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}
.enabled-control-vertical label {
  font-size: var(--font-size-xs);
  color: var(--color-primary-a90);
  text-transform: uppercase;
  font-weight: bold;
}
.enabled-control-vertical input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}
.changerotation-btn {
  padding: 5px;
  height: auto;
  width: auto;
  min-width: 28px;
  min-height: 28px;
  background: var(--color-primary-a15);
  border: 1px solid var(--color-primary-a30);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.changerotation-btn:hover {
  background: var(--color-primary-a25);
  box-shadow: var(--shadow-primary-sm);
}
.changerotation-icon {
  width: 18px;
  height: 18px;
  filter: drop-shadow(0 0 4px var(--color-primary));
}

.blend-mode-select,
.midi-channel-select,
.custom-select {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  font-size: var(--font-size-sm);
  padding: 5px var(--space-xs);
  background-color: var(--color-bg-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  outline: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='6' viewBox='0 0 12 6' fill='none'%3E%3Cpath d='M6 6L0 0H12L6 6Z' fill='%2300f3ff'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right var(--space-xs) center;
  cursor: pointer;
}
.blend-mode-select:focus,
.midi-channel-select:focus,
.custom-select:focus {
  border-color: var(--color-primary-a30);
  box-shadow: none;
}

.blend-mode-select option,
.midi-channel-select option {
  background-color: var(--color-bg-dark, #050f19);
  color: var(--color-primary);
  padding: var(--space-xs) var(--space-sm);
}

.midi-mappings-section {
  background: var(--color-bg-alt);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  margin-top: var(--space-lg);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}
.midi-section-title {
  margin: 0 0 var(--space-xs) 0;
  font-size: 10px;
  color: var(--color-primary);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-xs);
  text-transform: uppercase;
  font-weight: bold;
}
.global-mapping-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
  margin-bottom: var(--space-xs);
}
.global-mapping-item,
.layer-mapping-item {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-xs);
}
.global-mapping-label,
.layer-mapping-label {
  font-weight: bold;
  margin-bottom: var(--space-xs);
  font-size: 10px;
}
.global-mapping-controls,
.layer-mapping-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.layer-mapping-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-xs);
}
.layer-mapping-item.active {
  border-color: var(--color-primary-a50);
  background: var(--color-primary-a10);
}
.layer-mapping-text {
  font-size: 9px;
  color: var(--color-text-dim);
}
.midi-learn-btn {
  padding: 0 4px;
  font-size: 9px;
  background: var(--color-primary-a10);
  border: 1px solid var(--color-primary-a20);
  border-radius: var(--radius-sm);
  color: var(--color-primary);
  cursor: pointer;
  outline: none;
  line-height: 1.1;
  min-height: 16px;
}
.midi-learn-btn:focus {
  outline: none;
  box-shadow: none;
}
.midi-learn-btn:hover:not(:disabled) {
  background: var(--color-primary-a20);
}
.midi-learn-btn.learning {
  background: var(--color-accent-a20);
  border-color: var(--color-accent);
  color: var(--color-accent);
  animation: blink 1s infinite;
}

@keyframes blink {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

/* --- SCENE MANAGEMENT STYLES --- */
.scene-management-section {
  margin-top: var(--space-lg);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.scene-management-section h4 {
  margin: 0 0 var(--space-sm) 0;
  font-size: var(--font-size-sm);
  color: var(--color-primary-a90);
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.scene-create-form {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.scene-create-form .form-control {
  flex-grow: 1;
  padding: var(--space-xs) var(--space-sm);
}

.scene-create-form .btn {
  flex-shrink: 0;
  padding: var(--space-xs) var(--space-sm);
}

.scene-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 150px; /* Adjust as needed */
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-bg-inset);
  scrollbar-width: thin;
  scrollbar-color: var(--color-primary-a30) rgba(0, 0, 0, 0.1);
}

.scene-list::-webkit-scrollbar { width: 6px; }
.scene-list::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.1); }
.scene-list::-webkit-scrollbar-thumb { background-color: var(--color-primary-a30); }

.scene-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border-dark);
  gap: var(--space-sm);
}
.scene-list li:last-child { border-bottom: none; }
.scene-list li.active { background-color: var(--color-primary-a15); }

.scene-main-content {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-grow: 1;
  overflow: hidden;
}

.scene-name {
  flex-grow: 1;
  text-align: left;
  background: none;
  border: none;
  color: var(--color-primary-a90);
  cursor: pointer;
  padding: 0;
  font-size: var(--font-size-md);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.scene-list li.active .scene-name { font-weight: bold; color: var(--color-primary); }
.scene-name:hover:not(:disabled) { color: var(--color-primary); }
.scene-name:disabled { cursor: not-allowed; }

.default-scene-tag {
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  font-weight: bold;
  background-color: var(--color-primary-a15);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.scene-actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-shrink: 0;
}

.scene-actions .btn-icon {
  font-size: 1.2em;
  color: var(--color-text-muted);
  transition: color 0.2s ease, transform 0.2s ease;
}

.scene-actions .btn-icon:hover:not(:disabled) {
  color: var(--color-primary);
  transform: scale(1.1);
}

.scene-actions .delete-scene {
  color: var(--color-error-a70);
}
.scene-actions .delete-scene:hover:not(:disabled) {
  color: var(--color-error);
}

.no-scenes-message {
  font-style: italic;
  color: var(--color-text-muted);
  padding: var(--space-sm);
  text-align: center;
}

/* --- SCENE SEQUENCER CONTROLS --- */
.sequencer-settings-section {
  margin-top: var(--space-lg);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.sequencer-interval-form {
  display: grid;
  /* --- THIS IS THE FIX --- */
  /* The first column (label) now takes up the flexible space, pushing the controls to the right. */
  grid-template-columns: 1fr auto auto auto;
  /* --- END FIX --- */
  align-items: center;
  gap: var(--space-sm);
}

.sequencer-interval-form label {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.sequencer-interval-form .interval-input {
  /* --- THIS IS THE FIX --- */
  /* Set a specific width for the input field to prevent it from stretching. */
  width: 60px;
  /* --- END FIX --- */
  text-align: right;
  padding-right: var(--space-xs);
}

.sequencer-interval-form .interval-input::-webkit-outer-spin-button,
.sequencer-interval-form .interval-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.sequencer-interval-form .interval-input[type=number] {
  -moz-appearance: textfield;
}

.sequencer-interval-form .interval-unit {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  font-weight: bold;
}

.sequencer-interval-form .interval-set-button {
  flex-shrink: 0;
}
```

---
### `src\components\Panels\PanelStyles\EnhancedSavePanel.css`
```css
@import "../../../styles/variables.css";

.enhanced-save-panel .config-section {
  margin-bottom: var(--space-lg);
  padding-bottom: var(--space-lg);
  border-bottom: 1px solid var(--color-border-dark);
}
.enhanced-save-panel .config-section:last-child {
  border-bottom: none;
  margin-bottom: var(--space-md);
}
.enhanced-save-panel h3 {
  margin-top: 0;
  margin-bottom: var(--space-md);
  color: var(--color-primary);
  font-size: var(--font-size-md);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.enhanced-save-panel .form-group {
  margin-bottom: var(--space-md);
}
.enhanced-save-panel .form-control {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background-color: var(--color-bg-inset, #222);
  border: 1px solid var(--color-border, #555);
  color: var(--color-text, #eee);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
}
.enhanced-save-panel .form-control:disabled {
  background-color: var(--color-bg-disabled, #333);
  cursor: not-allowed;
  opacity: 0.7;
}

.enhanced-save-panel .checkbox-options-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
  padding-left: var(--space-xs);
  border: none;
  padding: 0;
}
.enhanced-save-panel .checkbox-group {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: 0;
}
.enhanced-save-panel .checkbox-group input[type="checkbox"] {
  margin: 0;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  accent-color: var(--color-primary);
  cursor: pointer;
}
.enhanced-save-panel .checkbox-group label {
  margin-bottom: 0;
  font-weight: normal;
  color: var(--color-text-muted);
  cursor: pointer;
  line-height: 1.4;
  font-size: var(--font-size-sm);
}
.enhanced-save-panel .checkbox-group input[type="checkbox"]:disabled + label {
  cursor: not-allowed;
  opacity: 0.7;
}

.enhanced-save-panel .form-help-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: 1.5;
  margin-top: var(--space-xs);
  margin-bottom: var(--space-md);
}

.save-global-section .global-save-buttons {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
  margin-top: var(--space-sm);
}
.save-global-section .btn-save-global {
  flex-grow: 1;
  flex-basis: 150px;
}

.load-section h3 {
  color: var(--color-primary);
}
.load-section .load-actions-group {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
}
.load-section .load-actions-group .btn {
  flex-grow: 1;
  flex-basis: 150px;
}

.load-section .config-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-bg-inset, #1f1f1f);
  scrollbar-width: thin;
  scrollbar-color: var(--color-primary-a30) rgba(0, 0, 0, 0.1);
}
.load-section .config-list::-webkit-scrollbar { width: 6px; height: 6px; }
.load-section .config-list::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.1); border-radius: 3px; }
.load-section .config-list::-webkit-scrollbar-thumb { background-color: var(--color-primary-a30); border-radius: 3px; }
.load-section .config-list::-webkit-scrollbar-thumb:hover { background-color: var(--color-primary-a50); }

.load-section .config-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border-dark);
  /* --- NEW --- */
  gap: var(--space-sm);
}
.load-section .config-list li:last-child { border-bottom: none; }
.load-section .config-list li.active { background-color: var(--color-primary-a15); }
.load-section .config-list li.active .config-name { font-weight: bold; color: var(--color-primary); }

.load-section .config-list .config-name {
  flex-grow: 1;
  text-align: left;
  background: none;
  border: none;
  color: var(--color-primary-a90);
  cursor: pointer;
  padding: 0;
  margin-right: 0; /* Updated from var(--space-sm) */
  font-size: var(--font-size-md);
  font-family: var(--font-family);
  /* --- NEW --- */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.load-section .config-list .config-name:hover:not(:disabled) { text-decoration: none; color: var(--color-primary); }
.load-section .config-list .config-name:disabled { color: var(--color-text-muted); cursor: not-allowed; font-weight: normal; }

.load-section .config-list .delete-config {
  background: none;
  border: none;
  color: var(--color-error-a70);
  cursor: pointer;
  font-size: 1.4em;
  font-weight: bold;
  padding: 0 5px;
  line-height: 1;
  flex-shrink: 0;
  transition: color var(--transition-fast);
}
.load-section .config-list .delete-config:hover:not(:disabled) { color: var(--color-error); }
.load-section .config-list .delete-config:disabled { color: var(--color-text-muted); cursor: not-allowed; opacity: 0.5; }

.load-section .no-configs-message,
.load-section .loading-list-message {
  font-style: italic;
  color: var(--color-text-muted);
  margin-top: var(--space-md);
  padding: var(--space-sm);
  text-align: center;
  background-color: var(--color-primary-a05);
  border-radius: var(--radius-sm);
}

.status-indicator { padding: var(--space-sm) var(--space-md); border-radius: var(--radius-md); font-size: var(--font-size-sm); text-align: center; margin-bottom: var(--space-md); font-weight: bold; border: 1px solid transparent; transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease; }
.status-indicator.pending { background-color: var(--color-warning-a10); border-color: var(--color-warning-a30); color: var(--color-warning-a90); }
.status-indicator.success { background-color: var(--color-success-a10); border-color: var(--color-success-a30); color: var(--color-success-a90); }
.status-indicator.error { background-color: var(--color-error-a10); border-color: var(--color-error-a30); color: var(--color-error-a90); }
.status-indicator.saving { background-color: var(--color-info-a10, #1a3a5a); border-color: var(--color-info-a30, #3a5a78); color: var(--color-info-a90, #b3e5fc); }
.status-indicator.idle { background-color: var(--color-primary-a05); border-color: var(--color-primary-a15); color: var(--color-primary-a70); font-weight: normal; }

.status-message { padding: var(--space-sm) var(--space-md); margin-bottom: var(--space-md); border-radius: var(--radius-md); text-align: center; font-size: var(--font-size-sm); border: 1px solid transparent; }
.status-message.success { background-color: var(--color-success-a10); border-color: var(--color-success-a30); color: var(--color-success-a90); }
.status-message.error { background-color: var(--color-error-a10); border-color: var(--color-error-a30); color: var(--color-error-a90); }
.status-message.info { background-color: var(--color-info-a10, #1a3a5a); border-color: var(--color-info-a30, #3a5a78); color: var(--color-info-a90, #b3e5fc); }
.status-message.warning { background-color: var(--color-warning-a10); border-color: var(--color-warning-a30); color: var(--color-warning-a90); }

.save-info { display: flex; align-items: flex-start; gap: var(--space-sm); padding: var(--space-md); border-radius: var(--radius-md); margin-top: var(--space-lg); margin-bottom: var(--space-md); border: 1px solid; }
.save-info span[aria-hidden="true"] { font-size: 20px; margin-top: 2px; flex-shrink: 0; }
.save-info > div { flex-grow: 1; }
.save-info .title { font-weight: bold; margin-bottom: 4px; font-size: var(--font-size-md); }
.save-info .desc { font-size: var(--font-size-sm); color: var(--color-text-muted); line-height: 1.4; }
.connection-warning.save-info { background: var(--color-error-a10); border-color: var(--color-error-a30); color: var(--color-error-a90); }
.connection-warning.save-info strong { color: var(--color-error-a90); }
.preview-banner.save-info { background: var(--color-warning-a10); border-color: var(--color-warning-a30); }
.preview-banner.save-info .title { color: var(--color-warning-a90); }
.preview-banner.save-info span[aria-hidden="true"] { color: var(--color-warning-a90); }
.visitor-banner.save-info { background: var(--color-primary-a05); border-color: var(--color-primary-a30); }
.visitor-banner.save-info .title { color: var(--color-primary); }
.visitor-banner.save-info span[aria-hidden="true"] { color: var(--color-primary); }

.btn { display: inline-block; padding: var(--space-sm) var(--space-md); border: 1px solid transparent; border-radius: var(--radius-sm); font-weight: bold; text-align: center; cursor: pointer; transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease; }
.btn:disabled { cursor: not-allowed; opacity: 0.6; }
.btn-block { display: block; width: 100%; }
.btn-save { background-color: var(--color-primary); border-color: var(--color-primary); color: var(--color-bg-dark); }
.btn-save:not(:disabled):hover { background-color: var(--color-primary-a70); border-color: var(--color-primary-a70); }
.btn-secondary { background-color: var(--color-bg-light); border-color: var(--color-border); color: var(--color-text); }
.btn-secondary:not(:disabled):hover { background-color: var(--color-primary-a05); border-color: var(--color-primary-a30); }
.btn-outline { background-color: transparent; border: 1px solid var(--color-primary-a30); color: var(--color-primary-a70); }
.btn-outline:not(:disabled):hover { background-color: var(--color-primary-a05); border-color: var(--color-primary-a70); }
.btn-link { background: none; border: none; padding: 0; color: var(--color-primary); cursor: pointer; text-decoration: none; }
.btn-link:hover:not(:disabled) { text-decoration: underline; }
.btn-link:disabled { color: var(--color-text-muted); cursor: not-allowed; text-decoration: none; }
.btn-icon { background: none; border: none; padding: 2px 5px; cursor: pointer; line-height: 1; }
.btn-icon:disabled { cursor: not-allowed; opacity: 0.5; }

.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0; }

/* --- NEW STYLES ADDED FOR REFACTORED SAVE PANEL --- */
.scene-main-content {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-grow: 1;
  overflow: hidden;
}

.default-scene-tag {
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  font-weight: bold;
  background-color: var(--color-primary-a15);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.scene-actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-shrink: 0;
}

.scene-actions .btn-icon {
  font-size: 1.2em;
  color: var(--color-text-muted);
  transition: color 0.2s ease, transform 0.2s ease;
}

.scene-actions .btn-icon:hover:not(:disabled) {
  color: var(--color-primary);
  transform: scale(1.1);
}

.scene-actions .btn-icon[title*="Default"]:hover:not(:disabled) {
  color: var(--color-warning);
}
/* --- END NEW STYLES --- */
```

---
### `src\components\Panels\PanelStyles\Eventspanel.css`
```css
@import "../../../styles/variables.css";

.events-panel-custom-scroll .section-title {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  margin-bottom: var(--space-sm);
  text-transform: uppercase;
  opacity: 0.9;
  font-weight: 600;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-xs);
}

.events-panel-custom-scroll .form-help-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.4;
  margin-bottom: var(--space-md);
}

/* Target options specifically within this panel's selects */
.events-panel-custom-scroll .custom-select option {
  background-color: var(--color-bg-dark, #050f19);
  color: var(--color-primary);
  padding: var(--space-xs) var(--space-sm);
}
/* Style for the select element itself when opened (browser dependent) */
.events-panel-custom-scroll .custom-select {
    background-color: var(--color-bg-alt);
}
.events-panel-custom-scroll .custom-select:focus {
   background-color: var(--color-bg-dark);
   border-color: var(--color-primary-a50);
}

.reaction-form.section-box {
  margin-bottom: var(--space-lg);
}

.color-config-section {
  background: var(--color-primary-a05);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  margin-top: var(--space-md);
  margin-bottom: var(--space-md);
}

.config-section-title {
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  margin-bottom: var(--space-sm);
  text-transform: uppercase;
  opacity: 0.8;
  font-weight: 500;
}

.color-preview-container {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.color-preview-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.color-preview {
  height: 25px;
  flex-grow: 1;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.2);
}

/* UPDATED STYLES FOR SLIDER SPACING */
.color-config-section .slider-group { /* Targets slider groups specifically within color-config-section */
  display: flex;
  flex-direction: column;
  gap: 2px; /* Reduced gap between slider containers */
}
.color-config-section .slider-container { /* Targets slider containers specifically within color-config-section */
  margin-bottom: 0px; /* Removed bottom margin from individual slider containers */
}

.color-config-section .slider-header { /* Targets slider headers specifically within color-config-section */
  /* This overrides the global .slider-header margin if needed, or complements it */
  margin-bottom: 2px; /* Reduced space between header and the input */
}

.color-config-section input[type="range"].color-slider { /* Targets color sliders specifically */
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  cursor: pointer;
  outline: none;
  margin-top: 2px; /* Reduced space above the slider input */
}
/* END UPDATED STYLES FOR SLIDER SPACING */


input[type="range"].color-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--color-primary);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 4px rgba(var(--color-primary-rgb), 0.5);
  margin-top: -4px; /* This helps vertically center the thumb on the track */
}
input[type="range"].color-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: var(--color-primary);
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 0 4px rgba(var(--color-primary-rgb), 0.5);
}

input[type="range"].red-slider { background: linear-gradient(to right, #000000, #ff0000); }
input[type="range"].green-slider { background: linear-gradient(to right, #000000, #00ff00); }
input[type="range"].blue-slider { background: linear-gradient(to right, #000000, #0000ff); }
input[type="range"].alpha-slider { background: linear-gradient( to right, rgba(var(--color-primary-rgb), 0), var(--color-primary) ); }

.active-reactions.section-box {
  margin-top: var(--space-lg);
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-md);
}

.no-reactions {
  color: var(--color-primary-a50);
  font-style: italic;
  font-size: var(--font-size-sm);
  text-align: center;
  padding: var(--space-sm);
}

.reactions-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  max-height: 200px;
  overflow-y: auto;
  /* Custom Scrollbar */
  scrollbar-width: thin;
  scrollbar-color: var(--color-primary-a30) rgba(0, 0, 0, 0.1);
}
.reactions-list::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.reactions-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}
.reactions-list::-webkit-scrollbar-thumb {
  background-color: var(--color-primary-a30);
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}
.reactions-list::-webkit-scrollbar-thumb:hover {
  background-color: var(--color-primary-a50);
}

.reaction-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-primary-a05);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-sm);
  transition: all var(--transition-fast);
}

.reaction-item:hover {
  background: var(--color-primary-a15);
}

.reaction-details {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-grow: 1;
  overflow: hidden;
}

.reaction-event {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: bold;
  white-space: nowrap;
}

.reaction-effect-type {
  color: var(--color-primary-a70);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.color-pill {
  display: inline-block;
  min-width: 12px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  vertical-align: middle;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}

.btn-preview,
.btn-save-reaction {
  flex-grow: 1;
  font-size: var(--font-size-sm);
}

.save-hint,
.read-only-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-align: center;
  margin-top: var(--space-md);
  padding: var(--space-xs);
  background-color: var(--color-primary-a05);
  border-radius: var(--radius-sm);
}

.status-message {
  padding: var(--space-xs);
  margin-top: var(--space-sm);
  border-radius: var(--radius-sm);
  text-align: center;
  font-size: var(--font-size-xs);
}

.preview-status {
  color: var(--color-info-a90, lightblue);
}

.save-status.error {
  color: var(--color-error-a90);
  background-color: var(--color-error-a10);
}

.save-status.success {
  color: var(--color-success-a90);
  background-color: var(--color-success-a10);
}
```

---
### `src\components\Panels\PanelStyles\InfoOverlay.css`
```css
@import "../../../styles/variables.css";

.overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: var(--z-overlay); background-color: rgba(0, 0, 0, 0.8); backdrop-filter: blur(var(--blur-amount)); -webkit-backdrop-filter: blur(var(--blur-amount)); display: flex; justify-content: center; align-items: center; transition: background-color var(--transition-slow), backdrop-filter var(--transition-slow);
}

.overlay-content {
  width: 90%; max-width: 900px; height: 85vh; background: var(--color-glass-bg-dark); border: 1px solid var(--color-border); border-radius: var(--radius-xl); overflow: hidden; position: relative; box-shadow: var(--shadow-primary-lg); transition: transform var(--transition-slow), opacity var(--transition-slow); display: flex; flex-direction: column;
}

.overlay-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-border);
  z-index: 10;
  flex-shrink: 0;
}

.overlay-title {
  margin: 0;
  line-height: 1;
  display: flex;
  align-items: center;
}

.radar-logo-image {
  display: block;
  height: 60px;
  width: auto;
  position: relative;
  left: 10px;
  opacity: 0.55;
}

.close-button {
  background: none; border: none; color: var(--color-primary); font-size: var(--font-size-xl); cursor: pointer; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; transition: all var(--transition-fast); padding: 0; margin: 0; flex-shrink: 0;
}
.close-button:hover { opacity: 0.8; transform: scale(1.1); }

.overlay-body {
  flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 0; align-items: stretch; min-height: 0; width: 100%;
}

/* Tab Navigation specific to Info Overlay */
.info-overlay-tab-navigation {
  display: flex;
  flex-wrap: nowrap;
  justify-content: flex-start;
  padding: var(--space-md) 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
  overflow-y: hidden;
  flex-shrink: 0;
  align-items: center;
  min-width: 0;
  box-sizing: border-box;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none;  /* IE and Edge */
}
.info-overlay-tab-navigation::-webkit-scrollbar {
  display: none; /* Safari and Chrome */
  height: 0;
  width: 0;
}
.info-overlay-tab-navigation {
  mask-image: linear-gradient(to right, transparent 0%, black var(--space-lg), black calc(100% - var(--space-lg)), transparent 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 0%, black var(--space-lg), black calc(100% - var(--space-lg)), transparent 100%);
}

/* Tab Button specific to Info Overlay */
.info-overlay-tab-button {
  background: transparent;
  border: 1px solid transparent;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  margin: 0 2px;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  font-weight: 500;
  flex-shrink: 0;
  line-height: 1.2;
}
.info-overlay-tab-button:first-child {
    margin-left: var(--space-lg);
}
.info-overlay-tab-button:last-child {
    margin-right: var(--space-lg);
}
.info-overlay-tab-button:hover {
  background: var(--color-primary-a05);
  color: var(--color-primary-a90);
  border-color: var(--color-primary-a15);
}
.info-overlay-tab-button.active {
  background: var(--color-primary-a15);
  color: var(--color-primary);
  border-color: var(--color-primary-a30);
  box-shadow: var(--shadow-primary-sm);
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg) var(--space-lg);
  padding-right: calc(var(--space-lg) - 8px); /* Adjust for scrollbar */
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--color-primary-a30) rgba(0, 0, 0, 0.1);
  /* --- ADDED: Prevent scroll chaining from info overlay content --- */
  overscroll-behavior: contain;
  /* -------------------------------------------------------------- */
}
.tab-content::-webkit-scrollbar { width: 8px; height: 8px; }
.tab-content::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 4px; }
.tab-content::-webkit-scrollbar-thumb { background: var(--color-primary-a30); border-radius: 4px; }
.tab-content::-webkit-scrollbar-thumb:hover { background: var(--color-primary-a50); }

.tab-pane { padding-bottom: var(--space-lg); }
.tab-pane h3 { color: var(--color-primary); font-size: var(--font-size-lg); margin-top: 0; border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-sm); margin-bottom: var(--space-lg); font-weight: 600; }
.tab-pane h4 { color: var(--color-primary-a90); font-size: 1.1em; margin-top: var(--space-lg); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-xs); margin-bottom: var(--space-md); font-weight: 600; }
.tab-pane p { color: var(--color-text); line-height: 1.7; margin-bottom: var(--space-md); font-size: 12px; }
.tab-pane ul { list-style: none; padding-left: 0; margin-bottom: var(--space-md); }
.tab-pane li { margin-bottom: var(--space-sm); line-height: 1.6; color: var(--color-text); position: relative; padding-left: var(--space-md); font-size: 12px; }
.tab-pane li::before { content: '◆'; position: absolute; left: 0; top: 1px; color: var(--color-primary-a50); font-size: 0.8em; }
.tab-pane strong { color: var(--color-primary-a90); font-weight: 600; }
.tab-pane code { background-color: var(--color-primary-a05); color: var(--color-primary-a90); padding: 2px 4px; border-radius: var(--radius-sm); font-family: monospace; font-size: 0.9em; }
.info-card { background: var(--color-primary-a05); border: 1px solid var(--color-primary-a15); border-radius: var(--radius-md); padding: var(--space-md); margin-top: var(--space-lg); margin-bottom: var(--space-lg); }
.info-card h4 { color: var(--color-primary); margin-top: 0; margin-bottom: var(--space-sm); font-size: var(--font-size-md); border-bottom: none; padding-bottom: 0; font-weight: 600; }
.info-card p, .info-card li { font-size: 12px; color: var(--color-text); margin-bottom: var(--space-sm); }
.info-card p:last-child, .info-card ul:last-child { margin-bottom: 0; }
.info-card ul { margin-top: var(--space-sm); }
.info-card li::before { content: '—'; left: 2px; color: var(--color-primary-a70); }

.overlay {
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease-out, visibility 0s linear 0.3s;
}

.overlay.fadeToContent {
  opacity: 1;
  visibility: visible;
  transition: opacity 0.3s ease-in, visibility 0s linear 0s;
}

.overlay.exiting {
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease-out, visibility 0s linear 0.3s;
}

.overlay-content {
  transition: transform 0.3s ease-out, opacity 0.3s ease-out;
}

.overlay.exiting .overlay-content {
  transform: scale(0.98);
  opacity: 0;
  transition: transform 0.3s ease-out, opacity 0.3s ease-out;
}
```

---
### `src\components\Panels\PanelStyles\LibraryPanel.css`
```css
/* src/components/Panels/PanelStyles/LibraryPanel.css */
@import "../../../styles/variables.css";

/* Apply flex layout directly to the panel to space out its direct children */
.library-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

/* Base styling for section boxes within the panel */
.library-panel .section-box {
  background: var(--color-primary-a05);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

/* "Owner Mode" header styling (this is not a section-box, so style separately) */
.library-panel .admin-header {
  background: var(--color-success-a10);
  border: 1px solid var(--color-success-a30);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.library-panel .admin-badge {
  display: inline-block;
  background: var(--color-success-a30);
  color: var(--color-success-a90);
  font-size: var(--font-size-xs);
  font-weight: bold;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-xs);
}

.library-panel .admin-description {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  margin: 0;
  line-height: 1.4;
}

/* Section titles ("Add New Collection", "Current Library Collections") */
.library-panel .section-title {
  margin-top: 0;
  margin-bottom: var(--space-md);
  color: var(--color-primary);
  font-size: var(--font-size-md);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Error message styling */
.library-panel .status-message.error {
  background: var(--color-error-a10);
  border: 1px solid var(--color-error-a30);
  color: var(--color-error-a90);
  padding: var(--space-sm);
  border-radius: var(--radius-sm);
  text-align: center;
}

/* Consistent input styling */
.library-panel .form-control {
  background-color: var(--color-bg-inset);
}

/* Messages for empty/loading states */
.library-panel .loading-message,
.library-panel .empty-message {
  text-align: center;
  padding: var(--space-md);
  color: var(--color-text-muted);
  font-style: italic;
}

/* Grid for displaying collections */
.library-panel .collections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-md);
}

/* Individual collection card styling */
.library-panel .collection-card {
  background: rgba(0,0,0,0.2);
  border: 1px solid var(--color-border-dark);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: all var(--transition-fast);
  position: relative;
  display: flex;
  flex-direction: column;
}
.library-panel .collection-card:hover {
  border-color: var(--color-primary-a30);
  transform: translateY(-2px);
  box-shadow: var(--shadow-primary-sm);
}

.library-panel .collection-image {
  width: 100%;
  padding-bottom: 56.25%; /* 16:9 Aspect Ratio */
  height: 0;
  position: relative;
  background: var(--color-bg);
}

.library-panel .collection-image img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.library-panel .collection-info {
  padding: var(--space-sm);
  flex-grow: 1;
}

.library-panel .collection-name {
  font-size: var(--font-size-md);
  color: var(--color-primary);
  margin: 0 0 var(--space-xs) 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.library-panel .collection-address {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-family: monospace;
}

.library-panel .remove-button {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid var(--color-error-a50);
  color: var(--color-error-a90);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: all var(--transition-fast);
  z-index: 5;
}

.library-panel .remove-button:hover {
  background: var(--color-error-a30);
  transform: scale(1.1);
}
```

---
### `src\components\Panels\PanelStyles\NotificationPanel.css`
```css
.notification-empty {
  text-align: center;
  padding: 15px 0;
  color: var(--color-primary-a50);
  font-style: italic;
  font-size: var(--font-size-sm);
}

.panel-header-actions {
  margin-bottom: var(--space-md);
  display: flex;
  justify-content: flex-end;
}

.btn-clear-all {
  background: var(--color-error-a10);
  color: var(--color-error-a90);
  border-color: var(--color-error-a30);
}
.btn-clear-all:hover:not(:disabled) {
  background: var(--color-error-a30);
  color: var(--color-text);
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.notification-item {
  padding: var(--space-sm);
  background: var(--color-primary-a05);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-primary-a30);
  transition: all var(--transition-fast);
  cursor: pointer;
}

.notification-item:hover {
  background: var(--color-primary-a15);
  transform: translateY(-2px);
}

.notification-item.new {
  border-left-color: var(--color-error, #ff5555);
  background: var(--color-error-a05, rgba(255, 85, 85, 0.05));
  animation: highlight-new 2s ease-out;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-xs);
}

.notification-timestamp {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.notification-type-tag {
  font-size: var(--font-size-xs);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  text-transform: uppercase;
  font-weight: bold;
}

.notification-type-tag.lyx {
  background: var(--color-lyx-a20);
  color: var(--color-lyx);
}

.notification-type-tag.token {
  background: var(--color-token-a20);
  color: var(--color-token);
}

.notification-type-tag.contract {
  background: var(--color-contract-a20);
  color: var(--color-contract);
}

.notification-type-tag.social {
  background: rgba(138, 43, 226, 0.2); /* Example: Purple */
  color: #9370db; /* Example: Medium Purple */
}

.notification-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.notification-message {
  font-size: var(--font-size-sm);
  flex: 1;
  color: var(--color-text);
  line-height: 1.4;
}
```

---
### `src\components\Panels\PanelStyles\PanelStyles.css`
```css
@import "../../../styles/variables.css";

.panel {
  /* --- FINAL UPDATE FOR CONSISTENT GLASSMORPHISM --- */
  background: var(--color-glass-bg-dark);      /* Use the dark, semi-transparent overlay background */
  border: 1px solid var(--color-border);           /* Use the softer, standard border color */
  border-radius: var(--radius-xl);             /* Use the larger radius from overlays for a softer look */
  backdrop-filter: blur(50px);                 /* Increase blur for a more pronounced glass effect */
  -webkit-backdrop-filter: blur(50px);
  box-shadow: var(--shadow-primary-lg);        /* Apply the signature blue glow from the overlays */
  /* --- END FINAL UPDATE --- */
  
  color: var(--color-text);
  overflow: hidden;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  transition: none !important;
  /* Removed the problematic 'border-top: !important' */
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: rgba(0, 243, 255, 0.05);
  border-bottom: 1px solid rgba(0, 243, 255, 0.15);
  border-top: none !important;
  box-shadow: none !important;
  position: relative;
}

.panel-header:before,
.panel-header:after {
  display: none !important;
}

.panel-title {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-primary);
  letter-spacing: 0.8px;
  text-transform: uppercase;
}

.close-button {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
  font-size: 16px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  padding: 0;
}

.close-button:hover {
  background: rgba(0, 243, 255, 0.1);
}

.panel-content {
  padding: 15px;
  overflow-y: auto;
  flex: 1;
  overscroll-behavior: contain;
}
```

---
### `src\components\Panels\PanelStyles\PanelWrapper.css`
```css
/* PanelWrapper.css */
.panel-wrapper {
  position: fixed;
  top: 5px;
  left: -20px;
  z-index: 1000;
  max-height: 90vh;
  animation: panel-slide-in 0.5s ease-out forwards;
  overflow: visible;
  border: none !important;
  outline: none !important;
}

.panel-wrapper.panel-from-toolbar {
  /* Styles for panels originating from toolbar, if any, would go here */
}

.panel-wrapper.animating.closing {
  animation: panel-slide-out 0.5s ease-in forwards;
}

@keyframes panel-slide-in {
  from {
    opacity: 0;
    transform: translateX(-150px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes panel-slide-out {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(-150px);
  }
}
```

---
### `src\components\Panels\PanelStyles\PLockController.css`
```css
.plock-controls-container {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) 0;
  margin-bottom: var(--space-sm);
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.plock-button {
  flex-shrink: 0;
  font-weight: bold;
  font-size: var(--font-size-sm);
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 1px solid var(--color-border);
  min-width: 70px; /* Ensure consistent width */
  text-align: center;
}

.plock-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* IDLE State */
.plock-button.plock-record-button.idle {
  background-color: var(--color-primary-a05);
  color: var(--color-text-muted);
}
.plock-button.plock-record-button.idle:hover:not(:disabled) {
  background-color: var(--color-error-a10);
  border-color: var(--color-error-a30);
  color: var(--color-error);
}

/* ARMED State */
.plock-button.plock-record-button.armed {
  background-color: var(--color-error-a30);
  color: var(--color-error);
  border-color: var(--color-error-a50);
  animation: plock-pulse 1.5s infinite;
}

@keyframes plock-pulse {
  0% { box-shadow: 0 0 0 0 rgba(var(--color-error-rgb), 0.4); }
  70% { box-shadow: 0 0 0 8px rgba(var(--color-error-rgb), 0); }
  100% { box-shadow: 0 0 0 0 rgba(var(--color-error-rgb), 0); }
}

/* PLAYING State */
.plock-button.plock-record-button.playing {
  background-color: var(--color-primary-a15);
  color: var(--color-primary);
  border-color: var(--color-primary-a30);
}

/* CLEAR Button */
.plock-button.plock-clear-button {
  background-color: var(--color-primary-a05);
  color: var(--color-text-muted);
}
.plock-button.plock-clear-button:hover:not(:disabled) {
  background-color: var(--color-primary-a15);
  color: var(--color-primary);
}

/* PROGRESS BAR */
.plock-progress-bar-container {
  flex-grow: 1;
  height: 8px;
  background-color: var(--color-bg-inset);
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--color-border-dark);
}

.plock-progress-bar {
  width: 100%;
  height: 100%;
  transform-origin: left;
}

.speed-selector {
  display: flex;
  justify-content: space-between;
  gap: var(--space-xs);
  margin-bottom: var(--space-sm);
}

.speed-button {
  flex-grow: 1;
  font-weight: bold;
  font-size: var(--font-size-sm);
  padding: 4px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 1px solid var(--color-border);
  background-color: var(--color-primary-a05);
  color: var(--color-text-muted);
}

.speed-button:hover:not(:disabled) {
  background-color: var(--color-primary-a15);
  color: var(--color-primary);
  border-color: var(--color-primary-a30);
}

.speed-button.active {
  background-color: var(--color-primary-a30);
  color: var(--color-primary);
  border-color: var(--color-primary-a50);
  box-shadow: var(--shadow-primary-sm);
}

.speed-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* --- NEW ANIMATION FOR THE ARMED STATE PROGRESS BAR --- */
@keyframes plock-pulse-bar {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}

.plock-midi-map {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    margin-top: var(--space-sm);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--color-border);
}

.plock-midi-map .midi-mapping-text {
    font-size: var(--font-size-xs);
    color: var(--color-text-dim);
    background: var(--color-bg-alt);
    padding: 2px 4px;
    border-radius: var(--radius-sm);
}
```

---
### `src\components\Panels\PanelStyles\SetsPanel.css`
```css
/* src/components/Panels/PanelStyles/SetsPanel.css */
@import "../../../styles/variables.css";

.sets-panel .config-section {
  margin-bottom: var(--space-lg);
}

.sets-panel h3 {
  margin-top: 0;
  margin-bottom: var(--space-md);
  color: var(--color-primary);
  font-size: var(--font-size-md);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sets-panel .form-help-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: 1.5;
  margin-top: var(--space-xs);
  margin-bottom: 0;
}

.sets-panel .workspace-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-bg-inset);
  scrollbar-width: thin;
  scrollbar-color: var(--color-primary-a30) rgba(0, 0, 0, 0.1);
}

.sets-panel .workspace-list::-webkit-scrollbar { width: 6px; }
.sets-panel .workspace-list::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.1); }
.sets-panel .workspace-list::-webkit-scrollbar-thumb { background-color: var(--color-primary-a30); border-radius: 3px; }
.sets-panel .workspace-list::-webkit-scrollbar-thumb:hover { background-color: var(--color-primary-a50); }

.sets-panel .workspace-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border-dark);
  gap: var(--space-sm);
}
.sets-panel .workspace-list li:last-child { border-bottom: none; }

.sets-panel .workspace-list li.active {
  background-color: var(--color-primary-a15);
}
.sets-panel .workspace-list li.active .workspace-name {
  font-weight: bold;
  color: var(--color-primary);
}

.workspace-main-content {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-grow: 1;
  overflow: hidden;
}

.workspace-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--font-size-md);
  color: var(--color-text);
}

.workspace-rename-form {
  display: flex;
  flex-grow: 1;
  gap: var(--space-sm);
}

.workspace-rename-input {
  flex-grow: 1;
  padding: 4px 8px;
  background-color: var(--color-bg-inset-dark);
  border: 1px solid var(--color-primary);
  color: var(--color-text);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
}

.default-workspace-tag {
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  font-weight: bold;
  background-color: var(--color-primary-a15);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.workspace-actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-shrink: 0;
}

.workspace-actions .btn-icon {
  font-size: 1.2em;
  color: var(--color-text-muted);
  transition: color 0.2s ease, transform 0.2s ease;
}

.workspace-actions .btn-icon:hover:not(:disabled) {
  color: var(--color-primary);
  transform: scale(1.1);
}

.workspace-actions .btn-icon[title*="Default"]:hover:not(:disabled) {
  color: var(--color-warning);
}

.workspace-actions .btn-icon.delete-action:hover:not(:disabled) {
  color: var(--color-error);
}

.no-workspaces-message {
  font-style: italic;
  color: var(--color-text-muted);
  margin-top: var(--space-md);
  padding: var(--space-sm);
  text-align: center;
  background-color: var(--color-primary-a05);
  border-radius: var(--radius-sm);
}
```

---
### `src\components\Panels\PanelStyles\TokenSelectorOverlay.css`
```css
@import "../../../styles/variables.css";

/* ==========================================================================
   NON-BLOCKING TOKEN SELECTOR OVERLAY
   ========================================================================== */

.overlay.token-selector-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: var(--z-overlay);
  background-color: rgba(0, 0, 0, 0);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateZ(0);
  transition: opacity 300ms ease-out, background-color 300ms ease-out, visibility 0s linear 300ms;
}

.overlay.token-selector-overlay.visible {
  opacity: 1;
  visibility: visible;
  transition: opacity 300ms ease-out, background-color 300ms ease-out, visibility 0s linear 0s;
}

.overlay.token-selector-overlay.state-opening {
  background-color: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  pointer-events: auto;
}

.overlay.token-selector-overlay.state-content {
  background-color: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  pointer-events: auto;
}

.overlay.token-selector-overlay.state-exiting {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  background-color: rgba(0, 0, 0, 0);
  backdrop-filter: blur(0px);
  -webkit-backdrop-filter: blur(0px);
  transition: opacity 300ms ease-out, background-color 300ms ease-out, backdrop-filter 300ms ease-out, visibility 0s linear 300ms;
}

/* Preview mode - fade overlay to show background */
.overlay.token-selector-overlay.preview-mode {
  opacity: 0.1 !important;
  transition: opacity 150ms ease-out !important;
}

.overlay.token-selector-overlay.preview-mode .overlay-content {
  opacity: 0.1 !important;
  transition: opacity 150ms ease-out !important;
}

/* ==========================================================================
   OVERLAY CONTENT
   ========================================================================== */

.overlay.token-selector-overlay .overlay-content {
  width: 90%;
  max-width: 900px;
  height: 80vh;
  background: var(--color-glass-bg-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
  position: relative;
  box-shadow: var(--shadow-primary-lg);
  display: flex;
  flex-direction: column;
  opacity: 0;
  transform: scale(0.95) translateY(20px);
  transform-origin: center center;
  transition: opacity 300ms ease-out, transform 300ms ease-out;
}

.overlay.token-selector-overlay.state-content .overlay-content {
  opacity: 1;
  transform: scale(1) translateY(0);
}

.overlay.token-selector-overlay.state-exiting .overlay-content {
  opacity: 0;
  transform: scale(0.95) translateY(20px);
  transition:
    opacity 300ms ease-out,
    transform 300ms ease-out;
}

/* ==========================================================================
   HEADER
   ========================================================================== */

.token-selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 var(--space-md);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  background: rgba(var(--color-bg-rgb, 16, 16, 24), 0.7);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  height: 50px;
  position: relative;
  z-index: 20;
}

.header-center-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-grow: 1;
  padding: 0 var(--space-lg);
}

.layer-buttons {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: 3px;
}

.layer-button {
  width: 34px;
  height: 34px;
  background: var(--color-primary-a05);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.layer-button:hover {
  background: var(--color-primary-a15);
  border-color: var(--color-primary-a30);
}

.layer-button.active {
  background: var(--color-primary-a15);
  border-color: var(--color-primary-a50);
  box-shadow: var(--shadow-primary-sm);
}

.layer-button-icon {
  width: 20px;
  height: 20px;
  opacity: 0.8;
}

.layer-button:hover .layer-button-icon,
.layer-button.active .layer-button-icon {
  opacity: 1;
  filter: drop-shadow(0 0 3px var(--color-primary-a30));
}

.close-button {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  font-size: 18px;
  color: var(--color-primary-a70);
  border-radius: var(--radius-sm);
  background: none;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.close-button:hover {
  background: var(--color-primary-a15);
  color: var(--color-primary);
}

/* ==========================================================================
   BODY AND TOKEN AREAS
   ========================================================================== */

.overlay-body {
  padding: 0;
  display: flex;
  flex-direction: column;
  height: calc(100% - 50px);
  overflow: hidden;
}

.token-display-area {
  flex-grow: 1;
  overflow-y: auto;
  padding: var(--space-lg) var(--space-md);
  scrollbar-width: thin;
  scrollbar-color: var(--color-primary-a30) rgba(0, 0, 0, 0.1);
  scrollbar-gutter: stable;
}

.token-display-area::-webkit-scrollbar {
  width: 6px;
}

.token-display-area::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.token-display-area::-webkit-scrollbar-thumb {
  background: var(--color-primary-a30);
  border-radius: 3px;
}

.token-display-area::-webkit-scrollbar-thumb:hover {
  background: var(--color-primary-a50);
}

/* ==========================================================================
   TOKEN SECTIONS
   ========================================================================== */

.token-section {
  margin-bottom: var(--space-xl);
}

.token-section:last-child {
  margin-bottom: 0;
}

.token-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.1em;
  color: var(--color-primary-a70);
  margin: 0 0 var(--space-md) var(--space-xs);
  padding-bottom: var(--space-xs);
  border-bottom: 1px solid var(--color-border);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  font-weight: 500;
}

.token-section-header h3 {
  margin: 0;
  font-size: inherit;
  color: inherit;
  font-weight: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
}

/* ==========================================================================
   TOKEN GRID & ITEMS
   ========================================================================== */

.tokens-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 12px;
  padding: 8px;
}

.token-item {
  background: var(--color-primary-a05);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-xs);
  cursor: pointer;
  transition: all var(--transition-normal);
  text-align: center;
  width: 90px;
  height: 90px;
  display: flex;
  flex-direction: column;
  user-select: none;
  -webkit-user-select: none;
  margin: 4px;
  position: relative;
}

.token-item:hover {
  border-color: var(--color-primary-a50);
  background: var(--color-primary-a15);
  transform: translateY(-4px) scale(1.02);
  box-shadow: var(--shadow-sm);
  z-index: 10;
}

.token-item.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-a30);
  box-shadow: var(--shadow-primary-md);
}

.token-image-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background-color: rgba(0, 0, 0, 0.3);
}

.token-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-normal);
  pointer-events: none;
}

.token-item:hover .token-image {
  transform: scale(1.05);
}

/* ==========================================================================
   LOADING STATES AND SPINNERS
   ========================================================================== */

.loading-message {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-muted);
  font-style: italic;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-primary-a20);
  border-top: 3px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* ==========================================================================
   PALETTE & COLLECTION MANAGEMENT
   ========================================================================== */

.palette-section {
  background: rgba(0,0,0,0.2);
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-dark);
}
.create-palette-form {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}
.create-palette-form .form-control {
  flex-grow: 1;
}
.no-items-message {
  color: var(--color-text-muted);
  font-style: italic;
  text-align: center;
  padding: var(--space-md);
}
.collection-group {
  margin-bottom: var(--space-sm);
}
.collection-header {
  width: 100%;
  background: var(--color-primary-a05);
  border: 1px solid var(--color-border);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  text-align: left;
  color: var(--color-primary-a90);
  font-weight: 500;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.collection-header:hover {
  background: var(--color-primary-a15);
}
.collection-toggle-button {
  flex-grow: 1;
  background: none;
  border: none;
  color: inherit;
  font: inherit;
  text-align: left;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  padding: 0;
}
.delete-palette-btn {
  background: none;
  border: none;
  color: var(--color-error-a70);
  font-size: 1.2em;
  cursor: pointer;
  padding: 0 var(--space-xs);
  transition: color var(--transition-fast);
  flex-shrink: 0;
}
.delete-palette-btn:hover {
  color: var(--color-error);
}
.chevron {
  transition: transform var(--transition-fast);
  font-size: 1.2em;
}
.chevron.expanded {
  transform: rotate(90deg);
}
.add-to-palette-btn, .remove-from-palette-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0,0,0,0.6);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition-fast);
}
.token-item:hover .add-to-palette-btn,
.token-item:hover .remove-from-palette-btn {
  opacity: 1;
}
.add-to-palette-btn {
  color: var(--color-primary);
  border: 1px solid var(--color-primary-a30);
}
.add-to-palette-btn:hover {
  background: var(--color-primary-a30);
}
.remove-from-palette-btn {
  color: var(--color-error);
  border: 1px solid var(--color-error-a30);
}
.remove-from-palette-btn:hover {
  background: var(--color-error-a30);
}
.palette-modal-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: calc(var(--z-overlay) + 1);
}
.palette-modal-content {
  background: var(--color-bg-light);
  padding: var(--space-lg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  width: 90%;
  max-width: 300px;
}
.palette-modal-content h4 {
  margin-top: 0;
  color: var(--color-primary);
}
.palette-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  max-height: 50vh;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--color-primary-a30) rgba(0, 0, 0, 0.1);
  /* --- THIS IS THE FIX --- */
  padding: 0 var(--space-xs); /* Symmetrical padding */
}
.palette-list::-webkit-scrollbar {
  width: 6px;
}
.palette-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}
.palette-list::-webkit-scrollbar-thumb {
  background: var(--color-primary-a30);
  border-radius: 3px;
}
.palette-list::-webkit-scrollbar-thumb:hover {
  background: var(--color-primary-a50);
}

/* --- Styles for LazyLoadImage Component --- */
.lazy-image-container {
  width: 100%;
  height: 100%;
  position: relative;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.lazy-image-container .token-image {
  transition: opacity 300ms ease-in-out;
}

.placeholder-shimmer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    100deg,
    rgba(255, 255, 255, 0) 20%,
    rgba(255, 255, 255, 0.05) 50%,
    rgba(255, 255, 255, 0) 80%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite linear;
}

@keyframes shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

/* --- Styles for Loading Progress Bar --- */
.loading-progress-header {
  padding: var(--space-xs) var(--space-md);
  background: rgba(0,0,0,0.3);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.progress-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-xs);
  text-align: center;
}
.progress-bar-container {
  height: 4px;
  background: rgba(0,0,0,0.4);
  border-radius: 2px;
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 2px;
  transition: width 0.2s linear;
}

/* --- Styles for Sort Controls --- */
.sort-controls {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}
.sort-controls label {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  white-space: nowrap;
}
.custom-select-sm {
  padding: 2px 20px 2px 8px;
  font-size: var(--font-size-sm);
  background-position: right 6px center;
}
```

---
### `src\components\Panels\PanelWrapper.jsx`
```jsx
// src/components/Panels/PanelWrapper.jsx
import React from "react";
import PropTypes from "prop-types";
// Correct the import path to point to the PanelStyles subdirectory
import "./PanelStyles/PanelWrapper.css";

/**
 * @typedef {object} PanelWrapperProps
 * @property {string} [className=""] - Optional additional CSS class names to apply to the wrapper div.
 * @property {React.ReactNode} children - The panel content (typically a `Panel` component) to be rendered within this wrapper.
 * @property {React.CSSProperties} [style] - Optional inline styles to apply to the wrapper div.
 */

/**
 * PanelWrapper: A component designed to wrap individual panels (like `EnhancedControlPanel`, `NotificationPanel`).
 * It handles the positioning of the panel on the screen and applies slide-in/slide-out animations
 * using CSS keyframes defined in an accompanying CSS file.
 *
 * The animation durations have been modified as per the original comments.
 *
 * @param {PanelWrapperProps} props - The component's props.
 * @returns {JSX.Element} The rendered PanelWrapper component.
 */
const PanelWrapper = ({ className = "", children, style }) => {
  return (
    <div className={`panel-wrapper ${className}`} style={style}>
      {children}
    </div>
  );
};

PanelWrapper.propTypes = {
  /** Optional additional CSS class names for the wrapper. */
  className: PropTypes.string,
  /** The panel content to be rendered within this wrapper. */
  children: PropTypes.node.isRequired,
  /** Optional inline styles for the wrapper. */
  style: PropTypes.object,
};

export default PanelWrapper;
```

---
### `src\components\Panels\PLockController.jsx`
```jsx
// src/components/Panels/PLockController.jsx
import React from 'react';
import PropTypes from 'prop-types';
import './PanelStyles/PLockController.css';

const PLockController = ({
  pLockState = 'idle',
  loopProgress = 0,
  hasLockedParams = false,
  pLockSpeed = 'medium',
  onSetPLockSpeed,
  onTogglePLock,
}) => {
  const getRecordButtonText = () => {
    switch (pLockState) {
      case 'armed': return 'ARM ●';
      case 'playing': return 'STOP ■';
      case 'stopping': return '...';
      default: return 'REC';
    }
  };

  const getRecordButtonTitle = () => {
    switch (pLockState) {
      case 'armed': return 'Press again to capture snapshot and start playback.';
      case 'playing': return 'Stop playback and rest at the final recorded position.';
      case 'stopping': return 'Stopping and setting parameters to their final state...';
      default: return 'Arm sequencer to record parameter changes. Clears any previous recording.';
    }
  };

  const getProgressBarColor = () => {
    if (pLockState === 'armed') return 'var(--color-error)';
    if (pLockState === 'playing') return 'var(--color-primary)';
    if (pLockState === 'stopping') return 'var(--color-warning)';
    return 'transparent';
  };
  
  const isButtonDisabled = pLockState === 'stopping';

  return (
    <>
      <div className="speed-selector">
        <button disabled={pLockState !== 'idle'} className={`speed-button ${pLockSpeed === 'fast' ? 'active' : ''}`} onClick={() => onSetPLockSpeed('fast')} title="Fast Loop (4 seconds)">F</button>
        <button disabled={pLockState !== 'idle'} className={`speed-button ${pLockSpeed === 'medium' ? 'active' : ''}`} onClick={() => onSetPLockSpeed('medium')} title="Medium Loop (8 seconds)">M</button>
        <button disabled={pLockState !== 'idle'} className={`speed-button ${pLockSpeed === 'slow' ? 'active' : ''}`} onClick={() => onSetPLockSpeed('slow')} title="Slow Loop (12 seconds)">S</button>
      </div>
      <div className="plock-controls-container">
        <button className={`plock-button plock-record-button ${pLockState}`} onClick={onTogglePLock} title={getRecordButtonTitle()} disabled={isButtonDisabled}>
          {getRecordButtonText()}
        </button>
        <div className="plock-progress-bar-container">
          {(pLockState === 'playing' || pLockState === 'armed' || pLockState === 'stopping') && (
            <div
              className="plock-progress-bar"
              style={{
                transform: pLockState === 'playing' ? `scaleX(${loopProgress})` : 'scaleX(1)',
                backgroundColor: getProgressBarColor(),
                animation: pLockState === 'armed' ? 'plock-pulse-bar 1.5s infinite' : 'none',
                transition: 'background-color 0.2s ease',
              }}
            />
          )}
        </div>
      </div>
    </>
  );
};

PLockController.propTypes = {
  pLockState: PropTypes.oneOf(['idle', 'armed', 'playing', 'stopping']),
  loopProgress: PropTypes.number,
  hasLockedParams: PropTypes.bool,
  pLockSpeed: PropTypes.string,
  onSetPLockSpeed: PropTypes.func,
  onTogglePLock: PropTypes.func,
};

export default React.memo(PLockController);
```

---
### `src\components\Panels\SetsPanel.jsx`
```jsx
// src/components/Panels/SetsPanel.jsx
import React, { useState } from "react";
import PropTypes from "prop-types";

import Panel from "./Panel";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import { useUserSession } from "../../context/UserSessionContext";

import "./PanelStyles/SetsPanel.css";

const SetsPanel = ({ onClose }) => {
  const { canSaveToHostProfile } = useUserSession();
  const {
    stagedSetlist,
    activeWorkspaceName,
    loadWorkspace,
    createNewWorkspace,
    deleteWorkspaceFromSet,
    renameWorkspaceInSet,
    setDefaultWorkspaceInSet,
    isLoading,
    isSaving,
    preloadWorkspace, 
  } = useWorkspaceContext();

  const [editingName, setEditingName] = useState(null);
  const [newName, setNewName] = useState("");
  const canEdit = canSaveToHostProfile;

  const handleCreateClick = () => {
    const name = window.prompt("Enter a name for the new blank workspace:");
    if (name && name.trim()) {
      createNewWorkspace(name.trim());
    }
  };

  const handleRenameClick = (currentName) => {
    setEditingName(currentName);
    setNewName(currentName);
  };

  const handleRenameSubmit = (oldName) => {
    if (newName.trim() && newName.trim() !== oldName) {
      renameWorkspaceInSet(oldName, newName.trim());
    }
    setEditingName(null);
    setNewName("");
  };

  const handleLoadClick = (name) => {
    loadWorkspace(name);
    onClose();
  };

  const workspaces = stagedSetlist?.workspaces ? Object.entries(stagedSetlist.workspaces) : [];

  return (
    <Panel title="SETLIST MANAGEMENT" onClose={onClose} className="panel-from-toolbar sets-panel">
      <div className="config-section">
        <h3>Workspaces in this Setlist</h3>
        
        {canEdit && (
          <button 
            id="create-workspace-btn" // <-- ID ADDED HERE
            className="btn btn-block" 
            onClick={handleCreateClick} 
            disabled={isLoading || isSaving}
          >
            + Create New Workspace
          </button>
        )}
        
        <p className="form-help-text">
          Manage your collection of workspaces. Load one to start playing, or edit your setlist. Changes must be saved via the Save panel.
        </p>
        
        {workspaces.length > 0 ? (
          <ul className="workspace-list" style={{ marginTop: 'var(--space-md)' }}>
            {workspaces.map(([name, _data]) => (
              <li
                key={name}
                className={name === activeWorkspaceName ? "active" : ""}
                onMouseEnter={() => preloadWorkspace(name)}
              >
                <div className="workspace-main-content">
                  {editingName === name ? (
                    <form className="workspace-rename-form" onSubmit={(e) => { e.preventDefault(); handleRenameSubmit(name); }}>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onBlur={() => handleRenameSubmit(name)}
                        autoFocus
                        className="workspace-rename-input"
                      />
                    </form>
                  ) : (
                    <span className="workspace-name">{name}</span>
                  )}
                  {stagedSetlist?.defaultWorkspaceName === name && (
                    <span className="default-workspace-tag">(Default)</span>
                  )}
                </div>
                <div className="workspace-actions">
                  <button onClick={() => handleLoadClick(name)} className="btn-icon" title={`Load "${name}"`} disabled={isLoading || isSaving}>
                    ➔
                  </button>
                  {canEdit && (
                    <>
                      <button onClick={() => handleRenameClick(name)} className="btn-icon" title={`Rename "${name}"`} disabled={isSaving}>
                        ✏️
                      </button>
                      <button onClick={() => setDefaultWorkspaceInSet(name)} className="btn-icon" title="Set as Default" disabled={isSaving || stagedSetlist?.defaultWorkspaceName === name}>
                        ★
                      </button>
                      <button onClick={() => deleteWorkspaceFromSet(name)} className="btn-icon delete-action" title={`Delete "${name}"`} disabled={isSaving || workspaces.length <= 1}>
                        ×
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-workspaces-message" style={{ marginTop: 'var(--space-md)' }}>
            No workspaces found in this setlist.
          </p>
        )}
      </div>
    </Panel>
  );
};

SetsPanel.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default SetsPanel;
```

---
### `src\components\Panels\TokenGrid.jsx`
```jsx
// src/components/Panels/TokenGrid.jsx
import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import './PanelStyles/TokenSelectorOverlay.css';

const TokenGrid = ({ tokens, renderTokenItem, hasMore, onLoadMore, isLoading, scrollContainerRef }) => {
  const sentinelRef = useRef(null);
  const onLoadMoreRef = useRef(onLoadMore);

  // Keep the onLoadMore callback ref up to date
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  // This effect sets up the IntersectionObserver to watch the sentinel
  useEffect(() => {
    // --- FIX: Don't run the observer if there's no scroll container yet ---
    if (!hasMore || !sentinelRef.current || !scrollContainerRef?.current) return;

    // --- FIX: We now provide the scrollable container as the 'root' for the observer ---
    const options = {
      root: scrollContainerRef.current, // This tells the observer which scroll area to watch
      rootMargin: '200px', // Start loading when the sentinel is 200px away
      threshold: 0.01,
    };

    const observer = new IntersectionObserver(
      (entries) => {
        // isIntersecting is true when the sentinel enters the view of the `root`
        if (entries[0].isIntersecting && onLoadMoreRef.current) {
          onLoadMoreRef.current();
        }
      },
      options
    );

    const currentSentinel = sentinelRef.current;
    observer.observe(currentSentinel);

    return () => {
      observer.unobserve(currentSentinel);
    };
    // --- FIX: Add scrollContainerRef to the dependency array ---
  }, [hasMore, scrollContainerRef]);

  if (tokens.length === 0 && !hasMore && !isLoading) {
    return <p className="no-items-message">No tokens found in this collection.</p>;
  }

  return (
    // --- NOTE: We no longer need the outer scrollable div here, as it's in the parent ---
    <div className="tokens-grid">
      {tokens.map((token) => (
        <React.Fragment key={token.id}>
          {renderTokenItem(token)}
        </React.Fragment>
      ))}
      {hasMore && <div ref={sentinelRef} style={{ height: '1px', width: '100%' }} />}
      {isLoading && (
        <div className="loading-message" style={{ gridColumn: '1 / -1' }}>
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
};

TokenGrid.propTypes = {
  tokens: PropTypes.array.isRequired,
  renderTokenItem: PropTypes.func.isRequired,
  hasMore: PropTypes.bool.isRequired,
  onLoadMore: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  // --- FIX: Add the new prop for the scroll container ref ---
  scrollContainerRef: PropTypes.object,
};

export default React.memo(TokenGrid);
```

---
### `src\components\Panels\TokenSelectorOverlay.jsx`
```jsx
// src/components/Panels/TokenSelectorOverlay.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import PropTypes from "prop-types";
import { toplayerIcon, middlelayerIcon, bottomlayerIcon } from "../../assets";
import { demoAssetMap } from "../../assets/DemoLayers/initLayers";
import { manageOverlayDimmingEffect } from "../../utils/performanceHelpers";
import { globalAnimationFlags } from "../../utils/globalAnimationFlags";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import { useAssetContext } from "../../context/AssetContext";
import { useVisualEngineContext } from "../../context/VisualEngineContext";
import { useUserSession } from "../../context/UserSessionContext";
import TokenGrid from "./TokenGrid";
import LazyLoadImage from "./LazyLoadImage";
import "./PanelStyles/TokenSelectorOverlay.css";

const OPEN_CLOSE_ANIMATION_DURATION = 300;
const PAGE_SIZE = 40;

const TokenSelectorOverlay = ({ isOpen, onClose, readOnly = false }) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState(3);
  const [selectedTokens, setSelectedTokens] = useState({ 1: null, 2: null, 3: null });
  const [animationState, setAnimationState] = useState("hidden");
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [newPaletteName, setNewPaletteName] = useState("");
  const [paletteModalState, setPaletteModalState] = useState({ isOpen: false, token: null });
  const [expandedSections, setExpandedSections] = useState({});
  const [collectionSort, setCollectionSort] = useState('name');

  const [loadedTokens, setLoadedTokens] = useState({});
  const [collectionPages, setCollectionPages] = useState({});
  const [isLoadingMore, setIsLoadingMore] = useState({});
  const [hasMoreToLoad, setHasMoreToLoad] = useState({});

  const {
    stagedActiveWorkspace,
    addPalette, removePalette, addTokenToPalette, removeTokenFromPalette,
    configServiceRef,
  } = useWorkspaceContext();

  const {
    ownedTokenIdentifiers,
    tokenFetchProgress,
    officialWhitelist = [],
    refreshOwnedTokens, 
  } = useAssetContext();

  const { updateTokenAssignment } = useVisualEngineContext();

  const { visitorProfileAddress } = useUserSession();

  const isMountedRef = useRef(false);
  const hasFetchedInitialIdentifiers = useRef(false);
  const overlayContentRef = useRef(null);
  const tokenDisplayAreaRef = useRef(null);

  useEffect(() => {
    if (isOpen && !hasFetchedInitialIdentifiers.current) {
      if (import.meta.env.DEV) console.log("[TokenSelectorOverlay] Opened, triggering token identifier fetch.");
      refreshOwnedTokens();
      hasFetchedInitialIdentifiers.current = true;
    }
  }, [isOpen, refreshOwnedTokens]);

  const demoTokens = useMemo(() => {
    return Object.entries(demoAssetMap).map(([key, src]) => ({
      id: key, type: 'demo', metadata: { name: `Demo ${key.replace("DEMO_LAYER_", "Asset ")}`, image: src }
    }));
  }, []);

  const userPalettes = useMemo(() => stagedActiveWorkspace?.userPalettes || {}, [stagedActiveWorkspace]);

  const paletteTokens = useMemo(() => {
    const palettes = {};
    const combinedTokenMap = new Map();
    Object.values(loadedTokens).flat().forEach(t => combinedTokenMap.set(t.id, t));
    demoTokens.forEach(t => combinedTokenMap.set(t.id, t));

    if (userPalettes) {
      for (const paletteName in userPalettes) {
        palettes[paletteName] = userPalettes[paletteName]
          .map(tokenId => combinedTokenMap.get(tokenId))
          .filter(Boolean);
      }
    }
    return palettes;
  }, [loadedTokens, demoTokens, userPalettes]);
  
  const sortedCollectionLibrary = useMemo(() => {
    if (!Array.isArray(officialWhitelist)) return [];
    return [...officialWhitelist].sort((a, b) => {
      if (collectionSort === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (collectionSort === 'addedAt') {
        return (b.addedAt || 0) - (a.addedAt || 0);
      }
      return 0;
    });
  }, [officialWhitelist, collectionSort]);

  useEffect(() => {
    const initialHasMore = {};
    for (const collectionAddr in ownedTokenIdentifiers) {
      const totalIds = ownedTokenIdentifiers[collectionAddr]?.length || 0;
      const currentlyLoaded = loadedTokens[collectionAddr]?.length || 0;
      initialHasMore[collectionAddr] = currentlyLoaded < totalIds;
    }
    setHasMoreToLoad(initialHasMore);
  }, [ownedTokenIdentifiers, loadedTokens]);

  const loadMoreTokens = useCallback(async (collectionAddress) => {
    if (isLoadingMore[collectionAddress] || !hasMoreToLoad[collectionAddress] || !configServiceRef.current) {
        return;
    }

    setIsLoadingMore(prev => ({ ...prev, [collectionAddress]: true }));
    const currentPage = collectionPages[collectionAddress] || 0;
    const identifiers = ownedTokenIdentifiers[collectionAddress] || [];

    try {
        const newTokens = await configServiceRef.current.getTokensMetadataForPage(
            collectionAddress,
            identifiers,
            currentPage,
            PAGE_SIZE
        );
        
        if (isMountedRef.current) {
            if (newTokens.length > 0) {
                setLoadedTokens(prev => ({
                    ...prev,
                    [collectionAddress]: [...(prev[collectionAddress] || []), ...newTokens],
                }));
                setCollectionPages(prev => ({ ...prev, [collectionAddress]: currentPage + 1 }));
            }

            if (newTokens.length < PAGE_SIZE) {
                setHasMoreToLoad(prev => ({ ...prev, [collectionAddress]: false }));
            }
        }
    } catch (error) {
        console.error(`Failed to load more tokens for ${collectionAddress}:`, error);
    } finally {
        if (isMountedRef.current) {
            setIsLoadingMore(prev => ({ ...prev, [collectionAddress]: false }));
        }
    }
  }, [isLoadingMore, hasMoreToLoad, collectionPages, ownedTokenIdentifiers, configServiceRef]);

  const toggleSection = (sectionId) => {
    const isExpanding = !expandedSections[sectionId];
    setExpandedSections(prev => ({ ...prev, [sectionId]: isExpanding }));
    
    if (isExpanding && (!loadedTokens[sectionId] || loadedTokens[sectionId].length === 0)) {
      loadMoreTokens(sectionId);
    }
  };

  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);

  useEffect(() => {
    if (isOpen) {
      globalAnimationFlags.isTokenSelectorOpening = true;
      setAnimationState("opening");
      const openTimeout = setTimeout(() => {
        if (isMountedRef.current) { setInternalIsOpen(true); setAnimationState("content"); }
      }, 50);
      return () => clearTimeout(openTimeout);
    } else {
      globalAnimationFlags.isTokenSelectorOpening = false;
      setAnimationState("exiting");
      const closeTimeout = setTimeout(() => {
        if (isMountedRef.current) { setInternalIsOpen(false); setAnimationState("hidden"); }
      }, OPEN_CLOSE_ANIMATION_DURATION);
      return () => clearTimeout(closeTimeout);
    }
  }, [isOpen]);

  useEffect(() => {
    if (animationState === "opening" || animationState === "exiting") {
      const cancelDimming = manageOverlayDimmingEffect(OPEN_CLOSE_ANIMATION_DURATION + 100);
      return cancelDimming;
    }
  }, [animationState]);

  const handleClose = useCallback(() => { if (animationState === "exiting") return; onClose(); }, [onClose, animationState]);

  const handleTokenMouseDown = useCallback((token, e) => {
    if (e.button !== 0) return;
    const tokenImage = token.metadata?.image;
    if (!tokenImage || !updateTokenAssignment) return;
    updateTokenAssignment(token, selectedLayer);
    setSelectedTokens(prev => ({ ...prev, [selectedLayer]: tokenImage }));
    setIsPreviewMode(true);
  }, [updateTokenAssignment, selectedLayer]);

  const handleMouseUp = useCallback(() => { setIsPreviewMode(false); }, []);

  useEffect(() => {
    if (isPreviewMode) {
      const handleGlobalMouseUp = () => setIsPreviewMode(false);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isPreviewMode]);

  const handleCreatePalette = () => { const name = newPaletteName.trim(); if (name) { addPalette(name); setNewPaletteName(""); } };
  const handleRemovePalette = (paletteName) => { if (window.confirm(`Are you sure you want to delete the "${paletteName}" palette?`)) { removePalette(paletteName); } };
  const handleRemoveTokenFromPalette = (paletteName, tokenId) => { removeTokenFromPalette(paletteName, tokenId); };
  const handleAddToPaletteClick = (token) => { setPaletteModalState({ isOpen: true, token }); };
  const handleSelectPaletteForToken = (paletteName) => { if (paletteModalState.token) { addTokenToPalette(paletteName, paletteModalState.token.id); } setPaletteModalState({ isOpen: false, token: null }); };

  const renderTokenItem = useCallback((token, { onAddToPalette, onRemoveFromPalette, paletteName } = {}) => {
    const tokenImageSrc = token.metadata?.image ?? '';
    if (!tokenImageSrc) return null;
    return (
      <div className={`token-item ${selectedTokens[selectedLayer] === tokenImageSrc ? "selected" : ""}`} onMouseDown={(e) => handleTokenMouseDown(token, e)} onMouseUp={handleMouseUp} title={token.metadata.name}>
        <div className="token-image-container">
          <LazyLoadImage src={tokenImageSrc} alt={token.metadata.name} className="token-image" />
        </div>
        {onAddToPalette && (<button className="add-to-palette-btn" onClick={(e) => { e.stopPropagation(); onAddToPalette(token); }} onMouseDown={(e) => e.stopPropagation()} title="Add to Palette">+</button>)}
        {onRemoveFromPalette && paletteName && (<button className="remove-from-palette-btn" onClick={(e) => { e.stopPropagation(); onRemoveFromPalette(paletteName, token.id); }} onMouseDown={(e) => e.stopPropagation()} title="Remove from Palette">-</button>)}
      </div>
    );
  }, [selectedLayer, selectedTokens, handleTokenMouseDown, handleMouseUp]);

  const overlayClassName = `overlay token-selector-overlay ${internalIsOpen || animationState === 'exiting' ? 'visible' : ''} state-${animationState} ${isPreviewMode ? 'preview-mode' : ''}`;
  if (!isOpen && animationState === 'hidden') return null;

  return (
    <div className={overlayClassName} onClick={handleClose}>
      <div className="overlay-content" ref={overlayContentRef} onClick={(e) => e.stopPropagation()}>
        <div className="overlay-header token-selector-header">
          <div className="header-center-content">
            <div className="layer-buttons">
              <button className={`layer-button ${selectedLayer === 3 ? "active" : ""}`} onClick={() => setSelectedLayer(3)} title="Select Top Layer"><img src={toplayerIcon} alt="L3" className="layer-button-icon" /></button>
              <button className={`layer-button ${selectedLayer === 2 ? "active" : ""}`} onClick={() => setSelectedLayer(2)} title="Select Middle Layer"><img src={middlelayerIcon} alt="L2" className="layer-button-icon" /></button>
              <button className={`layer-button ${selectedLayer === 1 ? "active" : ""}`} onClick={() => setSelectedLayer(1)} title="Select Bottom Layer"><img src={bottomlayerIcon} alt="L1" className="layer-button-icon" /></button>
            </div>
          </div>
          <button className="close-button" onClick={handleClose} aria-label="Close token selector">✕</button>
        </div>
        <div className="overlay-body">
          {tokenFetchProgress.loading && ( <div className="loading-progress-header"><div className="progress-text">Loading Asset Libraries... ({tokenFetchProgress.loaded} / {tokenFetchProgress.total})</div><div className="progress-bar-container"><div className="progress-bar-fill" style={{ width: `${tokenFetchProgress.total > 0 ? (tokenFetchProgress.loaded / tokenFetchProgress.total) * 100 : 0}%` }}></div></div></div> )}
          <div className="token-display-area" ref={tokenDisplayAreaRef}>
            <div className="token-section palette-section">
              <div className="token-section-header"><h3>My Palettes</h3></div>
              <div className="create-palette-form"><input type="text" value={newPaletteName} onChange={(e) => setNewPaletteName(e.target.value)} placeholder="New Palette Name" className="form-control" /><button onClick={handleCreatePalette} className="btn btn-sm" disabled={!newPaletteName.trim()}>Create</button></div>
              {Object.keys(userPalettes).length > 0 ? (Object.keys(userPalettes).map(paletteName => (<div key={paletteName} className="collection-group"><div className="collection-header"><button onClick={() => toggleSection(paletteName)} className="collection-toggle-button">{paletteName} ({paletteTokens[paletteName]?.length || 0})<span className={`chevron ${expandedSections[paletteName] ? 'expanded' : ''}`}>›</span></button><button onClick={() => handleRemovePalette(paletteName)} className="delete-palette-btn" title={`Delete "${paletteName}" palette`}>🗑️</button></div>{expandedSections[paletteName] && (<TokenGrid scrollContainerRef={tokenDisplayAreaRef} tokens={paletteTokens[paletteName] || []} renderTokenItem={(token) => renderTokenItem(token, { onRemoveFromPalette: handleRemoveTokenFromPalette, paletteName })} hasMore={false} onLoadMore={()=>{}} isLoading={false} />)}</div>))) : <p className="no-items-message">Create a palette to organize tokens.</p>}
            </div>
            <div className="token-section">
              <div className="token-section-header"><h3>My Collections</h3><div className="sort-controls"><label htmlFor="collection-sort">Sort by:</label><select id="collection-sort" value={collectionSort} onChange={(e) => setCollectionSort(e.target.value)} className="custom-select custom-select-sm"><option value="name">Name</option><option value="addedAt">Date Added</option></select></div></div>
              {sortedCollectionLibrary.length > 0 ? (sortedCollectionLibrary.map(collection => (<div key={collection.address} className="collection-group"><button onClick={() => toggleSection(collection.address)} className="collection-header collection-toggle-button">{collection.name} ({(ownedTokenIdentifiers[collection.address]?.length || 0)})<span className={`chevron ${expandedSections[collection.address] ? 'expanded' : ''}`}>›</span></button>{expandedSections[collection.address] && (<TokenGrid scrollContainerRef={tokenDisplayAreaRef} tokens={loadedTokens[collection.address] || []} renderTokenItem={(token) => renderTokenItem(token, { onAddToPalette: handleAddToPaletteClick })} hasMore={hasMoreToLoad[collection.address] || false} onLoadMore={() => loadMoreTokens(collection.address)} isLoading={isLoadingMore[collection.address] || false} />)}</div>))) : <p className="no-items-message">{!visitorProfileAddress ? "Connect a profile to see your tokens." : "No collections found."}</p>}
            </div>
            <div className="token-section">
              <div className="collection-group"><button onClick={() => toggleSection('demo')} className="collection-header collection-toggle-button">Demo Tokens ({demoTokens.length})<span className={`chevron ${expandedSections['demo'] ? 'expanded' : ''}`}>›</span></button>{expandedSections['demo'] && (<TokenGrid scrollContainerRef={tokenDisplayAreaRef} tokens={demoTokens} renderTokenItem={(token) => renderTokenItem(token, { onAddToPalette: handleAddToPaletteClick })} hasMore={false} onLoadMore={()=>{}} isLoading={false} />)}</div>
            </div>
          </div>
        </div>
      </div>
      {paletteModalState.isOpen && (<div className="palette-modal-overlay" onClick={(e) => { e.stopPropagation(); setPaletteModalState({ isOpen: false, token: null }); }}><div className="palette-modal-content" onClick={(e) => e.stopPropagation()}><h4>Add to Palette</h4>{Object.keys(userPalettes).length > 0 ? (<div className="palette-list">{Object.keys(userPalettes).map(paletteName => (<button key={paletteName} onClick={() => handleSelectPaletteForToken(paletteName)} className="btn btn-block">{paletteName}</button>))}</div>) : <p>No palettes created yet.</p>}</div></div>)}
    </div>
  );
};

TokenSelectorOverlay.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  readOnly: PropTypes.bool
};

export default React.memo(TokenSelectorOverlay);
```

---
### `src\components\Toolbars\ToolbarStyles\TopRightControls.css`
```css
.top-right-controls-container {
  position: fixed;
  top: var(--space-lg);
  right: var(--space-lg);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  z-index: var(--z-controls); /* Ensure it's above other UI that might fade */
  width: fit-content;
  max-width: 100%;
  background: none;
  pointer-events: auto; /* This container should always be interactive */
}

.top-right-controls-container .toolbar-icon {
  width: var(--icon-size-lg);
  height: var(--icon-size-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-normal);
  background: rgba(0, 243, 255, 0.05);
  border: 1px solid rgba(0, 243, 255, 0.2);
  overflow: visible;
  position: relative;
  padding: 0;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  pointer-events: auto; /* Individual icons also need this */
}

.top-right-controls-container .toolbar-icon:hover {
  background: rgba(0, 243, 255, 0.15);
  border-color: rgba(0, 243, 255, 0.3);
  transform: translateY(-2px);
  box-shadow: var(--shadow-primary-sm);
}

/* --- NEW PARALLAX TOGGLE --- */
/* Style for any active button in this toolbar */
.top-right-controls-container .toolbar-icon.active {
  background: rgba(0, 243, 255, 0.15);
  border-color: rgba(0, 243, 255, 0.5);
  box-shadow: var(--shadow-primary-md);
}
/* --- END NEW PARALLAX TOGGLE --- */

.top-right-controls-container .icon-image {
  width: var(--icon-size-md);
  height: var(--icon-size-md);
  transition: all var(--transition-fast);
  opacity: 0.9;
}

.top-right-controls-container .toolbar-icon:hover .icon-image {
  opacity: 1;
  filter: drop-shadow(0 0 5px rgba(0, 243, 255, 0.3));
}

.enhanced-view-icon {
  font-size: 18px;
  color: var(--color-primary);
  transition: all var(--transition-fast);
}

.top-right-controls-container .toolbar-icon:hover .enhanced-view-icon {
  transform: scale(1.1);
  filter: drop-shadow(0 0 3px var(--color-primary-a30));
}

/* This class is added to top-right-controls-container by TopRightControls.jsx when isUiVisible is false */
.top-right-controls-container.ui-hidden .toolbar-icon:not(.fixed-toggle-button) {
  display: none !important; /* Hide other icons when UI is "hidden" */
}

/* Ensure the toggle button itself is always displayed correctly */
.top-right-controls-container .fixed-toggle-button {
  display: flex !important;
}

/* Styles for the toggle button when the rest of the UI is hidden */
.top-right-controls-container.ui-hidden .fixed-toggle-button.show-ui-btn {
  opacity: 0.7; /* Make it slightly less prominent if desired */
  background: rgba(0, 0, 0, 0.2); /* Example background */
  border-color: rgba(var(--color-primary-rgb), 0.4);
}
.top-right-controls-container.ui-hidden .fixed-toggle-button.show-ui-btn:hover {
  opacity: 1;
  background: rgba(var(--color-primary-rgb), 0.15);
}
```

---
### `src\components\Toolbars\ToolbarStyles\VerticalToolbar.css`
```css
.vertical-toolbar-icon {
  position: fixed;
  left: var(--space-lg);
  width: var(--icon-size-lg);
  height: var(--icon-size-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-normal);
  background: rgba(0, 243, 255, 0.05);
  border: 1px solid rgba(0, 243, 255, 0.2);
  overflow: visible;
  z-index: var(--z-controls);
  padding: 0;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.vertical-toolbar-icon:hover {
  background: rgba(0, 243, 255, 0.15);
  border-color: rgba(0, 243, 255, 0.3);
  transform: translateY(-2px);
  box-shadow: var(--shadow-primary-sm);
}

.vertical-toolbar-icon.active {
  background: rgba(0, 243, 255, 0.15);
  border-color: rgba(0, 243, 255, 0.5);
  box-shadow: var(--shadow-primary-md);
}

.vertical-toolbar-icon .icon-image {
  width: var(--icon-size-md);
  height: var(--icon-size-md);
  transition: all var(--transition-fast);
  opacity: 0.9;
}

.vertical-toolbar-icon:hover .icon-image,
.vertical-toolbar-icon.active .icon-image {
  opacity: 1;
  filter: drop-shadow(0 0 5px rgba(0, 243, 255, 0.3));
}

.vertical-toolbar-icon.active::after {
  content: "";
  position: absolute;
  top: -4px;
  left: -4px;
  right: -4px;
  bottom: -4px;
  border-radius: 10px;
  background: transparent;
  animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
  z-index: -1;
}

.vertical-toolbar-icon.active::before {
  content: "";
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border-radius: 30px;
  background: rgba(0, 243, 255, 0.15);
  animation: pulse-core 3s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
  z-index: -1;
}

.notification-orb {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notification-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  min-width: 16px;
  height: 16px;
  background: #ff3a3a;
  color: white;
  border-radius: 8px;
  font-size: 10px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  box-shadow: 0 0 5px rgba(255, 0, 0, 0.5);
  z-index: 10;
}

.bell-animation {
  animation: bell-pulse 2s infinite ease-in-out;
}

@keyframes bell-pulse {
  0% {
    transform: scale(1);
  }
  10% {
    transform: scale(1.1);
  }
  20% {
    transform: scale(1);
  }
  100% {
    transform: scale(1);
  }
}
```

---
### `src\components\Toolbars\TopRightControls.jsx`
```jsx
// src/components/Toolbars/TopRightControls.jsx
import React from "react";
import PropTypes from "prop-types";

import "./ToolbarStyles/TopRightControls.css";
import {
  whitelistIcon,
  enlargeIcon,
  learnIcon,
  eyeIcon,
  eyeopenIcon,
  parallaxIcon,
} from "../../assets";

const TopRightControls = ({
  isRadarProjectAdmin = false,
  onWhitelistClick,
  showInfo = true,
  showToggleUI = true,
  showEnhancedView = true,
  onInfoClick,
  onToggleUI,
  onEnhancedView,
  isUiVisible = true,
  isParallaxEnabled,
  onToggleParallax,
}) => {
  return (
    <div className={`top-right-controls-container ${!isUiVisible ? "ui-hidden" : ""}`}>
      {showEnhancedView && isUiVisible && (
        <button
          className="toolbar-icon"
          onClick={onEnhancedView}
          title="Toggle Fullscreen"
          aria-label="Toggle Fullscreen"
        >
          <img
            src={enlargeIcon}
            alt="Toggle Fullscreen"
            className="enhanced-view-icon icon-image"
          />
        </button>
      )}

      {isRadarProjectAdmin && isUiVisible && (
        <button
          className="toolbar-icon"
          onClick={onWhitelistClick}
          title="Manage Official Collection Whitelist"
          aria-label="Manage Whitelist"
        >
          <img
            src={whitelistIcon}
            alt="Manage Whitelist"
            className="icon-image"
          />
        </button>
      )}

      {isUiVisible && (
        <button
          className={`toolbar-icon ${isParallaxEnabled ? "active" : ""}`}
          onClick={onToggleParallax}
          title={isParallaxEnabled ? "Disable Parallax Effect" : "Enable Parallax Effect"}
          aria-label={isParallaxEnabled ? "Disable Parallax Effect" : "Enable Parallax Effect"}
        >
          <img
            src={parallaxIcon}
            alt="Toggle Parallax"
            className="icon-image"
          />
        </button>
      )}

      {showInfo && isUiVisible && (
        <button
          className="toolbar-icon"
          onClick={onInfoClick}
          title="Information"
          aria-label="Show Information"
        >
          <img src={learnIcon} alt="Information" className="icon-image" />
        </button>
      )}

      {showToggleUI && (
        <button
          className={`toolbar-icon fixed-toggle-button ${!isUiVisible ? "show-ui-btn" : ""}`}
          onClick={onToggleUI}
          title={isUiVisible ? "Hide UI" : "Show UI"}
          aria-label={isUiVisible ? "Hide User Interface" : "Show User Interface"}
        >
          <img
            src={isUiVisible ? eyeopenIcon : eyeIcon}
            alt={isUiVisible ? "Hide UI" : "Show UI"}
            className="icon-image"
          />
        </button>
      )}
    </div>
  );
};

TopRightControls.propTypes = {
  isRadarProjectAdmin: PropTypes.bool,
  onWhitelistClick: PropTypes.func,
  showInfo: PropTypes.bool,
  showToggleUI: PropTypes.bool,
  showEnhancedView: PropTypes.bool,
  onInfoClick: PropTypes.func,
  onToggleUI: PropTypes.func,
  onEnhancedView: PropTypes.func,
  isUiVisible: PropTypes.bool,
  isParallaxEnabled: PropTypes.bool,
  onToggleParallax: PropTypes.func,
};

export default TopRightControls;
```

---
### `src\components\Toolbars\VerticalToolbar.jsx`
```jsx
// src/components/Toolbars/VerticalToolbar.jsx
import React from "react";
import PropTypes from "prop-types";

import "./ToolbarStyles/VerticalToolbar.css";
import {
  controlsIcon,
  notifyIcon,
  listenIcon,
  changetokenIcon,
  writeIcon,
  wavezIcon,
  setsIcon,
} from "../../assets";
import { useNotificationContext } from "../../context/NotificationContext";

const VerticalToolbar = ({
  activePanel,
  setActivePanel,
}) => {
  const { unreadCount: notificationCount } = useNotificationContext();

  const handleIconClick = (panelName) => {
    if (typeof setActivePanel === 'function') {
      setActivePanel(panelName);
    } else if (import.meta.env.DEV) {
      console.warn("[VerticalToolbar] setActivePanel prop is not a function.");
    }
  };

  const buttonPositions = [
    { top: "20px" },  // 1. Controls
    { top: "65px" },  // 2. Notifications
    { top: "110px" }, // 3. Events
    { top: "155px" }, // 4. Token Selector
    { top: "200px" }, // 5. Setlist Management
    { top: "245px" }, // 6. Save Configuration
    { top: "290px" }, // 7. Audio Visualizer
  ];

  return (
    <>
      {/* 1. Controls */}
      <button
        className={`vertical-toolbar-icon ${activePanel === "controls" ? "active" : ""}`}
        onClick={() => handleIconClick("controls")}
        title="Controls"
        aria-label="Open Controls Panel"
        style={buttonPositions[0]}
      >
        <img src={controlsIcon} alt="Controls Panel" className="icon-image" />
      </button>

      {/* 2. Notifications */}
      <button
        className={`vertical-toolbar-icon ${activePanel === "notifications" ? "active" : ""}`}
        onClick={() => handleIconClick("notifications")}
        title="Notifications"
        aria-label="Open Notifications Panel"
        style={buttonPositions[1]}
      >
        <div className="notification-orb">
          <img
            src={notifyIcon}
            alt="Notifications Panel"
            className={`icon-image ${notificationCount > 0 ? "bell-animation" : ""}`}
          />
          {notificationCount > 0 && (
            <div className="notification-badge" aria-label={`${notificationCount} unread notifications`}>
              {notificationCount}
            </div>
          )}
        </div>
      </button>

      {/* 3. Event Reactions */}
      <button
        className={`vertical-toolbar-icon ${activePanel === "events" ? "active" : ""}`}
        onClick={() => handleIconClick("events")}
        title="Event Reactions"
        aria-label="Open Event Reactions Panel"
        style={buttonPositions[2]}
      >
        <img src={listenIcon} alt="Event Reactions Panel" className="icon-image" />
      </button>

      {/* 4. Token Selector */}
      <button
        className={`vertical-toolbar-icon ${activePanel === "tokens" ? "active" : ""}`}
        onClick={() => handleIconClick("tokens")}
        title="Select Token / Asset"
        aria-label="Open Token Selector"
        style={buttonPositions[3]}
      >
        <img src={changetokenIcon} alt="Select Token" className="icon-image" />
      </button>
      
      {/* 5. Setlist Management */}
      <button
        className={`vertical-toolbar-icon ${activePanel === "sets" ? "active" : ""}`}
        onClick={() => handleIconClick("sets")}
        title="Setlist Management"
        aria-label="Open Setlist Management Panel"
        style={buttonPositions[4]}
      >
        <img src={setsIcon} alt="Setlist Management" className="icon-image" />
      </button>

      {/* 6. Save Configuration */}
      <button
        className={`vertical-toolbar-icon ${activePanel === "save" ? "active" : ""}`}
        onClick={() => handleIconClick("save")}
        title="Save Configuration"
        aria-label="Open Save Configuration Panel"
        style={buttonPositions[5]}
      >
        <img src={writeIcon} alt="Save Configuration" className="icon-image" />
      </button>

      {/* 7. Audio Visualizer */}
      <button
        className={`vertical-toolbar-icon ${activePanel === "audio" ? "active" : ""}`}
        onClick={() => handleIconClick("audio")}
        title="Audio Visualizer Controls"
        aria-label="Open Audio Controls Panel"
        style={buttonPositions[6]}
      >
        <img src={wavezIcon} alt="Audio Controls" className="icon-image" />
      </button>
    </>
  );
};

VerticalToolbar.propTypes = {
  activePanel: PropTypes.string,
  setActivePanel: PropTypes.func.isRequired,
};

export default VerticalToolbar;
```

---
### `src\components\UI\Crossfader.css`
```css
/* src/components/UI/Crossfader.css */
@import '../../styles/variables.css';

.crossfader-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-xs) 0;
}

.crossfader-label {
  color: var(--color-text);
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  min-width: 60px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* --- START MODIFICATION --- */
/* Increased selector specificity and adjusted width */
input[type="range"].crossfader-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 250px; 
  height: 6px;
  background: transparent;
  outline: none;
  cursor: grab;
  margin: 0;
  padding: 0;
}
/* --- END MODIFICATION --- */


.crossfader-slider:active {
  cursor: grabbing;
}

/* --- Webkit (Chrome, Safari) --- */
.crossfader-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: 6px;
  background: var(--color-bg-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  transition: var(--transition-fast);
}

.crossfader-slider:hover::-webkit-slider-runnable-track {
  border-color: var(--color-border-light);
}

.crossfader-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: var(--radius-circle);
  background: var(--color-primary);
  border: 2px solid var(--color-bg-dark);
  margin-top: -6px; /* (track-height - thumb-height) / 2 + border */
  box-shadow: var(--shadow-primary-sm);
  transition: transform var(--transition-fast);
}

.crossfader-slider:active::-webkit-slider-thumb {
    transform: scale(1.1);
}

/* --- Mozilla (Firefox) --- */
.crossfader-slider::-moz-range-track {
  width: 100%;
  height: 6px;
  background: var(--color-bg-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  transition: var(--transition-fast);
}

.crossfader-slider:hover::-moz-range-track {
  border-color: var(--color-border-light);
}

.crossfader-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-circle);
  background: var(--color-primary);
  border: 2px solid var(--color-bg-dark);
  box-shadow: var(--shadow-primary-sm);
  transition: transform var(--transition-fast);
}

.crossfader-slider:active::-moz-range-thumb {
    transform: scale(1.1);
}
```

---
### `src\components\UI\Crossfader.jsx`
```jsx
// src/components/UI/Crossfader.jsx
import React from 'react';
import PropTypes from 'prop-types';
import './Crossfader.css';

const Crossfader = ({ value, onInput, onChange, disabled = false }) => {
  const handleOnInput = (e) => {
    // onInput fires continuously while the user is dragging the slider.
    if (onInput) {
      onInput(e.target.valueAsNumber);
    }
  };

  const handleOnChange = (e) => {
    // onChange typically fires only when the user releases the mouse.
    if (onChange) {
      onChange(e.target.valueAsNumber);
    }
  };

  return (
    <div className="crossfader-container">
      <input
        type="range"
        min="0"
        max="1"
        step="0.001" // A reasonable step for high fidelity without event flooding.
        value={value}
        onInput={handleOnInput}   // Use onInput for live, real-time updates.
        onChange={handleOnChange} // Use onChange for the final, committed value.
        className="crossfader-slider"
        disabled={disabled}
      />
    </div>
  );
};

Crossfader.propTypes = {
  value: PropTypes.number.isRequired,
  onInput: PropTypes.func, // The new handler for real-time updates.
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
};

export default Crossfader;
```

---
### `src\components\UI\LoadingOverlay.css`
```css
/* src/components/UI/LoadingOverlay.css */
@import '../../styles/variables.css';

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: var(--color-bg);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: var(--z-top);
  transition: opacity 0.5s ease-out;
  opacity: 1;
}

.loading-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--color-primary-a30);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-message {
  color: var(--color-primary-a90);
  font-size: var(--font-size-lg);
  font-weight: 500;
  letter-spacing: 0.5px;
  margin: 0;
}
```

---
### `src\components\UI\LoadingOverlay.jsx`
```jsx
// src/components/UI/LoadingOverlay.jsx
import React from 'react';
import PropTypes from 'prop-types';
import './LoadingOverlay.css';

const LoadingOverlay = ({ isLoading, message }) => {
  if (!isLoading) {
    return null;
  }

  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="loading-spinner"></div>
        <p className="loading-message">{message}</p>
      </div>
    </div>
  );
};

LoadingOverlay.propTypes = {
  isLoading: PropTypes.bool.isRequired,
  message: PropTypes.string.isRequired,
};

export default LoadingOverlay;
```

---
### `src\components\UI\SceneSelectorBar.css`
```css
/* src/components/UI/SceneSelectorBar.css */
@import "../../styles/variables.css";

:root {
  --color-scene-active-bg: rgba(255, 193, 7, 0.85);
  --color-scene-active-border: rgba(255, 193, 7, 1.0);
  --color-scene-active-text: #1a1a2e;

  --color-scene-hover-bg: rgba(255, 204, 51, 0.8);
  --color-scene-hover-border: rgba(255, 214, 82, 1.0);
  --color-scene-hover-text: #1a1a2e;

  --ping-duration: 1.5s;
  --ping-color: rgba(255, 193, 7, 0.7);
  --ping-spread: 5px;

  --color-scene-default-border: var(--color-border);
  --slide-duration: 300ms;
}

.scene-selector-bar {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xxs);
  border: none;
  border-radius: var(--radius-md);
  transition: opacity var(--transition-normal), visibility var(--transition-normal);
  opacity: 1;
  visibility: visible;
  background: transparent;
}

.scene-buttons-container {
  display: flex;
  gap: var(--space-sm);
  transition: transform var(--slide-duration) ease-in-out;
  transform: translateX(0);
}

@keyframes slideInFromRight {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes slideInFromLeft {
  from { transform: translateX(-100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.scene-buttons-container.slide-in-left {
  animation: slideInFromLeft var(--slide-duration) ease-in-out forwards;
}
.scene-buttons-container.slide-in-right {
  animation: slideInFromRight var(--slide-duration) ease-in-out forwards;
}

.scene-selector-button,
.pagination-button {
  font-family: var(--font-family);
  font-weight: 600;
  color: var(--color-text);
  border: 1px solid var(--color-scene-default-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast), transform var(--transition-fast), box-shadow var(--transition-fast);
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
  background: var(--color-button-secondary-a80);
  backdrop-filter: blur(var(--blur-amount));
  -webkit-backdrop-filter: blur(var(--blur-amount));
  overflow: hidden;
  position: relative;
}

.scene-selector-button {
  font-size: var(--font-size-xs);
  width: 28px;
  height: 28px;
}

.pagination-button {
  font-size: var(--font-size-sm);
  width: 24px;
  height: 24px;
}

.scene-selector-button:hover:not(:disabled):not(.active),
.pagination-button:hover:not(:disabled) {
  background: var(--color-scene-hover-bg);
  border-color: var(--color-scene-hover-border);
  color: var(--color-scene-hover-text);
  transform: translateY(-1px);
}

.scene-selector-button:active:not(:disabled):not(.active),
.pagination-button:active:not(:disabled) {
  background: rgba(255, 180, 0, 0.9);
  transform: translateY(0px);
  box-shadow: none;
}

.scene-selector-button:disabled,
.pagination-button:disabled {
  color: var(--color-text);
  border-color: var(--color-scene-default-border);
  background: var(--color-button-secondary-a80);
  backdrop-filter: blur(var(--blur-amount));
  -webkit-backdrop-filter: blur(var(--blur-amount));
  cursor: not-allowed;
  pointer-events: none;
  opacity: 0.8;
  animation: none !important;
  box-shadow: none !important;
  transform: none !important;
}

@keyframes continuous-ping-animation {
  0%, 100% {
    box-shadow: 0 0 0 0px var(--ping-color);
  }
  50% {
    box-shadow: 0 0 0 var(--ping-spread) rgba(255, 193, 7, 0);
  }
}

.scene-selector-button.active {
  background: var(--color-scene-active-bg);
  border-color: var(--color-scene-active-border);
  color: var(--color-scene-active-text);
  cursor: default;
  transform: translateY(0px);
  animation: continuous-ping-animation var(--ping-duration) infinite ease-out;
}

.scene-selector-button.active:disabled {
  background: var(--color-scene-active-bg);
  border-color: var(--color-scene-active-border);
  color: var(--color-scene-active-text);
  opacity: 0.7;
  animation: none;
  box-shadow: none;
  cursor: not-allowed;
  pointer-events: none;
  transform: none;
}
```

---
### `src\components\UI\SceneSelectorBar.jsx`
```jsx
// src/components/UI/SceneSelectorBar.jsx
import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './SceneSelectorBar.css';

const ITEMS_PER_PAGE = 5;
const SLIDE_ANIMATION_DURATION_MS = 300;
const MAX_BUTTON_LABEL_LENGTH = 3;

const getSceneDisplayLabel = (fullName) => {
  if (!fullName || typeof fullName !== 'string') return '?';

  const nameParts = fullName.split('.');

  if (nameParts.length > 1) {
    const identifier = nameParts.slice(1).join('.');

    if (/^\d+$/.test(identifier)) {
      const num = parseInt(identifier, 10);
      return num.toString();
    } else {
      return identifier.substring(0, MAX_BUTTON_LABEL_LENGTH).toUpperCase();
    }
  } else {
    return fullName.substring(0, MAX_BUTTON_LABEL_LENGTH).toUpperCase();
  }
};

const SceneSelectorBar = ({
  savedSceneList = [],
  currentSceneName = null,
  onSceneSelect,
  isLoading = false,
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [paginationDirection, setPaginationDirection] = useState(null);

  const sortedList = useMemo(() => {
    return savedSceneList.filter(
      (item) => item && typeof item.name === 'string'
    );
  }, [savedSceneList]);

  useEffect(() => {
    if (currentSceneName && sortedList.length > 0) {
      const currentIndex = sortedList.findIndex(p => p.name === currentSceneName);
      if (currentIndex !== -1) {
        const targetPage = Math.floor(currentIndex / ITEMS_PER_PAGE);
        setCurrentPage(prevPage => {
            if (prevPage !== targetPage) {
                setPaginationDirection(null);
                return targetPage;
            }
            return prevPage;
        });
      }
    } else if (sortedList.length === 0) {
        setCurrentPage(prevPage => {
            if (prevPage !== 0) {
                setPaginationDirection(null);
                return 0;
            }
            return prevPage;
        });
    }
  }, [currentSceneName, sortedList]);

  useEffect(() => {
    let timer;
    if (paginationDirection) {
      timer = setTimeout(() => {
        setPaginationDirection(null);
      }, SLIDE_ANIMATION_DURATION_MS);
    }
    return () => clearTimeout(timer);
  }, [paginationDirection]);

  const totalPages = Math.ceil(sortedList.length / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;

  const visibleScenes = useMemo(() => {
    return sortedList.slice(startIndex, endIndex);
  }, [sortedList, startIndex, endIndex]);

  const handlePrev = () => {
    if (currentPage > 0) {
      setPaginationDirection('prev');
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages - 1) {
      setPaginationDirection('next');
      setCurrentPage((prev) => prev + 1);
    }
  };

  if (!sortedList || sortedList.length === 0) {
    return null;
  }

  const canGoPrev = currentPage > 0;
  const canGoNext = currentPage < totalPages - 1;
  const animationClass = paginationDirection === 'next' ? 'slide-in-left' :
                         paginationDirection === 'prev' ? 'slide-in-right' : '';

  return (
    <div className="scene-selector-bar">
      <button
        type="button"
        className="pagination-button"
        onClick={handlePrev}
        disabled={!canGoPrev || isLoading || !!paginationDirection}
        aria-label="Previous scenes"
        title="Previous scenes"
      >
        {'<'}
      </button>
      <div className={`scene-buttons-container ${animationClass}`}>
        {visibleScenes.map((scene) => {
          const isActive = scene.name === currentSceneName;
          const displayLabel = getSceneDisplayLabel(scene.name);
          return (
            <button
              type="button"
              key={scene.name}
              className={`scene-selector-button ${isActive ? 'active' : ''}`}
              onClick={() => onSceneSelect(scene.name)}
              disabled={isLoading}
              title={`Load: ${scene.name}`}
            >
              {displayLabel}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="pagination-button"
        onClick={handleNext}
        disabled={!canGoNext || isLoading || !!paginationDirection}
        aria-label="Next scenes"
        title="Next scenes"
      >
        {'>'}
      </button>
    </div>
  );
};

SceneSelectorBar.propTypes = {
  savedSceneList: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
    })
  ),
  currentSceneName: PropTypes.string,
  onSceneSelect: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

export default SceneSelectorBar;
```

---
### `src\components\UI\Startveil.css`
```css
/* src/components/UI/StartVeil.css */
@import '../../styles/variables.css';

.start-veil {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: var(--color-bg);
  background-image: 
    radial-gradient(circle, rgba(var(--color-primary-rgb), 0.1) 1px, transparent 1px),
    radial-gradient(circle at center, var(--color-bg-light) 0%, #000000 100%);
  background-size: 20px 20px, cover;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: var(--z-top);
  animation: fadeIn 2s ease-in-out;
}

.start-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
}

.start-logo-container {
  perspective: 800px;
}

.start-logo-animated {
  position: relative;
  width: 250px;
  height: 250px;
  margin-bottom: var(--space-md);
  transform-style: preserve-3d;
}

.logo-bottom, .logo-top {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.logo-bottom {
  transform: translateZ(-15px);
}

.logo-top {
  transform: translateZ(15px);
}

.enter-prompt {
  font-family: var(--font-family);
  font-size: var(--font-size-lg);
  color: var(--color-primary-a70);
  cursor: pointer;
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-md);
  animation: pulse-glow 2s infinite alternate;
  transition: all var(--transition-normal);
}

@keyframes pulse-glow {
  from {
    opacity: 0.7;
    text-shadow: 0 0 5px var(--color-primary-a30);
  }
  to {
    opacity: 1;
    text-shadow: 0 0 15px var(--color-primary-a50);
  }
}
```

---
### `src\components\UI\StartVeil.jsx`
```jsx
// src/components/UI/StartVeil.jsx
import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import R_WEBP_ASSET from "../../assets/R.webp";
import './StartVeil.css';

const StartVeil = ({ onStart }) => {
  const logoRef = useRef(null);
  const mousePosition = useRef({ x: 0, y: 0 });
  const animationFrameId = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const { innerWidth, innerHeight } = window;
      mousePosition.current = {
        x: (e.clientX / innerWidth - 0.5) * 2, // -1 to 1
        y: (e.clientY / innerHeight - 0.5) * 2, // -1 to 1
      };
    };

    const animate = () => {
      if (logoRef.current) {
        const { x, y } = mousePosition.current;
        const tiltIntensity = 8;
        const shiftIntensity = 6;
        
        logoRef.current.style.transform = `
          rotateY(${x * tiltIntensity}deg) 
          rotateX(${-y * tiltIntensity}deg) 
          translate(${x * shiftIntensity}px, ${y * shiftIntensity}px)
        `;
      }
      animationFrameId.current = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', handleMouseMove);
    animationFrameId.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  return (
    <div className="start-veil">
      <div className="start-content">
        <div className="start-logo-container">
          <div className="start-logo-animated" ref={logoRef}>
            <img src={R_WEBP_ASSET} alt="RADAR Logo Background" className="logo-bottom" />
            <img src={R_WEBP_ASSET} alt="RADAR Logo Foreground" className="logo-top" />
          </div>
        </div>
        <div className="enter-prompt" onClick={onStart}>
          Click to Enter
        </div>
      </div>
    </div>
  );
};

StartVeil.propTypes = {
  onStart: PropTypes.func.isRequired,
};

export default StartVeil;
```

---
### `src\components\UI\UIOverlay.css`
```css
/* src/components/UI/UIOverlay.css */
@import '../../styles/variables.css';

.ui-elements-container {
  /* This class already exists in layout.css, but we can add specific styles here if needed */
}

/* Container for both crossfader and its MIDI mapping controls */
.crossfader-control-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-xs);
  background: var(--color-button-secondary-a80);
  backdrop-filter: blur(var(--blur-amount));
  -webkit-backdrop-filter: blur(var(--blur-amount));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

/* Container for the mapping text and button */
.crossfader-midi-map {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

/* Style for the text displaying the current MIDI mapping */
.crossfader-midi-map .midi-mapping-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  background: var(--color-bg-alt);
  padding: 2px 4px;
  border-radius: var(--radius-sm);
}

/* Re-using the small action button style for the new "Map" button */
.crossfader-midi-map .midi-btn.small-action-button {
  padding: 0 4px;
  font-size: 9px;
  background: var(--color-warning-a15);
  border: 1px solid var(--color-warning-a30);
  border-radius: var(--radius-sm);
  color: var(--color-warning);
  cursor: pointer;
  outline: none;
  line-height: 1.1;
  min-height: 16px;
  transition: all var(--transition-fast);
}

.crossfader-midi-map .midi-btn.small-action-button:hover:not(:disabled) {
  background: var(--color-warning-a25);
}

.crossfader-midi-map .midi-btn.small-action-button.learning {
  background: var(--color-accent-a20);
  border-color: var(--color-accent);
  color: var(--color-accent);
  animation: blink 1s infinite;
}

@keyframes blink {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

/* Other UI Overlay specific styles can go here */
.preview-mode-indicator {
    position: fixed;
    bottom: var(--space-lg);
    left: var(--space-lg);
    background: var(--color-warning-a30);
    color: var(--color-warning-a90);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-md);
    font-weight: bold;
    font-size: var(--font-size-sm);
    z-index: var(--z-top);
    pointer-events: none;
    display: flex;
    align-items: center;
    gap: var(--space-xs);
}
```

---
### `src\components\UI\UIOverlay.jsx`
```jsx
// src/components/UI/UIOverlay.jsx
import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

import TopRightControls from '../Toolbars/TopRightControls';
import VerticalToolbar from '../Toolbars/VerticalToolbar';
import PanelWrapper from '../Panels/PanelWrapper';
import EnhancedControlPanel from '../Panels/EnhancedControlPanel';
import NotificationPanel from '../Panels/NotificationPanel';
import EventsPanel from '../Panels/EventsPanel';
import EnhancedSavePanel from '../Panels/EnhancedSavePanel';
import SetsPanel from '../Panels/SetsPanel';
import AudioControlPanel from '../Audio/AudioControlPanel';
import TokenSelectorOverlay from '../Panels/TokenSelectorOverlay';
import InfoOverlay from '../Panels/InfoOverlay';
import GlobalMIDIStatus from '../MIDI/GlobalMIDIStatus';
import AudioStatusIcon from '../Audio/AudioStatusIcon';
import SceneSelectorBar from './SceneSelectorBar';
import LibraryPanel from '../Panels/LibraryPanel';
import Crossfader from './Crossfader';
import WorkspaceSelectorDots from './WorkspaceSelectorDots';
import { useWorkspaceContext } from '../../context/WorkspaceContext';
import { useVisualEngineContext } from '../../context/VisualEngineContext';
import { useNotificationContext } from '../../context/NotificationContext';
import { useUserSession } from '../../context/UserSessionContext';

import { useToast } from '../../context/ToastContext';
import { ForwardIcon as SequencerIcon } from '@heroicons/react/24/outline';
import './UIOverlay.css';

const MemoizedTopRightControls = React.memo(TopRightControls);
const MemoizedVerticalToolbar = React.memo(VerticalToolbar);
const MemoizedGlobalMIDIStatus = React.memo(GlobalMIDIStatus);
const MemoizedAudioStatusIcon = React.memo(AudioStatusIcon);
const MemoizedSceneSelectorBar = React.memo(SceneSelectorBar);

const DEFAULT_SEQUENCER_INTERVAL = 0;

const GeneralConnectPill = () => {
    return (
        <div className="general-connect-pill">
            Please connect your Universal Profile to begin.
        </div>
    );
};

const ActivePanelRenderer = (props) => {
    const { 
      uiState, audioState, pLockProps, onPreviewEffect,
      sequencerIntervalMs, onSetSequencerInterval, // <-- Receive from props
      crossfadeDurationMs, onSetCrossfadeDuration, // <-- Receive from props
    } = props;
    const { activePanel, animatingPanel, activeLayerTab, closePanel, setActiveLayerTab } = uiState;
    const { isAudioActive, audioSettings, analyzerData, setIsAudioActive, setAudioSettings } = audioState;
    
    const { handleSceneSelect, updateTokenAssignment, isAutoFading, uiControlConfig, updateLayerConfig } = useVisualEngineContext();
    
    const handleTokenSelectorClose = useCallback(() => closePanel(), [closePanel]);
    const panelWrapperClassName = useMemo(() => animatingPanel === "closing" ? "animating closing" : animatingPanel ? "animating" : "", [animatingPanel]);

    switch (activePanel) {
        case "controls":
            return (
                <PanelWrapper key="controls-panel" className={panelWrapperClassName}>
                    <EnhancedControlPanel
                        onToggleMinimize={closePanel}
                        activeTab={activeLayerTab}
                        onTabChange={setActiveLayerTab}
                        pLockProps={pLockProps}
                        onSceneSelect={(sceneName) => handleSceneSelect(sceneName, crossfadeDurationMs)}
                        sequencerIntervalMs={sequencerIntervalMs}
                        onSetSequencerInterval={onSetSequencerInterval}
                        crossfadeDurationMs={crossfadeDurationMs}
                        onSetCrossfadeDuration={onSetCrossfadeDuration}
                        isAutoFading={isAutoFading}
                        activeLayerConfigs={uiControlConfig?.layers}
                        onLayerConfigChange={updateLayerConfig}
                    />
                </PanelWrapper>
            );
        case "notifications":
            return ( <PanelWrapper key="notifications-panel" className={panelWrapperClassName}><NotificationPanel onClose={closePanel} /></PanelWrapper> );
        case "events":
            return ( <PanelWrapper key="events-panel" className={panelWrapperClassName}><EventsPanel onClose={closePanel} onPreviewEffect={onPreviewEffect} /></PanelWrapper> );
        case "sets":
            return ( <PanelWrapper key="sets-panel" className={panelWrapperClassName}><SetsPanel onClose={closePanel} /></PanelWrapper> );
        case "save":
            return ( <PanelWrapper key="save-panel" className={panelWrapperClassName}><EnhancedSavePanel onClose={closePanel} /></PanelWrapper> );
        case "audio":
            return ( <PanelWrapper key="audio-panel" className={panelWrapperClassName}><AudioControlPanel onClose={closePanel} isAudioActive={isAudioActive} setIsAudioActive={setIsAudioActive} audioSettings={audioSettings} setAudioSettings={setAudioSettings} analyzerData={analyzerData} /></PanelWrapper> );
        case "whitelist":
            return ( <PanelWrapper key="whitelist-panel" className={panelWrapperClassName}><LibraryPanel onClose={closePanel} /></PanelWrapper> );
        case "tokens":
            return ( <TokenSelectorOverlay key="token-selector-overlay" isOpen={activePanel === "tokens"} onClose={handleTokenSelectorClose} onTokenApplied={updateTokenAssignment} /> );
        default:
            return null;
    }
};
ActivePanelRenderer.propTypes = {
    uiState: PropTypes.object.isRequired,
    audioState: PropTypes.object.isRequired,
    pLockProps: PropTypes.object.isRequired,
    onPreviewEffect: PropTypes.func.isRequired,
    sequencerIntervalMs: PropTypes.number.isRequired,
    onSetSequencerInterval: PropTypes.func.isRequired,
    crossfadeDurationMs: PropTypes.number.isRequired,
    onSetCrossfadeDuration: PropTypes.func.isRequired,
};
const MemoizedActivePanelRenderer = React.memo(ActivePanelRenderer);

const OverlayRenderer = ({ uiState }) => {
    const { infoOverlayOpen, toggleInfoOverlay } = uiState;
    return infoOverlayOpen ? <InfoOverlay isOpen={infoOverlayOpen} onClose={toggleInfoOverlay} /> : null;
};
OverlayRenderer.propTypes = {
    uiState: PropTypes.object.isRequired,
};
const MemoizedOverlayRenderer = React.memo(OverlayRenderer);

function UIOverlay({
  uiState,
  audioState,
  pLockProps,
  isReady = false, // Default value here replaces defaultProps
  actions,
  configData,
  crossfadeDurationMs,
  onSetCrossfadeDuration,
}) {
  const { addToast } = useToast();
  const { stagedSetlist, loadWorkspace, activeWorkspaceName: currentWorkspaceName, isLoading: isConfigLoading, activeSceneName, fullSceneList: savedSceneList } = useWorkspaceContext();
  const { renderedCrossfaderValue, isAutoFading, handleSceneSelect, handleCrossfaderChange } = useVisualEngineContext();
  const { unreadCount } = useNotificationContext();
  const { isRadarProjectAdmin, hostProfileAddress: currentProfileAddress } = useUserSession();
  const { isUiVisible, activePanel, toggleSidePanel, toggleInfoOverlay, toggleUiVisibility } = uiState;
  const { isAudioActive } = audioState;
  
  const { onEnhancedView, onToggleParallax, onPreviewEffect } = actions;
  const [isSequencerActive, setIsSequencerActive] = useState(false);
  const sequencerTimeoutRef = useRef(null);
  const nextSceneIndexRef = useRef(0);
  const isMountedRef = useRef(false);

  // --- THIS IS THE FIX: State is now held in the correct parent component ---
  const [sequencerIntervalMs, setSequencerIntervalMs] = useState(DEFAULT_SEQUENCER_INTERVAL);
  // --- END FIX ---

  const workspaceList = useMemo(() => {
    if (!stagedSetlist?.workspaces) return [];
    return Object.keys(stagedSetlist.workspaces)
      .map(name => ({ name }));
  }, [stagedSetlist]);

  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; } }, []);
  
  const handleSceneSelectRef = useRef(handleSceneSelect);
  const savedSceneListRef = useRef(savedSceneList);
  useEffect(() => {
    handleSceneSelectRef.current = handleSceneSelect;
    savedSceneListRef.current = savedSceneList;
  }, [handleSceneSelect, savedSceneList]);

  const runNextSequenceStep = useCallback(() => {
    const currentList = savedSceneListRef.current;
    if (!currentList || currentList.length === 0) {
        setIsSequencerActive(false);
        return;
    }
    const nextIndex = nextSceneIndexRef.current % currentList.length;
    const nextScene = currentList[nextIndex];
    if (nextScene?.name && handleSceneSelectRef.current) {
        handleSceneSelectRef.current(nextScene.name, crossfadeDurationMs);
    }
    nextSceneIndexRef.current = nextIndex + 1;
  }, [crossfadeDurationMs]);

  useEffect(() => {
    if (sequencerTimeoutRef.current) clearTimeout(sequencerTimeoutRef.current);
    if (isSequencerActive && !isAutoFading) {
        sequencerTimeoutRef.current = setTimeout(runNextSequenceStep, sequencerIntervalMs);
    }
    return () => { if (sequencerTimeoutRef.current) clearTimeout(sequencerTimeoutRef.current); };
  }, [isSequencerActive, isAutoFading, sequencerIntervalMs, runNextSequenceStep]);

  const handleToggleSequencer = () => {
    if (isConfigLoading || !currentProfileAddress) return;
    setIsSequencerActive(prev => {
      const isActivating = !prev;
      if (isActivating) {
        addToast(`Sequencer started.`, 'info', 3000);
        const currentList = savedSceneList;
        if (currentList && currentList.length > 0) {
          const currentIndex = currentList.findIndex(p => p.name === activeSceneName);
          nextSceneIndexRef.current = (currentIndex === -1 ? 0 : currentIndex + 1);
        } else {
          nextSceneIndexRef.current = 0;
        }
        // --- THIS IS THE FIX: Removed the immediate imperative call ---
        // runNextSequenceStep(); // <--- REMOVED
        // The useEffect hook will now handle the first step after the initial interval.
      } else {
        addToast('Sequencer stopped.', 'info', 2000);
        if (sequencerTimeoutRef.current) clearTimeout(sequencerTimeoutRef.current);
      }
      return isActivating;
    });
  };

  // --- FIX: Logic simplified and corrected ---
  const shouldShowUI = useMemo(() => isReady, [isReady]);
  const showSceneBar = useMemo(() => shouldShowUI && isUiVisible && !activePanel && !!currentProfileAddress, [shouldShowUI, isUiVisible, activePanel, currentProfileAddress]);
  const mainUiContainerClass = `ui-elements-container ${shouldShowUI && isUiVisible ? "visible" : "hidden-by-opacity"}`;
  // --- END FIX ---

  if (!isReady) {
    return null;
  }
  
  return (
    <>
      {isReady && <MemoizedTopRightControls
        isRadarProjectAdmin={isRadarProjectAdmin} 
        showInfo={true} 
        showToggleUI={true} 
        showEnhancedView={true}
        onWhitelistClick={() => toggleSidePanel('whitelist')}
        onInfoClick={toggleInfoOverlay} 
        onToggleUI={toggleUiVisibility} 
        onEnhancedView={onEnhancedView} 
        isUiVisible={isUiVisible}
        isParallaxEnabled={configData.isParallaxEnabled}
        onToggleParallax={onToggleParallax}
      />}
      <div className={mainUiContainerClass}>
        {isUiVisible && (
          <>
            <div className="bottom-right-icons">
              <MemoizedGlobalMIDIStatus />
              <button
                className={`toolbar-icon sequencer-toggle-button ${isSequencerActive ? "active" : ""}`}
                onClick={handleToggleSequencer} title={isSequencerActive ? `Stop Scene Sequencer` : `Start Scene Sequencer`}
                aria-label={isSequencerActive ? "Stop Scene Sequencer" : "Start Scene Sequencer"} disabled={isConfigLoading || !currentProfileAddress}
              >
                <SequencerIcon className="icon-image" />
              </button>
              <MemoizedAudioStatusIcon isActive={isAudioActive} onClick={() => uiState.openPanel('audio')} />
            </div>
            {isReady && <div className="vertical-toolbar-container">
              <MemoizedVerticalToolbar activePanel={activePanel} setActivePanel={toggleSidePanel} notificationCount={unreadCount} />
            </div>}
            <MemoizedActivePanelRenderer
                uiState={uiState}
                audioState={audioState}
                pLockProps={pLockProps}
                onPreviewEffect={onPreviewEffect}
                sequencerIntervalMs={sequencerIntervalMs}
                onSetSequencerInterval={setSequencerIntervalMs}
                crossfadeDurationMs={crossfadeDurationMs}
                onSetCrossfadeDuration={onSetCrossfadeDuration}
            />
            {showSceneBar && (
              <div className="bottom-center-controls">
                <WorkspaceSelectorDots
                  workspaces={workspaceList}
                  activeWorkspaceName={currentWorkspaceName}
                  onSelectWorkspace={loadWorkspace}
                  isLoading={isAutoFading || isConfigLoading}
                />
                <Crossfader
                  value={renderedCrossfaderValue}
                  onInput={handleCrossfaderChange}
                  onChange={handleCrossfaderChange}
                  disabled={isAutoFading}
                />
                <MemoizedSceneSelectorBar
                  savedSceneList={savedSceneList} currentSceneName={activeSceneName}
                  onSceneSelect={(sceneName) => handleSceneSelect(sceneName, crossfadeDurationMs)} isLoading={isAutoFading || isConfigLoading}
                />
              </div>
            )}
          </>
        )}
      </div>
      <MemoizedOverlayRenderer uiState={uiState} />
      {!currentProfileAddress && ( <GeneralConnectPill /> )}
    </>
  );
}

UIOverlay.propTypes = {
  pLockProps: PropTypes.object.isRequired,
  uiState: PropTypes.object.isRequired,
  audioState: PropTypes.object.isRequired,
  configData: PropTypes.object.isRequired,
  actions: PropTypes.object.isRequired,
  isReady: PropTypes.bool,
  crossfadeDurationMs: PropTypes.number.isRequired,
  onSetCrossfadeDuration: PropTypes.func.isRequired,
};

export default React.memo(UIOverlay);
```

---
### `src\components\UI\WorkspaceSelectorDots.css`
```css
/* src/components/UI/WorkspaceSelectorDots.css */
@import '../../styles/variables.css';

.workspace-dots-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-xs) 0;
  width: 100%;
}

.workspace-dot {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-circle);
  border: 2px solid var(--color-primary-a30);
  background-color: transparent;
  cursor: pointer;
  padding: 0;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.workspace-dot:hover:not(:disabled) {
  background-color: var(--color-primary-a50);
  transform: scale(1.2);
}

.workspace-dot.active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  transform: scale(1.25);
  box-shadow: var(--shadow-primary-md);
  cursor: default;
}

.workspace-dot:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: scale(1);
}

.workspace-dot.active:disabled {
    opacity: 1; /* Keep active dot fully visible even if disabled */
}
```

---
### `src\components\UI\WorkspaceSelectorDots.jsx`
```jsx
// src/components/UI/WorkspaceSelectorDots.jsx
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import './WorkspaceSelectorDots.css';
import { useWorkspaceContext } from '../../context/WorkspaceContext';

const WorkspaceSelectorDots = ({
  workspaces = [],
  activeWorkspaceName,
  onSelectWorkspace,
  isLoading,
}) => {
  const { preloadWorkspace } = useWorkspaceContext();

  // --- FIX: Call all hooks unconditionally at the top level ---
  const sortedWorkspaces = useMemo(() => workspaces, [workspaces]);

  if (workspaces.length <= 1) {
    return null;
  }

  return (
    <div className="workspace-dots-container">
      {sortedWorkspaces.map(({ name }) => (
        <button
          key={name}
          className={`workspace-dot ${name === activeWorkspaceName ? 'active' : ''}`}
          title={`Load Workspace: ${name}`}
          onClick={() => onSelectWorkspace(name)}
          onMouseEnter={() => preloadWorkspace(name)}
          disabled={isLoading || name === activeWorkspaceName}
          aria-label={`Load workspace ${name}`}
        />
      ))}
    </div>
  );
};

WorkspaceSelectorDots.propTypes = {
  workspaces: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
    })
  ).isRequired,
  activeWorkspaceName: PropTypes.string,
  onSelectWorkspace: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

export default WorkspaceSelectorDots;
```

---
### `src\config\fallback-config.js`
```js
// src/config/fallback-config.js

// No need to import specific images here if using tokenAssignments keys

/**
 * Default configuration object used when no specific profile configuration
 * (named scene or default pointer) is loaded.
 * Defines initial layer parameters and assigns default demo tokens.
 */
export default {
  version: "1.1", // Increment version number if desired
  layers: {
    // Keep the desired visual parameters from the original showcase/fallback
    1: { // Bottom Layer
      enabled: true,
      speed: 0.01,
      size: 4.7,
      xaxis: -629,
      yaxis: -1240,
      drift: 0.4,
      direction: -1,
      angle: -194.21,
      blendMode: "exclusion",
      driftSpeed: 0.3,
      opacity: 0.25,
    },
    2: { // Middle Layer
      enabled: true,
      speed: 0.01,
      size: 2,
      xaxis: 1771,
      yaxis: 1371,
      drift: 0.5,
      direction: -1,
      angle: -90,
      blendMode: "overlay",
      driftSpeed: 0.4,
      opacity: 1,
    },
    3: { // Top Layer
      enabled: true,
      speed: 0.01,
      size: 1.8,
      xaxis: 2229,
      yaxis: 1886,
      drift: 15.4,
      direction: 1,
      angle: 63.385,
      blendMode: "normal",
      driftSpeed: 0.3,
      opacity: 1,
    },
  },
  // --- UPDATED: Use tokenAssignments to specify the default visuals ---
  tokenAssignments: {
    // Assign the key for Layer4.webp to all visual layers
    // Assuming the key in demoAssetMap is "DEMO_LAYER_4"
    1: "DEMO_LAYER_4", // Bottom Layer uses Layer4.webp
    2: "DEMO_LAYER_4", // Middle Layer uses Layer4.webp
    3: "DEMO_LAYER_4", // Top Layer uses Layer4.webp
  },
  // --- REMOVED the potentially confusing 'assets' property ---
  // assets: { ... },
  reactions: {}, // Keep default empty reactions
};
```

---
### `src\config\global-config.js`
```js
// src/config/global-config.js
import { keccak256, stringToBytes } from "viem";
import { LSP1_TYPE_IDS as StandardLSP1TypeIds } from "@lukso/lsp-smart-contracts";

/**
 * Global configuration constants and helper functions for the RADAR application.
 * Defines ERC725Y storage keys, IPFS gateway, LSP1 event type mappings,
 * and blend modes.
 */

// --- Core Configuration ---

/**
 * The IPFS Gateway used to resolve 'ipfs://' URIs to fetchable HTTP URLs.
 */
export const IPFS_GATEWAY =
  import.meta.env.VITE_IPFS_GATEWAY ||
  "https://api.universalprofile.cloud/ipfs/";

/**
 * The official admin address for the RADAR project. This address may have special
 * privileges, such as managing an official list of recommended collections.
 * @type {string}
 */
export const RADAR_OFFICIAL_ADMIN_ADDRESS = import.meta.env.VITE_RADAR_OFFICIAL_ADMIN_ADDRESS || "0x0000000000000000000000000000000000000000"; // Fallback to zero address

if (!import.meta.env.VITE_RADAR_OFFICIAL_ADMIN_ADDRESS && import.meta.env.DEV) {
  console.warn(
    "⚠️ [RADAR Config] VITE_RADAR_OFFICIAL_ADMIN_ADDRESS is not defined in your .env file. Admin-specific features will not be available. Please set this variable to your designated admin UP address."
  );
}


// --- Primary ERC725Y Storage Key (New Architecture) ---

/**
 * The single, primary on-chain key that points to the user's entire workspace
 * JSON file stored on IPFS. This is the cornerstone of the new scalable storage model.
 * @type {string}
 */
export const RADAR_ROOT_STORAGE_POINTER_KEY = keccak256(stringToBytes("RADAR.RootStoragePointer"));

// --- LSP1 Event Type Mappings ---

export const EVENT_TYPE_MAP = {
  lyx_received: StandardLSP1TypeIds.LSP0ValueReceived,
  follower_gained: "0x71e02f9f05bcd5816ec4f3134aa2e5a916669537ec6c77fe66ea595fabc2d51a", // Custom
  follower_lost: "0x9d3c0b4012b69658977b099bdaa51eff0f0460f421fba96d15669506c00d1c4f", // Custom
  lsp7_received: "0x20804611b3e2ea21c480dc465142210acf4a2485947541770ec1fb87dee4a55c", // Custom
  lsp8_received: "0x0b084a55ebf70fd3c06fd755269dac2212c4d3f0f4d09079780bfa50c1b2984d", // Custom
};

export const TYPE_ID_TO_EVENT_MAP = Object.fromEntries(
  Object.entries(EVENT_TYPE_MAP).map(([eventName, typeId]) => [
    typeId.toLowerCase(),
    eventName,
  ]),
);


// --- Application Constants ---

/**
 * A list of supported CSS `mix-blend-mode` values for the visualizer layers.
 */
export const BLEND_MODES = [
  "normal", "multiply", "screen", "overlay", "darken",
  "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", 
  "difference", "exclusion", "hue", "saturation", "color", "luminosity"
];
```

---
### `src\config\midiConstants.js`
```js
// src/config/midiConstants.js
export const INTERPOLATED_MIDI_PARAMS = [
  'xaxis', 
  'yaxis', 
  'angle',
  'speed',
  'size',
  'opacity',
  'drift',
  'driftSpeed'
];
```

---
### `src\config\RADAR-erc725y-schema.json`
```json
[
  {
    "name": "RADAR.NamedConfiguration:<configName>",
    "key": "0x44f0a644f86a60b959270000<bytes20 nameHash>",
    "keyType": "Mapping",
    "valueType": "bytes",
    "valueContent": "JSONURL"
  },
  {
    "name": "RADAR.SavedConfigurationList[]",
    "key": "0xb705191a8b41d1f6b4bd88156334f8218a5d70f6a579c9c5a0a6871d2e398a9a",
    "keyType": "Array",
    "valueType": "string",
    "valueContent": "String"
  },
  {
    "name": "RADAR.DefaultConfigurationName",
    "key": "0xaf9518865d704640a115a21518b109f9a37c0ab1f6865c84d6a150f5f6693e19",
    "keyType": "Singleton",
    "valueType": "string",
    "valueContent": "String"
  },
  {
    "name": "RADAR.MIDI.ParameterMap",
    "key": "0x9e5e3b0c7c8a4f6d1d9d63429a9743e3f38270f5a8c2633e7e6dfb01fc17e3bd",
    "keyType": "Singleton",
    "valueType": "bytes",
    "valueContent": "JSONURL"
  },
  {
    "name": "RADAR.EventReactions",
    "key": "0x0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
    "keyType": "Singleton",
    "valueType": "bytes",
    "valueContent": "JSONURL"
  },
  {
    "name": "RADAR.WhitelistedCollections",
    "key": "0x5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b",
    "keyType": "Singleton",
    "valueType": "bytes",
    "valueContent": "JSONURL"
  }
]
```

---
### `src\config\sliderParams.js`
```js
// src/config/sliderParams.js

/**
 * Shared configuration for visual layer control sliders.
 * This is used across various components and contexts to ensure consistency.
 *
 * @property {string} prop - The key in the layer configuration object.
 * @property {string} label - The display label for the UI.
 * @property {string} icon - Placeholder for a potential future icon identifier.
 * @property {number} min - The minimum value for the slider.
 * @property {number} max - The maximum value for the slider.
 * @property {number} step - The step increment for the slider.
 * @property {number} formatDecimals - The number of decimal places for display formatting.
 * @property {number} [defaultValue=0] - The default value if one is not provided in the configuration.
 */
export const sliderParams = [
  { prop: "speed", label: "SPEED", icon: "slidersIcon_placeholder", min: 0.001, max: 0.1, step: 0.001, formatDecimals: 3 },
  { prop: "size", label: "SIZE", icon: "enlargeIcon_placeholder", min: 0.1, max: 8.0, step: 0.01, formatDecimals: 1 },
  { prop: "opacity", label: "OPACITY", icon: "eyeIcon_placeholder", min: 0, max: 1, step: 0.001, formatDecimals: 2, defaultValue: 1 },
  { prop: "drift", label: "DRIFT", icon: "wavesIcon_placeholder", min: 0, max: 100, step: 0.001, formatDecimals: 1 },
  { prop: "driftSpeed", label: "DRIFT SPEED", icon: "wavezIcon_placeholder", min: 0, max: 1, step: 0.001, formatDecimals: 1 },
  { prop: "xaxis", label: "X POS", icon: "horizontalviewIcon_placeholder", min: -10000, max: 10000, step: 0.001, formatDecimals: 0 },
  { prop: "yaxis", label: "Y POS", icon: "verticalviewIcon_placeholder", min: -10000, max: 10000, step: 0.001, formatDecimals: 0 },
  { prop: "angle", label: "ANGLE", icon: "rotateIcon_placeholder", min: -90, max: 90, step: 0.001, formatDecimals: 1 },
];
```

---
### `src\config\uiConstants.js`
```js
/** Color for the canvas click ping effect. */
export const PING_COLOR = "var(--color-primary, #00FFCC)";

/** Stroke width for the canvas click ping effect circle. */
export const PING_STROKE_WIDTH = 1.5;

/** CSS selectors for elements that should NOT trigger the canvas click ping effect. */
export const NO_PING_SELECTORS = ['.ui-container', '.status-display', '.fps-counter'].join(', ');
```

---
### `src\context\AssetContext.jsx`
```jsx
// src/context/AssetContext.jsx
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { keccak256, stringToBytes } from "viem";
import { useWorkspaceContext } from './WorkspaceContext'; // Dependency
import { useUserSession } from './UserSessionContext'; // Dependency
import { useToast } from './ToastContext'; // Dependency
import { RADAR_OFFICIAL_ADMIN_ADDRESS, IPFS_GATEWAY } from "../config/global-config";
import { hexToUtf8Safe } from "../services/ConfigurationService";

const OFFICIAL_WHITELIST_KEY = keccak256(stringToBytes("RADAR.OfficialWhitelist"));

const AssetContext = createContext();

export const AssetProvider = ({ children }) => {
  const { configServiceRef, configServiceInstanceReady } = useWorkspaceContext();
  const { hostProfileAddress, visitorProfileAddress } = useUserSession();
  const { addToast } = useToast();

  const [officialWhitelist, setOfficialWhitelist] = useState([]);
  const [ownedTokenIdentifiers, setOwnedTokenIdentifiers] = useState({});
  const [isFetchingTokens, setIsFetchingTokens] = useState(false);
  const [tokenFetchProgress, setTokenFetchProgress] = useState({ loaded: 0, total: 0, loading: false });

  const refreshOfficialWhitelist = useCallback(async () => {
    const service = configServiceRef.current;
    if (!service || !service.checkReadyForRead()) return;
    try {
        const pointerHex = await service.loadDataFromKey(RADAR_OFFICIAL_ADMIN_ADDRESS, OFFICIAL_WHITELIST_KEY);
        if (!pointerHex || pointerHex === '0x') { setOfficialWhitelist([]); return; }
        const ipfsUri = hexToUtf8Safe(pointerHex);
        if (!ipfsUri || !ipfsUri.startsWith('ipfs://')) { setOfficialWhitelist([]); return; }
        const cid = ipfsUri.substring(7);
        const response = await fetch(`${IPFS_GATEWAY}${cid}`);
        if (!response.ok) throw new Error(`Failed to fetch whitelist from IPFS: ${response.statusText}`);
        const list = await response.json();
        setOfficialWhitelist(Array.isArray(list) ? list : []);
    } catch (error) {
        console.error("Error fetching official collection whitelist:", error);
        setOfficialWhitelist([]);
    }
  }, [configServiceRef]);

  useEffect(() => {
    if (configServiceInstanceReady) {
      refreshOfficialWhitelist();
    }
  }, [configServiceInstanceReady, refreshOfficialWhitelist]);

  const refreshOwnedTokens = useCallback(async (isSilent = false) => {
    const service = configServiceRef.current;
    const effectiveAddress = hostProfileAddress || visitorProfileAddress;
    if (!effectiveAddress || officialWhitelist.length === 0 || !service) {
      setOwnedTokenIdentifiers({});
      setTokenFetchProgress({ loaded: 0, total: 0, loading: false });
      return;
    }

    setIsFetchingTokens(true);
    setTokenFetchProgress({ loaded: 0, total: officialWhitelist.length, loading: true });
    if (!isSilent) addToast("Fetching token libraries...", "info", 2000);

    try {
      const isAdminShowcase = effectiveAddress.toLowerCase() === RADAR_OFFICIAL_ADMIN_ADDRESS.toLowerCase();
      
      const identifierPromises = officialWhitelist.map(async (collection) => {
        const standard = await service.detectCollectionStandard(collection.address);
        let identifiers = [];
        if (standard === 'LSP8') {
          if (isAdminShowcase) {
            identifiers = await service.getAllLSP8TokenIdsForCollection(collection.address);
          } else {
            identifiers = await service.getOwnedLSP8TokenIdsForCollection(effectiveAddress, collection.address);
          }
        }
        setTokenFetchProgress(prev => ({ ...prev, loaded: prev.loaded + 1 }));
        return { address: collection.address, identifiers };
      });

      const results = await Promise.all(identifierPromises);
      
      const newIdentifierMap = results.reduce((acc, result) => {
        if (result.identifiers.length > 0) {
          acc[result.address] = result.identifiers;
        }
        return acc;
      }, {});

      setOwnedTokenIdentifiers(newIdentifierMap);

      if (!isSilent) {
        const totalIds = Object.values(newIdentifierMap).reduce((sum, ids) => sum + ids.length, 0);
        addToast(`Token libraries loaded: ${totalIds} assets available.`, "success", 3000);
      }
    } catch (error) {
      console.error("Failed to refresh owned token identifiers:", error);
      if (!isSilent) addToast("Could not load token libraries.", "error");
    } finally {
      setIsFetchingTokens(false);
      setTokenFetchProgress(prev => ({ ...prev, loading: false }));
    }
  }, [hostProfileAddress, visitorProfileAddress, officialWhitelist, addToast, configServiceRef]);

  const contextValue = useMemo(() => ({
    officialWhitelist,
    refreshOfficialWhitelist,
    ownedTokenIdentifiers,
    isFetchingTokens,
    tokenFetchProgress,
    refreshOwnedTokens,
  }), [
    officialWhitelist,
    refreshOfficialWhitelist,
    ownedTokenIdentifiers,
    isFetchingTokens,
    tokenFetchProgress,
    refreshOwnedTokens,
  ]);

  return (
    <AssetContext.Provider value={contextValue}>
      {children}
    </AssetContext.Provider>
  );
};

AssetProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAssetContext = () => {
  const context = useContext(AssetContext);
  if (context === undefined) {
    throw new Error("useAssetContext must be used within an AssetProvider");
  }
  return context;
};
```

---
### `src\context\MIDIContext.jsx`
```jsx
// src/context/MIDIContext.jsx
import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, useReducer
} from 'react';
import PropTypes from 'prop-types';

import { useWorkspaceContext } from './WorkspaceContext';

const MAX_MONITOR_ENTRIES = 100;
const MIDI_CONNECT_TIMEOUT_MS = 10000;

const defaultContextValue = {
  midiAccess: null, isConnected: false, isConnecting: false, error: null, midiInputs: [],
  midiMap: {}, layerMappings: { "1": {}, "2": {}, "3": {} },
  midiLearning: null, learningLayer: null, selectedChannel: 0, midiMonitorData: [],
  showMidiMonitor: false, pendingActions: [],
  connectMIDI: async () => { if (import.meta.env.DEV) console.warn("connectMIDI called on default MIDIContext"); return null; },
  disconnectMIDI: () => { if (import.meta.env.DEV) console.warn("disconnectMIDI called on default MIDIContext"); },
  startMIDILearn: () => { if (import.meta.env.DEV) console.warn("startMIDILearn called on default MIDIContext"); },
  stopMIDILearn: () => { if (import.meta.env.DEV) console.warn("stopMIDILearn called on default MIDIContext"); },
  startLayerMIDILearn: () => { if (import.meta.env.DEV) console.warn("startLayerMIDILearn called on default MIDIContext"); },
  stopLayerMIDILearn: () => { if (import.meta.env.DEV) console.warn("stopLayerMIDILearn called on default MIDIContext"); },
  startGlobalMIDILearn: () => { if (import.meta.env.DEV) console.warn("startGlobalMIDILearn called on default MIDIContext"); },
  clearAllMappings: () => { if (import.meta.env.DEV) console.warn("clearAllMappings called on default MIDIContext"); },
  setChannelFilter: () => { if (import.meta.env.DEV) console.warn("setChannelFilter called on default MIDIContext"); },
  clearMIDIMonitor: () => { if (import.meta.env.DEV) console.warn("clearMIDIMonitor called on default MIDIContext"); },
  setShowMidiMonitor: () => { if (import.meta.env.DEV) console.warn("setShowMidiMonitor called on default MIDIContext"); },
  clearPendingActions: () => { if (import.meta.env.DEV) console.warn("clearPendingActions called on default MIDIContext"); },
  mapParameterToMIDI: () => { if (import.meta.env.DEV) console.warn("mapParameterToMIDI called on default MIDIContext"); },
  midiStateRef: { current: null }, // Added for default value consistency
};

const MIDIContext = createContext(defaultContextValue);

const midiActionsReducer = (state, action) => {
  switch (action.type) {
    case 'QUEUE_ACTION':
      return {
        ...state,
        pendingActions: [...state.pendingActions, action.payload],
      };
    case 'CLEAR_QUEUE':
      return {
        ...state,
        pendingActions: [],
      };
    default:
      return state;
  }
};

const initialState = { pendingActions: [] };


const normalizeMIDIValue = (value, type = 'cc') => {
  if (type === 'pitchbend') return Math.max(0, Math.min(1, value / 16383));
  return Math.max(0, Math.min(1, value / 127));
};

const getMidiMessageType = (status) => {
  const type = status & 0xF0;
  switch (type) {
    case 0x80: return 'Note Off'; case 0x90: return 'Note On'; case 0xA0: return 'Poly Aftertouch';
    case 0xB0: return 'Control Change'; case 0xC0: return 'Program Change'; case 0xD0: return 'Channel Aftertouch';
    case 0xE0: return 'Pitch Bend';
    case 0xF0:
      switch (status) {
        case 0xF0: return 'SysEx Start'; case 0xF1: return 'MIDI Time Code Qtr Frame'; case 0xF2: return 'Song Position Pointer';
        case 0xF3: return 'Song Select'; case 0xF6: return 'Tune Request'; case 0xF7: return 'SysEx End';
        case 0xF8: return 'Timing Clock'; case 0xFA: return 'Start'; case 0xFB: return 'Continue';
        case 0xFC: return 'Stop'; case 0xFE: return 'Active Sensing'; case 0xFF: return 'System Reset';
        default: return 'System Common';
      }
    default: return `Unknown (${type.toString(16)})`;
  }
};

export function MIDIProvider({ children }) {
  const { 
    stagedSetlist,
    updateGlobalMidiMap,
    updateLayerMidiMappings,
    isInitiallyResolved,
  } = useWorkspaceContext();
  
  const midiStateRef = useRef({ liveCrossfaderValue: null });
  
  const [midiAccess, setMidiAccess] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [midiInputs, setMidiInputs] = useState([]);
  const [midiLearning, setMidiLearning] = useState(null);
  const [learningLayer, setLearningLayer] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(0);
  const [midiMonitorData, setMidiMonitorData] = useState([]);
  const [showMidiMonitor, setShowMidiMonitor] = useState(false);
  const [midiActionState, dispatch] = useReducer(midiActionsReducer, initialState);
  const { pendingActions } = midiActionState;

  const activeMidiMap = useMemo(() => stagedSetlist?.globalUserMidiMap || {}, [stagedSetlist]);
  const activeControllerMidiMapRef = useRef(activeMidiMap);
  const midiLearningRef = useRef(midiLearning);
  const learningLayerRef = useRef(learningLayer);
  const selectedChannelRef = useRef(selectedChannel);
  const connectionInProgressRef = useRef(false);
  const connectTimeoutRef = useRef(null);
  const isUnmountingRef = useRef(false);
  const midiAccessRefForCallbacks = useRef(midiAccess);
  const handleMIDIMessageRef = useRef(null);
  const isConnectedRef = useRef(isConnected);

  const layerMappings = useMemo(() => activeMidiMap?.layerSelects || {}, [activeMidiMap]);
  const layerMappingsRef = useRef(layerMappings);

  useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);
  useEffect(() => { activeControllerMidiMapRef.current = activeMidiMap; }, [activeMidiMap]);
  useEffect(() => { midiAccessRefForCallbacks.current = midiAccess; }, [midiAccess]);
  useEffect(() => { layerMappingsRef.current = layerMappings; }, [layerMappings]);
  useEffect(() => { midiLearningRef.current = midiLearning; }, [midiLearning]);
  useEffect(() => { learningLayerRef.current = learningLayer; }, [learningLayer]);
  useEffect(() => { selectedChannelRef.current = selectedChannel; }, [selectedChannel]);

  useEffect(() => {
    const handleForceEndLoading = () => {
      if (connectionInProgressRef.current) {
        if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
        setIsConnecting(false);
        connectionInProgressRef.current = false;
        setError("Connection attempt force-ended.");
      }
    };
    document.addEventListener('force-end-loading', handleForceEndLoading);
    return () => document.removeEventListener('force-end-loading', handleForceEndLoading);
  }, []);

  const mapParameterToMIDI = useCallback((param, layer, mappingData) => {
    const currentMap = activeMidiMap || {};
    const updatedActiveMap = {
      ...currentMap,
      [String(layer)]: {
        ...(currentMap[String(layer)] || {}),
        [param]: mappingData
      }
    };
    updateGlobalMidiMap(updatedActiveMap);
  }, [activeMidiMap, updateGlobalMidiMap]);

  const clearAllMappings = useCallback(() => {
    if (window.confirm("Are you sure you want to reset ALL persistent MIDI parameter mappings? This will be staged until you save.")) {
      updateGlobalMidiMap({});
    }
  }, [updateGlobalMidiMap]);

  const startMIDILearn = useCallback((param, layer) => {
    setMidiLearning({ type: 'param', param, layer });
    setLearningLayer(null);
  }, []);
  const startGlobalMIDILearn = useCallback((controlName) => {
    setMidiLearning({ type: 'global', control: controlName });
    setLearningLayer(null);
  }, []);
  const stopMIDILearn = useCallback(() => { if (midiLearningRef.current) setMidiLearning(null); }, []);
  const startLayerMIDILearn = useCallback((layer) => { setLearningLayer(layer); setMidiLearning(null); }, []);
  const stopLayerMIDILearn = useCallback(() => { if (learningLayerRef.current !== null) setLearningLayer(null); }, []);

  const handleMIDIMessage = useCallback((message) => {
    if (!message || !message.data || message.data.length === 0) return;
    const [status, data1, data2] = message.data;
    const msgChan = status & 0x0F;
    const msgType = getMidiMessageType(status);
    const timestamp = Date.now();

    setMidiMonitorData(prev => {
      const newEntry = { timestamp: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit', second:'2-digit', fractionalSecondDigits: 3 }), status, data1, data2, channel: msgChan + 1, type: msgType };
      const updated = [...prev, newEntry];
      return updated.length > MAX_MONITOR_ENTRIES ? updated.slice(-MAX_MONITOR_ENTRIES) : updated;
    });
    
    if (selectedChannelRef.current > 0 && (msgChan + 1) !== selectedChannelRef.current) return;

    const isCC = msgType === 'Control Change';
    const isNoteOn = msgType === 'Note On' && data2 > 0;
    const isPitch = msgType === 'Pitch Bend';

    if (midiLearningRef.current) {
      if (isCC || isNoteOn || isPitch) {
        const mappingData = { type: isCC ? 'cc' : (isNoteOn ? 'note' : 'pitchbend'), number: data1, channel: msgChan };
        const currentLearningState = midiLearningRef.current;

        if (currentLearningState.type === 'param' && currentLearningState.param && currentLearningState.layer) {
          mapParameterToMIDI(currentLearningState.param, currentLearningState.layer, mappingData);
        } else if (currentLearningState.type === 'global' && currentLearningState.control) {
          const currentMap = activeControllerMidiMapRef.current || {};
          const updatedActiveMap = {
            ...currentMap,
            global: {
              ...(currentMap.global || {}),
              [currentLearningState.control]: mappingData
            }
          };
          updateGlobalMidiMap(updatedActiveMap);
        }
        
        stopMIDILearn();
      }
      return;
    }

    if (learningLayerRef.current !== null) {
      if (isNoteOn) {
        const mappingData = { type: 'note', number: data1, channel: msgChan };
        updateLayerMidiMappings(learningLayerRef.current, mappingData);
        stopLayerMIDILearn();
      }
      return;
    }

    if (!isCC && !isNoteOn && !isPitch) return;

    const currentControllerMap = activeControllerMidiMapRef.current || {};
    const globalMappings = currentControllerMap.global;

    if (globalMappings) {
        const discreteActions = {
            'nextScene': { type: 'nextScene' },
            'prevScene': { type: 'prevScene' },
            'nextWorkspace': { type: 'nextWorkspace' },
            'prevWorkspace': { type: 'prevWorkspace' },
            'pLockToggle': { type: 'globalAction', action: 'pLockToggle' }
        };

        for (const actionName in discreteActions) {
            const mapping = globalMappings[actionName];
            if (!mapping) continue;

            let isMatch = (mapping.type === 'note' && isNoteOn && mapping.number === data1) ||
                          (mapping.type === 'cc' && isCC && mapping.number === data1);
            
            if (isMatch && (mapping.channel === undefined || mapping.channel === msgChan)) {
                const { type, action } = discreteActions[actionName];
                const payload = action ? { type, action, timestamp } : { type, timestamp };
                dispatch({ type: 'QUEUE_ACTION', payload });
                return;
            }
        }

        const crossfaderMapping = globalMappings['crossfader'];
        if (crossfaderMapping) {
            let isMatch = false;
            let rawValue = data2;
            let midiMsgType = 'cc';

            if (crossfaderMapping.type === 'cc' && isCC && Number(crossfaderMapping.number) === Number(data1) && (crossfaderMapping.channel === undefined || Number(crossfaderMapping.channel) === Number(msgChan))) {
                isMatch = true;
            } else if (crossfaderMapping.type === 'pitchbend' && isPitch && (crossfaderMapping.channel === undefined || Number(crossfaderMapping.channel) === Number(msgChan))) {
                isMatch = true;
                rawValue = (data2 << 7) | data1;
                midiMsgType = 'pitchbend';
            }

            if(isMatch) {
                const normalizedValue = normalizeMIDIValue(rawValue, midiMsgType);
                if (midiStateRef) {
                  midiStateRef.current.liveCrossfaderValue = normalizedValue;
                }
                dispatch({ type: 'QUEUE_ACTION', payload: { type: 'crossfaderUpdate', value: normalizedValue, timestamp } });
                return;
            }
        }
    }


    if (isNoteOn) {
        for (const layerId in layerMappingsRef.current) {
            const lsm = layerMappingsRef.current[layerId];
            if (lsm?.type === 'note' && lsm.number === data1 && (lsm.channel === undefined || lsm.channel === msgChan)) {
                dispatch({ type: 'QUEUE_ACTION', payload: { type: 'layerSelect', layer: parseInt(layerId, 10), timestamp } });
                return;
            }
        }
    }
    
    for (const layerIdStr in currentControllerMap) {
        if (layerIdStr === 'global' || layerIdStr === 'layerSelects') continue;

        const layerParams = currentControllerMap[layerIdStr];
        if (typeof layerParams !== 'object' || layerParams === null) continue;

        for (const paramName in layerParams) {
            const mappingData = layerParams[paramName];
            if (!mappingData) continue;

            let isMatch = false;
            let rawValue = data2;
            let midiMsgTypeForNormalization = 'cc';

            if (mappingData.type === 'cc' && isCC && Number(mappingData.number) === Number(data1) && (mappingData.channel === undefined || Number(mappingData.channel) === Number(msgChan))) {
                isMatch = true; rawValue = data2;
            } else if (mappingData.type === 'note' && isNoteOn && Number(mappingData.number) === Number(data1) && (mappingData.channel === undefined || Number(mappingData.channel) === Number(msgChan))) {
                isMatch = true; rawValue = data2;
            } else if (mappingData.type === 'pitchbend' && isPitch && (mappingData.channel === undefined || Number(mappingData.channel) === Number(msgChan))) {
                isMatch = true; rawValue = (data2 << 7) | data1; midiMsgTypeForNormalization = 'pitchbend';
            }

            if (isMatch) {
                const currentNormalizedMidiVal = normalizeMIDIValue(rawValue, midiMsgTypeForNormalization);
                dispatch({ type: 'QUEUE_ACTION', payload: { type: 'paramUpdate', layer: parseInt(layerIdStr, 10), param: paramName, value: currentNormalizedMidiVal, timestamp } });
                return;
            }
        }
    }
  }, [mapParameterToMIDI, stopMIDILearn, updateGlobalMidiMap, stopLayerMIDILearn, updateLayerMidiMappings, midiStateRef]);

  useEffect(() => { handleMIDIMessageRef.current = handleMIDIMessage; }, [handleMIDIMessage]);
  
  const processMidiInputs = useCallback((midiAccessObject) => {
    if (!midiAccessObject) return;
    const currentInputs = [];
    let anyDevicePhysicallyConnected = false;
    
    const messageHandlerWrapper = (message) => { 
      if (handleMIDIMessageRef.current) handleMIDIMessageRef.current(message); 
    };

    midiAccessObject.inputs.forEach(input => {
      currentInputs.push({ id: input.id, name: input.name || `Input ${input.id}`, manufacturer: input.manufacturer || 'Unknown', state: input.state });
      
      if (input.state === 'connected') {
        anyDevicePhysicallyConnected = true;
        if (isInitiallyResolved) {
            try {
                if (input.onmidimessage !== messageHandlerWrapper) {
                    input.onmidimessage = messageHandlerWrapper;
                }
            } catch (e) {
                if (import.meta.env.DEV) console.error(`[MIDI] FAILED to attach listener for device: ${input.name}. Error:`, e);
            }
        } else {
            if (input.onmidimessage) {
                input.onmidimessage = null;
            }
        }
      } else {
        if (input.onmidimessage) {
          input.onmidimessage = null;
        }
      }
    });

    setMidiInputs(currentInputs);
    
    if (!anyDevicePhysicallyConnected) {
      setError("No MIDI devices found or connected.");
      setIsConnected(false);
    } else {
      setError(null);
      setIsConnected(true);
    }
  }, [isInitiallyResolved]);

  useEffect(() => {
    if (isInitiallyResolved && midiAccess) {
      processMidiInputs(midiAccess);
    }
  }, [isInitiallyResolved, midiAccess, processMidiInputs]);

  const handleStateChange = useCallback((event) => {
    const currentMidiAccess = midiAccessRefForCallbacks.current;
    if (!currentMidiAccess) return;
    processMidiInputs(currentMidiAccess);
  }, [processMidiInputs]);

  const connectMIDI = useCallback(async () => {
    if (connectionInProgressRef.current || isConnectedRef.current) return midiAccessRefForCallbacks.current;
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      setError("Web MIDI API not supported");
      return null;
    }
    connectionInProgressRef.current = true;
    setIsConnecting(true);
    setError(null);
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    connectTimeoutRef.current = setTimeout(() => {
      if (connectionInProgressRef.current) {
        setError("MIDI connection timed out.");
        setIsConnecting(false);
        connectionInProgressRef.current = false;
      }
    }, MIDI_CONNECT_TIMEOUT_MS);

    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      if (isUnmountingRef.current) return null;

      setMidiAccess(access);
      access.onstatechange = handleStateChange;
      
      processMidiInputs(access);
      
      return access;
    } catch (err) {
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      const errorMessage = err.message || err.name || 'Unknown MIDI access error';
      setError(`MIDI access failed: ${errorMessage}`);
      setMidiAccess(null);
      setIsConnected(false);
      return null;
    } finally {
      if (connectionInProgressRef.current) {
        setIsConnecting(false);
        connectionInProgressRef.current = false;
      }
    }
  }, [handleStateChange, processMidiInputs]);
  
  const disconnectMIDI = useCallback((forceFullDisconnect = false) => {
    const isDevelopment = import.meta.env.DEV;
    const isFinalUnmount = isUnmountingRef.current && forceFullDisconnect;
    const currentMidiAccess = midiAccessRefForCallbacks.current;
    if (currentMidiAccess) {
      if (currentMidiAccess.onstatechange) currentMidiAccess.onstatechange = null;
      currentMidiAccess.inputs.forEach(input => {
        if (input.onmidimessage) input.onmidimessage = null;
      });
    }
    if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null; }
    connectionInProgressRef.current = false;
    if (forceFullDisconnect || isFinalUnmount || !isDevelopment) {
      setMidiAccess(null);
      setIsConnected(false);
      setIsConnecting(false);
      setMidiInputs([]);
      setError(null);
    } else {
      setIsConnecting(false);
    }
  }, []);

  const setChannelFilter = useCallback((channel) => {
    const ch = parseInt(String(channel), 10);
    if (!isNaN(ch) && ch >= 0 && ch <= 16) {
      setSelectedChannel(ch);
    }
  }, []);
  const clearMIDIMonitor = useCallback(() => { setMidiMonitorData([]); }, []);
  
  const clearPendingActions = useCallback(() => {
    dispatch({ type: 'CLEAR_QUEUE' });
  }, []);

  useEffect(() => {
    isUnmountingRef.current = false;
    return () => {
      isUnmountingRef.current = true;
      disconnectMIDI(true);
    };
  }, [disconnectMIDI]);

  const contextValue = useMemo(() => ({
    midiAccess, isConnected, isConnecting, error, midiInputs,
    midiMap: activeMidiMap,
    layerMappings, midiLearning, learningLayer, selectedChannel,
    midiMonitorData, showMidiMonitor, pendingActions,
    setShowMidiMonitor,
    connectMIDI, disconnectMIDI, startMIDILearn, stopMIDILearn,
    startLayerMIDILearn, stopLayerMIDILearn, clearAllMappings, setChannelFilter,
    clearMIDIMonitor, mapParameterToMIDI, clearPendingActions,
    startGlobalMIDILearn,
    midiStateRef,
  }), [
    midiAccess, isConnected, isConnecting, error, midiInputs, 
    activeMidiMap,
    layerMappings, midiLearning, learningLayer, selectedChannel,
    midiMonitorData, showMidiMonitor, pendingActions,
    connectMIDI, disconnectMIDI, clearAllMappings, mapParameterToMIDI,
    setChannelFilter, clearMIDIMonitor, setShowMidiMonitor, clearPendingActions, stopMIDILearn,
    startMIDILearn, startLayerMIDILearn, stopLayerMIDILearn,
    startGlobalMIDILearn,
    midiStateRef,
  ]);

  return (
    <MIDIContext.Provider value={contextValue}>
      {children}
    </MIDIContext.Provider>
  );
}

MIDIProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Custom hook to consume the MIDIContext.
 * @returns {object} The current value of the MIDIContext.
 */
export const useMIDI = () => {
  const context = useContext(MIDIContext);
  if (context === undefined) {
    throw new Error("useMIDI must be used within a MIDIProvider");
  }
  return context;
};
```

---
### `src\context\NotificationContext.jsx`
```jsx
// src/context/NotificationContext.jsx
import React, { createContext, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useNotifications } from '../hooks/useNotifications';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const notificationData = useNotifications();

  const contextValue = useMemo(() => ({
    notifications: notificationData.notifications,
    addNotification: notificationData.addNotification,
    onMarkNotificationRead: notificationData.markAsRead,
    onClearAllNotifications: notificationData.clearAll,
    unreadCount: notificationData.unreadCount,
  }), [notificationData]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

NotificationProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotificationContext must be used within a NotificationProvider");
  }
  return context;
};
```

---
### `src\context\ToastContext.jsx`
```jsx
// src/context/ToastContext.jsx
import React, { createContext, useState, useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';

/**
 * @typedef {'info' | 'success' | 'warning' | 'error'} ToastType - The type of the toast, influencing its appearance.
 */

/**
 * @typedef {object} ToastMessage
 * @property {number} id - Unique identifier for the toast message.
 * @property {string | React.ReactNode} content - The content of the toast message. Can be a string or a React node.
 * @property {ToastType} type - The type of the toast (e.g., 'info', 'success').
 * @property {number | null} duration - The duration in milliseconds for which the toast should be visible. If null, it remains until manually dismissed.
 */

/**
 * @typedef {object} ToastContextValue
 * @property {(content: string | React.ReactNode, type?: ToastType, duration?: number | null) => void} addToast - Function to add a new toast notification.
 * @property {(id: number) => void} removeToast - Function to remove a toast notification by its ID.
 * @property {Array<ToastMessage>} toasts - An array of the currently active toast notifications.
 */

/**
 * Default context value for ToastContext.
 * Provides no-op functions and an empty toasts array if used outside a provider.
 * @type {ToastContextValue}
 */
const defaultToastContextValue = {
  addToast: (content, type, duration) => {
    if (import.meta.env.DEV) {
      console.warn("addToast called on default ToastContext. Ensure ToastProvider is an ancestor.", { content, type, duration });
    }
  },
  removeToast: (id) => {
    if (import.meta.env.DEV) {
      console.warn("removeToast called on default ToastContext. Ensure ToastProvider is an ancestor.", { id });
    }
  },
  toasts: [],
};

const ToastContext = createContext(defaultToastContextValue);

/** @type {number} Simple counter to generate unique IDs for toast messages. */
let idCounter = 0;

/**
 * ToastProvider: Manages the state for displaying toast notifications.
 * It provides functions to add and remove toasts, and exposes the current list of toasts
 * to consuming components. Toasts can have a type, content, and an optional auto-dismiss duration.
 *
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The child components that will have access to this context.
 * @returns {JSX.Element} The ToastProvider component.
 */
export const ToastProvider = ({ children }) => {
  /** @type {[Array<ToastMessage>, React.Dispatch<React.SetStateAction<Array<ToastMessage>>>]} */
  const [toasts, setToasts] = useState([]);

  /**
   * Removes a toast notification from the list by its unique ID.
   * This function is memoized for stability.
   * @param {number} id - The ID of the toast to remove.
   */
  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []); // setToasts is stable

  /**
   * Adds a new toast notification to the list.
   * If a `duration` is provided, the toast will automatically be removed after that time.
   * This function is memoized and depends on the stable `removeToast` callback.
   * @param {string | React.ReactNode} content - The message or React node to display in the toast.
   * @param {ToastType} [type='info'] - The type of the toast, affecting its style.
   * @param {number | null} [duration=5000] - The duration in milliseconds for the toast to be visible.
   *                                         Pass `null` or `0` for a toast that does not auto-dismiss.
   */
  const addToast = useCallback((content, type = 'info', duration = 5000) => {
    const id = idCounter++; // Generate a new unique ID
    setToasts((prevToasts) => [...prevToasts, { id, content, type, duration }]);

    // Set a timer to automatically remove the toast if a positive duration is provided
    if (duration && duration > 0) {
      setTimeout(() => {
        removeToast(id); // Call the stable removeToast function
      }, duration);
    }
  }, [removeToast]); // Depends on the stable removeToast callback

  // Memoize the context value to prevent unnecessary re-renders of consumers
  // when the provider's parent re-renders but these specific values haven't changed.
  const contextValue = useMemo(() => ({
    addToast,
    removeToast,
    toasts
  }), [addToast, removeToast, toasts]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
    </ToastContext.Provider>
  );
};

ToastProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Custom hook to consume the `ToastContext`.
 * Provides access to the `addToast` and `removeToast` functions, and the `toasts` array.
 * It ensures that the hook is used within a `ToastProvider` and throws an error if not.
 *
 * @returns {ToastContextValue} The current value of the ToastContext.
 * @throws {Error} If the hook is not used within a `ToastProvider`.
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) { // Standard check for missing provider
    const err = new Error('useToast must be used within a ToastProvider component.');
    if (import.meta.env.DEV) {
        console.error("useToast context details: Attempted to use context but found undefined. This usually means ToastProvider is missing as an ancestor of the component calling useToast.", err.stack);
    }
    throw err;
  }
  return context;
};
```

---
### `src\context\UpProvider.jsx`
```jsx
// src/context/UpProvider.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import PropTypes from 'prop-types';

import { createClientUPProvider } from "@lukso/up-provider"; // Lukso UP Provider
import {
  createWalletClient,
  createPublicClient,
  custom, // For Viem transport with EIP-1193 provider
  http,   // For Viem public client transport
  numberToHex,
  getAddress, // <<< ADDED IMPORT
} from "viem";
import { lukso, luksoTestnet } from "viem/chains"; // Supported Viem chain definitions

/**
 * Normalizes a chain ID to its hexadecimal string representation (e.g., "0x2a").
 * Handles number, decimal string, or hex string inputs.
 * @param {string|number|null|undefined} chainId - The chain ID to normalize.
 * @returns {string|null} The normalized hex chain ID (lowercase) or null if input is invalid.
 */
const normalizeChainId = (chainId) => {
  if (chainId === null || chainId === undefined) return null;
  if (typeof chainId === "number") {
    return numberToHex(chainId);
  }
  if (typeof chainId === "string") {
    const lower = chainId.toLowerCase().trim();
    if (/^0x[0-9a-f]+$/.test(lower)) return lower; // Already hex
    try {
      const num = parseInt(lower, 10); // Try parsing as decimal
      if (!isNaN(num) && num >= 0) return numberToHex(num);
    // eslint-disable-next-line no-unused-vars
    } catch (_) {
      // Ignore parse error, try hex without 0x
    }
    if (/^[0-9a-f]+$/.test(lower)) return `0x${lower}`; // Add 0x if missing
  }
  if (import.meta.env.DEV) {
    console.warn("[UpProvider] Invalid chainId format provided for normalization:", chainId);
  }
  return null;
};

// Supported chains configuration, keyed by normalized chain ID
const VIEM_CHAINS = {
  [/** @type {string} */ (normalizeChainId(lukso.id))]: lukso,
  [/** @type {string} */ (normalizeChainId(luksoTestnet.id))]: luksoTestnet,
};

// RPC URLs from environment variables with fallbacks
const LUKSO_MAINNET_RPC = import.meta.env.VITE_LUKSO_MAINNET_RPC_URL || "https://rpc.mainnet.lukso.network";
const LUKSO_TESTNET_RPC = import.meta.env.VITE_LUKSO_TESTNET_RPC_URL || "https://rpc.testnet.lukso.network";

const RPC_URLS = {
  [/** @type {string} */ (normalizeChainId(lukso.id))]: LUKSO_MAINNET_RPC,
  [/** @type {string} */ (normalizeChainId(luksoTestnet.id))]: LUKSO_TESTNET_RPC,
};

// Map of supported chain objects, keyed by normalized chain ID
const SUPPORTED_CHAINS = {
  [/** @type {string} */ (normalizeChainId(lukso.id))]: VIEM_CHAINS[/** @type {string} */ (normalizeChainId(lukso.id))],
  [/** @type {string} */ (normalizeChainId(luksoTestnet.id))]: VIEM_CHAINS[/** @type {string} */ (normalizeChainId(luksoTestnet.id))],
};

// --- Context Definition ---
/**
 * @typedef {object} UpProviderState
 * @property {object|null} provider - The raw EIP-1193 UP Provider instance from `@lukso/up-provider`. Null if `createClientUPProvider` fails.
 * @property {import('viem').WalletClient|null} walletClient - Viem Wallet Client configured for the UP. Null if provider, chain, or EOA is unavailable/invalid.
 * @property {import('viem').PublicClient|null} publicClient - Viem Public Client for the current chain. Null if chain is unsupported or RPC URL is missing.
 * @property {string|null} chainId - The current hexadecimal chain ID (e.g., '0x2a' for LUKSO Mainnet), or null if unsupported/disconnected.
 * @property {Array<string>} accounts - Array of EOA addresses controlled by the user, provided by the UP extension. `accounts[0]` is typically the active EOA.
 * @property {Array<string>} contextAccounts - Array of UP addresses relevant to the current context (e.g., the profile being viewed). `contextAccounts[0]` is the primary context UP.
 * @property {boolean} walletConnected - True if the provider is considered connected (valid chain, EOA accounts, and context UP accounts are present).
 * @property {boolean} isConnecting - Always false in this implementation; connection status is derived from events and available data. Kept for potential API consistency if other providers manage explicit connection states.
 * @property {Error|null} initializationError - Error object if `createClientUPProvider` failed during initial module load.
 * @property {Error|null} fetchStateError - Error object from Viem public or wallet client creation attempts.
 * @property {boolean} hasCriticalError - True if `initializationError` is present, indicating a fundamental issue with the UP provider setup.
 */

/** @type {React.Context<UpProviderState | undefined>} */
const UpContext = createContext(undefined);

// --- UP Provider Instance Creation ---
let upProviderInstance = null;
/** @type {Error | null} */
let upProviderInitializationError = null;

if (typeof window !== "undefined" && typeof window.ethereum !== "undefined") {
  try {
    upProviderInstance = createClientUPProvider();
  } catch (error) {
    if (import.meta.env.DEV) {
        console.error("[UpProvider] CRITICAL: Error creating Client UP Provider instance:", error);
    }
    upProviderInitializationError = error instanceof Error ? error : new Error(String(error));
  }
} else if (typeof window !== "undefined" && import.meta.env.DEV) {
    console.warn("[UpProvider] window.ethereum (Universal Profile Extension) not detected. UP Provider not initialized.");
    upProviderInitializationError = new Error("Universal Profile Extension (window.ethereum) not detected.");
}


/**
 * Custom hook `useUpProvider` to consume `UpContext`.
 * @returns {UpProviderState} The current state of the UpProvider.
 * @throws {Error} If used outside of an `UpProvider`.
 */
export function useUpProvider() {
  const context = useContext(UpContext);
  if (context === undefined) {
    const err = new Error("useUpProvider must be used within an UpProvider component.");
    if (import.meta.env.DEV) {
        console.error("useUpProvider context details: Attempted to use context but found undefined. This usually means UpProvider is missing as an ancestor.", err.stack);
    }
    throw err;
  }
  return context;
}

/**
 * `UpProvider` component.
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Child components that will consume this context.
 * @returns {JSX.Element} The UpProvider component.
 */
export function UpProvider({ children }) {
  const [provider] = useState(upProviderInstance);
  const [initializationError] = useState(upProviderInitializationError);
  /** @type {[string | null, React.Dispatch<React.SetStateAction<string | null>>]} */
  const [chainId, setChainId] = useState(null);
  /** @type {[Array<string>, React.Dispatch<React.SetStateAction<Array<string>>>]} */
  const [accounts, setAccounts] = useState([]);
  /** @type {[Array<string>, React.Dispatch<React.SetStateAction<Array<string>>>]} */
  const [contextAccounts, setContextAccounts] = useState([]);
  const [walletConnected, setWalletConnected] = useState(false);
  /** @type {[Error | null, React.Dispatch<React.SetStateAction<Error | null>>]} */
  const [fetchStateError, setFetchStateError] = useState(null);

  const hasCriticalError = useMemo(() => !!initializationError, [initializationError]);
  const currentChain = useMemo(() => chainId && SUPPORTED_CHAINS[chainId] ? SUPPORTED_CHAINS[chainId] : null, [chainId]);
  const connectedEOA = useMemo(() => (accounts?.length > 0 ? accounts[0] : null), [accounts]);

  const publicClient = useMemo(() => {
    if (!currentChain || !chainId) return null;
    try {
      const rpcUrl = RPC_URLS[chainId];
      if (!rpcUrl) {
        throw new Error(`No configured RPC URL for chain ${chainId}`);
      }
      const transport = http(rpcUrl, { retryCount: 3 });
      return createPublicClient({ chain: currentChain, transport });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("[UpProvider] Error creating public client:", error);
      }
      setFetchStateError(error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }, [currentChain, chainId]);

  const walletClient = useMemo(() => {
    if (hasCriticalError || !provider || !currentChain || !connectedEOA) return null;
    try {
      const eoaForClient = getAddress(/** @type {`0x${string}`} */ (connectedEOA)); // Ensure checksummed and cast for Viem
      return createWalletClient({ chain: currentChain, transport: custom(provider), account: eoaForClient });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("[UpProvider] Error creating wallet client:", error);
      }
      setFetchStateError(error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }, [provider, currentChain, connectedEOA, hasCriticalError]);

  const updateConnectedStatus = useCallback(() => {
    const connected = !!chainId &&
                      !!SUPPORTED_CHAINS[chainId] &&
                      accounts.length > 0 &&
                      contextAccounts.length > 0;
    setWalletConnected(connected);
  }, [chainId, accounts, contextAccounts]);

  useEffect(() => {
    if (initializationError) {
      if (import.meta.env.DEV) {
        console.error("[UpProvider] Setup skipped due to UP provider initialization error.");
      }
      setWalletConnected(false);
      return;
    }
    if (!provider) {
      if (import.meta.env.DEV) {
        console.warn("[UpProvider] Setup skipped: Client UP Provider instance not available (likely no UP extension).");
      }
      setWalletConnected(false);
      return;
    }

    /** @type {{ current: boolean }} */
    const mountedRef = { current: true };

    try {
      const _initialAccounts = provider.accounts || [];
      const _initialContextAccounts = provider.contextAccounts || [];
      if (mountedRef.current) {
        setAccounts(_initialAccounts);
        setContextAccounts(_initialContextAccounts);
      }

      provider.request({ method: "eth_chainId" })
        .then(rawChainId => {
          if (!mountedRef.current) return;
          const normalizedId = normalizeChainId(rawChainId);
          const isValid = !!normalizedId && normalizedId !== "0x0" && !!SUPPORTED_CHAINS[normalizedId];
          setChainId(isValid ? normalizedId : null);
          updateConnectedStatus();
        })
        .catch(err => {
            if (import.meta.env.DEV) console.warn("[UpProvider] Error fetching initial chainId:", err);
            if (mountedRef.current) { setChainId(null); updateConnectedStatus(); }
        });
      updateConnectedStatus();
    } catch (err) {
      if (import.meta.env.DEV) console.error("[UpProvider] Error accessing initial provider properties:", err);
      provider.request({ method: "eth_accounts" })
        .then(_fallbackAccounts => {
          if (!mountedRef.current) return;
          setAccounts(_fallbackAccounts || []);
          updateConnectedStatus();
        })
        .catch(fallbackErr => {
            if (import.meta.env.DEV) console.warn("[UpProvider] Error fetching initial accounts (fallback):", fallbackErr);
            if (mountedRef.current) { setAccounts([]); updateConnectedStatus(); }
        });
    }

    const handleAccountsChanged = (_newAccounts) => {
      if (!mountedRef.current) return;
      const newAccs = Array.isArray(_newAccounts) ? _newAccounts : [];
      setAccounts(newAccs);
      updateConnectedStatus();
    };

    const handleChainChanged = (rawChainId) => {
      if (!mountedRef.current) return;
      const normalizedId = normalizeChainId(rawChainId);
      const isValidChain = !!normalizedId && normalizedId !== "0x0" && !!SUPPORTED_CHAINS[normalizedId];
      setChainId(isValidChain ? normalizedId : null);
      if (!isValidChain) {
          if (import.meta.env.DEV) console.warn("[UpProvider Event] Chain changed to invalid/unsupported. Clearing accounts.");
          setAccounts([]);
          setContextAccounts([]);
      }
      updateConnectedStatus();
    };

    const handleContextAccountsChanged = (_newContextAccounts) => {
      if (!mountedRef.current) return;
      const newContextAccs = Array.isArray(_newContextAccounts) ? _newContextAccounts : [];
      setContextAccounts(newContextAccs);
      updateConnectedStatus();
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);
    provider.on("contextAccountsChanged", handleContextAccountsChanged);

    return () => {
      mountedRef.current = false;
      if (provider?.removeListener) {
        provider.removeListener("accountsChanged", handleAccountsChanged);
        provider.removeListener("chainChanged", handleChainChanged);
        provider.removeListener("contextAccountsChanged", handleContextAccountsChanged);
      }
    };
  }, [provider, initializationError, updateConnectedStatus]);

  const contextValue = useMemo(
    () => ({
      provider,
      walletClient,
      publicClient,
      chainId,
      accounts,
      contextAccounts,
      walletConnected,
      isConnecting: false,
      initializationError,
      fetchStateError,
      hasCriticalError,
    }),
    [
      provider, walletClient, publicClient, chainId, accounts, contextAccounts,
      walletConnected, initializationError, fetchStateError, hasCriticalError,
    ],
  );

  return (
    <UpContext.Provider value={contextValue}>{children}</UpContext.Provider>
  );
}

UpProvider.propTypes = {
    children: PropTypes.node.isRequired,
};
```

---
### `src\context\UpServerProvider.js`
```js
// src/utils/upHostConnector.js (Example filename, adjust as needed)
import { createUPProviderConnector } from "@lukso/up-provider";

/**
 * Initializes the Universal Profile (UP) Provider Connector for the host environment (the main window).
 * This setup allows embedded iframes (MiniApps), which use the client-side UP Provider,
 * to securely connect and interact with the user's UP browser extension via this host application.
 *
 * This function should only be called when the application is determined to be running
 * in the top-level window context (i.e., not inside an iframe).
 *
 * The connector listens for new communication channels from MiniApps and enables them.
 * It relies on the standard EIP-1193 events (`chainChanged`, `accountsChanged`) being relayed
 * by the connector to inform MiniApps of state changes, rather than pushing initial state directly,
 * to prevent potential state conflicts or race conditions.
 *
 * @returns {void}
 */
export function initializeHostUPConnector() {
  try {
    // Attempt to get the host's EIP-1193 provider (typically the UP extension)
    const hostProvider = window.lukso || window.ethereum;
    if (!hostProvider) {
      // This is a critical issue if the host is expected to have a UP extension.
      if (import.meta.env.DEV) {
        console.error("[UP Host Connector] No host provider (window.lukso or window.ethereum) found. UP Connector cannot be initialized.");
      }
      return;
    }

    // The RPC URL provided here is a fallback or for specific configurations.
    // The hostProvider (UP extension) itself dictates the actual network connection.
    // Using a Mainnet RPC is a common default if no other specific network is targeted by the host setup.
    const connector = createUPProviderConnector(hostProvider, [
      "https://rpc.lukso.network", // LUKSO Mainnet RPC endpoint (can be made configurable if needed)
      // Add other RPCs if your host application might switch networks and needs to inform the connector.
    ]);

    // Listen for new channels created by MiniApps attempting to connect.
    connector.on("channelCreated", (id, channel) => {
      // When a MiniApp (identified by `id`) creates a channel, enable it.
      // The `channel.enable = true` step is crucial for establishing communication.
      //
      // IMPORTANT: Do NOT push initial state (like chainId or accounts) directly to the channel here.
      // The client UP Provider in the MiniApp should request this information using standard
      // EIP-1193 methods (e.g., `eth_chainId`, `eth_accounts`) after connection, or listen for
      // standard EIP-1193 events (`chainChanged`, `accountsChanged`) that the connector
      // should automatically relay from the hostProvider. Pushing state here can lead to
      // race conditions or state inconsistencies, potentially disabling the connect button
      // in the MiniApp or causing other unexpected behavior.
      try {
        channel.enable = true; // Enable the communication channel with the MiniApp.
        if (import.meta.env.DEV) {
          // console.log(`[UP Host Connector] Enabled communication channel for MiniApp ID: ${id}`);
        }
      } catch (error) {
        // This is a critical error if a channel cannot be enabled.
        if (import.meta.env.DEV) {
          console.error(`[UP Host Connector] CRITICAL: Error enabling channel for MiniApp ID ${id}:`, error);
        }
        // Consider additional error handling, e.g., attempting to disconnect the problematic channel
        // if (channel && typeof channel.disconnect === 'function') {
        //   channel.disconnect();
        // }
      }
    });

    if (import.meta.env.DEV) {
      // console.log("[UP Host Connector] Initialized successfully and listening for MiniApp connections.");
    }

  } catch (error) {
    // This indicates a fatal error during the connector's own initialization.
    if (import.meta.env.DEV) {
      console.error("[UP Host Connector] FATAL: Error initializing UPProviderConnector:", error);
    }
  }
}
```

---
### `src\context\UserSessionContext.jsx`
```jsx
// src/context/UserSessionContext.jsx
import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';

import { useUpProvider } from './UpProvider'; // Local context
import { RADAR_OFFICIAL_ADMIN_ADDRESS } from '../config/global-config.js'; // Local config

import { isAddress } from 'viem'; // Third-party utility

export const defaultUserSessionContextValue = {
  hostProfileAddress: null,
  visitorProfileAddress: null,
  isHostProfileOwner: false,
  isRadarProjectAdmin: false,
  isPreviewMode: false,
  canSaveToHostProfile: false,
  togglePreviewMode: () => {
    if (import.meta.env.DEV) {
      console.warn("togglePreviewMode called on default UserSessionContext. Ensure UserSessionProvider is an ancestor.");
    }
  },
};

const UserSessionContext = createContext(defaultUserSessionContextValue);

export const UserSessionProvider = ({ children }) => {
  const { accounts, contextAccounts } = useUpProvider();
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // --- START: CORRECTED LOGIC ---
  const hostProfileAddress = useMemo(() => {
    // The profile being viewed (the "host") is always the one provided by the extension's context.
    if (contextAccounts && contextAccounts.length > 0 && isAddress(contextAccounts[0])) {
      return contextAccounts[0];
    }
    return null;
  }, [contextAccounts]);

  const visitorProfileAddress = useMemo(() => {
    // The "visitor's" identity is also their active Universal Profile from the context.
    // In this app's design, the host and visitor are the same entity.
    if (contextAccounts && contextAccounts.length > 0 && isAddress(contextAccounts[0])) {
      return contextAccounts[0];
    }
    return null;
  }, [contextAccounts]);

  const isHostProfileOwner = useMemo(() => {
    // For the UI, we determine "ownership" by checking if a controller wallet (EOA) is connected.
    // The UP extension ensures this EOA has permissions for the active UP (hostProfileAddress).
    const hasController = accounts && accounts.length > 0 && isAddress(accounts[0]);
    return !!hasController && !!hostProfileAddress;
  }, [accounts, hostProfileAddress]);
  // --- END: CORRECTED LOGIC ---

  const isRadarProjectAdmin = useMemo(() => {
    if (!visitorProfileAddress || !RADAR_OFFICIAL_ADMIN_ADDRESS) return false;
    
    if (!isAddress(RADAR_OFFICIAL_ADMIN_ADDRESS)) {
        if (import.meta.env.DEV) {
            console.warn("[UserSessionContext] RADAR_OFFICIAL_ADMIN_ADDRESS in global-config.js is not a valid Ethereum address. isRadarProjectAdmin will always be false.");
        }
        return false;
    }
    return visitorProfileAddress.toLowerCase() === RADAR_OFFICIAL_ADMIN_ADDRESS.toLowerCase();
  }, [visitorProfileAddress]);

  const canSaveToHostProfile = useMemo(() => {
    return isHostProfileOwner && !isPreviewMode;
  }, [isHostProfileOwner, isPreviewMode]);

  const togglePreviewMode = useCallback(() => {
    setIsPreviewMode(prev => !prev);
  }, []);

  const contextValue = useMemo(() => {
    const val = {
      hostProfileAddress,
      visitorProfileAddress,
      isHostProfileOwner,
      isRadarProjectAdmin,
      isPreviewMode,
      canSaveToHostProfile,
      togglePreviewMode,
    };
    return val;
  }, [
    hostProfileAddress,
    visitorProfileAddress,
    isHostProfileOwner,
    isRadarProjectAdmin,
    isPreviewMode,
    canSaveToHostProfile,
    togglePreviewMode,
  ]);

  return (
    <UserSessionContext.Provider value={contextValue}>
      {children}
    </UserSessionContext.Provider>
  );
};

UserSessionProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useUserSession = () => {
  const context = useContext(UserSessionContext);
  if (context === undefined) {
    const err = new Error('useUserSession must be used within a UserSessionProvider component.');
    if (import.meta.env.DEV) {
        console.error("useUserSession context details: Attempted to use context but found undefined. This usually means UserSessionProvider is missing as an ancestor.", err.stack);
    }
    throw err;
  }
  return context;
};
```

---
### `src\context\VisualEngineContext.jsx`
```jsx
// src/context/VisualEngineContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useWorkspaceContext } from './WorkspaceContext';
import { useMIDI } from './MIDIContext';
import fallbackConfig from '../config/fallback-config.js';
import { lerp } from '../utils/helpers.js';
import { INTERPOLATED_MIDI_PARAMS } from '../config/midiConstants.js';

const AUTO_FADE_DURATION_MS = 1000;
const CROSSFADER_LERP_FACTOR = 0.2;

const usePrevious = (value) => {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

const VisualEngineContext = createContext();

export const VisualEngineProvider = ({ children }) => {
    const { 
        isWorkspaceTransitioning, isFullyLoaded, stagedActiveWorkspace, 
        fullSceneList, setActiveSceneName, setHasPendingChanges,
        activeSceneName 
    } = useWorkspaceContext();

    const { midiStateRef } = useMIDI();

    const [sideA, setSideA] = useState({ config: null });
    const [sideB, setSideB] = useState({ config: null });
    const [targetCrossfaderValue, setTargetCrossfaderValue] = useState(0.0);
    const [renderedCrossfaderValue, setRenderedCrossfaderValue] = useState(0.0);
    const renderedValueRef = useRef(0.0);
    const [isAutoFading, setIsAutoFading] = useState(false);
    const [targetSceneName, setTargetSceneName] = useState(null);
    
    const faderAnimationRef = useRef();
    const autoFadeRef = useRef(null);
  
    const managerInstancesRef = useRef(null);
    const canvasUpdateFnsRef = useRef({});
  
    const registerManagerInstancesRef = useCallback((ref) => {
      managerInstancesRef.current = ref;
    }, []);
  
    const registerCanvasUpdateFns = useCallback((fns) => {
      canvasUpdateFnsRef.current = fns;
    }, []);

    const prevIsWorkspaceTransitioning = usePrevious(isWorkspaceTransitioning);
    const prevIsFullyLoaded = usePrevious(isFullyLoaded);
    const prevActiveSceneName = usePrevious(activeSceneName);

    const uiControlConfig = useMemo(() => {
        return renderedValueRef.current < 0.5 ? sideA.config : sideB.config;
    }, [renderedCrossfaderValue, sideA.config, sideB.config]);

    useEffect(() => {
        return () => {
            if (faderAnimationRef.current) cancelAnimationFrame(faderAnimationRef.current);
            if (autoFadeRef.current) cancelAnimationFrame(autoFadeRef.current);
        };
    }, []);

    useEffect(() => {
        const animateFader = () => {
          const current = renderedValueRef.current;
          const target = targetCrossfaderValue;
          if (Math.abs(target - current) > 0.0001) {
            const newRendered = lerp(current, target, CROSSFADER_LERP_FACTOR);
            renderedValueRef.current = newRendered;
            setRenderedCrossfaderValue(newRendered);
          } else if (current !== target) {
            renderedValueRef.current = target;
            setRenderedCrossfaderValue(target);
          }
          faderAnimationRef.current = requestAnimationFrame(animateFader);
        };
        faderAnimationRef.current = requestAnimationFrame(animateFader);
        return () => { if (faderAnimationRef.current) cancelAnimationFrame(faderAnimationRef.current); };
    }, [targetCrossfaderValue]);

    const animateCrossfade = useCallback((startTime, startValue, endValue, duration, targetSceneNameParam) => {
        const now = performance.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const newCrossfaderValue = startValue + (endValue - startValue) * progress;
        setRenderedCrossfaderValue(newCrossfaderValue);
        renderedValueRef.current = newCrossfaderValue;
        if (progress < 1) {
            autoFadeRef.current = requestAnimationFrame(() => animateCrossfade(startTime, startValue, endValue, duration, targetSceneNameParam));
        } else {
            setIsAutoFading(false);
            setTargetCrossfaderValue(endValue);
            setActiveSceneName(targetSceneNameParam);
            setTargetSceneName(null);
            autoFadeRef.current = null;
        }
    }, [setIsAutoFading, setTargetCrossfaderValue, setActiveSceneName]);
    
    // --- START: UNIFIED LIFECYCLE AND PRELOADING EFFECT ---
    useEffect(() => {
        const initialLoadJustFinished = !prevIsFullyLoaded && isFullyLoaded;
        const transitionJustFinished = prevIsWorkspaceTransitioning && !isWorkspaceTransitioning;
        const sceneNameChanged = activeSceneName !== prevActiveSceneName;

        if (initialLoadJustFinished || transitionJustFinished) {
            const initialFaderValue = midiStateRef.current.liveCrossfaderValue !== null ? midiStateRef.current.liveCrossfaderValue : 0.0;
            
            if (!fullSceneList || fullSceneList.length === 0) {
                const baseScene = { name: "Fallback", ts: Date.now(), layers: JSON.parse(JSON.stringify(fallbackConfig.layers)), tokenAssignments: JSON.parse(JSON.stringify(fallbackConfig.tokenAssignments)) };
                setSideA({ config: baseScene });
                setSideB({ config: baseScene });
                setActiveSceneName(null);
                setTargetCrossfaderValue(initialFaderValue);
                setRenderedCrossfaderValue(initialFaderValue);
                renderedValueRef.current = initialFaderValue;
                return;
            }
            
            const initialSceneName = stagedActiveWorkspace.defaultPresetName || fullSceneList[0]?.name;
            let startIndex = fullSceneList.findIndex(p => p.name === initialSceneName);
            if (startIndex === -1) startIndex = 0;
            
            const nextIndex = fullSceneList.length > 1 ? (startIndex + 1) % fullSceneList.length : startIndex;
            const startSceneConfig = JSON.parse(JSON.stringify(fullSceneList[startIndex]));
            const nextSceneConfig = JSON.parse(JSON.stringify(fullSceneList[nextIndex]));
            
            const activeSideIsA = initialFaderValue < 0.5;
            if (activeSideIsA) {
                setSideA({ config: startSceneConfig });
                setSideB({ config: nextSceneConfig });
            } else {
                setSideB({ config: startSceneConfig });
                setSideA({ config: nextSceneConfig });
            }
            setActiveSceneName(startSceneConfig.name);
            setTargetCrossfaderValue(initialFaderValue);
            setRenderedCrossfaderValue(initialFaderValue);
            renderedValueRef.current = initialFaderValue;
        } else if (sceneNameChanged && isFullyLoaded && fullSceneList.length > 1 && !isAutoFading) {
            const currentIndex = fullSceneList.findIndex(scene => scene.name === activeSceneName);
            if (currentIndex === -1) return;

            const nextIndex = (currentIndex + 1) % fullSceneList.length;
            const nextSceneData = JSON.parse(JSON.stringify(fullSceneList[nextIndex]));
            const activeDeckIsA = renderedValueRef.current < 0.5;

            if (activeDeckIsA) {
                if (sideB.config?.name !== nextSceneData.name) setSideB({ config: nextSceneData });
            } else {
                if (sideA.config?.name !== nextSceneData.name) setSideA({ config: nextSceneData });
            }
        }
    }, [isWorkspaceTransitioning, isFullyLoaded, stagedActiveWorkspace, fullSceneList, prevIsFullyLoaded, prevIsWorkspaceTransitioning, activeSceneName, prevActiveSceneName, isAutoFading, midiStateRef, setActiveSceneName]);
    // --- END: UNIFIED LIFECYCLE AND PRELOADING EFFECT ---

    const handleSceneSelect = useCallback((sceneName, duration = AUTO_FADE_DURATION_MS) => {
        if (isAutoFading || !fullSceneList || fullSceneList.length === 0) return;
        
        setTargetSceneName(sceneName);
    
        const targetScene = fullSceneList.find(s => s.name === sceneName);
        if (!targetScene) return;
    
        const activeDeckIsA = renderedValueRef.current < 0.5;
        const activeSceneNameOnDeck = activeDeckIsA ? sideA.config?.name : sideB.config?.name;
    
        if (activeSceneNameOnDeck === sceneName) return;
    
        if (!activeDeckIsA && sideA.config?.name === sceneName) {
            setIsAutoFading(true);
            animateCrossfade(performance.now(), renderedValueRef.current, 0.0, duration, sceneName);
            return;
        }
        if (activeDeckIsA && sideB.config?.name === sceneName) {
            setIsAutoFading(true);
            animateCrossfade(performance.now(), renderedValueRef.current, 1.0, duration, sceneName);
            return;
        }
    
        if (activeDeckIsA) {
            setSideB({ config: JSON.parse(JSON.stringify(targetScene)) });
            setIsAutoFading(true);
            animateCrossfade(performance.now(), renderedValueRef.current, 1.0, duration, sceneName);
        } else {
            setSideA({ config: JSON.parse(JSON.stringify(targetScene)) });
            setIsAutoFading(true);
            animateCrossfade(performance.now(), renderedValueRef.current, 0.0, duration, sceneName);
        }
    }, [isAutoFading, fullSceneList, sideA.config, sideB.config, animateCrossfade]);

    const handleCrossfaderChange = useCallback((newValue) => {
        setTargetCrossfaderValue(newValue);
        if (isAutoFading) return;
    
        const threshold = 0.001;
        if (newValue >= 1.0 - threshold) {
            const sceneNameB = sideB.config?.name;
            if (sceneNameB && activeSceneName !== sceneNameB) setActiveSceneName(sceneNameB);
        } else if (newValue <= threshold) {
            const sceneNameA = sideA.config?.name;
            if (sceneNameA && activeSceneName !== sceneNameA) setActiveSceneName(sceneNameA);
        }
    }, [isAutoFading, activeSceneName, sideA.config, sideB.config, setActiveSceneName]);
    
    const updateLayerConfig = useCallback((layerId, key, value, isMidiUpdate = false) => {
        const managers = managerInstancesRef.current?.current;
        if (!managers) return;
        const manager = managers[String(layerId)];
        if (!manager) return;
        
        const activeDeck = renderedValueRef.current < 0.5 ? 'A' : 'B';
    
        if (isMidiUpdate && INTERPOLATED_MIDI_PARAMS.includes(key)) {
          if (activeDeck === 'A') manager.setTargetValue(key, value);
          else manager.setTargetValueB(key, value);
        } else {
          if (activeDeck === 'A') manager.updateConfigProperty(key, value);
          else manager.updateConfigBProperty(key, value);
        }
        
        const stateSetter = activeDeck === 'A' ? setSideA : setSideB;
        stateSetter(prev => {
          if (!prev.config) return prev;
          const newConfig = JSON.parse(JSON.stringify(prev.config));
          if (!newConfig.layers[layerId]) newConfig.layers[layerId] = {};
          newConfig.layers[layerId][key] = value;
          return { ...prev, config: newConfig };
        });
        
        setHasPendingChanges(true);
    }, [setHasPendingChanges]);

    const updateTokenAssignment = useCallback(async (token, layerId) => {
        const { setCanvasLayerImage } = canvasUpdateFnsRef.current;
        if (!setCanvasLayerImage) {
            console.error("[VisualEngineContext] setCanvasLayerImage function is not registered!");
            return;
        }

        const idToSave = token.id;
        const srcToLoad = token.metadata?.image;
        if (!idToSave || !srcToLoad) return;
      
        const assignmentObject = { id: idToSave, src: srcToLoad };
        
        const targetDeck = renderedValueRef.current < 0.5 ? 'A' : 'B';
        const stateSetter = targetDeck === 'A' ? setSideA : setSideB;
    
        stateSetter(prev => {
          if (!prev.config) return prev;
          const newConfig = JSON.parse(JSON.stringify(prev.config));
          if (!newConfig.tokenAssignments) newConfig.tokenAssignments = {};
          newConfig.tokenAssignments[String(layerId)] = assignmentObject;
          return { ...prev, config: newConfig };
        });
    
        try {
            await setCanvasLayerImage(String(layerId), srcToLoad, idToSave);
        } catch (e) {
            console.error(`[VisualEngineContext] Error setting canvas image for layer ${layerId}:`, e);
        }
    
        setHasPendingChanges(true);
    }, [setHasPendingChanges]);

    const setLiveConfig = useCallback(
        (newLayerConfigs, newTokenAssignments) => {
          const activeDeck = renderedValueRef.current < 0.5 ? 'A' : 'B';
          const stateSetter = activeDeck === 'A' ? setSideA : setSideB;
    
          stateSetter(prev => {
            if (!prev.config) return prev;
            const newConfig = JSON.parse(JSON.stringify(prev.config));
            newConfig.layers = newLayerConfigs || fallbackConfig.layers;
            newConfig.tokenAssignments = newTokenAssignments || fallbackConfig.tokenAssignments;
            return { ...prev, config: newConfig };
          });
          setHasPendingChanges(false);
        },
        [setHasPendingChanges]
    );

    const reloadSceneOntoInactiveDeck = useCallback((sceneName) => {
        if (!fullSceneList || fullSceneList.length === 0) {
            return;
        }
        
        const cleanSceneData = fullSceneList.find(s => s.name === sceneName);
        if (!cleanSceneData) {
            return;
        }
        
        const activeDeckIsA = renderedValueRef.current < 0.5;
        const inactiveDeck = activeDeckIsA ? 'B' : 'A';
        
        const stateSetter = inactiveDeck === 'A' ? setSideA : setSideB;
        stateSetter({ config: JSON.parse(JSON.stringify(cleanSceneData)) });

        console.log(`[VisualEngineContext] Reloaded scene "${sceneName}" onto inactive Deck ${inactiveDeck}.`);
    }, [fullSceneList]);

    const contextValue = useMemo(() => ({
        sideA,
        sideB,
        uiControlConfig,
        renderedCrossfaderValue,
        isAutoFading,
        targetSceneName,
        handleSceneSelect,
        handleCrossfaderChange,
        updateLayerConfig,
        updateTokenAssignment,
        setLiveConfig,
        registerManagerInstancesRef,
        registerCanvasUpdateFns,
        managerInstancesRef,
        reloadSceneOntoInactiveDeck,
    }), [
        sideA, sideB, uiControlConfig, renderedCrossfaderValue, isAutoFading,
        targetSceneName, handleSceneSelect, handleCrossfaderChange, updateLayerConfig, 
        updateTokenAssignment, setLiveConfig, registerManagerInstancesRef, 
        registerCanvasUpdateFns, managerInstancesRef, reloadSceneOntoInactiveDeck,
    ]);

    return (
        <VisualEngineContext.Provider value={contextValue}>
            {children}
        </VisualEngineContext.Provider>
    );
};

VisualEngineProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

export const useVisualEngineContext = () => {
    const context = useContext(VisualEngineContext);
    if (context === undefined) {
        throw new Error("useVisualEngineContext must be used within a VisualEngineProvider");
    }
    return context;
};
```

---
### `src\context\WorkspaceContext.jsx`
```jsx
// src/context/WorkspaceContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useUserSession } from './UserSessionContext';
import { useToast } from './ToastContext';
import { useUpProvider } from './UpProvider';
import ConfigurationService from '../services/ConfigurationService';
import { uploadJsonToPinata } from '../services/PinataService.js';
import { preloadImages, resolveImageUrl } from '../utils/imageDecoder.js';
import fallbackConfig from '../config/fallback-config.js';
import { useAsyncErrorHandler } from '../hooks/useAsyncErrorHandler';

const WorkspaceContext = createContext();

export const WorkspaceProvider = ({ children }) => {
    const { hostProfileAddress, isHostProfileOwner } = useUserSession();
    const { provider, walletClient, publicClient } = useUpProvider();
    const { addToast } = useToast();
    const { handleAsyncError } = useAsyncErrorHandler();

    const [shouldStartLoading, setShouldStartLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("Initializing...");
    const [isFullyLoaded, setIsFullyLoaded] = useState(false);
    const [isInitiallyResolved, setIsInitiallyResolved] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [hasPendingChanges, setHasPendingChanges] = useState(false);

    // --- THIS IS THE FIX (Part 1) ---
    const [sceneUpdateTrigger, setSceneUpdateTrigger] = useState(0);
    // --- END FIX ---

    const configServiceRef = useRef(null);
    const [configServiceInstanceReady, setConfigServiceInstanceReady] = useState(false);
    
    const [setlist, setSetlist] = useState(null);
    const [stagedSetlist, setStagedSetlist] = useState(null);
    const [activeWorkspace, setActiveWorkspace] = useState(null);
    const [stagedActiveWorkspace, setStagedActiveWorkspace] = useState(null);
    const [activeWorkspaceName, setActiveWorkspaceName] = useState(null);
    const [activeSceneName, setActiveSceneName] = useState(null);
    
    const [isWorkspaceTransitioning, setIsWorkspaceTransitioning] = useState(false);
    const workspaceToLoadRef = useRef(null);
    const [newlyCreatedWorkspace, setNewlyCreatedWorkspace] = useState(null);
    const preloadedWorkspacesRef = useRef(new Map());
    const preloadingInProgressRef = useRef(new Set());
    const prevProfileAddressRef = useRef(null);

    const startLoadingProcess = useCallback(() => {
        if(import.meta.env.DEV) console.log('%c[WorkspaceContext] User initiated loading process.', 'color: #1abc9c; font-weight: bold;');
        setShouldStartLoading(true);
    }, []);

    useEffect(() => {
        if (provider) {
            configServiceRef.current = new ConfigurationService(provider, walletClient, publicClient);
            configServiceRef.current.publicClient = publicClient;
            configServiceRef.current.walletClient = walletClient;
            const isReady = configServiceRef.current.checkReadyForRead();
            setConfigServiceInstanceReady(isReady);
        }
    }, [provider, publicClient, walletClient]);

    const _loadWorkspaceFromCid = useCallback(async (cid) => {
        const service = configServiceRef.current;
        if (!service || !cid) return null;
        const workspaceData = await service._loadWorkspaceFromCID(cid);
        return workspaceData;
    }, []);

    useEffect(() => {
        if (!shouldStartLoading) {
          if(import.meta.env.DEV) console.log('%c[WorkspaceContext] Waiting for user interaction to start loading.', 'color: #e67e22;');
          return;
        }
    
        const currentAddress = hostProfileAddress;
        const service = configServiceRef.current;
        const profileChanged = currentAddress !== prevProfileAddressRef.current;
        
        const emptySetlist = { defaultWorkspaceName: null, workspaces: {}, globalUserMidiMap: {} };
        const emptyWorkspace = { presets: {}, defaultPresetName: null, globalEventReactions: {}, personalCollectionLibrary: [], userPalettes: {} };
    
        if (profileChanged) {
          if (import.meta.env.DEV) console.log(`%c[WorkspaceContext] Profile changed from ${prevProfileAddressRef.current?.slice(0,6)} to ${currentAddress?.slice(0,6)}. Resetting state.`, 'color: #f39c12;');
          prevProfileAddressRef.current = currentAddress;
          setIsLoading(true);
          setLoadingMessage("Initializing...");
          setIsFullyLoaded(false);
          setIsInitiallyResolved(false); setLoadError(null); setHasPendingChanges(false);
          setSetlist(null); setStagedSetlist(null); setActiveWorkspace(null); setStagedActiveWorkspace(null);
          setActiveWorkspaceName(null); setActiveSceneName(null);
        }
    
        const loadInitialData = async (address) => {
          setIsLoading(true);
          try {
            setLoadingMessage("Fetching Setlist...");
            const loadedSetlist = await service.loadWorkspace(address);
            if (prevProfileAddressRef.current !== address) return;
    
            setSetlist(loadedSetlist);
            setStagedSetlist(loadedSetlist);
            setIsInitiallyResolved(true);
    
            const defaultWorkspaceName = loadedSetlist.defaultWorkspaceName || Object.keys(loadedSetlist.workspaces)[0];
            const workspaceInfo = defaultWorkspaceName ? loadedSetlist.workspaces[defaultWorkspaceName] : null;
            let loadedWorkspace;
    
            if (workspaceInfo && workspaceInfo.cid) {
                setLoadingMessage(`Loading Workspace: ${defaultWorkspaceName}...`);
                const result = await handleAsyncError(_loadWorkspaceFromCid(workspaceInfo.cid));
                if (result.success) {
                    loadedWorkspace = result.data;
                } else {
                    loadedWorkspace = null; // Ensure it's null on failure
                }
            }
            
            if (!loadedWorkspace) {
                loadedWorkspace = emptyWorkspace;
                if (defaultWorkspaceName) addToast(`Default workspace "${defaultWorkspaceName}" could not be loaded.`, 'warning');
            }
            
            if (prevProfileAddressRef.current !== address) return;
    
            setLoadingMessage("Preloading Assets...");
            const imageUrlsToPreload = new Set();
            Object.values(loadedWorkspace.presets || {}).forEach(preset => {
                Object.values(preset.tokenAssignments || {}).forEach(assignment => {
                    const src = resolveImageUrl(assignment);
                    if (src) imageUrlsToPreload.add(src);
                });
            });
    
            if (imageUrlsToPreload.size > 0) {
                await preloadImages(Array.from(imageUrlsToPreload));
            }
    
            if (prevProfileAddressRef.current !== address) return;
    
            setActiveWorkspace(loadedWorkspace);
            setStagedActiveWorkspace(loadedWorkspace);
            setActiveWorkspaceName(defaultWorkspaceName);
            
            const initialSceneName = loadedWorkspace.defaultPresetName || Object.keys(loadedWorkspace.presets || {})[0] || null;
            setActiveSceneName(initialSceneName);
            
            setLoadError(null);
            setHasPendingChanges(false);
    
          } catch (error) {
            if (prevProfileAddressRef.current === address) {
              setLoadError(error.message || "Failed to load setlist.");
              addToast("Could not load your setlist.", "error");
              setSetlist(emptySetlist); setStagedSetlist(emptySetlist);
              setActiveWorkspace(emptyWorkspace); setStagedActiveWorkspace(emptyWorkspace);
            }
          } finally {
            if (prevProfileAddressRef.current === address) {
              setIsLoading(false);
              setLoadingMessage("");
              if(import.meta.env.DEV) console.log(`%c[WorkspaceContext] Load sequence finished for ${address?.slice(0,6)}. Setting isFullyLoaded = true.`, 'color: #2ecc71; font-weight: bold;');
              setIsFullyLoaded(true);
            }
          }
        };
        
        if (configServiceInstanceReady && !isInitiallyResolved) {
          if (currentAddress) {
            if (import.meta.env.DEV) console.log(`%c[WorkspaceContext] Initializing for connected profile: ${currentAddress.slice(0,6)}...`, 'color: #f39c12;');
            loadInitialData(currentAddress);
          } else {
            if (import.meta.env.DEV) console.log(`%c[WorkspaceContext] Initializing for DISCONNECTED state.`, 'color: #f39c12;');
            setSetlist(emptySetlist); setStagedSetlist(emptySetlist);
            setActiveWorkspace(emptyWorkspace); setStagedActiveWorkspace(emptyWorkspace);
            setIsLoading(false);
            setIsInitiallyResolved(true);
          }
        }
    }, [shouldStartLoading, hostProfileAddress, configServiceInstanceReady, isInitiallyResolved, addToast, _loadWorkspaceFromCid, handleAsyncError]);

    useEffect(() => {
        if (isInitiallyResolved && !hostProfileAddress && !isFullyLoaded) {
          if (import.meta.env.DEV) console.log(`%c[WorkspaceContext] Resolved as DISCONNECTED. Setting isFullyLoaded = true.`, 'color: #2ecc71; font-weight: bold;');
          setIsFullyLoaded(true);
        }
    }, [isInitiallyResolved, hostProfileAddress, isFullyLoaded]);

    const fullSceneList = useMemo(() => {
        if (!stagedActiveWorkspace?.presets) return [];
        const validScenes = Object.values(stagedActiveWorkspace.presets).filter(
            (item) => item && typeof item.name === 'string'
        );
        return [...validScenes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    }, [stagedActiveWorkspace]);

    const _executeLoadAfterFade = useCallback(async () => {
        const workspaceName = workspaceToLoadRef.current;
        if (!workspaceName || !stagedSetlist || !stagedSetlist.workspaces[workspaceName]) {
          const errorMsg = `Target workspace '${workspaceName}' not found for loading.`;
          addToast(errorMsg, 'error');
          setIsLoading(false);
          setLoadingMessage("");
          setIsWorkspaceTransitioning(false);
          return;
        }
    
        try {
          let newWorkspace;
          if (preloadedWorkspacesRef.current.has(workspaceName)) {
            newWorkspace = preloadedWorkspacesRef.current.get(workspaceName);
          } else {
            const workspaceInfo = stagedSetlist.workspaces[workspaceName];
            const result = await handleAsyncError(_loadWorkspaceFromCid(workspaceInfo.cid));
            if (result.success) {
                newWorkspace = result.data;
            } else {
                newWorkspace = null; // Ensure it's null on failure
            }

            if (newWorkspace) {
                const imageUrlsToPreload = new Set();
                Object.values(newWorkspace.presets || {}).forEach(preset => {
                  Object.values(preset.tokenAssignments || {}).forEach(assignment => {
                    const src = resolveImageUrl(assignment);
                    if (src) imageUrlsToPreload.add(src);
                  });
                });
                if (imageUrlsToPreload.size > 0) {
                  await preloadImages(Array.from(imageUrlsToPreload));
                }
                preloadedWorkspacesRef.current.set(workspaceName, newWorkspace);
            }
          }
    
          if (newWorkspace) {
            setActiveWorkspace(newWorkspace);
            setStagedActiveWorkspace(newWorkspace);
            setActiveWorkspaceName(workspaceName);
            addToast(`Workspace "${workspaceName}" loaded.`, 'success');
          }
    
        } catch (error) {
          addToast(error.message, 'error');
        } finally {
          setIsLoading(false);
          setLoadingMessage("");
          setIsWorkspaceTransitioning(false);
          workspaceToLoadRef.current = null;
        }
    }, [stagedSetlist, addToast, _loadWorkspaceFromCid, handleAsyncError]);

    const loadWorkspace = useCallback(async (workspaceName) => {
        if (isWorkspaceTransitioning) return;
    
        if (!stagedSetlist || !stagedSetlist.workspaces[workspaceName]) {
            const errorMsg = `Workspace '${workspaceName}' not found.`;
            addToast(errorMsg, 'error');
            return { success: false, error: errorMsg };
        }
    
        setIsFullyLoaded(false); 
    
        setLoadingMessage(`Switching to ${workspaceName}...`);
        setIsLoading(true);
        setIsWorkspaceTransitioning(true);
        workspaceToLoadRef.current = workspaceName;
    
        return { success: true };
    }, [isWorkspaceTransitioning, stagedSetlist, addToast]);

    useEffect(() => {
        if (newlyCreatedWorkspace && stagedSetlist?.workspaces[newlyCreatedWorkspace]) {
          loadWorkspace(newlyCreatedWorkspace);
          setNewlyCreatedWorkspace(null); 
        }
    }, [newlyCreatedWorkspace, stagedSetlist, loadWorkspace]);

    const saveChanges = useCallback(async (workspaceNameToSave = activeWorkspaceName, setlistToSave = stagedSetlist) => {
        const service = configServiceRef.current;
        const addressToSave = hostProfileAddress;
        if (!service || !addressToSave || !service.checkReadyForWrite()) {
            const errorMsg = "Save service not ready or no profile connected.";
            addToast(errorMsg, "error");
            return { success: false, error: errorMsg };
        }
        if (!setlistToSave || !stagedActiveWorkspace || !workspaceNameToSave) {
            addToast("Data not fully loaded, cannot save.", "error");
            return { success: false, error: "Data not loaded" };
        }
        setIsSaving(true);
        setSaveError(null);
        setSaveSuccess(false);
        try {
            const workspaceToUpload = JSON.parse(JSON.stringify(stagedActiveWorkspace));
            delete workspaceToUpload.globalMidiMap;
            
            addToast("Uploading workspace data...", "info", 2000);
            const newWorkspaceCid = await uploadJsonToPinata(workspaceToUpload, `RADAR_Workspace_${workspaceNameToSave}`);
            if (!newWorkspaceCid) throw new Error("Failed to upload workspace to IPFS.");
    
            const newSetlist = JSON.parse(JSON.stringify(setlistToSave));
            if (!newSetlist.workspaces[workspaceNameToSave]) {
              newSetlist.workspaces[workspaceNameToSave] = {};
            }
            newSetlist.workspaces[workspaceNameToSave].cid = newWorkspaceCid;
    
            addToast("Saving setlist to your profile...", "info", 2000);
            await service.saveSetlist(addressToSave, newSetlist);
    
            setSetlist(newSetlist);
            setStagedSetlist(newSetlist);
            if (workspaceNameToSave === activeWorkspaceName) {
                setActiveWorkspace(stagedActiveWorkspace);
            }
            setHasPendingChanges(false);
            setSaveSuccess(true);
            addToast("Changes saved successfully!", "success");
            return { success: true, newSetlist };
        } catch (error) {
            const errorMsg = error.message || "Unknown save error.";
            addToast(`Error saving changes: ${errorMsg}`, 'error');
            setSaveError(errorMsg);
            setSaveSuccess(false);
            return { success: false, error: errorMsg };
        } finally {
            setIsSaving(false);
        }
    }, [stagedSetlist, activeWorkspaceName, stagedActiveWorkspace, hostProfileAddress, addToast]);

    const duplicateActiveWorkspace = useCallback(async (newName) => {
        if (!newName || typeof newName !== 'string') {
            addToast("Invalid workspace name provided.", "error");
            return { success: false, error: "Invalid name" };
        }
        if (stagedSetlist?.workspaces[newName]) {
            addToast(`Workspace "${newName}" already exists.`, "error");
            return { success: false, error: "Name exists" };
        }
    
        const newSetlist = JSON.parse(JSON.stringify(stagedSetlist));
        newSetlist.workspaces[newName] = { cid: '' };
    
        const result = await saveChanges(newName, newSetlist);
        
        if (result.success) {
            setActiveWorkspaceName(newName);
            addToast(`Workspace "${newName}" created and loaded.`, 'success');
        }
        return result;
    
    }, [stagedSetlist, saveChanges, addToast]);

    const createNewWorkspace = useCallback(async (newName) => {
        if (isLoading) return;
        if (!newName || typeof newName !== 'string') {
            addToast("Invalid workspace name provided.", "error");
            return;
        }
        if (stagedSetlist?.workspaces[newName]) {
            addToast(`Workspace name "${newName}" is already taken.`, "error");
            return;
        }
      
        setIsLoading(true);
        setLoadingMessage(`Creating "${newName}"...`);
      
        try {
            const newWorkspace = {
                presets: {
                    "Default": { name: "Default", ts: Date.now(), layers: fallbackConfig.layers, tokenAssignments: fallbackConfig.tokenAssignments }
                },
                defaultPresetName: "Default",
                globalEventReactions: {},
                personalCollectionLibrary: [],
                userPalettes: {}
            };
      
            const defaultAssignments = fallbackConfig.tokenAssignments || {};
            const imageUrlsToPreload = new Set();
            Object.values(defaultAssignments).forEach(assignment => {
                const src = resolveImageUrl(assignment);
                if (src) {
                    imageUrlsToPreload.add(src);
                }
            });
      
            if (imageUrlsToPreload.size > 0) {
                await preloadImages(Array.from(imageUrlsToPreload));
            }
      
            const newWorkspaceCID = await uploadJsonToPinata(newWorkspace, `RADAR_Workspace_${newName}`);
            if (!newWorkspaceCID) throw new Error("Failed to upload new workspace.");
      
            preloadedWorkspacesRef.current.set(newName, newWorkspace);
      
            setStagedSetlist(prev => {
                const newSetlist = prev ? JSON.parse(JSON.stringify(prev)) : { workspaces: {}, defaultWorkspaceName: null };
                newSetlist.workspaces[newName] = { cid: newWorkspaceCID, lastModified: Date.now() };
                return newSetlist;
            });
      
            setHasPendingChanges(true);
            addToast(`Workspace "${newName}" created. Save your setlist to persist it.`, "success");
            
            setNewlyCreatedWorkspace(newName);
      
        } catch (error) {
            addToast(`Error creating workspace: ${error.message}`, "error");
            setIsLoading(false);
            setLoadingMessage("");
        }
    }, [stagedSetlist, addToast, isLoading]);

    const deleteWorkspaceFromSet = useCallback((workspaceName) => {
        setStagedSetlist(prev => {
          if (!prev || !prev.workspaces[workspaceName]) return prev;
          const newSetlist = JSON.parse(JSON.stringify(prev));
          delete newSetlist.workspaces[workspaceName];
          if (newSetlist.defaultWorkspaceName === workspaceName) {
            newSetlist.defaultWorkspaceName = Object.keys(newSetlist.workspaces)[0] || null;
          }
          setHasPendingChanges(true);
          addToast(`Workspace "${workspaceName}" deleted. Save changes to confirm.`, 'info');
          return newSetlist;
        });
    }, [addToast]);
    
    const renameWorkspaceInSet = useCallback((oldName, newName) => {
        setStagedSetlist(prev => {
          if (!prev || !prev.workspaces[oldName] || prev.workspaces[newName]) {
            if (prev.workspaces[newName]) addToast(`Name "${newName}" is already taken.`, 'error');
            return prev;
          }
          const newSetlist = JSON.parse(JSON.stringify(prev));
          newSetlist.workspaces[newName] = newSetlist.workspaces[oldName];
          delete newSetlist.workspaces[oldName];
    
          if (newSetlist.defaultWorkspaceName === oldName) {
            newSetlist.defaultWorkspaceName = newName;
          }
          if (activeWorkspaceName === oldName) {
            setActiveWorkspaceName(newName);
          }
    
          setHasPendingChanges(true);
          addToast(`Workspace renamed to "${newName}".`, 'success');
          return newSetlist;
        });
    }, [addToast, activeWorkspaceName]);
    
    const setDefaultWorkspaceInSet = useCallback((workspaceName) => {
        setStagedSetlist(prev => {
          if (!prev || !prev.workspaces[workspaceName]) return prev;
          const newSetlist = { ...prev, defaultWorkspaceName: workspaceName };
          setHasPendingChanges(true);
          addToast(`"${workspaceName}" is now the default workspace.`, 'success');
          return newSetlist;
        });
    }, [addToast]);

    const addNewSceneToStagedWorkspace = useCallback((newSceneName, newSceneData) => {
        setStagedActiveWorkspace(prev => {
          const newWorkspace = prev ? JSON.parse(JSON.stringify(prev)) : { presets: {}, defaultPresetName: null, globalMidiMap: {}, globalEventReactions: {}, personalCollectionLibrary: [], userPalettes: {} };
          newWorkspace.presets[newSceneName] = newSceneData;
          return newWorkspace;
        });
        setActiveSceneName(newSceneName);
        setHasPendingChanges(true);
        // --- THIS IS THE FIX (Part 1) ---
        setSceneUpdateTrigger(prev => prev + 1);
        // --- END FIX ---
    }, []);
    
    const deleteSceneFromStagedWorkspace = useCallback((nameToDelete) => {
        setStagedActiveWorkspace(prev => {
          if (!prev || !prev.presets || !prev.presets[nameToDelete]) return prev;
          const newWorkspace = JSON.parse(JSON.stringify(prev));
          delete newWorkspace.presets[nameToDelete];
          if (newWorkspace.defaultPresetName === nameToDelete) newWorkspace.defaultPresetName = null;
          return newWorkspace;
        });
        setHasPendingChanges(true);
    }, []);
    
    const setDefaultSceneInStagedWorkspace = useCallback((nameToSet) => {
        setStagedActiveWorkspace(prev => {
          if (!prev || !prev.presets || !prev.presets[nameToSet]) return prev;
          return { ...prev, defaultPresetName: nameToSet };
        });
        setHasPendingChanges(true);
    }, []);

    const updateGlobalMidiMap = useCallback((newMap) => {
        if (isHostProfileOwner) {
            setStagedSetlist(prev => ({ ...prev, globalUserMidiMap: newMap || {} }));
            setHasPendingChanges(true);
        }
    }, [isHostProfileOwner]);
    
    const updateLayerMidiMappings = useCallback((layerId, mappingData) => {
        if (isHostProfileOwner) {
          setStagedSetlist(prev => {
            const newGlobalMidiMap = { ...(prev?.globalUserMidiMap || {}) };
            newGlobalMidiMap.layerSelects = { ...(newGlobalMidiMap.layerSelects || {}), [layerId]: mappingData };
            return { ...prev, globalUserMidiMap: newGlobalMidiMap };
          });
          setHasPendingChanges(true);
        }
    }, [isHostProfileOwner]);

    const updateGlobalEventReactions = useCallback((eventType, reactionData) => {
        if (!eventType || !reactionData) return;
        setStagedActiveWorkspace(prev => ({
          ...prev, globalEventReactions: { ...(prev?.globalEventReactions || {}), [eventType]: reactionData }
        }));
        setHasPendingChanges(true);
    }, []);
    
    const deleteGlobalEventReaction = useCallback((eventType) => {
        if (!eventType) return;
        setStagedActiveWorkspace(prev => {
          const newReactions = { ...(prev?.globalEventReactions || {}) };
          if (newReactions[eventType]) {
            delete newReactions[eventType];
            setHasPendingChanges(true);
            return { ...prev, globalEventReactions: newReactions };
          }
          return prev;
        });
    }, []);

    const addPalette = useCallback((paletteName) => {
        setStagedActiveWorkspace(prev => {
          const newWorkspace = { ...prev, userPalettes: { ...(prev?.userPalettes || {}) } };
          if (newWorkspace.userPalettes[paletteName]) {
            addToast(`Palette "${paletteName}" already exists.`, "warning");
            return prev;
          }
          newWorkspace.userPalettes[paletteName] = [];
          addToast(`Palette "${paletteName}" created.`, "success");
          setHasPendingChanges(true);
          return newWorkspace;
        });
    }, [addToast]);
    
    const removePalette = useCallback((paletteName) => {
        setStagedActiveWorkspace(prev => {
          const newWorkspace = { ...prev, userPalettes: { ...(prev?.userPalettes || {}) } };
          if (!newWorkspace.userPalettes[paletteName]) return prev;
          delete newWorkspace.userPalettes[paletteName];
          addToast(`Palette "${paletteName}" removed.`, "info");
          setHasPendingChanges(true);
          return newWorkspace;
        });
    }, [addToast]);
    
    const addTokenToPalette = useCallback((paletteName, tokenId) => {
        setStagedActiveWorkspace(prev => {
          const newWorkspace = { ...prev, userPalettes: { ...(prev?.userPalettes || {}) } };
          const palette = newWorkspace.userPalettes[paletteName];
          if (!palette) {
            addToast(`Palette "${paletteName}" not found.`, "error"); return prev;
          }
          if (palette.includes(tokenId)) {
            addToast("Token is already in this palette.", "info"); return prev;
          }
          newWorkspace.userPalettes[paletteName] = [...palette, tokenId];
          addToast(`Token added to "${paletteName}".`, "success");
          setHasPendingChanges(true);
          return newWorkspace;
        });
    }, [addToast]);
    
    const removeTokenFromPalette = useCallback((paletteName, tokenId) => {
        setStagedActiveWorkspace(prev => {
          const newWorkspace = { ...prev, userPalettes: { ...(prev?.userPalettes || {}) } };
          const palette = newWorkspace.userPalettes[paletteName];
          if (!palette) return prev;
          newWorkspace.userPalettes[paletteName] = palette.filter(id => id !== tokenId);
          setHasPendingChanges(true);
          return newWorkspace;
        });
    }, []);

    const preloadWorkspace = useCallback(async (workspaceName) => {
        const service = configServiceRef.current;
        if (!service || !stagedSetlist?.workspaces[workspaceName]) return;
        if (preloadedWorkspacesRef.current.has(workspaceName) || preloadingInProgressRef.current.has(workspaceName)) {
          return;
        }
        try {
          preloadingInProgressRef.current.add(workspaceName);
          if (import.meta.env.DEV) console.log(`[Preloader] Hover detected. Starting preload for workspace: "${workspaceName}"`);
          const workspaceInfo = stagedSetlist.workspaces[workspaceName];
          const workspaceData = await _loadWorkspaceFromCid(workspaceInfo.cid);
          if (workspaceData) {
            preloadedWorkspacesRef.current.set(workspaceName, workspaceData);
            if (import.meta.env.DEV) console.log(`[Preloader] Cached workspace data for "${workspaceName}".`);
            const imageUrlsToPreload = new Set();
            Object.values(workspaceData.presets || {}).forEach(preset => {
              Object.values(preset.tokenAssignments || {}).forEach(assignment => {
                const src = resolveImageUrl(assignment);
                if (src) imageUrlsToPreload.add(src);
              });
            });
            if (imageUrlsToPreload.size > 0) {
              if (import.meta.env.DEV) console.log(`[Preloader] Preloading ${imageUrlsToPreload.size} images for "${workspaceName}".`);
              preloadImages(Array.from(imageUrlsToPreload));
            }
          }
        } catch (error) {
          if (import.meta.env.DEV) console.warn(`[Preloader] Failed to preload workspace "${workspaceName}":`, error);
        } finally {
          preloadingInProgressRef.current.delete(workspaceName);
        }
    }, [stagedSetlist, _loadWorkspaceFromCid]);

    const contextValue = useMemo(() => ({
        isLoading, loadingMessage, isFullyLoaded, isInitiallyResolved, loadError, isSaving, saveError, saveSuccess, hasPendingChanges,
        configServiceRef, configServiceInstanceReady,
        setlist, stagedSetlist, activeWorkspace, stagedActiveWorkspace, activeWorkspaceName, activeSceneName,
        fullSceneList,
        startLoadingProcess,
        isWorkspaceTransitioning,
        _executeLoadAfterFade,
        loadWorkspace,
        saveChanges,
        duplicateActiveWorkspace,
        createNewWorkspace,
        deleteWorkspaceFromSet,
        renameWorkspaceInSet,
        setDefaultWorkspaceInSet,
        addNewSceneToStagedWorkspace,
        deleteSceneFromStagedWorkspace,
        setDefaultSceneInStagedWorkspace,
        updateGlobalMidiMap,
        updateLayerMidiMappings,
        updateGlobalEventReactions,
        deleteGlobalEventReaction,
        addPalette,
        removePalette,
        addTokenToPalette,
        removeTokenFromPalette,
        preloadWorkspace,
        setHasPendingChanges,
        setActiveSceneName,
        // --- THIS IS THE FIX (Part 1) ---
        sceneUpdateTrigger,
        // --- END FIX ---
    }), [
        isLoading, loadingMessage, isFullyLoaded, isInitiallyResolved, loadError, isSaving, saveError, saveSuccess, hasPendingChanges,
        configServiceRef, configServiceInstanceReady,
        setlist, stagedSetlist, activeWorkspace, stagedActiveWorkspace, activeWorkspaceName, activeSceneName,
        fullSceneList,
        startLoadingProcess,
        isWorkspaceTransitioning,
        _executeLoadAfterFade,
        loadWorkspace,
        saveChanges,
        duplicateActiveWorkspace,
        createNewWorkspace,
        deleteWorkspaceFromSet,
        renameWorkspaceInSet,
        setDefaultWorkspaceInSet,
        addNewSceneToStagedWorkspace,
        deleteSceneFromStagedWorkspace,
        setDefaultSceneInStagedWorkspace,
        updateGlobalMidiMap,
        updateLayerMidiMappings,
        updateGlobalEventReactions,
        deleteGlobalEventReaction,
        addPalette,
        removePalette,
        addTokenToPalette,
        removeTokenFromPalette,
        preloadWorkspace,
        setActiveSceneName,
        // --- THIS IS THE FIX (Part 1) ---
        sceneUpdateTrigger,
        // --- END FIX ---
    ]);

    return (
        <WorkspaceContext.Provider value={contextValue}>
            {children}
        </WorkspaceContext.Provider>
    );
};

WorkspaceProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

export const useWorkspaceContext = () => {
    const context = useContext(WorkspaceContext);
    if (context === undefined) {
        throw new Error("useWorkspaceContext must be used within a WorkspaceProvider");
    }
    return context;
};
```

---
### `src\dump_to_md.py`
```py
import os
from pathlib import Path

# === CONFIGURATION ===
project_root = Path(__file__).resolve().parent.parent  # you're in src/, go one level up
exclude_dirs = {"node_modules", "dist", "assets", ".git", ".vscode", "__pycache__"}
exclude_files = {"package-lock.json"}

output_file = project_root / "full_codebase_dump.md"
allowed_suffixes = {".js", ".jsx", ".ts", ".tsx", ".css", ".json", ".html", ".md", ".py"}

# === FORMATTER ===
def format_file(file_path: Path):
    suffix = file_path.suffix.lstrip(".")
    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception as e:
        content = f"Error reading file: {e}"
    return f"\n---\n### `{file_path.relative_to(project_root)}`\n```{suffix}\n{content}\n```\n"

# === FILE COLLECTOR ===
def collect_files(root: Path):
    files = []
    for path in root.rglob("*"):
        if (
            path.is_file() and
            path.suffix in allowed_suffixes and
            not any(part in exclude_dirs for part in path.parts) and
            path.name not in exclude_files
        ):
            files.append(path)
    return sorted(files)

# === MAIN ===
if __name__ == "__main__":
    print("🔍 Scanning project files...")
    all_files = collect_files(project_root)
    print(f"📄 Found {len(all_files)} files.")

    print(f"✍️ Writing to {output_file.name}...")
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("# 📦 Full Codebase Dump\n")
        for file in all_files:
            f.write(format_file(file))
    
    print("✅ Full markdown dump complete!")

```

---
### `src\effects\ColorOverlayEffect.js`
```js
// src/effects/ColorOverlayEffect.js
import VisualEffect from "./VisualEffect"; // Local base class

/**
 * @typedef {object} ColorOverlayConfig
 * @property {string} [color='rgba(255, 0, 0, 0.3)'] - The color of the overlay (CSS color string).
 * @property {number} [pulseCount=3] - The number of times the overlay will pulse (fade in and out).
 * @property {number} [duration=3000] - The total duration of the effect in milliseconds.
 * @property {number} [fadeOutDuration] - Duration for the final fade out of the overlay. Defaults to 40% of `duration`.
 * @property {string} [easing='cubic-bezier(0.4, 0, 0.2, 1)'] - CSS easing function for the pulse transitions.
 * @property {string} [mixBlendMode='overlay'] - CSS mix-blend-mode for the overlay.
 */

/**
 * Creates a pulsating color overlay effect on a target canvas layer
 * or globally on the main canvas container. The color, pulse count, and duration
 * are configurable via the `config` property inherited from VisualEffect.
 * This effect works by dynamically adding and animating a DOM element overlay.
 *
 * @extends VisualEffect
 */
class ColorOverlayEffect extends VisualEffect {
  /**
   * Applies the color overlay effect by creating and animating a DOM element.
   *
   * @returns {import('../utils/VisualEffectsProcessor').EffectControlAPI} A control object including `effectId`, `layer`, and a `clear` method to stop and remove the effect.
   */
  apply() { // Removed _updateLayerConfig as it's unused in this specific effect
    const { layer } = this;
    /** @type {ColorOverlayConfig} */
    const effectSpecificConfig = this.config || {};

    const {
      color = "rgba(255, 0, 0, 0.3)",
      pulseCount = 3,
      duration = 3000,
      fadeOutDuration = duration * 0.4,
      easing = "cubic-bezier(0.4, 0, 0.2, 1)",
      mixBlendMode = "overlay",
    } = effectSpecificConfig;

    const logPrefix = `[ColorOverlayEffect ${this.effectId}]`;
    /** @type {HTMLElement | null} */
    let targetElement = null;
    let zIndexBase = 1;

    if (layer === 'global') {
        targetElement = document.querySelector('.canvas-container');
        if (targetElement) {
            zIndexBase = 10;
        } else if (import.meta.env.DEV) {
            console.error(`${logPrefix} Failed to find .canvas-container element for global overlay!`);
        }
    } else {
        const layerSelector = `.canvas.layer-${layer}`;
        targetElement = document.querySelector(layerSelector);
        if (targetElement) {
            const targetZIndex = parseInt(targetElement.style.zIndex || '', 10);
            zIndexBase = isNaN(targetZIndex) ? (parseInt(String(layer), 10) + 2) : targetZIndex;
        } else if (import.meta.env.DEV) {
             console.warn(`${logPrefix} Canvas element not found using selector: ${layerSelector}`);
        }
    }

    if (!targetElement) {
      if (import.meta.env.DEV) {
        console.error(`${logPrefix} No target element found to apply overlay.`);
      }
      return {
        effectId: this.effectId,
        layer: layer,
        type: this.type,
        config: this.config,
        clear: () => this.cleanup(),
      };
    }

    const existingOverlay = document.getElementById(`color-overlay-${this.effectId}`);
    if (existingOverlay) {
      existingOverlay.remove();
    }

    const overlayId = `color-overlay-${this.effectId}`;
    const overlay = document.createElement("div");
    overlay.id = overlayId;
    overlay.classList.add("color-overlay-effect");
    Object.assign(overlay.style, {
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        background: color,
        pointerEvents: "none",
        zIndex: (zIndexBase + 10).toString(),
        opacity: "0",
        transition: `opacity ${duration / (pulseCount * 2)}ms ${easing}`,
        mixBlendMode: mixBlendMode,
    });

    targetElement.appendChild(overlay);

    let currentPulse = 0;
    let isVisible = false;
    let isCleanedUp = false;

    const pulse = () => {
      if (isCleanedUp || !overlay || !overlay.isConnected) return;

      isVisible = !isVisible;
      overlay.style.opacity = isVisible ? "1" : "0";

      if (!isVisible) {
        currentPulse++;
      }

      if (currentPulse >= pulseCount) {
        this.addTimeout(
          "final_fade_out",
          () => {
            if (isCleanedUp || !overlay || !overlay.isConnected) return;
            overlay.style.transition = `opacity ${fadeOutDuration}ms ease-out`;
            overlay.style.opacity = "0";
            this.addTimeout(
              "remove_element",
              () => {
                if (overlay?.parentNode) {
                   overlay.remove();
                }
              },
              fadeOutDuration + 100,
            );
          },
          duration / (pulseCount * 2),
        );
        return;
      }

      this.addTimeout(
        `pulse-${currentPulse}-${isVisible ? "on" : "off"}`,
        pulse,
        duration / (pulseCount * 2),
      );
    };

    this.addTimeout("start_pulse", pulse, 50);

    return {
      effectId: this.effectId,
      layer: layer,
      type: this.type,
      config: this.config,
      clear: () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        this.cleanup();
      },
    };
  }

  /**
   * Overrides the base cleanup method to specifically handle the removal
   * of the DOM element created by this effect.
   */
  cleanup() {
    super.cleanup();

    const overlayId = `color-overlay-${this.effectId}`;
    const overlayElement = document.getElementById(overlayId);

    if (overlayElement) {
      if (overlayElement.style.opacity !== "0") {
        overlayElement.style.transition = "opacity 150ms ease-out";
        overlayElement.style.opacity = "0";
        setTimeout(() => {
          if (overlayElement.parentNode) {
            overlayElement.remove();
          }
        }, 150);
      } else if (overlayElement.parentNode) {
        overlayElement.remove();
      }
    }
  }
}

export default ColorOverlayEffect;
```

---
### `src\effects\EffectFactory.js`
```js
// src/effects/EffectFactory.js
import ColorOverlayEffect from "./ColorOverlayEffect"; // Local effect class
// import ParticleBurstEffect from "./ParticleBurstEffect"; // Example for future expansion
// import VisualEffect from "./VisualEffect"; // Base class, for type hinting if needed

/**
 * @typedef {import('./VisualEffect').default} VisualEffect - Base class for all visual effects.
 * @typedef {import('../utils/VisualEffectsProcessor').EffectConfigInput} EffectConfigInput - Input config for effects.
 */

/**
 * EffectFactory: A factory class responsible for creating instances
 * of different visual effect classes based on a given type string.
 * This allows for easy extension with new effect types without modifying
 * the core effect processing logic.
 */
class EffectFactory {
  /**
   * Creates an instance of a specific VisualEffect subclass based on the `effectType`.
   * If the `effectType` is unknown or not explicitly handled, it falls back to
   * creating a `ColorOverlayEffect` as a default.
   *
   * @param {string} effectType - The type of effect to create (e.g., 'color_overlay').
   * @param {EffectConfigInput} options - Configuration options to pass to the effect constructor.
   *                                      These options typically include `layer`, `config`, `effectId`, etc.
   * @returns {VisualEffect} An instance of the requested (or fallback) effect class,
   *                         which should extend `VisualEffect`.
   */
  static createEffect(effectType, options) {
    switch (effectType) {
      case "color_overlay":
        return new ColorOverlayEffect(options);
      // Example for future expansion:
      // case "particle_burst":
      //   return new ParticleBurstEffect(options);
      default:
        if (import.meta.env.DEV) {
          // Keep warning for unknown types, as it indicates a potential configuration issue or missing effect class.
          console.warn(
            `[EffectFactory] Unknown effect type: '${effectType}'. Falling back to 'color_overlay'.`,
          );
        }
        // Fallback to a default effect (ColorOverlayEffect in this case)
        // Ensure the options passed are still compatible or handled gracefully by the fallback.
        return new ColorOverlayEffect({ ...options, type: 'color_overlay' });
    }
  }
}

export default EffectFactory;
```

---
### `src\effects\VisualEffect.js`
```js
// src/effects/VisualEffect.js

/**
 * @typedef {object} VisualEffectOptions
 * @property {string} [effectId] - Optional unique ID for the effect. If not provided, one will be generated.
 * @property {string|number} layer - The target layer ID for the effect (e.g., 'global', 1, 2, 3).
 * @property {object} [config={}] - Effect-specific configuration options. Structure depends on the concrete effect class.
 * @property {boolean} [preserveAnimation=false] - A hint indicating whether underlying canvas animations on the target layer should be preserved or potentially paused while this effect is active.
 * @property {string} [type] - The type identifier of the effect (e.g., 'color_overlay'). Often added by the factory or processor.
 */

/**
 * @typedef {object} EffectControlAPI
 * @property {string} effectId - The unique ID of this effect instance.
 * @property {string|number} layer - The target layer of this effect.
 * @property {() => void} clear - A function to manually stop and clean up this effect instance.
 * @property {string} [type] - The type of the effect.
 * @property {object} [config] - The configuration used for this effect instance.
 */

/**
 * VisualEffect: Base class for all visual effects within the application.
 * Provides common properties like ID, layer target, configuration, duration,
 * and methods for applying the effect, cleaning up resources (timeouts),
 * and common helper functions (like easing).
 *
 * Subclasses must implement the `apply` method.
 */
class VisualEffect {
  /** @type {string} Unique identifier for this effect instance. */
  effectId;
  /** @type {string|number} The layer this effect targets. */
  layer;
  /** @type {object} Effect-specific configuration. */
  config;
  /** @type {number} Default or configured duration of the effect in milliseconds. */
  duration;
  /** @type {boolean} Hint for animation preservation. */
  preserveAnimation;
  /** @type {string | undefined} The type identifier of the effect. */
  type;
  /** @type {Map<string, ReturnType<typeof setTimeout>>} Stores managed timeouts for automatic cleanup. Keyed by a unique ID. */
  timeouts = new Map();

  /**
   * Creates an instance of VisualEffect.
   * @param {VisualEffectOptions} options - Configuration options for the effect.
   */
  constructor(options) {
    this.effectId =
      options.effectId ||
      `effect_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`; // Increased randomness part
    this.layer = options.layer;
    this.config = options.config || {};
    this.duration = typeof this.config.duration === 'number' ? this.config.duration : 3000; // Default duration if not in config
    this.preserveAnimation = options.preserveAnimation || false;
    this.type = options.type; // Store the type if provided
    this.timeouts = new Map();
  }

  /**
   * Abstract method to apply the visual effect. Must be implemented by subclasses.
   * @param {(layerId: string | number, key: string, value: any) => void} [_updateLayerConfig] - Optional function to potentially update layer config (may not be used by all effects).
   * @returns {EffectControlAPI} A control object, typically including { effectId, layer, type, config, clear() }.
   * @throws {Error} If the method is not implemented by a subclass.
   */
  // eslint-disable-next-line no-unused-vars
  apply(_updateLayerConfig) {
    // This JSDoc comment is for the abstract method, ESLint will still warn if the param is unused in subclasses.
    // Subclasses should decide if they need to use it or can omit it from their signature if truly unused.
    throw new Error("Method 'apply' must be implemented by subclasses of VisualEffect.");
  }

  /**
   * Cleans up any resources used by the effect, primarily clearing all managed timeouts.
   * Subclasses can override this to add specific cleanup logic (e.g., removing DOM elements),
   * but they should call `super.cleanup()` to ensure timeouts are cleared.
   * @returns {void}
   */
  cleanup() {
    for (const timeoutId of this.timeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.timeouts.clear();
    // if (import.meta.env.DEV) {
    //   console.log(`[VisualEffect ${this.effectId}] Cleaned up timeouts.`);
    // }
  }

  // --- Helper methods potentially useful for subclasses ---

  /**
   * Quadratic easing in/out function.
   * f(t) = t < 0.5 ? 2 * t^2 : 1 - (-2 * t + 2)^2 / 2
   * @param {number} t - Progress ratio (0 to 1).
   * @returns {number} Eased value.
   */
  easeInOutQuad(t) {
    // Ensure t is clamped between 0 and 1
    const clampedT = Math.max(0, Math.min(1, t));
    return clampedT < 0.5 ? 2 * clampedT * clampedT : 1 - Math.pow(-2 * clampedT + 2, 2) / 2;
  }

  /**
   * Elastic easing out function.
   * Provides a bouncy, elastic effect at the end of the animation.
   * @param {number} t - Progress ratio (0 to 1).
   * @returns {number} Eased value.
   */
  easeOutElastic(t) {
    // Ensure t is clamped between 0 and 1
    const clampedT = Math.max(0, Math.min(1, t));
    const c4 = (2 * Math.PI) / 3;

    if (clampedT === 0) return 0;
    if (clampedT === 1) return 1;

    return Math.pow(2, -10 * clampedT) * Math.sin((clampedT * 10 - 0.75) * c4) + 1;
  }

  /**
   * Adds a timeout to the internal map for automatic cleanup via `this.cleanup()`.
   * If a timeout with the same `id` already exists, it is cleared before setting the new one.
   * The timeout is removed from the map once its callback is executed.
   *
   * @param {string} id - A unique identifier for the timeout within this effect instance.
   * @param {() => void} callback - The function to execute after the delay.
   * @param {number} delay - The delay in milliseconds.
   * @returns {ReturnType<typeof setTimeout>} The timeout ID (NodeJS.Timeout or number).
   */
  addTimeout(id, callback, delay) {
    // Clear existing timeout with the same ID if present
    if (this.timeouts.has(id)) {
        const existingTimeoutId = this.timeouts.get(id);
        if (existingTimeoutId) clearTimeout(existingTimeoutId);
    }

    const timeoutId = setTimeout(() => {
        this.timeouts.delete(id); // Remove from map once executed or cleared
        try {
            callback();
        } catch (e) {
            if (import.meta.env.DEV) {
                console.error(`[VisualEffect ${this.effectId}] Error in timeout callback for ID '${id}':`, e);
            }
        }
    }, delay);

    this.timeouts.set(id, timeoutId);
    return timeoutId;
  }
}

export default VisualEffect;
```

---
### `src\hooks\configSelectors.js`
```js
// src/hooks/configSelectors.js
import { useMemo } from 'react';

import { useUserSession } from '../context/UserSessionContext.jsx';
import { useWorkspaceContext } from '../context/WorkspaceContext.jsx';
import { useVisualEngineContext } from '../context/VisualEngineContext.jsx';
import { useUpProvider } from '../context/UpProvider.jsx';

/**
 * @typedef {object} VisualLayerState
 * @property {object} layerConfigs - Configuration for visual layers of the host profile. Sourced from `VisualEngineContext`.
 * @property {object} tokenAssignments - Mapping of layer IDs to token identifiers or image URLs for the host profile. Sourced from `VisualEngineContext`.
 * @property {(layerId: string | number, key: string, value: any) => void} updateLayerConfig - Updates a specific property of a layer's configuration for the host profile. From `VisualEngineContext`.
 * @property {(layerId: string | number, tokenId: string | object | null) => void} updateTokenAssignment - Updates the token assigned to a layer for the host profile. From `VisualEngineContext`.
 */
export const useVisualLayerState = () => {
  const visualEngineCtx = useVisualEngineContext();
  return useMemo(() => ({
    layerConfigs: visualEngineCtx.uiControlConfig?.layers,
    tokenAssignments: visualEngineCtx.uiControlConfig?.tokenAssignments,
    updateLayerConfig: visualEngineCtx.updateLayerConfig,
    updateTokenAssignment: visualEngineCtx.updateTokenAssignment,
  }), [visualEngineCtx.uiControlConfig, visualEngineCtx.updateLayerConfig, visualEngineCtx.updateTokenAssignment]);
};

/**
 * @typedef {object} SetManagementState
 * This typedef mirrors useWorkspaceContext for documentation consistency.
 */
export const useSetManagementState = () => {
  // This hook now directly passes through useWorkspaceContext.
  return useWorkspaceContext();
};

/**
 * @typedef {object} InteractionSettingsState
 * @property {object} savedReactions - User-defined reactions to blockchain events for the active workspace.
 * @property {object} midiMap - User's global MIDI controller mappings for the active workspace.
 * @property {(eventType: string, reactionData: object) => void} updateSavedReaction - Adds or updates a specific event reaction configuration.
 * @property {(eventType: string) => void} deleteSavedReaction - Removes an event reaction configuration.
 * @property {(newMap: object) => void} updateMidiMap - Replaces the entire MIDI map configuration.
 */
export const useInteractionSettingsState = () => {
  const workspaceCtx = useWorkspaceContext();
  return useMemo(() => ({
    savedReactions: workspaceCtx.stagedActiveWorkspace?.globalEventReactions || {},
    midiMap: workspaceCtx.stagedSetlist?.globalUserMidiMap || {},
    updateSavedReaction: workspaceCtx.updateGlobalEventReactions,
    deleteSavedReaction: workspaceCtx.deleteGlobalEventReaction,
    updateMidiMap: workspaceCtx.updateGlobalMidiMap,
  }), [
    workspaceCtx.stagedActiveWorkspace,
    workspaceCtx.stagedSetlist,
    workspaceCtx.updateGlobalEventReactions,
    workspaceCtx.deleteGlobalEventReaction,
    workspaceCtx.updateGlobalMidiMap,
  ]);
};

/**
 * @typedef {object} ProfileSessionState
 * @property {string | null} currentProfileAddress - Address of the Universal Profile being viewed (host).
 * @property {string | null} visitorUPAddress - Address of the visitor's Universal Profile.
 * @property {boolean} isProfileOwner - True if visitor is owner of host profile.
 * @property {boolean} isVisitor - True if visitor is not the owner of the host profile.
 * @property {boolean} canSave - True if the current user has permissions to save changes to the host profile.
 * @property {boolean} canInteract - True if the current user can interact with controls (not read-only).
 * @property {boolean} isPreviewMode - True if the app is in a special preview/demo mode.
 * @property {() => void} togglePreviewMode - Toggles the preview mode.
 * @property {boolean} isParentAdmin - True if the current visitor is the RADAR project admin.
 */
export const useProfileSessionState = () => {
  const sessionCtx = useUserSession();

  return useMemo(() => {
    const {
      hostProfileAddress,
      visitorProfileAddress,
      isHostProfileOwner,
      isRadarProjectAdmin,
      isPreviewMode,
      canSaveToHostProfile,
      togglePreviewMode,
    } = sessionCtx;

    const canInteract = !!hostProfileAddress && !isPreviewMode;
    
    return {
      currentProfileAddress: hostProfileAddress, 
      visitorUPAddress: visitorProfileAddress,
      isProfileOwner: isHostProfileOwner,
      isVisitor: !isHostProfileOwner,
      canSave: canSaveToHostProfile, 
      canInteract,
      isPreviewMode: isPreviewMode,
      togglePreviewMode: togglePreviewMode,
      isParentAdmin: isRadarProjectAdmin,
    };
  }, [sessionCtx]);
};

/**
 * @typedef {object} PendingChangesState
 * @property {boolean} hasPendingChanges - True if local configuration of the host profile differs from its last saved state.
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setHasPendingChanges - Manually sets the pending changes flag.
 */
export const usePendingChangesState = () => {
  const workspaceCtx = useWorkspaceContext();
  return useMemo(() => ({
    hasPendingChanges: workspaceCtx.hasPendingChanges,
    setHasPendingChanges: workspaceCtx.setHasPendingChanges,
  }), [workspaceCtx.hasPendingChanges, workspaceCtx.setHasPendingChanges]);
};

/**
 * @typedef {object} ConfigStatusState
 * @property {boolean} isLoading - True if a setlist or workspace for the host profile is currently being loaded.
 * @property {boolean} isInitiallyResolved - True once the very first attempt to load the host profile's data is done.
 * @property {boolean} configServiceInstanceReady - True if ConfigurationService is instantiated and ready.
 * @property {number} sceneLoadNonce - Increments each time a new scene for the host profile is applied.
 * @property {React.RefObject<import('../services/ConfigurationService.js').default | null>} configServiceRef - Ref to the ConfigurationService instance.
 * @property {Error | string | null} loadError - Error from the last load attempt.
 * @property {Error | null} upInitializationError - Error from UpProvider initialization.
 * @property {Error | null} upFetchStateError - Error from UpProvider client fetching.
 */
export const useConfigStatusState = () => {
  const workspaceCtx = useWorkspaceContext();
  const upCtx = useUpProvider(); 

  return useMemo(() => ({
    isLoading: workspaceCtx.isLoading,
    isInitiallyResolved: workspaceCtx.isInitiallyResolved,
    configServiceInstanceReady: workspaceCtx.configServiceInstanceReady,
    sceneLoadNonce: 0, // This value is now managed internally by VisualEngineContext
    configServiceRef: workspaceCtx.configServiceRef,
    loadError: workspaceCtx.loadError,
    upInitializationError: upCtx.initializationError, 
    upFetchStateError: upCtx.fetchStateError,       
  }), [
    workspaceCtx.isLoading, workspaceCtx.isInitiallyResolved, workspaceCtx.loadError,
    workspaceCtx.configServiceInstanceReady, workspaceCtx.configServiceRef,
    upCtx.initializationError, upCtx.fetchStateError, 
  ]);
};
```

---
### `src\hooks\useAnimationLifecycleManager.js`
```js
// src/hooks/useAnimationLifecycleManager.js
import { useEffect, useRef } from 'react';

import { globalAnimationFlags } from "../utils/globalAnimationFlags"; // Local utility

const ANIMATION_RESTART_DELAY = 16; // ms

/**
 * Manages the lifecycle of canvas animations based on component mount state,
 * visibility, UI interactions (panels, overlays), and explicit transition states.
 * It decides when to start or stop animations to optimize performance and ensure
 * visual correctness during UI changes or when the canvas is not visible.
 * Uses a small delay before restarting animations to allow UI to settle.
 *
 * This version uses an internal ref (`lastActionRef`) to track its last commanded
 * state (start/stop), making its decision to issue a new command more robust
 * independently of an external `isAnimating` prop that might not be perfectly in sync.
 *
 * @param {object} params - Parameters for the animation lifecycle manager.
 * @param {boolean} params.isMounted - Indicates if the component consuming this hook is fully mounted.
 * @param {string} params.renderState - The current rendering state of the visual component (e.g., "rendered", "loading").
 * @param {boolean} params.isContainerObservedVisible - Flag indicating if the main visual container is visible, typically determined by an IntersectionObserver.
 * @param {boolean} params.isBenignOverlayActive - Flag indicating if a non-blocking overlay (e.g., toasts, temporary messages) is currently active, which might warrant continued animation.
 * @param {string | null} params.animatingPanel - Identifier of any UI panel that is currently undergoing an open/close animation. (Logged for debugging; not directly used in the core animation start/stop decision logic of this hook version).
 * @param {boolean} params.isTransitioning - Flag indicating if a visual preset transition or an initial load animation sequence is active. Animations should generally run during transitions.
 * @param {() => void} params.restartCanvasAnimations - Callback function to be invoked when animations should (re)start.
 * @param {() => void} params.stopCanvasAnimations - Callback function to be invoked when animations should stop.
 * @returns {void} This hook does not return a value but manages side effects.
 */
export function useAnimationLifecycleManager({
  isMounted,
  renderState,
  isContainerObservedVisible,
  isBenignOverlayActive,
  animatingPanel, // Keep for logging, though not in core logic here
  isTransitioning,
  restartCanvasAnimations,
  stopCanvasAnimations,
}) {
  /** @type {React.RefObject<ReturnType<typeof setTimeout> | null>} */
  const animationStartTimerRef = useRef(null);
  /** @type {React.RefObject<'start' | 'stop' | null>} */
  const lastActionRef = useRef(null); // Tracks the last action taken by this hook

  useEffect(() => {
    const timestamp = performance.now();
    if (import.meta.env.DEV) {
        // Updated log to show last commanded action by this hook
        console.log(`[AnimLC ${timestamp.toFixed(0)}] EFFECT RUN. LastCmd: ${lastActionRef.current}, isTokenSelectorOpening: ${globalAnimationFlags.isTokenSelectorOpening}, IOVisible: ${isContainerObservedVisible}, BenignActive: ${isBenignOverlayActive}, AnimPanel: ${animatingPanel}, IsTransitioning: ${isTransitioning}, RenderState: ${renderState}`);
    }

    if (!isMounted || !restartCanvasAnimations || !stopCanvasAnimations) {
      if (import.meta.env.DEV) {
        console.log(`[AnimLC ${timestamp.toFixed(0)}] Aborting: Not mounted or animation functions missing.`);
      }
      return;
    }

    // Clear any pending restart timeout from a previous run of this effect
    if (animationStartTimerRef.current) {
      clearTimeout(animationStartTimerRef.current);
      animationStartTimerRef.current = null;
    }

    let shouldRunAnimations;
    // Determine if animations should be running based on current state
    if (globalAnimationFlags.isTokenSelectorOpening) {
      shouldRunAnimations = true;
      if (import.meta.env.DEV) console.log(`[AnimLC ${timestamp.toFixed(0)}] Condition Eval: RUN (GlobalFlag Override: isTokenSelectorOpening)`);
    } else if (isTransitioning) {
      shouldRunAnimations = true;
      if (import.meta.env.DEV) console.log(`[AnimLC ${timestamp.toFixed(0)}] Condition Eval: RUN (Preset Transition active)`);
    } else if (isBenignOverlayActive) {
      shouldRunAnimations = true;
      if (import.meta.env.DEV) console.log(`[AnimLC ${timestamp.toFixed(0)}] Condition Eval: RUN (Benign Overlay Active)`);
    } else {
      shouldRunAnimations = renderState === "rendered" && isContainerObservedVisible;
      if (import.meta.env.DEV) console.log(`[AnimLC ${timestamp.toFixed(0)}] Condition Eval: ${shouldRunAnimations ? "RUN" : "STOP"} (General: RenderState=${renderState}, IOVisible=${isContainerObservedVisible})`);
    }
    
    const isInFullscreen = !!document.fullscreenElement;
    // Logic to determine if animations should definitely stop:
    // They should stop if `shouldRunAnimations` is false AND we are not in fullscreen.
    const shouldStopLogic = !shouldRunAnimations && !isInFullscreen;

    if (shouldRunAnimations) {
      // If animations should run, but this hook's last command wasn't 'start'
      if (lastActionRef.current !== 'start') {
        if (import.meta.env.DEV) console.log(`[AnimLC ${timestamp.toFixed(0)}] Action: Scheduling RESTART (last cmd: ${lastActionRef.current})`);
        
        animationStartTimerRef.current = setTimeout(() => {
          // Re-check conditions inside timeout as state might have changed during the delay
          let currentShouldRunAgain;
          if (globalAnimationFlags.isTokenSelectorOpening) currentShouldRunAgain = true;
          else if (isTransitioning) currentShouldRunAgain = true;
          else if (isBenignOverlayActive) currentShouldRunAgain = true;
          else currentShouldRunAgain = renderState === "rendered" && isContainerObservedVisible;

          if (isMounted && currentShouldRunAgain) {
            if (import.meta.env.DEV) console.log(`[AnimLC ${performance.now().toFixed(0)}] setTimeout: EXECUTING RESTART (isMounted & currentShouldRunAgain).`);
            restartCanvasAnimations();
            lastActionRef.current = 'start'; // Update last action
          } else {
            if (import.meta.env.DEV) console.log(`[AnimLC ${performance.now().toFixed(0)}] setTimeout: Conditions changed, NOT RESTARTING (isMounted=${isMounted}, currentShouldRunAgain=${currentShouldRunAgain}). Last cmd remains: ${lastActionRef.current}`);
          }
          animationStartTimerRef.current = null; // Clear ref after execution or if not run
        }, ANIMATION_RESTART_DELAY);
      } else {
          // Animations should run and last command was 'start', so do nothing.
          if (import.meta.env.DEV) console.log(`[AnimLC ${timestamp.toFixed(0)}] No Action: Conditions indicate RUN, and last command was 'start'.`);
      }
    } else if (shouldStopLogic) {
      // If animations should stop, but this hook's last command wasn't 'stop'
      if (lastActionRef.current !== 'stop') {
        if (import.meta.env.DEV) console.log(`[AnimLC ${timestamp.toFixed(0)}] Action: EXECUTING STOP (last cmd: ${lastActionRef.current})`);
        stopCanvasAnimations();
        lastActionRef.current = 'stop'; // Update last action
      } else {
        // Animations should stop and last command was 'stop', so do nothing.
        if (import.meta.env.DEV) console.log(`[AnimLC ${timestamp.toFixed(0)}] No Action: Conditions indicate STOP, and last command was 'stop'.`);
      }
    } else {
        // This block covers cases where:
        // 1. `shouldRunAnimations` is false, BUT `isInFullscreen` is true (so `shouldStopLogic` is false).
        //    In this case, we don't stop animations. `lastActionRef` remains what it was.
        //    If `lastActionRef` was 'start', animations continue (correct for fullscreen).
        //    If `lastActionRef` was 'stop' (e.g. from a previous non-fullscreen stop), and now it's fullscreen but conditions like IOVisible are false,
        //    it won't try to restart them here, which seems correct. The expectation is usually that fullscreen implies visible content.
        if (import.meta.env.DEV) {
            if (!shouldRunAnimations && isInFullscreen) {
                 console.log(`[AnimLC ${timestamp.toFixed(0)}] No Action: Conditions suggest STOP, but fullscreen is active. Last cmd: ${lastActionRef.current}. Animation continues if it was 'start'.`);
            } else {
                 // This case should ideally not be hit if logic is exhaustive.
                 // It might mean `shouldRunAnimations` is true, but `lastActionRef.current` was already 'start'. (Covered by specific log above)
                 // Or `shouldRunAnimations` is false, `isInFullscreen` is false (so `shouldStopLogic` is true), but `lastActionRef.current` was already 'stop'. (Covered by specific log above)
                 console.log(`[AnimLC ${timestamp.toFixed(0)}] No Action: Uncategorized state or conditions met current command. shouldRunAnimations: ${shouldRunAnimations}, shouldStopLogic: ${shouldStopLogic}, last cmd: ${lastActionRef.current}.`);
            }
        }
    }

    // Cleanup function for the useEffect
    return () => {
      if (animationStartTimerRef.current) {
        clearTimeout(animationStartTimerRef.current);
        animationStartTimerRef.current = null;
      }
    };
  }, [
    isMounted, renderState, isContainerObservedVisible, isBenignOverlayActive,
    animatingPanel, // Kept for logging consistency, even if not in core decision logic
    isTransitioning,
    restartCanvasAnimations, stopCanvasAnimations,
    // lastActionRef is a ref, its changes don't re-trigger useEffect.
    // globalAnimationFlags is external, its changes don't re-trigger useEffect.
  ]);
}
```

---
### `src\hooks\useAppInteractions.js`
```js
// src/hooks/useAppInteractions.js
import { useCallback, useEffect, useMemo } from 'react';
import { useUIState } from './useUIState';
import { useVisualEffects } from './useVisualEffects';
import { useLsp1Events } from './useLsp1Events';
import { useMIDI } from '../context/MIDIContext';
import { useUserSession } from '../context/UserSessionContext';
import { useVisualEngineContext } from '../context/VisualEngineContext';
import { useNotificationContext } from '../context/NotificationContext';
import { useWorkspaceContext } from '../context/WorkspaceContext';
import { sliderParams } from '../config/sliderParams';
import { scaleNormalizedValue } from "../utils/helpers";

export const useAppInteractions = (props) => {
  const {
    managerInstancesRef,
    isMountedRef,
    onTogglePLock,
    onNextScene,
    onPrevScene,
    onNextWorkspace,
    onPrevWorkspace,
  } = props;

  const { visitorProfileAddress } = useUserSession();
  const uiStateHook = useUIState('tab1');
  const { addNotification, unreadCount } = useNotificationContext();
  const { stagedActiveWorkspace } = useWorkspaceContext();
  const savedReactions = stagedActiveWorkspace?.globalEventReactions || {};
  const { updateLayerConfig, updateTokenAssignment, handleCrossfaderChange } = useVisualEngineContext();
  const { processEffect, createDefaultEffect } = useVisualEffects(updateLayerConfig);
  
  const { 
    pendingActions,
    clearPendingActions 
  } = useMIDI();
  
  const applyPlaybackValueToManager = useCallback((layerId, key, value) => {
    const manager = managerInstancesRef.current?.[String(layerId)];
    if (manager?.snapVisualProperty) {
      manager.snapVisualProperty(key, value);
    }
  }, [managerInstancesRef]);

  const handleEventReceived = useCallback((event) => {
    if (!isMountedRef.current || !event?.typeId) return;
    if (addNotification) addNotification(event);
    const reactionsMap = savedReactions || {};
    const typeIdToMatch = event.typeId.toLowerCase();
    const matchingReactions = Object.values(reactionsMap).filter(
      r => r?.event?.toLowerCase() === typeIdToMatch
    );
    if (matchingReactions.length > 0) {
      matchingReactions.forEach(reactionConfig => {
        if (processEffect) processEffect({ ...reactionConfig, originEvent: event });
      });
    } else if (createDefaultEffect) {
      createDefaultEffect(event.type);
    }
  }, [isMountedRef, addNotification, savedReactions, processEffect, createDefaultEffect]);

  useLsp1Events(visitorProfileAddress, handleEventReceived);

  useEffect(() => {
    if (pendingActions && pendingActions.length > 0) {
      pendingActions.forEach(action => {
        switch (action.type) {
          case 'paramUpdate': {
            const { layer, param, value: normalizedMidiValue } = action;
            const sliderConfig = sliderParams.find(p => p.prop === param);
            const manager = managerInstancesRef.current?.[String(layer)];
            if (sliderConfig && manager) {
              const scaledValue = scaleNormalizedValue(normalizedMidiValue, sliderConfig.min, sliderConfig.max);
              updateLayerConfig(String(layer), param, scaledValue, true);
            }
            break;
          }
          case 'layerSelect': {
            const { layer } = action;
            const layerToTabMap = { 1: 'tab3', 2: 'tab2', 3: 'tab1' };
            const targetTab = layerToTabMap[layer];
            if (targetTab && uiStateHook.setActiveLayerTab) {
              uiStateHook.setActiveLayerTab(targetTab);
            }
            break;
          }
          case 'globalAction': {
            const actionName = action.action;
            if (actionName === 'pLockToggle' && onTogglePLock) {
              onTogglePLock();
            }
            break;
          }
          case 'crossfaderUpdate': {
            const { value } = action;
            if (handleCrossfaderChange) {
              handleCrossfaderChange(value);
            }
            break;
          }
          case 'nextScene':
            if (onNextScene) onNextScene();
            break;
          case 'prevScene':
            if (onPrevScene) onPrevScene();
            break;
          case 'nextWorkspace':
            if (onNextWorkspace) onNextWorkspace();
            break;
          case 'prevWorkspace':
            if (onPrevWorkspace) onPrevWorkspace();
            break;
          default:
            break;
        }
      });
      clearPendingActions();
    }
  }, [
    pendingActions,
    clearPendingActions,
    managerInstancesRef,
    updateLayerConfig,
    uiStateHook,
    onTogglePLock,
    handleCrossfaderChange,
    onNextScene,
    onPrevScene,
    onNextWorkspace,
    onPrevWorkspace,
  ]);


  const handleTokenApplied = useCallback(async (token, layerId) => {
    if (!isMountedRef.current) return;
    if (updateTokenAssignment) {
      updateTokenAssignment(token, layerId);
    }
  }, [isMountedRef, updateTokenAssignment]);

  return useMemo(() => ({
    uiStateHook,
    notificationData: { unreadCount },
    handleTokenApplied,
    processEffect,
    createDefaultEffect,
    applyPlaybackValueToManager,
  }), [
    uiStateHook, unreadCount, handleTokenApplied,
    processEffect, createDefaultEffect,
    applyPlaybackValueToManager
  ]);
};
```

---
### `src\hooks\useAsyncErrorHandler.js`
```js
// src/hooks/useAsyncErrorHandler.js
import { useToast } from '../context/ToastContext';
import { useCallback } from 'react';

export const useAsyncErrorHandler = () => {
  const { addToast } = useToast();

  const handleAsyncError = useCallback(async (promise, successMessage) => {
    try {
      const result = await promise;
      if (successMessage) {
        addToast(successMessage, 'success');
      }
      return { success: true, data: result };
    } catch (error) {
      console.error("An async error was caught by the handler:", error);
      const userMessage = error.shortMessage || error.message || "An unknown error occurred.";
      addToast(userMessage, 'error');
      return { success: false, error };
    }
  }, [addToast]);

  return { handleAsyncError };
};
```

---
### `src\hooks\useAudioVisualizer.js`
```js
// src/hooks/useAudioVisualizer.js
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

import throttle from 'lodash-es/throttle';

const UI_UPDATE_THROTTLE_MS = 100; // Update UI max 10 times per second (100ms)

/**
 * @typedef {object} AudioVisualizerSettings
 * @property {number} bassIntensity - Intensity multiplier for the bass frequency band.
 * @property {number} midIntensity - Intensity multiplier for the mid frequency band.
 * @property {number} trebleIntensity - Intensity multiplier for the treble frequency band.
 * @property {number} smoothingFactor - Smoothing factor for audio data changes.
 */

/**
 * @typedef {object} AudioFrequencyBands
 * @property {number} bass - Bass frequency level.
 * @property {number} mid - Mid frequency level.
 * @property {number} treble - Treble frequency level.
 */

/**
 * @typedef {object} RawAudioAnalyzerData
 * @property {number} level - Overall audio level.
 * @property {AudioFrequencyBands} frequencyBands - Audio levels for different frequency bands.
 */

/**
 * @typedef {object} AudioVisualizerAPI
 * @property {boolean} isAudioActive - Whether audio processing is currently active.
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setIsAudioActive - Function to set the audio active state.
 * @property {AudioVisualizerSettings} audioSettings - Current settings for audio processing.
 * @property {React.Dispatch<React.SetStateAction<AudioVisualizerSettings>>} setAudioSettings - Function to update audio settings.
 * @property {RawAudioAnalyzerData} analyzerData - Processed and throttled audio analysis data for UI consumption.
 * @property {(data: RawAudioAnalyzerData) => void} handleAudioDataUpdate - Callback to feed new raw audio data into the visualizer.
 */

// Helper to compare frequency band objects shallowly
const areFrequencyBandsEqual = (bandsA, bandsB) => {
  if (!bandsA || !bandsB) return bandsA === bandsB;
  return bandsA.bass === bandsB.bass && bandsA.mid === bandsB.mid && bandsA.treble === bandsB.treble;
};

/**
 * Custom hook to manage audio visualization state, including activity status,
 * settings, and processed analyzer data. It throttles UI updates for performance.
 *
 * @returns {AudioVisualizerAPI} An object containing audio visualizer state and control functions.
 */
export function useAudioVisualizer() {
  const [isAudioActive, setIsAudioActive] = useState(false);
  const [audioSettings, setAudioSettings] = useState({
    bassIntensity: 1.0,
    midIntensity: 1.0,
    trebleIntensity: 1.0,
    smoothingFactor: 0.6,
  });

  // Internal state that is updated by the throttled function
  /** @type {[RawAudioAnalyzerData, React.Dispatch<React.SetStateAction<RawAudioAnalyzerData>>]} */
  const [internalAnalyzerData, setInternalAnalyzerData] = useState({
    level: 0,
    frequencyBands: { bass: 0, mid: 0, treble: 0 },
  });

  // Memoized version of analyzerData to be passed as props.
  // This ensures the object reference only changes if the actual values change.
  const uiPropAnalyzerData = useMemo(() => ({
    level: internalAnalyzerData.level,
    frequencyBands: { // Always create a new object for frequencyBands for immutability
      bass: internalAnalyzerData.frequencyBands.bass,
      mid: internalAnalyzerData.frequencyBands.mid,
      treble: internalAnalyzerData.frequencyBands.treble,
    }
  }), [
    internalAnalyzerData.level,
    internalAnalyzerData.frequencyBands.bass, // Depend on individual primitive values
    internalAnalyzerData.frequencyBands.mid,
    internalAnalyzerData.frequencyBands.treble
  ]);

  /** @type {React.RefObject<RawAudioAnalyzerData>} */
  const latestRawDataRef = useRef({
    level: 0,
    frequencyBands: { bass: 0, mid: 0, treble: 0 },
  });

  // Throttled function to update the internal state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const throttledUpdateInternalState = useCallback(
    throttle(() => {
      // Read the latest data from the ref when the throttled function executes
      const newDataFromRef = latestRawDataRef.current;
      setInternalAnalyzerData(prevData => {
        // Only update if the values have actually changed
        if (prevData.level !== newDataFromRef.level || !areFrequencyBandsEqual(prevData.frequencyBands, newDataFromRef.frequencyBands)) {
          return newDataFromRef; // Return new data, causing a state change
        }
        return prevData; // Return old data, preventing unnecessary state change & re-render
      });
    }, UI_UPDATE_THROTTLE_MS, { leading: true, trailing: true }),
    [] // setInternalAnalyzerData is stable from useState, latestRawDataRef is a ref
  );

  /**
   * Handles incoming raw audio data, stores it in a ref, and triggers a throttled state update.
   * @param {RawAudioAnalyzerData} data - The latest raw audio data.
   */
  const handleAudioDataUpdate = useCallback((data) => {
    // Always update the ref with the absolute latest raw data
    latestRawDataRef.current = {
      level: data.level ?? 0,
      frequencyBands: data.frequencyBands ?? { bass: 0, mid: 0, treble: 0 },
    };
    // Call the throttled function, which will then decide whether to update state
    throttledUpdateInternalState();
  }, [throttledUpdateInternalState]);

  useEffect(() => {
    // Cleanup the throttle function on unmount
    return () => {
      throttledUpdateInternalState.cancel();
    };
  }, [throttledUpdateInternalState]);

  return useMemo(() => ({
    isAudioActive,
    setIsAudioActive,
    audioSettings,
    setAudioSettings,
    analyzerData: uiPropAnalyzerData, // Expose the memoized, more stable data for UI
    handleAudioDataUpdate,
  }), [
    isAudioActive,
    audioSettings,
    uiPropAnalyzerData,
    handleAudioDataUpdate,
    // setIsAudioActive and setAudioSettings are stable
  ]);
}
```

---
### `src\hooks\useCanvasContainer.js`
```js
// src/hooks/useCanvasContainer.js
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * @typedef {object} CanvasContainerOptions Options for the useCanvasContainer hook.
 * @property {() => void} [onResize] - Optional: Callback function triggered on valid resize events (debounced for zero dimensions). Also triggered on significant visual viewport scale changes.
 * @property {(isVisible: boolean) => void} [onVisibilityChange] - Optional: Callback function triggered when the container's viewport visibility changes based on IntersectionObserver.
 * @property {() => void} [onZeroDimensions] - Optional: Callback function triggered when container dimensions become zero after being valid, following a debounce check.
 */

/**
 * @typedef {object} CanvasContainerHookReturn The state and actions provided by the useCanvasContainer hook.
 * @property {React.RefObject<HTMLDivElement>} containerRef - Ref to be attached to the container element that this hook will observe. Its `.current` property will be `HTMLDivElement | null`.
 * @property {boolean} hasValidDimensions - Indicates if the container currently has valid (non-zero) width and height based on ResizeObserver.
 * @property {boolean} isContainerObservedVisible - Indicates if the container is currently considered visible within the viewport by the IntersectionObserver.
 * @property {boolean} isFullscreenActive - Indicates if the browser is currently in fullscreen mode, typically initiated via this hook.
 * @property {() => void} enterFullscreen - Function to attempt to toggle fullscreen mode. It targets an element with ID 'fullscreen-root' first, falling back to the `containerRef` element.
 */

/**
 * Custom hook to manage observation of a container element for resize, viewport visibility,
 * and fullscreen state. It provides callbacks for these events and stateful flags.
 *
 * @param {CanvasContainerOptions} [options={}] - Configuration options for the hook.
 * @returns {CanvasContainerHookReturn} An object containing the container ref, state flags, and control functions.
 */
export function useCanvasContainer(options = {}) {
  const { onResize, onVisibilityChange, onZeroDimensions } = options;

  /** @type {React.RefObject<HTMLDivElement | null>} */
  const containerRef = useRef(null);
  /** @type {React.RefObject<boolean>} */
  const isMountedRef = useRef(false);
  /** @type {React.RefObject<IntersectionObserver | null>} */
  const intersectionObserverRef = useRef(null);
  /** @type {React.RefObject<ResizeObserver | null>} */
  const resizeObserverRef = useRef(null);
  /** @type {React.RefObject<ReturnType<typeof setTimeout> | null>} */
  const zeroDimCheckTimeoutRef = useRef(null);
  /** @type {React.RefObject<{width: number, height: number}>} */
  const lastValidDimensionsRef = useRef({ width: 0, height: 0 });
  /** @type {React.RefObject<number>} */
  const lastVisualViewportScaleRef = useRef(
    typeof window !== 'undefined' && window.visualViewport ? window.visualViewport.scale : 1
  );

  const [hasValidDimensions, setHasValidDimensions] = useState(false);
  const [isContainerObservedVisible, setIsContainerObservedVisible] = useState(true);
  const [isFullscreenActive, setIsFullscreenActive] = useState(false);

  const stableOnResize = useCallback(() => {
    if (onResize) {
      onResize();
    }
  }, [onResize]);

  const handleFullscreenError = useCallback((err) => {
      if (import.meta.env.DEV) {
        console.error(`[useCanvasContainer] Error with fullscreen operation: ${err.message} (${err.name})`);
      }
      // Update fullscreen state based on the actual document state after an error.
      setIsFullscreenActive(!!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement));
  }, [setIsFullscreenActive]); // setIsFullscreenActive is stable

  const enterFullscreen = useCallback(() => {
    const elem = document.getElementById('fullscreen-root') || containerRef.current;
    if (!elem) {
      if (import.meta.env.DEV) {
        console.warn("[useCanvasContainer] Fullscreen target element not found for enterFullscreen.");
      }
      return;
    }

    const isInFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);

    if (!isInFullscreen) {
      const requestPromise = elem.requestFullscreen?.() || elem.webkitRequestFullscreen?.() || elem.mozRequestFullScreen?.() || elem.msRequestFullscreen?.();
      if (requestPromise && typeof requestPromise.catch === 'function') {
        requestPromise.catch(handleFullscreenError);
      } else if (!requestPromise) {
        if (import.meta.env.DEV) {
          console.warn("[useCanvasContainer] Fullscreen request API not supported or call failed synchronously.");
        }
        handleFullscreenError(new Error("Fullscreen request failed or not supported."));
      }
    } else {
      const exitPromise = document.exitFullscreen?.() || document.webkitExitFullscreen?.() || document.mozCancelFullScreen?.() || document.msExitFullscreen?.();
      if (exitPromise && typeof exitPromise.catch === 'function') {
        exitPromise.catch(handleFullscreenError);
      } else if (!exitPromise) {
        if (import.meta.env.DEV) {
          console.warn("[useCanvasContainer] Fullscreen exit API not supported or call failed synchronously.");
        }
        handleFullscreenError(new Error("Fullscreen exit failed or not supported."));
      }
    }
  }, [containerRef, handleFullscreenError]);

  useEffect(() => {
    isMountedRef.current = true;
    const containerElement = containerRef.current;

    if (!containerElement) {
      return;
    }

    const intersectionCallback = (entries) => {
      if (!isMountedRef.current) return;
      entries.forEach((entry) => {
        const currentlyVisible = entry.isIntersecting;
        setIsContainerObservedVisible(prevVisible => {
            if (prevVisible !== currentlyVisible) {
                if (onVisibilityChange) { onVisibilityChange(currentlyVisible); }
                return currentlyVisible;
            }
            return prevVisible;
        });
      });
    };
    intersectionObserverRef.current = new IntersectionObserver(intersectionCallback, {
      root: null, rootMargin: "0px", threshold: 0.01,
    });
    intersectionObserverRef.current.observe(containerElement);

    const resizeCallback = (entries) => {
        if (!isMountedRef.current) return;
        const entry = entries[0]; if (!entry) return;
        const { width, height } = entry.contentRect;
        const currentWidth = Math.floor(width);
        const currentHeight = Math.floor(height);

        if (zeroDimCheckTimeoutRef.current) {
            clearTimeout(zeroDimCheckTimeoutRef.current);
            zeroDimCheckTimeoutRef.current = null;
        }

        if (currentWidth > 0 && currentHeight > 0) {
            if (!hasValidDimensions) {
                setHasValidDimensions(true);
            }
            lastValidDimensionsRef.current = { width: currentWidth, height: currentHeight };
            stableOnResize();
        } else {
            if (hasValidDimensions) {
                setHasValidDimensions(false);
                zeroDimCheckTimeoutRef.current = setTimeout(() => {
                    if (!isMountedRef.current) return;
                    const checkElement = containerRef.current;
                    const checkWidth = checkElement ? checkElement.clientWidth : 0;
                    const checkHeight = checkElement ? checkElement.clientHeight : 0;
                    if (checkWidth <= 0 || checkHeight <= 0) {
                        if (onZeroDimensions) { onZeroDimensions(); }
                    } else {
                        setHasValidDimensions(true);
                        lastValidDimensionsRef.current = { width: checkWidth, height: checkHeight };
                        stableOnResize();
                    }
                    zeroDimCheckTimeoutRef.current = null;
                }, 500);
            }
        }
    };
    resizeObserverRef.current = new ResizeObserver(resizeCallback);
    resizeObserverRef.current.observe(containerElement);

    let vv = null;
    const handleVisualViewportResize = () => {
        if (!isMountedRef.current || !vv) return;
        const currentScale = vv.scale;
        if (Math.abs(currentScale - lastVisualViewportScaleRef.current) > 0.01) {
            lastVisualViewportScaleRef.current = currentScale;
            stableOnResize();
        }
    };

    if (typeof window !== 'undefined' && window.visualViewport) {
        vv = window.visualViewport;
        lastVisualViewportScaleRef.current = vv.scale;
        vv.addEventListener('resize', handleVisualViewportResize);
        vv.addEventListener('scroll', handleVisualViewportResize);
    }

    const initialWidth = containerElement.clientWidth;
    const initialHeight = containerElement.clientHeight;
    if (initialWidth > 0 && initialHeight > 0) {
        if (!hasValidDimensions) setHasValidDimensions(true);
        lastValidDimensionsRef.current = { width: initialWidth, height: initialHeight };
    } else {
        if (hasValidDimensions) setHasValidDimensions(false);
        lastValidDimensionsRef.current = { width: 0, height: 0 };
    }

    return () => {
      isMountedRef.current = false;
      if (intersectionObserverRef.current) { intersectionObserverRef.current.disconnect(); }
      if (resizeObserverRef.current) { resizeObserverRef.current.disconnect(); }
      if (zeroDimCheckTimeoutRef.current) { clearTimeout(zeroDimCheckTimeoutRef.current); }
      if (vv) {
        vv.removeEventListener('resize', handleVisualViewportResize);
        vv.removeEventListener('scroll', handleVisualViewportResize);
      }
    };
  }, [stableOnResize, onVisibilityChange, onZeroDimensions, hasValidDimensions]);

  useEffect(() => {
    const handleFullscreenChange = () => {
        const isCurrentlyFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
        setIsFullscreenActive(isCurrentlyFullscreen);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    handleFullscreenChange(); // Initial check
    return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
        document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [setIsFullscreenActive]); // setIsFullscreenActive is stable

  return useMemo(() => ({
    containerRef,
    hasValidDimensions,
    isContainerObservedVisible,
    isFullscreenActive,
    enterFullscreen,
  }), [containerRef, hasValidDimensions, isContainerObservedVisible, isFullscreenActive, enterFullscreen]);
}
```

---
### `src\hooks\useCanvasOrchestrator.js`
```js
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import debounce from '../utils/debounce';
import CanvasManager from '../utils/CanvasManager';
import { resolveImageUrl } from '../utils/imageDecoder';

const RESIZE_DEBOUNCE_DELAY = 250;

export function useCanvasOrchestrator({ canvasRefs, sideA, sideB, crossfaderValue, isInitiallyResolved, activeWorkspaceName }) {
    const isMountedRef = useRef(false);
    const [managersReady, setManagersReady] = useState(false);
    const [managers, setManagers] = useState({});
    const managerInstancesRef = useRef({});
    const resizeTimeoutRef = useRef(null);
    
    const activeWorkspaceNameRef = useRef(activeWorkspaceName);
    useEffect(() => {
        activeWorkspaceNameRef.current = activeWorkspaceName;
    }, [activeWorkspaceName]);

    useEffect(() => {
        const allRefsAreSet = Object.values(canvasRefs).every(deckRefs => 
            deckRefs.A?.current instanceof HTMLCanvasElement &&
            deckRefs.B?.current instanceof HTMLCanvasElement
        );
        if (!allRefsAreSet) return;

        const newManagers = {};
        Object.keys(canvasRefs).forEach(layerId => {
            const canvasElementA = canvasRefs[layerId]?.A?.current;
            const canvasElementB = canvasRefs[layerId]?.B?.current;
            if (canvasElementA && canvasElementB) {
                newManagers[layerId] = new CanvasManager(canvasElementA, canvasElementB, layerId);
            }
        });

        managerInstancesRef.current = newManagers;
        setManagers(newManagers);
        
        const allManagersExist = Object.keys(canvasRefs).every(id => managerInstancesRef.current?.[id] instanceof CanvasManager);
        setManagersReady(allManagersExist);

        const debouncedResize = debounce(() => {
            Object.values(managerInstancesRef.current).forEach(manager => {
                if (manager?.setupCanvas) manager.setupCanvas().catch(err => console.error(`Error during resize for layer ${manager.layerId}:`, err));
            });
        }, RESIZE_DEBOUNCE_DELAY);

        window.addEventListener('resize', debouncedResize, { passive: true });

        return () => {
            window.removeEventListener('resize', debouncedResize);
            Object.values(managerInstancesRef.current).forEach(manager => {
                if (manager?.destroy) manager.destroy();
            });
            managerInstancesRef.current = {};
        };
    }, [canvasRefs]);


    useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);
    
    useEffect(() => {
        if (!managersReady || !sideA?.config?.ts) return;
        const setup = async () => {
            const managers = managerInstancesRef.current;
            const setupPromises = Object.keys(managers).map(async (layerIdStr) => {
                const manager = managers[layerIdStr];
                if (!manager) return;
                const layerConfigA = sideA.config.layers?.[layerIdStr];
                const tokenA = sideA.config.tokenAssignments?.[layerIdStr];
                const imageUrlA = resolveImageUrl(tokenA);
                const tokenIdA = typeof tokenA === 'object' ? tokenA.id : tokenA;
                await manager.setImage(imageUrlA, tokenIdA);
                manager.applyFullConfig(layerConfigA ? JSON.parse(JSON.stringify(layerConfigA)) : null);
            });
            await Promise.all(setupPromises);
        };
        setup();
    }, [sideA.config?.ts, managersReady]);
    
    useEffect(() => {
        if (!managersReady || !sideB?.config?.ts) return;
        const setup = async () => {
            const managers = managerInstancesRef.current;
            const setupPromises = Object.keys(managers).map(async (layerIdStr) => {
                const manager = managers[layerIdStr];
                if (!manager) return;
                const layerConfigB = sideB.config.layers?.[layerIdStr];
                const tokenB = sideB.config.tokenAssignments?.[layerIdStr];
                const imageUrlB = resolveImageUrl(tokenB);
                const tokenIdB = typeof tokenB === 'object' ? tokenB.id : tokenB;
                await manager.setCrossfadeTarget(imageUrlB, layerConfigB ? JSON.parse(JSON.stringify(layerConfigB)) : null, tokenIdB);
            });
            await Promise.all(setupPromises);
        };
        setup();
    }, [sideB.config?.ts, managersReady]);

    useEffect(() => {
        if (!managersReady) return;
        const managers = managerInstancesRef.current;
        for (const layerIdStr in managers) {
            const manager = managers[layerIdStr];
            if (manager) {
                manager.setCrossfadeValue(crossfaderValue);

                // --- START: FIX FOR OPACITY CONTROL ---
                // 1. Get the opacity value from the layer's own configuration controls.
                // Fallback to 1.0 if it's not defined.
                const layerOpacityA = sideA.config?.layers?.[layerIdStr]?.opacity ?? 1.0;
                const layerOpacityB = sideB.config?.layers?.[layerIdStr]?.opacity ?? 1.0;

                // 2. Calculate the opacity from the equal-power crossfader.
                const angle = crossfaderValue * 0.5 * Math.PI;
                const crossfadeOpacityA = Math.cos(angle);
                const crossfadeOpacityB = Math.sin(angle);

                // 3. Multiply them together to get the final opacity for each canvas.
                const finalOpacityA = crossfadeOpacityA * layerOpacityA;
                const finalOpacityB = crossfadeOpacityB * layerOpacityB;

                if (manager.canvasA) {
                    manager.canvasA.style.opacity = finalOpacityA;
                    manager.canvasA.style.mixBlendMode = sideA.config?.layers?.[layerIdStr]?.blendMode || 'normal';
                }
                if (manager.canvasB) {
                    manager.canvasB.style.opacity = finalOpacityB;
                    manager.canvasB.style.mixBlendMode = sideB.config?.layers?.[layerIdStr]?.blendMode || 'normal';
                }
                // --- END: FIX FOR OPACITY CONTROL ---
            }
        }
    }, [crossfaderValue, managersReady, sideA, sideB]);
    
    const setCanvasLayerImage = useCallback((layerId, src, tokenId) => {
        if (!managersReady) return Promise.reject(new Error("Managers not ready"));
        const manager = managerInstancesRef.current?.[String(layerId)];
        if (!manager) return Promise.reject(new Error(`Manager not found for layer ${layerId}`));

        if (crossfaderValue < 0.5) {
            return manager.setImage(src, tokenId);
        } else {
            const configBForLayer = sideB?.config?.layers?.[String(layerId)];
            const configBCopy = configBForLayer ? JSON.parse(JSON.stringify(configBForLayer)) : null;
            return manager.setCrossfadeTarget(src, configBCopy, tokenId);
        }
    }, [managersReady, crossfaderValue, sideB]);

    const stopCanvasAnimations = useCallback(() => {
        Object.values(managerInstancesRef.current || {}).forEach(manager => {
            if (manager?.stopAnimationLoop) manager.stopAnimationLoop();
        });
    }, []);

    const restartCanvasAnimations = useCallback(() => {
        if (!managersReady) return;
        Object.values(managerInstancesRef.current || {}).forEach(manager => {
            const config = manager?.getConfigData?.();
            if (manager?.startAnimationLoop && config?.enabled) {
                manager.startAnimationLoop();
            }
        });
    }, [managersReady]);
    
    const handleCanvasResize = useCallback(() => {
        Object.values(managerInstancesRef.current || {}).forEach(manager => {
            if (manager?.setupCanvas) manager.setupCanvas().catch(err => console.error(`Error during resize for layer ${manager.layerId}:`, err));
        });
    }, []);

    const applyPlaybackValue = useCallback((layerId, key, value) => { managerInstancesRef.current[layerId]?.applyPlaybackValue(key, value); }, []);
    const clearAllPlaybackValues = useCallback(() => { Object.values(managerInstancesRef.current).forEach(m => m.clearPlaybackValues()); }, []);

    return useMemo(() => ({
        managersReady,
        managerInstancesRef,
        stopCanvasAnimations,
        restartCanvasAnimations,
        handleCanvasResize,
        setCanvasLayerImage,
        applyPlaybackValue,
        clearAllPlaybackValues,
    }), [
        managersReady,
        stopCanvasAnimations,
        restartCanvasAnimations,
        handleCanvasResize,
        setCanvasLayerImage,
        applyPlaybackValue,
        clearAllPlaybackValues,
    ]);
}
```

---
### `src\hooks\useCoreApplicationStateAndLifecycle.js`
```js
// src/hooks/useCoreApplicationStateAndLifecycle.js
import { useRef, useEffect, useCallback, useMemo } from "react";
import { useCanvasOrchestrator } from "./useCanvasOrchestrator";
import { useRenderLifecycle } from './useRenderLifecycle';
import { useCanvasContainer } from './useCanvasContainer';
import { useAudioVisualizer } from './useAudioVisualizer';
import { useAnimationLifecycleManager } from './useAnimationLifecycleManager';
import { usePLockSequencer } from './usePLockSequencer';
import { useWorkspaceContext } from '../context/WorkspaceContext';
import { useVisualEngineContext } from '../context/VisualEngineContext';
import { useUpProvider } from '../context/UpProvider';
import { useUserSession } from '../context/UserSessionContext';

export const useCoreApplicationStateAndLifecycle = (props) => {
  const {
    canvasRefs,
    isBenignOverlayActive,
    animatingPanel,
  } = props;

  const {
    isInitiallyResolved,
    loadError,
    activeWorkspaceName,
    isFullyLoaded,
  } = useWorkspaceContext();

  const {
    sideA,
    sideB,
    renderedCrossfaderValue, // Use the rendered value for the orchestrator
    uiControlConfig,
    updateLayerConfig,
  } = useVisualEngineContext();

  const { upInitializationError, upFetchStateError } = useUpProvider();
  const { hostProfileAddress: currentProfileAddress } = useUserSession();

  const isMountedRef = useRef(false);
  const internalResetLifecycleRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // --- FIX: Rely directly on sideA, sideB, and the renderedCrossfaderValue ---
  const {
    managersReady, managerInstancesRef,
    stopCanvasAnimations, restartCanvasAnimations,
    setCanvasLayerImage,
    applyPlaybackValue, clearAllPlaybackValues,
    handleCanvasResize,
  } = useCanvasOrchestrator({
    canvasRefs,
    sideA,
    sideB,
    crossfaderValue: renderedCrossfaderValue,
    isInitiallyResolved,
    activeWorkspaceName,
  });
  // --- END FIX ---

  const sequencer = usePLockSequencer({
    onValueUpdate: (layerId, paramName, value) => {
      updateLayerConfig(String(layerId), paramName, value); 
      if (applyPlaybackValue) {
        applyPlaybackValue(String(layerId), paramName, value);
      }
    },
    onAnimationEnd: (finalStateSnapshot) => {
      if (clearAllPlaybackValues) {
        clearAllPlaybackValues();
      }
      if (finalStateSnapshot) {
        for (const layerId in finalStateSnapshot) {
          for (const paramName in finalStateSnapshot[layerId]) {
            updateLayerConfig(layerId, paramName, finalStateSnapshot[layerId][paramName]);
          }
        }
      }
    }
  });

  const audioState = useAudioVisualizer();

  const handleZeroDimensionsOrchestrator = useCallback(() => {
    if (isMountedRef.current && internalResetLifecycleRef.current && typeof internalResetLifecycleRef.current === 'function') {
      if (import.meta.env.DEV) console.log("[CoreAppLifecycle] Zero dimensions detected, triggering lifecycle reset.");
      internalResetLifecycleRef.current();
    }
  }, []);

  const onResizeCanvasContainer = useCallback(() => {
    if (isMountedRef.current && typeof handleCanvasResize === 'function') {
      handleCanvasResize();
    }
  }, [handleCanvasResize]);

  const { containerRef, hasValidDimensions, isContainerObservedVisible, isFullscreenActive, enterFullscreen } = useCanvasContainer({
    onResize: onResizeCanvasContainer,
    onZeroDimensions: handleZeroDimensionsOrchestrator,
  });

  const renderLifecycleData = useRenderLifecycle({
    managersReady,
    isInitiallyResolved,
    hasValidDimensions,
    isContainerObservedVisible,
    configLoadNonce: 0,
    currentProfileAddress,
    layerConfigs: uiControlConfig?.layers,
    targetLayerConfigsForPreset: null,
    targetTokenAssignmentsForPreset: null,
    loadError,
    upInitializationError,
    upFetchStateError,
    stopAllAnimations: stopCanvasAnimations,
    restartCanvasAnimations: restartCanvasAnimations,
    isFullyLoaded, 
  });
  const {
    renderState, loadingStatusMessage, isStatusFadingOut, showStatusDisplay,
    showRetryButton, isTransitioning,
    outgoingLayerIdsOnTransitionStart,
    makeIncomingCanvasVisible,
    isAnimating, handleManualRetry, resetLifecycle
  } = renderLifecycleData;

  useEffect(() => {
    internalResetLifecycleRef.current = resetLifecycle;
  }, [resetLifecycle]);

  useAnimationLifecycleManager({
    isMounted: isMountedRef.current,
    renderState,
    isContainerObservedVisible,
    isBenignOverlayActive,
    animatingPanel,
    isAnimating,
    isTransitioning,
    restartCanvasAnimations,
    stopCanvasAnimations,
  });

  return useMemo(() => ({
    containerRef,
    managerInstancesRef,
    audioState,
    renderState,
    loadingStatusMessage,
    isStatusFadingOut,
    showStatusDisplay,
    showRetryButton,
    isTransitioning,
    outgoingLayerIdsOnTransitionStart,
    makeIncomingCanvasVisible,
    isAnimating,
    handleManualRetry,
    resetLifecycle,
    managersReady,
    stopCanvasAnimations,
    restartCanvasAnimations,
    setCanvasLayerImage,
    hasValidDimensions,
    isContainerObservedVisible,
    isFullscreenActive,
    enterFullscreen,
    isMountedRef,
    sequencer,
    uiControlConfig,
  }), [
    containerRef, managerInstancesRef, audioState, renderState, loadingStatusMessage,
    isStatusFadingOut, showStatusDisplay, showRetryButton, isTransitioning,
    outgoingLayerIdsOnTransitionStart, makeIncomingCanvasVisible, isAnimating,
    handleManualRetry,
    resetLifecycle, managersReady,
    stopCanvasAnimations, restartCanvasAnimations, setCanvasLayerImage,
    hasValidDimensions, isContainerObservedVisible, isFullscreenActive, enterFullscreen,
    isMountedRef, sequencer, uiControlConfig
  ]);
};
```

---
### `src\hooks\useLsp1Events.js`
```js
// src/hooks/useLsp1Events.js
import { useEffect, useRef } from 'react';

import LSP1EventService from '../services/LSP1EventService'; // Local service

import { isAddress } from 'viem'; // Third-party library

/**
 * @typedef {object} Lsp1Event - Represents an event received from the LSP1EventService.
 * Structure depends on the specific event type.
 */

/**
 * Manages the lifecycle of an LSP1EventService instance, automatically
 * initializing, connecting, and cleaning up based on the provided profileAddress.
 * It subscribes to events from the service using the provided `onEventReceived`
 * callback, ensuring the callback reference is kept up-to-date without causing
 * unnecessary effect re-runs.
 *
 * @param {string | null} profileAddress - The address of the Universal Profile to listen to. The service will connect/disconnect as this address changes or becomes null/invalid.
 * @param {(event: Lsp1Event) => void} onEventReceived - Callback function executed when a new LSP1 event is received from the service.
 * @returns {void} This hook does not return a value but manages side effects.
 */
export function useLsp1Events(profileAddress, onEventReceived) {
  /** @type {React.RefObject<LSP1EventService | null>} */
  const eventServiceRef = useRef(null);
  /** @type {React.RefObject<() => void>} */
  const unsubscribeRef = useRef(() => {});
  /** @type {React.RefObject<(event: Lsp1Event) => void>} */
  const onEventReceivedRef = useRef(onEventReceived);

  // Keep the callback ref updated to avoid adding it to the main effect's dependencies
  useEffect(() => {
    onEventReceivedRef.current = onEventReceived;
  }, [onEventReceived]);

  // Effect to manage the service lifecycle based on profileAddress
  useEffect(() => {
    /** @type {boolean} - Tracks if the component is still mounted to prevent state updates on unmounted components. */
    let isMounted = true;

    const initializeAndListen = async (address) => {
      // Cleanup existing service before creating a new one
      if (eventServiceRef.current) {
        if (typeof unsubscribeRef.current === 'function') unsubscribeRef.current();
        eventServiceRef.current.cleanupListeners();
        eventServiceRef.current = null;
        unsubscribeRef.current = () => {};
      }

      const service = new LSP1EventService();
      eventServiceRef.current = service; // Store the instance immediately

      try {
        await service.initialize();
        if (!isMounted) {
          // Clean up the newly created service if unmounted during init
          service.cleanupListeners();
          eventServiceRef.current = null;
          return;
        }

        const success = await service.setupEventListeners(address);
        if (success && isMounted) {
          // Subscribe using the ref to the latest callback
          unsubscribeRef.current = service.onEvent((event) => {
            if (onEventReceivedRef.current) {
              onEventReceivedRef.current(event);
            }
          });
        } else if (!success && isMounted) {
          if (import.meta.env.DEV) {
            console.warn(`[useLsp1Events] Failed to set up listeners for ${address}.`);
          }
          service.cleanupListeners();
          eventServiceRef.current = null;
        } else if (!isMounted) {
           // Clean up if unmounted during listener setup
           service.cleanupListeners();
           eventServiceRef.current = null;
        }
      } catch (error) {
        if (import.meta.env.DEV) {
            console.error(`[useLsp1Events] Error initializing/setting up service for ${address}:`, error);
        }
        if (eventServiceRef.current) { // Check ref before cleanup
            eventServiceRef.current.cleanupListeners();
            eventServiceRef.current = null;
        }
        unsubscribeRef.current = () => {};
      }
    };

    const cleanupService = () => {
      if (typeof unsubscribeRef.current === 'function') {
        unsubscribeRef.current();
        unsubscribeRef.current = () => {};
      }
      if (eventServiceRef.current) {
        eventServiceRef.current.cleanupListeners();
        eventServiceRef.current = null;
      }
    };

    if (profileAddress && isAddress(profileAddress)) {
      initializeAndListen(profileAddress);
    } else {
      cleanupService();
    }

    // Cleanup function for when the hook unmounts or profileAddress changes
    return () => {
      isMounted = false;
      cleanupService();
    };
  }, [profileAddress]); // Only re-run when the profileAddress changes
}
```

---
### `src\hooks\useNotifications.js`
```js
// src/hooks/useNotifications.js
import { useState, useCallback, useMemo, useEffect } from "react";

const LOCAL_STORAGE_KEY = "axyz_app_notifications";

/**
 * @typedef {object} NotificationItem
 * @property {string|number} id - Unique identifier for the notification.
 * @property {number} timestamp - Timestamp of when the notification was created or received.
 * @property {boolean} read - Whether the notification has been marked as read.
 * @property {string} [messageFromInput] - Optional: A pre-formatted message if provided directly to addNotification.
 * @property {string} type - Event type (e.g., 'follower_gained', 'lyx_received'). From LSP1EventService.
 * @property {string} [typeId] - The on-chain typeId of the event. From LSP1EventService.
 * @property {string} [sender] - Sender address. From LSP1EventService.
 * @property {string} [value] - Event value. From LSP1EventService.
 * @property {string} [data] - Raw receivedData. From LSP1EventService.
 * @property {object} [decodedPayload] - Decoded payload, e.g., followerAddress. From LSP1EventService.
 * @property {string} [link] - Optional: A URL link associated with the notification (if provided to addNotification).
 */

/**
 * @typedef {object} NotificationInput
 * @property {string} [message] - Optional: A pre-formatted message. If not provided, NotificationItem will generate one.
 * @property {string} type - REQUIRED: Event type from LSP1EventService or a custom type.
 * @property {string} [typeId] - Optional: The on-chain typeId.
 * @property {string} [sender] - Optional: Sender address.
 * @property {string} [value] - Optional: Event value.
 * @property {string} [data] - Optional: Raw receivedData.
 * @property {object} [decodedPayload] - Optional: Decoded payload.
 * @property {string} [link] - Optional: A URL link.
 * @property {string|number} [id] - Optional: Predefined ID.
 * @property {number} [timestamp] - Optional: Predefined timestamp.
 * @property {boolean} [read] - Optional: Initial read status.
 */

/**
 * @typedef {object} NotificationsAPI
 * @property {Array<NotificationItem>} notifications - The current array of notification objects.
 * @property {(notificationInput: NotificationInput) => void} addNotification - Adds a new notification to the list.
 * @property {(id: string|number) => void} markAsRead - Marks a specific notification as read by its ID.
 * @property {() => void} markAllAsRead - Marks all current notifications as read.
 * @property {(id: string|number) => void} removeNotification - Removes a specific notification from the list by its ID.
 * @property {() => void} clearAll - Removes all notifications from the list.
 * @property {number} unreadCount - The count of unread notifications.
 */

/**
 * Manages a list of notifications, providing functions to add, remove,
 * mark as read, and clear notifications. It persists the notification state
 * to localStorage to maintain notifications across sessions. It also calculates
 * and provides the count of unread notifications.
 *
 * @param {Array<NotificationItem>} [initialNotifications=[]] - An optional initial array of notification objects. Primarily used if localStorage is empty or fails.
 * @returns {NotificationsAPI} An object containing the current notifications array, functions to manage them, and the unread count.
 */
export function useNotifications(initialNotifications = []) {
  const [notifications, setNotifications] = useState(() => {
    try {
      const storedNotifications = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedNotifications) {
        const parsed = JSON.parse(storedNotifications);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(
          "[useNotifications] Error loading notifications from localStorage:",
          error,
        );
      }
    }
    return Array.isArray(initialNotifications) ? initialNotifications : [];
  });

  // Effect to save notifications to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notifications));
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(
          "[useNotifications] Error saving notifications to localStorage:",
          error,
        );
      }
    }
  }, [notifications]);

  /**
   * Adds a new notification to the list, ensuring a unique ID and timestamp.
   * @param {NotificationInput} notificationInput - The notification object to add.
   */
  const addNotification = useCallback((notificationInput) => {
    // The `notificationInput` object is the `eventObj` from LSP1EventService
    // or a custom object if addNotification is called from elsewhere.
    const formattedNotification = {
      // Fields directly from LSP1EventService's eventObj or from custom input
      id: notificationInput.id || `notification_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      timestamp: notificationInput.timestamp || Date.now(),
      read: notificationInput.read || false,
      type: notificationInput.type, // This is the human-readable eventTypeName
      typeId: notificationInput.typeId, // The on-chain typeId
      sender: notificationInput.sender, // The determined sender/initiator
      value: notificationInput.value,   // The event value
      data: notificationInput.data,     // The raw receivedData
      decodedPayload: notificationInput.decodedPayload, // Contains followerAddress etc.
      
      // Optional fields that might be passed if addNotification is called with a custom object
      messageFromInput: notificationInput.message, // If a pre-formatted message is passed
      link: notificationInput.link,
    };
    setNotifications((prev) => [formattedNotification, ...prev]); // Prepend
  }, []);

  /**
   * Marks a specific notification as read by its ID.
   * @param {string|number} id - The ID of the notification to mark as read.
   */
  const markAsRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif)),
    );
  }, []);

  /** Marks all current notifications as read. */
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
  }, []);

  /**
   * Removes a specific notification from the list by its ID.
   * @param {string|number} id - The ID of the notification to remove.
   */
  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  }, []);

  /** Removes all notifications from the list. */
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  /** Memoized count of unread notifications. */
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  return useMemo(() => ({
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    unreadCount,
  }), [
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    unreadCount,
  ]);
}
```

---
### `src\hooks\usePanelState.js`
```js
// src/hooks/usePanelState.js
import { useState, useCallback, useEffect, useMemo, useRef } from "react";

const OPEN_ANIMATION_DURATION = 500;
const CLOSE_ANIMATION_DELAY = 500;

/**
 * @typedef {object} PanelState
 * @property {string | null} activePanel - The identifier of the currently active panel (e.g., 'controls', 'notifications', 'tokens'), or null if no panel is active.
 * @property {string | null} animatingPanel - The identifier of the panel currently undergoing an open/close animation (e.g., 'controls', 'closing'), or null.
 * @property {boolean} tokenSelectorOpen - True if the token selector overlay should be open. This is typically true when `activePanel` is 'tokens'.
 * @property {string} activeLayerTab - The identifier of the currently active layer tab (e.g., 'tab1', 'tab2', 'tab3').
 * @property {React.Dispatch<React.SetStateAction<string>>} setActiveLayerTab - Function to set the active layer tab.
 * @property {(panelName: string | null) => void} togglePanel - Function to toggle a panel's visibility (opens if closed, closes if open). Pass `null` to close the current panel.
 * @property {(panelName: string) => void} openPanel - Function to open a specific panel.
 * @property {() => void} closePanel - Function to close any currently active panel.
 * @property {(panelName: string) => boolean} isPanelActive - Function to check if a specific panel is currently active.
 * @property {() => number} getActiveLayerId - Function to get the numerical layer ID corresponding to the `activeLayerTab`.
 * @property {Object.<string, number>} tabToLayer - A mapping from tab identifiers (e.g., 'tab1') to their corresponding numerical layer IDs (e.g., 1).
 */

/**
 * Manages all state related to UI panels, layer tabs, and panel animations.
 * This hook is a consolidation of the previous `usePanelManager` and `usePanelState` hooks.
 *
 * @param {string|null} [initialPanel=null] - The identifier of the panel to be initially active.
 * @param {string} [initialLayerTab='tab1'] - The identifier of the initially active layer tab.
 * @returns {PanelState} An object containing the panel and tab state, along with functions to manage them.
 */
export function usePanelState(initialPanel = null, initialLayerTab = 'tab1') {
  const [activePanel, setActivePanel] = useState(initialPanel);
  const [animatingPanel, setAnimatingPanel] = useState(null);
  const [tokenSelectorOpen, setTokenSelectorOpen] = useState(initialPanel === "tokens");
  const [activeLayerTab, setActiveLayerTab] = useState(initialLayerTab);

  const openTimeoutRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    setTokenSelectorOpen(activePanel === "tokens");
  }, [activePanel]);

  const openPanel = useCallback((panelName) => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);

    setAnimatingPanel(panelName);
    setActivePanel(panelName);

    openTimeoutRef.current = setTimeout(() => {
      setAnimatingPanel(null);
    }, OPEN_ANIMATION_DURATION);
  }, []);

  const closePanel = useCallback(() => {
    if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);

    setAnimatingPanel("closing");

    closeTimeoutRef.current = setTimeout(() => {
      setActivePanel(null);
      setAnimatingPanel(null);
    }, CLOSE_ANIMATION_DELAY);
  }, []);

  const togglePanel = useCallback((panelName) => {
      const cleanPanelName = panelName === "null" ? null : panelName;
      // Directly check the current state, don't use a state updater function here.
      if (activePanel === cleanPanelName) {
        closePanel();
      } else {
        openPanel(cleanPanelName);
      }
    }, [activePanel, openPanel, closePanel]);

  const isPanelActive = useCallback((panelName) => {
    return activePanel === panelName;
  }, [activePanel]);

  const tabToLayer = useMemo(() => ({
    tab1: 3, // Top
    tab2: 2, // Middle
    tab3: 1, // Bottom
  }), []);

  const getActiveLayerId = useCallback(() => {
    return tabToLayer[activeLayerTab] || 3;
  }, [activeLayerTab, tabToLayer]);

  return useMemo(() => ({
    activePanel,
    animatingPanel,
    tokenSelectorOpen,
    activeLayerTab,
    setActiveLayerTab,
    togglePanel,
    openPanel,
    closePanel,
    isPanelActive,
    getActiveLayerId,
    tabToLayer,
  }), [
    activePanel,
    animatingPanel,
    tokenSelectorOpen,
    activeLayerTab,
    togglePanel,
    openPanel,
    closePanel,
    isPanelActive,
    getActiveLayerId,
    tabToLayer,
  ]);
}
```

---
### `src\hooks\usePLockSequencer.js`
```js
// src/hooks/usePLockSequencer.js
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

const LERP_THRESHOLD = 1e-5;
const TRANSITION_ANIMATION_DURATION = 1000; // ms for smooth stop animation
const lerp = (start, end, t) => start * (1 - t) + end * t;

const SPEED_DURATIONS = {
  fast: 4000,
  medium: 8000,
  slow: 12000,
};

export const usePLockSequencer = ({ onValueUpdate, onAnimationEnd }) => {
  const [pLockState, setPLockState] = useState('idle');
  const [loopProgress, setLoopProgress] = useState(0);
  const [pLockSpeed, setPLockSpeed] = useState('medium');

  const stateRef = useRef(pLockState);
  const animationDataRef = useRef({});
  const transitionDataRef = useRef(null);
  const startTimeRef = useRef(0);
  const loopDurationRef = useRef(SPEED_DURATIONS.medium);
  const rafRef = useRef(null);
  const onValueUpdateRef = useRef(onValueUpdate);
  const onAnimationEndRef = useRef(onAnimationEnd);
  const initialStateSnapshotRef = useRef(null);
  const prevProgressRef = useRef(0);

  useEffect(() => { stateRef.current = pLockState; }, [pLockState]);
  useEffect(() => { onValueUpdateRef.current = onValueUpdate; }, [onValueUpdate]);
  useEffect(() => { onAnimationEndRef.current = onAnimationEnd; }, [onAnimationEnd]);

  const stopAndClear = useCallback((stateToApplyOnEnd = null) => {
    if (onAnimationEndRef.current) {
      // Apply the provided final state, or null to just clear playback values
      onAnimationEndRef.current(stateToApplyOnEnd);
    }
    setPLockState('idle');
    setLoopProgress(0);
    animationDataRef.current = {};
    initialStateSnapshotRef.current = null;
    transitionDataRef.current = null;
    startTimeRef.current = 0;
    prevProgressRef.current = 0;
  }, []);

  const armSequencer = useCallback((snapshot) => {
    // Clear previous animation playback state without snapping values
    stopAndClear(null);
    setPLockState('armed');
    initialStateSnapshotRef.current = snapshot;
  }, [stopAndClear]);

  const initiatePlayback = useCallback((finalConfigs) => {
    const initialConfigs = initialStateSnapshotRef.current;
    if (!initialConfigs) {
      stopAndClear(null);
      return;
    }

    const newAnimationData = {};
    let hasChanges = false;
    for (const layerId in initialConfigs) {
      if (!finalConfigs[layerId]) continue;
      const layerAnimationData = {};
      
      for (const paramName in initialConfigs[layerId]) {
        const initialValue = initialConfigs[layerId][paramName];
        const finalValue = finalConfigs[layerId]?.[paramName];
        
        if (finalValue !== undefined && JSON.stringify(initialValue) !== JSON.stringify(finalValue)) {
          layerAnimationData[paramName] = { initialValue, targetValue: finalValue };
          hasChanges = true;
        }
      }
      
      if (Object.keys(layerAnimationData).length > 0) {
        newAnimationData[layerId] = layerAnimationData;
      }
    }

    if (!hasChanges) {
      stopAndClear(null);
      return;
    }

    animationDataRef.current = newAnimationData;
    loopDurationRef.current = SPEED_DURATIONS[pLockSpeed];
    prevProgressRef.current = 0;
    setPLockState('playing');
    startTimeRef.current = performance.now();
  }, [stopAndClear, pLockSpeed]);

  const initiateStopAnimation = useCallback(() => {
    const currentAnimationData = animationDataRef.current;
    if (Object.keys(currentAnimationData).length === 0) {
      stopAndClear(null);
      return;
    }
    const lastKnownValues = {};
    const targetValuesToRestore = {};
    const loopElapsedTime = (performance.now() - startTimeRef.current) % loopDurationRef.current;
    const performanceDuration = loopDurationRef.current / 2;

    for (const layerId in currentAnimationData) {
      lastKnownValues[layerId] = {};
      targetValuesToRestore[layerId] = {};
      for (const paramName in currentAnimationData[layerId]) {
        const { initialValue, targetValue } = currentAnimationData[layerId][paramName];
        targetValuesToRestore[layerId][paramName] = targetValue;
        
        if (typeof initialValue === 'number' && typeof targetValue === 'number') {
            lastKnownValues[layerId][paramName] = loopElapsedTime < performanceDuration
              ? lerp(targetValue, initialValue, loopElapsedTime / performanceDuration)
              : lerp(initialValue, targetValue, (loopElapsedTime - performanceDuration) / performanceDuration);
        } else {
            lastKnownValues[layerId][paramName] = loopElapsedTime < performanceDuration ? targetValue : initialValue;
        }
      }
    }
    transitionDataRef.current = { startTime: performance.now(), fromValues: lastKnownValues, toValues: targetValuesToRestore };
    animationDataRef.current = {};
    setPLockState('stopping');
  }, [stopAndClear]);

  const toggle = useCallback((currentLiveConfigs) => {
    const currentState = stateRef.current;
    if (currentState === 'idle') {
      armSequencer(JSON.parse(JSON.stringify(currentLiveConfigs)));
    } else if (currentState === 'armed') {
      initiatePlayback(currentLiveConfigs);
    } else if (currentState === 'playing') {
      initiateStopAnimation();
    }
  }, [armSequencer, initiatePlayback, initiateStopAnimation]);

  useEffect(() => {
    const animationLoop = (timestamp) => {
      const currentState = stateRef.current;
      let continueLoop = false;

      if (currentState === 'stopping') {
        continueLoop = true;
        const transitionData = transitionDataRef.current;
        if (!transitionData) { stopAndClear(null); return; }
        const elapsed = timestamp - transitionData.startTime;
        const progress = Math.min(1.0, elapsed / TRANSITION_ANIMATION_DURATION);
        
        for (const layerId in transitionData.fromValues) {
          for (const paramName in transitionData.fromValues[layerId]) {
            const from = transitionData.fromValues[layerId][paramName];
            const to = transitionData.toValues[layerId][paramName];
            
            if (typeof from === 'number' && typeof to === 'number') {
                onValueUpdateRef.current(layerId, paramName, lerp(from, to, progress));
            } else {
                onValueUpdateRef.current(layerId, paramName, progress < 1.0 ? from : to);
            }
          }
        }

        if (progress >= 1.0) {
          // Stop and apply the final target values as the new resting state
          stopAndClear(transitionData.toValues);
          transitionDataRef.current = null;
        }
      } else if (currentState === 'playing') {
        continueLoop = true;
        const duration = loopDurationRef.current;
        const startTime = startTimeRef.current;
        const loopElapsedTime = (timestamp - startTime) % duration;
        const currentProgress = loopElapsedTime / duration;
        setLoopProgress(currentProgress);
        
        const performanceDuration = duration / 2;
        const isFirstHalf = loopElapsedTime < performanceDuration;
        const justCrossedMidpoint = prevProgressRef.current < 0.5 && currentProgress >= 0.5;
        const justStartedLoop = prevProgressRef.current > currentProgress;

        for (const layerId in animationDataRef.current) {
          const layerData = animationDataRef.current[layerId];
          for (const paramName in layerData) {
            const { initialValue, targetValue } = layerData[paramName];
            
            if (typeof initialValue === 'number' && typeof targetValue === 'number') {
              // INVERTED: Animate from target to initial, then back to target
              const value = isFirstHalf
                ? lerp(targetValue, initialValue, loopElapsedTime / performanceDuration)
                : lerp(initialValue, targetValue, (loopElapsedTime - performanceDuration) / performanceDuration);
              onValueUpdateRef.current(layerId, paramName, value);
            } else {
              // INVERTED: Start at target, switch to initial at midpoint
              if (justStartedLoop) {
                onValueUpdateRef.current(layerId, paramName, targetValue);
              } else if (justCrossedMidpoint) {
                onValueUpdateRef.current(layerId, paramName, initialValue);
              }
            }
          }
        }
        prevProgressRef.current = currentProgress;
      }

      if (continueLoop) rafRef.current = requestAnimationFrame(animationLoop);
      else rafRef.current = null;
    };

    const shouldLoop = ['playing', 'stopping'].includes(pLockState);
    if (shouldLoop && !rafRef.current) {
      if (pLockState === 'playing' && !startTimeRef.current) startTimeRef.current = performance.now();
      rafRef.current = requestAnimationFrame(animationLoop);
    }

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
  }, [pLockState, stopAndClear]);

  const hasLockedParams = useMemo(() => {
    const data = animationDataRef.current;
    return data && Object.keys(data).length > 0;
  }, [pLockState]);

  return useMemo(() => ({
    pLockState, loopProgress, hasLockedParams, toggle,
    animationDataRef, pLockSpeed, setPLockSpeed,
  }), [pLockState, loopProgress, hasLockedParams, toggle, pLockSpeed]);
};
```

---
### `src\hooks\useProfileCache.js`
```js
// src/hooks/useProfileCache.js
import { useState, useCallback, useMemo } from "react";

import { ERC725 } from "@erc725/erc725.js";
import lsp3ProfileSchema from "@erc725/erc725.js/schemas/LSP3ProfileMetadata.json";

import { isAddress } from "viem";

// Configuration
const RPC_URL = import.meta.env.VITE_LUKSO_MAINNET_RPC_URL || "https://rpc.mainnet.lukso.network";
const IPFS_GATEWAY = import.meta.env.VITE_IPFS_GATEWAY || "https://api.universalprofile.cloud/ipfs/";

// In-memory Cache (shared across hook instances within the session)
/** @type {Object.<string, {data: ProfileData, error: boolean, timestamp: number}>} */
const profileCacheStore = {};
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Debounce mechanism to prevent fetch storms
/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const fetchDebounceMap = new Map();
const DEBOUNCE_DELAY_MS = 300;

/**
 * @typedef {object} ProfileData The structure of cached or fetched profile data.
 * @property {string} name - The profile name (or a fallback like 'UP (0x...)', or an error indicator like 'Error (0x...)').
 * @property {string | null} profileImage - The resolved URL for the profile image, or null.
 * @property {string | null} backgroundImage - The resolved URL for the background image, or null.
 */

/**
 * @typedef {object} ProfileCacheResult The return value of the useProfileCache hook.
 * @property {(address: string | null) => Promise<ProfileData | null>} getProfileData - Asynchronously fetches profile data for a given address. It utilizes an in-memory cache with expiration and debounces requests for the same address. Returns `null` if the address is invalid or if an error occurs during the initial setup of the fetch. On successful fetch or cache hit, it returns a `ProfileData` object. If an error occurred during fetching or processing, the `name` property of `ProfileData` will indicate an error state (e.g., "Error (0x...)").
 * @property {(address: string | null) => ProfileData | null} getCachedProfile - Synchronously retrieves profile data from the cache if it's valid and not expired. Returns `null` if the address is invalid, or if the data is not in the cache, is expired, or represents a cached error state (use `getProfileData` to re-fetch errors).
 * @property {string | null} isLoadingAddress - The address currently being fetched by this specific hook instance, or `null` if no fetch is in progress for this instance.
 */

/**
 * Provides functions to fetch and cache LSP3 Profile data (name, images) for Lukso Universal Profiles.
 * It uses an in-memory cache with expiration and debounces requests for the same address
 * made in quick succession. It leverages erc725.js for efficient data fetching and decoding.
 *
 * @returns {ProfileCacheResult} An object containing functions to get profile data and the loading status.
 */
export function useProfileCache() {
  // State to track loading status for THIS hook instance
  const [isLoadingAddress, setIsLoadingAddress] = useState(null);

  /**
   * Fetches LSP3 Profile data for an address, checking cache first and debouncing requests.
   * Returns cached data immediately if valid. Otherwise, initiates a debounced fetch.
   * Handles VerifiableURI decoding and IPFS resolution via erc725.js.
   *
   * @param {string | null} address The Universal Profile address to fetch data for.
   * @returns {Promise<ProfileData | null>} A promise resolving to the profile data or null/error object.
   */
  const getProfileData = useCallback(
    async (address) => {
      if (!address || typeof address !== "string" || !isAddress(address)) {
        if (import.meta.env.DEV) {
            console.warn(`[ProfileCache] Invalid address provided to getProfileData: ${address}`);
        }
        return null;
      }
      const lowerAddress = address.toLowerCase();

      const now = Date.now();
      const cachedEntry = profileCacheStore[lowerAddress];

      // Return valid, non-error cache entry immediately
      if (cachedEntry && !cachedEntry.error && now - cachedEntry.timestamp < CACHE_DURATION_MS) {
        return cachedEntry.data;
      }
      // Return cached error state immediately (allows UI to show error without re-fetching immediately)
      if (cachedEntry?.error) {
        // If error is stale, allow re-fetch by not returning here, otherwise return cached error.
        if (now - cachedEntry.timestamp < CACHE_DURATION_MS) {
            return cachedEntry.data;
        }
      }

      // Debounce logic
      if (fetchDebounceMap.has(lowerAddress)) {
        // If a fetch is already debounced for this address, return current cache or loading state
        return cachedEntry?.data || { name: "Loading...", profileImage: null, backgroundImage: null };
      }
      const timerId = setTimeout(() => { fetchDebounceMap.delete(lowerAddress); }, DEBOUNCE_DELAY_MS);
      fetchDebounceMap.set(lowerAddress, timerId);

      setIsLoadingAddress(lowerAddress);

      try {
        const erc725Instance = new ERC725(lsp3ProfileSchema, lowerAddress, RPC_URL, { ipfsGateway: IPFS_GATEWAY });
        const fetchedData = await erc725Instance.fetchData("LSP3Profile");

        if (fetchedData?.value?.LSP3Profile) {
          const profile = fetchedData.value.LSP3Profile;
          const defaultName = `UP (${lowerAddress.slice(0, 6)}...)`;
          const name = profile.name?.trim() ? profile.name.trim() : defaultName;

          const getImageUrl = (images) => {
            if (!Array.isArray(images) || images.length === 0) return null;
            const url = images[0]?.url; // Assuming the first image is the primary one
            if (!url || typeof url !== "string") return null;

            if (url.startsWith("ipfs://")) {
              const hash = url.slice(7);
              const gateway = IPFS_GATEWAY.endsWith("/") ? IPFS_GATEWAY : IPFS_GATEWAY + "/";
              return `${gateway}${hash}`;
            }
            if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;

            if (import.meta.env.DEV) {
                console.warn(`[ProfileCache] Unknown image URL format for address ${lowerAddress}: ${url}`);
            }
            return null;
          };

          const profileImageUrl = getImageUrl(profile.profileImage);
          const backgroundImageUrl = getImageUrl(profile.backgroundImage);

          const profileResult = { name, profileImage: profileImageUrl, backgroundImage: backgroundImageUrl };

          profileCacheStore[lowerAddress] = { data: profileResult, error: false, timestamp: Date.now() };
          return profileResult;

        } else {
          if (import.meta.env.DEV) {
            console.warn(`[ProfileCache] LSP3Profile data key found but content invalid or missing for ${lowerAddress}. Fetched data:`, fetchedData);
          }
          // This case indicates that the LSP3Profile key might exist but doesn't contain the expected structure.
          throw new Error("LSP3Profile data key found but content invalid or missing.");
        }
      } catch (error) {
        if (import.meta.env.DEV) {
            console.error(`[ProfileCache] Error fetching or processing profile data for ${lowerAddress}:`, error);
        }
        const errorResult = { name: `Error (${lowerAddress.slice(0, 6)})`, profileImage: null, backgroundImage: null };
        profileCacheStore[lowerAddress] = { data: errorResult, error: true, timestamp: Date.now() };
        return errorResult;
      } finally {
        const currentTimerId = fetchDebounceMap.get(lowerAddress);
        if (currentTimerId === timerId) { // Ensure we only clear the timer we set
            clearTimeout(timerId);
            fetchDebounceMap.delete(lowerAddress);
        }
        // Clear loading state *only if* this instance was the one loading THIS address
        // and the address hasn't changed in the meantime by another call.
        if (isLoadingAddress === lowerAddress) {
             setIsLoadingAddress(null);
        }
      }
    },
    [isLoadingAddress],
  );

  /**
   * Synchronously retrieves profile data from the cache if available, valid, and not an error state.
   * Does NOT trigger a network fetch.
   * @param {string | null} address The Universal Profile address to check in the cache.
   * @returns {ProfileData | null} The cached profile data object, or null if not found/expired/invalid/error.
   */
  const getCachedProfile = useCallback((address) => {
    if (!address || typeof address !== "string" || !isAddress(address)) return null;
    const lowerAddress = address.toLowerCase();
    const cachedEntry = profileCacheStore[lowerAddress];

    // Only return if cached, not an error, and not expired
    if (cachedEntry && !cachedEntry.error && Date.now() - cachedEntry.timestamp < CACHE_DURATION_MS) {
      return cachedEntry.data;
    }
    return null;
  }, []);

  return useMemo(() => ({
    getProfileData,
    getCachedProfile,
    isLoadingAddress
  }), [getProfileData, getCachedProfile, isLoadingAddress]);
}
```

---
### `src\hooks\useRenderLifecycle.js`
```js
// src/hooks/useRenderLifecycle.js
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

const CANVAS_FADE_DURATION = 500;
const CONNECTING_MESSAGE = "Connecting";
const LOADING_CONFIG_MESSAGE = "Loading Workspace...";
const TRANSITION_MESSAGE = "Transitioning";

export function useRenderLifecycle(options) {
  const {
    managersReady, isInitiallyResolved, hasValidDimensions,
    isContainerObservedVisible, configLoadNonce, currentProfileAddress,
    layerConfigs,
    targetLayerConfigsForPreset,
    loadError, upInitializationError, upFetchStateError,
    stopAllAnimations,
    restartCanvasAnimations,
    isFullyLoaded,
  } = options;

  const [renderState, setRenderStateInternal] = useState('initializing');
  const [loadingStatusMessage, setLoadingStatusMessageState] = useState(CONNECTING_MESSAGE);
  const [isStatusFadingOut, setIsStatusFadingOut] = useState(false);
  const [isTransitioningInternal, setIsTransitioningInternal] = useState(false);
  const [makeIncomingCanvasVisible, setMakeIncomingCanvasVisible] = useState(false);

  const isMountedRef = useRef(false);
  const lastAppliedNonceRef = useRef(0);
  const statusDisplayFadeTimeoutRef = useRef(null);
  const transitionEndTimeoutRef = useRef(null);
  const animationStateRef = useRef('stopped');
  const outgoingLayerIdsOnTransitionStartRef = useRef(new Set());
  const prevAddressRef = useRef(currentProfileAddress);

  const logStateChange = useCallback((newState, reason) => {
    setRenderStateInternal(prevState => {
      if (prevState !== newState) {
        if (import.meta.env.DEV) {
          console.log(`%c[RenderLifecycle] State CHANGE: ${prevState} -> ${newState} (Reason: ${reason})`, 'color: #3498db; font-weight: bold;');
        }
        return newState;
      }
      return prevState;
    });
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (statusDisplayFadeTimeoutRef.current) clearTimeout(statusDisplayFadeTimeoutRef.current);
      if (transitionEndTimeoutRef.current) clearTimeout(transitionEndTimeoutRef.current);
    };
  }, []);

  const setLoadingStatusMessage = useCallback((message) => {
    if (isMountedRef.current) {
      setLoadingStatusMessageState(message);
      setIsStatusFadingOut(false);
      if (statusDisplayFadeTimeoutRef.current) {
        clearTimeout(statusDisplayFadeTimeoutRef.current);
      }
    }
  }, []);

  const resetLifecycle = useCallback(() => {
    if (!isMountedRef.current) return;
    setLoadingStatusMessage(CONNECTING_MESSAGE);
    logStateChange("initializing", "External Reset");
    lastAppliedNonceRef.current = 0;
    setIsTransitioningInternal(false);
    setMakeIncomingCanvasVisible(false);
    outgoingLayerIdsOnTransitionStartRef.current.clear();
    if (stopAllAnimations) stopAllAnimations();
    animationStateRef.current = 'stopped';
  }, [stopAllAnimations, setLoadingStatusMessage, logStateChange]);

  const handleManualRetry = useCallback(() => {
    if (import.meta.env.DEV) console.log("[RenderLifecycle] Manual retry triggered.");
    resetLifecycle();
  }, [resetLifecycle]);

  useEffect(() => {
    const previousAddress = prevAddressRef.current;
    if (previousAddress && currentProfileAddress && previousAddress !== currentProfileAddress) {
      resetLifecycle();
    }
    prevAddressRef.current = currentProfileAddress;
  }, [currentProfileAddress, resetLifecycle]);
  
  // --- THIS IS THE FIX ---
  // This useEffect now correctly determines the current loading state without getting stuck.
  useEffect(() => {
    const currentState = renderState;

    // Highest priority: check for critical errors.
    if (loadError || upInitializationError || upFetchStateError) {
      if (currentState !== 'error') logStateChange('error', 'Critical error detected');
      return;
    }

    // If we are already rendered or in a transition, don't revert to a loading state.
    if (['rendered', 'fading_out'].includes(currentState)) {
      return;
    }

    // The key change is here: we now proceed to 'rendered' as soon as the data is loaded and the layout is valid.
    // We no longer wait for `managersReady` in this specific check, as it can "flicker" during a re-render.
    const allPrimaryPrerequisitesMet = isInitiallyResolved && hasValidDimensions && isFullyLoaded;

    if (allPrimaryPrerequisitesMet) {
      logStateChange('rendered', 'All primary prerequisites (data, layout) met');
    } else {
      // Set the loading message based on the first unmet condition.
      if (!isInitiallyResolved || !isFullyLoaded) {
        logStateChange('resolving_initial_config', 'Awaiting data resolution');
      } else if (!managersReady) {
        // This state is now okay, because the primary condition check above will eventually pass.
        logStateChange('initializing_managers', 'Awaiting Managers');
      } else if (!hasValidDimensions) {
        logStateChange('waiting_layout', 'Awaiting valid dimensions');
      }
    }
  }, [
    renderState, managersReady, isInitiallyResolved, hasValidDimensions, isFullyLoaded, 
    loadError, upInitializationError, upFetchStateError, logStateChange
  ]);
  // --- END FIX ---

  useEffect(() => {
    if (isInitiallyResolved && configLoadNonce > lastAppliedNonceRef.current && renderState === 'rendered') {
      if (targetLayerConfigsForPreset) {
        setLoadingStatusMessage(TRANSITION_MESSAGE);
        setIsTransitioningInternal(true);
        setMakeIncomingCanvasVisible(false);
        outgoingLayerIdsOnTransitionStartRef.current = new Set(Object.keys(layerConfigs || {}));
        logStateChange('fading_out', 'New Scene Selected');
      }
    }
  }, [configLoadNonce, isInitiallyResolved, renderState, layerConfigs, setLoadingStatusMessage, logStateChange, targetLayerConfigsForPreset]);
  
  useEffect(() => {
    if (renderState === 'fading_out') {
      const transitionTimer = setTimeout(() => {
        if (isMountedRef.current) {
          logStateChange('rendered', 'Transition fade-out complete');
          lastAppliedNonceRef.current = configLoadNonce;
        }
      }, CANVAS_FADE_DURATION);
      return () => clearTimeout(transitionTimer);
    }
  }, [renderState, configLoadNonce, logStateChange]);

  useEffect(() => {
    if (renderState !== "rendered") return;
    setMakeIncomingCanvasVisible(true);
    setIsStatusFadingOut(true);
    if (statusDisplayFadeTimeoutRef.current) {
      clearTimeout(statusDisplayFadeTimeoutRef.current);
    }
    if (isTransitioningInternal) {
      if (transitionEndTimeoutRef.current) clearTimeout(transitionEndTimeoutRef.current);
      transitionEndTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setIsTransitioningInternal(false);
          outgoingLayerIdsOnTransitionStartRef.current.clear();
        }
      }, CANVAS_FADE_DURATION);
    }
    if (animationStateRef.current !== 'running' && isContainerObservedVisible) {
      if (restartCanvasAnimations) restartCanvasAnimations();
      animationStateRef.current = 'running';
    }
    return () => {
      if (transitionEndTimeoutRef.current) clearTimeout(transitionEndTimeoutRef.current);
    };
  }, [renderState, isTransitioningInternal, isContainerObservedVisible, restartCanvasAnimations]);

  useEffect(() => {
    if (renderState === 'waiting_layout') setLoadingStatusMessage("Waiting for layout...");
    else if (renderState === 'initializing_managers') setLoadingStatusMessage("Initializing managers...");
    else if (renderState === 'resolving_initial_config') setLoadingStatusMessage(LOADING_CONFIG_MESSAGE);
    else if (renderState === 'error') setLoadingStatusMessage("Render failed. Please retry.");
  }, [renderState, setLoadingStatusMessage]);

  const showStatusDisplay = useMemo(() => {
    if (isTransitioningInternal || renderState === 'error') {
      return true;
    }
    return false;
  }, [renderState, isTransitioningInternal]);

  const showRetryButton = useMemo(() => renderState === 'error' && !upInitializationError && !upFetchStateError && !(loadError && !isInitiallyResolved), [renderState, upInitializationError, upFetchStateError, loadError, isInitiallyResolved]);

  return useMemo(() => ({
    renderState,
    loadingStatusMessage,
    isStatusFadingOut,
    showStatusDisplay,
    showRetryButton,
    isTransitioning: isTransitioningInternal,
    outgoingLayerIdsOnTransitionStart: outgoingLayerIdsOnTransitionStartRef.current,
    makeIncomingCanvasVisible,
    isAnimating: animationStateRef.current === 'running',
    handleManualRetry,
    resetLifecycle,
  }), [
    renderState, loadingStatusMessage, isStatusFadingOut, showStatusDisplay, showRetryButton,
    isTransitioningInternal, makeIncomingCanvasVisible, handleManualRetry, resetLifecycle
  ]);
}
```

---
### `src\hooks\useUIState.js`
```js
// src/hooks/useUIState.js
import { useState, useCallback, useMemo } from 'react';

import { usePanelState } from './usePanelState'; // Local hook

/**
 * @typedef {object} UIState
 * @property {boolean} isUiVisible - Whether the main UI elements (toolbars, panels) are visible.
 * @property {boolean} infoOverlayOpen - Whether the informational overlay is currently open.
 * @property {boolean} whitelistPanelOpen - Whether the whitelist management panel is currently open.
 * @property {string|null} activePanel - The identifier of the currently open side panel (e.g., 'controls', 'notifications'), or null if none are open. Managed by the integrated `usePanelState`.
 * @property {string|null} animatingPanel - The identifier of the panel currently undergoing an open/close animation (e.g., 'controls', 'closing'), or null. Managed by the integrated `usePanelState`.
 * @property {string} activeLayerTab - The identifier of the active layer control tab (e.g., 'tab1').
 * @property {() => void} toggleUiVisibility - Function to toggle the visibility of the main UI elements.
 * @property {() => void} toggleInfoOverlay - Function to toggle the visibility of the informational overlay.
 * @property {() => void} toggleWhitelistPanel - Function to toggle the visibility of the whitelist panel.
 * @property {(panelName: string) => void} openPanel - Function to open a specific side panel by its identifier. This is sourced from `usePanelState`.
 * @property {() => void} closePanel - Function to close the currently active side panel. This is sourced from `usePanelState`.
 * @property {(panelName: string) => void} toggleSidePanel - Function to toggle a specific side panel's visibility. This is sourced from `usePanelState`.
 * @property {React.Dispatch<React.SetStateAction<string>>} setActiveLayerTab - Function to directly set the active layer control tab identifier.
 * @property {() => number} getActiveLayerId - Function to get the numerical layer ID corresponding to the `activeLayerTab`.
 */

export function useUIState(initialLayerTab = 'tab1') {
  const [isUiVisible, setIsUiVisible] = useState(true);
  const [infoOverlayOpen, setInfoOverlayOpen] = useState(false);
  const [whitelistPanelOpen, setWhitelistPanelOpen] = useState(false);
  
  const {
    activePanel,
    animatingPanel,
    openPanel,
    closePanel,
    togglePanel: toggleSidePanel,
    activeLayerTab,
    setActiveLayerTab,
    getActiveLayerId
  } = usePanelState(null, initialLayerTab);

  const toggleUiVisibility = useCallback(() => {
    setIsUiVisible((prev) => !prev);
  }, []);

  const toggleInfoOverlay = useCallback(() => {
    setInfoOverlayOpen((prev) => !prev);
  }, []);
  
  const toggleWhitelistPanel = useCallback(() => {
    toggleSidePanel('whitelist');
  }, [toggleSidePanel]);

  return useMemo(() => ({
    isUiVisible,
    infoOverlayOpen,
    whitelistPanelOpen,
    activePanel,
    animatingPanel,
    activeLayerTab,
    toggleUiVisibility,
    toggleInfoOverlay,
    toggleWhitelistPanel,
    openPanel,
    closePanel,
    toggleSidePanel,
    setActiveLayerTab,
    getActiveLayerId,
  }), [
    isUiVisible, infoOverlayOpen, whitelistPanelOpen,
    activePanel, animatingPanel, activeLayerTab,
    toggleUiVisibility, toggleInfoOverlay, toggleWhitelistPanel,
    openPanel, closePanel, toggleSidePanel, setActiveLayerTab,
    getActiveLayerId,
  ]);
}
```

---
### `src\hooks\useVisualEffects.js`
```js
// src/hooks/useVisualEffects.js
import { useRef, useCallback, useEffect, useState, useMemo } from "react";

import VisualEffectsProcessor from "../utils/VisualEffectsProcessor"; // Local utility

/**
 * @typedef {object} EffectConfig Base structure for defining a visual effect.
 * @property {string} type - The type identifier of the effect (e.g., 'color_overlay').
 * @property {string | number} layer - The target layer ID ('global', 1, 2, or 3).
 * @property {object} [config] - Effect-specific configuration options (e.g., color, duration).
 * @property {string} [effectId] - Optional unique ID; one will be generated by the processor if not provided.
 * @property {boolean} [isPersistent=false] - Flag indicating if the effect should persist (currently a placeholder, as persistence logic is primarily managed by the consumer of this hook or a higher-level state).
 * @property {boolean} [preserveAnimation=false] - Hint for whether background animations should be preserved when this effect is active.
 */

/**
 * @typedef {object} EffectControlObject Object returned by the VisualEffectsProcessor after applying an effect.
 * @property {string} effectId - The unique ID of the applied effect instance.
 * @property {string | number} layer - The target layer of the effect.
 * @property {() => void} clear - Function to manually stop and clean up this specific effect instance.
 */

/**
 * @typedef {object} VisualEffectsAPI Interface provided by the useVisualEffects hook.
 * @property {(effectConfig: EffectConfig) => Promise<string | null>} processEffect - Processes and applies a given effect configuration using the internal `VisualEffectsProcessor`. Returns the effect ID on success, null on failure.
 * @property {(eventType: string) => Promise<string | null>} createDefaultEffect - Creates and applies a default visual effect based on an event type string, using the internal `VisualEffectsProcessor`. Returns the effect ID on success, null on failure.
 * @property {(effectId: string) => void} clearPersistentEffect - Clears a specific effect by its ID using the internal `VisualEffectsProcessor`. Also removes it from the local `persistentEffects` state if present.
 * @property {() => void} clearAllTimedEffects - Clears all currently active effects managed by the internal `VisualEffectsProcessor`.
 * @property {Object.<string, EffectConfig>} persistentEffects - State holding configurations of effects that were marked as persistent when processed. This state is primarily for informational purposes or for consumers to manage re-application if needed, as the hook itself doesn't automatically re-apply them.
 */

/**
 * Initializes and manages a `VisualEffectsProcessor` instance to handle the
 * creation, application, and cleanup of visual effects (like color overlays)
 * triggered by events or actions within the application. It provides functions
 * to process specific effect configurations or generate default effects based on event types.
 *
 * @param {(layerId: string | number, key: string, value: any) => void} [updateLayerConfig] - Optional: A function passed down from a configuration context, potentially used by some effects to modify layer properties directly. Current effects may not heavily rely on this.
 * @returns {VisualEffectsAPI} An object containing functions to manage visual effects.
 */
export function useVisualEffects(updateLayerConfig) {
  /** @type {React.RefObject<VisualEffectsProcessor | null>} */
  const processorRef = useRef(null);
  // State to potentially track persistent effects in the future
  /** @type {[Object.<string, EffectConfig>, React.Dispatch<React.SetStateAction<Object.<string, EffectConfig>>>]} */
  const [persistentEffects, setPersistentEffects] = useState({});
  /** @type {React.RefObject<(layerId: string | number, key: string, value: any) => void | undefined>} */
  const updateLayerConfigRef = useRef(updateLayerConfig);

  // Keep the updateLayerConfig function reference up-to-date
  useEffect(() => {
    updateLayerConfigRef.current = updateLayerConfig;
  }, [updateLayerConfig]);

  // Initialize and clean up the VisualEffectsProcessor instance
  useEffect(() => {
    processorRef.current = new VisualEffectsProcessor();
    if (import.meta.env.DEV) {
      // console.log("[useVisualEffects] VisualEffectsProcessor Initialized.");
    }

    const processorInstance = processorRef.current; // Capture instance for cleanup closure

    return () => {
      if (import.meta.env.DEV) {
        // console.log("[useVisualEffects] Cleaning up VisualEffectsProcessor...");
      }
      // Ensure we use the instance captured at the time of effect setup for cleanup,
      // as processorRef.current might be nulled by another effect run if deps change rapidly.
      const processorToClean = processorInstance;
      if (processorToClean && typeof processorToClean.cancelAllEffects === "function") {
        if (import.meta.env.DEV) {
          // console.log("[useVisualEffects] Calling cancelAllEffects on processor.");
        }
        processorToClean.cancelAllEffects();
      } else if (import.meta.env.DEV) {
        // Keep warning for potential cleanup issues
        console.warn("[useVisualEffects] VisualEffectsProcessor instance or cancelAllEffects method not available during cleanup.");
      }
      processorRef.current = null; // Explicitly nullify on unmount
    };
  }, []);

  /** Processes and applies a specific visual effect configuration. */
  const processEffect = useCallback(async (effectConfig) => {
    const currentProcessor = processorRef.current;
    const currentUpdateFn = updateLayerConfigRef.current;

    if (!currentProcessor) {
      if (import.meta.env.DEV) {
        console.warn("[useVisualEffects processEffect] Processor not ready.");
      }
      return null;
    }

    if (!effectConfig || (!effectConfig.type && !effectConfig.effect) || !effectConfig.layer) {
      if (import.meta.env.DEV) {
        console.warn("[useVisualEffects processEffect] Invalid effect object:", effectConfig);
      }
      return null;
    }

    const type = effectConfig.type || effectConfig.effect; // 'effect' for backward compatibility
    const layerId = String(effectConfig.layer);
    const isPersistent = effectConfig.isPersistent === true;
    // Processor now generates ID internally if not provided
    const fullConfig = { ...effectConfig, type: type, layer: layerId, isPersistent };


    if (import.meta.env.DEV) {
      // console.log(`[useVisualEffects processEffect] Processing effect:`, fullConfig);
    }
    try {
      const controlObject = await currentProcessor.processEffect(fullConfig, currentUpdateFn);
      if (controlObject?.effectId && isPersistent) {
        if (import.meta.env.DEV) {
          // console.log(`[useVisualEffects processEffect] Registered persistent effect placeholder: ${controlObject.effectId}`);
        }
        // Update local state for persistent effects
        setPersistentEffects((prev) => ({ ...prev, [controlObject.effectId]: fullConfig }));
      }
      return controlObject?.effectId || null;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`[useVisualEffects processEffect] Error processing effect ${fullConfig.effectId || '(new)'}:`, error);
      }
      return null;
    }
  }, []); // updateLayerConfigRef is a ref, processorRef is a ref. Their .current changing doesn't re-memoize.

  /** Creates and applies a default visual effect based on an event type string. */
  const createDefaultEffect = useCallback(async (eventType) => {
    const currentProcessor = processorRef.current;
    const currentUpdateFn = updateLayerConfigRef.current;

    if (!currentProcessor) {
      if (import.meta.env.DEV) {
        console.warn("[useVisualEffects createDefaultEffect] Processor not ready.");
      }
      return null;
    }


    if (import.meta.env.DEV) {
      // console.log(`[useVisualEffects createDefaultEffect] Creating default effect for event: ${eventType}`);
    }
    try {
      // Assuming createDefaultEffect might also return a control object with an effectId
      const controlObject = await currentProcessor.createDefaultEffect(eventType, currentUpdateFn);
      // If default effects can be persistent, handle similar to processEffect
      // For now, assuming they are not typically marked persistent this way.
      return controlObject?.effectId || null;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`[useVisualEffects createDefaultEffect] Error creating default effect for ${eventType}:`, error);
        if (error instanceof TypeError && error.message.includes("is not a function")) {
          console.error(`[useVisualEffects createDefaultEffect] DETECTED 'is not a function' error. Processor state:`, currentProcessor);
        }
      }
      return null;
    }
  }, []); // updateLayerConfigRef is a ref, processorRef is a ref.

  /** Manually stops and cleans up a specific effect instance by its ID. */
  const clearPersistentEffect = useCallback((effectId) => {
    const currentProcessor = processorRef.current;
    if (!currentProcessor) {
      if (import.meta.env.DEV) {
        console.warn("[useVisualEffects clearPersistentEffect] Processor not ready.");
      }
      return;
    }
    if (!effectId) return;

    if (import.meta.env.DEV) {
      // console.log(`[useVisualEffects clearPersistentEffect] Clearing effect: ${effectId}`);
    }
    try {
      currentProcessor.cancelEffect(effectId);
      setPersistentEffects((prev) => {
        if (!prev[effectId]) return prev; // No change if effectId not in state
        const newState = { ...prev };
        delete newState[effectId];
        if (import.meta.env.DEV) {
          // console.log(`[useVisualEffects clearPersistentEffect] Persistent effect ${effectId} removed from state.`);
        }
        return newState;
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`[useVisualEffects clearPersistentEffect] Error cancelling effect ${effectId}:`, error);
      }
    }
  }, []); // processorRef is a ref.

  /** Stops and cleans up ALL currently active effects managed by the processor. */
  const clearAllTimedEffects = useCallback(() => {
    const currentProcessor = processorRef.current;
    if (!currentProcessor) {
      if (import.meta.env.DEV) {
        console.warn("[useVisualEffects clearAllTimedEffects] Processor not ready.");
      }
      return;
    }

    if (import.meta.env.DEV) {
      // console.log("[useVisualEffects clearAllTimedEffects] Clearing ALL processor-managed effects.");
    }
    try {
      currentProcessor.cancelAllEffects();
      // Optionally clear the local persistentEffects state if all effects are being cleared
      // setPersistentEffects({});
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`[useVisualEffects clearAllTimedEffects] Error cancelling all effects:`, error);
      }
    }
  }, []); // processorRef is a ref.

  return useMemo(() => ({
    processEffect,
    createDefaultEffect,
    clearPersistentEffect,
    clearAllTimedEffects,
    persistentEffects,
  }), [
    processEffect, createDefaultEffect, clearPersistentEffect, clearAllTimedEffects,
    persistentEffects
  ]);
}
```

---
### `src\index.css`
```css
@import "./styles/variables.css";
@import "./styles/base.css";
@import "./styles/layout.css"; 
@import "./styles/components.css"; 
@import "./components/Toolbars/ToolbarStyles/TopRightControls.css";
@import "./components/MIDI/MIDIStyles/GlobalMIDIStatus.css";


#root {
  width: 100%;
  height: 100%;
}
```

---
### `src\main.jsx`
```jsx
// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { UpProvider } from "./context/UpProvider.jsx";
import { UserSessionProvider } from "./context/UserSessionContext.jsx";
import { WorkspaceProvider } from "./context/WorkspaceContext.jsx";
import { AssetProvider } from "./context/AssetContext.jsx";
import { VisualEngineProvider } from "./context/VisualEngineContext.jsx";
import { MIDIProvider } from "./context/MIDIContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import { NotificationProvider } from "./context/NotificationContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./index.css";
import { initializeHostUPConnector } from "./context/UpServerProvider.js";

const isRunningInIframe = () => {
  try {
    return window.self !== window.top;
  } catch (_e) {
    return true;
  }
};

const inIframe = isRunningInIframe();

if (!inIframe) {
  console.log("[main.jsx] Running as host/top window, initializing Host UP Connector.");
  initializeHostUPConnector();
} else {
  console.log("[main.jsx] Running inside an iframe, skipping Host UP Connector initialization.");
}

const AppTree = (
  <ErrorBoundary>
    <UpProvider>
      <UserSessionProvider>
        <WorkspaceProvider>
          <AssetProvider>
            <MIDIProvider>
              <VisualEngineProvider>
                <ToastProvider>
                  <NotificationProvider>
                    <App />
                  </NotificationProvider>
                </ToastProvider>
              </VisualEngineProvider>
            </MIDIProvider>
          </AssetProvider>
        </WorkspaceProvider>
      </UserSessionProvider>
    </UpProvider>
  </ErrorBoundary>
);


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {AppTree}
  </React.StrictMode>
);

console.log("[main.jsx] React application rendered successfully.");
```

---
### `src\services\ConfigurationService.js`
```js
// src/services/ConfigurationService.js
import {
  hexToString, stringToHex,
  getAddress,
} from "viem";

import {
  RADAR_ROOT_STORAGE_POINTER_KEY,
  IPFS_GATEWAY,
  RADAR_OFFICIAL_ADMIN_ADDRESS,
} from "../config/global-config";
import { resolveLsp4Metadata } from '../utils/erc725.js';
import { uploadJsonToPinata } from './PinataService.js';
import { ERC725YDataKeys } from '@lukso/lsp-smart-contracts';
import { Buffer } from 'buffer';

if (typeof window !== 'undefined' && typeof window.Buffer === 'undefined') {
  window.Buffer = Buffer;
}

const ERC725Y_ABI = [
  { inputs: [{ type: "bytes32", name: "dataKey" }], name: "getData", outputs: [{ type: "bytes", name: "dataValue" }], stateMutability: "view", type: "function" },
  { inputs: [{ type: "bytes32[]", name: "dataKeys" }], name: "getDataBatch", outputs: [{ type: "bytes[]", name: "dataValues" }], stateMutability: "view", type: "function" },
  { inputs: [{ type: "bytes32", name: "dataKey" }, { type: "bytes", name: "dataValue" }], name: "setData", outputs: [], stateMutability: "payable", type: "function" },
  { inputs: [{ type: "bytes32[]", name: "dataKeys" }, { type: "bytes[]", name: "dataValues" }], name: "setDataBatch", outputs: [], stateMutability: "payable", type: "function" },
  { name: "supportsInterface", inputs: [{ type: "bytes4", name: "interfaceId" }], outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
];

const LSP7_ABI = [
  {
    "inputs": [{ "name": "owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

const LSP8_ABI = [
  {
    "inputs": [{ "name": "tokenOwner", "type": "address" }],
    "name": "tokenIdsOf",
    "outputs": [{ "name": "", "type": "bytes32[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
        { "name": "tokenId", "type": "bytes32" },
        { "name": "dataKey", "type": "bytes32" }
    ],
    "name": "getDataForTokenId",
    "outputs": [{ "name": "dataValue", "type": "bytes" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "dataKey", "type": "bytes32" }],
    "name": "getData",
    "outputs": [{ "name": "dataValue", "type": "bytes" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

const LSP8_INTERFACE_ID = "0x3a271706";
const LSP7_INTERFACE_ID = "0xc52d6008";

export function hexToUtf8Safe(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("0x") || hex === "0x") return null;
  try {
    const decodedString = hexToString(hex);
    return decodedString.replace(/\u0000/g, '');
  } catch {
    return null;
  }
}

function decodeVerifiableUriBytes(bytesValue) {
    if (!bytesValue || typeof bytesValue !== 'string' || !bytesValue.startsWith('0x') || bytesValue.length < 14) {
        return null; 
    }

    const valueWithoutPrefix = bytesValue.substring(2);

    if (valueWithoutPrefix.startsWith('0000')) {
        try {
            const hashLengthHex = `0x${valueWithoutPrefix.substring(12, 16)}`;
            const hashLength = parseInt(hashLengthHex, 16);
            const urlBytesStart = 16 + (hashLength * 2);

            if (valueWithoutPrefix.length < urlBytesStart) {
                return null;
            }

            const urlBytes = `0x${valueWithoutPrefix.substring(urlBytesStart)}`;
            return hexToUtf8Safe(urlBytes);
        } catch (e) {
            console.error("Error parsing VerifiableURI bytes:", e);
            return null;
        }
    } else {
        return hexToUtf8Safe(bytesValue);
    }
}


export function hexBytesToIntegerSafe(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("0x") || hex === "0x") return 0;
  try {
    const bigIntValue = BigInt(hex);
    if (bigIntValue > BigInt(Number.MAX_SAFE_INTEGER)) {
      if (import.meta.env.DEV) {
        console.warn(`[hexBytesToIntegerSafe] Value ${hex} exceeds MAX_SAFE_INTEGER. Capping.`);
      }
      return Number.MAX_SAFE_INTEGER;
    }
    return Number(bigIntValue);
  } catch { return 0; }
}

function getChecksumAddressSafe(address) {
  if (typeof address !== 'string') return null;
  try { return getAddress(address.trim()); }
  catch { return null; }
}

class ConfigurationService {
  walletClient = null;
  publicClient = null;
  readReady = false;
  writeReady = false;

  constructor(_provider, walletClient, publicClient) {
    this.walletClient = walletClient;
    this.publicClient = publicClient;
    this.readReady = !!publicClient;
    this.writeReady = !!publicClient && !!walletClient?.account;
  }

  async initialize() {
    this.readReady = !!this.publicClient;
    this.writeReady = this.readReady && !!this.walletClient?.account;
    return this.readReady;
  }

  getUserAddress() {
    return this.walletClient?.account?.address ?? null;
  }

  checkReadyForRead() {
    this.readReady = !!this.publicClient;
    return this.readReady;
  }

  checkReadyForWrite() {
    this.readReady = !!this.publicClient;
    this.writeReady = this.readReady && !!this.walletClient?.account;
    return this.writeReady;
  }

  async _loadWorkspaceFromCID(cid) {
    const logPrefix = `[CS _loadWorkspaceFromCID CID:${cid.slice(0, 10)}]`;
    if (!cid) return null;
    const gatewayUrl = `${IPFS_GATEWAY}${cid}`;
    if (import.meta.env.DEV) console.log(`${logPrefix} Fetching workspace from ${gatewayUrl}`);
    const response = await fetch(gatewayUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch from IPFS gateway: ${response.status} ${response.statusText}`);
    }
    const workspaceData = await response.json();
    if (typeof workspaceData !== 'object' || workspaceData === null || !('presets' in workspaceData)) {
        throw new Error('Fetched data is not a valid workspace object.');
    }
    return workspaceData;
  }

  async loadWorkspace(profileAddress) {
    const defaultSetlist = { defaultWorkspaceName: null, workspaces: {}, globalUserMidiMap: {} };
    if (!this.checkReadyForRead()) return defaultSetlist;
    const checksummedProfileAddr = getChecksumAddressSafe(profileAddress);
    if (!checksummedProfileAddr) return defaultSetlist;

    const logPrefix = `[CS loadWorkspace(Setlist) Addr:${checksummedProfileAddr.slice(0, 6)}]`;
    try {
        const pointerHex = await this.loadDataFromKey(checksummedProfileAddr, RADAR_ROOT_STORAGE_POINTER_KEY);
        if (!pointerHex || pointerHex === '0x') return defaultSetlist;
        
        const ipfsUri = hexToUtf8Safe(pointerHex);
        if (!ipfsUri || !ipfsUri.startsWith('ipfs://')) return defaultSetlist;

        const cid = ipfsUri.substring(7);
        const gatewayUrl = `${IPFS_GATEWAY}${cid}`;
        if (import.meta.env.DEV) console.log(`${logPrefix} Fetching setlist from ${gatewayUrl}`);
        
        const response = await fetch(gatewayUrl);
        if (!response.ok) throw new Error(`Failed to fetch from IPFS gateway: ${response.status} ${response.statusText}`);

        const setlist = await response.json();
        if (typeof setlist !== 'object' || setlist === null || !('workspaces' in setlist)) {
            throw new Error('Fetched data is not a valid setlist object.');
        }

        // --- MIGRATION LOGIC ---
        if (typeof setlist === 'object' && setlist !== null && !setlist.globalUserMidiMap) {
          if (import.meta.env.DEV) console.log(`${logPrefix} Old setlist format detected. Attempting to migrate MIDI map.`);
          const defaultWorkspaceName = setlist.defaultWorkspaceName || Object.keys(setlist.workspaces)[0];
          if (defaultWorkspaceName && setlist.workspaces[defaultWorkspaceName]?.cid) {
              const defaultWorkspace = await this._loadWorkspaceFromCID(setlist.workspaces[defaultWorkspaceName].cid);
              if (defaultWorkspace?.globalMidiMap) {
                  if (import.meta.env.DEV) console.log(`${logPrefix} Found MIDI map in default workspace. Promoting to setlist level.`);
                  setlist.globalUserMidiMap = defaultWorkspace.globalMidiMap;
              }
          }
        }
        // --- END MIGRATION LOGIC ---

        if (import.meta.env.DEV) console.log(`${logPrefix} Successfully loaded and parsed setlist.`);
        return setlist;

    } catch (error) {
        if (import.meta.env.DEV) console.error(`${logPrefix} Failed to load setlist:`, error);
        return defaultSetlist;
    }
  }

  async saveSetlist(targetProfileAddress, setlistObject) {
    const logPrefix = `[CS saveSetlist Addr:${targetProfileAddress?.slice(0, 6)}]`;
    if (!this.checkReadyForWrite()) {
      throw new Error("Client not ready for writing.");
    }
    const checksummedTargetAddr = getChecksumAddressSafe(targetProfileAddress);
    if (!checksummedTargetAddr) {
      throw new Error("Invalid target profile address format.");
    }
    if (!setlistObject || typeof setlistObject !== 'object' || !('workspaces' in setlistObject)) {
      throw new Error("Invalid or malformed setlistObject provided.");
    }
    const userAddress = this.walletClient.account.address;
    if (userAddress?.toLowerCase() !== checksummedTargetAddr?.toLowerCase()) {
      throw new Error("Permission denied: Signer does not own the target profile.");
    }

    let oldCidToUnpin = null;
    try {
      const oldPointerHex = await this.loadDataFromKey(checksummedTargetAddr, RADAR_ROOT_STORAGE_POINTER_KEY);
      if (oldPointerHex && oldPointerHex !== '0x') {
        const oldIpfsUri = hexToUtf8Safe(oldPointerHex);
        if (oldIpfsUri && oldIpfsUri.startsWith('ipfs://')) {
          oldCidToUnpin = oldIpfsUri.substring(7);
          if (import.meta.env.DEV) console.log(`${logPrefix} Found old Setlist CID to unpin later: ${oldCidToUnpin}`);
        }
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn(`${logPrefix} Could not retrieve old Setlist CID, will proceed without unpinning. Error:`, e);
    }

    try {
      if (import.meta.env.DEV) console.log(`${logPrefix} Uploading new setlist JSON to IPFS...`);
      const newIpfsCid = await uploadJsonToPinata(setlistObject, 'RADAR_Setlist');
      if (!newIpfsCid) {
        throw new Error("IPFS upload failed: received no CID from PinataService.");
      }
      if (import.meta.env.DEV) console.log(`${logPrefix} IPFS upload successful. New Setlist CID: ${newIpfsCid}`);

      const newIpfsUri = `ipfs://${newIpfsCid}`;
      const valueHex = stringToHex(newIpfsUri);
      if (import.meta.env.DEV) console.log(`${logPrefix} Setting RADAR.RootStoragePointer on-chain to new value...`);
      const result = await this.saveDataToKey(checksummedTargetAddr, RADAR_ROOT_STORAGE_POINTER_KEY, valueHex);
      if (import.meta.env.DEV) console.log(`${logPrefix} On-chain update successful. TxHash: ${result.hash}`);
      
      if (oldCidToUnpin && oldCidToUnpin !== newIpfsCid) {
        if (import.meta.env.DEV) console.log(`${logPrefix} Triggering unpinning of old Setlist CID: ${oldCidToUnpin}`);
        
        fetch('/api/unpin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cid: oldCidToUnpin }),
        }).catch(unpinError => {
            if (import.meta.env.DEV) console.error(`${logPrefix} Call to the /api/unpin endpoint failed:`, unpinError);
        });
      }

      return result;

    } catch (error) {
      if (import.meta.env.DEV) { console.error(`${logPrefix} Error during saveSetlist:`, error); }
      throw new Error(error.message || "An unexpected error occurred during the save process.");
    }
  }
  
  async saveDataToKey(targetAddress, key, valueHex) {
    if (!this.checkReadyForWrite()) throw new Error("Client not ready for writing.");
    const checksummedTargetAddr = getChecksumAddressSafe(targetAddress);
    if (!checksummedTargetAddr) throw new Error("Invalid target address format.");
    const userAddress = this.walletClient.account.address;
    if (userAddress?.toLowerCase() !== checksummedTargetAddr?.toLowerCase()) { throw new Error("Permission denied: Signer does not own the target profile."); }
    if (!key || typeof key !== "string" || !key.startsWith("0x") || key.length !== 66) { throw new Error("Data key must be a valid bytes32 hex string."); }
    const finalValueHex = (valueHex === undefined || valueHex === null) ? "0x" : valueHex;
    if (typeof finalValueHex !== "string" || !finalValueHex.startsWith("0x")) { throw new Error("Value must be a valid hex string (0x...)."); }
    try {
        const hash = await this.walletClient.writeContract({ address: checksummedTargetAddr, abi: ERC725Y_ABI, functionName: "setData", args: [key, finalValueHex], account: this.walletClient.account });
        return { success: true, hash };
    } catch (writeError) {
        const baseError = writeError.cause || writeError;
        const message = baseError?.shortMessage || writeError.message || "Unknown setData error";
        throw new Error(`Set data transaction failed: ${message}`);
    }
  }

  async loadDataFromKey(address, key) {
    if (!this.checkReadyForRead()) { return null; }
    const checksummedAddress = getChecksumAddressSafe(address);
    if (!checksummedAddress) { return null; }
    const isKeyValid = typeof key === "string" && key.startsWith("0x") && key.length === 66;
    if (!isKeyValid) { return null; }
    try {
        const dataValueBytes = await this.publicClient.readContract({ address: checksummedAddress, abi: ERC725Y_ABI, functionName: "getData", args: [key] });
        return (dataValueBytes === undefined || dataValueBytes === null) ? null : dataValueBytes;
    } catch (e) {
        return null;
    }
  }

  async detectCollectionStandard(collectionAddress) {
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    if (!this.checkReadyForRead() || !checksummedCollectionAddr) {
      return null;
    }
    try {
      const supportsLSP8 = await this.publicClient.readContract({
        address: checksummedCollectionAddr, abi: ERC725Y_ABI, functionName: "supportsInterface", args: [LSP8_INTERFACE_ID]
      }).catch(() => false);
      if (supportsLSP8) return 'LSP8';

      const supportsLSP7 = await this.publicClient.readContract({
        address: checksummedCollectionAddr, abi: ERC725Y_ABI, functionName: "supportsInterface", args: [LSP7_INTERFACE_ID]
      }).catch(() => false);
      if (supportsLSP7) return 'LSP7';

      return null;
    } catch (error) {
      if (import.meta.env.DEV) console.warn(`[CS detectStandard] Error detecting standard for ${collectionAddress.slice(0,10)}...:`, error.shortMessage || error.message);
      return null;
    }
  }

  async getLSP7Balance(userAddress, collectionAddress) {
    const checksummedUserAddr = getChecksumAddressSafe(userAddress);
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    if (!this.checkReadyForRead() || !checksummedUserAddr || !checksummedCollectionAddr) {
      return 0n;
    }
    try {
      const balance = await this.publicClient.readContract({
        address: checksummedCollectionAddr, abi: LSP7_ABI, functionName: "balanceOf", args: [checksummedUserAddr]
      });
      return balance || 0n;
    } catch (error) {
      if (import.meta.env.DEV) console.warn(`[CS getLSP7Balance] Failed for collection ${collectionAddress.slice(0,10)}...:`, error.shortMessage || error.message);
      return 0n;
    }
  }

  async getLSP4CollectionMetadata(collectionAddress) {
    const logPrefix = `[CS getLSP4CollectionMetadata]`;
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    if (!this.checkReadyForRead() || !checksummedCollectionAddr) {
      return null;
    }
    try {
      const metadata = await resolveLsp4Metadata(this, checksummedCollectionAddr);
      if (!metadata?.LSP4Metadata) {
        if (import.meta.env.DEV) console.log(`${logPrefix} No LSP4Metadata found for collection ${collectionAddress.slice(0,10)}...`);
        return null;
      }
      const lsp4Data = metadata.LSP4Metadata;
      const name = lsp4Data.name || 'Unnamed Collection';
      const rawUrl = lsp4Data.icon?.[0]?.url || lsp4Data.images?.[0]?.[0]?.url || lsp4Data.assets?.[0]?.url;
      let imageUrl = null;
      if (rawUrl && typeof rawUrl === 'string') {
        const trimmedUrl = rawUrl.trim();
        if (trimmedUrl.startsWith('ipfs://')) {
          imageUrl = `${IPFS_GATEWAY}${trimmedUrl.slice(7)}`;
        } else if (trimmedUrl.startsWith('http') || trimmedUrl.startsWith('data:')) {
          imageUrl = trimmedUrl;
        }
      }
      return { name, image: imageUrl };
    } catch (error) {
      if (import.meta.env.DEV) console.warn(`${logPrefix} Error for collection ${collectionAddress.slice(0,10)}...:`, error.message);
      return null;
    }
  }
  
  async getOwnedLSP8TokenIdsForCollection(userAddress, collectionAddress) {
      const logPrefix = `[CS getOwnedLSP8]`;
      const checksummedUserAddr = getChecksumAddressSafe(userAddress);
      const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);

      if (!this.checkReadyForRead() || !checksummedUserAddr || !checksummedCollectionAddr) {
          if (import.meta.env.DEV) console.warn(`${logPrefix} Prereqs failed: ready=${this.readReady}, user=${!!checksummedUserAddr}, collection=${!!checksummedCollectionAddr}`);
          return [];
      }

      if (import.meta.env.DEV) console.log(`${logPrefix} Fetching owned tokens for: ${checksummedUserAddr}.`);
      try {
          const tokenIds = await this.publicClient.readContract({
              address: checksummedCollectionAddr,
              abi: LSP8_ABI,
              functionName: "tokenIdsOf",
              args: [checksummedUserAddr],
          });
          return tokenIds || [];
      } catch (error) {
          if (import.meta.env.DEV) console.warn(`${logPrefix} Failed to fetch token IDs for collection ${collectionAddress.slice(0, 10)}...:`, error.shortMessage || error.message);
          return [];
      }
  }

  async getAllLSP8TokenIdsForCollection(collectionAddress) {
      const logPrefix = `[CS getAllLSP8]`;
      const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);

      if (!this.checkReadyForRead() || !checksummedCollectionAddr) {
          if (import.meta.env.DEV) console.warn(`${logPrefix} Prereqs failed: ready=${this.readReady}, collection=${!!checksummedCollectionAddr}`);
          return [];
      }

      if (import.meta.env.DEV) console.log(`${logPrefix} Fetching ALL tokens for collection: ${checksummedCollectionAddr}.`);
      try {
          const total = await this.publicClient.readContract({
              address: checksummedCollectionAddr,
              abi: LSP8_ABI,
              functionName: "totalSupply",
          });
          const totalAsNumber = Number(total);
          
          const allTokenIndices = Array.from({ length: totalAsNumber }, (_, i) => i);
          
          if (import.meta.env.DEV) console.log(`${logPrefix} Found ${totalAsNumber} total tokens. Returning indices.`);
          return allTokenIndices;
      } catch (error) {
          if (import.meta.env.DEV) console.error(`${logPrefix} Failed to fetch all tokens. Does contract have 'totalSupply'?`, error);
          return [];
      }
  }

  async getTokenMetadata(collectionAddress, tokenId) {
    const logPrefix = `[CS getTokenMetadata]`;
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    
    if (!this.checkReadyForRead() || !checksummedCollectionAddr) {
        if (import.meta.env.DEV) console.warn(`${logPrefix} Client not ready or invalid collection address.`);
        return null;
    }

    try {
      const lsp4Key = ERC725YDataKeys.LSP4.LSP4Metadata;
      const metadataUriBytes = await this.publicClient.readContract({
          address: checksummedCollectionAddr, abi: LSP8_ABI, functionName: "getDataForTokenId", args: [tokenId, lsp4Key]
      }).catch(() => null);

      if (metadataUriBytes && metadataUriBytes !== '0x') {
        const decodedString = hexToUtf8Safe(metadataUriBytes);
        if (decodedString && decodedString.trim().startsWith('<svg')) {
          if (import.meta.env.DEV) console.log(`${logPrefix} Detected on-chain SVG for tokenId ${tokenId.slice(0,10)}...`);
          const base64Svg = Buffer.from(decodedString, 'utf8').toString('base64');
          const imageUrl = `data:image/svg+xml;base64,${base64Svg}`;
          const name = `Token #${Number(BigInt(tokenId))}`;
          return { name, image: imageUrl };
        }
      }

      let finalMetadataUrl = '';

      if (metadataUriBytes && metadataUriBytes !== '0x') {
        const decodedUri = decodeVerifiableUriBytes(metadataUriBytes);
        if (decodedUri) finalMetadataUrl = decodedUri;
      } else {
        const baseUriKey = ERC725YDataKeys.LSP8.LSP8TokenMetadataBaseURI;
        const baseUriBytes = await this.publicClient.readContract({
            address: checksummedCollectionAddr, abi: LSP8_ABI, functionName: "getData", args: [baseUriKey]
        }).catch(() => null);

        if (baseUriBytes && baseUriBytes !== '0x') {
          const decodedBaseUri = decodeVerifiableUriBytes(baseUriBytes);
          if (decodedBaseUri) {
            const tokenIdAsString = BigInt(tokenId).toString();
            finalMetadataUrl = decodedBaseUri.endsWith('/') ? `${decodedBaseUri}${tokenIdAsString}` : `${decodedBaseUri}/${tokenIdAsString}`;
          }
        }
      }

      if (!finalMetadataUrl) {
        if (import.meta.env.DEV) console.log(`${logPrefix} No metadata URI found for tokenId ${tokenId.slice(0,10)}...`);
        return null;
      }
      
      let fetchableUrl = finalMetadataUrl;
      if (fetchableUrl.startsWith('ipfs://')) {
          fetchableUrl = `${IPFS_GATEWAY}${fetchableUrl.substring(7)}`;
      } else if (!fetchableUrl.startsWith('http')) {
          fetchableUrl = `${IPFS_GATEWAY}${fetchableUrl}`;
      }
      
      if (!fetchableUrl.startsWith('http')) {
        if (import.meta.env.DEV) console.warn(`${logPrefix} Unsupported metadata URI scheme: ${fetchableUrl}`);
        return null;
      }

      const response = await fetch(fetchableUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${fetchableUrl}`);
      
      const contentType = response.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
          const metadata = await response.json();
          const lsp4Data = metadata.LSP4Metadata || metadata;
          const name = lsp4Data.name || 'Unnamed Token';
          const rawUrl = lsp4Data.images?.[0]?.[0]?.url || lsp4Data.icon?.[0]?.url || lsp4Data.assets?.[0]?.url;
          let imageUrl = null;
          
          if (rawUrl && typeof rawUrl === 'string') {
            const trimmedUrl = rawUrl.trim();
            if (trimmedUrl.startsWith('ipfs://')) {
                imageUrl = `${IPFS_GATEWAY}${trimmedUrl.slice(7)}`;
            } else if (trimmedUrl.startsWith('http') || trimmedUrl.startsWith('data:')) {
                imageUrl = trimmedUrl;
            }
          }
          return { name, image: imageUrl };
      } else if (contentType && contentType.startsWith("image/")) {
          const tokenIdNum = Number(BigInt(tokenId));
          const name = `Token #${tokenIdNum}`;
          const imageUrl = fetchableUrl;
          return { name, image: imageUrl };
      } else {
          throw new Error(`Unsupported content type: ${contentType}`);
      }

    } catch (error) {
        if (import.meta.env.DEV) console.error(`${logPrefix} Error getting metadata for tokenId ${tokenId.slice(0,10)} in collection ${collectionAddress.slice(0,6)}...:`, error.message);
        return null;
    }
  }

  async getTokensMetadataForPage(collectionAddress, identifiers, page, pageSize) {
    const logPrefix = `[CS getTokensMetadataForPage]`;
    if (!this.checkReadyForRead() || !identifiers || identifiers.length === 0) {
        return [];
    }

    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    const pageIdentifiers = identifiers.slice(startIndex, endIndex);

    if (pageIdentifiers.length === 0) return [];

    const metadataFetchPromises = pageIdentifiers.map(async (identifier) => {
        const tokenId = typeof identifier === 'number'
            ? '0x' + identifier.toString(16).padStart(64, '0')
            : identifier;
        
        const metadata = await this.getTokenMetadata(collectionAddress, tokenId);
        return metadata ? { originalIdentifier: identifier, tokenId, metadata } : null;
    });

    if (import.meta.env.DEV) console.log(`${logPrefix} Fetching metadata for ${pageIdentifiers.length} tokens on page ${page}.`);
    const settledMetadataResults = await Promise.allSettled(metadataFetchPromises);
  
    const finalTokenData = settledMetadataResults.map((result) => {
      if (result.status === 'rejected' || !result.value) return null;
      
      const { tokenId, metadata } = result.value;
      if (!metadata?.image) return null;

      return {
          id: `${collectionAddress}-${tokenId}`,
          type: 'owned',
          address: collectionAddress,
          tokenId: tokenId,
          metadata: { name: metadata.name || 'Unnamed', image: metadata.image },
      };
    }).filter(Boolean);
  
    return finalTokenData;
  }
}

export default ConfigurationService;
```

---
### `src\services\LSP1EventService.jsx`
```jsx
// src/services/LSP1EventService.jsx
import {
  createPublicClient,
  webSocket,
  isAddress,
  decodeEventLog,
  // slice, // Intentionally removed as unused
  getAddress,
  decodeAbiParameters,
  parseAbiParameters,
} from "viem";
import { lukso } from "viem/chains";

import { EVENT_TYPE_MAP, TYPE_ID_TO_EVENT_MAP } from "../config/global-config";

// LSP1 ABI definition for UniversalReceiver event
const LSP1_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "uint256", name: "value", type: "uint256" },
      { indexed: true, internalType: "bytes32", name: "typeId", type: "bytes32" },
      { internalType: "bytes", name: "receivedData", type: "bytes" },
      { internalType: "bytes", name: "returnedValue", type: "bytes" },
    ],
    name: "UniversalReceiver",
    type: "event",
  },
];

// ABI parameter definitions for decoding specific event data payloads
const LSP7_RECEIVED_DATA_ABI = parseAbiParameters('address caller, address from, address to, uint256 amount, bytes data');
const LSP8_RECEIVED_DATA_ABI = parseAbiParameters('address caller, address from, address to, bytes32 tokenId, bytes data');

const DEFAULT_LUKSO_WSS_RPC_URL = "wss://ws-rpc.mainnet.lukso.network";
const WSS_RPC_URL = import.meta.env.VITE_LUKSO_WSS_RPC_URL || DEFAULT_LUKSO_WSS_RPC_URL;
const MAX_RECENT_EVENTS = 10; // For duplicate detection

/**
 * @typedef {object} DecodedLsp1EventArgs
 * @property {string} from - Address of the sender of the transaction.
 * @property {bigint} value - Value sent with the transaction (in Wei).
 * @property {string} typeId - Bytes32 type identifier of the received data.
 * @property {string} receivedData - Bytes data received by the Universal Profile.
 * @property {string} returnedValue - Bytes data returned by the Universal Profile.
 */

/**
 * @typedef {object} ProcessedLsp1Event
 * @property {string} id - Unique identifier for the processed event.
 * @property {number} timestamp - Timestamp when the event was processed.
 * @property {string} type - Human-readable event type name (e.g., 'lsp7_received', 'follower_gained').
 * @property {string} typeId - The original bytes32 typeId of the event.
 * @property {string} data - The raw `receivedData` from the event.
 * @property {string} sender - The actual sender address, potentially decoded from `receivedData`.
 * @property {string} value - The value from the event, converted to a string.
 * @property {boolean} read - Read status, defaults to false.
 * @property {object} decodedPayload - Additional decoded data, e.g., `followerAddress`.
 */


/**
 * Service class responsible for connecting to the LUKSO network via WebSocket,
 * listening for `UniversalReceiver` events on a specific profile address using
 * Viem's `watchContractEvent`, decoding the event arguments, and notifying
 * registered callbacks. Includes logic to decode sender addresses from LSP7/LSP8
 * `receivedData` and follower addresses from custom follower event data.
 * Also provides basic duplicate event detection and event simulation.
 */
class LSP1EventService {
  /** @type {Array<(event: ProcessedLsp1Event) => void>} */
  eventCallbacks = [];
  /** @type {import('viem').PublicClient | null} */
  viemClient = null;
  /** @type {(() => void) | null} Function returned by watchContractEvent to stop watching */
  unwatchEvent = null;
  /** @type {string | null} The address currently being listened to */
  listeningAddress = null;
  /** @type {boolean} */
  initialized = false;
  /** @type {boolean} Indicates if setupEventListeners is currently running */
  isSettingUp = false;
  /** @type {boolean} Flag indicating if the service *should* be connected (based on valid address) */
  shouldBeConnected = false;
  /** @type {string[]} Stores identifiers of recent events to prevent duplicates */
  recentEvents = [];

  constructor() {
    this.eventCallbacks = [];
    this.viemClient = null;
    this.unwatchEvent = null;
    this.listeningAddress = null;
    this.initialized = false;
    this.isSettingUp = false;
    this.shouldBeConnected = false;
    this.recentEvents = [];
  }

  /**
   * Initializes the service (currently just sets a flag).
   * @async
   * @returns {Promise<boolean>} True if initialized.
   */
  async initialize() {
    if (this.initialized) return true;
    this.initialized = true;
    return true;
  }

  /**
   * Sets up the Viem WebSocket client and starts watching for UniversalReceiver events
   * on the specified address. Cleans up any previous listeners first.
   * @param {string} address - The Universal Profile address to listen on.
   * @returns {Promise<boolean>} True if setup was successful, false otherwise.
   */
  async setupEventListeners(address) {
    const logPrefix = `[LSP1 viem setup Addr:${address?.slice(0, 6)}]`;
    if (this.isSettingUp) {
      if (import.meta.env.DEV) {
        console.warn(`${logPrefix} Setup already in progress. Aborting.`);
      }
      return false;
    }
    if (!address || !isAddress(address)) {
      if (import.meta.env.DEV) {
        console.warn(`${logPrefix} Invalid address provided. Aborting setup.`);
      }
      this.shouldBeConnected = false;
      return false;
    }

    // If already listening to the same address and watcher exists, consider it setup.
    if (this.listeningAddress?.toLowerCase() === address.toLowerCase() && this.unwatchEvent) {
      this.shouldBeConnected = true;
      return true;
    }

    this.isSettingUp = true;
    this.shouldBeConnected = true; // Assume connection will be successful until proven otherwise
    this.cleanupListeners(); // Clean up previous before setting up new
    this.listeningAddress = address;

    try {
      const client = createPublicClient({
        chain: lukso,
        transport: webSocket(WSS_RPC_URL, {
            // Optional: Add retry logic or other WebSocket options here if needed
            // e.g., retryCount: 5, retryDelay: 2000
        }),
      });
      this.viemClient = client;

      this.unwatchEvent = this.viemClient.watchContractEvent({
        address: this.listeningAddress, // Viem expects checksummed address or will checksum it
        abi: LSP1_ABI,
        eventName: "UniversalReceiver",
        onLogs: (logs) => {
          if (import.meta.env.DEV) {
            console.log(`%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%`);
            console.log(`%%% VIEM watchContractEvent RECEIVED ${logs.length} LOG(S)! %%%`);
            console.log(`%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%`);
          }
          logs.forEach((log) => {
            if (import.meta.env.DEV) {
                console.log(`--- Processing Log ---`);
                console.log(`  TX Hash: ${log.transactionHash}`);
                console.log(`  Block: ${log.blockNumber}`);
                console.log(`  Removed: ${log.removed}`);
                // console.log(`  Raw Data: ${log.data}`); // Usually very long
                // console.log(`  Raw Topics:`, log.topics);
            }

            if (log.removed) {
              if (import.meta.env.DEV) {
                console.warn(`${logPrefix} Log marked as removed (reorg), skipping processing.`);
              }
              return;
            }

            try {
              const decodedLog = decodeEventLog({ abi: LSP1_ABI, data: log.data, topics: log.topics });
              if (import.meta.env.DEV) {
                console.log(`  Decoded Event Name: ${decodedLog.eventName}`);
                // console.log(`  Decoded Args Object:`, decodedLog.args);
              }

              if (decodedLog.eventName === "UniversalReceiver" && decodedLog.args) {
                this.handleUniversalReceiver(/** @type {DecodedLsp1EventArgs} */ (decodedLog.args));
              } else if (import.meta.env.DEV) {
                console.warn(`${logPrefix} Decoded log name mismatch or args missing.`);
              }
            } catch (e) {
              if (import.meta.env.DEV) {
                console.error(`%%% Error decoding filter log:`, e);
              }
            }
            if (import.meta.env.DEV) {
                console.log(`--- End Log ---`);
            }
          });
        },
        onError: (error) => {
          if (import.meta.env.DEV) {
            console.error(`❌ [LSP1 viem watchContractEvent] Error on address ${this.listeningAddress}:`, error);
          }
          this.shouldBeConnected = false;
          // Consider attempting to re-establish listener after a delay, or notify higher level
        },
      });
      if (import.meta.env.DEV) {
        console.log(`${logPrefix} Successfully started watching events.`);
      }
      this.isSettingUp = false;
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`${logPrefix} Error during viem client creation or watch setup:`, error);
      }
      this.cleanupListeners(); // Ensure cleanup on error
      this.isSettingUp = false;
      this.shouldBeConnected = false;
      return false;
    }
  }

  /** Cleans up the Viem client and event listener. */
  cleanupListeners() {
    const logPrefix = "[LSP1 viem cleanup]";
    this.shouldBeConnected = false; // Mark as not intended to be connected
    this.isSettingUp = false; // Reset setup flag

    if (this.unwatchEvent) {
      try {
        this.unwatchEvent();
        if (import.meta.env.DEV) {
            // console.log(`${logPrefix} Called unwatch function.`);
        }
      } catch (e) {
        if (import.meta.env.DEV) {
            console.error(`${logPrefix} Error calling unwatch function:`, e);
        }
      }
      this.unwatchEvent = null;
    }
    // Note: Viem's public client does not have an explicit close/disconnect for WebSocket transport.
    // It should be garbage collected when no longer referenced.
    this.viemClient = null;
    this.listeningAddress = null;
    this.recentEvents = []; // Clear recent events on cleanup
    if (import.meta.env.DEV) {
        // console.log(`${logPrefix} Listeners cleaned up.`);
    }
  }

  /**
   * Handles decoded UniversalReceiver event arguments, decodes additional data if necessary,
   * checks for duplicates, and notifies listeners.
   * @param {DecodedLsp1EventArgs} eventArgs - The decoded arguments from the UniversalReceiver event.
   */
  handleUniversalReceiver(eventArgs) {
    if (!eventArgs || typeof eventArgs !== "object" || !eventArgs.typeId) {
      if (import.meta.env.DEV) {
        console.warn("‼️ [LSP1 handleUniversalReceiver - viem] Invalid or incomplete args received:", eventArgs);
      }
      return;
    }
    const { from, value, typeId, receivedData, returnedValue } = eventArgs;
    const lowerCaseTypeId = typeId?.toLowerCase();

    if (!lowerCaseTypeId) {
      if (import.meta.env.DEV) {
        console.warn("‼️ [LSP1 handleUniversalReceiver - viem] Missing typeId in args:", eventArgs);
      }
      return;
    }

    const stringValue = value?.toString() ?? "0";
    const eventTypeName = TYPE_ID_TO_EVENT_MAP[lowerCaseTypeId] || "unknown_event";

    // --- ADD DEBUG LOGGING FOR FOLLOWER_GAINED ---
    if (eventTypeName === "follower_gained" && import.meta.env.DEV) {
        console.log("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
        console.log("DEBUG: Follower Gained Event Received by LSP1EventService");
        console.log("  eventArgs.from (caller of universalReceiver):", from);
        console.log("  eventArgs.value:", stringValue);
        console.log("  eventArgs.typeId:", typeId);
        console.log("  eventArgs.receivedData:", receivedData);
        console.log("  eventArgs.returnedValue:", returnedValue);
        console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
    }
    // --- END DEBUG LOGGING ---


    if (this.isDuplicateEvent(typeId, from, stringValue, receivedData)) {
      if (import.meta.env.DEV) {
        console.warn(`[LSP1 handleUniversalReceiver - viem] Duplicate event detected, ignoring: Type=${eventTypeName}`);
      }
      return;
    }
    if (import.meta.env.DEV) {
        console.log(`✅ [LSP1 handleUniversalReceiver - viem] Processing Unique Event: Type=${eventTypeName}, From=${from?.slice(0, 6)}, Value=${stringValue}, TypeId=${lowerCaseTypeId.slice(0, 8)}...`);
    }

    let actualSender = from || "0xUNKNOWN"; 
    let decodedPayload = {};

    if ((eventTypeName === "lsp7_received" || eventTypeName === "lsp8_received") && typeof receivedData === "string" && receivedData !== "0x") {
        const abiToUse = eventTypeName === "lsp7_received" ? LSP7_RECEIVED_DATA_ABI : LSP8_RECEIVED_DATA_ABI;
        try {
            const decodedDataArray = decodeAbiParameters(abiToUse, receivedData);
            if (decodedDataArray && decodedDataArray.length > 1 && typeof decodedDataArray[1] === 'string' && isAddress(decodedDataArray[1])) {
                actualSender = getAddress(decodedDataArray[1]); 
                if (import.meta.env.DEV) {
                    console.log(`   Decoded actual sender from receivedData (${eventTypeName}): ${actualSender}`);
                }
            } else if (import.meta.env.DEV) {
                console.warn(`[LSP1 viem] Failed to decode sender from receivedData or decoded data invalid for ${eventTypeName}. Data: ${receivedData}`);
            }
        } catch (decodeError) {
            if (import.meta.env.DEV) {
                console.error(`[LSP1 viem] Error decoding receivedData for ${eventTypeName}:`, decodeError, `Data: ${receivedData}`);
            }
        }
    }

    if ((eventTypeName === "follower_gained" || eventTypeName === "follower_lost")) {
        const logCtx = `[LSP1 ${eventTypeName}]`;

        if (typeof receivedData === "string" && isAddress(receivedData)) {
            // Per LSP26, receivedData is the follower's address. This is the only reliable source.
            const followerAddress = getAddress(receivedData);
            decodedPayload.followerAddress = followerAddress;
            if (import.meta.env.DEV) {
                console.log(`${logCtx} Decoded follower address from receivedData: ${followerAddress}`);
            }
        } else if (import.meta.env.DEV) {
            console.warn(`${logCtx} Could not determine follower address. 'receivedData' was not a valid address. Data:`, receivedData);
        }
    }


    const eventObj = {
      id: `event_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      timestamp: Date.now(),
      type: eventTypeName, // Human-readable name from TYPE_ID_TO_EVENT_MAP
      typeId: lowerCaseTypeId, // The actual on-chain typeId, lowercased
      data: receivedData || "0x",
      sender: actualSender, 
      value: stringValue,
      read: false,
      decodedPayload: decodedPayload, 
    };
    this.notifyEventListeners(eventObj);
  }

  /**
   * Basic duplicate event detection based on recent event identifiers.
   * @param {string} typeId - The typeId of the event.
   * @param {string} from - The 'from' address of the event.
   * @param {string} value - The 'value' of the event.
   * @param {string} data - The 'receivedData' of the event.
   * @returns {boolean} True if the event is considered a duplicate, false otherwise.
   */
  isDuplicateEvent(typeId, from, value, data) {
    const eventIdentifier = `${typeId}-${from}-${value}-${data || "0x"}`;
    if (this.recentEvents.includes(eventIdentifier)) {
      return true;
    }
    this.recentEvents.push(eventIdentifier);
    if (this.recentEvents.length > MAX_RECENT_EVENTS) {
      this.recentEvents.shift(); // Keep the list bounded
    }
    return false;
  }

  /**
   * Registers a callback function to be executed when an event is received.
   * @param {(event: ProcessedLsp1Event) => void} callback - The function to register.
   * @returns {() => void} An unsubscribe function.
   */
  onEvent(callback) {
    if (typeof callback === "function") {
      if (!this.eventCallbacks.includes(callback)) {
        this.eventCallbacks.push(callback);
      } else if (import.meta.env.DEV) {
        console.warn("[LSP1 viem] Attempted duplicate event callback registration.");
      }
    } else if (import.meta.env.DEV) {
      console.error("[LSP1 viem] Invalid callback type passed to onEvent:", typeof callback);
    }
    return () => {
      this.eventCallbacks = this.eventCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Notifies all registered listeners about a new event.
   * @param {ProcessedLsp1Event} event - The processed event object.
   */
  notifyEventListeners(event) {
    if (!event || !event.type) {
      if (import.meta.env.DEV) {
        console.error("[LSP1 viem notifyEventListeners] Attempted to notify with invalid event object:", event);
      }
      return;
    }
    if (this.eventCallbacks.length === 0 && import.meta.env.DEV) {
      console.warn(`[LSP1 viem] No listeners registered to notify about event type '${event.type}'.`);
      // return; // Allow to proceed even if no listeners, for consistency
    }
    if (import.meta.env.DEV) {
        console.log(`[LSP1 viem] Notifying ${this.eventCallbacks.length} listeners about event type '${event.type}'. Event ID: ${event.id}, TypeId: ${event.typeId}`);
    }
    // Iterate over a copy in case a callback modifies the array (e.g., unsubscribes)
    this.eventCallbacks.slice().forEach((callback) => {
      try {
        callback(event);
      } catch (e) {
        if (import.meta.env.DEV) {
            console.error(`[LSP1 viem] Error executing callback for event type ${event.type} (ID: ${event.id}):`, e);
        }
      }
    });
  }

  /**
   * Simulates receiving an event for testing purposes.
   * @async
   * @param {string} eventType - The human-readable event type or typeId to simulate.
   * @returns {Promise<boolean>} True if simulation was processed, false on error.
   */
  async simulateEvent(eventType) {
    if (!eventType || typeof eventType !== "string") {
      if (import.meta.env.DEV) {
        console.error("[LSP1 Sim - viem] Invalid eventType:", eventType);
      }
      return false;
    }
    const normalizedEventType = eventType.toLowerCase().replace(/[-_\s]/g, "");

    let typeId;
    let readableName;

    // Try to find by human-readable name first
    const typeIdEntryByName = Object.entries(EVENT_TYPE_MAP).find(
      ([key]) => key.toLowerCase().replace(/[-_\s]/g, "") === normalizedEventType
    );

    if (typeIdEntryByName) {
      readableName = typeIdEntryByName[0];
      typeId = typeIdEntryByName[1];
    } else {
      // Try to find by typeId
      const typeIdEntryById = Object.entries(TYPE_ID_TO_EVENT_MAP).find(
        ([id]) => id.toLowerCase() === normalizedEventType // Assuming normalizedEventType could be a typeId
      );
      if (typeIdEntryById) {
        typeId = typeIdEntryById[0];
        readableName = typeIdEntryById[1];
      } else {
        if (import.meta.env.DEV) {
            console.error("[LSP1 Sim - viem] Unknown event type/ID:", eventType);
        }
        return false;
      }
    }

    const mockValue = readableName.includes("lyx") ? 1000000000000000000n : 0n; // 1 LYX or 0
    // For simulating follower gained, the 'from' address should be the Follower Registry
    const mockFromField = (readableName === "follower_gained" || readableName === "follower_lost")
        ? "0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA" // LSP26 Follower Registry
        : "0xSimulationSender0000000000000000000000"; // Placeholder for other events
    
    let mockReceivedData = "0x";
    if (readableName === "follower_gained" || readableName === "follower_lost") {
      const mockFollowerAddress = "0xd8dA6Bf26964AF9D7eed9e03e53415D37aA96045"; // Actual follower/unfollower
      mockReceivedData = mockFollowerAddress.toLowerCase(); // LSP26: receivedData is the follower's address
    }

    const simulatedArgs = {
      from: mockFromField, 
      value: mockValue,
      typeId: typeId,
      receivedData: mockReceivedData, 
      returnedValue: "0x", 
    };

    try {
      this.handleUniversalReceiver(simulatedArgs);
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`[LSP1 Sim - viem] Error during handleUniversalReceiver call:`, error);
      }
      return false;
    }
  }
}

export default LSP1EventService;
```

---
### `src\services\PinataService.js`
```js
// src/services/PinataService.js

// The base URL for the Pinata PinJSONToIPFS API endpoint.
const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

// Retrieve the Pinata JWT from environment variables.
// It's crucial this is set in your .env file for this service to work.
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;

if (!PINATA_JWT && import.meta.env.DEV) {
  // A prominent warning for developers if the JWT is missing during development.
  // This helps catch configuration errors early.
  console.warn(
    "⚠️ [PinataService] VITE_PINATA_JWT is not defined in your .env file. " +
    "The service will not be able to upload files to Pinata. " +
    "Please get a JWT from your Pinata account (https://app.pinata.cloud/keys) and add it to your .env file."
  );
}

/**
 * Uploads a JavaScript object as a JSON file to IPFS via the Pinata pinning service.
 * This function handles the API request, authentication, and error handling.
 *
 * @param {object} jsonData The JavaScript object to be uploaded. It will be stringified to JSON.
 * @param {string} [pinataName='RADAR_Workspace'] An optional name for the pin, which helps identify it in your Pinata account.
 * @returns {Promise<string>} A promise that resolves with the IPFS Content Identifier (CID, e.g., 'Qm...').
 * @throws {Error} Throws an error if the Pinata JWT is not configured, if the network request fails, or if the Pinata API returns an error.
 */
export async function uploadJsonToPinata(jsonData, pinataName = 'RADAR_Workspace') {
  // Fail fast if the essential JWT is missing.
  if (!PINATA_JWT) {
    throw new Error("Pinata JWT is not configured. Cannot upload to IPFS.");
  }

  // The body of the request needs to be a specific structure that Pinata expects.
  const requestBody = {
    pinataOptions: {
      cidVersion: 1, // Use CIDv1 for better compatibility and case-insensitivity.
    },
    pinataMetadata: {
      // The name helps you identify the file in your Pinata dashboard.
      name: `${pinataName}_${new Date().toISOString()}`,
    },
    // The actual JSON data you want to pin.
    pinataContent: jsonData,
  };

  try {
    const response = await fetch(PINATA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The JWT is passed as a Bearer token in the Authorization header.
        'Authorization': `Bearer ${PINATA_JWT}`,
      },
      body: JSON.stringify(requestBody),
    });

    // Handle non-successful HTTP responses.
    if (!response.ok) {
      // Try to parse the error response from Pinata for a more specific message.
      const errorData = await response.json().catch(() => ({ error: 'Could not parse Pinata error response.' }));
      // Throw an error that includes the HTTP status and the message from Pinata.
      throw new Error(`Pinata API Error (${response.status}): ${errorData.error || response.statusText}`);
    }

    // If the request was successful, parse the JSON response.
    const result = await response.json();

    // The CID is returned in the 'IpfsHash' property of the response.
    if (!result.IpfsHash) {
      throw new Error("Pinata API response did not include an IpfsHash (CID).");
    }
    
    if (import.meta.env.DEV) {
      console.log(`[PinataService] Successfully pinned JSON. CID: ${result.IpfsHash}, Timestamp: ${result.Timestamp}`);
    }
    
    return result.IpfsHash;

  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("[PinataService] An error occurred during the upload process:", error);
    }
    // Re-throw the error so the calling function (e.g., ConfigurationService) can handle it.
    throw error;
  }
}
```

---
### `src\services\TokenService.js`
```js
// src/services/TokenService.js
import { isAddress, hexToString, getAddress } from "viem"; // Removed unused: slice, decodeAbiParameters, parseAbiParameters
import { ERC725YDataKeys } from "@lukso/lsp-smart-contracts";

// LSP8 minimal ABI needed for token interactions
const LSP8_MINIMAL_ABI = [
  { inputs: [{ name: "interfaceId", type: "bytes4" }], name: "supportsInterface", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "tokenId", type: "bytes32" }], name: "tokenOwnerOf", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "tokenOwner", type: "address" }], name: "tokenIdsOf", outputs: [{ name: "", type: "bytes32[]" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "dataKey", type: "bytes32" }], name: "getData", outputs: [{ name: "dataValue", type: "bytes" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "dataKeys", type: "bytes32[]" }], name: "getDataBatch", outputs: [{ name: "dataValues", type: "bytes[]" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "tokenId", type: "bytes32" }, { name: "dataKey", type: "bytes32" }], name: "getDataForTokenId", outputs: [{ name: "data", type: "bytes" }], stateMutability: "view", type: "function" },
];

/**
 * Safely decodes hex to UTF-8 string, returning null on error.
 * @param {string | null | undefined} hex - The hex string to decode.
 * @returns {string | null} The decoded string or null.
 */
function hexToUtf8Safe(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("0x") || hex === "0x") return null;
  try { return hexToString(hex); }
  catch (e) {
    if (import.meta.env.DEV) {
        console.warn("[TS] Failed hexToString:", hex, e);
    }
    return null;
  }
}

/**
 * Safely parses bytes32 hex string to a number, returning NaN on error.
 * @param {string | null | undefined} tokenIdBytes32 - The bytes32 token ID.
 * @returns {number} The parsed number or NaN.
 */
function parseTokenIdNum(tokenIdBytes32) {
  if (!tokenIdBytes32 || typeof tokenIdBytes32 !== "string" || !tokenIdBytes32.startsWith("0x")) return NaN;
  try { return Number(BigInt(tokenIdBytes32)); }
  catch (e) {
    if (import.meta.env.DEV) {
        console.warn(`[TS] Could not parse tokenId ${tokenIdBytes32} as number:`, e);
    }
    return NaN;
  }
}

/**
 * @typedef {object} DecodedVerifiableUri
 * @property {string} url - The decoded URL.
 * @property {string|null} hashFunction - The hash function identifier (e.g., 'keccak256(utf8)'), or null.
 * @property {string|null} hash - The hash value, or null.
 */

/**
 * @typedef {object} TokenMetadata
 * @property {string} name - The name of the token.
 * @property {string} [description] - The description of the token.
 * @property {string|null} image - The resolved image URL for the token.
 * @property {any} [attributes] - Other attributes from the metadata.
 */


/**
 * Service class for interacting with LSP8 NFT collections.
 * Handles fetching owned token IDs and resolving token metadata (including images)
 * using a Viem Public Client. Includes internal caching for metadata.
 */
class TokenService {
  /** @type {import('viem').PublicClient | null} */
  publicClient = null;
  /** @type {string | null} */
  collectionAddress = null;
  /** @type {Map<string, TokenMetadata>} */
  metadataCache = new Map();
  /** @type {boolean} */
  initialized = false;
  /** @type {string} */
  ipfsGateway = "https://api.universalprofile.cloud/ipfs/"; // Default, can be overridden by env var

  /**
   * Creates an instance of TokenService.
   * @param {import('viem').PublicClient | null} publicClient - The Viem Public Client instance.
   * @param {string | null} collectionAddress - The address of the LSP8 collection contract.
   */
  constructor(publicClient, collectionAddress) {
    this.publicClient = publicClient;
    this.collectionAddress = collectionAddress ? (isAddress(collectionAddress) ? getAddress(collectionAddress) : null) : null;
    this.metadataCache = new Map();
    this.initialized = !!publicClient && !!this.collectionAddress;
    if (import.meta.env.VITE_IPFS_GATEWAY) {
        this.ipfsGateway = import.meta.env.VITE_IPFS_GATEWAY;
    }
  }

  /**
   * Initializes the service, checking for client and valid collection address.
   * @async
   * @returns {Promise<boolean>} True if ready, false otherwise.
   */
  async initialize() {
    this.initialized = !!this.publicClient;
    if (!this.collectionAddress || !isAddress(this.collectionAddress)) {
      if (import.meta.env.DEV) {
        console.error("TokenService: Invalid or missing collection address during initialization.");
      }
      this.initialized = false;
    }
    return this.initialized;
  }

  /**
   * Checks if the Viem Public Client is available and connected.
   * @async
   * @returns {Promise<boolean>} True if client is ready, false otherwise.
   */
  async checkClientReady() {
    if (!this.publicClient) {
      if (import.meta.env.DEV) {
        console.warn("TokenService: Public Client not available.");
      }
      return false;
    }
    try {
      const chainId = await this.publicClient.getChainId();
      return !!chainId; // Basic check to see if client can communicate
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("[TokenService] Error checking public client:", error);
      }
      return false;
    }
  }

  /**
   * Retrieves the token IDs owned by a specific user within this collection.
   * @param {string} userAddress - The address of the user.
   * @returns {Promise<string[]>} An array of bytes32 token IDs. Returns empty array on error or if none found.
   */
  async getOwnedTokenIds(userAddress) {
    if (!userAddress || !isAddress(userAddress)) {
      if (import.meta.env.DEV) {
        console.warn("[TS] getOwnedTokenIds: Invalid userAddress.");
      }
      return [];
    }
    if (!this.collectionAddress) { // Already checked for isAddress in constructor/initialize
      if (import.meta.env.DEV) {
        console.warn("[TS] getOwnedTokenIds: Invalid or uninitialized collectionAddress.");
      }
      return [];
    }
    if (!(await this.checkClientReady())) {
      if (import.meta.env.DEV) {
        console.warn("[TS] getOwnedTokenIds: Client not ready.");
      }
      return [];
    }

    try {
      const tokenIds = await this.publicClient.readContract({
        address: this.collectionAddress,
        abi: LSP8_MINIMAL_ABI,
        functionName: "tokenIdsOf",
        args: [getAddress(userAddress)], // Ensure checksummed
      });
      return Array.isArray(tokenIds) ? tokenIds : [];
    } catch (error) {
      if (import.meta.env.DEV) {
        if (error?.message?.includes("InvalidArgumentsError") || error?.message?.includes("call exception")) {
          console.warn(`[TS] Contract ${this.collectionAddress} likely doesn't support tokenIdsOf or address ${userAddress} has no tokens.`);
        } else {
          console.error("[TS] Error calling tokenIdsOf:", error);
        }
      }
      return [];
    }
  }

  /**
   * Decodes VerifiableURI bytes according to LSP2 specification.
   * @param {string} verifiableUriBytes - The hex string (0x...) representing the VerifiableURI.
   * @returns {DecodedVerifiableUri | null} Decoded data or null on failure.
   */
  decodeVerifiableUri(verifiableUriBytes) {
    if (!verifiableUriBytes || typeof verifiableUriBytes !== "string" || !verifiableUriBytes.startsWith("0x")) return null;

    if (verifiableUriBytes.startsWith("0x0000") && verifiableUriBytes.length >= (2 + 4 + 2 + 0 + 0) * 2) {
      try {
        const hexString = verifiableUriBytes.substring(2);
        const methodId = `0x${hexString.substring(4, 12)}`;
        const lengthHex = `0x${hexString.substring(12, 16)}`;
        const hashLengthBytes = parseInt(lengthHex, 16);

        if (isNaN(hashLengthBytes)) throw new Error("Invalid hash length bytes in VerifiableURI");

        const hashLengthChars = hashLengthBytes * 2;
        const hashStartOffsetChars = 16;
        const hashEndOffsetChars = hashStartOffsetChars + hashLengthChars;

        if (hexString.length < hashEndOffsetChars) throw new Error("Byte string too short for declared hash length");

        const hash = `0x${hexString.substring(hashStartOffsetChars, hashEndOffsetChars)}`;
        const uriHex = `0x${hexString.substring(hashEndOffsetChars)}`;
        const url = hexToUtf8Safe(uriHex);

        if (!url) throw new Error("Failed to decode URL part of VerifiableURI");

        let hashFunction = null;
        if (methodId === "0x6f357c6a") hashFunction = "keccak256(utf8)";
        else if (methodId === "0x8019f9b1") hashFunction = "keccak256(bytes)";

        return { url, hashFunction, hash };
      } catch (e) {
        if (import.meta.env.DEV) {
            console.error("[TS] Error decoding VerifiableURI:", verifiableUriBytes, e);
        }
      }
    }

    const plainUrl = hexToUtf8Safe(verifiableUriBytes);
    if (plainUrl) {
      return { url: plainUrl, hashFunction: null, hash: null };
    }

    if (import.meta.env.DEV) {
        console.warn("[TS] Could not decode URI bytes as VerifiableURI or plain URL:", verifiableUriBytes);
    }
    return null;
  }

  /**
   * Fetches JSON data from a given URI (resolving IPFS URIs).
   * @param {string} uri - The URI (http, https, or ipfs) to fetch from.
   * @returns {Promise<object|null>} The parsed JSON object or null on error.
   * @async
   */
  async fetchJsonFromUri(uri) {
    if (!uri || typeof uri !== "string") return null;
    let fetchUrl = uri;

    if (uri.startsWith("ipfs://")) {
      fetchUrl = `${this.ipfsGateway.endsWith('/') ? this.ipfsGateway : this.ipfsGateway + '/'}${uri.slice(7)}`;
    } else if (!uri.startsWith("http")) {
      if (import.meta.env.DEV) {
        console.warn(`[TS] Skipping fetch for unknown scheme: ${uri}`);
      }
      return null;
    }

    try {
      const response = await fetch(fetchUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${fetchUrl}`);
      }
      return await response.json();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`[TS] Fetch/Parse JSON Error from ${fetchUrl}:`, error);
      }
      return null;
    }
  }

  /**
   * Resolves an IPFS or HTTP URL string to a fetchable URL.
   * @param {string | null | undefined} url - The URL to resolve.
   * @returns {string | null} The fetchable URL or null.
   */
  resolveImageUrl(url) {
    if (!url || typeof url !== "string") return null;
    if (url.startsWith("ipfs://")) {
        return `${this.ipfsGateway.endsWith('/') ? this.ipfsGateway : this.ipfsGateway + '/'}${url.slice(7)}`;
    }
    if (url.startsWith("http")) return url;
    return null;
  }

  /**
   * Extracts the primary image URL from potentially nested LSP3/LSP4 metadata.
   * @param {object | null} metadata - The metadata object.
   * @returns {string | null} The resolved image URL or null.
   */
  getImageUrlFromMetadata(metadata) {
    if (!metadata || typeof metadata !== "object") return null;
    let imageUrl = null;

    imageUrl = this.resolveImageUrl(metadata.image);
    if (imageUrl) return imageUrl;

    if (metadata.LSP4Metadata) {
        imageUrl = this.resolveImageUrl(metadata.LSP4Metadata.images?.[0]?.[0]?.url);
        if (imageUrl) return imageUrl;
        imageUrl = this.resolveImageUrl(metadata.LSP4Metadata.icon?.[0]?.url);
        if (imageUrl) return imageUrl;
        imageUrl = this.resolveImageUrl(metadata.LSP4Metadata.assets?.[0]?.url);
        if (imageUrl) return imageUrl;
    }

    if (metadata.LSP3Profile) {
        imageUrl = this.resolveImageUrl(metadata.LSP3Profile.profileImage?.[0]?.url);
        if (imageUrl) return imageUrl;
        imageUrl = this.resolveImageUrl(metadata.LSP3Profile.backgroundImage?.[0]?.url);
        if (imageUrl) return imageUrl;
    }
    return null;
  }

  /**
   * Fetches, processes, and caches metadata for a specific token ID within the collection.
   * @param {string} tokenId - The bytes32 token ID.
   * @returns {Promise<TokenMetadata|null>} Processed metadata or a fallback object on error. Returns null for invalid input.
   * @async
   */
  async fetchTokenMetadata(tokenId) {
    if (!tokenId || typeof tokenId !== "string" || !tokenId.startsWith("0x") || !this.collectionAddress) {
        if(import.meta.env.DEV) console.warn("[TS fetchTokenMetadata] Invalid tokenId or uninitialized collectionAddress.");
        return null;
    }

    const cacheKey = `metadata_${this.collectionAddress}_${tokenId}`;
    if (this.metadataCache.has(cacheKey)) {
      return this.metadataCache.get(cacheKey) || null;
    }

    if (!(await this.checkClientReady())) {
      if (import.meta.env.DEV) {
        console.warn("[TS fetchTokenMetadata] Client not ready.");
      }
      return null;
    }

    const displayId = parseTokenIdNum(tokenId);
    const fallbackMeta = { name: `Token #${displayId || tokenId.slice(0, 8)}...`, description: "Metadata loading failed", image: null };

    try {
      const lsp4MetadataKey = ERC725YDataKeys.LSP4.LSP4Metadata;
      let metadataUriBytes = await this.publicClient.readContract({
          address: this.collectionAddress, abi: LSP8_MINIMAL_ABI, functionName: "getDataForTokenId", args: [tokenId, lsp4MetadataKey],
        }).catch(() => null);

      if (!metadataUriBytes || metadataUriBytes === "0x") {
        const baseUriKey = ERC725YDataKeys.LSP8.LSP8TokenMetadataBaseURI;
        metadataUriBytes = await this.publicClient.readContract({
            address: this.collectionAddress, abi: LSP8_MINIMAL_ABI, functionName: "getData", args: [baseUriKey],
          }).catch(() => null);
      }

      if (metadataUriBytes && metadataUriBytes !== "0x") {
        const decodedUriData = this.decodeVerifiableUri(metadataUriBytes);
        if (decodedUriData?.url) {
          let finalUrl = decodedUriData.url;
          const baseUriCheckBytes = await this.publicClient.readContract({
              address: this.collectionAddress, abi: LSP8_MINIMAL_ABI, functionName: "getData", args: [ERC725YDataKeys.LSP8.LSP8TokenMetadataBaseURI],
            }).catch(() => null);

          if (metadataUriBytes === baseUriCheckBytes && baseUriCheckBytes !== null) {
            const formattedTokenIdPart = parseTokenIdNum(tokenId).toString();
            if (!isNaN(Number(formattedTokenIdPart))) {
                finalUrl = finalUrl.endsWith("/") ? `${finalUrl}${formattedTokenIdPart}` : `${finalUrl}/${formattedTokenIdPart}`;
            } else if (import.meta.env.DEV) {
                console.warn(`[TS] Token ID ${tokenId} could not be parsed to a number for base URI construction. Using raw base URI: ${finalUrl}`);
            }
          }

          const metadataJson = await this.fetchJsonFromUri(finalUrl);
          if (metadataJson) {
            const processedMetadata = {
                name: metadataJson.name || fallbackMeta.name,
                description: metadataJson.description,
                image: this.getImageUrlFromMetadata(metadataJson),
                attributes: metadataJson.attributes,
            };
            this.metadataCache.set(cacheKey, processedMetadata);
            return processedMetadata;
          }
        }
      }

      if (import.meta.env.DEV) {
        console.warn(`[TS] No metadata URI resolved or fetched for ${tokenId} in collection ${this.collectionAddress}. Using fallback.`);
      }
      this.metadataCache.set(cacheKey, fallbackMeta);
      return fallbackMeta;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`[TS] Critical error fetching metadata for ${tokenId} in ${this.collectionAddress}:`, error);
      }
      this.metadataCache.set(cacheKey, fallbackMeta);
      return fallbackMeta;
    }
  }

  /**
   * Loads a token's image into a specific CanvasManager instance.
   * @param {string} tokenId - The bytes32 token ID.
   * @param {import('../utils/CanvasManager').default} canvasManager - The target CanvasManager instance.
   * @returns {Promise<boolean>} True if image was successfully set (or attempted with a valid URL), false otherwise.
   * @async
   */
  async loadTokenIntoCanvas(tokenId, canvasManager) {
    if (!tokenId || !canvasManager?.setImage || typeof canvasManager.setImage !== 'function') {
      if (import.meta.env.DEV) {
        console.error("TokenService: Invalid parameters for loadTokenIntoCanvas.");
      }
      return false;
    }

    const displayId = parseTokenIdNum(tokenId);
    const placeholderUrl = `https://via.placeholder.com/600x400/444444/cccccc.png?text=Loading...+(${displayId || tokenId.slice(0, 6)})`;
    const errorPlaceholder = `https://via.placeholder.com/600x400/cc3333/ffffff.png?text=Load+Error+(${displayId || tokenId.slice(0, 6)})`;

    try {
      await canvasManager.setImage(placeholderUrl);
      const metadata = await this.fetchTokenMetadata(tokenId);
      const imageUrl = metadata?.image;

      if (!imageUrl || typeof imageUrl !== "string") {
        if (import.meta.env.DEV) {
            console.warn(`[TS] No valid image URL found in metadata for token ${tokenId}. Using error placeholder.`);
        }
        await canvasManager.setImage(errorPlaceholder);
        return false;
      }

      await canvasManager.setImage(imageUrl);
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`[TS] Error loading token ${tokenId} into canvas:`, error);
      }
      try {
        await canvasManager.setImage(errorPlaceholder);
      } catch (fallbackError) {
        if (import.meta.env.DEV) {
            console.error("[TS] Failed to load error placeholder into canvas:", fallbackError);
        }
      }
      return false;
    }
  }

  /**
   * Applies multiple token assignments to their respective CanvasManager instances.
   * @param {Object.<string, string>} tokenAssignments - An object mapping layerId to tokenId (bytes32).
   * @param {Object.<string, import('../utils/CanvasManager').default>} canvasManagers - An object mapping layerId to CanvasManager instances.
   * @returns {Promise<Object.<string, {success: boolean, tokenId: string | null, error?: string}>>} An object detailing success/failure per layer.
   * @async
   */
  async applyTokenAssignments(tokenAssignments, canvasManagers) {
    /** @type {Object.<string, {success: boolean, tokenId: string | null, error?: string}>} */
    const results = {};
    if (!tokenAssignments || !canvasManagers) {
        if(import.meta.env.DEV) console.warn("[TS applyTokenAssignments] Missing tokenAssignments or canvasManagers.");
        return results;
    }
    if (!(await this.checkClientReady())) {
      if (import.meta.env.DEV) {
        console.warn("[TS applyTokenAssignments] Client not ready.");
      }
      Object.keys(tokenAssignments).forEach(layerId => {
        results[layerId] = { success: false, tokenId: tokenAssignments[layerId], error: "Client not ready" };
      });
      return results;
    }

    const promises = Object.entries(tokenAssignments).map(
      async ([layerId, tokenId]) => {
        results[layerId] = { success: false, tokenId: tokenId || null };
        if (!tokenId) {
          results[layerId].error = "No token ID provided for layer";
          return;
        }
        const manager = canvasManagers[layerId];
        if (!manager) {
          if (import.meta.env.DEV) {
            console.warn(`[TS applyTokenAssignments] No manager found for layer ${layerId}`);
          }
          results[layerId].error = "Canvas manager not found for layer";
          return;
        }
        try {
          const success = await this.loadTokenIntoCanvas(tokenId, manager);
          results[layerId].success = success;
          if (!success) {
            results[layerId].error = results[layerId].error || "Image load into canvas failed";
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error(`[TS applyTokenAssignments] Error applying token ${tokenId} to layer ${layerId}:`, error);
          }
          results[layerId].error = error.message || "Unknown error during token application";
        }
      },
    );

    await Promise.allSettled(promises);
    return results;
  }
}

export default TokenService;
```

---
### `src\setupTests.js`
```js
// src/setupTests.js
import '@testing-library/jest-dom'; // Extends expect with jest-dom matchers
```

---
### `src\styles\base.css`
```css
@import "./variables.css";

@font-face {
  font-family: "RadarFont";
  src: url("/RADAR.ttf") format("truetype");
  font-weight: normal;
  font-style: normal;
}

/* Reset */
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* Base HTML & Body */
html,
body {
  font-family: var(--font-family);
  font-size: 16px;
  color: var(--color-text);
  /* Base height/width/bg set inline */
}

/* Base App Wrapper */
.app {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* Typography */
h1,
h2,
h3,
h4,
h5,
h6 {
  color: var(--color-primary);
  margin-bottom: var(--space-sm);
  font-weight: 500;
}

p {
  line-height: 1.5;
  margin-bottom: var(--space-md);
}

a {
  color: var(--color-primary);
  text-decoration: none;
  transition: color var(--transition-fast);
}

a:hover {
  color: var(--color-primary-a70);
}

/* Common utility classes */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* Animations */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideInFromLeft { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
@keyframes pulse { 0% { opacity: 0.7; } 50% { opacity: 1; } 100% { opacity: 0.7; } }
@keyframes pulse-ring { 0% { transform: scale(0.95); opacity: 0.7; } 50% { transform: scale(1.05); opacity: 0.3; } 100% { transform: scale(0.95); opacity: 0.7; } }
@keyframes pulse-core { 0% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.05); opacity: 0.2; } 100% { transform: scale(1); opacity: 0.5; } }
@keyframes highlight-new { 0% { background: var(--color-primary-a30); transform: translateY(-5px); } 100% { background: var(--color-primary-a05); transform: translateY(0); } }
@keyframes bell-pulse { 0% { transform: scale(1); } 10% { transform: scale(1.1); } 20% { transform: scale(1); } 100% { transform: scale(1); } }
```

---
### `src\styles\components.css`
```css
@import "./variables.css";

/*---------- Buttons ----------*/
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-xs) var(--space-md);
  background: var(--color-primary-a15);
  color: var(--color-primary);
  border: 1px solid var(--color-primary-a30);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  font-weight: 500;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--transition-normal);
}
.btn:hover:not(:disabled) {
  background: var(--color-primary-a30);
  border-color: var(--color-primary-a50);
  transform: translateY(-2px);
  box-shadow: var(--shadow-primary-sm);
}
.btn:active:not(:disabled) {
  transform: translateY(0);
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-sm {
  font-size: var(--font-size-sm);
  padding: var(--space-xxs) var(--space-xs);
}
.btn-block {
  width: 100%;
  display: block;
}
.btn-icon {
  width: var(--icon-size-md);
  height: var(--icon-size-md);
  padding: 0;
  border-radius: var(--radius-circle);
}

/* Generic Close Button Style */
.close-button {
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: var(--font-size-xl);
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  padding: 0;
  margin: 0;
}
.close-button:hover {
  opacity: 0.8;
  transform: scale(1.1);
}

/*---------- Forms ----------*/
.form-group {
  margin-bottom: var(--space-md);
}
.form-group label {
  display: block;
  margin-bottom: var(--space-xs);
  font-size: var(--font-size-sm);
  color: var(--color-primary-a90);
  text-transform: uppercase;
}
.form-control {
  width: 100%;
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-glass-bg);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  transition: border-color var(--transition-fast);
}
.form-control:focus {
  outline: none;
  border-color: var(--color-primary-a50);
  box-shadow: var(--shadow-primary-sm);
}

/* Custom Select Dropdown */
.custom-select {
  width: 100%;
  padding: var(--space-xs) var(--space-md) var(--space-xs) var(--space-sm);
  background: var(--color-glass-bg);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='6' viewBox='0 0 12 6' fill='none'%3E%3Cpath d='M6 6L0 0H12L6 6Z' fill='%2300f3ff'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  border: 1px solid var(--color-border);
  color: var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none; /* For Safari */
  -moz-appearance: none;    /* For Firefox */
}
.custom-select:hover {
  border-color: var(--color-primary-a30);
  background-color: var(--color-primary-a05);
}
.custom-select:focus {
  outline: none;
  border-color: var(--color-primary-a50);
  box-shadow: var(--shadow-primary-sm);
}

/* Sliders */
.slider-container {
  margin-bottom: var(--space-md);
}
.slider-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-xs);
}
.slider-label {
  text-transform: uppercase;
  font-size: var(--font-size-sm);
  color: var(--color-primary-a90);
}
.slider-value {
  font-size: var(--font-size-sm);
  color: var(--color-primary-a90);
}
input[type="range"] {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  height: 4px;
  background: var(--color-primary-a15);
  border-radius: 2px;
  outline: none;
  transition: background var(--transition-fast);
}
input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: var(--color-primary);
  border-radius: 50%;
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}
input[type="range"]::-moz-range-thumb { /* Styles for Firefox */
  width: 16px;
  height: 16px;
  background: var(--color-primary);
  border-radius: 50%;
  cursor: pointer;
  border: none; /* Remove default border */
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}
input[type="range"]:hover::-webkit-slider-thumb {
  transform: scale(1.2);
  box-shadow: 0 0 10px var(--color-primary-a30);
}
input[type="range"]:hover::-moz-range-thumb {
  transform: scale(1.2);
  box-shadow: 0 0 10px var(--color-primary-a30);
}
input[type="range"]:hover {
  background: var(--color-primary-a30);
}

/* Checkbox */
.checkbox-group {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}
.checkbox-group input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}

/*---------- Panels ----------*/
.panel {
  /* --- MODIFIED FOR CONSISTENT GLASSMORPHISM --- */
  background: var(--color-glass-bg-dark); /* Dark, semi-transparent base */
  border: 1px solid var(--color-primary-a15); /* Softer, color-matched border */
  border-radius: var(--radius-lg); /* Softer corners */
  backdrop-filter: blur(12px); /* Increased blur */
  -webkit-backdrop-filter: blur(12px);
  /* --- END MODIFICATION --- */
  
  color: var(--color-text);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  width: var(--panel-width);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  background: rgba(16, 16, 24, 0.4); /* Semi-transparent header */
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0; /* Prevent header from shrinking */
}
.panel-title {
  font-size: var(--font-size-lg);
  text-transform: uppercase;
  margin: 0;
  letter-spacing: 0.5px;
  font-weight: 500;
  color: var(--color-primary);
}
.panel-content {
  padding: var(--space-md);
  overflow-y: auto;
  flex-grow: 1; /* Allow content to take remaining space */
}
.panel-from-toolbar {
  position: fixed;
  top: var(--space-lg);
  left: var(--panel-left-position);
  z-index: var(--z-controls);
  animation: slideInFromLeft var(--transition-normal) var(--transition-elastic);
}

/*---------- Toolbar ----------*/
.toolbar-icon {
  width: var(--icon-size-lg);
  height: var(--icon-size-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-normal);
  background: var(--color-primary-a05);
  border: 1px solid var(--color-border);
  overflow: visible; /* Allow potential badges/effects */
  position: relative;
}
.toolbar-icon:hover {
  background: var(--color-primary-a15);
  border-color: var(--color-primary-a30);
  transform: translateY(-2px);
  box-shadow: var(--shadow-primary-sm);
}
.toolbar-icon.active {
  background: var(--color-primary-a15);
  border-color: var(--color-primary-a50);
  box-shadow: var(--shadow-primary-md);
}
.toolbar-icon .icon-image {
  width: var(--icon-size-md);
  height: var(--icon-size-md);
  transition: all var(--transition-fast);
  opacity: 1; /* Keep default opacity */
}
.toolbar-icon:hover .icon-image,
.toolbar-icon.active .icon-image {
  opacity: 1;
  filter: drop-shadow(0 0 5px var(--color-primary-a30));
}

/*---------- Notifications ----------*/
.notification-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  min-width: 16px;
  height: 16px;
  background: var(--color-error);
  color: white;
  border-radius: 8px;
  font-size: 10px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  box-shadow: 0 0 5px var(--color-error-a50, rgba(255, 85, 85, 0.5));
  z-index: var(--z-base); 
}
.notification-item {
  padding: var(--space-sm);
  background: var(--color-primary-a05);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-primary-a30);
  transition: all var(--transition-fast);
  cursor: pointer;
  margin-bottom: var(--space-xs);
}
.notification-item:hover {
  background: var(--color-primary-a15);
  transform: translateY(-2px);
}
.notification-item.new {
  border-left-color: var(--color-error, #ff5555);
  background: var(--color-error-a05, rgba(255, 85, 85, 0.05));
  animation: highlight-new 2s ease-out;
}

/*---------- Overlays ----------*/
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: var(--z-overlay);
  background-color: rgba(0, 0, 0, 0.75);
  display: flex;
  justify-content: center;
  align-items: center;
  transition: background-color var(--transition-slow);
}
.overlay-content {
    width: 90%;
    max-width: 900px;
    height: 80vh;
    background: var(--color-glass-bg-dark);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    overflow: hidden; 
    position: relative;
    box-shadow: var(--shadow-primary-lg);
    transition: opacity var(--transition-slow);
    display: flex; 
    flex-direction: column; 
}
.overlay-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0; 
}
.overlay-title {
  color: var(--color-primary);
  font-size: var(--font-size-xxl);
  margin: 0;
}
.overlay-body {
  padding: var(--space-lg);
  overflow-y: auto; 
  flex-grow: 1; 
}

/*---------- Custom Scrollbar (for panel content, etc.) ----------*/
.panel-content::-webkit-scrollbar,
.overlay-body::-webkit-scrollbar 
 {
  width: 8px;
  height: 8px;
}
.panel-content::-webkit-scrollbar-track,
.overlay-body::-webkit-scrollbar-track
 {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}
.panel-content::-webkit-scrollbar-thumb,
.overlay-body::-webkit-scrollbar-thumb
 {
  background: var(--color-primary-a30);
  border-radius: 4px;
}
.panel-content::-webkit-scrollbar-thumb:hover,
.overlay-body::-webkit-scrollbar-thumb:hover
 {
  background: var(--color-primary-a50);
}

/* Add Firefox scrollbar styles if needed */
.panel-content, .overlay-body {
  scrollbar-width: thin; 
  scrollbar-color: var(--color-primary-a30) rgba(0, 0, 0, 0.1); 
}
```

---
### `src\styles\layout.css`
```css
/* src/styles/layout.css */
@import "./variables.css";

/* Core App Layout */
.main-view {
  width: 100%;
  height: 100%;
  background: none; /* Background is on canvas-container now */
  position: relative;
  overflow: hidden;
  display: block;
}

/* Canvas Container Layout */
.canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  /* background, opacity, and transition for dimming are now in Mainview.css */
  z-index: var(--z-background);
}

/* Background Grid */
.grid-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: radial-gradient( circle, rgba(var(--color-primary-rgb), 0.1) 1px, transparent 1px );
  background-size: 20px 20px;
  pointer-events: none;
  opacity: 1;
  z-index: 0; /* Behind canvases, but within canvas-container */
}

/* Centered Logo */
.entity-logo {
  position: absolute;
  bottom: var(--space-lg);
  left: 50%;
  transform: translateX(-50%);
  max-width: 200px;
  z-index: var(--z-ui); /* Above canvas container */
  opacity: 1;
  transition: all var(--transition-slow) ease;
}
.entity-logo:hover {
  opacity: 1;
  transform: translateX(-50%) scale(1.1);
  filter: drop-shadow(0 0 10px var(--color-primary-a30));
}

/* Preview Mode Indicator */
.preview-mode-indicator {
  position: fixed;
  top: calc(var(--space-lg) + var(--icon-size-lg) + 10px);
  right: var(--space-lg);
  z-index: var(--z-controls);
  display: flex;
  align-items: center;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-md);
  background: var(--color-warning-a10);
  border: 1px solid var(--color-warning-a30);
  animation: fadeIn var(--transition-normal);
}
.preview-icon {
  font-size: 18px;
  margin-right: var(--space-xs);
}
.preview-text {
  color: var(--color-warning-a90);
  font-size: var(--font-size-md);
  font-weight: bold;
  margin-right: var(--space-xs);
}
.exit-preview-button {
  background: var(--color-warning-a30);
  border: none;
  color: var(--color-text);
  padding: var(--space-xxs) var(--space-xs);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.exit-preview-button:hover {
  background: var(--color-warning-a50, rgba(255, 165, 0, 0.5));
}

/* Main UI Container - for toolbars, panels etc. */
.ui-elements-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: var(--z-ui); /* Above canvas container */
  opacity: 1;
  visibility: visible;
  transition: opacity 0.5s ease-in-out, visibility 0s linear 0s;
}
.ui-elements-container.visible {
  opacity: 1;
  visibility: visible;
  transition-delay: 0s;
}
.ui-elements-container.visible > * {
  pointer-events: auto;
}
.ui-elements-container.hidden-by-opacity {
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.5s ease-in-out 0s, visibility 0s linear 0.5s;
  pointer-events: none !important;
}
.ui-elements-container.hidden-by-opacity > * {
  pointer-events: none !important;
}
.ui-elements-container.visible .panel-wrapper,
.ui-elements-container.visible .vertical-toolbar-icon,
.ui-elements-container.visible .bottom-right-icons,
.ui-elements-container.visible .preset-selector-bar {
  pointer-events: auto;
}


/* UI Controls Layout */
.bottom-center-controls {
  position: fixed;
  bottom: var(--space-md);
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-controls);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
}


/* Status Display (Loading/Error/Idle Messages) */
.status-display {
  position: fixed;
  top: 20%;
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-top);
  backdrop-filter: blur(var(--blur-amount, 3px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 3px));
  box-shadow: var(--shadow-md);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-weight: 500;
  text-align: center;
  min-width: 250px;
  transition: opacity 500ms ease-in-out;
  opacity: 1;
  pointer-events: none;
}
.status-display.info-state {
  background: rgba(var(--color-warning-rgb), 0.25);
  border: 1px solid var(--color-warning-a50, rgba(255, 165, 0, 0.5));
  color: var(--color-warning, #ffa500);
  box-shadow: 0 0 12px rgba(var(--color-warning-rgb), 0.4);
}
.status-display.error-state {
  background: rgba(var(--color-error-rgb), 0.25);
  border: 1px solid var(--color-error-a50, rgba(255, 85, 85, 0.5));
  color: var(--color-error, #ff5555);
  box-shadow: 0 0 12px rgba(var(--color-error-rgb), 0.4);
}
.status-display.fade-out {
  opacity: 0;
}
.status-display .retry-render-button {
  display: block;
  margin: var(--space-sm) auto 0;
  padding: var(--space-xs) var(--space-md);
  background: var(--color-error-a30);
  color: var(--color-text);
  border: 1px solid var(--color-error-a50, rgba(255, 85, 85, 0.5));
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
  pointer-events: auto;
  font-size: var(--font-size-sm);
  font-family: var(--font-family);
  font-weight: bold;
  text-transform: uppercase;
}
.status-display .retry-render-button:hover:not(:disabled) {
  background: var(--color-error-a50, rgba(255, 165, 0, 0.5));
}
.status-display .retry-render-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* --- START: NEW LOADING PILL STYLES --- */
.loading-indicator-pill {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: var(--z-top);
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-lg);
  background: var(--color-glass-bg-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: var(--shadow-primary-lg);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease-in-out, visibility 0s linear 0.3s;
  pointer-events: none;
}
.loading-indicator-pill.visible {
  opacity: 1;
  visibility: visible;
  transition: opacity 0.3s ease-in-out, visibility 0s linear 0s;
}
.loading-indicator-pill .loading-spinner {
  width: 20px;
  height: 20px;
  border: 3px solid var(--color-primary-a30);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.loading-indicator-pill .loading-message {
  color: var(--color-primary-a90);
  font-size: var(--font-size-md);
  font-weight: 500;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
/* --- END: NEW LOADING PILL STYLES --- */


/* FPS Counter */
.fps-counter {
  position: fixed;
  bottom: var(--space-sm, 12px);
  left: var(--space-sm, 12px);
  z-index: 10001;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(1px);
  -webkit-backdrop-filter: blur(1px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: none;
  color: var(--color-text-dim, rgba(255, 255, 255, 0.4));
  padding: var(--space-xxs) var(--space-xs);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-family: monospace;
  text-align: center;
  opacity: 0.7;
}

/* Custom Cursor */
#fullscreen-root.radar-cursor {
  cursor: url('/assets/cursors/radar-dot.svg') 8 8, auto;
}

/* Click Ping Effect */
.click-ping-svg-container {
  position: absolute;
  width: 20px;
  height: 20px;
  transform: translate(-50%, -50%);
  transform-origin: center center;
  opacity: 1;
  pointer-events: none;
  z-index: var(--z-effects, 10);
}
.click-ping-svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.click-ping-svg circle {
  stroke-opacity: 1;
  fill: none;
}
.ping-svg-animation .click-ping-svg circle {
  animation: ping-circle-anim 0.7s cubic-bezier(0.1, 0.7, 0.3, 1) forwards;
}
@keyframes ping-circle-anim {
  0% { r: 2; stroke-opacity: 1; transform: scale(0.5); }
  70% { r: 15; stroke-opacity: 0.7; transform: scale(1.2); }
  100% { r: 20; stroke-opacity: 0; transform: scale(1.5); }
}


/* Hidden Audio Analyzer Element */
.hidden-audio-analyzer {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

/* Maximize/Fullscreen Button */
.maximize-button {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  backdrop-filter: blur(4px);
  transition: all 0.3s ease;
}
.maximize-button:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Bottom Right Icons Container */
.bottom-right-icons {
  position: fixed;
  bottom: var(--space-lg);
  right: var(--space-lg);
  z-index: var(--z-controls);
  display: flex;
  flex-direction: column-reverse; /* Stack vertically, bottom-to-top */
  align-items: center; /* Center items horizontally in the stack */
  gap: var(--space-sm); /* Vertical spacing between icons */
  pointer-events: auto;
}

/* Sequencer/Randomizer Button Styles */
.bottom-right-icons .toolbar-icon.sequencer-toggle-button {
  order: -1;
  width: var(--icon-size-lg);
  height: var(--icon-size-lg);
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bottom-right-icons .toolbar-icon.sequencer-toggle-button .icon-image {
  width: var(--icon-size-md);
  height: var(--icon-size-md);
  object-fit: contain;
  color: var(--color-primary-a70);
  transition: color var(--transition-fast), filter var(--transition-fast);
}

.bottom-right-icons .toolbar-icon.sequencer-toggle-button:hover .icon-image {
  color: var(--color-primary);
}

.bottom-right-icons .toolbar-icon.sequencer-toggle-button.active {
  background: var(--color-primary-a30);
  border-color: var(--color-primary);
  box-shadow: var(--shadow-primary-md);
}

.bottom-right-icons .toolbar-icon.sequencer-toggle-button.active .icon-image {
  color: var(--color-primary);
  filter: drop-shadow(0 0 5px var(--color-primary));
}

/* Disabled state for all toolbar icons in bottom-right */
.bottom-right-icons .toolbar-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--color-button-secondary-a80);
  border-color: var(--color-primary-a50);
}

.bottom-right-icons .toolbar-icon:disabled:hover {
  transform: none;
  background: var(--color-button-secondary-a80);
  border-color: var(--color-primary-a50);
}

.bottom-right-icons .toolbar-icon:disabled .icon-image {
  color: var(--color-text-muted);
  filter: none;
}

/* General Connect Pill Style */
.general-connect-pill {
  position: fixed;
  bottom: calc(var(--space-md) + 36px + var(--space-sm));
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--color-warning-a10);
  color: var(--color-warning-a90);
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  border: 1px solid var(--color-warning-a30);
  z-index: var(--z-top);
  box-shadow: var(--shadow-md);
  text-align: center;
  max-width: 80%;
  animation: fadeIn var(--transition-normal);
}
```

---
### `src\styles\variables.css`
```css
/* src/styles/variables.css */
:root {
  --font-family-radar: "RadarFont", var(--font-family);

  --color-primary: #00f3ff;
  --color-primary-rgb: 0, 243, 255;
  --color-primary-a90: rgba(0, 243, 255, 0.9);
  --color-primary-a70: rgba(0, 243, 255, 0.7);
  --color-primary-a50: rgba(0, 243, 255, 0.5);
  --color-primary-a30: rgba(0, 243, 255, 0.3);
  --color-primary-a15: rgba(0, 243, 255, 0.15);
  --color-primary-a05: rgba(0, 243, 255, 0.05);

  --color-bg-dark: #050f19;
  --color-bg: #101018;
  --color-bg-light: #1a1a2e;

  --color-glass-bg: rgba(16, 16, 24, 0.8);
  --color-glass-bg-light: rgba(26, 26, 46, 0.8);
  --color-glass-bg-dark: rgba(5, 15, 25, 0.85);

  --color-success: #00ff00;
  --color-success-rgb: 0, 255, 0;
  --color-warning: #ffa500;
  --color-warning-rgb: 255, 165, 0;
  --color-error: #ff5555;
  --color-error-rgb: 255, 85, 85;

  --color-success-a90: rgba(0, 255, 0, 0.9);
  --color-success-a30: rgba(0, 255, 0, 0.3);
  --color-success-a10: rgba(0, 255, 0, 0.1);

  --color-warning-a90: rgba(255, 165, 0, 0.9);
  --color-warning-a30: rgba(255, 165, 0, 0.3);
  --color-warning-a10: rgba(255, 165, 0, 0.1);

  --color-error-a90: rgba(255, 85, 85, 0.9);
  --color-error-a30: rgba(255, 85, 85, 0.3);
  --color-error-a10: rgba(255, 85, 85, 0.1);

  --color-lyx: #ff9000;
  --color-lyx-a20: rgba(255, 144, 0, 0.2);
  --color-token: #00ff80;
  --color-token-a20: rgba(0, 255, 128, 0.2);
  --color-contract: #0080ff;
  --color-contract-a20: rgba(0, 128, 255, 0.2);

  /* --- ADDED/UPDATED DEFINITIONS FOR METER FILL COLORS --- */
  --color-accent: #FFD700; /* Gold - for Level meter */
  --color-bass: #FF5733;   /* Reddish-Orange - for Bass meter */
  --color-mid: #FFC300;    /* Yellow-Orange - for Mid meter */
  --color-treble: #33FFBD; /* Cyan-Green - for Treble meter */
  /* --- END ADDED/UPDATED DEFINITIONS --- */


  --color-text: rgba(255, 255, 255, 0.9);
  --color-text-muted: rgba(255, 255, 255, 0.6);
  --color-text-dim: rgba(255, 255, 255, 0.4);

  --color-border: rgba(0, 243, 255, 0.2);
  --color-border-light: rgba(0, 243, 255, 0.3);
  --color-border-dark: rgba(0, 243, 255, 0.1);

  --space-xxs: 4px;
  --space-xs: 8px;
  --space-sm: 12px;
  --space-md: 16px;
  --space-lg: 20px;
  --space-xl: 24px;
  --space-xxl: 32px;

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-circle: 50%;

  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 4px 10px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 5px 15px rgba(0, 0, 0, 0.3);

  --shadow-primary-sm: 0 0 5px rgba(0, 243, 255, 0.2);
  --shadow-primary-md: 0 0 10px rgba(0, 243, 255, 0.3);
  --shadow-primary-lg: 0 0 15px rgba(0, 243, 255, 0.3);

  --transition-fast: 0.2s ease;
  --transition-normal: 0.3s ease;
  --transition-slow: 0.5s ease;
  --transition-elastic: 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);

  --z-background: 1;
  --z-base: 10;
  --z-canvas: 100;
  --z-ui: 500;
  --z-controls: 1000;
  --z-overlay: 1500;
  --z-top: 2000;
  --z-tooltip: 2500;

  --icon-size-sm: 24px;
  --icon-size-md: 28px;
  --icon-size-lg: 35px;
  --panel-width: 400px;
  --control-panel-width: 400px;

  --blur-amount: 1px;

  --font-family: "Arial", sans-serif;
  --font-size-xs: 10px;
  --font-size-sm: 11px;
  --font-size-md: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 18px;
  --font-size-xxl: 24px;

  --header-height: 40px;
  --panel-left-position: 90px;
}
```

---
### `src\utils\CanvasManager.js`
```js
// src/utils/CanvasManager.js
import { BLEND_MODES } from '../config/global-config';
import ValueInterpolator from './ValueInterpolator';
import { sliderParams } from '../config/sliderParams';
import { getDecodedImage } from './imageDecoder';

const SETUP_CANVAS_POLL_INTERVAL = 100;
const SETUP_CANVAS_POLL_TIMEOUT = 3000;
const MAX_TOTAL_OFFSET = 10000;
const DELTA_TIME_BUFFER_SIZE = 5;

const MIDI_INTERPOLATION_DURATION = 300;
const MAX_DELTA_TIME = 1 / 30;

const lerp = (start, end, t) => {
    if (typeof start !== 'number' || typeof end !== 'number') return start;
    return start * (1 - t) + end * t;
};

class CanvasManager {
    canvasA = null;
    ctxA = null;
    canvasB = null;
    ctxB = null;
    layerId;
    imageA = null;
    configA;
    animationFrameId = null;
    lastTimestamp = 0;
    isDrawing = false;
    isDestroyed = false;
    lastImageSrc = null;
    lastValidWidth = 0;
    lastValidHeight = 0;
    lastDPR = 1;
    deltaTimeBuffer = [];
    smoothedDeltaTime = 1 / 60;

    interpolators = {};
    interpolatorsB = {};
    playbackValues = {};

    continuousRotationAngleA = 0;
    continuousRotationAngleB = 0;

    driftStateA = { x: 0, y: 0, phase: 0 };
    driftStateB = { x: 0, y: 0, phase: 0 };

    audioFrequencyFactor = 1.0;
    beatPulseFactor = 1.0;
    beatPulseEndTime = 0;

    imageB = null;
    configB = null;
    crossfadeValue = 0.0;

    parallaxOffset = { x: 0, y: 0 };
    renderedParallaxOffset = { x: 0, y: 0 };
    parallaxFactor = 1;
    internalParallaxFactor = 0;

    tokenA_id = null;
    tokenB_id = null;

    constructor(canvasA, canvasB, layerId) {
        if (!canvasA || !(canvasA instanceof HTMLCanvasElement) || !canvasB || !(canvasB instanceof HTMLCanvasElement)) {
            throw new Error(`[CM L${layerId}] Invalid canvas elements provided.`);
        }
        this.canvasA = canvasA;
        this.canvasB = canvasB;
        this.layerId = layerId;

        try {
            // --- START: FIX FOR PRE-MULTIPLIED ALPHA ---
            // Create the context with premultipliedAlpha set to true. This aligns the canvas
            // drawing with the browser's compositing engine, preventing opacity dips during CSS fades.
            const contextOptions = { alpha: true, willReadFrequently: false, premultipliedAlpha: true };
            this.ctxA = canvasA.getContext('2d', contextOptions);
            this.ctxB = canvasB.getContext('2d', contextOptions);
            // --- END: FIX FOR PRE-MULTIPLIED ALPHA ---

            if (!this.ctxA || !this.ctxB) throw new Error(`Failed to get 2D context for Layer ${layerId}`);
        } catch (e) {
            if (import.meta.env.DEV) console.error(`[CM L${layerId}] Error getting context:`, e);
            throw new Error(`Failed to get 2D context for Layer ${layerId}: ${e.message}`);
        }

        if (layerId === '1') { this.parallaxFactor = 10; this.internalParallaxFactor = 10; }
        if (layerId === '2') { this.parallaxFactor = 25; this.internalParallaxFactor = 20; }
        if (layerId === '3') { this.parallaxFactor = 50; this.internalParallaxFactor = 30; }

        this.configA = this.getDefaultConfig();
        this.configB = this.getDefaultConfig();
        this.lastDPR = 1;
        this.playbackValues = {};

        this.driftStateA = { x: 0, y: 0, phase: Math.random() * Math.PI * 2 };
        this.driftStateB = { x: 0, y: 0, phase: Math.random() * Math.PI * 2 };

        this.interpolators = {};
        this.interpolatorsB = {};
        sliderParams.forEach(param => {
            if (typeof (this.configA[param.prop]) === 'number') {
                const initialValue = this.configA[param.prop] ?? param.defaultValue ?? 0;
                this.interpolators[param.prop] = new ValueInterpolator(initialValue, MIDI_INTERPOLATION_DURATION);
                this.interpolatorsB[param.prop] = new ValueInterpolator(initialValue, MIDI_INTERPOLATION_DURATION);
            }
        });

        this.animationLoop = this.animationLoop.bind(this);
    }

    setParallaxOffset(x, y) {
        this.parallaxOffset.x = x;
        this.parallaxOffset.y = y;
    }

    async setCrossfadeTarget(imageSrc, config, tokenId) {
        if (this.isDestroyed) throw new Error("Manager destroyed");
        this.tokenB_id = tokenId || null;
        if (!imageSrc || typeof imageSrc !== 'string') {
            this.imageB = null; this.configB = config || this.getDefaultConfig();
            return;
        }
        try {
            const decodedBitmap = await getDecodedImage(imageSrc);
            if (this.isDestroyed) return;
            if (decodedBitmap.width === 0 || decodedBitmap.height === 0) {
                 this.imageB = null; this.configB = config || this.getDefaultConfig();
                 throw new Error(`Loaded crossfade image bitmap has zero dimensions: ${imageSrc.substring(0, 100)}`);
            }
            this.imageB = decodedBitmap;
            this.configB = config || this.getDefaultConfig();
            this.continuousRotationAngleB = 0;
            this.driftStateB = { x: 0, y: 0, phase: Math.random() * Math.PI * 2 };
            Object.keys(this.interpolatorsB).forEach(key => {
                const interpolator = this.interpolatorsB[key];
                const value = this.configB?.[key];
                if (interpolator && value !== undefined) interpolator.snap(value);
            });
        } catch (error) {
            if (this.isDestroyed) throw new Error("Manager destroyed during crossfade image load");
            this.imageB = null; this.configB = config || this.getDefaultConfig();
            throw error;
        }
    }

    setCrossfadeValue(value) {
        this.crossfadeValue = Math.max(0, Math.min(1, Number(value) || 0));
    }

    getDefaultConfig() {
        const defaultConfig = {};
        sliderParams.forEach(p => {
            defaultConfig[p.prop] = p.defaultValue ?? (p.min + p.max) / 2;
            if (p.prop === 'speed') defaultConfig[p.prop] = 0.01;
            if (p.prop === 'size') defaultConfig[p.prop] = 1.0;
        });
        defaultConfig.enabled = true;
        defaultConfig.blendMode = 'normal';
        defaultConfig.direction = 1;
        return defaultConfig;
    }

    applyPlaybackValue(key, value) {
        if (this.isDestroyed) return;
        this.playbackValues[key] = value;
    }

    clearPlaybackValues() {
        if (this.isDestroyed) return;
        this.playbackValues = {};
    }

    async setupCanvas() {
        const canvases = [this.canvasA, this.canvasB];
        for (const canvas of canvases) {
            if (!canvas || this.isDestroyed) continue;
            const parent = canvas.parentElement;
            if (!parent) continue;

            const dprForBuffer = 1;
            const parentRect = parent.getBoundingClientRect();
            let logicalWidth = Math.floor(parentRect.width);
            let logicalHeight = Math.floor(parentRect.height);

            if (logicalWidth <= 0 || logicalHeight <= 0) {
                await new Promise(resolve => setTimeout(resolve, 50)); // Wait a bit for layout
                const newRect = parent.getBoundingClientRect();
                logicalWidth = Math.floor(newRect.width);
                logicalHeight = Math.floor(newRect.height);
            }

            if (logicalWidth <= 0 || logicalHeight <= 0) {
                if (import.meta.env.DEV) console.error(`[CM L${this.layerId}] FAILED - Zero Dimensions for canvas.`);
                continue;
            }

            const targetRenderWidth = logicalWidth;
            const targetRenderHeight = logicalHeight;

            if (canvas.width !== targetRenderWidth || canvas.height !== targetRenderHeight) {
                canvas.width = targetRenderWidth;
                canvas.height = targetRenderHeight;
            }
            if (canvas.style.width !== `${logicalWidth}px` || canvas.style.height !== `${logicalHeight}px`) {
                canvas.style.width = `${logicalWidth}px`;
                canvas.style.height = `${logicalHeight}px`;
            }
            const ctx = canvas === this.canvasA ? this.ctxA : this.ctxB;
            if (ctx) ctx.setTransform(dprForBuffer, 0, 0, dprForBuffer, 0, 0);
        }
        this.lastValidWidth = this.canvasA.width;
        this.lastValidHeight = this.canvasA.height;
        return this.lastValidWidth > 0 && this.lastValidHeight > 0;
    }

    applyFullConfig(newConfig) {
        if (this.isDestroyed) return;
        const defaultConfig = this.getDefaultConfig();
        const mergedConfig = { ...defaultConfig, ...(newConfig || {}) };
        if (!BLEND_MODES.includes(mergedConfig.blendMode)) mergedConfig.blendMode = 'normal';
        this.configA = mergedConfig;
        this.continuousRotationAngleA = 0;
        this.driftStateA = newConfig?.driftState || { x: 0, y: 0, phase: Math.random() * Math.PI * 2 };
        Object.keys(this.interpolators).forEach(key => this.interpolators[key]?.snap(this.configA[key]));
        this.handleEnabledToggle(this.configA.enabled);
    }

    validateValue(key, value, defaultValue) {
        let validated = value;
        const defaultValueType = typeof defaultValue;
        if (defaultValueType === 'number') {
            validated = Number(value);
            if (isNaN(validated)) validated = defaultValue;
        } else if (defaultValueType === 'string') {
            validated = String(value);
            if (key === 'blendMode' && !BLEND_MODES.includes(validated)) validated = defaultValue;
        } else if (defaultValueType === 'boolean') {
            validated = Boolean(value);
        }
        return validated;
    }

    handleEnabledToggle(isEnabled) {
        if (isEnabled && !this.animationFrameId) this.startAnimationLoop();
        else if (!isEnabled && this.animationFrameId) {
            this.stopAnimationLoop();
            if (this.ctxA && this.canvasA) this.ctxA.clearRect(0, 0, this.canvasA.width, this.canvasA.height);
            if (this.ctxB && this.canvasB) this.ctxB.clearRect(0, 0, this.canvasB.width, this.canvasB.height);
        }
    }

    updateConfigProperty(key, value) {
        if (this.isDestroyed) return;
        const defaultConfig = this.getDefaultConfig();
        if (!Object.prototype.hasOwnProperty.call(defaultConfig, key)) return;
        const validatedValue = this.validateValue(key, value, defaultConfig[key]);
        this.configA[key] = validatedValue;
        if (this.interpolators[key]) this.interpolators[key].snap(validatedValue);
        if (key === 'enabled') this.handleEnabledToggle(validatedValue);
    }

    updateConfigBProperty(key, value) {
        if (this.isDestroyed || !this.configB) return;
        const defaultConfig = this.getDefaultConfig();
        if (!Object.prototype.hasOwnProperty.call(defaultConfig, key)) return;
        const validatedValue = this.validateValue(key, value, defaultConfig[key]);
        this.configB[key] = validatedValue;
        if (this.interpolatorsB[key]) this.interpolatorsB[key].snap(validatedValue);
    }

    setTargetValue(param, targetValue) {
        if (this.isDestroyed) return;
        const validatedValue = this.validateValue(param, targetValue, this.configA[param]);
        this.configA[param] = validatedValue;
        if (this.interpolators[param]) this.interpolators[param].setTarget(validatedValue);
    }

    setTargetValueB(param, targetValue) {
        if (this.isDestroyed || !this.configB) return;
        const validatedValue = this.validateValue(param, targetValue, this.configB[param]);
        this.configB[param] = validatedValue;
        if (this.interpolatorsB[param]) this.interpolatorsB[param].setTarget(validatedValue);
    }

    startAnimationLoop() {
        if (this.isDestroyed || this.animationFrameId !== null) return;
        this.lastTimestamp = performance.now();
        this.deltaTimeBuffer = [];
        this.smoothedDeltaTime = 1 / 60;
        this.animationFrameId = requestAnimationFrame(this.animationLoop);
    }

    stopAnimationLoop() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.isDrawing = false;
    }

    async setImage(src, tokenId) {
        if (this.isDestroyed) return Promise.reject(new Error("Manager destroyed"));
        this.tokenA_id = tokenId || null;
        if (!src || typeof src !== 'string') {
            this.imageA = null; this.lastImageSrc = null;
            return Promise.resolve();
        }
        if (src === this.lastImageSrc && this.imageA) return Promise.resolve();
        try {
            const decodedBitmap = await getDecodedImage(src);
            if (this.isDestroyed) return;
            if (decodedBitmap.width === 0 || decodedBitmap.height === 0) {
                this.imageA = null; this.lastImageSrc = null;
                throw new Error(`Loaded image bitmap has zero dimensions: ${src.substring(0, 100)}`);
            }
            this.imageA = decodedBitmap;
            this.lastImageSrc = src;
        } catch (error) {
            if (this.isDestroyed) return;
            this.imageA = null; this.lastImageSrc = null;
            console.error(`[CM L${this.layerId}] setImage failed:`, error.message);
            throw error;
        }
    }

    setAudioFrequencyFactor(factor) { if (this.isDestroyed) return; this.audioFrequencyFactor = Number(factor) || 1.0; }
    triggerBeatPulse(pulseFactor, duration) { if (this.isDestroyed) return; this.beatPulseFactor = Number(pulseFactor) || 1.0; this.beatPulseEndTime = performance.now() + (Number(duration) || 0); }
    resetAudioModifications() { if (this.isDestroyed) return; this.audioFrequencyFactor = 1.0; this.beatPulseFactor = 1.0; this.beatPulseEndTime = 0; }
    getConfigData() { return JSON.parse(JSON.stringify(this.configA)); }

    _drawFrame(ctx, image, frameConfig, continuousRotationAngle, driftState) {
        if (!ctx || !image || !frameConfig) return;
        const { width, height } = ctx.canvas;
        const halfWidth = Math.floor(width / 2); const halfHeight = Math.floor(height / 2);
        const remainingWidth = width - halfWidth; const remainingHeight = height - halfHeight;
        const { size, xaxis, yaxis, angle } = frameConfig;
        const { width: imgNaturalWidth, height: imgNaturalHeight } = image;
        const imgAspectRatio = (imgNaturalWidth > 0 && imgNaturalHeight > 0) ? imgNaturalWidth / imgNaturalHeight : 1;
        let finalDrawSize = size * this.audioFrequencyFactor;
        if (this.beatPulseEndTime && performance.now() < this.beatPulseEndTime) finalDrawSize *= this.beatPulseFactor;
        else if (this.beatPulseEndTime) { this.beatPulseFactor = 1.0; this.beatPulseEndTime = 0; }
        finalDrawSize = Math.max(0.01, finalDrawSize);
        let imgDrawWidth = halfWidth * finalDrawSize;
        let imgDrawHeight = imgDrawWidth / imgAspectRatio;
        if (imgAspectRatio > 0 && imgDrawHeight > halfHeight * finalDrawSize) {
            imgDrawHeight = halfHeight * finalDrawSize; imgDrawWidth = imgDrawHeight * imgAspectRatio;
        }
        imgDrawWidth = Math.max(1, Math.floor(imgDrawWidth));
        imgDrawHeight = Math.max(1, Math.floor(imgDrawHeight));
        const driftX = driftState?.x ?? 0; const driftY = driftState?.y ?? 0;
        const internalParallaxX = this.renderedParallaxOffset.x * this.internalParallaxFactor;
        const internalParallaxY = this.renderedParallaxOffset.y * this.internalParallaxFactor;
        const offsetX = xaxis / 10; const offsetY = yaxis / 10;
        const finalCenterX_TL = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, halfWidth / 2 + offsetX + driftX + internalParallaxX));
        const finalCenterY_TL = Math.max(-MAX_TOTAL_OFFSET, Math.min(MAX_TOTAL_OFFSET, halfHeight / 2 + offsetY + internalParallaxY));
        const finalAngle = angle + continuousRotationAngle;
        const angleRad = (finalAngle % 360) * Math.PI / 180;
        const drawImageWithRotation = () => {
            ctx.save();
            ctx.rotate(angleRad);
            ctx.drawImage(image, 0, 0, imgNaturalWidth, imgNaturalHeight, -imgDrawWidth / 2, -imgDrawHeight / 2, imgDrawWidth, imgDrawHeight);
            ctx.restore();
        };
        ctx.save(); ctx.beginPath(); ctx.rect(0,0,halfWidth,halfHeight); ctx.clip();
        ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(halfWidth,0,remainingWidth,halfHeight); ctx.clip();
        ctx.translate(width,0); ctx.scale(-1,1);
        ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(0,halfHeight,halfWidth,remainingHeight); ctx.clip();
        ctx.translate(0,height); ctx.scale(1,-1);
        ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(halfWidth,halfHeight,remainingWidth,remainingHeight); ctx.clip();
        ctx.translate(width,height); ctx.scale(-1,-1);
        ctx.translate(finalCenterX_TL, finalCenterY_TL); drawImageWithRotation(); ctx.restore();
    }

    draw() {
        if (this.isDestroyed || this.isDrawing || !this.canvasA || !this.ctxA || !this.canvasB || !this.ctxB || this.lastValidWidth <= 0) {
            this.isDrawing = false;
            return false;
        }
        this.isDrawing = true;
        try {
            this.ctxA.clearRect(0, 0, this.canvasA.width, this.canvasA.height);
            this.ctxB.clearRect(0, 0, this.canvasB.width, this.canvasB.height);
            const t = this.crossfadeValue;
            const liveConfigA = { ...this.configA };
            const liveConfigB = { ...this.configB };
            for (const key in this.interpolators) liveConfigA[key] = this.playbackValues[key] ?? this.interpolators[key].getCurrentValue();
            if (liveConfigB) for (const key in this.interpolatorsB) liveConfigB[key] = this.interpolatorsB[key].getCurrentValue();
            
            const morphedConfig = { ...liveConfigA };
            const morphedDrift = { ...this.driftStateA };
            let morphedAngle = this.continuousRotationAngleA;

            if (liveConfigA && liveConfigB) {
                for (const key in liveConfigA) {
                    if (typeof liveConfigA[key] === 'number' && typeof liveConfigB[key] === 'number') {
                        morphedConfig[key] = lerp(liveConfigA[key], liveConfigB[key], t);
                    }
                }
                morphedDrift.x = lerp(this.driftStateA.x, this.driftStateB.x, t);
                morphedDrift.y = lerp(this.driftStateA.y, this.driftStateB.y, t);
                let angleA = this.continuousRotationAngleA;
                let angleB = this.continuousRotationAngleB;
                if (angleB - angleA > 180) angleA += 360;
                else if (angleB - angleA < -180) angleA -= 360;
                morphedAngle = lerp(angleA, angleB, t);
            }

            if (this.imageA && liveConfigA?.enabled) {
                this._drawFrame(this.ctxA, this.imageA, morphedConfig, morphedAngle, morphedDrift);
            }
            if (this.imageB && liveConfigB?.enabled) {
                this._drawFrame(this.ctxB, this.imageB, morphedConfig, morphedAngle, morphedDrift);
            }

        } catch (e) {
            if (import.meta.env.DEV) console.error(`[CM L${this.layerId}] draw: Unexpected draw error:`, e);
        } finally {
            this.isDrawing = false;
        }
        return true;
    }

    _updateInternalDrift(config, driftState, deltaTime) {
        if (!config || !driftState) return;
        const driftAmount = config.drift;
        const driftSpeed = config.driftSpeed;
        if(driftAmount > 0){
            if(typeof driftState.phase !== "number" || isNaN(driftState.phase)) driftState.phase = Math.random() * Math.PI * 2;
            driftState.phase += deltaTime * driftSpeed * 1.0;
            const calculatedX = Math.sin(driftState.phase) * driftAmount * 1.5;
            const calculatedY = Math.cos(driftState.phase * 0.7 + Math.PI / 4) * driftAmount * 1.5;
            driftState.x = Math.max(-MAX_TOTAL_OFFSET / 2, Math.min(MAX_TOTAL_OFFSET / 2, calculatedX));
            driftState.y = Math.max(-MAX_TOTAL_OFFSET / 2, Math.min(MAX_TOTAL_OFFSET / 2, calculatedY));
        } else {
            const LERP_FACTOR = 0.05;
            driftState.x = lerp(driftState.x, 0, LERP_FACTOR);
            driftState.y = lerp(driftState.y, 0, LERP_FACTOR);
            if (Math.abs(driftState.x) < 0.01) driftState.x = 0;
            if (Math.abs(driftState.y) < 0.01) driftState.y = 0;
        }
    }

    animationLoop(timestamp) {
        if (this.isDestroyed || this.animationFrameId === null) return;
        this.animationFrameId = requestAnimationFrame(this.animationLoop);
        if (!this.lastTimestamp) this.lastTimestamp = timestamp;
        const elapsed = timestamp - this.lastTimestamp;
        this.lastTimestamp = timestamp;
        const rawDeltaTime = Math.min(elapsed / 1000.0, MAX_DELTA_TIME);
        this.deltaTimeBuffer.push(rawDeltaTime);
        if (this.deltaTimeBuffer.length > DELTA_TIME_BUFFER_SIZE) this.deltaTimeBuffer.shift();
        this.smoothedDeltaTime = this.deltaTimeBuffer.reduce((a,b) => a+b,0) / this.deltaTimeBuffer.length;
        if (this.lastValidWidth <= 0 || this.lastValidHeight <= 0) {
            this.setupCanvas().then(setupOk => { if (setupOk) this.draw(); });
            return;
        }
        const now = performance.now();
        for (const key in this.interpolators) this.interpolators[key].update(now);
        for (const key in this.interpolatorsB) this.interpolatorsB[key].update(now);
        const parallaxLerpFactor = 0.05;
        this.renderedParallaxOffset.x = lerp(this.renderedParallaxOffset.x, this.parallaxOffset.x, parallaxLerpFactor);
        this.renderedParallaxOffset.y = lerp(this.renderedParallaxOffset.y, this.parallaxOffset.y, parallaxLerpFactor);
        const parallaxX = this.renderedParallaxOffset.x * this.parallaxFactor;
        const parallaxY = this.renderedParallaxOffset.y * this.parallaxFactor;
        const transformStyle = `translate(${parallaxX}px, ${parallaxY}px) scale(1)`;
        if (this.canvasA) this.canvasA.style.transform = transformStyle;
        if (this.canvasB) this.canvasB.style.transform = transformStyle;
        if (this.configA) {
            const speedA = this.playbackValues.speed ?? this.interpolators.speed.getCurrentValue();
            const directionA = this.configA.direction ?? 1;
            this.continuousRotationAngleA = (this.continuousRotationAngleA + (speedA * directionA * this.smoothedDeltaTime * 600)) % 360;
            this._updateInternalDrift(this.configA, this.driftStateA, this.smoothedDeltaTime);
        }
        if (this.configB) {
            const speedB = this.interpolatorsB.speed.getCurrentValue();
            const directionB = this.configB.direction ?? 1;
            this.continuousRotationAngleB = (this.continuousRotationAngleB + (speedB * directionB * this.smoothedDeltaTime * 600)) % 360;
            this._updateInternalDrift(this.configB, this.driftStateB, this.smoothedDeltaTime);
        }
        this.draw();
    }

    destroy() {
        this.isDestroyed = true;
        this.stopAnimationLoop();
        this.imageA?.close();
        this.imageB?.close();
        this.imageA = null; this.imageB = null;
        this.ctxA = null; this.ctxB = null;
        this.canvasA = null; this.canvasB = null;
        if (import.meta.env.DEV) console.log(`[CM L${this.layerId}] Destroyed.`);
    }
}
export default CanvasManager;
```

---
### `src\utils\debounce.js`
```js
// src/utils/debounce.js

/**
 * Creates a debounced function that delays invoking the provided function (`func`)
 * until `wait` milliseconds have elapsed since the last time the debounced function
 * was invoked. Useful for limiting the rate at which a function fires, e.g.,
 * on window resize or input events. The debounced function is invoked with the
 * arguments and `this` context of the last call.
 *
 * @param {Function} func The function to debounce.
 * @param {number} wait The number of milliseconds to delay execution.
 * @returns {(...args: any[]) => void} The new debounced function.
 */
function debounce(func, wait) {
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timeout = null;

  /**
   * The debounced version of the input function.
   * @param  {...any} args Arguments to pass to the original function.
   */
  return function executedFunction(...args) {
    // `this` context will be preserved from where `executedFunction` is called.
    const context = this;

    const later = () => {
      timeout = null; // Indicate debounce ended, allowing next call to set a new timeout
      func.apply(context, args); // Execute original function with preserved context and arguments
    };

    if (timeout !== null) {
      clearTimeout(timeout); // Clear previous timer if one was set
    }
    timeout = setTimeout(later, wait); // Set new timer
  };
}

export default debounce;
```

---
### `src\utils\erc725.js`
```js
// src/utils/erc725.js
import { getAddress, hexToString, decodeAbiParameters, parseAbiParameters } from 'viem';
import { ERC725YDataKeys } from '@lukso/lsp-smart-contracts';
import { Buffer } from 'buffer';

// Ensure Buffer is polyfilled in environments where it's not globally available (like browsers)
// This is often handled by build tools (like Vite/Webpack) based on configuration.
if (typeof window !== 'undefined' && typeof window.Buffer === 'undefined') {
  window.Buffer = Buffer;
}

const IPFS_GATEWAY = import.meta.env.VITE_IPFS_GATEWAY || 'https://api.universalprofile.cloud/ipfs/';

/**
 * @typedef {object} DecodedDataItem
 * @property {string} keyName - The original key name from the input.
 * @property {string} value - The original hex value from the input.
 */

/**
 * Decodes ERC725Y data items based on a schema hint.
 * Currently supports decoding the RadarWhitelist address array (both ABI-encoded and legacy JSON format).
 * Falls back to returning raw data items (keyName, value) for unknown schema hints or if decoding fails.
 *
 * @param {Array<{keyName: string, value: string}>} dataItems - Array of data items fetched from ERC725Y storage. Expected to contain the relevant key for the schemaHint.
 * @param {string} schemaHint - A hint indicating the expected schema (e.g., 'SupportedStandards:RadarWhitelist').
 * @returns {Array<string> | Array<DecodedDataItem>} Decoded data (e.g., array of addresses for RadarWhitelist) or the original items if decoding fails or hint is unknown. Returns an empty array if input is invalid or decoding yields no results.
 */
export function decodeData(dataItems, schemaHint) {
    if (!dataItems || !Array.isArray(dataItems) || dataItems.length === 0) return [];

    try {
        if (schemaHint === 'SupportedStandards:RadarWhitelist' && dataItems[0]?.value) {
            const rawData = dataItems[0].value;
            if (rawData && rawData !== '0x') {
                try {
                    // Try ABI decoding first (assuming address[])
                    const types = parseAbiParameters('address[]');
                    const decoded = decodeAbiParameters(types, /** @type {`0x${string}`} */ (rawData)); // Cast to satisfy viem
                    return decoded[0] || []; // Return the decoded array or empty if null/undefined
                } catch (abiError) {
                    if (import.meta.env.DEV) {
                        console.warn(`[decodeData] Failed ABI decode for ${schemaHint}. Trying JSON decode...`, abiError);
                    }
                    try {
                        // Fallback to JSON decoding for legacy format
                        const jsonString = hexToString(/** @type {`0x${string}`} */ (rawData)); // Cast to satisfy viem
                        const parsed = JSON.parse(jsonString);
                        if (Array.isArray(parsed)) {
                            // Assuming legacy format was [{address: '0x...'}, ...] or string array
                            return parsed.map(item => typeof item === 'string' ? item : item?.address).filter(Boolean);
                        } else {
                             if (import.meta.env.DEV) {
                                 console.warn(`[decodeData] Decoded JSON is not an array for ${schemaHint}.`);
                             }
                             return [];
                        }
                    } catch (jsonError) {
                        if (import.meta.env.DEV) {
                            console.error(`[decodeData] Failed both ABI and JSON decoding for ${schemaHint}:`, jsonError, 'Data:', rawData);
                        }
                        return []; // Return empty array on double failure
                    }
                }
            } else {
                return []; // Return empty array if rawData is empty or '0x'
            }
        }
        // If no specific logic for the schemaHint, return the raw items
        if (import.meta.env.DEV) {
            console.warn(`[decodeData] No specific decoding logic for schemaHint: ${schemaHint}. Returning raw items.`);
        }
        return dataItems.map(item => ({ keyName: item.keyName, value: item.value }));
    } catch (error) {
        if (import.meta.env.DEV) {
            console.error(`[decodeData] Error decoding data for schema ${schemaHint}:`, error, 'Data:', dataItems);
        }
        return []; // Return empty array on general error
    }
}

/**
 * @typedef {object} ParsedDataUri
 * @property {string} mimeType - The MIME type of the data.
 * @property {boolean} isBase64 - True if the data is base64 encoded.
 * @property {string} data - The actual data payload.
 */

/**
 * Parses a Data URI string into its components: mime type, base64 encoding status, and data payload.
 * Follows the standard Data URI format (RFC 2397).
 *
 * @param {string} uri - The Data URI string (e.g., "data:application/json;base64,eyJ...").
 * @returns {ParsedDataUri} An object containing the parsed components.
 * @throws {Error} If the input string is not a valid Data URI format.
 */
function parseDataUri(uri) {
    if (typeof uri !== 'string' || !uri.startsWith('data:')) {
        throw new Error('Invalid Data URI: input is not a string or does not start with "data:"');
    }
    const commaIndex = uri.indexOf(',');
    if (commaIndex === -1) {
        throw new Error('Invalid Data URI: missing comma separator');
    }
    // Extract the part between "data:" and ","
    const metaPart = uri.substring(5, commaIndex).trim();
    // Extract the part after ","
    const dataPart = uri.substring(commaIndex + 1);

    const metaParts = metaPart.split(';');
    // The first part is the mime type, default if empty
    const mimeType = metaParts[0] || 'text/plain;charset=US-ASCII';
    // Check if "base64" is present in the other parts
    const isBase64 = metaParts.slice(1).includes('base64');

    return { mimeType, isBase64, data: dataPart };
}


/**
 * Fetches and resolves LSP4 Metadata for a given asset contract address.
 * Handles VerifiableURI decoding (including Data URIs and plain URLs), IPFS URL resolution via a gateway,
 * and extracts the primary metadata object. Uses the provided ConfigurationService
 * instance for blockchain reads. It attempts to handle both standard VerifiableURI format
 * and direct URL storage in the LSP4Metadata key.
 *
 * @async
 * @param {import('../services/ConfigurationService').default} configService - An initialized instance of ConfigurationService.
 * @param {string} contractAddress - The address of the LSP7/LSP8 asset.
 * @returns {Promise<object | null>} - The parsed LSP4Metadata object (potentially wrapped in an {LSP4Metadata: ...} object if fetched directly) or null if not found or an error occurred.
 */
export async function resolveLsp4Metadata(configService, contractAddress) {
    let checksummedAddress;
    try {
        checksummedAddress = getAddress(contractAddress);
    } catch (e) {
        if (import.meta.env.DEV) {
            console.error(`[resolveLsp4Metadata Addr:${contractAddress}] Invalid address format. Error: ${e.message}`);
        }
        return null;
    }
    const logPrefix = `[resolveLsp4Metadata Addr:${checksummedAddress.slice(0, 6)}]`;

    if (!configService || typeof configService.loadDataFromKey !== 'function') {
        if (import.meta.env.DEV) {
            console.error(`${logPrefix} Invalid or missing configService.`);
        }
        return null;
    }

    try {
        const lsp4Key = ERC725YDataKeys.LSP4.LSP4Metadata;
        const rawValue = await configService.loadDataFromKey(checksummedAddress, lsp4Key);

        if (!rawValue || rawValue === '0x') {
            return null; // No metadata key set or empty
        }

        let potentialUrl = null;
        let extractedJsonDirectly = null;
        const VERIFIABLE_URI_PREFIX = "0x0000";
        const HASH_FUNCTION_ID_LENGTH_BYTES = 4;
        const HASH_LENGTH_BYTES_LENGTH = 2;

        // const DATA_URI_HEX_PREFIX_RAW = Buffer.from('data:').toString('hex'); // Not used in this revised logic

        if (rawValue.startsWith(VERIFIABLE_URI_PREFIX)) {
            const valueWithoutPrefix = rawValue.substring(VERIFIABLE_URI_PREFIX.length);
            // const hashFunctionIdHex = `0x${valueWithoutPrefix.substring(0, HASH_FUNCTION_ID_LENGTH_BYTES * 2)}`; // This was unused
            const hashLengthHex = `0x${valueWithoutPrefix.substring(HASH_FUNCTION_ID_LENGTH_BYTES * 2, (HASH_FUNCTION_ID_LENGTH_BYTES + HASH_LENGTH_BYTES_LENGTH) * 2)}`;
            const hashLength = parseInt(hashLengthHex, 16);

            if (!isNaN(hashLength)) {
                const hashStart = (HASH_FUNCTION_ID_LENGTH_BYTES + HASH_LENGTH_BYTES_LENGTH) * 2;
                const hashEnd = hashStart + hashLength * 2;
                const urlBytesHex = `0x${valueWithoutPrefix.substring(hashEnd)}`;

                try {
                    potentialUrl = hexToString(/** @type {`0x${string}`} */ (urlBytesHex));
                } catch (e) {
                    if (import.meta.env.DEV) {
                        console.warn(`${logPrefix} Failed to decode URL part of VerifiableURI: ${e.message}. Raw URL bytes: ${urlBytesHex}`);
                    }
                }
            } else if (import.meta.env.DEV) {
                console.warn(`${logPrefix} Invalid hash length in VerifiableURI.`);
            }
        } else {
            try {
                const decodedEntireValue = hexToString(/** @type {`0x${string}`} */ (rawValue));
                if (decodedEntireValue.startsWith('ipfs://') || decodedEntireValue.startsWith('http')) {
                    potentialUrl = decodedEntireValue;
                } else if (decodedEntireValue.startsWith('data:')) {
                    try {
                        const { mimeType, isBase64, data } = parseDataUri(decodedEntireValue);
                        if (mimeType.includes('json')) {
                            const jsonDataString = isBase64 ? Buffer.from(data, 'base64').toString('utf8') : decodeURIComponent(data);
                            extractedJsonDirectly = JSON.parse(jsonDataString);
                        } else if (import.meta.env.DEV) {
                            console.warn(`${logPrefix} Data URI has non-JSON mime type: ${mimeType}. Ignoring content.`);
                        }
                    } catch (e) {
                        if (import.meta.env.DEV) {
                            console.error(`${logPrefix} Failed to decode/parse Data URI content from direct value: ${e.message}`);
                        }
                    }
                } else if (import.meta.env.DEV) {
                    console.warn(`${logPrefix} Direct decode of raw value is not a standard URL or Data URI.`);
                }
            } catch (e) {
                if (import.meta.env.DEV) {
                    console.warn(`${logPrefix} Could not decode entire raw value as string. Raw: ${rawValue.substring(0, 50)}... Error: ${e.message}`);
                }
            }
        }


        if (extractedJsonDirectly) {
            if (extractedJsonDirectly.LSP4Metadata) {
                 return extractedJsonDirectly;
            } else if (extractedJsonDirectly.name || extractedJsonDirectly.icon || extractedJsonDirectly.images || extractedJsonDirectly.assets) {
                 if (import.meta.env.DEV) {
                     console.warn(`${logPrefix} JSON from Data URI lacks 'LSP4Metadata' key, wrapping content.`);
                 }
                 return { LSP4Metadata: extractedJsonDirectly };
            } else {
                 if (import.meta.env.DEV) {
                     console.error(`${logPrefix} JSON from Data URI has unexpected structure.`, extractedJsonDirectly);
                 }
                 return null;
            }
        }

        if (potentialUrl) {
            let fetchUrl = potentialUrl;
            if (fetchUrl.startsWith('ipfs://')) {
                fetchUrl = `${IPFS_GATEWAY.endsWith('/') ? IPFS_GATEWAY : IPFS_GATEWAY + '/'}${fetchUrl.substring(7)}`;
            }

            if (!fetchUrl.startsWith('http')) {
                if (import.meta.env.DEV) {
                    console.error(`${logPrefix} Invalid fetch URL derived: ${fetchUrl}`);
                }
                return null;
            }

            try {
                const response = await fetch(fetchUrl);
                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'Could not read error response body');
                    throw new Error(`HTTP error! status: ${response.status} for ${fetchUrl}. Body: ${errorText.substring(0, 200)}`);
                }
                const rawResponseText = await response.text();
                let metadata;
                try {
                    metadata = JSON.parse(rawResponseText);
                } catch (parseError) {
                    if (import.meta.env.DEV) {
                        console.error(`${logPrefix} Failed to parse JSON response from ${fetchUrl}. Error: ${parseError.message}. Response text (truncated): ${rawResponseText.substring(0, 200)}...`);
                    }
                    throw new Error(`JSON Parse Error: ${parseError.message}`);
                }

                if (metadata && metadata.LSP4Metadata) {
                    return metadata;
                } else if (metadata && (metadata.name || metadata.icon || metadata.images || metadata.assets)) {
                    if (import.meta.env.DEV) {
                        console.warn(`${logPrefix} Fetched JSON lacks 'LSP4Metadata' key, wrapping content.`);
                    }
                    return { LSP4Metadata: metadata };
                } else {
                    if (import.meta.env.DEV) {
                        console.warn(`${logPrefix} Fetched JSON from URL has unexpected structure.`, metadata);
                    }
                    return null;
                }
            } catch (fetchError) {
                if (import.meta.env.DEV) {
                    console.error(`${logPrefix} Failed to fetch or parse LSP4 JSON from ${fetchUrl}:`, fetchError.message);
                }
                return null;
            }
        }

        if (import.meta.env.DEV) {
            console.warn(`${logPrefix} Could not extract a valid JSON URL or parse JSON directly from LSP4Metadata value.`);
        }
        return null;

    } catch (error) {
        if (import.meta.env.DEV) {
            console.error(`${logPrefix} General error resolving LSP4 Metadata:`, error);
        }
        return null;
    }
}
```

---
### `src\utils\globalAnimationFlags.js`
```js
// src/utils/globalAnimationFlags.js

/**
 * @file Holds global flags that can be imperatively set to influence animation decisions.
 * Use with extreme caution and only for critical and very hard-to-solve race conditions
 * that are caused, in this case, by an initial image loading burst or similar complex UI interactions
 * where declarative state flow is insufficient or overly complex to manage.
 *
 * These flags are intended as a last resort. Prefer managing animation states through
 * React's declarative state and props model whenever possible.
 */

/**
 * @typedef {object} GlobalAnimationFlags
 * @property {boolean} isTokenSelectorOpening - Set to `true` when the token selector UI component
 * is in the process of opening or is open. This can be used by animation managers
 * (e.g., `useAnimationLifecycleManager`) to ensure animations continue or restart
 * if they were paused due to other conditions (like visibility changes) that might
 * incorrectly stop animations needed for the token selector's presentation.
 * Should be reset to `false` when the token selector is closed or its opening animation completes.
 */

/**
 * Global animation flags.
 * @type {GlobalAnimationFlags}
 */
export const globalAnimationFlags = {
  isTokenSelectorOpening: false,
};
```

---
### `src\utils\helpers.js`
```js
// src/utils/helpers.js

/**
 * Scales a normalized value (expected to be between 0 and 1) to a specified
 * minimum and maximum range using linear interpolation.
 * Handles potential non-numeric inputs gracefully by attempting to convert them
 * to numbers and returning the minimum of the range if any input is invalid.
 * The normalized input value is clamped to the [0, 1] range before scaling.
 *
 * @param {number|string} normalizedValue - The input value, ideally between 0 and 1.
 * @param {number|string} min - The minimum value of the target range.
 * @param {number|string} max - The maximum value of the target range.
 * @returns {number} The scaled value, clamped to be within the [min, max] range.
 *                   Returns `min` (or 0 if `min` is also NaN) if any input is non-numeric.
 */
export const scaleNormalizedValue = (normalizedValue, min, max) => {
  const norm = Number(normalizedValue);
  const minimum = Number(min);
  const maximum = Number(max);

  // Check for invalid inputs
  if (isNaN(norm) || isNaN(minimum) || isNaN(maximum)) {
    if (import.meta.env.DEV) {
      console.warn(`[scaleNormalizedValue] Invalid input: normalizedValue=${normalizedValue}, min=${min}, max=${max}. Returning minimum.`);
    }
    // Return the numerical minimum if valid, otherwise 0 as a fallback.
    return isNaN(minimum) ? 0 : minimum;
  }

  // Clamp the normalized value to the 0-1 range to ensure correct scaling
  const clampedNorm = Math.max(0, Math.min(1, norm));

  // Perform the linear interpolation: result = min + (normalized_clamped * (max - min))
  const scaledValue = minimum + clampedNorm * (maximum - minimum);

  // Ensure the final result is also clamped within the min/max of the target range,
  // especially if min > max was provided (though logically incorrect, this handles it).
  if (minimum <= maximum) {
    return Math.max(minimum, Math.min(maximum, scaledValue));
  } else {
    // If min > max, the range is inverted. Clamp accordingly.
    return Math.max(maximum, Math.min(minimum, scaledValue));
  }
};

/**
 * Performs linear interpolation between two values.
 *
 * @param {number} a - The starting value (when t=0).
 * @param {number} b - The ending value (when t=1).
 * @param {number} t - The interpolation factor, clamped between 0 and 1.
 * @returns {number} The interpolated value.
 */
export const lerp = (a, b, t) => {
  return a * (1 - t) + b * t;
};
```

---
### `src\utils\helpers.test.js`
```js
// src/utils/helpers.test.js
import { describe, it, expect } from 'vitest';
import { scaleNormalizedValue } from './helpers';

describe('scaleNormalizedValue', () => {
  it('should correctly scale a value within the 0-1 range', () => {
    // Arrange
    const normalizedValue = 0.5;
    const min = 10;
    const max = 20;
    const expected = 15;

    // Act
    const result = scaleNormalizedValue(normalizedValue, min, max);

    // Assert
    expect(result).toBe(expected);
  });

  it('should clamp to min if normalizedValue is less than 0', () => {
    expect(scaleNormalizedValue(-0.5, 10, 20)).toBe(10);
  });

  it('should clamp to max if normalizedValue is greater than 1', () => {
    expect(scaleNormalizedValue(1.5, 10, 20)).toBe(20);
  });

  it('should handle min and max being the same', () => {
    expect(scaleNormalizedValue(0.5, 10, 10)).toBe(10);
  });

  it('should handle string inputs that are valid numbers', () => {
    expect(scaleNormalizedValue('0.25', '0', '100')).toBe(25);
  });

  it('should return min if inputs are NaN', () => {
    expect(scaleNormalizedValue('abc', 10, 20)).toBe(10);
    expect(scaleNormalizedValue(0.5, 'xyz', 20)).toBe(0); // min is NaN, defaults to 0
    expect(scaleNormalizedValue(0.5, 10, 'pqr')).toBe(10); // max is NaN, but min is valid
  });

  it('should handle inverted min/max range by clamping correctly', () => {
    expect(scaleNormalizedValue(0.5, 20, 10)).toBe(15); // Midpoint
    expect(scaleNormalizedValue(0, 20, 10)).toBe(20);   // Should be clamped to the "actual" min (which is 10 here)
    expect(scaleNormalizedValue(1, 20, 10)).toBe(10);   // Should be clamped to the "actual" max (which is 20 here)
  });
});
```

---
### `src\utils\imageDecoder.js`
```js
// src/utils/imageDecoder.js

import { demoAssetMap } from '../assets/DemoLayers/initLayers';

// In-memory cache for GPU-ready ImageBitmap objects
const decodedImageCache = new Map();

/**
 * Resolves a token assignment into a fetchable image URL.
 * @param {object|string} assignment - The token assignment from a preset.
 * @returns {string|null} The resolved image URL or null.
 */
export const resolveImageUrl = (assignment) => {
  if (typeof assignment === 'string' && assignment.startsWith("DEMO_LAYER_")) {
    return demoAssetMap[assignment] || null;
  }
  if (typeof assignment === 'object' && assignment !== null && assignment.src) {
    return assignment.src;
  }
  return null;
};

/**
 * Fetches an image and creates an ImageBitmap, which is optimized for rendering.
 * Returns the ImageBitmap object, ready for immediate drawing.
 * @param {string} src The URL of the image to preload and decode.
 * @returns {Promise<ImageBitmap>} A promise that resolves with the GPU-ready ImageBitmap object.
 */
export const getDecodedImage = (src) => {
  if (decodedImageCache.has(src)) {
    return Promise.resolve(decodedImageCache.get(src));
  }

  // Use a temporary Image element to fetch the blob
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (src.startsWith('http') && !src.startsWith(window.location.origin)) {
      img.crossOrigin = "Anonymous";
    }

    img.src = src;

    img.onload = async () => {
      try {
        const imageBitmap = await createImageBitmap(img);
        decodedImageCache.set(src, imageBitmap);
        resolve(imageBitmap);
      } catch (bitmapError) {
        console.error(`[ImageDecoder] Failed to create ImageBitmap for: ${src}`, bitmapError);
        reject(bitmapError);
      }
    };

    img.onerror = (error) => {
      console.error(`[ImageDecoder] Failed to load image blob for bitmap creation: ${src}`, error);
      reject(error);
    };
  });
};

/**
 * Preloads and decodes an array of image URLs into ImageBitmaps.
 * This is now an async function that returns a Promise which resolves when all images are processed.
 * @param {string[]} urls - An array of image URLs to preload.
 * @returns {Promise<void>} A promise that resolves when all images have been attempted.
 */
export const preloadImages = async (urls) => {
  if (!Array.isArray(urls)) return;

  const preloadPromises = urls.map(url => {
    if (typeof url === 'string' && url.length > 0 && !decodedImageCache.has(url)) {
      return getDecodedImage(url).catch(() => {
        // Errors are already logged in getDecodedImage. We catch here so one failed image doesn't stop all others.
      });
    }
    return Promise.resolve();
  });

  // Wait for all image decoding promises to settle (either resolve or reject).
  await Promise.allSettled(preloadPromises);
};
```

---
### `src\utils\imagePreloader.js`
```js
// src/utils/imagePreloader.js

// IMPORTANT: You will need to import your demoAssetMap here for resolveImageUrl to work correctly.
import { demoAssetMap } from '../assets/DemoLayers/initLayers';

/**
 * Triggers the browser to fetch and cache an array of image URLs.
 * This is a "fire and forget" operation. The browser handles caching internally.
 * @param {string[]} urls - An array of image URLs to preload.
 */
export const preloadImages = (urls) => {
  if (!Array.isArray(urls)) return;

  urls.forEach(url => {
    if (typeof url === 'string' && url.length > 0) {
      // Creating a new Image object and setting its src is the standard
      // way to trigger a browser fetch for an image without adding it to the DOM.
      const img = new Image();
      img.src = url;
    }
  });
};

/**
 * Resolves a token assignment object or string into a fetchable image URL.
 * NOTE: This logic should be consistent with how it's resolved elsewhere in your app.
 * @param {object|string} assignment - The token assignment from a preset.
 * @returns {string|null} The resolved image URL or null.
 */
export const resolveImageUrl = (assignment) => {
  // Check for a demo asset string (e.g., "DEMO_LAYER_4")
  if (typeof assignment === 'string' && assignment.startsWith("DEMO_LAYER_")) {
    // This requires the `demoAssetMap` to be imported and available in this scope.
    // return demoAssetMap[assignment] || null; 
    
    // As a placeholder until you import demoAssetMap:
    console.warn("[resolveImageUrl] Demo asset resolution needs the demoAssetMap to be imported here.");
    return null;
  }
  // Check for the standard object format { id: '...', src: '...' }
  if (typeof assignment === 'object' && assignment !== null && assignment.src) {
    return assignment.src;
  }
  return null;
};
```

---
### `src\utils\performanceHelpers.js`
```js
// src/utils/performanceHelpers.js

/** @type {ReturnType<typeof setTimeout> | null} */
let dimmingTimerId = null; // Hold the timer ID for the dimming effect

// New performance tracking variables
let backgroundAnimationPaused = false;
let performanceMode = 'auto'; // 'auto', 'performance', 'quality'

/**
 * Adds/Removes a class to a target element to indicate an overlay is active,
 * typically used to dim or slightly de-emphasize background content.
 * This version is simplified to only manage class toggling and avoid
 * interfering with animation/transition properties of other elements.
 *
 * @param {number} [duration=300] - How long the class should be applied in milliseconds.
 * @param {object} [options={}] - Configuration options.
 * @param {string} [options.className='overlay-animating'] - The class to add/remove.
 * @param {string} [options.selector='.main-view'] - The selector for the target element.
 * @param {boolean} [options.debug=false] - Enable debug logging for this specific utility. General dev logs use `import.meta.env.DEV`.
 * @returns {() => void} - A function that can be called to cancel the dimming effect early and remove the class.
 */
export const manageOverlayDimmingEffect = (duration = 300, options = {}) => {
  const {
    className = 'overlay-animating',
    selector = '.main-view',
    debug = false // Note: This 'debug' flag is specific to this util.
  } = options;

  const target = document.querySelector(selector);

  if (!target) {
    if (debug && import.meta.env.DEV) { // Conditional logging
        console.warn(`[manageOverlayDimmingEffect] Could not find element matching selector "${selector}"`);
    }
    return () => {}; // Return a no-op function if target not found
  }

  // Clear any existing timer for this effect
  if (dimmingTimerId) {
    clearTimeout(dimmingTimerId);
    dimmingTimerId = null;
  }

  // NEW: Always pause background animations during overlay operations
  pauseBackgroundAnimations(true);

  // Add class if not already present
  if (!target.classList.contains(className)) {
    if (debug && import.meta.env.DEV) { // Conditional logging
        console.log(`[manageOverlayDimmingEffect] Adding class '${className}' to element matching '${selector}'.`);
    }
    target.classList.add(className);
  }

  // Set timer to remove the class after the specified duration
  dimmingTimerId = setTimeout(() => {
    if (debug && import.meta.env.DEV) { // Conditional logging
        console.log(`[manageOverlayDimmingEffect] Duration elapsed. Removing class '${className}' from element matching '${selector}'.`);
    }
    if(target.classList.contains(className)) { // Check if class still exists before removing
        target.classList.remove(className);
    }
    
    // NEW: Resume background animations
    pauseBackgroundAnimations(false);
    
    dimmingTimerId = null; // Clear timer ID after execution
  }, duration);

  // Return a cleanup function to cancel the effect early
  return () => {
    if (debug && import.meta.env.DEV) { // Conditional logging
        console.log(`[manageOverlayDimmingEffect] Manually canceled. Removing class '${className}'.`);
    }
    if (dimmingTimerId) {
      clearTimeout(dimmingTimerId);
      dimmingTimerId = null;
    }
    // Ensure class is removed if the cancel function is called
    if (target.classList.contains(className)) {
        target.classList.remove(className);
    }
    
    // NEW: Resume background animations on manual cancel
    pauseBackgroundAnimations(false);
  };
};

/**
 * Creates a "rested" `requestAnimationFrame` (RAF) callback that waits for a specified
 * number of animation frames before executing the provided callback function.
 * This can be useful to allow the browser to complete other rendering tasks or "catch up"
 * before performing an animation or update.
 *
 * @param {() => void} callback - The function to execute after the specified frame count.
 * @param {number} [frameCount=2] - Number of animation frames to wait before executing the callback (1-3 recommended for responsiveness).
 * @returns {number | null} - The ID returned by `requestAnimationFrame`, which can be used with `cancelAnimationFrame` to cancel the "rested" RAF. Returns `null` if `requestAnimationFrame` is not supported (should not happen in modern browsers).
 */
export const restfulRAF = (callback, frameCount = 2) => {
  /** @type {number} */
  let currentFrame = 0;
  /** @type {number | null} */
  let rafId = null;

  const rafLoop = () => {
    currentFrame++;
    if (currentFrame >= frameCount) {
      callback();
      // rafId is implicitly null after callback if not re-assigned, or loop ends.
    } else {
      if (typeof requestAnimationFrame === 'function') {
        rafId = requestAnimationFrame(rafLoop);
      } else if (import.meta.env.DEV) {
        // This case should be extremely rare in modern environments.
        console.warn("[restfulRAF] requestAnimationFrame is not supported. Callback will not be executed.");
      }
    }
  };

  if (typeof requestAnimationFrame === 'function') {
    rafId = requestAnimationFrame(rafLoop);
  } else if (import.meta.env.DEV) {
    console.warn("[restfulRAF] requestAnimationFrame is not supported. Callback will not be scheduled.");
  }
  return rafId;
};

// ========== NEW PERFORMANCE OPTIMIZATION FUNCTIONS ==========

/**
 * Detect if we should use performance mode based on device capabilities
 */
const detectPerformanceMode = () => {
  // Check various performance indicators
  const isLowPowerMode = navigator.deviceMemory && navigator.deviceMemory < 4;
  const isSlowConnection = navigator.connection && 
    (navigator.connection.effectiveType === 'slow-2g' || navigator.connection.effectiveType === '2g');
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isLowPowerMode || isSlowConnection) {
    return 'performance';
  } else if (isMobile) {
    return 'auto';
  }
  return 'quality';
};

// Initialize performance mode
if (performanceMode === 'auto') {
  performanceMode = detectPerformanceMode();
}

/**
 * Function to pause/resume background animations to improve overlay performance
 * @param {boolean} pause - Whether to pause (true) or resume (false) animations
 */
const pauseBackgroundAnimations = (pause) => {
  if (pause === backgroundAnimationPaused) return;
  
  backgroundAnimationPaused = pause;
  
  // Dispatch custom event for animation managers to listen to
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('backgroundAnimationControl', {
      detail: { paused: pause, reason: 'overlay-performance' }
    }));
  }
  
  // Use CSS approach for broad compatibility - more aggressive pausing
  const styleId = 'performance-animation-control';
  let styleElement = document.getElementById(styleId);
  
  if (pause) {
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }
    
    styleElement.textContent = `
      .performance-pause-animations,
      .performance-pause-animations *,
      .main-view,
      .main-view * {
        animation-play-state: paused !important;
        transition-duration: 0.05s !important;
        will-change: auto !important;
      }
      
      .main-view canvas {
        will-change: auto !important;
        transform: translateZ(0) !important;
      }
      
      /* Reduce GPU usage during overlay operations */
      .main-view {
        transform: translateZ(0);
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
      }
    `;
    
    // Add class to main view and body
    const mainView = document.querySelector('.main-view');
    const body = document.body;
    if (mainView) {
      mainView.classList.add('performance-pause-animations', 'performance-mode');
    }
    if (body) {
      body.classList.add('performance-pause-animations');
    }
  } else {
    if (styleElement) {
      styleElement.remove();
    }
    
    // Remove class from main view and body
    const mainView = document.querySelector('.main-view');
    const body = document.body;
    if (mainView) {
      mainView.classList.remove('performance-pause-animations', 'performance-mode');
    }
    if (body) {
      body.classList.remove('performance-pause-animations');
    }
  }
};

/**
 * Debounced function factory for performance-critical operations
 * @param {Function} func - The function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export const createPerformanceDebouncer = (func, wait = 16) => {
  let timeout;
  let lastCallTime = 0;
  
  return function executedFunction(...args) {
    const now = Date.now();
    
    // If we're in performance mode, increase debounce time
    const actualWait = performanceMode === 'performance' ? wait * 2 : wait;
    
    const later = () => {
      lastCallTime = now;
      timeout = null;
      func.apply(this, args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    
    // If enough time has passed, execute immediately
    if (now - lastCallTime >= actualWait) {
      later();
    } else {
      timeout = setTimeout(later, actualWait - (now - lastCallTime));
    }
  };
};

/**
 * Throttled function factory for scroll and resize events
 * @param {Function} func - The function to throttle
 * @param {number} limit - Throttle limit in milliseconds
 * @returns {Function} - Throttled function
 */
export const createPerformanceThrottler = (func, limit = 16) => {
  let inThrottle;
  
  return function throttledFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      
      const throttleTime = performanceMode === 'performance' ? limit * 2 : limit;
      
      setTimeout(() => {
        inThrottle = false;
      }, throttleTime);
    }
  };
};

/**
 * Request idle callback with fallback for older browsers
 * @param {Function} callback - Callback function to execute
 * @param {object} options - Options object
 * @returns {number} - ID that can be used to cancel the callback
 */
export const safeRequestIdleCallback = (callback, options = {}) => {
  if (typeof window !== 'undefined' && window.requestIdleCallback) {
    return window.requestIdleCallback(callback, {
      timeout: 5000,
      ...options
    });
  } else {
    // Fallback for browsers without requestIdleCallback
    return setTimeout(() => {
      const start = Date.now();
      callback({
        didTimeout: false,
        timeRemaining() {
          return Math.max(0, 50 - (Date.now() - start));
        }
      });
    }, 1);
  }
};

/**
 * Cancel idle callback with fallback
 * @param {number} id - ID returned by safeRequestIdleCallback
 */
export const safeCancelIdleCallback = (id) => {
  if (typeof window !== 'undefined' && window.cancelIdleCallback) {
    window.cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
};

/**
 * Optimized animation frame scheduler
 * @param {Function} callback - Callback to execute
 * @param {string} priority - Priority level: 'high', 'normal', 'low'
 * @returns {number} - ID that can be used to cancel
 */
export const scheduleWork = (callback, priority = 'normal') => {
  const priorities = {
    high: 0,
    normal: 5,
    low: 10
  };
  
  const delay = priorities[priority] || 5;
  
  if (performanceMode === 'performance') {
    // In performance mode, defer non-critical work
    if (priority === 'low') {
      return requestIdleCallback(callback);
    }
  }
  
  if (delay === 0) {
    return requestAnimationFrame(callback);
  } else {
    return setTimeout(() => {
      requestAnimationFrame(callback);
    }, delay);
  }
};

/**
 * Performance monitoring utilities
 */
export const performanceMonitor = {
  startTiming: (label) => {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`${label}-start`);
    }
    return Date.now();
  },
  
  endTiming: (label, startTime) => {
    const endTime = Date.now();
    const duration = endTime - (startTime || 0);
    
    if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
      performance.mark(`${label}-end`);
      try {
        performance.measure(label, `${label}-start`, `${label}-end`);
      } catch (e) {
        // Ignore measurement errors
      }
    }
    
    if (duration > 16 && import.meta.env.DEV && console.warn) {
      console.warn(`Performance warning: ${label} took ${duration}ms`);
    }
    
    return duration;
  }
};

/**
 * Get current performance mode
 * @returns {string} Current performance mode
 */
export const getPerformanceMode = () => performanceMode;

/**
 * Set performance mode
 * @param {string} mode - Performance mode to set
 */
export const setPerformanceMode = (mode) => {
  performanceMode = mode;
};

/**
 * Request idle callback with fallback for older browsers
 * @param {Function} callback - Callback function to execute
 * @param {object} options - Options object
 * @returns {number} - ID that can be used to cancel the callback
 */
export const requestIdleCallback = (callback, options = {}) => {
  if (typeof window !== 'undefined' && window.requestIdleCallback) {
    return window.requestIdleCallback(callback, {
      timeout: 5000,
      ...options
    });
  } else {
    // Fallback for browsers without requestIdleCallback
    return setTimeout(() => {
      const start = Date.now();
      callback({
        didTimeout: false,
        timeRemaining() {
          return Math.max(0, 50 - (Date.now() - start));
        }
      });
    }, 1);
  }
};

/**
 * Cancel idle callback with fallback
 * @param {number} id - ID returned by requestIdleCallback
 */
export const cancelIdleCallback = (id) => {
  if (typeof window !== 'undefined' && window.cancelIdleCallback) {
    window.cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
};

/**
 * Cleanup function for the module
 */
export const cleanup = () => {
  if (dimmingTimerId) {
    clearTimeout(dimmingTimerId);
    dimmingTimerId = null;
  }
  
  if (backgroundAnimationPaused) {
    pauseBackgroundAnimations(false);
  }
};
```

---
### `src\utils\ValueInterpolator.js`
```js
const lerp = (start, end, t) => start * (1 - t) + end * t;

class ValueInterpolator {
    currentValue = 0;
    startValue = 0;
    targetValue = 0;
    duration = 100; // ms
    startTime = 0;
    isInterpolating = false;

    constructor(initialValue, duration) {
        this.currentValue = initialValue;
        this.startValue = initialValue;
        this.targetValue = initialValue;
        this.duration = duration;
        this.isInterpolating = false;
    }

    setTarget(newTargetValue) {
        if (newTargetValue === this.targetValue) return;

        this.startTime = performance.now();
        this.startValue = this.currentValue;
        this.targetValue = newTargetValue;
        this.isInterpolating = true;
    }

    update(currentTime) {
        if (!this.isInterpolating) return;

        const elapsed = currentTime - this.startTime;
        let progress = this.duration > 0 ? elapsed / this.duration : 1;

        if (progress >= 1) {
            progress = 1;
            this.isInterpolating = false;
            this.currentValue = this.targetValue;
        } else {
            this.currentValue = lerp(this.startValue, this.targetValue, progress);
        }
    }

    snap(newValue) {
        this.isInterpolating = false;
        this.currentValue = newValue;
        this.targetValue = newValue;
        this.startValue = newValue;
    }

    getCurrentValue() {
        return this.currentValue;
    }

    isCurrentlyInterpolating() {
        return this.isInterpolating;
    }
}

export default ValueInterpolator;
```

---
### `src\utils\VisualEffectsProcessor.js`
```js
// src/utils/VisualEffectsProcessor.js
import EffectFactory from "../effects/EffectFactory"; // Local dependency

/**
 * @typedef {object} EffectConfigInput
 * @property {string} [type] - The type identifier of the effect (e.g., 'color_overlay'). If not provided and `effect` is, `effect` will be used. Defaults to 'color_overlay' if neither is present.
 * @property {string} [effect] - Alternative key for effect type, for backward compatibility.
 * @property {string | number} layer - The target layer ID ('global', 1, 2, or 3).
 * @property {object} [config] - Effect-specific configuration options (e.g., color, duration).
 * @property {string} [effectId] - Optional unique ID; one will be generated by the EffectFactory if not provided.
 * @property {boolean} [isPersistent=false] - Flag indicating if the effect should persist (currently placeholder for processor's internal state, actual persistence managed by consumer).
 * @property {boolean} [preserveAnimation=false] - Hint for whether background animations should be preserved when this effect is active.
 */

/**
 * @typedef {object} EffectControlAPI
 * @property {string} effectId - The unique ID of the applied effect instance.
 * @property {string | number} layer - The target layer of the effect.
 * @property {() => void} clear - Function to manually stop and clean up this specific effect instance.
 * @property {string} type - The type of the effect.
 * @property {object} [config] - The configuration used for this effect instance.
 */

/**
 * Manages the creation, application, and lifecycle of visual effects.
 * It uses an EffectFactory to instantiate specific effect classes and keeps track
 * of active effects, allowing them to be cancelled individually, by layer, or all at once.
 * It also provides a method to create default effects based on event types.
 */
class VisualEffectsProcessor {
  /** @type {Map<string, EffectControlAPI>} Stores active effect control objects, keyed by effectId. */
  activeEffects = new Map();

  constructor() {
    this.activeEffects = new Map();
  }

  /**
   * Creates, applies, and tracks a visual effect based on the provided configuration.
   * Automatically cancels any existing effects on the same target layer before applying the new one.
   * Sets a timeout to remove the effect from the active list after its duration (plus a buffer),
   * effectively making effects self-cleaning from this processor's perspective unless explicitly persistent.
   *
   * @param {EffectConfigInput} effectConfig - The configuration object for the effect.
   * @param {(layerId: string | number, key: string, value: any) => void | null} [updateLayerConfig] - Optional function potentially used by the effect to update layer configuration.
   * @returns {Promise<EffectControlAPI | null>} A promise resolving to the effect's control object or null if creation/application failed.
   */
  async processEffect(effectConfig, updateLayerConfig) {
    if (import.meta.env.DEV) {
        // console.log(`[VisualEffectsProcessor] ✅ Processing effect:`, effectConfig); // Keep this potentially useful log for debugging effects
    }

    // Handle potential variations in effect type key
    let type = effectConfig.type || effectConfig.effect; // 'effect' for backward compatibility
    if (!type) {
      if (import.meta.env.DEV) {
        console.warn("[VisualEffectsProcessor] No effect type specified, defaulting to color_overlay");
      }
      type = "color_overlay";
    }
    const finalEffectConfig = { ...effectConfig, type };


    // Cancel conflicting effects on the same layer before applying a new one
    // This ensures only one effect (of this processor's management) is active per layer at a time.
    const activeLayerEffects = Array.from(this.activeEffects.values()).filter(
      (e) => e.layer === finalEffectConfig.layer,
    );
    activeLayerEffects.forEach((activeEffect) => {
      if (activeEffect?.clear) {
        if (import.meta.env.DEV) {
            // console.log(`[VisualEffectsProcessor] Cancelling existing effect ${activeEffect.effectId} on layer ${finalEffectConfig.layer} due to new effect.`);
        }
        activeEffect.clear();
        this.activeEffects.delete(activeEffect.effectId);
      }
    });

    // Create and apply the new effect
    try {
        const effectInstance = EffectFactory.createEffect(finalEffectConfig.type, finalEffectConfig);
        const controlObject = effectInstance.apply(updateLayerConfig); // Pass update function

        if (controlObject?.effectId) {
            this.activeEffects.set(controlObject.effectId, controlObject);

            // Auto-cleanup entry from map after duration (+ buffer)
            // This makes effects "timed" by default from the processor's perspective.
            // Persistent effects would need to be managed/re-added by the consumer if they expire here.
            const duration = finalEffectConfig.config?.duration || 3000; // Default duration if not specified
            setTimeout(() => {
                // Only delete if it's still the same effect instance in the map.
                // This check is minor as clear() should handle its own state, but good for safety.
                if (this.activeEffects.get(controlObject.effectId) === controlObject) {
                    this.activeEffects.delete(controlObject.effectId);
                }
            }, duration + 1000); // Buffer allows for cleanup animations or effect finalization

            return controlObject;
        } else {
             if (import.meta.env.DEV) {
                console.warn("[VisualEffectsProcessor] Effect instance did not return a valid control object from apply().");
             }
             return null;
        }
    } catch (error) {
        if (import.meta.env.DEV) {
            console.error(`[VisualEffectsProcessor] Error creating/applying effect type ${finalEffectConfig.type}:`, error);
        }
        return null;
    }
  }

  /**
   * Manually cancels and cleans up a specific active effect by its ID.
   * @param {string} effectId - The unique ID of the effect to cancel.
   * @returns {void}
   */
  cancelEffect(effectId) {
    const effectControl = this.activeEffects.get(effectId);
    if (effectControl?.clear) {
      try {
        effectControl.clear();
      } catch (e) {
        if (import.meta.env.DEV) {
            console.error(`[VisualEffectsProcessor] Error during effectControl.clear() for ${effectId}:`, e);
        }
      }
    }
    // Always remove from map regardless of clear success to prevent stale entries
    this.activeEffects.delete(effectId);
  }

  /**
   * Manually cancels all active effects currently running on a specific layer.
   * @param {string|number} layer - The layer identifier ('global', 1, 2, or 3).
   * @returns {void}
   */
  cancelEffectsForLayer(layer) {
    const layerIdStr = String(layer); // Ensure comparison is consistent
    const effectsToCancelOnLayer = [];
    for (const [id, effectControl] of this.activeEffects.entries()) {
      if (effectControl?.layer?.toString() === layerIdStr) {
        effectsToCancelOnLayer.push(id);
      }
    }
    effectsToCancelOnLayer.forEach((id) => this.cancelEffect(id));
  }

  /**
   * Manually cancels and cleans up all currently active effects managed by this processor.
   * @returns {void}
   */
  cancelAllEffects() {
    // Iterate over a copy of keys because cancelEffect modifies the map
    const allEffectIds = Array.from(this.activeEffects.keys());
    allEffectIds.forEach((effectId) => {
      this.cancelEffect(effectId);
    });
    // Ensure the map is cleared, though cancelEffect should handle individual deletions.
    this.activeEffects.clear();
  }

  /**
   * Creates and processes a default visual effect based on a given event type string.
   * Maps common event types to predefined effect configurations (e.g., color overlays).
   * @param {string} eventType - The type of the event (e.g., 'lyx_received', 'token_sent').
   * @param {(layerId: string | number, key: string, value: any) => void | null} [updateLayerConfig] - Optional function potentially used by the effect.
   * @returns {Promise<EffectControlAPI | null>} A promise resolving to the effect's control object or null.
   */
  async createDefaultEffect(eventType, updateLayerConfig) {
    const eventLower = typeof eventType === "string" ? eventType.toLowerCase() : "";
    /** @type {EffectConfigInput | undefined} */
    let effectConfig;

    // Define default effect configurations based on event type
    if (eventLower.includes("lyx_received") || eventLower.includes("lyxreceived")) {
      effectConfig = { type: "color_overlay", layer: "1", preserveAnimation: true, config: { color: "rgba(255, 165, 0, 0.3)", pulseCount: 3, duration: 3000 } };
    } else if (eventLower.includes("lyx_sent") || eventLower.includes("lyxsent")) {
      effectConfig = { type: "color_overlay", layer: "2", preserveAnimation: true, config: { color: "rgba(0, 140, 255, 0.3)", pulseCount: 3, duration: 3000 } };
    } else if (eventLower.includes("token_received") || eventLower.includes("tokenreceived")) {
      effectConfig = { type: "color_overlay", layer: "1", preserveAnimation: true, config: { color: "rgba(0, 255, 140, 0.3)", pulseCount: 3, duration: 3000 } };
    } else if (eventLower.includes("token_sent") || eventLower.includes("tokensent")) {
      effectConfig = { type: "color_overlay", layer: "2", preserveAnimation: true, config: { color: "rgba(153, 51, 255, 0.3)", pulseCount: 3, duration: 3000 } };
    } else { // Default for unknown/other events
      effectConfig = { type: "color_overlay", layer: "3", preserveAnimation: true, config: { color: "rgba(255, 51, 153, 0.3)", pulseCount: 3, duration: 3000 } };
    }

    if (!effectConfig) { // Should not happen with the logic above, but as a safeguard
        if (import.meta.env.DEV) {
            console.warn(`[VisualEffectsProcessor] No default effect config determined for eventType: ${eventType}`);
        }
        return Promise.resolve(null);
    }
    return this.processEffect(effectConfig, updateLayerConfig);
  }

  /**
   * Gets the number of currently active effects being tracked by this processor.
   * @returns {number} The count of active effects.
   */
  getActiveEffectsCount() {
    return this.activeEffects.size;
  }

  /**
   * Gets an array containing the control objects of all currently active effects.
   * @returns {Array<EffectControlAPI>} An array of active effect control objects.
   */
  getActiveEffects() {
    return Array.from(this.activeEffects.values());
  }
}

export default VisualEffectsProcessor;
```

---
### `vite.config.js`
```js
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { // Vitest configuration
    globals: true, // Allows using Vitest globals (describe, it, expect) without importing
    environment: 'jsdom', // Use JSDOM for testing React components
    setupFiles: './src/setupTests.js', // Your setup file
    css: true, // If you want to process CSS imports in tests
    env: { // Define environment variables for your tests
      DEV: 'true', // Makes import.meta.env.DEV available and true in tests
      // You can add other test-specific environment variables here
      // VITE_SOME_KEY: 'test_value' -> accessible as import.meta.env.VITE_SOME_KEY
    },
  },
});
```
