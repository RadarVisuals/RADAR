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