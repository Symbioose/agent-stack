import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SessionView from './SessionView';

vi.mock('./Terminal', () => ({ default: () => <div data-testid="terminal" /> }));

const session = {
  id: 'deck_1', title: 'Corriger le terminal', cli: 'claude', cliLabel: 'Claude Code',
  created: 1, attached: false, running: true,
};

describe('SessionView', () => {
  it('renders a terminal without status text or composer', () => {
    render(<SessionView session={session} sidebarOpen onOpenSidebar={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()} onMissing={vi.fn()} />);
    expect(screen.getByTestId('terminal')).toBeInTheDocument();
    expect(screen.getByText('Corriger le terminal')).toBeInTheDocument();
    expect(screen.queryByText('En cours')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Envoyer une commande/i)).not.toBeInTheDocument();
  });

  it('keeps rename and delete in the overflow menu', () => {
    render(<SessionView session={session} sidebarOpen onOpenSidebar={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()} onMissing={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Actions de la session' }));
    expect(screen.getByRole('button', { name: 'Renommer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeInTheDocument();
  });
});
