'use client';

import { motion } from 'framer-motion';
import { type Film, getFilmId, getFilmTitle, formatRating, getRatingClass } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface FilmCardProps {
  film: Film;
  index?: number;
  onClick: (id: number) => void;
  compact?: boolean;
  featured?: boolean;
}

const ratingColors: Record<'high' | 'medium' | 'low', string> = {
  high: 'var(--color-success)',
  medium: 'var(--color-warning)',
  low: 'var(--color-danger)',
};

export default function FilmCard({
  film,
  index = 0,
  onClick,
  compact = false,
}: FilmCardProps) {
  const title = getFilmTitle(film);
  const rating = formatRating(film.ratingKinopoisk || film.rating);
  const ratingClass = rating ? getRatingClass(rating) : null;
  const year = film.year || '';
  const genres = film.genres?.map((g) => g.genre).slice(0, 2).join(', ') || '';
  const posterUrl = film.posterUrlPreview || film.posterUrl || '';
  const filmId = getFilmId(film);
  const { isWatched } = useAuth();
  const watched = isWatched(filmId);

  return (
    <motion.button
      type="button"
      onClick={() => onClick(filmId)}
      className={`group block text-left ${compact ? 'w-[10.5rem] shrink-0' : 'w-full'}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.04, 0.25), ease: [0.22, 1, 0.36, 1] }}
      data-clickable
    >
      <div
        className="film-frame relative overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-panel)]"
        style={{ aspectRatio: '2/3' }}
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-[var(--ease-smooth)] group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[0.6rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            Нет постера
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-[rgb(10_10_10_/_0)] transition-colors duration-500 group-hover:bg-[rgb(10_10_10_/_0.3)]" />

        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, transparent 50%, rgb(10 10 10 / 0.7) 100%)',
          }}
        />

        {/* Rating */}
        {rating && ratingClass ? (
          <div
            className="absolute left-2.5 top-2.5 rounded-full px-2.5 py-0.5 text-[0.58rem] tabular-nums tracking-[0.1em]"
            style={{
              color: ratingColors[ratingClass],
              background: 'rgb(10 10 10 / 0.7)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {rating}
          </div>
        ) : null}

        {/* Watched badge */}
        {watched ? (
          <div
            className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full"
            style={{ background: 'rgb(141 184 154 / 0.85)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#0a0a0b" strokeWidth="3" className="h-2.5 w-2.5">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </div>
        ) : null}

        {/* Index number */}
        {!compact ? (
          <div className="absolute bottom-2.5 left-3 display-title text-[2.2rem] leading-none text-[rgb(232_228_222_/_0.1)] transition-all duration-500 group-hover:text-[rgb(232_228_222_/_0.2)]">
            {String(index + 1).padStart(2, '0')}
          </div>
        ) : null}
      </div>

      <div className={`${compact ? 'mt-2.5' : 'mt-3'} space-y-1`}>
        <h3 className={`${compact ? 'text-[0.9rem]' : 'text-[1rem]'} leading-tight text-[var(--color-text)] transition-colors duration-300 group-hover:text-white`}>
          {title}
        </h3>
        <p className="text-[0.72rem] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          {[year, genres].filter(Boolean).join(' — ') || '—'}
        </p>
      </div>
    </motion.button>
  );
}

export function FilmCardSkeleton({ count = 7 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="w-[12.8rem] min-w-[12.8rem] sm:w-[14.2rem] sm:min-w-[14.2rem]">
          <div className="skeleton-shimmer rounded-[var(--radius-md)]" style={{ aspectRatio: '2/3' }} />
          <div className="mt-3 space-y-1.5">
            <div className="skeleton-shimmer h-3.5 w-[70%] rounded-full" />
            <div className="skeleton-shimmer h-2.5 w-[45%] rounded-full" />
          </div>
        </div>
      ))}
    </>
  );
}
