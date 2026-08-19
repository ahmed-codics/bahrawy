import { fireEvent, render, screen } from '@testing-library/react';
import { ProtectedVideoControls } from './ProtectedVideoControls';

const base = {
  isPlaying: false,
  isFullscreen: false,
  isVideoReady: false,
  currentTime: 0,
  duration: 100,
  playbackRate: 1,
  onTogglePlay: () => undefined,
  onToggleFullscreen: () => undefined,
  onSeek: () => undefined,
  onPlaybackRateChange: () => undefined,
  onExitFocus: undefined,
};

describe('ProtectedVideoControls', () => {
  it('renders play button when paused', () => {
    render(<ProtectedVideoControls {...base} />);
    expect(screen.getByRole('button', { name: 'تشغيل' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'إيقاف مؤقت' })).not.toBeInTheDocument();
  });

  it('renders pause button when playing', () => {
    render(<ProtectedVideoControls {...base} isPlaying />);
    expect(screen.getByRole('button', { name: 'إيقاف مؤقت' })).toBeInTheDocument();
  });

  it('switches fullscreen label based on isFullscreen', () => {
    const { rerender } = render(<ProtectedVideoControls {...base} />);
    expect(screen.getByRole('button', { name: 'ملء الشاشة' })).toBeInTheDocument();
    rerender(<ProtectedVideoControls {...base} isFullscreen />);
    expect(screen.getByRole('button', { name: 'الخروج من ملء الشاشة' })).toBeInTheDocument();
  });

  it('shows the exit focus button only when onExitFocus is provided', () => {
    const { rerender } = render(<ProtectedVideoControls {...base} />);
    expect(screen.queryByRole('button', { name: 'العودة لصفحة الدرس' })).not.toBeInTheDocument();
    rerender(<ProtectedVideoControls {...base} onExitFocus={() => undefined} />);
    expect(screen.getByRole('button', { name: 'العودة لصفحة الدرس' })).toBeInTheDocument();
  });

  it('fires toggle handlers on click', () => {
    const onTogglePlay = jest.fn();
    const onToggleFullscreen = jest.fn();
    const onExitFocus = jest.fn();
    render(
      <ProtectedVideoControls
        {...base}
        onTogglePlay={onTogglePlay}
        onToggleFullscreen={onToggleFullscreen}
        onExitFocus={onExitFocus}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'تشغيل' }));
    fireEvent.click(screen.getByRole('button', { name: 'ملء الشاشة' }));
    fireEvent.click(screen.getByRole('button', { name: 'العودة لصفحة الدرس' }));

    expect(onTogglePlay).toHaveBeenCalledTimes(1);
    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
    expect(onExitFocus).toHaveBeenCalledTimes(1);
  });

  it('renders a seekable progress bar with current and total time', () => {
    const { container } = render(
      <ProtectedVideoControls {...base} currentTime={25} duration={100} isVideoReady />,
    );
    const slider = container.querySelector('[data-progress-bar="true"]');
    expect(slider).not.toBeNull();
    expect(slider).toHaveAttribute('role', 'slider');
    expect(slider).toHaveAttribute('aria-valuenow', '25');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
    expect(container.textContent).toContain('00:25');
    expect(container.textContent).toContain('01:40');
  });

  it('seeks by clicking the progress bar', () => {
    const onSeek = jest.fn();
    const { container } = render(
      <ProtectedVideoControls {...base} currentTime={0} duration={100} isVideoReady onSeek={onSeek} />,
    );
    const track = container.querySelector('[data-progress-bar="true"]') as HTMLElement;
    track.getBoundingClientRect = () =>
      ({ left: 0, width: 200, right: 200, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    fireEvent.pointerDown(track, { clientX: 50, pointerId: 1 });
    fireEvent.pointerUp(track, { clientX: 50, pointerId: 1 });

    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith(25);
  });

  it('drags the progress bar and commits the seek on release', () => {
    const onSeek = jest.fn();
    const { container } = render(
      <ProtectedVideoControls {...base} currentTime={0} duration={100} isVideoReady onSeek={onSeek} />,
    );
    const track = container.querySelector('[data-progress-bar="true"]') as HTMLElement;
    track.getBoundingClientRect = () =>
      ({ left: 0, width: 200, right: 200, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    fireEvent.pointerDown(track, { clientX: 40, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 120, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 160, pointerId: 1 });
    fireEvent.pointerUp(track, { clientX: 160, pointerId: 1 });

    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith(80);
  });

  it('does not seek while the video is not ready', () => {
    const onSeek = jest.fn();
    const { container } = render(
      <ProtectedVideoControls {...base} currentTime={0} duration={100} onSeek={onSeek} />,
    );
    const track = container.querySelector('[data-progress-bar="true"]') as HTMLElement;
    expect(track).toHaveAttribute('aria-disabled', 'true');
    expect(track).toHaveAttribute('tabindex', '-1');

    fireEvent.pointerDown(track, { clientX: 50, pointerId: 1 });
    fireEvent.pointerUp(track, { clientX: 50, pointerId: 1 });
    expect(onSeek).not.toHaveBeenCalled();
  });

  it('changes playback speed from the menu and calls the handler', () => {
    const onPlaybackRateChange = jest.fn();
    render(
      <ProtectedVideoControls
        {...base}
        isVideoReady
        playbackRate={1}
        onPlaybackRateChange={onPlaybackRateChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'سرعة التشغيل' }));
    const menu = screen.getByRole('menu', { name: 'خيارات سرعة التشغيل' });
    expect(menu).toBeInTheDocument();
    // The controls bar is pointer-events-none; the dropdown must re-enable
    // pointer events so the protection layer cannot swallow menu clicks.
    expect(menu.className).toContain('pointer-events-auto');

    fireEvent.click(screen.getByRole('menuitemradio', { name: '1.5x' }));
    expect(onPlaybackRateChange).toHaveBeenCalledWith(1.5);
  });

  it('still selects a speed when a real pointer press precedes the click', () => {
    const onPlaybackRateChange = jest.fn();
    render(
      <ProtectedVideoControls
        {...base}
        isVideoReady
        playbackRate={1}
        onPlaybackRateChange={onPlaybackRateChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'سرعة التشغيل' }));
    const item = screen.getByRole('menuitemradio', { name: '1.5x' });
    // Browsers dispatch pointerdown before click; the outside-press close
    // handler must not swallow the selection.
    fireEvent.pointerDown(item);
    fireEvent.click(item);

    expect(onPlaybackRateChange).toHaveBeenCalledWith(1.5);
  });

  it('shows the current playback rate on the speed button', () => {
    render(<ProtectedVideoControls {...base} isVideoReady playbackRate={2} />);
    expect(screen.getByRole('button', { name: 'سرعة التشغيل' }).textContent).toContain('2x');
  });
});