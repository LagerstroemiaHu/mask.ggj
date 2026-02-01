
import React, { useState, useEffect } from 'react';
import { HomeScreen } from './components/screens/HomeScreen';
import { TransitionScreen } from './components/screens/TransitionScreen';
import { LevelSelectScreen } from './components/screens/LevelSelectScreen';
import { Level1Conformity } from './components/levels/Level1Conformity';
import { Level2Factory } from './components/levels/Level2Factory';
import { Level3Capital } from './components/levels/Level3Capital';
import { Level4Consumerism } from './components/levels/Level4Consumerism';
import { Level5Epiphany } from './components/levels/Level5Epiphany';
import { AppState } from './types';
import { AudioProvider } from './contexts/AudioContext';

// New key to force reset state for players from previous versions
const AWAKENED_STORAGE_KEY = 'masks_awakened_true';

function AppContent() {
  const [appState, setAppState] = useState<AppState>(AppState.HOME);
  const [currentLevelId, setCurrentLevelId] = useState<number>(1);
  const [isAwakened, setIsAwakened] = useState<boolean>(false);

  // Load awakened state on mount
  useEffect(() => {
      const savedState = localStorage.getItem(AWAKENED_STORAGE_KEY);
      if (savedState === 'true') {
          setIsAwakened(true);
      }
  }, []);

  // Flow: Home -> Transition -> Level 1 -> Transition -> Level 2 ...

  const handleStartGame = () => {
    setAppState(AppState.TRANSITION);
  };
  
  const handleGMMode = () => {
    setAppState(AppState.LEVEL_SELECT);
  };

  const handleLevelSelect = (levelId: number) => {
    setCurrentLevelId(levelId);
    setAppState(AppState.TRANSITION);
  };

  const handleTransitionComplete = () => {
    setAppState(AppState.GAMEPLAY);
  };

  const handleLevelComplete = (isSuccess: boolean = true) => {
    // Progress to next level
    const nextLevel = currentLevelId + 1;
    
    // Level 5 Logic: Only "Success" (Liberation) triggers Awakening
    if (currentLevelId === 5) {
        if (isSuccess) {
            setIsAwakened(true);
            localStorage.setItem(AWAKENED_STORAGE_KEY, 'true');
        }
        // If failed (Black ending), we loop back but DO NOT awaken.
        
        setCurrentLevelId(1);
        setAppState(AppState.HOME);
        return;
    }

    if (nextLevel > 5) {
        // Fallback catch-all, though usually caught by block above
        setCurrentLevelId(1);
        setAppState(AppState.HOME);
    } else {
        setCurrentLevelId(nextLevel);
        // Trigger transition again between levels
        setAppState(AppState.TRANSITION);
    }
  };

  return (
    <div className="w-full h-screen bg-black text-white overflow-hidden">
      {appState === AppState.HOME && (
        <HomeScreen 
            onStart={handleStartGame} 
            onGMMode={handleGMMode} 
            isAwakened={isAwakened}
        />
      )}

      {appState === AppState.LEVEL_SELECT && (
        <LevelSelectScreen onSelectLevel={handleLevelSelect} />
      )}

      {appState === AppState.TRANSITION && (
        <TransitionScreen onComplete={handleTransitionComplete} />
      )}

      {appState === AppState.GAMEPLAY && (
        <>
            {currentLevelId === 1 && (
                <Level1Conformity onComplete={() => handleLevelComplete(true)} />
            )}

            {currentLevelId === 2 && (
                <Level2Factory onComplete={() => handleLevelComplete(true)} />
            )}
            
            {currentLevelId === 3 && (
                <Level3Capital onComplete={() => handleLevelComplete(true)} />
            )}

            {currentLevelId === 4 && (
                <Level4Consumerism onComplete={() => handleLevelComplete(true)} />
            )}
            
            {currentLevelId === 5 && (
                <Level5Epiphany onComplete={(success) => handleLevelComplete(success)} />
            )}
        </>
      )}
    </div>
  );
}

function App() {
    return (
        <AudioProvider>
            <AppContent />
        </AudioProvider>
    );
}

export default App;
