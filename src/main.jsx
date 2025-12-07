import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { UpProvider } from "./context/UpProvider.jsx";
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

// Notice: We removed UserSessionProvider, WorkspaceProvider, SceneProvider.
// Their state is now managed globally by Zustand stores.
// AssetProvider, MIDIProvider, VisualEngineProvider remain as they hold local refs/logic
// that are still being refactored or are tied to the render tree.

const AppTree = (
  <ErrorBoundary>
    <UpProvider>
      <AssetProvider>
        <MIDIProvider>
          <VisualEngineProvider>
            <App />
          </VisualEngineProvider>
        </MIDIProvider>
      </AssetProvider>
    </UpProvider>
  </ErrorBoundary>
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {AppTree}
  </React.StrictMode>
);