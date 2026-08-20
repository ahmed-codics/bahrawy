'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle, Mic, Square, TriangleAlert } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../utils';

const SUPPORTED_MIME_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
] as const;

const EXTENSION_BY_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
};

const PERMISSION_DENIED_MESSAGE = 'لم يتم السماح باستخدام الميكروفون';
const NO_MICROPHONE_MESSAGE =
  'لم يتم العثور على ميكروفون. تأكد من توصيل ميكروفون وحاول مرة أخرى.';
const MICROPHONE_BUSY_MESSAGE =
  'تعذر الوصول إلى الميكروفون. قد يكون مستخدماً في تطبيق آخر.';
const UNSUPPORTED_MESSAGE =
  'متصفحك لا يدعم تسجيل الصوت. يمكنك إرفاق ملف صوتي جاهز بدلاً من ذلك.';
const INSECURE_CONTEXT_MESSAGE =
  'تسجيل الصوت غير متاح في هذا الاتصال. تأكد من فتح الموقع عبر https:// ثم أعد المحاولة.';
const MICROPHONE_BLOCKED_MESSAGE =
  'الميكروفون محظور في إعدادات المتصفح لهذا الموقع. افتح إعدادات الموقع واسمح بالوصول إلى الميكروفون ثم اضغط على زر التسجيل.';
const START_FAILED_MESSAGE = 'تعذر تشغيل الميكروفون. حاول مرة أخرى.';
const PERMISSION_PENDING_MESSAGE =
  'لم يتم تأكيد إذن استخدام الميكروفون. اضغط على زر التسجيل للمحاولة مرة أخرى.';
const AUTO_STOP_MESSAGE = 'تم الوصول إلى الحد الأقصى لمدة التسجيل.';
const EMPTY_RECORDING_MESSAGE = 'التسجيل فارغ، حاول مرة أخرى.';

// Safety net: if the browser keeps the permission prompt open without ever
// resolving (e.g. the user dismissed it), give up instead of staying stuck.
const PERMISSION_REQUEST_TIMEOUT_MS = 30000;

type RecorderPhase =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'stopped'
  | 'error';

function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const mime of SUPPORTED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

async function microphonePermissionBlocked(): Promise<boolean> {
  try {
    if (
      typeof navigator === 'undefined' ||
      typeof navigator.permissions?.query !== 'function'
    ) {
      return false;
    }
    const status = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });
    return status.state === 'denied';
  } catch {
    return false;
  }
}

async function permissionErrorMessage(error: unknown): Promise<string> {
  const name =
    error instanceof DOMException ? error.name : (error as Error | null)?.name;
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError': {
      // A persistent browser block (state === 'denied') means the browser will
      // never show the prompt again until the user unblocks the origin, so we
      // give explicit guidance instead of a generic denial message.
      const blocked = await microphonePermissionBlocked();
      return blocked ? MICROPHONE_BLOCKED_MESSAGE : PERMISSION_DENIED_MESSAGE;
    }
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return NO_MICROPHONE_MESSAGE;
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return MICROPHONE_BUSY_MESSAGE;
    case 'NotSupportedError':
      return UNSUPPORTED_MESSAGE;
    default:
      return START_FAILED_MESSAGE;
  }
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Local microphone recorder that produces a voice attachment Blob. Uses
 * MediaRecorder with a browser-native container (webm/ogg/mp4), enforces a
 * hard max duration with an automatic stop, and hands the resulting File and
 * its duration back to the parent for upload. Server-side validation still
 * applies on upload.
 *
 * The microphone is only ever requested from the start() call triggered by the
 * user's click on the record button (never from an effect or on mount), and
 * the same click both requests permission and starts recording once granted.
 */
export function VoiceRecorder({
  onRecording,
  maxDurationSeconds = 180,
  disabled,
  error,
  className,
}: {
  onRecording: (file: File, durationSeconds: number) => void;
  maxDurationSeconds?: number;
  disabled?: boolean;
  error?: string;
  className?: string;
}) {
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestTokenRef = useRef(0);
  const inFlightRef = useRef(false);

  const cleanup = useCallback(() => {
    inFlightRef.current = false;
    requestTokenRef.current += 1;
    if (requestTimeoutRef.current) {
      clearTimeout(requestTimeoutRef.current);
      requestTimeoutRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, []);

  useEffect(() => {
    if (phase === 'recording' && elapsed >= maxDurationSeconds) {
      setLocalError(AUTO_STOP_MESSAGE);
      stop();
    }
  }, [elapsed, maxDurationSeconds, phase, stop]);

  useEffect(() => cleanup, [cleanup]);

  const start = async () => {
    // Double-click protection: never start a second permission request or a
    // second MediaRecorder while one is already pending or running. A ref is
    // used so back-to-back clicks in the same tick are still caught.
    if (phase === 'requesting' || phase === 'recording' || inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;

    const token = ++requestTokenRef.current;
    setLocalError(null);
    setPhase('requesting');

    // Microphone access requires a secure context (HTTPS or localhost). If the
    // page is not secure, navigator.mediaDevices is usually unavailable too, so
    // give a clear message before even trying.
    if (
      typeof window === 'undefined' ||
      window.isSecureContext === false
    ) {
      inFlightRef.current = false;
      setPhase('error');
      setLocalError(INSECURE_CONTEXT_MESSAGE);
      console.warn('[VoiceRecorder] insecure context: microphone unavailable');
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      typeof navigator.mediaDevices === 'undefined' ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      inFlightRef.current = false;
      setPhase('error');
      setLocalError(UNSUPPORTED_MESSAGE);
      console.warn('[VoiceRecorder] mediaDevices.getUserMedia unavailable');
      return;
    }

    // The browser will only show its permission prompt if getUserMedia is
    // invoked from this click's user gesture, so it is the first async call.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (token !== requestTokenRef.current) return;
      cleanup();
      setPhase('error');
      setLocalError(await permissionErrorMessage(err));
      console.warn('[VoiceRecorder] getUserMedia failed:', err);
      return;
    }

    if (token !== requestTokenRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    if (requestTimeoutRef.current) {
      clearTimeout(requestTimeoutRef.current);
      requestTimeoutRef.current = null;
    }

    const mimeType = pickMimeType();
    if (!mimeType) {
      stream.getTracks().forEach((track) => track.stop());
      inFlightRef.current = false;
      setPhase('error');
      setLocalError(UNSUPPORTED_MESSAGE);
      console.warn('[VoiceRecorder] MediaRecorder unsupported');
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch {
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        stream.getTracks().forEach((track) => track.stop());
        inFlightRef.current = false;
        setPhase('error');
        setLocalError(UNSUPPORTED_MESSAGE);
        console.warn('[VoiceRecorder] MediaRecorder construction failed');
        return;
      }
    }

    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];
    startedAtRef.current = Date.now();

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - startedAtRef.current) / 1000),
      );
      const type = recorder.mimeType || mimeType || 'audio/webm';
      const extension = EXTENSION_BY_MIME[type.split(';')[0]] || 'webm';
      const blob = new Blob(chunksRef.current, { type });
      const file = new File([blob], `rec-${Date.now()}.${extension}`, { type });
      cleanup();
      setPhase('stopped');
      setElapsed(0);
      if (file.size > 0) {
        onRecording(file, durationSeconds);
      } else {
        setLocalError(EMPTY_RECORDING_MESSAGE);
      }
    };

    try {
      recorder.start();
    } catch {
      cleanup();
      setPhase('error');
      setLocalError(START_FAILED_MESSAGE);
      return;
    }

    setPhase('recording');
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000));
    }, 250);
  };

  useEffect(() => {
    if (phase !== 'requesting') return;
    requestTimeoutRef.current = setTimeout(() => {
      cleanup();
      setPhase('error');
      setLocalError(PERMISSION_PENDING_MESSAGE);
    }, PERMISSION_REQUEST_TIMEOUT_MS);
    return () => {
      if (requestTimeoutRef.current) {
        clearTimeout(requestTimeoutRef.current);
        requestTimeoutRef.current = null;
      }
    };
  }, [phase, cleanup]);

  const errorMessage = localError || error;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        {phase === 'recording' ? (
          <>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={stop}
              leadingIcon={<Square className="size-4 fill-current" />}
            >
              إيقاف
            </Button>
            <span
              className="ba-number inline-flex items-center gap-1.5 text-xs font-bold text-danger"
              role="timer"
            >
              <span
                className="size-2 rounded-full bg-danger"
                aria-hidden="true"
              />
              جاري التسجيل {formatTime(elapsed)}
            </span>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || phase === 'requesting'}
            onClick={() => void start()}
            leadingIcon={
              phase === 'requesting' ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Mic className="size-4" />
              )
            }
          >
            {phase === 'requesting' ? 'جاري تشغيل الميكروفون…' : 'تسجيل فويس'}
          </Button>
        )}
      </div>
      {errorMessage && (
        <p role="alert" className="flex items-center gap-1.5 text-xs font-bold text-danger">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          {errorMessage}
        </p>
      )}
    </div>
  );
}