'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { type Film, getFilmTitle, formatRating } from '@/lib/api';

interface HeroProps {
  films: Film[];
  onDetailsClick: (id: number) => void;
  ready?: boolean;
}

export default function Hero({ films, onDetailsClick, ready = true }: HeroProps) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const posterX = useSpring(rawX, { stiffness: 24, damping: 18 });
  const posterY = useSpring(rawY, { stiffness: 24, damping: 18 });

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!window.matchMedia('(pointer:fine)').matches) return;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      rawX.set(((event.clientX - cx) / cx) * 8);
      rawY.set(((event.clientY - cy) / cy) * 6);
    },
    [rawX, rawY]
  );

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIndex((c) => (films.length === 0 ? 0 : (c + 1) % films.length));
    }, 7000);
  }, [films.length]);

  useEffect(() => {
    if (films.length > 0) startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [films.length, startTimer]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const goTo = (n: number) => { setIndex(n); startTimer(); };

  const hoverHandlers = useMemo(() => ({
    onMouseEnter: pauseTimer,
    onMouseLeave: startTimer,
  }), [pauseTimer, startTimer]);

  if (films.length === 0) {
    return (
      <section className="relative flex min-h-screen items-end overflow-hidden pt-[calc(var(--header-height)+2rem)]">
        <div className="section-shell relative z-10 w-full pb-20">
          <div className="skeleton-shimmer mb-4 h-3 w-40 rounded-full" />
          <div className="skeleton-shimmer h-[clamp(5rem,14vw,12rem)] w-[5ch] rounded-[var(--radius-md)]" />
          <div className="mt-6 skeleton-shimmer h-4 w-[min(80%,28rem)] rounded-full" />
        </div>
      </section>
    );
  }

  const film = films[index];
  const title = getFilmTitle(film);
  const description = film.shortDescription || film.description || '';
  const rating = formatRating(film.ratingKinopoisk || film.rating);
  const year = film.year ? String(film.year) : '';
  const genres = film.genres?.map((g) => g.genre).slice(0, 2).join(' / ') || '';
  const countries = film.countries?.map((c) => c.country).slice(0, 2).join(', ') || '';
  const posterUrl = film.coverUrl || film.posterUrl || film.posterUrlPreview || '';
  const filmId = film.kinopoiskId || film.filmId || 0;

  return (
    <section className="relative flex min-h-screen items-end overflow-hidden">
      {/* Background image */}
      <AnimatePresence mode="wait">
        <motion.div
          key={posterUrl}
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${posterUrl})` }}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 0.12, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 1.2 }, scale: { duration: 10, ease: 'easeOut' } }}
        />
      </AnimatePresence>

      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgb(10 10 10 / 0.3) 0%, rgb(10 10 10 / 0.6) 50%, rgb(10 10 10 / 0.97) 100%)',
        }}
      />

      {/* Content */}
      <motion.div
        className="section-shell relative z-10 flex w-full flex-col pb-10 pt-[calc(var(--header-height)+3rem)] sm:pb-14 lg:pb-16"
        animate={ready ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.7 }}
        {...hoverHandlers}
      >
        <div className="grid w-full items-end gap-8 lg:grid-cols-[1fr_auto] lg:gap-12">
          {/* Left — text */}
          <AnimatePresence mode="wait">
            <motion.div
              key={filmId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Meta line */}
              <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.58rem] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
                {year ? <span>{year}</span> : null}
                {year && genres ? <span className="text-[var(--color-border-strong)]">/</span> : null}
                {genres ? <span>{genres}</span> : null}
                {rating ? (
                  <>
                    <span className="text-[var(--color-border-strong)]">/</span>
                    <span className="text-[var(--color-accent)]">{rating}</span>
                  </>
                ) : null}
              </div>

              {/* Title — huge typography, character reveal */}
              <h1 className="overflow-hidden">
                <motion.span
                  className="display-title block text-[clamp(3.5rem,11vw,11rem)] text-[var(--color-text)]"
                  initial={{ y: '100%' }}
                  animate={{ y: '0%' }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                >
                  {title}
                </motion.span>
              </h1>

              {/* Description */}
              {description ? (
                <motion.p
                  className="mt-5 max-w-[28rem] text-[0.92rem] leading-[1.7] text-[var(--color-text-secondary)]"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.2 }}
                >
                  {description}
                </motion.p>
              ) : null}

              {/* Actions */}
              <motion.div
                className="mt-8 flex items-center gap-4"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.35 }}
              >
                <button
                  type="button"
                  onClick={() => onDetailsClick(filmId)}
                  className="editorial-button editorial-button--solid"
                  data-clickable
                >
                  <span className="text-[0.7rem] uppercase tracking-[0.16em]">Подробнее</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                    <path d="M7 17L17 7M17 7H7M17 7v10" />
                  </svg>
                </button>

                {countries ? (
                  <span className="text-[0.6rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                    {countries}
                  </span>
                ) : null}
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {/* Right — poster */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${filmId}-poster`}
              className="relative mx-auto w-full max-w-[18rem] lg:mx-0 lg:max-w-[16rem] xl:max-w-[18rem]"
              style={{ x: posterX, y: posterY }}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="film-frame relative aspect-[2/3] overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-poster)]">
                {posterUrl ? (
                  <img src={posterUrl} alt={title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[0.6rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                    Нет постера
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation dots + arrows */}
        <motion.div
          className="mt-10 flex items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <button
            type="button"
            onClick={() => goTo((index - 1 + films.length) % films.length)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors duration-300 hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
            aria-label="Предыдущий"
            data-clickable
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex items-center gap-1.5">
            {films.map((f, i) => (
              <button
                key={f.kinopoiskId || f.filmId || i}
                type="button"
                onClick={() => goTo(i)}
                className="h-1 rounded-full transition-all duration-500"
                style={{
                  width: i === index ? '2rem' : '0.5rem',
                  background: i === index ? 'var(--color-accent)' : 'var(--color-border-strong)',
                }}
                aria-label={`Фильм ${i + 1}`}
                data-clickable
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => goTo((index + 1) % films.length)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors duration-300 hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
            aria-label="Следующий"
            data-clickable
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <span className="ml-2 text-[0.55rem] tabular-nums tracking-[0.2em] text-[var(--color-text-muted)]">
            {String(index + 1).padStart(2, '0')} / {String(films.length).padStart(2, '0')}
          </span>
        </motion.div>
      </motion.div>
    </section>
  );
}
