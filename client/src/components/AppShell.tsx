import React from 'react';
import { Link, useRoute } from 'wouter';
import { logout, role } from '../lib/auth';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isAdmin] = useRoute('/admin');
  const [isGrower] = useRoute('/grower');
  const r = role();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b">
        <div className="mx-auto max-w-screen-xl px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/"><a className="font-semibold">GrowerSlot</a></Link>
            <nav className="hidden sm:flex items-center gap-2 text-sm">
              <Link href="/admin">
                <a className={`px-2 py-1 rounded ${isAdmin ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'}`}>Admin</a>
              </Link>
              <Link href="/grower">
                <a className={`px-2 py-1 rounded ${isGrower ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'}`}>Grower</a>
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 hidden sm:inline">role: {r ?? 'guest'}</span>
            <button
              onClick={() => { logout(); window.location.href = '/login'; }}
              className="px-3 py-1 rounded border hover:bg-gray-100"
              aria-label="Logout"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-screen-xl px-3 py-4">
        {children}
      </main>
    </div>
  );
}