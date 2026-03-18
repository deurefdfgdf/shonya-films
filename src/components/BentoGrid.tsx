'use client';

import { motion } from 'framer-motion';
import { type Film, getFilmId, getFilmTitle, formatRating } from '@/lib/api';

interface BentoGridProps {
  films: Film[];
  onFilmClick: (id: number) => void;
}

export default function BentoGrid({ films, onFilmClick }: BentoGridProps) {
  if (films.length === 0) {
    return (
      <section className="section-shell py-20 sm:py-28">
        <div className="mb-10">
          <div className="skeleton-shimmer mb-3 h-3 w-28 rounded-full" />
          <div className="skeleton-shimmer h-16 w-[5ch] rounded-[var(--radius-sm)] sm:h-24" />
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="skeleton-shimmer min-h-[26rem] rounded-[var(--radius-md)]" />
          <div className="space-y-2.5">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="skeleton-shimmer h-20 rounded-[var(--radius-sm)]" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const [featured, ...secondary] = films.slice(0, 6);
  const featuredId = getFilmId(featured);
  const featuredPoster = featured.coverUrl || featured.posterUrl || featured.posterUrlPreview || '';
  const featuredTitle = getFilmTitle(featured);
  const featuredRating = formatRating(featured.ratingKinopoisk || featured.rating);
  const featuredMeta = [
    featured.year,
    featured.genres?.map((g) => g.genre).slice(0, 3).join(', '),
  ].filter(Boolean).join(' — ');

  return (
    <section className="section-shell py-20 sm:py-28">
      {/* Section header */}
      <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="eyebrow mb-3">Сейчас смотрят</span>
          <h2 className="display-title text-[clamp(3rem,7vw,6.5rem)] text-[var(--color-text)]">
            Популярное
          </h2>
        </div>
        <p className="max-w-[24rem] text-[0.82rem] leading-relaxed text-[var(--color-text-muted)]">
          Лучшие фильмы из текущей подборки — выбор алгоритмов и кураторов.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] xl:items-start">
        {/* Featured card */}
        <motion.button
          type="button"
          onClick={() => onFilmClick(featuredId)}
          className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] text-left"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          data-clickable
        >
          <div className="grid min-h-[26rem] md:grid-cols-[minmax(0,1.05fr)_minmax(240px,0.95fr)]">
            <div className="relative flex flex-col justify-between gap-6 p-6 sm:p-8">
              <div>
                <span className="text-[0.58rem] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
                  01 / Featured
                </span>
                <h3 className="display-title mt-3 max-w-[10ch] text-[clamp(2.8rem,5.5vw,5rem)] text-[var(--color-text)] transition-transform duration-700 group-hover:translate-y-[-2px]">
                  {featuredTitle}
                </h3>
              </div>

              <div className="space-y-3">
                <div className="text-[0.62rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                  {featuredMeta || 'Из основной подборки'}
                </div>
                {featured.shortDescription || featured.description ? (
                  <p className="text-[0.88rem] leading-relaxed text-[var(--color-text-secondary)] line-clamp-3">
                    {featured.shortDescription || featured.description}
                  </p>
                ) : null}
                <div className="inline-flex items-center gap-3 text-[0.62rem] uppercase tracking-[0.2em] text-[var(--color-text)]">
                  <span>{featuredRating ? `${featuredRating} KP` : 'Без рейтинга'}</span>
                  <span className="h-px w-8 bg-[var(--color-border-strong)]" />
                  <span className="text-[var(--color-text-muted)]">Открыть</span>
                </div>
              </div>
            </div>

            <div className="film-frame relative min-h-[20rem]">
              {featuredPoster ? (
                <img
                  src={featuredPoster}
                  alt={featuredTitle}
                  className="h-full w-full object-cover transition-transform duration-[1000ms] ease-[var(--ease-smooth)] group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[0.6rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                  Нет постера
                </div>
              )}
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, rgb(10 10 10 / 0.3) 0%, transparent 40%), linear-gradient(180deg, transparent 50%, rgb(10 10 10 / 0.4) 100%)',
                }}
              />
            </div>
          </div>
        </motion.button>

        {/* Secondary list */}
        <div className="space-y-2.5">
          {secondary.map((film, idx) => {
            const filmId = getFilmId(film);
            const poster = film.posterUrlPreview || film.posterUrl || '';
            const title = getFilmTitle(film);
            const rating = formatRating(film.ratingKinopoisk || film.rating);
            const year = film.year;

            return (
              <motion.button
                key={filmId || idx}
                type="button"
                onClick={() => onFilmClick(filmId)}
                className="group grid w-full items-center gap-3.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-2.5 text-left transition-colors duration-300 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-panel)] sm:grid-cols-[80px_minmax(0,1fr)]"
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.45, delay: idx * 0.06, ease: [0.22, 1, 0.36, 1] }}
                data-clickable
              >
                <div className="film-frame aspect-[2/3] overflow-hidden rounded-[var(--radius-sm)]">
                  {poster ? (
                    <img src={poster} alt={title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[0.55rem] text-[var(--color-text-muted)]">—</div>
                  )}
                </div>

                <div className="min-w-0 py-1">
                  <span className="text-[0.55rem] tabular-nums tracking-[0.2em] text-[var(--color-text-muted)]">
                    {String(idx + 2).padStart(2, '0')}
                  </span>
                  <h4 className="mt-1 text-[1.1rem] leading-tight text-[var(--color-text)]">
                    {title}
                  </h4>
                  <div className="mt-1.5 flex items-center gap-2 text-[0.58rem] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                    {year ? <span>{year}</span> : null}
                    {year && rating ? <span>/</span> : null}
                    {rating ? <span>{rating}</span> : null}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
