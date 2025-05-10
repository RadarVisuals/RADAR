import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { UpProvider } from "./context/UpProvider.jsx";
import { UserSessionProvider } from "./context/UserSessionContext.jsx";
import { ConfigProvider } from "./context/ConfigContext.jsx";
import { VisualConfigProvider } from "./context/VisualConfigContext.jsx"; // Import new provider
import { MIDIProvider } from "./context/MIDIContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./index.css";
import { initializeHostUPConnector } from "./context/UpServerProvider.js";

/**
 * Checks if the application is running inside an iframe.
 * This is crucial for determining whether to initialize the host UP connector
 * or operate as a client Mini-App.
 * @returns {boolean} True if running inside an iframe, false otherwise.
 */
const isRunningInIframe = () => {
  try {
    // If window.self is different from window.top, it's in an iframe.
    return window.self !== window.top;
  } catch (_e) {
    // Catch potential cross-origin errors when accessing window.top.
    // If accessing top fails, it's highly likely due to cross-origin restrictions,
    // strongly indicating an iframe environment.
    return true;
  }
};

const inIframe = isRunningInIframe();

// Initialize the host connector only if running as the main window (not in an iframe)
if (!inIframe) {
  console.log("[main.jsx] Running as host/top window, initializing Host UP Connector.");
  initializeHostUPConnector();
} else {
  console.log("[main.jsx] Running inside an iframe, skipping Host UP Connector initialization.");
}

// The provider tree structure:
// 1. ErrorBoundary: Catches errors in the application.
// 2. UpProvider: Manages connection to the Universal Profile extension. Essential for UserSessionProvider.
// 3. UserSessionProvider: Consumes UpProvider to establish user/host session context (visitor vs. host profile).
// 4. ConfigProvider: Consumes UserSessionProvider (for hostProfileAddress) to manage general app configuration,
//    preset loading/saving, and global interaction settings for the host profile.
// 5. VisualConfigProvider: Consumes ConfigProvider (for loaded preset data) to manage the live visual state
//    (layerConfigs, tokenAssignments) of the host profile.
// 6. MIDIProvider: Consumes ConfigProvider (potentially for saving MIDI maps associated with the host profile).
// 7. ToastProvider: Provides global toast notification functionality.
// 8. App: The main application component.
const AppTree = (
  <ErrorBoundary>
    <UpProvider>
      <UserSessionProvider>
        <ConfigProvider>
          <VisualConfigProvider> {/* VisualConfigProvider is wrapped by ConfigProvider */}
            <MIDIProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </MIDIProvider>
          </VisualConfigProvider>
        </ConfigProvider>
      </UserSessionProvider>
    </UpProvider>
  </ErrorBoundary>
);

ReactDOM.createRoot(document.getElementById("root")).render(AppTree);

console.log("[main.jsx] React application rendered successfully.");