'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Maximize, Minimize, Pause, Play, Undo2, X } from 'lucide-react';
import { cn } from '../utils';

export type VideoFocusOverlayProps = {
  focusMode: boolean;
  onExitFocus: () => void;
  children: ReactNode;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  showCustomControls?: boolean;
};

function ControlButton({
  onClick,
  label,
  children,
  className,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-lg backdrop-blur-md transition hover:scale-105 hover:bg-brand-500/85 focus-visible:outline-2 focus-visible:outline-white active:scale-95 sm:size-12',
        className,
      )}
    >
      {children}
    </button>
  );
}

const getFullscreenElement = () => {
  const webkitDoc = document as Document & { webkitFullscreenElement?: Element };
  return document.fullscreenElement ?? webkitDoc.webkitFullscreenElement ?? null;
};

const exitFullscreen = () => {
  const webkitDoc = document as Document & { webkitExitFullscreen?: () => void };
  const exit = document.exitFullscreen ?? webkitDoc.webkitExitFullscreen;
  exit?.call(document);
};

export function VideoFocusOverlay({
  focusMode,
  onExitFocus,
  children,
  isPlaying = false,
  onTogglePlay,
  showCustomControls = false,
}: VideoFocusOverlayProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!focusMode) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';

    const onWheel = (event: WheelEvent) => {
      const target = event.target as Node;
      if (stageRef.current && stageRef.current.contains(target)) return;
      event.preventDefault();
    };
    const onTouchMove = (event: TouchEvent) => {
      const target = event.target as Node;
      if (stageRef.current && stageRef.current.contains(target)) return;
      event.preventDefault();
    };

    document.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overscrollBehavior = previousOverscroll;
      document.removeEventListener('wheel', onWheel);
      document.removeEventListener('touchmove', onTouchMove);
    };
  }, [focusMode]);

  useEffect(() => {
    const onChange = () => {
      const element = stageRef.current;
      setIsFullscreen(!!element && element.contains(getFullscreenElement()));
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const element = stageRef.current;
    if (!element) return;
    if (getFullscreenElement()) {
      exitFullscreen();
      return;
    }
    const webkitElement = element as HTMLElement & {
      webkitRequestFullscreen?: () => void;
    };
    const request =
      element.requestFullscreen ?? webkitElement.webkitRequestFullscreen;
    if (typeof request === 'function') {
      const result = request.call(element) as Promise<void> | undefined;
      result?.catch(() => {
        // Fullscreen request rejected by the browser; stay in focus mode.
      });
      return;
    }
    const iframe = element.querySelector('iframe');
    if (iframe) {
      const webkitFrame = iframe as HTMLIFrameElement & {
        webkitRequestFullscreen?: () => void;
      };
      const frameRequest =
        iframe.requestFullscreen ?? webkitFrame.webkitRequestFullscreen;
      if (typeof frameRequest === 'function') {
        const result = frameRequest.call(iframe) as Promise<void> | undefined;
        result?.catch(() => {
          // Fullscreen request rejected by the browser; stay in focus mode.
        });
      }
    }
  };

  const handleExitFullscreen = () => {
    if (getFullscreenElement()) {
      exitFullscreen();
      return;
    }
    onExitFocus();
  };

  return (
    <div
      className={cn(
        'relative',
        focusMode &&
          'fixed inset-0 z-[90] overflow-hidden overscroll-none bg-black',
      )}
    >
      {focusMode && (
        <div
          className="absolute inset-0 z-0 touch-none"
          aria-hidden="true"
          onPointerDown={(event) => event.preventDefault()}
          onTouchStart={(event) => event.preventDefault()}
        />
      )}

      <div
        className={cn(
          focusMode &&
            'relative z-10 flex h-full items-center justify-center p-3 sm:p-6',
        )}
      >
        <div
          ref={stageRef}
          dir="ltr"
          className={cn('relative w-full', focusMode && !isFullscreen && 'max-w-6xl')}
          style={
            isFullscreen
              ? {
                  position: 'fixed',
                  inset: 0,
                  width: '100vw',
                  height: '100vh',
                  zIndex: 2147483647,
                  backgroundColor: '#000',
                }
              : undefined
          }
        >
{children}

          {focusMode && isFullscreen && (
            <div
              aria-hidden="true"
              className="absolute inset-0 z-30 touch-none"
              onPointerDown={(event) => event.preventDefault()}
              onClick={(event) => event.preventDefault()}
              onTouchStart={(event) => event.preventDefault()}
              onTouchMove={(event) => event.preventDefault()}
              onDoubleClick={(event) => event.preventDefault()}
              onContextMenu={(event) => event.preventDefault()}
            />
          )}

          {focusMode && showCustomControls && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex items-center justify-center gap-2 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-3 pb-3 pt-12 sm:gap-3 sm:pb-4 sm:pt-14">
              <ControlButton
                onClick={() => onTogglePlay?.()}
                label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
              >
                {isPlaying ? (
                  <Pause className="size-5 fill-current sm:size-6" />
                ) : (
                  <Play className="size-5 fill-current sm:size-6" />
                )}
              </ControlButton>
              <ControlButton onClick={() => toggleFullscreen()} label="ملء الشاشة">
                {isFullscreen ? (
                  <Minimize className="size-5 sm:size-6" />
                ) : (
                  <Maximize className="size-5 sm:size-6" />
                )}
              </ControlButton>
              <ControlButton
                onClick={() => handleExitFullscreen()}
                label={
                  isFullscreen
                    ? 'الخروج من ملء الشاشة'
                    : 'خروج من Fullscreen والعودة لصفحة الدرس'
                }
              >
                <Undo2 className="size-5 sm:size-6" />
              </ControlButton>
            </div>
          )}
        </div>
      </div>

      {focusMode && (
        <button
          type="button"
          onClick={onExitFocus}
          aria-label="الخروج من وضع المشاهدة"
          title="الخروج من وضع المشاهدة"
          className="absolute left-3 top-3 z-30 flex size-11 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white shadow-lg backdrop-blur-md transition hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-white sm:left-4 sm:top-4"
        >
          <X className="size-5" />
        </button>
      )}
    </div>
  );
}