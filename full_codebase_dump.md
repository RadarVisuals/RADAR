# 📦 Full Codebase Dump

---
### `.netlify\functions-serve\pin\netlify\functions\pin.js`
```js
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// netlify/functions/pin.js
var pin_exports = {};
__export(pin_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(pin_exports);
var handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin;
  const allowedOrigins = [
    "https://radar725.netlify.app",
    "https://www.radar725.netlify.app"
  ];
  const isLocalhost = origin && (origin.includes("localhost") || origin.includes("127.0.0.1"));
  if (origin && !allowedOrigins.includes(origin) && !isLocalhost) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: "Forbidden: Request prohibited from this origin." })
    };
  }
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }
  const PINATA_JWT = process.env.PINATA_JWT;
  console.log("--- DEBUG: PINATA UPLOAD STARTED ---");
  if (!PINATA_JWT) {
    console.error("DEBUG ERROR: PINATA_JWT is undefined/null");
  } else {
    console.log("DEBUG: PINATA_JWT loaded. Starts with:", PINATA_JWT.substring(0, 10) + "...");
  }
  if (!PINATA_JWT) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server configuration error: PINATA_JWT missing." })
    };
  }
  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON body" })
    };
  }
  const { pinataContent, pinataMetadata } = payload;
  if (!pinataContent) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing pinataContent in payload" })
    };
  }
  const upstreamBody = {
    pinataOptions: {
      cidVersion: 1
    },
    pinataMetadata: pinataMetadata || {
      name: `RADAR_Upload_${(/* @__PURE__ */ new Date()).toISOString()}`
    },
    pinataContent
  };
  try {
    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${PINATA_JWT}`
      },
      body: JSON.stringify(upstreamBody)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`DEBUG: Pinata API Failed. Status: ${response.status}. Response: ${errorText}`);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: `Pinata Error: ${errorText}` })
      };
    }
    const result = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error("Internal Server Error during Pinata upload:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error during upload" })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=pin.js.map

```

---
### `.netlify\functions-serve\pin\package.json`
```json
{"type":"commonjs"}
```

---
### `.netlify\functions-serve\pin\pin.js`
```js
module.exports = require('./netlify/functions/pin.js')
```

---
### `.netlify\functions-serve\unpin\netlify\functions\unpin.js`
```js
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// netlify/functions/unpin.js
var unpin_exports = {};
__export(unpin_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(unpin_exports);
var handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin;
  const allowedOrigins = [
    "https://radar725.netlify.app",
    "https://www.radar725.netlify.app"
  ];
  const isLocalhost = origin && (origin.includes("localhost") || origin.includes("127.0.0.1"));
  if (origin && !allowedOrigins.includes(origin) && !isLocalhost) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: "Forbidden: Request prohibited from this origin." })
    };
  }
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }
  let cid;
  try {
    const body = JSON.parse(event.body);
    cid = body.cid;
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON body" })
    };
  }
  const cidRegex = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[A-Za-z2-7]{58,})$/;
  if (!cid || typeof cid !== "string" || !cidRegex.test(cid)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid CID format" })
    };
  }
  const PINATA_JWT = process.env.PINATA_JWT;
  if (!PINATA_JWT) {
    console.error("CRITICAL: PINATA_JWT is missing in Netlify Environment Variables.");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server configuration error" })
    };
  }
  try {
    const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${PINATA_JWT}`
      }
    });
    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Pinata API Error (${response.status}) for CID ${cid}: ${errorData}`);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Failed to communicate with storage service." })
      };
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: `Unpin request for ${cid} successful.` })
    };
  } catch (error) {
    console.error(`Internal error while trying to unpin CID ${cid}:`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "An internal server error occurred." })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=unpin.js.map

```

---
### `.netlify\functions-serve\unpin\package.json`
```json
{"type":"commonjs"}
```

---
### `.netlify\functions-serve\unpin\unpin.js`
```js
module.exports = require('./netlify/functions/unpin.js')
```

---
### `.netlify\state.json`
```json
{
	"geolocation": {
		"data": {
			"city": "Oudenaarde",
			"country": {
				"code": "BE",
				"name": "Belgium"
			},
			"subdivision": {
				"code": "VLG",
				"name": "Flanders"
			},
			"timezone": "Europe/Brussels",
			"latitude": 50.8498,
			"longitude": 3.6092,
			"postalCode": "9700"
		},
		"timestamp": 1764700425381
	}
}
```

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
### `netlify\functions\pin.js`
```js
export const handler = async (event) => {
  // 1. SECURITY: Strict Origin Check
  const origin = event.headers.origin || event.headers.Origin;
  const allowedOrigins = [
    'https://radar725.netlify.app',
    'https://www.radar725.netlify.app'
  ];
  
  const isLocalhost = origin && (
    origin.includes('localhost') || 
    origin.includes('127.0.0.1')
  );

  if (origin && !allowedOrigins.includes(origin) && !isLocalhost) {
     return { 
       statusCode: 403, 
       body: JSON.stringify({ error: 'Forbidden: Request prohibited from this origin.' }) 
     };
  }

  // 2. Method Check
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  // 3. Load the Secret Key
  const PINATA_JWT = process.env.PINATA_JWT;

  // --- DEBUG LOGGING START ---
  console.log("--- DEBUG: PINATA UPLOAD STARTED ---");
  if (!PINATA_JWT) {
      console.error("DEBUG ERROR: PINATA_JWT is undefined/null");
  } else {
      // Print first 10 chars to verify it matches your NEW key, not the old one
      console.log("DEBUG: PINATA_JWT loaded. Starts with:", PINATA_JWT.substring(0, 10) + "...");
  }
  // --- DEBUG LOGGING END ---

  if (!PINATA_JWT) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error: PINATA_JWT missing.' }),
    };
  }

  // 4. Parse Data
  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const { pinataContent, pinataMetadata } = payload;

  if (!pinataContent) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing pinataContent in payload' }),
    };
  }

  // 5. Prepare Pinata Request
  const upstreamBody = {
    pinataOptions: {
      cidVersion: 1,
    },
    pinataMetadata: pinataMetadata || {
      name: `RADAR_Upload_${new Date().toISOString()}`,
    },
    pinataContent: pinataContent,
  };

  // 6. Send to Pinata
  try {
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PINATA_JWT}`,
      },
      body: JSON.stringify(upstreamBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Log the specific error from Pinata to your terminal
      console.error(`DEBUG: Pinata API Failed. Status: ${response.status}. Response: ${errorText}`);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: `Pinata Error: ${errorText}` }),
      };
    }

    const result = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error('Internal Server Error during Pinata upload:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error during upload' }),
    };
  }
};
```

---
### `netlify\functions\unpin.js`
```js
export const handler = async (event) => {
  // 1. SECURITY: Strict Origin Check
  const origin = event.headers.origin || event.headers.Origin;
  const allowedOrigins = [
    'https://radar725.netlify.app',
    'https://www.radar725.netlify.app'
  ];
  const isLocalhost = origin && (
    origin.includes('localhost') || 
    origin.includes('127.0.0.1')
  );

  if (origin && !allowedOrigins.includes(origin) && !isLocalhost) {
     return { 
       statusCode: 403, 
       body: JSON.stringify({ error: 'Forbidden: Request prohibited from this origin.' }) 
     };
  }

  // 2. Method Check
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  // 3. Parse & Validate CID
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

  // Regex to ensure this is actually an IPFS CID and not a malicious command
  const cidRegex = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[A-Za-z2-7]{58,})$/;
  if (!cid || typeof cid !== 'string' || !cidRegex.test(cid)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid CID format' }),
    };
  }

  // 4. Load Secret Key
  const PINATA_JWT = process.env.PINATA_JWT;

  if (!PINATA_JWT) {
    console.error('CRITICAL: PINATA_JWT is missing in Netlify Environment Variables.');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  // 5. Send Delete Request to Pinata
  try {
    const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Pinata API Error (${response.status}) for CID ${cid}: ${errorData}`);
      return {
        statusCode: 502, 
        body: JSON.stringify({ error: 'Failed to communicate with storage service.' }),
      };
    }

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
    "dev": "netlify dev",
    "vite": "vite --open",
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
    "@tensorflow-models/face-landmarks-detection": "^1.0.6",
    "@tensorflow/tfjs-backend-webgl": "^4.22.0",
    "@tensorflow/tfjs-core": "^4.22.0",
    "buffer": "^6.0.3",
    "ethers": "^6.13.5",
    "lodash-es": "^4.17.21",
    "pixi-filters": "^6.1.4",
    "pixi.js": "^8.14.3",
    "prop-types": "^15.8.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "viem": "^2.27.0",
    "zustand": "^5.0.8"
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
    "netlify-cli": "^21.6.0",
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
import { useEngineStore } from "../../store/useEngineStore";

const DEFAULT_LAYER_VALUES = { size: 1.0 };
const FFT_SIZE = 2048;

const AudioAnalyzer = ({
  layerConfigs: layerConfigsProp,
  configLoadNonce,
  managerInstancesRef,
}) => {
  // Read state from store (Only settings, NOT the high-frequency data updater)
  const isActive = useEngineStore((state) => state.isAudioActive);
  const audioSettings = useEngineStore((state) => state.audioSettings);

  const audioSettingsRef = useRef(audioSettings);
  const baseLayerValuesRef = useRef({
      '1': { size: DEFAULT_LAYER_VALUES.size },
      '2': { size: DEFAULT_LAYER_VALUES.size },
      '3': { size: DEFAULT_LAYER_VALUES.size },
  });
  const capturedNonceRef = useRef(-1);
  
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameRef = useRef(null);
  const dataArrayRef = useRef(null);
  const streamRef = useRef(null);
  const isCleanupScheduledRef = useRef(false);

  useEffect(() => {
    audioSettingsRef.current = audioSettings;
    if (analyserRef.current && audioContextRef.current && audioContextRef.current.state === "running") {
        try {
            const smoothing = audioSettings.smoothingFactor ?? 0.6;
            analyserRef.current.smoothingTimeConstant = Math.max(0, Math.min(1, smoothing));
        } catch (e) {
            console.warn("[AudioAnalyzer] Error setting smoothing:", e);
        }
    }
  }, [audioSettings]);

  useEffect(() => {
    if (layerConfigsProp && configLoadNonce !== capturedNonceRef.current) {
        const newBaseValues = {};
        ['1', '2', '3'].forEach(id => {
            const config = layerConfigsProp[id] || {};
            newBaseValues[id] = { size: config.size ?? DEFAULT_LAYER_VALUES.size };
        });
        baseLayerValuesRef.current = newBaseValues;
        capturedNonceRef.current = configLoadNonce;
    }
  }, [configLoadNonce, layerConfigsProp]);

  const applyAudioToLayers = useCallback((bands, level) => {
    const managers = managerInstancesRef?.current;
    const currentSettings = audioSettingsRef.current;

    if (!managers || !currentSettings) return;

    const { bassIntensity = 1.0, midIntensity = 1.0, trebleIntensity = 1.0 } = currentSettings;

    const bassFactor = 1 + (bands.bass * 0.8 * bassIntensity);
    const midFactor = 1 + (bands.mid * 1.0 * midIntensity);
    const trebleFactor = 1 + (bands.treble * 2.0 * trebleIntensity);

    // Apply directly to PIXI managers (Zero-Render)
    if (managers['1']) managers['1'].setAudioFrequencyFactor(Math.max(0.1, bassFactor));
    if (managers['2']) managers['2'].setAudioFrequencyFactor(Math.max(0.1, midFactor));
    if (managers['3']) managers['3'].setAudioFrequencyFactor(Math.max(0.1, trebleFactor));

    if (level > 0.4 && bands.bass > 0.6) {
      const pulseMultiplier = 1 + level * 0.8;
      if (managers['1']) managers['1'].triggerBeatPulse(Math.max(0.1, pulseMultiplier), 80);
    }
  }, [managerInstancesRef]);

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
    
    // 1. Apply logic to Visuals
    applyAudioToLayers(newFrequencyBands, averageLevel);

    // 2. PERFORMANCE FIX: Dispatch event for UI instead of updating Store
    // This prevents React from re-rendering the whole tree 60 times a second
    window.dispatchEvent(new CustomEvent('radar-audio-analysis', { 
        detail: { 
            level: averageLevel, 
            frequencyBands: newFrequencyBands 
        } 
    }));

  }, [applyAudioToLayers]);

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !isActive || !audioContextRef.current || audioContextRef.current.state !== 'running') {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    processAudioData(dataArrayRef.current);
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, [isActive, processAudioData]);

  const setupAudioAnalyzer = useCallback(async (stream) => {
    try {
      if (!audioContextRef.current) {
        const AudioContextGlobal = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContextGlobal();
      }

      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      if (!analyserRef.current) {
        analyserRef.current = audioContextRef.current.createAnalyser();
      }

      const initialSmoothing = audioSettingsRef.current?.smoothingFactor ?? 0.6;
      analyserRef.current.fftSize = FFT_SIZE;
      analyserRef.current.smoothingTimeConstant = Math.max(0, Math.min(1, initialSmoothing));
      analyserRef.current.minDecibels = -90;
      analyserRef.current.maxDecibels = -10;

      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);

      if (sourceRef.current) {
        try { sourceRef.current.disconnect(); } catch(e) { /* ignore */ }
      }
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);

      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
      isCleanupScheduledRef.current = false;

    } catch (e) {
      console.error("[AudioAnalyzer] Setup error:", e);
    }
  }, [analyzeAudio]);

  const requestMicrophoneAccess = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
      streamRef.current = stream;
      await setupAudioAnalyzer(stream);
    } catch (err) {
      console.error("[AudioAnalyzer] Mic access error:", err);
    }
  }, [setupAudioAnalyzer]);

  const cleanupAudio = useCallback(() => {
    if (isCleanupScheduledRef.current) return;
    isCleanupScheduledRef.current = true;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const managers = managerInstancesRef?.current;
    if (managers && managers['1']) {
        managers['1'].resetAudioModifications(); 
    }

    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch(e) { /* ignore */ }
      sourceRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state === "running") {
        audioContextRef.current.suspend().catch(() => {}).finally(() => {
            isCleanupScheduledRef.current = false;
        });
    } else {
        isCleanupScheduledRef.current = false;
    }
  }, [managerInstancesRef]);

  useEffect(() => {
    if (isActive) requestMicrophoneAccess();
    else cleanupAudio();
    return () => { if (isActive) cleanupAudio(); };
  }, [isActive, requestMicrophoneAccess, cleanupAudio]);

  useEffect(() => {
    return () => {
      cleanupAudio();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [cleanupAudio]);

  return null;
};

AudioAnalyzer.propTypes = {
  layerConfigs: PropTypes.object,
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
import React, { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { useEngineStore } from "../../store/useEngineStore"; 

import Panel from "../Panels/Panel";
import "./AudioStyles/AudioControlPanel.css";

const DISPLAY_LEVEL_AMPLIFICATION = 1.8;
const DISPLAY_TREBLE_AMPLIFICATION = 2.5;
const DEFAULT_SMOOTHING = 0.6;

const AudioControlPanel = React.memo(({
  onClose,
  isAudioActive,
  setIsAudioActive,
  audioSettings,
  setAudioSettings,
}) => {
  const [audioDevices, setAudioDevices] = useState([]);
  
  // Get destruction state
  const isDestructionMode = useEngineStore((state) => state.isDestructionMode);
  const setDestructionMode = useEngineStore((state) => state.setDestructionMode);
  
  const levelRef = useRef(null);
  const bassRef = useRef(null);
  const midRef = useRef(null);
  const trebleRef = useRef(null);

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

  useEffect(() => {
    if (!isAudioActive) return;

    const handleAudioUpdate = (event) => {
        const { level, frequencyBands } = event.detail;
        
        if (levelRef.current) {
            const displayLevel = Math.min(100, level * DISPLAY_LEVEL_AMPLIFICATION * 100);
            levelRef.current.style.width = `${displayLevel}%`;
        }
        if (bassRef.current) {
            bassRef.current.style.width = `${Math.min(100, frequencyBands.bass * 100)}%`;
        }
        if (midRef.current) {
            midRef.current.style.width = `${Math.min(100, frequencyBands.mid * 100)}%`;
        }
        if (trebleRef.current) {
            const displayTreble = Math.min(100, frequencyBands.treble * DISPLAY_TREBLE_AMPLIFICATION * 100);
            trebleRef.current.style.width = `${displayTreble}%`;
        }
    };

    window.addEventListener('radar-audio-analysis', handleAudioUpdate);
    return () => {
        window.removeEventListener('radar-audio-analysis', handleAudioUpdate);
    };
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
                  <div ref={levelRef} className="meter-fill level" style={{ width: '0%' }} role="meter"></div>
                </div>
              </div>

              <div className="frequency-meters">
                <div className="frequency-meter">
                  <div className="meter-label">Bass</div>
                  <div className="meter-bar"><div ref={bassRef} className="meter-fill bass" style={{ width: '0%' }} role="meter"></div></div>
                </div>
                <div className="frequency-meter">
                  <div className="meter-label">Mid</div>
                  <div className="meter-bar"><div ref={midRef} className="meter-fill mid" style={{ width: '0%' }} role="meter"></div></div>
                </div>
                <div className="frequency-meter">
                  <div className="meter-label">Treble</div>
                  <div className="meter-bar"><div ref={trebleRef} className="meter-fill treble" style={{ width: '0%' }} role="meter"></div></div>
                </div>
              </div>
               <button className="stop-listening-button btn btn-secondary" onClick={handleStopListening} aria-label="Stop listening to audio">
                 Stop Listening
               </button>
            </div>

            {/* --- NEW: INDUSTRIAL DESTRUCTION MODE SECTION --- */}
            <div className="section-box" style={{ borderColor: 'var(--color-error)', background: 'rgba(255, 0, 0, 0.05)' }}>
                <h4 className="config-section-title" style={{ color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{fontSize: '1.2em'}}>⚠️</span> INDUSTRIAL MODE
                </h4>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <p className="device-note" style={{ color: 'var(--color-error-a90)', margin: 0, maxWidth: '70%' }}>
                        Extreme distortion. Audio drives chaos. Photosensitivity warning.
                    </p>
                    <div className="toggle-switch-wrapper" style={{flexShrink: 0}}>
                        <label className="toggle-switch" style={{ width: '50px' }}>
                            <input 
                                type="checkbox" 
                                checked={isDestructionMode} 
                                onChange={(e) => setDestructionMode(e.target.checked)} 
                            />
                            <span className="toggle-slider" style={{ 
                                backgroundColor: isDestructionMode ? 'var(--color-error-a30)' : '',
                                borderColor: isDestructionMode ? 'var(--color-error)' : ''
                            }}></span>
                        </label>
                        <span className="toggle-state" style={{ color: isDestructionMode ? 'var(--color-error)' : '', fontSize: '10px', marginTop: '4px' }}>
                            {isDestructionMode ? "DESTROY" : "SAFE"}
                        </span>
                    </div>
                </div>
            </div>
            {/* --- END NEW SECTION --- */}

            <div className="audio-settings-section section-box">
              <h4 className="config-section-title">Audio Reactivity Settings</h4>
              <div className="slider-group">
                <div className="slider-container">
                  <div className="slider-header"><span className="slider-label">Bass Impact (L1 Size)</span><span className="slider-value">{(audioSettings?.bassIntensity || 1.0).toFixed(1)}x</span></div>
                  <input type="range" min="0.1" max="3.0" step="0.1" value={audioSettings?.bassIntensity || 1.0} onChange={(e) => handleSettingChange("bassIntensity", e.target.value)} className="bass-slider intensity-slider horizontal-slider" aria-label="Bass impact intensity"/>
                </div>
                <div className="slider-container">
                  <div className="slider-header"><span className="slider-label">Mid Impact (L2 Size)</span><span className="slider-value">{(audioSettings?.midIntensity || 1.0).toFixed(1)}x</span></div>
                  <input type="range" min="0.1" max="3.0" step="0.1" value={audioSettings?.midIntensity || 1.0} onChange={(e) => handleSettingChange("midIntensity", e.target.value)} className="mid-slider intensity-slider horizontal-slider" aria-label="Mid-range impact intensity"/>
                </div>
                <div className="slider-container">
                  <div className="slider-header"><span className="slider-label">Treble Impact (L3 Size)</span><span className="slider-value">{(audioSettings?.trebleIntensity || 1.0).toFixed(1)}x</span></div>
                  <input type="range" min="0.1" max="3.0" step="0.1" value={audioSettings?.trebleIntensity || 1.0} onChange={(e) => handleSettingChange("trebleIntensity", e.target.value)} className="treble-slider intensity-slider horizontal-slider" aria-label="Treble impact intensity"/>
                </div>
                <div className="slider-container">
                  <div className="slider-header"><span className="slider-label">Smoothing Algorithm</span><span className="slider-value">{currentSmoothing.toFixed(2)}</span></div>
                  <input type="range" min="0.05" max="0.95" step="0.01" value={currentSmoothing} onChange={(e) => handleSettingChange("smoothingFactor", e.target.value)} className="smoothness-slider intensity-slider horizontal-slider" title="Adjust response smoothness (Left=Sharp/Sawtooth, Right=Smooth/Sine)" aria-label="Audio response smoothing factor"/>
                   <div className="slider-labels"><span>Sharp</span><span>Smooth</span></div>
                </div>
              </div>
            </div>
          </>
        )}

        {!isAudioActive && (
          <div className="inactive-state section-box">
            <div className="inactive-description">
              <div className="feature-description">
                <p>Enable "Audio Responsive Layers" to make your visual configuration respond to music and onboard sound.</p>
                <ul>
                  <li>Bass influences the bottom layer's size.</li>
                  <li>Mid-range frequencies control the middle layer's size.</li>
                  <li>Treble affects the top layer's size.</li>
                  <li>A custom algorithm blends these influences for dynamic visuals.</li>
                </ul>
              </div>
              <div className="usage-note">
                <strong>Note:</strong> RADAR makes use of your microphone access to listen to the audio playing through your device. This is required for the visualizer to work. Please ensure you have granted microphone access to your browser for this site.
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
};

AudioControlPanel.defaultProps = {
  audioSettings: {
    bassIntensity: 1.0,
    midIntensity: 1.0,
    trebleIntensity: 1.0,
    smoothingFactor: DEFAULT_SMOOTHING,
  },
  setAudioSettings: () => {
    if (import.meta.env.DEV) console.warn("setAudioSettings called on default AudioControlPanel prop");
  },
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
import { useShallow } from 'zustand/react/shallow';

import { useUpProvider } from "../../context/UpProvider.jsx";
import { useCoreApplicationStateAndLifecycle } from '../../hooks/useCoreApplicationStateAndLifecycle';
import { useAppInteractions } from '../../hooks/useAppInteractions';
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import { useVisualEngineContext } from "../../context/VisualEngineContext";
import { useEngineStore } from "../../store/useEngineStore";

import ToastContainer from "../Notifications/ToastContainer";
import UIOverlay from '../UI/UIOverlay';
import PixiCanvasWrapper from '../MainViewParts/PixiCanvasWrapper';
import FpsDisplay from '../MainViewParts/FpsDisplay';
import StatusIndicator from '../MainViewParts/StatusIndicator';
import AudioAnalyzerWrapper from '../MainViewParts/AudioAnalyzerWrapper';
import CriticalErrorDisplay from '../MainViewParts/CriticalErrorDisplay';

import { BLEND_MODES } from "../../config/global-config";
import { PING_COLOR, PING_STROKE_WIDTH, NO_PING_SELECTORS } from "../../config/uiConstants";

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
  
  // Safe Selector for Audio State
  const audioState = useEngineStore(useShallow(state => ({
      isAudioActive: state.isAudioActive,
      audioSettings: state.audioSettings,
      analyzerData: state.analyzerData,
      setIsAudioActive: state.setIsAudioActive,
      setAudioSettings: state.setAudioSettings,
      handleAudioDataUpdate: state.updateAnalyzerData
  })));
  
  const rootRef = useRef(null);
  
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
    canvasRefs: {}, 
    animatingPanel: localAnimatingPanel, 
    isBenignOverlayActive: localIsBenignOverlayActive,
  });

  const {
    containerRef, 
    pixiCanvasRef,
    managerInstancesRef, 
    renderState, 
    loadingStatusMessage: renderLifecycleMessage, 
    isStatusFadingOut, 
    showStatusDisplay,
    showRetryButton, 
    isTransitioning,
    handleManualRetry,
    managersReady,
    setCanvasLayerImage,
    isContainerObservedVisible, 
    isFullscreenActive, 
    enterFullscreen,
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
        if (managerInstancesRef.current['1'] && managerInstancesRef.current['1'].setParallax) {
             managerInstancesRef.current['1'].setParallax(x, y);
        }
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

  // UPDATED: loopProgress removed to prevent 60fps React re-renders
  const pLockProps = useMemo(() => ({
    pLockState: sequencer.pLockState, 
    hasLockedParams: sequencer.hasLockedParams,
    onTogglePLock: handleTogglePLock, 
    pLockSpeed: sequencer.pLockSpeed, 
    onSetPLockSpeed: sequencer.setPLockSpeed,
    animationDataRef: sequencer.animationDataRef,
  }), [sequencer, handleTogglePLock]);

  const containerClass = `canvas-container ${isTransitioning ? 'transitioning-active' : ''} ${isWorkspaceTransitioning ? 'workspace-fading-out' : ''}`;
  
  const isReadyToRender = renderState === 'rendered';
  const showLoadingIndicator = !!loadingMessage;

  return (
    <>
      <div id="fullscreen-root" ref={rootRef} className="main-view radar-cursor">
        
        <LoadingIndicatorPill message={loadingMessage} isVisible={showLoadingIndicator} />

        <PixiCanvasWrapper
          containerRef={containerRef}
          canvasRef={pixiCanvasRef}
          containerClass={containerClass}
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
              // handleAudioDataUpdate removed (internal)
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
  Core transition applied when transform changes.
  Opacity transitions are now handled exclusively by JS to prevent race conditions.
*/
.canvas {
  /* --- FIX: Removed 'opacity' from transition-property --- */
  transition-property: transform;
  transition-duration: 500ms; /* This MUST match CANVAS_FADE_DURATION in JS */
  transition-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
}

/*
  .visible class is added by JS to set the final visible state.
  Opacity is now controlled by inline styles from the canvas orchestrator.
*/
.canvas.visible {
  /* --- FIX: Opacity is no longer controlled by this class --- */
  /* opacity: 1; */
  visibility: visible;
  /* The final transform for a visible canvas is its external parallax position,
     which is handled by inline styles in CanvasManager.js.
     We set a base scale here. */
  transform: scale(1);
}

/* --- FIX: The following two rules are the primary cause of the flicker and have been REMOVED --- */
/*
.canvas.is-fading-out {
  opacity: 0 !important;
  transform: scale(0.95) !important;
  z-index: 100 !important;
}

.canvas.is-fading-in {
  visibility: visible !important;
}
*/
/* --- END FIX --- */


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
// src/components/MainViewParts/AudioAnalyzerWrapper.jsx
import React from 'react';
import PropTypes from 'prop-types';

import AudioAnalyzer from '../Audio/AudioAnalyzer'; 

const AudioAnalyzerWrapper = ({
  isAudioActive,
  managersReady,
  layerConfigs, 
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
        // onAudioData removed as it's now handled via event dispatch
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
  layerConfigs: PropTypes.object,
  audioSettings: PropTypes.object.isRequired,
  configLoadNonce: PropTypes.number.isRequired,
  managerInstancesRef: PropTypes.object.isRequired,
};

export default AudioAnalyzerWrapper;
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
// src/components/MainViewParts/FpsDisplay.jsx
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

import './FpsDisplay.css';

/**
 * @typedef {object} FpsDisplayProps
 * @property {boolean} showFpsCounter - If true, the FPS counter is rendered and active.
 */

const FpsDisplay = ({ showFpsCounter }) => {
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

  // Always render inline. This ensures the counter is part of the element
  // that goes fullscreen (#fullscreen-root), so it remains visible.
  return (
    <div className="fps-counter" aria-live="off">
      FPS: {currentFps}
    </div>
  );
};

FpsDisplay.propTypes = {
  showFpsCounter: PropTypes.bool.isRequired,
};

export default FpsDisplay;
```

---
### `src\components\MainViewParts\PixiCanvasWrapper.jsx`
```jsx
// src/components/MainViewParts/PixiCanvasWrapper.jsx
import React, { useCallback } from 'react';
import PropTypes from 'prop-types';

const PixiCanvasWrapper = ({
  containerRef,
  canvasRef,
  containerClass,
  pingColor,
  pingStrokeWidth,
  noPingSelectors,
}) => {

  const handleCanvasClick = useCallback((event) => {
    if (noPingSelectors && typeof noPingSelectors === 'string' && event.target.closest(noPingSelectors)) {
      return;
    }

    const containerElement = containerRef.current;
    if (!containerElement) return;

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
      console.error("Error creating click ping:", e);
    }
  }, [containerRef, noPingSelectors, pingColor, pingStrokeWidth]);

  return (
    <div ref={containerRef} className={containerClass} onClick={handleCanvasClick}>
      <div className="grid-overlay"></div>
      <canvas 
        ref={canvasRef} 
        className="pixi-canvas"
        style={{
            display: 'block',
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1
        }}
      />
    </div>
  );
};

PixiCanvasWrapper.propTypes = {
  containerRef: PropTypes.object.isRequired,
  canvasRef: PropTypes.object.isRequired,
  containerClass: PropTypes.string.isRequired,
  pingColor: PropTypes.string.isRequired,
  pingStrokeWidth: PropTypes.number.isRequired,
  noPingSelectors: PropTypes.string.isRequired,
};

export default PixiCanvasWrapper;
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
import React from 'react';
import { useUIStore } from '../../store/useUIStore';
import Toast from './Toast';
import './ToastStyles.css';

const ToastContainer = () => {
  // Selector ensures this component ONLY re-renders when toasts change
  const toasts = useUIStore((state) => state.toasts);
  const removeToast = useUIStore((state) => state.removeToast);

  if (!toasts || toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          content={toast.content}
          type={toast.type}
          duration={toast.duration}
          onDismiss={removeToast}
        />
      ))}
    </div>
  );
};

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
### `src\components\Panels\EffectsPanel.jsx`
```jsx
// src/components/Panels/EffectsPanel.jsx
import React from 'react';
import PropTypes from 'prop-types';
import Panel from './Panel';
import { useVisualEngineContext } from '../../context/VisualEngineContext';
import './PanelStyles/EffectsPanel.css';

const EffectControl = ({ label, effectKey, params, config, onChange }) => {
    const isEnabled = config[effectKey]?.enabled || false;

    const handleToggle = (e) => {
        onChange(effectKey, 'enabled', e.target.checked);
    };

    const handleChange = (param, value) => {
        onChange(effectKey, param, parseFloat(value));
    };

    return (
        <div className={`effect-control-group ${isEnabled ? 'active' : ''}`}>
            <div className="effect-header">
                <span className="effect-label">{label}</span>
                <label className="toggle-switch">
                    <input type="checkbox" checked={isEnabled} onChange={handleToggle} />
                    <span className="toggle-slider"></span>
                </label>
            </div>
            {isEnabled && (
                <div className="effect-params">
                    {params.map(p => (
                        <div key={p.key} className="param-row">
                            <span className="param-label">{p.label}</span>
                            {p.type === 'select' ? (
                                <select 
                                    className="custom-select custom-select-sm"
                                    value={config[effectKey]?.[p.key] !== undefined ? config[effectKey][p.key] : p.default}
                                    onChange={(e) => handleChange(p.key, e.target.value)}
                                    style={{ flexGrow: 1, padding: '2px 5px', height: '20px' }}
                                >
                                    {p.options.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            ) : (
                                <>
                                    <input 
                                        type="range" 
                                        min={p.min} 
                                        max={p.max} 
                                        step={p.step}
                                        value={config[effectKey]?.[p.key] !== undefined ? config[effectKey][p.key] : p.default}
                                        onChange={(e) => handleChange(p.key, e.target.value)}
                                        className="param-slider"
                                    />
                                    <span className="param-value">{(config[effectKey]?.[p.key] !== undefined ? config[effectKey][p.key] : p.default).toFixed(p.decimals || 1)}</span>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

EffectControl.propTypes = {
    label: PropTypes.string.isRequired,
    effectKey: PropTypes.string.isRequired,
    params: PropTypes.arrayOf(PropTypes.shape({
        key: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        type: PropTypes.string,
        min: PropTypes.number,
        max: PropTypes.number,
        step: PropTypes.number,
        default: PropTypes.number,
        decimals: PropTypes.number,
        options: PropTypes.arrayOf(PropTypes.shape({
            value: PropTypes.number.isRequired,
            label: PropTypes.string.isRequired
        }))
    })).isRequired,
    config: PropTypes.object.isRequired,
    onChange: PropTypes.func.isRequired,
};

const EffectsPanel = ({ onClose }) => {
    const { effectsConfig, updateEffectConfig } = useVisualEngineContext();

    return (
        <Panel title="GLOBAL EFFECTS" onClose={onClose} className="panel-from-toolbar effects-panel">
            <div className="effects-content">
                
                <h4 className="config-section-title" style={{marginTop:0}}>Glitch & Chaos</h4>

                <EffectControl 
                    label="ADVERSARIAL GLITCH" 
                    effectKey="adversarial"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'intensity', label: 'Power', min: 0, max: 2.0, step: 0.01, default: 0.8, decimals: 2 },
                        { key: 'bands', label: 'Bands', min: 1, max: 64, step: 1, default: 24, decimals: 0 },
                        { key: 'shift', label: 'Shift', min: 0, max: 50, step: 1, default: 12, decimals: 0 },
                        { key: 'noiseScale', label: 'Noise', min: 0.1, max: 12, step: 0.1, default: 3.0, decimals: 1 },
                        { key: 'chromatic', label: 'RGB Split', min: 0, max: 10, step: 0.1, default: 1.5, decimals: 1 },
                        { key: 'scanline', label: 'Scanline', min: 0, max: 1, step: 0.01, default: 0.35, decimals: 2 },
                        { key: 'qNoise', label: 'Crush', min: 0, max: 8, step: 0.1, default: 2.0, decimals: 1 },
                        { key: 'seed', label: 'Seed', min: 0, max: 10, step: 0.01, default: 0.42, decimals: 2 }
                    ]}
                />

                <h4 className="config-section-title">Retro & Terminal</h4>

                <EffectControl 
                    label="ASCII TERMINAL" 
                    effectKey="ascii"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'size', label: 'Grid Size', min: 4, max: 32, step: 1, default: 12, decimals: 0 },
                        { 
                            key: 'charSet', 
                            label: 'Style', 
                            type: 'select',
                            default: 0,
                            options: [
                                { value: 0, label: 'Shapes' },
                                { value: 1, label: 'Data Flow' },
                                { value: 2, label: 'Binary' },
                                { value: 3, label: 'Density' }
                            ]
                        },
                        { 
                            key: 'colorMode', 
                            label: 'Color', 
                            type: 'select',
                            default: 0,
                            options: [
                                { value: 0, label: 'Original' },
                                { value: 1, label: 'Matrix' },
                                { value: 2, label: 'Amber' },
                                { value: 3, label: 'Cyber' },
                                { value: 4, label: 'B&W' }
                            ]
                        },
                        { 
                            key: 'invert', 
                            label: 'Mode', 
                            type: 'select',
                            default: 0,
                            options: [
                                { value: 0, label: 'Normal' },
                                { value: 1, label: 'Inverted' }
                            ]
                        }
                    ]}
                />

                <h4 className="config-section-title">Atmosphere & Flow (Premium)</h4>

                <EffectControl 
                    label="LIQUID FLOW" 
                    effectKey="liquid"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'intensity', label: 'Amount', min: 0, max: 0.1, step: 0.001, default: 0.02, decimals: 3 },
                        { key: 'scale', label: 'Density', min: 0.1, max: 10, step: 0.1, default: 3.0, decimals: 1 },
                        { key: 'speed', label: 'Flow Spd', min: 0, max: 2.0, step: 0.1, default: 0.5, decimals: 1 }
                    ]}
                />

                <EffectControl 
                    label="VOLUMETRIC LIGHT" 
                    effectKey="volumetric"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'exposure', label: 'Brightness', min: 0, max: 1.0, step: 0.01, default: 0.3, decimals: 2 },
                        { key: 'threshold', label: 'Threshold', min: 0, max: 1.0, step: 0.01, default: 0.5, decimals: 2 },
                        { key: 'decay', label: 'Decay', min: 0.8, max: 1.0, step: 0.001, default: 0.95, decimals: 3 },
                        { key: 'density', label: 'Density', min: 0, max: 1.0, step: 0.01, default: 0.8, decimals: 2 },
                        { key: 'x', label: 'Light X', min: 0, max: 1.0, step: 0.01, default: 0.5, decimals: 2 },
                        { key: 'y', label: 'Light Y', min: 0, max: 1.0, step: 0.01, default: 0.5, decimals: 2 }
                    ]}
                />

                <EffectControl 
                    label="WAVE DISTORT" 
                    effectKey="waveDistort"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'intensity', label: 'Amplitude', min: 0, max: 2.0, step: 0.01, default: 0.5, decimals: 2 }
                    ]}
                />

                <h4 className="config-section-title">Distortion & Geometry</h4>
                
                <EffectControl 
                    label="KALEIDOSCOPE (MIRROR)" 
                    effectKey="kaleidoscope"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { 
                            key: 'sides', 
                            label: 'Pattern', 
                            type: 'select',
                            default: 6,
                            options: [
                                { value: 2, label: 'Mirror (2)' },
                                { value: 3, label: 'Triad (3)' },
                                { value: 4, label: 'Quad (4)' },
                                { value: 6, label: 'Hex (6)' },
                                { value: 8, label: 'Octo (8)' },
                                { value: 12, label: 'Dodeca (12)' },
                                { value: 20, label: 'Hyper (20)' },
                            ]
                        },
                        { key: 'angle', label: 'Angle', min: 0, max: 6.28, step: 0.01, default: 0, decimals: 2 }
                    ]}
                />

                <EffectControl 
                    label="VOID VORTEX (TWIST)" 
                    effectKey="twist"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'radius', label: 'Radius', min: 100, max: 1000, step: 10, default: 400, decimals: 0 },
                        { key: 'angle', label: 'Twist', min: -10, max: 10, step: 0.1, default: 4, decimals: 1 }
                    ]}
                />

                <EffectControl 
                    label="WARP DRIVE (ZOOM)" 
                    effectKey="zoomBlur"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'strength', label: 'Strength', min: 0, max: 0.5, step: 0.01, default: 0.1, decimals: 2 },
                        { key: 'innerRadius', label: 'Safe Zone', min: 0, max: 200, step: 10, default: 50, decimals: 0 }
                    ]}
                />

                <h4 className="config-section-title">Color & Texture</h4>

                <EffectControl 
                    label="CHROMATIC ABERRATION" 
                    effectKey="rgb"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'amount', label: 'Offset', min: 0, max: 20, step: 1, default: 2, decimals: 0 }
                    ]}
                />

                <EffectControl 
                    label="BLOOM (GLOW)" 
                    effectKey="bloom"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'intensity', label: 'Intensity', min: 0, max: 5, step: 0.1, default: 1 },
                        { key: 'threshold', label: 'Threshold', min: 0, max: 1, step: 0.01, default: 0.5 },
                        { key: 'blur', label: 'Blur', min: 0, max: 20, step: 1, default: 8, decimals: 0 }
                    ]}
                />

                <EffectControl 
                    label="CRT MONITOR (RETRO)" 
                    effectKey="crt"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'curvature', label: 'Curve', min: 0, max: 10, step: 0.1, default: 1, decimals: 1 },
                        { key: 'lineWidth', label: 'Scanlines', min: 0, max: 5, step: 0.1, default: 1, decimals: 1 },
                        { key: 'noise', label: 'Static', min: 0, max: 0.5, step: 0.01, default: 0.1, decimals: 2 }
                    ]}
                />

                <EffectControl 
                    label="PIXELATE (8-BIT)" 
                    effectKey="pixelate"
                    config={effectsConfig}
                    onChange={updateEffectConfig}
                    params={[
                        { key: 'size', label: 'Block Size', min: 2, max: 100, step: 1, default: 10, decimals: 0 }
                    ]}
                />
            </div>
        </Panel>
    );
};

EffectsPanel.propTypes = {
    onClose: PropTypes.func.isRequired,
};

export default EffectsPanel;
```

---
### `src\components\Panels\EnhancedControlPanel.jsx`
```jsx
// src/components/Panels/EnhancedControlPanel.jsx
import React, { useCallback, useMemo, useState, useEffect } from "react";
import PropTypes from "prop-types";

import Panel from "./Panel";
import PLockController from './PLockController';
import PerformanceSlider from "../UI/PerformanceSlider"; 

import { useProfileSessionState } from "../../hooks/configSelectors";
import { useMIDI } from "../../context/MIDIContext";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import { useVisualEngineContext } from "../../context/VisualEngineContext";
import { useEngineStore } from "../../store/useEngineStore";
import { useToast } from "../../context/ToastContext";
import { BLEND_MODES } from "../../config/global-config";
import { sliderParams } from "../../config/sliderParams";

import {
  toplayerIcon,
  middlelayerIcon,
  bottomlayerIcon,
  rotateIcon,
} from "../../assets";

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
    setActiveSceneName,
  } = useWorkspaceContext();

  const {
    handleSceneSelect: onSceneSelect,
    updateLayerConfig: onLayerConfigChange,
    managerInstancesRef,
    renderedCrossfaderValue,
    uiControlConfig 
  } = useVisualEngineContext();

  const isAutoFading = useEngineStore(state => state.isAutoFading);

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
  
  // --- PERFORMANCE OPTIMIZATION HANDLERS ---
  
  // 1. FAST: Updates visual engine immediately, skips React/Zustand store
  const handleSliderInput = useCallback((name, value) => {
    onLayerConfigChange(activeLayer, name, value, false, true); // skipStoreUpdate = true
  }, [onLayerConfigChange, activeLayer]);

  // 2. SLOW: Commits final value to Store on release
  const handleSliderCommit = useCallback((name, value) => {
    onLayerConfigChange(activeLayer, name, value, false, false); // skipStoreUpdate = false
  }, [onLayerConfigChange, activeLayer]);

  const handleCreateScene = useCallback(() => {
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
    const activeDeckIsA = renderedCrossfaderValue < 0.5;
    const activeDeckChar = activeDeckIsA ? 'A' : 'B';
    let liveLayersConfig = {};

    if (managers && Object.keys(managers).length > 0) {
      for (const layerId in managers) {
        const manager = managers[layerId];
        const currentState = manager.getState ? manager.getState(activeDeckChar) : null;
        if (!currentState) continue;
        
        const liveConfig = JSON.parse(JSON.stringify(currentState.config));
        liveConfig.angle = (currentState.config.angle + currentState.continuousRotationAngle) % 360;
        liveConfig.driftState = JSON.parse(JSON.stringify(currentState.driftState));
        
        if (currentState.playbackValues) {
            for (const key in currentState.playbackValues) {
                liveConfig[key] = currentState.playbackValues[key];
            }
        }
        liveLayersConfig[layerId] = liveConfig;
      }
    } else {
      liveLayersConfig = JSON.parse(JSON.stringify(uiControlConfig.layers));
    }

    const newSceneData = {
      name,
      ts: Date.now(),
      layers: liveLayersConfig,
      tokenAssignments: JSON.parse(JSON.stringify(uiControlConfig.tokenAssignments)),
    };

    addNewSceneToStagedWorkspace(name, newSceneData);
    setActiveSceneName(name);

    addToast(`Scene "${name}" created and staged.`, "success");
    setNewSceneName("");
    
  }, [newSceneName, savedSceneList, uiControlConfig, addNewSceneToStagedWorkspace, addToast, managerInstancesRef, renderedCrossfaderValue, setActiveSceneName]);

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
                
                <PerformanceSlider 
                    name={prop}
                    layerId={activeLayer} // --- ADDED: Pass layerId for event filtering ---
                    min={min}
                    max={max}
                    step={step}
                    value={config[prop] ?? defaultValue}
                    onChange={handleSliderInput}   // FAST Update
                    onCommit={handleSliderCommit}  // SLOW Update
                    disabled={isLearningThis || isLocked}
                    className="horizontal-slider"
                    ariaLabel={label}
                />
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
                <button type="button" className={`midi-learn-btn small-action-button ${isLearning('global', 'crossfader') ? "learning" : ""}`} onClick={() => handleEnterGlobalMIDILearnMode('crossfader')} disabled={!isProfileOwner || !midiConnected || !!midiLearning || !!learningLayer} title="Map MIDI to Crossfader">{isLearning('global', 'crossfader') ? "..." : "Map"}</button>
              </div>
            </div>
            <div className="global-mapping-item">
              <div className="global-mapping-label">P-Lock Toggle</div>
              <div className="global-mapping-controls">
                <span className="layer-mapping-text" title={displayGlobalMidiMapping('pLockToggle')}>{displayGlobalMidiMapping('pLockToggle')}</span>
                <button type="button" className={`midi-learn-btn small-action-button ${isLearning('global', 'pLockToggle') ? "learning" : ""}`} onClick={() => handleEnterGlobalMIDILearnMode('pLockToggle')} disabled={!isProfileOwner || !midiConnected || !!midiLearning || !!learningLayer} title="Map MIDI to P-Lock Toggle">{isLearning('global', 'pLockToggle') ? "..." : "Map"}</button>
              </div>
            </div>
            <div className="global-mapping-item">
              <div className="global-mapping-label">Previous Scene</div>
              <div className="global-mapping-controls">
                <span className="layer-mapping-text" title={displayGlobalMidiMapping('prevScene')}>{displayGlobalMidiMapping('prevScene')}</span>
                <button type="button" className={`midi-learn-btn small-action-button ${isLearning('global', 'prevScene') ? "learning" : ""}`} onClick={() => handleEnterGlobalMIDILearnMode('prevScene')} disabled={!isProfileOwner || !midiConnected || !!midiLearning || !!learningLayer} title="Map MIDI to Previous Scene">{isLearning('global', 'prevScene') ? "..." : "Map"}</button>
              </div>
            </div>
            <div className="global-mapping-item">
              <div className="global-mapping-label">Next Scene</div>
              <div className="global-mapping-controls">
                <span className="layer-mapping-text" title={displayGlobalMidiMapping('nextScene')}>{displayGlobalMidiMapping('nextScene')}</span>
                <button type="button" className={`midi-learn-btn small-action-button ${isLearning('global', 'nextScene') ? "learning" : ""}`} onClick={() => handleEnterGlobalMIDILearnMode('nextScene')} disabled={!isProfileOwner || !midiConnected || !!midiLearning || !!learningLayer} title="Map MIDI to Next Scene">{isLearning('global', 'nextScene') ? "..." : "Map"}</button>
              </div>
            </div>
            <div className="global-mapping-item">
              <div className="global-mapping-label">Previous Workspace</div>
              <div className="global-mapping-controls">
                <span className="layer-mapping-text" title={displayGlobalMidiMapping('prevWorkspace')}>{displayGlobalMidiMapping('prevWorkspace')}</span>
                <button type="button" className={`midi-learn-btn small-action-button ${isLearning('global', 'prevWorkspace') ? "learning" : ""}`} onClick={() => handleEnterGlobalMIDILearnMode('prevWorkspace')} disabled={!isProfileOwner || !midiConnected || !!midiLearning || !!learningLayer} title="Map MIDI to Previous Workspace">{isLearning('global', 'prevWorkspace') ? "..." : "Map"}</button>
              </div>
            </div>
            <div className="global-mapping-item">
              <div className="global-mapping-label">Next Workspace</div>
              <div className="global-mapping-controls">
                <span className="layer-mapping-text" title={displayGlobalMidiMapping('nextWorkspace')}>{displayGlobalMidiMapping('nextWorkspace')}</span>
                <button type="button" className={`midi-learn-btn small-action-button ${isLearning('global', 'nextWorkspace') ? "learning" : ""}`} onClick={() => handleEnterGlobalMIDILearnMode('nextWorkspace')} disabled={!isProfileOwner || !midiConnected || !!midiLearning || !!learningLayer} title="Map MIDI to Next Workspace">{isLearning('global', 'nextWorkspace') ? "..." : "Map"}</button>
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
  const { hostProfileAddress, isHostProfileOwner, canSaveToHostProfile } = useUserSession();
  const {
    activeWorkspaceName,
    saveChanges,
    duplicateActiveWorkspace,
    isLoading: isWorkspaceLoading,
    isSaving,
    hasPendingChanges,
  } = useWorkspaceContext();
  
  // If the current user is a visitor, display a read-only message and nothing else.
  if (!isHostProfileOwner) {
    return (
      <Panel title="VIEWING MODE" onClose={onClose} className="panel-from-toolbar enhanced-save-panel">
          <div className="save-info visitor-banner">
              <span aria-hidden="true">👤</span>
              <div>
                <div className="title">Viewing {formatAddress(hostProfileAddress)}'s Profile</div>
                <div className="desc">
                  You are viewing another user's profile. You can load and experiment with their scenes. Saving is disabled.
                </div>
              </div>
            </div>
      </Panel>
    );
  }

  // The remainder of the component is for the profile owner.
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
      const newName = window.prompt("Enter a name for your first workspace:");
      if (newName && newName.trim()) {
        const result = await duplicateActiveWorkspace(newName.trim());
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
    if (!hostProfileAddress) return "CONNECT PROFILE";
    return "SAVE MANAGEMENT";
  };

  const renderStatusIndicator = () => {
    if (isSaving) return <div className="status-indicator saving">Saving Changes...</div>;
    if (hasPendingChanges) return <div className="status-indicator pending">Unsaved changes</div>;
    return <div className="status-indicator idle">Workspace is in sync</div>;
  };

  const isUpdateDisabled = !hasPendingChanges || isSaving || !canSave || isWorkspaceLoading;
  const isSaveAsDisabled = isSaving || !canSave || isWorkspaceLoading;

  return (
    <Panel title={getPanelTitle()} onClose={onClose} className="panel-from-toolbar enhanced-save-panel">
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
    stagedSetlist, // --- UPDATED: Sourcing from stagedSetlist ---
    updateGlobalEventReactions,
    deleteGlobalEventReaction,
  } = useWorkspaceContext();

  const readOnly = !canSaveToHostProfile;
  
  // --- UPDATED: Reading from global reactions ---
  const reactions = useMemo(() => stagedSetlist?.globalEventReactions || {}, [stagedSetlist]);
  
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
          <button className="btn btn-secondary btn-preview" onClick={handlePreview} disabled={readOnly || typeof onPreviewEffect !== "function"} title="Trigger a preview of the current effect settings" > PREVIEW EFFECT </button>
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
### `src\components\Panels\IndustrialPanel.jsx`
```jsx
// src/components/Panels/IndustrialPanel.jsx
import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Panel from './Panel';
import { useEngineStore } from '../../store/useEngineStore';
import { useShallow } from 'zustand/react/shallow';
import { FireIcon, BoltIcon, SignalIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/solid';
import './PanelStyles/IndustrialPanel.css';

const TARGET_LABELS = {
    rgbStrength: 'RGB TEAR',
    glitchIntensity: 'DATA MOSH',
    pixelateSize: 'BIT CRUSH',
    zoomStrength: 'KICK ZOOM',
    crtNoise: 'STATIC NOISE',
    crtGeometry: 'CRT GEOMETRY',
    scanlineScale: 'SCAN WIDTH',
    chromaticShift: 'COLOR SHIFT',
    binaryThreshold: '1-BIT THRESHOLD',
    invertStrobe: 'NEGATIVE STROBE',
    crossfaderShred: 'SCENE SHREDDER'
};

const SOURCE_LABELS = {
    bass: 'BASS',
    mid: 'MID',
    treble: 'HIGH',
    level: 'LEVEL'
};

// Mini-component for signal visualizer
const SignalDot = ({ source }) => {
    const ref = useRef(null);
    useEffect(() => {
        const handleAudio = (e) => {
            if (!ref.current) return;
            const { level, frequencyBands } = e.detail;
            let val = 0;
            if (source === 'level') val = level;
            else val = frequencyBands[source] || 0;
            
            ref.current.style.opacity = 0.3 + (val * 0.7);
            ref.current.style.boxShadow = `0 0 ${val * 8}px var(--color-primary)`;
        };
        window.addEventListener('radar-audio-analysis', handleAudio);
        return () => window.removeEventListener('radar-audio-analysis', handleAudio);
    }, [source]);

    return (
        <div className="signal-dot" ref={ref} />
    );
};

SignalDot.propTypes = { source: PropTypes.string.isRequired };

const IndustrialPanel = ({ onClose }) => {
    const config = useEngineStore(useShallow(state => state.industrialConfig));
    const setIndustrialEnabled = useEngineStore(state => state.setIndustrialEnabled);
    const setIndustrialChaos = useEngineStore(state => state.setIndustrialChaos);
    const setIndustrialMasterDrive = useEngineStore(state => state.setIndustrialMasterDrive);
    const updateMapping = useEngineStore(state => state.updateIndustrialMapping);

    const toggleMain = () => setIndustrialEnabled(!config.enabled);

    return (
        <Panel title="SIGNAL ROUTER" onClose={onClose} className="panel-from-toolbar industrial-panel">
            <div className="panel-content">
                
                {/* --- MASTER SWITCH --- */}
                <div className={`master-switch-container ${config.enabled ? 'active' : ''}`}>
                    <div className="switch-info">
                        <FireIcon className="switch-icon"/>
                        <div>
                            <div className="switch-title">OVERDRIVE CORE</div>
                            <div className="switch-subtitle">
                                {config.enabled ? 'PATH: REROUTED' : 'PATH: BYPASSED'}
                            </div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={toggleMain}
                        className={`engage-button ${config.enabled ? 'active' : ''}`}
                    >
                        {config.enabled ? 'ON' : 'OFF'}
                    </button>
                </div>

                {/* --- GLOBAL CONTROLS --- */}
                <div className="global-controls-grid">
                    <div className="control-cell">
                        <div className="control-header">
                            <span className="control-label"><AdjustmentsHorizontalIcon className="icon-inline"/> MASTER DRIVE</span>
                            <span className="control-value">{(config.masterDrive * 100).toFixed(0)}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="1" step="0.01" 
                            value={config.masterDrive} 
                            onChange={(e) => setIndustrialMasterDrive(parseFloat(e.target.value))}
                            className="master-slider drive-slider"
                            title="Global Intensity"
                        />
                    </div>
                    <div className="control-cell">
                        <div className="control-header">
                            <span className="control-label"><BoltIcon className="icon-inline"/> CHAOS</span>
                            <span className="control-value">{(config.chaos * 100).toFixed(0)}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="1" step="0.01" 
                            value={config.chaos} 
                            onChange={(e) => setIndustrialChaos(parseFloat(e.target.value))}
                            className="master-slider chaos-slider"
                            title="Randomness Factor"
                        />
                    </div>
                </div>

                {/* --- PATCH BAY --- */}
                <div className="patch-bay-container">
                    <div className="patch-bay-header">
                        <span>ON</span>
                        <span>MODULE</span>
                        <span>SRC</span>
                        <span style={{textAlign:'right'}}>AMOUNT</span>
                    </div>

                    <div className="patch-list">
                        {Object.entries(config.mappings).map(([key, map]) => (
                            <div key={key} className={`patch-row ${map.enabled ? 'enabled' : 'disabled'}`}>
                                {/* Toggle */}
                                <label className="patch-toggle">
                                    <input 
                                        type="checkbox" 
                                        checked={map.enabled} 
                                        onChange={(e) => updateMapping(key, { enabled: e.target.checked })}
                                    />
                                    <span className="toggle-indicator"></span>
                                </label>

                                {/* Label */}
                                <span className="patch-name">
                                    {TARGET_LABELS[key] || key}
                                </span>

                                {/* Source Select */}
                                <div className="patch-source">
                                    <SignalDot source={map.source} />
                                    <select 
                                        value={map.source}
                                        onChange={(e) => updateMapping(key, { source: e.target.value })}
                                        className="source-select"
                                    >
                                        {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Gain Slider */}
                                <div className="patch-gain">
                                    <input 
                                        type="range" min="0" max="3.0" step="0.1"
                                        value={map.amount}
                                        onChange={(e) => updateMapping(key, { amount: parseFloat(e.target.value) })}
                                        className="gain-slider"
                                        title={`Effect Amount: ${map.amount}`}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="panel-footer">
                    <SignalIcon className="footer-icon" />
                    <span>SIGNAL FLOW: AUDIO &rarr; MAP &rarr; DRIVE &rarr; FX</span>
                </div>

            </div>
        </Panel>
    );
};

IndustrialPanel.propTypes = {
    onClose: PropTypes.func.isRequired,
};

export default React.memo(IndustrialPanel);
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
        if (entry.isIntersecting) {
          setIsVisible(true);
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

  const imageSource = isVisible ? src : '';

  return (
    <div ref={imgRef} className={`lazy-image-container ${isLoaded ? 'loaded' : ''}`}>
      {/* === START OF FIX === */}
      {/* Only render the img tag if there is a valid, non-empty imageSource */}
      {imageSource ? (
        <img
          src={imageSource}
          alt={alt}
          className={className}
          onLoad={() => setIsLoaded(true)}
          style={{ opacity: isLoaded ? 1 : 0 }}
          draggable="false"
          decoding="async"
        />
      ) : null}
      {/* === END OF FIX === */}

      {/* This placeholder will now correctly remain visible if imageSource is empty */}
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
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
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

const CollectionCard = ({ collection, onRemove, canRemove }) => {
    const renderImage = () => {
        const imgTag = (
            <img 
                src={collection.imageUrl || `https://via.placeholder.com/80/252525/00f3ff.png?text=${collection.name?.charAt(0)?.toUpperCase() || "?"}`} 
                alt={collection.name || "Collection"} 
            />
        );

        if (collection.linkUrl) {
            return (
                <a 
                    href={collection.linkUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="collection-link"
                    title={`Visit ${collection.name}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {imgTag}
                </a>
            );
        }
        return imgTag;
    };

    return (
        <div className="collection-card">
            <div className={`collection-image ${collection.linkUrl ? 'is-clickable' : ''}`}>
                {renderImage()}
            </div>
            <div className="collection-info">
                <h4 className="collection-name" title={collection.name}>{collection.name || "Unnamed"}</h4>
                <div className="collection-address" title={collection.address}>{formatAddress(collection.address)}</div>
            </div>
            {canRemove && (
                <button className="remove-button btn-icon" onClick={() => onRemove(collection.address)} title={`Remove ${collection.name}`} disabled={!canRemove}>✕</button>
            )}
        </div>
    );
};

CollectionCard.propTypes = {
  collection: PropTypes.object.isRequired,
  onRemove: PropTypes.func,
  canRemove: PropTypes.bool,
};

const LibraryPanel = ({ onClose }) => {
  const { isRadarProjectAdmin, isHostProfileOwner } = useUserSession();
  const {
    stagedSetlist,
    addCollectionToPersonalLibrary,
    removeCollectionFromPersonalLibrary,
    configServiceRef,
  } = useWorkspaceContext();
  const { officialWhitelist, refreshOfficialWhitelist } = useAssetContext();
  const { addToast } = useToast();
  
  const userLibrary = useMemo(() => stagedSetlist?.personalCollectionLibrary || [], [stagedSetlist]);

  const [newUserCollection, setNewUserCollection] = useState({ address: "", name: "", imageUrl: "" });
  const [userError, setUserError] = useState("");
  const userStatusTimerRef = useRef(null);
  
  const [stagedAdminWhitelist, setStagedAdminWhitelist] = useState([]);
  const [hasAdminChanges, setHasAdminChanges] = useState(false);
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [newAdminCollection, setNewAdminCollection] = useState({ address: "", name: "", imageUrl: "", linkUrl: "" });
  const adminStatusTimerRef = useRef(null);

  useEffect(() => {
    if (isRadarProjectAdmin) {
      setStagedAdminWhitelist(officialWhitelist || []);
      setHasAdminChanges(false);
    }
  }, [officialWhitelist, isRadarProjectAdmin]);

  const displayUserError = useCallback((message, duration = 4000) => {
    setUserError(message);
    if (userStatusTimerRef.current) clearTimeout(userStatusTimerRef.current);
    if (duration > 0) userStatusTimerRef.current = setTimeout(() => setUserError(""), duration);
  }, []);

  const handleUserInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setNewUserCollection((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleAddUserCollection = useCallback(() => {
    const addressToAdd = newUserCollection.address.trim();
    const nameToAdd = newUserCollection.name.trim();

    if (!addressToAdd || !nameToAdd) { displayUserError("Address and Name are required."); return; }
    if (!isAddress(addressToAdd)) { displayUserError("Invalid address format."); return; }
    
    const isAlreadyInOfficial = officialWhitelist.some(c => c.address.toLowerCase() === addressToAdd.toLowerCase());
    const isAlreadyInUser = userLibrary.some(c => c.address.toLowerCase() === addressToAdd.toLowerCase());
    
    if (isAlreadyInOfficial || isAlreadyInUser) {
        displayUserError("This collection is already in a library.");
        return;
    }
    
    addCollectionToPersonalLibrary({
      address: addressToAdd,
      name: nameToAdd,
      imageUrl: newUserCollection.imageUrl.trim() || null,
    });
    setNewUserCollection({ address: "", name: "", imageUrl: "" });
  }, [newUserCollection, userLibrary, officialWhitelist, addCollectionToPersonalLibrary, displayUserError]);

  const displayAdminError = useCallback((message, duration = 4000) => {
    setAdminError(message);
    if (adminStatusTimerRef.current) clearTimeout(adminStatusTimerRef.current);
    if (duration > 0) adminStatusTimerRef.current = setTimeout(() => setAdminError(""), duration);
  }, []);
  
  const handleAdminInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setNewAdminCollection((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleAdminAddCollection = useCallback(() => {
    const addressToAdd = newAdminCollection.address.trim();
    const nameToAdd = newAdminCollection.name.trim();

    if (!addressToAdd || !nameToAdd) { displayAdminError("Address and Name are required."); return; }
    if (!isAddress(addressToAdd)) { displayAdminError("Invalid address format."); return; }
    if (stagedAdminWhitelist.some(c => c.address.toLowerCase() === addressToAdd.toLowerCase())) {
        displayAdminError("This collection is already in the whitelist.");
        return;
    }
    
    setStagedAdminWhitelist(prev => [...prev, {
      address: addressToAdd,
      name: nameToAdd,
      imageUrl: newAdminCollection.imageUrl.trim() || null,
      linkUrl: newAdminCollection.linkUrl.trim() || null,
    }]);
    setNewAdminCollection({ address: "", name: "", imageUrl: "", linkUrl: "" });
    setHasAdminChanges(true);
  }, [newAdminCollection, stagedAdminWhitelist, displayAdminError]);

  const handleAdminRemoveCollection = useCallback((addressToRemove) => {
    setStagedAdminWhitelist(prev => prev.filter(c => c.address.toLowerCase() !== addressToRemove.toLowerCase()));
    setHasAdminChanges(true);
  }, []);

  const handleSaveWhitelist = async () => {
    if (!isRadarProjectAdmin || isSavingAdmin) return;
    setIsSavingAdmin(true);
    addToast("Saving official whitelist...", "info");
    try {
        const service = configServiceRef.current;
        if (!service || !service.checkReadyForWrite()) throw new Error("Configuration Service is not ready for writing.");
        const newCid = await uploadJsonToPinata(stagedAdminWhitelist, 'RADAR_OfficialWhitelist');
        const newIpfsUri = `ipfs://${newCid}`;
        const valueHex = stringToHex(newIpfsUri);
        await service.saveDataToKey(RADAR_OFFICIAL_ADMIN_ADDRESS, OFFICIAL_WHITELIST_KEY, valueHex);
        await refreshOfficialWhitelist();
        addToast("Official whitelist saved successfully!", "success");
        setHasAdminChanges(false);
        onClose(); 
    } catch (error) {
        console.error("Failed to save whitelist:", error);
        addToast(`Error: ${error.message}`, "error");
    } finally {
        setIsSavingAdmin(false);
    }
  };

  useEffect(() => {
    return () => {
        if (userStatusTimerRef.current) clearTimeout(userStatusTimerRef.current);
        if (adminStatusTimerRef.current) clearTimeout(adminStatusTimerRef.current);
    }
  }, []);

  return (
    <Panel title="Collections Library" onClose={onClose} className="panel-from-toolbar library-panel events-panel-custom-scroll">
      
      {isHostProfileOwner && (
        <div className="add-collection-section section-box">
          <h3 className="section-title">Add to My Library</h3>
          {userError && <div className="status-message error">{userError}</div>}
          <div className="form-group">
            <label htmlFor="user-address">Collection Address*</label>
            <input type="text" id="user-address" name="address" className="form-control" value={newUserCollection.address} onChange={handleUserInputChange} placeholder="0x..." aria-required="true" />
          </div>
          <div className="form-group">
            <label htmlFor="user-name">Collection Name*</label>
            <input type="text" id="user-name" name="name" className="form-control" value={newUserCollection.name} onChange={handleUserInputChange} placeholder="Name of the Collection" aria-required="true" />
          </div>
          <div className="form-group">
            <label htmlFor="user-imageUrl">Image URL</label>
            <input type="text" id="user-imageUrl" name="imageUrl" className="form-control" value={newUserCollection.imageUrl} onChange={handleUserInputChange} placeholder="https://... (optional)"/>
          </div>
          <button className="btn btn-block btn-secondary" onClick={handleAddUserCollection} disabled={!newUserCollection.address.trim() || !newUserCollection.name.trim() || !isAddress(newUserCollection.address.trim())}>
            Add to My Library
          </button>
          <p className="form-help-text">Add an LSP7 or LSP8 collection. Changes must be saved via the main Save panel.</p>
        </div>
      )}

      <div className="collections-section section-box">
        <h3 className="section-title">{isHostProfileOwner ? 'My Library' : 'Personal Library'}</h3>
        {userLibrary.length > 0 ? (
          <div className="collections-grid">
            {userLibrary.map(collection => (
              <CollectionCard key={collection.address} collection={collection} onRemove={removeCollectionFromPersonalLibrary} canRemove={isHostProfileOwner} />
            ))}
          </div>
        ) : (
          <div className="empty-message">This user's personal library is empty.</div>
        )}
      </div>

      <div className="collections-section section-box">
        <h3 className="section-title">Official Collections</h3>
        {officialWhitelist.length > 0 ? (
          <div className="collections-grid">
            {officialWhitelist.map((collection) => (
              <CollectionCard key={collection.address} collection={collection} canRemove={false} />
            ))}
          </div>
        ) : (
          <div className="empty-message">No official collections found.</div>
        )}
      </div>

      {isRadarProjectAdmin && (
        <div className="admin-section-wrapper">
          <div className="admin-header">
            <div className="admin-badge">Admin Mode</div>
            <p className="admin-description">Manage the global official whitelist. Changes here affect all users.</p>
          </div>
          {adminError && <div className="status-message error">{adminError}</div>}
          <div className="add-collection-section section-box">
            <h3 className="section-title">Add New Official Collection</h3>
            <div className="form-group">
              <label htmlFor="admin-address">Collection Address*</label>
              <input type="text" id="admin-address" name="address" className="form-control" value={newAdminCollection.address} onChange={handleAdminInputChange} placeholder="0x..." disabled={isSavingAdmin} aria-required="true" />
            </div>
            <div className="form-group">
              <label htmlFor="admin-name">Collection Name*</label>
              <input type="text" id="admin-name" name="name" className="form-control" value={newAdminCollection.name} onChange={handleAdminInputChange} placeholder="Name of the Collection" disabled={isSavingAdmin} aria-required="true" />
            </div>
            <div className="form-group">
              <label htmlFor="admin-imageUrl">Image URL</label>
              <input type="text" id="admin-imageUrl" name="imageUrl" className="form-control" value={newAdminCollection.imageUrl} onChange={handleAdminInputChange} placeholder="https://... (optional)" disabled={isSavingAdmin}/>
            </div>
            <div className="form-group">
              <label htmlFor="admin-linkUrl">Link URL</label>
              <input type="text" id="admin-linkUrl" name="linkUrl" className="form-control" value={newAdminCollection.linkUrl} onChange={handleAdminInputChange} placeholder="https://... (optional, e.g., for minting)" disabled={isSavingAdmin}/>
            </div>
            <button className="btn btn-block btn-secondary" onClick={handleAdminAddCollection} disabled={isSavingAdmin || !newAdminCollection.address.trim() || !newAdminCollection.name.trim() || !isAddress(newAdminCollection.address.trim())}>
              Add to Staged List
            </button>
          </div>
          <div className="collections-section section-box">
            <h3 className="section-title">Staged Official Whitelist</h3>
            {stagedAdminWhitelist.length > 0 ? (
              <div className="collections-grid">
                {stagedAdminWhitelist.map((collection) => (
                  <CollectionCard key={collection.address} collection={collection} onRemove={handleAdminRemoveCollection} canRemove={!isSavingAdmin} />
                ))}
              </div>
            ) : <div className="empty-message">Official whitelist is empty.</div>}
          </div>
          <div className="config-section save-workspace-section">
            {hasAdminChanges && <div className="status-indicator pending">Official whitelist has unsaved changes</div>}
            <button className="btn btn-block btn-primary" onClick={handleSaveWhitelist} disabled={isSavingAdmin || !hasAdminChanges}>
              {isSavingAdmin ? "SAVING..." : "Save Official Whitelist"}
            </button>
          </div>
        </div>
      )}
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

import Panel from "./Panel";
import { useProfileCache } from "../../hooks/useProfileCache";
import { useUIStore } from "../../store/useUIStore"; // Updated to use Store
import { isAddress } from "viem";

import "./PanelStyles/NotificationPanel.css";

// --- Helper Functions & Sub-components ---

const formatAddress = (address, length = 6) => {
  if (!address || typeof address !== "string" || !address.startsWith("0x")) {
    return "Unknown Address";
  }
  if (address.length <= length * 2 + 2) {
    return address;
  }
  return `${address.substring(0, length + 2)}...${address.substring(address.length - length)}`;
};

const NotificationItem = ({ notification, onMarkAsRead }) => {
  const { getCachedProfile, getProfileData } = useProfileCache();
  
  // Initialize state
  const [senderName, setSenderName] = useState(() => {
    return notification.sender ? formatAddress(notification.sender) : "Unknown Sender";
  });

  const [followerName, setFollowerName] = useState(() => {
      const addr = notification.decodedPayload?.followerAddress;
      return addr && isAddress(addr) ? formatAddress(addr) : null;
  });

  // Effect to fetch and update sender's profile name
  useEffect(() => {
    const senderAddress = notification.sender;

    if (senderAddress && isAddress(senderAddress)) {
      const cachedProfile = getCachedProfile(senderAddress);

      if (cachedProfile?.name) {
        setSenderName(cachedProfile.name);
      } else if (cachedProfile?.error) {
        setSenderName(`Error (${formatAddress(senderAddress, 4)})`);
      } else {
        const initialName = formatAddress(senderAddress);
        setSenderName(initialName);
        
        getProfileData(senderAddress).then((profileData) => {
          if (profileData?.name) {
            setSenderName(profileData.name);
          }
        }).catch(() => {});
      }
    } else {
      setSenderName("Unknown Sender");
    }
  }, [notification.sender, getProfileData, getCachedProfile]);

  // Effect to fetch and update follower's profile name
  useEffect(() => {
    const followerAddr = notification.decodedPayload?.followerAddress;
    const isFollowerEvent = notification.type === "follower_gained" || notification.type === "follower_lost";

    if (isFollowerEvent && followerAddr && isAddress(followerAddr)) {
      const cachedProfile = getCachedProfile(followerAddr);

      if (cachedProfile?.name) {
        setFollowerName(cachedProfile.name);
      } else if (cachedProfile?.error) {
        setFollowerName(`Error (${formatAddress(followerAddr, 4)})`);
      } else {
        const initialName = formatAddress(followerAddr);
        setFollowerName(initialName);
        
        getProfileData(followerAddr).then((profileData) => {
          if (profileData?.name) {
            setFollowerName(profileData.name);
          }
        }).catch(() => {
            setFollowerName(`Error (${formatAddress(followerAddr, 4)})`);
        });
      }
    } else {
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
    const currentFollowerName = followerName || "Someone";

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
      aria-label={`Notification status: ${notification.read ? 'Read' : 'Unread'}`}
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
  notification: PropTypes.object.isRequired,
  onMarkAsRead: PropTypes.func,
};

const MemoizedNotificationItem = React.memo(NotificationItem);

// --- Main Component ---

const NotificationPanel = ({ onClose }) => {
  // Use Zustand hooks directly
  const notifications = useUIStore((state) => state.notifications);
  const markNotificationRead = useUIStore((state) => state.markNotificationRead);
  const clearAllNotifications = useUIStore((state) => state.clearAllNotifications);

  return (
    <Panel
      title="NOTIFICATIONS"
      onClose={onClose}
      className="panel-from-toolbar notification-panel"
    >
      <div className="panel-header-actions">
        <button
          className="btn btn-sm btn-clear-all"
          onClick={clearAllNotifications}
          disabled={notifications.length === 0}
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
              onMarkAsRead={markNotificationRead}
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
### `src\components\Panels\PanelStyles\EffectsPanel.css`
```css
/* src/components/Panels/PanelStyles/EffectsPanel.css */
@import "../../../styles/variables.css";

.effects-panel .panel-content {
    padding: var(--space-sm);
}

.effect-control-group {
    background: var(--color-primary-a05);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-md);
    overflow: hidden;
    transition: all var(--transition-fast);
}

.effect-control-group.active {
    border-color: var(--color-primary-a50);
    background: var(--color-primary-a10);
    box-shadow: 0 0 10px var(--color-primary-a15);
}

.effect-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    background: rgba(0,0,0,0.2);
}

.effect-label {
    font-weight: bold;
    color: var(--color-primary);
    font-size: var(--font-size-sm);
    letter-spacing: 1px;
}

.toggle-switch {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 18px;
}

.toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
}

.toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0; left: 0; right: 0; bottom: 0;
    background-color: var(--color-bg-light);
    transition: .4s;
    border-radius: 34px;
    border: 1px solid var(--color-border);
}

.toggle-slider:before {
    position: absolute;
    content: "";
    height: 12px;
    width: 12px;
    left: 2px;
    bottom: 2px;
    background-color: var(--color-text-muted);
    transition: .4s;
    border-radius: 50%;
}

input:checked + .toggle-slider {
    background-color: var(--color-primary-a30);
    border-color: var(--color-primary);
}

input:checked + .toggle-slider:before {
    transform: translateX(18px);
    background-color: var(--color-primary);
}

.effect-params {
    padding: var(--space-sm) var(--space-md);
    border-top: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
}

.param-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
}

.param-label {
    font-size: 10px;
    text-transform: uppercase;
    color: var(--color-text-muted);
    width: 60px;
    flex-shrink: 0;
}

.param-slider {
    flex-grow: 1;
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    background: var(--color-bg-light);
    border-radius: 2px;
    outline: none;
}

.param-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    background: var(--color-primary);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 0 5px var(--color-primary-a50);
}

.param-value {
    font-size: 10px;
    font-family: monospace;
    color: var(--color-primary);
    width: 30px;
    text-align: right;
}
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
### `src\components\Panels\PanelStyles\IndustrialPanel.css`
```css
/* src/components/Panels/PanelStyles/IndustrialPanel.css */
@import "../../../styles/variables.css";

.industrial-panel .panel-content {
    padding: var(--space-sm);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
}

/* Master Switch */
.master-switch-container {
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    background: rgba(0,0,0,0.3);
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all 0.3s ease;
}

.master-switch-container.active {
    border-color: var(--color-error);
    background: rgba(var(--color-error-rgb), 0.1);
    box-shadow: 0 0 10px rgba(var(--color-error-rgb), 0.1);
}

.switch-info {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
}

.switch-icon {
    width: 24px;
    color: var(--color-text-muted);
    transition: color 0.3s;
}
.master-switch-container.active .switch-icon {
    color: var(--color-error);
    filter: drop-shadow(0 0 3px var(--color-error));
}

.switch-title {
    font-weight: 800;
    font-size: 13px;
    color: var(--color-text);
    letter-spacing: 1px;
}
.master-switch-container.active .switch-title {
    color: var(--color-error);
}

.switch-subtitle {
    font-size: 9px;
    color: var(--color-text-muted);
    font-family: monospace;
    text-transform: uppercase;
}

.engage-button {
    background: transparent;
    border: 1px solid var(--color-text-muted);
    color: var(--color-text-muted);
    padding: 4px 10px;
    border-radius: 4px;
    font-weight: bold;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 50px;
}

.engage-button:hover {
    border-color: var(--color-text);
    color: var(--color-text);
}

.engage-button.active {
    background: var(--color-error);
    border-color: var(--color-error);
    color: black;
    box-shadow: 0 0 8px var(--color-error);
}
.engage-button.active:hover {
    background: #ff5a5a;
}

/* Global Controls Grid */
.global-controls-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-sm);
    padding: 0 var(--space-xs);
}

.control-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
    align-items: center;
}

.icon-inline {
    width: 10px;
    height: 10px;
    display: inline-block;
    margin-right: 4px;
}

.control-label {
    font-size: 10px;
    font-weight: bold;
    color: var(--color-text-dim);
    letter-spacing: 0.5px;
}

.control-value {
    font-size: 10px;
    font-family: monospace;
    color: var(--color-primary);
}

.master-slider {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    appearance: none;
    outline: none;
}
.master-slider::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    cursor: pointer;
    border: none;
}

.drive-slider { accent-color: var(--color-primary); }
.drive-slider::-webkit-slider-thumb { background: var(--color-primary); }

.chaos-slider { accent-color: var(--color-warning); }
.chaos-slider::-webkit-slider-thumb { background: var(--color-warning); }


/* Patch Bay */
.patch-bay-container {
    background: rgba(0,0,0,0.2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border-dark);
    padding-bottom: 4px;
}

.patch-bay-header {
    display: grid;
    grid-template-columns: 30px 1fr 60px 1fr;
    font-size: 9px;
    color: var(--color-text-dim);
    padding: 6px var(--space-sm);
    text-transform: uppercase;
    font-weight: bold;
    letter-spacing: 0.5px;
    border-bottom: 1px solid var(--color-border-dark);
    background: rgba(255,255,255,0.02);
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.patch-list {
    display: flex;
    flex-direction: column;
}

.patch-row {
    display: grid;
    grid-template-columns: 30px 1fr 60px 1fr;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    transition: background 0.2s;
    border-bottom: 1px solid rgba(255,255,255,0.02);
}
.patch-row:last-child { border-bottom: none; }

.patch-row:hover {
    background: rgba(255,255,255,0.04);
}

.patch-row.enabled {
    background: rgba(var(--color-primary-rgb), 0.03);
}

/* Patch Components */
.patch-toggle {
    display: flex;
    align-items: center;
    cursor: pointer;
}
.patch-toggle input { display: none; }
.toggle-indicator {
    width: 12px;
    height: 12px;
    border: 1px solid var(--color-text-muted);
    border-radius: 2px;
    display: block;
    position: relative;
    transition: all 0.2s;
}
.patch-toggle input:checked + .toggle-indicator {
    background: var(--color-primary);
    border-color: var(--color-primary);
    box-shadow: 0 0 4px var(--color-primary-a50);
}

.patch-name {
    font-weight: bold;
    font-size: 10px;
    color: var(--color-text-muted);
    transition: color 0.2s;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.patch-row.enabled .patch-name {
    color: var(--color-primary);
}

.patch-source {
    display: flex;
    align-items: center;
    gap: 4px;
}

.signal-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--color-primary);
    opacity: 0.2;
    transition: transform 0.05s;
    flex-shrink: 0;
}

.source-select {
    background: transparent;
    color: var(--color-text-muted);
    border: none;
    font-size: 9px;
    padding: 0;
    text-transform: uppercase;
    width: 100%;
    outline: none;
    cursor: pointer;
    font-family: monospace;
}
.source-select:hover { color: var(--color-text); }

.gain-slider {
    width: 100%;
    height: 3px;
    background: rgba(255,255,255,0.1);
    border-radius: 2px;
    appearance: none;
    outline: none;
}
.gain-slider::-webkit-slider-thumb {
    appearance: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-text-muted);
    cursor: pointer;
}
.patch-row.enabled .gain-slider::-webkit-slider-thumb {
    background: var(--color-primary);
}

.panel-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: auto;
    padding-top: 10px;
    border-top: 1px solid var(--color-border-dark);
    font-size: 9px;
    color: var(--color-text-dim);
    letter-spacing: 1px;
}
.footer-icon { width: 14px; opacity: 0.5; }
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

/* Grid for displaying collections - now single column for a list view */
.library-panel .collections-grid {
  display: grid;
  grid-template-columns: 1fr; /* Each card takes the full width */
  gap: var(--space-xs); /* Tighter spacing between items */
}

/* Individual collection card styling - redesigned for horizontal layout */
.library-panel .collection-card {
  background: rgba(0,0,0,0.2);
  border: 1px solid var(--color-border-dark);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  position: relative;
  display: flex; /* Use flexbox for horizontal layout */
  flex-direction: row; /* Align items in a row */
  align-items: center; /* Vertically center image and text */
  padding: var(--space-xs); /* Add some internal padding */
  gap: var(--space-sm); /* Space between image and text block */
}
.library-panel .collection-card:hover {
  border-color: var(--color-primary-a30);
  background: var(--color-primary-a05);
  transform: translateY(-1px); /* More subtle hover effect */
  box-shadow: none; /* Remove box-shadow for a flatter look */
}

/* Image container is now a fixed-size square */
.library-panel .collection-image {
  width: 50px;
  height: 50px;
  flex-shrink: 0; /* Prevent the image from shrinking */
  position: relative;
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  overflow: hidden;
  padding-bottom: 0; /* Remove aspect ratio padding */
}

/* --- ADDED: Ensure links inside image container fill space --- */
.library-panel .collection-image .collection-link {
    display: block;
    width: 100%;
    height: 100%;
}

/* Optional: visual cue for clickable images on hover */
.library-panel .collection-image.is-clickable:hover {
    opacity: 0.8;
    box-shadow: 0 0 8px var(--color-primary-a30);
}
/* ----------------------------------------------------------- */

.library-panel .collection-image img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Info container holds the text and fills remaining space */
.library-panel .collection-info {
  padding: 0;
  flex-grow: 1;
  overflow: hidden; /* Important for text-overflow to work */
  min-width: 0; /* Fix for flexbox overflow issue */
}

.library-panel .collection-name {
  font-size: var(--font-size-md); /* Keep name readable */
  color: var(--color-primary);
  margin: 0 0 2px 0; /* Tighter margin */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis; /* Add ellipsis if name is too long */
}

.library-panel .collection-address {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Remove button is an overlay on the top right */
.library-panel .remove-button {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid var(--color-error-a50);
  color: var(--color-error-a90);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: all var(--transition-fast);
  z-index: 5;
  opacity: 0; /* Hide by default */
}

.library-panel .collection-card:hover .remove-button {
  opacity: 1; /* Show on card hover */
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
/* src/components/Panels/PanelStyles/PanelStyles.css */
@import "../../../styles/variables.css";

.panel {
  /* --- OPTIMIZED GLASSMORPHISM --- */
  background: var(--color-glass-bg-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  
  /* REDUCED BLUR: 50px is too heavy for active rendering. 16px is sufficient. */
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  
  box-shadow: var(--shadow-primary-lg);
  
  /* PERFORMANCE BOOST: Promotes this element to a GPU layer */
  will-change: transform;
  transform: translateZ(0); 
  /* -------------------------------- */
  
  color: var(--color-text);
  overflow: hidden;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  transition: none !important;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  /* Use static color instead of inheriting blur for header to save resources */
  background: rgba(0, 20, 30, 0.6); 
  border-bottom: 1px solid rgba(0, 243, 255, 0.15);
  border-top: none !important;
  box-shadow: none !important;
  position: relative;
  flex-shrink: 0; /* Ensure header never shrinks */
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
  /* IMPORTANT: Ensures scrolling happens on a dedicated layer */
  will-change: scroll-position;
  overscroll-behavior: contain;
}

/* Custom Scrollbar Styling to match theme */
.panel-content::-webkit-scrollbar {
  width: 6px;
}
.panel-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}
.panel-content::-webkit-scrollbar-thumb {
  background: var(--color-primary-a30);
  border-radius: 3px;
}
.panel-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-primary-a50);
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
  z-index: var(--z-panel-active);
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
import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './PanelStyles/PLockController.css';

const PLockController = ({
  pLockState = 'idle',
  // REMOVED: loopProgress prop
  hasLockedParams = false,
  pLockSpeed = 'medium',
  onSetPLockSpeed,
  onTogglePLock,
}) => {
  // NEW: Ref to directly manipulate the DOM bar
  const progressBarRef = useRef(null);

  // NEW: Listen for the high-frequency progress event
  useEffect(() => {
    const handleProgress = (e) => {
        if (progressBarRef.current) {
            // Apply scale directly to transform
            progressBarRef.current.style.transform = `scaleX(${e.detail})`;
        }
    };
    
    // Subscribe
    window.addEventListener('plock-progress', handleProgress);
    return () => window.removeEventListener('plock-progress', handleProgress);
  }, []);

  // Handle static states (reset/full) via effect when React state changes
  useEffect(() => {
      if (progressBarRef.current) {
          if (pLockState === 'armed') {
              progressBarRef.current.style.transform = 'scaleX(1)';
          } else if (pLockState === 'idle') {
              progressBarRef.current.style.transform = 'scaleX(0)';
          }
      }
  }, [pLockState]);

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
              ref={progressBarRef} // Added REF
              className="plock-progress-bar"
              style={{
                // transform is now handled by JS logic above
                transform: pLockState === 'armed' ? 'scaleX(1)' : undefined, // Initial render safety
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
  // loopProgress: PropTypes.number, // Removed
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
            id="create-workspace-btn"
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
    // Don't run if no more data, or refs are missing
    if (!hasMore || !sentinelRef.current || !scrollContainerRef?.current) return;

    const options = {
      root: scrollContainerRef.current, 
      rootMargin: '200px', // Pre-fetch when within 200px of bottom
      threshold: 0.01,
    };

    const observer = new IntersectionObserver(
      (entries) => {
        // Trigger load if sentinel is visible and we aren't currently loading
        if (entries[0].isIntersecting && !isLoading && onLoadMoreRef.current) {
          onLoadMoreRef.current();
        }
      },
      options
    );

    const currentSentinel = sentinelRef.current;
    observer.observe(currentSentinel);

    return () => {
      observer.unobserve(currentSentinel);
      observer.disconnect();
    };
    
    // --- FIX: Added tokens.length and isLoading to dependencies ---
    // This ensures that if new tokens load but don't fill the screen,
    // the observer resets, re-checks, and triggers the next page immediately.
  }, [hasMore, scrollContainerRef, tokens.length, isLoading]);

  if (tokens.length === 0 && !hasMore && !isLoading) {
    return <p className="no-items-message">No tokens found in this collection.</p>;
  }

  return (
    <div className="tokens-grid">
      {tokens.map((token) => (
        <React.Fragment key={token.id}>
          {renderTokenItem(token)}
        </React.Fragment>
      ))}
      
      {/* Sentinel: The invisible line at the bottom we watch for */}
      {hasMore && (
        <div 
            ref={sentinelRef} 
            style={{ 
                height: '20px', 
                width: '100%', 
                gridColumn: '1 / -1', 
                pointerEvents: 'none' 
            }} 
        />
      )}
      
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
import { ArrowPathIcon } from "@heroicons/react/24/outline"; 
import "./PanelStyles/TokenSelectorOverlay.css";

const OPEN_CLOSE_ANIMATION_DURATION = 300;
// Increased page size to help fill the screen and reduce "infinite scroll" bouncing
const PAGE_SIZE = 24; 

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
    stagedSetlist,
    addPalette, removePalette, addTokenToPalette, removeTokenFromPalette,
    configServiceRef,
  } = useWorkspaceContext();

  const {
    ownedTokenIdentifiers,
    tokenFetchProgress,
    officialWhitelist = [],
    refreshOwnedTokens,
    refreshOfficialWhitelist, 
  } = useAssetContext();

  const { updateTokenAssignment } = useVisualEngineContext();
  const { isHostProfileOwner, visitorProfileAddress } = useUserSession();

  const isMountedRef = useRef(false);
  const overlayContentRef = useRef(null);
  const tokenDisplayAreaRef = useRef(null);

  // --- REFRESH HANDLER ---
  const handleManualRefresh = useCallback(() => {
    refreshOfficialWhitelist();
    refreshOwnedTokens(true); 
  }, [refreshOfficialWhitelist, refreshOwnedTokens]);

  const userLibrary = useMemo(() => stagedSetlist?.personalCollectionLibrary || [], [stagedSetlist]);

  // --- UPDATED EFFECT: Prevent aggressive re-fetching ---
  useEffect(() => {
    if (isOpen) {
      if (!officialWhitelist || officialWhitelist.length === 0) {
          refreshOfficialWhitelist();
      }

      // Check if data exists. If so, DO NOT FETCH automatically.
      const hasData = Object.keys(ownedTokenIdentifiers).length > 0;
      
      if (!tokenFetchProgress.loading) {
         if (!hasData) {
             // Pass false to 'force' so caching logic applies
             refreshOwnedTokens(false); 
         } else {
             if (import.meta.env.DEV) {
                 console.log("[TokenSelector] Data exists, skipping auto-fetch to save RPC calls.");
             }
         }
      }
    }
  }, [isOpen]); 

  const demoTokens = useMemo(() => {
    return Object.entries(demoAssetMap).map(([key, src]) => ({
      id: key, type: 'demo', metadata: { name: `Demo ${key.replace("DEMO_LAYER_", "Asset ")}`, image: src }
    }));
  }, []);

  const userPalettes = useMemo(() => stagedSetlist?.userPalettes || {}, [stagedSetlist]);

  useEffect(() => {
    if (!isOpen || !userPalettes || !configServiceRef.current) return;
    const allPaletteTokenIds = Object.values(userPalettes).flat();
    if (allPaletteTokenIds.length === 0) return;

    const fetchMissingPaletteTokens = async () => {
        const currentlyLoadedIds = new Set(Object.values(loadedTokens).flat().map(t => t.id));
        const missingTokenIds = allPaletteTokenIds.filter(id => !currentlyLoadedIds.has(id));
        if (missingTokenIds.length === 0) return;

        try {
            const newTokens = await configServiceRef.current.getTokensMetadataByIds(missingTokenIds);
            if (newTokens && newTokens.length > 0) {
                setLoadedTokens(prev => {
                    const newLoadedTokens = { ...prev };
                    newTokens.forEach(token => {
                        const { address } = token;
                        if (!newLoadedTokens[address]) newLoadedTokens[address] = [];
                        if (!newLoadedTokens[address].some(t => t.id === token.id)) newLoadedTokens[address].push(token);
                    });
                    return newLoadedTokens;
                });
            }
        } catch (e) {
            console.error("Error fetching missing palette tokens:", e);
        }
    };
    fetchMissingPaletteTokens();
  }, [isOpen, userPalettes, configServiceRef, loadedTokens]);

  const combinedCollectionLibrary = useMemo(() => {
    const collectionMap = new Map();
    (officialWhitelist || []).forEach(c => {
        if (c && c.address) {
            collectionMap.set(c.address.toLowerCase(), { ...c, isOfficial: true });
        }
    });
    (userLibrary || []).forEach(c => {
        if (c && c.address && !collectionMap.has(c.address.toLowerCase())) {
            collectionMap.set(c.address.toLowerCase(), { ...c, isOfficial: false });
        }
    });
    return Array.from(collectionMap.values());
  }, [officialWhitelist, userLibrary]);
  
  const combinedTokenMap = useMemo(() => {
    const map = new Map();
    Object.values(loadedTokens).flat().forEach(t => map.set(t.id, t));
    demoTokens.forEach(t => map.set(t.id, t));
    return map;
  }, [loadedTokens, demoTokens]);

  const paletteTokens = useMemo(() => {
    const palettes = {};
    if (userPalettes) {
      for (const paletteName in userPalettes) {
        palettes[paletteName] = userPalettes[paletteName]
          .map(tokenId => combinedTokenMap.get(tokenId))
          .filter(Boolean);
      }
    }
    return palettes;
  }, [combinedTokenMap, userPalettes]);
  
  const sortedCollectionLibrary = useMemo(() => {
    if (!Array.isArray(combinedCollectionLibrary)) return [];
    return [...combinedCollectionLibrary].sort((a, b) => {
      if (collectionSort === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (collectionSort === 'addedAt') {
        return (b.addedAt || 0) - (a.addedAt || 0);
      }
      return 0;
    });
  }, [combinedCollectionLibrary, collectionSort]);

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

            // Logic fix: We only stop loading if we retrieved FEWER items than requested
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
    return (
      <div className={`token-item ${selectedTokens[selectedLayer] === tokenImageSrc ? "selected" : ""}`} onMouseDown={(e) => handleTokenMouseDown(token, e)} onMouseUp={handleMouseUp} title={token.metadata.name}>
        <div className="token-image-container">
          <LazyLoadImage src={tokenImageSrc} alt={token.metadata.name} className="token-image" />
        </div>
        {onAddToPalette && isHostProfileOwner && (<button className="add-to-palette-btn" onClick={(e) => { e.stopPropagation(); onAddToPalette(token); }} onMouseDown={(e) => e.stopPropagation()} title="Add to Palette">+</button>)}
        {onRemoveFromPalette && paletteName && isHostProfileOwner && (<button className="remove-from-palette-btn" onClick={(e) => { e.stopPropagation(); onRemoveFromPalette(paletteName, token.id); }} onMouseDown={(e) => e.stopPropagation()} title="Remove from Palette">-</button>)}
      </div>
    );
  }, [selectedLayer, selectedTokens, handleTokenMouseDown, handleMouseUp, isHostProfileOwner]);

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
          
          <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
            <button className="layer-button" onClick={handleManualRefresh} title="Reload Collections & Tokens">
               <ArrowPathIcon className="layer-button-icon" style={{width:'20px', height:'20px', color: 'var(--color-primary)'}} />
            </button>
            <button className="close-button" onClick={handleClose} aria-label="Close token selector">✕</button>
          </div>
        </div>
        
        <div className="overlay-body">
          {tokenFetchProgress.loading && ( <div className="loading-progress-header"><div className="progress-text">Loading Asset Libraries... ({tokenFetchProgress.loaded} / {tokenFetchProgress.total})</div><div className="progress-bar-container"><div className="progress-bar-fill" style={{ width: `${tokenFetchProgress.total > 0 ? (tokenFetchProgress.loaded / tokenFetchProgress.total) * 100 : 0}%` }}></div></div></div> )}
          <div className="token-display-area" ref={tokenDisplayAreaRef}>
            <div className="token-section palette-section">
              <div className="token-section-header"><h3>My Palettes</h3></div>
              {isHostProfileOwner && (
                <div className="create-palette-form">
                  <input type="text" value={newPaletteName} onChange={(e) => setNewPaletteName(e.target.value)} placeholder="New Palette Name" className="form-control" />
                  <button onClick={handleCreatePalette} className="btn btn-sm" disabled={!newPaletteName.trim()}>Create</button>
                </div>
              )}
              {Object.keys(userPalettes).length > 0 ? (Object.keys(userPalettes).map(paletteName => (<div key={paletteName} className="collection-group"><div className="collection-header"><button onClick={() => toggleSection(paletteName)} className="collection-toggle-button">{paletteName} ({paletteTokens[paletteName]?.length || 0})<span className={`chevron ${expandedSections[paletteName] ? 'expanded' : ''}`}>›</span></button>{isHostProfileOwner && (<button onClick={() => handleRemovePalette(paletteName)} className="delete-palette-btn" title={`Delete "${paletteName}" palette`}>🗑️</button>)}</div>{expandedSections[paletteName] && (<TokenGrid scrollContainerRef={tokenDisplayAreaRef} tokens={paletteTokens[paletteName] || []} renderTokenItem={(token) => renderTokenItem(token, { onRemoveFromPalette: handleRemoveTokenFromPalette, paletteName })} hasMore={false} onLoadMore={()=>{}} isLoading={false} />)}</div>))) : <p className="no-items-message">Create a palette to organize tokens.</p>}
            </div>
            
            <div className="token-section">
              <div className="token-section-header">
                  <h3>My Collections</h3>
                  <div className="sort-controls"><label htmlFor="collection-sort">Sort by:</label><select id="collection-sort" value={collectionSort} onChange={(e) => setCollectionSort(e.target.value)} className="custom-select custom-select-sm"><option value="name">Name</option><option value="addedAt">Date Added</option></select></div>
              </div>
              
              {sortedCollectionLibrary.length > 0 ? (sortedCollectionLibrary.map(collection => (<div key={collection.address} className="collection-group"><button onClick={() => toggleSection(collection.address)} className="collection-header collection-toggle-button">{collection.name} ({(ownedTokenIdentifiers[collection.address]?.length || 0)})<span className={`chevron ${expandedSections[collection.address] ? 'expanded' : ''}`}>›</span></button>{expandedSections[collection.address] && (<TokenGrid scrollContainerRef={tokenDisplayAreaRef} tokens={loadedTokens[collection.address] || []} renderTokenItem={(token) => renderTokenItem(token, { onAddToPalette: handleAddToPaletteClick })} hasMore={hasMoreToLoad[collection.address] || false} onLoadMore={() => loadMoreTokens(collection.address)} isLoading={isLoadingMore[collection.address] || false} />)}</div>))) : 
              <div style={{textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)'}}>
                  <p>{!visitorProfileAddress ? "Connect a profile to see your tokens." : "No collections found."}</p>
                  <p style={{fontSize: '0.8em', marginTop: '5px'}}>If libraries failed to load, click the Refresh icon in the top right.</p>
              </div>
              }
            </div>
            
            <div className="token-section">
              <div className="collection-group"><button onClick={() => toggleSection('demo')} className="collection-header collection-toggle-button">Demo Tokens ({demoTokens.length})<span className={`chevron ${expandedSections['demo'] ? 'expanded' : ''}`}>›</span></button>{expandedSections['demo'] && (<TokenGrid scrollContainerRef={tokenDisplayAreaRef} tokens={demoTokens} renderTokenItem={(token) => renderTokenItem(token, { onAddToPalette: handleAddToPaletteClick })} hasMore={false} onLoadMore={()=>{}} isLoading={false} />)}</div>
            </div>
          </div>
        </div>
      </div>
      {paletteModalState.isOpen && isHostProfileOwner && (<div className="palette-modal-overlay" onClick={(e) => { e.stopPropagation(); setPaletteModalState({ isOpen: false, token: null }); }}><div className="palette-modal-content" onClick={(e) => e.stopPropagation()}><h4>Add to Palette</h4>{Object.keys(userPalettes).length > 0 ? (<div className="palette-list">{Object.keys(userPalettes).map(paletteName => (<button key={paletteName} onClick={() => handleSelectPaletteForToken(paletteName)} className="btn btn-block">{paletteName}</button>))}</div>) : <p>No palettes created yet.</p>}</div></div>)}
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
import { RocketLaunchIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';

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
  isHostProfileOwner = false,
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
  transitionMode,        // Prop for state
  onToggleTransitionMode // Prop for toggle function
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

      {isHostProfileOwner && isUiVisible && (
        <button
          className="toolbar-icon"
          onClick={onWhitelistClick}
          title="Manage Collections Library"
          aria-label="Manage Collections Library"
        >
          <img
            src={whitelistIcon}
            alt="Manage Collections"
            className="icon-image"
          />
        </button>
      )}

      {/* --- PARALLAX TOGGLE --- */}
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

      {/* --- TRANSITION MODE TOGGLE (Moved Next to Parallax) --- */}
      {isUiVisible && onToggleTransitionMode && (
        <button
          className={`toolbar-icon transition-mode-btn ${transitionMode === 'flythrough' ? "active" : ""}`}
          onClick={onToggleTransitionMode}
          title={transitionMode === 'flythrough' ? "Hyperdrift Mode" : "Interpolate Mode"}
          aria-label={transitionMode === 'flythrough' ? "Switch to Interpolate Mode" : "Switch to Hyperdrift Mode"}
        >
          {transitionMode === 'flythrough' ? (
            /* Reduced padding to 3px makes the icon appear larger */
            <RocketLaunchIcon className="icon-image" style={{ padding: '3px' }} />
          ) : (
            <ArrowsRightLeftIcon className="icon-image" style={{ padding: '3px' }} />
          )}
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
  isHostProfileOwner: PropTypes.bool,
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
  transitionMode: PropTypes.string,
  onToggleTransitionMode: PropTypes.func,
};

export default TopRightControls;
```

---
### `src\components\Toolbars\VerticalToolbar.jsx`
```jsx
// src/components/Toolbars/VerticalToolbar.jsx
import React from "react";
import PropTypes from "prop-types";
import { FireIcon } from '@heroicons/react/24/outline';

import "./ToolbarStyles/VerticalToolbar.css";
import {
  controlsIcon,
  notifyIcon,
  listenIcon,
  changetokenIcon,
  writeIcon,
  wavezIcon,
  setsIcon,
  fxIcon,
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
    }
  };

  const buttonPositions = [
    { top: "20px" },  // Controls
    { top: "65px" },  // Notifications
    { top: "110px" }, // Events
    { top: "155px" }, // Tokens
    { top: "200px" }, // FX
    { top: "245px" }, // Sets
    { top: "290px" }, // Save
    { top: "335px" }, // Audio
    { top: "380px" }, // Industrial
  ];

  return (
    <>
      <button className={`vertical-toolbar-icon ${activePanel === "controls" ? "active" : ""}`} onClick={() => handleIconClick("controls")} title="Controls" style={buttonPositions[0]}>
        <img src={controlsIcon} alt="Controls" className="icon-image" />
      </button>

      <button className={`vertical-toolbar-icon ${activePanel === "notifications" ? "active" : ""}`} onClick={() => handleIconClick("notifications")} title="Notifications" style={buttonPositions[1]}>
        <div className="notification-orb">
          <img src={notifyIcon} alt="Notifications" className={`icon-image ${notificationCount > 0 ? "bell-animation" : ""}`} />
          {notificationCount > 0 && <div className="notification-badge">{notificationCount}</div>}
        </div>
      </button>

      <button className={`vertical-toolbar-icon ${activePanel === "events" ? "active" : ""}`} onClick={() => handleIconClick("events")} title="Event Reactions" style={buttonPositions[2]}>
        <img src={listenIcon} alt="Events" className="icon-image" />
      </button>

      <button className={`vertical-toolbar-icon ${activePanel === "tokens" ? "active" : ""}`} onClick={() => handleIconClick("tokens")} title="Select Token" style={buttonPositions[3]}>
        <img src={changetokenIcon} alt="Tokens" className="icon-image" />
      </button>

      <button className={`vertical-toolbar-icon ${activePanel === "fx" ? "active" : ""}`} onClick={() => handleIconClick("fx")} title="Global Effects" style={buttonPositions[4]}>
        <img src={fxIcon || wavezIcon} alt="Effects" className="icon-image" /> 
      </button>

      <button className={`vertical-toolbar-icon ${activePanel === "sets" ? "active" : ""}`} onClick={() => handleIconClick("sets")} title="Setlist" style={buttonPositions[5]}>
        <img src={setsIcon} alt="Sets" className="icon-image" />
      </button>

      <button className={`vertical-toolbar-icon ${activePanel === "save" ? "active" : ""}`} onClick={() => handleIconClick("save")} title="Save" style={buttonPositions[6]}>
        <img src={writeIcon} alt="Save" className="icon-image" />
      </button>

      <button className={`vertical-toolbar-icon ${activePanel === "audio" ? "active" : ""}`} onClick={() => handleIconClick("audio")} title="Audio" style={buttonPositions[7]}>
        <img src={wavezIcon} alt="Audio" className="icon-image" />
      </button>

      {/* --- NEW INDUSTRIAL BUTTON --- */}
      <button 
        className={`vertical-toolbar-icon ${activePanel === "industrial" ? "active" : ""}`} 
        onClick={() => handleIconClick("industrial")} 
        title="Signal Router (Overdrive)" 
        style={buttonPositions[8]}
      >
        <FireIcon className="icon-image" style={{padding: '4px', color: 'var(--color-error)'}} />
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
import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './Crossfader.css';

const Crossfader = ({ value, onInput, onChange, disabled = false }) => {
  const inputRef = useRef(null);
  const isDragging = useRef(false);

  // 1. Listen for high-frequency updates from VisualEngineContext (Zero-Render)
  useEffect(() => {
    const handleUpdate = (e) => {
      // Only update DOM if user isn't currently dragging the handle
      if (!isDragging.current && inputRef.current) {
        inputRef.current.value = e.detail;
      }
    };
    window.addEventListener('radar-crossfader-update', handleUpdate);
    return () => window.removeEventListener('radar-crossfader-update', handleUpdate);
  }, []);

  // 2. Sync with initial/low-frequency React prop updates (e.g. on load)
  useEffect(() => {
    if (!isDragging.current && inputRef.current) {
      inputRef.current.value = value;
    }
  }, [value]);

  const handleOnInput = (e) => {
    isDragging.current = true;
    if (onInput) {
      // Pass value directly to engine
      onInput(e.target.valueAsNumber);
    }
  };

  const handleOnChange = (e) => {
    isDragging.current = false;
    if (onChange) {
      // Commit final value
      onChange(e.target.valueAsNumber);
    }
  };

  return (
    <div className="crossfader-container">
      <input
        ref={inputRef}
        type="range"
        min="0"
        max="1"
        step="0.001"
        defaultValue={value} 
        onInput={handleOnInput}
        onChange={handleOnChange} 
        onPointerUp={handleOnChange} 
        className="crossfader-slider"
        disabled={disabled}
      />
    </div>
  );
};

Crossfader.propTypes = {
  value: PropTypes.number.isRequired,
  onInput: PropTypes.func,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
};

export default React.memo(Crossfader);
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
### `src\components\UI\PerformanceSlider.jsx`
```jsx
// src/components/UI/PerformanceSlider.jsx
import React, { useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';

/**
 * PerformanceSlider (Zero-Render Edition)
 * 
 * This component bypasses React state updates entirely during user interaction.
 * It treats the input as "uncontrolled" during the drag operation, relying
 * on the browser's native UI thread for 60fps handle movement.
 * 
 * It also listens to a custom window event to update itself during external 
 * high-frequency animations (like P-Lock sequencer) without re-rendering.
 */
const PerformanceSlider = ({ 
  name,
  layerId, // NEW: Needed for event filtering
  value, 
  min, 
  max, 
  step, 
  onChange, // Fast update (Pixi)
  onCommit, // Slow update (Store)
  disabled, 
  className,
  ariaLabel 
}) => {
  const inputRef = useRef(null);
  const isDragging = useRef(false);

  // Sync with external React prop changes (e.g. Scene load, Undo/Redo)
  useEffect(() => {
    if (!isDragging.current && inputRef.current) {
      inputRef.current.value = value;
    }
  }, [value]);

  // Sync with high-frequency Event updates (P-Lock, MIDI)
  useEffect(() => {
    const handleParamUpdate = (e) => {
      const { layerId: targetLayer, param, value: newValue } = e.detail;
      // Update only if this event targets this specific slider instance
      if (targetLayer === String(layerId) && param === name) {
         if (!isDragging.current && inputRef.current) {
             inputRef.current.value = newValue;
         }
      }
    };
    
    window.addEventListener('radar-param-update', handleParamUpdate);
    return () => window.removeEventListener('radar-param-update', handleParamUpdate);
  }, [layerId, name]);

  const handleInput = useCallback((e) => {
    isDragging.current = true;
    const val = parseFloat(e.target.value);
    
    // Direct pass-through to engine. No React Render happens here.
    if (onChange) {
      onChange(name, val);
    }
  }, [name, onChange]);

  const handleCommit = useCallback((e) => {
    isDragging.current = false;
    const val = parseFloat(e.target.value);

    // Commit to Zustand/React State ONLY on release/interaction end
    if (onCommit) {
      onCommit(name, val);
    }
  }, [name, onCommit]);

  return (
    <input
      ref={inputRef}
      type="range"
      name={name}
      min={min}
      max={max}
      step={step}
      defaultValue={value} 
      onInput={handleInput} 
      onPointerUp={handleCommit}
      onKeyUp={handleCommit}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
    />
  );
};

PerformanceSlider.propTypes = {
  name: PropTypes.string.isRequired,
  layerId: PropTypes.string.isRequired, // Ensure this is passed
  value: PropTypes.number,
  min: PropTypes.number.isRequired,
  max: PropTypes.number.isRequired,
  step: PropTypes.number.isRequired,
  onChange: PropTypes.func,
  onCommit: PropTypes.func,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  ariaLabel: PropTypes.string
};

export default React.memo(PerformanceSlider);
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
import './Startveil.css';

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
  /* Passthrough for layout positioning context */
}

/* --- Transition Mode Toggle (Hyperdrift/Interpolate) --- */

/* Ensure the button icon is white */
.transition-mode-btn {
  color: #ffffff !important;
}

/* Target the HeroIcon SVG specifically */
.transition-mode-btn .icon-image {
  color: #ffffff !important;
  stroke: #ffffff !important; /* HeroIcons outline uses stroke */
  opacity: 0.9;
  transition: all var(--transition-fast);
}

.transition-mode-btn:hover .icon-image {
  opacity: 1;
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.5));
}

.transition-mode-btn.active {
  border-color: var(--color-primary);
  background: var(--color-primary-a15);
  box-shadow: var(--shadow-primary-md);
}

/* --- Preview Mode Indicator --- */
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
import EffectsPanel from '../Panels/EffectsPanel';
import Crossfader from './Crossfader';
import WorkspaceSelectorDots from './WorkspaceSelectorDots';
import IndustrialPanel from '../Panels/IndustrialPanel'; // --- NEW IMPORT ---

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
      sequencerIntervalMs, onSetSequencerInterval, 
      crossfadeDurationMs, onSetCrossfadeDuration, 
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
        case "fx":
            return ( <PanelWrapper key="fx-panel" className={panelWrapperClassName}><EffectsPanel onClose={closePanel} /></PanelWrapper> );
        // --- NEW: INDUSTRIAL PANEL ---
        case "industrial":
            return ( <PanelWrapper key="industrial-panel" className={panelWrapperClassName}><IndustrialPanel onClose={closePanel} /></PanelWrapper> );
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
  isReady = false,
  actions,
  configData,
  crossfadeDurationMs,
  onSetCrossfadeDuration,
}) {
  const { addToast } = useToast();
  const { stagedSetlist, loadWorkspace, activeWorkspaceName: currentWorkspaceName, isLoading: isConfigLoading, activeSceneName, fullSceneList: savedSceneList } = useWorkspaceContext();
  
  const { renderedCrossfaderValue, isAutoFading, handleSceneSelect, handleCrossfaderChange, handleCrossfaderCommit, transitionMode, toggleTransitionMode } = useVisualEngineContext();
  
  const { unreadCount } = useNotificationContext();
  const { isRadarProjectAdmin, hostProfileAddress: currentProfileAddress, isHostProfileOwner } = useUserSession();
  const { isUiVisible, activePanel, toggleSidePanel, toggleInfoOverlay, toggleUiVisibility } = uiState;
  const { isAudioActive } = audioState;
  
  const { onEnhancedView, onToggleParallax, onPreviewEffect } = actions;
  const [isSequencerActive, setIsSequencerActive] = useState(false);
  const sequencerTimeoutRef = useRef(null);
  const nextSceneIndexRef = useRef(0);
  const isMountedRef = useRef(false);

  const [sequencerIntervalMs, setSequencerIntervalMs] = useState(DEFAULT_SEQUENCER_INTERVAL);

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
      } else {
        addToast('Sequencer stopped.', 'info', 2000);
        if (sequencerTimeoutRef.current) clearTimeout(sequencerTimeoutRef.current);
      }
      return isActivating;
    });
  };

  const shouldShowUI = useMemo(() => isReady, [isReady]);
  const showSceneBar = useMemo(() => shouldShowUI && isUiVisible && !activePanel && !!currentProfileAddress, [shouldShowUI, isUiVisible, activePanel, currentProfileAddress]);
  const mainUiContainerClass = `ui-elements-container ${shouldShowUI && isUiVisible ? "visible" : "hidden-by-opacity"}`;

  if (!isReady) {
    return null;
  }
  
  return (
    <>
      {isReady && <MemoizedTopRightControls
        isRadarProjectAdmin={isRadarProjectAdmin}
        isHostProfileOwner={isHostProfileOwner}
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
        transitionMode={transitionMode}
        onToggleTransitionMode={toggleTransitionMode}
      />}
      {isUiVisible && <MemoizedActivePanelRenderer
          uiState={uiState}
          audioState={audioState}
          pLockProps={pLockProps}
          onPreviewEffect={onPreviewEffect}
          sequencerIntervalMs={sequencerIntervalMs}
          onSetSequencerInterval={setSequencerIntervalMs}
          crossfadeDurationMs={crossfadeDurationMs}
          onSetCrossfadeDuration={onSetCrossfadeDuration}
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
                  onChange={handleCrossfaderCommit}
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
  version: "1.2", // Incremented version
  layers: {
    1: { // Bottom Layer
      enabled: true,
      speed: 0.010,
      size: 1.0,
      xaxis: -1500,
      yaxis: -1240,
      drift: 0.4,
      direction: -1,
      angle: -194.2,
      blendMode: "exclusion",
      driftSpeed: 0.3,
      opacity: 0.25,
    },
    2: { // Middle Layer
      enabled: true,
      speed: 0.010,
      size: 1.0,
      xaxis: 1083,
      yaxis: 583,
      drift: 0.5,
      direction: -1,
      angle: -90.0,
      blendMode: "overlay",
      driftSpeed: 0.4,
      opacity: 0.30,
    },
    3: { // Top Layer
      enabled: true,
      speed: 0.010,
      size: 0.6,
      xaxis: -667,
      yaxis: 833,
      drift: 15.4,
      direction: 1,
      angle: 63.4,
      blendMode: "normal",
      driftSpeed: 0.3,
      opacity: 1.00,
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
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { keccak256, stringToBytes } from "viem";
import { useWorkspaceContext } from './WorkspaceContext';
import { useUserSession } from './UserSessionContext';
import { useToast } from './ToastContext';
import { RADAR_OFFICIAL_ADMIN_ADDRESS, IPFS_GATEWAY } from "../config/global-config";
import { hexToUtf8Safe } from "../services/ConfigurationService";

const OFFICIAL_WHITELIST_KEY = keccak256(stringToBytes("RADAR.OfficialWhitelist"));
const TOKEN_CACHE_DURATION_MS = 5 * 60 * 1000; // 5 Minutes

const AssetContext = createContext();

export const AssetProvider = ({ children }) => {
  const { configServiceRef, configServiceInstanceReady, stagedSetlist } = useWorkspaceContext();
  const { hostProfileAddress, visitorProfileAddress, isRadarProjectAdmin } = useUserSession();
  const { addToast } = useToast();

  const [officialWhitelist, setOfficialWhitelist] = useState([]);
  const [ownedTokenIdentifiers, setOwnedTokenIdentifiers] = useState({});
  const [isFetchingTokens, setIsFetchingTokens] = useState(false);
  const [tokenFetchProgress, setTokenFetchProgress] = useState({ loaded: 0, total: 0, loading: false });
  
  const [lastFetchTimestamp, setLastFetchTimestamp] = useState(0);
  const prevCollectionCountRef = useRef(0);

  useEffect(() => {
    setOwnedTokenIdentifiers({});
    setLastFetchTimestamp(0);
    setTokenFetchProgress({ loaded: 0, total: 0, loading: false });
    prevCollectionCountRef.current = 0;
  }, [hostProfileAddress, visitorProfileAddress]);

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

  const refreshOwnedTokens = useCallback(async (force = false, isSilent = false) => {
    const service = configServiceRef.current;
    if (!service || !service.checkReadyForRead()) return;

    // effectiveAddress is the profile we are viewing (either our own, or one we are visiting)
    const effectiveAddress = hostProfileAddress || visitorProfileAddress;
    
    // Combine official + personal libraries into one list to scan
    // We explicitly tag them to know which strategy to use later
    const userLibrary = stagedSetlist?.personalCollectionLibrary || [];
    const combinedCollectionsMap = new Map();
    
    // Add Official Collections (Tag as Official)
    officialWhitelist.forEach(c => {
        if (c && c.address) {
            combinedCollectionsMap.set(c.address.toLowerCase(), { ...c, _isOfficial: true });
        }
    });
    
    // Add Personal Collections (Tag as NOT Official)
    // Note: If a collection is in both, Official takes precedence (set first)
    userLibrary.forEach(c => {
        if (c && c.address && !combinedCollectionsMap.has(c.address.toLowerCase())) {
            combinedCollectionsMap.set(c.address.toLowerCase(), { ...c, _isOfficial: false });
        }
    });
    const allCollections = Array.from(combinedCollectionsMap.values());

    // --- CACHE CHECK ---
    const collectionCountChanged = allCollections.length !== prevCollectionCountRef.current;
    if (!force && !collectionCountChanged && lastFetchTimestamp > 0 && (Date.now() - lastFetchTimestamp < TOKEN_CACHE_DURATION_MS)) {
        if (import.meta.env.DEV) console.log("[AssetContext] Skipping token fetch (Cache Valid & RPC Protection)");
        return;
    }

    if (!effectiveAddress || allCollections.length === 0) {
      setOwnedTokenIdentifiers({});
      return;
    }

    setIsFetchingTokens(true);
    setTokenFetchProgress({ loaded: 0, total: allCollections.length, loading: true });
    
    if (!isSilent && (force || collectionCountChanged)) {
       addToast("Syncing library...", "info", 1500);
    }

    try {
      // --- LOGIC SPLIT: SHOWCASE VS USER MODE ---
      
      // Showcase Mode: ONLY if the currently viewed profile IS the Official Admin Address
      const isAdminShowcase = hostProfileAddress?.toLowerCase() === RADAR_OFFICIAL_ADMIN_ADDRESS.toLowerCase();
      
      let newIdentifierMap = {};

      if (isAdminShowcase) {
        // === ADMIN HYBRID MODE ===
        if (import.meta.env.DEV) console.log("[AssetContext] Running in ADMIN MODE (Hybrid Fetch)");
        
        for (const collection of allCollections) {
            const standard = await service.detectCollectionStandard(collection.address);
            let identifiers = [];
            
            if (standard === 'LSP8') {
                if (collection._isOfficial) {
                    // CASE A: Official Collection -> SHOWCASE ALL (Total Supply)
                    if (import.meta.env.DEV) console.log(`[AssetContext] Fetching FULL supply for Official: ${collection.name}`);
                    identifiers = await service.getAllLSP8TokenIdsForCollection(collection.address);
                    
                    // Fallback: If total supply scan returns 0 (e.g. enumerable issue), try owned
                    if (identifiers.length === 0) {
                        identifiers = await service.getOwnedLSP8TokenIdsForCollection(effectiveAddress, collection.address);
                    }
                } else {
                    // CASE B: Personal Collection -> USER OWNED ONLY
                    if (import.meta.env.DEV) console.log(`[AssetContext] Fetching OWNED only for Personal: ${collection.name}`);
                    identifiers = await service.getOwnedLSP8TokenIdsForCollection(effectiveAddress, collection.address);
                }
            } else if (standard === 'LSP7') {
                const balance = await service.getLSP7Balance(effectiveAddress, collection.address);
                if (balance > 0) identifiers.push('LSP7_TOKEN');
            }
            
            if (identifiers.length > 0) newIdentifierMap[collection.address] = identifiers;
            setTokenFetchProgress(prev => ({ ...prev, loaded: prev.loaded + 1 }));
        }
      } else {
        // === USER MODE ===
        // Fetches ONLY tokens owned by 'effectiveAddress' (using tokenIdsOf).
        if (import.meta.env.DEV) console.log("[AssetContext] Running in USER MODE (Fetching Owned Tokens Only)");
        
        // This function inside ConfigurationService strictly uses 'tokenIdsOf'
        newIdentifierMap = await service.getBatchCollectionData(effectiveAddress, allCollections);
      }
      
      setOwnedTokenIdentifiers(newIdentifierMap);
      setLastFetchTimestamp(Date.now());
      prevCollectionCountRef.current = allCollections.length;

      if (!isSilent && (force || collectionCountChanged)) {
        const totalIds = Object.values(newIdentifierMap).reduce((sum, ids) => sum + ids.length, 0);
        addToast(`Library sync complete: ${totalIds} assets.`, "success", 2000);
      }
    } catch (error) {
      console.error("Failed to refresh owned token identifiers:", error);
    } finally {
      setIsFetchingTokens(false);
      setTokenFetchProgress(prev => ({ ...prev, loading: false }));
    }
  }, [hostProfileAddress, visitorProfileAddress, isRadarProjectAdmin, officialWhitelist, addToast, configServiceRef, stagedSetlist, lastFetchTimestamp]);

  const contextValue = useMemo(() => ({
    officialWhitelist,
    refreshOfficialWhitelist,
    ownedTokenIdentifiers,
    isFetchingTokens,
    tokenFetchProgress,
    refreshOwnedTokens,
  }), [officialWhitelist, refreshOfficialWhitelist, ownedTokenIdentifiers, isFetchingTokens, tokenFetchProgress, refreshOwnedTokens]);

  return (
    <AssetContext.Provider value={contextValue}>
      {children}
    </AssetContext.Provider>
  );
};

AssetProvider.propTypes = { children: PropTypes.node.isRequired };
export const useAssetContext = () => {
  const context = useContext(AssetContext);
  if (context === undefined) throw new Error("useAssetContext must be used within an AssetProvider");
  return context;
};
```

---
### `src\context\MIDIContext.jsx`
```jsx
// src/context/MIDIContext.jsx
import React, { createContext, useContext, useEffect, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useWorkspaceContext } from './WorkspaceContext';
import { useEngineStore } from '../store/useEngineStore';

const MIDI_CONNECT_TIMEOUT_MS = 10000;

const MIDIContext = createContext(null);

const normalizeMIDIValue = (value, type = 'cc') => {
  if (type === 'pitchbend') return Math.max(0, Math.min(1, value / 16383));
  return Math.max(0, Math.min(1, value / 127));
};

const getMidiMessageType = (status) => {
  const type = status & 0xF0;
  switch (type) {
    case 0x80: return 'Note Off';
    case 0x90: return 'Note On';
    case 0xB0: return 'Control Change';
    case 0xC0: return 'Program Change';
    case 0xD0: return 'Channel Aftertouch';
    case 0xE0: return 'Pitch Bend';
    case 0xF0: return 'System';
    default: return `Unknown (${type.toString(16)})`;
  }
};

export function MIDIProvider({ children }) {
  const { stagedSetlist, updateGlobalMidiMap, updateLayerMidiMappings } = useWorkspaceContext();
  
  // NOTE: We do NOT destructure state here to avoid Provider re-renders on high-freq MIDI data.
  // We use getState() inside callbacks.
  
  const activeMidiMap = useMemo(() => stagedSetlist?.globalUserMidiMap || {}, [stagedSetlist]);
  const layerMappings = useMemo(() => activeMidiMap?.layerSelects || {}, [activeMidiMap]);

  // Refs for event listener callback
  const stateRefs = useRef({
      activeMidiMap,
      layerMappings
  });

  useEffect(() => {
      stateRefs.current = { activeMidiMap, layerMappings };
  }, [activeMidiMap, layerMappings]);

  const connectionInProgressRef = useRef(false);
  const connectTimeoutRef = useRef(null);
  const midiAccessRef = useRef(null);

  const handleMIDIMessage = useCallback((message) => {
    if (!message || !message.data) return;
    const [status, data1, data2] = message.data;
    const msgChan = status & 0x0F;
    const msgType = getMidiMessageType(status);
    
    // Direct Store Writes
    const store = useEngineStore.getState();
    const { 
        midiLearning, learningLayer, selectedChannel, 
        addMidiMonitorData, setMidiLearning, setLearningLayer, 
        queueMidiAction 
    } = store;

    addMidiMonitorData({ 
        timestamp: new Date().toLocaleTimeString(), 
        status, data1, data2, channel: msgChan + 1, type: msgType 
    });

    if (selectedChannel > 0 && (msgChan + 1) !== selectedChannel) return;

    const { activeMidiMap, layerMappings } = stateRefs.current;
    
    const isCC = (status & 0xF0) === 0xB0;
    const isNoteOn = (status & 0xF0) === 0x90 && data2 > 0;
    const isPitch = (status & 0xF0) === 0xE0;

    // Learning Mode
    if (midiLearning) {
      if (isCC || isNoteOn || isPitch) {
        const mappingData = { type: isCC ? 'cc' : (isNoteOn ? 'note' : 'pitchbend'), number: data1, channel: msgChan };
        
        if (midiLearning.type === 'param') {
            const currentMap = activeMidiMap || {};
            const updated = { 
                ...currentMap, 
                [String(midiLearning.layer)]: { 
                    ...(currentMap[String(midiLearning.layer)] || {}), 
                    [midiLearning.param]: mappingData 
                } 
            };
            updateGlobalMidiMap(updated);
        } else if (midiLearning.type === 'global') {
            const currentMap = activeMidiMap || {};
            const updated = { 
                ...currentMap, 
                global: { 
                    ...(currentMap.global || {}), 
                    [midiLearning.control]: mappingData 
                } 
            };
            updateGlobalMidiMap(updated);
        }
        setMidiLearning(null);
      }
      return;
    }

    if (learningLayer !== null) {
      if (isNoteOn) {
        updateLayerMidiMappings(learningLayer, { type: 'note', number: data1, channel: msgChan });
        setLearningLayer(null);
      }
      return;
    }

    // Execution Mode
    if (activeMidiMap.global) {
        const cfMap = activeMidiMap.global['crossfader'];
        if (cfMap) {
            let isMatch = false;
            let rawValue = data2;
            let type = 'cc';

            if (cfMap.type === 'cc' && isCC && cfMap.number === data1 && (cfMap.channel === undefined || cfMap.channel === msgChan)) {
                isMatch = true;
            } else if (cfMap.type === 'pitchbend' && isPitch && (cfMap.channel === undefined || cfMap.channel === msgChan)) {
                isMatch = true;
                rawValue = (data2 << 7) | data1;
                type = 'pitchbend';
            }

            if (isMatch) {
                const val = normalizeMIDIValue(rawValue, type);
                store.setCrossfader(val);
                return;
            }
        }

        const actions = [
            { key: 'nextScene', type: 'nextScene' },
            { key: 'prevScene', type: 'prevScene' },
            { key: 'nextWorkspace', type: 'nextWorkspace' },
            { key: 'prevWorkspace', type: 'prevWorkspace' },
            { key: 'pLockToggle', type: 'globalAction', action: 'pLockToggle' }
        ];

        for (const actionDef of actions) {
            const mapping = activeMidiMap.global[actionDef.key];
            if (mapping && 
               ((mapping.type === 'note' && isNoteOn) || (mapping.type === 'cc' && isCC)) && 
               mapping.number === data1 && 
               (mapping.channel === undefined || mapping.channel === msgChan)) {
                
                queueMidiAction(actionDef.action ? { type: actionDef.type, action: actionDef.action } : { type: actionDef.type });
                return;
            }
        }
    }

    if (isNoteOn) {
        for (const layerId in layerMappings) {
            const lsm = layerMappings[layerId];
            if (lsm && lsm.type === 'note' && lsm.number === data1 && (lsm.channel === undefined || lsm.channel === msgChan)) {
                queueMidiAction({ type: 'layerSelect', layer: parseInt(layerId, 10) });
                return;
            }
        }
    }

    for (const layerIdStr in activeMidiMap) {
        if (layerIdStr === 'global' || layerIdStr === 'layerSelects') continue;
        const layerParams = activeMidiMap[layerIdStr];
        
        for (const paramName in layerParams) {
            const mapping = layerParams[paramName];
            if (!mapping) continue;

            let isMatch = false;
            let rawValue = data2;
            let type = 'cc';

            if (mapping.type === 'cc' && isCC && mapping.number === data1 && (mapping.channel === undefined || mapping.channel === msgChan)) {
                isMatch = true;
            } else if (mapping.type === 'pitchbend' && isPitch && (mapping.channel === undefined || mapping.channel === msgChan)) {
                isMatch = true;
                rawValue = (data2 << 7) | data1;
                type = 'pitchbend';
            } else if (mapping.type === 'note' && isNoteOn && mapping.number === data1 && (mapping.channel === undefined || mapping.channel === msgChan)) {
                isMatch = true;
            }

            if (isMatch) {
                const normalized = normalizeMIDIValue(rawValue, type);
                queueMidiAction({ type: 'paramUpdate', layer: parseInt(layerIdStr, 10), param: paramName, value: normalized });
                return;
            }
        }
    }

  }, [updateGlobalMidiMap, updateLayerMidiMappings]);

  const connectMIDI = useCallback(async () => {
      if (connectionInProgressRef.current) return;
      if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
          useEngineStore.getState().setMidiConnectionStatus(false, false, "Web MIDI API not supported");
          return;
      }
      
      connectionInProgressRef.current = true;
      useEngineStore.getState().setMidiConnectionStatus(false, true, null);

      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = setTimeout(() => {
          if (connectionInProgressRef.current) {
              useEngineStore.getState().setMidiConnectionStatus(false, false, "Connection timed out");
              connectionInProgressRef.current = false;
          }
      }, MIDI_CONNECT_TIMEOUT_MS);

      try {
          const access = await navigator.requestMIDIAccess({ sysex: false });
          if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
          
          midiAccessRef.current = access;
          useEngineStore.getState().setMidiAccess(access);
          
          const inputs = [];
          access.inputs.forEach(input => {
              inputs.push({ id: input.id, name: input.name, state: input.state });
              input.onmidimessage = handleMIDIMessage;
          });
          
          useEngineStore.getState().setMidiInputs(inputs);
          useEngineStore.getState().setMidiConnectionStatus(true, false, null);
          
          access.onstatechange = (e) => {
              const newInputs = [];
              e.target.inputs.forEach(i => {
                  newInputs.push({ id: i.id, name: i.name, state: i.state });
                  if (i.state === 'connected' && !i.onmidimessage) {
                      i.onmidimessage = handleMIDIMessage;
                  }
              });
              useEngineStore.getState().setMidiInputs(newInputs);
          };

      } catch (e) {
          if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
          useEngineStore.getState().setMidiConnectionStatus(false, false, e.message || "Failed to access MIDI");
      } finally {
          connectionInProgressRef.current = false;
      }
  }, [handleMIDIMessage]);

  const disconnectMIDI = useCallback((force = false) => {
      if (midiAccessRef.current) {
          midiAccessRef.current.inputs.forEach(input => input.onmidimessage = null);
          midiAccessRef.current.onstatechange = null;
      }
      useEngineStore.getState().setMidiAccess(null);
      useEngineStore.getState().setMidiConnectionStatus(false, false, null);
      connectionInProgressRef.current = false;
  }, []);

  useEffect(() => {
      return () => disconnectMIDI(true);
  }, [disconnectMIDI]);

  const contextValue = {
      connectMIDI,
      disconnectMIDI,
      midiMap: activeMidiMap,
      layerMappings,
      startMIDILearn: (param, layer) => useEngineStore.getState().setMidiLearning({ type: 'param', param, layer }),
      startGlobalMIDILearn: (control) => useEngineStore.getState().setMidiLearning({ type: 'global', control }),
      stopMIDILearn: () => useEngineStore.getState().setMidiLearning(null),
      startLayerMIDILearn: (layer) => useEngineStore.getState().setLearningLayer(layer),
      stopLayerMIDILearn: () => useEngineStore.getState().setLearningLayer(null),
      clearAllMappings: () => {
          if (window.confirm("Reset all MIDI mappings?")) {
              updateGlobalMidiMap({});
          }
      },
      midiStateRef: { current: { liveCrossfaderValue: 0 } }
  };

  return <MIDIContext.Provider value={contextValue}>{children}</MIDIContext.Provider>;
}

MIDIProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

export const useMIDI = () => {
    const context = useContext(MIDIContext);
    if (!context) throw new Error("useMIDI must be used within a MIDIProvider");
    const store = useEngineStore();
    return { ...context, ...store };
};
```

---
### `src\context\NotificationContext.jsx`
```jsx
import { useUIStore } from '../store/useUIStore';

// Adapter to maintain API compatibility
export const useNotificationContext = () => {
  const notifications = useUIStore((state) => state.notifications);
  const addNotification = useUIStore((state) => state.addNotification);
  const onMarkNotificationRead = useUIStore((state) => state.markNotificationRead);
  const onClearAllNotifications = useUIStore((state) => state.clearAllNotifications);
  
  // Calculate unread count efficiently
  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    addNotification,
    onMarkNotificationRead,
    onClearAllNotifications,
    unreadCount,
  };
};

export const NotificationProvider = ({ children }) => children;
```

---
### `src\context\SceneContext.jsx`
```jsx
// src/context/SceneContext.jsx
import React, { createContext, useContext } from 'react';
import { useWorkspaceContext } from './WorkspaceContext';

const SceneContext = createContext();

export const SceneProvider = ({ children }) => {
    // We simply pass the WorkspaceContext value down, 
    // because WorkspaceContext now includes all the Scene logic via the Store.
    const workspaceCtx = useWorkspaceContext();
    
    return (
        <SceneContext.Provider value={workspaceCtx}>
            {children}
        </SceneContext.Provider>
    );
};

export const useSceneContext = () => {
    // Redirect to WorkspaceContext, which now holds the consolidated store data
    const context = useContext(SceneContext);
    if (!context) {
        // Fallback if accessed outside provider (shouldn't happen in tree)
        throw new Error("useSceneContext must be used within a SceneProvider");
    }
    return context;
};
```

---
### `src\context\ToastContext.jsx`
```jsx
import { useUIStore } from '../store/useUIStore';

// Adapter to maintain API compatibility
export const useToast = () => {
  const addToast = useUIStore((state) => state.addToast);
  const removeToast = useUIStore((state) => state.removeToast);
  const toasts = useUIStore((state) => state.toasts);

  return { addToast, removeToast, toasts };
};

// Fake Provider to keep main.jsx happy until we clean it
export const ToastProvider = ({ children }) => children;
```

---
### `src\context\UpProvider.jsx`
```jsx
// src/context/UpProvider.jsx
import React, { createContext, useContext, useEffect } from "react";
import { useWalletStore } from "../store/useWalletStore";
import { useShallow } from 'zustand/react/shallow';

const UpContext = createContext(undefined);

export function useUpProvider() {
  const context = useContext(UpContext);
  if (context === undefined) {
    throw new Error("useUpProvider must be used within an UpProvider.");
  }
  return context;
}

export function UpProvider({ children }) {
  const initWallet = useWalletStore((state) => state.initWallet);
  
  // FIX: Wrapped selector in useShallow to prevent infinite re-renders
  const state = useWalletStore(useShallow((s) => ({
    provider: s.provider,
    walletClient: s.walletClient,
    publicClient: s.publicClient,
    chainId: s.chainId,
    accounts: s.accounts,
    contextAccounts: s.contextAccounts,
    walletConnected: s.isWalletConnected,
    isConnecting: false, // Deprecated but kept for compatibility
    initializationError: s.initializationError,
    fetchStateError: s.fetchStateError,
    hasCriticalError: !!s.initializationError,
  })));

  // Initialize once on mount
  useEffect(() => {
    initWallet();
  }, [initWallet]);

  return (
    <UpContext.Provider value={state}>
      {children}
    </UpContext.Provider>
  );
}
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
import React, { createContext, useContext, useMemo } from 'react';
import { useWalletStore } from '../store/useWalletStore';

const UserSessionContext = createContext(null);

export const UserSessionProvider = ({ children }) => {
  // Use a shallow selector or pick fields individually to prevent re-renders if unrelated store data changes
  const hostProfileAddress = useWalletStore(s => s.hostProfileAddress);
  const loggedInUserUPAddress = useWalletStore(s => s.loggedInUserUPAddress);
  const isHostProfileOwner = useWalletStore(s => s.isHostProfileOwner);
  const isRadarProjectAdmin = useWalletStore(s => s.isRadarProjectAdmin);
  const isPreviewMode = useWalletStore(s => s.isPreviewMode);
  
  const togglePreviewMode = useWalletStore(s => s.togglePreviewMode);

  const canSaveToHostProfile = useMemo(() => {
    return isHostProfileOwner && !isPreviewMode;
  }, [isHostProfileOwner, isPreviewMode]);

  const contextValue = useMemo(() => ({
    hostProfileAddress,
    loggedInUserUPAddress,
    isHostProfileOwner,
    isRadarProjectAdmin,
    isPreviewMode,
    canSaveToHostProfile,
    togglePreviewMode,
  }), [
    hostProfileAddress,
    loggedInUserUPAddress,
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

export const useUserSession = () => {
  const context = useContext(UserSessionContext);
  if (!context) {
    throw new Error('useUserSession must be used within a UserSessionProvider component.');
  }
  return context;
};
```

---
### `src\context\VisualEngineContext.jsx`
```jsx
// src/context/VisualEngineContext.jsx
import React, { createContext, useContext, useEffect, useRef, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceContext } from './WorkspaceContext';
import { lerp } from '../utils/helpers';
import { useEngineStore } from '../store/useEngineStore';
import fallbackConfig from '../config/fallback-config.js';

const VisualEngineContext = createContext(null);
const AUTO_FADE_DURATION_MS = 1000;
const CROSSFADER_LERP_FACTOR = 0.2;

function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

export const VisualEngineProvider = ({ children }) => {
    const { 
        isWorkspaceTransitioning, isFullyLoaded, stagedActiveWorkspace, 
        fullSceneList, setActiveSceneName, setHasPendingChanges,
        activeSceneName, isLoading,
    } = useWorkspaceContext();

    const prevIsFullyLoaded = usePrevious(isFullyLoaded);
    const prevIsWorkspaceTransitioning = usePrevious(isWorkspaceTransitioning);
    const prevActiveSceneName = usePrevious(activeSceneName);
    const prevFullSceneList = usePrevious(fullSceneList);

    const faderAnimationRef = useRef();
    const autoFadeRef = useRef(null);
    const renderedValueRef = useRef(0.0);
    const managerInstancesRef = useRef(null);
    const canvasUpdateFnsRef = useRef({});
    
    // --- NEW: Access Full Industrial Config ---
    const industrialConfig = useEngineStore(state => state.industrialConfig);
    
    const engineRef = useRef(null); 

    const registerManagerInstancesRef = useCallback((ref) => { managerInstancesRef.current = ref; }, []);
    const registerCanvasUpdateFns = useCallback((fns) => { canvasUpdateFnsRef.current = fns; }, []);

    // --- NEW: SYNC INDUSTRIAL CONFIG ---
    useEffect(() => {
        if (managerInstancesRef.current?.current?.engine) {
             // Pass the whole config object to the engine
             managerInstancesRef.current.current.engine.setIndustrialConfig(industrialConfig);
        }
    }, [industrialConfig]);

    useEffect(() => {
        const handleAudioUpdate = (event) => {
            if (managerInstancesRef.current?.current?.engine) {
                managerInstancesRef.current.current.engine.setAudioData(event.detail);
            }
        };

        window.addEventListener('radar-audio-analysis', handleAudioUpdate);
        return () => window.removeEventListener('radar-audio-analysis', handleAudioUpdate);
    }, []);

    const pushCrossfaderUpdate = useCallback((value) => {
        renderedValueRef.current = value;
        if (managerInstancesRef.current?.current?.updateCrossfade) {
            managerInstancesRef.current.current.updateCrossfade(value);
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('radar-crossfader-update', { detail: value }));
        }
    }, []);

    useEffect(() => {
        const initialLoadJustFinished = !prevIsFullyLoaded && isFullyLoaded;
        const transitionJustFinished = prevIsWorkspaceTransitioning && !isWorkspaceTransitioning;
        const sceneNameChanged = activeSceneName !== prevActiveSceneName;
        const sceneListChanged = prevFullSceneList !== fullSceneList;
        const store = useEngineStore.getState();

        if (initialLoadJustFinished || transitionJustFinished) {
            if (!isLoading && (!fullSceneList || fullSceneList.length === 0)) {
                const baseScene = { 
                    name: "Fallback", 
                    ts: Date.now(), 
                    layers: JSON.parse(JSON.stringify(fallbackConfig.layers)), 
                    tokenAssignments: JSON.parse(JSON.stringify(fallbackConfig.tokenAssignments)) 
                };
                store.setDeckConfig('A', baseScene);
                store.setDeckConfig('B', baseScene);
                store.setCrossfader(0.0);
                store.setRenderedCrossfader(0.0);
                pushCrossfaderUpdate(0.0);
                if (activeSceneName) setActiveSceneName(null);
                return;
            }

            if (!isLoading && fullSceneList && fullSceneList.length > 0) {
                const initialSceneName = stagedActiveWorkspace.defaultPresetName || fullSceneList[0]?.name;
                let startIndex = fullSceneList.findIndex(p => p.name === initialSceneName);
                if (startIndex === -1) startIndex = 0;
                const nextIndex = fullSceneList.length > 1 ? (startIndex + 1) % fullSceneList.length : startIndex;
                
                const startSceneConfig = JSON.parse(JSON.stringify(fullSceneList[startIndex]));
                const nextSceneConfig = JSON.parse(JSON.stringify(fullSceneList[nextIndex]));
                
                const initialFaderValue = 0.0;

                store.setDeckConfig('A', startSceneConfig);
                store.setDeckConfig('B', nextSceneConfig);
                store.setCrossfader(initialFaderValue);
                store.setRenderedCrossfader(initialFaderValue);
                pushCrossfaderUpdate(initialFaderValue);

                if (activeSceneName !== startSceneConfig.name) {
                    setActiveSceneName(startSceneConfig.name);
                }
            }
        } 
        else if ((sceneNameChanged || sceneListChanged) && isFullyLoaded && !store.isAutoFading) {
            if (!activeSceneName || !fullSceneList || fullSceneList.length === 0) return;
            const newActiveSceneData = fullSceneList.find(scene => scene.name === activeSceneName);
            if (!newActiveSceneData) return;

            const currentSideA = store.sideA.config;
            const currentSideB = store.sideB.config;
            const isOnDeckA = currentSideA?.name === activeSceneName;
            const isOnDeckB = currentSideB?.name === activeSceneName;

            if (!isOnDeckA && !isOnDeckB) {
                const activeDeckIsA = renderedValueRef.current < 0.5;
                const deckToSet = activeDeckIsA ? 'A' : 'B';
                store.setDeckConfig(deckToSet, JSON.parse(JSON.stringify(newActiveSceneData)));
            }

            const currentIndex = fullSceneList.findIndex(scene => scene.name === activeSceneName);
            if (currentIndex === -1) return;
            
            const nextIndex = (currentIndex + 1) % fullSceneList.length;
            const nextSceneData = JSON.parse(JSON.stringify(fullSceneList[nextIndex]));
            const activeDeckIsNowA = renderedValueRef.current < 0.5;
            
            if (activeDeckIsNowA) {
                if (currentSideB?.name !== nextSceneData.name) store.setDeckConfig('B', nextSceneData);
            } else {
                if (currentSideA?.name !== nextSceneData.name) store.setDeckConfig('A', nextSceneData);
            }
        }
    }, [
        isWorkspaceTransitioning, isFullyLoaded, stagedActiveWorkspace, fullSceneList, 
        prevIsFullyLoaded, prevIsWorkspaceTransitioning, activeSceneName, prevActiveSceneName, 
        prevFullSceneList, setActiveSceneName, isLoading, pushCrossfaderUpdate
    ]);

    useEffect(() => {
        const animateFader = () => {
            const state = useEngineStore.getState();
            const current = renderedValueRef.current;
            const target = state.crossfader;
            const isAuto = state.isAutoFading;
            let newRendered;

            if (!isAuto) {
                if (Math.abs(target - current) > 0.0001) {
                    newRendered = lerp(current, target, CROSSFADER_LERP_FACTOR);
                } else {
                    newRendered = target; 
                }
                
                pushCrossfaderUpdate(newRendered);

                const isSettled = Math.abs(target - newRendered) < 0.0001;
                if (isSettled) {
                    const currentSideA = state.sideA.config;
                    const currentSideB = state.sideB.config;
                    
                    if (target === 1.0) {
                        const sceneNameB = currentSideB?.name;
                        if (sceneNameB && activeSceneName !== sceneNameB) setActiveSceneName(sceneNameB);
                    } else if (target === 0.0) {
                        const sceneNameA = currentSideA?.name;
                        if (sceneNameA && activeSceneName !== sceneNameA) setActiveSceneName(sceneNameA);
                    }
                    
                    if (state.renderedCrossfader !== newRendered) {
                        state.setRenderedCrossfader(newRendered);
                    }
                }
            }
            faderAnimationRef.current = requestAnimationFrame(animateFader);
        };
        faderAnimationRef.current = requestAnimationFrame(animateFader);
        return () => { if (faderAnimationRef.current) cancelAnimationFrame(faderAnimationRef.current); };
    }, [activeSceneName, setActiveSceneName, pushCrossfaderUpdate]);

    const animateCrossfade = useCallback((startTime, startValue, endValue, duration, targetSceneNameParam) => {
        const now = performance.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const newCrossfaderValue = startValue + (endValue - startValue) * progress;
        
        pushCrossfaderUpdate(newCrossfaderValue);
        
        if (progress < 1) {
            autoFadeRef.current = requestAnimationFrame(() => animateCrossfade(startTime, startValue, endValue, duration, targetSceneNameParam));
        } else {
            const { setIsAutoFading, setCrossfader, setTargetSceneName, setRenderedCrossfader } = useEngineStore.getState();
            
            setIsAutoFading(false);
            setCrossfader(endValue);
            setRenderedCrossfader(endValue);
            
            setActiveSceneName(targetSceneNameParam);
            setTargetSceneName(null);
            autoFadeRef.current = null;
        }
    }, [setActiveSceneName, pushCrossfaderUpdate]);

    const handleSceneSelect = useCallback((sceneName, duration = AUTO_FADE_DURATION_MS) => {
        const state = useEngineStore.getState();
        const { isAutoFading, sideA, sideB, setDeckConfig, setIsAutoFading, setTargetSceneName } = state;

        if (isAutoFading || !fullSceneList || fullSceneList.length === 0) return;
        
        setTargetSceneName(sceneName);
        const targetScene = fullSceneList.find(s => s.name === sceneName);
        if (!targetScene) return;
        
        const activeDeckIsA = renderedValueRef.current < 0.5;
        const currentConfig = activeDeckIsA ? sideA.config : sideB.config;
        
        if (currentConfig?.name === sceneName) return; 

        const syncIncomingDeck = (targetDeck) => {
            const managers = managerInstancesRef.current?.current;
            if (managers) {
                Object.values(managers).forEach(manager => {
                    if (manager.syncPhysics) manager.syncPhysics(targetDeck);
                });
            }
        };

        if (activeDeckIsA) { 
            syncIncomingDeck('B'); 
            setDeckConfig('B', JSON.parse(JSON.stringify(targetScene)));
            setIsAutoFading(true); 
            animateCrossfade(performance.now(), renderedValueRef.current, 1.0, duration, sceneName); 
        } else { 
            syncIncomingDeck('A'); 
            setDeckConfig('A', JSON.parse(JSON.stringify(targetScene)));
            setIsAutoFading(true); 
            animateCrossfade(performance.now(), renderedValueRef.current, 0.0, duration, sceneName); 
        }
    }, [fullSceneList, animateCrossfade]);

    const updateLayerConfig = useCallback((layerId, key, value, isMidiUpdate = false, skipStoreUpdate = false) => {
        const managers = managerInstancesRef.current?.current;
        if (managers) {
            const manager = managers[String(layerId)];
            if (manager) {
                const activeDeck = renderedValueRef.current < 0.5 ? 'A' : 'B';
                
                if (isMidiUpdate && ['xaxis', 'yaxis', 'angle', 'speed', 'size', 'opacity', 'drift', 'driftSpeed'].includes(key)) {
                  if (activeDeck === 'A') manager.setTargetValue(key, value); else manager.setTargetValueB(key, value);
                } else {
                  if (activeDeck === 'A') {
                      if(manager.setProperty) manager.setProperty(key, value); else manager.snapProperty(key, value);
                  } else {
                      if(manager.setPropertyB) manager.setPropertyB(key, value); else manager.snapPropertyB(key, value);
                  }
                }
            }
        }

        if (!skipStoreUpdate) {
            const currentState = useEngineStore.getState();
            const activeDeck = renderedValueRef.current < 0.5 ? 'A' : 'B';
            const deckKey = activeDeck === 'A' ? 'sideA' : 'sideB';
            const currentDeckConfig = currentState[deckKey].config;
            
            if (currentDeckConfig) {
                const newConfig = JSON.parse(JSON.stringify(currentDeckConfig));
                if (!newConfig.layers[layerId]) newConfig.layers[layerId] = {};
                newConfig.layers[layerId][key] = value;
                currentState.setDeckConfig(activeDeck, newConfig);
            }
            setHasPendingChanges(true);
        } else {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('radar-param-update', { 
                    detail: { layerId: String(layerId), param: key, value: value } 
                }));
            }
        }
    }, [setHasPendingChanges]);

    const updateTokenAssignment = useCallback(async (token, layerId) => {
        const { setCanvasLayerImage } = canvasUpdateFnsRef.current;
        if (!setCanvasLayerImage) return;
        const idToSave = token.id;
        const srcToLoad = token.metadata?.image;
        if (!idToSave || !srcToLoad) return;
        
        const activeDeck = renderedValueRef.current < 0.5 ? 'A' : 'B';
        const currentState = useEngineStore.getState();
        const deckKey = activeDeck === 'A' ? 'sideA' : 'sideB';
        const currentDeckConfig = currentState[deckKey].config;

        if (currentDeckConfig) {
            const newConfig = JSON.parse(JSON.stringify(currentDeckConfig));
            if (!newConfig.tokenAssignments) newConfig.tokenAssignments = {};
            newConfig.tokenAssignments[String(layerId)] = { id: idToSave, src: srcToLoad };
            currentState.setDeckConfig(activeDeck, newConfig);
        }

        try { await setCanvasLayerImage(String(layerId), srcToLoad, idToSave); } catch (e) { console.error(e); }
        setHasPendingChanges(true);
    }, [setHasPendingChanges]);

    const setLiveConfig = useCallback((config) => {
        const activeDeck = renderedValueRef.current < 0.5 ? 'A' : 'B';
        useEngineStore.getState().setDeckConfig(activeDeck, config);
        if (config?.name) setActiveSceneName(config.name);
    }, [setActiveSceneName]);

    const reloadSceneOntoInactiveDeck = useCallback((sceneName) => {
        if (!fullSceneList) return;
        const scene = fullSceneList.find(s => s.name === sceneName);
        if (!scene) return;
        const activeDeck = renderedValueRef.current < 0.5 ? 'A' : 'B';
        useEngineStore.getState().setDeckConfig(activeDeck === 'A' ? 'B' : 'A', JSON.parse(JSON.stringify(scene)));
    }, [fullSceneList]);

    const contextValue = useMemo(() => ({
        handleSceneSelect,
        updateLayerConfig,
        updateTokenAssignment,
        registerManagerInstancesRef,
        registerCanvasUpdateFns,
        managerInstancesRef,
        setLiveConfig,
        reloadSceneOntoInactiveDeck,
        handleCrossfaderChange: (val) => {
            const state = useEngineStore.getState();
            state.setCrossfader(val);
            pushCrossfaderUpdate(val);
        }
    }), [
        handleSceneSelect,
        updateLayerConfig,
        updateTokenAssignment,
        registerManagerInstancesRef,
        registerCanvasUpdateFns,
        managerInstancesRef,
        setLiveConfig,
        reloadSceneOntoInactiveDeck,
        pushCrossfaderUpdate
    ]);

    return (
        <VisualEngineContext.Provider value={contextValue}>
            {children}
        </VisualEngineContext.Provider>
    );
};

export const useVisualEngineContext = () => {
    const context = useContext(VisualEngineContext);
    if (context === undefined) throw new Error("useVisualEngineContext must be used within a VisualEngineProvider");
    
    const storeState = useEngineStore(useShallow(state => ({
        sideA: state.sideA,
        sideB: state.sideB,
        isAutoFading: state.isAutoFading,
        targetSceneName: state.targetSceneName,
        effectsConfig: state.effectsConfig,
        transitionMode: state.transitionMode,
        // --- Added industrial config ---
        industrialConfig: state.industrialConfig
    })));
    
    const storeActions = useEngineStore.getState();

    const updateEffectConfigWrapper = useCallback((name, param, value) => {
        storeActions.updateEffectConfig(name, param, value);
        const managers = context.managerInstancesRef.current?.current;
        if (managers && managers['1']) {
             managers['1'].updateEffectConfig(name, param, value);
        }
    }, [context.managerInstancesRef, storeActions]);

    return {
        ...context,
        sideA: storeState.sideA,
        sideB: storeState.sideB,
        renderedCrossfaderValue: storeActions.renderedCrossfader || 0.0, 
        
        uiControlConfig: (storeActions.renderedCrossfader < 0.5) ? storeState.sideA.config : storeState.sideB.config,
        
        isAutoFading: storeState.isAutoFading,
        targetSceneName: storeState.targetSceneName,
        effectsConfig: storeState.effectsConfig,
        transitionMode: storeState.transitionMode,
        industrialConfig: storeState.industrialConfig,
        
        handleCrossfaderChange: context.handleCrossfaderChange, 
        handleCrossfaderCommit: storeActions.setCrossfader,
        
        updateEffectConfig: updateEffectConfigWrapper, 
        toggleTransitionMode: () => storeActions.setTransitionMode(storeState.transitionMode === 'crossfade' ? 'flythrough' : 'crossfade'),
    };
};
```

---
### `src\context\WorkspaceContext.jsx`
```jsx
// src/context/WorkspaceContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useUpProvider } from './UpProvider';
import { useUserSession } from './UserSessionContext';
import { useToast } from './ToastContext';

const WorkspaceContext = createContext();

export const WorkspaceProvider = ({ children }) => {
  const { provider, walletClient, publicClient } = useUpProvider();
  const { hostProfileAddress, loggedInUserUPAddress, isHostProfileOwner } = useUserSession();
  const { addToast } = useToast();

  // Access Store Hooks (Actions are stable)
  const initService = useProjectStore(state => state.initService);
  const loadSetlist = useProjectStore(state => state.loadSetlist);
  const resetProject = useProjectStore(state => state.resetProject);
  
  // State Selectors
  // We subscribe to the whole store to proxy values, BUT we must be careful with refs
  const storeState = useProjectStore();

  // --- CRITICAL FIX START ---
  // We use a React ref to hold the service. The ref OBJECT ITSELF ({ current: ... }) 
  // must remain referentially stable across renders.
  const configServiceRef = useRef(null);

  // We sync the value inside a useEffect. This updates the .current property 
  // without creating a new Ref object.
  useEffect(() => {
    configServiceRef.current = storeState.configService;
  }, [storeState.configService]);
  // --- CRITICAL FIX END ---

  // 1. Initialize Service when Provider is ready
  useEffect(() => {
    if (provider && publicClient) {
      initService(provider, walletClient, publicClient);
    }
  }, [provider, walletClient, publicClient, initService]);

  // 2. Load Data when Profile Changes
  useEffect(() => {
    // Only load if we have a profile AND the service is ready
    if (hostProfileAddress && storeState.isConfigReady) {
      const visitorContext = !isHostProfileOwner && loggedInUserUPAddress 
        ? { isVisitor: true, loggedInUserUPAddress } 
        : null;
      
      loadSetlist(hostProfileAddress, visitorContext);
    } else if (!hostProfileAddress) {
      resetProject();
    }
    // Dependencies must be precise to avoid loops
  }, [hostProfileAddress, storeState.isConfigReady, loadSetlist, resetProject, isHostProfileOwner, loggedInUserUPAddress]);

  // 3. Construct Compatibility API
  const contextValue = useMemo(() => {
    return {
      // Data
      isLoading: storeState.isLoading,
      loadingMessage: storeState.loadingMessage,
      isFullyLoaded: !storeState.isLoading && !!storeState.activeWorkspaceName,
      isInitiallyResolved: !!storeState.setlist,
      isSaving: storeState.isSaving,
      loadError: storeState.error,
      
      setlist: storeState.setlist,
      stagedSetlist: storeState.stagedSetlist,
      activeWorkspaceName: storeState.activeWorkspaceName,
      stagedActiveWorkspace: storeState.stagedWorkspace,
      activeSceneName: storeState.activeSceneName,
      
      // Flags
      hasPendingChanges: storeState.hasPendingChanges,
      configServiceInstanceReady: storeState.isConfigReady,
      
      // --- PASS THE STABLE REF ---
      // Do NOT create a new object here like { current: ... }
      configServiceRef: configServiceRef, 
      // ---------------------------

      // Setters (Mapped to Store Actions)
      setActiveSceneName: storeState.setActiveSceneName,
      setHasPendingChanges: (val) => useProjectStore.setState({ hasPendingChanges: val }),
      
      // Actions
      startLoadingProcess: () => { /* No-op, auto-handled now */ },
      loadWorkspace: storeState.loadWorkspace,
      saveChanges: async (target) => {
        const res = await storeState.saveChanges(target || hostProfileAddress);
        if (res.success) addToast("Saved successfully!", "success");
        else addToast(res.error, "error");
        return res;
      },
      duplicateActiveWorkspace: async (newName) => {
        const res = await storeState.saveChanges(newName);
        if (res.success) {
            storeState.loadWorkspace(newName);
            addToast(`Duplicated to ${newName}`, "success");
        }
        return res;
      },
      createNewWorkspace: storeState.createNewWorkspace,
      deleteWorkspaceFromSet: storeState.deleteWorkspaceFromSet,
      renameWorkspaceInSet: storeState.renameWorkspaceInSet,
      setDefaultWorkspaceInSet: storeState.setDefaultWorkspaceInSet,
      
      updateGlobalMidiMap: storeState.updateGlobalMidiMap,
      updateLayerMidiMappings: (layerId, mapping) => {
         const currentMap = storeState.stagedSetlist.globalUserMidiMap || {};
         const newLayerSelects = { ...(currentMap.layerSelects || {}), [layerId]: mapping };
         storeState.updateGlobalMidiMap({ ...currentMap, layerSelects: newLayerSelects });
      },
      updateGlobalEventReactions: storeState.updateGlobalEventReactions,
      deleteGlobalEventReaction: storeState.deleteGlobalEventReaction,
      
      addPalette: storeState.addPalette,
      removePalette: storeState.removePalette,
      addTokenToPalette: storeState.addTokenToPalette,
      removeTokenFromPalette: storeState.removeTokenFromPalette,
      
      addCollectionToPersonalLibrary: storeState.addCollectionToLibrary,
      removeCollectionFromPersonalLibrary: storeState.removeCollectionFromLibrary,
      
      preloadWorkspace: storeState.preloadWorkspace,
      
      // Scene CRUD
      addNewSceneToStagedWorkspace: storeState.addScene,
      deleteSceneFromStagedWorkspace: storeState.deleteScene,
      setDefaultSceneInStagedWorkspace: storeState.setDefaultScene,
      
      // Derived getters
      fullSceneList: Object.values(storeState.stagedWorkspace?.presets || {})
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    };
  }, [storeState, hostProfileAddress, addToast]); // configServiceRef is stable and doesn't need to be in deps

  return (
    <WorkspaceContext.Provider value={contextValue}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspaceContext = () => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspaceContext must be used within WorkspaceProvider");
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
import { useSceneContext } from '../context/SceneContext.jsx'; // --- NEW IMPORT ---

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
 * Merges Workspace and Scene contexts to provide a unified API for 
 * components like SetsPanel or EnhancedSavePanel.
 */
export const useSetManagementState = () => {
  const workspaceCtx = useWorkspaceContext();
  const sceneCtx = useSceneContext();
  
  return {
      ...workspaceCtx,
      ...sceneCtx, // Overwrite any potential duplicates with Scene-level specifics
  };
};

export const useInteractionSettingsState = () => {
  const workspaceCtx = useWorkspaceContext();
  return useMemo(() => ({
    savedReactions: workspaceCtx.stagedSetlist?.globalEventReactions || {},
    midiMap: workspaceCtx.stagedSetlist?.globalUserMidiMap || {},
    updateSavedReaction: workspaceCtx.updateGlobalEventReactions,
    deleteSavedReaction: workspaceCtx.deleteGlobalEventReaction,
    updateMidiMap: workspaceCtx.updateGlobalMidiMap,
  }), [
    workspaceCtx.stagedSetlist, 
    workspaceCtx.updateGlobalEventReactions,
    workspaceCtx.deleteGlobalEventReaction,
    workspaceCtx.updateGlobalMidiMap,
  ]);
};

export const useProfileSessionState = () => {
  const sessionCtx = useUserSession();

  return useMemo(() => {
    const {
      hostProfileAddress,
      loggedInUserUPAddress,
      isHostProfileOwner,
      isRadarProjectAdmin,
      isPreviewMode,
      canSaveToHostProfile,
      togglePreviewMode,
    } = sessionCtx;

    const canInteract = !!hostProfileAddress && !isPreviewMode;
    
    return {
      currentProfileAddress: hostProfileAddress, 
      loggedInUserUPAddress: loggedInUserUPAddress,
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

export const usePendingChangesState = () => {
  const sceneCtx = useSceneContext(); // --- UPDATED: Sourced from SceneContext ---
  return useMemo(() => ({
    hasPendingChanges: sceneCtx.hasPendingChanges,
    setHasPendingChanges: sceneCtx.setHasPendingChanges,
  }), [sceneCtx.hasPendingChanges, sceneCtx.setHasPendingChanges]);
};

export const useConfigStatusState = () => {
  const workspaceCtx = useWorkspaceContext();
  const upCtx = useUpProvider(); 

  return useMemo(() => ({
    isLoading: workspaceCtx.isLoading,
    isInitiallyResolved: workspaceCtx.isInitiallyResolved,
    configServiceInstanceReady: workspaceCtx.configServiceInstanceReady,
    sceneLoadNonce: 0,
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

  const { hostProfileAddress } = useUserSession(); 
  const uiStateHook = useUIState('tab1');
  const { addNotification, unreadCount } = useNotificationContext();
  
  // --- UPDATED: Use stagedSetlist for global reactions ---
  const { stagedSetlist } = useWorkspaceContext();
  const savedReactions = stagedSetlist?.globalEventReactions || {};
  
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

  useLsp1Events(hostProfileAddress, handleEventReceived);

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
import { useEngineStore } from '../store/useEngineStore';
import { useMemo } from 'react';

/**
 * Bridge Hook: Adapts the new Zustand store to the old hook API.
 * This keeps all UI components working without changes.
 */
export function useAudioVisualizer() {
  const isAudioActive = useEngineStore(state => state.isAudioActive);
  const audioSettings = useEngineStore(state => state.audioSettings);
  const analyzerData = useEngineStore(state => state.analyzerData);
  
  const setIsAudioActive = useEngineStore(state => state.setIsAudioActive);
  const setAudioSettings = useEngineStore(state => state.setAudioSettings);
  
  // handleAudioDataUpdate is no longer needed by UI, but we provide a no-op 
  // for compatibility if any legacy component calls it.
  const handleAudioDataUpdate = () => {};

  return useMemo(() => ({
    isAudioActive,
    setIsAudioActive,
    audioSettings,
    setAudioSettings,
    analyzerData,
    handleAudioDataUpdate,
  }), [
    isAudioActive,
    audioSettings,
    analyzerData,
    setIsAudioActive,
    setAudioSettings
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
### `src\hooks\useCoreApplicationStateAndLifecycle.js`
```js
// src/hooks/useCoreApplicationStateAndLifecycle.js
import { useRef, useEffect, useCallback, useMemo } from "react";
import { usePixiOrchestrator } from "./usePixiOrchestrator"; 
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
    isBenignOverlayActive,
    animatingPanel,
  } = props;

  const {
    isInitiallyResolved,
    loadError,
    activeWorkspaceName,
    isFullyLoaded,
    isLoading,
  } = useWorkspaceContext();

  const {
    sideA,
    sideB,
    renderedCrossfaderValue,
    uiControlConfig,
    updateLayerConfig,
    transitionMode, 
    // isAutoFading, // Removed as unused
  } = useVisualEngineContext();

  const { upInitializationError, upFetchStateError } = useUpProvider();
  const { hostProfileAddress: currentProfileAddress } = useUserSession();

  const isMountedRef = useRef(false);
  const internalResetLifecycleRef = useRef(null);
  const canvasRef = useRef(null); 

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const isReadyForLifecycle = isFullyLoaded && !isLoading;

  const orchestrator = usePixiOrchestrator({
    canvasRef,
    sideA,
    sideB,
    crossfaderValue: renderedCrossfaderValue,
    isReady: isReadyForLifecycle,
    transitionMode, 
  });

  const sequencer = usePLockSequencer({
    onValueUpdate: (layerId, paramName, value) => {
      // --- PERF FIX: Pass 'true' as 5th arg to skip React Store updates during animation loop ---
      updateLayerConfig(String(layerId), paramName, value, false, true); 
      
      if (orchestrator.isEngineReady && orchestrator.applyPlaybackValue) {
        orchestrator.applyPlaybackValue(String(layerId), paramName, value);
      }
    },
    onAnimationEnd: (finalStateSnapshot) => {
      if (orchestrator.isEngineReady && orchestrator.clearPlaybackValues) {
        orchestrator.clearPlaybackValues();
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
    if (isMountedRef.current && internalResetLifecycleRef.current) {
      internalResetLifecycleRef.current();
    }
  }, []);

  const onResizeCanvasContainer = useCallback(() => {}, []);

  const { containerRef, hasValidDimensions, isContainerObservedVisible, isFullscreenActive, enterFullscreen } = useCanvasContainer({
    onResize: onResizeCanvasContainer,
    onZeroDimensions: handleZeroDimensionsOrchestrator,
  });

  const renderLifecycleData = useRenderLifecycle({
    managersReady: orchestrator.isEngineReady,
    isInitiallyResolved: isReadyForLifecycle,
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
    stopAllAnimations: orchestrator.stopCanvasAnimations,
    restartCanvasAnimations: orchestrator.restartCanvasAnimations,
    isFullyLoaded: isReadyForLifecycle,
  });

  // --- REMOVED: Auto-stop sequencer logic ---
  // The useEffect that forced sequencer.stop() on transitions has been deleted.

  useEffect(() => {
    internalResetLifecycleRef.current = renderLifecycleData.resetLifecycle;
  }, [renderLifecycleData.resetLifecycle]);

  useAnimationLifecycleManager({
    isMounted: isMountedRef.current,
    renderState: renderLifecycleData.renderState,
    isContainerObservedVisible,
    isBenignOverlayActive,
    animatingPanel,
    isAnimating: renderLifecycleData.isAnimating,
    isTransitioning: renderLifecycleData.isTransitioning,
    restartCanvasAnimations: orchestrator.restartCanvasAnimations,
    stopCanvasAnimations: orchestrator.stopCanvasAnimations,
  });

  return useMemo(() => {
    if (!isReadyForLifecycle) {
      return {
        containerRef, pixiCanvasRef: canvasRef,
        managersReady: false, audioState, renderState: 'initializing',
        loadingStatusMessage: '', isStatusFadingOut: false, showStatusDisplay: false,
        showRetryButton: false, isTransitioning: false, outgoingLayerIdsOnTransitionStart: new Set(),
        makeIncomingCanvasVisible: false, isAnimating: false, handleManualRetry: () => {},
        resetLifecycle: () => {}, stopCanvasAnimations: () => {}, restartCanvasAnimations: () => {},
        setCanvasLayerImage: () => {}, hasValidDimensions: false, isContainerObservedVisible: true,
        isFullscreenActive: false, enterFullscreen: () => {}, isMountedRef, sequencer,
        uiControlConfig: null, managerInstancesRef: { current: null },
      };
    }

    return {
      containerRef,
      pixiCanvasRef: canvasRef,
      managerInstancesRef: orchestrator.managerInstancesRef,
      audioState,
      renderState: renderLifecycleData.renderState,
      loadingStatusMessage: renderLifecycleData.loadingStatusMessage,
      isStatusFadingOut: renderLifecycleData.isStatusFadingOut,
      showStatusDisplay: renderLifecycleData.showStatusDisplay,
      showRetryButton: renderLifecycleData.showRetryButton,
      isTransitioning: renderLifecycleData.isTransitioning,
      outgoingLayerIdsOnTransitionStart: renderLifecycleData.outgoingLayerIdsOnTransitionStart,
      makeIncomingCanvasVisible: renderLifecycleData.makeIncomingCanvasVisible,
      isAnimating: renderLifecycleData.isAnimating,
      handleManualRetry: renderLifecycleData.handleManualRetry,
      resetLifecycle: renderLifecycleData.resetLifecycle,
      managersReady: orchestrator.isEngineReady,
      stopCanvasAnimations: orchestrator.stopCanvasAnimations,
      restartCanvasAnimations: orchestrator.restartCanvasAnimations,
      setCanvasLayerImage: orchestrator.setCanvasLayerImage,
      hasValidDimensions,
      isContainerObservedVisible,
      isFullscreenActive,
      enterFullscreen,
      isMountedRef,
      sequencer,
      uiControlConfig,
    };
  }, [
    isReadyForLifecycle,
    containerRef, orchestrator, audioState, renderLifecycleData, hasValidDimensions,
    isContainerObservedVisible, isFullscreenActive, enterFullscreen,
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
### `src\hooks\usePixiOrchestrator.js`
```js
// src/hooks/usePixiOrchestrator.js
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import PixiEngine from '../utils/PixiEngine';
import { resolveImageUrl } from '../utils/imageDecoder';

export function usePixiOrchestrator({ 
  canvasRef, 
  sideA, 
  sideB, 
  crossfaderValue, 
  isReady,
  transitionMode
}) {
  const engineRef = useRef(null);
  const [isEngineReady, setIsEngineReady] = useState(false);

  // 1. Initialization
  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      const engine = new PixiEngine(canvasRef.current);
      engine.init().then(() => {
        engineRef.current = engine;
        setIsEngineReady(true);
        
        // Initial Sync
        if (sideA?.config) syncDeckConfig(engine, sideA.config, 'A');
        if (sideB?.config) syncDeckConfig(engine, sideB.config, 'B');
      });
    }
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
        setIsEngineReady(false);
      }
    };
  }, [canvasRef]); 

  // 2. Helper to sync config changes from React to Pixi
  const syncDeckConfig = (engine, configWrapper, side) => {
    if (!configWrapper) return;
    const { layers, tokenAssignments } = configWrapper;
    ['1', '2', '3'].forEach(layerId => {
        if (layers && layers[layerId]) engine.snapConfig(layerId, layers[layerId], side);
        if (tokenAssignments && tokenAssignments[layerId]) {
            const token = tokenAssignments[layerId];
            const src = resolveImageUrl(token);
            const id = typeof token === 'object' ? token.id : token;
            engine.setTexture(layerId, side, src, id);
        }
    });
  };

  // 3. Reactive Updates
  // We ONLY sync heavy config objects here. 
  useEffect(() => { 
      if (isEngineReady && engineRef.current && sideA?.config) {
          syncDeckConfig(engineRef.current, sideA.config, 'A'); 
      }
  }, [sideA, isEngineReady]);

  useEffect(() => { 
      if (isEngineReady && engineRef.current && sideB?.config) {
          syncDeckConfig(engineRef.current, sideB.config, 'B'); 
      }
  }, [sideB, isEngineReady]);

  // 4. Expose API for React Components
  const managerInstancesRef = useMemo(() => {
    const createLayerProxy = (layerId) => ({
        getState: (deckSide) => engineRef.current?.getState(layerId, deckSide),
        
        updateConfigProperty: (key, value) => engineRef.current?.updateConfig(layerId, key, value, 'A'),
        updateConfigBProperty: (key, value) => engineRef.current?.updateConfig(layerId, key, value, 'B'),
        
        snapProperty: (key, value) => engineRef.current?.snapConfig(layerId, { [key]: value }, 'A'),
        snapPropertyB: (key, value) => engineRef.current?.snapConfig(layerId, { [key]: value }, 'B'),

        setTargetValue: (key, value) => engineRef.current?.updateConfig(layerId, key, value, 'A'),
        setTargetValueB: (key, value) => engineRef.current?.updateConfig(layerId, key, value, 'B'),
        
        setAudioFrequencyFactor: (factor) => { if (engineRef.current) engineRef.current.setAudioFactors({ [layerId]: factor }); },
        triggerBeatPulse: (factor, duration) => engineRef.current?.triggerBeatPulse(factor, duration),
        resetAudioModifications: () => engineRef.current?.setAudioFactors({ '1': 1, '2': 1, '3': 1 }),
        
        setParallax: (x, y) => engineRef.current?.setParallax(x, y),
        
        applyPlaybackValue: (key, value) => engineRef.current?.applyPlaybackValue(layerId, key, value),
        clearPlaybackValues: () => engineRef.current?.clearPlaybackValues(),
        
        updateEffectConfig: (name, param, value) => engineRef.current?.updateEffectConfig(name, param, value),
        syncPhysics: (targetDeck) => engineRef.current?.syncDeckPhysics(layerId, targetDeck),

        destroy: () => {},
        startAnimationLoop: () => {},
        stopAnimationLoop: () => {}
    });

    return {
        current: {
            '1': createLayerProxy('1'),
            '2': createLayerProxy('2'),
            '3': createLayerProxy('3'),
            // --- NEW: Direct Crossfade Update ---
            updateCrossfade: (val) => engineRef.current?.setRenderedCrossfade(val),
            // --- FIX: Expose Engine Instance via Getter ---
            // This allows the Context to access .setDestructionMode() and .setAudioData()
            get engine() { return engineRef.current; }
        }
    };
  }, []);

  const restartCanvasAnimations = useCallback(() => { if (engineRef.current) engineRef.current.app.ticker.start(); }, []);
  const stopCanvasAnimations = useCallback(() => { if (engineRef.current) engineRef.current.app.ticker.stop(); }, []);
  
  const setCanvasLayerImage = useCallback(async (layerId, src, tokenId) => {
    const activeDeck = crossfaderValue < 0.5 ? 'A' : 'B';
    if (engineRef.current) await engineRef.current.setTexture(layerId, activeDeck, src, tokenId);
  }, [crossfaderValue]);

  return {
    isEngineReady,
    managerInstancesRef,
    restartCanvasAnimations,
    stopCanvasAnimations,
    setCanvasLayerImage,
    engineRef
  };
}
```

---
### `src\hooks\usePLockSequencer.js`
```js
// src/hooks/usePLockSequencer.js
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

const TRANSITION_ANIMATION_DURATION = 1000;
const lerp = (start, end, t) => start * (1 - t) + end * t;

const SPEED_DURATIONS = {
  fast: 4000,
  medium: 8000,
  slow: 12000,
};

export const usePLockSequencer = ({ onValueUpdate, onAnimationEnd }) => {
  const [pLockState, setPLockState] = useState('idle');
  // REMOVED: const [loopProgress, setLoopProgress] = useState(0); 
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
      onAnimationEndRef.current(stateToApplyOnEnd);
    }
    setPLockState('idle');
    
    // Dispatch 0 to reset UI immediately (Zero-Render logic)
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('plock-progress', { detail: 0 }));
    }

    animationDataRef.current = {};
    initialStateSnapshotRef.current = null;
    transitionDataRef.current = null;
    startTimeRef.current = 0;
    prevProgressRef.current = 0;
  }, []);

  const armSequencer = useCallback((snapshot) => {
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
    
    if (!startTimeRef.current) {
        startTimeRef.current = performance.now();
    }
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
        targetValuesToRestore[layerId][paramName] = initialValue;
        
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

  // --- NEW: Exposed Stop Function ---
  const stop = useCallback(() => {
    stopAndClear(null);
  }, [stopAndClear]);

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
          stopAndClear(transitionData.toValues);
          transitionDataRef.current = null;
        }
      } else if (currentState === 'playing') {
        continueLoop = true;
        const duration = loopDurationRef.current;
        
        if (!startTimeRef.current) startTimeRef.current = timestamp;
        
        const startTime = startTimeRef.current;
        const loopElapsedTime = (timestamp - startTime) % duration;
        const currentProgress = loopElapsedTime / duration;
        
        // Zero-Render Update
        window.dispatchEvent(new CustomEvent('plock-progress', { detail: currentProgress }));
        
        const performanceDuration = duration / 2;
        const isFirstHalf = loopElapsedTime < performanceDuration;

        for (const layerId in animationDataRef.current) {
          const layerData = animationDataRef.current[layerId];
          for (const paramName in layerData) {
            const { initialValue, targetValue } = layerData[paramName];
            
            if (typeof initialValue === 'number' && typeof targetValue === 'number') {
              const value = isFirstHalf
                ? lerp(targetValue, initialValue, loopElapsedTime / performanceDuration)
                : lerp(initialValue, targetValue, (loopElapsedTime - performanceDuration) / performanceDuration);
              onValueUpdateRef.current(layerId, paramName, value);
            } else {
              onValueUpdateRef.current(layerId, paramName, isFirstHalf ? targetValue : initialValue);
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
    pLockState, 
    hasLockedParams, toggle, stop, // Expose stop here
    animationDataRef, pLockSpeed, setPLockSpeed,
  }), [pLockState, hasLockedParams, toggle, stop, pLockSpeed]);
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
import { useUpProvider } from "../context/UpProvider"; // <-- IMPORT ADDED

// Configuration
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
  const { publicClient } = useUpProvider(); // <-- CLIENT FROM CONTEXT
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
        // Use the shared publicClient from the context instead of creating a new connection
        if (!publicClient) {
          throw new Error("Public client is not available.");
        }
        const erc725Instance = new ERC725(lsp3ProfileSchema, lowerAddress, publicClient.transport, { ipfsGateway: IPFS_GATEWAY });
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
    [isLoadingAddress, publicClient], // <-- DEPENDENCY ADDED
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
  
  // This useEffect correctly determines the current loading state.
  useEffect(() => {
    const currentState = renderState;

    if (loadError || upInitializationError || upFetchStateError) {
      if (currentState !== 'error') logStateChange('error', 'Critical error detected');
      return;
    }

    if (['rendered', 'fading_out'].includes(currentState)) {
      return;
    }

    // --- THIS IS THE FIX ---
    // The component is only truly ready to render when all prerequisites are met,
    // INCLUDING the layerConfigs being populated from the VisualEngineContext.
    // This prevents the 'rendered' state from being set prematurely.
    const allPrimaryPrerequisitesMet = isInitiallyResolved && hasValidDimensions && isFullyLoaded && !!layerConfigs;
    // --- END FIX ---

    if (allPrimaryPrerequisitesMet) {
      logStateChange('rendered', 'All primary prerequisites (data, layout, layerConfigs) met');
    } else {
      if (!isInitiallyResolved || !isFullyLoaded) {
        logStateChange('resolving_initial_config', 'Awaiting data resolution');
      } else if (!managersReady) {
        logStateChange('initializing_managers', 'Awaiting Managers');
      } else if (!hasValidDimensions) {
        logStateChange('waiting_layout', 'Awaiting valid dimensions');
      }
    }
  }, [
    renderState, managersReady, isInitiallyResolved, hasValidDimensions, isFullyLoaded, 
    loadError, upInitializationError, upFetchStateError, logStateChange,
    layerConfigs, // <-- Dependency added
  ]);

  // This useEffect handles the START of a scene transition.
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
  
  // This useEffect handles the MIDDLE of the transition (after fade-out is complete).
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

  // This useEffect handles the END of the transition (the fade-in).
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
import { useUIStore } from '../store/useUIStore';

// This makes useUIState a direct proxy to the store
export function useUIState(initialLayerTab = 'tab1') {
  const state = useUIStore();
  
  // Backward compatibility alias
  return {
    ...state,
    toggleSidePanel: state.togglePanel, 
  };
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
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { UpProvider } from "./context/UpProvider.jsx";
import { UserSessionProvider } from "./context/UserSessionContext.jsx";
import { WorkspaceProvider } from "./context/WorkspaceContext.jsx";
import { SceneProvider } from "./context/SceneContext.jsx";
import { AssetProvider } from "./context/AssetContext.jsx";
import { VisualEngineProvider } from "./context/VisualEngineContext.jsx";
import { MIDIProvider } from "./context/MIDIContext.jsx";
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
}

const AppTree = (
  <ErrorBoundary>
    <UpProvider>
      <UserSessionProvider>
        {/* SWAPPED: WorkspaceProvider must now wrap SceneProvider */}
        <WorkspaceProvider>
          <SceneProvider>
            <AssetProvider>
              <MIDIProvider>
                <VisualEngineProvider>
                  <App />
                </VisualEngineProvider>
              </MIDIProvider>
            </AssetProvider>
          </SceneProvider>
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
```

---
### `src\services\ConfigurationService.js`
```js
// src/services/ConfigurationService.js
import {
  hexToString, stringToHex,
  getAddress,
  decodeAbiParameters,
  parseAbiParameters
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

// --- CONSTANTS ---
const MULTICALL_BATCH_SIZE = 15; // Conservative batch size
const COLLECTION_CHUNK_SIZE = 3; // 3 Collections at a time (Better UX than 1, still safe)
const DEFAULT_REQUEST_TIMEOUT = 25000;

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
  },
  {
    "inputs": [{ "name": "index", "type": "uint256" }],
    "name": "tokenByIndex",
    "outputs": [{ "name": "", "type": "bytes32" }],
    "stateMutability": "view",
    "type": "function"
  }
];

const LSP8_INTERFACE_ID = "0x3a271706";
const LSP7_INTERFACE_ID = "0xc52d6008";

// --- HELPER FUNCTIONS ---

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = DEFAULT_REQUEST_TIMEOUT } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal  
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeout}ms`);
    }
    throw error;
  }
}

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
            if (valueWithoutPrefix.length < urlBytesStart) return null;
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

function getChecksumAddressSafe(address) {
  if (typeof address !== 'string') return null;
  try { return getAddress(address.trim()); }
  catch { return null; }
}

function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
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

  checkReadyForRead() { return !!this.publicClient; }
  checkReadyForWrite() { return !!this.publicClient && !!this.walletClient?.account; }

  // --- INTERNAL HELPERS ---

  async _processMetadataBytes(metadataUriBytes, tokenId) {
    if (!metadataUriBytes || metadataUriBytes === '0x') return null;

    const decodedString = hexToUtf8Safe(metadataUriBytes);
    if (decodedString && decodedString.trim().startsWith('<svg')) {
      const base64Svg = Buffer.from(decodedString, 'utf8').toString('base64');
      return { name: `Token #${Number(BigInt(tokenId))}`, image: `data:image/svg+xml;base64,${base64Svg}` };
    }

    const decodedUri = decodeVerifiableUriBytes(metadataUriBytes);
    if (!decodedUri) return null;

    return await this._fetchMetadataFromUrl(decodedUri, tokenId);
  }

  async _processBaseUriBytes(baseUriBytes, tokenId) {
    if (!baseUriBytes || baseUriBytes === '0x') return null;
    
    const decodedBaseUri = decodeVerifiableUriBytes(baseUriBytes);
    if (!decodedBaseUri) return null;

    const tokenIdAsString = BigInt(tokenId).toString();
    const finalUrl = decodedBaseUri.endsWith('/') 
        ? `${decodedBaseUri}${tokenIdAsString}` 
        : `${decodedBaseUri}/${tokenIdAsString}`;
    
    return await this._fetchMetadataFromUrl(finalUrl, tokenId);
  }

  async _fetchMetadataFromUrl(url, tokenId) {
    let fetchableUrl = url;
    if (fetchableUrl.startsWith('ipfs://')) fetchableUrl = `${IPFS_GATEWAY}${fetchableUrl.substring(7)}`;
    else if (!fetchableUrl.startsWith('http')) fetchableUrl = `${IPFS_GATEWAY}${fetchableUrl}`;
    
    if (!fetchableUrl.startsWith('http')) return null;

    try {
        const response = await fetchWithTimeout(fetchableUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
            const rawResponseText = await response.text();
            let metadata;
            try { metadata = JSON.parse(rawResponseText); } catch(e) { return null; }
            
            const lsp4Data = metadata.LSP4Metadata || metadata;
            const name = lsp4Data.name || `Token #${tokenId ? tokenId.toString().slice(0,6) : '?'}`;
            let imageUrl = null;
            const imageAsset = lsp4Data.images?.[0]?.[0] || lsp4Data.icon?.[0] || lsp4Data.assets?.[0];

            if (imageAsset && imageAsset.url) {
                let rawUrl = imageAsset.url.trim();
                if (rawUrl.startsWith('ipfs://')) imageUrl = `${IPFS_GATEWAY}${rawUrl.slice(7)}`;
                else if (rawUrl.startsWith('http') || rawUrl.startsWith('data:')) imageUrl = rawUrl;

                if (imageUrl && imageAsset.verification?.method && imageAsset.verification?.data) {
                    const params = new URLSearchParams();
                    params.append('method', imageAsset.verification.method);
                    params.append('data', imageAsset.verification.data);
                    imageUrl = `${imageUrl}?${params.toString()}`;
                }
            }
            return { name, image: imageUrl };

        } else if (contentType && contentType.startsWith("image/")) {
            const tokenIdNum = tokenId ? Number(BigInt(tokenId)) : 0;
            return { name: `Token #${tokenIdNum}`, image: fetchableUrl };
        } 
        return null;
    } catch (e) {
        return null;
    }
  }

  // --- PUBLIC API ---

  async loadWorkspace(profileAddress) {
    const defaultSetlist = { defaultWorkspaceName: null, workspaces: {}, globalUserMidiMap: {}, personalCollectionLibrary: [], userPalettes: {}, globalEventReactions: {} };
    if (!this.checkReadyForRead()) return defaultSetlist;
    const checksummedProfileAddr = getChecksumAddressSafe(profileAddress);
    if (!checksummedProfileAddr) return defaultSetlist;

    try {
        let pointerHex = null;
        try {
            pointerHex = await this.loadDataFromKey(checksummedProfileAddr, RADAR_ROOT_STORAGE_POINTER_KEY);
        } catch (rpcError) {
            console.warn(`[CS] RPC Error fetching root pointer:`, rpcError.message);
            return defaultSetlist; 
        }

        if (!pointerHex || pointerHex === '0x') return defaultSetlist;
        const ipfsUri = hexToUtf8Safe(pointerHex);
        if (!ipfsUri || !ipfsUri.startsWith('ipfs://')) return defaultSetlist;

        const cid = ipfsUri.substring(7);
        const gatewayUrl = `${IPFS_GATEWAY}${cid}`;
        
        const response = await fetchWithTimeout(gatewayUrl);
        if (!response.ok) throw new Error(`Failed to fetch setlist: ${response.status}`);

        const setlist = await response.json();
        if (!setlist || !('workspaces' in setlist)) throw new Error('Invalid setlist object.');

        if (setlist && !setlist.globalUserMidiMap) {
          const defaultWorkspaceName = setlist.defaultWorkspaceName || Object.keys(setlist.workspaces)[0];
          if (defaultWorkspaceName && setlist.workspaces[defaultWorkspaceName]?.cid) {
              const defaultWorkspace = await this._loadWorkspaceFromCID(setlist.workspaces[defaultWorkspaceName].cid);
              if (defaultWorkspace?.globalMidiMap) {
                  setlist.globalUserMidiMap = defaultWorkspace.globalMidiMap;
              }
          }
        }
        return setlist;
    } catch (error) {
        console.error(`[CS] Failed to load setlist:`, error);
        return defaultSetlist;
    }
  }

  async _loadWorkspaceFromCID(cid) {
    if (!cid) return null;
    const gatewayUrl = `${IPFS_GATEWAY}${cid}`;
    const response = await fetchWithTimeout(gatewayUrl);
    if (!response.ok) throw new Error(`Failed to fetch from IPFS: ${response.status}`);
    const workspaceData = await response.json();
    if (!workspaceData || !('presets' in workspaceData)) throw new Error('Invalid workspace object.');
    return workspaceData;
  }

  async saveSetlist(targetProfileAddress, setlistObject) {
    if (!this.checkReadyForWrite()) throw new Error("Client not ready for writing.");
    const checksummedTargetAddr = getChecksumAddressSafe(targetProfileAddress);
    if (!checksummedTargetAddr) throw new Error("Invalid target address.");
    
    const account = this.walletClient.account;
    const userAddress = typeof account === 'string' ? account : account?.address;
    if (userAddress.toLowerCase() !== checksummedTargetAddr.toLowerCase()) {
      throw new Error("Permission denied: Signer is not the profile owner.");
    }

    let oldCidToUnpin = null;
    try {
      const oldPointerHex = await this.loadDataFromKey(checksummedTargetAddr, RADAR_ROOT_STORAGE_POINTER_KEY);
      if (oldPointerHex && oldPointerHex !== '0x') {
        const oldIpfsUri = hexToUtf8Safe(oldPointerHex);
        if (oldIpfsUri?.startsWith('ipfs://')) oldCidToUnpin = oldIpfsUri.substring(7);
      }
    } catch (e) { /* ignore */ }

    try {
      const newIpfsCid = await uploadJsonToPinata(setlistObject, 'RADAR_Setlist');
      if (!newIpfsCid) throw new Error("IPFS upload failed.");

      const newIpfsUri = `ipfs://${newIpfsCid}`;
      const valueHex = stringToHex(newIpfsUri);
      
      const result = await this.saveDataToKey(checksummedTargetAddr, RADAR_ROOT_STORAGE_POINTER_KEY, valueHex);
      
      if (oldCidToUnpin && oldCidToUnpin !== newIpfsCid) {
        fetch('/api/unpin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cid: oldCidToUnpin }),
        }).catch(() => {});
      }
      return result;
    } catch (error) {
      throw new Error(error.message || "Save failed.");
    }
  }
  
  async saveDataToKey(targetAddress, key, valueHex) {
    if (!this.checkReadyForWrite()) throw new Error("Client not ready.");
    const checksummedTargetAddr = getChecksumAddressSafe(targetAddress);
    const account = this.walletClient.account;
    const userAddress = typeof account === 'string' ? account : account?.address;
    
    try {
        const hash = await this.walletClient.writeContract({ 
            address: checksummedTargetAddr, 
            abi: ERC725Y_ABI, 
            functionName: "setData", 
            args: [key, valueHex || "0x"], 
            account: userAddress 
        });
        return { success: true, hash };
    } catch (writeError) {
        const baseError = writeError.cause || writeError;
        throw new Error(`Transaction failed: ${baseError?.shortMessage || writeError.message}`);
    }
  }

  async loadDataFromKey(address, key) {
    if (!this.checkReadyForRead()) return null;
    const checksummedAddress = getChecksumAddressSafe(address);
    try {
        return await this.publicClient.readContract({ address: checksummedAddress, abi: ERC725Y_ABI, functionName: "getData", args: [key] });
    } catch (e) { throw e; }
  }

  async detectCollectionStandard(collectionAddress) {
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    if (!this.checkReadyForRead() || !checksummedCollectionAddr) return null;
    try {
      const [isLSP8, isLSP7] = await Promise.all([
          this.publicClient.readContract({ address: checksummedCollectionAddr, abi: ERC725Y_ABI, functionName: "supportsInterface", args: [LSP8_INTERFACE_ID] }).catch(() => false),
          this.publicClient.readContract({ address: checksummedCollectionAddr, abi: ERC725Y_ABI, functionName: "supportsInterface", args: [LSP7_INTERFACE_ID] }).catch(() => false)
      ]);
      if (isLSP8) return 'LSP8';
      if (isLSP7) return 'LSP7';
      return null;
    } catch (error) { return null; }
  }

  async getLSP7Balance(userAddress, collectionAddress) {
    const checksummedUserAddr = getChecksumAddressSafe(userAddress);
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    if (!this.checkReadyForRead() || !checksummedUserAddr || !checksummedCollectionAddr) return 0n;
    try {
      return await this.publicClient.readContract({
        address: checksummedCollectionAddr, abi: LSP7_ABI, functionName: "balanceOf", args: [checksummedUserAddr]
      });
    } catch (error) { return 0n; }
  }

  // === USER MODE: CHUNKED BATCH OWNED TOKENS ===
  // This function is STRICTLY for checking 'tokenIdsOf'. 
  // It should NEVER be used for 'totalSupply'.
  async getBatchCollectionData(userAddress, collections) {
    if (!this.checkReadyForRead() || !userAddress || collections.length === 0) return {};
    const checksummedUser = getChecksumAddressSafe(userAddress);
    const results = {};

    // Break collections into smaller chunks to prevent RPC limits
    const collectionChunks = chunkArray(collections, COLLECTION_CHUNK_SIZE);

    for (const chunk of collectionChunks) {
        try {
            // Add delay to prevent rate-limit
            await sleep(200); 

            const interfaceContracts = [];
            chunk.forEach(c => {
                interfaceContracts.push(
                    { address: c.address, abi: ERC725Y_ABI, functionName: 'supportsInterface', args: [LSP8_INTERFACE_ID] },
                    { address: c.address, abi: ERC725Y_ABI, functionName: 'supportsInterface', args: [LSP7_INTERFACE_ID] }
                );
            });

            // 1. Check Interfaces
            const interfaceResults = await this.publicClient.multicall({ 
                contracts: interfaceContracts,
                batchSize: MULTICALL_BATCH_SIZE 
            });
            
            const dataContracts = [];
            const chunkMeta = [];

            for (let i = 0; i < chunk.length; i++) {
                const addr = chunk[i].address;
                const isLSP8 = interfaceResults[i * 2]?.result;
                const isLSP7 = interfaceResults[i * 2 + 1]?.result;

                if (isLSP8) {
                    chunkMeta.push({ address: addr, standard: 'LSP8' });
                    // EXPLICIT: tokenIdsOf(user)
                    dataContracts.push({ address: addr, abi: LSP8_ABI, functionName: 'tokenIdsOf', args: [checksummedUser] });
                } else if (isLSP7) {
                    chunkMeta.push({ address: addr, standard: 'LSP7' });
                    // EXPLICIT: balanceOf(user)
                    dataContracts.push({ address: addr, abi: LSP7_ABI, functionName: 'balanceOf', args: [checksummedUser] });
                }
            }

            if (dataContracts.length > 0) {
                // 2. Fetch Data (Balances/TokenIds)
                const dataResults = await this.publicClient.multicall({ 
                    contracts: dataContracts,
                    batchSize: MULTICALL_BATCH_SIZE
                });
                
                dataResults.forEach((res, index) => {
                    const { address, standard } = chunkMeta[index];
                    if (res.status === 'success') {
                        if (standard === 'LSP8') {
                            results[address] = Array.isArray(res.result) ? res.result : [];
                        } else if (standard === 'LSP7' && res.result > 0n) {
                            results[address] = ['LSP7_TOKEN'];
                        }
                    }
                });
            }
        } catch (chunkError) {
            console.warn(`[CS] Error processing collection chunk. Skipping chunk.`, chunkError);
            await sleep(500);
        }
    }
    return results;
  }

  async getLSP4CollectionMetadata(collectionAddress) {
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    if (!this.checkReadyForRead() || !checksummedCollectionAddr) return null;
    try {
      const metadata = await resolveLsp4Metadata(this, checksummedCollectionAddr);
      if (!metadata?.LSP4Metadata) return null;
      
      const lsp4Data = metadata.LSP4Metadata;
      const name = lsp4Data.name || 'Unnamed Collection';
      const rawUrl = lsp4Data.icon?.[0]?.url || lsp4Data.images?.[0]?.[0]?.url || lsp4Data.assets?.[0]?.url;
      let imageUrl = null;
      if (rawUrl && typeof rawUrl === 'string') {
        const trimmedUrl = rawUrl.trim();
        if (trimmedUrl.startsWith('ipfs://')) imageUrl = `${IPFS_GATEWAY}${trimmedUrl.slice(7)}`;
        else if (trimmedUrl.startsWith('http') || trimmedUrl.startsWith('data:')) imageUrl = trimmedUrl;
      }
      return { name, image: imageUrl };
    } catch (error) { return null; }
  }
  
  async getOwnedLSP8TokenIdsForCollection(userAddress, collectionAddress) {
      const checksummedUserAddr = getChecksumAddressSafe(userAddress);
      const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
      if (!this.checkReadyForRead() || !checksummedUserAddr || !checksummedCollectionAddr) return [];
      try {
          return await this.publicClient.readContract({
              address: checksummedCollectionAddr, abi: LSP8_ABI, functionName: "tokenIdsOf", args: [checksummedUserAddr],
          });
      } catch (error) { return []; }
  }

  async getAllLSP8TokenIdsForCollection(collectionAddress) {
      const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
      if (!this.checkReadyForRead() || !checksummedCollectionAddr) return [];
      try {
          const total = await this.publicClient.readContract({ address: checksummedCollectionAddr, abi: LSP8_ABI, functionName: "totalSupply" });
          const totalAsNumber = Number(total);
          if (totalAsNumber === 0) return [];
          const tokenByIndexPromises = [];
          for (let i = 0; i < totalAsNumber; i++) {
              tokenByIndexPromises.push(
                  this.publicClient.readContract({ address: checksummedCollectionAddr, abi: LSP8_ABI, functionName: "tokenByIndex", args: [BigInt(i)] })
              );
          }
          const tokenIds = await Promise.all(tokenByIndexPromises);
          return tokenIds.filter(Boolean);
      } catch (error) { return []; }
  }

  async getTokenMetadata(collectionAddress, tokenId) {
    const checksummedCollectionAddr = getChecksumAddressSafe(collectionAddress);
    if (!this.checkReadyForRead() || !checksummedCollectionAddr) return null;
    
    if (tokenId === 'LSP7_TOKEN') {
      const metadata = await this.getLSP4CollectionMetadata(collectionAddress);
      return metadata ? { name: metadata.name || 'LSP7 Token', image: metadata.image || null } : { name: 'LSP7 Token', image: null };
    }

    try {
      const lsp4Key = ERC725YDataKeys.LSP4.LSP4Metadata;
      const metadataUriBytes = await this.publicClient.readContract({
          address: checksummedCollectionAddr, abi: LSP8_ABI, functionName: "getDataForTokenId", args: [tokenId, lsp4Key]
      }).catch(() => null);

      let metadata = await this._processMetadataBytes(metadataUriBytes, tokenId);
      if (metadata) return metadata;

      // Fallback: Base URI
      const baseUriKey = ERC725YDataKeys.LSP8.LSP8TokenMetadataBaseURI;
      const baseUriBytes = await this.publicClient.readContract({
          address: checksummedCollectionAddr, abi: LSP8_ABI, functionName: "getData", args: [baseUriKey]
      }).catch(() => null);

      return await this._processBaseUriBytes(baseUriBytes, tokenId);

    } catch (error) { return null; }
  }

  // --- UPDATED: BATCH METADATA FETCH (Solves Metadata RPC Limits) ---
  async getTokensMetadataForPage(collectionAddress, identifiers, page, pageSize) {
    if (!this.checkReadyForRead() || !identifiers || identifiers.length === 0) return [];

    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    const pageIdentifiers = identifiers.slice(startIndex, endIndex);

    if (pageIdentifiers.length === 0) return [];

    const checksummedCollection = getChecksumAddressSafe(collectionAddress);
    const lsp4Key = ERC725YDataKeys.LSP4.LSP4Metadata;
    const baseUriKey = ERC725YDataKeys.LSP8.LSP8TokenMetadataBaseURI;

    try {
      // 1. Prepare Multicall
      const contractCalls = pageIdentifiers.map(tokenId => ({
        address: checksummedCollection,
        abi: LSP8_ABI,
        functionName: "getDataForTokenId",
        args: [tokenId, lsp4Key]
      }));

      contractCalls.push({
        address: checksummedCollection,
        abi: LSP8_ABI,
        functionName: "getData",
        args: [baseUriKey]
      });

      const results = await this.publicClient.multicall({ 
          contracts: contractCalls,
          batchSize: MULTICALL_BATCH_SIZE 
      });
      
      const baseUriResult = results.pop(); 
      const baseUriBytes = (baseUriResult.status === 'success') ? baseUriResult.result : null;

      // 2. Process results
      const metadataPromises = results.map(async (res, index) => {
        const tokenId = pageIdentifiers[index];
        let metadata = null;

        if (res.status === 'success' && res.result && res.result !== '0x') {
           metadata = await this._processMetadataBytes(res.result, tokenId);
        }

        if (!metadata && baseUriBytes && baseUriBytes !== '0x') {
           metadata = await this._processBaseUriBytes(baseUriBytes, tokenId);
        }

        if (!metadata || !metadata.image) return null;

        return {
            id: `${collectionAddress}-${tokenId}`,
            type: tokenId === 'LSP7_TOKEN' ? 'LSP7' : 'owned',
            address: collectionAddress,
            tokenId: tokenId,
            metadata: { name: metadata.name || `Token #${tokenId}`, image: metadata.image },
        };
      });

      const resolvedItems = await Promise.all(metadataPromises);
      return resolvedItems.filter(Boolean);

    } catch (e) {
      console.error("[CS] Batch metadata fetch failed:", e);
      return [];
    }
  }

  async getTokensMetadataByIds(tokenIds) {
    if (!this.checkReadyForRead() || !Array.isArray(tokenIds) || tokenIds.length === 0) return [];

    const tokensByCollection = tokenIds.reduce((acc, fullId) => {
        const parts = fullId.split('-');
        if (parts.length === 2) {
            const [addr, id] = parts;
            if (!acc[addr]) acc[addr] = [];
            acc[addr].push(id);
        }
        return acc;
    }, {});

    const allResults = [];

    // Process per collection
    for (const [collectionAddr, ids] of Object.entries(tokensByCollection)) {
        try {
            const res = await this.getTokensMetadataForPage(collectionAddr, ids, 0, ids.length);
            allResults.push(...res);
        } catch (e) { /* ignore individual collection failures */ }
    }
    return allResults;
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

/**
 * Uploads a JavaScript object as a JSON file to IPFS via the internal Netlify function.
 * This protects the API keys by keeping them on the server.
 *
 * @param {object} jsonData The JavaScript object to be uploaded.
 * @param {string} [pinataName='RADAR_Workspace'] An optional name for the pin.
 * @returns {Promise<string>} A promise that resolves with the IPFS Content Identifier (CID).
 * @throws {Error} Throws an error if the network request fails.
 */
export async function uploadJsonToPinata(jsonData, pinataName = 'RADAR_Workspace') {
  // Construct the metadata for the file
  const metadata = {
    name: `${pinataName}_${new Date().toISOString()}`,
  };

  try {
    // Call our own backend function instead of Pinata directly
    // Ensure your Netlify redirect rules map /api/* to /.netlify/functions/*
    // If running locally with `netlify dev`, this path works automatically.
    const response = await fetch('/api/pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pinataContent: jsonData,
        pinataMetadata: metadata,
      }),
    });

    if (!response.ok) {
      let errorMessage = `Server Upload Error (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData.error) errorMessage += `: ${errorData.error}`;
      } catch (e) {
        // Ignore JSON parse error if body is not JSON
      }
      throw new Error(errorMessage);
    }

    // Parse result
    const result = await response.json();

    // The CID is returned in the 'IpfsHash' property from Pinata
    if (!result.IpfsHash) {
      throw new Error("Upload response did not include an IpfsHash (CID).");
    }
    
    if (import.meta.env.DEV) {
      console.log(`[PinataService] Successfully pinned JSON via Backend. CID: ${result.IpfsHash}, Timestamp: ${result.Timestamp}`);
    }
    
    return result.IpfsHash;

  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("[PinataService] An error occurred during the upload process:", error);
    }
    throw error;
  }
}
```

---
### `src\services\TokenService.js`
```js
// src/services/TokenService.js
import { isAddress, hexToString, getAddress } from "viem";
import { ERC725YDataKeys } from "@lukso/lsp-smart-contracts";

// LSP8 minimal ABI needed for token interactions
const LSP8_MINIMAL_ABI = [
  { inputs: [{ name: "interfaceId", type: "bytes4" }], name: "supportsInterface", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "tokenId", type: "bytes32" }], name: "tokenOwnerOf", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "tokenOwner", type: "address" }], name: "tokenIdsOf", outputs: [{ name: "", type: "bytes32[]" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "dataKey", type: "bytes32" }], name: "getData", outputs: [{ name: "dataValue", type: "bytes" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "tokenId", type: "bytes32" }, { name: "dataKey", type: "bytes32" }], name: "getDataForTokenId", outputs: [{ name: "data", type: "bytes" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalSupply", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "index", type: "uint256" }], name: "tokenByIndex", outputs: [{ name: "", type: "bytes32" }], stateMutability: "view", type: "function" }
];

const MULTICALL_BATCH_SIZE = 100; // Safe limit for most RPCs

function hexToUtf8Safe(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("0x") || hex === "0x") return null;
  try { return hexToString(hex); }
  catch (e) { return null; }
}

function parseTokenIdNum(tokenIdBytes32) {
  if (!tokenIdBytes32 || typeof tokenIdBytes32 !== "string" || !tokenIdBytes32.startsWith("0x")) return NaN;
  try { return Number(BigInt(tokenIdBytes32)); }
  catch (e) { return NaN; }
}

// Helper to chunk arrays for batching
function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

class TokenService {
  constructor(publicClient, collectionAddress) {
    this.publicClient = publicClient;
    this.collectionAddress = collectionAddress ? (isAddress(collectionAddress) ? getAddress(collectionAddress) : null) : null;
    this.metadataCache = new Map();
    this.initialized = !!publicClient && !!this.collectionAddress;
    this.ipfsGateway = import.meta.env.VITE_IPFS_GATEWAY || "https://api.universalprofile.cloud/ipfs/";
  }

  async initialize() {
    this.initialized = !!this.publicClient;
    if (!this.collectionAddress || !isAddress(this.collectionAddress)) {
      if (import.meta.env.DEV) console.error("TokenService: Invalid or missing collection address.");
      this.initialized = false;
    }
    return this.initialized;
  }

  async checkClientReady() {
    if (!this.publicClient) return false;
    try {
      const chainId = await this.publicClient.getChainId();
      return !!chainId; 
    } catch (error) {
      return false;
    }
  }

  // --- OPTIMIZED: Standard Single Read ---
  async getOwnedTokenIds(userAddress) {
    if (!this.collectionAddress || !(await this.checkClientReady())) return [];
    try {
      const tokenIds = await this.publicClient.readContract({
        address: this.collectionAddress,
        abi: LSP8_MINIMAL_ABI,
        functionName: "tokenIdsOf",
        args: [getAddress(userAddress)],
      });
      return Array.isArray(tokenIds) ? tokenIds : [];
    } catch (error) {
      if (import.meta.env.DEV) console.warn(`[TS] tokenIdsOf failed for ${this.collectionAddress}:`, error.message);
      return [];
    }
  }

  // --- OPTIMIZED: Multicall Batching ---
  async getAllLSP8TokenIdsForCollection(collectionAddress) {
      const logPrefix = `[TS getAllLSP8]`;
      const checksummedAddr = collectionAddress ? getAddress(collectionAddress) : this.collectionAddress;

      if (!this.publicClient || !checksummedAddr) return [];

      try {
          // 1. Get Total Supply
          const total = await this.publicClient.readContract({
              address: checksummedAddr,
              abi: LSP8_MINIMAL_ABI,
              functionName: "totalSupply",
          });
          const totalAsNumber = Number(total);
          
          if (totalAsNumber === 0) return [];
          if (import.meta.env.DEV) console.log(`${logPrefix} Total supply: ${totalAsNumber}. Batching calls...`);

          // 2. Prepare Contract Calls
          const contractCalls = [];
          for (let i = 0; i < totalAsNumber; i++) {
              contractCalls.push({
                  address: checksummedAddr,
                  abi: LSP8_MINIMAL_ABI,
                  functionName: "tokenByIndex",
                  args: [BigInt(i)],
              });
          }

          // 3. Execute Batched Multicalls
          const chunks = chunkArray(contractCalls, MULTICALL_BATCH_SIZE);
          const allTokenIds = [];

          for (const chunk of chunks) {
              const results = await this.publicClient.multicall({ contracts: chunk });
              results.forEach(res => {
                  if (res.status === 'success' && res.result) {
                      allTokenIds.push(res.result);
                  }
              });
          }

          if (import.meta.env.DEV) console.log(`${logPrefix} Fetched ${allTokenIds.length} tokens via Multicall.`);
          return allTokenIds;

      } catch (error) {
          if (import.meta.env.DEV) console.error(`${logPrefix} Multicall failed:`, error);
          return [];
      }
  }

  // --- OPTIMIZED: Batch Metadata Fetching ---
  async getTokensMetadataByIds(tokenIds) {
    const logPrefix = `[TS BatchMeta]`;
    if (!this.publicClient || !Array.isArray(tokenIds) || tokenIds.length === 0) return [];

    // Group tokens by collection address
    const tokensByCollection = tokenIds.reduce((acc, fullId) => {
        const parts = fullId.split('-');
        if (parts.length === 2) {
            const [addr, id] = parts;
            if (!acc[addr]) acc[addr] = [];
            acc[addr].push(id);
        }
        return acc;
    }, {});

    const allResults = [];

    // Process each collection
    for (const [addr, ids] of Object.entries(tokensByCollection)) {
        const contractCalls = ids.map(id => ({
            address: addr,
            abi: LSP8_MINIMAL_ABI,
            functionName: "getDataForTokenId",
            args: [id, ERC725YDataKeys.LSP4.LSP4Metadata]
        }));

        // Batch RPC calls for Metadata Bytes
        const chunks = chunkArray(contractCalls, MULTICALL_BATCH_SIZE);
        const metadataBytesMap = {}; // tokenId -> bytes

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const results = await this.publicClient.multicall({ contracts: chunk });
            
            results.forEach((res, idx) => {
                // Calculate original index to map back to tokenId
                const originalIndex = (i * MULTICALL_BATCH_SIZE) + idx;
                const tokenId = ids[originalIndex];
                if (res.status === 'success') {
                    metadataBytesMap[tokenId] = res.result;
                }
            });
        }

        // Parallel Process Metadata Resolution (Decode + IPFS Fetch)
        const resolutionPromises = ids.map(async (tokenId) => {
            const bytes = metadataBytesMap[tokenId];
            // Pass pre-fetched bytes to internal helper to avoid re-fetching RPC
            const metadata = await this._resolveMetadataFromBytes(addr, tokenId, bytes);
            
            if (metadata) {
                return {
                    id: `${addr}-${tokenId}`,
                    type: tokenId === 'LSP7_TOKEN' ? 'LSP7' : 'owned',
                    address: addr,
                    tokenId: tokenId,
                    metadata: { name: metadata.name || 'Unnamed', image: metadata.image },
                };
            }
            return null;
        });

        const resolved = await Promise.all(resolutionPromises);
        allResults.push(...resolved.filter(Boolean));
    }

    return allResults;
  }

  // --- INTERNAL HELPER: Decoupled Resolution Logic ---
  async _resolveMetadataFromBytes(collectionAddress, tokenId, metadataUriBytes) {
      // Logic refactored from fetchTokenMetadata to accept bytes directly
      if (!metadataUriBytes || metadataUriBytes === "0x") {
          // If LSP4 key empty, fallback to fetching individually (rare edge case for BaseURI)
          // We could optimize this too, but BaseURI pattern is less common in pure LSP8
          return await this.fetchTokenMetadata(tokenId); 
      }

      // Reuse existing logic for decoding URI from bytes
      const decodedUriData = this.decodeVerifiableUri(metadataUriBytes);
      if (decodedUriData?.url) {
          let finalUrl = decodedUriData.url;
          // Note: BaseURI logic omitted here for simplicity in batch mode, 
          // assumes full URI in LSP4Metadata key which is standard.
          
          const metadataJson = await this.fetchJsonFromUri(finalUrl);
          if (metadataJson) {
              return {
                  name: metadataJson.name,
                  description: metadataJson.description,
                  image: this.getImageUrlFromMetadata(metadataJson),
                  attributes: metadataJson.attributes,
              };
          }
      }
      return null;
  }

  // --- Existing Helper Methods (Preserved) ---

  decodeVerifiableUri(verifiableUriBytes) {
    if (!verifiableUriBytes || typeof verifiableUriBytes !== "string" || !verifiableUriBytes.startsWith("0x")) return null;

    if (verifiableUriBytes.startsWith("0x0000") && verifiableUriBytes.length >= 20) {
      try {
        const hexString = verifiableUriBytes.substring(2);
        // Skip methodId (8 chars) + hashLength (4 chars)
        const hashLengthHex = `0x${hexString.substring(12, 16)}`;
        const hashLengthBytes = parseInt(lengthHex, 16); // Typo fixed in original logic
        if (isNaN(hashLengthBytes)) return null; 

        // Simplified extraction for robustness
        const hashEndOffsetChars = 16 + (hashLengthBytes * 2);
        const uriHex = `0x${hexString.substring(hashEndOffsetChars)}`;
        return { url: hexToUtf8Safe(uriHex), hash: null, hashFunction: null };
      } catch (e) {
        // Fallback
      }
    }
    const plainUrl = hexToUtf8Safe(verifiableUriBytes);
    return plainUrl ? { url: plainUrl } : null;
  }

  async fetchJsonFromUri(uri) {
    if (!uri || typeof uri !== "string") return null;
    let fetchUrl = uri;
    if (uri.startsWith("ipfs://")) {
      fetchUrl = `${this.ipfsGateway.endsWith('/') ? this.ipfsGateway : this.ipfsGateway + '/'}${uri.slice(7)}`;
    } else if (!uri.startsWith("http")) return null;

    try {
      const response = await fetch(fetchUrl);
      if (!response.ok) return null;
      return await response.json();
    } catch { return null; }
  }

  resolveImageUrl(url) {
    if (!url || typeof url !== "string") return null;
    if (url.startsWith("ipfs://")) return `${this.ipfsGateway}${url.slice(7)}`;
    if (url.startsWith("http")) return url;
    return null;
  }

  getImageUrlFromMetadata(metadata) {
    if (!metadata) return null;
    let url = this.resolveImageUrl(metadata.image);
    if (url) return url;
    
    // LSP4 Structure
    const lsp4 = metadata.LSP4Metadata || metadata;
    url = this.resolveImageUrl(lsp4.images?.[0]?.[0]?.url) || 
          this.resolveImageUrl(lsp4.icon?.[0]?.url) || 
          this.resolveImageUrl(lsp4.assets?.[0]?.url);
    
    // LSP3 Structure (fallback)
    if (!url && metadata.LSP3Profile) {
        url = this.resolveImageUrl(metadata.LSP3Profile.profileImage?.[0]?.url);
    }
    return url;
  }

  // --- Standard Single Fetch (Fallback / Detailed) ---
  async fetchTokenMetadata(tokenId) {
    if (!tokenId || !this.collectionAddress) return null;
    const cacheKey = `metadata_${this.collectionAddress}_${tokenId}`;
    if (this.metadataCache.has(cacheKey)) return this.metadataCache.get(cacheKey);

    try {
        // Standard single fetch implementation
        const data = await this.publicClient.readContract({
            address: this.collectionAddress,
            abi: LSP8_MINIMAL_ABI,
            functionName: "getDataForTokenId",
            args: [tokenId, ERC725YDataKeys.LSP4.LSP4Metadata]
        });
        
        const metadata = await this._resolveMetadataFromBytes(this.collectionAddress, tokenId, data);
        if (metadata) {
            this.metadataCache.set(cacheKey, metadata);
            return metadata;
        }
        return { name: `Token #${tokenId.slice(0,6)}`, image: null };
    } catch (e) {
        return { name: "Error loading token", image: null };
    }
  }

  async loadTokenIntoCanvas(tokenId, canvasManager) {
    // This logic relies on fetchTokenMetadata, which uses the cache we might have populated via batching
    const metadata = await this.fetchTokenMetadata(tokenId);
    if (metadata?.image) {
        await canvasManager.setImage(metadata.image);
        return true;
    }
    await canvasManager.setImage(`https://via.placeholder.com/600x400?text=No+Image`);
    return false;
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
### `src\store\useEngineStore.js`
```js
// src/store/useEngineStore.js
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

const DEFAULT_AUDIO_SETTINGS = {
  bassIntensity: 1.0,
  midIntensity: 1.0,
  trebleIntensity: 1.0,
  smoothingFactor: 0.6,
};

// --- UPDATED: AGGRESSIVE DEFAULTS ---
const DEFAULT_INDUSTRIAL_MAPPING = {
    // VISUAL DESTRUCTION
    rgbStrength: { source: 'bass', amount: 1.2, enabled: true },
    zoomStrength: { source: 'bass', amount: 0.7, enabled: true },
    glitchIntensity: { source: 'treble', amount: 1.0, enabled: true },
    
    // CRT COMPONENTS
    crtNoise: { source: 'mid', amount: 0.5, enabled: true },
    crtGeometry: { source: 'bass', amount: 0.0, enabled: true }, // Default 0.0 amount = CLEAN
    
    // "VIDEO NASTY" EFFECTS
    binaryThreshold: { source: 'level', amount: 0.0, enabled: false }, 
    invertStrobe: { source: 'treble', amount: 0.8, enabled: true },
    
    // SCENE SHREDDER
    crossfaderShred: { source: 'bass', amount: 0.0, enabled: false },
};

export const useEngineStore = create(
  subscribeWithSelector((set, get) => ({
    // ... (Standard Visual Engine Slice) ...
    crossfader: 0.0,
    renderedCrossfader: 0.0,
    sideA: { config: null },
    sideB: { config: null },
    isAutoFading: false,
    transitionMode: 'crossfade',
    targetSceneName: null,
    
    // INDUSTRIAL CONFIG
    industrialConfig: {
        enabled: false,
        chaos: 0.0,
        masterDrive: 1.0, // Master Wet/Dry control
        mappings: DEFAULT_INDUSTRIAL_MAPPING
    },

    // Global Effects (Legacy/Standard)
    effectsConfig: {
        bloom: { enabled: false, intensity: 1.0, blur: 8, threshold: 0.5 },
        rgb: { enabled: false, amount: 2 },
        pixelate: { enabled: false, size: 10 },
        twist: { enabled: false, radius: 400, angle: 4, offset: { x: 0, y: 0 } },
        zoomBlur: { enabled: false, strength: 0.1, innerRadius: 50 },
        crt: { enabled: false, curvature: 1, lineWidth: 1, noise: 0.1 },
        kaleidoscope: { enabled: false, sides: 6, angle: 0 },
        liquid: { enabled: false, intensity: 0.02, scale: 3.0, speed: 0.5 },
        volumetric: { enabled: false, exposure: 0.3, decay: 0.95, density: 0.8, weight: 0.4, threshold: 0.5, x: 0.5, y: 0.5 },
        waveDistort: { enabled: false, intensity: 0.5 },
        oldFilm: { enabled: false, noise: 0.3, scratch: 0.1, vignetting: 0.3 },
        adversarial: { enabled: false, intensity: 0.8, bands: 24, shift: 12, noiseScale: 3.0, chromatic: 1.5, scanline: 0.35, qNoise: 2.0, seed: 0.42 },
        ascii: { enabled: false, size: 12, invert: 0, charSet: 0, colorMode: 0 }
    },

    // Actions
    setCrossfader: (value) => set({ crossfader: Math.max(0, Math.min(1, value)) }),
    setRenderedCrossfader: (value) => set({ renderedCrossfader: value }),
    setIsAutoFading: (isFading) => set({ isAutoFading: isFading }),
    setTransitionMode: (mode) => set({ transitionMode: mode }),
    setTargetSceneName: (name) => set({ targetSceneName: name }),
    
    setIndustrialEnabled: (enabled) => set((state) => ({ 
        industrialConfig: { ...state.industrialConfig, enabled } 
    })),
    
    setIndustrialChaos: (value) => set((state) => ({ 
        industrialConfig: { ...state.industrialConfig, chaos: value } 
    })),

    setIndustrialMasterDrive: (value) => set((state) => ({ 
        industrialConfig: { ...state.industrialConfig, masterDrive: value } 
    })),

    updateIndustrialMapping: (target, updates) => set((state) => ({
        industrialConfig: {
            ...state.industrialConfig,
            mappings: {
                ...state.industrialConfig.mappings,
                [target]: { ...state.industrialConfig.mappings[target], ...updates }
            }
        }
    })),
    
    setDeckConfig: (side, config) => set((state) => ({ 
      [side === 'A' ? 'sideA' : 'sideB']: { config } 
    })),

    updateEffectConfig: (effectName, param, value) => set((state) => ({
        effectsConfig: {
            ...state.effectsConfig,
            [effectName]: {
                ...state.effectsConfig[effectName],
                [param]: value
            }
        }
    })),

    // Audio Slice
    isAudioActive: false,
    audioSettings: DEFAULT_AUDIO_SETTINGS,
    analyzerData: { level: 0, frequencyBands: { bass: 0, mid: 0, treble: 0 } },

    setIsAudioActive: (input) => set((state) => ({ 
        isAudioActive: typeof input === 'function' ? input(state.isAudioActive) : input 
    })),
    
    setAudioSettings: (settingsOrFn) => set((state) => ({
        audioSettings: typeof settingsOrFn === 'function' 
            ? settingsOrFn(state.audioSettings) 
            : settingsOrFn
    })),
    
    updateAnalyzerData: (data) => set({ analyzerData: data }),

    // MIDI Slice (unchanged)
    midiAccess: null,
    midiInputs: [],
    isConnected: false,
    isConnecting: false,
    midiError: null,
    midiLearning: null, 
    learningLayer: null, 
    selectedChannel: 0,
    showMidiMonitor: false,
    midiMonitorData: [],
    pendingActions: [], 

    setMidiAccess: (access) => set({ midiAccess: access }),
    setMidiInputs: (inputs) => set({ midiInputs: inputs }),
    setMidiConnectionStatus: (isConnected, isConnecting, error = null) => 
        set({ isConnected, isConnecting, midiError: error }),
    setMidiLearning: (learningState) => set({ midiLearning: learningState }),
    setLearningLayer: (layer) => set({ learningLayer: layer }),
    setSelectedChannel: (channel) => set({ selectedChannel: channel }),
    setShowMidiMonitor: (show) => set({ showMidiMonitor: show }),
    addMidiMonitorData: (entry) => set((state) => {
        const updated = [...state.midiMonitorData, entry];
        return { midiMonitorData: updated.length > 50 ? updated.slice(-50) : updated };
    }),
    clearMidiMonitorData: () => set({ midiMonitorData: [] }),
    queueMidiAction: (action) => set((state) => ({
        pendingActions: [...state.pendingActions, action]
    })),
    clearPendingActions: () => set({ pendingActions: [] }),
  }))
);
```

---
### `src\store\useProjectStore.js`
```js
// src/store/useProjectStore.js
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import ConfigurationService from '../services/ConfigurationService';
import { uploadJsonToPinata } from '../services/PinataService';
import { resolveImageUrl, preloadImages } from '../utils/imageDecoder';
import fallbackConfig from '../config/fallback-config';

// Initial Empty States
const EMPTY_SETLIST = {
  defaultWorkspaceName: null,
  workspaces: {},
  globalUserMidiMap: {},
  personalCollectionLibrary: [],
  userPalettes: {},
  globalEventReactions: {}
};

const EMPTY_WORKSPACE = {
  presets: {},
  defaultPresetName: null
};

export const useProjectStore = create(devtools((set, get) => ({
  // =========================================
  // 1. STATE
  // =========================================
  
  // Infrastructure
  configService: null, // Instance of ConfigurationService
  isConfigReady: false,
  
  // Loading / Status
  isLoading: false,
  loadingMessage: "Initializing...",
  
  // Saving Status
  isSaving: false,
  hasPendingChanges: false,
  
  // Errors
  error: null,      // Critical Application Errors (stops rendering)
  saveError: null,  // Save/Transaction Errors (shows toast, keeps rendering)
  
  // Data: Setlist (The Container / Index)
  setlist: EMPTY_SETLIST, // Committed state
  stagedSetlist: EMPTY_SETLIST, // Editable state
  
  // Data: Active Workspace (The Content)
  activeWorkspaceName: null,
  stagedWorkspace: EMPTY_WORKSPACE, // Replaces 'stagedActiveWorkspace'
  
  // Data: Active Scene
  activeSceneName: null, // The currently selected scene ID
  
  // Cache for preloaded workspaces to avoid re-fetching IPFS
  workspaceCache: new Map(),

  // =========================================
  // 2. INITIALIZATION ACTIONS
  // =========================================

  initService: (provider, walletClient, publicClient) => {
    const service = new ConfigurationService(provider, walletClient, publicClient);
    const isReady = service.checkReadyForRead();
    set({ configService: service, isConfigReady: isReady });
  },

  resetProject: () => {
    set({
      setlist: EMPTY_SETLIST,
      stagedSetlist: EMPTY_SETLIST,
      stagedWorkspace: EMPTY_WORKSPACE,
      activeWorkspaceName: null,
      activeSceneName: null,
      hasPendingChanges: false,
      error: null,
      saveError: null
    });
  },

  // =========================================
  // 3. ASYNC LOADING ACTIONS
  // =========================================

  loadSetlist: async (profileAddress, visitorContext = null) => {
    const { configService } = get();
    if (!configService) return;

    set({ isLoading: true, loadingMessage: "Fetching Setlist...", error: null });

    try {
      let loadedSetlist = await configService.loadWorkspace(profileAddress);

      // Handle Visitor Logic (Merge visitor MIDI/Events with Host Setlist)
      if (visitorContext?.isVisitor && visitorContext?.loggedInUserUPAddress) {
        try {
          const visitorSetlist = await configService.loadWorkspace(visitorContext.loggedInUserUPAddress);
          if (visitorSetlist) {
            loadedSetlist = {
              ...loadedSetlist,
              globalUserMidiMap: visitorSetlist.globalUserMidiMap || loadedSetlist.globalUserMidiMap,
              globalEventReactions: visitorSetlist.globalEventReactions || loadedSetlist.globalEventReactions
            };
          }
        } catch (e) {
          console.warn("Failed to load visitor overlay data", e);
        }
      }

      set({ 
        setlist: loadedSetlist, 
        stagedSetlist: JSON.parse(JSON.stringify(loadedSetlist)), // Deep copy for editing
        isLoading: false,
        loadingMessage: ""
      });

      // Auto-load default workspace
      const defaultName = loadedSetlist.defaultWorkspaceName || Object.keys(loadedSetlist.workspaces)[0];
      if (defaultName) {
        await get().loadWorkspace(defaultName);
      } else {
        // Fallback if no workspaces exist
        set({ stagedWorkspace: EMPTY_WORKSPACE, activeWorkspaceName: null, activeSceneName: null });
      }

    } catch (err) {
      console.error("Load Setlist Error:", err);
      set({ isLoading: false, error: err.message || "Failed to load setlist." });
    }
  },

  loadWorkspace: async (workspaceName) => {
    const { stagedSetlist, configService, workspaceCache } = get();
    
    if (!stagedSetlist?.workspaces?.[workspaceName]) {
      set({ error: `Workspace '${workspaceName}' not found.` });
      return { success: false };
    }

    set({ isLoading: true, loadingMessage: `Loading ${workspaceName}...`, error: null });

    try {
      let workspaceData;

      // 1. Check Cache
      if (workspaceCache.has(workspaceName)) {
        workspaceData = workspaceCache.get(workspaceName);
      } else {
        // 2. Fetch from IPFS
        const cid = stagedSetlist.workspaces[workspaceName].cid;
        if (cid) {
          workspaceData = await configService._loadWorkspaceFromCID(cid);
          workspaceCache.set(workspaceName, workspaceData); // Cache it
        } else {
          // New/Empty workspace
          workspaceData = JSON.parse(JSON.stringify(fallbackConfig)); 
        }
      }

      if (!workspaceData) throw new Error("Failed to resolve workspace data.");

      // 3. Preload Assets
      set({ loadingMessage: "Decoding Assets..." });
      const imageUrls = new Set();
      Object.values(workspaceData.presets || {}).forEach(preset => {
        Object.values(preset.tokenAssignments || {}).forEach(assignment => {
          const src = resolveImageUrl(assignment);
          if (src) imageUrls.add(src);
        });
      });
      if (imageUrls.size > 0) await preloadImages(Array.from(imageUrls));

      // 4. Update State
      const initialScene = workspaceData.defaultPresetName || Object.keys(workspaceData.presets || {})[0] || null;
      
      set({
        stagedWorkspace: workspaceData,
        activeWorkspaceName: workspaceName,
        activeSceneName: initialScene,
        isLoading: false,
        loadingMessage: ""
      });

      return { success: true };

    } catch (err) {
      console.error("Load Workspace Error:", err);
      set({ isLoading: false, error: err.message });
      return { success: false };
    }
  },

  // =========================================
  // 4. SCENE MANAGEMENT ACTIONS
  // =========================================

  setActiveSceneName: (name) => set({ activeSceneName: name }),

  addScene: (sceneName, sceneData) => set((state) => {
    const newWorkspace = JSON.parse(JSON.stringify(state.stagedWorkspace));
    if (!newWorkspace.presets) newWorkspace.presets = {};
    newWorkspace.presets[sceneName] = sceneData;
    
    return { 
      stagedWorkspace: newWorkspace,
      hasPendingChanges: true,
      activeSceneName: sceneName 
    };
  }),

  deleteScene: (sceneName) => set((state) => {
    const newWorkspace = JSON.parse(JSON.stringify(state.stagedWorkspace));
    delete newWorkspace.presets[sceneName];
    
    // Reset default if we deleted it
    if (newWorkspace.defaultPresetName === sceneName) {
      newWorkspace.defaultPresetName = null;
    }

    return { 
      stagedWorkspace: newWorkspace,
      hasPendingChanges: true 
    };
  }),

  setDefaultScene: (sceneName) => set((state) => {
    const newWorkspace = { ...state.stagedWorkspace, defaultPresetName: sceneName };
    return { stagedWorkspace: newWorkspace, hasPendingChanges: true };
  }),

  // =========================================
  // 5. GLOBAL METADATA ACTIONS
  // =========================================

  updateGlobalMidiMap: (newMap) => set((state) => ({
    stagedSetlist: { ...state.stagedSetlist, globalUserMidiMap: newMap },
    hasPendingChanges: true
  })),

  updateGlobalEventReactions: (eventType, reactionData) => set((state) => {
    const newReactions = { ...state.stagedSetlist.globalEventReactions, [eventType]: reactionData };
    return {
      stagedSetlist: { ...state.stagedSetlist, globalEventReactions: newReactions },
      hasPendingChanges: true
    };
  }),

  deleteGlobalEventReaction: (eventType) => set((state) => {
    const newReactions = { ...state.stagedSetlist.globalEventReactions };
    delete newReactions[eventType];
    return {
      stagedSetlist: { ...state.stagedSetlist, globalEventReactions: newReactions },
      hasPendingChanges: true
    };
  }),

  addPalette: (name) => set((state) => {
    const newPalettes = { ...state.stagedSetlist.userPalettes, [name]: [] };
    return { stagedSetlist: { ...state.stagedSetlist, userPalettes: newPalettes }, hasPendingChanges: true };
  }),

  removePalette: (name) => set((state) => {
    const newPalettes = { ...state.stagedSetlist.userPalettes };
    delete newPalettes[name];
    return { stagedSetlist: { ...state.stagedSetlist, userPalettes: newPalettes }, hasPendingChanges: true };
  }),

  addTokenToPalette: (paletteName, tokenId) => set((state) => {
    const current = state.stagedSetlist.userPalettes[paletteName] || [];
    if (current.includes(tokenId)) return {};
    const newPalettes = { 
      ...state.stagedSetlist.userPalettes, 
      [paletteName]: [...current, tokenId] 
    };
    return { stagedSetlist: { ...state.stagedSetlist, userPalettes: newPalettes }, hasPendingChanges: true };
  }),

  removeTokenFromPalette: (paletteName, tokenId) => set((state) => {
    const current = state.stagedSetlist.userPalettes[paletteName] || [];
    const newPalettes = {
      ...state.stagedSetlist.userPalettes,
      [paletteName]: current.filter(id => id !== tokenId)
    };
    return { stagedSetlist: { ...state.stagedSetlist, userPalettes: newPalettes }, hasPendingChanges: true };
  }),

  addCollectionToLibrary: (collection) => set((state) => {
    const currentLib = state.stagedSetlist.personalCollectionLibrary || [];
    if (currentLib.some(c => c.address.toLowerCase() === collection.address.toLowerCase())) return {};
    return {
      stagedSetlist: { ...state.stagedSetlist, personalCollectionLibrary: [...currentLib, collection] },
      hasPendingChanges: true
    };
  }),

  removeCollectionFromLibrary: (address) => set((state) => {
    const currentLib = state.stagedSetlist.personalCollectionLibrary || [];
    return {
      stagedSetlist: { ...state.stagedSetlist, personalCollectionLibrary: currentLib.filter(c => c.address.toLowerCase() !== address.toLowerCase()) },
      hasPendingChanges: true
    };
  }),

  // =========================================
  // 6. WORKSPACE CRUD & SAVING
  // =========================================

  createNewWorkspace: async (name) => {
    const state = get();
    if (state.stagedSetlist.workspaces[name]) throw new Error("Workspace name exists");

    set({ isLoading: true, loadingMessage: "Creating Workspace...", error: null });

    const newWorkspaceData = JSON.parse(JSON.stringify(fallbackConfig));
    // Default fallback config usually has some assets, preload them
    const imageUrls = new Set();
    Object.values(newWorkspaceData.presets?.Default?.tokenAssignments || {}).forEach(t => {
       const src = resolveImageUrl(t);
       if(src) imageUrls.add(src);
    });
    if (imageUrls.size > 0) await preloadImages(Array.from(imageUrls));

    try {
        // Upload immediately to get a CID (Concept: Workspaces are IPFS objects)
        const cid = await uploadJsonToPinata(newWorkspaceData, `RADAR_Workspace_${name}`);

        // Update Setlist
        const newSetlist = JSON.parse(JSON.stringify(state.stagedSetlist));
        newSetlist.workspaces[name] = { cid, lastModified: Date.now() };

        // Update Cache
        state.workspaceCache.set(name, newWorkspaceData);

        set({ 
          stagedSetlist: newSetlist,
          hasPendingChanges: true,
          isLoading: false 
        });

        // Switch to it
        await get().loadWorkspace(name);
    } catch (err) {
        set({ isLoading: false, error: err.message });
    }
  },

  deleteWorkspaceFromSet: (name) => set((state) => {
    const newSetlist = JSON.parse(JSON.stringify(state.stagedSetlist));
    delete newSetlist.workspaces[name];
    if (newSetlist.defaultWorkspaceName === name) newSetlist.defaultWorkspaceName = null;
    return { stagedSetlist: newSetlist, hasPendingChanges: true };
  }),

  renameWorkspaceInSet: (oldName, newName) => set((state) => {
    const newSetlist = JSON.parse(JSON.stringify(state.stagedSetlist));
    newSetlist.workspaces[newName] = newSetlist.workspaces[oldName];
    delete newSetlist.workspaces[oldName];
    if (newSetlist.defaultWorkspaceName === oldName) newSetlist.defaultWorkspaceName = newName;
    
    const activeName = state.activeWorkspaceName === oldName ? newName : state.activeWorkspaceName;
    
    // Migrate Cache key
    if (state.workspaceCache.has(oldName)) {
      const data = state.workspaceCache.get(oldName);
      state.workspaceCache.set(newName, data);
      state.workspaceCache.delete(oldName);
    }

    return { stagedSetlist: newSetlist, activeWorkspaceName: activeName, hasPendingChanges: true };
  }),

  setDefaultWorkspaceInSet: (name) => set((state) => ({
    stagedSetlist: { ...state.stagedSetlist, defaultWorkspaceName: name },
    hasPendingChanges: true
  })),

  // THE BIG SAVE
  saveChanges: async (targetProfileAddress) => {
    const state = get();
    if (!state.configService) return { success: false, error: "Service not ready" };
    
    // Explicitly clear any previous save errors so the UI doesn't show old toasts
    set({ isSaving: true, saveError: null });

    try {
      // 1. Upload Current Workspace to IPFS
      const workspaceToUpload = JSON.parse(JSON.stringify(state.stagedWorkspace));
      
      const wsName = state.activeWorkspaceName || `Workspace_${Date.now()}`;
      const wsCid = await uploadJsonToPinata(workspaceToUpload, `RADAR_WS_${wsName}`);

      // 2. Update Setlist with new Workspace CID
      const newSetlist = JSON.parse(JSON.stringify(state.stagedSetlist));
      if (!newSetlist.workspaces[wsName]) newSetlist.workspaces[wsName] = {};
      newSetlist.workspaces[wsName].cid = wsCid;
      newSetlist.workspaces[wsName].lastModified = Date.now();

      // 3. Save Setlist On-Chain (via ConfigService)
      await state.configService.saveSetlist(targetProfileAddress, newSetlist);

      set({ 
        setlist: newSetlist,
        stagedSetlist: newSetlist,
        hasPendingChanges: false,
        isSaving: false,
        saveError: null // Ensure error is null on success
      });
      
      return { success: true };

    } catch (error) {
      console.error("Save Failed:", error);
      
      // FIX: Use specific saveError state instead of general 'error'
      set({ 
        isSaving: false, 
        saveError: error.message 
      });
      
      return { success: false, error: error.message };
    }
  },

  preloadWorkspace: async (workspaceName) => {
    const { stagedSetlist, configService, workspaceCache } = get();
    if (workspaceCache.has(workspaceName)) return;
    
    const cid = stagedSetlist?.workspaces?.[workspaceName]?.cid;
    if (cid) {
      try {
        const data = await configService._loadWorkspaceFromCID(cid);
        // Preload images silently
        const imageUrls = new Set();
        Object.values(data.presets || {}).forEach(p => {
            Object.values(p.tokenAssignments || {}).forEach(t => {
                const src = resolveImageUrl(t);
                if(src) imageUrls.add(src);
            });
        });
        if(imageUrls.size > 0) preloadImages(Array.from(imageUrls)); // Async, don't await
        
        workspaceCache.set(workspaceName, data);
      } catch (e) {
        console.warn("Preload failed", e);
      }
    }
  }

})));
```

---
### `src\store\useUIStore.js`
```js
// src/store/useUIStore.js
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const OPEN_ANIMATION_DURATION = 500;
const CLOSE_ANIMATION_DELAY = 500;

export const useUIStore = create(
  persist(
    (set, get) => ({
      // =========================================
      // 1. TOASTS SLICE
      // =========================================
      toasts: [],
      
      addToast: (content, type = 'info', duration = 5000) => {
        const id = Date.now() + Math.random();
        set((state) => ({ 
          toasts: [...state.toasts, { id, content, type, duration }] 
        }));

        if (duration && duration > 0) {
          setTimeout(() => {
            get().removeToast(id);
          }, duration);
        }
      },

      removeToast: (id) => {
        set((state) => ({ 
          toasts: state.toasts.filter((t) => t.id !== id) 
        }));
      },

      // =========================================
      // 2. NOTIFICATIONS SLICE (Persisted)
      // =========================================
      notifications: [],
      
      addNotification: (notificationInput) => {
        const newNotif = {
          id: notificationInput.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: notificationInput.timestamp || Date.now(),
          read: notificationInput.read || false,
          type: notificationInput.type,
          typeId: notificationInput.typeId,
          sender: notificationInput.sender,
          value: notificationInput.value,
          data: notificationInput.data,
          decodedPayload: notificationInput.decodedPayload,
          messageFromInput: notificationInput.message,
          link: notificationInput.link,
        };

        set((state) => ({ 
          notifications: [newNotif, ...state.notifications] 
        }));
      },

      markNotificationRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) => 
            n.id === id ? { ...n, read: true } : n
          ),
        }));
      },

      clearAllNotifications: () => {
        set({ notifications: [] });
      },

      getUnreadCount: () => {
        return get().notifications.filter((n) => !n.read).length;
      },

      // =========================================
      // 3. UI PANELS & LAYOUT SLICE
      // =========================================
      isUiVisible: true,
      infoOverlayOpen: false,
      whitelistPanelOpen: false,
      activePanel: null,
      animatingPanel: null,
      activeLayerTab: 'tab1', // 'tab1' = Layer 3 (Top), 'tab2' = Layer 2, 'tab3' = Layer 1
      tokenSelectorOpen: false,

      // Actions
      toggleUiVisibility: () => set((state) => ({ isUiVisible: !state.isUiVisible })),
      
      toggleInfoOverlay: () => set((state) => ({ infoOverlayOpen: !state.infoOverlayOpen })),
      
      setActiveLayerTab: (tab) => set({ activeLayerTab: tab }),

      // Complex Panel Logic with Animations
      openPanel: (panelName) => {
        // Clear any existing panel logic
        set({ animatingPanel: panelName, activePanel: panelName });
        
        // Simple timeout to clear "animating" status after slide-in
        setTimeout(() => {
          set({ animatingPanel: null });
        }, OPEN_ANIMATION_DURATION);
      },

      closePanel: () => {
        set({ animatingPanel: 'closing' });
        
        setTimeout(() => {
          set({ activePanel: null, animatingPanel: null, tokenSelectorOpen: false });
        }, CLOSE_ANIMATION_DELAY);
      },

      togglePanel: (panelName) => {
        const { activePanel, closePanel, openPanel } = get();
        const cleanName = panelName === "null" ? null : panelName;
        
        if (activePanel === cleanName) {
          closePanel();
        } else {
          openPanel(cleanName);
        }
      },
      
      getActiveLayerId: () => {
        const tab = get().activeLayerTab;
        const map = { tab1: 3, tab2: 2, tab3: 1 };
        return map[tab] || 3;
      }
    }),
    {
      name: 'axyz_app_notifications', // Matches your old localStorage key
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        notifications: state.notifications // Only persist notifications!
      }),
    }
  )
);
```

---
### `src\store\useWalletStore.js`
```js
// src/store/useWalletStore.js
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { createClientUPProvider } from "@lukso/up-provider";
import { createWalletClient, createPublicClient, custom, http, numberToHex, getAddress, isAddress } from "viem";
import { lukso, luksoTestnet } from "viem/chains";
import { ERC725 } from '@erc725/erc725.js';
import lsp3ProfileSchema from '@erc725/erc725.js/schemas/LSP3ProfileMetadata.json';
import { RADAR_OFFICIAL_ADMIN_ADDRESS, IPFS_GATEWAY } from '../config/global-config';

// --- CONFIG & HELPERS ---

const LUKSO_MAINNET_RPC = import.meta.env.VITE_LUKSO_MAINNET_RPC_URL || "https://rpc.mainnet.lukso.network";
const LUKSO_TESTNET_RPC = import.meta.env.VITE_LUKSO_TESTNET_RPC_URL || "https://rpc.testnet.lukso.network";

const normalizeChainId = (chainId) => {
  if (chainId === null || chainId === undefined) return null;
  if (typeof chainId === "number") return numberToHex(chainId);
  if (typeof chainId === "string") {
    const lower = chainId.toLowerCase().trim();
    if (/^0x[0-9a-f]+$/.test(lower)) return lower;
    try {
      const num = parseInt(lower, 10);
      if (!isNaN(num) && num >= 0) return numberToHex(num);
    } catch (_) {}
    if (/^[0-9a-f]+$/.test(lower)) return `0x${lower}`;
  }
  return null;
};

const VIEM_CHAINS = {
  [normalizeChainId(lukso.id)]: lukso,
  [normalizeChainId(luksoTestnet.id)]: luksoTestnet,
};

const RPC_URLS = {
  [normalizeChainId(lukso.id)]: LUKSO_MAINNET_RPC,
  [normalizeChainId(luksoTestnet.id)]: LUKSO_TESTNET_RPC,
};

export const useWalletStore = create(
  subscribeWithSelector(devtools((set, get) => ({
    // =========================================
    // 1. STATE
    // =========================================
    
    provider: null, // Raw UP Provider
    walletClient: null,
    publicClient: null,
    
    chainId: null,
    accounts: [], // Connected EOA accounts
    contextAccounts: [], // Profile currently being viewed (UP)
    
    // Derived Session State
    hostProfileAddress: null, // The UP address being viewed
    loggedInUserUPAddress: null, // The authenticated user's UP address (if they are the owner)
    
    // Flags
    isWalletConnected: false,
    isHostProfileOwner: false,
    isRadarProjectAdmin: false,
    isPreviewMode: false,
    
    // Errors
    initializationError: null,
    fetchStateError: null,

    // =========================================
    // 2. ACTIONS
    // =========================================

    initWallet: async () => {
      let upProviderInstance = null;
      
      // 1. Initialize Provider
      if (typeof window !== "undefined" && typeof window.ethereum !== "undefined") {
        try {
          upProviderInstance = createClientUPProvider();
          set({ provider: upProviderInstance });
        } catch (error) {
          console.error("[WalletStore] UP Provider Init Error:", error);
          set({ initializationError: error });
          return;
        }
      } else {
        set({ initializationError: new Error("Universal Profile Extension not detected.") });
        return;
      }

      const provider = upProviderInstance;

      // 2. Define Event Handlers
      const handleAccountsChanged = (rawAccounts) => {
        const newAccs = (rawAccounts || []).map(a => getAddress(a));
        set({ accounts: newAccs });
        get()._updateConnectionStatus();
      };

      const handleChainChanged = (rawChainId) => {
        const normalized = normalizeChainId(rawChainId);
        const isValid = !!normalized && !!VIEM_CHAINS[normalized];
        
        set({ chainId: isValid ? normalized : null });
        if (!isValid) set({ accounts: [], contextAccounts: [] });
        
        get()._recreateClients(); // Recreate public client for new chain
        get()._updateConnectionStatus();
      };

      const handleContextAccountsChanged = (rawContext) => {
        const newContext = (rawContext || []).map(a => getAddress(a));
        set({ contextAccounts: newContext });
        get()._updateConnectionStatus();
      };

      // 3. Attach Listeners
      provider.on("accountsChanged", handleAccountsChanged);
      provider.on("chainChanged", handleChainChanged);
      provider.on("contextAccountsChanged", handleContextAccountsChanged);

      // 4. Fetch Initial Data
      try {
        const [initialAccounts, initialChainId] = await Promise.all([
          provider.request({ method: "eth_accounts" }),
          provider.request({ method: "eth_chainId" })
        ]);

        const normalizedChainId = normalizeChainId(initialChainId);
        const isValidChain = !!normalizedChainId && !!VIEM_CHAINS[normalizedChainId];

        set({
          accounts: (initialAccounts || []).map(a => getAddress(a)),
          contextAccounts: (provider.contextAccounts || []).map(a => getAddress(a)),
          chainId: isValidChain ? normalizedChainId : null
        });

        get()._recreateClients();
        get()._updateConnectionStatus();

      } catch (err) {
        console.error("[WalletStore] Initial Fetch Error:", err);
      }
    },

    togglePreviewMode: () => set(state => ({ isPreviewMode: !state.isPreviewMode })),

    // =========================================
    // 3. INTERNAL HELPERS
    // =========================================

    _recreateClients: () => {
      const { provider, chainId, accounts, initializationError } = get();
      if (!chainId || !VIEM_CHAINS[chainId]) return;

      const currentChain = VIEM_CHAINS[chainId];
      const rpcUrl = RPC_URLS[chainId];

      // Public Client
      try {
        const publicClient = createPublicClient({
          chain: currentChain,
          // --- UPDATED TRANSPORT CONFIG FOR STABILITY ---
          transport: http(rpcUrl, { 
            timeout: 30_000,   // Increase timeout to 30s to handle slow batch responses
            retryCount: 3,     // Keep retries
            retryDelay: 2000,  // Wait 2s between retries (crucial for 429 errors)
            batch: { wait: 50 } // Small wait to allow auto-batching of simple calls
          })
        });
        set({ publicClient, fetchStateError: null });
      } catch (err) {
        set({ fetchStateError: err, publicClient: null });
      }

      // Wallet Client
      if (!initializationError && provider && accounts.length > 0) {
        try {
          const walletClient = createWalletClient({
            chain: currentChain,
            transport: custom(provider),
            account: accounts[0]
          });
          set({ walletClient });
        } catch (err) {
          set({ fetchStateError: err, walletClient: null });
        }
      } else {
        set({ walletClient: null });
      }
    },

    _updateConnectionStatus: async () => {
      const { chainId, accounts, contextAccounts, publicClient } = get();
      const isConnected = !!chainId && accounts.length > 0 && contextAccounts.length > 0;
      
      const hostProfileAddress = (contextAccounts && contextAccounts.length > 0) 
        ? contextAccounts[0] 
        : null;

      set({ 
        isWalletConnected: isConnected,
        hostProfileAddress 
      });

      // Trigger Permission Check
      await get()._checkPermissions();
    },

    _checkPermissions: async () => {
      const { accounts, hostProfileAddress, publicClient } = get();
      const controllerAddress = accounts[0];

      if (!controllerAddress || !hostProfileAddress || !publicClient) {
        set({ 
          isHostProfileOwner: false, 
          isRadarProjectAdmin: false, 
          loggedInUserUPAddress: null 
        });
        return;
      }

      let isOwner = false;

      // 1. Direct Equality Check
      if (controllerAddress.toLowerCase() === hostProfileAddress.toLowerCase()) {
        isOwner = true;
      } else {
        // 2. ERC725 Permissions Check
        try {
          const erc725 = new ERC725(
            lsp3ProfileSchema, 
            hostProfileAddress, 
            publicClient.transport.url, 
            { ipfsGateway: IPFS_GATEWAY }
          );
          const permissions = await erc725.getPermissions(controllerAddress);
          // Check for SUPER_SETDATA permission
          if (typeof permissions === 'string') {
             // Basic check if full permissions are needed, but usually we rely on the decode
             const decoded = ERC725.decodePermissions(permissions);
             isOwner = decoded.SUPER_SETDATA;
          } else if (typeof permissions === 'object') {
             // Handle if erc725 returns object directly
             isOwner = permissions.SUPER_SETDATA;
          }
        } catch (e) {
          isOwner = false;
        }
      }

      // 3. Admin Check
      let isAdmin = false;
      if (isOwner && isAddress(RADAR_OFFICIAL_ADMIN_ADDRESS)) {
        isAdmin = hostProfileAddress.toLowerCase() === RADAR_OFFICIAL_ADMIN_ADDRESS.toLowerCase();
      }

      set({ 
        isHostProfileOwner: isOwner, 
        isRadarProjectAdmin: isAdmin,
        loggedInUserUPAddress: isOwner ? hostProfileAddress : null
      });
    }

  })))
);
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
  /* Z-index is now controlled by the PanelWrapper */
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
  --z-panel-active: 1001;
  --z-overlay: 1500;
  --z-top: 2000;
  --z-tooltip: 2500;

  --icon-size-sm: 24px;
  --icon-size-md: 28px;
  --icon-size-lg: 35px;
  
  --panel-width: 300px;
  --control-panel-width: 300px;

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

/**
 * Interpolates between two angles (in degrees) taking the shortest path.
 * Handles wrapping (e.g., 350 -> 10 goes forward 20 degrees, not back 340).
 *
 * @param {number} start - Start angle in degrees.
 * @param {number} end - End angle in degrees.
 * @param {number} t - Interpolation factor (0-1).
 * @returns {number} The interpolated angle in degrees.
 */
export const lerpAngle = (start, end, t) => {
  // Calculates the shortest distance between angles, handling 0-360 wrap
  let da = (end - start) % 360;
  let distance = (2 * da) % 360 - da;
  return start + distance * t;
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
### `src\utils\pixi\PixiConstants.js`
```js
// src/utils/pixi/PixiConstants.js

export const MAX_TOTAL_OFFSET = 10000;
export const MIDI_INTERPOLATION_DURATION = 300;

export const BLEND_MODE_MAP = {
  'normal': 'normal',
  'multiply': 'multiply',
  'screen': 'screen',
  'overlay': 'overlay',
  'darken': 'darken',
  'lighten': 'lighten',
  'color-dodge': 'color-dodge',
  'color-burn': 'color-burn',
  'hard-light': 'hard-light',
  'soft-light': 'soft-light',
  'difference': 'difference',
  'exclusion': 'exclusion',
  'hue': 'normal', 
  'saturation': 'normal',
  'color': 'normal',
  'luminosity': 'overlay', 
  'linear-dodge': 'add',
  'add': 'add'
};
```

---
### `src\utils\pixi\PixiEffectsManager.js`
```js
// src/utils/pixi/PixiEffectsManager.js
import { 
    AdvancedBloomFilter, 
    RGBSplitFilter, 
    PixelateFilter,
    TwistFilter,
    ZoomBlurFilter,
    CRTFilter,
    ShockwaveFilter, 
    GlitchFilter
} from 'pixi-filters';
import { ColorMatrixFilter } from 'pixi.js';
import { VolumetricLightFilter, LiquidFilter, WaveDistortFilter, KaleidoscopeFilter, AdversarialGlitchFilter, AsciiFilter } from './PixiFilters';
import { lerp } from '../helpers';

export class PixiEffectsManager {
    constructor() {
        this.filters = {
            bloom: null, rgb: null, pixelate: null,
            twist: null, zoomBlur: null,
            crt: null, kaleidoscope: null,
            volumetric: null, waveDistort: null, liquid: null,
            shockwave: null, glitch: null,
            adversarial: null,
            ascii: null 
        };
        
        this.filters.destruction = {
            rgb: null,
            glitch: null,
            pixelate: null,
            crt: null,
            zoom: null,
            colorMatrix: null 
        };

        this._activeOneShotEffects = [];
        this.screen = null;
        this.res = 1;
    }

    init(screen) {
        this.screen = screen;
        this.res = window.devicePixelRatio || 1;
    }

    ensureFilter(name) {
        if (this.filters[name]) return this.filters[name];

        const res = this.res;
        const screen = this.screen;

        switch (name) {
            case 'bloom': this.filters.bloom = new AdvancedBloomFilter({ threshold: 0.5, bloomScale: 1.0, brightness: 1.0, blur: 8, quality: 5, resolution: res }); break;
            case 'rgb': this.filters.rgb = new RGBSplitFilter({ red: {x:0,y:0}, green: {x:0,y:0}, blue: {x:0,y:0}, resolution: res }); break;
            case 'pixelate': this.filters.pixelate = new PixelateFilter(1); this.filters.pixelate.resolution = res; break;
            case 'twist': this.filters.twist = new TwistFilter({ radius: 400, angle: 4, padding: 20, resolution: res }); break;
            case 'zoomBlur': this.filters.zoomBlur = new ZoomBlurFilter({ strength: 0.1, innerRadius: 50, resolution: res }); break;
            
            // --- FIX: Explicitly zero out ALL CRT properties on init ---
            case 'crt': this.filters.crt = new CRTFilter({ 
                curvature: 0, lineWidth: 0, lineContrast: 0, 
                noise: 0, noiseSize: 1.0, 
                vignetting: 0, vignettingAlpha: 0, vignettingBlur: 0, 
                resolution: res 
            }); break;
            
            case 'kaleidoscope': this.filters.kaleidoscope = new KaleidoscopeFilter(); this.filters.kaleidoscope.resolution = res; break;
            case 'volumetric': this.filters.volumetric = new VolumetricLightFilter(); break;
            case 'waveDistort': this.filters.waveDistort = new WaveDistortFilter(); break;
            case 'liquid': this.filters.liquid = new LiquidFilter(); break;
            case 'adversarial': this.filters.adversarial = new AdversarialGlitchFilter(); break;
            case 'ascii': this.filters.ascii = new AsciiFilter(); break;
            case 'shockwave': this.filters.shockwave = new ShockwaveFilter({ center: { x: screen.width / 2, y: screen.height / 2 }, speed: 500, amplitude: 30, wavelength: 160, radius: -1 }); break;
            case 'glitch': this.filters.glitch = new GlitchFilter({ slices: 10, offset: 10, direction: 0, fillMode: 2 }); this.filters.glitch.enabled = false; break;
        }

        if (this.filters[name]) {
            if (name !== 'glitch') this.filters[name].enabled = false; 
        }

        return this.filters[name];
    }

    ensureDestructionChain() {
        if (!this.filters.destruction.rgb) this.filters.destruction.rgb = this.ensureFilter('rgb');
        if (!this.filters.destruction.glitch) this.filters.destruction.glitch = this.ensureFilter('adversarial');
        if (!this.filters.destruction.pixelate) this.filters.destruction.pixelate = this.ensureFilter('pixelate');
        if (!this.filters.destruction.crt) this.filters.destruction.crt = this.ensureFilter('crt');
        if (!this.filters.destruction.zoom) this.filters.destruction.zoom = this.ensureFilter('zoomBlur');
        if (!this.filters.destruction.colorMatrix) {
            this.filters.destruction.colorMatrix = new ColorMatrixFilter();
            this.filters.destruction.colorMatrix.enabled = false;
        }
    }

    updateDestructionMode(audioData, config) {
        this.ensureDestructionChain();
        const { rgb, glitch, pixelate, crt, zoom, colorMatrix } = this.filters.destruction;
        const enabled = config && config.enabled;

        // Cleanup if disabled
        if (!enabled) {
            [rgb, glitch, pixelate, crt, zoom, colorMatrix].forEach(f => {
                if (f && f._isDestructionControlled) f.enabled = false;
            });
            if (rgb) rgb._isDestructionControlled = false;
            if (crt) crt._isDestructionControlled = false;
            
            // Re-enable if was manually set before
            if (rgb && rgb._wasManuallyEnabled) rgb.enabled = true;
            if (crt && crt._wasManuallyEnabled) crt.enabled = true;
            return;
        }

        const map = config.mappings || {};
        const chaos = config.chaos || 0; 
        const masterDrive = config.masterDrive !== undefined ? config.masterDrive : 1.0;

        // Force enable chain
        [rgb, glitch, pixelate, crt, zoom, colorMatrix].forEach(f => {
            f.enabled = true; 
            f._isDestructionControlled = true; 
        });

        const bands = audioData.frequencyBands; 
        const level = audioData.level;

        const getSourceValue = (source) => {
            if (source === 'level') return level;
            return bands[source] || 0;
        };

        const calcVal = (targetKey, base, rangeScale) => {
            const m = map[targetKey];
            if (!m || !m.enabled) return base;
            
            const input = getSourceValue(m.source);
            
            // Apply Chaos
            const chaosFactor = chaos > 0 ? 1 + (Math.random() * chaos * 3.0) : 1; 
            
            // Audio Curve
            const signalStrength = Math.pow(input, 2) * m.amount * 3.0; 
            
            // Result = Base + (Signal * Scale * Chaos)
            // Apply Master Drive to the added effect portion
            const addedEffect = (signalStrength * rangeScale * chaosFactor);
            return base + (addedEffect * masterDrive);
        };

        // 1. RGB SPLIT
        const rgbVal = calcVal('rgbStrength', 0.0, 40.0); 
        rgb.red = { x: rgbVal, y: -rgbVal * 0.5 };
        rgb.blue = { x: -rgbVal, y: rgbVal * 0.5 };
        
        // 2. KICK ZOOM
        const zoomVal = calcVal('zoomStrength', 0.0, 0.4);
        zoom.strength = Math.min(zoomVal, 0.8); 
        if (this.screen) zoom.center = { x: this.screen.width/2, y: this.screen.height/2 };

        // 3. GLITCH
        const glitchInt = calcVal('glitchIntensity', 0.0, 5.0);
        glitch.intensity = glitchInt;
        glitch.bands = 5 + Math.floor(glitchInt * 20);
        glitch.shift = Math.floor(glitchInt * 100);
        glitch.chromatic = calcVal('chromaticShift', 1.0, 15.0) * masterDrive; 

        // 4. CRT - SPLIT INTO NOISE AND GEOMETRY
        
        // A. Noise
        const noiseMap = map['crtNoise'];
        if (noiseMap && noiseMap.enabled && masterDrive > 0.01) {
            const calculatedNoise = calcVal('crtNoise', 0.0, 1.5);
            // Noise Gate: only apply if significant to prevent static hiss when clean
            crt.noise = calculatedNoise > 0.01 ? calculatedNoise : 0;
            if (crt.noise > 0) crt.time += 0.5 + (level * 5.0) + chaos; 
        } else {
            crt.noise = 0;
        }

        // B. Geometry & Vignette (The "Retro Look")
        // We use calcVal here so it responds to Master Drive correctly. 
        const geomIntensity = calcVal('crtGeometry', 0.0, 1.0); 

        // Stronger Noise Gate for Geometry (0.01) to prevent default vignetting
        if (geomIntensity > 0.01 && masterDrive > 0.01) {
            // Apply physics-based look
            crt.curvature = geomIntensity * 2.0; 
            crt.lineWidth = geomIntensity * 8.0;
            crt.lineContrast = geomIntensity * 0.5;
            
            // Explicitly control vignette intensity
            const vignetteAmount = geomIntensity * 0.45;
            crt.vignetting = vignetteAmount;
            crt.vignettingAlpha = vignetteAmount;
            crt.vignettingBlur = vignetteAmount * 0.5;
        } else {
            // Completely clean - FORCIBLY ZERO EVERYTHING
            crt.curvature = 0;
            crt.lineWidth = 0;
            crt.lineContrast = 0;
            crt.vignetting = 0;
            crt.vignettingAlpha = 0;
            crt.vignettingBlur = 0;
        }

        // 5. VIDEO NASTY: BINARY THRESHOLD & INVERT
        const threshVal = calcVal('binaryThreshold', 0, 1.0);
        const invertVal = calcVal('invertStrobe', 0, 1.0);
        
        colorMatrix.reset();
        
        if (threshVal > 0.1) {
            colorMatrix.desaturate();
            colorMatrix.contrast(threshVal * 5, true); 
        }

        if (invertVal > 0.5) {
            colorMatrix.negative(true);
        }

        // 6. PIXELATE
        const pixVal = Math.max(1, calcVal('pixelateSize', 1, 40)); 
        pixelate.size = pixVal;

        // Chaos Seeds
        glitch.seed = Math.random();
    }

    getFilterList() {
        const list = [
            this.filters.liquid,
            this.filters.kaleidoscope, 
            this.filters.twist, 
            this.filters.zoomBlur,
            this.filters.shockwave, 
            this.filters.glitch,    
            this.filters.adversarial,
            this.filters.ascii, 
            this.filters.volumetric,
            this.filters.waveDistort,
            this.filters.pixelate,
            this.filters.destruction.colorMatrix,
            this.filters.crt,
            this.filters.rgb, 
            this.filters.bloom
        ];
        return [...new Set(list.filter(f => f !== null && f.enabled))];
    }

    updateConfig(effectName, param, value) {
        const filter = this.ensureFilter(effectName);
        if (!filter) return;
        if (filter._isDestructionControlled) return;

        if (param === 'enabled') {
            filter.enabled = !!value;
            if (value) filter._wasManuallyEnabled = true;
            else delete filter._wasManuallyEnabled;
        } else if (effectName === 'rgb' && param === 'amount') {
            filter.red = { x: -value, y: -value };
            filter.green = { x: 0, y: 0 };
            filter.blue = { x: value, y: value };
        } else if (effectName === 'bloom' && param === 'intensity') {
            filter.bloomScale = value;
        } else if (effectName === 'liquid') {
            if (param === 'speed') filter.speed = value;
            if (param === 'scale') filter.scale = value;
            if (param === 'intensity') filter.intensity = value;
        } else if (effectName === 'volumetric') {
            if (param === 'exposure') filter.exposure = value;
            if (param === 'decay') filter.decay = value;
            if (param === 'density') filter.density = value;
            if (param === 'threshold') filter.threshold = value;
            if (param === 'x') filter.lightX = value;
            if (param === 'y') filter.lightY = value;
        } else if (effectName === 'waveDistort') {
            if (param === 'intensity') filter.intensity = value;
        } else if (effectName === 'ascii') { 
            if (param === 'size') filter.size = value;
            if (param === 'invert') filter.invert = value;
            if (param === 'charSet') filter.charSet = value;
            if (param === 'colorMode') filter.colorMode = value;
        } else if (effectName === 'adversarial') {
            if (param === 'intensity') filter.intensity = value;
            if (param === 'bands') filter.bands = value;
            if (param === 'shift') filter.shift = value;
            if (param === 'noiseScale') filter.noiseScale = value;
            if (param === 'chromatic') filter.chromatic = value;
            if (param === 'scanline') filter.scanline = value;
            if (param === 'qNoise') filter.qNoise = value;
            if (param === 'seed') filter.seed = value;
        } else {
            if (param in filter) {
                filter[param] = value;
            }
        }
    }

    triggerOneShot(type, config, screen) {
        const now = performance.now();
        const width = screen.width;
        const height = screen.height;
        
        if (type === 'shockwave') {
            const filter = this.ensureFilter('shockwave');
            filter.center = { x: Math.random() * width, y: Math.random() * height };
            filter.time = 0;
            filter.radius = -1; 
            filter.amplitude = config.amplitude || 30;
            filter.wavelength = config.wavelength || 160;
            const duration = config.duration || 1000;
            const maxRadius = Math.max(width, height) * 1.5;
            this._activeOneShotEffects.push({ type: 'shockwave', startTime: now, duration, maxRadius });
        }
        else if (type === 'glitch') {
            const filter = this.ensureFilter('glitch');
            filter.enabled = true;
            filter.slices = config.slices || 15;
            filter.offset = config.offset || 50;
            this._activeOneShotEffects.push({ type: 'glitch', startTime: now, duration: config.duration || 600 });
        }
        else if (type === 'bloomFlash') {
            const filter = this.ensureFilter('bloom');
            if (!filter.enabled) { filter.enabled = true; filter._wasDisabled = true; }
            const baseIntensity = filter.bloomScale;
            this._activeOneShotEffects.push({ type: 'bloomFlash', startTime: now, duration: config.duration || 500, baseIntensity, peakIntensity: config.intensity || 6.0 });
        }
    }

    update(ticker, renderer) {
        const now = performance.now();
        const filterDelta = ticker.deltaTime * 0.01;

        if (this.filters.crt && this.filters.crt.enabled) {
            this.filters.crt.seed = Math.random();
            this.filters.crt.time += ticker.deltaTime * 0.1;
        }
        if (this.filters.liquid && this.filters.liquid.enabled) this.filters.liquid.time += filterDelta;
        if (this.filters.waveDistort && this.filters.waveDistort.enabled) this.filters.waveDistort.time += filterDelta;
        if (this.filters.adversarial && this.filters.adversarial.enabled) this.filters.adversarial.time += filterDelta;
        if (this.filters.ascii && this.filters.ascii.enabled) this.filters.ascii.time += filterDelta;

        const logicalW = renderer.width / renderer.resolution;
        const logicalH = renderer.height / renderer.resolution;
        
        if (this.filters.kaleidoscope) this.filters.kaleidoscope.screenSize = { x: renderer.width, y: renderer.height };
        if (this.filters.zoomBlur) this.filters.zoomBlur.center = { x: logicalW/2, y: logicalH/2 };
        if (this.filters.twist) this.filters.twist.offset = { x: logicalW/2, y: logicalH/2 };

        if (this._activeOneShotEffects.length > 0) {
            this._activeOneShotEffects = this._activeOneShotEffects.filter(effect => {
                const elapsed = now - effect.startTime;
                const progress = Math.max(0, Math.min(elapsed / effect.duration, 1.0));
                
                if (effect.type === 'shockwave') {
                    if (this.filters.shockwave) {
                        this.filters.shockwave.radius = effect.maxRadius * progress;
                        if (progress > 0.8) {
                            const fade = (1.0 - progress) / 0.2;
                            this.filters.shockwave.amplitude = fade * 30;
                        }
                    }
                }
                else if (effect.type === 'glitch') {
                    if (this.filters.glitch) {
                        this.filters.glitch.seed = Math.random();
                        this.filters.glitch.offset = (1.0 - progress) * 50;
                        if (progress >= 1.0) this.filters.glitch.enabled = false;
                    }
                }
                else if (effect.type === 'bloomFlash') {
                    if (this.filters.bloom) {
                        const current = lerp(effect.peakIntensity, effect.baseIntensity, progress);
                        this.filters.bloom.bloomScale = current;
                        if (progress >= 1.0 && this.filters.bloom._wasDisabled) {
                            this.filters.bloom.enabled = false;
                            delete this.filters.bloom._wasDisabled;
                        }
                    }
                }
                return progress < 1.0;
            });
        }
    }
}
```

---
### `src\utils\pixi\PixiFilters.js`
```js
// src/utils/pixi/PixiFilters.js
import { Filter, GlProgram } from 'pixi.js';

const defaultFilterVertex = `
    precision highp float;
    in vec2 aPosition;
    out vec2 vTextureCoord;
    uniform vec4 uInputSize;
    uniform vec4 uOutputFrame;
    uniform vec4 uOutputTexture;

    vec4 filterVertexPosition( void ) {
        vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
        position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
        position.y = position.y * (2.0 / uOutputTexture.y) - 1.0;
        return vec4(position, 0.0, 1.0);
    }
    vec2 filterTextureCoord( void ) {
        return aPosition * (uOutputFrame.zw * uInputSize.zw);
    }
    void main(void) {
        gl_Position = filterVertexPosition();
        vTextureCoord = filterTextureCoord();
    }
`;

// --- VOLUMETRIC LIGHT ---
const volumetricFragment = `
    precision highp float;
    in vec2 vTextureCoord;
    out vec4 finalColor;
    
    uniform sampler2D uTexture;
    uniform vec2 uLightPos;
    uniform float uExposure;
    uniform float uDecay;
    uniform float uDensity;
    uniform float uWeight;
    uniform float uThreshold;

    const int SAMPLES = 50;

    void main() {
        vec2 deltaTextCoord = vec2(vTextureCoord - uLightPos);
        vec2 textCoo = vTextureCoord;
        deltaTextCoord *= 1.0 / float(SAMPLES) * uDensity;
        
        vec4 color = vec4(0.0);
        float illuminationDecay = 1.0;
        
        for(int i=0; i < SAMPLES ; i++) {
            textCoo -= deltaTextCoord;
            vec4 sample = texture(uTexture, textCoo);
            float brightness = dot(sample.rgb, vec3(0.2126, 0.7152, 0.0722));
            if(brightness < uThreshold) {
                sample *= 0.05;
            }
            sample *= illuminationDecay * uWeight;
            color += sample;
            illuminationDecay *= uDecay;
        }
        
        vec4 realColor = texture(uTexture, vTextureCoord);
        finalColor = realColor + (color * uExposure);
    }
`;

export class VolumetricLightFilter extends Filter {
    constructor() {
        super({
            glProgram: GlProgram.from({ vertex: defaultFilterVertex, fragment: volumetricFragment, name: 'volumetric-filter' }),
            resources: {
                volumetricUniforms: {
                    uLightPos: { value: {x: 0.5, y: 0.5}, type: 'vec2<f32>' },
                    uExposure: { value: 0.3, type: 'f32' },
                    uDecay: { value: 0.95, type: 'f32' },
                    uDensity: { value: 0.8, type: 'f32' },
                    uWeight: { value: 0.4, type: 'f32' },
                    uThreshold: { value: 0.5, type: 'f32' }
                }
            }
        });
    }
    get exposure() { return this.resources.volumetricUniforms.uniforms.uExposure; }
    set exposure(v) { this.resources.volumetricUniforms.uniforms.uExposure = v; }
    get threshold() { return this.resources.volumetricUniforms.uniforms.uThreshold; }
    set threshold(v) { this.resources.volumetricUniforms.uniforms.uThreshold = v; }
    get density() { return this.resources.volumetricUniforms.uniforms.uDensity; }
    set density(v) { this.resources.volumetricUniforms.uniforms.uDensity = v; }
    get decay() { return this.resources.volumetricUniforms.uniforms.uDecay; }
    set decay(v) { this.resources.volumetricUniforms.uniforms.uDecay = v; }
    set lightX(v) { this.resources.volumetricUniforms.uniforms.uLightPos.x = v; }
    set lightY(v) { this.resources.volumetricUniforms.uniforms.uLightPos.y = v; }
}

// --- LIQUID FLOW ---
const liquidFragment = `
    precision highp float;
    in vec2 vTextureCoord;
    out vec4 finalColor;
    uniform sampler2D uTexture;
    uniform float uTime;
    uniform float uSpeed;
    uniform float uScale;
    uniform float uIntensity;

    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
    }

    void main() {
        vec2 uv = vTextureCoord;
        float noiseVal = snoise(uv * uScale + (uTime * uSpeed));
        vec2 distort = vec2(noiseVal * uIntensity, noiseVal * uIntensity);
        finalColor = texture(uTexture, uv + distort);
    }
`;

export class LiquidFilter extends Filter {
    constructor() {
        super({
            glProgram: GlProgram.from({ vertex: defaultFilterVertex, fragment: liquidFragment, name: 'liquid-filter' }),
            resources: {
                liquidUniforms: {
                    uTime: { value: 0.0, type: 'f32' },
                    uSpeed: { value: 0.5, type: 'f32' },
                    uScale: { value: 3.0, type: 'f32' },
                    uIntensity: { value: 0.02, type: 'f32' }
                }
            }
        });
    }
    get time() { return this.resources.liquidUniforms.uniforms.uTime; }
    set time(v) { this.resources.liquidUniforms.uniforms.uTime = v; }
    get speed() { return this.resources.liquidUniforms.uniforms.uSpeed; }
    set speed(v) { this.resources.liquidUniforms.uniforms.uSpeed = v; }
    get scale() { return this.resources.liquidUniforms.uniforms.uScale; }
    set scale(v) { this.resources.liquidUniforms.uniforms.uScale = v; }
    get intensity() { return this.resources.liquidUniforms.uniforms.uIntensity; }
    set intensity(v) { this.resources.liquidUniforms.uniforms.uIntensity = v; }
}

// --- WAVE DISTORT ---
const waveDistortFragment = `
    precision highp float;
    in vec2 vTextureCoord;
    out vec4 finalColor;
    
    uniform sampler2D uTexture;
    uniform float uTime;
    uniform float uIntensity;

    void main() {
        vec2 uv = vTextureCoord;
        float wave = sin(uv.y * 20.0 + uTime * 5.0) * 0.005 * uIntensity;
        uv.x += wave;
        finalColor = texture(uTexture, uv);
    }
`;

export class WaveDistortFilter extends Filter {
    constructor() {
        super({
            glProgram: GlProgram.from({ vertex: defaultFilterVertex, fragment: waveDistortFragment, name: 'wave-distort-filter' }),
            resources: {
                waveUniforms: {
                    uTime: { value: 0.0, type: 'f32' },
                    uIntensity: { value: 0.5, type: 'f32' }
                }
            }
        });
    }
    get time() { return this.resources.waveUniforms.uniforms.uTime; }
    set time(v) { this.resources.waveUniforms.uniforms.uTime = v; }
    get intensity() { return this.resources.waveUniforms.uniforms.uIntensity; }
    set intensity(v) { this.resources.waveUniforms.uniforms.uIntensity = v; }
}

// --- KALEIDOSCOPE ---
const kaleidoscopeFragment = `
    precision highp float;
    in vec2 vTextureCoord;
    out vec4 finalColor;
    uniform sampler2D uTexture;
    uniform float sides;
    uniform float angle;
    uniform vec2 uScreenSize; 
    uniform vec4 uInputSize;
    void main() {
        vec2 uvPerPixel = uInputSize.zw;
        vec2 originUV = vTextureCoord - gl_FragCoord.xy * uvPerPixel;
        vec2 center = uScreenSize * 0.5;
        vec2 p = gl_FragCoord.xy - center;
        float r = length(p);
        float a = atan(p.y, p.x) + angle;
        if (sides > 0.0) {
            float slice = 6.28318530718 / sides;
            a = mod(a, slice);
            a = abs(a - 0.5 * slice);
            a -= 0.5 * slice;
        }
        vec2 newP = r * vec2(cos(a), sin(a));
        vec2 absPos = newP + center;
        vec2 safePos = absPos + (uScreenSize * 10.0); 
        vec2 mirroredPos = abs(mod(safePos - uScreenSize, 2.0 * uScreenSize) - uScreenSize);
        mirroredPos = clamp(mirroredPos, vec2(1.0), uScreenSize - vec2(1.0));
        vec2 finalUV = originUV + mirroredPos * uvPerPixel;
        finalColor = texture(uTexture, finalUV);
    }
`;

export class KaleidoscopeFilter extends Filter {
    constructor() {
        super({
            glProgram: GlProgram.from({ vertex: defaultFilterVertex, fragment: kaleidoscopeFragment, name: 'kaleidoscope-filter' }),
            resources: {
                kaleidoscopeUniforms: { sides: { value: 6.0, type: 'f32' }, angle: { value: 0.0, type: 'f32' }, uScreenSize: { value: { x: 1.0, y: 1.0 }, type: 'vec2<f32>' } }
            }
        });
        this.padding = 0; 
    }
    get sides() { return this.resources.kaleidoscopeUniforms.uniforms.sides; }
    set sides(value) { this.resources.kaleidoscopeUniforms.uniforms.sides = value; }
    get angle() { return this.resources.kaleidoscopeUniforms.uniforms.angle; }
    set angle(value) { this.resources.kaleidoscopeUniforms.uniforms.angle = value; }
    get screenSize() { return this.resources.kaleidoscopeUniforms.uniforms.uScreenSize; }
    set screenSize(value) { this.resources.kaleidoscopeUniforms.uniforms.uScreenSize = value; }
}

// --- ADVERSARIAL GLITCH ---
const adversarialFragment = `
    precision highp float;
    in vec2 vTextureCoord;
    out vec4 finalColor;
    
    uniform sampler2D uTexture;
    uniform vec4 uInputSize; 
    
    uniform float uTime;
    uniform float uIntensity;
    uniform float uBands;
    uniform float uShift;
    uniform float uNoiseScale;
    uniform float uChromatic;
    uniform float uScanline;
    uniform float uQNoise;
    uniform float uSeed;

    float hash11(float p) {
        p = fract(p * 0.1031);
        p *= p + 33.33;
        p *= p + p;
        return fract(p);
    }

    float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453 + uSeed);
    }

    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    vec2 perturb(vec2 uv) {
        vec2 p = uv * uNoiseScale + vec2(uSeed * 10.0, 0.0);
        float n1 = noise(p);
        float n2 = noise(p + vec2(7.5, 2.5));
        float ridge = sin(uv.y * (50.0 + 100.0 * n1) + uTime * 0.7);
        float angle = sin(uTime * 0.33 + n2 * 6.28318);
        vec2 dir = vec2(cos(angle), sin(angle));
        vec2 disp = dir * ridge * 0.002 * uIntensity;
        float hf = sin(uv.x * 800.0 + n2 * 10.0) * 0.0008 * uIntensity;
        return uv + disp + vec2(hf, -hf);
    }

    float bandMask(vec2 uv) {
        float bands = max(1.0, uBands);
        float y = uv.y * bands;
        float fracY = fract(y);
        float gate = step(0.5, hash11(floor(y) + uSeed * 100.0));
        float jitter = noise(vec2(fracY * 10.0, uTime * 0.5));
        return gate * jitter;
    }

    vec2 bandShift(vec2 uv) {
        float m = bandMask(uv);
        float shift = (m - 0.5) * 0.002 * uShift; 
        return uv + vec2(shift, 0.0);
    }

    vec3 sampleChromatic(vec2 uv) {
        vec2 cOff = vec2(0.001 * uChromatic, 0.0); 
        float r = texture(uTexture, uv + cOff).r;
        float g = texture(uTexture, uv).g;
        float b = texture(uTexture, uv - cOff).b;
        return vec3(r, g, b);
    }

    vec3 postProcess(vec2 uv, vec3 col) {
        float scan = 0.5 + 0.5 * sin(uv.y * 500.0 * 3.14159);
        col *= mix(1.0, 1.0 + uScanline * (scan - 0.5), uScanline);
        
        if(uQNoise > 0.0) {
            vec3 q = floor(col * (256.0 - uQNoise) + noise(uv * 1024.0) * uQNoise) / (256.0 - uQNoise);
            col = mix(col, q, uQNoise / 8.0);
        }
        return col;
    }

    void main() {
        vec2 uv = vTextureCoord;
        vec2 uvWarp = perturb(uv);
        vec2 uvGlitch = bandShift(uvWarp);
        vec3 col = sampleChromatic(uvGlitch);
        float n = noise(uvGlitch * (uNoiseScale * 0.5 + 0.001 + uIntensity * 0.5));
        col += (n - 0.5) * 0.02 * uIntensity;
        col = postProcess(uvGlitch, col);
        finalColor = vec4(col, 1.0);
    }
`;

export class AdversarialGlitchFilter extends Filter {
    constructor() {
        super({
            glProgram: GlProgram.from({ vertex: defaultFilterVertex, fragment: adversarialFragment, name: 'adversarial-glitch-filter' }),
            resources: {
                adversarialUniforms: {
                    uTime: { value: 0.0, type: 'f32' },
                    uIntensity: { value: 0.8, type: 'f32' },
                    uBands: { value: 24.0, type: 'f32' },
                    uShift: { value: 12.0, type: 'f32' },
                    uNoiseScale: { value: 3.0, type: 'f32' },
                    uChromatic: { value: 1.5, type: 'f32' },
                    uScanline: { value: 0.35, type: 'f32' },
                    uQNoise: { value: 2.0, type: 'f32' },
                    uSeed: { value: 0.42, type: 'f32' }
                }
            }
        });
    }
    
    get time() { return this.resources.adversarialUniforms.uniforms.uTime; }
    set time(v) { this.resources.adversarialUniforms.uniforms.uTime = v; }
    
    set intensity(v) { this.resources.adversarialUniforms.uniforms.uIntensity = v; }
    set bands(v) { this.resources.adversarialUniforms.uniforms.uBands = v; }
    set shift(v) { this.resources.adversarialUniforms.uniforms.uShift = v; }
    set noiseScale(v) { this.resources.adversarialUniforms.uniforms.uNoiseScale = v; }
    set chromatic(v) { this.resources.adversarialUniforms.uniforms.uChromatic = v; }
    set scanline(v) { this.resources.adversarialUniforms.uniforms.uScanline = v; }
    set qNoise(v) { this.resources.adversarialUniforms.uniforms.uQNoise = v; }
    set seed(v) { this.resources.adversarialUniforms.uniforms.uSeed = v; }
}

// --- ADVANCED ASCII / TEXTMODE FILTER ---
const asciiFragment = `
    precision highp float;
    in vec2 vTextureCoord;
    out vec4 finalColor;

    uniform sampler2D uTexture;
    uniform vec4 uInputSize;
    uniform float uSize;      
    uniform float uInvert;    
    uniform float uCharSet;   // 0: Shapes, 1: Data Bars, 2: Binary, 3: Dense
    uniform float uColorMode; // 0: Color, 1: Green, 2: Amber, 3: Cyan, 4: B&W
    uniform float uTime;      // For animations

    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    // --- CHARACTER SETS ---

    // Set 0: Abstract Geometric Shapes
    float charSetShapes(int index, vec2 p) {
        vec2 c = abs(p - 0.5);
        if (index == 0) return 0.0;
        if (index == 1) return step(length(p-0.5), 0.15); // Dot
        if (index == 2) return step(max(c.x, c.y), 0.3) - step(max(c.x, c.y), 0.2); // Box Outline
        if (index == 3) return step(min(c.x, c.y), 0.08); // Plus
        if (index == 4) return step(abs(c.x - c.y), 0.08); // Cross
        if (index >= 5) return 1.0; // Block
        return 0.0;
    }

    // Set 1: Data Flow (Vertical Bars)
    float charSetBars(float brightness, vec2 p) {
        return step(p.y, brightness); // Height based on brightness
    }

    // Set 2: Binary / Crypto (0 or 1)
    float charSetBinary(float brightness, vec2 p, vec2 id) {
        if (brightness < 0.2) return 0.0;
        float r = random(id + floor(uTime * 5.0)); // Random 0 or 1 change speed
        if (r > 0.5) {
            // Draw '1'
            return step(abs(p.x - 0.5), 0.1) * step(abs(p.y - 0.5), 0.35); 
        } else {
            // Draw '0'
            vec2 c = abs(p - 0.5);
            return (step(max(c.x, c.y*0.7), 0.35) - step(max(c.x, c.y*0.7), 0.2));
        }
    }

    // Set 3: Density / Halftone
    float charSetDensity(float brightness, vec2 p) {
        float r = length(p - 0.5) * 2.0;
        return step(r, brightness * 1.2); 
    }

    // --- COLOR MODES ---
    vec3 applyColorMode(vec3 src, float brightness) {
        int mode = int(uColorMode);
        if (mode == 0) return src; // Original
        if (mode == 1) return vec3(0.0, brightness, 0.0); // Matrix Green
        if (mode == 2) return vec3(1.0, 0.7, 0.0) * brightness; // Amber Terminal
        if (mode == 3) return vec3(0.0, 1.0, 1.0) * brightness; // Cyan Cyber
        if (mode == 4) return vec3(brightness); // B&W
        return src;
    }

    void main() {
        vec2 pixelSize = vec2(uSize) / uInputSize.xy;
        vec2 gridID = floor(vTextureCoord / pixelSize);
        vec2 gridUV = gridID * pixelSize + (pixelSize * 0.5);
        
        vec4 color = texture(uTexture, gridUV);
        float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        
        vec2 cellCoord = fract(vTextureCoord / pixelSize);
        float shape = 0.0;

        int set = int(uCharSet);
        if (set == 0) {
            int charIndex = int(floor(brightness * 5.9));
            shape = charSetShapes(charIndex, cellCoord);
        } else if (set == 1) {
            shape = charSetBars(brightness, cellCoord);
        } else if (set == 2) {
            shape = charSetBinary(brightness, cellCoord, gridID);
        } else if (set == 3) {
            shape = charSetDensity(brightness, cellCoord);
        }

        vec3 processedColor = applyColorMode(color.rgb, brightness);
        
        if (uInvert > 0.5) {
            finalColor = vec4(processedColor * (1.0 - shape), 1.0); 
        } else {
            finalColor = vec4(processedColor * shape, 1.0); 
        }
        finalColor.a = 1.0;
    }
`;

export class AsciiFilter extends Filter {
    constructor() {
        super({
            glProgram: GlProgram.from({ vertex: defaultFilterVertex, fragment: asciiFragment, name: 'ascii-filter' }),
            resources: {
                asciiUniforms: {
                    uSize: { value: 8.0, type: 'f32' },
                    uInvert: { value: 0.0, type: 'f32' },
                    uCharSet: { value: 0.0, type: 'f32' },
                    uColorMode: { value: 0.0, type: 'f32' },
                    uTime: { value: 0.0, type: 'f32' }
                }
            }
        });
    }
    get size() { return this.resources.asciiUniforms.uniforms.uSize; }
    set size(v) { this.resources.asciiUniforms.uniforms.uSize = v; }
    
    get invert() { return this.resources.asciiUniforms.uniforms.uInvert; }
    set invert(v) { this.resources.asciiUniforms.uniforms.uInvert = v; }

    get charSet() { return this.resources.asciiUniforms.uniforms.uCharSet; }
    set charSet(v) { this.resources.asciiUniforms.uniforms.uCharSet = v; }

    get colorMode() { return this.resources.asciiUniforms.uniforms.uColorMode; }
    set colorMode(v) { this.resources.asciiUniforms.uniforms.uColorMode = v; }

    get time() { return this.resources.asciiUniforms.uniforms.uTime; }
    set time(v) { this.resources.asciiUniforms.uniforms.uTime = v; }
}
```

---
### `src\utils\pixi\PixiLayerDeck.js`
```js
// src/utils/pixi/PixiLayerDeck.js
import { Container, Sprite, Texture, Graphics } from 'pixi.js';
import ValueInterpolator from '../ValueInterpolator';
import { sliderParams } from '../../config/sliderParams';
import { getDecodedImage } from '../imageDecoder';
import { MAX_TOTAL_OFFSET, MIDI_INTERPOLATION_DURATION, BLEND_MODE_MAP } from './PixiConstants';

// --- SCALE FIX ---
const BASE_SCALE_MODIFIER = 0.5;

class Quadrant {
  constructor(container) {
    this.container = new Container();
    this.mask = new Graphics();
    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5);
    this.container.mask = this.mask;
    this.container.addChild(this.mask);
    this.container.addChild(this.sprite);
    container.addChild(this.container);
  }

  updateMask(x, y, w, h) {
    this.mask.clear();
    this.mask.rect(x, y, w, h);
    this.mask.fill({ color: 0xffffff });
  }

  setTexture(texture) {
    this.sprite.texture = texture;
  }
}

export class PixiLayerDeck {
  constructor(layerId, deckId) {
    this.layerId = layerId;
    this.deckId = deckId;
    this.container = new Container();
    
    this.quadrants = [
      new Quadrant(this.container), 
      new Quadrant(this.container), 
      new Quadrant(this.container), 
      new Quadrant(this.container)  
    ];
    
    this.config = this.getDefaultConfig();
    this.driftState = { x: 0, y: 0, phase: Math.random() * Math.PI * 2 };
    this.continuousAngle = 0;
    
    this.interpolators = {};
    this.playbackValues = {}; 
    this.tokenId = null;
    this._loadingTokenId = null;

    // --- MEMORY OPTIMIZATION: Object Pooling ---
    // We allocate this ONCE. We never create a new object during the render loop.
    this._reusableRenderState = {
        speed: 0, size: 1, opacity: 1, drift: 0, driftSpeed: 0,
        xaxis: 0, yaxis: 0, angle: 0, direction: 1,
        blendMode: 'normal', enabled: true,
        totalAngleRad: 0, driftX: 0, driftY: 0
    };

    sliderParams.forEach(param => {
      if (typeof this.config[param.prop] === 'number') {
        this.interpolators[param.prop] = new ValueInterpolator(this.config[param.prop], MIDI_INTERPOLATION_DURATION);
      }
    });
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

  syncPhysicsFrom(otherDeck) {
    if (!otherDeck) return;
    this.continuousAngle = otherDeck.continuousAngle;
    this.driftState.x = otherDeck.driftState.x;
    this.driftState.y = otherDeck.driftState.y;
    this.driftState.phase = otherDeck.driftState.phase;
    
    Object.keys(this.interpolators).forEach(key => {
        if (otherDeck.interpolators[key]) {
            // Primitive copy only
            this.interpolators[key].currentValue = otherDeck.interpolators[key].currentValue;
            this.interpolators[key].startValue = otherDeck.interpolators[key].currentValue;
            this.interpolators[key].targetValue = otherDeck.interpolators[key].targetValue;
            this.interpolators[key].isInterpolating = otherDeck.interpolators[key].isInterpolating;
        }
    });
  }

  async setTexture(imageSrc, tokenId) {
    if (this.tokenId === tokenId) return;
    this._loadingTokenId = tokenId;
    if (!imageSrc) {
        this.tokenId = tokenId;
        this.quadrants.forEach(q => q.setTexture(Texture.EMPTY));
        return;
    }
    try {
      const imageBitmap = await getDecodedImage(imageSrc);
      if (this._loadingTokenId === tokenId) {
          this.tokenId = tokenId;
          const texture = Texture.from(imageBitmap);
          this.quadrants.forEach(q => q.setTexture(texture));
      }
    } catch (e) { 
        console.warn(`[PixiLayerDeck] Failed texture load for ${tokenId}`);
    }
  }

  updateConfig(key, value) {
    this.config[key] = value;
    if (this.interpolators[key]) {
        this.interpolators[key].setTarget(value);
    }
  }

  // Optimized method for direct property updates (no object allocation)
  setProperty(key, value) {
    this.config[key] = value; 
    if (this.interpolators[key]) {
        this.interpolators[key].snap(value);
    }
  }

  snapConfig(fullConfig) {
    // We iterate manually to avoid creating a new object with spread {...}
    for (const key in fullConfig) {
        this.config[key] = fullConfig[key];
        if (this.interpolators[key]) {
            this.interpolators[key].snap(fullConfig[key]);
        }
    }
  }

  getState() {
    // Only used for saving/snapshots, so allocation here is fine
    return { 
        config: {...this.config}, 
        driftState: {...this.driftState}, 
        continuousRotationAngle: this.continuousAngle, 
        playbackValues: {...this.playbackValues} 
    };
  }

  stepPhysics(deltaTime, now) {
    // Avoid Object.values allocation
    for (const key in this.interpolators) {
        this.interpolators[key].update(now);
    }
    
    // Inline access helper to avoid closure allocation
    // getVal(prop) => this.playbackValues[prop] ?? this.interpolators[prop].getCurrentValue();
    
    const getVal = (k) => (this.playbackValues[k] !== undefined ? this.playbackValues[k] : this.interpolators[k].currentValue);
    
    const speed = getVal('speed');
    const direction = this.config.direction || 1;
    const drift = getVal('drift');
    const driftSpeed = getVal('driftSpeed');

    this.continuousAngle += (speed * direction * deltaTime * 600);

    if (drift > 0) {
        this.driftState.phase += deltaTime * driftSpeed * 1.0;
        // Optimized math
        const xVal = Math.sin(this.driftState.phase) * drift * 1.5;
        const yVal = Math.cos(this.driftState.phase * 0.7 + 0.785398) * drift * 1.5; // 0.785398 = PI/4
        
        // Clamp without creating new Math objects
        this.driftState.x = xVal < -MAX_TOTAL_OFFSET ? -MAX_TOTAL_OFFSET : (xVal > MAX_TOTAL_OFFSET ? MAX_TOTAL_OFFSET : xVal);
        this.driftState.y = yVal < -MAX_TOTAL_OFFSET ? -MAX_TOTAL_OFFSET : (yVal > MAX_TOTAL_OFFSET ? MAX_TOTAL_OFFSET : yVal);
    } else {
        this.driftState.x *= 0.95; 
        this.driftState.y *= 0.95;
    }
  }

  resolveRenderState() {
    // --- ZERO ALLOCATION: Reuse the existing object ---
    const s = this._reusableRenderState;
    const getVal = (k) => (this.playbackValues[k] !== undefined ? this.playbackValues[k] : this.interpolators[k].currentValue);

    const angle = getVal('angle');
    
    s.speed = getVal('speed');
    s.size = getVal('size');
    s.opacity = getVal('opacity');
    s.drift = getVal('drift');
    s.driftSpeed = getVal('driftSpeed');
    s.xaxis = getVal('xaxis');
    s.yaxis = getVal('yaxis');
    s.angle = angle;
    s.direction = this.config.direction || 1;
    s.blendMode = this.config.blendMode;
    s.enabled = this.config.enabled;
    s.driftX = this.driftState.x;
    s.driftY = this.driftState.y;
    
    // Pre-calculate radians here
    const totalAngleDeg = angle + this.continuousAngle;
    s.totalAngleRad = (totalAngleDeg * 0.01745329251); // PI / 180 constant

    return s;
  }

  applyRenderState(state, alphaMult, beatFactor, parallaxOffset, parallaxFactor, screen) {
    if (alphaMult <= 0.001 || !state.enabled || !this.tokenId) { 
        this.container.visible = false; 
        return; 
    }
    this.container.visible = true;

    const screenW = screen.width; 
    const screenH = screen.height;
    const halfW = screenW * 0.5; 
    const halfH = screenH * 0.5;
    
    const pX = parallaxOffset.x * parallaxFactor;
    const pY = parallaxOffset.y * parallaxFactor;
    
    const targetX = halfW + (state.xaxis * 0.1) + state.driftX + pX;
    const targetY = halfH + (state.yaxis * 0.1) + state.driftY + pY;
    
    // Access sprite texture directly
    const tex = this.quadrants[0].sprite.texture;
    let screenRelativeScale = 1.0;
    
    if (tex && tex.valid && tex.width > 1) {
        const fitWidth = halfW / tex.width;
        const fitHeight = halfH / tex.height;
        screenRelativeScale = (fitWidth < fitHeight) ? fitWidth : fitHeight;
    }
    
    let finalScale = state.size * screenRelativeScale * beatFactor * BASE_SCALE_MODIFIER;
    if (finalScale < 0.001) finalScale = 0.001;

    const finalAlpha = state.opacity * alphaMult;
    const blend = BLEND_MODE_MAP[state.blendMode] || 'normal';
    const rad = state.totalAngleRad;

    // Unroll the loop manually for performance
    this._updateQuadrant(this.quadrants[0], targetX, targetY, finalScale, finalScale, rad, finalAlpha, blend);
    this._updateQuadrant(this.quadrants[1], screenW - targetX, targetY, -finalScale, finalScale, -rad, finalAlpha, blend);
    this._updateQuadrant(this.quadrants[2], targetX, screenH - targetY, finalScale, -finalScale, -rad, finalAlpha, blend);
    this._updateQuadrant(this.quadrants[3], screenW - targetX, screenH - targetY, -finalScale, -finalScale, rad, finalAlpha, blend);
  }

  _updateQuadrant(quad, x, y, sx, sy, rot, alpha, blend) {
    // Direct property access is slightly faster than .set()
    quad.sprite.position.x = x;
    quad.sprite.position.y = y;
    quad.sprite.scale.x = sx;
    quad.sprite.scale.y = sy;
    quad.sprite.rotation = rot;
    quad.sprite.alpha = alpha;
    
    // Only update blendMode if it changed (avoids PIXI internal state thrashing)
    if (quad.container.blendMode !== blend) {
        quad.container.blendMode = blend;
    }
  }

  resize(renderer) {
    const w = renderer.screen.width;
    const h = renderer.screen.height;
    // Use bitwise floor for speed
    const hw = (w * 0.5) | 0; 
    const hh = (h * 0.5) | 0;
    
    this.quadrants[0].updateMask(0, 0, hw, hh);
    this.quadrants[1].updateMask(hw, 0, w - hw, hh);
    this.quadrants[2].updateMask(0, hh, hw, h - hh);
    this.quadrants[3].updateMask(hw, hh, w - hw, h - hh);
  }
}
```

---
### `src\utils\PixiEngine.js`
```js
// src/utils/PixiEngine.js
import { Application, Container, RenderTexture, Mesh, PlaneGeometry } from 'pixi.js';
import { PixiLayerDeck } from './pixi/PixiLayerDeck';
import { PixiEffectsManager } from './pixi/PixiEffectsManager';
import { lerp, lerpAngle } from './helpers';
import { useEngineStore } from '../store/useEngineStore'; 

export default class PixiEngine {
  constructor(canvasElement) {
    this.app = new Application();
    this.canvas = canvasElement;
    this.layers = {}; 
    this.layerList = []; 
    this.isReady = false;
    this.crossfadeValue = 0.0;
    this.effectsManager = new PixiEffectsManager();
    this.mainLayerGroup = new Container(); 
    this.audioFrequencyFactors = { '1': 1.0, '2': 1.0, '3': 1.0 };
    this.beatPulseFactor = 1.0;
    this.beatPulseEndTime = 0;
    this.latestAudioData = { level: 0, frequencyBands: { bass: 0, mid: 0, treble: 0 } };
    this.industrialConfig = { enabled: false, chaos: 0, mappings: {} };
    this.parallaxOffset = { x: 0, y: 0 };
    this.renderedParallaxOffset = { x: 0, y: 0 };
    this.parallaxFactors = { '1': 10, '2': 25, '3': 50 };
    this.isMappingActive = false;
    this.renderTexture = null;
    this.projectionMesh = null;
    this.transitionMode = 'crossfade'; 
    this.lastCrossfadeValue = 0.0;
    this.flythroughSequence = 'A->B'; 
    this._morphedState = {}; 
    this._resizeHandler = this.handleResize.bind(this);
  }

  async init() {
    if (this.isReady) return;
    const maxRes = 1.5; 
    const resolution = Math.min(window.devicePixelRatio || 1, maxRes);
    await this.app.init({
      canvas: this.canvas,
      resizeTo: this.canvas.parentElement, 
      backgroundAlpha: 0,
      antialias: true,
      resolution: resolution,
      autoDensity: true,
      powerPreference: 'high-performance', 
      preference: 'webgl',
    });
    this.effectsManager.init(this.app.screen);
    ['1', '2', '3'].forEach(id => {
      const container = new Container();
      const deckA = new PixiLayerDeck(id, 'A');
      const deckB = new PixiLayerDeck(id, 'B');
      container.addChild(deckA.container);
      container.addChild(deckB.container);
      const layerObj = { id, container, deckA, deckB };
      this.layers[id] = layerObj;
      this.layerList.push(layerObj);
      this.mainLayerGroup.addChild(container);
    });
    this.mainLayerGroup.filters = this.effectsManager.getFilterList();
    this.app.stage.addChild(this.mainLayerGroup);
    this.initMappingResources();
    this.app.renderer.on('resize', this._resizeHandler);
    this.handleResize(); 
    this.app.ticker.add((ticker) => this.update(ticker));
    const state = useEngineStore.getState();
    this.crossfadeValue = state.renderedCrossfader;
    this.isReady = true;
    if (import.meta.env.DEV) console.log("[PixiEngine] Initialized.");
  }

  setRenderedCrossfade(value) { this.crossfadeValue = value; }
  setTransitionMode(mode) { this.transitionMode = mode; }
  setAudioData(data) { this.latestAudioData = data; }

  setIndustrialConfig(config) {
      this.industrialConfig = config;
      if (!config.enabled) {
          this.effectsManager.updateDestructionMode(this.latestAudioData, config);
          this.mainLayerGroup.filters = this.effectsManager.getFilterList();
      }
  }

  initMappingResources() {
    const { width, height } = this.app.screen;
    this.renderTexture = RenderTexture.create({ width, height, resolution: this.app.renderer.resolution });
    const geometry = new PlaneGeometry({ width, height, verticesX: 2, verticesY: 2 });
    this.projectionMesh = new Mesh({ geometry, texture: this.renderTexture });
  }

  setMappingMode(isActive) {
    this.isMappingActive = isActive;
    if (isActive) {
        this.app.stage.removeChild(this.mainLayerGroup);
        this.app.stage.addChild(this.projectionMesh);
    } else {
        this.app.stage.removeChild(this.projectionMesh);
        this.app.stage.addChild(this.mainLayerGroup);
    }
  }

  updateCorner(index, x, y) {
    if (!this.projectionMesh) return;
    const buffer = this.projectionMesh.geometry.getAttribute('aPosition').buffer;
    if (buffer.data) {
        buffer.data[index * 2] = x;
        buffer.data[index * 2 + 1] = y;
        buffer.update();
    }
  }

  handleResize() {
    if (!this.app || !this.app.renderer) return;
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    if (this.renderTexture) this.renderTexture.resize(w, h);
    if (this.mainLayerGroup) this.mainLayerGroup.filterArea = this.app.screen;
    for (let i = 0; i < this.layerList.length; i++) {
        const layer = this.layerList[i];
        layer.deckA.resize(this.app.renderer);
        layer.deckB.resize(this.app.renderer);
    }
  }

  triggerVisualEffect(type, config = {}) {
    this.effectsManager.triggerOneShot(type, config, this.app.screen);
    this.mainLayerGroup.filters = this.effectsManager.getFilterList();
  }

  updateEffectConfig(name, param, value) {
    this.effectsManager.updateConfig(name, param, value);
    this.mainLayerGroup.filters = this.effectsManager.getFilterList();
  }

  update(ticker) {
    const now = performance.now();
    const deltaTime = ticker.deltaTime * 0.01666;
    const state = useEngineStore.getState();
    this.transitionMode = state.transitionMode; 

    if (this.app && this.app.screen && this.mainLayerGroup) {
        this.mainLayerGroup.filterArea = this.app.screen;
    }

    if (this.industrialConfig.enabled) {
        this.effectsManager.updateDestructionMode(this.latestAudioData, this.industrialConfig);
        this.mainLayerGroup.filters = this.effectsManager.getFilterList();
    }

    this.effectsManager.update(ticker, this.app.renderer);

    // --- LOGIC: SCENE SHREDDER (Industrial Mode) ---
    // If enabled, we override the crossfader value based on audio bass
    let effectiveCrossfade = this.crossfadeValue;
    
    if (this.industrialConfig.enabled) {
        const shredMap = this.industrialConfig.mappings?.crossfaderShred;
        if (shredMap && shredMap.enabled && shredMap.amount > 0) {
            const bands = this.latestAudioData.frequencyBands;
            const sourceVal = shredMap.source === 'level' ? this.latestAudioData.level : (bands[shredMap.source] || 0);
            
            // If the audio hit is strong enough (kick), force a jump
            if (sourceVal * shredMap.amount > 0.6) {
                // If it's a kick, snap to 0 or 1 randomly or strobe between them
                // Using Math.sin(now) to create a strobe effect if held
                effectiveCrossfade = Math.sin(now * 0.05) > 0 ? 1.0 : 0.0;
            }
        }
    }

    // Update flythrough sequence based on effective value
    if (effectiveCrossfade >= 0.999) this.flythroughSequence = 'B->A';
    else if (effectiveCrossfade <= 0.001) this.flythroughSequence = 'A->B';
    
    this.lastCrossfadeValue = effectiveCrossfade;

    let currentBeatFactor = this.beatPulseEndTime > now ? this.beatPulseFactor : 1.0;
    
    this.renderedParallaxOffset.x += (this.parallaxOffset.x - this.renderedParallaxOffset.x) * 0.05;
    this.renderedParallaxOffset.y += (this.parallaxOffset.y - this.renderedParallaxOffset.y) * 0.05;

    for (let i = 0; i < this.layerList.length; i++) {
      const layer = this.layerList[i];
      const audioScale = this.audioFrequencyFactors[layer.deckA.layerId] || 1.0;
      const combinedBeatFactor = currentBeatFactor * audioScale;

      let renderA = true;
      let renderB = true;

      // Use effectiveCrossfade here
      if (this.transitionMode === 'crossfade') {
          if (effectiveCrossfade > 0.999) renderA = false;
          if (effectiveCrossfade < 0.001) renderB = false;
      }

      if (renderA) layer.deckA.stepPhysics(deltaTime, now);
      if (renderB) layer.deckB.stepPhysics(deltaTime, now);

      const stateA = renderA ? layer.deckA.resolveRenderState() : null;
      const stateB = renderB ? layer.deckB.resolveRenderState() : null;
      
      if (this.transitionMode === 'flythrough') {
          const t = effectiveCrossfade;
          let scaleMultA, alphaMultA;
          let scaleMultB, alphaMultB;
          const SIDEWAYS_FORCE = -25000; 
          const VERTICAL_FORCE = -8000;

          if (this.flythroughSequence === 'A->B') {
              const easeOut = t * t * t * t; 
              if (renderA) {
                  scaleMultA = 1.0 + (59.0) * easeOut; 
                  stateA.driftX += easeOut * SIDEWAYS_FORCE;
                  stateA.driftY += easeOut * VERTICAL_FORCE;
                  const fadeStartZoom = layer.deckA.layerId === '1' ? 1.1 : (layer.deckA.layerId === '2' ? 1.5 : 3.0);
                  const fadeEndZoom = layer.deckA.layerId === '1' ? 4.0 : (layer.deckA.layerId === '2' ? 8.0 : 20.0);
                  if (scaleMultA > fadeStartZoom) {
                      const fadeProg = (scaleMultA - fadeStartZoom) / (fadeEndZoom - fadeStartZoom);
                      alphaMultA = 1.0 - fadeProg;
                      if (alphaMultA < 0) alphaMultA = 0;
                  } else { alphaMultA = 1.0; }
                  stateA.size = stateA.size * scaleMultA;
                  layer.deckA.applyRenderState(stateA, alphaMultA, combinedBeatFactor, this.renderedParallaxOffset, this.parallaxFactors[layer.deckA.layerId], this.app.screen);
              } else { layer.deckA.container.visible = false; }

              if (renderB) {
                  scaleMultB = t; 
                  alphaMultB = t * 5.0;
                  if (alphaMultB > 1.0) alphaMultB = 1.0;
                  stateB.size = stateB.size * scaleMultB;
                  layer.deckB.applyRenderState(stateB, alphaMultB, combinedBeatFactor, this.renderedParallaxOffset, this.parallaxFactors[layer.deckB.layerId], this.app.screen);
              } else { layer.deckB.container.visible = false; }
              layer.container.setChildIndex(layer.deckB.container, 0); 
              layer.container.setChildIndex(layer.deckA.container, 1);
          } else {
              const rt = 1.0 - t;
              const easeOut = rt * rt * rt * rt;
              if (renderB) {
                  scaleMultB = 1.0 + (59.0) * easeOut;
                  stateB.driftX += easeOut * SIDEWAYS_FORCE;
                  stateB.driftY += easeOut * VERTICAL_FORCE;
                  const fadeStartZoom = layer.deckA.layerId === '1' ? 1.1 : (layer.deckA.layerId === '2' ? 1.5 : 3.0);
                  const fadeEndZoom = layer.deckA.layerId === '1' ? 4.0 : (layer.deckA.layerId === '2' ? 8.0 : 20.0);
                  if (scaleMultB > fadeStartZoom) {
                      const fadeProg = (scaleMultB - fadeStartZoom) / (fadeEndZoom - fadeStartZoom);
                      alphaMultB = 1.0 - fadeProg;
                      if (alphaMultB < 0) alphaMultB = 0;
                  } else { alphaMultB = 1.0; }
                  stateB.size = stateB.size * scaleMultB;
                  layer.deckB.applyRenderState(stateB, alphaMultB, combinedBeatFactor, this.renderedParallaxOffset, this.parallaxFactors[layer.deckB.layerId], this.app.screen);
              } else { layer.deckB.container.visible = false; }

              if (renderA) {
                  scaleMultA = rt;
                  alphaMultA = rt * 5.0;
                  if (alphaMultA > 1.0) alphaMultA = 1.0;
                  stateA.size = stateA.size * scaleMultA;
                  layer.deckA.applyRenderState(stateA, alphaMultA, combinedBeatFactor, this.renderedParallaxOffset, this.parallaxFactors[layer.deckA.layerId], this.app.screen);
              } else { layer.deckA.container.visible = false; }
              layer.container.setChildIndex(layer.deckA.container, 0);
              layer.container.setChildIndex(layer.deckB.container, 1);
          }
      } else {
          const angle = effectiveCrossfade * 1.570796; 
          const opacityA = Math.cos(angle);
          const opacityB = Math.sin(angle);
          
          if (renderA && renderB) {
              const ms = this._morphedState;
              ms.speed = effectiveCrossfade < 0.5 ? stateA.speed : stateB.speed;
              ms.size = lerp(stateA.size, stateB.size, effectiveCrossfade);
              ms.opacity = lerp(stateA.opacity, stateB.opacity, effectiveCrossfade);
              ms.drift = lerp(stateA.drift, stateB.drift, effectiveCrossfade);
              ms.driftSpeed = lerp(stateA.driftSpeed, stateB.driftSpeed, effectiveCrossfade);
              ms.xaxis = lerp(stateA.xaxis, stateB.xaxis, effectiveCrossfade);
              ms.yaxis = lerp(stateA.yaxis, stateB.yaxis, effectiveCrossfade);
              ms.angle = lerpAngle(stateA.angle, stateB.angle, effectiveCrossfade);
              ms.direction = effectiveCrossfade < 0.5 ? stateA.direction : stateB.direction;
              ms.blendMode = effectiveCrossfade < 0.5 ? stateA.blendMode : stateB.blendMode;
              ms.enabled = effectiveCrossfade < 0.5 ? stateA.enabled : stateB.enabled;
              ms.driftX = lerp(stateA.driftX, stateB.driftX, effectiveCrossfade);
              ms.driftY = lerp(stateA.driftY, stateB.driftY, effectiveCrossfade);
              const currentContinuous = lerp(layer.deckA.continuousAngle, layer.deckB.continuousAngle, effectiveCrossfade);
              const totalAngleDeg = ms.angle + currentContinuous;
              ms.totalAngleRad = (totalAngleDeg * 0.01745329251);
              layer.deckA.applyRenderState(ms, opacityA, combinedBeatFactor, this.renderedParallaxOffset, this.parallaxFactors[layer.deckA.layerId], this.app.screen);
              layer.deckB.applyRenderState(ms, opacityB, combinedBeatFactor, this.renderedParallaxOffset, this.parallaxFactors[layer.deckB.layerId], this.app.screen);
          } else {
              if (renderA) { layer.deckA.applyRenderState(stateA, opacityA, combinedBeatFactor, this.renderedParallaxOffset, this.parallaxFactors[layer.deckA.layerId], this.app.screen); } 
              else { layer.deckA.container.visible = false; }
              if (renderB) { layer.deckB.applyRenderState(stateB, opacityB, combinedBeatFactor, this.renderedParallaxOffset, this.parallaxFactors[layer.deckB.layerId], this.app.screen); } 
              else { layer.deckB.container.visible = false; }
          }
      }
    }
    if (this.isMappingActive) {
        this.app.renderer.render({ container: this.mainLayerGroup, target: this.renderTexture });
    }
  }

  async setTexture(layerId, deckSide, imageSrc, tokenId) {
    if (!this.isReady || !this.layers[layerId]) return;
    const deck = deckSide === 'A' ? this.layers[layerId].deckA : this.layers[layerId].deckB;
    await deck.setTexture(imageSrc, tokenId);
  }

  updateConfig(layerId, key, value, deckSide = 'A') {
    if (!this.layers[layerId]) return;
    const deck = deckSide === 'A' ? this.layers[layerId].deckA : this.layers[layerId].deckB;
    deck.updateConfig(key, value);
  }

  snapConfig(layerId, fullConfig, deckSide = 'A') {
    if (!this.layers[layerId]) return;
    const deck = deckSide === 'A' ? this.layers[layerId].deckA : this.layers[layerId].deckB;
    deck.snapConfig(fullConfig);
  }

  getState(layerId, deckSide) {
    if (!this.layers[layerId]) return null;
    const deck = deckSide === 'A' ? this.layers[layerId].deckA : this.layers[layerId].deckB;
    return deck.getState();
  }

  setAudioFactors(factors) { this.audioFrequencyFactors = { ...this.audioFrequencyFactors, ...factors }; }
  triggerBeatPulse(factor, duration) { this.beatPulseFactor = factor; this.beatPulseEndTime = performance.now() + duration; }
  setParallax(x, y) { this.parallaxOffset = { x, y }; }
  applyPlaybackValue(layerId, key, value) { 
      if (this.layers[layerId]) { 
          this.layers[layerId].deckA.playbackValues[key] = value; 
          this.layers[layerId].deckB.playbackValues[key] = value; 
      } 
  }
  clearPlaybackValues() { 
      for (let i=0; i<this.layerList.length; i++) {
          const l = this.layerList[i];
          l.deckA.playbackValues = {};
          l.deckB.playbackValues = {};
      }
  }
  syncDeckPhysics(layerId, targetDeckSide) {
      const layer = this.layers[layerId];
      if (!layer) return;
      const target = targetDeckSide === 'A' ? layer.deckA : layer.deckB;
      const source = targetDeckSide === 'A' ? layer.deckB : layer.deckA;
      const normalizedAngle = ((source.continuousAngle % 360) + 360) % 360;
      source.continuousAngle = normalizedAngle;
      target.syncPhysicsFrom(source);
  }
  destroy() { 
      if (this.app) {
          if (this.app.renderer) { this.app.renderer.off('resize', this._resizeHandler); }
          if (import.meta.env.DEV) console.log("[PixiEngine] Destroying application instance.");
          this.app.destroy(true, { children: true, texture: false, baseTexture: false }); 
      }
      this.isReady = false; 
  }
}
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
  server: {
    proxy: {
      // Forward calls to /api to the Netlify Functions server (default port 8888)
      '/api': {
        target: 'http://localhost:8888/.netlify/functions',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: { // Vitest configuration
    globals: true, 
    environment: 'jsdom', 
    setupFiles: './src/setupTests.js', 
    css: true, 
    env: { 
      DEV: 'true', 
    },
  },
});
```
