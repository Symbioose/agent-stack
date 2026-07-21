import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GalaxyBackground from './GalaxyBackground';

afterEach(() => vi.restoreAllMocks());

describe('GalaxyBackground', () => {
  it('keeps a static fallback and skips WebGL for reduced motion', () => {
    render(<GalaxyBackground className="test-layer" />);
    const background = screen.getByTestId('galaxy-background');
    expect(background).toHaveClass('galaxy-background', 'test-layer');
    expect(background).toHaveAttribute('aria-hidden', 'true');
    expect(background.querySelector('canvas')).toBeNull();
  });

  it('falls back silently when WebGL is unavailable', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<GalaxyBackground />);

    expect(screen.getByTestId('galaxy-background').querySelector('canvas')).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
