import { permanentRedirect } from 'next/navigation';

export default async function GradePage({
  params,
}: {
  params: Promise<{ gradeId: string }>;
}) {
  const { gradeId } = await params;
  permanentRedirect(`/courses?gradeId=${encodeURIComponent(gradeId)}`);
}
