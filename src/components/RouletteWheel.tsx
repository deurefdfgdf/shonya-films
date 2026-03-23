'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type Film, getFilmId, getFilmTitle, formatRating, getRatingClass } from '@/lib/api';
import { getRouletteFilms, resolveFilmNames } from '@/lib/ai';
import { useAuth } from '@/contexts/AuthContext';
import { playTick, playWin } from '@/lib/sounds';

interface RouletteWheelProps {
  onFilmClick: (id: number) => void;
  onBack: () => void;
}

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const ratingColors: Record<'high' | 'medium' | 'low', string> = {
  high: 'var(--color-success)',
  medium: 'var(--color-warning)',
  low: 'var(--color-danger)',
};

type RoulettePhase = 'idle' | 'loading' | 'ready' | 'spinning' | 'result';

export default function RouletteWheel({ onFilmClick, onBack }: RouletteWheelProps) {
  const [phase, setPhase] = useState<RoulettePhase>('idle');
  const [films, setFilms] = useState<Film[]>([]);
  const [winnerIndex, setWinnerIndex] = useState(0);
  const [spinAngle, setSpinAngle] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { watchedFilmTitles, watchedWithReactions } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  const loadFilms = useCallback(async () => {
    setPhase('loading');
    setError(null);
    try {
      const response = await getRouletteFilms(watchedFilmTitles, watchedWithReactions);
      const resolved = await resolveFilmNames(response.films);
      if (resolved.length < 2) {
        setError('Не удалось найти достаточно фильмов');
        setPhase('idle');
        return;
      }
      setFilms(resolved.slice(0, 8));
      setPhase('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      setPhase('idle');
    }
  }, [watchedFilmTitles, watchedWithReactions]);

  const spin = useCallback(() => {
    if (films.length === 0) return;
    setPhase('spinning');

    let winner = Math.floor(Math.random() * films.length);
    if (films.length > 1) {
      // Prevent selecting the same film twice in a row
      while (winner === winnerIndex) {
        winner = Math.floor(Math.random() * films.length);
      }
    }
    setWinnerIndex(winner);

    // Calculate angle: each segment, multiple full rotations + landing on winner
    const segmentAngle = 360 / films.length;
    // Land in the middle of the winner's segment (top = 0 degrees)
    const targetAngle = 360 - (winner * segmentAngle + segmentAngle / 2);
    // Add 5-7 full rotations for dramatic effect
    const fullRotations = (5 + Math.floor(Math.random() * 3)) * 360;
    const finalAngle = spinAngle + fullRotations + targetAngle;
    setSpinAngle(finalAngle);

    // Tick sounds during spin (slowing down)
    const ticks = [200, 400, 600, 850, 1150, 1500, 1900, 2400, 3000, 3600];
    ticks.forEach((delay) => setTimeout(() => playTick(), delay));

    // Wait for spin to finish
    setTimeout(() => {
      playWin();
      setPhase('result');
    }, 4200);
  }, [films, spinAngle]);

  const respin = useCallback(() => {
    setPhase('ready');
    // Small delay then spin again
    setTimeout(() => spin(), 300);
  }, [spin]);

  const winner = films[winnerIndex] || null;
  const segmentAngle = films.length > 0 ? 360 / films.length : 0;

  // Segment colors - alternating warm tones
  const segmentColors = [
    'rgb(201 184 154 / 0.12)',
    'rgb(201 184 154 / 0.06)',
    'rgb(180 168 140 / 0.10)',
    'rgb(180 168 140 / 0.04)',
    'rgb(196 191 182 / 0.11)',
    'rgb(196 191 182 / 0.05)',
    'rgb(188 178 160 / 0.10)',
    'rgb(188 178 160 / 0.04)',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <AnimatePresence mode="wait">
        {/* ─── Idle / Loading ─── */}
        {(phase === 'idle' || phase === 'loading') && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center"
          >
            {/* Decorative wheel preview */}
            <motion.div
              className="relative mb-8 flex h-52 w-52 items-center justify-center rounded-full border border-[rgb(201_184_154_/_0.15)] sm:h-64 sm:w-64"
              style={{ background: 'radial-gradient(circle, rgb(201 184 154 / 0.06) 0%, transparent 70%)' }}
              animate={phase === 'loading' ? { rotate: 360 } : {}}
              transition={phase === 'loading' ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
            >
              {/* Dashes around the circle */}
              {Array.from({ length: 24 }, (_, i) => (
                <div
                  key={i}
                  className="absolute h-1 w-3 rounded-full bg-[rgb(201_184_154_/_0.2)]"
                  style={{
                    transform: `rotate(${i * 15}deg) translateX(${phase === 'loading' ? 96 : 88}px)`,
                    transformOrigin: 'center center',
                    opacity: phase === 'loading' ? 0.4 + (i % 3) * 0.2 : 0.3,
                  }}
                />
              ))}

              <motion.div
                className="text-5xl sm:text-6xl"
                animate={phase === 'loading' ? { scale: [1, 1.15, 1] } : {}}
                transition={phase === 'loading' ? { duration: 1.5, repeat: Infinity } : {}}
              >
                🎰
              </motion.div>
            </motion.div>

            {error && (
              <p className="mb-4 text-center text-[0.68rem] text-[var(--color-danger)]">{error}</p>
            )}

            <p className="mb-8 max-w-[24rem] text-center text-sm leading-relaxed text-[var(--color-text-secondary)]">
              ИИ подберёт 8 фильмов на основе ваших предпочтений, а рулетка выберет один случайный.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={onBack}
                className="editorial-button"
                data-clickable
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[0.72rem]">Назад</span>
              </button>
              <button
                type="button"
                onClick={loadFilms}
                disabled={phase === 'loading'}
                className="editorial-button editorial-button--solid"
                data-clickable
              >
                {phase === 'loading' ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span className="text-[0.72rem]">Загрузка...</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[0.72rem]">Запустить рулетку</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* ─── Wheel ─── */}
        {(phase === 'ready' || phase === 'spinning' || phase === 'result') && (
          <motion.div
            key="wheel"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="flex flex-col items-center"
            ref={containerRef}
          >
            {/* Wheel container */}
            <div className="relative mb-8">
              {/* Pointer (top center) */}
              <div className="absolute -top-4 left-1/2 z-20 -translate-x-1/2">
                <motion.div
                  animate={phase === 'spinning' ? { y: [0, 4, 0] } : {}}
                  transition={phase === 'spinning' ? { duration: 0.15, repeat: Infinity } : {}}
                >
                  <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
                    <path d="M12 28L2 4a2 2 0 011.8-2.8h16.4A2 2 0 0122 4L12 28z" fill="var(--color-accent)" />
                  </svg>
                </motion.div>
              </div>

              {/* The wheel */}
              <motion.div
                className="relative h-72 w-72 overflow-hidden rounded-full border-2 border-[rgb(201_184_154_/_0.25)] sm:h-[22rem] sm:w-[22rem]"
                style={{
                  background: 'var(--color-bg)',
                  boxShadow: '0 0 60px rgb(201 184 154 / 0.08), inset 0 0 40px rgb(0 0 0 / 0.3)',
                }}
                animate={{ rotate: spinAngle }}
                transition={
                  phase === 'spinning'
                    ? { duration: 4, ease: [0.17, 0.67, 0.12, 0.99] }
                    : { duration: 0 }
                }
              >
                {/* Segments */}
                {films.map((film, i) => {
                  const startAngle = i * segmentAngle - 90; // Start from top
                  const title = getFilmTitle(film);
                  const displayTitle = title.length > 14 ? title.slice(0, 12) + '…' : title;

                  return (
                    <div key={getFilmId(film)} className="absolute inset-0">
                      {/* Segment background using conic gradient trick */}
                      <div
                        className="absolute inset-0"
                        style={{
                          background: `conic-gradient(from ${startAngle}deg, ${segmentColors[i % segmentColors.length]} 0deg, ${segmentColors[i % segmentColors.length]} ${segmentAngle}deg, transparent ${segmentAngle}deg)`,
                        }}
                      />
                      {/* Segment border line */}
                      <div
                        className="absolute left-1/2 top-0 h-1/2 w-px origin-bottom"
                        style={{
                          transform: `rotate(${i * segmentAngle}deg)`,
                          background: 'rgb(201 184 154 / 0.12)',
                        }}
                      />
                      {/* Film title label */}
                      <div
                        className="absolute left-1/2 top-0 flex h-1/2 w-0 origin-bottom items-start justify-center pt-4 sm:pt-5"
                        style={{
                          transform: `rotate(${i * segmentAngle + segmentAngle / 2}deg)`,
                        }}
                      >
                        <span
                          className="inline-block max-w-[5.5rem] truncate text-center text-[0.5rem] font-medium uppercase tracking-[0.1em] text-[var(--color-text-secondary)] sm:max-w-[6.5rem] sm:text-[0.56rem]"
                          style={{ transform: 'rotate(180deg)' }}
                        >
                          {displayTitle}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Center circle */}
                <div className="absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[rgb(201_184_154_/_0.2)] bg-[var(--color-bg)] sm:h-20 sm:w-20"
                  style={{ boxShadow: '0 0 20px rgb(0 0 0 / 0.4)' }}
                >
                  <span className="text-2xl sm:text-3xl">🎬</span>
                </div>
              </motion.div>

              {/* Glow ring during spin */}
              <AnimatePresence>
                {phase === 'spinning' && (
                  <motion.div
                    className="pointer-events-none absolute inset-0 rounded-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ boxShadow: '0 0 40px rgb(201 184 154 / 0.2), inset 0 0 40px rgb(201 184 154 / 0.05)' }}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Spin button or result */}
            <AnimatePresence mode="wait">
              {phase === 'ready' && (
                <motion.div
                  key="spin-btn"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex flex-col items-center gap-4"
                >
                  <button
                    type="button"
                    onClick={spin}
                    className="editorial-button editorial-button--solid"
                    data-clickable
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <polygon points="5 3 19 12 5 21 5 3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[0.72rem]">Крутить!</span>
                  </button>
                </motion.div>
              )}

              {phase === 'spinning' && (
                <motion.div
                  key="spinning-label"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="text-[0.72rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)]"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    Выбираем ваш фильм...
                  </motion.div>
                </motion.div>
              )}

              {phase === 'result' && winner && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: EASE }}
                  className="flex w-full max-w-[28rem] flex-col items-center"
                >
                  {/* Winner card */}
                  <motion.button
                    type="button"
                    onClick={() => onFilmClick(getFilmId(winner))}
                    className="group glass-panel flex w-full gap-5 overflow-hidden rounded-[1.5rem] p-4 text-left transition-all hover:border-[rgb(201_184_154_/_0.25)]"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5, ease: EASE }}
                    data-clickable
                  >
                    {/* Poster */}
                    <div className="h-36 w-24 shrink-0 overflow-hidden rounded-[0.8rem]">
                      {winner.posterUrlPreview || winner.posterUrl ? (
                        <img
                          src={winner.posterUrlPreview || winner.posterUrl || ''}
                          alt={getFilmTitle(winner)}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[var(--color-panel)] text-[0.5rem] uppercase text-[var(--color-text-muted)]">
                          Нет постера
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex flex-col justify-center py-1">
                      <div className="text-[0.55rem] uppercase tracking-[0.22em] text-[var(--color-accent)]">
                        Ваш фильм на вечер
                      </div>
                      <h3 className="mt-2 text-lg leading-tight text-[var(--color-text)] transition-colors group-hover:text-white">
                        {getFilmTitle(winner)}
                      </h3>
                      <div className="mt-1.5 flex items-center gap-3">
                        {winner.year && (
                          <span className="text-[0.68rem] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                            {winner.year}
                          </span>
                        )}
                        {(() => {
                          const rating = formatRating(winner.ratingKinopoisk || winner.rating);
                          const rc = rating ? getRatingClass(rating) : null;
                          return rating && rc ? (
                            <span className="text-[0.68rem] tabular-nums" style={{ color: ratingColors[rc] }}>
                              {rating}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      {winner.genres && winner.genres.length > 0 && (
                        <p className="mt-1.5 text-[0.62rem] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                          {winner.genres.map((g) => g.genre).slice(0, 3).join(', ')}
                        </p>
                      )}
                    </div>
                  </motion.button>

                  {/* Actions */}
                  <motion.div
                    className="mt-6 flex flex-wrap items-center justify-center gap-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <button
                      type="button"
                      onClick={respin}
                      className="editorial-button"
                      data-clickable
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                        <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-[0.72rem]">Крутить ещё</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFilms([]); setPhase('idle'); setSpinAngle(0); }}
                      className="editorial-button"
                      data-clickable
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                        <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-[0.72rem]">Новые фильмы</span>
                    </button>
                    <button
                      type="button"
                      onClick={onBack}
                      className="editorial-button"
                      data-clickable
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                        <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-[0.72rem]">К ассистенту</span>
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
