'use client';

import { FormEvent, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Input, Textarea } from '@bahrawy/ui';
import { fetchApi } from '../../../../../lib/api';

type QuestionModalProps = {
  assessmentId: string;
  onClose: () => void;
  onReload: () => Promise<void>;
};

export function QuestionModal({
  assessmentId,
  onClose,
  onReload,
}: QuestionModalProps) {
  const [saving, setSaving] = useState(false);
  const [correctIndex, setCorrectIndex] = useState(0);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const optionTexts = ['a', 'b', 'c', 'd'].map((key) =>
      String(form.get(`option-${key}`) || '').trim(),
    );
    if (optionTexts.some((text) => !text)) {
      toast.error('اكتب كل الاختيارات الأربعة');
      return;
    }

    const options = optionTexts.map((text) => ({
      id:
        typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      text,
    }));

    setSaving(true);
    try {
      await fetchApi(`/staff/assessments/${assessmentId}/questions`, {
        method: 'POST',
        body: JSON.stringify({
          titleAr: String(form.get('titleAr') || '').trim(),
          options,
          correctOptionId: options[correctIndex].id,
          explanation: String(form.get('explanation') || '').trim(),
          points: Number(form.get('points') || 1),
        }),
      });
      toast.success('تمت إضافة السؤال');
      await onReload();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشل إضافة السؤال');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border-default bg-surface p-5 shadow-xl"
      >
        <div className="mb-5">
          <h2 className="font-heading text-xl font-black">إضافة سؤال جديد</h2>
          <p className="mt-1 text-sm text-text-muted">
            اكتب السؤال والاختيارات وحدد الإجابة الصحيحة.
          </p>
        </div>

        <div className="space-y-4">
          <Textarea name="titleAr" label="نص السؤال" required rows={3} />
          <div className="grid gap-3 sm:grid-cols-2">
            {['A', 'B', 'C', 'D'].map((label, index) => (
              <div key={label} className="rounded-lg border border-border-default p-3">
                <Input
                  name={`option-${label.toLowerCase()}`}
                  label={`الاختيار ${label}`}
                  required
                />
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="correct"
                    checked={correctIndex === index}
                    onChange={() => setCorrectIndex(index)}
                  />
                  الإجابة الصحيحة
                </label>
              </div>
            ))}
          </div>
          <Textarea name="explanation" label="الشرح" rows={3} />
          <Input name="points" label="النقاط" type="number" min="1" defaultValue="1" />
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" loading={saving}>
            حفظ السؤال
          </Button>
        </div>
      </form>
    </div>
  );
}
