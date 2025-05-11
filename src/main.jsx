import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { UpProvider } from "./context/UpProvider.jsx";
import { UserSessionProvider } from "./context/UserSessionContext.jsx";
import { ConfigProvider } from "./context/ConfigContext.jsx";
import { PresetManagementProvider } from "./context/PresetManagementContext.jsx"; // Import PresetManagementProvider
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

// Updated Provider Tree Structure:
// 1. ErrorBoundary
// 2. UpProvider
// 3. UserSessionProvider
// 4. ConfigProvider (Provides ConfigService, global settings, hasPendingChanges)
// 5. PresetManagementProvider (Uses ConfigService. Manages preset state. Consumes ConfigContext)
// 6. VisualConfigProvider (Uses PresetManagementContext for loaded data, ConfigContext for pending changes. Consumes PresetManagementContext & ConfigContext)
// 7. MIDIProvider (Uses ConfigContext for saving global MIDI map)
// 8. ToastProvider
// 9. App
const AppTree = (
  <ErrorBoundary>
    <UpProvider>
      <UserSessionProvider>
        <ConfigProvider>
          <PresetManagementProvider>
            <VisualConfigProvider>
              <MIDIProvider>
                <ToastProvider>
                  <App />
                </ToastProvider>
              </MIDIProvider>
            </VisualConfigProvider>
          </PresetManagementProvider>
        </ConfigProvider>
      </UserSessionProvider>
    </UpProvider>
  </ErrorBoundary>
);

ReactDOM.createRoot(document.getElementById("root")).render(AppTree);

console.log("[main.jsx] React application rendered successfully.");