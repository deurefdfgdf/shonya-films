'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KinoAPI, type Film, getFilmId, getFilmTitle, formatRating } from '@/lib/api';

interface HeaderProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  onFilmClick: (id: number) => void;
}

const NAV_ITEMS = [
  { id: 'home', label: 'Главная' },
  { id: 'popular', label: 'Популярное' },
  { id: 'top250', label: 'Топ 250' },
  { id: 'premieres', label: 'Премьеры' },
  { id: 'series', label: 'Сериалы' },
  // { id: 'ai', label: 'ИИ Подбор' }, // TODO: раскомментировать когда будет рабочий OpenRouter ключ
];

export default function Header({ activeSection, onNavigate, onFilmClick }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Film[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (value.trim().length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      setSearching(false);
      return;
    }

    setSearchOpen(true);
    setSearching(true);

    searchTimeout.current = setTimeout(async () => {
      try {
        const data = await KinoAPI.searchFilms(value.trim());
        setSearchResults((data.films || data.items || []).slice(0, 8));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
  }, []);

  const handleResultClick = (film: Film) => {
    onFilmClick(getFilmId(film));
    setSearchOpen(false);
    setSearchQuery('');
    setMobileMenuOpen(false);
  };

  return (
    <header
      className="fixed left-0 right-0 top-0 z-50"
      style={{
        height: 'var(--header-height)',
        background: scrolled
          ? 'rgb(8 8 8 / 0.84)'
          : 'linear-gradient(180deg, rgb(8 8 8 / 0.72) 0%, rgb(8 8 8 / 0.22) 100%)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderBottom: scrolled ? '1px solid rgb(255 244 227 / 0.08)' : '1px solid rgb(255 244 227 / 0.04)',
      }}
    >
      <div className="section-shell flex h-full items-center gap-4 lg:gap-8">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="shrink-0 text-left"
          data-clickable
        >
          <span className="block text-[0.58rem] uppercase tracking-[0.34em] text-[var(--color-text-muted)]">
            Film archive
          </span>
          <span className="mt-1 block text-[1.06rem] uppercase tracking-[0.18em] text-[var(--color-text-secondary)] sm:text-[1.15rem]">
            Шоня Фильмсы
          </span>
        </button>

        <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`relative px-4 py-3 text-[0.6rem] uppercase tracking-[0.32em] transition-colors duration-500${
                  item.id === 'ai' ? ' rounded-full border border-[rgb(201_184_154_/_0.2)] ml-2' : ''
                }`}
                style={{
                  color: item.id === 'ai'
                    ? (isActive ? 'var(--color-accent)' : 'rgb(201 184 154 / 0.7)')
                    : (isActive ? 'var(--color-text-secondary)' : 'rgb(255 244 227 / 0.52)'),
                }}
                data-clickable
              >
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  {item.id === 'ai' && (
                    <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" stroke="var(--color-accent)" strokeWidth="2">
                      <path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.4l-6.4 4.8 2.4-7.2-6-4.8h7.6z" />
                    </svg>
                  )}
                  {item.label}
                </span>
                {isActive ? (
                  <motion.span
                    layoutId="header-line"
                    className="absolute inset-x-4 bottom-[0.78rem] h-px bg-[rgb(255_244_227_/_0.76)]"
                    transition={{ type: 'spring', stiffness: 360, damping: 38 }}
                  />
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5 sm:gap-3.5">
          <div ref={searchRef} className="relative w-[11.5rem] sm:w-[15rem] lg:w-[18.5rem]">
            <label
              className="flex items-center gap-2.5 border-b border-[rgb(255_244_227_/_0.12)] pb-2 text-[0.58rem] uppercase tracking-[0.28em] text-[var(--color-text-muted)] transition-colors duration-300 focus-within:border-[rgb(255_244_227_/_0.3)]"
              data-clickable
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-3.5 w-3.5 shrink-0"
              >
                <circle cx="11" cy="11" r="7.5" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => handleSearch(event.target.value)}
                onFocus={() => searchQuery.trim().length >= 2 && setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setSearchOpen(false);
                    (event.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Поиск"
                className="w-full bg-transparent text-[0.86rem] normal-case tracking-normal text-[var(--color-text)] placeholder:text-[rgb(255_244_227_/_0.36)] focus:outline-none"
                autoComplete="off"
                aria-label="Поиск фильма"
              />
            </label>

            <AnimatePresence>
              {searchOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                  className="glass-panel absolute right-0 top-[calc(100%+1rem)] z-50 w-full overflow-hidden rounded-[1.5rem]"
                >
                  {searching ? (
                    <div className="px-5 py-6 text-sm text-[var(--color-text-muted)]">Ищем фильм...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-5 py-6 text-sm text-[var(--color-text-muted)]">Ничего не найдено</div>
                  ) : (
                    searchResults.map((film, index) => (
                      <button
                        key={getFilmId(film) || index}
                        type="button"
                        onClick={() => handleResultClick(film)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-300 hover:bg-[rgb(255_244_227_/_0.05)]"
                        style={{
                          borderBottom:
                            index === searchResults.length - 1
                              ? 'none'
                              : '1px solid rgb(255 244 227 / 0.06)',
                        }}
                        data-clickable
                      >
                        <div className="film-frame h-16 w-11 shrink-0 rounded-[0.95rem]">
                          {film.posterUrlPreview || film.posterUrl ? (
                            <img
                              src={film.posterUrlPreview || film.posterUrl}
                              alt={getFilmTitle(film)}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-[var(--color-text-muted)]">
                              Нет
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-[var(--color-text)]">{getFilmTitle(film)}</div>
                          <div className="mt-1 text-[0.66rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                            {[film.year, formatRating(film.ratingKinopoisk || film.rating)]
                              .filter(Boolean)
                              .join(' / ')}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="flex h-10 w-10 flex-col items-center justify-center gap-[4px] md:hidden"
            aria-label="Меню"
            data-clickable
          >
            <motion.span
              className="block h-px w-5 bg-[var(--color-text)]"
              animate={mobileMenuOpen ? { rotate: 45, y: 5 } : { rotate: 0, y: 0 }}
            />
            <motion.span
              className="block h-px w-5 bg-[var(--color-text)]"
              animate={mobileMenuOpen ? { opacity: 0 } : { opacity: 1 }}
            />
            <motion.span
              className="block h-px w-5 bg-[var(--color-text)]"
              animate={mobileMenuOpen ? { rotate: -45, y: -5 } : { rotate: 0, y: 0 }}
            />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen ? (
          <motion.nav
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="border-b border-[rgb(255_244_227_/_0.06)] bg-[rgb(8_8_8_/_0.94)] px-5 py-5 md:hidden"
          >
            <div className="mx-auto flex max-w-[var(--container-width)] flex-col gap-1.5">
              {NAV_ITEMS.map((item, index) => {
                const isActive = activeSection === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigate(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center justify-between rounded-[1.1rem] border px-4 py-4 text-left text-[0.66rem] uppercase tracking-[0.28em] transition-colors duration-300"
                    style={{
                      color: isActive ? 'var(--color-text)' : 'var(--color-text-secondary)',
                      background: isActive ? 'rgb(255 244 227 / 0.05)' : 'transparent',
                      borderColor: isActive ? 'rgb(255 244 227 / 0.08)' : 'rgb(255 244 227 / 0.04)',
                    }}
                    data-clickable
                  >
                    <span>{item.label}</span>
                    <span className="text-[var(--color-text-muted)]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

