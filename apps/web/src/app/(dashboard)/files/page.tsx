'use client';

import { useEffect, useState } from 'react';
import { useServer } from '@/hooks/use-server';
import { toast } from 'sonner';
import {
  Folder, FileText, ChevronRight, ArrowLeft, Save,
  Trash2, Upload, Download, Home,
} from 'lucide-react';
import type { FileEntry } from '@mcpanel/shared';

export default function FilesPage() {
  const { send, on } = useServer();
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('.');
  const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const navigate = (dirPath: string) => {
    setLoading(true);
    setEditingFile(null);
    setCurrentPath(dirPath);
    send({ type: 'files:list', payload: { path: dirPath }, timestamp: Date.now() });
  };

  useEffect(() => {
    navigate('.');
    const unsubs = [
      on('files:list:response', (msg) => { setEntries(msg.payload.entries); setLoading(false); }),
      on('files:read:response', (msg) => { setEditingFile({ path: msg.payload.path, content: msg.payload.content }); }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [on]);

  const handleOpen = (entry: FileEntry) => {
    if (entry.isDirectory) {
      navigate(entry.path);
    } else {
      send({ type: 'files:read', payload: { path: entry.path }, timestamp: Date.now() });
    }
  };

  const handleSave = () => {
    if (!editingFile) return;
    send({ type: 'files:write', payload: { path: editingFile.path, content: editingFile.content }, timestamp: Date.now() });
    toast.success('File saved');
  };

  const handleDelete = (entry: FileEntry) => {
    if (!confirm(`Delete ${entry.name}?`)) return;
    send({ type: 'files:delete', payload: { path: entry.path }, timestamp: Date.now() });
    toast.info(`Deleting ${entry.name}...`);
    setTimeout(() => navigate(currentPath), 500);
  };

  const goUp = () => {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    navigate(parts.length ? parts.join('/') : '.');
  };

  const breadcrumbs = currentPath === '.' ? ['root'] : ['root', ...currentPath.split('/').filter(Boolean)];

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  if (editingFile) {
    return (
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4rem)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button className="btn btn-ghost" onClick={() => setEditingFile(null)} style={{ padding: '0.375rem' }}>
              <ArrowLeft size={16} />
            </button>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{editingFile.path}</h2>
          </div>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={14} /> Save
          </button>
        </div>
        <textarea
          className="input"
          value={editingFile.content}
          onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
          style={{
            flex: 1, fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8rem',
            lineHeight: 1.6, resize: 'none', borderRadius: 'var(--radius)',
          }}
        />
      </div>
    );
  }

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>File Manager</h1>
      </div>

      {/* Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
        <button onClick={() => navigate('.')} className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
          <Home size={12} /> root
        </button>
        {breadcrumbs.slice(1).map((crumb, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}>
            <ChevronRight size={12} />
            <span style={{ color: 'var(--text-secondary)' }}>{crumb}</span>
          </span>
        ))}
      </div>

      {currentPath !== '.' && (
        <button className="btn btn-ghost" onClick={goUp} style={{ marginBottom: '0.75rem', fontSize: '0.8rem' }}>
          <ArrowLeft size={14} /> Back
        </button>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {entries.map((entry) => (
            <div key={entry.path} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.625rem 1rem', cursor: 'pointer',
              borderBottom: '1px solid var(--border)',
              transition: 'background 0.1s',
            }}
              onClick={() => handleOpen(entry)}
              onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {entry.isDirectory ? <Folder size={16} color="var(--accent)" /> : <FileText size={16} color="var(--text-muted)" />}
              <span style={{ flex: 1, fontSize: '0.85rem' }}>{entry.name}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatSize(entry.size)}</span>
              <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); handleDelete(entry); }}
                style={{ padding: '0.25rem', color: 'var(--danger)', opacity: 0.5 }} title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {entries.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Empty directory</div>
          )}
        </div>
      )}
    </div>
  );
}
