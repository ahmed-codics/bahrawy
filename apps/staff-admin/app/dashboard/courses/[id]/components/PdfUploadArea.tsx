'use client';

import { ChangeEvent, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, FileText, Upload } from 'lucide-react';
import { Button } from '@bahrawy/ui';
import { fetchApi } from '../../../../../lib/api';
import type { ContentItem } from './types';

type PdfUploadAreaProps = {
  pdfItem: ContentItem | null;
  unitId: string;
  onReload: () => Promise<void>;
};

export function PdfUploadArea({ pdfItem, unitId, onReload }: PdfUploadAreaProps) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadResponse = await fetchApi('/storage/upload', {
        method: 'POST',
        body: formData,
      });
      const storedObjectId = uploadResponse.data.storedObjectId as string;

      let lessonId = pdfItem?.id;
      let version = pdfItem?.version;
      if (!lessonId) {
        const createResponse = await fetchApi(
          `/admin/v1/courses/units/${unitId}/lessons`,
          {
            method: 'POST',
            body: JSON.stringify({ titleAr: 'ملف PDF', contentType: 'PDF' }),
          },
        );
        lessonId = createResponse.data.id as string;
        version = createResponse.data.version as number;
      }

      await fetchApi(`/admin/v1/courses/lesson/${lessonId}/content`, {
        method: 'PATCH',
        body: JSON.stringify({
          titleAr: pdfItem?.titleAr ?? 'ملف PDF',
          contentUrl: storedObjectId,
          contentType: 'PDF',
          status: 'PUBLISHED',
          version,
        }),
      });
      toast.success('تم رفع ملف PDF بنجاح');
      await onReload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشل رفع الملف');
    } finally {
      setUploading(false);
    }
  };

  const archivePdf = async () => {
    if (!pdfItem) return;
    await fetchApi(`/admin/v1/courses/lesson/${pdfItem.id}/content`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'ARCHIVED', version: pdfItem.version }),
    });
    toast.success('تمت أرشفة ملف PDF');
    await onReload();
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void handleUpload(file);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <FileText className="size-4 text-brand-600" />
        ملف PDF مرفق
      </div>

      {pdfItem?.contentUrl ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="size-4" />
            <span>تم الرفع</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`/api/storage/${pdfItem.contentUrl}`, '_blank')}
            >
              عرض الملف
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void archivePdf()}>
              أرشفة الملف
            </Button>
            <label className="inline-flex min-h-8 cursor-pointer items-center text-xs font-bold text-ink-3 underline">
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={onFileChange}
              />
              استبدال الملف
            </label>
          </div>
        </div>
      ) : uploading ? (
        <div className="space-y-2">
          <div className="text-sm text-ink-3">جاري الرفع...</div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-brand-500" />
          </div>
        </div>
      ) : (
        <label className="flex flex-1 cursor-pointer flex-col">
          <input
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={onFileChange}
          />
          <span className="flex min-h-32 flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-4 text-center hover:border-brand-400">
            <Upload className="size-6 text-ink-3" />
            <span className="text-sm text-ink-3">اضغط لرفع ملف PDF</span>
            <span className="text-xs text-ink-4">PDF حتى 500 MB</span>
          </span>
        </label>
      )}
    </div>
  );
}
