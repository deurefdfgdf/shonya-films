'use client';

import { motion } from 'framer-motion';

export default function ScrollIndicator() {
  return (
    <motion.button
      type="button"
      className="relative z-[3] mx-auto flex select-none flex-col items-center gap-3 px-4 py-8 text-center"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 1.05, ease: [0.22, 1, 0.36, 1] }}
      onClick={() =>
        window.scrollBy({
          top: window.innerHeight * 0.82,
          behavior: 'smooth',
        })
      }
      data-clickable
    >
      <span className="text-[0.68rem] uppercase tracking-[0.32em] text-[var(--color-text-muted)]">
        Листать
      </span>

      <div className="relative h-14 w-px overflow-hidden bg-[var(--color-border)]">
        <motion.div
          className="absolute left-1/2 top-0 h-5 w-[3px] -translate-x-1/2 rounded-full bg-[var(--color-accent)]"
          animate={{ y: [0, 34, 34, 0], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity }}
        />
      </div>
    </motion.button>
  );
}
