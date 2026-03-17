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
      <section className="section-shell py-24 sm:py-32">
        <div className="mb-12">
          <div className="skeleton-shimmer mb-4 h-4 w-32 rounded-full" />
          <div className="skeleton-shimmer h-20 w-[6ch] rounded-[1rem] sm:h-28" />
        </div>
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
          <div className="skeleton-shimmer min-h-[28rem] rounded-[2rem]" />
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="skeleton-shimmer h-24 rounded-[1.6rem]" />
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
    featured.genres?.map((genre) => genre.genre).slice(0, 3).join(', '),
  ]
    .filter(Boolean)
    .join(' / ');

  return (
    <section className="section-shell py-24 sm:py-32">
      <div className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-[52rem]">
          <span className="eyebrow mb-4">Сейчас смотрят</span>
          <h2 className="display-title text-[clamp(3.6rem,8vw,7.6rem)] text-[var(--color-text)]">
            Популярное
          </h2>
        </div>
        <p className="max-w-[28rem] text-sm leading-relaxed text-[var(--color-text-muted)]">
          Доминирующий кадр и пять второстепенных постеров сохраняют всю подборку, но смещают акцент с интерфейса на атмосферу и типографику.
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] xl:items-start">
        <motion.button
          type="button"
          onClick={() => onFilmClick(featuredId)}
          className="group relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] text-left shadow-[var(--shadow-soft)]"
          initial={{ opacity: 0, y: 36 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          data-clickable
        >
          <div className="absolute inset-0 bg-[rgb(255_244_227_/_0.02)]" />
          <div className="grid min-h-[28rem] md:grid-cols-[minmax(0,1.05fr)_minmax(250px,0.95fr)]">
            <div className="relative flex flex-col justify-between gap-6 p-6 sm:p-8 lg:p-10">
              <div>
                <span className="text-[0.68rem] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
                  01 / Featured selection
                </span>
                <h3 className="display-title mt-4 max-w-[10ch] text-[clamp(3.1rem,6vw,5.8rem)] text-[var(--color-text)] transition-transform duration-700 group-hover:translate-y-[-4px]">
                  {featuredTitle}
                </h3>
              </div>

              <div className="max-w-[24rem] space-y-4">
                <div className="text-[0.72rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                  {featuredMeta || 'Фильм из основной подборки'}
                </div>
                {featured.shortDescription || featured.description ? (
                  <p className="text-base leading-relaxed text-[var(--color-text-secondary)] line-clamp-3">
                    {featured.shortDescription || featured.description}
                  </p>
                ) : null}
                <div className="inline-flex items-center gap-3 text-[0.72rem] uppercase tracking-[0.22em] text-[var(--color-text)]">
                  <span>{featuredRating ? `Кинопоиск ${featuredRating}` : 'Без рейтинга'}</span>
                  <span className="h-px w-10 bg-[var(--color-border-strong)]" />
                  <span>Открыть карточку</span>
                </div>
              </div>
            </div>

            <div className="film-frame relative min-h-[22rem] bg-[rgb(255_244_227_/_0.04)]">
              {featuredPoster ? (
                <img
                  src={featuredPoster}
                  alt={featuredTitle}
                  className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
                  Постер недоступен
                </div>
              )}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg, rgb(5 5 5 / 0.08) 0%, rgb(5 5 5 / 0.24) 36%, rgb(5 5 5 / 0.74) 100%)',
                }}
              />
            </div>
          </div>
        </motion.button>

        <div className="space-y-3">
          {secondary.map((film, index) => {
            const filmId = getFilmId(film);
            const poster = film.posterUrlPreview || film.posterUrl || '';
            const title = getFilmTitle(film);
            const rating = formatRating(film.ratingKinopoisk || film.rating);
            const meta = [
              film.year,
              film.genres?.map((genre) => genre.genre).slice(0, 2).join(', '),
            ]
              .filter(Boolean)
              .join(' / ');

            return (
              <motion.button
                key={filmId || index}
                type="button"
                onClick={() => onFilmClick(filmId)}
                className="group grid w-full items-center gap-4 rounded-[1.6rem] border border-[var(--color-border)] bg-[rgb(255_244_227_/_0.03)] p-3 text-left transition-colors duration-500 hover:bg-[rgb(255_244_227_/_0.05)] sm:grid-cols-[96px_minmax(0,1fr)]"
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                data-clickable
              >
                <div className="film-frame aspect-[0.72] overflow-hidden rounded-[1.2rem]">
                  {poster ? (
                    <img
                      src={poster}
                      alt={title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[0.65rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                      Нет постера
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="text-[0.68rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                    {String(index + 2).padStart(2, '0')}
                  </div>
                  <h4 className="mt-2 text-[1.35rem] leading-tight text-[var(--color-text)] transition-colors duration-300 group-hover:text-white">
                    {title}
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)] line-clamp-2">
                    {meta || 'Фильм из основной подборки'}
                  </p>
                  <div className="mt-3 text-[0.66rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                    {rating ? `Кинопоиск ${rating}` : 'Подробнее'}
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
