'use client';

import { motion } from 'framer-motion';

export default function BackgroundOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <motion.div
        className="absolute -left-[12vw] top-[10vh] h-[42vw] w-[42vw] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgb(201 184 154 / 0.16) 0%, transparent 62%)',
          filter: 'blur(70px)',
        }}
        animate={{ x: [0, 60, -30, 0], y: [0, -30, 40, 0], scale: [1, 1.08, 0.96, 1] }}
        transition={{ duration: 20, ease: 'easeInOut', repeat: Infinity }}
      />
      <motion.div
        className="absolute right-[-12vw] top-[18vh] h-[36vw] w-[36vw] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgb(255 255 255 / 0.08) 0%, transparent 64%)',
          filter: 'blur(85px)',
        }}
        animate={{ x: [0, -50, 10, 0], y: [0, 40, -20, 0], scale: [1, 1.12, 0.92, 1] }}
        transition={{ duration: 24, ease: 'easeInOut', repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-[-18vh] left-[26vw] h-[34vw] w-[34vw] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgb(201 184 154 / 0.1) 0%, transparent 60%)',
          filter: 'blur(90px)',
        }}
        animate={{ x: [0, 20, -50, 0], y: [0, -50, -10, 0], scale: [1, 0.95, 1.08, 1] }}
        transition={{ duration: 28, ease: 'easeInOut', repeat: Infinity }}
      />
    </div>
  );
}
