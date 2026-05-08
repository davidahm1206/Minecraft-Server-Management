'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Terminal, Puzzle, FolderOpen,
  Globe, Settings, LogOut, Server, ChevronRight,
} from 'lucide-react';
import { ServerProvider } from '@/hooks/use-server';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/console', label: 'Console', icon: Terminal },
  { href: '/mods', label: 'Mods', icon: Puzzle },
  { href: '/files', label: 'Files', icon: FolderOpen },
  { href: '/worlds', label: 'Worlds', icon: Globe },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) router.push('/login');
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{ padding: '1.25rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-muted)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Server size={20} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>MCPanel</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Fabric 1.21.1</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '0.75rem 0', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
              >
                <item.icon size={18} />
                {item.label}
                {isActive && <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
          <button onClick={handleLogout} className="sidebar-link" style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, marginLeft: 260, padding: '2rem', minWidth: 0 }}>
        <ServerProvider>
          {children}
        </ServerProvider>
      </main>
    </div>
  );
}
