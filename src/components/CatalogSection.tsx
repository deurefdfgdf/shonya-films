'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';

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
    const uniqueGenres = Array.from(
      new Set((filters?.genres || []).map((item) => item.genre).filter(Boolean))
    ).sort((left, right) => left.localeCompare(right, 'ru'));

    return uniqueGenres.map((genre) => ({ value: genre, label: genre }));
  }, [filters]);

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
      setTotalPages(pagesCount);
    } catch {
      setRawFilms([]);
    }

    setLoading(false);
  }, [type]);

  useEffect(() => {
    void loadFilms();
  }, [loadFilms]);

  const loadMore = async () => {
    const startPage = page + 1;
    const endPage = Math.min(startPage + PAGES_PER_LOAD - 1, totalPages);
    if (startPage > totalPages) {
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
  };

  const filteredFilms = useMemo(() => {
    const genres = new Set(selectedGenres.map((item) => item.value));
    const countries = new Set(selectedCountries.map((item) => item.value));
    const hasGenres = genres.size > 0;
    const hasCountries = countries.size > 0;
    const hasYearFilter =
      yearRange[0] !== defaultYearRange[0] || yearRange[1] !== defaultYearRange[1];

    const next = filterFilms(rawFilms).filter((film) => {
      if (hasGenres) {
        const filmGenres = film.genres?.map((genre) => genre.genre) || [];
        if (!filmGenres.some((genre) => genres.has(genre))) {
          return false;
        }
      }

      if (hasCountries) {
        const filmCountries = film.countries?.map((country) => country.country) || [];
        if (!filmCountries.some((country) => countries.has(country))) {
          return false;
        }
      }

      if (hasYearFilter) {
        if (!film.year) {
          return false;
        }
        if (film.year < yearRange[0] || film.year > yearRange[1]) {
          return false;
        }
      }

      return true;
    });

    return sortFilms(next, order);
  }, [defaultYearRange, order, rawFilms, selectedCountries, selectedGenres, yearRange]);

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
        <section className="section-shell mt-12">
          <motion.div
            className="glass-panel relative overflow-hidden rounded-[2rem] px-5 py-6 sm:px-7 sm:py-7 lg:px-8 lg:py-8"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="pointer-events-none absolute -right-24 top-0 h-56 w-56 rounded-full bg-[rgb(201_184_154_/_0.08)] blur-3xl" />
            <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-[rgb(255_244_227_/_0.05)] blur-3xl" />

            <div className="relative z-10 flex flex-col gap-8">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-[34rem]">
                  <div className="editorial-annotation">Фильтры</div>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)] sm:text-[0.98rem]">
                    Жанры и страны выбираются множественно с поиском, сортировка читается сразу, а диапазон лет задаётся одним контролом.
                  </p>
                </div>

                <div className="flex flex-col gap-4 xl:items-end">
                  <div className="flex flex-wrap items-center gap-3 rounded-[1.4rem] border border-[rgb(255_244_227_/_0.08)] bg-[rgb(255_244_227_/_0.03)] p-2">
                    {SORT_OPTIONS.map((item) => {
                      const active = item.value === order;

                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setOrder(item.value)}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[0.68rem] uppercase tracking-[0.2em] transition-all duration-300',
                            active
                              ? 'bg-[var(--color-accent)] text-black shadow-[0_10px_30px_rgb(201_184_154_/_0.16)]'
                              : 'text-[var(--color-text-secondary)] hover:bg-[rgb(255_244_227_/_0.05)] hover:text-[var(--color-text)]'
                          )}
                          aria-pressed={active}
                          data-clickable
                        >
                          <span
                            className={cn(
                              'h-2 w-2 rounded-full border',
                              active ? 'border-black bg-black' : 'border-[rgb(255_244_227_/_0.22)] bg-transparent'
                            )}
                          />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-3 text-[0.68rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                    <span>Сейчас:</span>
                    <span className="text-[var(--color-text)]">{currentSortLabel}</span>
                  </div>

                  <button
                    type="button"
                    onClick={resetFilters}
                    disabled={!hasAnyControls}
                    className="editorial-button min-h-0 px-4 py-2"
                    data-clickable
                  >
                    <span className="text-[0.68rem]">Сбросить фильтры</span>
                  </button>
                </div>
              </div>

              <div className="grid gap-8 border-t border-[rgb(255_244_227_/_0.08)] pt-7 lg:grid-cols-2">
                <FilterField
                  label="Жанры"
                  meta={selectedGenres.length > 0 ? `${selectedGenres.length} выбрано` : 'Любые жанры'}
                  description="Поиск по названию и множественный выбор без длинного списка."
                >
                  <MultipleSelector
                    value={selectedGenres}
                    onChange={setSelectedGenres}
                    options={genreOptions}
                    placeholder="Выбрать жанры"
                    emptyIndicator={<span>Ничего не найдено</span>}
                    hidePlaceholderWhenSelected
                    selectFirstItem={false}
                    maxSelected={6}
                    className="w-full"
                    badgeClassName="max-w-[12rem]"
                  />
                </FilterField>

                <FilterField
                  label="Страны"
                  meta={selectedCountries.length > 0 ? `${selectedCountries.length} выбрано` : 'Любые страны'}
                  description="Приоритетные страны подняты выше, остальные доступны через поиск."
                >
                  <MultipleSelector
                    value={selectedCountries}
                    onChange={setSelectedCountries}
                    options={countryOptions}
                    groupBy="group"
                    placeholder="Выбрать страны"
                    emptyIndicator={<span>Ничего не найдено</span>}
                    hidePlaceholderWhenSelected
                    selectFirstItem={false}
                    maxSelected={6}
                    className="w-full"
                    badgeClassName="max-w-[12rem]"
                  />
                </FilterField>
              </div>

              <div className="border-t border-[rgb(255_244_227_/_0.08)] pt-7">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <div className="editorial-annotation">Годы</div>
                    <div className="display-title mt-3 text-[clamp(2.5rem,5vw,4.6rem)] text-[var(--color-text)]">
                      {yearRange[0]} — {yearRange[1]}
                    </div>
                    <p className="mt-3 max-w-[30rem] text-sm leading-relaxed text-[var(--color-text-secondary)]">
                      Перетаскивайте диапазон или выбирайте быстрые эпохи, чтобы сузить подборку без перегрузки интерфейса.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:max-w-[34rem] xl:justify-end">
                    {yearPresets.map((preset) => {
                      const active = yearRange[0] === preset.range[0] && yearRange[1] === preset.range[1];
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setYearRange(preset.range)}
                          className={cn(
                            'rounded-full border px-3.5 py-2 text-[0.62rem] uppercase tracking-[0.2em] transition-all duration-300',
                            active
                              ? 'border-[rgb(255_244_227_/_0.26)] bg-[rgb(255_244_227_/_0.08)] text-[var(--color-text)]'
                              : 'border-[rgb(255_244_227_/_0.1)] bg-transparent text-[var(--color-text-muted)] hover:border-[rgb(255_244_227_/_0.18)] hover:text-[var(--color-text)]'
                          )}
                          data-clickable
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-8 rounded-[1.5rem] bg-[rgb(255_244_227_/_0.025)] px-4 py-6 sm:px-6">
                  <div className="mb-4 flex items-center justify-between text-[0.64rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                    <span>{MIN_YEAR}</span>
                    <span>{currentYear}</span>
                  </div>
                  <DualRangeSlider
                    value={yearRange}
                    onValueChange={(value) => setYearRange([value[0], value[1]] as [number, number])}
                    min={MIN_YEAR}
                    max={currentYear}
                    step={1}
                    minStepsBetweenThumbs={1}
                    className="py-3"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4 border-t border-[rgb(255_244_227_/_0.08)] pt-6 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[0.64rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                    Активно
                  </span>
                  {activeChips.length > 0 ? (
                    activeChips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border border-[rgb(255_244_227_/_0.1)] bg-[rgb(255_244_227_/_0.04)] px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.18em] text-[var(--color-text-secondary)]"
                      >
                        {chip}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-[var(--color-text-muted)]">Фильтры не выбраны</span>
                  )}
                </div>

                <div className="text-[0.72rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                  {filteredFilms.length} позиций после фильтрации
                </div>
              </div>
            </div>
          </motion.div>
        </section>
      ) : null}

      <section className="section-shell mt-14">
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
                key={`${film.kinopoiskId || film.filmId}-${index}`}
                film={film}
                index={index}
                onClick={onFilmClick}
              />
            ))
          )}
        </div>

        {showLoadMore && !loading ? (
          <div className="flex justify-center pt-16">
            <motion.button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="editorial-button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              data-clickable
            >
              <span className="text-[0.72rem]">{loadingMore ? 'Загрузка...' : 'Загрузить еще'}</span>
            </motion.button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function FilterField({
  label,
  meta,
  description,
  children,
}: {
  label: string;
  meta: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="editorial-annotation">{label}</div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {description}
          </p>
        </div>
        <span className="text-[0.62rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          {meta}
        </span>
      </div>
      {children}
    </div>
  );
}
