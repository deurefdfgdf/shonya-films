'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface PreloaderProps {
  onComplete: () => void;
}

const TITLE = 'ШОНЯ ФИЛЬМСЫ';

export default function Preloader({ onComplete }: PreloaderProps) {
  const [exiting, setExiting] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2200;
    const steps = 60;
    const interval = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * 100));

      if (step >= steps) {
        clearInterval(timer);
        setTimeout(() => setExiting(true), 200);
      }
    }, interval);

    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-[#0a0a0a]"
      animate={
        exiting
          ? { opacity: 0, y: -30 }
          : { opacity: 1, y: 0 }
      }
      transition={{ duration: 0.8, ease: [0.77, 0, 0.18, 1] }}
      onAnimationComplete={() => {
        if (exiting) onComplete();
      }}
    >
      {/* Counter — top right */}
      <motion.span
        className="absolute right-8 top-8 font-[var(--font-display)] text-[0.7rem] tabular-nums tracking-[0.2em] text-[var(--color-text-muted)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        {String(count).padStart(3, '0')}
      </motion.span>

      {/* Title — staggered character reveal */}
      <div className="flex flex-wrap justify-center gap-x-[0.06em] overflow-hidden px-6">
        {TITLE.split('').map((char, i) => (
          <motion.span
            key={i}
            className="display-title text-[clamp(3.5rem,12vw,9rem)] text-[var(--color-text)]"
            initial={{ y: '120%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            transition={{
              duration: 0.7,
              ease: [0.22, 1, 0.36, 1],
              delay: 0.15 + i * 0.04,
            }}
          >
            {char === ' ' ? '\u00A0' : char}
          </motion.span>
        ))}
      </div>

      {/* Progress line — bottom */}
      <div className="absolute bottom-12 left-1/2 h-px w-[min(280px,60vw)] -translate-x-1/2 bg-[rgb(232_228_222_/_0.08)]">
        <motion.div
          className="h-full origin-left bg-[var(--color-accent)]"
          style={{ scaleX: count / 100 }}
          transition={{ duration: 0.1 }}
        />
      </div>

      {/* Eyebrow — bottom left */}
      <motion.span
        className="absolute bottom-12 left-8 text-[0.55rem] uppercase tracking-[0.4em] text-[var(--color-text-muted)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: count > 30 ? 1 : 0 }}
        transition={{ duration: 0.6 }}
      >
        Film archive
      </motion.span>
    </motion.div>
  );
}
