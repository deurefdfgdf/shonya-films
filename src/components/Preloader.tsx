'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface PreloaderProps {
  onComplete: () => void;
}

export default function Preloader({ onComplete }: PreloaderProps) {
  const [exiting, setExiting] = useState(false);

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#050505]"
      animate={
        exiting
          ? { opacity: 0, scale: 1.04, filter: 'blur(12px)' }
          : { opacity: 1, scale: 1, filter: 'blur(0px)' }
      }
      transition={{ duration: 0.9, ease: [0.77, 0, 0.18, 1] }}
      onAnimationComplete={() => {
        if (exiting) {
          onComplete();
        }
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 38%, rgb(201 184 154 / 0.16) 0%, transparent 30%), linear-gradient(180deg, rgb(255 255 255 / 0.03) 0%, transparent 18%, transparent 100%)',
        }}
      />

      <div className="relative flex flex-col items-center gap-6 px-6 text-center">
        <motion.span
          className="eyebrow"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          Cinema index 2026
        </motion.span>

        <div className="overflow-hidden">
          <motion.h1
            className="display-title text-[clamp(4rem,10vw,8rem)] leading-[0.86] text-[var(--color-text)]"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          >
            Шоня
            <br />
            Фильмсы
          </motion.h1>
        </div>

        <motion.p
          className="max-w-md text-sm uppercase tracking-[0.28em] text-[var(--color-text-muted)]"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35 }}
        >
          Фильмы. Сериалы. Рейтинги.
        </motion.p>

        <div className="mt-3 h-px w-[220px] overflow-hidden bg-[rgb(255_244_227_/_0.12)]">
          <motion.div
            className="h-full origin-left bg-[var(--color-accent)]"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 2, ease: [0.77, 0, 0.18, 1] }}
            onAnimationComplete={() => setExiting(true)}
          />
        </div>
      </div>
    </motion.div>
  );
}
