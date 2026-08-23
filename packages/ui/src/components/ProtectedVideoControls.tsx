'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize, Minimize, Pause, Play, Settings2, Undo2 } from 'lucide-react';
import { cn } from '../utils';
import { VideoProgressBar } from './VideoProgressBar';

type ProtectedVideoControlsProps = {
  isPlaying: boolean;
  isFullscreen: boolean;
  isVideoReady: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  onTogglePlay: () => void;
  onToggleFullscreen: () => void;
  onSeek: (time: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  currentQuality?: string;
  qualityLevels?: string[];
  onQualityChange?: (quality: string) => void;
  onExitFocus?: () => void;
  className?: string;
};

export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

function formatRate(rate: number) {
  return `${rate}x`;
}

function ControlButton({
  onClick,
  label,
  children,
  className,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white shadow-lg backdrop-blur-md transition hover:scale-105 hover:bg-brand-500/85 focus-visible:outline-2 focus-visible:outline-white active:scale-95 sm:size-12',
        className,
      )}
    >
      {children}
    </button>
  );
}

function PlaybackSpeedButton({
  playbackRate,
  isVideoReady,
  onPlaybackRateChange,
}: {
  playbackRate: number;
  isVideoReady: boolean;
  onPlaybackRateChange: (rate: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      // Pressing a menu item fires pointerdown before its click, so closing on
      // any pointerdown would unmount the item before it can be selected.
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const keyClose = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', keyClose);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', keyClose);
    };
  }, [open]);

  const selectRate = (rate: number) => {
    onPlaybackRateChange(rate);
    setOpen(false);
  };

  return (
    <div className="relative">
      <ControlButton
        onClick={() => {
          if (isVideoReady) setOpen((value) => !value);
        }}
        label="سرعة التشغيل"
      >
        <span className="text-xs font-bold sm:text-sm">{formatRate(playbackRate)}</span>
      </ControlButton>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="خيارات سرعة التشغيل"
          data-playback-speed-menu="true"
          className="pointer-events-auto absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 rounded-xl border border-white/15 bg-black/90 p-1 shadow-2xl backdrop-blur-md"
        >
          {PLAYBACK_SPEEDS.map((rate) => {
            const selected = rate === playbackRate;
            return (
              <button
                key={rate}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => selectRate(rate)}
                className={cn(
                  'block w-16 whitespace-nowrap rounded-lg px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-brand-500/85 focus-visible:outline-2 focus-visible:outline-white',
                  selected && 'bg-brand-500 text-white',
                )}
              >
                {formatRate(rate)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Custom control bar for the protected video stage. Rendered ABOVE the
 * protection layer and the center play button (z-30) so it always receives
 * pointer/touch interaction, including the speed dropdown that extends over
 * the video area.
 * Contains Play/Pause, a seekable progress bar, playback speed, fullscreen and
 * exit-focus. All controls talk to the YouTube player through the control
 * handle; the protection layer keeps blocking the iframe itself.
 * Accessible: labelled buttons, keyboard-focusable slider, visible focus state.
 */

const QUALITY_LABELS: Record<string, string> = {
  highres: "Highest available",
  hd2160: "2160p",
  hd1440: "1440p",
  hd1080: "1080p",
  hd720: "720p",
  large: "480p",
  medium: "360p",
  small: "240p",
  tiny: "144p",
  auto: "Auto",
  default: "Auto",
};

function VideoQualityButton({
  currentQuality,
  qualityLevels,
  isVideoReady,
  onQualityChange,
}: {
  currentQuality: string;
  qualityLevels: string[];
  isVideoReady: boolean;
  onQualityChange: (quality: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const keyClose = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", keyClose);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", keyClose);
    };
  }, [open]);

  const selectQuality = (quality: string) => {
    onQualityChange(quality);
    setOpen(false);
  };

  const levels = Array.from(new Set(["default", ...qualityLevels])).filter((q) => q !== "auto");

  if (levels.length <= 1) return null;

  return (
    <div className="relative">
      <ControlButton
        onClick={() => {
          if (isVideoReady) setOpen((value) => !value);
        }}
        label="جودة الفيديو"
      >
        <Settings2 className="size-5 sm:size-6" />
      </ControlButton>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="خيارات جودة الفيديو"
          className="pointer-events-auto absolute bottom-full left-1/2 z-30 mb-2 max-h-60 -translate-x-1/2 overflow-y-auto rounded-xl border border-white/15 bg-black/90 p-1 shadow-2xl backdrop-blur-md"
        >
          {levels.map((level) => {
            const selected = level === currentQuality || (level === "default" && currentQuality === "auto");
            return (
              <button
                key={level}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => selectQuality(level)}
                className={cn(
                  "block w-32 whitespace-nowrap rounded-lg px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-brand-500/85 focus-visible:outline-2 focus-visible:outline-white",
                  selected && "bg-brand-500 text-white",
                )}
              >
                {selected ? "✓ " : ""}{QUALITY_LABELS[level] || level}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ProtectedVideoControls({
  isPlaying,
  isFullscreen,
  isVideoReady,
  currentTime,
  duration,
  playbackRate,
  onTogglePlay,
  onToggleFullscreen,
  onSeek,
  onPlaybackRateChange,
  onExitFocus,
  className,
  currentQuality = "default",
  qualityLevels = [],
  onQualityChange,
}: ProtectedVideoControlsProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-3 pb-3 pt-10 sm:pb-4 sm:pt-14',
        className,
      )}
    >
      <div className="pointer-events-auto pb-2">
        <VideoProgressBar
          currentTime={currentTime}
          duration={duration}
          isVideoReady={isVideoReady}
          onSeek={onSeek}
        />
      </div>
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        <ControlButton
          onClick={() => onTogglePlay()}
          label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
        >
          {isPlaying ? (
            <Pause className="size-5 fill-current sm:size-6" />
          ) : (
            <Play className="size-5 fill-current sm:size-6" />
          )}
        </ControlButton>

        <PlaybackSpeedButton
          playbackRate={playbackRate}
          isVideoReady={isVideoReady}
          onPlaybackRateChange={onPlaybackRateChange}
        />

        {onQualityChange && qualityLevels.length > 0 && (
          <VideoQualityButton
            currentQuality={currentQuality}
            qualityLevels={qualityLevels}
            isVideoReady={isVideoReady}
            onQualityChange={onQualityChange}
          />
        )}

        <ControlButton
          onClick={() => onToggleFullscreen()}
          label={isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}
        >
          {isFullscreen ? (
            <Minimize className="size-5 sm:size-6" />
          ) : (
            <Maximize className="size-5 sm:size-6" />
          )}
        </ControlButton>

        {onExitFocus && (
          <ControlButton
            onClick={() => onExitFocus()}
            label={
              isFullscreen
                ? 'الخروج من ملء الشاشة والعودة لصفحة الدرس'
                : 'العودة لصفحة الدرس'
            }
          >
            <Undo2 className="size-5 sm:size-6" />
          </ControlButton>
        )}

        {!isVideoReady && (
          <span className="sr-only" role="status">
            جاري تحميل الفيديو
          </span>
        )}
      </div>
    </div>
  );
}