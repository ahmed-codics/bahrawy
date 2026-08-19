'use client';

import { cn } from '../utils';

type VideoProtectionLayerProps = {
  className?: string;
};

/**
 * Captures every pointer/touch interaction over the video surface so it never
 * reaches the YouTube iframe (logo, "More Videos", external links, bottom
 * navigation, native control bar). It is transparent, does NOT use
 * pointer-events:none, and sits BELOW the custom controls (z-20) so the
 * controls remain clickable. Works for both mouse and touch.
 */
export function VideoProtectionLayer({ className }: VideoProtectionLayerProps) {
  const block = (event: React.SyntheticEvent) => event.preventDefault();

  return (
    <div
      aria-hidden="true"
      data-protection-layer="true"
      className={cn(
        'pointer-events-auto absolute inset-0 z-10 touch-none select-none',
        className,
      )}
      onPointerDown={block}
      onPointerMove={block}
      onPointerUp={block}
      onMouseDown={block}
      onClick={block}
      onTouchStart={block}
      onTouchMove={block}
      onTouchEnd={block}
      onDoubleClick={block}
      onContextMenu={block}
    />
  );
}