import {
  Home,
  Search,
  Calendar,
  User,
  Cake,
  Package,
  ShoppingBag,
  ShoppingCart,
  Bookmark,
  Eye,
  EyeOff,
  Shield,
  Heart,
  MessageCircle,
  Sparkles,
  Bell,
  Wallet,
  FileText,
  Receipt,
  UserCog,
  LifeBuoy,
  ClipboardList,
  Flag,
  Route,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserRole } from '@smartshaadi/types';

export type NavItem = { href: string; labelKey: string; Icon: LucideIcon };
export type NavGroup = { titleKey: string; items: NavItem[] };

// ── INDIVIDUAL ──────────────────────────────────────────────────────────────
const INDIVIDUAL_PRIMARY: NavItem[] = [
  { href: '/feed',      labelKey: 'discover', Icon: Home },
  { href: '/chats',     labelKey: 'chats',    Icon: MessageCircle },
  { href: '/weddings',  labelKey: 'wedding',  Icon: Cake },
  { href: '/dashboard', labelKey: 'profile',  Icon: User },
];

const INDIVIDUAL_MORE_GROUPS: NavGroup[] = [
  {
    titleKey: 'groupSocial',
    items: [
      { href: '/requests',      labelKey: 'requests',      Icon: Heart },
      { href: '/matches',       labelKey: 'connections',   Icon: Sparkles },
      { href: '/notifications', labelKey: 'notifications', Icon: Bell },
      { href: '/likes',         labelKey: 'likes',         Icon: Heart },
      { href: '/shortlist',     labelKey: 'shortlist',     Icon: Bookmark },
      { href: '/viewers',       labelKey: 'viewedMe',      Icon: Eye },
    ],
  },
  {
    titleKey: 'groupDiscover',
    items: [
      { href: '/vendors', labelKey: 'vendors', Icon: Search },
    ],
  },
  {
    titleKey: 'groupShop',
    items: [
      { href: '/store',    labelKey: 'shop',     Icon: ShoppingBag },
      { href: '/rentals',  labelKey: 'rentals',  Icon: Package },
      { href: '/bookings', labelKey: 'bookings', Icon: Calendar },
    ],
  },
  {
    titleKey: 'groupMoney',
    items: [
      { href: '/payments',          labelKey: 'payments', Icon: ShoppingCart },
      { href: '/payments/wallet',   labelKey: 'wallet',   Icon: Wallet },
      { href: '/payments/invoices', labelKey: 'invoices', Icon: FileText },
      { href: '/payments/refunds',  labelKey: 'refunds',  Icon: Receipt },
    ],
  },
  {
    titleKey: 'groupSettings',
    items: [
      { href: '/profile/personal',             labelKey: 'editProfile', Icon: UserCog },
      { href: '/settings/privacy',             labelKey: 'privacy',     Icon: EyeOff },
      { href: '/settings/security/two-factor', labelKey: 'security',    Icon: Shield },
    ],
  },
];

// ── VENDOR ──────────────────────────────────────────────────────────────────
const VENDOR_PRIMARY: NavItem[] = [
  { href: '/vendor-dashboard',        labelKey: 'home',     Icon: Home },
  { href: '/bookings',                labelKey: 'bookings', Icon: Calendar },
  { href: '/vendor-dashboard/store',  labelKey: 'products', Icon: Package },
  { href: '/vendor-dashboard/orders', labelKey: 'orders',   Icon: ShoppingCart },
  { href: '/vendor/payouts',          labelKey: 'payouts',  Icon: ShoppingBag },
  { href: '/payments/links',          labelKey: 'links',    Icon: MessageCircle },
  { href: '/profile/personal',        labelKey: 'profile',  Icon: User },
];

// ── ADMIN / SUPPORT ───────────────────────────────────────────────────────────
const ADMIN_PRIMARY: NavItem[] = [
  { href: '/admin',         labelKey: 'admin',    Icon: Home },
  { href: '/admin/revenue', labelKey: 'revenue',  Icon: Search },
  { href: '/admin/kyc',     labelKey: 'kyc',      Icon: Shield },
  { href: '/admin/escrow',  labelKey: 'disputes', Icon: Bookmark },
];

const ADMIN_MORE_GROUPS: NavGroup[] = [
  {
    titleKey: 'groupOperations',
    items: [
      { href: '/admin/vendors',   labelKey: 'vendorApprovals', Icon: Search },
      { href: '/admin/analytics', labelKey: 'analytics',       Icon: Sparkles },
    ],
  },
  {
    titleKey: 'groupMoney',
    items: [
      { href: '/admin/payouts',        labelKey: 'payouts',        Icon: ShoppingBag },
      { href: '/admin/refunds',        labelKey: 'refunds',        Icon: Receipt },
      { href: '/admin/promos',         labelKey: 'promos',         Icon: Heart },
      { href: '/admin/reconciliation', labelKey: 'reconciliation', Icon: FileText },
    ],
  },
  {
    titleKey: 'groupSettings',
    items: [
      { href: '/admin/settings', labelKey: 'settings', Icon: UserCog },
    ],
  },
];

// SUPPORT is guarded OUT of /admin/* by web middleware, so it must NOT get the
// admin nav (clicks would bounce /admin → /dashboard → /support). Own nav only.
const SUPPORT_PRIMARY: NavItem[] = [
  { href: '/support',          labelKey: 'support', Icon: LifeBuoy },
  { href: '/profile/personal', labelKey: 'profile', Icon: User },
];

const SUPPORT_MORE_GROUPS: NavGroup[] = [
  {
    titleKey: 'groupSupport',
    items: [
      { href: '/support',         labelKey: 'ticketQueue',  Icon: LifeBuoy },
      { href: '/support/reports', labelKey: 'abuseReports', Icon: Flag },
    ],
  },
  {
    titleKey: 'groupSettings',
    items: [
      { href: '/settings/security/two-factor', labelKey: 'security', Icon: Shield },
    ],
  },
];

// ── FAMILY_MEMBER ─────────────────────────────────────────────────────────────
const FAMILY_MEMBER_PRIMARY: NavItem[] = [
  { href: '/family',             labelKey: 'family',      Icon: Home },
  { href: '/family/inbox',       labelKey: 'familyInbox', Icon: Bell },
  { href: '/family/parent-mode', labelKey: 'parentMode',  Icon: UserCog },
  { href: '/profile/personal',   labelKey: 'profile',     Icon: User },
];

// ── EVENT_COORDINATOR ─────────────────────────────────────────────────────────
const COORDINATOR_PRIMARY: NavItem[] = [
  { href: '/coordinator',      labelKey: 'coordinator', Icon: ClipboardList },
  { href: '/weddings',         labelKey: 'wedding',     Icon: Cake },
  { href: '/bookings',         labelKey: 'bookings',    Icon: Calendar },
  { href: '/profile/personal', labelKey: 'profile',     Icon: User },
];

const COORDINATOR_MORE_GROUPS: NavGroup[] = [
  {
    titleKey: 'groupTools',
    items: [
      { href: '/coordinator/routing', labelKey: 'vendorRouting', Icon: Route },
      { href: '/vendors',             labelKey: 'vendors',       Icon: Search },
    ],
  },
  {
    titleKey: 'groupSettings',
    items: [
      { href: '/settings/security/two-factor', labelKey: 'security', Icon: Shield },
    ],
  },
];

// ── Selector — single source of truth shared by AppNav + TopNav ────────────────
export function navForRole(role: string): { primary: NavItem[]; moreGroups: NavGroup[] } {
  switch (role as UserRole) {
    case 'ADMIN':
      return { primary: ADMIN_PRIMARY, moreGroups: ADMIN_MORE_GROUPS };
    case 'SUPPORT':
      return { primary: SUPPORT_PRIMARY, moreGroups: SUPPORT_MORE_GROUPS };
    case 'VENDOR':
      return { primary: VENDOR_PRIMARY, moreGroups: [] };
    case 'FAMILY_MEMBER':
      return { primary: FAMILY_MEMBER_PRIMARY, moreGroups: [] };
    case 'EVENT_COORDINATOR':
      return { primary: COORDINATOR_PRIMARY, moreGroups: COORDINATOR_MORE_GROUPS };
    case 'INDIVIDUAL':
    default:
      return { primary: INDIVIDUAL_PRIMARY, moreGroups: INDIVIDUAL_MORE_GROUPS };
  }
}

// Demo-mode route blocklist — hidden when NEXT_PUBLIC_DEMO_MODE === 'true'.
// Prefix-match: any href starting with one of these is filtered out.
const DEMO_HIDDEN_PREFIXES = [
  '/store',
  '/rentals',
  '/admin',
  '/vendor-dashboard',
] as const;

function isDemoMode(): boolean {
  return process.env['NEXT_PUBLIC_DEMO_MODE'] === 'true';
}

export function filterForDemo<T extends { href: string }>(items: T[]): T[] {
  if (!isDemoMode()) return items;
  return items.filter(
    (i) => !DEMO_HIDDEN_PREFIXES.some((p) => i.href === p || i.href.startsWith(`${p}/`)),
  );
}
