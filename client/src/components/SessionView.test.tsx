import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SessionView from './SessionView';

vi.mock('./Terminal', () => ({ default: () => <div data-testid="terminal" /> }));

const session = {
  id: 'deck_1', title: 'Fix the terminal', cli: 'claude', cliLabel: 'Claude Code',
  created: 1, attached: false, state: 'working' as const,
};

describe('SessionView', () => {
  it('renders a terminal without status text or composer', () => {
    render(<SessionView session={session} sidebarOpen onOpenSidebar={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()} onMissing={vi.fn()} />);
    expect(screen.getByTestId('terminal')).toBeInTheDocument();
    expect(screen.getByText('Fix the terminal')).toBeInTheDocument();
    expect(screen.queryByText(/running/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Describe the task/i)).not.toBeInTheDocument();
  });

  it('keeps rename and delete in the overflow menu', () => {
    render(<SessionView session={session} sidebarOpen onOpenSidebar={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()} onMissing={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Session actions' }));
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });
});
