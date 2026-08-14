import React from 'react';
import { render, screen } from '@testing-library/react';
import { AnimatedWatermark } from './AnimatedWatermark';

describe('AnimatedWatermark', () => {
  it('renders the identifier text', () => {
    render(<AnimatedWatermark text="B123456·ABCDEF" />);
    expect(screen.getByText('B123456·ABCDEF')).toBeInTheDocument();
  });

  it('is non-interactive and hidden from assistive tech', () => {
    render(<AnimatedWatermark text="B123456·ABCDEF" />);
    const span = screen.getByText('B123456·ABCDEF');
    expect(span).toHaveAttribute('aria-hidden', 'true');
    expect(span.className).toMatch(/pointer-events-none/);
    expect(span.className).toMatch(/select-none/);
  });

  it('positions the badge away from the bottom control bar', () => {
    render(<AnimatedWatermark text="B123456·ABCDEF" />);
    const span = screen.getByText('B123456·ABCDEF');
    expect(span).toHaveStyle('top: 6%');
    expect(span).toHaveStyle('left: 5%');
  });
});