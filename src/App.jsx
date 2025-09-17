// src/App.jsx
import React, { useEffect, useState, useCallback } from "react";
import MainView from "./components/Main/Mainview";
import StartVeil from "./components/UI/StartVeil";
import { useSetManagement } from "./context/SetManagementContext"; // Import the hook

function App() {
  const [hasUserInitiated, setHasUserInitiated] = useState(false);
  
  // Get the context function to manually trigger the load
  const { startLoadingProcess } = useSetManagement();

  useEffect(() => {
    const staticLoader = document.querySelector('.static-loader');
    if (staticLoader) {
      staticLoader.remove();
    }
  }, []);

  const handleStart = useCallback(() => {
    setHasUserInitiated(true);
    // When the user clicks "Enter", we explicitly tell the SetManagementProvider to begin loading.
    if (startLoadingProcess) {
      startLoadingProcess();
    }
  }, [startLoadingProcess]);

  return (
    <div className="app">
      {!hasUserInitiated ? (
        <StartVeil onStart={handleStart} />
      ) : (
        <MainView />
      )}
    </div>
  );
}

export default App;