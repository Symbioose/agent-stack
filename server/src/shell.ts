import os from 'node:os';

// Resolve the user's real login shell instead of trusting $SHELL alone. A
// systemd-managed process has no $SHELL, so anything that silently defaulted
// to /bin/sh or tmux's own compiled-in default would miss PATH entries set
// up in the user's actual shell dotfiles (custom CLI installs, for example).
export function loginShell(): string {
  try {
    return process.env.SHELL || os.userInfo().shell || '/bin/sh';
  } catch {
    return process.env.SHELL || '/bin/sh';
  }
}
