import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar';

const sessions = [
  { id: 'new', title: 'Newest', cli: 'devin', cliLabel: 'Devin', created: 3, attached: false, state: 'working' as const },
  { id: 'mid', title: 'Middle', cli: 'claude', cliLabel: 'Claude Code', created: 2, attached: false, state: 'waiting' as const },
  { id: 'old', title: 'Oldest', cli: 'shell', cliLabel: 'Shell', created: 1, attached: false, state: 'idle' as const },
];

const baseProps = { activeId: null, onSelect: vi.fn(), onNew: vi.fn(), onDelete: vi.fn(), onClose: vi.fn(), onLogout: vi.fn() };

describe('Sidebar', () => {
  it('renders chronological history with three status dots', () => {
    render(<Sidebar {...baseProps} sessions={sessions} />);
    expect(screen.getAllByTestId('session-row').map((row) => row.textContent)).toEqual([
      expect.stringContaining('Newest'),
      expect.stringContaining('Middle'),
      expect.stringContaining('Oldest'),
    ]);
    expect(screen.getByLabelText('Working session')).toHaveClass('bg-green');
    expect(screen.getByLabelText('Waiting for you session')).toHaveClass('bg-amber');
    expect(screen.getByLabelText('Idle session')).toHaveClass('bg-faint');
  });

  it('opens the selected session', () => {
    const onSelect = vi.fn();
    render(<Sidebar {...baseProps} sessions={sessions} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Newest'));
    expect(onSelect).toHaveBeenCalledWith('new');
  });

  it('closes a session from its row', () => {
    const onDelete = vi.fn();
    const onSelect = vi.fn();
    render(<Sidebar {...baseProps} sessions={sessions} onDelete={onDelete} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close session Oldest' }));
    expect(onDelete).toHaveBeenCalledWith('old');
    expect(onSelect).not.toHaveBeenCalled();
  });
});
