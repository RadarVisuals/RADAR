// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { UpProvider } from "./context/UpProvider.jsx";
import { UserSessionProvider } from "./context/UserSessionContext.jsx";
import { AppProvider } from "./context/AppContext.jsx";
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

// The App component will now manage its own state and the provider tree.
// This keeps main.jsx clean and focused on the initial render.
const AppTree = (
  <ErrorBoundary>
    <UpProvider>
      <UserSessionProvider>
        {/* Note: hasUserInitiated is now handled inside App/AppProvider */}
        <AppProvider>
          <MIDIProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </MIDIProvider>
        </AppProvider>
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