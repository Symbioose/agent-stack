import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { CanvasAddon } from '@xterm/addon-canvas';
import { WebglAddon } from '@xterm/addon-webgl';
import { getToken } from '../api';

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

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(
      `${proto}://${location.host}/ws/${sessionId}?token=${encodeURIComponent(getToken())}`,
    );

    const sendResize = () => {
      fit.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(`\x00resize:${term.cols}x${term.rows}`);
      }
    };

    ws.onopen = () => {
      sendResize();
      term.focus();
    };
    ws.onmessage = (e) => term.write(e.data as string);
    ws.onclose = (event) => {
      if (event.code === 4004) {
        onMissingRef.current?.();
        return;
      }
      if (event.code !== 1000) term.write('\r\n\x1b[90m[terminal connection lost]\x1b[0m\r\n');
    };

    const dispose = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });

    const observer = new ResizeObserver(() => sendResize());
    observer.observe(containerRef.current!);

    return () => {
      observer.disconnect();
      dispose.dispose();
      ws.close();
      term.dispose();
    };
  }, [sessionId]);

  return <div className="terminal-host h-full min-h-0 w-full" ref={containerRef} />;
}
