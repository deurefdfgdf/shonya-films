'use client';

import { motion } from 'framer-motion';
import { type Film, getFilmTitle, formatRating } from '@/lib/api';

interface MarqueeStripProps {
  films: Film[];
}

export default function MarqueeStrip({ films }: MarqueeStripProps) {
  if (films.length === 0) return null;

  const items = [...films, ...films, ...films];

  return (
    <section className="overflow-hidden border-y border-[var(--color-border)] py-4">
      <motion.div
        className="flex w-max items-center gap-6 whitespace-nowrap"
        animate={{ x: ['0%', '-33.33%'] }}
        transition={{ duration: 40, ease: 'linear', repeat: Infinity }}
      >
        {items.map((film, index) => (
          <span
            key={`${film.kinopoiskId || film.filmId}-${index}`}
            className="inline-flex items-center gap-3"
          >
            <span className="display-title text-[clamp(1rem,1.8vw,1.5rem)] leading-none text-[var(--color-text)]">
              {getFilmTitle(film)}
            </span>
            <span className="text-[0.6rem] tabular-nums tracking-[0.16em] text-[var(--color-accent)]">
              {formatRating(film.ratingKinopoisk || film.rating) || '—'}
            </span>
            <span className="text-[var(--color-text-muted)]">—</span>
          </span>
        ))}
      </motion.div>
    </section>
  );
}
