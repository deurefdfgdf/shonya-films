'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { KinoAPI, type Film, getFilmId, getFilmTitle } from '@/lib/api';
import FilmCard from './FilmCard';
import ProfileSettings from './ProfileSettings';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { ActivityChart } from '@/components/ui/activity-chart';
import { cn } from '@/lib/utils';

interface ProfileSectionProps {
  onFilmClick: (id: number) => void;
}

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const MONTH_LABELS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

function getTimestamp(addedAt: unknown): number {
  if (addedAt && typeof addedAt === 'object' && 'seconds' in (addedAt as Record<string, unknown>)) {
    return (addedAt as { seconds: number }).seconds;
  }
  return 0;
}

export default function ProfileSection({ onFilmClick }: ProfileSectionProps) {
  const { user, watchedFilms, toggleWatched, signIn } = useAuth();
  const [films, setFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Load film details for all watched films
  useEffect(() => {
    if (!user || watchedFilms.size === 0) {
      setFilms([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const ids = Array.from(watchedFilms.keys());

    Promise.allSettled(ids.map((id) => KinoAPI.getFilmById(id))).then((results) => {
      if (cancelled) return;

      const loaded: Film[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          loaded.push(r.value);
        }
      }

      // Sort by addedAt (newest first)
      loaded.sort((a, b) => {
        const aTime = getTimestamp(watchedFilms.get(getFilmId(a))?.addedAt);
        const bTime = getTimestamp(watchedFilms.get(getFilmId(b))?.addedAt);
        return bTime - aTime;
      });

      setFilms(loaded);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [user, watchedFilms]);

  // Stats
  const stats = useMemo(() => {
    if (films.length === 0) return { count: 0, avgRating: 0, topGenres: [] as string[], totalHours: 0 };

    const genreCount: Record<string, number> = {};
    let ratingSum = 0;
    let ratingCount = 0;
    let totalMinutes = 0;

    for (const film of films) {
      if (film.ratingKinopoisk && typeof film.ratingKinopoisk === 'number') {
        ratingSum += film.ratingKinopoisk;
        ratingCount++;
      }
      if (film.filmLength && typeof film.filmLength === 'number') {
        totalMinutes += film.filmLength;
      }
      for (const g of film.genres || []) {
        if (g.genre) genreCount[g.genre] = (genreCount[g.genre] || 0) + 1;
      }
    }

    const topGenres = Object.entries(genreCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre]) => genre);

    return {
      count: films.length,
      avgRating: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0,
      topGenres,
      totalHours: Math.round(totalMinutes / 60),
    };
  }, [films]);

  // Activity data (films per month, last 12 months)
  const activityData = useMemo(() => {
    const now = new Date();
    const months: { label: string; value: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ label: MONTH_LABELS[d.getMonth()], value: 0 });
    }

    for (const [, watched] of watchedFilms) {
      const ts = getTimestamp(watched.addedAt);
      if (ts === 0) continue;
      const date = new Date(ts * 1000);
      const monthsAgo =
        (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
      if (monthsAgo >= 0 && monthsAgo < 12) {
        months[11 - monthsAgo].value++;
      }
    }

    return months;
  }, [watchedFilms]);

  // All unique genres for filter
  const allGenres = useMemo(() => {
    const genreSet = new Set<string>();
    for (const film of films) {
      for (const g of film.genres || []) {
        if (g.genre) genreSet.add(g.genre);
      }
    }
    return Array.from(genreSet).sort();
  }, [films]);

  // Filtered films
  const filteredFilms = useMemo(() => {
    if (!activeGenre) return films;
    return films.filter((f) => f.genres?.some((g) => g.genre === activeGenre));
  }, [films, activeGenre]);

  // Not logged in
  if (!user) {
    return (
      <div className="pb-20 pt-[calc(var(--header-height)+2.75rem)]">
        <section className="section-shell">
          <motion.div
            className="glass-panel mx-auto max-w-[32rem] rounded-[2rem] px-8 py-16 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[rgb(201_184_154_/_0.15)] bg-[rgb(201_184_154_/_0.06)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" className="h-9 w-9">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h2 className="display-title text-[clamp(1.8rem,4vw,2.8rem)] text-[var(--color-text)]">
              Личный кабинет
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              Войдите чтобы видеть историю просмотров и получать персональные рекомендации
            </p>
            <button
              type="button"
              onClick={signIn}
              className="editorial-button editorial-button--solid mt-8"
              data-clickable
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[0.72rem]">Войти через Google</span>
            </button>
          </motion.div>
        </section>
      </div>
    );
  }

  return (
    <div className="pb-20 pt-[calc(var(--header-height)+2.75rem)]">
      {/* Header */}
      <section className="section-shell relative overflow-hidden">
        <div className="relative z-10">
          <motion.span
            className="eyebrow mb-4"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Личный кабинет
          </motion.span>

          {/* Profile info */}
          <motion.div
            className="flex items-center gap-5"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: EASE }}
          >
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-[rgb(201_184_154_/_0.2)]">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[rgb(201_184_154_/_0.08)] text-2xl text-[var(--color-accent)]">
                  {user.displayName?.[0] || '?'}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="display-title text-[clamp(2rem,4vw,3.5rem)] text-[var(--color-text)]">
                  {user.displayName || 'Пользователь'}
                </h1>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)]"
                  aria-label="Настройки профиля"
                  data-clickable
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
              <p className="mt-1 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                {user.email}
              </p>
            </div>
          </motion.div>

          {/* Stats cards with glow */}
          <motion.div
            className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-stretch"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
          >
            {/* Films count */}
            <div className="relative rounded-[1.5rem] h-full">
              <GlowingEffect
                spread={40}
                glow
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={2}
              />
              <div className="glass-panel relative rounded-[1.5rem] px-6 py-5 h-full">
                <div className="text-[0.6rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                  Просмотрено
                </div>
                <div className="mt-2 display-title text-[2.4rem] leading-none text-[var(--color-text)]">
                  {stats.count}
                </div>
                <div className="mt-1 text-[0.66rem] text-[var(--color-text-muted)]">
                  {stats.count === 1 ? 'фильм' : stats.count >= 2 && stats.count <= 4 ? 'фильма' : 'фильмов'}
                </div>
              </div>
            </div>

            {/* Total hours */}
            <div className="relative rounded-[1.5rem] h-full">
              <GlowingEffect
                spread={40}
                glow
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={2}
              />
              <div className="glass-panel relative rounded-[1.5rem] px-6 py-5 h-full">
                <div className="text-[0.6rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                  Время просмотра
                </div>
                <div className="mt-2 display-title text-[2.4rem] leading-none text-[var(--color-text)]">
                  {stats.totalHours > 0 ? `${stats.totalHours}ч` : '—'}
                </div>
                {stats.totalHours > 0 && (
                  <div className="mt-1 text-[0.66rem] text-[var(--color-text-muted)]">
                    проведено за кино
                  </div>
                )}
              </div>
            </div>

            {/* Top genres */}
            <div className="relative rounded-[1.5rem] h-full">
              <GlowingEffect
                spread={40}
                glow
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={2}
              />
              <div className="glass-panel relative rounded-[1.5rem] px-6 py-5 h-full">
                <div className="text-[0.6rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                  Любимые жанры
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {stats.topGenres.length > 0 ? (
                    stats.topGenres.map((genre) => (
                      <span
                        key={genre}
                        className="rounded-full border border-[rgb(201_184_154_/_0.2)] bg-[rgb(201_184_154_/_0.06)] px-2.5 py-0.5 text-[0.58rem] uppercase tracking-[0.14em] text-[var(--color-accent)]"
                      >
                        {genre}
                      </span>
                    ))
                  ) : (
                    <span className="text-[0.72rem] text-[var(--color-text-muted)]">—</span>
                  )}
                </div>
              </div>
            </div>

            {/* Avg rating */}
            <div className="relative rounded-[1.5rem] h-full">
              <GlowingEffect
                spread={40}
                glow
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={2}
              />
              <div className="glass-panel relative rounded-[1.5rem] px-6 py-5 h-full">
                <div className="text-[0.6rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                  Средний рейтинг
                </div>
                <div className="mt-2 display-title text-[2.4rem] leading-none text-[var(--color-text)]">
                  {stats.avgRating > 0 ? stats.avgRating : '—'}
                </div>
                {stats.avgRating > 0 && (
                  <div className="mt-1 text-[0.66rem] text-[var(--color-text-muted)]">
                    Кинопоиск
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Activity chart */}
          <motion.div
            className="mt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: EASE }}
          >
            <div className="relative rounded-[1.5rem]">
              <GlowingEffect
                spread={40}
                glow
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={2}
              />
              <ActivityChart
                title="Активность за год"
                totalValue={stats.count}
                totalLabel="фильмов за всё время"
                data={activityData}
                className="relative"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Watch history */}
      <section className="section-shell mt-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35, ease: EASE }}
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-[0.68rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
              История просмотров
            </h2>
          </div>

          {/* Genre filter */}
          {allGenres.length > 0 && (
            <div className="mb-8 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveGenre(null)}
                className={cn(
                  'rounded-full border px-3 py-1 text-[0.58rem] uppercase tracking-[0.18em] transition-all duration-300',
                  !activeGenre
                    ? 'border-[var(--color-accent)] bg-[rgb(201_184_154_/_0.1)] text-[var(--color-accent)]'
                    : 'border-[rgb(255_244_227_/_0.08)] text-[var(--color-text-muted)] hover:border-[rgb(255_244_227_/_0.2)]'
                )}
                data-clickable
              >
                Все
              </button>
              {allGenres.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => setActiveGenre(activeGenre === genre ? null : genre)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-[0.58rem] uppercase tracking-[0.18em] transition-all duration-300',
                    activeGenre === genre
                      ? 'border-[var(--color-accent)] bg-[rgb(201_184_154_/_0.1)] text-[var(--color-accent)]'
                      : 'border-[rgb(255_244_227_/_0.08)] text-[var(--color-text-muted)] hover:border-[rgb(255_244_227_/_0.2)]'
                  )}
                  data-clickable
                >
                  {genre}
                </button>
              ))}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i}>
                  <div className="skeleton-shimmer rounded-[var(--radius-md)]" style={{ aspectRatio: '2/3' }} />
                  <div className="mt-3 space-y-1.5">
                    <div className="skeleton-shimmer h-3.5 w-[70%] rounded-full" />
                    <div className="skeleton-shimmer h-2.5 w-[45%] rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Films grid */}
          {!loading && filteredFilms.length > 0 && (
            <div className="grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              <AnimatePresence mode="popLayout">
                {filteredFilms.map((film, index) => {
                  const filmId = getFilmId(film);
                  const title = getFilmTitle(film);
                  return (
                    <motion.div
                      key={filmId}
                      layout
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.3, ease: EASE }}
                      className="group/card relative"
                    >
                      <FilmCard film={film} index={index} onClick={onFilmClick} />
                      <motion.button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWatched(filmId, title);
                        }}
                        className="absolute -right-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[rgb(224_85_85_/_0.3)] bg-[rgb(10_10_10_/_0.9)] text-[#e05555] opacity-0 backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-[rgb(224_85_85_/_0.15)] group-hover/card:opacity-100"
                        data-clickable
                        whileTap={{ scale: 0.85 }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-3.5 w-3.5">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </motion.button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          {/* Empty state */}
          {!loading && films.length === 0 && (
            <motion.div
              className="glass-panel rounded-[1.9rem] px-6 py-16 text-center"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-[rgb(201_184_154_/_0.12)] bg-[rgb(201_184_154_/_0.04)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" className="h-7 w-7">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Вы ещё не отметили ни одного фильма
              </p>
              <p className="mt-2 text-[0.68rem] text-[var(--color-text-muted)]">
                Нажмите «Просмотрено» на странице фильма, чтобы он появился здесь
              </p>
            </motion.div>
          )}

          {/* Filtered empty */}
          {!loading && films.length > 0 && filteredFilms.length === 0 && (
            <div className="glass-panel rounded-[1.9rem] px-6 py-12 text-center text-sm text-[var(--color-text-muted)]">
              Нет фильмов в жанре «{activeGenre}»
            </div>
          )}
        </motion.div>
      </section>

      <ProfileSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
