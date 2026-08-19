import '@testing-library/jest-dom';

// jsdom (without pretendToBeVisual) lacks requestAnimationFrame and
// ResizeObserver, which the video players rely on.
if (typeof global.requestAnimationFrame !== 'function') {
  global.requestAnimationFrame = ((callback: FrameRequestCallback) =>
    setTimeout(() => callback(Date.now()), 16)) as unknown as typeof requestAnimationFrame;
  global.cancelAnimationFrame = ((id: number) =>
    clearTimeout(id)) as unknown as typeof cancelAnimationFrame;
}

if (typeof (global as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
  (global as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom does not implement PointerEvent (or setPointerCapture), which the video
// progress bar relies on for pointer drag on mouse + touch. A minimal polyfill
// over MouseEvent keeps clientX/clientY and pointerId flowing into handlers.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? '';
      this.isPrimary = params.isPrimary ?? false;
    }
  }
  (window as unknown as { PointerEvent: typeof PointerEvent }).PointerEvent =
    PointerEventPolyfill as unknown as typeof PointerEvent;
}