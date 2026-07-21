'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bell } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Sheet, SheetTrigger, SheetContent } from '@/components/ui/sheet';
import { useNotifications } from '@/lib/notifications/NotificationsProvider.client';
import { NotificationPanel } from './NotificationPanel.client';

/**
 * Navbar bell + unread badge. Desktop opens a Popover under the bell; mobile
 * opens a bottom Sheet. Both render the same NotificationPanel.
 */
export function NotificationBell() {
  const t = useTranslations('notifications');
  const { unreadCount } = useNotifications();
  const [openDesktop, setOpenDesktop] = useState(false);
  const [openMobile, setOpenMobile] = useState(false);

  const label = unreadCount > 0 ? t('bell.labelWithCount', { count: unreadCount }) : t('bell.label');
  const badge = unreadCount > 99 ? '99+' : String(unreadCount);

  const trigger = (
    <button
      type="button"
      aria-label={label}
      className="relative flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute right-1 top-1 flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-2xs font-bold leading-4 text-white ring-2 ring-surface">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <>
      <div className="hidden md:block">
        <Popover open={openDesktop} onOpenChange={setOpenDesktop}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent align="end" sideOffset={10} className="w-[22rem] p-2">
            <NotificationPanel onClose={() => setOpenDesktop(false)} />
          </PopoverContent>
        </Popover>
      </div>

      <div className="md:hidden">
        <Sheet open={openMobile} onOpenChange={setOpenMobile}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl px-3 pb-6 pt-4">
            <NotificationPanel onClose={() => setOpenMobile(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
