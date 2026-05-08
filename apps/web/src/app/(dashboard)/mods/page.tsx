'use client';

import { useEffect, useState, useRef } from 'react';
import { useServer } from '@/hooks/use-server';
import { toast } from 'sonner';
import { Puzzle, Upload, Trash2, ToggleLeft, ToggleRight, AlertTriangle, Monitor, Search } from 'lucide-react';
import type { ModInfo } from '@mcpanel/shared';

export default function ModsPage() {
  const { send, on } = useServer();
  const [mods, setMods] = useState<ModInfo[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    send({ type: 'mods:list', payload: {}, timestamp: Date.now() });
    const unsub = on('mods:list:response', (msg) => {
      setMods(msg.payload.mods);
      setLoading(false);
    });
    return unsub;
  }, [send, on]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.jar')) { toast.error('Only .jar files allowed'); return; }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      send({ type: 'mods:upload', payload: { filename: file.name, data: base64 }, timestamp: Date.now() });
      toast.info(`Uploading ${file.name}...`);
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = (filename: string) => {
    if (!confirm(`Delete ${filename}?`)) return;
    send({ type: 'mods:delete', payload: { filename }, timestamp: Date.now() });
    toast.info(`Deleting ${filename}...`);
  };

  const handleToggle = (filename: string, enabled: boolean) => {
    send({ type: 'mods:toggle', payload: { filename, enabled: !enabled }, timestamp: Date.now() });
  };

  const filtered = mods.filter((m) =>
    m.displayName.toLowerCase().includes(search.toLowerCase()) ||
    m.modId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Mod Manager</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{mods.length} mods installed</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="input" placeholder="Search mods..." value={search}
              onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: '2rem', width: 220 }} />
          </div>
          <input ref={fileInputRef} type="file" accept=".jar" onChange={handleUpload} style={{ display: 'none' }} />
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={14} /> Upload Mod
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Puzzle size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
          <p>No mods found</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filtered.map((mod) => (
            <div key={mod.fileName} className="card" style={{
              padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem',
              opacity: mod.enabled ? 1 : 0.5,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{mod.displayName}</span>
                  <span className="badge badge-info">{mod.version}</span>
                  {mod.clientOnly && <span className="badge badge-warning"><Monitor size={10} /> Client-only</span>}
                  {mod.incompatible && <span className="badge badge-danger"><AlertTriangle size={10} /> Incompatible</span>}
                  {!mod.enabled && <span className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>Disabled</span>}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {mod.modId} • {(mod.fileSize / 1024 / 1024).toFixed(1)} MB {mod.authors && `• ${mod.authors}`}
                </p>
              </div>
              <button className="btn btn-ghost" onClick={() => handleToggle(mod.fileName, mod.enabled)}
                style={{ padding: '0.375rem' }} title={mod.enabled ? 'Disable' : 'Enable'}>
                {mod.enabled ? <ToggleRight size={20} color="var(--success)" /> : <ToggleLeft size={20} />}
              </button>
              <button className="btn btn-ghost" onClick={() => handleDelete(mod.fileName)}
                style={{ padding: '0.375rem', color: 'var(--danger)' }} title="Delete">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
