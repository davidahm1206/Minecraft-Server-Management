'use client';

import dynamic from 'next/dynamic';
import { useServer } from '@/hooks/use-server';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Search, ArrowDown, ArrowUp, Filter,
  Send, Trash2,
} from 'lucide-react';

const TerminalView = dynamic(() => import('@/components/console/terminal-view'), { ssr: false });

export default function ConsolePage() {
  const { logs, send } = useServer();
  const [command, setCommand] = useState('');
  const [filter, setFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredLogs = logs.filter((log) => {
    if (filter !== 'ALL' && log.level !== filter) return false;
    if (search && !log.line.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleSendCommand = () => {
    if (!command.trim()) return;
    send({ type: 'server:command', payload: { command: command.trim() }, timestamp: Date.now() });
    setCommandHistory((prev) => [command, ...prev].slice(0, 50));
    setCommand('');
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSendCommand();
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIdx = historyIndex + 1;
        setHistoryIndex(newIdx);
        setCommand(commandHistory[newIdx]);
      }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIdx = historyIndex - 1;
        setHistoryIndex(newIdx);
        setCommand(commandHistory[newIdx]);
      } else {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4rem)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Console</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Filter */}
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {['ALL', 'INFO', 'WARN', 'ERROR'].map((level) => (
              <button key={level} className={`btn ${filter === level ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilter(level)}
                style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}>
                {level}
              </button>
            ))}
          </div>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="input" placeholder="Search logs..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2rem', width: 200, fontSize: '0.8rem' }} />
          </div>
          {/* Auto-scroll */}
          <button className={`btn ${autoScroll ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setAutoScroll(!autoScroll)}
            style={{ padding: '0.375rem 0.625rem', fontSize: '0.75rem' }}>
            {autoScroll ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <TerminalView logs={filteredLogs} autoScroll={autoScroll} />
      </div>

      {/* Command Input */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', fontSize: '0.875rem', fontWeight: 600 }}>/</span>
          <input
            ref={inputRef}
            className="input"
            placeholder="Enter command..."
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ paddingLeft: '1.75rem', fontFamily: 'monospace' }}
          />
        </div>
        <button className="btn btn-primary" onClick={handleSendCommand} disabled={!command.trim()}>
          <Send size={14} /> Send
        </button>
      </div>
    </div>
  );
}
