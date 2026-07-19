import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NewSessionView from './NewSessionView';

const clis = [
  { id: 'claude', label: 'Claude Code', command: 'claude' },
  { id: 'devin', label: 'Devin', command: 'devin' },
  { id: 'grok', label: 'Grok Code', command: 'grok' },
];

describe('NewSessionView', () => {
  it('shows the CLI catalog and submits a task', () => {
    const onSubmit = vi.fn();
    render(<NewSessionView clis={clis} cli="claude" onCliChange={vi.fn()} onSubmit={onSubmit} pending={false} error={null} />);
    fireEvent.click(screen.getByRole('button', { name: /Claude Code/i }));
    expect(screen.getAllByText('Devin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Grok Code').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByPlaceholderText('Décris la tâche à exécuter…'), { target: { value: 'Corriger le terminal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lancer la session' }));
    expect(onSubmit).toHaveBeenCalledWith('Corriger le terminal');
  });

  it('shows launch errors inline', () => {
    render(<NewSessionView clis={clis} cli="grok" onCliChange={vi.fn()} onSubmit={vi.fn()} pending={false} error="La commande « grok » n'est pas installée." />);
    expect(screen.getByRole('alert')).toHaveTextContent('grok');
  });
});
