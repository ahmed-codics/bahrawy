import type { MetadataRoute } from 'next';

type SitemapGrade = { id: string };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://el-bahrawy.com';
  let gradeRoutes: MetadataRoute.Sitemap = [];

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/catalog/grades`, { next: { revalidate: 3600 } });
    if (response.ok) {
      const payload = (await response.json()) as { data?: SitemapGrade[] };
      gradeRoutes = (payload.data || []).map((grade) => ({
        url: `${baseUrl}/courses?gradeId=${encodeURIComponent(grade.id)}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      }));
    }
  } catch {
    // Static public routes still produce a valid sitemap if the API is unavailable.
  }

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/courses`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...gradeRoutes,
  ];
}
