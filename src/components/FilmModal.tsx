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
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filmId) {
      setFilm(null);
      return;
    }

    setLoading(true);
    setFilm(null);
    setSimilar([]);

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
      .catch(() => {});
  }, [filmId]);

  useEffect(() => {
    document.body.style.overflow = filmId ? 'hidden' : '';
    scrollRef.current?.scrollTo(0, 0);
    return () => {
      document.body.style.overflow = '';
    };
  }, [filmId]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const isOpen = filmId !== null;
  const title = film ? getFilmTitle(film) : '';
  const originalTitle = film ? film.nameOriginal || film.nameEn || '' : '';
  const rating = film ? formatRating(film.ratingKinopoisk || film.rating) : null;
  const ratingClass = rating ? getRatingClass(rating) : null;
  const genres = film?.genres?.map((genre) => genre.genre) || [];
  const countries = film?.countries?.map((country) => country.country).join(', ') || '';
  const posterUrl = film?.posterUrl || film?.posterUrlPreview || '';
  const directors = staff.filter((person) => person.professionKey === 'DIRECTOR').slice(0, 3);
  const actors = staff.filter((person) => person.professionKey === 'ACTOR').slice(0, 8);
  const filmLength = film?.filmLength
    ? `${Math.floor(film.filmLength / 60)}ч ${film.filmLength % 60}мин`
    : '';

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
        >
          <motion.button
            type="button"
            className="absolute inset-0 bg-[rgb(0_0_0_/_0.72)] backdrop-blur-md"
            onClick={onClose}
            aria-label="Закрыть окно"
          />

          <motion.div
            className="relative z-10 w-full max-w-[1180px] overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-[rgb(9_9_9_/_0.96)] shadow-[var(--shadow-strong)]"
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-[rgb(0_0_0_/_0.38)] text-lg text-[var(--color-text)] transition-colors duration-300 hover:bg-[rgb(255_244_227_/_0.08)]"
              aria-label="Закрыть"
              data-clickable
            >
              ×
            </button>

            {loading ? (
              <div className="flex min-h-[24rem] items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-[var(--color-text-muted)]">
                  <div className="h-10 w-10 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-accent)]" />
                  <span className="text-[0.72rem] uppercase tracking-[0.26em]">Загрузка</span>
                </div>
              </div>
            ) : film ? (
              <div className="grid max-h-[calc(100svh-2rem)] overflow-hidden lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)]">
                <div className="relative max-h-[14rem] overflow-hidden border-b border-[rgb(255_244_227_/_0.08)] lg:max-h-none lg:border-b-0 lg:border-r">
                  {posterUrl ? (
                    <img
                      src={posterUrl}
                      alt={title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full min-h-[20rem] items-center justify-center text-sm uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
                      Постер недоступен
                    </div>
                  )}

                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(180deg, rgb(5 5 5 / 0.08) 0%, rgb(5 5 5 / 0.26) 34%, rgb(5 5 5 / 0.8) 100%)',
                    }}
                  />

                  <div className="absolute bottom-0 left-0 right-0 p-6 text-[var(--color-text)]">
                    <div className="text-[0.66rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                      Poster frame
                    </div>
                    <div className="mt-3 text-[0.72rem] uppercase tracking-[0.22em] text-[var(--color-text-secondary)]">
                      {[film.year, countries].filter(Boolean).join(' / ') || 'Карточка фильма'}
                    </div>
                  </div>
                </div>

                <div ref={scrollRef} className="overflow-y-auto overscroll-contain px-6 py-6 sm:px-8 sm:py-8">
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
                    <div>
                      <span className="eyebrow mb-4">Фильм</span>
                      <h2 className="display-title text-[clamp(2.8rem,5vw,5rem)] text-[var(--color-text)]">
                        {title}
                      </h2>
                      {originalTitle && originalTitle !== title ? (
                        <p className="mt-3 text-sm uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                          {originalTitle}
                        </p>
                      ) : null}

                      <div className="mt-6 flex flex-wrap gap-3">
                        {rating && ratingClass ? (
                          <div
                            className="rounded-full border border-[var(--color-border)] px-4 py-2 text-[0.78rem] uppercase tracking-[0.22em]"
                            style={{ color: ratingColors[ratingClass] }}
                          >
                            Кинопоиск {rating}
                          </div>
                        ) : null}
                        {film.ratingImdb ? (
                          <div className="rounded-full border border-[var(--color-border)] px-4 py-2 text-[0.78rem] uppercase tracking-[0.22em] text-[var(--color-text-secondary)]">
                            IMDb {film.ratingImdb}
                          </div>
                        ) : null}
                        {film.ratingKinopoiskVoteCount ? (
                          <div className="rounded-full border border-[var(--color-border)] px-4 py-2 text-[0.78rem] uppercase tracking-[0.22em] text-[var(--color-text-secondary)]">
                            {formatNumber(film.ratingKinopoiskVoteCount)} оценок
                          </div>
                        ) : null}
                      </div>

                      {genres.length > 0 ? (
                        <div className="mt-6 flex flex-wrap gap-2">
                          {genres.map((genre) => (
                            <span
                              key={genre}
                              className="rounded-full border border-[var(--color-border)] px-3 py-1 text-[0.7rem] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
                            >
                              {genre}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-8 grid gap-4 sm:grid-cols-2">
                        {film.year ? <InfoItem label="Год" value={`${film.year}${film.endYear ? ` — ${film.endYear}` : ''}`} /> : null}
                        {countries ? <InfoItem label="Страна" value={countries} /> : null}
                        {filmLength ? <InfoItem label="Длительность" value={filmLength} /> : null}
                        {film.ratingAgeLimits ? <InfoItem label="Возраст" value={`${film.ratingAgeLimits.replace('age', '')}+`} /> : null}
                        {directors.length > 0 ? (
                          <InfoItem
                            label="Режиссер"
                            value={directors.map((person) => person.nameRu || person.nameEn).join(', ')}
                          />
                        ) : null}
                        {film.slogan ? <InfoItem label="Слоган" value={film.slogan} italic /> : null}
                      </div>

                      {film.description ? (
                        <section className="mt-8 border-t border-[rgb(255_244_227_/_0.08)] pt-6">
                          <h3 className="text-[0.72rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                            Описание
                          </h3>
                          <p className="mt-4 max-w-[42rem] text-base leading-relaxed text-[var(--color-text-secondary)]">
                            {film.description}
                          </p>
                        </section>
                      ) : null}

                      {actors.length > 0 ? (
                        <section className="mt-8 border-t border-[rgb(255_244_227_/_0.08)] pt-6">
                          <h3 className="text-[0.72rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                            В ролях
                          </h3>
                          <p className="mt-4 text-base leading-relaxed text-[var(--color-text-secondary)]">
                            {actors.map((person) => person.nameRu || person.nameEn).join(', ')}
                          </p>
                        </section>
                      ) : null}
                    </div>

                    <aside className="h-fit rounded-[1.6rem] border border-[var(--color-border)] bg-[rgb(255_244_227_/_0.03)] p-5">
                      <div className="text-[0.72rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                        Где смотреть
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                        Внешняя ссылка сохранена без изменений. Открывается в новой вкладке.
                      </p>

                      <a
                        href={`https://www.sspoisk.ru/film/${filmId}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="editorial-button editorial-button--solid mt-5 flex w-full items-center justify-between"
                        data-clickable
                      >
                        <span className="text-[0.72rem] uppercase tracking-[0.22em]">
                          Смотреть в Шонька плеере
                        </span>
                        <span className="text-lg">↗</span>
                      </a>

                      {film.slogan ? (
                        <blockquote className="mt-6 border-t border-[rgb(255_244_227_/_0.08)] pt-5 text-base italic leading-relaxed text-[var(--color-text-secondary)]">
                          {film.slogan}
                        </blockquote>
                      ) : null}
                    </aside>
                  </div>

                  {similar.length > 0 ? (
                    <section className="mt-10 border-t border-[rgb(255_244_227_/_0.08)] pt-8">
                      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <span className="eyebrow mb-3">Дальше смотреть</span>
                          <h3 className="display-title text-[clamp(2rem,4vw,3rem)] text-[var(--color-text)]">
                            Похожие фильмы
                          </h3>
                        </div>
                      </div>

                      <div className="flex gap-4 overflow-x-auto scroll-hide pb-2">
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

                  <div className="sticky bottom-0 -mx-6 mt-6 border-t border-[rgb(255_244_227_/_0.1)] bg-[rgb(9_9_9_/_0.95)] px-6 py-4 backdrop-blur-md xl:hidden">
                    <a
                      href={`https://www.sspoisk.ru/film/${filmId}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="editorial-button editorial-button--solid flex w-full items-center justify-between"
                      data-clickable
                    >
                      <span className="text-[0.72rem] uppercase tracking-[0.22em]">
                        Смотреть
                      </span>
                      <span className="text-lg">↗</span>
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-6 py-20 text-center text-sm text-[var(--color-text-muted)]">
                Ошибка загрузки
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function InfoItem({
  label,
  value,
  italic,
}: {
  label: string;
  value: string;
  italic?: boolean;
}) {
  return (
    <div className="rounded-[1.2rem] border border-[var(--color-border)] bg-[rgb(255_244_227_/_0.02)] p-4">
      <div className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        {label}
      </div>
      <div
        className="mt-2 text-sm leading-relaxed text-[var(--color-text)]"
        style={{ fontStyle: italic ? 'italic' : 'normal' }}
      >
        {value}
      </div>
    </div>
  );
}
