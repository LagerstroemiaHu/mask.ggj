
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameLoop } from '../../hooks/useGameLoop';
import { useKeyPress } from '../../hooks/useKeyPress';
import { useAudio } from '../../contexts/AudioContext';

interface Level3Props {
  onComplete: () => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; 
  maxLife: number;
  color: string;
  size: number;
}

// Config
const WAGE_CEILING = 15; 
const CAPITAL_EXPONENT = 1.15; 
const CAPITAL_BASE_GAIN = 5; 
const CLICK_DECAY_START = 20; 
const CLICK_DECAY_END = 80; 
const GRAVITY = 3000; 
const CAPITAL_MAX_THRESHOLD = 500; 
const UNIFIED_MAX_THRESHOLD = 1000; // Threshold for the fused ending

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

export const Level3Capital: React.FC<Level3Props> = ({ onComplete }) => {
  // Audio
  const { playTrack, setTrackVolume, playSound, stopTrack } = useAudio();
  
  // Game State
  const [wageValue, setWageValue] = useState(0); 
  const [capitalValue, setCapitalValue] = useState(0); 
  const [unifiedValue, setUnifiedValue] = useState(0); // For Fused state
  const [totalClicks, setTotalClicks] = useState(0);
  
  const [isFused, setIsFused] = useState(false); // New Fusion State
  const [fusionProgress, setFusionProgress] = useState(0); // 0 to 1 (1 = Fused)
  const [attractionFactor, setAttractionFactor] = useState(0); // 0 (Apart) to 1 (Touching)

  const [gameOver, setGameOver] = useState(false);
  const [isLiberated, setIsLiberated] = useState(false); // Renamed to "Ascended" logic effectively

  // Particles (Canvas)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const particleIdCounter = useRef(0);

  // Input
  const spacePressed = useKeyPress(' ');
  const leftArrowPressed = useKeyPress('ArrowLeft');
  const [impactTrigger, setImpactTrigger] = useState(0);

  // Init Audio
  useEffect(() => {
    // Play Ambient BGM
    playTrack('bgm_level3_capital', { volume: 0.8, loop: true, fadeDuration: 2000 });
    // Play Resistance BGM silently
    playTrack('bgm_level3_resistance', { volume: 0, loop: true });

    return () => {
        stopTrack('bgm_level3_capital', { fadeDuration: 1000 });
        stopTrack('bgm_level3_resistance', { fadeDuration: 1000 });
        // Ensure SFX stops if unmounted suddenly
        stopTrack('sfx_level3_drain', { fadeDuration: 500 });
    };
  }, [playTrack, stopTrack]);

  // Handle BGM Crossfade & Drain SFX
  useEffect(() => {
    if (gameOver) return;

    if (leftArrowPressed) {
        setTrackVolume('bgm_level3_capital', 0, 500);
        setTrackVolume('bgm_level3_resistance', 1, 500);
        
        // Play Drain Loop
        playTrack('sfx_level3_drain', { volume: 1.0, loop: true, fadeDuration: 200 });
    } else {
        setTrackVolume('bgm_level3_capital', 0.8, 500);
        setTrackVolume('bgm_level3_resistance', 0, 500);
        
        // Stop Drain Loop
        stopTrack('sfx_level3_drain', { fadeDuration: 200 });
    }
  }, [leftArrowPressed, setTrackVolume, gameOver, playTrack, stopTrack]);

  // Check ending
  useEffect(() => {
    if (gameOver) {
        setTrackVolume('bgm_level3_capital', 0, 3000);
        setTrackVolume('bgm_level3_resistance', 0, 3000);
        stopTrack('sfx_level3_drain', { fadeDuration: 1000 });
        
        const timer = setTimeout(() => {
            onComplete();
        }, 4000);
        return () => clearTimeout(timer);
    }
  }, [gameOver, onComplete, setTrackVolume, stopTrack]);

  // Handle Resize
  useEffect(() => {
      const handleResize = () => {
          if (canvasRef.current) {
              canvasRef.current.width = window.innerWidth;
              canvasRef.current.height = window.innerHeight;
          }
      };
      window.addEventListener('resize', handleResize);
      handleResize();
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle Space Input (Work)
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === ' ' && !e.repeat && !gameOver) {
              handleInteraction('SPACE');
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalClicks, gameOver, leftArrowPressed, isFused, wageValue, capitalValue, unifiedValue]);

  const handleInteraction = (type: 'SPACE') => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      
      setImpactTrigger(prev => prev + 1);

      // --- FUSED STATE INTERACTION ---
      if (isFused) {
          // Accelerated Growth in Fused State
          const growth = 50; // Super fast linear growth
          setUnifiedValue(prev => {
              const next = prev + growth;
              if (next > UNIFIED_MAX_THRESHOLD && !gameOver) {
                  triggerAscension();
              }
              return next;
          });
          // Reduced count from 60 to 30 for fused interaction
          spawnSparks(centerX, centerY, 'UNIFIED', 30, 2.0);
          playSound('sfx_level3_burn', 0.6); // Fused is high energy -> Burn sound
          return;
      }

      // --- NORMAL STATE INTERACTION ---
      if (type === 'SPACE' && !leftArrowPressed) {
          const currentClick = totalClicks + 1;
          setTotalClicks(currentClick);
          
          const alienation = Math.min(1, Math.max(0, (currentClick - CLICK_DECAY_START) / (CLICK_DECAY_END - CLICK_DECAY_START)));

          // Wage Logic
          const wageGain = Math.max(0, (2 - (wageValue / WAGE_CEILING) * 2)) * (1 - alienation);
          setWageValue(prev => Math.min(WAGE_CEILING, prev + wageGain));

          // Capital Logic
          const capitalGain = CAPITAL_BASE_GAIN * Math.pow(CAPITAL_EXPONENT, currentClick / 10);
          setCapitalValue(prev => {
              const nextVal = prev + capitalGain;
              if (nextVal > CAPITAL_MAX_THRESHOLD && !gameOver && attractionFactor < 0.8) {
                  setGameOver(true);
              }
              return nextVal;
          });

          // Visuals & Sound
          if (alienation < 0.9) {
              const isHighHeat = capitalValue > 150;
              spawnSparks(centerX, centerY, isHighHeat ? 'WHITE' : 'GOLD', isHighHeat ? 25 : 15, 1.0); 
              
              if (isHighHeat) {
                  playSound('sfx_level3_burn', 0.5);
              } else {
                  playSound('sfx_level3_coin', 0.4);
              }

          } else {
              spawnSparks(centerX, centerY, 'ASH', 10, 0.5);
              // Ash sound? Maybe a weak coin sound or silence.
              // Let's keep it silent or very quiet coin to signify loss of value
              if (Math.random() > 0.5) playSound('sfx_level3_coin', 0.1);
          }
      }
  };

  // Helper: Canvas Spark Spawner
  const spawnSparks = (x: number, y: number, type: 'GOLD' | 'WHITE' | 'RED' | 'ASH' | 'UNIFIED', count: number, speedMod: number) => {
      for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          
          let speedBase = 800;
          if (type === 'ASH') speedBase = 200;
          if (type === 'WHITE') speedBase = 400; 
          
          const velocity = (Math.random() * speedBase + (speedBase * 0.4)) * speedMod; 
          
          let upwardForce = 400;
          if (type === 'ASH') upwardForce = 0;
          if (type === 'WHITE') upwardForce = 50; 

          let color = '#fbbf24'; 
          if (type === 'WHITE') color = '#ffffff';
          if (type === 'RED') color = '#ef4444'; 
          if (type === 'ASH') color = '#71717a'; 
          if (type === 'UNIFIED') color = Math.random() > 0.5 ? '#ef4444' : '#fbbf24'; 

          particlesRef.current.push({
              id: particleIdCounter.current++,
              x: x + (Math.random() - 0.5) * 10, 
              y: y + (Math.random() - 0.5) * 10,
              vx: Math.cos(angle) * velocity,
              vy: Math.sin(angle) * velocity - upwardForce,
              life: 1.0,
              maxLife: 1.0,
              size: type === 'ASH' ? Math.random() * 2 + 1 : Math.random() * 3 + 1,
              color: color
          });
      }
  };

  // --- Game Loop ---
  useGameLoop((deltaTime) => {
      if (gameOver && !isLiberated) return;
      const dtSeconds = deltaTime / 1000;

      // --- ATTRACTION & FUSION LOGIC ---
      if (!isFused && !gameOver) {
          if (leftArrowPressed) {
              setAttractionFactor(prev => Math.min(1, prev + 1.0 * dtSeconds));
              
              if (capitalValue > 0) {
                   const transferRate = Math.max(10.0, capitalValue * 0.8) * dtSeconds; 
                   setCapitalValue(prev => Math.max(0, prev - transferRate));
                   setWageValue(prev => Math.min(100, prev + transferRate * 0.3)); 
              }

              if (attractionFactor >= 0.95) {
                  triggerFusion();
              }

              if (Math.random() > 0.1) {
                  spawnSparks(window.innerWidth/2, window.innerHeight/2, 'RED', 1, 0.5);
              }
          } else {
              setAttractionFactor(prev => Math.max(0, prev - 2.0 * dtSeconds));
          }
      } else if (isFused && !gameOver) {
          if (leftArrowPressed) {
              setUnifiedValue(prev => {
                const next = prev + 100 * dtSeconds; 
                if (next > UNIFIED_MAX_THRESHOLD && !gameOver) {
                    triggerAscension();
                }
                return next;
            });
            if (Math.random() > 0.05) {
                spawnSparks(window.innerWidth/2, window.innerHeight/2, 'UNIFIED', 2, 1.5);
            }
          }
      }

      // Physics Update
      particlesRef.current = particlesRef.current.map(p => {
          let newVx = p.vx * 0.95; 
          let newVy = p.vy + GRAVITY * dtSeconds;
          
          return {
            ...p,
            x: p.x + newVx * dtSeconds,
            y: p.y + newVy * dtSeconds,
            vx: newVx,
            vy: newVy,
            // Slightly slower life decay for clearer trails
            life: p.life - dtSeconds * (p.color === '#71717a' ? 0.4 : 1.2)
          };
      }).filter(p => p.life > 0);

      // CANVAS RENDER
      const canvas = canvasRef.current;
      if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.lineCap = 'round';
              ctx.globalCompositeOperation = 'lighter';

              particlesRef.current.forEach(p => {
                  ctx.lineWidth = p.size;
                  ctx.globalAlpha = p.life;
                  ctx.strokeStyle = p.color;
                  ctx.beginPath();
                  ctx.moveTo(p.x, p.y);
                  const trailLen = 0.035; // Slightly longer trail for impact
                  ctx.lineTo(p.x - p.vx * trailLen, p.y - p.vy * trailLen);
                  ctx.stroke();
              });

              ctx.globalCompositeOperation = 'source-over';
              ctx.globalAlpha = 1;
          }
      }

  }, !gameOver || isLiberated);

  const triggerFusion = () => {
      setIsFused(true);
      setUnifiedValue(wageValue * 10 + capitalValue); 
      setImpactTrigger(prev => prev + 20); 
      spawnSparks(window.innerWidth/2, window.innerHeight/2, 'UNIFIED', 70, 3.0);
      playSound('sfx_level3_burn', 1.0); // Big burn sound on fusion
  };

  const triggerAscension = () => {
      setIsLiberated(true);
      setImpactTrigger(prev => prev + 50); 
      spawnSparks(window.innerWidth/2, window.innerHeight/2, 'UNIFIED', 30, 4.0); 
      setTimeout(() => setGameOver(true), 4000);
  };

  const alienation = Math.min(1, Math.max(0, (totalClicks - CLICK_DECAY_START) / (CLICK_DECAY_END - CLICK_DECAY_START)));
  
  // --- VISUAL CALCULATIONS ---
  const wageBarColor = isFused ? '#ffffff' : (leftArrowPressed ? '#ef4444' : (alienation > 0.8 ? '#27272a' : '#10b981'));
  
  let capitalBarColor = '#f59e0b';
  if (isFused) {
      capitalBarColor = '#ffffff';
  } else if (leftArrowPressed) {
      capitalBarColor = '#ef4444'; 
  } else {
      const fadeStart = 150;
      const fadeEnd = 500;
      if (capitalValue > fadeStart) {
          const t = Math.min(1, (capitalValue - fadeStart) / (fadeEnd - fadeStart));
          capitalBarColor = lerpColor('#f59e0b', '#ffffff', t);
      }
  }

  const attractionOffset = attractionFactor * 40; 
  const zoomLevel = Math.max(0.7, 1 - (capitalValue / 1000));
  const capitalHeightPercent = Math.min(100, capitalValue);
  const capitalWidthPercent = Math.min(100, 15 + (capitalValue / CAPITAL_MAX_THRESHOLD) * 85);
  const unifiedWidthPercent = Math.min(100, (unifiedValue / UNIFIED_MAX_THRESHOLD) * 100);

  return (
    <div className="relative w-full h-full bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
        <canvas 
            ref={canvasRef}
            className="absolute inset-0 z-30 pointer-events-none"
        />

        <motion.div 
            className="w-full h-full relative z-10 origin-center transition-transform duration-1000 ease-out"
            style={{ transform: `scale(${zoomLevel})` }}
        >
            <AnimatePresence>
            {!isFused && (
                <motion.div 
                    className="absolute bottom-12 top-12 w-12 md:w-24 flex flex-col justify-end items-center z-10"
                    style={{ left: '5%' }}
                    animate={{ x: `${attractionOffset}vw` }}
                    transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                    exit={{ opacity: 0, scale: 0 }}
                >
                    <motion.div 
                        className="w-full rounded-t-sm"
                        style={{ backgroundColor: wageBarColor }}
                        animate={{ 
                            height: `${wageValue}%`,
                            y: spacePressed && !leftArrowPressed ? 20 : 0, 
                        }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    />
                </motion.div>
            )}
            </AnimatePresence>

             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40">
                <AnimatePresence>
                    {impactTrigger > 0 && (
                        <motion.div 
                            key={impactTrigger}
                            className="rounded-full border-4 border-white/40"
                            initial={{ width: 0, height: 0, opacity: 1, borderWidth: '10px' }}
                            animate={{ width: 300, height: 300, opacity: 0, borderWidth: '0px' }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                        />
                    )}
                </AnimatePresence>
             </div>

            <AnimatePresence>
            {!isFused && (
                <motion.div 
                    className="absolute bottom-0 top-0 flex flex-col justify-end items-end z-20"
                    style={{ 
                        right: '0%', 
                        width: `${capitalWidthPercent}%`,
                        paddingRight: 'max(3rem, 5vw)'
                    }}
                    animate={{ x: `-${attractionOffset}vw` }}
                    transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                    exit={{ opacity: 0, scale: 0 }}
                >
                    <motion.div 
                        className="w-full max-w-full rounded-tl-lg"
                        style={{ 
                            backgroundColor: capitalBarColor,
                            boxShadow: capitalValue > 250 ? "0 0 100px rgba(255,255,255,0.2)" : "none"
                        }}
                        animate={{ 
                            height: `${capitalHeightPercent}%`,
                            scaleY: spacePressed && !leftArrowPressed ? 1.02 : 1, 
                            y: spacePressed && !leftArrowPressed ? 5 : 0,
                        }}
                        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                    >
                         <div className="w-full h-full opacity-30 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMDAwIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] " />
                    </motion.div>
                </motion.div>
            )}
            </AnimatePresence>

            <AnimatePresence>
                {isFused && (
                    <motion.div 
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col justify-end items-center z-30 w-32 md:w-64"
                        initial={{ height: '0%', opacity: 0 }}
                        animate={{ height: '100%', opacity: 1 }}
                        transition={{ duration: 0.5 }}
                    >
                        <motion.div 
                            className="w-full rounded-t-lg bg-white"
                            style={{ 
                                boxShadow: "0 0 100px rgba(251, 191, 36, 0.5), 0 0 30px rgba(239,68,68,0.5)"
                            }}
                            animate={{ 
                                height: `${unifiedWidthPercent}%`,
                                width: `${100 + unifiedWidthPercent}%`,
                                scaleY: spacePressed || leftArrowPressed ? 1.02 : 1,
                            }}
                        >
                            <div className="w-full h-full opacity-50 bg-gradient-to-t from-red-500 via-amber-400 to-white" />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </motion.div>

        <AnimatePresence>
            {gameOver && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 2 }}
                    className={`absolute inset-0 z-50 flex items-center justify-center ${isLiberated ? 'bg-white' : 'bg-black'}`}
                />
            )}
        </AnimatePresence>
    </div>
  );
};
