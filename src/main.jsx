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