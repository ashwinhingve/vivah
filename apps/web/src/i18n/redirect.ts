import { redirect as nextRedirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { routing } from './routing';

export async function redirect(href: string): Promise<never> {
  if (/^https?:\/\//i.test(href)) {
    nextRedirect(href);
  }

  const locale = await getLocale();
  const prefixed =
    locale === routing.defaultLocale ? href : `/${locale}${href}`;
  nextRedirect(prefixed);
}
