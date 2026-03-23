'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  KinoAPI,
  type Film,
  type StaffPerson,
  getFilmTitle,
  formatRating,
  getRatingClass,
  formatNumber,
  getFilmId,
} from '@/lib/api';
import FilmCard from './FilmCard';
import { useAuth } from '@/contexts/AuthContext';

interface FilmModalProps {
  filmId: number | null;
  onClose: () => void;
  onFilmClick: (id: number) => void;
}

const ratingColors: Record<'high' | 'medium' | 'low', string> = {
  high: 'var(--color-success)',
  medium: 'var(--color-warning)',
  low: 'var(--color-danger)',
};

export default function FilmModal({ filmId, onClose, onFilmClick }: FilmModalProps) {
  const [film, setFilm] = useState<Film | null>(null);
  const [staff, setStaff] = useState<StaffPerson[]>([]);
  const [similar, setSimilar] = useState<Film[]>([]);
  const [trailerYtId, setTrailerYtId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [promptStep, setPromptStep] = useState<'watched' | 'reaction' | null>(null);
  const [writeError, setWriteError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { user, isWatched, toggleWatched, setFilmReaction } = useAuth();
  const watched = filmId ? isWatched(filmId) : false;

  useEffect(() => {
    if (!filmId) { setFilm(null); return; }
    setLoading(true);
    setFilm(null);
    setSimilar([]);
    setTrailerYtId(null);
    setPromptStep(null);
    setWriteError(false);
    clearTimeout(promptTimerRef.current);

    Promise.all([
      KinoAPI.getFilmById(filmId),
      KinoAPI.getFilmStaff(filmId).catch(() => []),
    ])
      .then(([filmData, staffData]) => {
        setFilm(filmData);
        setStaff(Array.isArray(staffData) ? staffData : []);
      })
      .finally(() => setLoading(false));

    KinoAPI.getSimilarFilms(filmId)
      .then((data) => setSimilar(data.items || []))
      .catch(() => { });

    KinoAPI.getFilmVideos(filmId)
      .then((data) => {
        // Find a YouTube trailer
        const yt = data.items?.find(
          (v) =>
            v.site?.toUpperCase() === 'YOUTUBE' ||
            v.url?.toLowerCase().includes('youtube.com') ||
            v.url?.toLowerCase().includes('youtu.be')
        );

        if (yt) {
          const ytUrl = yt.url;
          // Extract video ID from youtube URL
          const match = ytUrl.match(
            /(?:v=|\/embed\/|\/v\/|youtu\.be\/|\/watch\?v=)([a-zA-Z0-9_-]{11})/
          );
          if (match && match[1]) {
            setTrailerYtId(match[1]);
          } else {
            try {
              const urlObj = new URL(ytUrl);
              const v = urlObj.searchParams.get('v');
              if (v) setTrailerYtId(v);
            } catch (e) {
              // Ignore invalid urls
            }
          }
        }
      })
      .catch(() => { });
  }, [filmId]);

  useEffect(() => {
    document.body.style.overflow = filmId ? 'hidden' : '';
    scrollRef.current?.scrollTo(0, 0);
    return () => { document.body.style.overflow = ''; };
  }, [filmId]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleWatchClick = () => {
    if (!filmId) return;
    window.open(`https://www.sspoisk.ru/film/${filmId}/`, '_blank', 'noopener,noreferrer');
    if (user && !watched) {
      setPromptStep('watched');
      clearTimeout(promptTimerRef.current);
      promptTimerRef.current = setTimeout(() => setPromptStep(null), 20000);
    }
  };

  const handleMarkWatched = async () => {
    if (filmId === null) return;
    setWriteError(false);
    const ok = await toggleWatched(filmId, title);
    if (!ok) {
      setWriteError(true);
      return;
    }
    setPromptStep('reaction');
    clearTimeout(promptTimerRef.current);
    promptTimerRef.current = setTimeout(() => setPromptStep(null), 20000);
  };

  const handleReaction = (reaction: 'liked' | 'neutral' | 'disliked') => {
    if (filmId !== null) setFilmReaction(filmId, reaction);
    setPromptStep(null);
    clearTimeout(promptTimerRef.current);
  };

  const dismissPrompt = () => {
    setPromptStep(null);
    setWriteError(false);
    clearTimeout(promptTimerRef.current);
  };

  const isOpen = filmId !== null;
  const title = film ? getFilmTitle(film) : '';
  const originalTitle = film ? film.nameOriginal || film.nameEn || '' : '';
  const rating = film ? formatRating(film.ratingKinopoisk || film.rating) : null;
  const ratingClass = rating ? getRatingClass(rating) : null;
  const genres = film?.genres?.map((g) => g.genre) || [];
  const countries = film?.countries?.map((c) => c.country).join(', ') || '';
  const posterUrl = film?.posterUrl || film?.posterUrlPreview || '';
  const directors = staff.filter((p) => p.professionKey === 'DIRECTOR').slice(0, 3);
  const actors = staff.filter((p) => p.professionKey === 'ACTOR').slice(0, 8);
  const filmLength = film?.filmLength
    ? `${Math.floor(film.filmLength / 60)}ч ${film.filmLength % 60}мин`
    : '';

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <motion.button
            type="button"
            className="absolute inset-0 bg-[rgb(0_0_0_/_0.75)] backdrop-blur-sm"
            onClick={onClose}
            aria-label="Закрыть окно"
          />

          <motion.div
            className="relative z-10 w-full max-w-[1120px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgb(10_10_10_/_0.97)] shadow-[var(--shadow-strong)]"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[rgb(10_10_10_/_0.6)] text-[var(--color-text-secondary)] transition-colors duration-200 hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)]"
              aria-label="Закрыть"
              data-clickable
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {loading ? (
              <div className="flex min-h-[22rem] items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-[var(--color-text-muted)]">
                  <div className="h-8 w-8 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-accent)]" />
                  <span className="text-[0.6rem] uppercase tracking-[0.24em]">Загрузка</span>
                </div>
              </div>
            ) : film ? (
              <div className="grid max-h-[calc(100svh-2rem)] lg:grid-cols-[minmax(260px,0.68fr)_minmax(0,1.32fr)]">
                {/* Poster side */}
                <div className="relative max-h-[13rem] overflow-hidden border-b border-[var(--color-border)] lg:max-h-[calc(100svh-2rem)] lg:border-b-0 lg:border-r">
                  {posterUrl ? (
                    <img src={posterUrl} alt={title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full min-h-[18rem] items-center justify-center text-[0.6rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                      Нет постера
                    </div>
                  )}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(180deg, transparent 30%, rgb(10 10 10 / 0.7) 100%)',
                    }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <div className="text-[0.58rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                      {[film.year, countries].filter(Boolean).join(' — ')}
                    </div>
                  </div>
                </div>

                {/* Content side */}
                <div ref={scrollRef} className="relative flex flex-col min-h-0 overflow-y-auto overscroll-contain px-5 py-5 pb-10 sm:px-7 sm:py-6 sm:pb-8">
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_240px]">
                    <div>
                      <h2 className="display-title text-[clamp(2.4rem,4.5vw,4.2rem)] text-[var(--color-text)]">
                        {title}
                      </h2>
                      {originalTitle && originalTitle !== title ? (
                        <p className="mt-2 text-[0.65rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                          {originalTitle}
                        </p>
                      ) : null}

                      {/* Rating badges */}
                      <div className="mt-5 flex flex-wrap gap-2">
                        {rating && ratingClass ? (
                          <span
                            className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.18em]"
                            style={{ color: ratingColors[ratingClass] }}
                          >
                            KP {rating}
                          </span>
                        ) : null}
                        {film.ratingImdb ? (
                          <span className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                            IMDb {film.ratingImdb}
                          </span>
                        ) : null}
                        {film.ratingKinopoiskVoteCount ? (
                          <span className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                            {formatNumber(film.ratingKinopoiskVoteCount)} оценок
                          </span>
                        ) : null}
                      </div>

                      {/* Genres */}
                      {genres.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {genres.map((genre) => (
                            <span
                              key={genre}
                              className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.16em] text-[var(--color-text-secondary)]"
                            >
                              {genre}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {/* Info grid */}
                      <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        {film.year ? <InfoItem label="Год" value={`${film.year}${film.endYear ? ` — ${film.endYear}` : ''}`} /> : null}
                        {countries ? <InfoItem label="Страна" value={countries} /> : null}
                        {filmLength ? <InfoItem label="Длительность" value={filmLength} /> : null}
                        {film.ratingAgeLimits ? <InfoItem label="Возраст" value={`${film.ratingAgeLimits.replace('age', '')}+`} /> : null}
                        {directors.length > 0 ? (
                          <InfoItem label="Режиссер" value={directors.map((p) => p.nameRu || p.nameEn).join(', ')} />
                        ) : null}
                        {film.slogan ? <InfoItem label="Слоган" value={film.slogan} italic /> : null}
                      </div>

                      {/* Description */}
                      {film.description ? (
                        <section className="mt-6 border-t border-[var(--color-border)] pt-5">
                          <h3 className="text-[0.6rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">Описание</h3>
                          <p className="mt-3 max-w-[40rem] text-[0.88rem] leading-relaxed text-[var(--color-text-secondary)]">
                            {film.description}
                          </p>
                        </section>
                      ) : null}

                      {/* Actors */}
                      {actors.length > 0 ? (
                        <section className="mt-6 border-t border-[var(--color-border)] pt-5">
                          <h3 className="text-[0.6rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">В ролях</h3>
                          <p className="mt-3 text-[0.88rem] leading-relaxed text-[var(--color-text-secondary)]">
                            {actors.map((p) => p.nameRu || p.nameEn).join(', ')}
                          </p>
                        </section>
                      ) : null}
                    </div>

                    {/* Watch sidebar */}
                    <aside className="h-fit rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
                      <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                        Где смотреть
                      </div>
                      <button
                        type="button"
                        onClick={handleWatchClick}
                        className="editorial-button editorial-button--solid mt-4 flex w-full items-center justify-between"
                        data-clickable
                      >
                        <span className="text-[0.65rem] uppercase tracking-[0.18em]">Смотреть</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                          <path d="M7 17L17 7M17 7H7M17 7v10" />
                        </svg>
                      </button>

                      {/* Watched indicator */}
                      {user && watched && (
                        <div className="mt-3 flex items-center justify-between rounded-[var(--radius-full)] border border-[var(--color-success)] bg-[rgb(141_184_154_/_0.1)] px-4 py-2.5 text-[0.6rem] uppercase tracking-[0.18em] text-[var(--color-success)]">
                          <span>Просмотрен</span>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                            <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}

                    </aside>
                  </div>

                  {/* Trailer */}
                  {trailerYtId && (
                    <section className="mt-8 border-t border-[var(--color-border)] pt-6">
                      <h3 className="mb-4 text-[0.6rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">Трейлер</h3>
                      <div className="overflow-hidden rounded-[var(--radius-md)]" style={{ aspectRatio: '16/9' }}>
                        <iframe
                          src={`https://www.youtube.com/embed/${trailerYtId}?autoplay=1&mute=1&rel=0&modestbranding=1`}
                          allow="autoplay; encrypted-media; fullscreen"
                          allowFullScreen
                          className="h-full w-full border-0"
                          title="Трейлер"
                        />
                      </div>
                    </section>
                  )}

                  {/* Similar films */}
                  {similar.length > 0 ? (
                    <section className="mt-8 border-t border-[var(--color-border)] pt-6">
                      <h3 className="mb-4 text-[0.6rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                        Похожие фильмы
                      </h3>
                      <div className="flex gap-3 overflow-x-auto scroll-smooth pb-4">
                        {similar.slice(0, 8).map((item, index) => (
                          <FilmCard
                            key={getFilmId(item) || index}
                            film={item}
                            index={index}
                            onClick={onFilmClick}
                            compact
                          />
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {/* Mobile sticky CTA */}
                  <div className="sticky bottom-0 -mx-5 mt-5 border-t border-[var(--color-border)] bg-[rgb(10_10_10_/_0.96)] px-5 py-3 backdrop-blur-sm xl:hidden">
                    <button
                      type="button"
                      onClick={handleWatchClick}
                      className="editorial-button editorial-button--solid flex w-full items-center justify-between"
                      data-clickable
                    >
                      <span className="text-[0.65rem] uppercase tracking-[0.18em]">Смотреть</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                        <path d="M7 17L17 7M17 7H7M17 7v10" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-5 py-16 text-center text-[0.7rem] text-[var(--color-text-muted)]">
                Ошибка загрузки
              </div>
            )}

            {/* macOS-style overlay prompt */}
            <AnimatePresence>
              {promptStep && (
                <motion.div
                  className="absolute inset-0 z-30 flex items-center justify-center rounded-[inherit] bg-[rgb(0_0_0_/_0.6)] backdrop-blur-[10px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={dismissPrompt}
                >
                  <motion.div
                    className="mx-6 w-full max-w-[300px] rounded-[1.8rem] border border-[rgb(255_255_255_/_0.08)] bg-[rgb(16_16_16_/_0.96)] p-6 shadow-2xl"
                    initial={{ opacity: 0, scale: 0.88, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 8 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {promptStep === 'watched' ? (
                      <>
                        <div className="mb-3 text-[0.58rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                          Новый просмотр
                        </div>
                        <p className="text-[0.88rem] leading-snug text-[var(--color-text-secondary)]">
                          Вы посмотрели{' '}
                          <span className="text-[var(--color-text)]">{title}</span>?
                        </p>
                        <div className="mt-5 flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={handleMarkWatched}
                            className="w-full rounded-[0.85rem] border border-[rgb(232_228_222_/_0.15)] bg-[rgb(232_228_222_/_0.08)] py-2.5 text-[0.63rem] uppercase tracking-[0.18em] text-[var(--color-text)] transition-colors hover:bg-[rgb(232_228_222_/_0.14)]"
                            data-clickable
                          >
                            Да, посмотрел
                          </button>
                          <button
                            type="button"
                            onClick={dismissPrompt}
                            className="w-full py-2 text-[0.6rem] uppercase tracking-[0.18em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
                            data-clickable
                          >
                            Нет, ещё не смотрел
                          </button>
                          {writeError && (
                            <p className="text-center text-[0.6rem] text-[#e05555]">
                              Ошибка сохранения — проверьте правила Firestore
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mb-3 text-[0.58rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                          Ваша оценка
                        </div>
                        <p className="text-[0.88rem] leading-snug text-[var(--color-text-secondary)]">
                          Как вам{' '}
                          <span className="text-[var(--color-text)]">{title}</span>?
                        </p>
                        <div className="mt-5 flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => handleReaction('liked')}
                            className="w-full rounded-[0.85rem] border border-[rgb(141_184_154_/_0.3)] bg-[rgb(141_184_154_/_0.07)] py-2.5 text-[0.63rem] uppercase tracking-[0.18em] text-[var(--color-success)] transition-colors hover:bg-[rgb(141_184_154_/_0.14)]"
                            data-clickable
                          >
                            Понравился
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReaction('neutral')}
                            className="w-full rounded-[0.85rem] border border-[rgb(201_184_154_/_0.15)] bg-[rgb(201_184_154_/_0.04)] py-2.5 text-[0.63rem] uppercase tracking-[0.18em] text-[var(--color-text-secondary)] transition-colors hover:bg-[rgb(201_184_154_/_0.09)]"
                            data-clickable
                          >
                            Нормально
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReaction('disliked')}
                            className="w-full rounded-[0.85rem] border border-[rgb(224_85_85_/_0.2)] bg-[rgb(224_85_85_/_0.05)] py-2.5 text-[0.63rem] uppercase tracking-[0.18em] text-[#e05555] transition-colors hover:bg-[rgb(224_85_85_/_0.1)]"
                            data-clickable
                          >
                            Не понравился
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={dismissPrompt}
                          className="mt-3 w-full py-1 text-[0.58rem] uppercase tracking-[0.16em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
                          data-clickable
                        >
                          Пропустить
                        </button>
                      </>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function InfoItem({ label, value, italic }: { label: string; value: string; italic?: boolean }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
      <div className="text-[0.55rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">{label}</div>
      <div
        className="mt-1.5 text-[0.82rem] leading-relaxed text-[var(--color-text)]"
        style={{ fontStyle: italic ? 'italic' : 'normal' }}
      >
        {value}
      </div>
    </div>
  );
}
