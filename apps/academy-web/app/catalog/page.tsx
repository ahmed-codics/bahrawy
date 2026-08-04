import { permanentRedirect } from 'next/navigation';

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const gradeId = typeof query.gradeId === 'string' ? query.gradeId : '';
  permanentRedirect(gradeId ? `/courses?gradeId=${encodeURIComponent(gradeId)}` : '/courses');
}
