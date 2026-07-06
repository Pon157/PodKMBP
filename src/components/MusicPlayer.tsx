import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Music, Volume2 } from 'lucide-react';
import { motion } from 'motion/react';

interface MusicPlayerProps {
  url: string;
  title?: string;
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({ url, title = 'Прикрепленная аудиозапись' }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Re-initialize audio if URL changes
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    audioRef.current = new Audio(url);
    audioRef.current.loop = true;
    
    // Listen for end of audio (though it is looping)
    const handleEnd = () => setIsPlaying(false);
    audioRef.current.addEventListener('ended', handleEnd);

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('ended', handleEnd);
      }
    };
  }, [url]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.log('Audio playback prevented', e));
      setIsPlaying(true);
    }
  };

  return (
    <div className="bg-wine-dark/60 border-2 border-gummy/30 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-wine flex items-center justify-center text-gummy border border-gummy/40">
          <Music size={18} className={isPlaying ? 'animate-spin' : ''} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gummy truncate">{title}</p>
          <p className="text-xs text-gummy/60 truncate">Превью аудиофайла</p>
        </div>
        <button
          id={`play-btn-${title.replace(/\s+/g, '-')}`}
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-gummy text-wine hover:bg-white transition-all flex items-center justify-center font-bold"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>
      </div>

      {/* Custom equalizer bar animation */}
      {isPlaying && (
        <div className="flex items-end justify-center gap-1.5 h-8 pt-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((bar) => (
            <motion.div
              key={bar}
              className="w-1 bg-gummy rounded-full"
              animate={{
                height: [
                  `${Math.random() * 40 + 10}%`,
                  `${Math.random() * 80 + 20}%`,
                  `${Math.random() * 30 + 10}%`,
                ],
              }}
              transition={{
                duration: 0.6 + Math.random() * 0.4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{ height: '30%' }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
