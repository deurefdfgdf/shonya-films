'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { KinoAPI, type Film, type FiltersResponse, filterFilms } from '@/lib/api';
import { MultipleSelector, type Option } from '@/components/ui/multiple-selector';
import { DualRangeSlider } from '@/components/ui/dual-range-slider';
import { cn } from '@/lib/utils';
import FilmCard from './FilmCard';

interface CatalogSectionProps {
  type: string;
  onFilmClick: (id: number) => void;
}

type SortOrder = 'NUM_VOTE' | 'RATING' | 'YEAR';

const TITLES: Record<string, string> = {
  popular: 'Популярные фильмы',
  top250: 'Топ 250',
  premieres: 'Премьеры',
  series: 'Сериалы',
};

const DESCRIPTIONS: Record<string, string> = {
  popular: 'Самые заметные фильмы каталога без изменения исходной логики переходов и открытия карточек.',
  top250: 'Канон зрительских оценок и устойчивый список фильмов, к которым возвращаются чаще всего.',
  premieres: 'Свежие релизы текущего месяца с тем же содержанием, ссылками и открытием модального окна.',
  series: 'Каталог сериалов с сохранённой фильтрацией и более ясной навигацией по параметрам.',
};

const PAGES_PER_LOAD = 3;
const MIN_YEAR = 1950;
const SORT_OPTIONS: Array<{ value: SortOrder; label: string }> = [
  { value: 'NUM_VOTE', label: 'По оценкам' },
  { value: 'RATING', label: 'По рейтингу' },
  { value: 'YEAR', label: 'По году' },
];
const MAJOR_COUNTRIES = new Set([
  'Россия',
  'США',
  'Великобритания',
  'Франция',
  'Германия',
  'Италия',
  'Испания',
  'Япония',
  'Южная Корея',
  'Корея Южная',
  'Индия',
  'Китай',
  'Канада',
  'Австралия',
]);

function getNumericRating(film: Film) {
  const value = film.ratingKinopoisk ?? film.rating;
  const number = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(number) ? number : 0;
}

function getVoteCount(film: Film) {
  return film.ratingKinopoiskVoteCount ?? 0;
}

function sortFilms(films: Film[], order: SortOrder) {
  const next = [...films];

  next.sort((left, right) => {
    if (order === 'RATING') {
      return getNumericRating(right) - getNumericRating(left) || (right.year ?? 0) - (left.year ?? 0);
    }

    if (order === 'YEAR') {
      return (right.year ?? 0) - (left.year ?? 0) || getNumericRating(right) - getNumericRating(left);
    }

    return getVoteCount(right) - getVoteCount(left) || getNumericRating(right) - getNumericRating(left);
  });

  return next;
}

export default function CatalogSection({ type, onFilmClick }: CatalogSectionProps) {
  const [rawFilms, setRawFilms] = useState<Film[]>([]);
  const [baseFilmsCount, setBaseFilmsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(PAGES_PER_LOAD);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<FiltersResponse | null>(null);

  const [selectedGenres, setSelectedGenres] = useState<Option[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<Option[]>([]);
  const currentYear = new Date().getFullYear();
  const defaultYearRange = useMemo<[number, number]>(() => [MIN_YEAR, currentYear], [currentYear]);
  const [yearRange, setYearRange] = useState<[number, number]>(defaultYearRange);
  const [order, setOrder] = useState<SortOrder>('NUM_VOTE');
  const [premiereMonthOffset, setPremiereMonthOffset] = useState(0);
  const [loadingMorePremieres, setLoadingMorePremieres] = useState(false);

  useEffect(() => {
    setYearRange(defaultYearRange);
  }, [defaultYearRange]);

  useEffect(() => {
    KinoAPI.getFilters().then(setFilters).catch(() => {});
  }, []);

  const orderedCountries = useMemo(
    () =>
      filters?.countries
        ?.filter((item) => item.country)
        .sort((left, right) => {
          const leftMajor = MAJOR_COUNTRIES.has(left.country);
          const rightMajor = MAJOR_COUNTRIES.has(right.country);
          if (leftMajor && !rightMajor) {
            return -1;
          }
          if (!leftMajor && rightMajor) {
            return 1;
          }
          return left.country.localeCompare(right.country, 'ru');
        }) || [],
    [filters]
  );

  const genreOptions = useMemo<Option[]>(() => {
    const fallbackGenres = [
      'аниме','биография','боевик','вестерн','военный','детектив','детский',
      'документальный','драма','история','комедия','короткометражка','криминал',
      'мелодрама','музыка','мультфильм','мюзикл','приключения','семейный',
      'спорт','триллер','ужасы','фантастика','фильм-нуар','фэнтези',
    ];
    const apiGenres = (filters?.genres || []).map((item) => item.genre).filter(Boolean);
    const filmGenres = rawFilms.flatMap((film) => film.genres?.map((g) => g.genre) || []).filter(Boolean);
    const uniqueGenres = Array.from(new Set([...fallbackGenres, ...apiGenres, ...filmGenres]))
      .sort((left, right) => left.localeCompare(right, 'ru'));

    return uniqueGenres.map((genre) => ({ value: genre, label: genre }));
  }, [filters, rawFilms]);

  const countryOptions = useMemo<Option[]>(() => {
    return orderedCountries.map((item) => ({
      value: item.country,
      label: item.country,
      group: MAJOR_COUNTRIES.has(item.country) ? 'Приоритетные страны' : 'Все страны',
    }));
  }, [orderedCountries]);

  const yearPresets = useMemo(
    () => [
      { label: 'Все годы', range: defaultYearRange },
      { label: '2020+', range: [2020, currentYear] as [number, number] },
      { label: '2010-е', range: [2010, 2019] as [number, number] },
      { label: '2000-е', range: [2000, 2009] as [number, number] },
      { label: '90-е', range: [1990, 1999] as [number, number] },
    ],
    [currentYear, defaultYearRange]
  );

  const loadFilms = useCallback(async () => {
    setLoading(true);
    setRawFilms([]);
    setBaseFilmsCount(0);
    setPage(PAGES_PER_LOAD);

    try {
      let result: Film[] = [];
      let pagesCount = 1;

      if (type === 'popular') {
        const pages = await Promise.all(
          Array.from({ length: PAGES_PER_LOAD }, (_, index) =>
            KinoAPI.getTopFilms('TOP_POPULAR_MOVIES', index + 1)
          )
        );
        result = pages.flatMap((data) => data.items || data.films || []);
        pagesCount = pages[0]?.totalPages || 1;
      } else if (type === 'top250') {
        const pages = await Promise.all(
          Array.from({ length: PAGES_PER_LOAD }, (_, index) =>
            KinoAPI.getTopFilms('TOP_250_MOVIES', index + 1)
          )
        );
        result = pages.flatMap((data) => data.items || data.films || []);
        pagesCount = pages[0]?.totalPages || 1;
      } else if (type === 'premieres') {
        const now = new Date();
        const data = await KinoAPI.getPremieres(now.getFullYear(), now.getMonth() + 1);
        result = data.items || [];
        pagesCount = 1;
      } else if (type === 'series') {
        const pages = await Promise.all(
          Array.from({ length: PAGES_PER_LOAD }, (_, index) =>
            KinoAPI.getFilmsWithFilters({ type: 'TV_SERIES', page: index + 1 })
          )
        );
        result = pages.flatMap((data) => data.items || []);
        pagesCount = pages[0]?.totalPages || 1;
      }

      setRawFilms(result);
      setBaseFilmsCount(result.length);
      setTotalPages(pagesCount);
    } catch {
      setRawFilms([]);
    }

    setLoading(false);
  }, [type]);

  useEffect(() => {
    void loadFilms();
  }, [loadFilms]);

  const loadMore = useCallback(async () => {
    const startPage = page + 1;
    const endPage = Math.min(startPage + PAGES_PER_LOAD - 1, totalPages);
    if (startPage > totalPages || loadingMore) {
      return;
    }

    setLoadingMore(true);

    try {
      let newFilms: Film[] = [];
      const pagesToLoad = endPage - startPage + 1;

      if (type === 'popular') {
        const pages = await Promise.all(
          Array.from({ length: pagesToLoad }, (_, index) =>
            KinoAPI.getTopFilms('TOP_POPULAR_MOVIES', startPage + index)
          )
        );
        newFilms = pages.flatMap((data) => data.items || data.films || []);
      } else if (type === 'top250') {
        const pages = await Promise.all(
          Array.from({ length: pagesToLoad }, (_, index) =>
            KinoAPI.getTopFilms('TOP_250_MOVIES', startPage + index)
          )
        );
        newFilms = pages.flatMap((data) => data.items || data.films || []);
      } else if (type === 'series') {
        const pages = await Promise.all(
          Array.from({ length: pagesToLoad }, (_, index) =>
            KinoAPI.getFilmsWithFilters({ type: 'TV_SERIES', page: startPage + index })
          )
        );
        newFilms = pages.flatMap((data) => data.items || []);
      }

      setRawFilms((current) => [...current, ...newFilms]);
      setPage(endPage);
    } catch {
    } finally {
      setLoadingMore(false);
    }
  }, [page, totalPages, loadingMore, type]);

  // Infinite scroll observer
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading || loadingMore || page >= totalPages || type === 'premieres') return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, loadingMore, page, totalPages, type, loadMore]);

  const filteredFilms = useMemo(() => {
    const genres = new Set(selectedGenres.map((item) => item.value));
    const countries = new Set(selectedCountries.map((item) => item.value));
    const hasGenres = genres.size > 0;
    const hasCountries = countries.size > 0;
    const hasYearFilter =
      yearRange[0] !== defaultYearRange[0] || yearRange[1] !== defaultYearRange[1];

    const applyFilters = (films: Film[]) =>
      filterFilms(films).filter((film) => {
        if (hasGenres) {
          const filmGenres = film.genres?.map((genre) => genre.genre) || [];
          if (!filmGenres.some((genre) => genres.has(genre))) return false;
        }
        if (hasCountries) {
          const filmCountries = film.countries?.map((country) => country.country) || [];
          if (!filmCountries.some((country) => countries.has(country))) return false;
        }
        if (hasYearFilter) {
          if (!film.year) return false;
          if (film.year < yearRange[0] || film.year > yearRange[1]) return false;
        }
        return true;
      });

    // Sort base and extra batches independently so load-more never reorders existing films
    const base = applyFilters(rawFilms.slice(0, baseFilmsCount));
    const extra = applyFilters(rawFilms.slice(baseFilmsCount));
    return [...sortFilms(base, order), ...sortFilms(extra, order)];
  }, [defaultYearRange, order, rawFilms, baseFilmsCount, selectedCountries, selectedGenres, yearRange]);

  const loadMorePremieres = async () => {
    setLoadingMorePremieres(true);
    try {
      const nextOffset = premiereMonthOffset + 1;
      const now = new Date();
      const targetDate = new Date(now.getFullYear(), now.getMonth() + nextOffset, 1);
      const data = await KinoAPI.getPremieres(targetDate.getFullYear(), targetDate.getMonth() + 1);
      const newFilms = data.items || [];
      setRawFilms((current) => [...current, ...newFilms]);
      setPremiereMonthOffset(nextOffset);
    } catch {
    } finally {
      setLoadingMorePremieres(false);
    }
  };

  const showFilters = type !== 'premieres';
  const showLoadMore = page < totalPages && type !== 'premieres';
  const currentMonth = new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(new Date());
  const hasYearFilter =
    yearRange[0] !== defaultYearRange[0] || yearRange[1] !== defaultYearRange[1];
  const activeFilterCount =
    selectedGenres.length + selectedCountries.length + (hasYearFilter ? 1 : 0);
  const hasCustomSort = order !== 'NUM_VOTE';
  const hasAnyControls = activeFilterCount > 0 || hasCustomSort;
  const currentSortLabel = SORT_OPTIONS.find((item) => item.value === order)?.label || 'По оценкам';

  const activeChips = [
    ...selectedGenres.map((item) => item.label),
    ...selectedCountries.map((item) => item.label),
    hasYearFilter ? `${yearRange[0]} — ${yearRange[1]}` : null,
  ].filter(Boolean) as string[];

  const resetFilters = () => {
    setSelectedGenres([]);
    setSelectedCountries([]);
    setYearRange(defaultYearRange);
    setOrder('NUM_VOTE');
  };

  const emptyStateText =
    showFilters && hasAnyControls
      ? 'Попробуйте ослабить фильтры или сбросить диапазон лет.'
      : 'Фильмы не найдены';

  return (
    <div className="pb-20 pt-[calc(var(--header-height)+2.75rem)]">
      <section className="section-shell relative overflow-hidden">
        <div className="relative z-10 max-w-[60rem]">
          <motion.span
            className="eyebrow mb-4"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {type === 'premieres' ? currentMonth : 'Каталог'}
          </motion.span>
          <motion.h1
            className="display-title max-w-[7.5ch] text-[clamp(4.2rem,10vw,9.5rem)] text-[var(--color-text)]"
            initial={{ opacity: 0, y: 34 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          >
            {TITLES[type] || 'Каталог'}
          </motion.h1>
          <motion.p
            className="mt-5 max-w-[41rem] text-[1.02rem] leading-relaxed text-[var(--color-text-secondary)]"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.72, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            {DESCRIPTIONS[type] || 'Редакционный каталог без изменения логики переходов.'}
          </motion.p>
        </div>
      </section>

      {showFilters ? (
        <FilterPanel
          order={order}
          setOrder={setOrder}
          selectedGenres={selectedGenres}
          setSelectedGenres={setSelectedGenres}
          selectedCountries={selectedCountries}
          setSelectedCountries={setSelectedCountries}
          yearRange={yearRange}
          setYearRange={setYearRange}
          defaultYearRange={defaultYearRange}
          genreOptions={genreOptions}
          countryOptions={countryOptions}
          yearPresets={yearPresets}
          resetFilters={resetFilters}
          hasAnyControls={hasAnyControls}
          activeFilterCount={activeFilterCount}
          filteredCount={filteredFilms.length}
          currentYear={currentYear}
        />
      ) : null}

      <section className="section-shell mt-14" style={{ overflowAnchor: 'none' } as React.CSSProperties}>
        <div className="mb-8 flex flex-col gap-2 text-[0.7rem] uppercase tracking-[0.26em] text-[var(--color-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>{loading ? 'Загрузка подборки' : `${filteredFilms.length} позиций`}</span>
          <span>
            {type === 'premieres'
              ? currentMonth
              : `Страница ${Math.min(page, totalPages)} / ${totalPages}`}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {loading ? (
            Array.from({ length: 10 }, (_, index) => (
              <div key={index} className="space-y-4">
                <div className="skeleton-shimmer rounded-[1.8rem]" style={{ aspectRatio: '0.71' }} />
                <div className="space-y-2">
                  <div className="skeleton-shimmer h-4 w-[74%] rounded-full" />
                  <div className="skeleton-shimmer h-3 w-[48%] rounded-full" />
                </div>
              </div>
            ))
          ) : filteredFilms.length === 0 ? (
            <div className="glass-panel col-span-full rounded-[1.9rem] px-6 py-16 text-center text-sm text-[var(--color-text-muted)]">
              {emptyStateText}
            </div>
          ) : (
            filteredFilms.map((film, index) => (
              <FilmCard
                key={film.kinopoiskId ?? film.filmId ?? index}
                film={film}
                index={index}
                onClick={onFilmClick}
              />
            ))
          )}
        </div>

        {/* Infinite scroll sentinel */}
        {showLoadMore && !loading && (
          <div ref={sentinelRef} className="flex justify-center pt-16">
            {loadingMore && (
              <div className="flex flex-col items-center gap-3 text-[var(--color-text-muted)]">
                <div className="h-8 w-8 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-accent)]" />
                <span className="text-[0.6rem] uppercase tracking-[0.24em]">Загрузка</span>
              </div>
            )}
          </div>
        )}

        {/* Manual button for premieres */}
        {type === 'premieres' && !loading ? (
          <div className="flex justify-center pt-16">
            <motion.button
              type="button"
              onClick={loadMorePremieres}
              disabled={loadingMorePremieres}
              className="editorial-button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              data-clickable
            >
              <span className="text-[0.72rem]">
                {loadingMorePremieres ? 'Загрузка...' : 'Загрузить следующий месяц'}
              </span>
            </motion.button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

/* ─── Compact Filter Panel ─── */

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

function FilterPanel({
  order,
  setOrder,
  selectedGenres,
  setSelectedGenres,
  selectedCountries,
  setSelectedCountries,
  yearRange,
  setYearRange,
  defaultYearRange,
  genreOptions,
  countryOptions,
  yearPresets,
  resetFilters,
  hasAnyControls,
  activeFilterCount,
  filteredCount,
  currentYear,
}: {
  order: SortOrder;
  setOrder: (v: SortOrder) => void;
  selectedGenres: Option[];
  setSelectedGenres: (v: Option[]) => void;
  selectedCountries: Option[];
  setSelectedCountries: (v: Option[]) => void;
  yearRange: [number, number];
  setYearRange: (v: [number, number]) => void;
  defaultYearRange: [number, number];
  genreOptions: Option[];
  countryOptions: Option[];
  yearPresets: Array<{ label: string; range: [number, number] }>;
  resetFilters: () => void;
  hasAnyControls: boolean;
  activeFilterCount: number;
  filteredCount: number;
  currentYear: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasYearFilter = yearRange[0] !== defaultYearRange[0] || yearRange[1] !== defaultYearRange[1];

  // Removable active chips
  const activeChips: Array<{ label: string; onRemove: () => void }> = [
    ...selectedGenres.map((g) => ({
      label: g.label,
      onRemove: () => setSelectedGenres(selectedGenres.filter((x) => x.value !== g.value)),
    })),
    ...selectedCountries.map((c) => ({
      label: c.label,
      onRemove: () => setSelectedCountries(selectedCountries.filter((x) => x.value !== c.value)),
    })),
    ...(hasYearFilter
      ? [{
          label: `${yearRange[0]}–${yearRange[1]}`,
          onRemove: () => setYearRange(defaultYearRange),
        }]
      : []),
  ];

  return (
    <section className="section-shell mt-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        {/* Compact bar — always visible */}
        <div className="glass-panel rounded-[1.5rem] px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Toggle expand */}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[0.62rem] uppercase tracking-[0.2em] transition-all duration-300',
                expanded
                  ? 'border-[var(--color-accent)] bg-[rgb(201_184_154_/_0.1)] text-[var(--color-accent)]'
                  : 'border-[rgb(255_244_227_/_0.12)] text-[var(--color-text-secondary)] hover:border-[rgb(255_244_227_/_0.25)]'
              )}
              data-clickable
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn('h-3.5 w-3.5 transition-transform duration-300', expanded && 'rotate-180')}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
              <span>Фильтры</span>
              {activeFilterCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-accent)] text-[0.5rem] font-medium text-black">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Sort pills — always visible */}
            <div className="flex items-center gap-1 rounded-full border border-[rgb(255_244_227_/_0.08)] bg-[rgb(255_244_227_/_0.02)] p-1">
              {SORT_OPTIONS.map((item) => {
                const active = item.value === order;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setOrder(item.value)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-[0.58rem] uppercase tracking-[0.18em] transition-all duration-300',
                      active
                        ? 'bg-[var(--color-accent)] text-black'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                    )}
                    data-clickable
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Year presets — always visible */}
            <div className="hidden items-center gap-1 sm:flex">
              {yearPresets.map((preset) => {
                const active = yearRange[0] === preset.range[0] && yearRange[1] === preset.range[1];
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setYearRange(preset.range)}
                    className={cn(
                      'rounded-full px-2.5 py-1.5 text-[0.56rem] uppercase tracking-[0.16em] transition-all duration-300',
                      active
                        ? 'bg-[rgb(255_244_227_/_0.1)] text-[var(--color-text)]'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                    )}
                    data-clickable
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Count + reset */}
            <span className="text-[0.58rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              {filteredCount}
            </span>
            {hasAnyControls && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[0.58rem] uppercase tracking-[0.18em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                data-clickable
              >
                Сбросить
              </button>
            )}
          </div>

          {/* Active chips row */}
          {activeChips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {activeChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.onRemove}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-[rgb(255_244_227_/_0.1)] bg-[rgb(255_244_227_/_0.04)] px-2.5 py-1 text-[0.56rem] uppercase tracking-[0.16em] text-[var(--color-text-secondary)] transition-all hover:border-[rgb(224_85_85_/_0.3)] hover:text-[#e05555]"
                  data-clickable
                >
                  {chip.label}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="h-2.5 w-2.5 opacity-50 group-hover:opacity-100">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Expanded panel */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
              exit={{ overflow: 'hidden', height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              style={{ overflow: 'hidden' }}
            >
              <div className="glass-panel mt-2 rounded-[1.5rem] px-4 py-5 sm:px-6 sm:py-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Genres */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[0.58rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">Жанры</span>
                      {selectedGenres.length > 0 && (
                        <span className="text-[0.54rem] uppercase tracking-[0.18em] text-[var(--color-accent)]">{selectedGenres.length} выбрано</span>
                      )}
                    </div>
                    <MultipleSelector
                      value={selectedGenres}
                      onChange={setSelectedGenres}
                      options={genreOptions}
                      placeholder="Поиск жанров..."
                      emptyIndicator={<span>Не найдено</span>}
                      hidePlaceholderWhenSelected
                      selectFirstItem={false}
                      maxSelected={6}
                      className="w-full"
                      badgeClassName="max-w-[10rem]"
                    />
                  </div>

                  {/* Countries */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[0.58rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">Страны</span>
                      {selectedCountries.length > 0 && (
                        <span className="text-[0.54rem] uppercase tracking-[0.18em] text-[var(--color-accent)]">{selectedCountries.length} выбрано</span>
                      )}
                    </div>
                    <MultipleSelector
                      value={selectedCountries}
                      onChange={setSelectedCountries}
                      options={countryOptions}
                      groupBy="group"
                      placeholder="Поиск стран..."
                      emptyIndicator={<span>Не найдено</span>}
                      hidePlaceholderWhenSelected
                      selectFirstItem={false}
                      maxSelected={6}
                      className="w-full"
                      badgeClassName="max-w-[10rem]"
                    />
                  </div>
                </div>

                {/* Year slider */}
                <div className="mt-6 border-t border-[rgb(255_244_227_/_0.06)] pt-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.58rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">Годы</span>
                    <span className="text-[0.72rem] tabular-nums text-[var(--color-text-secondary)]">
                      {yearRange[0]} — {yearRange[1]}
                    </span>
                  </div>

                  {/* Mobile year presets */}
                  <div className="mt-3 flex flex-wrap gap-1.5 sm:hidden">
                    {yearPresets.map((preset) => {
                      const active = yearRange[0] === preset.range[0] && yearRange[1] === preset.range[1];
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setYearRange(preset.range)}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[0.54rem] uppercase tracking-[0.16em] transition-all duration-300',
                            active
                              ? 'border-[rgb(255_244_227_/_0.25)] bg-[rgb(255_244_227_/_0.08)] text-[var(--color-text)]'
                              : 'border-[rgb(255_244_227_/_0.08)] text-[var(--color-text-muted)]'
                          )}
                          data-clickable
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 px-1">
                    <DualRangeSlider
                      value={yearRange}
                      onValueChange={(value) => setYearRange([value[0], value[1]] as [number, number])}
                      min={MIN_YEAR}
                      max={currentYear}
                      step={1}
                      minStepsBetweenThumbs={1}
                      className="py-2"
                    />
                    <div className="mt-1 flex items-center justify-between text-[0.5rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                      <span>{MIN_YEAR}</span>
                      <span>{currentYear}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
