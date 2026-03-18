'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { type Film, getFilmId, getFilmTitle } from '@/lib/api';
import {
  getQuickRecommendations,
  getProbeFilms,
  getFinalRecommendations,
  resolveFilmNames,
} from '@/lib/ai';
import FilmCard from './FilmCard';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface AiAssistantProps {
  onFilmClick: (id: number) => void;
}

type AiPhase =
  | 'mode-select'
  | 'quick-tags'
  | 'quick-loading'
  | 'quick-results'
  | 'deep-input'
  | 'deep-loading'
  | 'deep-probe'
  | 'deep-refine-loading'
  | 'deep-results'
  | 'error';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const MOOD_CARDS = [
  { id: 'tense', icon: '🔪', label: 'Напряжённый вечер', tags: ['триллер', 'напряжение', 'саспенс'] },
  { id: 'laugh', icon: '😂', label: 'Посмеяться', tags: ['комедия', 'лёгкий', 'весёлый'] },
  { id: 'think', icon: '🧠', label: 'Подумать о жизни', tags: ['драма', 'философский', 'глубокий'] },
  { id: 'romance', icon: '💕', label: 'Романтика', tags: ['мелодрама', 'любовь', 'романтический'] },
  { id: 'horror', icon: '👻', label: 'Пощекотать нервы', tags: ['ужасы', 'хоррор', 'жуткий'] },
  { id: 'adventure', icon: '🗺️', label: 'Приключения', tags: ['приключения', 'экшен', 'путешествие'] },
  { id: 'scifi', icon: '🚀', label: 'Будущее и космос', tags: ['фантастика', 'космос', 'будущее'] },
  { id: 'family', icon: '🏠', label: 'С семьёй', tags: ['семейный', 'анимация', 'добрый'] },
  { id: 'mystery', icon: '🔍', label: 'Загадка', tags: ['детектив', 'загадка', 'расследование'] },
  { id: 'anime', icon: '⛩️', label: 'Аниме', tags: ['аниме', 'японская анимация'] },
  { id: 'classic', icon: '🎬', label: 'Классика кино', tags: ['классика', 'культовый', 'шедевр'] },
  { id: 'documentary', icon: '📹', label: 'Документалка', tags: ['документальный', 'реальная история'] },
];

const STORAGE_KEYS = {
  lastTags: 'shonya-ai-last-tags',
  lastQuery: 'shonya-ai-last-query',
} as const;

function loadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/* ─── Floating Tag Component ─── */

function FloatingTag({
  tag,
  index,
  total,
  mouseX,
  mouseY,
}: {
  tag: string;
  index: number;
  total: number;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  mouseY: ReturnType<typeof useMotionValue<number>>;
}) {
  const springX = useSpring(mouseX, { damping: 22 + index * 4, stiffness: 120, mass: 0.6 });
  const springY = useSpring(mouseY, { damping: 22 + index * 4, stiffness: 120, mass: 0.6 });
  const angle = (index / total) * Math.PI * 2;
  const radius = 70 + (index % 3) * 30;
  const offsetX = Math.cos(angle) * radius;
  const offsetY = Math.sin(angle) * radius;

  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-[9999]"
      style={{ x: springX, y: springY }}
    >
      <motion.span
        className="absolute whitespace-nowrap rounded-full border border-[rgb(201_184_154_/_0.25)] bg-[rgb(10_10_10_/_0.8)] px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.18em] text-[var(--color-accent)] backdrop-blur-sm"
        initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
        animate={{ opacity: 1 - index * 0.1, scale: 1, x: offsetX, y: offsetY }}
        exit={{ opacity: 0, scale: 0 }}
        transition={{ delay: index * 0.12, duration: 0.6, ease: EASE }}
        style={{ translateX: '-50%', translateY: '-50%' }}
      >
        {tag}
      </motion.span>
    </motion.div>
  );
}

/* ─── Loading Animation ─── */

function AiLoadingView({ tags }: { tags?: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(window.matchMedia('(pointer: fine)').matches);
    const handler = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener('mousemove', handler, { passive: true });
    return () => window.removeEventListener('mousemove', handler);
  }, [mouseX, mouseY]);

  return (
    <motion.div
      key="loading"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      {/* Tags on mobile */}
      {tags && tags.length > 0 && !isDesktop && (
        <div className="mb-6 flex flex-wrap gap-2">
          {tags.map((tag, i) => (
            <motion.span
              key={tag}
              className="rounded-full border border-[rgb(201_184_154_/_0.2)] bg-[rgb(201_184_154_/_0.06)] px-3 py-1 text-[0.58rem] uppercase tracking-[0.18em] text-[var(--color-accent)]"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08, duration: 0.4, ease: EASE }}
            >
              {tag}
            </motion.span>
          ))}
        </div>
      )}

      <div className="relative" ref={containerRef}>
        {/* Search icon flying between cards */}
        <motion.div
          className="pointer-events-none absolute z-10"
          animate={{
            x: ['10%', '55%', '85%', '10%', '55%', '85%', '10%'],
            y: ['8%', '8%', '8%', '55%', '55%', '55%', '8%'],
          }}
          transition={{ duration: 6, ease: 'easeInOut', repeat: Infinity }}
        >
          <motion.div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{
              background: 'rgb(196 191 182 / 0.1)',
              boxShadow: '0 0 30px rgb(196 191 182 / 0.15)',
            }}
            animate={{
              boxShadow: [
                '0 0 20px rgb(196 191 182 / 0.1)',
                '0 0 40px rgb(196 191 182 / 0.25)',
                '0 0 20px rgb(196 191 182 / 0.1)',
              ],
              scale: [1, 1.15, 1],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" className="h-6 w-6">
              <circle cx="11" cy="11" r="7.5" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </motion.div>
        </motion.div>

        {/* Skeleton grid */}
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4, ease: EASE }}
              className="space-y-4"
            >
              <div className="skeleton-shimmer rounded-[1.8rem]" style={{ aspectRatio: '0.71' }} />
              <div className="space-y-2">
                <div className="skeleton-shimmer h-4 w-[74%] rounded-full" />
                <div className="skeleton-shimmer h-3 w-[48%] rounded-full" />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <motion.div
            className="inline-flex items-center gap-3 text-[0.72rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)]"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="h-2 w-2 animate-spin rounded-full border border-[var(--color-accent)] border-t-transparent" />
            Подбираем фильмы
          </motion.div>
        </div>
      </div>

      {/* Floating tags near cursor (desktop only, deep mode) */}
      {isDesktop && tags && tags.length > 0 && (
        <AnimatePresence>
          {tags.map((tag, i) => (
            <FloatingTag key={tag} tag={tag} index={i} total={tags.length} mouseX={mouseX} mouseY={mouseY} />
          ))}
        </AnimatePresence>
      )}
    </motion.div>
  );
}

/* ─── Probe Film Card ─── */

function ProbeCard({
  film,
  index,
  verdict,
  onVerdict,
  onFilmClick,
}: {
  film: Film;
  index: number;
  verdict?: 'liked' | 'disliked' | 'skipped';
  onVerdict: (v: 'liked' | 'disliked' | 'skipped') => void;
  onFilmClick: (id: number) => void;
}) {
  const title = getFilmTitle(film);
  const posterUrl = film.posterUrlPreview || film.posterUrl || '';
  const year = film.year || '';
  const genres = film.genres?.map((g) => g.genre).slice(0, 2).join(', ') || '';
  const filmId = getFilmId(film);

  return (
    <motion.div
      className="glass-panel overflow-hidden rounded-[1.5rem]"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.5, ease: EASE }}
    >
      <button
        type="button"
        onClick={() => onFilmClick(filmId)}
        className="w-full text-left"
        data-clickable
      >
        <div className="film-frame relative" style={{ aspectRatio: '0.71' }}>
          {posterUrl ? (
            <img src={posterUrl} alt={title} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[0.68rem] uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
              Нет постера
            </div>
          )}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(180deg, rgb(5 5 5 / 0.05) 0%, rgb(5 5 5 / 0.14) 26%, rgb(5 5 5 / 0.82) 100%)',
            }}
          />
        </div>
        <div className="px-4 pt-3">
          <h3 className="text-sm leading-tight text-[var(--color-text)]">{title}</h3>
          <p className="mt-1 text-[0.66rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
            {[year, genres].filter(Boolean).join(' / ')}
          </p>
        </div>
      </button>

      <div className="flex items-center justify-center gap-3 px-3 pb-4 pt-3">
        {/* Dislike */}
        <motion.button
          type="button"
          onClick={() => onVerdict('disliked')}
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all duration-300',
            verdict === 'disliked'
              ? 'border-[#e05555] bg-[rgb(224_85_85_/_0.15)] text-[#e05555] scale-110'
              : 'border-[rgb(255_244_227_/_0.12)] text-[var(--color-text-muted)] hover:border-[#e05555] hover:text-[#e05555]'
          )}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.9 }}
          data-clickable
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-5 w-5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </motion.button>

        {/* Skip */}
        <motion.button
          type="button"
          onClick={() => onVerdict('skipped')}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-300',
            verdict === 'skipped'
              ? 'border-[rgb(255_244_227_/_0.3)] bg-[rgb(255_244_227_/_0.08)] text-[var(--color-text-secondary)]'
              : 'border-[rgb(255_244_227_/_0.08)] text-[var(--color-text-muted)] hover:border-[rgb(255_244_227_/_0.2)]'
          )}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          data-clickable
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
            <path d="M5 12h14" />
          </svg>
        </motion.button>

        {/* Like */}
        <motion.button
          type="button"
          onClick={() => onVerdict('liked')}
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all duration-300',
            verdict === 'liked'
              ? 'border-[#55c878] bg-[rgb(85_200_120_/_0.15)] text-[#55c878] scale-110'
              : 'border-[rgb(255_244_227_/_0.12)] text-[var(--color-text-muted)] hover:border-[#55c878] hover:text-[#55c878]'
          )}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.9 }}
          data-clickable
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-5 w-5">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ─── Main Component ─── */

export default function AiAssistant({ onFilmClick }: AiAssistantProps) {
  const [phase, setPhase] = useState<AiPhase>('mode-select');
  const [selectedMoods, setSelectedMoods] = useState<string[]>(() =>
    loadStorage<string[]>(STORAGE_KEYS.lastTags, [])
  );
  const [userQuery, setUserQuery] = useState(() =>
    loadStorage<string>(STORAGE_KEYS.lastQuery, '')
  );
  const [extractedTags, setExtractedTags] = useState<string[]>([]);
  const [probeFilms, setProbeFilms] = useState<Film[]>([]);
  const [probeFilmNames, setProbeFilmNames] = useState<string[]>([]); // kept for refine step
  const [feedback, setFeedback] = useState<Record<number, 'liked' | 'disliked' | 'skipped'>>({});
  const [resultFilms, setResultFilms] = useState<Film[]>([]);
  const [resultReasons, setResultReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const { watchedFilmTitles } = useAuth();

  const toggleMood = (id: string) => {
    setSelectedMoods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const setFilmFeedback = useCallback((filmId: number, verdict: 'liked' | 'disliked' | 'skipped') => {
    setFeedback((prev) => ({ ...prev, [filmId]: verdict }));
  }, []);

  const reset = () => {
    setPhase('mode-select');
    setExtractedTags([]);
    setProbeFilms([]);
    setProbeFilmNames([]);
    setFeedback({});
    setResultFilms([]);
    setResultReasons({});
    setError(null);
  };

  /* Quick mode flow */
  const startQuick = async () => {
    setPhase('quick-loading');
    try {
      const allTags = selectedMoods.flatMap(
        (id) => MOOD_CARDS.find((m) => m.id === id)?.tags || []
      );
      localStorage.setItem(STORAGE_KEYS.lastTags, JSON.stringify(selectedMoods));

      const response = await getQuickRecommendations(allTags, watchedFilmTitles);
      const films = await resolveFilmNames(response.films);
      setResultFilms(films);
      setPhase('quick-results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
      setPhase('error');
    }
  };

  /* Deep mode - step 1: analyze */
  const startDeep = async () => {
    setPhase('deep-loading');
    try {
      localStorage.setItem(STORAGE_KEYS.lastQuery, userQuery);

      const response = await getProbeFilms(userQuery, watchedFilmTitles);
      setExtractedTags(response.tags || []);
      setProbeFilmNames(response.films);
      const films = await resolveFilmNames(response.films);
      setProbeFilms(films);
      setPhase('deep-probe');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
      setPhase('error');
    }
  };

  /* Deep mode - step 2: refine */
  const startRefine = async () => {
    setPhase('deep-refine-loading');
    try {
      const liked: string[] = [];
      const disliked: string[] = [];
      const skipped: string[] = [];

      probeFilms.forEach((film) => {
        const id = getFilmId(film);
        const title = getFilmTitle(film);
        const v = feedback[id];
        if (v === 'liked') liked.push(title);
        else if (v === 'disliked') disliked.push(title);
        else skipped.push(title);
      });

      const response = await getFinalRecommendations(userQuery, liked, disliked, skipped, watchedFilmTitles);
      const filmNames = response.films.map((f) => f.name);
      const reasons: Record<string, string> = {};
      for (const f of response.films) {
        reasons[f.name] = f.reason;
      }

      const films = await resolveFilmNames(filmNames);
      setResultFilms(films);

      const resolvedReasons: Record<string, string> = {};
      for (const film of films) {
        const title = getFilmTitle(film);
        for (const [name, reason] of Object.entries(reasons)) {
          if (title.toLowerCase().includes(name.toLowerCase().slice(0, 6)) || name.toLowerCase().includes(title.toLowerCase().slice(0, 6))) {
            resolvedReasons[title] = reason;
            break;
          }
        }
      }
      setResultReasons(resolvedReasons);
      setPhase('deep-results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
      setPhase('error');
    }
  };

  const feedbackCount = Object.keys(feedback).length;
  const isLoading = phase === 'quick-loading' || phase === 'deep-loading' || phase === 'deep-refine-loading';
  const isResults = phase === 'quick-results' || phase === 'deep-results';

  const phaseTitle: Record<AiPhase, string> = {
    'mode-select': 'Подбор фильмов',
    'quick-tags': 'Выберите настроение',
    'quick-loading': 'Подбираем',
    'quick-results': 'Рекомендации',
    'deep-input': 'Расскажите о вкусах',
    'deep-loading': 'Анализируем',
    'deep-probe': 'Оцените фильмы',
    'deep-refine-loading': 'Уточняем подбор',
    'deep-results': 'Ваша подборка',
    error: 'Ошибка',
  };

  const phaseDescription: Record<AiPhase, string> = {
    'mode-select': 'ИИ-ассистент поможет найти идеальный фильм на вечер. Выберите режим подбора.',
    'quick-tags': 'Выберите одно или несколько настроений, и ИИ подберёт подходящие фильмы.',
    'quick-loading': 'ИИ анализирует ваши предпочтения и ищет лучшие совпадения...',
    'quick-results': 'Вот что подобрал ИИ специально для вас.',
    'deep-input': 'Опишите что хотите посмотреть — ИИ поймёт ваш вайб.',
    'deep-loading': 'ИИ извлекает ключевые теги и подбирает пробные фильмы...',
    'deep-probe': 'Отметьте фильмы чтобы ИИ лучше понял ваш вкус. Потом мы подберём точнее.',
    'deep-refine-loading': 'ИИ учитывает вашу обратную связь и подбирает финальные рекомендации...',
    'deep-results': 'Финальная подборка, настроенная под ваш вкус.',
    error: 'Что-то пошло не так.',
  };

  return (
    <div className="pb-20 pt-[calc(var(--header-height)+2.75rem)]">
      {/* Header */}
      <section className="section-shell relative overflow-hidden">
        <div className="relative z-10 max-w-[60rem]">
          <motion.span
            className="eyebrow mb-4"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            ИИ Ассистент
          </motion.span>
          <motion.h1
            className="display-title max-w-[10ch] text-[clamp(4.2rem,10vw,9.5rem)] text-[var(--color-text)]"
            initial={{ opacity: 0, y: 34 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: EASE }}
            key={phase}
          >
            {phaseTitle[phase]}
          </motion.h1>
          <motion.p
            className="mt-5 max-w-[41rem] text-[1.02rem] leading-relaxed text-[var(--color-text-secondary)]"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.72, delay: 0.12, ease: EASE }}
            key={`desc-${phase}`}
          >
            {phaseDescription[phase]}
          </motion.p>
        </div>
      </section>

      {/* Content */}
      <section className="section-shell mt-12">
        <AnimatePresence mode="wait">
          {/* ─── Mode Select ─── */}
          {phase === 'mode-select' && (
            <motion.div
              key="mode-select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="grid gap-6 lg:grid-cols-2"
            >
              <motion.button
                type="button"
                onClick={() => setPhase('quick-tags')}
                className="glass-panel group rounded-[2rem] p-8 text-left transition-all duration-500 hover:border-[var(--color-accent-soft)]"
                whileHover={{ y: -4 }}
                data-clickable
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgb(201_184_154_/_0.15)] bg-[rgb(201_184_154_/_0.06)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" className="h-7 w-7">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="editorial-annotation">Быстрый подбор</div>
                <h2 className="display-title mt-4 text-[clamp(2rem,4vw,3.5rem)] text-[var(--color-text)]">
                  По настроению
                </h2>
                <p className="mt-4 max-w-[28rem] text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  Выберите карточки настроений и получите 10 фильмов мгновенно. Идеально когда знаете чего хотите.
                </p>
                <div className="mt-6 flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[rgb(255_244_227_/_0.15)] text-[0.56rem]">1</span>
                  шаг → результат
                </div>
              </motion.button>

              <motion.button
                type="button"
                onClick={() => setPhase('deep-input')}
                className="glass-panel group rounded-[2rem] p-8 text-left transition-all duration-500 hover:border-[var(--color-accent-soft)]"
                whileHover={{ y: -4 }}
                data-clickable
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgb(201_184_154_/_0.15)] bg-[rgb(201_184_154_/_0.06)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" className="h-7 w-7">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="editorial-annotation">Глубокий подбор</div>
                <h2 className="display-title mt-4 text-[clamp(2rem,4vw,3.5rem)] text-[var(--color-text)]">
                  Под ваш вайб
                </h2>
                <p className="mt-4 max-w-[28rem] text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  Опишите что хотите, оцените пробные фильмы — ИИ поймёт ваш вкус и подберёт точнее.
                </p>
                <div className="mt-6 flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[rgb(255_244_227_/_0.15)] text-[0.56rem]">3</span>
                  шага → точный результат
                </div>
              </motion.button>
            </motion.div>
          )}

          {/* ─── Quick Tags ─── */}
          {phase === 'quick-tags' && (
            <motion.div
              key="quick-tags"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {MOOD_CARDS.map((card, i) => {
                  const active = selectedMoods.includes(card.id);
                  return (
                    <motion.button
                      key={card.id}
                      type="button"
                      onClick={() => toggleMood(card.id)}
                      className={cn(
                        'glass-panel relative rounded-[1.5rem] px-5 py-5 text-left transition-all duration-300',
                        active && 'border-[rgb(201_184_154_/_0.3)] bg-[rgb(201_184_154_/_0.08)]'
                      )}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.4, ease: EASE }}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.97 }}
                      data-clickable
                    >
                      <span className="mb-2 block text-[1.6rem]">{card.icon}</span>
                      <span className="block text-[1.02rem] leading-tight text-[var(--color-text)]">
                        {card.label}
                      </span>
                      <span className="mt-2 block text-[0.62rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                        {card.tags.slice(0, 2).join(' · ')}
                      </span>
                      {active && (
                        <motion.div
                          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent)]"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3" className="h-3.5 w-3.5">
                            <path d="M5 12l5 5L20 7" />
                          </svg>
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => setPhase('mode-select')}
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
                  onClick={startQuick}
                  disabled={selectedMoods.length === 0}
                  className="editorial-button editorial-button--solid"
                  data-clickable
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[0.72rem]">
                    Подобрать{selectedMoods.length > 0 ? ` (${selectedMoods.length})` : ''}
                  </span>
                </button>
              </div>
            </motion.div>
          )}

          {/* ─── Deep Input ─── */}
          {phase === 'deep-input' && (
            <motion.div
              key="deep-input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <div className="glass-panel rounded-[2rem] p-6 sm:p-8">
                <div className="editorial-annotation mb-4">Опишите что хотите посмотреть</div>
                <textarea
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Например: хочу что-то как Тетрадь смерти, но с юмором..."
                  className="w-full min-h-[8rem] resize-none border-b border-[rgb(255_244_227_/_0.12)] bg-transparent text-[1.02rem] leading-relaxed text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
                />
                <p className="mt-3 text-[0.68rem] leading-relaxed text-[var(--color-text-muted)]">
                  Упоминайте фильмы, персонажей, атмосферу — чем подробнее, тем точнее подбор.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => setPhase('mode-select')}
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
                  onClick={startDeep}
                  disabled={!userQuery.trim()}
                  className="editorial-button editorial-button--solid"
                  data-clickable
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
                  </svg>
                  <span className="text-[0.72rem]">Анализировать</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* ─── Loading States ─── */}
          {isLoading && (
            <AiLoadingView
              tags={phase === 'deep-loading' ? extractedTags : undefined}
            />
          )}

          {/* ─── Deep Probe ─── */}
          {phase === 'deep-probe' && (
            <motion.div
              key="deep-probe"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              {extractedTags.length > 0 && (
                <div className="mb-6 flex flex-wrap gap-2">
                  {extractedTags.map((tag, i) => (
                    <motion.span
                      key={tag}
                      className="rounded-full border border-[rgb(201_184_154_/_0.2)] bg-[rgb(201_184_154_/_0.06)] px-3 py-1 text-[0.58rem] uppercase tracking-[0.18em] text-[var(--color-accent)]"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06, ease: EASE }}
                    >
                      {tag}
                    </motion.span>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
                {probeFilms.map((film, i) => (
                  <ProbeCard
                    key={getFilmId(film)}
                    film={film}
                    index={i}
                    verdict={feedback[getFilmId(film)]}
                    onVerdict={(v) => setFilmFeedback(getFilmId(film), v)}
                    onFilmClick={onFilmClick}
                  />
                ))}
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                <div className="text-[0.68rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                  Отмечено: {feedbackCount} из {probeFilms.length}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={reset}
                    className="editorial-button"
                    data-clickable
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[0.72rem]">Заново</span>
                  </button>
                  <button
                    type="button"
                    onClick={startRefine}
                    disabled={feedbackCount < 3}
                    className="editorial-button editorial-button--solid"
                    data-clickable
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[0.72rem]">Подобрать точнее</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── Results ─── */}
          {isResults && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <div className="grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {resultFilms.map((film, index) => {
                  const title = getFilmTitle(film);
                  const reason = resultReasons[title];
                  return (
                    <div key={getFilmId(film)}>
                      <FilmCard film={film} index={index} onClick={onFilmClick} />
                      {reason && (
                        <motion.div
                          className="mt-2 inline-flex rounded-full border border-[rgb(201_184_154_/_0.2)] bg-[rgb(201_184_154_/_0.06)] px-3 py-1 text-[0.58rem] uppercase tracking-[0.18em] text-[var(--color-accent)]"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 + 0.3, ease: EASE }}
                        >
                          {reason}
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>

              {resultFilms.length === 0 && (
                <div className="glass-panel rounded-[1.9rem] px-6 py-16 text-center text-sm text-[var(--color-text-muted)]">
                  ИИ не смог найти подходящие фильмы. Попробуйте другой запрос.
                </div>
              )}

              <div className="mt-12 flex justify-center">
                <button
                  type="button"
                  onClick={reset}
                  className="editorial-button"
                  data-clickable
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[0.72rem]">Начать заново</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* ─── Error ─── */}
          {phase === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="glass-panel rounded-[2rem] px-6 py-12 text-center"
            >
              <div className="text-[0.72rem] uppercase tracking-[0.24em] text-[var(--color-danger)]">
                Ошибка
              </div>
              <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
                {error || 'Произошла непредвиденная ошибка'}
              </p>
              <button
                type="button"
                onClick={reset}
                className="editorial-button mt-6"
                data-clickable
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[0.72rem]">Попробовать снова</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
