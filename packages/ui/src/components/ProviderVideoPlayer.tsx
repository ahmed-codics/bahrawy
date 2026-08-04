'use client';

import { useEffect, useRef } from 'react';
import { VideoPlayer } from './VideoPlayer';

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
  onEnded?: () => void;
  onProgress?: (progress: number, currentTime: number, duration: number) => void;
};

export function ProviderVideoPlayer({
  playback,
  className = '',
  initialTime = 0,
  onEnded,
  onProgress,
}: ProviderVideoPlayerProps) {
  if (playback.provider === 'YOUTUBE' && playback.videoId) {
    return (
      <YouTubePlayer
        key={playback.videoId}
        videoId={playback.videoId}
        className={className}
        initialTime={initialTime}
        onEnded={onEnded}
        onProgress={onProgress}
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
}

type YouTubePlayerProps = {
  videoId: string;
  className: string;
  initialTime: number;
  onEnded?: () => void;
  onProgress?: (progress: number, currentTime: number, duration: number) => void;
};

type YouTubePlayerInstance = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
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
  onEnded,
  onProgress,
}: YouTubePlayerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onEndedRef = useRef(onEnded);
  const onProgressRef = useRef(onProgress);
  const aspectRatio = YOUTUBE_ASPECT_RATIOS[videoId] ?? '16 / 9';

  useEffect(() => {
    onEndedRef.current = onEnded;
    onProgressRef.current = onProgress;
  }, [onEnded, onProgress]);

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
        events: {
          onReady: () => {
            const player = playerRef.current;
            const duration = player?.getDuration() ?? 0;
            if (player && initialTime > 1 && duration > 0 && initialTime < duration - 10) {
              player.seekTo(initialTime, true);
              return;
            }
            reportProgress();
          },
          onStateChange: ({ data }) => {
            if (data === 1 && !progressTimerRef.current) {
              progressTimerRef.current = setInterval(reportProgress, 5000);
            } else if (data !== 1) {
              reportProgress();
              stopProgressTimer();
            }
            if (data === 0) onEndedRef.current?.();
          },
        },
      });
    });

    return () => {
      cancelled = true;
      stopProgressTimer();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [initialTime, videoId]);

  return (
    <div
      className={`aspect-video w-full overflow-hidden rounded-[var(--radius-xl)] bg-black ${className}`}
      style={{ aspectRatio }}
    >
      <div ref={mountRef} className="h-full w-full" />
    </div>
  );
}
