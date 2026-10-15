'use client';

export type Tab = 'home' | 'trends' | 'records' | 'colour';

const ICON_PATHS: Record<Tab, string> = {
  // House
  home: 'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
  // Rising line chart
  trends: 'M3 3v18h18M7 15l4-4 3 3 6-7',
  // Table rows
  records: 'M4 5h16M4 10h16M4 15h16M4 20h16',
  // Colour swatch
  colour: 'M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.5 0-.9-.6-1.2-.6-2.1 0-.9.7-1.4 1.6-1.4H17a4 4 0 0 0 4-4c0-4.4-4-9-9-9Zm-4.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm4.5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z',
};

export const NAV_ITEMS: { tab: Tab; label: string; description: string }[] = [
  { tab: 'home', label: 'Home', description: 'Enter or upload weights' },
  { tab: 'trends', label: 'Trends & Charts', description: 'X-bar, R and rule signals' },
  { tab: 'records', label: 'Records', description: 'Edit and review subgroups' },
  { tab: 'colour', label: 'Tom Brown p-Chart', description: 'Colour batch control' },
];

function NavIcon({ tab, className }: { tab: Tab; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={ICON_PATHS[tab]} />
    </svg>
  );
}

/** Main navigation: a left sidebar on wider screens, a scrollable row of pills on phones. */
export function SideNav({ tab, onSelect }: { tab: Tab; onSelect: (tab: Tab) => void }) {
  return (
    <nav
      aria-label="Dashboard sections"
      className="md:w-64 md:shrink-0 md:sticky md:top-6 md:self-start"
    >
      <div className="md:rounded-xl md:border md:border-border md:bg-surface md:p-3 md:shadow-sm">
        <p className="hidden md:block px-3 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
          Menu
        </p>
        <ul className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:gap-1 md:overflow-visible md:pb-0">
          {NAV_ITEMS.map((item) => {
            const active = tab === item.tab;
            return (
              <li key={item.tab} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onSelect(item.tab)}
                  aria-current={active ? 'page' : undefined}
                  className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                    active
                      ? 'bg-primary-soft text-primary-hover'
                      : 'border border-border bg-surface text-muted hover:bg-primary-soft/60 hover:text-foreground md:border-transparent md:bg-transparent'
                  }`}
                >
                  {/* Accent bar marking the current section (sidebar only). */}
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-2 bottom-2 hidden w-1 rounded-full md:block ${
                      active ? 'bg-primary' : 'bg-transparent'
                    }`}
                  />
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                      active
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-primary-soft text-primary group-hover:bg-white'
                    }`}
                  >
                    <NavIcon tab={item.tab} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`block whitespace-nowrap text-sm ${
                        active ? 'font-semibold' : 'font-medium'
                      }`}
                    >
                      {item.label}
                    </span>
                    <span className="hidden md:block truncate text-xs text-muted">
                      {item.description}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
