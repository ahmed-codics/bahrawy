import React from 'react';
import { render, screen } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('renders correctly', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('renders with associated label', () => {
    render(<Input label="Email Address" />);
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
  });

  it('generates a stable ID if none provided', () => {
    render(<Input label="Stable ID Test" />);
    const input = screen.getByLabelText('Stable ID Test');
    expect(input).toHaveAttribute('id');
  });

  it('handles hint and error association', () => {
    render(<Input label="Password" hint="Minimum 8 chars" error="Too short" />);
    const input = screen.getByLabelText('Password');

    // Hint and error text should exist
    expect(screen.getByText('Minimum 8 chars')).toBeInTheDocument();
    expect(screen.getByText('Too short')).toBeInTheDocument();

    // ARIA attributes
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();

    // Verify describedBy IDs point to the hint/error
    const hintEl = screen.getByText('Minimum 8 chars');
    const errEl = screen.getByText('Too short');
    expect(describedBy).toContain(hintEl.id);
    expect(describedBy).toContain(errEl.id);
  });

  it('sets correct input direction based on type', () => {
    const { rerender } = render(<Input label="Dir auto" type="text" data-testid="t1" />);
    // by default dir is undefined unless forced
    expect(screen.getByTestId('t1')).not.toHaveAttribute('dir');

    rerender(<Input label="Dir email" type="email" data-testid="t2" />);
    expect(screen.getByTestId('t2')).toHaveAttribute('dir', 'ltr');

    rerender(<Input label="Dir force rtl" type="text" directionMode="rtl" data-testid="t3" />);
    expect(screen.getByTestId('t3')).toHaveAttribute('dir', 'rtl');
  });

  it('passes ref correctly', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
