import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NewSessionView from './NewSessionView';

const clis = [
  { id: 'claude', label: 'Claude Code', command: 'claude' },
  { id: 'devin', label: 'Devin', command: 'devin' },
  { id: 'grok', label: 'Grok Code', command: 'grok' },
];

const baseProps = {
  clis,
  onCliChange: vi.fn(),
  cwd: '~',
  onCwdChange: vi.fn(),
  pending: false,
  error: null,
};

describe('NewSessionView', () => {
  it('shows the CLI catalog and submits a task', () => {
    const onSubmit = vi.fn();
    render(<NewSessionView {...baseProps} cli="claude" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /Claude Code/i }));
    expect(screen.getAllByText('Devin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Grok Code').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByPlaceholderText('Describe the task to run…'), { target: { value: 'Fix the terminal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    expect(onSubmit).toHaveBeenCalledWith('Fix the terminal');
  });

  it('shows launch errors inline', () => {
    render(<NewSessionView {...baseProps} cli="grok" onSubmit={vi.fn()} error='"grok" is not installed on this machine.' />);
    expect(screen.getByRole('alert')).toHaveTextContent('grok');
  });

  it('shows the working folder chip', () => {
    render(<NewSessionView {...baseProps} cli="claude" onSubmit={vi.fn()} cwd="~/Developer" />);
    expect(screen.getByTitle('Working folder')).toHaveTextContent('~/Developer');
  });
});
