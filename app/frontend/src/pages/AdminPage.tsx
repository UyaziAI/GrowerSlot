import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, ChevronDown, MoreHorizontal, ChevronLeft, ChevronRight, Calendar, Download } from 'lucide-react';
// Component imports removed for testing - will be re-added when components exist
// import DayPeekSheet, { DayPeekSummary } from './DayPeekSheet';
// import FilterDrawer from './FilterDrawer';
// import CreateSlotsDialog from './CreateSlotsDialog';
// import BulkCreateDialog from './BulkCreateDialog';

interface DayPeekSummary {
  remaining: number;
  booked: number;
  blackout: boolean;
  restricted: boolean;
}

type ViewMode = 'month' | 'week' | 'day';

interface Slot {
  id: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  capacity?: number;
  blackout?: boolean;
  usage?: {
    booked: number;
    remaining: number;
  };
  restrictions?: Record<string, any>;
}

export default function AdminPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [createSlotsDialogOpen, setCreateSlotsDialogOpen] = useState(false);
  const [bulkCreateDialogOpen, setBulkCreateDialogOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dayPeek, setDayPeek] = useState<{ dateISO: string; summary: DayPeekSummary } | null>(null);

  const queryClient = useQueryClient();

  // Mock query for slots
  const { data: slots = [] } = useQuery<Slot[]>({
    queryKey: ['slots', selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/slots?date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch slots');
      return response.json();
    },
  });

  const handleDateNavigation = (direction: 'prev' | 'next') => {
    const currentDate = new Date(selectedDate);
    if (direction === 'prev') {
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  };

  const handleTodayClick = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const handleCreateSlots = () => {
    setCreateSlotsDialogOpen(true);
  };

  const handleBulkCreate = () => {
    setBulkCreateDialogOpen(true);
  };

  const handleApplyTemplate = () => {
    console.log('Apply template clicked');
  };

  const handleExportCSV = () => {
    console.log('Export CSV clicked');
  };

  const handleDayClick = (dateISO: string) => {
    const summary: DayPeekSummary = {
      remaining: 15,
      booked: 8,
      blackout: false,
      restricted: false
    };
    setDayPeek({ dateISO, summary });
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
              {format(new Date(selectedDate), 'MMM d, yyyy')}
            </Button>
          </div>

          {/* Right: Only Create ▾ and More ▾ */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" data-testid="admin-header-create">
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
                  <Calendar className="h-4 w-4 mr-2" />
                  Bulk Create Slots
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleApplyTemplate} data-testid="menuitem-apply-template">
                  <Calendar className="h-4 w-4 mr-2" />
                  Apply Template
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="admin-header-more">
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
                <DropdownMenuItem onClick={() => setFiltersOpen(true)} data-testid="menuitem-open-filters">
                  Open Filters…
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="menuitem-help">
                  Help
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
            {/* Mock calendar for M1 testing - replace with CalendarMonth when implemented */}
            <div className="h-full p-4" data-testid="mock-calendar-month">
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }, (_, i) => (
                  <button
                    key={i}
                    className="p-2 border rounded hover:bg-gray-100"
                    onClick={() => handleDayClick(`2025-08-${String(i + 1).padStart(2, '0')}`)}
                    data-testid={`mock-day-cell-${i}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="week" className="h-full mt-0">
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Week view coming soon
            </div>
          </TabsContent>

          <TabsContent value="day" className="h-full mt-0 relative">
            <div className="h-full p-4">
              <div className="space-y-4">
                <div className="text-center py-8">
                  <h2 className="text-2xl font-bold mb-2">
                    {format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}
                  </h2>
                  <p className="text-muted-foreground">
                    Manage slots for this day
                  </p>
                </div>
                
                <div className="space-y-2" data-testid="day-view-slots">
                  {slots.filter(slot => slot.date === selectedDate).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No slots defined for this day
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs and sheets removed for testing - will be re-added when components exist */}
    </div>
  );
}