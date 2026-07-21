import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import GalaxyBackground from './GalaxyBackground';

describe('GalaxyBackground', () => {
  it('keeps a static fallback and skips WebGL for reduced motion', () => {
    render(<GalaxyBackground className="test-layer" />);
    const background = screen.getByTestId('galaxy-background');
    expect(background).toHaveClass('galaxy-background', 'test-layer');
    expect(background).toHaveAttribute('aria-hidden', 'true');
    expect(background.querySelector('canvas')).toBeNull();
  });
});
