'use client';

import { ChangeEvent, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Cloud, HardDrive, PlayCircle, Upload } from 'lucide-react';
import { fetchApi } from '../../../../../lib/api';
import type { ContentItem } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const MAX_VIDEO_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

type VideoProvider = 'YOUTUBE' | 'R2' | 'LOCAL';

type VideoUploadAreaProps = {
  videoItem: ContentItem | null;
  onReload: () => Promise<void>;
};

const PROVIDERS: Array<{
  value: VideoProvider;
  label: string;
  icon: typeof PlayCircle;
}> = [
  { value: 'YOUTUBE', label: 'YouTube', icon: PlayCircle },
  { value: 'R2', label: 'R2', icon: Cloud },
  { value: 'LOCAL', label: 'Local', icon: HardDrive },
];

export function VideoUploadArea({ videoItem, onReload }: VideoUploadAreaProps) {
  const currentVideo = videoItem?.videoLesson;
  const [provider, setProvider] = useState<VideoProvider>(currentVideo?.provider ?? 'R2');
  const [youtubeUrl, setYoutubeUrl] = useState(
    currentVideo?.provider === 'YOUTUBE' ? currentVideo.sourceRef : '',
  );
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadLocalVideo = (lessonId: string, file: File) =>
    new Promise<void>((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      const request = new XMLHttpRequest();
      request.open('POST', `${API_BASE}/admin/v1/video/${lessonId}/upload`);
      request.withCredentials = true;
      request.timeout = 0;
      request.upload.onprogress = (event) => updateProgress(event);
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) resolve();
        else reject(new Error(readUploadError(request)));
      };
      request.onerror = () => reject(new Error('تعذر الاتصال بالخادم أثناء رفع الفيديو'));
      request.onabort = () => reject(new Error('تم إلغاء رفع الفيديو'));
      request.send(formData);
    });

  const uploadR2Video = async (lessonId: string, file: File) => {
    const response = await fetchApi(`/admin/v1/video/${lessonId}/r2/upload-url`, {
      method: 'POST',
      timeoutMs: 60_000,
      body: JSON.stringify({
        originalFileName: file.name,
        mimeType: file.type || 'video/mp4',
        fileSizeBytes: file.size,
      }),
    });
    const { uploadUrl, objectKey } = response.data as {
      uploadUrl: string;
      objectKey: string;
    };

    await new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('PUT', uploadUrl);
      request.timeout = 0;
      request.setRequestHeader('Content-Type', file.type || 'video/mp4');
      request.upload.onprogress = (event) => updateProgress(event);
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) resolve();
        else reject(new Error('رفض R2 رفع الملف'));
      };
      request.onerror = () =>
        reject(new Error('تعذر الرفع إلى R2. تحقق من إعدادات CORS الخاصة بالـ bucket.'));
      request.onabort = () => reject(new Error('تم إلغاء رفع الفيديو'));
      request.send(file);
    });

    await fetchApi(`/admin/v1/video/${lessonId}/r2/complete`, {
      method: 'POST',
      timeoutMs: 60_000,
      body: JSON.stringify({
        objectKey,
        originalFileName: file.name,
        mimeType: file.type || 'video/mp4',
      }),
    });
  };

  const updateProgress = (event: ProgressEvent) => {
    if (event.lengthComputable) {
      setProgress(Math.round((event.loaded / event.total) * 100));
    }
  };

  const handleUpload = async (file: File) => {
    if (!videoItem) {
      toast.error('يجب إنشاء درس الفيديو أولا');
      return;
    }
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      toast.error('حجم الفيديو يجب ألا يتجاوز 2 GB');
      return;
    }
    if (provider === 'R2' && file.type !== 'video/mp4') {
      toast.error('فيديو R2 يجب أن يكون بصيغة MP4');
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      if (provider === 'R2') {
        await uploadR2Video(videoItem.id, file);
      } else {
        await uploadLocalVideo(videoItem.id, file);
      }
      toast.success(
        provider === 'R2'
          ? 'تم الرفع. جاري تجهيز نسختي 480p و720p في الخلفية.'
          : 'تم حفظ الفيديو بنجاح',
      );
      await onReload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشل رفع الفيديو');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const saveYouTube = async () => {
    if (!videoItem) {
      toast.error('يجب إنشاء درس الفيديو أولا');
      return;
    }
    if (!youtubeUrl.trim()) {
      toast.error('أدخل رابط YouTube أو معرّف الفيديو');
      return;
    }

    setUploading(true);
    try {
      await fetchApi(`/admin/v1/video/${videoItem.id}/youtube`, {
        method: 'POST',
        body: JSON.stringify({ youtubeUrl: youtubeUrl.trim() }),
      });
      toast.success('تم حفظ فيديو YouTube');
      await onReload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشل حفظ فيديو YouTube');
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void handleUpload(file);
  };

  const handlePreview = () => {
    if (!videoItem) return;
    window.open(`${API_BASE}/admin/v1/video/${videoItem.id}/preview`, '_blank');
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-default bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <PlayCircle className="size-4 text-brand-600" />
          الفيديو
        </div>
        {currentVideo && (
          <span
            className={`flex items-center gap-1 text-xs font-bold ${
              currentVideo.status === 'FAILED' ? 'text-danger' : 'text-success'
            }`}
          >
            <CheckCircle2 className="size-3.5" />
            {currentVideo.provider} · {currentVideo.status}
          </span>
        )}
      </div>

      {currentVideo?.provider === 'R2' &&
        ['QUEUED', 'PROCESSING'].includes(currentVideo.status) && (
          <div className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-800">
            جاري تجهيز الفيديو. سيعمل مؤقتًا بالملف الأصلي، ثم يصبح 480p افتراضيًا مع خيار 720p عند
            اكتمال المعالجة.
          </div>
        )}
      {currentVideo?.provider === 'R2' && currentVideo.status === 'FAILED' && (
        <div className="rounded-md border border-danger/25 bg-danger/5 px-3 py-2 text-xs font-bold text-danger">
          تعذرت معالجة الفيديو. أعد رفع الملف أو راجع سجل عامل الفيديو.
        </div>
      )}

      <div
        className="grid grid-cols-3 overflow-hidden rounded-md border border-border-default"
        aria-label="مزود الفيديو"
      >
        {PROVIDERS.map((option) => {
          const Icon = option.icon;
          const selected = provider === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setProvider(option.value)}
              className={`flex h-9 items-center justify-center gap-1.5 border-e border-border-default px-2 text-xs font-bold transition last:border-e-0 ${
                selected
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface text-text-muted hover:bg-surface-soft'
              }`}
              aria-pressed={selected}
            >
              <Icon className="size-3.5" />
              {option.label}
            </button>
          );
        })}
      </div>

      {provider === 'YOUTUBE' ? (
        <div className="space-y-2">
          <input
            value={youtubeUrl}
            onChange={(event) => setYoutubeUrl(event.target.value)}
            placeholder="https://youtu.be/..."
            className="h-10 w-full rounded-md border border-border-default bg-surface px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
            dir="ltr"
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => void saveYouTube()}
            className="h-9 w-full rounded-md bg-brand-600 px-3 text-xs font-bold text-white transition hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
          >
            حفظ فيديو YouTube
          </button>
        </div>
      ) : uploading ? (
        <div className="space-y-2">
          <div className="text-sm text-text-muted">جاري الرفع... {progress}%</div>
          <div className="h-1.5 overflow-hidden rounded-full bg-border-default">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${Math.max(progress, 4)}%` }}
            />
          </div>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col">
          <input
            type="file"
            accept="video/*,video/mp4"
            className="hidden"
            onChange={onFileChange}
          />
          <span className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border-default p-4 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40">
            <Upload className="size-6 text-text-muted" />
            <span className="text-sm text-text-muted">
              {provider === 'R2' ? 'رفع مباشر وآمن إلى R2' : 'رفع إلى خادم التطوير المحلي'}
            </span>
            <span className="text-xs text-text-muted/70">MP4 - حتى 2 GB</span>
          </span>
        </label>
      )}

      {currentVideo && (
        <button
          type="button"
          onClick={handlePreview}
          className="self-start text-xs font-bold text-interactive underline hover:text-interactive/80"
        >
          معاينة الفيديو الحالي
        </button>
      )}
    </div>
  );
}

function readUploadError(request: XMLHttpRequest) {
  try {
    const error = JSON.parse(request.responseText) as { message?: string };
    return error.message || 'فشل رفع الفيديو';
  } catch {
    return 'فشل رفع الفيديو';
  }
}
