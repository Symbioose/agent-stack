import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar';

const sessions = [
  { id: 'new', title: 'Newest', cli: 'devin', cliLabel: 'Devin', created: 3, lastActivity: 30, attached: false, state: 'working' as const },
  { id: 'mid', title: 'Middle', cli: 'claude', cliLabel: 'Claude Code', created: 2, lastActivity: 20, attached: false, state: 'waiting' as const },
  { id: 'old', title: 'Oldest', cli: 'shell', cliLabel: 'Shell', created: 1, lastActivity: 10, attached: false, state: 'idle' as const },
];

const baseProps = { activeId: null, onSelect: vi.fn(), onNew: vi.fn(), onDelete: vi.fn(), onRename: vi.fn(), onClose: vi.fn(), onLogout: vi.fn() };

describe('Sidebar', () => {
  it('renders chronological history with three status dots', () => {
    render(<Sidebar {...baseProps} sessions={sessions} />);
    expect(screen.getAllByTestId('session-row').map((row) => row.textContent)).toEqual([
      expect.stringContaining('Newest'),
      expect.stringContaining('Middle'),
      expect.stringContaining('Oldest'),
    ]);
    expect(screen.getByLabelText('Working session')).toHaveClass('bg-amber');
    expect(screen.getByLabelText('Done — waiting for you session')).toHaveClass('bg-green');
    expect(screen.getByLabelText('Paused session')).toHaveClass('bg-faint');
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

  it('renames a session from its row without opening it', () => {
    const onRename = vi.fn();
    const onSelect = vi.fn();
    render(<Sidebar {...baseProps} sessions={sessions} onRename={onRename} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename session Middle' }));
    const input = screen.getByDisplayValue('Middle');
    fireEvent.change(input, { target: { value: 'Renamed conversation' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('mid', 'Renamed conversation');
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue('Renamed conversation')).not.toBeInTheDocument();
  });

  it('cancels a rename on Escape without calling onRename', () => {
    const onRename = vi.fn();
    render(<Sidebar {...baseProps} sessions={sessions} onRename={onRename} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename session Middle' }));
    const input = screen.getByDisplayValue('Middle');
    fireEvent.change(input, { target: { value: 'Discarded' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText('Middle')).toBeInTheDocument();
  });
});
