'use client';

import { useEffect, useState } from 'react';
import { useServer } from '@/hooks/use-server';
import { toast } from 'sonner';
import { Globe, Trash2, RefreshCw, HardDrive } from 'lucide-react';
import type { WorldInfo } from '@mcpanel/shared';

export default function WorldsPage() {
  const { send, on, status } = useServer();
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [seed, setSeed] = useState('');
  const [showRegen, setShowRegen] = useState(false);

  useEffect(() => {
    send({ type: 'world:list', payload: {}, timestamp: Date.now() });
    const unsub = on('world:list:response', (msg) => {
      setWorlds(msg.payload.worlds);
      setLoading(false);
    });
    return unsub;
  }, [send, on]);

  const handleDelete = (name: string) => {
    if (status === 'online') { toast.error('Stop the server first'); return; }
    if (!confirm(`Delete world "${name}"? This cannot be undone!`)) return;
    send({ type: 'world:delete', payload: { worldName: name }, timestamp: Date.now() });
    toast.info(`Deleting ${name}...`);
    setTimeout(() => { send({ type: 'world:list', payload: {}, timestamp: Date.now() }); }, 1000);
  };

  const handleRegenerate = () => {
    if (status === 'online') { toast.error('Stop the server first'); return; }
    if (!confirm('Regenerate the world? Current world will be deleted!')) return;
    send({ type: 'world:regenerate', payload: { seed: seed || undefined }, timestamp: Date.now() });
    toast.info('Regenerating world...');
    setShowRegen(false);
    setSeed('');
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1073741824).toFixed(2)} GB`;
  };

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>World Management</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {worlds.length} world{worlds.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowRegen(!showRegen)}>
          <RefreshCw size={14} /> Regenerate World
        </button>
      </div>

      {/* Regenerate Panel */}
      {showRegen && (
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>Regenerate World</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            This will delete the current world and create a new one on next start.
            {status === 'online' && <span style={{ color: 'var(--danger)' }}> Stop the server first.</span>}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input className="input" placeholder="Seed (optional)" value={seed}
              onChange={(e) => setSeed(e.target.value)} style={{ maxWidth: 300 }} />
            <button className="btn btn-danger" onClick={handleRegenerate} disabled={status === 'online'}>
              Regenerate
            </button>
            <button className="btn btn-ghost" onClick={() => setShowRegen(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : worlds.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Globe size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
          <p>No worlds found</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {worlds.map((world) => (
            <div key={world.name} className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontWeight: 600, fontSize: '1rem' }}>{world.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <HardDrive size={12} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatSize(world.size)}</span>
                  </div>
                  {world.seed && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Seed: {world.seed}
                    </p>
                  )}
                  {world.lastPlayed && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                      Modified: {new Date(world.lastPlayed).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <button className="btn btn-ghost" onClick={() => handleDelete(world.name)}
                  style={{ padding: '0.375rem', color: 'var(--danger)' }} title="Delete world">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
