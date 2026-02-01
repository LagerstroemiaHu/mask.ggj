
import React, { createContext, useContext, useRef, useEffect, useCallback } from 'react';
import { AudioKey } from '../types';

// Map keys to actual file paths (assuming they are in public/audio/)
const AUDIO_MANIFEST: Record<AudioKey, string> = {
  'bgm_level1_routine': '/audio/bgm_level1_routine.mp3',
  'bgm_level1_resistance': '/audio/bgm_level1_resistance.mp3',
  'bgm_level2_factory': '/audio/bgm_level2_factory.mp3',
  'bgm_level2_revolution': '/audio/bgm_level2_revolution.mp3',
  'sfx_level2_tap_1': '/audio/sfx_level2_tap_1.mp3',
  'sfx_level2_tap_2': '/audio/sfx_level2_tap_2.mp3',
  'bgm_level3_capital': '/audio/bgm_level3_capital.mp3',
  'bgm_level3_resistance': '/audio/bgm_level3_resistance.mp3',
  'sfx_level3_coin': '/audio/sfx_level3_coin.mp3',
  'sfx_level3_burn': '/audio/sfx_level3_burn.mp3',
  'sfx_level3_drain': '/audio/sfx_level3_drain.mp3',
  'bgm_level4_mall': '/audio/bgm_level4_mall.mp3',
  'bgm_level4_resistance': '/audio/bgm_level4_resistance.mp3',
  'sfx_level4_buy': '/audio/sfx_level4_buy.mp3',
  'bgm_level5_epiphany': '/audio/bgm_level5_epiphany.mp3',
};

interface AudioContextType {
  playTrack: (key: AudioKey, options?: { loop?: boolean; volume?: number; fadeDuration?: number }) => void;
  stopTrack: (key: AudioKey, options?: { fadeDuration?: number }) => void;
  setTrackVolume: (key: AudioKey, volume: number, fadeDuration?: number) => void; // fadeDuration in ms
  playSound: (key: AudioKey, volume?: number) => void; // For one-shot SFX
  stopAll: () => void;
}

const AudioContext = createContext<AudioContextType | null>(null);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRefs = useRef<Map<AudioKey, HTMLAudioElement>>(new Map());
  const fadeIntervals = useRef<Map<AudioKey, number>>(new Map());

  // Helper to get or create audio element
  const getAudio = useCallback((key: AudioKey): HTMLAudioElement => {
    if (!audioRefs.current.has(key)) {
      const audio = new Audio(AUDIO_MANIFEST[key]);
      audio.preload = 'auto';
      audioRefs.current.set(key, audio);
    }
    return audioRefs.current.get(key)!;
  }, []);

  // Clear any active fade interval for a track
  const clearFade = useCallback((key: AudioKey) => {
    if (fadeIntervals.current.has(key)) {
      clearInterval(fadeIntervals.current.get(key));
      fadeIntervals.current.delete(key);
    }
  }, []);

  const setTrackVolume = useCallback((key: AudioKey, targetVolume: number, fadeDuration: number = 0) => {
    const audio = getAudio(key);
    // Clamp target
    const safeTarget = Math.max(0, Math.min(1, targetVolume));

    clearFade(key);

    if (fadeDuration <= 0) {
      audio.volume = safeTarget;
      return;
    }

    const startVolume = audio.volume;
    const diff = safeTarget - startVolume;
    const steps = 20; // Update 20 times within the duration
    const stepTime = fadeDuration / steps;
    const volumeStep = diff / steps;
    let currentStep = 0;

    const intervalId = window.setInterval(() => {
      currentStep++;
      const newVolume = startVolume + (volumeStep * currentStep);
      
      // Safety check
      audio.volume = Math.max(0, Math.min(1, newVolume));

      if (currentStep >= steps) {
        audio.volume = safeTarget; // Ensure exact end value
        clearFade(key);
      }
    }, stepTime);

    fadeIntervals.current.set(key, intervalId);
  }, [getAudio, clearFade]);

  const playTrack = useCallback((key: AudioKey, options: { loop?: boolean; volume?: number; fadeDuration?: number } = {}) => {
    const audio = getAudio(key);
    const { loop = true, volume = 1, fadeDuration = 0 } = options;

    audio.loop = loop;
    
    // If starting from silence or stopped, reset volume to 0 for fade in
    if (fadeDuration > 0 && audio.paused) {
        audio.volume = 0;
    } else if (audio.paused) {
        audio.volume = volume;
    }

    // Attempt to play (browser autoplay policies might block this if no interaction yet)
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.warn(`Audio play blocked for ${key}:`, error);
      });
    }

    if (fadeDuration > 0) {
      setTrackVolume(key, volume, fadeDuration);
    } else {
      audio.volume = volume;
    }
  }, [getAudio, setTrackVolume]);

  const playSound = useCallback((key: AudioKey, volume: number = 1) => {
      // For SFX, we want to allow rapid firing.
      // We clone the node to allow overlapping sounds (e.g. rapid spacebar taps).
      // If we used the single cached node, it would cut off the previous sound.
      if (AUDIO_MANIFEST[key]) {
          const baseAudio = getAudio(key);
          const clone = baseAudio.cloneNode() as HTMLAudioElement;
          clone.volume = Math.max(0, Math.min(1, volume));
          
          const playPromise = clone.play();
          if (playPromise !== undefined) {
              playPromise.catch(() => {});
          }
          
          // Cleanup clone after it finishes to prevent memory leak
          clone.onended = () => {
              clone.remove();
          };
      }
  }, [getAudio]);

  const stopTrack = useCallback((key: AudioKey, options: { fadeDuration?: number } = {}) => {
    const audio = audioRefs.current.get(key);
    if (!audio) return;
    
    const { fadeDuration = 0 } = options;

    if (fadeDuration > 0) {
      setTrackVolume(key, 0, fadeDuration);
      // We need to actually pause it after the fade. 
      // This simple implementation might leave it playing at 0 volume until next play call.
      // But to be clean:
      setTimeout(() => {
          if (audio.volume === 0) {
            audio.pause();
            audio.currentTime = 0;
          }
      }, fadeDuration + 50);
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [setTrackVolume]);

  const stopAll = useCallback(() => {
    audioRefs.current.forEach((audio, key) => {
      clearFade(key);
      audio.pause();
      audio.currentTime = 0;
    });
  }, [clearFade]);

  // Preload all on mount
  useEffect(() => {
    Object.keys(AUDIO_MANIFEST).forEach(k => getAudio(k as AudioKey));
    return () => stopAll();
  }, [getAudio, stopAll]);

  return (
    <AudioContext.Provider value={{ playTrack, stopTrack, setTrackVolume, playSound, stopAll }}>
      {children}
    </AudioContext.Provider>
  );
};
