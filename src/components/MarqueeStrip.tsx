'use client';

import { motion } from 'framer-motion';
import { type Film, getFilmTitle, formatRating } from '@/lib/api';

interface MarqueeStripProps {
  films: Film[];
}

export default function MarqueeStrip({ films }: MarqueeStripProps) {
  if (films.length === 0) {
    return null;
  }

  const items = [...films, ...films, ...films];

  return (
    <section className="overflow-hidden border-y border-[rgb(255_244_227_/_0.08)] py-5">
      <motion.div
        className="flex w-max items-center gap-8 whitespace-nowrap"
        animate={{ x: ['0%', '-33.33%'] }}
        transition={{ duration: 34, ease: 'linear', repeat: Infinity }}
      >
        {items.map((film, index) => (
          <span
            key={`${film.kinopoiskId || film.filmId}-${index}`}
            className="inline-flex items-center gap-3 text-[clamp(1.1rem,2vw,1.7rem)] text-[var(--color-text-secondary)]"
          >
            <span className="text-[0.68rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
              {formatRating(film.ratingKinopoisk || film.rating) || '00'}
            </span>
            <span className="display-title leading-none text-[var(--color-text)]">
              {getFilmTitle(film)}
            </span>
            <span className="h-px w-8 bg-[var(--color-border)]" />
          </span>
        ))}
      </motion.div>
    </section>
  );
}
