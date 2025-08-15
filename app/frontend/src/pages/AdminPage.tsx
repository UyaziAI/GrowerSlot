import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Plus, MoreHorizontal, ChevronDown, Calendar, Download, CheckSquare, Square, CalendarPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import CalendarMonth from '@/features/booking/components/CalendarMonth';
import { DayPeekSheet } from './DayPeekSheet';
import { FilterDrawer } from './FilterDrawer';
import { DayEditorSheet } from './DayEditorSheet';
import { BulkBar } from './BulkBar';
import { SlotSheet } from './SlotSheet';
import { CreateSlotsDialog } from './CreateSlotsDialog';
import { BulkCreateDialog } from './BulkCreateDialog';
import { format, addDays, subDays } from 'date-fns';

type ViewMode = 'month' | 'week' | 'day';

interface DayPeekSummary {
  remaining: number;
  booked: number;
  blackout: boolean;
  restricted: boolean;
}

export default function AdminPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dayPeekOpen, setDayPeekOpen] = useState(false);
  const [dayPeekData, setDayPeekData] = useState<{
    dateISO: string;
    summary: DayPeekSummary;
  } | null>(null);
  const [dayEditorOpen, setDayEditorOpen] = useState(false);
  const [dayEditorDate, setDayEditorDate] = useState<string>('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [slotSheetOpen, setSlotSheetOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [createSlotOpen, setCreateSlotOpen] = useState(false);
  const [createSlotsDialogOpen, setCreateSlotsDialogOpen] = useState(false);
  const [bulkCreateDialogOpen, setBulkCreateDialogOpen] = useState(false);
  const [newSlotForm, setNewSlotForm] = useState({
    startTime: '09:00',
    slotLength: 60,
    capacity: 20,
    notes: ''
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    grower: '',
    cultivar: '',
    status: '',
    showBlackout: true,
    showRestricted: true
  });

  // Mock data - in real implementation, this would come from API
  const growers = [
    { id: '1', name: 'Lowveld Farms' },
    { id: '2', name: 'Highland Orchards' },
  ];

  const cultivars = [
    { id: '1', name: 'Beaumont' },
    { id: '2', name: 'A4' },
    { id: '3', name: 'Nelspruit' },
  ];

  // Fetch slots data
  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ['/v1/slots', selectedDate, filters],
    staleTime: 15 * 1000, // 15 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleDateNavigation = (direction: 'prev' | 'next') => {
    const currentDate = new Date(selectedDate);
    const newDate = direction === 'next' 
      ? addDays(currentDate, 1)
      : subDays(currentDate, 1);
    setSelectedDate(newDate.toISOString().split('T')[0]);
  };

  const handleTodayClick = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const handleDayClick = (dateISO: string) => {
    if (selectionMode) {
      // Toggle day selection
      setSelectedDates(prev => 
        prev.includes(dateISO) 
          ? prev.filter(date => date !== dateISO)
          : [...prev, dateISO]
      );
    } else {
      // Normal day peek behavior
      const summary: DayPeekSummary = {
        remaining: 15,
        booked: 8,
        blackout: false,
        restricted: false
      };

      setDayPeekData({ dateISO, summary });
      setDayPeekOpen(true);
    }
  };

  const handleToggleSelectionMode = () => {
    setSelectionMode(prev => !prev);
    if (selectionMode) {
      setSelectedDates([]);
    }
  };

  const handleSelectWeek = () => {
    // Select all 7 days of the current week
    const currentDate = new Date(selectedDate);
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      weekDates.push(date.toISOString().split('T')[0]);
    }
    
    setSelectedDates(weekDates);
    setSelectionMode(true);
  };

  const handleClearSelection = () => {
    setSelectedDates([]);
  };

  const handleDoneSelection = () => {
    setSelectionMode(false);
    setSelectedDates([]);
  };

  const handleCreateSlots = () => {
    setCreateSlotsDialogOpen(true);
  };

  const handleBulkCreate = () => {
    setBulkCreateDialogOpen(true);
  };

  const handleSlotClick = (slot: any) => {
    // Mock slot data - in real implementation, this would come from API
    const slotData = {
      id: slot.id || 'mock-slot-id',
      date: slot.date,
      start_time: slot.start_time || '09:00:00',
      end_time: slot.end_time || '10:00:00',
      capacity: slot.capacity || 20,
      booked: slot.booked || 5,
      blackout: slot.blackout || false,
      notes: slot.notes || '',
      restrictions: slot.restrictions || {}
    };
    
    setSelectedSlot(slotData);
    setSlotSheetOpen(true);
  };

  const queryClient = useQueryClient();

  // Create slot mutation for FAB
  const createSlotMutation = useMutation({
    mutationFn: async () => {
      const endTime = new Date(`2000-01-01T${newSlotForm.startTime}:00`);
      endTime.setMinutes(endTime.getMinutes() + newSlotForm.slotLength);
      const endTimeStr = endTime.toTimeString().slice(0, 5);

      const response = await fetch('/v1/slots/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: selectedDate,
          endDate: selectedDate,
          startTime: newSlotForm.startTime,
          endTime: endTimeStr,
          slotDuration: newSlotForm.slotLength / 60, // Convert to hours
          capacity: newSlotForm.capacity,
          notes: newSlotForm.notes,
          weekdays: [false, false, false, false, false, false, false] // Will be computed server-side
        })
      });
      
      if (!response.ok) throw new Error('Failed to create slot');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/v1/slots'] });
      setCreateSlotOpen(false);
      setNewSlotForm({
        startTime: '09:00',
        slotLength: 60,
        capacity: 20,
        notes: ''
      });
    },
    onError: (error) => {
      console.error('Failed to create slot:', error);
    }
  });

  const handleCreateSlots = () => {
    // TODO: Open create slots dialog
    console.log('Create slots clicked');
  };

  const handleExportCSV = () => {
    // TODO: Export CSV functionality
    console.log('Export CSV clicked');
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50" data-testid="admin-page">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: View Mode */}
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
            <TabsList className="grid w-48 grid-cols-3" data-testid="view-mode-tabs">
              <TabsTrigger value="month" data-testid="tab-month">Month</TabsTrigger>
              <TabsTrigger value="week" data-testid="tab-week">Week</TabsTrigger>
              <TabsTrigger value="day" data-testid="tab-day">Day</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Center: Date Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDateNavigation('prev')}
              data-testid="button-prev-date"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTodayClick}
              className="min-w-16"
              data-testid="button-today"
            >
              Today
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDateNavigation('next')}
              data-testid="button-next-date"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="ml-2"
              data-testid="button-date-picker"
            >
              <Calendar className="h-4 w-4 mr-2" />
              {format(new Date(selectedDate), 'MMM d, yyyy')}
            </Button>
          </div>

          {/* Right: Actions + Filter */}
          <div className="flex items-center gap-2">
            <FilterDrawer
              isOpen={filtersOpen}
              onOpenChange={setFiltersOpen}
              filters={filters}
              onFiltersChange={setFilters}
              growers={growers}
              cultivars={cultivars}
            />

            {/* Selection Mode Toggle */}
            <Button
              variant={selectionMode ? "default" : "outline"}
              size="sm"
              onClick={handleToggleSelectionMode}
              data-testid="button-selection-mode"
            >
              {selectionMode ? <CheckSquare className="h-4 w-4 mr-2" /> : <Square className="h-4 w-4 mr-2" />}
              {selectionMode ? 'Exit Select' : 'Select'}
            </Button>

            {/* Week Selection (only show in week view) */}
            {viewMode === 'week' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectWeek}
                data-testid="button-select-week"
              >
                Bulk actions (week)
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" data-testid="button-create-dropdown">
                  <Plus className="h-4 w-4 mr-2" />
                  Create
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCreateSlots} data-testid="menuitem-create-slots">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Slots (Day)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBulkCreate} data-testid="menuitem-bulk-create">
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Bulk Create (Range)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-more-dropdown">
                  <MoreHorizontal className="h-4 w-4 mr-2" />
                  More
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV} data-testid="menuitem-export-csv">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="menuitem-settings">
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={viewMode} className="h-full">
          <TabsContent value="month" className="h-full mt-0">
            <CalendarMonth
              slots={slots.map(slot => ({
                id: slot.id,
                date: slot.date || selectedDate,
                start_time: slot.startTime || '08:00',
                end_time: slot.endTime || '17:00',
                capacity: slot.capacity || 0,
                blackout: slot.blackout || false,
                usage: {
                  capacity: slot.capacity || 0,
                  booked: slot.usage?.booked || 0,
                  remaining: slot.usage?.remaining || slot.capacity || 0
                },
                restrictions: slot.restrictions || {}
              }))}
              selectedDate={new Date(selectedDate)}
              onDateSelect={(date) => {
                setSelectedDate(date.toISOString().split('T')[0]);
              }}
              onSlotClick={(slot) => handleDayClick(slot.date)}
              onDayClick={handleDayClick}
              isLoading={slotsLoading}
              selectionMode={selectionMode}
              selectedDates={selectedDates}
              className="h-full"
            />
          </TabsContent>

          <TabsContent value="week" className="h-full mt-0">
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Week view coming soon
            </div>
          </TabsContent>

          <TabsContent value="day" className="h-full mt-0 relative">
            <div className="h-full p-4">
              {/* Day View Content */}
              <div className="space-y-4">
                <div className="text-center py-8">
                  <h2 className="text-2xl font-bold mb-2">
                    {format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}
                  </h2>
                  <p className="text-muted-foreground">
                    Manage slots for this day
                  </p>
                </div>
                
                {/* Mock slot list for day view */}
                <div className="space-y-2" data-testid="day-view-slots">
                  {slots.filter(slot => slot.date === selectedDate).map((slot, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-white border rounded-lg cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSlotClick(slot)}
                      data-testid={`day-slot-${index}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-medium">
                          {slot.startTime || '09:00'} - {slot.endTime || '10:00'}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{slot.usage?.booked || 0}/{slot.capacity || 20} booked</span>
                          {slot.blackout && <span className="text-red-600">• Blackout</span>}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                  
                  {slots.filter(slot => slot.date === selectedDate).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No slots defined for this day
                    </div>
                  )}
                </div>
              </div>

              {/* FAB (Floating Action Button) */}
              <Dialog open={createSlotOpen} onOpenChange={setCreateSlotOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="lg"
                    className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40"
                    data-testid="day-view-fab"
                  >
                    <Plus className="h-6 w-6" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md" data-testid="create-slot-dialog">
                  <DialogHeader>
                    <DialogTitle>Create New Slot</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="new-start-time">Start Time</Label>
                        <Input
                          id="new-start-time"
                          type="time"
                          value={newSlotForm.startTime}
                          onChange={(e) => setNewSlotForm(prev => ({ ...prev, startTime: e.target.value }))}
                          data-testid="input-new-start-time"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-slot-length">Duration</Label>
                        <Select
                          value={newSlotForm.slotLength.toString()}
                          onValueChange={(value) => setNewSlotForm(prev => ({ ...prev, slotLength: parseInt(value) }))}
                          data-testid="select-new-slot-length"
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 min</SelectItem>
                            <SelectItem value="60">1 hour</SelectItem>
                            <SelectItem value="90">1.5 hours</SelectItem>
                            <SelectItem value="120">2 hours</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="new-capacity">Capacity</Label>
                      <Input
                        id="new-capacity"
                        type="number"
                        min="1"
                        value={newSlotForm.capacity}
                        onChange={(e) => setNewSlotForm(prev => ({ ...prev, capacity: parseInt(e.target.value) || 0 }))}
                        data-testid="input-new-capacity"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="new-notes">Notes (optional)</Label>
                      <Textarea
                        id="new-notes"
                        placeholder="Add notes for this slot..."
                        value={newSlotForm.notes}
                        onChange={(e) => setNewSlotForm(prev => ({ ...prev, notes: e.target.value }))}
                        data-testid="textarea-new-notes"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setCreateSlotOpen(false)}
                      className="flex-1"
                      data-testid="button-cancel-create"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => createSlotMutation.mutate()}
                      disabled={createSlotMutation.isPending}
                      className="flex-1"
                      data-testid="button-confirm-create"
                    >
                      {createSlotMutation.isPending ? 'Creating...' : 'Create Slot'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Day Peek Bottom Sheet */}
      {dayPeekData && (
        <DayPeekSheet
          dateISO={dayPeekData.dateISO}
          summary={dayPeekData.summary}
          isOpen={dayPeekOpen}
          onClose={() => setDayPeekOpen(false)}
          onCreateDay={() => {
            console.log('Create day slots');
            setDayPeekOpen(false);
          }}
          onBlackoutDay={() => {
            console.log('Blackout day');
            setDayPeekOpen(false);
          }}
          onRestrictDay={() => {
            console.log('Restrict day');
            setDayPeekOpen(false);
          }}
          onOpenEditor={() => {
            console.log('Open editor');
            setDayEditorDate(dayPeekData.dateISO);
            setDayPeekOpen(false);
            setDayEditorOpen(true);
          }}
          onOpenDayView={() => {
            console.log('Open day view');
            setDayPeekOpen(false);
            setViewMode('day');
          }}
        />
      )}

      {/* Day Editor Sheet */}
      <DayEditorSheet
        dateISO={dayEditorDate}
        isOpen={dayEditorOpen}
        onClose={() => {
          setDayEditorOpen(false);
          setDayEditorDate('');
        }}
      />

      {/* Bulk Bar */}
      <BulkBar
        selectedDates={selectedDates}
        onClearSelection={handleClearSelection}
        onDone={handleDoneSelection}
      />

      {/* Slot Sheet */}
      <SlotSheet
        slot={selectedSlot}
        isOpen={slotSheetOpen}
        onClose={() => {
          setSlotSheetOpen(false);
          setSelectedSlot(null);
        }}
      />

      {/* Create Slots Dialog */}
      <CreateSlotsDialog
        isOpen={createSlotsDialogOpen}
        onClose={() => setCreateSlotsDialogOpen(false)}
        focusedDate={selectedDate}
        tenantId="mock-tenant-id"
      />

      {/* Bulk Create Dialog */}
      <BulkCreateDialog
        isOpen={bulkCreateDialogOpen}
        onClose={() => setBulkCreateDialogOpen(false)}
        tenantId="mock-tenant-id"
      />
    </div>
  );
}