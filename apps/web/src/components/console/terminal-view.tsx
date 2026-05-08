'use client';

import { useEffect, useRef } from 'react';
import type { ServerLogPayload } from '@mcpanel/shared';

interface TerminalViewProps {
  logs: ServerLogPayload[];
  autoScroll: boolean;
}

const LEVEL_COLORS: Record<string, string> = {
  ERROR: '#ef4444',
  WARN: '#f59e0b',
  INFO: '#8888a8',
  DEBUG: '#6366f1',
  UNKNOWN: '#5a5a78',
};

export default function TerminalView({ logs, autoScroll }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '1rem',
        fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
        fontSize: '0.8rem',
        lineHeight: 1.6,
        background: '#0d0d14',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      {logs.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '2rem' }}>
          No log entries yet. Start the server to see output.
        </div>
      ) : (
        logs.map((log, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
              {log.timestamp}
            </span>
            <span style={{ color: LEVEL_COLORS[log.level] || LEVEL_COLORS.UNKNOWN, flexShrink: 0, minWidth: 40 }}>
              [{log.level}]
            </span>
            <span style={{
              color: log.level === 'ERROR' ? '#ef4444' : log.level === 'WARN' ? '#f59e0b' : 'var(--text-primary)',
            }}>
              {log.line}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
