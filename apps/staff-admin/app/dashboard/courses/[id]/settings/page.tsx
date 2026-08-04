'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { ErrorState, PageSkeleton } from '@bahrawy/ui';
import { fetchApi } from '../../../../../lib/api';
import { CourseHeader } from '../components/CourseHeader';
import type { CourseWithContent } from '../components/types';

export default function CourseSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [course, setCourse] = useState<CourseWithContent | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetchApi(`/admin/v1/courses/${id}`);
      setCourse(response.data as CourseWithContent);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'تعذر تحميل الإعدادات',
      );
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !course) {
    return <ErrorState title="تعذر تحميل الإعدادات" description={error} onRetry={load} />;
  }
  if (!course) return <PageSkeleton cards={3} />;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <CourseHeader course={course} onReload={load} />
      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-xl font-black">إعدادات مستقلة وآمنة</h2>
        <p className="mt-2 text-sm leading-7 text-ink-3">
          استخدم زر إعدادات الكورس لتعديل الهوية ومواعيد النشر. الأرشفة والحذف
          منفصلان دائماً ويعرضان الارتباطات المتأثرة قبل التنفيذ.
        </p>
      </section>
    </div>
  );
}
