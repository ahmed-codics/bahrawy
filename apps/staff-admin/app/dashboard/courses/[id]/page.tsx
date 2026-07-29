'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, FileText, ListChecks, Video } from 'lucide-react';
import { Button, Card, CardContent, ErrorState, PageSkeleton, StatCard } from '@bahrawy/ui';
import { fetchApi } from '../../../../lib/api';
import { CourseHeader } from './components/CourseHeader';
import type { CourseWithContent } from './components/types';

export default function CourseOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [course, setCourse] = useState<CourseWithContent | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetchApi(`/admin/v1/courses/${id}`);
      setCourse(response.data as CourseWithContent);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'تعذر تحميل الكورس',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <PageSkeleton cards={5} />;
  if (!course) {
    return (
      <ErrorState
        title="تعذر فتح الكورس"
        description={error}
        onRetry={() => {
          setLoading(true);
          void load();
        }}
      />
    );
  }

  const units = course.chapters.flatMap((chapter) => chapter.units);
  const lessons = units.flatMap((unit) => unit.lessons);
  const videos = lessons.filter((lesson) => lesson.videoLesson).length;
  const pdfs = lessons.filter(
    (lesson) => lesson.contentType === 'PDF' || lesson.attachedPdfUrl,
  ).length;
  const assessments = units.reduce(
    (total, unit) => total + unit.assessments.length,
    0,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <CourseHeader course={course} onReload={load} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="الفصول"
          value={course.chapters.length}
          icon={<BookOpen className="size-5" />}
          tone="blue"
        />
        <StatCard
          label="الدروس"
          value={lessons.length}
          icon={<FileText className="size-5" />}
          tone="cyan"
        />
        <StatCard
          label="الفيديو"
          value={videos}
          icon={<Video className="size-5" />}
          tone="amber"
        />
        <StatCard
          label="الاختبارات"
          value={assessments}
          icon={<ListChecks className="size-5" />}
          tone="violet"
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <p className="text-xs font-bold text-brand-600">جاهزية المحتوى</p>
              <h2 className="mt-1 text-xl font-black">راجع الكورس قبل النشر</h2>
            </div>
            <div className="space-y-3 text-sm">
              <ReadinessRow label="بيانات الكورس الأساسية" ready={Boolean(course.titleAr)} />
              <ReadinessRow label="صورة الغلاف" ready={Boolean(course.coverImageUrl)} />
              <ReadinessRow label="وجود فصل ووحدة واحدة على الأقل" ready={units.length > 0} />
              <ReadinessRow label="فيديو واحد على الأقل" ready={videos > 0} />
              <ReadinessRow label="ملف PDF واحد على الأقل" ready={pdfs > 0} />
            </div>
          </CardContent>
        </Card>

        <Card tone="blue">
          <CardContent className="space-y-3 pt-6">
            <h2 className="text-xl font-black">الخطوة التالية</h2>
            <p className="text-sm text-ink-3">
              المنهج أصبح مساحة منفصلة لتنظيم الفصول والوحدات. افتح الوحدة لإضافة
              دروسها ومحتواها.
            </p>
            <Button
              className="w-full"
              onClick={() =>
                router.push(`/dashboard/courses/${course.id}/curriculum`)
              }
            >
              فتح بناء المنهج
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ReadinessRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
      <span>{label}</span>
      <span className={ready ? 'font-bold text-success' : 'font-bold text-amber-700'}>
        {ready ? 'جاهز' : 'يحتاج استكمال'}
      </span>
    </div>
  );
}
