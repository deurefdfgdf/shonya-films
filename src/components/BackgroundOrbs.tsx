'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function BackgroundOrbs() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  if (reducedMotion) {
    return (
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
        <div
          className="absolute -left-[15vw] top-[8vh] rounded-full"
          style={{
            width: '35vw',
            height: '35vw',
            background: 'radial-gradient(circle, rgb(196 191 182 / 0.035) 0%, transparent 60%)',
            filter: 'blur(80px)',
          }}
        />
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <motion.div
        className="absolute -left-[15vw] top-[8vh] rounded-full"
        style={{
          width: '35vw',
          height: '35vw',
          background: 'radial-gradient(circle, rgb(196 191 182 / 0.035) 0%, transparent 60%)',
          filter: 'blur(80px)',
          willChange: 'transform',
        }}
        animate={{ x: [0, 40, -20, 0], y: [0, -20, 30, 0] }}
        transition={{ duration: 24, ease: 'easeInOut', repeat: Infinity }}
      />
      <motion.div
        className="absolute right-[-15vw] top-[20vh] rounded-full"
        style={{
          width: '30vw',
          height: '30vw',
          background: 'radial-gradient(circle, rgb(220 218 216 / 0.03) 0%, transparent 60%)',
          filter: 'blur(90px)',
          willChange: 'transform',
        }}
        animate={{ x: [0, -30, 10, 0], y: [0, 25, -15, 0] }}
        transition={{ duration: 28, ease: 'easeInOut', repeat: Infinity }}
      />
    </div>
  );
}
