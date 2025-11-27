// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { UpProvider } from "./context/UpProvider.jsx";
import { UserSessionProvider } from "./context/UserSessionContext.jsx";
import { WorkspaceProvider } from "./context/WorkspaceContext.jsx";
import { SceneProvider } from "./context/SceneContext.jsx"; // --- NEW ---
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
}

const AppTree = (
  <ErrorBoundary>
    <UpProvider>
      <UserSessionProvider>
        <ToastProvider>
          <NotificationProvider>
            {/* SceneProvider MUST be inside WorkspaceProvider if it uses data from it (though in my design they are siblings or Scene is inside Workspace to allow Workspace to set Scene data) */}
            {/* Design Decision: WorkspaceProvider fetches data and populates SceneContext via setters.
                So SceneProvider needs to be available to WorkspaceProvider. 
                Wait, if WorkspaceProvider calls `useSceneContext`, SceneProvider must be the PARENT or WorkspaceProvider must be a CHILD.
                
                Let's nest: SceneProvider -> WorkspaceProvider.
                WorkspaceProvider logic: "I fetched data, now I call setStagedActiveWorkspace (from SceneContext)".
                So SceneContext must be higher up. 
            */}
            
            <SceneProvider>
                <WorkspaceProvider>
                  <AssetProvider>
                    <MIDIProvider>
                      <VisualEngineProvider>
                        <App />
                      </VisualEngineProvider>
                    </MIDIProvider>
                  </AssetProvider>
                </WorkspaceProvider>
            </SceneProvider>
            
          </NotificationProvider>
        </ToastProvider>
      </UserSessionProvider>
    </UpProvider>
  </ErrorBoundary>
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {AppTree}
  </React.StrictMode>
);