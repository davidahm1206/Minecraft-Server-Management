'use client';

import { useEffect, useState, useRef } from 'react';
import { useServer } from '@/hooks/use-server';
import { toast } from 'sonner';
import {
  Puzzle, Upload, Trash2, ToggleLeft, ToggleRight,
  AlertTriangle, Monitor, Server, Layers, Search, RefreshCw,
} from 'lucide-react';
import type { ModInfo } from '@mcpanel/shared';

// ─── Environment Badge ───
function EnvBadge({ env }: { env: ModInfo['environment'] }) {
  if (env === 'client') {
    return (
      <span className="badge badge-warning" style={{ gap: '0.25rem', display: 'inline-flex', alignItems: 'center' }}>
        <Monitor size={10} /> Client-only
      </span>
    );
  }
  if (env === 'server') {
    return (
      <span className="badge badge-info" style={{ gap: '0.25rem', display: 'inline-flex', alignItems: 'center' }}>
        <Server size={10} /> Server-side
      </span>
    );
  }
  return null; // 'both' is the normal case — no badge needed
}

export default function ModsPage() {
  const { send, on } = useServer();
  const [mods, setMods] = useState<ModInfo[]>([]);
  const [search, setSearch] = useState('');
  const [envFilter, setEnvFilter] = useState<'all' | 'server' | 'client' | 'both'>('all');
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    setLoading(true);
    send({ type: 'mods:list', payload: {}, timestamp: Date.now() });
  };

  useEffect(() => {
    refresh();
    const unsub = on('mods:list:response', (msg) => {
      setMods((msg.payload as any).mods);
      setLoading(false);
    });
    return unsub;
  }, [send, on]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.jar')) { toast.error('Only .jar files allowed'); return; }
    // Reset input so same file can be re-uploaded
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      send({ type: 'mods:upload', payload: { filename: file.name, data: base64 }, timestamp: Date.now() });
      toast.info(`Uploading ${file.name}...`);
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = (filename: string) => {
    if (!confirm(`Delete ${filename}? This cannot be undone.`)) return;
    send({ type: 'mods:delete', payload: { filename }, timestamp: Date.now() });
    toast.info(`Deleting ${filename}...`);
    setTimeout(refresh, 600);
  };

  const handleToggle = (filename: string, enabled: boolean) => {
    send({ type: 'mods:toggle', payload: { filename, enabled: !enabled }, timestamp: Date.now() });
    setTimeout(refresh, 400);
  };

  const filtered = mods.filter((m) => {
    const matchesSearch =
      m.displayName.toLowerCase().includes(search.toLowerCase()) ||
      m.modId.toLowerCase().includes(search.toLowerCase()) ||
      (m.authors || '').toLowerCase().includes(search.toLowerCase());
    const matchesEnv = envFilter === 'all' || m.environment === envFilter;
    return matchesSearch && matchesEnv;
  });

  // Stats
  const clientCount = mods.filter((m) => m.environment === 'client').length;
  const serverCount = mods.filter((m) => m.environment === 'server').length;
  const incompatibleCount = mods.filter((m) => m.incompatible).length;

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Mod Manager</h1>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.375rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {mods.length} mods
            </span>
            {clientCount > 0 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>
                {clientCount} client-only
              </span>
            )}
            {incompatibleCount > 0 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>
                {incompatibleCount} incompatible
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Env filter */}
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {(['all', 'both', 'server', 'client'] as const).map((f) => (
              <button key={f} className={`btn ${envFilter === f ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setEnvFilter(f)}
                style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem', textTransform: 'capitalize' }}>
                {f}
              </button>
            ))}
          </div>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="input" placeholder="Search mods..." value={search}
              onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: '2rem', width: 200 }} />
          </div>
          <button className="btn btn-ghost" onClick={refresh} title="Refresh mod list" style={{ padding: '0.5rem' }}>
            <RefreshCw size={14} />
          </button>
          <input ref={fileInputRef} type="file" accept=".jar" onChange={handleUpload} style={{ display: 'none' }} />
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={14} /> Upload Mod
          </button>
        </div>
      </div>

      {/* Mod List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Puzzle size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
          <p>{mods.length === 0 ? 'No Fabric mods installed' : 'No mods match your filter'}</p>
          {mods.length === 0 && (
            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
              Upload a Fabric mod JAR to get started
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filtered.map((mod) => (
            <div key={mod.fileName} className="card" style={{
              padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem',
              opacity: mod.enabled ? 1 : 0.55,
              borderLeft: mod.incompatible ? '3px solid var(--danger)' :
                          mod.environment === 'client' ? '3px solid var(--warning)' : undefined,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Name + badges row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{mod.displayName}</span>
                  <span className="badge badge-info">{mod.version}</span>
                  <EnvBadge env={mod.environment} />
                  {mod.incompatible && (
                    <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <AlertTriangle size={10} /> Incompatible
                    </span>
                  )}
                  {!mod.enabled && (
                    <span className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                      Disabled
                    </span>
                  )}
                </div>
                {/* Meta row */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    ID: {mod.modId}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {(mod.fileSize / 1024 / 1024).toFixed(1)} MB
                  </span>
                  {mod.mcVersion && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      MC: {mod.mcVersion}
                    </span>
                  )}
                  {mod.fabricVersion && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Fabric Loader: {mod.fabricVersion}
                    </span>
                  )}
                  {mod.authors && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      by {mod.authors}
                    </span>
                  )}
                </div>
                {/* Incompatibility reason */}
                {mod.incompatibleReason && (
                  <p style={{ fontSize: '0.72rem', color: 'var(--danger)', marginTop: '0.2rem' }}>
                    ⚠ {mod.incompatibleReason}
                  </p>
                )}
              </div>

              {/* Actions */}
              <button className="btn btn-ghost" onClick={() => handleToggle(mod.fileName, mod.enabled)}
                style={{ padding: '0.375rem' }} title={mod.enabled ? 'Disable mod' : 'Enable mod'}>
                {mod.enabled ? <ToggleRight size={20} color="var(--success)" /> : <ToggleLeft size={20} />}
              </button>
              <button className="btn btn-ghost" onClick={() => handleDelete(mod.fileName)}
                style={{ padding: '0.375rem', color: 'var(--danger)' }} title="Delete mod">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
