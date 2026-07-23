'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Pencil, Plus, RotateCcw } from 'lucide-react';
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
} from '@bahrawy/ui';
import { fetchApi } from '../../../lib/api';

type Question = {
  id: string;
  titleAr: string;
  type: string;
  points: number;
  options: { id: string; textAr: string }[];
  correctOptionId: string;
  tags: string[];
  archivedAt?: string | null;
  _count: { assessments: number };
};

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchApi<AdminApiResponse<Question[]>>(
        `/admin/v1/questions?archived=${showArchived}`,
      );
      setQuestions(response.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل الأسئلة');
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const value = search.trim().toLowerCase();
    return value
      ? questions.filter((question) =>
          [question.titleAr, ...question.tags].some((text) => text.toLowerCase().includes(value)),
        )
      : questions;
  }, [questions, search]);

  if (loading && !questions.length) return <PageSkeleton cards={5} />;
  if (error && !questions.length) {
    return <ErrorState title="تعذر تحميل بنك الأسئلة" description={error} onRetry={load} />;
  }

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        eyebrow="التقييم والتدريب"
        title="بنك الأسئلة"
        description="أسئلة قابلة لإعادة الاستخدام مع تتبع عدد الاختبارات المرتبطة."
        actions={
          <Button leadingIcon={<Plus className="size-4" />} onClick={() => setDrawerOpen(true)}>
            سؤال جديد
          </Button>
        }
      />
      <FilterBar
        value={search}
        onSearch={setSearch}
        searchPlaceholder="ابحث في نص السؤال أو الوسوم"
        filters={
          <label className="flex min-h-10 items-center gap-2 whitespace-nowrap text-sm">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            عرض المؤرشف
          </label>
        }
      />
      <DataTable
        loading={loading}
        error={error}
        columns={[
          {
            id: 'question',
            header: 'السؤال',
            cell: (row: Question) => (
              <div className="max-w-xl">
                <strong>{row.titleAr}</strong>
                <p className="text-xs text-ink-3">{row.tags.join(' · ')}</p>
              </div>
            ),
          },
          {
            id: 'type',
            header: 'النوع',
            cell: (row: Question) => <Badge tone="blue">{row.type}</Badge>,
          },
          { id: 'points', header: 'الدرجة', cell: (row: Question) => row.points, align: 'center' },
          {
            id: 'usage',
            header: 'الاستخدام',
            cell: (row: Question) => `${row._count.assessments} اختبار`,
            align: 'center',
          },
        ]}
        data={visible}
        keyExtractor={(row) => row.id}
        rowActions={(row) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" aria-label="تعديل السؤال">
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={showArchived ? 'استعادة السؤال' : 'أرشفة السؤال'}
              onClick={async () => {
                await fetchApi(
                  `/admin/v1/questions/${row.id}/${showArchived ? 'restore' : 'archive'}`,
                  { method: 'PATCH' },
                );
                await load();
              }}
            >
              {showArchived ? <RotateCcw className="size-4" /> : <Archive className="size-4" />}
            </Button>
          </div>
        )}
      />
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="إضافة سؤال"
        footer={
          <Button type="submit" form="question-form" loading={saving}>
            حفظ السؤال
          </Button>
        }
      >
        <form
          id="question-form"
          className="space-y-4"
          onSubmit={async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setSaving(true);
            try {
              await fetchApi('/admin/v1/questions', {
                method: 'POST',
                body: JSON.stringify({
                  titleAr: form.get('titleAr'),
                  options: [
                    { id: '1', textAr: form.get('option1') },
                    { id: '2', textAr: form.get('option2') },
                  ],
                  correctOptionId: form.get('correctOptionId'),
                  points: Number(form.get('points')) || 1,
                  tags: String(form.get('tags') || '')
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                }),
              });
              setDrawerOpen(false);
              await load();
            } finally {
              setSaving(false);
            }
          }}
        >
          <Input name="titleAr" label="نص السؤال" required />
          <Input name="option1" label="الاختيار الأول" required />
          <Input name="option2" label="الاختيار الثاني" required />
          <label className="block text-sm font-medium text-ink-2">
            الإجابة الصحيحة
            <select
              name="correctOptionId"
              className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3"
              required
            >
              <option value="1">الاختيار الأول</option>
              <option value="2">الاختيار الثاني</option>
            </select>
          </label>
          <Input name="points" type="number" min="1" defaultValue="1" label="الدرجة" />
          <Input name="tags" label="الوسوم" hint="افصل بين الوسوم بفاصلة" />
        </form>
      </Drawer>
    </div>
  );
}
