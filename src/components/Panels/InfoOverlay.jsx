// src/components/Panels/InfoOverlay.jsx
// FINAL VERSION v7: Using blue wordmark, adjusted structure slightly for consistency
// Extended with IP Rights Tab
// Refactored to remove list structures (ul, ol, li) and replace with paragraphs
// Added Audio Reactivity Tab

import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import "./PanelStyles/InfoOverlay.css";

import radarWordmarkBlue from "../../assets/branding/radarwordmarkblue.svg"; 

const InfoOverlay = ({ isOpen, onClose }) => {
  const [transitionState, setTransitionState] = useState("initial");
  const [activeTab, setActiveTab] = useState("philosophy");

  useEffect(() => {
    if (isOpen) {
      setTransitionState("fadeToContent"); 
    } else {
      setTransitionState("exiting");
      setTimeout(() => setTransitionState("initial"), 300); 
    }
  }, [isOpen]);

  const handleClose = () => {
    setTransitionState("exiting");
    setTimeout(onClose, 300); 
  };

  const handleBackgroundClick = (e) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "philosophy":
        return (
          <div className="tab-pane">
            <h3>Stop letting your assets gather virtual dust</h3>
            <p>
              Most NFTs are digital posters in expensive frames. Static.
              Lifeless. Collecting virtual dust in a wallet that's little more
              than a glorified vault. Is that really the revolution? That
              thinking misses the entire point of true digital ownership, decentralization and the
              universe of possibility unlocked by LUKSO's Universal Profiles.
            </p>
            <h4>Decentralization Creates</h4>
            <p>
              Centralized platforms lure you in, then dictate exactly how you can
              interact with the stuff "you supposedly own". Their APIs, their
              features, their arbitrary limits. They build the playground, you
              just get to use the swings they allow.
            </p>
            <p>
              LUKSO flips the script. Your Universal Profile is your own sovereign space on the blockchain. Your
              assets, your data, your configurations. They all live with you, under
              your control, accessible through open standards.
            </p>
            <div className="info-card">
              <h4>Your NFTs are an Engine</h4>
              <p>
                RADAR is the antidote to static and treats your NFTs as a living
                visual source. Assign NFTs to layers, make them breathe with
                audio, contort them with MIDI and make them react to on-chain
                events. Where most blockchain interactions remain abstract data,
                RADAR turns these into a visual experience.
              </p>
            </div>
            <div className="info-card">
              <h4>Ownership = Uncensored Freedom to Use (and Abuse)</h4>
              <p>
                Holding is basic. Using is power. RADAR gives you the freedom to
                push your owned assets. Layer 'em, glitch 'em, blend 'em into
                oblivion. Save infinite configurations on chain, discover visuals
                the original creator couldn't fathom. Break the mold. Go wild.
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
            <div className="info-card">
              <h4>Composable & Open: Build Together</h4>
              <p>
                Visual presets, MIDI maps, event reactions, they are all stored
                on your profile, using ERC725Y keys. This isn't locked away in a
                database; it's decentralized data YOU own. Imagine building a
                collaborative and collective visual database. RADAR makes it
                possible through the usage of a globally defined MIDI map key
                tied to your profile. This makes cross profile VJ'ing possible,
                you can not only just check out another profile's presets, you
                can also play their owned assets while you are browsing them. Imagine it like this:
                if the RADAR Genesis Collection happens to sell out, you can perceive it as a collection
                that is now actually owned by the community. How? By setting up your owned assets
                as presets through saved dynamic keys, you also make them available to others to play around with.
                So, your profile not only looks good with your own presets, people now have a reason to visit your
                profile because you have the most / coolest presets available. Tying this with the global MIDI key
                that is loaded from your profile while browsing his presets opens another door to the imagination
                how these keys can be used.

              </p>
            </div>
            <div className="info-card">
              <h4>Provenance + Use is the Future</h4>
              <p>
                Forget archaic IP restrictions. On LUKSO, LSP4 metadata provides
                immutable, on-chain proof of origin, linked to the creator's UP.
                That's provenance solved, right at the front door. RADAR focuses
                on the next step: empowering radical use and transformation of
                your owned assets. It's about creative liberation, not legal
                handcuffs.
              </p>
            </div>
            <p style={{ marginTop: "var(--space-lg)", fontWeight: "bold" }}>
              While others are still figuring out profile pictures, LUKSO built
              the operating system for the decentralized future. It's here so
              stop letting your assets gather virtual dust. Load 'em UP! Crank
              the knobs. RADAR is a statement against digital stagnation. It's
              proof that the future of digital art is dynamic, interactive,
              deeply personal and radically free.
            </p>
          </div>
        );
      case "general":
        return (
          <div className="tab-pane">
            <h3>What is RADAR?</h3>
            <p>
              RADAR is short for "Reactive Asset Driven Audio Receiver", it's way more than just an
              NFT viewer; it's a high-performance, multi-layer visual
              synthesizer built for the revolutionary architecture of the LUKSO
              ecosystem. It lives directly within your Universal Profile,
              transforming your static digital assets into dynamic, interactive
              art pieces you control.
            </p>
            <div className="info-card">
              <h4>Core Pillars:</h4>
              <p>
                <strong>Visual Synthesis Engine:</strong> Utilizes a 3-layer
                system where LSP8 NFTs become the raw visual material,
                manipulated in real-time.
              </p>
              <p>
                <strong>Multi-Modal Reactivity:</strong> Responds dynamically
                to external stimuli, the rhythm and frequencies of audio (Web
                Audio API) and the precise control of MIDI hardware (Web MIDI
                API).
              </p>
              <p>
                <strong>Blockchain Awareness (LSP1):</strong> Directly connects
                to your Universal Profile's event stream via the LSP1
                Universal Receiver standard, enabling visual reactions (for now custom color coded pulses) to
                on-chain activity like receiving LYX, receiving and sending LSP7/8 tokens, Follower lost, Follower Gained.
                You can fullsceen the RADAR application on a second screen, put on some good music, activate the responsive audio layers, pour in a coctail and get notified through these color coded pulses.
                At a glance you can see what events are incoming. 
                This makes blockchain events not only tied to just data driven notifications but actual visual experiences you have set up yourself, fully saved on chain.
              </p>
              <p>
                <strong>Decentralized State (ERC725Y):</strong> All your
                configurations, intricate visual presets, personalized MIDI
                mappings, custom event reactions are saved directly onto
                your Universal Profile using ERC725Y key-value
                storage. No servers, no databases, just your profile.
              </p>
              <p>
                <strong>Optimized Performance:</strong> Engineered for
                fluidity, targeting high FPS to ensure a seamless, immersive
                visual experience even with complex layer interactions.
              </p>
            </div>
            <p>
              RADAR is a demonstration of LUKSO's potential: creating
              applications that are deeply integrated with user identity, truly
              ownable, and capable of unlocking unprecedented creative utility
              for digital assets.
            </p>
          </div>
        );
      case "layers":
        return (
          <div className="tab-pane">
            <h3>Layer Controls & MIDI Mastery</h3>
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
            <div className="info-card">
              <h4>MIDI Integration: Your Tactile Command Center</h4>
              <p>Why click when you can play? RADAR features robust MIDI Learn:</p>
              <p>Connect your MIDI controller.</p>
              <p>
                When connecting a class compliant USB MIDI contoller through the MIDI button in the bottom right a midi learn function becomes available in the controls panel.
                Click the small 'M' button next to any parameter (Speed, Size,
                X Pos, etc.). Move a physical knob, fader, or pad on your controller. Boom. Mapped. Instantly.
              </p>
              <p>
                The magic? Your entire mapping setup is saved as{" "}
                <strong>one single entry</strong> (
                <code>RADAR.MIDI.ParameterMap</code>) in your UP's ERC725Y
                storage. Load any visual preset and your knobs always control the
                same parameters. This persistent, global mapping is only possible
                thanks to LUKSO's on-chain profile storage.
              </p>
            </div>
          </div>
        );
      case "audioReactivity":
        return (
          <div className="tab-pane">
            <h3>Audio Reactivity Setup (Using Virtual Audio Cable & Voicemeeter)</h3>
            <p>
              To make RADAR's visuals react to the audio playing on your computer (e.g., from your browser or music player), you can route your audio through Voicemeeter using a Virtual Audio Cable. This gives you fine-grained control.
            </p>
            <div className="info-card">
              <h4>Prerequisites:</h4>
              <p>
                <strong>Voicemeeter (Standard version or Banana/Potato) installed.</strong> Get it from vb-audio.com/Voicemeeter/.
              </p>
              <p>
                <strong>Restart your computer after installing these.</strong>
              </p>
            </div>
            <div className="info-card">
              <h4>Steps:</h4>
              <p>
                <strong>1. Route Desired Audio to Virtual Cable (Recommended for Browser/App Audio):</strong>
              </p>
              <p style={{ paddingLeft: "var(--space-md)" }}>
                In Windows Sound settings ("Open Sound settings" -{">"} "App volume and device preferences"):
                Find your web browser.
                Change its Output device to "CABLE Input (VB-Audio Virtual Cable)".
              </p>
              <p style={{ paddingLeft: "var(--space-md)" }}>
                Alternatively, for simpler system-wide audio capture (less granular), set "CABLE Input" as your Default Playback Device in Windows Sound settings (Playback tab).
              </p>
              <p>
                <strong>2. Configure Voicemeeter:</strong>
              </p>
              <p style={{ paddingLeft: "var(--space-md)" }}>
                Open Voicemeeter.
                Hardware Input 1 (Stereo Input 1 or 2): Click its name and select "CABLE Output (VB-Audio Virtual Cable)". This brings audio from the virtual cable into Voicemeeter.
                Ensure this channel is active (fader up, not muted). Enable its output to A1 (or your main hardware out) if you want to monitor this source through Voicemeeter.
              </p>
              <p style={{ paddingLeft: "var(--space-md)" }}>
                Hardware Out (A1 is the MAIN OUT): Click "A1" (last channel strip) and select your main speakers/headphones. Done.
              </p>
              <p>
                <strong>3. Browser Permissions for RADAR:</strong>
              </p>
              <p style={{ paddingLeft: "var(--space-md)" }}>
                When enabling Audio Reactivity in RADAR, your browser will ask for microphone permission.
                Select "Voicemeeter Output" (from step 3) as the microphone source.
              </p>
            </div>
            <div className="info-card">
              <h4>How it Works:</h4>
              <p>
                Your application sends sound to "CABLE Input." "CABLE Output" feeds this into Voicemeeter. Voicemeeter processes it, sends it to your speakers (via A1) AND to its own virtual "Voicemeeter Output." RADAR listens to "Voicemeeter Output" as a microphone.
              </p>
            </div>
            <p>
              This method allows selective audio routing for the visualizer.
            </p>
            <div className="info-card">
                <h4>Embedding RADAR with Permissions:</h4>
                <p>
                If you are embedding RADAR (e.g., in an iframe), ensure you grant the necessary permissions for full functionality:
                </p>
                <p>
                <code>{`<iframe src="https://radar725.netlify.app/" allow="microphone, midi, fullscreen"></iframe>`}</code>
                </p>
                <p>
                This allows RADAR to access the microphone (for audio reactivity), MIDI devices, and enter fullscreen mode.
                </p>
            </div>
          </div>
        );
      case "events":
        return (
          <div className="tab-pane">
            <h3>LSP1 UniversalReceiver: Visualizing Your Blockchain Life</h3>
            <p>
              Your Universal Profile isn't just a container; it's an active
              participant on the blockchain. RADAR taps into this activity using
              the standardized <strong>LSP1 UniversalReceiver</strong>, turning
              on-chain events into visual feedback.
            </p>
            <div className="info-card">
              <h4>The LSP1 Advantage:</h4>
              <p>
                <strong>Standardized Notifications:</strong> LSP1 provides a
                single, reliable endpoint on your UP for receiving
                notifications about incoming value (LYX, LSP7 Tokens) and
                potentially other standardized actions across the ecosystem.
              </p>
              <p>
                <strong>Real-Time Connection:</strong> RADAR maintains a
                WebSocket connection to monitor these LSP1 events as they
                happen on your profile.
              </p>
              <p>
                <strong>Custom Reactions:</strong> The "Event Reactions" panel
                lets you define rules: "IF LYX Received THEN Trigger Orange
                Pulse on Layer 1". You choose the event, the target layer, and
                the visual effect.
              </p>
              <p>
                <strong>Persistent & Global (ERC725Y):</strong> Your entire
                ruleset is saved to the global{" "}
                <code>RADAR.EventReactions</code> key on your UP. Set it up
                once, and your profile will visually react according to your
                rules, no matter which visual preset is loaded.
              </p>
            </div>
            <p>
              Leveraging the core architecture of LUKSO UPs to create a reactive, personalized
              experience directly linked to your on-chain interactions.
            </p>
          </div>
        );
      case "tokens":
        return (
          <div className="tab-pane">
            <h3>NFTs Reimagined: LSP8 Assets as Visual Fuel</h3>
            <p>
              RADAR is built around LUKSO's next-generation NFT standard,{" "}
              <strong>LSP8 Identifiable Digital Asset</strong>. These aren't
              just static collectibles; they are the dynamic source material for
              the visualizer.
            </p>
            <div className="info-card">
              <h4>Why LSP8 Matters:</h4>
              <p>
                <strong>Rich Metadata (LSP4):</strong> RADAR utilizes the
                associated{" "}
                <strong>LSP4 Digital Asset Metadata</strong> standard to
                reliably fetch crucial information like token names and image
                locations (including IPFS resolution). This structured data
                avoids the inconsistencies plagueing older NFT standards.
              </p>
              <p>
                <strong>Designed for Interaction:</strong> While RADAR
                primarily uses the visual aspect, LSP8 allows for richer data
                and potential future interactions beyond what simple
                ERC721/1155 offer.
              </p>
            </div>
            <div className="info-card">
              <h4>Loading Assets:</h4>
              <p>
                <strong>Transparency is Power:</strong> Assets created with
                transparent backgrounds (like the RADAR Genesis collection)
                unlock the full potential of the layering system, allowing
                intricate visual blending.
              </p>
              <p>
                <strong>Demo & Owned:</strong> Experiment instantly with
                built-in Demo Tokens, or connect your UP via the extension to
                access LSP8 NFTs you own from RADAR-whitelisted collections.
              </p>
              <p>
                <strong>Simple Application:</strong> Use the Token Selector
                panel, choose your target layer (Top/Middle/Bottom), and click
                an asset to load it instantly.
              </p>
            </div>
            <p>
              By embracing LSP8 and LSP4, RADAR moves beyond basic NFT display
              towards true digital asset *utility* and *composability*.
            </p>
          </div>
        );
      case "configurations":
        return (
          <div className="tab-pane">
            <h3>
              On-Chain Configurations: Your State, Your Profile (ERC725Y)
            </h3>
            <p>
              Forget saving files locally or relying on centralized backends.
              RADAR leverages the <strong>ERC725Y</strong> standard to store all
              your personalized configurations directly and decentrally onto your
              Universal Profile's storage. This is a cornerstone of the LUKSO
              vision.
            </p>
            <div className="info-card">
              <h4>How RADAR Uses Your UP Storage:</h4>
              <p>
                <strong>
                  Visual Presets (Map:{" "}
                  <code>{`RADAR.NamedConfiguration:<nameHash>`}</code>):
                </strong>{" "}
                Every unique visual setup you create (layers, loaded tokens,
                all parameters) can be saved as a named preset. RADAR uses an
                ERC725Y Map, hashing the preset name to generate a unique
                storage key. This allows you to store a virtually unlimited
                number of distinct visual configurations directly on your
                profile.
              </p>
              <p>
                <strong>
                  Preset Index (Array:{" "}
                  <code>RADAR.SavedConfigurationList[]</code>):
                </strong>{" "}
                To keep track of your named presets, RADAR maintains an ERC725Y
                Array storing the names of all your saved configurations. This
                populates the Preset Selector Bar.
              </p>
              <p>
                <strong>
                  Default Preset (Singleton:{" "}
                  <code>RADAR.DefaultConfigurationName</code>):
                </strong>{" "}
                Designate your favorite preset! RADAR stores the *name* of your
                chosen default preset in this Singleton key. This is the
                configuration automatically loaded when anyone views RADAR on
                your profile.
              </p>
              <p>
                <strong>
                  Global MIDI Map (Singleton:{" "}
                  <code>RADAR.MIDI.ParameterMap</code>):
                </strong>{" "}
                Your entire MIDI controller mapping schema is saved to this
                single key. Consistent control across all presets.
              </p>
              <p>
                <strong>
                  Global Reactions (Singleton:{" "}
                  <code>RADAR.EventReactions</code>):
                </strong>{" "}
                All your custom LSP1 event-to-visual effect rules are stored
                together in this key. Persistent blockchain reactivity.
              </p>
            </div>
            <div className="info-card">
              <h4>Management:</h4>
              <p>Use the "Save" panel (write icon) to:</p>
              <p>Save new named Visual Presets.</p>
              <p>
                Optionally update the Global MIDI and Reaction keys when
                saving a preset.
              </p>
              <p>Explicitly save only the Global MIDI or Reaction keys.</p>
              <p>
                Load any saved preset by name or load your designated Default.
              </p>
              <p>
                Delete unwanted presets (which removes them from the Map and
                the Array).
              </p>
            </div>
            <p>
              This powerful combination of ERC725Y data types enables a truly
              decentralized, persistent, and user-owned application state,
              showcasing the advanced capabilities of Universal Profiles.
            </p>
          </div>
        );
      case "collections":
        return (
          <div className="tab-pane">
            <h3>
              Whitelisted Collections: Curated Compatibility (ERC725Y & LSP4)
            </h3>
            <p>
              To ensure assets load correctly and interact well with the visual
              engine, RADAR utilizes an on-chain whitelist managed by the
              project's admin profile.
            </p>
            <div className="info-card">
              <h4>The Whitelist System:</h4>
              <p>
                <strong>On-Chain List (ERC725Y):</strong> A list of approved
                LSP8 collection contract addresses is stored under the{" "}
                <code>RADAR.WhitelistedCollections</code> key on the admin UP.
              </p>
              <p>
                <strong>Loading Owned Assets:</strong> When you connect your
                UP, RADAR checks which LSP8 assets you hold (via LSP5 Received
                Assets) and cross-references them against this on-chain
                whitelist. Only assets from approved collections appear in the
                "My Owned Tokens" tab.
              </p>
              <p>
                <strong>Metadata (LSP4):</strong> For displaying collection
                information (and potentially in the future, token details),
                RADAR relies on the collection contracts supporting the LSP4
                metadata standard.
              </p>
            </div>
            <div className="info-card">
              <h4>RADAR Genesis:</h4>
              <p>
                The primary whitelisted collection is <strong>RADAR Genesis</strong>,
                featuring 8,000 unique LSP8 NFTs specifically designed by the
                creator of RADAR with transparency and visual complexity ideal
                for this layering system.
              </p>
            </div>
            <p>
              This system balances openness with quality control, ensuring a
              smooth user experience while leveraging on-chain data for
              configuration.
            </p>
          </div>
        );
      case "artists":
        return (
          <div className="tab-pane">
            <h3>Artist & Creation: The Vision Behind RADAR (LSP4)</h3>
            <p>
              RADAR wasn't built in a vacuum; it's the culmination of an
              artistic vision combined with deep exploration of LUKSO's
              technical capabilities. It's a tool built *by* an artist, *for*
              enhancing digital art.
            </p>
            <div className="info-card">
              <h4>The RADAR Genesis Collection:</h4>
              <p>
                At the heart of the demo and the initial offering is the{" "}
                <strong>RADAR Genesis</strong> collection. This isn't random
                art; it's 8,000 unique LSP8 NFTs derived from over 350
                meticulously hand-drawn characters, algorithmically processed
                into fractal forms. Crucially, they were designed from the
                ground up with <strong>transparent backgrounds</strong> and
                intricate detail specifically for RADAR's dynamic layering and
                manipulation engine.
              </p>
            </div>
            <div className="info-card">
              <h4>Empowering Owners & Redefining Utility:</h4>
              <p>
                <strong>From Static to Dynamic:</strong> RADAR empowers owners
                to transform the base artwork. Your NFT is the seed for
                countless unique visual experiences you create and control.
              </p>
              <p>
                <strong>Immutable Artist Link (LSP4):</strong> Thanks to LSP4
                metadata, the connection between the NFT, its collection, and
                the original creator's Universal Profile is permanently
                recorded on-chain. Provenance is inherent.
              </p>
              <p>
                <strong>A Solo Endeavor:</strong> This entire project – the
                concept, the 8k artwork collection, the complex
                React/Canvas/Blockchain application, the UI/UX design –
                represents thousands of hours of work by a single creator
                dedicated to realizing this vision on LUKSO.
              </p>
            </div>
            <p>
              The goal is to demonstrate that NFTs can be more than static
              collectibles – they can be living, breathing components of a
              larger creative ecosystem.
            </p>
          </div>
        );
      case "ipRights":
        return (
          <div className="tab-pane">
            <h3>IP is Old News: Embrace the New Protocol</h3>
            <p>
              As an artist, I’ve wrestled with the concept of intellectual
              property countless times. My conclusion? True artistic value isn't
              found in locking your work away; it's unleashed when you set it
              free.
            </p>

            <div className="info-card">
              <h4>Signature as the New IP</h4>
              <p>
                In this new era of digital creativity, your signature is the
                indelible mark of your authorship. This signature is
                intrinsically baked into the very fabric of your work,
                especially on platforms like LUKSO with standards like LSP4. Your
                originality becomes traceable, immutable, and profoundly
                composable. This isn't just desirable for a creator, it's
                fundamental.
              </p>
            </div>

            <div className="info-card">
              <h4>From Control to Ignition</h4>
              <p>
                Create art. Sell it. Let it evolve as it passes through hands.
                Encourage others to mutate it, remix it, and propel it to
                horizons you never imagined. This isn't theft, it's the
                cultivation of a living legacy.
              </p>
              <p>
                My vision towards this has shifted immensly through paying
                carefull attention what LUKSO is stating. I no longer seek
                control, I aim for ignition. I want my art to be the spark for
                someone else’s artistic journey. And through LUKSO's Universal
                Profiles and LSP4 metadata, your name, your provenance, remains
                eternally linked.
              </p>
            </div>

            <div className="info-card">
              <h4>Transparency for the AI Era</h4>
              <p>
                Imagine an AI trained on a dataset where every single piece
                includes embedded, verifiable metadata about the original
                artist, its title, its context. No more guesswork, no more
                unethical scraping, no more protracted lawsuits. Just pure,
                unadulterated transparency.
              </p>
              <p>
                This approach, built on foundational standards native to LUKSO,
                solves the attribution problem from the outset.
              </p>
            </div>

            <div className="info-card">
              <h4>Beyond Outdated Legal Frameworks</h4>
              <p>
                Attempting to combat the dynamic nature of AI and Web3 remix
                culture with archaic IP laws is like bringing a quill to a data
                stream. Traditional IP rights often serve middlemen who monetize
                your creativity, packaging you as a product while claiming to
                protect you.
              </p>
            </div>

            <p style={{ marginTop: "var(--space-lg)", fontWeight: "bold" }}>
              Don’t become a product. Become the protocol. Embrace the future
              where your art lives, breathes, and inspires, all while your
              authorship is clearly and immutably recognized on LUKSO.
            </p>
          </div>
        );
      case "roadmap":
        return (
          <div className="tab-pane">
            <h3>Roadmap: The Journey Ahead</h3>
            <p>
              RADAR is launched, but the vision extends further. This is a
              living project fueled by the potential of LUKSO and my personal to
              push self expression and creative boundaries.
            </p>
            <div className="info-card">
              <h4>Potential Future Directions:</h4>
              <p>
                <strong>Visual Effect Expansion:</strong> Adding more diverse
                and controllable visual effects triggered by LSP1 events or
                MIDI signals.
              </p>
              <p>
                <strong>Advanced MIDI Capabilities:</strong> Investigating
                features like MIDI clock synchronization for tempo-based
                effects, or more sophisticated mapping options (e.g., value
                ranges, toggles).
              </p>
              <p>
                <strong>Preset Sharing & Discovery:</strong> Building tools or
                standards to allow users to easily share their on-chain RADAR
                presets, fostering a community library of visual setups.
              </p>
              <p>
                <strong>Collection Onboarding:</strong> Streamlining the
                process for suggesting and potentially whitelisting new,
                compatible LSP8 collections from the community.
              </p>
              <p>
                <strong>Performance & Optimization:</strong> Continuously
                refining the rendering engine (CanvasManager) for maximum
                efficiency across devices.
              </p>
              <p>
                <strong>Open Source Strategy:</strong> Evaluating which parts
                of RADAR could be open-sourced to serve as examples and
                building blocks for other LUKSO developers.
              </p>
            </div>
            <p>
              The path forward will be shaped by user feedback and the evolving
              capabilities of the LUKSO network. Join the conversation and help
              define the future of dynamic digital art!
            </p>
          </div>
        );
      default:
        return (
          <div className="tab-pane">
            <p>Select a tab to view information.</p>
          </div>
        );
    }
  };

  // Main component render
  return (
    <div className={`overlay ${transitionState}`} onClick={handleBackgroundClick}>
      {/* Main Content Container */}
      <div className="overlay-content">
        <div className="overlay-header">
          <h2 className="overlay-title">
            {/* Use the imported SVG  */}
            <img src={radarWordmarkBlue} alt="RADAR Logo" className="radar-logo-image"/>
          </h2>
          <button className="close-button" onClick={handleClose}>✕</button>
        </div>
        <div className="overlay-body">
          {/* Tab Buttons - USE UNIQUE CLASS NAMES */}
          <div className="info-overlay-tab-navigation">
            <button className={`info-overlay-tab-button ${activeTab === "philosophy" ? "active" : ""}`} onClick={() => setActiveTab("philosophy")}>Philosophy</button>
            <button className={`info-overlay-tab-button ${activeTab === "general" ? "active" : ""}`} onClick={() => setActiveTab("general")}>About</button>
            <button className={`info-overlay-tab-button ${activeTab === "layers" ? "active" : ""}`} onClick={() => setActiveTab("layers")}>Controls</button>
            <button className={`info-overlay-tab-button ${activeTab === "audioReactivity" ? "active" : ""}`} onClick={() => setActiveTab("audioReactivity")}>Audio Reactivity</button>
            <button className={`info-overlay-tab-button ${activeTab === "events" ? "active" : ""}`} onClick={() => setActiveTab("events")}>Universal Receiver</button>
            <button className={`info-overlay-tab-button ${activeTab === "tokens" ? "active" : ""}`} onClick={() => setActiveTab("tokens")}>Tokens</button>
            <button className={`info-overlay-tab-button ${activeTab === "configurations" ? "active" : ""}`} onClick={() => setActiveTab("configurations")}>Configurations</button>
            <button className={`info-overlay-tab-button ${activeTab === "collections" ? "active" : ""}`} onClick={() => setActiveTab("collections")}>Collections</button>
            <button className={`info-overlay-tab-button ${activeTab === "artists" ? "active" : ""}`} onClick={() => setActiveTab("artists")}>Artists</button>
            <button className={`info-overlay-tab-button ${activeTab === "ipRights" ? "active" : ""}`} onClick={() => setActiveTab("ipRights")}>IP Rights</button>
            <button className={`info-overlay-tab-button ${activeTab === "roadmap" ? "active" : ""}`} onClick={() => setActiveTab("roadmap")}>Roadmap</button>
          </div>

          {/* Rendered Tab Content */}
          <div className="tab-content">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

InfoOverlay.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default InfoOverlay;