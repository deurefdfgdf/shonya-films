'use client';

import { motion } from 'framer-motion';
import { type Film, getFilmId, getFilmTitle, formatRating, getRatingClass } from '@/lib/api';

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
  const genres = film.genres?.map((genre) => genre.genre).slice(0, 2).join(', ') || '';
  const posterUrl = film.posterUrlPreview || film.posterUrl || '';
  const filmId = getFilmId(film);

  return (
    <motion.button
      type="button"
      onClick={() => onClick(filmId)}
      className={`group block text-left ${compact ? 'w-[9rem]' : 'w-full'}`}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: Math.min(index * 0.05, 0.3), ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      data-clickable
    >
      <div className="film-frame relative overflow-hidden rounded-[1.7rem] bg-[rgb(255_244_227_/_0.03)]" style={{ aspectRatio: '0.71' }}>
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-[950ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1 group-hover:scale-[1.035]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[0.68rem] uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
            Нет постера
          </div>
        )}

        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgb(5 5 5 / 0.05) 0%, rgb(5 5 5 / 0.14) 26%, rgb(5 5 5 / 0.82) 100%)',
          }}
        />

        {rating && ratingClass ? (
          <div
            className="absolute left-3 top-3 rounded-full px-3 py-1 text-[0.62rem] uppercase tracking-[0.18em]"
            style={{
              color: ratingColors[ratingClass],
              background: 'rgb(0 0 0 / 0.38)',
              border: '1px solid rgb(255 244 227 / 0.08)',
            }}
          >
            {rating}
          </div>
        ) : null}

        {!compact ? (
          <div className="absolute bottom-3 left-3 text-[2.7rem] leading-none text-[rgb(255_244_227_/_0.15)] transition-transform duration-700 group-hover:translate-y-[-3px]">
            {String(index + 1).padStart(2, '0')}
          </div>
        ) : null}
      </div>

      <div className={`${compact ? 'mt-3' : 'mt-4'} space-y-1.5`}>
        <h3 className={`${compact ? 'text-[0.98rem]' : 'text-[1.08rem]'} leading-tight text-[var(--color-text)] transition-colors duration-300 group-hover:text-white`}>
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
          {[year, genres].filter(Boolean).join(' / ') || 'Открыть фильм'}
        </p>
      </div>
    </motion.button>
  );
}

export function FilmCardSkeleton({ count = 7 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="w-[12.8rem] min-w-[12.8rem] sm:w-[14.2rem] sm:min-w-[14.2rem]">
          <div className="skeleton-shimmer rounded-[1.6rem]" style={{ aspectRatio: '0.71' }} />
          <div className="mt-4 space-y-2">
            <div className="skeleton-shimmer h-4 w-[74%] rounded-full" />
            <div className="skeleton-shimmer h-3 w-[48%] rounded-full" />
          </div>
        </div>
      ))}
    </>
  );
}

