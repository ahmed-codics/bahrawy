'use client';

import { useCallback, useRef, useState } from 'react';
import { cn } from '../utils';

type VideoProgressBarProps = {
  currentTime: number;
  duration: number;
  isVideoReady: boolean;
  onSeek: (time: number) => void;
  className?: string;
};

const SEEK_STEP_SECONDS = 5;

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const total = Math.floor(safe);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(secs)}`
    : `${pad(minutes)}:${pad(secs)}`;
}

/**
 * Seekable progress bar for the protected video stage. Rendered above the
 * protection layer and driven entirely through the YouTube Player API via the
 * control handle: pointer drag + click + keyboard all call onSeek, which the
 * parent routes to player.seekTo(). touch-action:none keeps dragging usable on
 * mobile, and pointer capture keeps the drag working outside the track.
 */
export function VideoProgressBar({
  currentTime,
  duration,
  isVideoReady,
  onSeek,
  className,
}: VideoProgressBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState<number | null>(null);

  const safeDuration = duration > 0 ? duration : 0;
  const displayed = dragging && dragValue !== null ? dragValue : currentTime;
  const percent =
    safeDuration > 0 ? Math.min(100, Math.max(0, (displayed / safeDuration) * 100)) : 0;

  const positionFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || safeDuration <= 0) return 0;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * safeDuration;
    },
    [safeDuration],
  );

  const commitSeek = useCallback(
    (time: number) => {
      if (!isVideoReady) return;
      setDragging(false);
      setDragValue(null);
      onSeek(time);
    },
    [isVideoReady, onSeek],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isVideoReady) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
    setDragValue(positionFromClientX(event.clientX));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragValue(positionFromClientX(event.clientX));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    commitSeek(positionFromClientX(event.clientX));
  };

  const handlePointerCancel = () => {
    setDragging(false);
    setDragValue(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isVideoReady) return;
    let target: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
        target = Math.min(safeDuration, displayed + SEEK_STEP_SECONDS);
        break;
      case 'ArrowLeft':
        target = Math.max(0, displayed - SEEK_STEP_SECONDS);
        break;
      case 'Home':
        target = 0;
        break;
      case 'End':
        target = safeDuration;
        break;
      default:
        return;
    }
    event.preventDefault();
    onSeek(target);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="shrink-0 text-[11px] font-medium tabular-nums text-white/80">
        {formatTime(displayed)}
      </span>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={isVideoReady ? 0 : -1}
        aria-label="شريط تقدم الفيديو"
        aria-valuemin={0}
        aria-valuemax={Math.round(safeDuration)}
        aria-valuenow={Math.round(displayed)}
        aria-valuetext={`${formatTime(displayed)} من ${formatTime(safeDuration)}`}
        aria-disabled={!isVideoReady}
        data-progress-bar="true"
        className={cn(
          'group relative h-8 flex-1 touch-none cursor-pointer select-none',
          !isVideoReady && 'cursor-default opacity-60',
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
      >
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/20 transition-[height] group-hover:h-2.5 group-focus-visible:h-2.5" />
        <div
          className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand-500 transition-[height] group-hover:h-2.5 group-focus-visible:h-2.5"
          style={{ width: `${percent}%` }}
        />
        <div
          aria-hidden="true"
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand-500 opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          style={{ left: `${percent}%` }}
        />
      </div>
      <span className="shrink-0 text-[11px] font-medium tabular-nums text-white/80">
        {formatTime(safeDuration)}
      </span>
    </div>
  );
}