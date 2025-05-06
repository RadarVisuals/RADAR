// src/main.jsx (Original from Dump)
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { UpProvider } from "./context/UpProvider.jsx";
import { ConfigProvider } from "./context/ConfigContext.jsx";
import { MIDIProvider } from "./context/MIDIContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./index.css";
import { initializeHostUPConnector } from "./context/UpServerProvider.js";

// Simple check if running inside an iframe
const isRunningInIframe = () => {
  try {
    // Check if window is different from the top window
    return window.self !== window.top;
  } catch (e) {
    // If accessing top fails (cross-origin), assume it's in an iframe
    return true;
  }
};

const inIframe = isRunningInIframe();
let hostConnectorInitialized = false;

if (!inIframe) {
  console.log(
    "[main.jsx] Running as host/top window, initializing Host UP Connector.",
  );
  // Initialize only if it's the main window
  // Ensure this function doesn't cause issues if called multiple times accidentally
  // (though the check should prevent it)
  initializeHostUPConnector();
  hostConnectorInitialized = true; // Mark as initialized
} else {
  console.log(
    "[main.jsx] Running inside an iframe, skipping Host UP Connector initialization.",
  );
}

// Conditionally wrap with UpProvider only when in an iframe
const AppTree = (
    <ErrorBoundary>
        <ConfigProvider>
          <MIDIProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </MIDIProvider>
        </ConfigProvider>
    </ErrorBoundary>
);

ReactDOM.createRoot(document.getElementById("root")).render(
  // <React.StrictMode> // Keep commented out for now
    <>
      {inIframe ? (
        // If in iframe, wrap with UpProvider to act as client
        <UpProvider>{AppTree}</UpProvider>
      ) : (
        // If host, render AppTree directly (server logic handled outside React tree)
        AppTree
      )}
    </>
  // </React.StrictMode>
);


console.log("[main.jsx] React application rendered successfully.");