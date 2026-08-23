'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { VideoFocusOverlay } from './VideoFocusOverlay';

export type VideoPlayback = {
  provider: 'YOUTUBE' | 'R2' | 'LOCAL';
  url?: string;
  videoId?: string;
  expiresInSeconds?: number;
  defaultQuality?: string;
  sources?: Array<{ quality: string; url: string }>;
  processingStatus?: string;
};

export type ProviderVideoPlayerProps = {
  playback: VideoPlayback;
  className?: string;
  initialTime?: number;
  focusMode?: boolean;
  onExitFocus?: () => void;
  onEnded?: () => void;
  onProgress?: (progress: number, currentTime: number, duration: number) => void;
  /** Fired whenever the underlying player's play/pause state changes. */
  onPlayingChange?: () => void;
  /** External control handle. When provided, it replaces the internal one so
   *  a parent (e.g. ProtectedVideoPlayer) can drive play/pause. */
  controlRef?: React.MutableRefObject<VideoControlHandle | null>;
  /** Called once the underlying player is ready to accept commands. */
  onReady?: () => void;
  /** Called when the underlying player reports a playback error. */
  onError?: () => void;
  onPlaybackQualityChange?: (quality: string) => void;
};

export type VideoControlHandle = {
  play: () => void;
  pause: () => void;
  getPlaying: () => boolean;
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number) => void;
  getPlaybackRate: () => number;
  setPlaybackRate: (rate: number) => void;
  getAvailableQualityLevels?: () => string[];
  getPlaybackQuality?: () => string;
  setPlaybackQuality?: (quality: string) => void;
};

export function ProviderVideoPlayer({
  playback,
  className = '',
  initialTime = 0,
  focusMode = false,
  onExitFocus,
  onEnded,
  onProgress,
  onPlayingChange,
  controlRef: controlRefProp,
  onReady,
  onError,
  onPlaybackQualityChange,
}: ProviderVideoPlayerProps) {
  const internalRef = useRef<VideoControlHandle | null>(null);
  const controlRef = controlRefProp ?? internalRef;
  const [isPlaying, setIsPlaying] = useState(false);

  const syncPlaying = useCallback(() => {
    setIsPlaying(controlRef.current?.getPlaying() ?? false);
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

  const renderPlayer = () => {
    if (playback.provider === 'YOUTUBE' && playback.videoId) {
      return (
        <YouTubePlayer
          key={playback.videoId}
          videoId={playback.videoId}
          className={className}
          initialTime={initialTime}
          controlRef={controlRef}
          blockNativeControls={focusMode && playback.provider === 'YOUTUBE'}
          onReady={onReady}
          onError={onError}
          onPlayingChange={onPlayingChange}
          onEnded={onEnded}
          onProgress={onProgress}
          onPlaybackQualityChange={onPlaybackQualityChange}
        />
      );
    }

    if (playback.url) {
      return (
        <VideoPlayer
          src={playback.url}
          sources={playback.sources}
          defaultQuality={playback.defaultQuality}
          className={className}
          initialTime={initialTime}
          onEnded={onEnded}
          onProgress={onProgress}
        />
      );
    }

    return null;
  };

  const player = renderPlayer();
  if (!player) return null;

  if (!focusMode) return player;

  return (
    <VideoFocusOverlay
      focusMode={focusMode}
      onExitFocus={() => onExitFocus?.()}
      isPlaying={isPlaying}
      onTogglePlay={handleTogglePlay}
      showCustomControls={playback.provider === 'YOUTUBE'}
    >
      {player}
    </VideoFocusOverlay>
  );
}

type YouTubePlayerProps = {
  videoId: string;
  className: string;
  initialTime: number;
  controlRef: React.MutableRefObject<VideoControlHandle | null>;
  blockNativeControls?: boolean;
  onReady?: () => void;
  onError?: () => void;
  onPlayingChange?: () => void;
  onEnded?: () => void;
  onProgress?: (progress: number, currentTime: number, duration: number) => void;
  onPlaybackQualityChange?: (quality: string) => void;
};

type YouTubePlayerInstance = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  pauseVideo: () => void;
  playVideo: () => void;
  getPlayerState: () => number;
  getPlaybackRate: () => number;
  setPlaybackRate: (rate: number) => void;
  getAvailableQualityLevels: () => string[];
  getPlaybackQuality: () => string;
  setPlaybackQuality: (quality: string) => void;
};

type YouTubeNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      host: string;
      videoId: string;
      width: string;
      height: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: () => void;
        onStateChange: (event: { data: number }) => void;
        onPlaybackRateChange?: (event: { data: number }) => void;
        onError?: (event: { data: number }) => void;
      };
    },
  ) => YouTubePlayerInstance;
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YOUTUBE_PLAYER_STATE = {
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
};

let youtubeApiPromise: Promise<YouTubeNamespace> | null = null;

const YOUTUBE_ASPECT_RATIOS: Record<string, string> = {
  nNh_Jq7mPbM: '2.08 / 1',
};

function loadYouTubeApi() {
  if (window.YT) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<YouTubeNamespace>((resolve) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT) resolve(window.YT);
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return youtubeApiPromise;
}

function YouTubePlayer({
  videoId,
  className,
  initialTime,
  controlRef,
  blockNativeControls = false,
  onReady,
  onError,
  onPlayingChange,
  onEnded,
  onProgress,
  onPlaybackQualityChange,
}: YouTubePlayerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onEndedRef = useRef(onEnded);
  const onProgressRef = useRef(onProgress);
  const onPlayingChangeRef = useRef(onPlayingChange);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const onPlaybackQualityChangeRef = useRef(onPlaybackQualityChange);
  const [iframeOffsets, setIframeOffsets] = useState<{
    top: number;
    bottom: number;
  } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const aspectRatio = YOUTUBE_ASPECT_RATIOS[videoId] ?? '16 / 9';

  useEffect(() => {
    onEndedRef.current = onEnded;
    onProgressRef.current = onProgress;
    onPlayingChangeRef.current = onPlayingChange;
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
    onPlaybackQualityChangeRef.current = onPlaybackQualityChange;
  }, [onEnded, onProgress, onPlayingChange, onReady, onError, onPlaybackQualityChange]);

  useEffect(() => {
    let cancelled = false;

    const stopProgressTimer = () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };

    const reportProgress = () => {
      const player = playerRef.current;
      if (!player) return;
      const currentTime = player.getCurrentTime();
      const duration = player.getDuration();
      if (duration > 0) {
        onProgressRef.current?.(currentTime / duration, currentTime, duration);
      }
    };

    void loadYouTubeApi().then((YT) => {
      if (cancelled || !mountRef.current) return;
      playerRef.current = new YT.Player(mountRef.current, {
        host: 'https://www.youtube-nocookie.com',
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          controls: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          playsinline: 1,
          rel: 0,
        },
        events: ({
          onReady: () => {
            controlRef.current = {
              play: () => playerRef.current?.playVideo(),
              pause: () => playerRef.current?.pauseVideo(),
              getPlaying: () =>
                playerRef.current?.getPlayerState() === YOUTUBE_PLAYER_STATE.PLAYING,
              getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
              getDuration: () => playerRef.current?.getDuration() ?? 0,
              seekTo: (seconds: number) =>
                playerRef.current?.seekTo(seconds, true),
              getPlaybackRate: () => playerRef.current?.getPlaybackRate() ?? 1,
              setPlaybackRate: (rate: number) =>
                playerRef.current?.setPlaybackRate(rate),
              getAvailableQualityLevels: () => playerRef.current?.getAvailableQualityLevels() || [],
              getPlaybackQuality: () => playerRef.current?.getPlaybackQuality() || 'default',
              setPlaybackQuality: (quality: string) => playerRef.current?.setPlaybackQuality(quality),
            };
            const player = playerRef.current;
            const duration = player?.getDuration() ?? 0;
            if (player && initialTime > 1 && duration > 0 && initialTime < duration - 10) {
              player.seekTo(initialTime, true);
            }
            reportProgress();
            onPlayingChangeRef.current?.();
            onReadyRef.current?.();
          },
          onStateChange: ({ data }: { data: number }) => {
            onPlayingChangeRef.current?.();
            if (data === 1 && !progressTimerRef.current) {
              progressTimerRef.current = setInterval(reportProgress, 1000);
            } else if (data !== 1) {
              reportProgress();
              stopProgressTimer();
            }
            if (data === 0) onEndedRef.current?.();
          },
          onPlaybackRateChange: () => {
            onPlayingChangeRef.current?.();
          },
          onError: () => onErrorRef.current?.(),
          onPlaybackQualityChange: (event: { data: string }) => {
            onPlaybackQualityChangeRef.current?.(event.data);
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any),
      });
    });

    return () => {
      cancelled = true;
      stopProgressTimer();
      playerRef.current?.destroy();
      playerRef.current = null;
      controlRef.current = null;
    };
  }, [initialTime, videoId, controlRef]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const player = playerRef.current;
      if (!player) return;
      if (document.hidden) {
        player.pauseVideo();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    const getFullscreenElement = () => {
      const webkitDoc = document as Document & { webkitFullscreenElement?: Element };
      return document.fullscreenElement ?? webkitDoc.webkitFullscreenElement ?? null;
    };
    const handleFullscreenChange = () => {
      const container = containerRef.current;
      const element = getFullscreenElement();
      setIsFullscreen(
        !!container &&
          !!element &&
          (element === container ||
            container.contains(element) ||
            element.contains(container)),
      );
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const syncFrame = () => {
      const container = containerRef.current;
      const frame = container ? container.querySelector('iframe') : null;
      if (!container || !frame) return;
      frame.allowFullscreen = true;
      const r = container.getBoundingClientRect();
      frame.style.setProperty('position', 'absolute', 'important');
      frame.style.setProperty('left', '0px', 'important');
      frame.style.setProperty('top', '0px', 'important');
      frame.style.setProperty('width', `${r.width}px`, 'important');
      frame.style.setProperty('height', `${r.height}px`, 'important');
      const currentAllow = frame.getAttribute('allow') || '';
      if (!/\bfullscreen\b/.test(currentAllow)) {
        frame.setAttribute(
          'allow',
          `${currentAllow ? `${currentAllow}; ` : ''}fullscreen`,
        );
      }
    };
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(syncFrame);
    };
    const observer = new MutationObserver(run);
    const container = containerRef.current;
    if (container) {
      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'width', 'height'],
      });
    }
    const ro = new ResizeObserver(run);
    if (container) ro.observe(container);
    syncFrame();
    return () => {
      observer.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!blockNativeControls) {
      setIframeOffsets(null);
      return;
    }

    let iframe: HTMLIFrameElement | null = null;
    const measure = () => {
      const container = containerRef.current;
      if (!container || !iframe) return;
      const cRect = container.getBoundingClientRect();
      const fRect = iframe.getBoundingClientRect();
      setIframeOffsets({
        top: fRect.top - cRect.top,
        bottom: cRect.bottom - fRect.bottom,
      });
    };

    const ro = new ResizeObserver(measure);
    const mo = new MutationObserver(() => {
      const found = containerRef.current?.querySelector('iframe') ?? null;
      if (found !== iframe) {
        if (iframe) ro.unobserve(iframe);
        iframe = found;
        if (iframe) ro.observe(iframe);
        measure();
      }
    });

    const found = containerRef.current?.querySelector('iframe') ?? null;
    if (found) {
      iframe = found;
      ro.observe(iframe);
    }
    if (containerRef.current)
      mo.observe(containerRef.current, { childList: true, subtree: true });
    window.addEventListener('resize', measure);
    measure();

    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [blockNativeControls]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden bg-black ${
        isFullscreen ? 'h-full' : 'aspect-video rounded-[var(--radius-xl)]'
      } ${className}`}
      style={
        isFullscreen
          ? { width: '100%', height: '100%', aspectRatio: 'auto', borderRadius: 0 }
          : { aspectRatio }
      }
      onContextMenu={(event) => event.preventDefault()}
    >
      <div ref={mountRef} className="absolute inset-0" />
      {blockNativeControls && (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-x-0 z-10 h-14 touch-none sm:h-16"
            style={iframeOffsets ? { top: iframeOffsets.top } : undefined}
            onPointerDown={(event) => event.preventDefault()}
            onClick={(event) => event.preventDefault()}
            onContextMenu={(event) => event.preventDefault()}
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 z-10 h-16 touch-none sm:h-20"
            style={iframeOffsets ? { bottom: iframeOffsets.bottom } : undefined}
            onPointerDown={(event) => event.preventDefault()}
            onClick={(event) => event.preventDefault()}
            onContextMenu={(event) => event.preventDefault()}
          />
        </>
      )}
    </div>
  );
}