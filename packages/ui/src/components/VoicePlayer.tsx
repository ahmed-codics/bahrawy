'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { cn } from '../utils';

let activeAudio: { el: HTMLAudioElement; onStopped: () => void } | null = null;

function startExclusive(el: HTMLAudioElement, onStopped: () => void) {
  if (activeAudio && activeAudio.el !== el) {
    activeAudio.el.pause();
    activeAudio.onStopped();
  }
  activeAudio = { el, onStopped };
  void el.play().catch(() => undefined);
}

function stopExclusive(el: HTMLAudioElement) {
  if (activeAudio && activeAudio.el === el) {
    activeAudio.el.pause();
    activeAudio.onStopped();
    activeAudio = null;
  }
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Play button + progress bar for a voice attachment. Only one recording can
 * play at a time across the whole app (a module-level bus pauses any other
 * active player). Shows the server-provided duration when available and falls
 * back to the actual media duration otherwise.
 */
export function VoicePlayer({
  src,
  durationSeconds,
  className,
}: {
  src: string;
  durationSeconds?: number | null;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    setCurrent(0);
  }, [src]);

  useEffect(() => {
    return () => {
      if (audioRef.current) stopExclusive(audioRef.current);
    };
  }, []);

  const displayDuration =
    durationSeconds && durationSeconds > 0 ? durationSeconds : duration;

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      stopExclusive(el);
      return;
    }
    setPlaying(true);
    startExclusive(el, () => {
      setPlaying(false);
      setCurrent(0);
    });
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? null)}
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
        onEnded={() => {
          stopExclusive(audioRef.current as HTMLAudioElement);
          setPlaying(false);
          setCurrent(0);
        }}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'إيقاف التسجيل' : 'تشغيل التسجيل'}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition hover:bg-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-brand-400 dark:text-brand-950 dark:hover:bg-brand-300"
      >
        {playing ? (
          <Pause className="size-4 fill-current" aria-hidden="true" />
        ) : (
          <Play className="size-4 translate-x-[1px] fill-current" aria-hidden="true" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-brand-500 transition-[width] duration-200 dark:bg-brand-400"
            style={{
              width: displayDuration
                ? `${Math.min(100, (current / displayDuration) * 100)}%`
                : '0%',
            }}
          />
        </div>
        <p className="ba-number mt-1 text-[11px] font-semibold text-text-muted">
          {formatTime(current)} / {displayDuration ? formatTime(displayDuration) : '--:--'}
        </p>
      </div>
    </div>
  );
}