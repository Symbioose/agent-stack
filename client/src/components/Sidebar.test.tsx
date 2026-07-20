import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar';

const sessions = [
  { id: 'new', title: 'Newest', cli: 'devin', cliLabel: 'Devin', created: 2, attached: false, running: true },
  { id: 'old', title: 'Oldest', cli: 'shell', cliLabel: 'Shell', created: 1, attached: false, running: false },
];

describe('Sidebar', () => {
  it('renders chronological history with dot-only status', () => {
    render(<Sidebar sessions={sessions} activeId={null} onSelect={vi.fn()} onNew={vi.fn()} onClose={vi.fn()} onLogout={vi.fn()} />);
    expect(screen.getAllByTestId('session-row').map((row) => row.textContent)).toEqual([
      expect.stringContaining('Newest'),
      expect.stringContaining('Oldest'),
    ]);
    expect(screen.getByLabelText('Active session')).toHaveClass('bg-green');
    expect(screen.getByLabelText('Idle session')).toHaveClass('bg-faint');
    expect(screen.queryByText(/running/i)).not.toBeInTheDocument();
  });

  it('opens the selected session', () => {
    const onSelect = vi.fn();
    render(<Sidebar sessions={sessions} activeId={null} onSelect={onSelect} onNew={vi.fn()} onClose={vi.fn()} onLogout={vi.fn()} />);
    fireEvent.click(screen.getByText('Newest'));
    expect(onSelect).toHaveBeenCalledWith('new');
  });
});
