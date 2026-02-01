
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameLoop } from '../../hooks/useGameLoop';
import { useKeyPress } from '../../hooks/useKeyPress';
import { ShapeRenderer } from '../ui/ShapeRenderer';
import { ShapeType } from '../../types';
import { useAudio } from '../../contexts/AudioContext';

interface Level4Props {
  onComplete: () => void;
}

interface FlyingItem {
  id: number;
  color: string;
  shape: ShapeType;
  targetY: number; // The Y position of the specific bar it goes to
}

interface SmallRipple {
    id: number;
}

// Config
const CATEGORIES = [
    { id: 0, color: '#06b6d4', shape: ShapeType.CIRCLE },   // Cyan
    { id: 1, color: '#f59e0b', shape: ShapeType.HEXAGON },  // Amber
    { id: 2, color: '#8b5cf6', shape: ShapeType.DIAMOND },  // Violet
];

const MAX_MARKET_WIDTH = 100; 
const MIN_MARKET_WIDTH = 0;
const INITIAL_NEED_CAPACITY = 30; 
const INITIAL_MARKET_WIDTH = 33.3; // 1/3 of screen

// Balancing for Longer Gameplay (~20 clicks)
const BUY_IMPACT = 2.5; // Reduced from 5.6 to 2.5
const RESISTANCE_POWER = 12; // Speed of pushing back wall
const PASSIVE_GROWTH_BASE = 0.5; // Very slow base crawl
const NEED_PRESSURE_FACTOR = 0.02; // How much needs accelerate growth

// Resistance Difficulty
const MAX_DEGRADE_SPEED = 2.0; // How fast we destroy the bars (Victory progress)
const CURRENT_DRAIN_SPEED = 15.0; // How fast we empty the current fill

export const Level4Consumerism: React.FC<Level4Props> = ({ onComplete }) => {
  // Audio
  const { playTrack, setTrackVolume, playSound, stopTrack } = useAudio();

  // --- State ---
  const [gameOver, setGameOver] = useState(false);
  const [isLiberated, setIsLiberated] = useState(false);
  
  // The Wall: Represents the divide between Market (Left) and Life (Right)
  const [marketWidth, setMarketWidth] = useState(INITIAL_MARKET_WIDTH); 
  
  // Needs Bars: { current: number, max: number }
  const [needs, setNeeds] = useState([
      { current: 10, max: INITIAL_NEED_CAPACITY }, // Start partially filled
      { current: 10, max: INITIAL_NEED_CAPACITY },
      { current: 10, max: INITIAL_NEED_CAPACITY },
  ]);

  // Products
  const [currentProduct, setCurrentProduct] = useState(CATEGORIES[0]);
  const productTimerRef = useRef(0);

  // Visual Effects
  const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);
  const nextFlyingId = useRef(0);
  
  // Resistance Visuals (New)
  const [resistanceLevel, setResistanceLevel] = useState(0); // 0 to 1 intensity
  const [smallRipples, setSmallRipples] = useState<SmallRipple[]>([]);
  const rippleIdCounter = useRef(0);
  const rippleTimerRef = useRef(0);

  // Particles
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<any[]>([]);
  
  // Inputs
  const spacePressed = useKeyPress(' ');
  const leftArrowPressed = useKeyPress('ArrowLeft');
  const spaceTriggerRef = useRef(false);

  // Init Audio
  useEffect(() => {
    // Play Mall BGM (Consumerism)
    playTrack('bgm_level4_mall', { volume: 0.8, loop: true, fadeDuration: 2000 });
    // Play Resistance BGM silently
    playTrack('bgm_level4_resistance', { volume: 0, loop: true });

    return () => {
        stopTrack('bgm_level4_mall', { fadeDuration: 1000 });
        stopTrack('bgm_level4_resistance', { fadeDuration: 1000 });
    };
  }, [playTrack, stopTrack]);

  // Handle BGM Crossfade based on Resistance (Left Arrow)
  useEffect(() => {
    if (gameOver || isLiberated) {
        setTrackVolume('bgm_level4_mall', 0, 2000);
        setTrackVolume('bgm_level4_resistance', 0, 2000);
        return;
    }

    if (leftArrowPressed) {
        setTrackVolume('bgm_level4_mall', 0, 500);
        setTrackVolume('bgm_level4_resistance', 1, 500);
    } else {
        setTrackVolume('bgm_level4_mall', 0.8, 500);
        setTrackVolume('bgm_level4_resistance', 0, 500);
    }
  }, [leftArrowPressed, setTrackVolume, gameOver, isLiberated]);

  // Ending Logic
  useEffect(() => {
    if (gameOver || isLiberated) {
        const timer = setTimeout(() => {
            onComplete();
        }, 4000);
        return () => clearTimeout(timer);
    }
  }, [gameOver, isLiberated, onComplete]);

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

  // --- Game Loop ---
  useGameLoop((deltaTime) => {
    if (gameOver && !isLiberated) return;
    const dtSeconds = deltaTime / 1000;

    // 0. Auto-Rotate Product (Every 1s)
    if (!isLiberated) {
        productTimerRef.current += deltaTime;
        if (productTimerRef.current > 1000) {
            rotateProduct();
            productTimerRef.current = 0;
        }
    }

    // 1. Victory/Defeat Check
    if (!isLiberated && !gameOver) {
        if (marketWidth >= 99) {
            setGameOver(true);
        }
        
        const totalNeedMax = needs.reduce((acc, n) => acc + n.max, 0);
        // Victory only if bars are basically gone AND market is pushed back
        if (totalNeedMax <= 1 && marketWidth < 5) {
            setIsLiberated(true);
            spawnParticles(window.innerWidth/2, window.innerHeight/2, '#ffffff', 100);
        }
    }

    if (isLiberated) {
        setMarketWidth(prev => Math.max(0, prev - 50 * dtSeconds));
        return; 
    }

    // 2. Input Handling (Space = Buy)
    if (spacePressed && !spaceTriggerRef.current) {
        spaceTriggerRef.current = true;
        buyProduct();
    }
    if (!spacePressed) {
        spaceTriggerRef.current = false;
    }

    // 3. Resistance Logic (Left Arrow)
    if (leftArrowPressed) {
        // Increase Resistance Visual Intensity
        setResistanceLevel(prev => Math.min(1, prev + dtSeconds * 1.5));

        // Spawn Small Ripples based on intensity
        // At level 0, no ripples. At level 1, fast ripples (every 100ms)
        rippleTimerRef.current += deltaTime;
        const rippleThreshold = 800 - (resistanceLevel * 700); // 800ms down to 100ms
        
        if (rippleTimerRef.current > rippleThreshold && resistanceLevel > 0.1) {
             setSmallRipples(prev => [...prev, { id: rippleIdCounter.current++ }]);
             rippleTimerRef.current = 0;
        }

        // Push the wall back
        setMarketWidth(prev => Math.max(MIN_MARKET_WIDTH, prev - RESISTANCE_POWER * dtSeconds));
        
        // Degrade Needs (Victory Progress)
        setNeeds(prev => prev.map(n => ({
            current: Math.max(0, n.current - CURRENT_DRAIN_SPEED * dtSeconds), 
            max: Math.max(0, n.max - MAX_DEGRADE_SPEED * dtSeconds)
        })));
        
        // Particles
        if (Math.random() > 0.8) {
             spawnParticles(window.innerWidth * (marketWidth/100), window.innerHeight/2, '#ffffff', 1);
        }

    } else {
        // Decay Resistance Visual Intensity
        setResistanceLevel(prev => Math.max(0, prev - dtSeconds * 3.0));

        // Passive Reversion
        const totalNeedPressure = needs.reduce((acc, n) => acc + n.max, 0);
        // Passive expansion based on needs
        const growthSpeed = PASSIVE_GROWTH_BASE + (totalNeedPressure * NEED_PRESSURE_FACTOR);
        
        if (marketWidth < MAX_MARKET_WIDTH) {
            setMarketWidth(prev => Math.min(MAX_MARKET_WIDTH, prev + growthSpeed * dtSeconds));
        }
    }

    updateParticles(dtSeconds);

  }, !gameOver);

  const rotateProduct = () => {
      setCurrentProduct(prev => {
          const nextId = (prev.id + 1) % 3;
          return CATEGORIES[nextId];
      });
  };

  const buyProduct = () => {
      // Audio
      playSound('sfx_level4_buy', 0.6);

      const catIndex = currentProduct.id;
      
      // 1. Hedonic Treadmill Update (Zeno's Paradox Logic)
      setNeeds(prev => {
          return prev.map((n, i) => {
              if (i === catIndex) {
                  // The bar gets physically longer (Growing void)
                  const growth = 8; 
                  const newMax = n.max + growth;

                  // But the satisfaction chases the max via Halving the Distance (Gap)
                  // Calculate the gap to the OLD max (or current perceived lack)
                  // And cut it in half.
                  const currentGap = n.max - n.current;
                  const newGap = Math.max(1, currentGap * 0.5); // Never 0, always a tiny gap left
                  
                  // The new current is the New Max minus that tiny gap
                  // This ensures visually: 75% -> 90% -> 95% -> 98%
                  const newCurrent = newMax - newGap;

                  return {
                      ...n,
                      current: newCurrent,
                      max: newMax 
                  };
              }
              return n;
          });
      });

      // 2. Push the Wall (Reduced impact)
      setMarketWidth(prev => Math.min(MAX_MARKET_WIDTH, prev + BUY_IMPACT));

      // 3. Spawn Visual Flow (Flying Item)
      const targetY = 32 + (catIndex * 30); 
      setFlyingItems(prev => [...prev, {
          id: nextFlyingId.current++,
          color: currentProduct.color,
          shape: currentProduct.shape,
          targetY: targetY
      }]);

      // 4. Force Rotate immediately
      rotateProduct();
      productTimerRef.current = 0; 
  };

  const removeFlyingItem = (id: number) => {
      setFlyingItems(prev => prev.filter(i => i.id !== id));
      spawnParticles(window.innerWidth/2, 50, '#ffffff', 5);
  };

  const removeSmallRipple = (id: number) => {
      setSmallRipples(prev => prev.filter(r => r.id !== id));
  };

  const spawnParticles = (x: number, y: number, color: string, count: number) => {
      for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 200 + 50;
          particlesRef.current.push({
              x, y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 1.0,
              color: color,
              size: Math.random() * 4 + 2
          });
      }
  };

  const updateParticles = (dt: number) => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      particlesRef.current = particlesRef.current.map(p => {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          return p;
      }).filter(p => p.life > 0);

      particlesRef.current.forEach(p => {
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
      });
  };

  // Determine Player Appearance
  // Green (#10b981) normally, Red (#ef4444) when resisting or liberated
  const playerColor = isLiberated ? '#ef4444' : (leftArrowPressed ? '#ef4444' : '#10b981');
  
  // Dynamic Scale
  // 1. Base scale depends on available space (shrink if crushed)
  const spaceFactor = Math.max(0.5, (100 - marketWidth) / 50);
  // 2. Resistance adds a bonus multiplier (pulsing bigger when holding key)
  // Max growth during resistance is 1.5x of the current spaceFactor
  const resistanceMultiplier = 1 + (resistanceLevel * 0.6); 

  const finalScale = isLiberated ? 2 : (spaceFactor * resistanceMultiplier);

  return (
    <div className="relative w-full h-full bg-white flex overflow-hidden">
        
        {/* TOP UI: NEEDS BARS */}
        <div className="absolute top-0 left-0 w-full p-8 z-50 flex flex-col items-center gap-4">
            {!isLiberated && needs.map((need, idx) => (
                <div key={idx} className="h-4 flex items-center justify-center transition-all duration-300" style={{ width: '60%' }}>
                    {/* The Bar Container grows with Max Need */}
                    <motion.div 
                        className="h-full bg-zinc-200 rounded-full relative overflow-hidden"
                        // Prevent width from jumping to 0 immediately when reduced. Minimum visual width of 2px
                        animate={{ width: `${Math.max(1, Math.min(100, need.max))}%` }} 
                        transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                    >
                         {/* The Fill represents satisfaction */}
                         <motion.div 
                            className="absolute left-0 top-0 bottom-0"
                            style={{ backgroundColor: CATEGORIES[idx].color }}
                            animate={{ width: `${(need.current / Math.max(1, need.max)) * 100}%` }}
                         />

                         {/* Resistance Overlay (Red from Right) */}
                         {/* Changed mix-blend to normal opacity to prevent "disappearing" glitch */}
                         <motion.div 
                            className="absolute right-0 top-0 bottom-0 bg-red-500 opacity-60"
                            initial={{ width: '0%' }}
                            animate={{ width: leftArrowPressed ? '100%' : '0%' }}
                            transition={{ duration: leftArrowPressed ? 2.0 : 0.2 }} 
                         />
                    </motion.div>
                </div>
            ))}
        </div>

        {/* FLYING ITEMS LAYER */}
        <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden">
            <AnimatePresence>
                {flyingItems.map(item => (
                    <motion.div
                        key={item.id}
                        initial={{ 
                            x: (window.innerWidth * (marketWidth / 100)) - 100, 
                            y: window.innerHeight / 2,
                            scale: 1,
                            opacity: 1
                        }}
                        animate={{ 
                            x: window.innerWidth / 2, 
                            y: item.targetY,
                            scale: 0.5,
                            opacity: 0
                        }}
                        transition={{ duration: 0.6, ease: "easeInOut" }}
                        onAnimationComplete={() => removeFlyingItem(item.id)}
                        className="absolute"
                    >
                        <ShapeRenderer 
                            type={item.shape}
                            color={item.color}
                            targetType={item.shape}
                            targetColor={item.color}
                            conformity={0}
                            size={40}
                        />
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>

        {/* LEFT SIDE: MARKET */}
        <motion.div 
            className="h-full bg-[#111] relative overflow-hidden flex flex-col items-center justify-center z-20 shadow-[10px_0_50px_rgba(0,0,0,0.5)]"
            animate={{ width: `${marketWidth}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        >
            {!isLiberated && (
                <div className="relative z-10 flex flex-col items-center gap-12">
                     <motion.div
                        key={currentProduct.id}
                        initial={{ scale: 0.8, opacity: 0, x: -50 }}
                        animate={{ scale: 1, opacity: 1, x: 0 }}
                        exit={{ scale: 0.8, opacity: 0, x: 50 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                     >
                         <ShapeRenderer 
                            type={currentProduct.shape}
                            color={currentProduct.color}
                            targetType={currentProduct.shape}
                            targetColor={currentProduct.color}
                            size={120}
                            conformity={0}
                            className="drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                         />
                     </motion.div>
                </div>
            )}
            
            <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IiMzMzMiLz48L3N2Zz4=')]"></div>
        </motion.div>

        {/* RIGHT SIDE: LIVING SPACE (Updated Visuals) */}
        <div className="flex-1 h-full bg-[#f0f0f0] relative flex items-center justify-center overflow-hidden">
             
             {/* SMALL RESISTANCE RIPPLES: Local rings pulsing out from player */}
             <AnimatePresence>
                 {smallRipples.map(ripple => (
                     <motion.div 
                        key={ripple.id}
                        className="absolute rounded-full border border-red-500/40"
                        initial={{ width: 32, height: 32, opacity: 0.8, borderWidth: '3px' }}
                        animate={{ width: 200, height: 200, opacity: 0, borderWidth: '0px' }}
                        transition={{ duration: 1.0, ease: "easeOut" }}
                        onAnimationComplete={() => removeSmallRipple(ripple.id)}
                        style={{ zIndex: 5 }}
                     />
                 ))}
             </AnimatePresence>

             {/* LIBERATION RIPPLES: Massive red rings when free (Distinct from small ones) */}
             <AnimatePresence>
                 {isLiberated && (
                    <>
                        {[0, 1, 2].map(i => (
                            <motion.div
                                key={i}
                                className="absolute rounded-full border border-red-500/50 bg-red-500/10"
                                initial={{ width: 0, height: 0, opacity: 1 }}
                                animate={{ width: '150vmax', height: '150vmax', opacity: 0 }}
                                transition={{ 
                                    duration: 2.5, 
                                    repeat: Infinity, 
                                    delay: i * 0.8,
                                    ease: "easeOut"
                                }}
                            />
                        ))}
                    </>
                 )}
             </AnimatePresence>

             {/* PLAYER BALL: Green by default, Red on resistance, Size scales */}
             <motion.div 
                className="w-8 h-8 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.2)] z-10"
                style={{ backgroundColor: playerColor }}
                animate={{ 
                    scale: finalScale,
                    opacity: 1
                }}
                transition={{ duration: 0.1 }} 
             />
             
             {isLiberated && (
                 <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5, duration: 2 }}
                    className="absolute text-zinc-400 font-mono text-xs tracking-[1em] uppercase z-20"
                 >
                     Enough
                 </motion.div>
             )}
        </div>

        {/* CANVAS LAYER (Particles) */}
        <canvas 
            ref={canvasRef}
            className="absolute inset-0 z-40 pointer-events-none"
        />

        {/* Game Over Overlay */}
        <AnimatePresence>
            {(gameOver || isLiberated) && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1 }}
                    className={`absolute inset-0 z-[100] flex items-center justify-center ${isLiberated ? 'bg-white' : 'bg-black'}`}
                />
            )}
        </AnimatePresence>

    </div>
  );
};
