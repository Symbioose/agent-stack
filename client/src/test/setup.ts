import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

// jsdom lacks matchMedia; components use it to honor prefers-reduced-motion.
window.matchMedia ??= (query: string) =>
  ({
    matches: true, // treat tests as reduced-motion so effects stay inert
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
