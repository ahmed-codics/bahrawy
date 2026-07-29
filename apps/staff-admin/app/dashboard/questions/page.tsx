'use client';

import { FormEvent, useCallback, useDeferredValue, useEffect, useState } from 'react';
import { Archive, Pencil, Plus, RotateCcw } from 'lucide-react';
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
import { ReasonActionDialog } from '../_components/ReasonActionDialog';

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
  version: number;
};

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [lifecycleQuestion, setLifecycleQuestion] = useState<Question | null>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        archived: String(showArchived),
        page: String(page),
        pageSize: '25',
      });
      if (deferredSearch.trim()) query.set('search', deferredSearch.trim());
      const response = await fetchApi(`/admin/v1/questions?${query}`);
      setQuestions(response.data.items as Question[]);
      setPageCount(response.data.meta.pageCount);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل الأسئلة');
    } finally {
      setLoading(false);
    }
  }, [deferredSearch, page, showArchived]);

  useEffect(() => {
    void load();
  }, [load]);

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
          <Button
            leadingIcon={<Plus className="size-4" />}
            onClick={() => {
              setEditingQuestion(null);
              setDrawerOpen(true);
            }}
          >
            سؤال جديد
          </Button>
        }
      />
      <FilterBar
        value={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="ابحث في نص السؤال أو الوسوم"
        filters={
          <label className="flex min-h-10 items-center gap-2 whitespace-nowrap text-sm">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => {
                setShowArchived(event.target.checked);
                setPage(1);
              }}
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
        data={questions}
        keyExtractor={(row) => row.id}
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        rowActions={(row) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="تعديل السؤال"
              onClick={() => {
                setEditingQuestion(row);
                setDrawerOpen(true);
              }}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={showArchived ? 'استعادة السؤال' : 'أرشفة السؤال'}
              onClick={() => setLifecycleQuestion(row)}
            >
              {showArchived ? <RotateCcw className="size-4" /> : <Archive className="size-4" />}
            </Button>
          </div>
        )}
      />
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingQuestion ? 'تعديل السؤال' : 'إضافة سؤال'}
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
              await fetchApi(
                editingQuestion
                  ? `/admin/v1/questions/${editingQuestion.id}`
                  : '/admin/v1/questions',
                {
                method: editingQuestion ? 'PATCH' : 'POST',
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
                  ...(editingQuestion ? { version: editingQuestion.version } : {}),
                }),
              });
              setDrawerOpen(false);
              setEditingQuestion(null);
              await load();
            } finally {
              setSaving(false);
            }
          }}
        >
          <Input
            name="titleAr"
            label="نص السؤال"
            defaultValue={editingQuestion?.titleAr ?? ''}
            required
          />
          <Input
            name="option1"
            label="الاختيار الأول"
            defaultValue={editingQuestion?.options[0]?.textAr ?? ''}
            required
          />
          <Input
            name="option2"
            label="الاختيار الثاني"
            defaultValue={editingQuestion?.options[1]?.textAr ?? ''}
            required
          />
          <label className="block text-sm font-medium text-ink-2">
            الإجابة الصحيحة
            <select
              name="correctOptionId"
              defaultValue={editingQuestion?.correctOptionId ?? '1'}
              className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3"
              required
            >
              <option value="1">الاختيار الأول</option>
              <option value="2">الاختيار الثاني</option>
            </select>
          </label>
          <Input
            name="points"
            type="number"
            min="1"
            defaultValue={editingQuestion?.points ?? 1}
            label="الدرجة"
          />
          <Input
            name="tags"
            label="الوسوم"
            defaultValue={editingQuestion?.tags.join(', ') ?? ''}
            hint="افصل بين الوسوم بفاصلة"
          />
        </form>
      </Drawer>
      {lifecycleQuestion && (
        <ReasonActionDialog
          open
          title={showArchived ? 'استعادة السؤال' : 'أرشفة السؤال'}
          description={
            showArchived
              ? 'سيعود السؤال إلى بنك الأسئلة النشط ويمكن استخدامه في اختبارات جديدة.'
              : `سيختفي السؤال من الاختيار للاختبارات الجديدة، لكنه سيظل محفوظاً في ${lifecycleQuestion._count.assessments} اختبار مرتبط.`
          }
          confirmLabel={showArchived ? 'استعادة السؤال' : 'أرشفة السؤال'}
          tone={showArchived ? 'primary' : 'danger'}
          onClose={() => setLifecycleQuestion(null)}
          onConfirm={async (reason) => {
            await fetchApi(
              `/admin/v1/questions/${lifecycleQuestion.id}/${showArchived ? 'restore' : 'archive'}`,
              {
                method: 'PATCH',
                body: JSON.stringify({
                  version: lifecycleQuestion.version,
                  reason,
                }),
              },
            );
            setLifecycleQuestion(null);
            await load();
          }}
        />
      )}
    </div>
  );
}
