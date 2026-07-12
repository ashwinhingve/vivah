'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import {
  LayoutDashboard,
  CalendarRange,
  Sparkles,
  ListChecks,
  Users,
  Store,
  UserCog,
  Wallet,
  Receipt,
  Utensils,
  Armchair,
  Image as ImageIcon,
  FileText,
  Gift,
  Globe,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Item = { seg: string; label: string; Icon: LucideIcon };
type Group = { title: string; items: Item[]; collapsible?: boolean };

const GROUPS: Group[] = [
  { title: '', items: [{ seg: '', label: 'Dashboard', Icon: LayoutDashboard }] },
  {
    title: 'Planning',
    items: [
      { seg: 'timeline', label: 'Timeline', Icon: CalendarRange },
      { seg: 'calendar', label: 'Calendar', Icon: CalendarDays },
      { seg: 'ceremonies', label: 'Ceremonies', Icon: Sparkles },
      { seg: 'tasks', label: 'Tasks', Icon: ListChecks },
    ],
  },
  {
    title: 'People',
    items: [
      { seg: 'guests', label: 'Guests', Icon: Users },
      { seg: 'vendors', label: 'Vendors', Icon: Store },
      { seg: 'members', label: 'Members', Icon: UserCog },
    ],
  },
  {
    title: 'Money',
    items: [
      { seg: 'budget', label: 'Budget', Icon: Wallet },
      { seg: 'expenses', label: 'Expenses', Icon: Receipt },
    ],
  },
  {
    title: 'More',
    collapsible: true,
    items: [
      { seg: 'catering', label: 'Catering', Icon: Utensils },
      { seg: 'seating', label: 'Seating', Icon: Armchair },
      { seg: 'moodboard', label: 'Mood Board', Icon: ImageIcon },
      { seg: 'documents', label: 'Documents', Icon: FileText },
      { seg: 'registry', label: 'Registry', Icon: Gift },
      { seg: 'website', label: 'Website', Icon: Globe },
      { seg: 'day-of', label: 'Day-of', Icon: CalendarClock },
    ],
  },
];

const ALL_ITEMS: Item[] = GROUPS.flatMap((g) => g.items);

function statusChip(status: string): string {
  switch (status) {
    case 'CONFIRMED':
      return 'bg-teal/10 text-teal border-teal/30';
    case 'COMPLETED':
      return 'bg-success/15 text-success border-success/30';
    case 'CANCELLED':
      return 'bg-muted text-muted-foreground border-muted-foreground/20';
    default:
      return 'bg-warning/15 text-warning border-warning/30';
  }
}

interface Props {
  id: string;
  weddingName: string;
  status: string;
  statusLabel: string;
}

/**
 * Persistent wedding-section nav. Renders a sticky left rail on desktop and a
 * sticky horizontal segmented-tab strip on mobile (the global app bottom nav
 * already owns the screen bottom). Active section is derived from the pathname.
 */
export function WeddingSidebar({ id, weddingName, status, statusLabel }: Props) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Derive the active sub-segment (locale-prefix agnostic): the part of the
  // path right after `/weddings/<id>` — '' for the dashboard itself.
  const base = `/weddings/${id}`;
  const idx = pathname.indexOf(base);
  const rest = idx === -1 ? '' : pathname.slice(idx + base.length).replace(/^\//, '');
  const activeSeg = rest.split('/')[0] ?? '';

  const href = (seg: string) => `/weddings/${id}${seg ? `/${seg}` : ''}`;

  return (
    <>
      {/* ── Desktop rail ─────────────────────────────────────────────── */}
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
          <Link
            href="/weddings"
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            All weddings
          </Link>

          <div className="mb-5 rounded-xl border border-gold/25 bg-surface p-3 shadow-card">
            <p className="truncate font-heading text-sm font-semibold text-primary">{weddingName}</p>
            <span
              className={cn(
                'mt-1.5 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                statusChip(status),
              )}
            >
              {statusLabel}
            </span>
          </div>

          <nav aria-label="Wedding sections" className="space-y-5">
            {GROUPS.map((g, gi) => {
              const hasActive = g.items.some((it) => it.seg === activeSeg);
              const collapsed = Boolean(g.collapsible) && !moreOpen && !hasActive;
              return (
                <div key={gi}>
                  {g.title &&
                    (g.collapsible ? (
                      <button
                        type="button"
                        onClick={() => setMoreOpen((o) => !o)}
                        aria-expanded={!collapsed}
                        className="mb-1.5 flex w-full items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-primary"
                      >
                        {g.title}
                        <ChevronDown
                          className={cn('h-3.5 w-3.5 transition-transform', !collapsed && 'rotate-180')}
                          aria-hidden="true"
                        />
                      </button>
                    ) : (
                      <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        {g.title}
                      </p>
                    ))}

                  {!collapsed && (
                    <ul className="space-y-0.5">
                      {g.items.map((it) => {
                        const active = it.seg === activeSeg;
                        return (
                          <li key={it.seg}>
                            <Link
                              href={href(it.seg)}
                              aria-current={active ? 'page' : undefined}
                              className={cn(
                                'group flex min-h-[40px] items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                                active
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-foreground/80 hover:bg-gold/5 hover:text-primary',
                              )}
                            >
                              <it.Icon
                                className={cn(
                                  'h-4 w-4 shrink-0',
                                  active ? 'text-primary' : 'text-gold-muted group-hover:text-primary',
                                )}
                                aria-hidden="true"
                              />
                              {it.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* ── Mobile segmented tabs ────────────────────────────────────── */}
      <div className="sticky top-[57px] z-20 border-b border-gold/20 bg-background/95 backdrop-blur-sm lg:hidden">
        <div className="flex items-center gap-2 px-4 pt-2">
          <Link
            href="/weddings"
            aria-label="All weddings"
            className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p className="truncate font-heading text-sm font-semibold text-primary">{weddingName}</p>
          <span
            className={cn(
              'ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
              statusChip(status),
            )}
          >
            {statusLabel}
          </span>
        </div>
        <nav
          aria-label="Wedding sections"
          className="flex gap-1.5 overflow-x-auto px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {ALL_ITEMS.map((it) => {
            const active = it.seg === activeSeg;
            return (
              <Link
                key={it.seg}
                href={href(it.seg)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-[36px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                  active
                    ? 'border-primary bg-primary text-white'
                    : 'border-gold/30 bg-surface text-foreground/80',
                )}
              >
                <it.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {it.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
