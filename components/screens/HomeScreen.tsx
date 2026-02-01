
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKeyPress } from '../../hooks/useKeyPress';

interface HomeScreenProps {
  onStart: () => void;
  onGMMode?: () => void;
  isAwakened?: boolean;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onStart, onGMMode, isAwakened = false }) => {
  const spacePressed = useKeyPress(' ');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // The reflected text changes if the player is Awakened
  const reflectionText = isAwakened ? "MAKS" : "MASK";

  useEffect(() => {
    if (spacePressed && !isTransitioning) {
        setIsTransitioning(true);
        
        // Wait 2 seconds for the "fade to black" animation before starting
        setTimeout(() => {
            onStart();
        }, 2000);
    }
  }, [spacePressed, isTransitioning, onStart]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-zinc-950 overflow-hidden">
      
      {/* GM Mode Button (Top Left) */}
      <button 
        onClick={(e) => {
            e.stopPropagation();
            onGMMode && onGMMode();
        }}
        className="absolute top-8 left-8 text-zinc-800 hover:text-zinc-500 font-mono text-xs z-50 transition-colors uppercase tracking-widest"
      >
        [ GM_MODE ]
      </button>

      {/* SVG Filters Definition */}
      <svg className="absolute w-0 h-0">
        <defs>
            {/* Sky Flow Filter: Vertical noise + horizontal drift */}
            <filter id="sky-flow">
                <feTurbulence type="fractalNoise" baseFrequency="0.01 0.05" numOctaves="3" result="noise">
                    <animate attributeName="baseFrequency" values="0.01 0.05;0.01 0.08;0.01 0.05" dur="10s" repeatCount="indefinite" />
                </feTurbulence>
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="20" xChannelSelector="R" yChannelSelector="G" />
                <feGaussianBlur stdDeviation="2" />
            </filter>

            {/* Water Ripple Filter: Larger scale noise + displacement */}
            <filter id="water-ripple">
                <feTurbulence type="turbulence" baseFrequency="0.02 0.05" numOctaves="2" result="turbulence">
                    <animate attributeName="baseFrequency" values="0.02 0.05; 0.02 0.09; 0.02 0.05" dur="8s" repeatCount="indefinite" />
                </feTurbulence>
                <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="15" xChannelSelector="R" yChannelSelector="G" />
            </filter>
        </defs>
      </svg>

      {/* Background Ambient Elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-white rounded-full opacity-20 animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] border border-white rounded-full opacity-10" />
      </div>

      {/* Main Title with Mirror Effect */}
      <div className="relative z-10 flex flex-col items-center gap-4 group mb-16">
        
        {/* Top Reflection (Sky) */}
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ 
              opacity: isTransitioning ? 0 : 0.15, 
              y: 0 
          }}
          transition={{ 
              duration: isTransitioning ? 0.8 : 2, 
              delay: isTransitioning ? 1.0 : 0.5 // Delay until center text is gone
          }}
          style={{ filter: 'url(#sky-flow)' }}
          className="text-6xl md:text-9xl font-black tracking-widest text-cyan-200 scale-y-[-1] select-none pointer-events-none"
        >
          {reflectionText}
        </motion.h1>

        {/* Main Text */}
        <motion.h1 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ 
              opacity: 1, 
              scale: 1,
              color: isTransitioning ? '#0a0a0a' : '#ffffff' // Fades to background black
          }}
          transition={{ 
              duration: isTransitioning ? 1.0 : 1.5, // Faster fade for center
              ease: "easeInOut"
          }}
          className="text-6xl md:text-9xl font-black tracking-widest text-white select-none mix-blend-difference z-20"
        >
          MASK
        </motion.h1>

        {/* Bottom Reflection (Water) */}
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ 
              opacity: isTransitioning ? 0 : 0.15, 
              y: 0 
          }}
          transition={{ 
              duration: isTransitioning ? 0.8 : 2, 
              delay: isTransitioning ? 1.0 : 0.5 // Delay until center text is gone
          }}
          style={{ filter: 'url(#water-ripple)' }}
          className="text-6xl md:text-9xl font-black tracking-widest text-blue-200 scale-y-[-1] select-none pointer-events-none origin-top"
        >
          {reflectionText}
        </motion.h1>
      </div>

      {/* Spacebar Interaction UI */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-16 flex flex-col items-center gap-4 z-20"
      >
         <div className="relative">
             
            {/* The Ripple Effect (Triggers on Transition Start) */}
            <AnimatePresence>
                {isTransitioning && (
                    <>
                         {/* Large expanding ripple */}
                        <motion.div 
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20"
                            initial={{ width: 300, height: 60, opacity: 1 }}
                            animate={{ width: 800, height: 160, opacity: 0 }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                        />
                         {/* Secondary ripple */}
                        <motion.div 
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10"
                            initial={{ width: 300, height: 60, opacity: 0.5 }}
                            animate={{ width: 600, height: 120, opacity: 0 }}
                            transition={{ duration: 1.2, delay: 0.1, ease: "easeOut" }}
                        />
                    </>
                )}
            </AnimatePresence>

            {/* The Physical Key UI (Matches Level 1 Style) */}
            <motion.div 
                className={`
                    relative w-72 h-14 rounded-lg 
                    bg-zinc-900 border-2 
                    shadow-[0_10px_0_rgb(24,24,27)] 
                    flex items-center justify-center
                    overflow-hidden
                    transition-colors duration-300
                    cursor-pointer
                `}
                style={{
                    borderColor: 'rgb(82, 82, 91)'
                }}
                animate={spacePressed ? { 
                    y: 8, 
                    boxShadow: "0px 2px 0px rgb(24,24,27)", 
                    scale: 0.98 
                } : { 
                    y: 0, 
                    boxShadow: "0px 10px 0px rgb(24,24,27)",
                    scale: 1,
                    transition: { duration: 0.05 }
                }}
            >
                {/* Key Top Detail */}
                <div className="absolute inset-x-0 top-0 h-[2px] bg-white/20" />
                <div className="w-12 h-1 rounded-full bg-zinc-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" />
                
                {/* Press Highlight */}
                <motion.div 
                    className="absolute inset-0 bg-white/30"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: spacePressed ? 1 : 0 }}
                    transition={{ duration: 0.05 }}
                />

                {/* Text Label */}
                <span className="absolute bottom-2 text-[10px] text-zinc-600 tracking-widest font-mono">SPACE TO START</span>
            </motion.div>

            {/* Prompt Glow Behind */}
            <motion.div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-20 bg-white/5 rounded-full blur-xl -z-10"
                animate={{ opacity: isTransitioning ? 0 : [0.2, 0.5, 0.2] }}
                transition={{ duration: 3, repeat: Infinity }}
            />
         </div>
      </motion.div>

    </div>
  );
};
