// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { UpProvider } from "./context/UpProvider.jsx";
import { UserSessionProvider } from "./context/UserSessionContext.jsx";
import { PresetManagementProvider } from "./context/PresetManagementContext.jsx";
import { VisualConfigProvider } from "./context/VisualConfigContext.jsx";
import { MIDIProvider } from "./context/MIDIContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
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
        <VisualConfigProvider>
          <PresetManagementProvider>
            <MIDIProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </MIDIProvider>
          </PresetManagementProvider>
        </VisualConfigProvider>
      </UserSessionProvider>
    </UpProvider>
  </ErrorBoundary>
);

ReactDOM.createRoot(document.getElementById("root")).render(AppTree);

console.log("[main.jsx] React application rendered successfully.");