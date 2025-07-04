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
              <h4>Staging Presets</h4>
              <p>
                The Save Panel is your studio's control room. When you find a visual configuration you like, you can create a "Preset" by giving it a name. This doesn't save it on-chain immediately; instead, it's "staged." You can create, update, and delete multiple presets in this staging area. Your list of staged presets will appear in the Preset Selector Bar at the bottom of the screen for quick access.
              </p>
            </div>
            <div className="info-card">
              <h4>The Workspace: Your Public Gallery</h4>
              <p>
                RADAR treats your entire setup as a single "Workspace." This isn't just your presets; it includes your personal library of collections, your global MIDI mappings, and your custom event reactions. When you're ready, you hit "Save Workspace." This single action bundles everything into one file, uploads it to a decentralized network (IPFS), and updates a single pointer on your Universal Profile. Your profile doesn't get cluttered with data; it just holds the key to your entire creative studio, making it efficient, portable, and truly yours.
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
                Because your library is public, anyone who visits your Universal Profile in RADAR can see and use the assets from your curated collections. They can load your presets and "perform" with your setup using their own audio or MIDI controllers. This turns every profile into a potential gallery and a stage for collaborative, cross-profile visual experiences.
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
              <h4>The Next Level: Minting Presets</h4>
              <p>
                The most exciting step on the horizon is the ability to mint your creations. A "Preset" is essentially a layered recipe of assets and their parameters. We are eagerly awaiting the evolution of tools on LUKSO, like an official token generator, to explore how we can wire this up internally.
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