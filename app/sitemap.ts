import type { MetadataRoute } from 'next';
import { getZodiacSigns } from '@/lib/supabase/horoscopes';

const SITE = 'https://astrodorado.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const signs = await getZodiacSigns();
  const today = new Date().toISOString().split('T')[0];

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE,
      lastModified: today,
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ];

  const signPages: MetadataRoute.Sitemap = signs.map((s) => ({
    url: `${SITE}/${s.slug}`,
    lastModified: today,
    changeFrequency: 'daily',
    priority: 0.9,
  }));

  return [...staticPages, ...signPages];
}
