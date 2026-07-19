import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { getToken } from '../api';

interface Props {
  sessionId: string;
  onClosed?: () => void;
}

export default function TerminalView({ sessionId, onClosed }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13.5,
      fontFamily: '"JetBrains Mono", "Fira Code", Menlo, monospace',
      theme: {
        background: '#0b0c0e',
        foreground: '#e6e9ee',
        cursor: '#7aa2f7',
        selectionBackground: '#33467c',
        black: '#15161a',
        brightBlack: '#5c616d',
      },
      scrollback: 20000,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current!);
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
    ws.onclose = () => {
      term.write('\r\n\x1b[90m[session terminée]\x1b[0m\r\n');
      onClosedRef.current?.();
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
