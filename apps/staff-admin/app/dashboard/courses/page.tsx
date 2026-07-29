'use client';

import { FormEvent, useCallback, useDeferredValue, useEffect, useState } from 'react';
import { Archive, Eye, ImageIcon, Plus } from 'lucide-react';
import type { AdminApiResponse } from '@bahrawy/types';
import {
  Badge,
  Button,
  DataTable,
  Drawer,
  ErrorState,
  FilterBar,
  Input,
  PageHeader,
  PageSkeleton,
  Select,
} from '@bahrawy/ui';
import { useRouter } from 'next/navigation';
import { API_BASE, fetchApi } from '../../../lib/api';

type AcademicOption = { id: string; nameAr?: string; label?: string; code: string };
type AcademicOverview = {
  grades: AcademicOption[];
  subjects: AcademicOption[];
  cohorts: { terms: { id: string; titleAr: string; code: string }[] }[];
};
type Course = {
  id: string;
  code: string;
  titleAr: string;
  titleEn?: string;
  coverImageUrl?: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishAt?: string;
  unpublishAt?: string;
  updatedAt: string;
  grade?: { nameAr: string };
  subject?: { nameAr: string };
  term?: { titleAr: string };
  _count: { chapters: number; products: number };
  readiness: { lessons: number; videos: number; pdfs: number; assessments: number };
};
type CourseList = {
  items: Course[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
};

function lifecycleBadge(course: Course) {
  if (course.status === 'ARCHIVED') return <Badge tone="neutral">مؤرشف</Badge>;
  if (course.status === 'DRAFT') return <Badge tone="amber">مسودة</Badge>;
  if (course.publishAt && new Date(course.publishAt) > new Date()) {
    return <Badge tone="blue">مجدول</Badge>;
  }
  return <Badge tone="success">منشور</Badge>;
}

function readiness(value: number, total: number) {
  return (
    <span className={value === total && total > 0 ? 'text-success' : 'text-ink-3'}>
      <span className="ba-number">
        {value}/{total}
      </span>
    </span>
  );
}

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [academic, setAcademic] = useState<AcademicOverview | null>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [gradeId, setGradeId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (gradeId) query.set('gradeId', gradeId);
      if (status) query.set('status', status);
      if (deferredSearch.trim()) query.set('search', deferredSearch.trim());
      query.set('page', String(page));
      query.set('pageSize', '24');
      const [courseResponse, academicResponse] = await Promise.all([
        fetchApi<AdminApiResponse<CourseList>>(`/admin/v1/courses?${query}`),
        fetchApi<AdminApiResponse<AcademicOverview>>('/admin/v1/academic'),
      ]);
      setCourses(courseResponse.data.items);
      setPageCount(courseResponse.data.meta.pageCount);
      setAcademic(academicResponse.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل الكورسات');
    } finally {
      setLoading(false);
    }
  }, [deferredSearch, gradeId, page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleCourses = courses.filter(
    (course) => status === 'ARCHIVED' || course.status !== 'ARCHIVED',
  );

  if (loading && !academic) return <PageSkeleton cards={6} />;
  if (error && !academic) {
    return <ErrorState title="تعذر تحميل الكورسات" description={error} onRetry={load} />;
  }

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        eyebrow="المحتوى الأكاديمي"
        title="الكورسات"
        description="إدارة المحتوى وحالة النشر والجاهزية والارتباط بالباقات."
        actions={
          <Button leadingIcon={<Plus className="size-4" />} onClick={() => setDrawerOpen(true)}>
            كورس جديد
          </Button>
        }
      />

      <div className="flex gap-2 border-b border-border pb-3">
        <Button variant={status !== 'ARCHIVED' ? 'primary' : 'ghost'} onClick={() => setStatus('')}>
          الكورسات الحالية
        </Button>
        <Button
          variant={status === 'ARCHIVED' ? 'primary' : 'ghost'}
          leadingIcon={<Archive className="size-4" />}
          onClick={() => setStatus('ARCHIVED')}
        >
          الأرشيف
        </Button>
      </div>

      <FilterBar
        value={search}
        searchPlaceholder="ابحث بالاسم أو الكود"
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        filters={
          <>
            <Select
              aria-label="تصفية بالمرحلة"
              value={gradeId}
              onChange={(event) => {
                setGradeId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">كل المراحل</option>
              {academic?.grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.nameAr}
                </option>
              ))}
            </Select>
          </>
        }
      />

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="hidden xl:block">
        <DataTable
          loading={loading}
          emptyMessage="لا توجد كورسات مطابقة"
          columns={[
          {
            id: 'course',
            header: 'الكورس',
            cell: (course: Course) => (
              <div className="min-w-52">
                <strong>{course.titleAr}</strong>
                <p className="text-xs text-ink-3" dir="ltr">
                  {course.code}
                </p>
              </div>
            ),
          },
          {
            id: 'context',
            header: 'السياق',
            cell: (course: Course) => (
              <div>
                <span>{course.grade?.nameAr || 'بدون مرحلة'}</span>
                <p className="text-xs text-ink-3">
                  {course.subject?.nameAr || 'بدون مادة'}
                  {course.term ? ` · ${course.term.titleAr}` : ''}
                </p>
              </div>
            ),
          },
          { id: 'status', header: 'النشر', cell: lifecycleBadge },
          {
            id: 'lessons',
            header: 'الدروس',
            cell: (course: Course) => course.readiness.lessons,
            align: 'center',
          },
          {
            id: 'video',
            header: 'فيديو',
            cell: (course: Course) => readiness(course.readiness.videos, course.readiness.lessons),
            align: 'center',
          },
          {
            id: 'pdf',
            header: 'PDF',
            cell: (course: Course) => readiness(course.readiness.pdfs, course.readiness.lessons),
            align: 'center',
          },
          {
            id: 'assessment',
            header: 'اختبار',
            cell: (course: Course) =>
              readiness(course.readiness.assessments, course.readiness.lessons),
            align: 'center',
          },
          {
            id: 'bundles',
            header: 'الباقات',
            cell: (course: Course) => course._count.products,
            align: 'center',
          },
        ]}
          data={visibleCourses}
          keyExtractor={(course) => course.id}
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
          rowActions={(course) => (
            <Button
              variant="ghost"
              size="icon"
              aria-label="فتح الكورس"
              onClick={() => router.push(`/dashboard/courses/${course.id}`)}
            >
              <Eye className="size-4" />
            </Button>
          )}
        />
      </div>

      {!loading && visibleCourses.length === 0 ? (
        <div className="border border-dashed border-border p-10 text-center text-ink-3">
          {status === 'ARCHIVED' ? 'لا توجد كورسات مؤرشفة' : 'لا توجد كورسات مطابقة'}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:hidden">
          {visibleCourses.map((course) => (
            <article
              key={course.id}
              className="overflow-hidden border border-border bg-surface-1 transition hover:border-brand-400"
            >
              <div className="relative aspect-video overflow-hidden bg-surface-2">
                {course.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${API_BASE}${course.coverImageUrl}`}
                    alt={course.titleAr}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-ink-3">
                    <ImageIcon className="size-10" />
                  </div>
                )}
                <div className="absolute right-3 top-3">{lifecycleBadge(course)}</div>
              </div>
              <div className="space-y-4 p-4">
                <div>
                  <h2 className="text-lg font-bold text-ink">{course.titleAr}</h2>
                  <p className="mt-1 text-xs text-ink-3" dir="ltr">{course.code}</p>
                  <p className="mt-2 text-sm text-ink-3">
                    {course.grade?.nameAr || 'بدون مرحلة'} · {course.subject?.nameAr || 'بدون مادة'}
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2 border-y border-border py-3 text-center text-xs">
                  <div><strong className="block text-base">{course.readiness.lessons}</strong>درس</div>
                  <div><strong className="block text-base">{readiness(course.readiness.videos, course.readiness.lessons)}</strong>فيديو</div>
                  <div><strong className="block text-base">{readiness(course.readiness.pdfs, course.readiness.lessons)}</strong>PDF</div>
                  <div><strong className="block text-base">{course._count.products}</strong>باقة</div>
                </div>
                <Button
                  className="w-full"
                  variant="outline"
                  leadingIcon={<Eye className="size-4" />}
                  onClick={() => router.push(`/dashboard/courses/${course.id}`)}
                >
                  إدارة الكورس
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-between xl:hidden">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            السابق
          </Button>
          <span className="text-sm text-ink-3">
            صفحة {page} من {pageCount}
          </span>
          <Button
            variant="outline"
            disabled={page >= pageCount}
            onClick={() => setPage((value) => value + 1)}
          >
            التالي
          </Button>
        </div>
      )}

      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="إنشاء كورس"
        footer={
          <Button type="submit" form="create-course" loading={saving}>
            إنشاء كمسودة
          </Button>
        }
      >
        <form
          id="create-course"
          className="space-y-4"
          onSubmit={async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            setSaving(true);
            try {
              const formData = new FormData(event.currentTarget);
              const image = formData.get('coverImage');
              formData.delete('coverImage');
              let coverImageUrl: string | undefined;
              if (image instanceof File && image.size > 0) {
                const upload = new FormData();
                upload.append('file', image);
                const uploaded = await fetchApi('/storage/upload', {
                  method: 'POST',
                  body: upload,
                  timeoutMs: 60_000,
                });
                coverImageUrl = `/storage/${uploaded.data.storedObjectId}`;
              }
              const payload = { ...Object.fromEntries(formData), coverImageUrl };
              const response = await fetchApi<AdminApiResponse<Course>>('/admin/v1/courses', {
                method: 'POST',
                body: JSON.stringify(payload),
              });
              setDrawerOpen(false);
              router.push(`/dashboard/courses/${response.data.id}`);
            } finally {
              setSaving(false);
            }
          }}
        >
          <Input name="titleAr" label="اسم الكورس بالعربية" required />
          <Input name="titleEn" label="الاسم بالإنجليزية" directionMode="ltr" />
          <Input name="code" label="الكود" directionMode="ltr" required />
          <Select name="gradeId" label="المرحلة">
            <option value="">بدون مرحلة</option>
            {academic?.grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.nameAr}
              </option>
            ))}
          </Select>
          <Select name="subjectId" label="المادة">
            <option value="">بدون مادة</option>
            {academic?.subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.nameAr}
              </option>
            ))}
          </Select>
          <Input name="descriptionAr" label="وصف مختصر" />
          <label className="block space-y-2 text-sm font-bold text-ink">
            صورة الكورس
            <input
              name="coverImage"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="block w-full border border-border bg-surface-1 p-3 text-sm"
            />
          </label>
          <div className="border-t border-border pt-4 text-sm text-ink-3">
            يبدأ الكورس كمسودة. نشر الكورس لا ينشر الدروس المسودة تلقائياً.
          </div>
        </form>
      </Drawer>
    </div>
  );
}
