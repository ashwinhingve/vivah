'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageCircle } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { AssistantChat } from './AssistantChat.client';

/**
 * Floating bottom-right trigger that opens the Matrimony AI Assistant in a
 * side sheet. Lives in the (app) layout so it appears on every authenticated
 * route. The full-page view at /assistant uses the same component without
 * the toggle wrapper.
 */
export function AssistantToggle() {
  const t = useTranslations('assistant.toggle');
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 sm:bottom-6 z-40 flex items-center justify-center h-12 w-12 rounded-full bg-primary text-white shadow-card-hover hover:scale-105 transition-transform"
        aria-label={t('label')}
      >
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b border-gold/20">
            <SheetTitle className="text-base font-heading">{t('title')}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0">
            <AssistantChat compact />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
