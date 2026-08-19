/* eslint-disable @typescript-eslint/no-explicit-any */
import { act } from '@testing-library/react';

export type FullscreenMock = {
  setElement: (el: Element | null) => void;
  requestFullscreen: jest.Mock;
  exitFullscreen: jest.Mock;
  dispatchChange: () => void;
};

/**
 * Installs a controllable Fullscreen API mock for jsdom, where the real API is
 * not implemented. Tracks document.fullscreenElement and dispatches
 * fullscreenchange synchronously (inside the caller's act() window) like a
 * real browser would.
 */
export function installFullscreenMock(): FullscreenMock {
  let fullscreenElement: Element | null = null;

  const dispatchChange = () => {
    document.dispatchEvent(new Event('fullscreenchange'));
  };

  const requestFullscreen = jest.fn(function (this: Element) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    fullscreenElement = this;
    dispatchChange();
    return Promise.resolve();
  });

  const exitFullscreen = jest.fn(() => {
    fullscreenElement = null;
    dispatchChange();
  });

  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => fullscreenElement,
  });
  Object.defineProperty(document, 'fullscreenEnabled', {
    configurable: true,
    get: () => true,
  });
  Object.defineProperty(Element.prototype, 'requestFullscreen', {
    configurable: true,
    value: requestFullscreen,
  });
  Object.defineProperty(Document.prototype, 'exitFullscreen', {
    configurable: true,
    value: exitFullscreen,
  });

  return {
    setElement: (el) => {
      act(() => {
        fullscreenElement = el;
        dispatchChange();
      });
    },
    requestFullscreen,
    exitFullscreen,
    dispatchChange,
  };
}

export type YouTubeMockPlayers = Array<{
  element: HTMLElement;
  options: {
    videoId: string;
    events: {
      onReady: () => void;
      onStateChange: (event: { data: number }) => void;
      onPlaybackRateChange?: (event: { data: number }) => void;
      onError?: (event: { data: number }) => void;
    };
  };
  state: number;
  playbackRate: number;
  playVideo: jest.Mock;
  pauseVideo: jest.Mock;
  getPlayerState: jest.Mock;
  getCurrentTime: jest.Mock;
  getDuration: jest.Mock;
  seekTo: jest.Mock;
  getPlaybackRate: jest.Mock;
  setPlaybackRate: jest.Mock;
  destroy: jest.Mock;
}>;

/**
 * Installs a minimal window.YT IFrame API mock. The Player constructor stores
 * itself and fires onReady shortly after construction, exactly like the real
 * API. onStateChange is fired on play/pause.
 */
export function installYouTubeMock(): {
  players: YouTubeMockPlayers;
  Player: jest.Mock;
} {
  const players: YouTubeMockPlayers = [];

  const Player = jest.fn(function (this: unknown, element: HTMLElement, options: any) {
    const instance: YouTubeMockPlayers[number] = {
      element,
      options,
      state: -1,
      playbackRate: 1,
      playVideo: jest.fn(() => {
        instance.state = 1;
        instance.options.events.onStateChange?.({ data: 1 });
      }),
      pauseVideo: jest.fn(() => {
        instance.state = 2;
        instance.options.events.onStateChange?.({ data: 2 });
      }),
      getPlayerState: jest.fn(() => instance.state),
      getCurrentTime: jest.fn(() => 25),
      getDuration: jest.fn(() => 100),
      seekTo: jest.fn((time: number) => {
        void time;
      }),
      getPlaybackRate: jest.fn(() => instance.playbackRate),
      setPlaybackRate: jest.fn((rate: number) => {
        instance.playbackRate = rate;
        instance.options.events.onPlaybackRateChange?.({ data: rate });
      }),
      destroy: jest.fn(),
    };
    players.push(instance);
    queueMicrotask(() => {
      instance.options.events.onReady?.();
    });
    return instance;
  });

  (window as any).YT = {
    Player,
  };

  return { players, Player };
}

export function clearYouTubeMock() {
  delete (window as any).YT;
}