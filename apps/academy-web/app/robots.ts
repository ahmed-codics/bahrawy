import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/student/', '/guardian/', '/change-password', '/api/'],
    },
    sitemap: 'https://el-bahrawy.com/sitemap.xml',
  };
}
