
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShapeRenderer } from '../ui/ShapeRenderer';
import { ShapeType, StudentEntity, TeacherEntity } from '../../types';
import { COLORS } from '../../constants';
import { useKeyPress } from '../../hooks/useKeyPress';
import { useGameLoop } from '../../hooks/useGameLoop';
import { useAudio } from '../../contexts/AudioContext';

interface Level1Props {
  onComplete: () => void;
}

// Configuration
const LEVEL_DURATION = 60000; 
const PHASE_SWITCH_TIME = 15000; 
const TEACHER_SWITCH_INTERVAL = 15000; 
const BASE_DIFFICULTY = 0.00006; 
const TAP_POWER_PERCENT = 0.05; 

// Revolution Config
const REVOLUTION_SPEED = 0.0004; // Slower buildup (was 0.0008) for smoother teacher fade out
const REVOLUTION_DECAY = 0.0006; 
const REVOLUTION_WAVE_SPEED = 5; 

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

export const Level1Conformity: React.FC<Level1Props> = ({ onComplete }) => {
  // Audio System
  const { playTrack, setTrackVolume, stopTrack } = useAudio();

  // --- Game State ---
  const [gameTime, setGameTime] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'HOLD' | 'TAP'>('HOLD');
  
  // Revolution State
  const [rebellionProgress, setRebellionProgress] = useState(0); 
  const [isRevolutionComplete, setIsRevolutionComplete] = useState(false);
  const [revolutionWaveRadius, setRevolutionWaveRadius] = useState(0); 
  const allRedTimeRef = useRef<number | null>(null); 

  // Audio Focus State (For ducking)
  const focusLevelRef = useRef(0); // 0 = Normal, 1 = Fully Focused (Quiet)

  // Teacher Logic
  const teacherQueue = useRef<TeacherEntity[]>([
      { shape: ShapeType.SQUARE, color: '#8b5cf6' }, // Violet (Start)
      { shape: ShapeType.TRIANGLE, color: '#3b82f6' }, // Blue
      { shape: ShapeType.CIRCLE, color: '#d946ef' }, // Pink
      { shape: ShapeType.HEXAGON, color: '#f59e0b' }, // Amber (Final Boss)
  ]);
  const [currentTeacher, setCurrentTeacher] = useState<TeacherEntity>(teacherQueue.current[0]);
  const [isSwitchingTeacher, setIsSwitchingTeacher] = useState(false); 
  const nextTeacherIndexRef = useRef(0);

  // Students
  const [students, setStudents] = useState<StudentEntity[]>(() => {
      const shapes = Object.values(ShapeType);
      // Students start as Grey (Unconformed / Blank Slate)
      const initialColor = '#525252'; 
      return Array.from({ length: 10 }).map((_, i) => {
          const isPlayer = i === 9; // Player is the last one (separate row)
          
          const original = isPlayer ? ShapeType.CIRCLE : (shapes[i % shapes.length] === ShapeType.SQUARE ? ShapeType.DIAMOND : shapes[i % shapes.length]);
          const color = isPlayer ? '#10b981' : initialColor;

          return {
            id: `student-${i}`,
            originalShape: original,
            visualStartingShape: original, 
            color: color,
            rotationOffset: Math.random() * 360,
            conformity: 0,
            baseSpeed: 0.00005 + (Math.random() * 0.00015), 
            morphSpeed: 1, 
            isPlayer: isPlayer,
            mode: 'CONFORMING'
          };
      });
  });

  // Input & Visual Feedback
  const spacePressed = useKeyPress(' ');
  const leftArrowPressed = useKeyPress('ArrowLeft'); 
  const spacePressedRef = useRef(false);
  const leftArrowPressedRef = useRef(false);
  
  const tapLogicQueueRef = useRef(0); 
  const [visualTapTrigger, setVisualTapTrigger] = useState(0);

  useEffect(() => { spacePressedRef.current = spacePressed; }, [spacePressed]);
  useEffect(() => { leftArrowPressedRef.current = leftArrowPressed; }, [leftArrowPressed]);

  // Init Audio
  useEffect(() => {
    // Start Routine BGM at full volume
    playTrack('bgm_level1_routine', { volume: 1, loop: true, fadeDuration: 2000 });
    // Start Resistance BGM at 0 volume (synced)
    playTrack('bgm_level1_resistance', { volume: 0, loop: true });

    return () => {
        stopTrack('bgm_level1_routine', { fadeDuration: 1000 });
        stopTrack('bgm_level1_resistance', { fadeDuration: 1000 });
    };
  }, [playTrack, stopTrack]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === ' ' && !e.repeat) {
              tapLogicQueueRef.current += 1;
              setVisualTapTrigger(prev => prev + 1); 
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-advance logic
  useEffect(() => {
      if (gameOver) {
          // Fade out audio on game over
          setTrackVolume('bgm_level1_routine', 0, 2000);
          setTrackVolume('bgm_level1_resistance', 0, 2000);

          const timer = setTimeout(() => {
              onComplete();
          }, 3000); 
          return () => clearTimeout(timer);
      }
  }, [gameOver, onComplete, setTrackVolume]);

  // --- Logic Helpers ---

  const triggerTeacherSwitch = (nextIndex: number) => {
      setIsSwitchingTeacher(true);
      nextTeacherIndexRef.current = nextIndex % teacherQueue.current.length;
      
      const nextTeacher = teacherQueue.current[nextIndex % teacherQueue.current.length];
      const prevTeacherShape = currentTeacher.shape;

      // Update students
      setStudents(prev => prev.map(s => {
          // KEY CHANGE: If it is the player, they reset to their TRUE SELF (originalShape).
          // Other students maintain the residue of the previous teacher (prevTeacherShape).
          const nextVisualStart = s.isPlayer ? s.originalShape : prevTeacherShape;

          return {
              ...s,
              mode: 'CONFORMING', 
              visualStartingShape: nextVisualStart, 
              conformity: 0 // Reset progress for the new cycle
          };
      }));

      setCurrentTeacher(nextTeacher);
      
      setTimeout(() => {
        setIsSwitchingTeacher(false);
      }, 3000);
  };

  // --- Game Loop ---
  useGameLoop((deltaTime) => {
    if (gameOver && !isRevolutionComplete) return; 

    const newTime = gameTime + deltaTime;
    setGameTime(newTime);
    const dtSeconds = deltaTime / 1000;

    // 0. Revolution / Anti-Gravity Logic
    let currentRebellion = rebellionProgress;
    
    if (!isRevolutionComplete) {
        if (leftArrowPressedRef.current) {
            currentRebellion += REVOLUTION_SPEED * deltaTime;
        } else {
            currentRebellion -= REVOLUTION_DECAY * deltaTime;
        }
        
        currentRebellion = Math.max(0, Math.min(1, currentRebellion));
        setRebellionProgress(currentRebellion);

        if (currentRebellion >= 1) {
            setIsRevolutionComplete(true);
        }
    } else {
        setRevolutionWaveRadius(prev => prev + REVOLUTION_WAVE_SPEED * dtSeconds);

        if (revolutionWaveRadius > 8) {
            if (allRedTimeRef.current === null) {
                allRedTimeRef.current = newTime;
            } else if (newTime > allRedTimeRef.current + 1000) {
                setGameOver(true);
            }
        }
    }

    // 1. Time Limit Check
    if (newTime >= LEVEL_DURATION && !isRevolutionComplete) {
        setGameOver(true);
        return;
    }

    // 2. Logic Updates
    if (!isRevolutionComplete) {
        // Teacher Switching & Phase Logic
        if (newTime >= PHASE_SWITCH_TIME && currentPhase === 'HOLD') {
            setCurrentPhase('TAP');
        }
        
        const currentInterval = Math.floor(gameTime / TEACHER_SWITCH_INTERVAL);
        const newInterval = Math.floor(newTime / TEACHER_SWITCH_INTERVAL);
        if (newInterval > currentInterval && !isSwitchingTeacher) {
            triggerTeacherSwitch(newInterval);
        }
    }

    const tapsProcessed = tapLogicQueueRef.current;
    
    // Check if we are in the "Despair Phase" (Last 12 seconds)
    const isDespairPhase = newTime > LEVEL_DURATION - 12000;

    // 3. Simulation
    let playerConformity = 0;

    setStudents(prevStudents => {
        return prevStudents.map((student, index) => {
            // REVOLUTION EFFECT: Immediate Override
            if (isRevolutionComplete) {
                if (student.isPlayer) playerConformity = 0;

                const row = Math.floor(index / 5);
                const col = index % 5;
                const dist = Math.sqrt(Math.pow(row + 1, 2) + Math.pow(col - 2, 2));
                
                if (revolutionWaveRadius > dist) {
                     return {
                        ...student,
                        color: '#ef4444', // Red
                        visualStartingShape: ShapeType.CIRCLE, // Instantly Circle
                        conformity: 0 // No interpolation, just pure shape
                    };
                } else {
                    return student;
                }
            }

            let change = 0;
            const timeMultiplier = 1 + (newTime / LEVEL_DURATION); 
            let newConformity = student.conformity;

            // --- CONFORMING LOGIC (Simplified: No Revert Mode) ---
            if (student.isPlayer) {
                if (isDespairPhase) {
                    newConformity += (0.0005 * deltaTime); 
                } else {
                    if (currentPhase === 'HOLD') {
                        if (spacePressedRef.current) {
                            change -= (0.0008 * deltaTime);
                        } else {
                            change += (student.baseSpeed + BASE_DIFFICULTY) * timeMultiplier * deltaTime;
                        }
                        newConformity += change;
                    } else {
                        // TAP PHASE
                        const tapPhaseProgress = (newTime - PHASE_SWITCH_TIME) / (LEVEL_DURATION - PHASE_SWITCH_TIME);
                        const pressure = (student.baseSpeed + BASE_DIFFICULTY) * (1 + tapPhaseProgress * 0.5) * deltaTime;
                        
                        newConformity += pressure;

                        if (tapsProcessed > 0) {
                            newConformity -= (TAP_POWER_PERCENT * tapsProcessed);
                        }
                    }

                    if (currentRebellion > 0) {
                        newConformity -= (0.001 * deltaTime * currentRebellion);
                    }
                }
            } else {
                change = student.baseSpeed * timeMultiplier * deltaTime;
                newConformity += change;
            }

            newConformity = Math.max(0, Math.min(1, newConformity));
            
            if (student.isPlayer) {
                playerConformity = newConformity;
                if (newConformity >= 1 && !gameOver && !isRevolutionComplete) {
                    setGameOver(true);
                }
            }

            return { ...student, conformity: newConformity };
        });
    });
    
    // --- Audio Logic in Game Loop ---
    if (!gameOver) {
        // 1. Calculate Base Volume based on Conformity (Numbness)
        // High conformity = Low volume (Numbness)
        let targetRoutineVol = 1 - Math.pow(playerConformity, 0.5);

        // 2. Focus Ducking Logic (The User Request)
        // When working (Space Pressed), the routine noise fades into the background immediately.
        // We smooth this transition using a focusLevel ref.
        const targetFocus = spacePressedRef.current ? 1 : 0;
        // Interpolate focus level (approx 200ms transition)
        focusLevelRef.current += (targetFocus - focusLevelRef.current) * 8 * dtSeconds;
        
        // Apply ducking: Volume drops to 20% when fully focused
        const duckingMultiplier = 1 - (focusLevelRef.current * 0.8);
        targetRoutineVol *= duckingMultiplier;

        // 3. Resistance Logic
        // If resisting (Left Key), Resistance Track goes UP, Routine Track goes DOWN.
        let targetResistanceVol = currentRebellion; // Direct mapping
        
        // Resistance suppresses routine even further
        targetRoutineVol = targetRoutineVol * (1 - currentRebellion);

        // Apply volumes (No fade duration here, we want instant reaction to game loop state)
        setTrackVolume('bgm_level1_routine', targetRoutineVol, 0);
        setTrackVolume('bgm_level1_resistance', targetResistanceVol, 0);
    }
    
    tapLogicQueueRef.current = 0;

  }, !gameOver || isRevolutionComplete);

  const player = students.find(s => s.isPlayer);
  const npcs = students.filter(s => !s.isPlayer);

  const playerDisplayColor = player 
    ? lerpColor('#10b981', '#ef4444', rebellionProgress) 
    : '#10b981';

  return (
    <div 
        className="relative w-full h-full bg-[#050505] flex flex-col items-center justify-center p-4 overflow-hidden select-none"
    >
      {/* Background Noise */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} 
      />
      
      {/* Game Area */}
      <div className="flex-1 w-full max-w-7xl flex flex-row items-center justify-center gap-16 relative z-10 -mt-20 px-8">
        
        {/* Left Side: The Teacher */}
        <div className="relative w-1/3 h-96 flex items-center justify-center">
             <motion.div
                className="absolute flex items-center justify-center"
                animate={{ 
                    x: rebellionProgress * -100, // Move back into shadow
                    opacity: 1 - rebellionProgress,
                    scale: 1 - rebellionProgress * 0.2
                }}
             >
                <AnimatePresence mode="popLayout">
                    <motion.div 
                        key={currentTeacher.shape} 
                        initial={{ x: -200, opacity: 0 }} 
                        animate={{ x: 0, opacity: 1 }} 
                        exit={{ x: -200, opacity: 0 }} 
                        transition={{ 
                            duration: 3.0, 
                            ease: [0.22, 1, 0.36, 1] 
                        }}
                    >
                        <ShapeRenderer 
                            type={currentTeacher.shape}
                            color={currentTeacher.color}
                            targetType={currentTeacher.shape}
                            targetColor={currentTeacher.color}
                            size={180} 
                            conformity={0}
                            className="drop-shadow-[0_10px_30px_rgba(255,255,255,0.15)]"
                        />
                    </motion.div>
                </AnimatePresence>
             </motion.div>
        </div>

        {/* Right Side: The Students & Player */}
        <div className="w-2/3 flex flex-col items-center gap-16 perspective-container" style={{ perspective: '800px' }}>
            
            {/* Top Row: 3x3 Grid of NPCs */}
            <div className="grid grid-cols-3 gap-8">
                {npcs.map((student) => (
                    <motion.div 
                        key={student.id} 
                        className="relative flex items-center justify-center" 
                        style={{ transformStyle: 'preserve-3d', zIndex: 1 }}
                    >
                        <ShapeRenderer
                            type={student.visualStartingShape}
                            color={student.color}
                            targetType={currentTeacher.shape}
                            targetColor={currentTeacher.color} 
                            size={70}
                            conformity={isRevolutionComplete ? 0 : student.conformity}
                            className="shadow-sm"
                        />
                    </motion.div>
                ))}
            </div>

            {/* Bottom Row: The Player (Larger, Separated) */}
            {player && (
                 <motion.div 
                    key={player.id} 
                    className="relative flex items-center justify-center mt-4" 
                    style={{ transformStyle: 'preserve-3d', zIndex: 50 }}
                    animate={isRevolutionComplete ? {
                        x: -600, // Move drastically LEFT to replace Teacher
                        y: -50,
                        scale: 1.2, 
                        rotateZ: -5
                    } : {
                        x: rebellionProgress * -200, // Gradual move to left when resisting
                    }}
                    transition={{
                        // Smooth transition for the finale (3s), responsive for gameplay (0.1s)
                        duration: isRevolutionComplete ? 3.0 : 0.1,
                        ease: isRevolutionComplete ? [0.22, 1, 0.36, 1] : "linear"
                    }}
                >
                    {!gameOver && !isRevolutionComplete && (
                        <div className="absolute top-full mt-6 w-24 h-1 bg-white/20 rounded-full blur-[4px] animate-pulse" />
                    )}
                    
                    <ShapeRenderer
                        type={player.visualStartingShape}
                        color={playerDisplayColor}
                        targetType={currentTeacher.shape}
                        targetColor={currentTeacher.color} 
                        size={100} // Larger than NPCs
                        conformity={isRevolutionComplete ? 0 : player.conformity}
                        className="drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                    />
                </motion.div>
            )}

        </div>
      </div>

      {/* Spacebar UI */}
      <motion.div 
        className="relative w-full flex flex-col items-center justify-center z-20 pb-10 h-32"
        style={{ opacity: 1 - rebellionProgress }}
      >
         {!gameOver && (
            <div className="relative group flex flex-col items-center gap-4">
                <div className="relative">
                    {/* Visual Feedback for Phase */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10 flex items-center justify-center">
                    {currentPhase === 'HOLD' ? (
                        <>
                            <motion.div 
                                className="absolute w-80 h-24 rounded-2xl border-2 border-white/30"
                                animate={{ scale: [1, 1.2], opacity: [0.5, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                            />
                        </>
                    ) : (
                        <>
                            {/* Tap Phase: Red Pulsing Box */}
                            <motion.div 
                                className="absolute w-72 h-14 rounded-lg border-2 border-red-500/50"
                                animate={{ 
                                    scale: [1, 1.15, 1], 
                                    opacity: [0, 0.8, 0], 
                                    rotate: [0, 1, -1, 0] 
                                }}
                                transition={{ duration: 0.4, repeat: Infinity }}
                            />
                            <AnimatePresence>
                            <motion.div 
                                key={visualTapTrigger} 
                                className="absolute w-80 h-24 rounded-2xl border-4 border-white/60 bg-white/5"
                                initial={{ scale: 0.9, opacity: 1 }}
                                animate={{ scale: 1.5, opacity: 0, borderWidth: "0px" }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                            />
                            </AnimatePresence>
                        </>
                    )}
                    </div>

                    {/* The Physical Key */}
                    <motion.div 
                        className={`
                            relative w-72 h-14 rounded-lg 
                            bg-zinc-900 border-2 
                            shadow-[0_10px_0_rgb(24,24,27)] 
                            flex items-center justify-center
                            overflow-hidden
                            transition-colors duration-300
                        `}
                        style={{
                            borderColor: currentPhase === 'TAP' && !spacePressed 
                                ? 'rgba(239, 68, 68, 0.6)' 
                                : 'rgb(82, 82, 91)'
                        }}
                        animate={spacePressed ? { 
                            y: 8, 
                            boxShadow: "0px 2px 0px rgb(24,24,27)", 
                            scale: 0.98 
                        } : { 
                            y: 0, 
                            boxShadow: "0px 10px 0px rgb(24,24,27)",
                            scale: 1,
                            x: currentPhase === 'TAP' ? [0, -1, 1, -1, 1, 0] : 0 
                        }}
                        transition={{ 
                            duration: 0.05,
                            x: { duration: 0.2, repeat: currentPhase === 'TAP' ? Infinity : 0, repeatDelay: 0.5 } 
                        }}
                    >
                        <div className="absolute inset-x-0 top-0 h-[2px] bg-white/20" />
                        <div className="w-12 h-1 rounded-full bg-zinc-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" />
                        
                        {currentPhase === 'HOLD' && (
                            <motion.div 
                                className="absolute inset-0 bg-white/10"
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: spacePressed ? 1 : 0 }}
                                transition={{ duration: 0.2 }}
                                style={{ originX: 0 }}
                            />
                        )}

                        {currentPhase === 'TAP' && spacePressed && (
                            <motion.div 
                                className="absolute inset-0 bg-white/30"
                                initial={{ opacity: 1 }}
                                animate={{ opacity: 0 }}
                                transition={{ duration: 0.1 }}
                            />
                        )}
                    </motion.div>
                </div>
            </div>
         )}
      </motion.div>

      {/* Ending Fade Overlays */}
      <AnimatePresence>
        {gameOver && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 2 }}
                className={`absolute inset-0 z-50 pointer-events-none ${isRevolutionComplete ? 'bg-white' : 'bg-black'}`}
            />
        )}
      </AnimatePresence>
    </div>
  );
};
