'use client';

import { FormEvent, useState } from 'react';
import { Button, Input } from '@bahrawy/ui';

type InlineFormProps = {
  label: string;
  placeholder: string;
  onSave: (value: string) => Promise<void>;
  onCancel: () => void;
};

export function InlineForm({
  label,
  placeholder,
  onSave,
  onCancel,
}: InlineFormProps) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSave(trimmed);
      setValue('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border-default bg-surface-soft p-4"
    >
      <Input
        autoFocus
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={saving}>
          حفظ
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}
