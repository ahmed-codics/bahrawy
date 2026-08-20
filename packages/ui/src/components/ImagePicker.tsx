'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from './Button';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSION = /\.(jpe?g|png|webp)$/i;

const TOO_MANY_MESSAGE = 'يُسمح بإرفاق 3 صور كحد أقصى لكل سؤال أو رد.';
const INVALID_TYPE_MESSAGE =
  'صيغة الملف غير مدعومة. يُسمح فقط بصور JPG أو PNG أو WebP.';
const SIZE_TOO_LARGE_MESSAGE = 'حجم الصورة يجب ألا يتجاوز 5 ميجابايت';

/**
 * Local image picker for attachments. Validates on the client (count, type,
 * extension, size) before the parent ever uploads, shows previews with remove
 * buttons, and exposes the chosen files through a controlled `files` prop.
 * Server-side validation always applies again on upload.
 */
export function ImagePicker({
  files,
  onFilesChange,
  max = 3,
  disabled,
  error,
  onPreview,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  max?: number;
  disabled?: boolean;
  error?: string;
  onPreview?: (src: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const urlCache = useRef<Map<File, string>>(new Map());
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const cache = urlCache.current;
    const currentKeys = new Set(files);
    for (const key of Array.from(cache.keys())) {
      if (!currentKeys.has(key)) {
        URL.revokeObjectURL(cache.get(key) as string);
        cache.delete(key);
      }
    }
    for (const file of files) {
      if (!cache.has(file)) cache.set(file, URL.createObjectURL(file));
    }
    setPreviewUrls(files.map((file) => cache.get(file) as string));
  }, [files]);

  useEffect(
    () => () => {
      for (const url of urlCache.current.values()) URL.revokeObjectURL(url);
      urlCache.current.clear();
    },
    [],
  );

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    setLocalError(null);

    const next = [...files];
    for (const file of selected) {
      if (next.length >= max) {
        setLocalError(TOO_MANY_MESSAGE);
        break;
      }
      if (!ALLOWED_TYPES.includes(file.type) || !ALLOWED_EXTENSION.test(file.name)) {
        setLocalError(INVALID_TYPE_MESSAGE);
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        setLocalError(SIZE_TOO_LARGE_MESSAGE);
        continue;
      }
      next.push(file);
    }
    if (next.length !== files.length) onFilesChange(next);
  };

  const remove = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const errorMessage = localError || error;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || files.length >= max}
          leadingIcon={<ImagePlus className="size-4" />}
          onClick={() => inputRef.current?.click()}
        >
          إضافة صورة
        </Button>
        <span className="ba-number text-xs font-semibold text-text-muted">
          {files.length}/{max}
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFiles}
        aria-label="إضافة صورة"
      />
      {previewUrls.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {previewUrls.map((url, index) => (
            <div key={url} className="group relative">
              <button
                type="button"
                onClick={() => onPreview?.(url)}
                className="block w-full overflow-hidden rounded-lg border border-border bg-surface-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                aria-label={`عرض الصورة ${index + 1}`}
              >
                <img
                  src={url}
                  alt={`صورة مرفقة ${index + 1}`}
                  className="aspect-square w-full object-cover"
                />
              </button>
              <button
                type="button"
                onClick={() => remove(index)}
                className="absolute -end-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full border border-border bg-surface text-ink shadow-sm transition hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                aria-label="إزالة الصورة"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
      {errorMessage && (
        <p role="alert" className="text-xs font-bold text-danger">
          {errorMessage}
        </p>
      )}
    </div>
  );
}