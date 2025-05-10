// src/App.jsx
import React, { useEffect } from "react";
import MainView from "./components/Main/Mainview";
import { useUserSession } from "./context/UserSessionContext"; // Import useUserSession

// Component to handle URL parameters for pure visitor mode
const URLParameterHandler = () => {
  const { togglePreviewMode } = useUserSession(); // Use togglePreviewMode from UserSessionContext

  useEffect(
    () => {
      const urlParams = new URLSearchParams(window.location.search);
      const isPureFromUrl = urlParams.get("pure") === "true";
      if (isPureFromUrl && typeof togglePreviewMode === "function") {
        // NOTE: The actual call to togglePreviewMode() is currently disabled below.
        // If re-enabled, add togglePreviewMode to the dependency array.
        // togglePreviewMode();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // If togglePreviewMode() is re-enabled, add it to deps: [togglePreviewMode]
  );

  return null;
};

function App() {
  return (
    <div className="app">
      <URLParameterHandler />
      <MainView />
    </div>
  );
}

export default App;