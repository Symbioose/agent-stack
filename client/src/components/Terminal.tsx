import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { CanvasAddon } from '@xterm/addon-canvas';
import { WebglAddon } from '@xterm/addon-webgl';
import { wsProtocols } from '../api';

// GPU-accelerated rendering keeps large bursts of agent output smooth. Try
// WebGL first, fall back to the canvas renderer, and silently keep the
// built-in DOM renderer if neither is available (old GPUs, some browsers).
function loadFastRenderer(term: Terminal): void {
  try {
    const webgl = new WebglAddon();
    webgl.onContextLoss(() => webgl.dispose());
    term.loadAddon(webgl);
    return;
  } catch {
    // Fall through to the canvas renderer.
  }
  try {
    term.loadAddon(new CanvasAddon());
  } catch {
    // Keep the default DOM renderer.
  }
}

interface Props {
  sessionId: string;
  onMissing?: () => void;
}

export default function TerminalView({ sessionId, onMissing }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onMissingRef = useRef(onMissing);
  onMissingRef.current = onMissing;

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13.5,
      fontFamily: '"JetBrains Mono", "Fira Code", Menlo, monospace',
      theme: {
        background: '#090b0d',
        foreground: '#e7e9ec',
        cursor: '#97a8ff',
        selectionBackground: '#2d385f',
        black: '#111317',
        brightBlack: '#59616c',
      },
      scrollback: 20000,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current!);
    loadFastRenderer(term);
    fit.fit();

    // Mobile browsers kill sockets whenever the phone locks or the app goes
    // to the background, so the connection must heal itself: exponential
    // backoff in the background, immediate retry when the tab is visible again.
    let ws: WebSocket | null = null;
    let disposed = false;
    let everConnected = false;
    let announcedLoss = false;
    let retryDelay = 1000;
    let retryTimer: number | undefined;

    const sendResize = () => {
      fit.fit();
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(`\x00resize:${term.cols}x${term.rows}`);
      }
    };

    const connect = () => {
      if (disposed) return;
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws/${sessionId}`, wsProtocols());
      ws.onopen = () => {
        // The server replays the scrollback on every attach; start clean so
        // history is not duplicated after a reconnect.
        if (everConnected) term.reset();
        everConnected = true;
        announcedLoss = false;
        retryDelay = 1000;
        sendResize();
        term.focus();
      };
      ws.onmessage = (e) => term.write(e.data as string);
      ws.onclose = (event) => {
        if (disposed) return;
        if (event.code === 4004) {
          onMissingRef.current?.();
          return;
        }
        if (event.code === 1000) return; // the pty ended cleanly
        if (everConnected && !announcedLoss) {
          announcedLoss = true;
          term.write('\r\n\x1b[90m[connection lost — reconnecting…]\x1b[0m\r\n');
        }
        retryTimer = window.setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 15000);
      };
    };
    connect();

    const onVisible = () => {
      if (document.hidden || disposed) return;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
      window.clearTimeout(retryTimer);
      retryDelay = 1000;
      connect();
    };
    document.addEventListener('visibilitychange', onVisible);

    const dispose = term.onData((data) => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(data);
    });

    const observer = new ResizeObserver(() => sendResize());
    observer.observe(containerRef.current!);

    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      document.removeEventListener('visibilitychange', onVisible);
      observer.disconnect();
      dispose.dispose();
      ws?.close();
      term.dispose();
    };
  }, [sessionId]);

  return <div className="terminal-host h-full min-h-0 w-full" ref={containerRef} />;
}
