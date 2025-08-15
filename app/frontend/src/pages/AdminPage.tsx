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
  const [dragging, setDragging] = useState<{start: string, end?: string} | null>(null);
  const [showMobileFAB, setShowMobileFAB] = useState(false);
  const { toast } = useToast();
  
  // Feature flags from environment
  const FEATURE_ADMIN_TEMPLATES = import.meta.env.VITE_FEATURE_ADMIN_TEMPLATES === 'true';
  
  // Detect mobile viewport
  const isMobile = window.innerWidth < 768;
  
  // Check if user is authenticated and has admin role
  const checkAuth = () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
      return { authenticated: false, isAdmin: false };
    }
    
    try {
      const user = JSON.parse(userStr);
      return { 
        authenticated: true, 
        isAdmin: user.role === 'admin' 
      };
    } catch {
      return { authenticated: false, isAdmin: false };
    }
  };

  // Fetch slots for visible range
  const fetchSlots = async () => {
    const auth = checkAuth();
    
    // Check authentication first
    if (!auth.authenticated) {
      toast({ 
        description: 'Please log in to access admin features', 
        variant: 'destructive' 
      });
      return;
    }

    if (!auth.isAdmin) {
      toast({ 
        description: 'Admin access required', 
        variant: 'destructive' 
      });
      return;
    }

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
      // Handle auth errors specifically
      if (error.status === 401) {
        // Don't show noisy popup - clear auth and redirect
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return;
      }
      // Show other server errors verbatim (422/403/409)
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
      
      // Get slots for this day from backend data
      const daySlots = slots.filter(s => s.date === dateISO);
      
      days.push(
        <div key={i} className="border rounded p-2 min-h-[200px]" data-testid={`week-day-${dateISO}`}>
          <button
            onClick={() => handleDayClick(dateISO)}
            className={`w-full text-left p-2 rounded mb-2 ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-50'}`}
          >
            <div className="font-medium">{format(day, 'EEE d')}</div>
          </button>
          
          {/* Slot Ribbons */}
          <div className="space-y-1" data-testid={`week-slots-${dateISO}`}>
            {daySlots.length === 0 && (
              <div className="text-xs text-gray-400 text-center py-4">
                No slots
              </div>
            )}
            {daySlots.map((slot, idx) => {
              const remaining = (slot.capacity || 0) - (slot.booked || 0);
              const utilizationPercent = slot.capacity > 0 ? ((slot.booked || 0) / slot.capacity) * 100 : 0;
              
              // Color coding based on availability
              let ribbonColor = 'bg-green-100 border-green-300 text-green-800'; // Available
              if (remaining === 0) {
                ribbonColor = 'bg-red-100 border-red-300 text-red-800'; // Full
              } else if (utilizationPercent > 70) {
                ribbonColor = 'bg-yellow-100 border-yellow-300 text-yellow-800'; // Nearly full
              }
              
              if (slot.blackout) {
                ribbonColor = 'bg-gray-100 border-gray-400 text-gray-600'; // Blackout
              }
              
              return (
                <div
                  key={`${slot.id}-${idx}`}
                  className={`border rounded p-2 text-xs cursor-pointer hover:shadow-sm ${ribbonColor}`}
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
                  data-testid={`week-slot-ribbon-${slot.id}`}
                  title={`${slot.time} - ${remaining}/${slot.capacity} available${slot.blackout ? ' (Blackout)' : ''}${slot.notes ? ` - ${slot.notes}` : ''}`}
                >
                  <div className="font-medium">
                    {slot.time || slot.start_time}
                    {slot.slot_length_min && ` (${slot.slot_length_min}m)`}
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs">
                      {remaining}/{slot.capacity}
                    </span>
                    {slot.blackout && (
                      <span className="text-xs" title="Blackout slot">⛔</span>
                    )}
                    {slot.restrictions && (
                      (slot.restrictions.growers?.length > 0 || slot.restrictions.cultivars?.length > 0)
                    ) && (
                      <span className="text-xs" title="Restricted slot">🔒</span>
                    )}
                  </div>
                  {slot.notes && (
                    <div className="text-xs mt-1 truncate" title={slot.notes}>
                      {slot.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    
    return (
      <div data-testid="week-view-grid">
        <div className="grid grid-cols-7 gap-2">
          {days}
        </div>
      </div>
    );
  };

  // Helper to generate timeline hours (6 AM to 8 PM)
  const generateTimeSlots = () => {
    const hours = [];
    for (let hour = 6; hour <= 20; hour++) {
      hours.push(hour);
    }
    return hours;
  };

  // Handle timeline mouse events for draw-to-create
  const handleTimelineMouseDown = (hour: number) => {
    if (isMobile) return; // Only for desktop
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    setDragging({ start: timeStr });
  };

  const handleTimelineMouseOver = (hour: number) => {
    if (!dragging || isMobile) return;
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    setDragging(prev => prev ? { ...prev, end: timeStr } : null);
  };

  const handleTimelineMouseUp = () => {
    if (!dragging || !dragging.end || isMobile) {
      setDragging(null);
      return;
    }

    // Create slot with selected time range
    const startHour = parseInt(dragging.start.split(':')[0]);
    const endHour = parseInt(dragging.end.split(':')[0]);
    const actualStart = Math.min(startHour, endHour);
    const actualEnd = Math.max(startHour, endHour) + 1; // +1 for duration

    setSlotSheet({
      id: null, // New slot
      date: focusedDate,
      start_time: `${actualStart.toString().padStart(2, '0')}:00`,
      end_time: `${actualEnd.toString().padStart(2, '0')}:00`,
      capacity: 20, // Default capacity
      booked: 0,
      blackout: false,
      notes: '',
      restrictions: {}
    });

    setDragging(null);
  };

  const renderDayView = () => {
    const daySlots = slots.filter(s => s.date === focusedDate);
    const timeSlots = generateTimeSlots();
    
    return (
      <div className="space-y-4" data-testid="day-view">
        <div className="font-semibold text-lg">
          {format(parseISO(focusedDate), 'EEEE, MMMM d, yyyy')}
        </div>
        
        {/* Desktop Timeline */}
        {!isMobile && (
          <div className="border rounded p-4" data-testid="day-timeline">
            <div className="text-sm font-medium mb-2">
              Timeline (drag to create slot)
            </div>
            <div 
              className="grid grid-cols-15 gap-1 select-none"
              onMouseLeave={() => setDragging(null)}
            >
              {timeSlots.map(hour => {
                const timeStr = `${hour.toString().padStart(2, '0')}:00`;
                const hasSlot = daySlots.some(slot => 
                  slot.time === timeStr || slot.start_time === timeStr
                );
                const isDragStart = dragging?.start === timeStr;
                const isDragEnd = dragging?.end === timeStr;
                const isDragRange = dragging && dragging.end && 
                  parseInt(dragging.start.split(':')[0]) <= hour && 
                  hour <= parseInt(dragging.end.split(':')[0]);

                return (
                  <div
                    key={hour}
                    className={`
                      border rounded p-2 text-xs text-center cursor-pointer
                      ${hasSlot ? 'bg-blue-100 border-blue-300' : 'bg-gray-50 hover:bg-gray-100'}
                      ${isDragStart || isDragEnd ? 'bg-green-200 border-green-400' : ''}
                      ${isDragRange ? 'bg-green-100 border-green-300' : ''}
                    `}
                    onMouseDown={() => handleTimelineMouseDown(hour)}
                    onMouseOver={() => handleTimelineMouseOver(hour)}
                    onMouseUp={handleTimelineMouseUp}
                    data-testid={`timeline-hour-${hour}`}
                  >
                    {hour}:00
                    {hasSlot && <div className="text-xs mt-1">•</div>}
                  </div>
                );
              })}
            </div>
            {dragging && (
              <div className="text-sm text-green-600 mt-2">
                Creating slot: {dragging.start} - {dragging.end || '...'}
              </div>
            )}
          </div>
        )}

        {/* Mobile Add Button */}
        {isMobile && (
          <Button
            onClick={() => setShowMobileFAB(true)}
            className="w-full"
            data-testid="mobile-add-slot-button"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Slot
          </Button>
        )}

        {/* Desktop Add Button */}
        {!isMobile && (
          <Button
            onClick={() => setEditDay(focusedDate)}
            variant="outline"
            className="w-full"
            data-testid="desktop-add-slot-button"
          >
            <Plus className="h-4 w-4 mr-2" />
            Open Day Editor
          </Button>
        )}

        {/* Existing Slots List */}
        <div className="space-y-2" data-testid="day-slots-list">
          {daySlots.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              No slots for this day
              {!isMobile && <div className="text-sm mt-1">Drag on timeline above to create</div>}
            </div>
          )}
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
              data-testid={`day-slot-${slot.id}`}
            >
              <div className="flex justify-between">
                <span>{slot.time} ({slot.slot_length_min}min)</span>
                <span>{slot.remaining}/{slot.capacity}</span>
              </div>
              {slot.notes && <div className="text-sm text-gray-600">{slot.notes}</div>}
            </button>
          ))}
        </div>

        {/* Mobile FAB Dialog */}
        {isMobile && showMobileFAB && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50" data-testid="mobile-fab-overlay">
            <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">Create New Slot</h3>
                <button 
                  onClick={() => setShowMobileFAB(false)}
                  data-testid="mobile-fab-close"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Time</label>
                  <input 
                    type="time" 
                    defaultValue="09:00"
                    className="w-full border rounded px-3 py-2"
                    data-testid="mobile-fab-start-time"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
                  <input 
                    type="number" 
                    defaultValue="60"
                    min="15"
                    step="15"
                    className="w-full border rounded px-3 py-2"
                    data-testid="mobile-fab-duration"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Capacity</label>
                  <input 
                    type="number" 
                    defaultValue="20"
                    min="1"
                    className="w-full border rounded px-3 py-2"
                    data-testid="mobile-fab-capacity"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Notes (optional)</label>
                  <input 
                    type="text" 
                    placeholder="Add notes..."
                    className="w-full border rounded px-3 py-2"
                    data-testid="mobile-fab-notes"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button 
                    onClick={() => setShowMobileFAB(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => {
                      // Get form values and create slot
                      const startTime = (document.querySelector('[data-testid="mobile-fab-start-time"]') as HTMLInputElement)?.value || '09:00';
                      const duration = parseInt((document.querySelector('[data-testid="mobile-fab-duration"]') as HTMLInputElement)?.value || '60');
                      const capacity = parseInt((document.querySelector('[data-testid="mobile-fab-capacity"]') as HTMLInputElement)?.value || '20');
                      const notes = (document.querySelector('[data-testid="mobile-fab-notes"]') as HTMLInputElement)?.value || '';
                      
                      // Calculate end time
                      const [hours, minutes] = startTime.split(':').map(Number);
                      const endMinutes = (hours * 60 + minutes + duration);
                      const endHours = Math.floor(endMinutes / 60);
                      const endMins = endMinutes % 60;
                      const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;

                      setSlotSheet({
                        id: null, // New slot
                        date: focusedDate,
                        start_time: startTime,
                        end_time: endTime,
                        capacity,
                        booked: 0,
                        blackout: false,
                        notes,
                        restrictions: {}
                      });
                      
                      setShowMobileFAB(false);
                    }}
                    className="flex-1"
                    data-testid="mobile-fab-create"
                  >
                    Create Slot
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
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
    </div>
  );
}