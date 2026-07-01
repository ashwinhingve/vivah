import type { MetadataRoute } from 'next';
import { allSlugs } from '@/lib/seo-data';

const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://smartshaadi.co.in';

type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;

// localePrefix is 'as-needed': en at the bare path, hi under /hi.
function localeAlternates(path: string): { languages: Record<string, string> } {
  const hiPath = path === '/' ? '/hi' : `/hi${path}`;
  return { languages: { 'en-IN': `${SITE_URL}${path}`, 'hi-IN': `${SITE_URL}${hiPath}` } };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticDefs: { path: string; changeFrequency: ChangeFrequency; priority: number }[] = [
    { path: '/',         changeFrequency: 'weekly',  priority: 1.0 },
    { path: '/pricing',  changeFrequency: 'monthly', priority: 0.8 },
    { path: '/register', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/login',    changeFrequency: 'yearly',  priority: 0.3 },
  ];

  const staticRoutes: MetadataRoute.Sitemap = staticDefs.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
    alternates: localeAlternates(path),
  }));

  // 22 programmatic SEO landing pages (communities / cities / castes) — indexable.
  const programmaticRoutes: MetadataRoute.Sitemap = allSlugs().map((slug) => ({
    url: `${SITE_URL}/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
    alternates: localeAlternates(`/${slug}`),
  }));

  return [...staticRoutes, ...programmaticRoutes];
}
