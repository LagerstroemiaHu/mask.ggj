import React from 'react';
import { motion } from 'framer-motion';
import { LEVELS } from '../../constants';
import { Lock } from 'lucide-react';

interface LevelSelectScreenProps {
  onSelectLevel: (levelId: number) => void;
}

export const LevelSelectScreen: React.FC<LevelSelectScreenProps> = ({ onSelectLevel }) => {
  return (
    <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center p-8">
      <motion.h2 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-bold tracking-tighter mb-12 text-zinc-100"
      >
        SELECT PROTOCOL
      </motion.h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
        {LEVELS.map((level, index) => (
          <motion.div
            key={level.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => !level.locked && onSelectLevel(level.id)}
            className={`
              relative aspect-square border border-zinc-800 p-6 flex flex-col justify-between
              transition-all duration-300 group
              ${level.locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-zinc-900 hover:border-white'}
            `}
          >
            <div className="flex justify-between items-start">
              <span className="text-4xl font-thin text-zinc-600 group-hover:text-zinc-200 transition-colors">
                0{level.id}
              </span>
              {level.locked && <Lock className="w-5 h-5 text-zinc-600" />}
            </div>
            
            <div>
              <h3 className="text-xl font-bold text-white mb-2">{level.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed font-mono">
                {level.description}
              </p>
            </div>

            {/* Hover Effect Corner */}
            {!level.locked && (
              <motion.div 
                className="absolute bottom-0 right-0 w-0 h-0 border-b-2 border-r-2 border-white"
                whileHover={{ width: '20px', height: '20px' }}
              />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};
