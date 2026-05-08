'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Settings as SettingsIcon, Save, Key, Shield } from 'lucide-react';

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [apiUrl, setApiUrl] = useState(process.env.NEXT_PUBLIC_API_URL || '');

  const handleChangePassword = async () => {
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    toast.info('Password change not yet implemented in this version');
  };

  return (
    <div className="animate-in">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Settings</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 600 }}>
        {/* Connection Info */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <SettingsIcon size={18} color="var(--accent)" />
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Connection</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>API URL</label>
              <input className="input" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://your-worker.workers.dev" />
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Key size={18} color="var(--accent)" />
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Change Password</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <input className="input" type="password" placeholder="Current password"
              value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            <input className="input" type="password" placeholder="New password (min 8 chars)"
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <button className="btn btn-primary" onClick={handleChangePassword} style={{ alignSelf: 'flex-start' }}>
              <Save size={14} /> Update Password
            </button>
          </div>
        </div>

        {/* Security Info */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Shield size={18} color="var(--success)" />
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Security</h2>
          </div>
          <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: '1rem' }}>
            <li>JWT authentication with 15min access tokens</li>
            <li>Agent connection via outbound WebSocket (DS-Lite safe)</li>
            <li>Filesystem sandboxed to server directory</li>
            <li>Command injection prevention</li>
            <li>Rate limiting: 120 req/min</li>
            <li>PBKDF2 password hashing (100k iterations)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
