import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SessionView from './SessionView';

vi.mock('./Terminal', () => ({ default: () => <div data-testid="terminal" /> }));

const session = {
  id: 'deck_1', title: 'Fix the terminal', cli: 'claude', cliLabel: 'Claude Code',
  created: 1, lastActivity: 1, attached: false, state: 'working' as const,
};

const renderView = (props: Partial<React.ComponentProps<typeof SessionView>> = {}) => {
  const defaults = {
    session,
    sidebarOpen: true,
    onOpenSidebar: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onMissing: vi.fn(),
  };
  return render(<SessionView {...defaults} {...props} />);
};

describe('SessionView', () => {
  it('renders a terminal without status text or composer', () => {
    renderView();
    expect(screen.getByTestId('terminal')).toBeInTheDocument();
    expect(screen.getByText('Fix the terminal')).toBeInTheDocument();
    expect(screen.queryByText(/running/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Describe the task/i)).not.toBeInTheDocument();
  });

  it('keeps rename and delete in the overflow menu', () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Session actions' }));
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('closes the actions menu on outside click and Escape', () => {
    renderView();
    const actions = screen.getByRole('button', { name: 'Session actions' });
    fireEvent.click(actions);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
    fireEvent.click(actions);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
  });

  it('runs Rename and Delete from the actions menu', () => {
    const onRename = vi.fn();
    const onDelete = vi.fn();
    renderView({ onRename, onDelete });
    fireEvent.click(screen.getByRole('button', { name: 'Session actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByDisplayValue(session.title);
    fireEvent.change(input, { target: { value: 'Renamed session' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('Renamed session');
    fireEvent.click(screen.getByRole('button', { name: 'Session actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
