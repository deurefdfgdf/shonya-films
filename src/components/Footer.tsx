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
    <footer className="border-t border-[var(--color-border)] py-16 sm:py-24">
      <div className="section-shell flex flex-col gap-12">
        {/* Large typography block */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="display-title text-[clamp(3rem,8vw,7rem)] text-[var(--color-text)]">
              Шоня
              <br />
              Фильмсы
            </h2>
          </div>

          {/* Nav links */}
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {FOOTER_LINKS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="group relative text-[0.62rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)] transition-colors duration-300 hover:text-[var(--color-text)]"
                data-clickable
              >
                {item.label}
                <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[var(--color-accent)] transition-all duration-500 group-hover:w-full" />
              </button>
            ))}
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-6 text-[0.6rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Шоня Фильмсы</p>
          <p>Шонька если ты читаешь это то ты лох.</p>
        </div>
      </div>
    </footer>
  );
}
