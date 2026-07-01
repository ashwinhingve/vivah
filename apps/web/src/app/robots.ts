import type { MetadataRoute } from 'next';

const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://smartshaadi.co.in';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Private / logged-in surfaces — never crawl (mirrors per-page noindex).
      disallow: [
        '/admin',
        '/feed',
        '/profiles/',
        '/chat/',
        '/api/',
        '/actions/',
        '/dashboard/',
        '/onboarding/',
        '/settings/',
        '/account',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
