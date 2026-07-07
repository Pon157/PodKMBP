import React from 'react';
import { motion } from 'motion/react';

interface MascotProps {
  pose?: 'neutral' | 'lying' | 'pointing-left' | 'pointing-right' | 'greeting' | 'thinking';
  className?: string;
  size?: number;
}

export const MascotPlaceholder: React.FC<MascotProps> = ({
  pose = 'neutral',
  className = '',
  size = 200,
}) => {
  // Let's render a custom, extremely charming SVG Mascot utilizing wine (#6A0D28) and gummy (#FBAFD5) colors.
  // The mascot is a cute cosmic bunny/cat creature with long ears, starry cheeks, and expressive eyes.
  
  const getPoseAnimation = () => {
    switch (pose) {
      case 'lying':
        return {
          y: [4, -4, 4],
          rotate: [0, 1, -1, 0],
          transition: { repeat: Infinity, duration: 4, ease: 'easeInOut' }
        };
      case 'pointing-left':
        return {
          x: [-2, 2, -2],
          transition: { repeat: Infinity, duration: 3, ease: 'easeInOut' }
        };
      case 'pointing-right':
        return {
          x: [2, -2, 2],
          transition: { repeat: Infinity, duration: 3, ease: 'easeInOut' }
        };
      case 'greeting':
        return {
          scale: [1, 1.03, 1],
          y: [0, -6, 0],
          transition: { repeat: Infinity, duration: 3.5, ease: 'easeInOut' }
        };
      case 'thinking':
        return {
          rotate: [-2, 2, -2],
          y: [0, -3, 0],
          transition: { repeat: Infinity, duration: 5, ease: 'easeInOut' }
        };
      default:
        return {
          y: [-5, 5, -5],
          transition: { repeat: Infinity, duration: 4, ease: 'easeInOut' }
        };
    }
  };

  return (
    <motion.div
      className={`relative select-none flex items-center justify-center ${className}`}
      animate={getPoseAnimation()}
      style={{ width: size, height: size }}
    >
      {/* Soft purple/violet-to-white gradient glow behind the mascot */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.25)_0%,rgba(255,255,255,0.1)_50%,transparent_100%)] blur-2xl rounded-full -z-10 w-full h-full scale-125 pointer-events-none" />
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-lg"
      >
        {/* Shadow under mascot */}
        <ellipse cx="100" cy="180" rx="60" ry="10" fill="#4A0518" opacity="0.4" />

        {/* Mascot Body & Pose specific structures */}
        {pose === 'lying' ? (
          <>
            {/* Lying pose body */}
            <path d="M40 140 C 40 100, 160 100, 160 140 C 160 160, 40 160, 40 140 Z" fill="#FBAFD5" stroke="#6A0D28" strokeWidth="6" />
            <ellipse cx="60" cy="155" rx="15" ry="10" fill="#FBAFD5" stroke="#6A0D28" strokeWidth="5" />
            <ellipse cx="140" cy="155" rx="15" ry="10" fill="#FBAFD5" stroke="#6A0D28" strokeWidth="5" />
            {/* Tail */}
            <path d="M35 135 C 20 120, 15 140, 20 150" stroke="#6A0D28" strokeWidth="6" strokeLinecap="round" />
            {/* Lying head */}
            <circle cx="100" cy="90" r="45" fill="#FBAFD5" stroke="#6A0D28" strokeWidth="6" />
          </>
        ) : (
          <>
            {/* Standing body */}
            <path d="M70 120 C 70 95, 130 95, 130 120 L 140 170 C 140 175, 60 175, 60 170 Z" fill="#FBAFD5" stroke="#6A0D28" strokeWidth="6" />
            
            {/* Feet */}
            <ellipse cx="80" cy="172" rx="16" ry="10" fill="#FBAFD5" stroke="#6A0D28" strokeWidth="5" />
            <ellipse cx="120" cy="172" rx="16" ry="10" fill="#FBAFD5" stroke="#6A0D28" strokeWidth="5" />

            {/* Arms / Hands */}
            {pose === 'pointing-left' ? (
              <>
                {/* Left arm pointing left */}
                <path d="M68 115 C 30 105, 30 95, 35 90" stroke="#6A0D28" strokeWidth="7" strokeLinecap="round" fill="none" />
                <circle cx="33" cy="92" r="8" fill="#FBAFD5" stroke="#6A0D28" strokeWidth="5" />
                {/* Right arm resting */}
                <path d="M130 115 C 145 130, 135 145, 125 145" stroke="#6A0D28" strokeWidth="6" strokeLinecap="round" fill="none" />
              </>
            ) : pose === 'pointing-right' ? (
              <>
                {/* Left arm resting */}
                <path d="M70 115 C 55 130, 65 145, 75 145" stroke="#6A0D28" strokeWidth="6" strokeLinecap="round" fill="none" />
                {/* Right arm pointing right */}
                <path d="M132 115 C 170 105, 170 95, 165 90" stroke="#6A0D28" strokeWidth="7" strokeLinecap="round" fill="none" />
                <circle cx="167" cy="92" r="8" fill="#FBAFD5" stroke="#6A0D28" strokeWidth="5" />
              </>
            ) : pose === 'greeting' ? (
              <>
                {/* Left arm waving */}
                <path d="M68 115 C 50 100, 45 80, 55 65" stroke="#6A0D28" strokeWidth="7" strokeLinecap="round" fill="none" />
                <circle cx="55" cy="65" r="9" fill="#FBAFD5" stroke="#6A0D28" strokeWidth="5" />
                {/* Right arm resting */}
                <path d="M130 115 C 145 130, 135 145, 125 145" stroke="#6A0D28" strokeWidth="6" strokeLinecap="round" fill="none" />
              </>
            ) : (
              <>
                {/* Default arms resting */}
                <path d="M68 115 C 50 130, 60 145, 70 145" stroke="#6A0D28" strokeWidth="6" strokeLinecap="round" fill="none" />
                <path d="M132 115 C 150 130, 140 145, 130 145" stroke="#6A0D28" strokeWidth="6" strokeLinecap="round" fill="none" />
              </>
            )}

            {/* Standing Head */}
            <circle cx="100" cy="78" r="45" fill="#FBAFD5" stroke="#6A0D28" strokeWidth="6" />
          </>
        )}

        {/* --- Shared Head details (Ears, Face, Eyes) --- */}
        {/* Ears */}
        {/* Left Ear */}
        <path d="M70 48 C 50 10, 30 20, 62 40" fill="#FBAFD5" stroke="#6A0D28" strokeWidth="6" strokeLinecap="round" />
        <path d="M65 42 C 53 18, 41 24, 60 36" fill="#6A0D28" opacity="0.3" />

        {/* Right Ear */}
        <path d="M130 48 C 150 10, 170 20, 138 40" fill="#FBAFD5" stroke="#6A0D28" strokeWidth="6" strokeLinecap="round" />
        <path d="M135 42 C 147 18, 159 24, 140 36" fill="#6A0D28" opacity="0.3" />

        {/* Face coordinates anchor: cx=100, cy= (pose === 'lying' ? 90 : 78) */}
        {/* Let's define dynamic Y offset based on pose */}
        {(() => {
          const fy = pose === 'lying' ? 92 : 80;
          return (
            <>
              {/* Star / Sparkle cheeks (strictly NO EMOJIS, pure vector graphics!) */}
              {/* Left Star Cheek */}
              <path d={`M ${73} ${fy + 8} L ${75} ${fy + 5} L ${78} ${fy + 8} L ${75} ${fy + 11} Z`} fill="#6A0D28" opacity="0.5" />
              {/* Right Star Cheek */}
              <path d={`M ${123} ${fy + 8} L ${125} ${fy + 5} L ${128} ${fy + 8} L ${125} ${fy + 11} Z`} fill="#6A0D28" opacity="0.5" />

              {/* Eyes */}
              {pose === 'thinking' ? (
                <>
                  {/* Thinking eyes: one squiggly or wink */}
                  <path d={`M 78 ${fy - 3} Q 85 ${fy - 8} 92 ${fy - 3}`} stroke="#6A0D28" strokeWidth="5" strokeLinecap="round" fill="none" />
                  <circle cx="114" cy={fy - 3} r="6" fill="#6A0D28" />
                </>
              ) : (
                <>
                  {/* Animated blinking pupils */}
                  <motion.circle
                    cx="84"
                    cy={fy - 3}
                    fill="#6A0D28"
                    animate={{ scaleY: [1, 0.1, 1] }}
                    transition={{ repeat: Infinity, duration: 4, times: [0, 0.05, 0.1], repeatDelay: 3 }}
                    style={{ transformOrigin: `84px ${fy - 3}px` }}
                    r="6.5"
                  />
                  <motion.circle
                    cx="116"
                    cy={fy - 3}
                    fill="#6A0D28"
                    animate={{ scaleY: [1, 0.1, 1] }}
                    transition={{ repeat: Infinity, duration: 4, times: [0, 0.05, 0.1], repeatDelay: 3 }}
                    style={{ transformOrigin: `116px ${fy - 3}px` }}
                    r="6.5"
                  />
                  {/* Eye shines */}
                  <circle cx="82" cy={fy - 5} r="2" fill="white" />
                  <circle cx="114" cy={fy - 5} r="2" fill="white" />
                </>
              )}

              {/* Nose */}
              <polygon points={`${97},${fy + 3} ${103},${fy + 3} ${100},${fy + 6}`} fill="#6A0D28" />

              {/* Mouth */}
              <path d={`M 92 ${fy + 10} Q 96 ${fy + 14} 100 ${fy + 10} Q 104 ${fy + 14} 108 ${fy + 10}`} stroke="#6A0D28" strokeWidth="4.5" strokeLinecap="round" fill="none" />
            </>
          );
        })()}
      </svg>
      {/* Decorative sparkle tags to enrich branding */}
      <div className="absolute top-2 right-2 w-3 h-3 bg-gummy rounded-full animate-ping opacity-75" />
    </motion.div>
  );
};
