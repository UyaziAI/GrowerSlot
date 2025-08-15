import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Plus, MoreHorizontal, ChevronDown, Calendar, Download } from 'lucide-react';
import CalendarMonth from '@/features/booking/components/CalendarMonth';
import { DayPeekSheet } from './DayPeekSheet';
import { FilterDrawer } from './FilterDrawer';
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
    // Mock summary data - in real implementation, calculate from slots
    const summary: DayPeekSummary = {
      remaining: 15,
      booked: 8,
      blackout: false,
      restricted: false
    };

    setDayPeekData({ dateISO, summary });
    setDayPeekOpen(true);
  };

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
                  Create Slots
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="menuitem-bulk-create">
                  Bulk Create
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
              className="h-full"
            />
          </TabsContent>

          <TabsContent value="week" className="h-full mt-0">
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Week view coming soon
            </div>
          </TabsContent>

          <TabsContent value="day" className="h-full mt-0">
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Day view coming soon
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
            setDayPeekOpen(false);
          }}
          onOpenDayView={() => {
            console.log('Open day view');
            setDayPeekOpen(false);
            setViewMode('day');
          }}
        />
      )}
    </div>
  );
}