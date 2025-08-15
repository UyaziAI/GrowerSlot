/**
 * AdminCalendarPage - Comprehensive calendar view for slot and booking management
 * Supports Month/Week/Day views with CRUD operations
 * Shows only backend-provided data, no client-side fabrication
 */
import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Plus, Filter, Download } from 'lucide-react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { authService } from '@/lib/auth';
import { useSlotsRange } from '@/hooks/useSlotsRange';
import AdminMonthView from './components/AdminMonthView';
import AdminWeekView from './components/AdminWeekView';
import AdminDayView from './components/AdminDayView';
import BulkCreateSlotsDialog from './components/BulkCreateSlotsDialog';
import FilterDialog from './components/FilterDialog';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const TENANT_TZ = 'Africa/Johannesburg';

interface AdminCalendarFilters {
  growerId?: string;
  cultivarId?: string;
  showBlackouts?: boolean;
}

export default function AdminCalendarPage() {
  const [, setLocation] = useLocation();
  const isAdmin = authService.isAdmin();
  const isAuthenticated = authService.isAuthenticated();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [filters, setFilters] = useState<AdminCalendarFilters>({});
  const [showBulkCreateDialog, setShowBulkCreateDialog] = useState(false);
  const [showFilterDialog, setShowFilterDialog] = useState(false);

  // Redirect non-admin users
  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      setLocation('/calendar');
    }
  }, [isAuthenticated, isAdmin, setLocation]);

  // Calculate date range based on view mode
  const getDateRange = () => {
    const selected = dayjs(selectedDate).tz(TENANT_TZ);
    
    switch (viewMode) {
      case 'month': {
        const startOfMonth = selected.startOf('month');
        const endOfMonth = selected.endOf('month');
        return {
          startDate: startOfMonth.format('YYYY-MM-DD'),
          endDate: endOfMonth.format('YYYY-MM-DD')
        };
      }
      case 'week': {
        const startOfWeek = selected.startOf('week');
        const endOfWeek = selected.endOf('week');
        return {
          startDate: startOfWeek.format('YYYY-MM-DD'),
          endDate: endOfWeek.format('YYYY-MM-DD')
        };
      }
      case 'day': {
        return {
          startDate: selected.format('YYYY-MM-DD'),
          endDate: selected.format('YYYY-MM-DD')
        };
      }
      default:
        return {
          startDate: selected.format('YYYY-MM-DD'),
          endDate: selected.format('YYYY-MM-DD')
        };
    }
  };

  const { startDate, endDate } = getDateRange();

  // Fetch slots for current view range - no placeholderData
  const { 
    data: slots = [], 
    isLoading,
    error 
  } = useSlotsRange(startDate, endDate, false); // No keepPreviousData

  // Navigation handlers
  const navigatePrevious = () => {
    const prev = dayjs(selectedDate).subtract(1, viewMode);
    setSelectedDate(prev.toDate());
  };

  const navigateNext = () => {
    const next = dayjs(selectedDate).add(1, viewMode);
    setSelectedDate(next.toDate());
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  // Export functionality (placeholder)
  const handleExport = () => {
    // TODO: Implement CSV export
    console.log('Export functionality not yet implemented');
  };

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Admin access required to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Calendar</h1>
              <p className="text-gray-600">
                Manage slots and bookings - {dayjs(selectedDate).tz(TENANT_TZ).format('MMMM YYYY')}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilterDialog(true)}
                data-testid="button-filter"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                data-testid="button-export"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button
                onClick={() => setShowBulkCreateDialog(true)}
                data-testid="button-create-slots"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Slots
              </Button>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={navigatePrevious} data-testid="button-prev">
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday} data-testid="button-today">
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={navigateNext} data-testid="button-next">
                Next
              </Button>
            </div>

            {/* View Mode Tabs */}
            <Tabs value={viewMode} onValueChange={(value: string) => setViewMode(value as any)}>
              <TabsList>
                <TabsTrigger value="month" data-testid="tab-month">Month</TabsTrigger>
                <TabsTrigger value="week" data-testid="tab-week">Week</TabsTrigger>
                <TabsTrigger value="day" data-testid="tab-day">Day</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">Failed to load calendar data. Please try again.</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="grid grid-cols-7 gap-4">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="h-20 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Calendar Views */}
        {!isLoading && (
          <div className="bg-white rounded-lg shadow">
            {viewMode === 'month' && (
              <AdminMonthView
                selectedDate={selectedDate}
                slots={slots}
                filters={filters}
                onDateSelect={handleDateSelect}
                onSlotClick={(slot: any) => console.log('Slot clicked:', slot)}
                onBookingClick={(booking: any) => console.log('Booking clicked:', booking)}
              />
            )}
            {viewMode === 'week' && (
              <AdminWeekView
                selectedDate={selectedDate}
                slots={slots}
                filters={filters}
                onDateSelect={handleDateSelect}
                onSlotClick={(slot: any) => console.log('Slot clicked:', slot)}
                onBookingClick={(booking: any) => console.log('Booking clicked:', booking)}
              />
            )}
            {viewMode === 'day' && (
              <AdminDayView
                selectedDate={selectedDate}
                slots={slots}
                filters={filters}
                onSlotClick={(slot: any) => console.log('Slot clicked:', slot)}
                onBookingClick={(booking: any) => console.log('Booking clicked:', booking)}
              />
            )}
          </div>
        )}

        {/* Empty State - Only when not loading and no slots */}
        {!isLoading && slots.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No slots defined</h3>
            <p className="text-gray-600 mb-6">
              No slots have been defined by admin for this period.
            </p>
            <Button onClick={() => setShowBulkCreateDialog(true)} data-testid="button-create-first-slots">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Slots
            </Button>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <BulkCreateSlotsDialog
        open={showBulkCreateDialog}
        onOpenChange={setShowBulkCreateDialog}
        selectedDate={selectedDate}
      />
      
      <FilterDialog
        open={showFilterDialog}
        onOpenChange={setShowFilterDialog}
        filters={filters}
        onFiltersChange={setFilters}
      />
    </div>
  );
}