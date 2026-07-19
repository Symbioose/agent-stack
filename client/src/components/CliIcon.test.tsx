import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CliIcon from './CliIcon';

const BRANDS = {
  claude: 'Claude Code',
  codex: 'Codex',
  gemini: 'Gemini CLI',
  opencode: 'OpenCode',
  devin: 'Devin',
  grok: 'Grok Code',
};

describe('CliIcon', () => {
  for (const [cli, brand] of Object.entries(BRANDS)) {
    it(`renders the accessible official ${brand} icon`, () => {
      const { container } = render(<CliIcon cli={cli} label={brand} />);
      expect(screen.getByRole('img', { name: brand })).toBeInTheDocument();
      expect(container.querySelector('title')).not.toBeNull();
    });
  }

  it('renders an accessible neutral Shell icon', () => {
    const { container } = render(<CliIcon cli="shell" label="Shell" />);
    expect(screen.getByRole('img', { name: 'Shell' })).toBeInTheDocument();
    expect(container.querySelector('.lucide-square-terminal')).toBeInTheDocument();
  });

  it('falls back to Shell for custom CLI IDs', () => {
    const { container } = render(<CliIcon cli="custom" label="Custom CLI" />);
    expect(screen.getByRole('img', { name: 'Custom CLI' })).toBeInTheDocument();
    expect(container.querySelector('.lucide-square-terminal')).toBeInTheDocument();
  });
});
