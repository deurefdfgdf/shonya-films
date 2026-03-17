'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { type Film, getFilmTitle, formatRating } from '@/lib/api';

interface HeroProps {
  films: Film[];
  onDetailsClick: (id: number) => void;
  ready?: boolean;
}

const wordVariants = {
  hidden: { opacity: 0, y: '100%', filter: 'blur(8px)' },
  visible: (index: number) => ({
    opacity: 1,
    y: '0%',
    filter: 'blur(0px)',
    transition: {
      duration: 0.95,
      delay: index * 0.08,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

export default function Hero({ films, onDetailsClick, ready = true }: HeroProps) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const posterX = useSpring(rawX, { stiffness: 24, damping: 18 });
  const posterY = useSpring(rawY, { stiffness: 24, damping: 18 });

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!window.matchMedia('(pointer:fine)').matches) {
        return;
      }

      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      rawX.set(((event.clientX - centerX) / centerX) * 10);
      rawY.set(((event.clientY - centerY) / centerY) * 8);
    },
    [rawX, rawY]
  );

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setIndex((current) => (films.length === 0 ? 0 : (current + 1) % films.length));
    }, 6400);
  }, [films.length]);

  useEffect(() => {
    if (films.length > 0) {
      startTimer();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [films.length, startTimer]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const goTo = (nextIndex: number) => {
    setIndex(nextIndex);
    startTimer();
  };

  const hoverHandlers = useMemo(() => ({
    onMouseEnter: pauseTimer,
    onMouseLeave: startTimer,
  }), [pauseTimer, startTimer]);

  if (films.length === 0) {
    return (
      <section className="relative flex min-h-screen items-end overflow-hidden pt-[calc(var(--header-height)+1.25rem)]">
        <div className="section-shell relative z-10 w-full pb-20">
          <div className="max-w-[54rem]">
            <div className="mb-6 flex gap-4">
              <div className="skeleton-shimmer h-4 w-24 rounded-full" />
              <div className="skeleton-shimmer h-4 w-16 rounded-full" />
            </div>
            <div className="skeleton-shimmer h-32 w-[5ch] rounded-[1.5rem] sm:h-44 lg:h-56" />
            <div className="mt-6 space-y-3">
              <div className="skeleton-shimmer h-5 w-[80%] max-w-[31rem] rounded-full" />
              <div className="skeleton-shimmer h-5 w-[60%] max-w-[24rem] rounded-full" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  const film = films[index];
  const title = getFilmTitle(film);
  const titleWords = title.split(/\s+/);
  const description = film.shortDescription || film.description || 'Избранный фильм из текущей подборки.';
  const rating = formatRating(film.ratingKinopoisk || film.rating);
  const year = film.year ? String(film.year) : '';
  const genres = film.genres?.map((genre) => genre.genre).slice(0, 2).join(' / ') || '';
  const countries = film.countries?.map((country) => country.country).slice(0, 2).join(' / ') || '';
  const posterUrl = film.coverUrl || film.posterUrl || film.posterUrlPreview || '';
  const filmId = film.kinopoiskId || film.filmId || 0;

  return (
    <section className="relative flex min-h-screen items-end overflow-hidden pt-[calc(var(--header-height)+1.25rem)]">
      <AnimatePresence mode="wait">
        <motion.div
          key={posterUrl}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${posterUrl})` }}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 0.14, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: 1.2 },
            scale: { duration: 8, ease: 'easeOut' },
          }}
        />
      </AnimatePresence>

      <motion.div
        className="absolute inset-0"
        animate={{ opacity: [0.72, 0.88, 0.72] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          background:
            'linear-gradient(180deg, rgb(6 6 6 / 0.22) 0%, rgb(6 6 6 / 0.44) 34%, rgb(6 6 6 / 0.94) 100%)',
        }}
      />
      <motion.div
        className="absolute inset-0"
        animate={{ x: ['-1.5%', '1%', '-1.5%'], y: ['0%', '1%', '0%'] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          background:
            'radial-gradient(circle at 72% 32%, rgb(255 244 227 / 0.07) 0%, transparent 18%), radial-gradient(circle at 20% 18%, rgb(201 184 154 / 0.08) 0%, transparent 22%)',
        }}
      />

      <motion.div
        className="section-shell relative z-10 flex w-full pb-12 sm:pb-16 lg:pb-18"
        animate={ready ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        {...hoverHandlers}
      >
        <div className="grid w-full items-end gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.48fr)] lg:gap-16 xl:gap-20">
          <AnimatePresence mode="wait">
            <motion.div
              key={filmId}
              initial={{ opacity: 0, y: 46 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-[54rem] lg:pr-6 xl:pr-14"
            >
              <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.64rem] uppercase tracking-[0.26em] text-[var(--color-text-muted)] sm:text-[0.68rem]">
                <span>{rating ? `Кинопоиск ${rating}` : 'Выбор редакции'}</span>
                {year ? <span>{year}</span> : null}
                {genres ? <span>{genres}</span> : null}
              </div>

              <h1 className="display-title max-w-[6.4ch] text-[clamp(4.6rem,13vw,13.2rem)] text-[var(--color-text)]">
                {titleWords.map((word, wordIndex) => (
                  <span key={`${filmId}-${word}-${wordIndex}`} className="mr-[0.1em] inline-flex overflow-hidden align-top">
                    <motion.span custom={wordIndex} variants={wordVariants} initial="hidden" animate="visible" className="inline-block">
                      {word}
                    </motion.span>
                  </span>
                ))}
              </h1>

              <motion.p
                className="mt-6 max-w-[31rem] text-[clamp(0.98rem,1.15vw,1.16rem)] leading-[1.7] text-[var(--color-text-secondary)]"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.85, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                {description}
              </motion.p>

              <motion.div
                className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.85, delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="max-w-[28rem] text-sm leading-relaxed text-[var(--color-text-muted)]">
                  {[countries, film.type].filter(Boolean).join(' / ') || 'Из текущей кураторской подборки'}
                </div>

                <button
                  type="button"
                  onClick={() => onDetailsClick(filmId)}
                  className="editorial-button editorial-button--solid self-start"
                  data-clickable
                >
                  <span className="text-[0.72rem]">Открыть фильм</span>
                  <span className="text-lg">↗</span>
                </button>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${filmId}-poster`}
              className="relative mx-auto w-full max-w-[20rem] justify-self-end sm:max-w-[22rem] xl:max-w-[23rem]"
              style={{ x: posterX, y: posterY }}
              initial={{ opacity: 0, y: 56 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ scale: 1.025, y: -6 }}
            >
              <div
                className="absolute -inset-[14%] rounded-full blur-3xl"
                style={{ background: 'radial-gradient(circle, rgb(201 184 154 / 0.22) 0%, transparent 62%)' }}
              />

              <div className="film-frame float-slow relative aspect-[0.72] overflow-hidden rounded-[2.1rem] border border-[rgb(255_244_227_/_0.08)] bg-[rgb(255_244_227_/_0.03)] shadow-[var(--shadow-poster)]">
                {posterUrl ? (
                  <img src={posterUrl} alt={title} className="h-full w-full object-cover object-center" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
                    Постер недоступен
                  </div>
                )}

                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(180deg, rgb(5 5 5 / 0.04) 0%, rgb(5 5 5 / 0.14) 22%, rgb(5 5 5 / 0.82) 100%)',
                  }}
                />

                <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-5 p-5 sm:p-6">
                  <div>
                    <div className="text-[1rem] leading-tight text-[var(--color-text)] sm:text-[1.15rem]">{title}</div>
                    <div className="mt-2 text-[0.64rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                      {[year, rating ? `${rating} KP` : null].filter(Boolean).join(' / ')}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="relative z-20 mt-8 pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => goTo((index - 1 + films.length) % films.length)}
              className="editorial-button px-5"
              aria-label="Предыдущий фильм"
              data-clickable
            >
              Назад
            </button>

            <div className="flex items-center gap-2">
              {films.map((item, dotIndex) => {
                const active = dotIndex === index;
                return (
                  <button
                    key={item.kinopoiskId || item.filmId || dotIndex}
                    type="button"
                    onClick={() => goTo(dotIndex)}
                    className="relative h-2 rounded-full transition-all duration-700"
                    style={{
                      width: active ? '3rem' : '0.7rem',
                      background: active ? 'var(--color-accent)' : 'rgb(255 244 227 / 0.16)',
                    }}
                    aria-label={`Открыть фильм ${dotIndex + 1}`}
                    data-clickable
                  />
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => goTo((index + 1) % films.length)}
              className="editorial-button px-5"
              aria-label="Следующий фильм"
              data-clickable
            >
              Дальше
            </button>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
