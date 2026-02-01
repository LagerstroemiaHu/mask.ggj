
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameLoop } from '../../hooks/useGameLoop';
import { ShapeType } from '../../types';
import { useKeyPress } from '../../hooks/useKeyPress';
import { ShapeRenderer } from '../ui/ShapeRenderer';
import { COLORS } from '../../constants';
import { useAudio } from '../../contexts/AudioContext';

interface Level2Props {
  onComplete: () => void;
}

interface FactoryItem {
  id: number;
  type: ShapeType;
  x: number; 
  y: number; 
  speedMultiplier: number;
  rotation: number;
  isLiberated: boolean;
  // Enhanced Orbit Physics
  orbitState?: { 
      radius: number; 
      angle: number; 
      speed: number; // Radians per second
      eccentricity: number; // 0 to 1, makes orbit oval
      wobbleOffset: number;
  }; 
  morphProgress: number; 
  opacity: number; 
  // Visual Smoothing
  colorProgress: number; // 0 (Grey) to 1 (Red)
}

// CONSTANTS
const DEATH_X = 900; // INCREASED: Gives ~6 seconds of drift time before death
const WARNING_X = 200; 
// Increased Deadzone to allow player to move visibly to the Left side of the screen
const CAMERA_DEADZONE = 400; 
const WIN_COUNT_THRESHOLD = 10; 

// GAME FLOW CONSTANTS
const SPEED_START = 150;
const SPEED_MIRROR_SHOW = 200;
const SPEED_MIRROR_PEAK = 400;
const SPEED_MIRROR_FADE = 700;
const SPEED_SOLO_RUN = 850; // Mirrors completely gone here
const SPEED_ENDING = 950;   // Game ends here (~6 seconds after SOLO_RUN)

// Color Helper
const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
};

const lerpColor = (color1: string, color2: string, factor: number) => {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    const r = Math.round(c1.r + (c2.r - c1.r) * factor);
    const g = Math.round(c1.g + (c2.g - c1.g) * factor);
    const b = Math.round(c1.b + (c2.b - c1.b) * factor);
    return `rgb(${r}, ${g}, ${b})`;
};

// Lerp Helper
const lerp = (start: number, end: number, t: number) => {
  return start * (1 - t) + end * t;
};

const ConveyorBeltLane: React.FC<{
    items: FactoryItem[];
    playerX: number;
    cameraWorldX: number; 
    backgroundOffset: number; 
    isMainLane: boolean;
    mirrorOpacity: number; 
    gameOver: boolean;
    inputActive: boolean; 
    revolutionActive: boolean; 
    spacePressed: boolean;
}> = ({ items, playerX, cameraWorldX, backgroundOffset, isMainLane, mirrorOpacity, gameOver, inputActive, revolutionActive, spacePressed }) => {
    
    // Lane Opacity: If Revolution Active, mirrors are REAL (Opacity 1), otherwise follow narrative fade
    // Exception: If we are in the very beginning (fade in), keep fade in.
    const effectiveOpacity = isMainLane ? 1 : mirrorOpacity;

    // Player Color
    const playerColor = revolutionActive ? COLORS.accent : '#10b981';

    const playerScreenX = playerX - cameraWorldX;

    return (
        <div 
            className="relative w-[2000%] h-64 flex items-center justify-center transition-opacity duration-300"
            style={{ 
                opacity: effectiveOpacity,
                left: '50%',
                transform: 'translateX(-50%)',
                // If revolution active, make mirrors sharper (remove potential blurs if we had them, 
                // but here we ensure they feel solid)
                filter: revolutionActive && !isMainLane ? 'contrast(1.2) brightness(1.2)' : 'none'
            }}
        >
             {/* Conveyor Belt Background Grid */}
             <div className="absolute w-full h-full flex flex-col items-center justify-center opacity-10 z-0 overflow-hidden">
                <div className={`w-full h-48 border-t border-b ${isMainLane ? 'border-zinc-500' : 'border-zinc-800'} relative bg-zinc-900/30`}>
                    <div 
                        className="absolute inset-0 flex"
                        style={{ 
                            width: '100%',
                            transform: `translate3d(${(backgroundOffset - cameraWorldX) % 200}px, 0, 0)` 
                        }}
                    >
                        {Array.from({ length: 400 }).map((_, i) => (
                            <div 
                                key={i} 
                                className="flex-shrink-0 w-[40px] h-full border-r border-zinc-700/30 transform -skew-x-12" 
                                style={{ transform: 'skewX(-12deg)' }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Items Layer */}
            <div className="absolute w-full h-64 flex items-center z-10 pointer-events-none">
                {items.map(item => {
                    const baseColor = isMainLane ? '#71717a' : '#27272a';
                    const targetAccent = COLORS.accent;
                    
                    // Smooth color transition based on colorProgress
                    const displayColor = lerpColor(baseColor, targetAccent, item.colorProgress);
                    
                    const relativeX = item.x - cameraWorldX;

                    return (
                        <div 
                            key={item.id}
                            className="absolute flex items-center justify-center transition-transform will-change-transform"
                            style={{ 
                                left: `calc(50% + ${relativeX}px)`, 
                                top: `calc(50% + ${item.y}px)`,
                                transform: `rotate(${item.rotation}deg) scale(${item.isLiberated ? 0.6 : 1})`,
                                zIndex: item.isLiberated ? 30 : 10,
                                opacity: item.opacity
                            }}
                        >
                            <ShapeRenderer 
                                type={item.type}
                                color={displayColor}
                                targetType={ShapeType.CIRCLE} 
                                targetColor={COLORS.accent} 
                                conformity={item.morphProgress} 
                                size={64}
                                className={item.isLiberated ? "drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" : ""}
                            />
                        </div>
                    );
                })}

                {/* Player */}
                <div 
                    className="absolute top-1/2 -translate-y-1/2 w-24 h-24 z-20 flex items-center justify-center will-change-transform"
                    style={{ 
                        left: `calc(50% + ${playerScreenX}px)`, 
                        top: '50%',
                        transform: 'translate(-50%, -50%)' 
                    }}
                >
                     <div className="relative w-20 h-20 flex items-center justify-center">
                         {/* Aura when Revolution Active */}
                         {revolutionActive && (
                             <motion.div 
                                className="absolute inset-0 rounded-full border-2 border-red-500 opacity-50"
                                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                                transition={{ repeat: Infinity, duration: 0.5 }}
                             />
                         )}

                         {/* Strong Feedback for Space Press */}
                         {spacePressed && (
                             <motion.div 
                                className="absolute inset-0 rounded-full bg-white opacity-20"
                                initial={{ scale: 1, opacity: 0.8 }}
                                animate={{ scale: 2.5, opacity: 0 }}
                                transition={{ repeat: Infinity, duration: 0.6 }}
                             />
                         )}

                         <ShapeRenderer 
                            type={ShapeType.CIRCLE}
                            color={playerColor}
                            targetType={ShapeType.CIRCLE}
                            targetColor={COLORS.accent}
                            conformity={0}
                            size={80}
                            className={isMainLane ? `drop-shadow-[0_0_15px_${playerColor}80]` : ''}
                         />
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Level2Factory: React.FC<Level2Props> = ({ onComplete }) => {
  // Audio
  const { playTrack, setTrackVolume, playSound, stopTrack } = useAudio();
  const tapSoundIndexRef = useRef(0);

  // --- Game State ---
  const [gameTime, setGameTime] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  
  // Physics State
  const [playerX, setPlayerX] = useState(0); 
  const [cameraWorldX, setCameraWorldX] = useState(0); 
  
  const [cameraZoom, setCameraZoom] = useState(1.0); 
  const [conveyorSpeed, setConveyorSpeed] = useState(100); 
  
  const [backgroundOffset, setBackgroundOffset] = useState(0);

  // Mechanics
  const [liberatedCount, setLiberatedCount] = useState(0);
  const velocityStackRef = useRef(0); 
  
  const itemsRef = useRef<FactoryItem[]>([]);
  const nextItemId = useRef(0);
  const lastItemTime = useRef(0);
  const lastDecayTime = useRef(0);

  // Input
  const spacePressed = useKeyPress(' '); 
  const leftArrowPressed = useKeyPress('ArrowLeft'); 
  
  const [visualTapTrigger, setVisualTapTrigger] = useState(0);

  // Init Audio
  useEffect(() => {
    // Start Factory BGM
    playTrack('bgm_level2_factory', { volume: 1, loop: true, fadeDuration: 1500 });
    // Start Revolution BGM silently
    playTrack('bgm_level2_revolution', { volume: 0, loop: true });

    return () => {
        stopTrack('bgm_level2_factory', { fadeDuration: 1000 });
        stopTrack('bgm_level2_revolution', { fadeDuration: 1000 });
    };
  }, [playTrack, stopTrack]);

  // Handle BGM Crossfade based on Left Arrow
  useEffect(() => {
    if (gameOver || gameWon) return;

    if (leftArrowPressed) {
        setTrackVolume('bgm_level2_factory', 0, 500);
        setTrackVolume('bgm_level2_revolution', 1, 500);
    } else {
        setTrackVolume('bgm_level2_factory', 1, 500);
        setTrackVolume('bgm_level2_revolution', 0, 500);
    }
  }, [leftArrowPressed, setTrackVolume, gameOver, gameWon]);

  // Tap Handler & SFX
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === ' ' && !e.repeat && !gameOver && !gameWon) {
            velocityStackRef.current += 30; // Stronger tap
            setVisualTapTrigger(prev => prev + 1);

            // Play SFX (Alternating)
            const sfxKey = tapSoundIndexRef.current === 0 ? 'sfx_level2_tap_1' : 'sfx_level2_tap_2';
            playSound(sfxKey, 0.6);
            tapSoundIndexRef.current = (tapSoundIndexRef.current + 1) % 2;
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameOver, gameWon, playSound]);

  // Completion (Fade out Audio)
  useEffect(() => {
      if (gameWon || gameOver) {
          setTrackVolume('bgm_level2_factory', 0, 2000);
          setTrackVolume('bgm_level2_revolution', 0, 2000);

          const timer = setTimeout(() => {
              onComplete();
          }, 4000); 
          return () => clearTimeout(timer);
      }
  }, [gameWon, gameOver, onComplete, setTrackVolume]);

  // --- Game Loop ---
  useGameLoop((deltaTime) => {
    if (gameOver || gameWon) return;

    const dtSeconds = deltaTime / 1000;
    const newTime = gameTime + deltaTime;
    setGameTime(newTime);

    // 1. Calculate Belt Speed
    let currentSpeed = SPEED_START + (newTime / 60); 
    if (currentSpeed > SPEED_ENDING) currentSpeed = SPEED_ENDING;
    setConveyorSpeed(currentSpeed);

    // ENDING CONDITION 1: Time Survival (Void Sequence)
    // If player survives past the solo run into the darkness (~5-6s), they win.
    if (currentSpeed >= SPEED_ENDING - 10 && !gameWon) {
        setGameWon(true);
    }

    // ENDING CONDITION 2: Revolution Victory (10 Followers)
    if (liberatedCount >= WIN_COUNT_THRESHOLD && leftArrowPressed && !gameWon) {
        setGameWon(true);
    }

    // Decay Logic (Lose followers if key released)
    if (!leftArrowPressed && liberatedCount > 0) {
        if (newTime - lastDecayTime.current > 1000) { 
             for (let i = itemsRef.current.length - 1; i >= 0; i--) {
                 if (itemsRef.current[i].isLiberated) {
                     itemsRef.current[i].isLiberated = false;
                     itemsRef.current[i].y += (Math.random() - 0.5) * 50; 
                     break; 
                 }
             }
             lastDecayTime.current = newTime;
        }
    } else {
        lastDecayTime.current = newTime;
    }

    // 2. Physics Calculation
    // Cap velocity stack so spacebar spam cannot beat revolution mode
    const MAX_TAP_RESISTANCE = 350; 
    const tapResistance = Math.min(MAX_TAP_RESISTANCE, Math.max(0, velocityStackRef.current));
    
    velocityStackRef.current = Math.max(0, velocityStackRef.current - (80 * dtSeconds)); 
    
    // Revolution Push - SIGNIFICANTLY INCREASED
    // Allows player to visibly move to the left side of the screen against the flow
    let revolutionPush = 0;
    if (leftArrowPressed) {
        // Dynamic Force: Always overcomes currentSpeed + Adds strong leftward force
        // currentSpeed (belt) is canceled out, leaving +500 net velocity to the LEFT.
        revolutionPush = currentSpeed + 500 + (liberatedCount * 50); 
    }
    
    // Net Velocity
    let netVelocity = currentSpeed - tapResistance - revolutionPush;
    
    // Update Strict Physics X
    let newX = playerX + netVelocity * dtSeconds;
    
    // LOSS CONDITION
    if (newX >= DEATH_X) {
        setGameOver(true);
    }

    // 3. Update Position
    setPlayerX(newX);

    // 4. Camera Follow
    // The player moves Left (negative X). The Camera tries to follow.
    // By increasing CAMERA_DEADZONE, we allow the player to drift further from center
    // before the camera starts panning. This creates the visual effect of being "on the left".
    let targetCamX = cameraWorldX;
    const dist = newX - cameraWorldX;
    if (dist > CAMERA_DEADZONE) targetCamX = newX - CAMERA_DEADZONE;
    else if (dist < -CAMERA_DEADZONE) targetCamX = newX + CAMERA_DEADZONE;
    
    // Camera smoothness
    const newCameraWorldX = lerp(cameraWorldX, targetCamX, 4 * dtSeconds);
    setCameraWorldX(newCameraWorldX);

    // 5. Background Scroll
    setBackgroundOffset(prev => prev + (currentSpeed * dtSeconds));

    // 6. Camera Zoom
    const progress = Math.max(0, (currentSpeed - SPEED_START) / (SPEED_ENDING - SPEED_START));
    const targetZoom = 1.0 - (progress * 0.95);
    setCameraZoom(prev => prev + (targetZoom - prev) * 0.5 * dtSeconds);

    // 7. Item Logic
    if (newTime - lastItemTime.current > 3000) {
        const shapes = [ShapeType.SQUARE, ShapeType.TRIANGLE, ShapeType.HEXAGON, ShapeType.DIAMOND, ShapeType.STAR, ShapeType.CIRCLE];
        const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
        
        const spawnX = cameraWorldX - (1500 / Math.max(0.1, cameraZoom));

        itemsRef.current.push({
            id: nextItemId.current++,
            type: randomShape,
            x: spawnX, 
            y: Math.random() * 60 - 30, 
            speedMultiplier: 1.0 + Math.random() * 0.3, 
            rotation: Math.random() * 360,
            isLiberated: false,
            morphProgress: 0,
            opacity: 0,
            colorProgress: 0
        });
        lastItemTime.current = newTime;
    }

    // Update Items
    let newLiberatedCount = 0;
    
    itemsRef.current = itemsRef.current.map(item => {
        let newMorph = item.morphProgress;
        let newOpacity = item.opacity;
        let newColorProgress = item.colorProgress;

        if (newOpacity < 1 && !item.isLiberated) {
            newOpacity = Math.min(1, newOpacity + dtSeconds * 2.0);
        }
        
        if (item.isLiberated) {
             newLiberatedCount++; 

             // Smooth Color Transition (3x faster than morph to feel responsive but smooth)
             if (newColorProgress < 1) newColorProgress = Math.min(1, newColorProgress + 3 * dtSeconds);

             if (newMorph < 1) newMorph = Math.min(1, newMorph + 2 * dtSeconds);
             
             // Initialize CHAOTIC Orbit State
             if (!item.orbitState) {
                 item.orbitState = {
                     radius: 60 + Math.random() * 80, // Varied depth
                     angle: Math.random() * Math.PI * 2,
                     // Random speed between -3 and 3 rads/sec
                     speed: (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random() * 2),
                     eccentricity: 0.5 + Math.random() * 0.5, // 1 is circle, 0.5 is oval
                     wobbleOffset: Math.random() * 10
                 };
             }
             
             // Update Orbit
             item.orbitState.angle += dtSeconds * item.orbitState.speed; 
             
             // Calculate chaotic position
             const cx = Math.cos(item.orbitState.angle) * item.orbitState.radius * item.orbitState.eccentricity;
             const cy = Math.sin(item.orbitState.angle) * item.orbitState.radius;

             return {
                 ...item,
                 x: playerX + cx, 
                 y: cy + Math.sin(newTime * 0.005 + item.orbitState.wobbleOffset) * 10,
                 rotation: item.rotation + (item.orbitState.speed * 50) * dtSeconds, // Spin matches orbit speed
                 morphProgress: newMorph,
                 opacity: 1,
                 colorProgress: newColorProgress
             };
        } else {
            // Revert color if lost
            if (newColorProgress > 0) newColorProgress = Math.max(0, newColorProgress - 3 * dtSeconds);

            // Normal Movement
            const itemVelocity = currentSpeed * item.speedMultiplier;
            const updatedX = item.x + itemVelocity * dtSeconds; 
            
            let isNowLiberated = false;
            if (leftArrowPressed) {
                const dx = Math.abs(updatedX - playerX);
                const dy = Math.abs(item.y);
                if (dx < 100 && dy < 50) {
                    isNowLiberated = true;
                }
            }

            return { 
                ...item, 
                x: updatedX, 
                isLiberated: isNowLiberated,
                orbitState: isNowLiberated ? undefined : item.orbitState, 
                morphProgress: newMorph, 
                opacity: newOpacity,
                colorProgress: newColorProgress
            };
        }
    }).filter(item => {
        if (item.x > cameraWorldX + (3000/cameraZoom)) return false;
        return true;
    });

    if (newLiberatedCount !== liberatedCount) {
        setLiberatedCount(newLiberatedCount);
    }

  }, !gameOver && !gameWon);

  // --- Dynamic Mirror Rows ---
  const mirrorRows = useMemo(() => {
      const rows = [];
      // REDUCED LOOP: Only create center (0) plus 1 and 2. 
      // This results in offsets: 0, 1, -1, 2, -2. Total 5 rows.
      for (let i = 0; i < 3; i++) {
        rows.push(i);
        if(i!==0) rows.push(-i);
      }
      return rows.sort((a,b)=>a-b);
  }, []);

  const showWarning = playerX > WARNING_X; 

  // Mirror Opacity Logic
  let globalMirrorOpacity = 0;
  if (conveyorSpeed < SPEED_MIRROR_SHOW) {
      globalMirrorOpacity = 0;
  } else if (conveyorSpeed < SPEED_MIRROR_PEAK) {
      globalMirrorOpacity = (conveyorSpeed - SPEED_MIRROR_SHOW) / (SPEED_MIRROR_PEAK - SPEED_MIRROR_SHOW);
  } else if (conveyorSpeed < SPEED_MIRROR_FADE) {
      globalMirrorOpacity = 1;
  } else if (conveyorSpeed < SPEED_SOLO_RUN) {
      globalMirrorOpacity = 1 - ((conveyorSpeed - SPEED_MIRROR_FADE) / (SPEED_SOLO_RUN - SPEED_MIRROR_FADE));
  } else {
      globalMirrorOpacity = 0;
  }
  globalMirrorOpacity = Math.max(0, Math.min(1, globalMirrorOpacity));

  // Determine if we should show mirrors clearly (Revolution Mode)
  // If Revolution is active, we force transparency to 1 (Real), UNLESS we are in the very early "Fade In" stage.
  // We want the player to "reveal" the structure.
  const isRevolutionMode = leftArrowPressed;
  
  return (
    <div 
        className="relative w-full h-full bg-[#0a0a0a] flex flex-col items-center justify-center overflow-hidden select-none cursor-crosshair z-0"
    >
        {/* Background Gradient */}
        <div 
            className="absolute inset-0 bg-gradient-to-r from-red-950 via-zinc-950 to-green-950 opacity-60 pointer-events-none" 
            style={{ zIndex: 0 }}
        />

        {/* Dynamic Zoom Container */}
        <motion.div 
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            style={{ 
                scale: cameraZoom,
                zIndex: 10
            }}
        >
            {/* Render Mirrors */}
            {mirrorRows.map((offset) => {
                // Logic: If Revolution, show all mirrors clearly (ignore global fade out).
                // But still respect the initial fade-in so they don't pop.
                const revolutionOpacity = Math.min(1, (conveyorSpeed - SPEED_START) / 100); // Simple fade in at start

                const finalOpacity = isRevolutionMode 
                    ? revolutionOpacity 
                    : globalMirrorOpacity;

                if (offset !== 0 && finalOpacity < 0.01) return null;

                const isMain = offset === 0;
                // If Revolution, NO DISTANCE FADE. They are real.
                const distFade = isRevolutionMode ? 1 : Math.max(0, 1 - Math.abs(offset) * 0.1); 

                return (
                    <div 
                        key={offset} 
                        className="w-full flex justify-center"
                        style={{ 
                            transform: `scale(${1 - Math.abs(offset) * 0.05})`,
                            marginTop: '-1px', 
                            marginBottom: '-1px'
                        }}
                    >
                        <ConveyorBeltLane 
                            items={itemsRef.current}
                            playerX={playerX}
                            cameraWorldX={cameraWorldX}
                            backgroundOffset={backgroundOffset} 
                            isMainLane={isMain}
                            mirrorOpacity={finalOpacity * distFade}
                            gameOver={gameOver}
                            inputActive={visualTapTrigger > 0 || spacePressed} 
                            revolutionActive={leftArrowPressed}
                            spacePressed={spacePressed && isMain}
                        />
                    </div>
                );
            })}
        </motion.div>

        {/* UI / UX Guide */}
        <motion.div 
            className="fixed bottom-10 w-full flex flex-col items-center justify-center pointer-events-auto"
            style={{ zIndex: 20 }} 
        >
         {!gameOver && !gameWon && (
            <div className="relative flex items-center justify-center">
                
                {/* Warning Pulse */}
                <AnimatePresence>
                    {showWarning && (
                        <motion.div 
                            className="absolute w-96 h-32 rounded-3xl border-4 border-red-500/80"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                            exit={{ opacity: 0 }}
                            transition={{ repeat: Infinity, duration: 0.5 }}
                        />
                    )}
                </AnimatePresence>

                {/* Tap Feedback Ring */}
                <div className="absolute inset-0 flex items-center justify-center -z-10">
                    <AnimatePresence>
                        {visualTapTrigger > 0 && (
                            <motion.div 
                                key={visualTapTrigger}
                                className="absolute w-80 h-24 rounded-2xl border-2 border-white/30"
                                initial={{ scale: 1, opacity: 0.5 }}
                                animate={{ scale: 1.3, opacity: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3 }}
                            />
                        )}
                    </AnimatePresence>
                </div>

                {/* The Spacebar UI */}
                <motion.div 
                    className={`
                        relative w-72 h-14 rounded-lg 
                        bg-zinc-900 border-2 
                        shadow-[0_10px_0_rgb(24,24,27)] 
                        flex items-center justify-center
                        overflow-hidden
                        transition-colors duration-100
                    `}
                    style={{ borderColor: showWarning ? '#ef4444' : 'rgb(82, 82, 91)' }}
                    animate={spacePressed ? { 
                        y: 8, 
                        boxShadow: "0px 2px 0px rgb(24,24,27)", 
                        scale: 0.98 
                    } : { 
                        y: 0, 
                        boxShadow: "0px 10px 0px rgb(24,24,27)",
                        scale: 1,
                        x: showWarning ? [0, -1, 1, -1, 1, 0] : 0 
                    }}
                    transition={{ duration: 0.05 }}
                >
                    <div className="absolute inset-x-0 top-0 h-[2px] bg-white/20" />
                    <div className="w-12 h-1 rounded-full bg-zinc-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" />
                    <motion.div 
                        className="absolute inset-0 bg-white/30"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: spacePressed ? 1 : 0 }}
                        transition={{ duration: 0.05 }}
                    />
                </motion.div>
            </div>
         )}
        </motion.div>

        {/* Silent Fade Overlays - Update: White for win, Black for loss */}
        <AnimatePresence>
        {gameOver && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 2 }}
                className="absolute inset-0 bg-black flex items-center justify-center pointer-events-none"
                style={{ zIndex: 50 }}
            />
        )}
        {gameWon && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 3 }}
                className="absolute inset-0 bg-white flex items-center justify-center pointer-events-none"
                style={{ zIndex: 50 }}
            />
        )}
      </AnimatePresence>
    </div>
  );
};
