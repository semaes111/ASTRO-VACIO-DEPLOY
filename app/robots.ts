import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/vip/'],
      },
    ],
    sitemap: 'https://astrodorado.com/sitemap.xml',
    host: 'https://astrodorado.com',
  };
}
