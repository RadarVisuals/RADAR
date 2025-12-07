import React, { useEffect, useState, useCallback } from "react";
import MainView from "./components/Main/Mainview";
import StartVeil from "./components/UI/StartVeil";
import { useProjectLifecycle } from "./hooks/useProjectLifecycle"; // Use new hook

function App() {
  const [hasUserInitiated, setHasUserInitiated] = useState(false);
  
  // This hook handles the side effects of loading data when profiles connect.
  // It replaces the logic previously hidden inside WorkspaceContext.
  useProjectLifecycle();

  useEffect(() => {
    const staticLoader = document.querySelector('.static-loader');
    if (staticLoader) {
      staticLoader.remove();
    }
  }, []);

  const handleStart = useCallback(() => {
    setHasUserInitiated(true);
  }, []);

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