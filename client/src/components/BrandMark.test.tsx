import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BrandMark from './BrandMark';

describe('BrandMark', () => {
  it('renders an accessible monochrome mark at the requested size', () => {
    render(<BrandMark size={32} />);
    const mark = screen.getByRole('img', { name: 'Agent Deck' });
    expect(mark).toHaveStyle({ width: '32px', height: '32px' });
    expect(mark.querySelector('svg')).toHaveAttribute('stroke', 'currentColor');
  });
});
