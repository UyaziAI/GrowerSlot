import React, { useState } from 'react';

export default function AdminPage() {
  const [view, setView] = useState<'month'|'week'|'day'>('month');
  
  return (
    <div data-testid="admin-page">
      <header className="flex items-center justify-between p-3 border-b">
        <div className="flex gap-2">
          <button onClick={()=>setView('month')}>Month</button>
          <button onClick={()=>setView('week')}>Week</button>
          <button onClick={()=>setView('day')}>Day</button>
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="admin-header-create">Create ▾</button>
          <button data-testid="admin-header-more">More ▾</button>
        </div>
      </header>
      <main className="p-3">
        <h1 className="text-xl font-semibold">Admin Calendar</h1>
        <div data-testid="admin-calendar-grid" className="mt-3 border rounded p-6">
          {/* Admin calendar grid goes here (no Grower components) */}
        </div>
      </main>
    </div>
  );
}