import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface TransitionScreenProps {
  onComplete: () => void;
}

export const TransitionScreen: React.FC<TransitionScreenProps> = ({ onComplete }) => {
  // Auto-progress logic
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2500); // 2.5 seconds tunnel sequence
    return () => clearTimeout(timer);
  }, [onComplete]);

  // Generate a sequence of rectangles for the tunnel
  const rects = Array.from({ length: 15 }).map((_, i) => i);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden perspective-container">
      {rects.map((i) => (
        <motion.div
          key={i}
          className="absolute border border-white opacity-0"
          initial={{ 
            width: '20px', 
            height: '20px', 
            opacity: 0, 
            z: 0 
          }}
          animate={{ 
            width: '400vw', 
            height: '400vh', 
            opacity: [0, 1, 0], 
            rotate: i % 2 === 0 ? 10 : -10 // Slight chaotic twist
          }}
          transition={{
            duration: 2,
            delay: i * 0.1,
            ease: "easeIn",
            times: [0, 0.5, 1]
          }}
        />
      ))}
    </div>
  );
};
