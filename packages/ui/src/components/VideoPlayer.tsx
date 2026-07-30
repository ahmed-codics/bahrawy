'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Gauge,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { MobileSheet } from './MobileSheet';
import { useDataSaver } from './DataSaverProvider';

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  initialTime?: number;
  onEnded?: () => void;
  onTimeUpdate?: (time: number) => void;
  onProgress?: (progress: number, currentTime: number, duration: number) => void;
}

type QualityOption = {
  label: string;
  levelIndex: number;
  available: boolean;
};

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];
const DEFAULT_QUALITY_LABEL = 'تلقائي';
const QUALITY_LADDER = ['1080p', '720p', '480p', '360p', '240p', '144p'];
const DEFAULT_QUALITY_OPTIONS = QUALITY_LADDER.map((label) => ({
  label,
  levelIndex: -2,
  available: false,
}));

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function chooseDefaultQualityLevel(levels: Hls['levels']) {
  if (levels.length === 0) return -1;

  const exact480 = levels.findIndex((level) => level.height === 480);
  if (exact480 >= 0) return exact480;

  const lowerOrEqual = levels
    .map((level, index) => ({ height: level.height || 0, index }))
    .filter((level) => level.height > 0 && level.height <= 480)
    .sort((a, b) => b.height - a.height)[0];
  if (lowerOrEqual) return lowerOrEqual.index;

  return levels
    .map((level, index) => ({ distance: Math.abs((level.height || 480) - 480), index }))
    .sort((a, b) => a.distance - b.distance)[0]?.index ?? -1;
}

export function VideoPlayer({
  src,
  poster,
  className = '',
  initialTime = 0,
  onEnded,
  onTimeUpdate,
  onProgress,
}: VideoPlayerProps) {
  const { enabled: dataSaver } = useDataSaver();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const appliedInitialTimeRef = useRef(false);
  const bufferingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rateChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutedForBufferingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isChangingRate, setIsChangingRate] = useState(false);
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>(DEFAULT_QUALITY_OPTIONS);
  const [selectedQuality, setSelectedQuality] = useState(DEFAULT_QUALITY_LABEL);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const progressPercent = useMemo(() => {
    if (!duration) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  const syncPlayState = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setIsPlaying(!video.paused && !video.ended);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls: Hls | null = null;
    setError(null);
    setIsBuffering(true);
    appliedInitialTimeRef.current = false;
    setSelectedQuality(DEFAULT_QUALITY_LABEL);
    setQualityOptions(DEFAULT_QUALITY_OPTIONS);

    const handleNativeError = () => {
      setError('حدث خطأ أثناء تحميل الفيديو.');
      setIsBuffering(false);
    };

    const isHlsSource = /\.m3u8(?:$|\?)/i.test(src);
    if (!isHlsSource) {
      video.src = src;
      video.addEventListener('error', handleNativeError);
    } else if (Hls.isSupported()) {
      const hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 90,
        backBufferLength: 30,
      });
      hls = hlsInstance;
      hlsRef.current = hls;
      hlsInstance.loadSource(src);
      hlsInstance.attachMedia(video);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        const defaultLevel = dataSaver ? chooseDefaultQualityLevel(hlsInstance.levels) : -1;
        if (dataSaver && defaultLevel >= 0) {
          hlsInstance.currentLevel = defaultLevel;
          setSelectedQuality(`${hlsInstance.levels[defaultLevel]?.height || 480}p`);
        } else {
          hlsInstance.currentLevel = -1;
          setSelectedQuality(DEFAULT_QUALITY_LABEL);
        }

        const availableOptions = hlsInstance.levels.map((level, index) => ({
          label: `${level.height || 480}p`,
          levelIndex: index,
          available: true,
        }));
        const options = QUALITY_LADDER.map((label) => {
          const match = availableOptions.find((option) => option.label === label);
          return match ?? { label, levelIndex: -2, available: false };
        });

        setQualityOptions(options);
      });

      hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            setError('خطأ في الاتصال بالشبكة. جاري محاولة إعادة الاتصال...');
            hls?.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            setError('خطأ في تشغيل الفيديو. جاري محاولة الإصلاح...');
            hls?.recoverMediaError();
            break;
          default:
            setError('حدث خطأ غير معروف أثناء تحميل الفيديو.');
            hls?.destroy();
            break;
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('error', handleNativeError);
    } else {
      setError('متصفحك لا يدعم تشغيل هذا النوع من الفيديوهات.');
      setIsBuffering(false);
    }

    return () => {
      video.removeEventListener('error', handleNativeError);
      if (bufferingTimerRef.current) {
        clearTimeout(bufferingTimerRef.current);
      }
      if (rateChangeTimerRef.current) {
        clearTimeout(rateChangeTimerRef.current);
      }
      if (hls) {
        hls.destroy();
      }
      hlsRef.current = null;
    };
  }, [dataSaver, src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      const videoDuration = video.duration || 0;
      setDuration(videoDuration);
      if (
        !appliedInitialTimeRef.current &&
        initialTime > 1 &&
        videoDuration > 0 &&
        initialTime < videoDuration - 10
      ) {
        video.currentTime = initialTime;
        setCurrentTime(initialTime);
      }
      appliedInitialTimeRef.current = true;
      setIsBuffering(false);
    };
    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
      if (video.duration) {
        onProgress?.(time / video.duration, time, video.duration);
      }
    };
    const handleWaiting = () => {
      if (bufferingTimerRef.current) return;
      bufferingTimerRef.current = setTimeout(() => {
        if (!video.paused && !video.muted) {
          video.muted = true;
          mutedForBufferingRef.current = true;
        }
        setIsBuffering(true);
        bufferingTimerRef.current = null;
      }, 350);
    };
    const handleCanPlay = () => {
      if (bufferingTimerRef.current) {
        clearTimeout(bufferingTimerRef.current);
        bufferingTimerRef.current = null;
      }
      if (mutedForBufferingRef.current) {
        video.muted = false;
        mutedForBufferingRef.current = false;
      }
      setIsBuffering(false);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', syncPlayState);
    video.addEventListener('pause', syncPlayState);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('volumechange', handleVolumeChange);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', syncPlayState);
      video.removeEventListener('pause', syncPlayState);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('volumechange', handleVolumeChange);
      mutedForBufferingRef.current = false;
    };
  }, [initialTime, onEnded, onProgress, onTimeUpdate, syncPlayState]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      try {
        await video.play();
      } catch {
        setError('تعذر تشغيل الفيديو. اضغط مرة أخرى للمحاولة.');
      }
    } else {
      video.pause();
    }
  };

  const seekToPercent = (value: number) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    video.currentTime = (value / 100) * duration;
    setCurrentTime(video.currentTime);
  };

  const skipBy = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(video.currentTime + seconds, 0), duration || video.duration || 0);
  };

  const changeVolume = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value;
    video.muted = value === 0;
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  };

  const changePlaybackRate = async (rate: number) => {
    const video = videoRef.current;
    if (!video || rate === playbackRate || isChangingRate) return;

    const shouldResume = !video.paused && !video.ended;
    setSettingsOpen(false);
    setIsChangingRate(true);
    if (shouldResume) video.pause();

    video.preservesPitch = true;
    video.playbackRate = rate;
    setPlaybackRate(rate);

    if (shouldResume) {
      await new Promise<void>((resolve) => {
        rateChangeTimerRef.current = setTimeout(
          () => {
            rateChangeTimerRef.current = null;
            resolve();
          },
          rate >= 2 ? 900 : 650,
        );
      });

      if (videoRef.current === video) {
        try {
          await video.play();
        } catch {
          setError('تعذر استئناف الفيديو بالسرعة الجديدة.');
        }
      }
    }
    setIsChangingRate(false);
  };

  const changeQuality = (option: QualityOption) => {
    if (!option.available) return;
    if (option.levelIndex >= 0 && hlsRef.current) {
      hlsRef.current.currentLevel = option.levelIndex;
    }
    setSelectedQuality(option.label);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await container.requestFullscreen();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`group relative aspect-video w-full overflow-hidden rounded-[var(--radius-xl)] bg-black shadow-[var(--shadow-xl)] ${className}`}
      dir="ltr"
      onDoubleClick={toggleFullscreen}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        playsInline
        preload="metadata"
        poster={poster}
        controls={false}
        controlsList="nodownload"
        onClick={togglePlay}
        onContextMenu={(event) => event.preventDefault()}
      />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.3),transparent_30%,transparent_55%,rgba(0,0,0,0.86))]" />

      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-5 text-center text-white">
          <p className="max-w-md font-heading text-sm font-semibold sm:text-base">{error}</p>
        </div>
      )}

      {isBuffering && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="size-12 rounded-full border-4 border-white/25 border-t-brand-400 animate-spin" />
        </div>
      )}

      {isChangingRate && !error && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/55 text-white backdrop-blur-[2px]"
          aria-live="polite"
        >
          <div className="size-11 animate-spin rounded-full border-4 border-white/25 border-t-brand-400" />
          <p className="text-sm font-bold">جاري ضبط سرعة التشغيل...</p>
        </div>
      )}

      {!isPlaying && !error && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute left-1/2 top-1/2 z-10 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white shadow-xl backdrop-blur-md transition hover:scale-105 hover:bg-brand-500/85 focus-visible:outline-white sm:size-20"
          aria-label="تشغيل الفيديو"
        >
          <Play className="size-8 fill-current sm:size-10" />
        </button>
      )}

      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between gap-3 p-3 text-white sm:p-4">
        <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1 text-xs font-bold backdrop-blur-md">
          {selectedQuality}
        </span>
        <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1 text-xs font-bold backdrop-blur-md">
          {playbackRate}x
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 space-y-3 p-3 text-white sm:p-4">
        <div className="flex items-center gap-3">
          <span className="ba-number w-12 text-xs font-semibold text-white/85 sm:w-14">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progressPercent}
            onChange={(event) => seekToPercent(Number(event.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-brand-400"
            style={{
              background: `linear-gradient(90deg, var(--color-brand-400) ${progressPercent}%, rgb(255 255 255 / 0.22) ${progressPercent}%)`,
            }}
            aria-label="تقدم الفيديو"
          />
          <span className="ba-number w-12 text-end text-xs font-semibold text-white/85 sm:w-14">
            {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/15 bg-black/45 p-2 shadow-lg backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="flex size-11 items-center justify-center rounded-full text-white transition hover:bg-white/12"
              aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
            >
              {isPlaying ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
            </button>
            <button
              type="button"
              onClick={() => skipBy(-10)}
              className="hidden size-11 items-center justify-center rounded-full text-white transition hover:bg-white/12 sm:flex"
              aria-label="الرجوع 10 ثواني"
            >
              <RotateCcw className="size-5" />
            </button>
            <button
              type="button"
              onClick={toggleMute}
              className="flex size-11 items-center justify-center rounded-full text-white transition hover:bg-white/12"
              aria-label={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
            >
              {isMuted || volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(event) => changeVolume(Number(event.target.value))}
              className="hidden h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/20 accent-brand-400 md:block"
              aria-label="مستوى الصوت"
            />
          </div>

          <div className="relative flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setSettingsOpen((open) => !open)}
              className="flex min-h-11 items-center gap-2 rounded-full px-3 text-xs font-bold text-white transition hover:bg-white/12"
              aria-expanded={settingsOpen}
              aria-label="إعدادات الفيديو"
            >
              <Settings className="size-5" />
              <span className="hidden sm:inline">الإعدادات</span>
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex size-11 items-center justify-center rounded-full text-white transition hover:bg-white/12"
              aria-label={isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}
            >
              {isFullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
            </button>

            <MobileSheet
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              title="إعدادات الفيديو"
              description={dataSaver ? 'توفير البيانات مفعل' : 'اختار الجودة وسرعة التشغيل'}
            >
                <div className="space-y-5" dir="rtl">
                  <div>
                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-3">
                      <Settings className="size-4" />
                      الجودة
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (hlsRef.current) hlsRef.current.currentLevel = -1;
                        setSelectedQuality(DEFAULT_QUALITY_LABEL);
                        setSettingsOpen(false);
                      }}
                      className={`mb-2 min-h-11 w-full rounded-xl px-3 text-sm font-bold ${
                        selectedQuality === DEFAULT_QUALITY_LABEL
                          ? 'bg-brand-600 text-white'
                          : 'bg-surface-2 text-ink'
                      }`}
                    >
                      تلقائي
                    </button>
                    <div className="grid grid-cols-3 gap-2">
                      {qualityOptions.map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => changeQuality(option)}
                          disabled={!option.available}
                          title={
                            option.available
                              ? option.label
                              : 'هذه الجودة تحتاج توليد نسخة HLS بعد رفع الفيديو'
                          }
                          className={`min-h-11 rounded-xl px-2 py-2 text-sm font-bold transition ${
                            selectedQuality === option.label
                              ? 'bg-brand-500 text-white'
                              : option.available
                                ? 'bg-surface-2 text-ink hover:bg-surface-3'
                                : 'bg-surface-2 text-ink-4'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-px bg-border" />

                  <div>
                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-3">
                      <Gauge className="size-4" />
                      السرعة
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {PLAYBACK_RATES.map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => void changePlaybackRate(rate)}
                          disabled={isChangingRate}
                          className={`min-h-11 rounded-xl px-1 py-2 text-xs font-bold transition ${
                            playbackRate === rate
                              ? 'bg-brand-500 text-white'
                              : 'bg-surface-2 text-ink hover:bg-surface-3'
                          }`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
            </MobileSheet>
          </div>
        </div>
      </div>
    </div>
  );
}
