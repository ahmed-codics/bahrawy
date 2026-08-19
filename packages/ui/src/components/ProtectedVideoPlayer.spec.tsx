import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProtectedVideoPlayer } from './ProtectedVideoPlayer';
import {
  clearYouTubeMock,
  installFullscreenMock,
  installYouTubeMock,
} from '../testing/fullscreenMock';

const youTubePlayback = {
  provider: 'YOUTUBE' as const,
  videoId: 'iMZ1skkbUWI',
};

const r2Playback = {
  provider: 'R2' as const,
  url: 'https://example.test/video.m3u8',
};

describe('ProtectedVideoPlayer', () => {
  let fullscreen: ReturnType<typeof installFullscreenMock>;

  beforeEach(() => {
    fullscreen = installFullscreenMock();
    installYouTubeMock();
  });

  afterEach(() => {
    clearYouTubeMock();
  });

  it('renders protection layer and custom controls for YouTube', async () => {
    const { container } = render(
      <ProtectedVideoPlayer playback={youTubePlayback} focusMode />,
    );

    expect(await screen.findByRole('button', { name: 'تشغيل' })).toBeInTheDocument();
    expect(container.querySelector('[data-protection-layer="true"]')).not.toBeNull();
  });

  it('renders a plain player without protection layer for non-YouTube providers', () => {
    const { container } = render(<ProtectedVideoPlayer playback={r2Playback} focusMode />);
    expect(container.querySelector('[data-protection-layer="true"]')).toBeNull();
  });

  it('auto-enters real fullscreen once the player is ready', async () => {
    render(<ProtectedVideoPlayer playback={youTubePlayback} focusMode />);

    await screen.findByRole('button', { name: 'الخروج من ملء الشاشة' });
    expect(fullscreen.requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('does not auto-fullscreen when autoFullscreen is disabled', async () => {
    render(
      <ProtectedVideoPlayer playback={youTubePlayback} focusMode autoFullscreen={false} />,
    );

    await screen.findByRole('button', { name: 'تشغيل' });
    expect(fullscreen.requestFullscreen).not.toHaveBeenCalled();
  });

  it('falls back gracefully and never retries when fullscreen is rejected', async () => {
    fullscreen.requestFullscreen.mockImplementation(function () {
      return Promise.reject(new Error('denied'));
    });

    render(<ProtectedVideoPlayer playback={youTubePlayback} focusMode />);

    await screen.findByRole('button', { name: 'تشغيل' });
    await waitFor(() => expect(fullscreen.requestFullscreen).toHaveBeenCalledTimes(1));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(fullscreen.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'ملء الشاشة' })).toBeInTheDocument();
  });

  it('toggles fullscreen through the custom button', async () => {
    render(
      <ProtectedVideoPlayer playback={youTubePlayback} focusMode autoFullscreen={false} />,
    );

    await screen.findByRole('button', { name: 'تشغيل' });
    fireEvent.click(screen.getByRole('button', { name: 'ملء الشاشة' }));

    await screen.findByRole('button', { name: 'الخروج من ملء الشاشة' });
    expect(fullscreen.requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('syncs state when the browser exits fullscreen (Escape)', async () => {
    render(
      <ProtectedVideoPlayer playback={youTubePlayback} focusMode autoFullscreen={false} />,
    );

    await screen.findByRole('button', { name: 'تشغيل' });
    fireEvent.click(screen.getByRole('button', { name: 'ملء الشاشة' }));
    await screen.findByRole('button', { name: 'الخروج من ملء الشاشة' });

    fullscreen.setElement(null);
    await screen.findByRole('button', { name: 'ملء الشاشة' });
  });

  it('calls onExitFocus and exits fullscreen when returning to the lesson', async () => {
    const onExitFocus = jest.fn();
    render(
      <ProtectedVideoPlayer
        playback={youTubePlayback}
        focusMode
        autoFullscreen={false}
        onExitFocus={onExitFocus}
      />,
    );

    await screen.findByRole('button', { name: 'تشغيل' });
    fireEvent.click(screen.getByRole('button', { name: 'ملء الشاشة' }));
    await screen.findByRole('button', { name: 'الخروج من ملء الشاشة' });

    fireEvent.click(
      screen.getByRole('button', { name: 'الخروج من ملء الشاشة والعودة لصفحة الدرس' }),
    );
    expect(onExitFocus).toHaveBeenCalledTimes(1);
  });

  it('does not expose the video id in the DOM', async () => {
    const { container } = render(
      <ProtectedVideoPlayer playback={youTubePlayback} focusMode />,
    );
    await screen.findByRole('button', { name: 'تشغيل' });

    expect(container.textContent).not.toContain('iMZ1skkbUWI');
    const attributes = Array.from(container.querySelectorAll('*')).flatMap((el) =>
      Array.from(el.attributes).map((a) => a.value),
    );
    expect(attributes.some((v) => v.includes('iMZ1skkbUWI'))).toBe(false);
  });

  it('shows a clean error and no protection layer for unplayable YouTube playback', () => {
    const { container } = render(
      <ProtectedVideoPlayer playback={{ provider: 'YOUTUBE', videoId: undefined }} focusMode />,
    );
    expect(screen.getByText('الفيديو غير متاح حالياً.')).toBeInTheDocument();
    expect(container.querySelector('[data-protection-layer="true"]')).toBeNull();
  });

  it('switches to the error state when the player reports an error', async () => {
    const { players } = installYouTubeMock();
    const { container } = render(<ProtectedVideoPlayer playback={youTubePlayback} focusMode />);

    await screen.findByRole('button', { name: 'تشغيل' });
    expect(players.length).toBe(1);

    act(() => {
      players[0].options.events.onError?.({ data: 2 });
    });

    await screen.findByText('تعذر تشغيل الفيديو. حاول مرة أخرى بعد قليل.');
    expect(container.querySelector('[data-protection-layer="true"]')).toBeNull();
  });

  it('plays and pauses through the custom controls', async () => {
    const { players } = installYouTubeMock();
    render(<ProtectedVideoPlayer playback={youTubePlayback} focusMode autoFullscreen={false} />);

    await screen.findByRole('button', { name: 'تشغيل' });
    fireEvent.click(screen.getByRole('button', { name: 'تشغيل' }));

    await screen.findByRole('button', { name: 'إيقاف مؤقت' });
    expect(players[0].playVideo).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'إيقاف مؤقت' }));
    await screen.findByRole('button', { name: 'تشغيل' });
    expect(players[0].pauseVideo).toHaveBeenCalledTimes(1);
  });

  it('removes all document listeners on unmount', async () => {
    const addSpy = jest.spyOn(document, 'addEventListener');
    const removeSpy = jest.spyOn(document, 'removeEventListener');

    const { unmount } = render(
      <ProtectedVideoPlayer playback={youTubePlayback} focusMode autoFullscreen={false} />,
    );
    await screen.findByRole('button', { name: 'تشغيل' });
    unmount();

    const added = addSpy.mock.calls.filter(([name]) => name === 'fullscreenchange').length;
    const removed = removeSpy.mock.calls.filter(([name]) => name === 'fullscreenchange').length;
    expect(added).toBe(removed);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('syncs the progress bar with the player', async () => {
    const { container } = render(
      <ProtectedVideoPlayer playback={youTubePlayback} focusMode autoFullscreen={false} />,
    );
    await screen.findByRole('button', { name: 'تشغيل' });

    const slider = container.querySelector('[data-progress-bar="true"]');
    expect(slider).toHaveAttribute('aria-valuenow', '25');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
    expect(slider).toHaveAttribute('role', 'slider');
  });

it('seeks the real player through the progress bar', async () => {
    const { players } = installYouTubeMock();
    const { container } = render(
      <ProtectedVideoPlayer playback={youTubePlayback} focusMode autoFullscreen={false} />,
    );
    await screen.findByRole('button', { name: 'تشغيل' });

    const track = container.querySelector('[data-progress-bar="true"]') as HTMLElement;
    track.getBoundingClientRect = () =>
      ({ left: 0, width: 200, right: 200, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    fireEvent.pointerDown(track, { clientX: 50, pointerId: 1 });
    fireEvent.pointerUp(track, { clientX: 50, pointerId: 1 });

    expect(players[0].seekTo).toHaveBeenCalledTimes(1);
    expect(players[0].seekTo).toHaveBeenCalledWith(25, true);
  });

  it('drags the progress bar and seeks on release', async () => {
    const { players } = installYouTubeMock();
    const { container } = render(
      <ProtectedVideoPlayer playback={youTubePlayback} focusMode autoFullscreen={false} />,
    );
    await screen.findByRole('button', { name: 'تشغيل' });

    const track = container.querySelector('[data-progress-bar="true"]') as HTMLElement;
    track.getBoundingClientRect = () =>
      ({ left: 0, width: 200, right: 200, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    fireEvent.pointerDown(track, { clientX: 40, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 160, pointerId: 1 });
    fireEvent.pointerUp(track, { clientX: 160, pointerId: 1 });

    expect(players[0].seekTo).toHaveBeenCalledTimes(1);
    expect(players[0].seekTo).toHaveBeenCalledWith(80, true);
  });

  it('changes playback speed on the real player and reflects it in the UI', async () => {
    const { players } = installYouTubeMock();
    render(
      <ProtectedVideoPlayer playback={youTubePlayback} focusMode autoFullscreen={false} />,
    );
    await screen.findByRole('button', { name: 'تشغيل' });

    fireEvent.click(screen.getByRole('button', { name: 'سرعة التشغيل' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: '1.5x' }));

    expect(players[0].setPlaybackRate).toHaveBeenCalledTimes(1);
    expect(players[0].setPlaybackRate).toHaveBeenCalledWith(1.5);
    expect(screen.getByRole('button', { name: 'سرعة التشغيل' }).textContent).toContain('1.5x');
  });

  it('returns to 1x when the rate is reset', async () => {
    const { players } = installYouTubeMock();
    render(
      <ProtectedVideoPlayer playback={youTubePlayback} focusMode autoFullscreen={false} />,
    );
    await screen.findByRole('button', { name: 'تشغيل' });

    fireEvent.click(screen.getByRole('button', { name: 'سرعة التشغيل' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: '2x' }));
    expect(players[0].setPlaybackRate).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByRole('button', { name: 'سرعة التشغيل' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: '1x' }));
    expect(players[0].setPlaybackRate).toHaveBeenLastCalledWith(1);
    expect(screen.getByRole('button', { name: 'سرعة التشغيل' }).textContent).toContain('1x');
  });

  it('does not leak players or listeners across mounts', async () => {
    const { players } = installYouTubeMock();
    const { unmount } = render(
      <ProtectedVideoPlayer playback={youTubePlayback} focusMode autoFullscreen={false} />,
    );
    await screen.findByRole('button', { name: 'تشغيل' });
    expect(players.length).toBe(1);

    unmount();
    expect(players[0].destroy).toHaveBeenCalledTimes(1);

    render(
      <ProtectedVideoPlayer playback={youTubePlayback} focusMode autoFullscreen={false} />,
    );
    await screen.findByRole('button', { name: 'تشغيل' });
    expect(players.length).toBe(2);
  });
});