'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Shield, Server } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isSetup ? '/api/auth/setup' : '/api/auth/login';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      if (isSetup) {
        toast.success('Admin account created! Please log in.');
        setIsSetup(false);
        return;
      }

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      toast.success(`Welcome back, ${data.user.username}`);
      router.push('/');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, var(--bg-primary) 0%, #0f0f1a 100%)',
    }}>
      <div className="card animate-in" style={{ width: 400, padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 'var(--radius)',
            background: 'var(--accent-muted)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
          }}>
            <Server size={28} color="var(--accent)" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>MCPanel</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            {isSetup ? 'Create your admin account' : 'Sign in to manage your server'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.375rem', display: 'block' }}>
              Username
            </label>
            <input
              className="input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
              autoFocus
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.375rem', display: 'block' }}>
              Password
            </label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', padding: '0.625rem', marginTop: '0.5rem' }}>
            {loading ? <span className="spinner" /> : <Shield size={16} />}
            {isSetup ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <button
          onClick={() => setIsSetup(!isSetup)}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: '0.8rem', cursor: 'pointer', marginTop: '1rem',
            display: 'block', width: '100%', textAlign: 'center',
          }}
        >
          {isSetup ? '← Back to login' : 'First time? Create admin account'}
        </button>
      </div>
    </div>
  );
}
