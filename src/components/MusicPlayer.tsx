import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Music } from 'lucide-react';
import { motion } from 'motion/react';

interface MusicPlayerProps {
  url: string;
  title?: string;
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({ url, title = 'Прикрепленная аудиозапись' }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // When url changes, reset state
    setIsPlaying(false);
    setError(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.load();
    }
  }, [url]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      setError(null);
      audioRef.current.play().catch((err) => {
        console.error('Audio playback error:', err);
        setError('Нажмите еще раз для воспроизведения');
        setIsPlaying(false);
      });
    }
  };

  return (
    <div className="bg-wine-dark/60 border-2 border-gummy/30 rounded-xl p-4 flex flex-col gap-3">
      {/* Native HTML5 Audio element for maximum compatibility (iOS Safari restriction friendly) */}
      <audio
        ref={audioRef}
        src={url}
        loop
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={(e) => {
          console.error('Audio file load error:', e);
          setError('Ошибка загрузки аудиофайла');
          setIsPlaying(false);
        }}
      />

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-wine flex items-center justify-center text-gummy border border-gummy/40">
          <Music size={18} className={isPlaying ? 'animate-spin' : ''} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gummy truncate">{title}</p>
          <p className="text-xs text-gummy/60 truncate">
            {error ? <span className="text-red-400 font-semibold">{error}</span> : 'Аудиозапись'}
          </p>
        </div>
        <button
          type="button"
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
