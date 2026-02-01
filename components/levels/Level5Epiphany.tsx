
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useGameLoop } from '../../hooks/useGameLoop';
import { useKeyPress } from '../../hooks/useKeyPress';
import { ShapeRenderer } from '../ui/ShapeRenderer';
import { ShapeType } from '../../types';
import { useAudio } from '../../contexts/AudioContext';

interface Level5Props {
  onComplete: (isLiberated: boolean) => void;
}

interface Ball {
  id: number;
  gridIndex: number; // Position in the grid (0 to N*N-1)
  isPlayer: boolean;
  isRed: boolean;
  isMovingLeft: boolean;
  xOffset: number; // Deviation from grid
  velocityX: number; // Impulse velocity
}

// Config
const GRID_GAP = 80;
const LURCH_FORCE = 900; // Strong initial impulse to the Right
const FRICTION = 4.0; // How fast the impulse decays
const RED_MOVE_SPEED = 400; // How fast NPCs move left (Drag force)
const PLAYER_RESISTANCE_SPEED = 250; // How fast player moves left when holding key
const PLAYER_RETURN_SPEED = 600; // How fast balls return to grid when not resisting
const LIBERATION_THRESHOLD = -600; // Distance required to "break free" (Legacy check)
const MAX_STAGE = 10;
const JUMP_COOLDOWN = 600; // ms

// Visual config
const TIME_DILATION = 0.2; // The world moves at 20% speed during the final choice
const FREEDOM_VELOCITY = 600; // Speed of player when they choose freedom

export const Level5Epiphany: React.FC<Level5Props> = ({ onComplete }) => {
  // Audio
  const { playTrack, setTrackVolume, stopTrack } = useAudio();

  // Game State
  const [stage, setStage] = useState(1); 
  const [balls, setBalls] = useState<Ball[]>([]);
  const [jumpCountInStage, setJumpCountInStage] = useState(0);
  
  // Ending States
  const [isLiberated, setIsLiberated] = useState(false); // White Ending
  const [isLost, setIsLost] = useState(false); // Black Ending
  const [finalChoiceMode, setFinalChoiceMode] = useState(false); // The frozen moment before the end
  const [showFinalHint, setShowFinalHint] = useState(false); // Immediate visual trigger
  const [hasChosenFreedom, setHasChosenFreedom] = useState(false); // Player pressed Left in finale

  // Input
  const spacePressed = useKeyPress(' ');
  const leftArrowPressed = useKeyPress('ArrowLeft');
  const spaceTriggerRef = useRef(false);
  const lastJumpTimeRef = useRef(0);
  const spaceReleaseCheckRef = useRef(false); // To ensure we don't trigger end immediately on the same press

  // Layout Helpers
  const getGridSize = (currentStage: number) => {
      // Direct mapping up to Max Stage
      return Math.min(MAX_STAGE, currentStage);
  };

  const getPlayerIndex = (currentStage: number) => {
      // Calculate center index for ANY grid size NxN
      const size = getGridSize(currentStage);
      const total = size * size;
      return Math.floor(total / 2);
  };

  // Init Audio
  useEffect(() => {
    // Play Epiphany BGM - Set loop: true explicitly to ensure continuous atmosphere
    playTrack('bgm_level5_epiphany', { volume: 0.8, loop: true, fadeDuration: 2000 });

    return () => {
        stopTrack('bgm_level5_epiphany', { fadeDuration: 1000 });
    };
  }, [playTrack, stopTrack]);

  // Audio Fade Out on End
  useEffect(() => {
    if (isLiberated || isLost) {
        setTrackVolume('bgm_level5_epiphany', 0, 3000);
    }
  }, [isLiberated, isLost, setTrackVolume]);

  // Initialize Stage
  useEffect(() => {
    const size = getGridSize(stage);
    const total = size * size;
    const playerIdx = getPlayerIndex(stage);

    const newBalls: Ball[] = Array.from({ length: total }).map((_, i) => ({
        id: stage * 1000 + i, // Unique ID per stage to force re-render/anim
        gridIndex: i,
        isPlayer: i === playerIdx,
        isRed: false,
        isMovingLeft: false,
        xOffset: 0,
        velocityX: 0
    }));

    setBalls(newBalls);
    setJumpCountInStage(0);
  }, [stage]);

  // Completion Delay
  useEffect(() => {
      if (isLiberated) {
          const timer = setTimeout(() => {
              onComplete(true); // Success: Awakened
          }, 3500);
          return () => clearTimeout(timer);
      }
      if (isLost) {
          const timer = setTimeout(() => {
              onComplete(false); // Failure: Conformed
          }, 3500);
          return () => clearTimeout(timer);
      }
  }, [isLiberated, isLost, onComplete]);

  // --- Game Loop ---
  useGameLoop((deltaTime) => {
      if (isLiberated || isLost) return;
      const dtSeconds = deltaTime / 1000;
      const now = Date.now();

      // --- FINAL CHOICE LOGIC ---
      if (finalChoiceMode) {
          // Wait for Space release first so we don't auto-trigger
          if (!spacePressed) {
              spaceReleaseCheckRef.current = true;
          }

          if (spaceReleaseCheckRef.current) {
              if (spacePressed && !hasChosenFreedom) {
                  setIsLost(true); // Choose conformity
              }
              if (leftArrowPressed && !hasChosenFreedom) {
                  setHasChosenFreedom(true); // Choose freedom (Start Animation)
              }
          }
          
          // "Bullet Time" Physics
          // The world keeps moving, but very slowly.
          setBalls(prev => prev.map(ball => {
              let newX = ball.xOffset;
              let newIsRed = ball.isRed;
              
              if (ball.isPlayer) {
                  if (hasChosenFreedom) {
                      // Player actively moves LEFT (overcoming the slow motion)
                      newX -= FREEDOM_VELOCITY * dtSeconds;
                      newIsRed = true; // Turn RED to signify resistance/effort
                  } else {
                      // Player drifts slowly with momentum
                      newX += ball.velocityX * dtSeconds * TIME_DILATION;
                  }
              } else if (ball.isMovingLeft || ball.isRed) {
                  // Red balls CONTINUE to flow past the player, but in slow motion
                  // This creates the effect that the current is trying to sweep everyone away
                  newX -= RED_MOVE_SPEED * dtSeconds * TIME_DILATION;
              }
              
              // Apply slow friction to impulse
              const newVx = ball.velocityX * 0.95;

              return {
                  ...ball,
                  xOffset: newX,
                  velocityX: newVx,
                  isRed: newIsRed
              };
          }));

          // Trigger ACTUAL Liberation after player has moved far enough
          if (hasChosenFreedom) {
             const player = balls.find(b => b.isPlayer);
             // Threshold to ensure player has visibly left the pack
             // The pack is around -400 to +400. -1200 is safely off-screen relative to grid.
             if (player && player.xOffset < -1200) {
                 setIsLiberated(true);
             }
          }
          
          return; // Skip normal physics
      }


      // 1. Handle Space Input
      if (spacePressed && !spaceTriggerRef.current) {
          spaceTriggerRef.current = true;
          if (now - lastJumpTimeRef.current > JUMP_COOLDOWN) {
             handleJump(now);
          }
      }
      if (!spacePressed) {
          spaceTriggerRef.current = false;
      }

      // 2. Physics & Animation
      setBalls(prev => prev.map(ball => {
          let newX = ball.xOffset;
          let newVx = ball.velocityX;
          let newIsRed = ball.isRed;

          // Apply Impulse Velocity (Rightward Lurch)
          if (Math.abs(newVx) > 1) {
              newX += newVx * dtSeconds;
              // Friction (Decay)
              newVx -= newVx * FRICTION * dtSeconds;
          } else {
              newVx = 0;
          }

          // --- PLAYER RESISTANCE LOGIC ---
          if (ball.isPlayer) {
              if (leftArrowPressed) {
                  // Push Left (Resist)
                  newX -= PLAYER_RESISTANCE_SPEED * dtSeconds;
                  newIsRed = true; // Turn red while resisting
              } else {
                  // Pull Back (Return to Formation/Center)
                  if (Math.abs(newX) > 1) {
                      const dir = newX > 0 ? -1 : 1;
                      // Stronger return if we are positive (Conformity pull)
                      const speed = dir === -1 ? PLAYER_RETURN_SPEED : PLAYER_RETURN_SPEED * 0.5;
                      newX += dir * speed * dtSeconds;
                      // Snap to 0
                      if ((dir === -1 && newX < 0) || (dir === 1 && newX > 0)) newX = 0;
                  }
                  newIsRed = false; // Turn green again
              }

              // Check Win Condition (Broke free during normal play - rare but possible)
              if (newX < LIBERATION_THRESHOLD && !isLiberated) {
                  setIsLiberated(true);
              }
          } 
          // --- NPC LOGIC ---
          else {
              if (ball.isMovingLeft) {
                  // Red balls constantly move Left (The Drag)
                  newX -= RED_MOVE_SPEED * dtSeconds;
              } else {
                  // Green balls return to 0 if displaced by Lurch
                  if (newX > 0) {
                      newX -= PLAYER_RETURN_SPEED * dtSeconds;
                      if (newX < 0) newX = 0;
                  }
              }
          }

          return {
              ...ball,
              xOffset: newX,
              velocityX: newVx,
              isRed: newIsRed
          };
      }));

  }, !isLiberated && !isLost);

  const handleJump = (now: number) => {
      lastJumpTimeRef.current = now;

      // 1. Trigger Lurch Physics (Kick Right)
      setBalls(prev => prev.map(b => {
          if (!b.isMovingLeft) {
              return { ...b, velocityX: LURCH_FORCE + (Math.random() * 100) };
          }
          return b; 
      }));

      // 2. Progression Logic
      const nextJumpCount = jumpCountInStage + 1;
      setJumpCountInStage(nextJumpCount);

      // GENERALIZED STAGE LOGIC:
      if (stage < MAX_STAGE) {
          // ... (existing logic for stage < MAX)
          if (nextJumpCount >= stage) {
              if (stage >= 3) {
                  const amount = Math.ceil(stage / 2);
                  turnRandomBallRed(amount);
                  setTimeout(() => setStage(stage + 1), 1200);
              } else {
                  setTimeout(() => setStage(stage + 1), 300);
              }
              return;
          }
          if (stage >= 4) {
             turnRandomBallRed(1);
          }
      } 
      // FINAL STAGE LOGIC (Stage 10)
      else if (stage === MAX_STAGE) {
          // Turn escalating amount of balls red per jump
          turnRandomBallRed(nextJumpCount * 2);

          // If we hit the final jump count (10)
          if (nextJumpCount >= MAX_STAGE) {
               // IMMEDIATE VISUAL CUE - CAMERA SNAPS NOW
               setShowFinalHint(true);
               
               // DELAY PHYSICS CHANGE:
               // We reduce the delay to 600ms. 
               // This means the camera (taking ~600ms to snap) will arrive 
               // just as the physics freeze happens. 
               setTimeout(() => {
                   setFinalChoiceMode(true);
                   spaceReleaseCheckRef.current = false;
               }, 600);
          }
          
          // Fallback check
          setBalls(currentBalls => {
              const remainingGreens = currentBalls.filter(b => !b.isPlayer && !b.isRed).length;
              if (remainingGreens === 0 && !finalChoiceMode) {
                  setShowFinalHint(true);
                  setTimeout(() => {
                      setFinalChoiceMode(true);
                      spaceReleaseCheckRef.current = false;
                  }, 600);
              }
              return currentBalls;
          });
      }
  };

  const turnRandomBallRed = (count: number) => {
      setBalls(prev => {
          const candidates = prev.filter(b => !b.isPlayer && !b.isRed);
          if (candidates.length === 0) return prev;

          // Shuffle and pick 'count'
          const shuffled = [...candidates].sort(() => Math.random() - 0.5);
          const toTurn = shuffled.slice(0, count).map(b => b.id);

          return prev.map(b => {
              if (toTurn.includes(b.id)) {
                  return {
                      ...b,
                      isRed: true,
                      isMovingLeft: true
                  };
              }
              return b;
          });
      });
  };

  // Rendering Helpers
  const gridSize = getGridSize(stage);
  // Centering calculations
  const totalWidth = (gridSize - 1) * GRID_GAP;
  const startX = -totalWidth / 2;
  const startY = -totalWidth / 2;

  // Camera Zoom Logic
  const baseZoom = Math.max(0.4, 1 - (stage - 2) * 0.08);
  const targetZoom = showFinalHint ? 1.4 : baseZoom;

  // --- CAMERA PAN LOGIC (CENTERING) ---
  const playerBall = balls.find(b => b.isPlayer);
  let focusOffsetX = 0;
  let focusOffsetY = 0;

  if (showFinalHint && playerBall) {
      // 1. Calculate Player's Base Grid Position
      const row = Math.floor(playerBall.gridIndex / gridSize);
      const col = playerBall.gridIndex % gridSize;
      const basePlayerX = startX + col * GRID_GAP;
      const basePlayerY = startY + row * GRID_GAP;

      // 2. Calculate Actual World Position
      const worldPlayerX = basePlayerX + playerBall.xOffset;
      const worldPlayerY = basePlayerY; 

      // 3. Pan the container
      focusOffsetX = -worldPlayerX;
      focusOffsetY = -worldPlayerY;
  }

  return (
    <div className="relative w-full h-full bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
        
        {/* The Grid Container - Scaled & Panned */}
        <motion.div 
            className="relative w-0 h-0 flex items-center justify-center"
            animate={{ 
                scale: targetZoom,
                x: focusOffsetX, 
                y: focusOffsetY 
            }}
            transition={{ 
                // Dynamic Duration: Fast Snap (0.6s) on Finale, Slow Zoom (1.5s) otherwise
                duration: showFinalHint ? 0.6 : 1.5, 
                // Aggressive Snap ease for finale, smooth for normal
                ease: showFinalHint ? [0.22, 1, 0.36, 1] : "easeInOut"
            }}
        >
            <AnimatePresence>
                {balls.map(ball => {
                    const row = Math.floor(ball.gridIndex / gridSize);
                    const col = ball.gridIndex % gridSize;

                    const baseX = startX + col * GRID_GAP;
                    const baseY = startY + row * GRID_GAP;

                    return (
                        <motion.div
                            key={ball.id}
                            className="absolute flex items-center justify-center"
                            style={{
                                x: baseX + ball.xOffset,
                                y: baseY, // Fixed Y
                            }}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            {/* FINAL CHOICE HINT UI - Attached to Player Ball */}
                            {/* Ghostly Effect: Opacity pulses, Blur, Scale breathing */}
                            {/* Hide hint once decision is made */}
                            {ball.isPlayer && showFinalHint && !hasChosenFreedom && (
                                <motion.div 
                                    className="absolute right-full mr-12 flex items-center gap-2 pointer-events-none"
                                    initial={{ opacity: 0, filter: 'blur(5px)', scale: 0.5 }}
                                    animate={{ 
                                        opacity: [0, 0.4, 0.8, 0.4, 0.2], 
                                        filter: ['blur(5px)', 'blur(0px)', 'blur(2px)', 'blur(0px)'],
                                        scale: [0.9, 1.1, 1.05],
                                        x: [10, -5, 0]
                                    }}
                                    transition={{ 
                                        duration: 4, 
                                        repeat: Infinity, 
                                        ease: "easeInOut",
                                        times: [0, 0.2, 0.5, 0.8, 1]
                                    }}
                                >
                                    <div className="relative">
                                        <ArrowLeft className="text-white w-16 h-16 drop-shadow-[0_0_15px_rgba(255,255,255,1)]" />
                                        {/* Second ghost arrow for trailing effect */}
                                        <motion.div 
                                            className="absolute inset-0 text-white opacity-50"
                                            animate={{ x: [0, 10, 0], opacity: [0.5, 0, 0.5] }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                        >
                                            <ArrowLeft className="w-16 h-16 blur-sm" />
                                        </motion.div>
                                    </div>
                                </motion.div>
                            )}

                            <ShapeRenderer 
                                type={ShapeType.CIRCLE}
                                color={ball.isRed ? '#ef4444' : '#10b981'}
                                targetType={ShapeType.CIRCLE}
                                targetColor={ball.isRed ? '#ef4444' : '#10b981'}
                                conformity={0}
                                size={40}
                                className={ball.isPlayer ? `drop-shadow-[0_0_15px_${ball.isRed ? '#ef4444' : '#10b981'}]` : ""}
                            />
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </motion.div>

        {/* Endings */}
        <AnimatePresence>
            {isLiberated && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 3 }}
                    className="absolute inset-0 bg-white z-50 flex items-center justify-center"
                />
            )}
            {isLost && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 2 }}
                    className="absolute inset-0 bg-black z-50 flex items-center justify-center"
                />
            )}
        </AnimatePresence>

    </div>
  );
};
