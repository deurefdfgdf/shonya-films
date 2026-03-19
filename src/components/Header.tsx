'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KinoAPI, type Film, getFilmId, getFilmTitle, formatRating } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface HeaderProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  onFilmClick: (id: number) => void;
}

const NAV_ITEMS = [
  { id: 'home', label: 'Главная', num: '01' },
  { id: 'popular', label: 'Популярное', num: '02' },
  { id: 'top250', label: 'Топ 250', num: '03' },
  { id: 'premieres', label: 'Премьеры', num: '04' },
  { id: 'series', label: 'Сериалы', num: '05' },
];

export default function Header({ activeSection, onNavigate, onFilmClick }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Film[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user, signIn, signOut } = useAuth();

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
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

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
        setSearchResults((data.films || data.items || []).slice(0, 6));
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
    <>
      <header
        className="fixed left-0 right-0 top-0 z-50 transition-all duration-500"
        style={{
          height: 'var(--header-height)',
          background: scrolled
            ? 'rgb(10 10 10 / 0.92)'
            : 'linear-gradient(180deg, rgb(10 10 10 / 0.8) 0%, transparent 100%)',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
          borderBottom: scrolled ? '1px solid rgb(220 218 216 / 0.07)' : '1px solid transparent',
        }}
      >
        <div className="section-shell flex h-full items-center gap-6 lg:gap-10">
          {/* Logo */}
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="shrink-0"
            data-clickable
          >
            <span className="display-title block text-[1.1rem] tracking-[0.12em] text-[var(--color-text)] sm:text-[1.2rem]">
              ШОНЯ ФИЛЬМСЫ
            </span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden flex-1 items-center justify-center gap-0.5 md:flex">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className="group relative px-4 py-3 text-[0.65rem] uppercase tracking-[0.24em] transition-colors duration-300"
                  style={{
                    color: isActive ? 'var(--color-text)' : 'var(--color-text-secondary)',
                  }}
                  data-clickable
                >
                  <span className="relative z-10">{item.label}</span>
                  {/* Hover underline */}
                  <span
                    className="absolute inset-x-4 bottom-[0.7rem] h-px origin-left scale-x-0 bg-[var(--color-accent)] transition-transform duration-500 ease-[var(--ease-smooth)] group-hover:scale-x-100"
                    style={{
                      transform: isActive ? 'scaleX(1)' : undefined,
                    }}
                  />
                </button>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            {/* AI button */}
            <button
              type="button"
              onClick={() => {
                onNavigate('ai');
                setMobileMenuOpen(false);
              }}
              className="hidden items-center gap-1.5 rounded-full border px-3.5 py-2 text-[0.56rem] uppercase tracking-[0.22em] transition-all duration-300 hover:bg-[var(--color-accent-soft)] md:inline-flex"
              style={{
                borderColor: activeSection === 'ai' ? 'var(--color-accent)' : 'var(--color-border-strong)',
                color: activeSection === 'ai' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                background: activeSection === 'ai' ? 'var(--color-accent-soft)' : 'transparent',
              }}
              data-clickable
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.4l-6.4 4.8 2.4-7.2-6-4.8h7.6z" />
              </svg>
              ИИ Подбор
            </button>

            {/* Search */}
            <div ref={searchRef} className="relative w-[10rem] sm:w-[13rem] lg:w-[16rem]">
              <label
                className="flex items-center gap-2 border-b pb-2 text-[0.56rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)] transition-colors duration-300 focus-within:border-[var(--color-accent)]"
                style={{
                  borderColor: searchOpen ? 'var(--color-accent)' : 'var(--color-border)',
                }}
                data-clickable
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5 shrink-0">
                  <circle cx="11" cy="11" r="7.5" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => searchQuery.trim().length >= 2 && setSearchOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setSearchOpen(false);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  placeholder="Поиск"
                  className="w-full bg-transparent text-[0.82rem] normal-case tracking-normal text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
                  autoComplete="off"
                  aria-label="Поиск фильма"
                />
              </label>

              {/* Search dropdown */}
              <AnimatePresence>
                {searchOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="glass-panel absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(360px,90vw)] overflow-hidden rounded-[var(--radius-md)]"
                  >
                    {searching ? (
                      <div className="px-4 py-5 text-[0.75rem] text-[var(--color-text-muted)]">Ищем...</div>
                    ) : searchResults.length === 0 ? (
                      <div className="px-4 py-5 text-[0.75rem] text-[var(--color-text-muted)]">Ничего не найдено</div>
                    ) : (
                      searchResults.map((film, index) => (
                        <button
                          key={getFilmId(film) || index}
                          type="button"
                          onClick={() => handleResultClick(film)}
                          className="flex w-full items-center gap-3 border-b border-[var(--color-border)] px-4 py-3 text-left transition-colors duration-200 last:border-b-0 hover:bg-[var(--color-panel-strong)]"
                          data-clickable
                        >
                          <div className="film-frame h-14 w-10 shrink-0 rounded-[var(--radius-sm)]">
                            {film.posterUrlPreview || film.posterUrl ? (
                              <img
                                src={film.posterUrlPreview || film.posterUrl}
                                alt={getFilmTitle(film)}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[0.6rem] text-[var(--color-text-muted)]">
                                —
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[0.82rem] text-[var(--color-text)]">{getFilmTitle(film)}</div>
                            <div className="mt-0.5 text-[0.6rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                              {[film.year, formatRating(film.ratingKinopoisk || film.rating)]
                                .filter(Boolean)
                                .join(' — ')}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {/* Auth */}
            {user ? (
              <div ref={profileRef} className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => setProfileOpen((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[var(--color-border)] transition-colors duration-300 hover:border-[var(--color-border-strong)]"
                  data-clickable
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-[0.6rem] uppercase text-[var(--color-text-secondary)]">
                      {user.displayName?.[0] || '?'}
                    </span>
                  )}
                </button>
                <AnimatePresence>
                  {profileOpen ? (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.2 }}
                      className="glass-panel absolute right-0 top-[calc(100%+0.5rem)] z-50 w-48 rounded-[var(--radius-md)] p-3"
                    >
                      <div className="truncate text-[0.72rem] text-[var(--color-text-secondary)]">
                        {user.displayName || user.email}
                      </div>
                      <button
                        type="button"
                        onClick={() => { onNavigate('profile'); setProfileOpen(false); }}
                        className="mt-2.5 w-full text-left text-[0.6rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)] transition-colors duration-200 hover:text-[var(--color-text)]"
                        data-clickable
                      >
                        Личный кабинет
                      </button>
                      <button
                        type="button"
                        onClick={() => { signOut(); setProfileOpen(false); }}
                        className="mt-2 w-full text-left text-[0.6rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)] transition-colors duration-200 hover:text-[var(--color-text)]"
                        data-clickable
                      >
                        Выйти
                      </button>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : (
              <button
                type="button"
                onClick={signIn}
                className="hidden items-center gap-1.5 rounded-full border border-[var(--color-border-strong)] px-3 py-1.5 text-[0.56rem] uppercase tracking-[0.2em] text-[var(--color-text-secondary)] transition-all duration-300 hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-text)] md:inline-flex"
                data-clickable
              >
                Войти
              </button>
            )}

            {/* Mobile burger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="flex h-10 w-10 flex-col items-center justify-center gap-[5px] md:hidden"
              aria-label="Меню"
              data-clickable
            >
              <motion.span
                className="block h-px w-5 bg-[var(--color-text)]"
                animate={mobileMenuOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.3 }}
              />
              <motion.span
                className="block h-px w-5 bg-[var(--color-text)]"
                animate={mobileMenuOpen ? { opacity: 0 } : { opacity: 1 }}
                transition={{ duration: 0.2 }}
              />
              <motion.span
                className="block h-px w-5 bg-[var(--color-text)]"
                animate={mobileMenuOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.3 }}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Fullscreen mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-40 flex flex-col justify-center bg-[#0a0a0a] px-8 md:hidden"
            style={{ paddingTop: 'var(--header-height)' }}
          >
            <nav className="flex flex-col gap-2">
              {NAV_ITEMS.map((item, index) => {
                const isActive = activeSection === item.id;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                    onClick={() => {
                      onNavigate(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-baseline gap-4 py-3 text-left"
                    data-clickable
                  >
                    <span className="text-[0.6rem] tabular-nums tracking-[0.2em] text-[var(--color-text-muted)]">
                      {item.num}
                    </span>
                    <span
                      className="display-title text-[clamp(2rem,8vw,3.5rem)]"
                      style={{
                        color: isActive ? 'var(--color-text)' : 'var(--color-text-secondary)',
                      }}
                    >
                      {item.label}
                    </span>
                  </motion.button>
                );
              })}

              <motion.button
                type="button"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: NAV_ITEMS.length * 0.06, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => {
                  onNavigate('ai');
                  setMobileMenuOpen(false);
                }}
                className="mt-4 flex items-center gap-3 py-3 text-left"
                data-clickable
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="var(--color-accent)" strokeWidth="1.5">
                  <path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.4l-6.4 4.8 2.4-7.2-6-4.8h7.6z" />
                </svg>
                <span
                  className="display-title text-[clamp(1.8rem,6vw,2.5rem)]"
                  style={{ color: 'var(--color-accent)' }}
                >
                  ИИ Подбор
                </span>
              </motion.button>
            </nav>

            {/* Mobile auth */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="mt-8"
            >
              {user ? (
                <div className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="h-9 w-9 rounded-full border border-[var(--color-border)]" referrerPolicy="no-referrer" />
                  ) : null}
                  <div>
                    <div className="text-[0.8rem] text-[var(--color-text-secondary)]">{user.displayName}</div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => { onNavigate('profile'); setMobileMenuOpen(false); }}
                        className="text-[0.58rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]"
                        data-clickable
                      >
                        Кабинет
                      </button>
                      <span className="text-[0.58rem] text-[var(--color-text-muted)]">·</span>
                      <button
                        type="button"
                        onClick={() => { signOut(); setMobileMenuOpen(false); }}
                        className="text-[0.58rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]"
                        data-clickable
                      >
                        Выйти
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { signIn(); setMobileMenuOpen(false); }}
                  className="rounded-full border border-[var(--color-border-strong)] px-5 py-2.5 text-[0.62rem] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
                  data-clickable
                >
                  Войти через Google
                </button>
              )}
            </motion.div>

            {/* Bottom annotation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="absolute bottom-10 left-8 right-8 flex items-center justify-between text-[0.55rem] uppercase tracking-[0.3em] text-[var(--color-text-muted)]"
            >
              <span>Film archive</span>
              <span>2026</span>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
