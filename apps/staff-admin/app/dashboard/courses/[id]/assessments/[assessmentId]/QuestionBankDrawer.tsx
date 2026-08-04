'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Button, Drawer, Input } from '@bahrawy/ui';
import { fetchApi } from '../../../../../../lib/api';

type BankQuestion = {
  id: string;
  titleAr: string;
  points: number;
  tags: string[];
};

type QuestionBankDrawerProps = {
  assessmentId: string;
  assignedQuestionIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onAssigned: () => Promise<void>;
};

export function QuestionBankDrawer({
  assessmentId,
  assignedQuestionIds,
  isOpen,
  onClose,
  onAssigned,
}: QuestionBankDrawerProps) {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchApi('/admin/v1/questions?pageSize=100')
      .then((response) =>
        setQuestions((response.data.items ?? response.data) as BankQuestion[]),
      )
      .finally(() => setLoading(false));
  }, [isOpen]);

  const assigned = useMemo(() => new Set(assignedQuestionIds), [assignedQuestionIds]);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return questions.filter(
      (question) =>
        !assigned.has(question.id) &&
        (!query ||
          question.titleAr.toLowerCase().includes(query) ||
          question.tags.some((tag) => tag.toLowerCase().includes(query))),
    );
  }, [assigned, questions, search]);

  const toggle = (questionId: string) => {
    setSelected((current) =>
      current.includes(questionId)
        ? current.filter((id) => id !== questionId)
        : [...current, questionId],
    );
  };

  const assign = async () => {
    if (!selected.length) return;
    setSaving(true);
    try {
      await fetchApi(`/admin/v1/questions/assessments/${assessmentId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ questionIds: selected }),
      });
      setSelected([]);
      await onAssigned();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="اختيار أسئلة من البنك"
      footer={
        <Button onClick={() => void assign()} loading={saving} disabled={!selected.length}>
          إضافة المحدد ({selected.length})
        </Button>
      }
    >
      <div className="space-y-4" dir="rtl">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ابحث في نص السؤال أو الوسوم"
          leadingIcon={<Search className="size-4" />}
        />
        <div className="divide-y divide-border border-y border-border">
          {loading && <p className="py-8 text-center text-sm text-ink-3">جاري التحميل...</p>}
          {!loading && visible.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-3">لا توجد أسئلة متاحة</p>
          )}
          {visible.map((question) => {
            const checked = selected.includes(question.id);
            return (
              <button
                key={question.id}
                type="button"
                onClick={() => toggle(question.id)}
                className="flex w-full items-start gap-3 px-1 py-4 text-right hover:bg-surface-2"
              >
                <span
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center border ${
                    checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-border'
                  }`}
                >
                  {checked && <Check className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="line-clamp-2 text-sm">{question.titleAr}</strong>
                  <span className="mt-1 block text-xs text-ink-3">
                    {question.points} نقطة
                    {question.tags.length ? ` · ${question.tags.join('، ')}` : ''}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Drawer>
  );
}
