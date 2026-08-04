import React from 'react';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardContent } from './Card';

describe('Card', () => {
  it('renders components with semantic flexibility', () => {
    render(
      <Card as="article" data-testid="card">
        <CardHeader>
          <CardTitle as="h2">My Title</CardTitle>
        </CardHeader>
        <CardContent>Content</CardContent>
      </Card>,
    );

    const card = screen.getByTestId('card');
    expect(card.tagName).toBe('ARTICLE');
    expect(screen.getByRole('heading', { level: 2, name: 'My Title' })).toBeInTheDocument();
  });

  it('merges public classes', () => {
    render(<Card className="custom-class" data-testid="card" />);
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('custom-class');
    expect(card).toHaveClass('rounded-[var(--radius-card)]');
  });

  it('passes refs correctly', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Card ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
