# Agent Deck terminal isolation and UI redesign

Date: 2026-07-19
Status: Approved design

## Goal

Make Agent Deck reliable for real CLI sessions and redesign it as a polished, minimal interface where the terminal remains the primary surface.

The current functional failure comes from Agent Deck sharing the user's default tmux server. The user's tmux hooks, including `ensure-sidebar.sh`, run inside Agent Deck sessions and inject a session sidebar into the web terminal. Agent Deck must use an isolated tmux server that never reads the user's tmux configuration.

## Product principles

- The terminal is the product once a session is open.
- Visual treatment is minimal and premium, with subtle depth rather than heavy glass effects.
- Session state appears only in the chronological history.
- Creating a session and interacting with an existing session are distinct modes.
- Unavailable CLIs remain discoverable and fail clearly when launched.

## Terminal architecture

All tmux operations use one dedicated server socket and an empty configuration:

```text
tmux -L agent-deck -f /dev/null <command>
```

This applies to listing, creating, checking, attaching, resizing, capturing, sending input, and deleting sessions. The web server must not inherit behavior from the user's default tmux server.

A browser terminal connection attaches through `node-pty` to the same dedicated socket. Closing a browser or WebSocket terminates only the PTY attachment, not the tmux session. Reopening a session restores scrollback and then attaches to live output.

## CLI catalog

The built-in catalog includes:

- Claude Code (`claude`)
- Codex (`codex`)
- Gemini CLI (`gemini`)
- OpenCode (`opencode`)
- Devin (`devin`)
- Grok Code (`grok` by default, configurable)
- Shell (the user's login shell)

The custom `~/.agent-deck/clis.json` catalog remains supported.

Every catalog entry is visible in the new-session picker. Availability is not used to hide or disable entries. On launch, the server verifies that a non-shell executable exists. If it does not, the request fails before creating tmux metadata or a tmux session. The creation screen displays a concise error that identifies the missing command and allows the user to retry.

## Session state

The sidebar is a single reverse-chronological history without date groups or separate active sections.

Each row contains:

- official CLI logo;
- session title;
- CLI name and relative creation time;
- one status dot.

There are two visual states:

- green: the agent process is active;
- gray: the process is waiting, idle, or no longer active.

No status badge or status text appears in the session header.

## Brand and CLI logos

Agent Deck uses a new compact, monochrome product mark. It should feel like a polished AI product mark without copying Devin's logo. The mark appears next to the Agent Deck wordmark and in PWA assets.

CLI entries use locally bundled official brand assets where official assets are available. Shell uses a neutral terminal icon. The implementation must not rely on runtime network requests for logos. Assets must remain legible at 16–28 px and have accessible labels.

## New-session screen

The composer exists only on the new-session screen.

The screen contains:

- a concise heading and one explanatory line;
- a large but restrained task input;
- a CLI picker with the complete catalog and official logos;
- a submit action;
- an inline launch error region.

Submitting creates the session and immediately navigates to its terminal. Empty prompts are rejected client-side. The title is initially derived from the prompt and can be renamed from session actions.

## Session screen

The session screen contains:

- a compact top bar with the CLI logo, session title, and an overflow actions button;
- a near-full-screen terminal surface;
- no composer, command bubble, or duplicate input outside the terminal;
- no textual status pill.

All interaction is sent directly through xterm. Terminal margins and border radius are modest on desktop and reduced further on mobile. Resize events update the PTY dimensions.

Session actions include rename and delete. Delete remains destructive and requires confirmation.

## Visual system

- Nearly black, slightly warm background.
- Tonal surfaces and subtle borders.
- One restrained cool accent for focus and primary actions.
- Green reserved for active session dots.
- Gray reserved for idle session dots.
- Subtle shadows and ambient depth only where they communicate layering.
- Fast CSS transitions; no animation library is required.
- Chronological sidebar width near 250 px on desktop.

On mobile, the sidebar becomes a dismissible overlay. The terminal occupies the remaining viewport, accounts for safe areas, and does not include a bottom composer.

## Data flow

1. The client authenticates and opens the session-events WebSocket.
2. The server pushes a complete ordered session snapshot immediately and when data or process state changes.
3. The user selects a CLI and submits a prompt from the new-session screen.
4. The server validates the CLI executable, creates an isolated tmux session, persists metadata, and sends the first prompt.
5. The client navigates to the returned session ID and opens the terminal WebSocket.
6. The server sends captured scrollback and attaches a live PTY to the isolated tmux server.
7. xterm input and resize messages pass directly to the PTY.

## Error handling

- Missing CLI: return a structured client error; create no session.
- Missing tmux: return a deployment error with the required executable name.
- PTY attach failure: keep the web server alive, close only that connection, and show a concise terminal error.
- Missing session: close the terminal connection with a not-found code and return the client to the new-session screen.
- Event WebSocket disconnect: reconnect with bounded delay and preserve the last snapshot while reconnecting.
- Authentication failure: clear the invalid token and return to login.

## Verification

Automated and manual verification must cover:

1. Build and TypeScript checks for client and server.
2. Isolated tmux server creation using the `agent-deck` socket.
3. Confirmation that the user's default tmux hooks and sidebar are absent.
4. Shell session creation, prompt execution, live PTY input, resize, and scrollback restoration.
5. Browser disconnect/reconnect without stopping the tmux process.
6. Claude Code, Codex, Gemini, and Devin launch checks when installed.
7. Clear launch error and no orphan metadata for missing OpenCode and Grok commands.
8. Real-time chronological history updates and green/gray status changes.
9. Rename and confirmed deletion.
10. Desktop and mobile layouts, including sidebar overlay and full-height terminal.
11. New-session composer absence from every existing-session view.

## Out of scope

- Converting CLI output into a structured chat transcript.
- File browser, git diff viewer, or agent metadata side panel.
- Multiple VMs or remote host management.
- Installing third-party CLIs from the Agent Deck interface.
- More than two visual session states.
