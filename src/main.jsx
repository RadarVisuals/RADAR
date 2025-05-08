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

/**
 * Checks if the application is running inside an iframe.
 * @returns {boolean} True if running inside an iframe, false otherwise.
 */
const isRunningInIframe = () => {
  try {
    // If window.self is different from window.top, it's in an iframe.
    return window.self !== window.top;
  // eslint-disable-next-line no-unused-vars
  } catch (_e) { // Catch potential cross-origin errors when accessing window.top
    // If accessing top fails, it's highly likely due to cross-origin restrictions, indicating an iframe.
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

// Determine the appropriate provider nesting based on the environment
const AppTree = (
  <ErrorBoundary>
    {inIframe ? (
      // In an iframe (MiniApp): Use UpProvider to connect as a client
      <UpProvider>
        <ConfigProvider>
          <MIDIProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </MIDIProvider>
        </ConfigProvider>
      </UpProvider>
    ) : (
      // As host/standalone: Don't need UpProvider, ConfigProvider is outermost
      <ConfigProvider>
        <MIDIProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </MIDIProvider>
      </ConfigProvider>
    )}
  </ErrorBoundary>
);

// Render the application
ReactDOM.createRoot(document.getElementById("root")).render(AppTree);

console.log("[main.jsx] React application rendered successfully.");