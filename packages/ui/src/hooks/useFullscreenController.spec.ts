import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useFullscreenController } from './useFullscreenController';
import { installFullscreenMock } from '../testing/fullscreenMock';

describe('useFullscreenController', () => {
  let fullscreen: ReturnType<typeof installFullscreenMock>;

  beforeEach(() => {
    fullscreen = installFullscreenMock();
  });

  function mountHook() {
    return renderHook(() => useFullscreenController(useRef<HTMLDivElement>(null)));
  }

  it('starts non-fullscreen with support detected', () => {
    const { result } = mountHook();
    expect(result.current.isFullscreen).toBe(false);
    expect(result.current.supported).toBe(true);
  });

  it('tracks fullscreen state on fullscreenchange', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return { ref, controller: useFullscreenController(ref) };
    });
    const stage = document.createElement('div');
    document.body.appendChild(stage);
    act(() => {
      result.current.ref.current = stage;
    });

    act(() => {
      void result.current.controller.enter();
    });
    expect(result.current.controller.isFullscreen).toBe(true);

    act(() => {
      void result.current.controller.exit();
    });
    expect(result.current.controller.isFullscreen).toBe(false);
  });

  it('reports isFullscreen false when an unrelated element becomes fullscreen', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return { ref, controller: useFullscreenController(ref) };
    });
    const stage = document.createElement('div');
    document.body.appendChild(stage);
    act(() => {
      result.current.ref.current = stage;
    });

    act(() => {
      fullscreen.setElement(document.body);
    });
    expect(result.current.controller.isFullscreen).toBe(false);

    act(() => {
      fullscreen.setElement(stage);
    });
    expect(result.current.controller.isFullscreen).toBe(true);
  });

  it('returns false when requestFullscreen is rejected', async () => {
    fullscreen.requestFullscreen.mockImplementation(function () {
      return Promise.reject(new Error('denied'));
    });
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return { ref, controller: useFullscreenController(ref) };
    });
    const stage = document.createElement('div');
    document.body.appendChild(stage);
    act(() => {
      result.current.ref.current = stage;
    });

    let accepted = true;
    await act(async () => {
      await result.current.controller.enter().then((ok) => {
        accepted = ok;
      });
    });
    expect(accepted).toBe(false);
    expect(result.current.controller.isFullscreen).toBe(false);
  });

  it('cleans up listeners on unmount', () => {
    const addSpy = jest.spyOn(document, 'addEventListener');
    const removeSpy = jest.spyOn(document, 'removeEventListener');

    const { unmount } = mountHook();
    expect(addSpy).toHaveBeenCalledWith('fullscreenchange', expect.any(Function));

    unmount();
    expect(removeSpy).toHaveBeenCalledWith('fullscreenchange', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('webkitfullscreenchange', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});