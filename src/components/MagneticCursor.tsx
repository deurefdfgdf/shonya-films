'use client';

import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export default function MagneticCursor() {
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const [isHovering, setIsHovering] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const smoothX = useSpring(cursorX, { damping: 26, stiffness: 320, mass: 0.45 });
  const smoothY = useSpring(cursorY, { damping: 26, stiffness: 320, mass: 0.45 });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(pointer: fine)');
    if (!mediaQuery.matches) {
      return;
    }

    setIsVisible(true);
    document.body.classList.add('cursor-ready');

    const moveCursor = (event: MouseEvent) => {
      cursorX.set(event.clientX);
      cursorY.set(event.clientY);
    };

    const handleMouseOver = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const clickable = target.closest(
        'a, button, [role="button"], input, select, textarea, [data-clickable]'
      );
      setIsHovering(clickable !== null);
    };

    const handleMouseDown = () => setIsPressed(true);
    const handleMouseUp = () => setIsPressed(false);

    window.addEventListener('mousemove', moveCursor, { passive: true });
    window.addEventListener('mouseover', handleMouseOver, { passive: true });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.classList.remove('cursor-ready');
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('mouseover', handleMouseOver);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [cursorX, cursorY]);

  if (!isVisible) {
    return null;
  }

  return (
    <>
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[10000] rounded-full"
        style={{
          x: smoothX,
          y: smoothY,
          translateX: '-50%',
          translateY: '-50%',
          width: isHovering ? 42 : 24,
          height: isHovering ? 42 : 24,
          border: `1px solid ${isHovering ? 'var(--color-accent)' : 'rgb(255 244 227 / 0.18)'}`,
          background: isHovering ? 'rgb(201 184 154 / 0.06)' : 'transparent',
          boxShadow: isHovering ? '0 0 0 8px rgb(201 184 154 / 0.05)' : 'none',
          scale: isPressed ? 0.84 : 1,
        }}
      />
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[10000] rounded-full"
        style={{
          x: cursorX,
          y: cursorY,
          translateX: '-50%',
          translateY: '-50%',
          width: isHovering ? 6 : 4,
          height: isHovering ? 6 : 4,
          background: 'var(--color-accent)',
          opacity: 0.9,
          scale: isPressed ? 0.6 : 1,
        }}
      />
    </>
  );
}
