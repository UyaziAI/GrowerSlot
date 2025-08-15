import React, { useState } from 'react';
import DayPeekSheet, { DayPeekSummary } from './DayPeekSheet';
import DayEditorSheet from './DayEditorSheet';

export default function AdminPage() {
  const [view, setView] = useState<'month'|'week'|'day'>('month');
  const [peek, setPeek] = useState<{dateISO: string, summary: DayPeekSummary} | null>(null);
  const [editDay, setEditDay] = useState<string | null>(null);
  
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
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 14 }, (_, i) => {
              const dayNum = i + 1;
              const dateISO = `2025-08-${String(dayNum).padStart(2, '0')}`;
              return (
                <button
                  key={i}
                  onClick={() => setPeek({ 
                    dateISO, 
                    summary: { remaining: 10 - (i % 5), booked: i % 5, blackout: i === 7, restricted: i === 3 } 
                  })}
                  className="p-3 border rounded hover:bg-gray-50 text-sm"
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
        </div>
      </main>
      
      {peek && (
        <DayPeekSheet
          dateISO={peek.dateISO}
          summary={peek.summary}
          onCreateDay={()=>{/* open day create */}}
          onBlackoutDay={()=>{/* POST /v1/slots/blackout (day) */}}
          onRestrictDay={()=>{/* POST /v1/restrictions/apply (day) */}}
          onOpenEditor={()=> setEditDay(peek.dateISO)}
          onOpenDayView={()=> {/* switch to day view */}}
          onClose={()=> setPeek(null)}
        />
      )}
      
      {editDay && (
        <DayEditorSheet
          dateISO={editDay}
          onClose={()=> setEditDay(null)}
          onToggleBlackout={()=>{/* PATCH/POST blackout */}}
          onQuickCreate={(p)=>{/* POST /v1/slots/bulk start=end=editDay */}}
        />
      )}
    </div>
  );
}