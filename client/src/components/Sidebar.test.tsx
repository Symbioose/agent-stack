import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar';

const sessions = [
  { id: 'new', title: 'Nouvelle', cli: 'devin', cliLabel: 'Devin', created: 2, attached: false, running: true },
  { id: 'old', title: 'Ancienne', cli: 'shell', cliLabel: 'Shell', created: 1, attached: false, running: false },
];

describe('Sidebar', () => {
  it('renders chronological history with dot-only status', () => {
    render(<Sidebar sessions={sessions} activeId={null} onSelect={vi.fn()} onNew={vi.fn()} onClose={vi.fn()} onLogout={vi.fn()} />);
    expect(screen.getAllByTestId('session-row').map((row) => row.textContent)).toEqual([
      expect.stringContaining('Nouvelle'),
      expect.stringContaining('Ancienne'),
    ]);
    expect(screen.getByLabelText('Session active')).toHaveClass('bg-green');
    expect(screen.getByLabelText('Session inactive')).toHaveClass('bg-faint');
    expect(screen.queryByText('En cours')).not.toBeInTheDocument();
  });

  it('opens the selected session', () => {
    const onSelect = vi.fn();
    render(<Sidebar sessions={sessions} activeId={null} onSelect={onSelect} onNew={vi.fn()} onClose={vi.fn()} onLogout={vi.fn()} />);
    fireEvent.click(screen.getByText('Nouvelle'));
    expect(onSelect).toHaveBeenCalledWith('new');
  });
});
