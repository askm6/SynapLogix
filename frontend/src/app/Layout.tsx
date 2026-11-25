/** Application shell: glass sidebar with the six screens, top bar with mode badge, theme and language. */
import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router';
import { BarChart3, Database, GitCompare, Home, Moon, Route, Sun, Truck } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Badge, cx } from '@/components/ui';
import { useI18n, type MessageKey } from '@/i18n';
import { USE_MOCKS } from '@/services';
import { useUi } from './store';

const NAV: { to: string; key: MessageKey; icon: typeof Home }[] = [
  { to: '/', key: 'nav.home', icon: Home },
  { to: '/datos', key: 'nav.data', icon: Database },
  { to: '/flota', key: 'nav.fleet', icon: Truck },
  { to: '/optimizacion', key: 'nav.optimize', icon: Route },
  { to: '/resultados', key: 'nav.results', icon: BarChart3 },
  { to: '/comparar', key: 'nav.compare', icon: GitCompare },
];

export function Layout() {
  const { t, language } = useI18n();
  const { theme, toggleTheme, setLanguage } = useUi();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.lang = language;
  }, [theme, language]);

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        {t('app.skip')}
      </a>
      <aside className="glass sticky top-0 z-40 flex shrink-0 flex-col gap-4 border-0 border-b border-line px-4 py-3 md:h-screen md:w-60 md:border-r md:border-b-0 md:py-5">
        <div className="flex items-center justify-between">
          <Logo />
        </div>
        <nav
          aria-label="SynapLogix"
          className="-mx-1 flex gap-1 overflow-x-auto md:mx-0 md:flex-col md:overflow-visible"
        >
          {NAV.map(({ to, key, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cx(
                  'flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm transition',
                  isActive
                    ? 'bg-accent/15 text-accent-ink shadow-[inset_0_0_0_1px_rgb(58_167_255/0.35)]'
                    : 'text-muted hover:bg-white/5 hover:text-fg',
                )
              }
            >
              <Icon className="size-4" aria-hidden />
              {t(key)}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-2 px-4 pt-4 md:px-8">
          {USE_MOCKS && (
            <span title={t('topbar.mockHint')}>
              <Badge tone="warn">{t('topbar.mock')}</Badge>
            </span>
          )}
          <div role="group" aria-label={t('topbar.language')} className="glass flex rounded-xl p-0.5 text-xs">
            {(['es', 'en'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                aria-pressed={language === lang}
                className={cx(
                  'rounded-lg px-2.5 py-1 font-medium uppercase transition',
                  language === lang ? 'bg-accent text-on-accent' : 'text-muted hover:text-fg',
                )}
              >
                {lang}
              </button>
            ))}
          </div>
          <button
            onClick={toggleTheme}
            className="glass flex size-8 items-center justify-center rounded-xl text-muted hover:text-fg"
            aria-label={theme === 'dark' ? t('topbar.toLight') : t('topbar.toDark')}
            title={theme === 'dark' ? t('topbar.toLight') : t('topbar.toDark')}
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-4 pb-12 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
