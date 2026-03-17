'use client';

interface FooterProps {
  onNavigate: (section: string) => void;
}

const FOOTER_LINKS = [
  { id: 'popular', label: 'Популярное' },
  { id: 'top250', label: 'Топ 250' },
  { id: 'premieres', label: 'Премьеры' },
  { id: 'series', label: 'Сериалы' },
];

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="border-t border-[rgb(255_244_227_/_0.08)] py-16 sm:py-20">
      <div className="section-shell flex flex-col gap-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.6fr)] lg:items-end">
          <div>
            <span className="eyebrow mb-4">Финальный кадр</span>
            <h2 className="display-title text-[clamp(3.2rem,7vw,6.2rem)] text-[var(--color-text)]">
              Шоня Фильмсы
            </h2>
            <p className="mt-5 max-w-[34rem] text-base leading-relaxed text-[var(--color-text-secondary)]">
              Весь мир кино в одном месте.
            </p>
          </div>

          <div className="grid gap-3 text-[0.72rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)] sm:grid-cols-2">
            {FOOTER_LINKS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="border-b border-[rgb(255_244_227_/_0.08)] py-3 text-left transition-colors duration-300 hover:text-[var(--color-text)]"
                data-clickable
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[rgb(255_244_227_/_0.08)] pt-6 text-sm text-[var(--color-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Шоня Фильмсы.</p>
          <p>Шонька если ты читаешь это то ты лох.</p>
        </div>
      </div>
    </footer>
  );
}
