import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, parseISO, isAfter, isBefore, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import DayPeekSheet, { DayPeekSummary } from './DayPeekSheet';
import DayEditorSheet from './DayEditorSheet';
import { BulkBar } from './BulkBar';
import { SlotSheet } from './SlotSheet';
import { useToast } from '../hooks/use-toast';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Plus } from 'lucide-react';

const TZ = 'Africa/Johannesburg';

function todayISO(): string {
  const now = toZonedTime(new Date(), TZ);
  return format(startOfDay(now), 'yyyy-MM-dd');
}

export default function AdminPage() {
  const [view, setView] = useState<'month'|'week'|'day'>('month');
  const [focusedDate, setFocusedDate] = useState<string>(todayISO());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [peek, setPeek] = useState<{dateISO: string, summary: DayPeekSummary} | null>(null);
  const [editDay, setEditDay] = useState<string | null>(null);
  const [slotSheet, setSlotSheet] = useState<any | null>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  // Fetch slots for visible range
  const fetchSlots = async () => {
    setLoading(true);
    try {
      const startDate = view === 'day' ? focusedDate : 
                       view === 'week' ? format(startOfWeek(parseISO(focusedDate)), 'yyyy-MM-dd') :
                       format(startOfMonth(parseISO(focusedDate)), 'yyyy-MM-dd');
      const endDate = view === 'day' ? focusedDate :
                     view === 'week' ? format(endOfWeek(parseISO(focusedDate)), 'yyyy-MM-dd') :
                     format(endOfMonth(parseISO(focusedDate)), 'yyyy-MM-dd');
      
      const res = await fetch(`/v1/slots/range?start=${startDate}&end=${endDate}`);
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots || []);
      }
    } catch (error) {
      console.error('Failed to fetch slots:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, [view, focusedDate]);

  const handleDayClick = (dateISO: string) => {
    if (selectMode) {
      setSelectedDates(prev => 
        prev.includes(dateISO) 
          ? prev.filter(d => d !== dateISO)
          : [...prev, dateISO]
      );
    } else {
      setPeek({ 
        dateISO, 
        summary: { remaining: 0, booked: 0, blackout: false, restricted: false }
      });
    }
  };

  const renderMonthView = () => {
    const date = parseISO(focusedDate);
    const monthStart = startOfMonth(date);
    const calendarStart = startOfWeek(monthStart);
    const days = [];
    
    // Always render 42 cells for consistent calendar
    for (let i = 0; i < 42; i++) {
      const day = addDays(calendarStart, i);
      const dateISO = format(day, 'yyyy-MM-dd');
      const isCurrentMonth = isSameMonth(day, date);
      const isSelected = selectedDates.includes(dateISO);
      
      days.push(
        <button
          key={i}
          onClick={() => handleDayClick(dateISO)}
          className={`
            p-3 border rounded text-sm
            ${isCurrentMonth ? '' : 'text-gray-400'}
            ${isSelected ? 'bg-blue-100 border-blue-500' : 'hover:bg-gray-50'}
          `}
        >
          {format(day, 'd')}
        </button>
      );
    }
    
    return (
      <div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-sm font-medium">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const date = parseISO(focusedDate);
    const weekStart = startOfWeek(date);
    const days = [];
    
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const dateISO = format(day, 'yyyy-MM-dd');
      const isSelected = selectedDates.includes(dateISO);
      
      days.push(
        <div key={i} className="border rounded p-2">
          <button
            onClick={() => handleDayClick(dateISO)}
            className={`w-full text-left p-2 rounded ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-50'}`}
          >
            <div className="font-medium">{format(day, 'EEE d')}</div>
          </button>
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-7 gap-2">
        {days}
      </div>
    );
  };

  const renderDayView = () => {
    const daySlots = slots.filter(s => s.date === focusedDate);
    
    return (
      <div className="space-y-4">
        <div className="font-semibold text-lg">
          {format(parseISO(focusedDate), 'EEEE, MMMM d, yyyy')}
        </div>
        <Button
          onClick={() => {
            // TODO: Open create dialog for single slot
          }}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Slot
        </Button>
        <div className="space-y-2">
          {daySlots.map(slot => (
            <button
              key={slot.id}
              onClick={() => setSlotSheet({
                id: slot.id,
                date: slot.date,
                start_time: slot.time || slot.start_time,
                end_time: slot.end_time || '',
                capacity: slot.capacity,
                booked: slot.booked || (slot.capacity - slot.remaining),
                blackout: slot.blackout || false,
                notes: slot.notes || '',
                restrictions: slot.restrictions || {}
              })}
              className="w-full text-left p-3 border rounded hover:bg-gray-50"
            >
              <div className="flex justify-between">
                <span>{slot.time} ({slot.slot_length_min}min)</span>
                <span>{slot.remaining}/{slot.capacity}</span>
              </div>
              {slot.notes && <div className="text-sm text-gray-600">{slot.notes}</div>}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div data-testid="admin-page">
      <header className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <button 
              onClick={()=>setView('month')}
              className={`px-3 py-1 rounded ${view === 'month' ? 'bg-blue-500 text-white' : ''}`}
            >
              Month
            </button>
            <button 
              onClick={()=>setView('week')}
              className={`px-3 py-1 rounded ${view === 'week' ? 'bg-blue-500 text-white' : ''}`}
            >
              Week
            </button>
            <button 
              onClick={()=>setView('day')}
              className={`px-3 py-1 rounded ${view === 'day' ? 'bg-blue-500 text-white' : ''}`}
            >
              Day
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={selectMode}
              onCheckedChange={setSelectMode}
              id="select-mode"
            />
            <Label htmlFor="select-mode">Select days</Label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="admin-header-create">Create ▾</button>
          <button data-testid="admin-header-more">More ▾</button>
        </div>
      </header>
      <main className="p-3">
        <h1 className="text-xl font-semibold">Admin Calendar</h1>
        <div data-testid="admin-calendar-grid" className="mt-3 border rounded p-6">
          {loading && <div>Loading...</div>}
          {!loading && view === 'month' && renderMonthView()}
          {!loading && view === 'week' && renderWeekView()}
          {!loading && view === 'day' && renderDayView()}
        </div>
      </main>
      
      {selectedDates.length > 0 && (
        <BulkBar
          selectedDates={selectedDates}
          onClearSelection={() => setSelectedDates([])}
          onDone={() => {
            setSelectMode(false);
            setSelectedDates([]);
          }}
        />
      )}

      {peek && (
        <DayPeekSheet
          dateISO={peek.dateISO}
          summary={peek.summary}
          onCreateDay={() => {
            // TODO: Open day create dialog
          }}
          onBlackoutDay={async () => {
            try {
              const res = await fetch('/v1/slots/blackout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dates: [peek.dateISO] })
              });
              if (!res.ok) {
                const json = await res.json();
                toast({ description: json.error, variant: 'destructive' });
              } else {
                await fetchSlots();
                setPeek(null);
              }
            } catch (error) {
              toast({ description: 'Failed to blackout day', variant: 'destructive' });
            }
          }}
          onRestrictDay={async () => {
            try {
              const res = await fetch('/v1/restrictions/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  dates: [peek.dateISO],
                  scope: 'day'
                })
              });
              if (!res.ok) {
                const json = await res.json();
                toast({ description: json.error, variant: 'destructive' });
              } else {
                await fetchSlots();
                setPeek(null);
              }
            } catch (error) {
              toast({ description: 'Failed to restrict day', variant: 'destructive' });
            }
          }}
          onOpenEditor={() => {
            setEditDay(peek.dateISO);
            setPeek(null);
          }}
          onOpenDayView={() => {
            setView('day');
            setFocusedDate(peek.dateISO);
            setPeek(null);
          }}
          onClose={() => setPeek(null)}
        />
      )}
      
      {editDay && (
        <DayEditorSheet
          dateISO={editDay}
          onClose={() => setEditDay(null)}
          onToggleBlackout={async (next) => {
            try {
              const res = await fetch('/v1/slots/blackout', {
                method: next ? 'POST' : 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dates: [editDay] })
              });
              if (!res.ok) {
                const json = await res.json();
                toast({ description: json.error, variant: 'destructive' });
              } else {
                await fetchSlots();
              }
            } catch (error) {
              toast({ description: 'Failed to toggle blackout', variant: 'destructive' });
            }
          }}
          onQuickCreate={async (params) => {
            try {
              const dayOfWeek = format(parseISO(editDay), 'EEEE').toLowerCase();
              const res = await fetch('/v1/slots/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...params,
                  start_date: editDay,
                  end_date: editDay,
                  weekdays: [dayOfWeek]
                })
              });
              if (!res.ok) {
                const json = await res.json();
                if (res.status === 422) {
                  toast({ description: json.error, variant: 'destructive' });
                } else {
                  toast({ description: json.error || 'Failed to create slots', variant: 'destructive' });
                }
              } else {
                await fetchSlots();
                setEditDay(null);
              }
            } catch (error) {
              toast({ description: 'Failed to create slots', variant: 'destructive' });
            }
          }}
        />
      )}

      {slotSheet && (
        <SlotSheet
          slot={slotSheet}
          isOpen={true}
          onClose={() => setSlotSheet(null)}
        />
      )}

      {/* Old SlotSheet handlers - keeping for reference
          onToggleBlackout={async (next) => {
            try {
              const res = await fetch(`/v1/slots/${slotSheet.id}/blackout`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blackout: next })
              });
              if (!res.ok) {
                const json = await res.json();
                toast({ description: json.error, variant: 'destructive' });
              } else {
                await fetchSlots();
                setSlotSheet(null);
              }
            } catch (error) {
              toast({ description: 'Failed to toggle blackout', variant: 'destructive' });
            }
          }}
          onRestrict={async () => {
            try {
              const res = await fetch('/v1/restrictions/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  slot_ids: [slotSheet.id],
                  scope: 'slot'
                })
              });
              if (!res.ok) {
                const json = await res.json();
                toast({ description: json.error, variant: 'destructive' });
              } else {
                await fetchSlots();
                setSlotSheet(null);
              }
            } catch (error) {
              toast({ description: 'Failed to restrict slot', variant: 'destructive' });
            }
          }}
          onDelete={async () => {
            if (slotSheet.remaining !== slotSheet.capacity) {
              toast({ description: 'Cannot delete slot with bookings', variant: 'destructive' });
              return;
            }
            try {
              const res = await fetch(`/v1/slots/${slotSheet.id}`, {
                method: 'DELETE'
              });
              if (!res.ok) {
                const json = await res.json();
                toast({ description: json.error, variant: 'destructive' });
              } else {
                await fetchSlots();
                setSlotSheet(null);
              }
            } catch (error) {
              toast({ description: 'Failed to delete slot', variant: 'destructive' });
            }
          }}
          onClose={() => setSlotSheet(null)}
        />
      )}
    </div>
  );
}