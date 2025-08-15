import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, parseISO, isAfter, isBefore, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import DayPeekSheet, { DayPeekSummary } from './DayPeekSheet';
import DayEditorSheet from './DayEditorSheet';
import { BulkBar } from './BulkBar';
import { SlotSheet } from './SlotSheet';
import { fetchJson } from '../lib/http';
import { useToast } from '../hooks/use-toast';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Plus, ChevronDown, Download, Filter, HelpCircle, Copy, Layers } from 'lucide-react';

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
  
  // Feature flags from environment
  const FEATURE_ADMIN_TEMPLATES = import.meta.env.VITE_FEATURE_ADMIN_TEMPLATES === 'true';
  
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
      
      const data = await fetchJson(`/v1/slots?start=${startDate}&end=${endDate}`);
      setSlots(data.slots || []);
    } catch (error: any) {
      toast({ description: error.message, variant: 'destructive' });
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
      
      // Get slot data for this day from backend
      const daySlots = slots.filter(s => s.date === dateISO);
      const totalSlots = daySlots.length;
      const totalCapacity = daySlots.reduce((sum, slot) => sum + (slot.capacity || 0), 0);
      const totalBooked = daySlots.reduce((sum, slot) => sum + (slot.booked || 0), 0);
      const remaining = totalCapacity - totalBooked;
      
      // Check for status indicators from backend data
      const hasBlackout = daySlots.some(slot => slot.blackout === true);
      const hasRestrictions = daySlots.some(slot => 
        slot.restrictions && (
          (slot.restrictions.growers && slot.restrictions.growers.length > 0) ||
          (slot.restrictions.cultivars && slot.restrictions.cultivars.length > 0)
        )
      );
      
      days.push(
        <button
          key={i}
          onClick={() => handleDayClick(dateISO)}
          className={`
            relative p-3 border rounded text-sm min-h-[60px] flex flex-col items-start
            ${isCurrentMonth ? '' : 'text-gray-400'}
            ${isSelected ? 'bg-blue-100 border-blue-500' : 'hover:bg-gray-50'}
          `}
          data-testid={`month-cell-${dateISO}`}
        >
          <div className="font-medium">{format(day, 'd')}</div>
          
          {/* Status Indicators */}
          <div className="flex gap-1 mt-1">
            {hasBlackout && (
              <span className="text-red-500" data-testid={`blackout-indicator-${dateISO}`} title="Blackout day">
                ⛔
              </span>
            )}
            {hasRestrictions && (
              <span className="text-yellow-600" data-testid={`restriction-indicator-${dateISO}`} title="Restricted slots">
                🔒
              </span>
            )}
          </div>
          
          {/* Slot Count Badge */}
          {totalSlots > 0 && (
            <div className="absolute bottom-1 right-1 flex gap-1">
              <span 
                className="text-xs bg-blue-100 text-blue-800 px-1 rounded"
                data-testid={`slot-count-badge-${dateISO}`}
                title={`${totalSlots} slots, ${remaining} remaining`}
              >
                {totalSlots}
              </span>
              {remaining > 0 && (
                <span 
                  className="text-xs bg-green-100 text-green-800 px-1 rounded"
                  data-testid={`remaining-badge-${dateISO}`}
                  title={`${remaining} slots available`}
                >
                  {remaining}
                </span>
              )}
            </div>
          )}
        </button>
      );
    }
    
    return (
      <div data-testid="month-view-grid">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-sm font-medium">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2" data-testid="month-calendar-cells">
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
          {/* Create Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="admin-header-create">
                Create
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => {
                  // Open day editor for focused date
                  setEditDay(focusedDate);
                }}
                data-testid="create-menu-day-slots"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Slots — Day
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => {
                  // Enable select mode for bulk operations
                  setSelectMode(true);
                  toast({
                    title: "Bulk Create Mode",
                    description: "Select multiple days to create slots in bulk"
                  });
                }}
                data-testid="create-menu-bulk-slots"
              >
                <Layers className="h-4 w-4 mr-2" />
                Bulk Create Slots
              </DropdownMenuItem>
              {FEATURE_ADMIN_TEMPLATES && (
                <DropdownMenuItem 
                  onClick={() => {
                    toast({
                      title: "Apply Template",
                      description: "Template functionality coming soon"
                    });
                  }}
                  data-testid="create-menu-apply-template"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Apply Template
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* More Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="admin-header-more">
                More
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => {
                  toast({
                    title: "Export CSV",
                    description: "CSV export functionality coming soon"
                  });
                }}
                data-testid="more-menu-export-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => {
                  toast({
                    title: "Filters",
                    description: "Filter functionality coming soon"
                  });
                }}
                data-testid="more-menu-filters"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters…
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => {
                  toast({
                    title: "Help",
                    description: "Help documentation coming soon"
                  });
                }}
                data-testid="more-menu-help"
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Help
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
              await fetchJson('/v1/slots/blackout', {
                method: 'POST',
                body: JSON.stringify({ dates: [peek.dateISO] })
              });
              await fetchSlots();
              setPeek(null);
            } catch (error: any) {
              toast({ description: error.message, variant: 'destructive' });
            }
          }}
          onRestrictDay={async () => {
            try {
              await fetchJson('/v1/restrictions/apply', {
                method: 'POST',
                body: JSON.stringify({ 
                  dates: [peek.dateISO],
                  scope: 'day'
                })
              });
              await fetchSlots();
              setPeek(null);
            } catch (error: any) {
              toast({ description: error.message, variant: 'destructive' });
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
          onToggleBlackout={async () => {
            try {
              await fetchJson('/v1/slots/blackout', {
                method: 'POST',
                body: JSON.stringify({ dates: [editDay] })
              });
              await fetchSlots();
            } catch (error: any) {
              toast({ description: error.message, variant: 'destructive' });
            }
          }}
          onQuickCreate={async (params) => {
            try {
              const dayOfWeek = format(parseISO(editDay), 'EEEE').toLowerCase();
              await fetchJson('/v1/slots/bulk', {
                method: 'POST',
                body: JSON.stringify({
                  ...params,
                  start_date: editDay,
                  end_date: editDay,
                  weekdays: [dayOfWeek]
                })
              });
              await fetchSlots();
              setEditDay(null);
            } catch (error: any) {
              toast({ description: error.message, variant: 'destructive' });
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