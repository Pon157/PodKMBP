import React from 'react';
import { motion } from 'motion/react';

interface AnimatedCloudProps {
  className?: string;
  size?: number;
  delay?: number;
}

export const AnimatedCloud: React.FC<AnimatedCloudProps> = ({
  className = '',
  size = 120,
  delay = 0,
}) => {
  return (
    <motion.div
      className={`pointer-events-none drop-shadow-md select-none ${className}`}
      initial={{ x: -10, y: 0 }}
      animate={{
        x: [0, 15, -15, 0],
        y: [0, -10, 10, 0],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: delay,
      }}
      style={{ width: size, height: size * 0.6 }}
    >
      <svg viewBox="0 0 100 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Soft pink / gummy colored fluffy cloud */}
        <path
          d="M20 40 C10 40 5 30 15 20 C10 10 25 5 35 15 C45 0 65 0 75 15 C85 5 95 15 90 25 C100 35 85 45 75 40 C65 50 35 50 20 40 Z"
          fill="#FBAFD5"
          opacity="0.85"
          stroke="#6A0D28"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        {/* Inner shadow highlighting cloud fluff */}
        <path
          d="M30 43 C40 45 60 45 70 38"
          stroke="#6A0D28"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.5"
        />
      </svg>
    </motion.div>
  );
};

interface AnimatedFlowerProps {
  className?: string;
  size?: number;
  delay?: number;
}

export const AnimatedFlower: React.FC<AnimatedFlowerProps> = ({
  className = '',
  size = 60,
  delay = 0,
}) => {
  return (
    <motion.div
      className={`pointer-events-none drop-shadow-sm select-none ${className}`}
      animate={{
        rotate: [0, 15, -15, 0],
        scale: [1, 1.05, 0.95, 1],
      }}
      transition={{
        duration: 6,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: delay,
      }}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* 5 Petals */}
        <circle cx="50" cy="25" r="18" fill="#FBAFD5" stroke="#6A0D28" strokeWidth="4" />
        <circle cx="75" cy="43" r="18" fill="#FBAFD5" stroke="#6A0D28" strokeWidth="4" />
        <circle cx="65" cy="72" r="18" fill="#FBAFD5" stroke="#6A0D28" strokeWidth="4" />
        <circle cx="35" cy="72" r="18" fill="#FBAFD5" stroke="#6A0D28" strokeWidth="4" />
        <circle cx="25" cy="43" r="18" fill="#FBAFD5" stroke="#6A0D28" strokeWidth="4" />

        {/* Center / Core */}
        <circle cx="50" cy="50" r="16" fill="#6A0D28" stroke="#FBAFD5" strokeWidth="3" />
        {/* Detail lines inside core */}
        <circle cx="50" cy="50" r="6" fill="#FBAFD5" opacity="0.6" />
      </svg>
    </motion.div>
  );
};
