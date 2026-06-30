'use client';

/**
 * MatchFeed — polished discovery feed client component.
 *
 * Architecture notes:
 *
 * 1. CLIENT-SIDE FILTERING: The matchmaking/feed API accepts only `page` and
 *    `limit` parameters. There is NO server-side attribute filtering endpoint.
 *    All attribute filters (age, city, diet, manglik, must-haves) operate over
 *    the already-loaded feed items in the browser. This is noted in comments
 *    throughout to prevent future confusion.
 *
 * 2. CLIENT-SIDE HIDE/PASS: There is NO POST /api/v1/matchmaking/hide endpoint
 *    in the matchmaking router. The "Pass" action persists hidden profile IDs
 *    to localStorage via useShortlistStore only — no server call is made.
 *
 * 3. PAGINATION: Server page/limit pagination via "Load more" button.
 *    Filters apply to the current in-memory batch.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  ChevronDown, Loader2, ArrowUpDown, Heart, CheckCircle2,
  RefreshCw, SlidersHorizontal,
} from 'lucide-react';
import type { MatchFeedItem } from '@smartshaadi/types';
import { ProfileCard } from '@/components/ui/ProfileCard.client';
import { EmptyState } from '@/components/shared';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { resolvePhotoUrl } from '@/lib/photo';
import { clientEnv } from '@/lib/env';
import { useToast } from '@/components/ui/toast';
import { useShortlistStore } from '@/store/useShortlistStore';
import dynamic from 'next/dynamic';
import {
  ActiveFilterChips,
  DEFAULT_FILTERS,
  type FeedFilters,
} from './MatchFilters.client';

// Heavy client modules — split into separate chunks. Both only mount in
// response to user interaction (filter Sheet open / profile card click), so
// `loading: () => null` is safe — pre-mount there is nothing to render.
// next/dynamic named-export form: the resolver returns the component itself,
// NOT `{ default: component }` — the latter shape is silently mis-rendered.
const MatchFilters = dynamic(
  () => import('./MatchFiltersPanel.client').then((m) => m.MatchFilters),
  { ssr: false, loading: () => null },
);
const MatchProfileDrawer = dynamic(
  () => import('./MatchProfileDrawer.client').then((m) => m.MatchProfileDrawer),
  { ssr: false, loading: () => null },
);

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = 'topMatch' | 'recentlyActive' | 'newest' | 'distance';

const SORT_OPTIONS: { value: SortKey; labelKey: string }[] = [
  { value: 'topMatch', labelKey: 'topMatch' },
  { value: 'recentlyActive', labelKey: 'recentlyActive' },
  { value: 'newest', labelKey: 'newest' },
  { value: 'distance', labelKey: 'nearest' },
];

// ─── Filtering logic ──────────────────────────────────────────────────────────

/**
 * Apply client-side filters to already-loaded feed items.
 * NOTE: No server-side filter endpoint exists — this is purely in-memory.
 */
function applyFilters(items: MatchFeedItem[], filters: FeedFilters, hiddenIds: Set<string>): MatchFeedItem[] {
  return items.filter((item) => {
    // Always hide passed profiles (client-only, no API)
    if (hiddenIds.has(item.profileId)) return false;

    // Age range
    if (item.age != null) {
      if (item.age < filters.ageRange[0] || item.age > filters.ageRange[1]) return false;
    }

    // City filter
    if (filters.cities.length > 0 && !filters.cities.includes(item.city)) return false;

    // Diet filter — feed item has no diet field; skip this filter silently
    // (diet data lives in MongoDB profiles_content, not the feed index)

    // Manglik filter
    if (filters.manglikFilter === 'MANGLIK' && item.manglik !== 'YES' && item.manglik !== 'PARTIAL') return false;
    if (filters.manglikFilter === 'NON_MANGLIK' && item.manglik === 'YES') return false;

    // Must-haves
    if (filters.mustHaves.includes('verified') && !item.isVerified) return false;
    if (filters.mustHaves.includes('withPhoto') && (item.photoHidden || !item.photoKey)) return false;
    if (filters.mustHaves.includes('highGuna') && item.compatibility.gunaScore < 24) return false;
    if (filters.mustHaves.includes('recentlyActive')) {
      if (!item.lastActiveAt) return false;
      const daysSince = (Date.now() - new Date(item.lastActiveAt).getTime()) / 86_400_000;
      if (daysSince > 7) return false;
    }

    return true;
  });
}

/**
 * Sort already-loaded feed items client-side.
 */
function sortItems(items: MatchFeedItem[], sort: SortKey): MatchFeedItem[] {
  const arr = [...items];
  switch (sort) {
    case 'topMatch':
      return arr.sort((a, b) => b.compatibility.totalScore - a.compatibility.totalScore);
    case 'recentlyActive':
      return arr.sort((a, b) => {
        const ta = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
        const tb = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
        return tb - ta;
      });
    case 'newest':
      return arr.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    case 'distance':
      return arr.sort((a, b) => {
        const da = a.distanceKm ?? Infinity;
        const db = b.distanceKm ?? Infinity;
        return da - db;
      });
    default:
      return arr;
  }
}

// ─── Connect Sheet (note textarea + send) ────────────────────────────────────

function ConnectSheet({
  open,
  profileId,
  profileName,
  onClose,
}: {
  open: boolean;
  profileId: string;
  profileName: string;
  onClose: () => void;
}) {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const { toast } = useToast();
  const t = useTranslations('feed');
  const { addRequestSent } = useShortlistStore();
  const MAX_CHARS = 280;

  async function handleSend() {
    setStatus('sending');
    setErrorMsg('');
    try {
      const res = await fetch(`${clientEnv.apiUrl}/matchmaking/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          receiverId: profileId,
          ...(message.trim() ? { message: message.trim() } : {}),
        }),
      });
      if (res.ok || res.status === 409) {
        setStatus('sent');
        addRequestSent(profileId);
        const firstName = profileName.split(' ')[0] ?? profileName;
        toast(t('connect.toast', { name: firstName }), 'success');
        setTimeout(onClose, 800);
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      setErrorMsg(body.error?.message ?? t('connect.error'));
      setStatus('error');
    } catch {
      setErrorMsg(t('connect.error'));
      setStatus('error');
    }
  }

  // Reset on open
  useEffect(() => {
    if (open) { setMessage(''); setStatus('idle'); setErrorMsg(''); }
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="mb-4">
          <SheetTitle className="font-heading text-lg text-primary">
            {t('connect.title', { name: profileName })}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="connect-note" className="mb-1.5 block text-sm font-medium text-muted-foreground">
              {t('connect.noteLabel')} <span className="text-xs">{t('connect.optional')}</span>
            </label>
            <textarea
              id="connect-note"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_CHARS))}
              placeholder={t('connect.placeholder')}
              rows={4}
              className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
            <p className={`mt-1 text-right text-xs ${message.length >= MAX_CHARS ? 'text-destructive' : 'text-muted-foreground'}`}>
              {message.length}/{MAX_CHARS}
            </p>
          </div>

          {errorMsg ? (
            <p role="alert" className="text-sm text-destructive">{errorMsg}</p>
          ) : null}

          <div className="flex gap-3 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 flex-1 items-center justify-center rounded-lg border border-border text-sm font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {t('connect.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={status === 'sending' || status === 'sent'}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-teal text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:bg-teal-hover hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
            >
              {status === 'sending' ? (
                <><Loader2 className="h-4 w-4 animate-spin" />{t('connect.sending')}</>
              ) : status === 'sent' ? (
                <><CheckCircle2 className="h-4 w-4" />{t('connect.sent')}</>
              ) : (
                <><Heart className="h-4 w-4" />{t('connect.send')}</>
              )}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Pass confirm tooltip ────────────────────────────────────────────────────

function PassConfirmTooltip({
  profileName,
  onConfirm,
  onCancel,
}: {
  profileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('feed');
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-[2px]">
      <div className="mx-4 max-w-[240px] rounded-xl bg-surface px-5 py-4 shadow-card-hover text-center">
        <p className="mb-3 text-sm font-semibold text-foreground">
          {t('passConfirm.prompt', { name: profileName.split(' ')[0] ?? profileName })}
        </p>
        <p className="mb-4 text-xs text-muted-foreground">
          {t('passConfirm.help')}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-9 flex-1 items-center justify-center rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-primary"
          >
            {t('passConfirm.keep')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex h-9 flex-1 items-center justify-center rounded-lg bg-destructive text-xs font-semibold text-white hover:opacity-90"
          >
            {t('passConfirm.hide')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Single animated card wrapper ────────────────────────────────────────────

function FeedCardItem({
  item,
  shortlisted,
  requestSent,
  onShortlist,
  onConnect,
  onPass,
  onOpen,
}: {
  item: MatchFeedItem;
  shortlisted: boolean;
  requestSent: boolean;
  onShortlist: () => void;
  onConnect: () => void;
  onPass: () => void;
  onOpen: () => void;
}) {
  const t = useTranslations('feed');
  const reduced = useReducedMotion();
  const [showPassConfirm, setShowPassConfirm] = useState(false);
  const [passing, setPassing] = useState(false);

  const photoUrl = item.photoHidden ? null : resolvePhotoUrl(item.photoKey);

  function handlePassConfirm() {
    setPassing(true);
    setTimeout(() => {
      onPass();
    }, 350);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: reduced ? 0 : 24 }}
      animate={
        passing
          ? { opacity: 0, x: 80, transition: { duration: 0.3, ease: 'easeIn' } }
          : { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } }
      }
      exit={{ opacity: 0, x: 80, transition: { duration: 0.25, ease: 'easeIn' } }}
      className="relative"
    >
      {showPassConfirm && (
        <PassConfirmTooltip
          profileName={item.name}
          onConfirm={handlePassConfirm}
          onCancel={() => setShowPassConfirm(false)}
        />
      )}

      {/* Request Sent pill overlay */}
      {requestSent && (
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full bg-teal px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
          <CheckCircle2 className="h-3 w-3" />
          {t('requestSentPill')}
        </div>
      )}

      <ProfileCard
        name={item.name}
        age={item.age}
        city={item.city}
        photoUrl={photoUrl}
        isNew={item.isNew}
        isVerified={item.isVerified}
        compatibilityPct={item.compatibility.totalScore}
        gunaScore={item.compatibility.gunaScore}
        shortlisted={shortlisted}
        onShortlist={onShortlist}
        onConnect={onConnect}
        onPass={() => setShowPassConfirm(true)}
        onOpen={onOpen}
      />
    </motion.div>
  );
}

// ─── MatchFeed ────────────────────────────────────────────────────────────────

interface MatchFeedProps {
  /** Initial items from server (first page). */
  initialItems: MatchFeedItem[];
  /** Total count from server (for Load more logic). */
  total: number;
  /**
   * External filter state from a parent (e.g. FeedPageClient sharing state
   * between the desktop sidebar and this component). When provided, this
   * component uses externalFilters instead of its own internal filter state.
   */
  externalFilters?: FeedFilters;
  onExternalFiltersChange?: (f: FeedFilters) => void;
  /** Unique cities available for the city filter (derived server-side from items). */
  availableCities?: string[];
  /** If true we are the mobile filter trigger context */
  mobileFilterOpen?: boolean;
  onMobileFilterOpenChange?: (open: boolean) => void;
}

const PAGE_SIZE = 12;

export function MatchFeed({
  initialItems,
  total,
  externalFilters,
  onExternalFiltersChange,
  availableCities: availableCitiesProp,
  mobileFilterOpen = false,
  onMobileFilterOpenChange,
}: MatchFeedProps) {
  // ── Pagination state ──────────────────────────────────────────────────────
  const [allItems, setAllItems] = useState<MatchFeedItem[]>(initialItems);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const hasMore = allItems.length < total;

  // ── Filter / sort state ───────────────────────────────────────────────────
  // Use internal state when no external filter controller is provided
  const [internalFilters, setInternalFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
  const filters = externalFilters ?? internalFilters;
  const setFilters = useCallback((f: FeedFilters) => {
    if (onExternalFiltersChange) onExternalFiltersChange(f);
    else setInternalFilters(f);
  }, [onExternalFiltersChange]);
  // pendingFilters: draft state for the mobile sheet (only committed on Apply).
  // Syncs from externalFilters when the mobile sheet is opened, so it reflects
  // any desktop-sidebar changes made before opening the sheet.
  const [pendingFilters, setPendingFilters] = useState<FeedFilters>(externalFilters ?? DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>('topMatch');

  // ── Store ─────────────────────────────────────────────────────────────────
  // `addRequestSent` is invoked inside ConnectSheet (it has its own store hook);
  // here we only need to read sent-state, so it is intentionally not destructured.
  const { shortlistedIds, hiddenIds, addShortlisted, removeShortlisted, addHidden, isRequestSent } =
    useShortlistStore();

  // ── Sheet state ───────────────────────────────────────────────────────────
  const [connectTarget, setConnectTarget] = useState<{ profileId: string; name: string } | null>(null);
  const [drawerProfileId, setDrawerProfileId] = useState<string | null>(null);

  const { toast } = useToast();
  const t = useTranslations('feed');

  // ── Derived: unique cities from loaded items (or prop override) ──────────
  const availableCitiesFromItems = useMemo(() => {
    const s = new Set(allItems.map((i) => i.city).filter(Boolean));
    return [...s].sort();
  }, [allItems]);
  const availableCities = availableCitiesProp ?? availableCitiesFromItems;

  // ── Derived: filtered + sorted items ─────────────────────────────────────
  // NOTE: This is pure client-side filtering — no API call. See file header.
  const visibleItems = useMemo(
    () => sortItems(applyFilters(allItems, filters, hiddenIds), sort),
    [allItems, filters, hiddenIds, sort]
  );

  // ── Filter key for AnimatePresence re-mount ───────────────────────────────
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);

  // ── Load more (server pagination) ────────────────────────────────────────
  async function loadMore() {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await fetch(
        `${clientEnv.apiUrl}/matchmaking/feed?page=${nextPage}&limit=${PAGE_SIZE}`,
        { credentials: 'include' }
      );
      if (!res.ok) { toast(t('couldNotLoadMore'), 'error'); return; }
      const json = (await res.json()) as {
        success: boolean;
        data: { items: MatchFeedItem[]; total: number } | MatchFeedItem[];
      };
      if (!json.success) { toast(t('couldNotLoadMore'), 'error'); return; }
      const newItems = Array.isArray(json.data) ? json.data : (json.data?.items ?? []);
      setAllItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.profileId));
        return [...prev, ...newItems.filter((i) => !existingIds.has(i.profileId))];
      });
      setPage(nextPage);
    } catch {
      toast('Network error — please try again', 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  // ── Shortlist toggle ──────────────────────────────────────────────────────
  async function handleShortlist(profileId: string) {
    const isCurrentlyShortlisted = shortlistedIds.has(profileId);
    // Optimistic update
    if (isCurrentlyShortlisted) {
      removeShortlisted(profileId);
    } else {
      addShortlisted(profileId);
    }
    // Sync to server
    try {
      const res = await fetch(`${clientEnv.apiUrl}/matchmaking/shortlists/${profileId}`, {
        method: isCurrentlyShortlisted ? 'DELETE' : 'POST',
        credentials: 'include',
      });
      if (!res.ok && res.status !== 409) {
        // Roll back
        if (isCurrentlyShortlisted) addShortlisted(profileId);
        else removeShortlisted(profileId);
        toast('Could not update shortlist', 'error');
      } else {
        toast(isCurrentlyShortlisted ? 'Removed from shortlist' : 'Added to shortlist', 'success');
      }
    } catch {
      if (isCurrentlyShortlisted) addShortlisted(profileId);
      else removeShortlisted(profileId);
      toast('Network error', 'error');
    }
  }

  // ── Pass / hide (CLIENT ONLY — no API) ───────────────────────────────────
  // IMPORTANT: There is no /hide endpoint. This stores the ID in localStorage only.
  function handlePass(profileId: string) {
    addHidden(profileId);
  }

  // ── Filter chip removal ───────────────────────────────────────────────────
  function handleFilterRemove(key: keyof FeedFilters, value?: string) {
    if (key === 'ageRange') {
      setFilters({ ...filters, ageRange: DEFAULT_FILTERS.ageRange });
    } else if (key === 'manglikFilter') {
      setFilters({ ...filters, manglikFilter: 'ANY' });
    } else if (value !== undefined) {
      const arr = filters[key] as string[];
      setFilters({ ...filters, [key]: arr.filter((v) => v !== value) });
    }
  }

  // ── Sync pendingFilters from live filters when mobile sheet opens ─────────
  useEffect(() => {
    if (mobileFilterOpen) setPendingFilters(filters);
    // Only sync when the sheet OPENS, not on every filter change (drafting UX)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileFilterOpen]);

  // ── Initialise shortlist state from server data ───────────────────────────
  useEffect(() => {
    // Seed the store with server-provided shortlisted state on first load
    initialItems.forEach((item) => {
      if (item.shortlisted && !shortlistedIds.has(item.profileId)) {
        addShortlisted(item.profileId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const filterCount = useMemo(() => {
    let count = 0;
    if (filters.ageRange[0] !== DEFAULT_FILTERS.ageRange[0] || filters.ageRange[1] !== DEFAULT_FILTERS.ageRange[1]) count++;
    count += filters.cities.length + filters.religions.length + filters.educations.length + filters.diets.length;
    if (filters.manglikFilter !== 'ANY') count++;
    count += filters.mustHaves.length;
    return count;
  }, [filters]);

  return (
    <>
      {/* ── Mobile filter sheet ─────────────────────────────────────────── */}
      <Sheet open={mobileFilterOpen} onOpenChange={onMobileFilterOpenChange}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-heading text-primary">{t('filters.filtersTitle')}</SheetTitle>
          </SheetHeader>
          <MatchFilters
            filters={pendingFilters}
            onChange={setPendingFilters}
            availableCities={availableCities}
            onApply={() => {
              setFilters(pendingFilters);
              onMobileFilterOpenChange?.(false);
            }}
          />
        </SheetContent>
      </Sheet>

      {/* ── Connect sheet ─────────────────────────────────────────────────── */}
      <ConnectSheet
        open={connectTarget !== null}
        profileId={connectTarget?.profileId ?? ''}
        profileName={connectTarget?.name ?? ''}
        onClose={() => setConnectTarget(null)}
      />

      {/* ── Profile quick-view drawer ──────────────────────────────────────── */}
      <MatchProfileDrawer
        profileId={drawerProfileId}
        onClose={() => setDrawerProfileId(null)}
      />

      {/* ── Sort + active filter chips row ────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          {/* Mobile filter trigger */}
          <button
            type="button"
            onClick={() => onMobileFilterOpenChange?.(true)}
            className="relative inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-teal/50 hover:text-primary lg:hidden"
            aria-label={t('openFilters')}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {t('openFilters')}
            {filterCount > 0 && (
              <span className="flex h-5 min-w-[18px] items-center justify-center rounded-full bg-teal px-1 text-[10px] font-bold text-white">
                {filterCount}
              </span>
            )}
          </button>

          {/* Sort dropdown */}
          <div className="ml-auto flex items-center gap-2">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-9 rounded-lg border border-border bg-surface py-0 pl-2 pr-8 text-sm font-medium text-foreground focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
              aria-label={t('sort.label')}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(`sort.${opt.labelKey}`)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active filter chips */}
        <ActiveFilterChips
          filters={filters}
          onRemove={handleFilterRemove}
          onReset={() => { setFilters(DEFAULT_FILTERS); setPendingFilters(DEFAULT_FILTERS); }}
        />
      </div>

      {/* ── Main grid ────────────────────────────────────────────────────── */}
      <AnimatePresence mode="popLayout">
        {visibleItems.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <EmptyState
              icon={Heart}
              title={t('filterEmptyTitle')}
              description={t('filterEmptyBody')}
              action={
                <button
                  type="button"
                  onClick={() => { setFilters(DEFAULT_FILTERS); setPendingFilters(DEFAULT_FILTERS); }}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-teal px-5 text-sm font-semibold text-white shadow-sm hover:-translate-y-px hover:bg-teal-hover hover:shadow-md"
                >
                  <RefreshCw className="h-4 w-4" />
                  {t('resetFilters')}
                </button>
              }
            />
          </motion.div>
        ) : (
          <motion.div
            key={`grid-${filterKey}`}
            role="feed"
            aria-label={`${visibleItems.length} match suggestions`}
            aria-busy={loadingMore}
            className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4"
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.04 } },
            }}
          >
            <AnimatePresence mode="popLayout">
              {visibleItems.map((item) => (
                <FeedCardItem
                  key={item.profileId}
                  item={item}
                  shortlisted={shortlistedIds.has(item.profileId)}
                  requestSent={isRequestSent(item.profileId)}
                  onShortlist={() => handleShortlist(item.profileId)}
                  onConnect={() => setConnectTarget({ profileId: item.profileId, name: item.name })}
                  onPass={() => handlePass(item.profileId)}
                  onOpen={() => setDrawerProfileId(item.profileId)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Load more ────────────────────────────────────────────────────── */}
      {/* Load more stays reachable even when active filters hide every loaded
          card but the server still has more pages — so the user is never stuck. */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-teal px-6 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:bg-teal-hover hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
          >
            {loadingMore ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{t('loadingMore')}</>
            ) : (
              <><ChevronDown className="h-4 w-4" />{t('loadMore')}</>
            )}
          </button>
        </div>
      )}
    </>
  );
}
