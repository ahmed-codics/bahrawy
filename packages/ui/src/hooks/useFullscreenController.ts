'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type FullscreenRequestable = HTMLElement & {
  webkitRequestFullscreen?: () => void;
};

type DocumentWithWebkit = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => void;
};

export function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as DocumentWithWebkit;
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/**
 * True when the Fullscreen API can fullscreen arbitrary elements in this
 * browser. Older iOS Safari only supports fullscreen on native <video>, so we
 * gracefully fall back to the in-page focus stage there.
 */
export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as DocumentWithWebkit;
  return Boolean(document.fullscreenEnabled ?? doc.webkitFullscreenEnabled);
}

export function requestFullscreenFor(
  element: Element | null,
): Promise<boolean> {
  if (!element) return Promise.resolve(false);
  const target = element as FullscreenRequestable;
  const request = target.requestFullscreen ?? target.webkitRequestFullscreen;
  if (typeof request !== 'function') return Promise.resolve(false);
  try {
    const result = request.call(target) as unknown;
    if (result && typeof (result as Promise<void>).then === 'function') {
      return (result as Promise<void>)
        .then(() => true)
        .catch(() => false);
    }
    return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}

export function exitFullscreen(): void {
  if (typeof document === 'undefined') return;
  const doc = document as DocumentWithWebkit;
  const exit = document.exitFullscreen ?? doc.webkitExitFullscreen;
  if (typeof exit === 'function') {
    try {
      exit.call(document);
    } catch {
      // Ignore: the browser may reject exit while not fullscreen.
    }
  }
}

/**
 * Single source of truth for the video fullscreen state. Listens to both the
 * standard and webkit fullscreenchange events so state stays correct no matter
 * how fullscreen was entered or exited (button, Escape, browser UI, OS).
 */
export function useFullscreenController<T extends HTMLElement>(
  targetRef: React.RefObject<T | null>,
) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const supported = isFullscreenSupported();

  const changeHandlerRef = useRef<() => void>(() => {});

  useEffect(() => {
    const onChange = () => {
      const element = getFullscreenElement();
      const target = targetRef.current;
      setIsFullscreen(
        Boolean(
          target &&
            element &&
            (element === target || target.contains(element)),
        ),
      );
    };
    changeHandlerRef.current = onChange;
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
      changeHandlerRef.current = () => {};
    };
  }, [targetRef]);

  const enter = useCallback(
    () => requestFullscreenFor(targetRef.current),
    [targetRef],
  );

  const exit = useCallback(() => {
    exitFullscreen();
  }, []);

  const toggle = useCallback(() => {
    if (getFullscreenElement()) {
      exitFullscreen();
      return Promise.resolve(true);
    }
    return requestFullscreenFor(targetRef.current);
  }, [targetRef]);

  return { isFullscreen, supported, enter, exit, toggle };
}