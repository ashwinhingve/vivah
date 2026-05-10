import type { MetadataRoute } from 'next';
import { allSlugs } from '@/lib/seo-data';

const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://smartshaadi.in';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`,         lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${SITE_URL}/pricing`,  lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/signup`,   lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/login`,    lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ];

  const programmaticRoutes: MetadataRoute.Sitemap = allSlugs().map((slug) => ({
    url:            `${SITE_URL}/${slug}`,
    lastModified:   now,
    changeFrequency: 'weekly',
    priority:       0.7,
  }));

  return [...staticRoutes, ...programmaticRoutes];
}
