// src/App.jsx
import React, { useEffect } from "react";
import MainView from "./components/Main/MainView";
import { useConfig } from "./context/ConfigContext";

// Component to handle URL parameters for pure visitor mode
const URLParameterHandler = () => {
  const { togglePureVisitorMode } = useConfig();

  useEffect(
    () => {
      const urlParams = new URLSearchParams(window.location.search);
      const isPureFromUrl = urlParams.get("pure") === "true";
      // Check if togglePureVisitorMode exists before calling
      if (isPureFromUrl && typeof togglePureVisitorMode === "function") {
        // NOTE: The actual call to togglePureVisitorMode() is currently disabled below.
        // If re-enabled, add togglePureVisitorMode to the dependency array.
        // togglePureVisitorMode();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // Empty deps because togglePureVisitorMode() call is commented out
  );

  return null; // This component doesn't render anything visible
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