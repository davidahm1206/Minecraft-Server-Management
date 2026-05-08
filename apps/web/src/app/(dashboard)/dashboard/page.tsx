'use client';

import { useServer } from '@/hooks/use-server';
import { toast } from 'sonner';
import {
  Cpu, MemoryStick, Activity, Users, Clock, Wifi, WifiOff,
  Play, Square, RotateCcw, Skull, Gauge,
} from 'lucide-react';

function formatUptime(seconds: number): string {
  if (seconds === 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatRam(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string; icon: any; accent: string;
}) {
  return (
    <div className={`card stat-card-${accent}`} style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            {label}
          </p>
          <p style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.25rem', lineHeight: 1.2 }}>
            {value}
          </p>
          {sub && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{sub}</p>}
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: 'var(--radius-sm)',
          background: `var(--${accent === 'purple' ? 'accent' : accent}-muted, var(--accent-muted))`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} style={{ color: `var(--${accent === 'purple' ? 'accent' : accent}, var(--accent))` }} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { status, metrics, agentConnected, send } = useServer();

  const handleStart = () => {
    send({ type: 'server:start', payload: {}, timestamp: Date.now() });
    toast.info('Starting server...');
  };
  const handleStop = () => {
    send({ type: 'server:stop', payload: { graceful: true }, timestamp: Date.now() });
    toast.info('Stopping server...');
  };
  const handleRestart = () => {
    send({ type: 'server:restart', payload: {}, timestamp: Date.now() });
    toast.info('Restarting server...');
  };
  const handleKill = () => {
    send({ type: 'server:stop', payload: { graceful: false }, timestamp: Date.now() });
    toast.warning('Force killing server...');
  };

  const isOnline = status === 'online';
  const isTransition = status === 'starting' || status === 'stopping';

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Dashboard</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.375rem' }}>
            <span className={`status-dot status-${status}`} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
              {status}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>•</span>
            {agentConnected ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Wifi size={12} /> Agent Connected
              </span>
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <WifiOff size={12} /> Agent Offline
              </span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-success" onClick={handleStart} disabled={isOnline || isTransition || !agentConnected}>
            <Play size={14} /> Start
          </button>
          <button className="btn btn-ghost" onClick={handleStop} disabled={!isOnline || isTransition}>
            <Square size={14} /> Stop
          </button>
          <button className="btn btn-ghost" onClick={handleRestart} disabled={!isOnline || isTransition}>
            <RotateCcw size={14} /> Restart
          </button>
          <button className="btn btn-danger" onClick={handleKill} disabled={status === 'offline'}>
            <Skull size={14} /> Kill
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard label="CPU Usage" value={`${metrics.cpuPercent.toFixed(1)}%`} icon={Cpu} accent="blue" />
        <StatCard label="RAM Usage" value={formatRam(metrics.ramUsageMb)}
          sub={`of ${formatRam(metrics.ramTotalMb)}`} icon={MemoryStick} accent="purple" />
        <StatCard label="TPS" value={metrics.tps.toFixed(1)}
          sub={metrics.tps >= 19 ? 'Healthy' : metrics.tps >= 15 ? 'Degraded' : 'Critical'}
          icon={Gauge} accent={metrics.tps >= 19 ? 'green' : metrics.tps >= 15 ? 'yellow' : 'red'} />
        <StatCard label="Players" value={`${metrics.playerCount}/${metrics.maxPlayers}`}
          icon={Users} accent="green" />
        <StatCard label="Uptime" value={formatUptime(metrics.uptime)} icon={Clock} accent="blue" />
        <StatCard label="Version" value="1.20.1" sub="Forge" icon={Activity} accent="purple" />
      </div>

      {/* Online Players */}
      {metrics.onlinePlayers.length > 0 && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
            Online Players
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {metrics.onlinePlayers.map((p) => (
              <div key={p} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.375rem 0.75rem', background: 'var(--bg-input)',
                borderRadius: 'var(--radius-sm)', fontSize: '0.8rem',
              }}>
                <img src={`https://mc-heads.net/avatar/${p}/24`} alt={p}
                  style={{ width: 20, height: 20, borderRadius: 4 }} />
                {p}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
