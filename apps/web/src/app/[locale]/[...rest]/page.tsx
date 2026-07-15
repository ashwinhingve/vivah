import { notFound } from 'next/navigation';

/**
 * Locale-level catch-all: routes every unmatched path (any depth) into the
 * [locale] segment so notFound() renders [locale]/not-found.tsx WITH intl
 * context. Without this, multi-segment unknown paths fall through to the
 * root not-found, which has no next-intl provider → 500.
 */
export default function CatchAllNotFound(): never {
  notFound();
}
