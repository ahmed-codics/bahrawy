import { fireEvent, render } from '@testing-library/react';
import { VideoProtectionLayer } from './VideoProtectionLayer';

describe('VideoProtectionLayer', () => {
  it('renders a transparent blocker above the player', () => {
    const { container } = render(<VideoProtectionLayer />);
    const layer = container.querySelector('[data-protection-layer="true"]');
    expect(layer).not.toBeNull();
    expect(layer).toHaveAttribute('aria-hidden', 'true');
  });

  it('blocks pointer and mouse interaction events', () => {
    const { container } = render(<VideoProtectionLayer />);
    const layer = container.querySelector('[data-protection-layer="true"]') as HTMLElement;

    expect(fireEvent.pointerDown(layer, { pointerId: 1 })).toBe(false);
    expect(fireEvent.mouseDown(layer)).toBe(false);
    expect(fireEvent.click(layer)).toBe(false);
    expect(fireEvent.dblClick(layer)).toBe(false);
    expect(fireEvent.contextMenu(layer)).toBe(false);
  });

  it('captures touch gestures on the layer (touch-action none prevents scroll/zoom)', () => {
    const { container } = render(<VideoProtectionLayer />);
    const layer = container.querySelector('[data-protection-layer="true"]') as HTMLElement;

    // The layer sits on top of the iframe, so gestures land here, and the
    // touch-none class lets the browser suppress scroll/zoom natively.
    fireEvent.touchStart(layer, { touches: [{ identifier: 1 } as Touch] });
    expect(layer).toHaveClass('touch-none');
  });
});