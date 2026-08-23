'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import {
  ProviderVideoPlayer,
  type VideoControlHandle,
  type VideoPlayback,
} from './ProviderVideoPlayer';
import {
  exitFullscreen,
  getFullscreenElement,
  useFullscreenController,
} from '../hooks/useFullscreenController';
import { VideoProtectionLayer } from './VideoProtectionLayer';
import { ProtectedVideoControls } from './ProtectedVideoControls';
import { cn } from '../utils';

export type ProtectedVideoPlayerProps = {
  playback: VideoPlayback | null;
  className?: string;
  initialTime?: number;
  focusMode?: boolean;
  onExitFocus?: () => void;
  onEnded?: () => void;
  onProgress?: (progress: number, currentTime: number, duration: number) => void;
  /** Attempt real browser fullscreen once the player is ready (default true). */
  autoFullscreen?: boolean;
};

/**
 * Protected video lesson player.
 *
 * Hierarchy (z-index):
 *   stage (video container) — fullscreen target
 *     player            z-1
 *     protection layer  z-10 (captures interaction)
 *     center play btn   z-20 (visible only while paused)
 *     custom controls   z-30 (above everything, always clickable)
 *
 * - Fullscreen targets the VIDEO CONTAINER via the real Fullscreen API.
 * - The iframe is never reloaded on fullscreen entry/exit; only the stage's
 *   class changes, so the playback position is preserved.
 * - A single fullscreenchange listener keeps state in sync with Escape /
 *   browser UI / OS exits as well as our own buttons.
 * - Automatic fullscreen is attempted once; if the browser rejects it (no user
 *   gesture) we show the custom fullscreen button instead and never retry.
 */
export function ProtectedVideoPlayer({
  playback,
  className = '',
  initialTime = 0,
  focusMode = false,
  onExitFocus,
  onEnded,
  onProgress,
  autoFullscreen = true,
}: ProtectedVideoPlayerProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<VideoControlHandle | null>(null);
  const autoFsAttemptedRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const playbackRateRef = useRef(1);
  const [currentQuality, setCurrentQuality] = useState<string>("default");
  const [qualityLevels, setQualityLevels] = useState<string[]>([]);

  const {
    isFullscreen,
    toggle: toggleFullscreen,
    enter: enterFullscreen,
  } = useFullscreenController(stageRef);

  const isYouTube = playback?.provider === 'YOUTUBE';

  const syncPlaying = useCallback(() => {
    const control = controlRef.current;
    setIsPlaying(control?.getPlaying() ?? false);
    const rate = control?.getPlaybackRate() ?? 1;
    // The iframe API can keep reporting 1 until the media actually loads, so
    // only adopt a confirmed rate when it differs from the default — otherwise
    // a play/pause sync would silently undo an explicit speed selection.
    if (rate !== 1 || playbackRateRef.current === 1) {
      playbackRateRef.current = rate;
      setPlaybackRateState(rate);
    }
    if (control) {
      const levels = control.getAvailableQualityLevels?.() || [];
      if (levels.length > 0) setQualityLevels(levels);
    }
  }, []);

  const handleTogglePlay = useCallback(() => {
    const control = controlRef.current;
    if (!control) return;
    if (control.getPlaying()) {
      control.pause();
    } else {
      control.play();
    }
    syncPlaying();
  }, [syncPlaying]);

  const handleSeek = useCallback((time: number) => {
    const control = controlRef.current;
    if (!control) return;
    const target = Math.max(0, Math.min(time, control.getDuration() || time));
    control.seekTo(target);
    setCurrentTime(target);
  }, []);

  const handlePlaybackRateChange = useCallback((rate: number) => {
    const control = controlRef.current;
    if (!control) return;
    control.setPlaybackRate(rate);
    playbackRateRef.current = rate;
    setPlaybackRateState(rate);
  }, []);

  const handleQualityChange = useCallback((quality: string) => {
    const control = controlRef.current;
    if (!control) return;
    control.setPlaybackQuality?.(quality);
    setCurrentQuality(quality);
  }, []);

  const handlePlaybackQualityChange = useCallback((quality: string) => {
    setCurrentQuality(quality);
  }, []);

  const handleProgress = useCallback(
    (progress: number, time: number, videoDuration: number) => {
      if (Number.isFinite(videoDuration) && videoDuration > 0) {
        setDuration(videoDuration);
      }
      if (Number.isFinite(time)) {
        setCurrentTime(time);
      }
      onProgress?.(progress, time, videoDuration);
    },
    [onProgress],
  );

  const handleReady = useCallback(() => {
    setIsVideoReady(true);
    const control = controlRef.current;
    if (control) {
      setQualityLevels(control.getAvailableQualityLevels?.() || []);
      setCurrentQuality(control.getPlaybackQuality?.() || "default");
    }
  }, []);

  const handlePlayerError = useCallback(() => {
    setPlayerError('تعذر تشغيل الفيديو. حاول مرة أخرى بعد قليل.');
  }, []);

  useEffect(() => {
    if (!isVideoReady || !focusMode || !autoFullscreen) return;
    if (autoFsAttemptedRef.current) return;
    autoFsAttemptedRef.current = true;
    // Real browser fullscreen, once. Rejection (no user gesture) is expected
    // and handled: we keep showing the custom fullscreen button.
    void enterFullscreen();
  }, [isVideoReady, focusMode, autoFullscreen, enterFullscreen]);

  const handleExitFocus = useCallback(() => {
    if (getFullscreenElement()) exitFullscreen();
    onExitFocus?.();
  }, [onExitFocus]);

  // Non-YouTube providers keep their own native player and controls; the
  // protection layer is a YouTube-focused concern and must not block them.
  if (playback && !isYouTube) {
    return (
      <ProviderVideoPlayer
        playback={playback}
        initialTime={initialTime}
        className={className}
        onEnded={onEnded}
        onProgress={onProgress}
      />
    );
  }

  if (!playback) return null;

  // A YOUTUBE playback without a video id is not playable — show a clean
  // error and never render an invisible protection layer on top of it.
  if (playback.provider === 'YOUTUBE' && !playback.videoId) {
    return (
      <div
        className={cn(
          'flex aspect-video w-full items-center justify-center bg-black text-white/70',
          className,
        )}
      >
        الفيديو غير متاح حالياً.
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative',
        focusMode && 'fixed inset-0 z-[90] flex overflow-hidden bg-black',
      )}
    >
      <div
        ref={stageRef}
        dir="ltr"
        className={cn(
          'relative overflow-hidden bg-black',
          isFullscreen
            ? 'h-full w-full'
            : 'aspect-video w-full',
          focusMode && !isFullscreen && 'mx-auto max-w-6xl',
          !focusMode && 'rounded-[var(--radius-xl)]',
          className,
        )}
      >
        {playerError ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 p-5 text-center text-white">
            <p className="max-w-md font-heading text-sm font-semibold sm:text-base">
              {playerError}
            </p>
          </div>
        ) : (
          <>
<div className="absolute inset-0 z-[1]">
                <ProviderVideoPlayer
                  playback={playback}
                  initialTime={initialTime}
                  controlRef={controlRef}
                  onReady={handleReady}
                  onPlayingChange={syncPlaying}
                  onEnded={onEnded}
                  onProgress={handleProgress}
                  onError={handlePlayerError}
                  onPlaybackQualityChange={handlePlaybackQualityChange}
                />
              </div>

            <VideoProtectionLayer />

            <ProtectedVideoControls
              isPlaying={isPlaying}
              isFullscreen={isFullscreen}
              isVideoReady={isVideoReady}
              currentTime={currentTime}
              duration={duration}
              playbackRate={playbackRate}
              onTogglePlay={handleTogglePlay}
              onToggleFullscreen={() => void toggleFullscreen()}
              onSeek={handleSeek}
              onPlaybackRateChange={handlePlaybackRateChange}
              onExitFocus={focusMode ? handleExitFocus : undefined}
              currentQuality={currentQuality}
              qualityLevels={qualityLevels}
              onQualityChange={handleQualityChange}
            />

            {!isPlaying && isVideoReady && (
              <button
                type="button"
                onClick={handleTogglePlay}
                aria-label="تشغيل الفيديو"
                className="pointer-events-auto absolute left-1/2 top-1/2 z-20 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white shadow-xl backdrop-blur-md transition hover:scale-105 hover:bg-brand-500/85 focus-visible:outline-2 focus-visible:outline-white active:scale-95 sm:size-20"
              >
                <Play className="size-8 fill-current sm:size-10" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}