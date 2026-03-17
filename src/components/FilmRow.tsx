'use client';

import { type Film } from '@/lib/api';
import FilmCard, { FilmCardSkeleton } from './FilmCard';

interface FilmRowProps {
  title: string;
  films: Film[];
  loading?: boolean;
  onSeeAll?: () => void;
  onFilmClick: (id: number) => void;
}

export default function FilmRow({
  title,
  films,
  loading = false,
  onSeeAll,
  onFilmClick,
}: FilmRowProps) {
  const sectionLabel = title === 'Топ 250' ? 'Главный список' : 'Новые поступления';

  return (
    <section className="section-shell py-24 sm:py-32">
      <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-[52rem]">
          <span className="eyebrow mb-4">{sectionLabel}</span>
          <h2 className="display-title text-[clamp(3.4rem,7vw,6.4rem)] text-[var(--color-text)]">
            {title}
          </h2>
        </div>

        {onSeeAll ? (
          <button
            type="button"
            onClick={onSeeAll}
            className="editorial-button self-start"
            data-clickable
          >
            <span className="text-[0.72rem] uppercase tracking-[0.24em]">Открыть раздел</span>
            <span className="text-lg">↗</span>
          </button>
        ) : null}
      </div>

      <div className="flex gap-6 overflow-x-auto scroll-hide pb-2">
        {loading ? (
          <FilmCardSkeleton count={5} />
        ) : (
          films.map((film, index) => (
            <div
              key={film.kinopoiskId || film.filmId || index}
              className="w-[12.8rem] min-w-[12.8rem] sm:w-[14.2rem] sm:min-w-[14.2rem]"
            >
              <FilmCard film={film} index={index} onClick={onFilmClick} />
            </div>
          ))
        )}
      </div>
    </section>
  );
}
