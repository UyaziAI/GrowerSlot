import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import TopNavigation from "@/components/top-navigation";
import DayTimeline from "@/features/booking/components/DayTimeline";
import DayView from "@/features/booking/components/DayView";
import MiniMonthPopover from "@/features/booking/components/MiniMonthPopover";
import { useSlotsRange } from "@/features/booking/hooks/useSlotsRange";
import { authService } from "@/lib/auth";
import { SlotWithUsage } from "@shared/schema";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

export default function CalendarPage() {
  // Tenant timezone configuration
  const tenantTz = 'Africa/Johannesburg'; // TODO: Get from tenant settings
  
  // Helper to create timezone-normalized dates
  const toTzDay = (d: dayjs.ConfigType) => dayjs(d).tz(tenantTz).startOf('day');
  
  // Initialize dates with timezone normalization
  const urlParams = new URLSearchParams(window.location.search);
  const dateParam = urlParams.get('date');
  const initial = dateParam ? toTzDay(dateParam) : toTzDay(new Date());
  
  const [selectedDate, setSelectedDate] = useState(initial.toDate()); // drives DayView + URL
  const [focusedDate, setFocusedDate] = useState(initial.toDate());   // purely visual highlight in scroller
  const [isMonthPopoverOpen, setIsMonthPopoverOpen] = useState(false);
  const timelineRef = useRef<{ centerOnDate: (date: Date | string, opts?: ScrollToOptions) => Promise<void> }>(null);
  const user = authService.getUser();

  // Initial load centering after first paint and virtualizer measure
  useEffect(() => {
    const doInitialCenter = () => {
      const currentInitial = dateParam ? toTzDay(dateParam) : toTzDay(new Date());
      console.log('Initial load - centering on:', currentInitial.format('YYYY-MM-DD'));
      console.log('Timeline ref available:', !!timelineRef.current);
      
      if (timelineRef.current) {
        timelineRef.current.centerOnDate(currentInitial.toDate(), { behavior: 'instant' });
      } else {
        console.log('Timeline ref not available during initial center');
      }
    };
    
    // Wait for multiple frames to ensure timeline is fully mounted and measured
    requestAnimationFrame(() => 
      requestAnimationFrame(() =>
        requestAnimationFrame(() => doInitialCenter())
      )
    );
  }, []);

  // Update URL when date changes (no hard navigate)
  const updateURL = (date: Date) => {
    const dateStr = toTzDay(date).format('YYYY-MM-DD');
    const url = new URL(window.location.href);
    url.searchParams.set('date', dateStr);
    window.history.replaceState({}, '', url.toString());
  };

  // Calculate week range for initial data (API 14-day limit)
  const getWeekRange = () => {
    const startDate = new Date(selectedDate);
    startDate.setDate(startDate.getDate() - 7);
    
    const endDate = new Date(selectedDate);
    endDate.setDate(endDate.getDate() + 7);
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  };

  const { startDate, endDate } = getWeekRange();
  
  // Fetch 2-week range for DayTimeline (respects API limits)
  const {
    data: slots = [],
    isLoading: slotsLoading
  } = useSlotsRange(startDate, endDate, true);

  // Go to today functionality with timezone handling
  const goToToday = () => {
    const today = toTzDay(new Date()).toDate();
    
    setSelectedDate(today);
    setFocusedDate(today);
    updateURL(today);
    
    console.log('Today button clicked - centering on:', toTzDay(today).format('YYYY-MM-DD'));
    console.log('Timeline ref available on Today click:', !!timelineRef.current);
    
    // Await multiple animation frames for state updates to settle
    requestAnimationFrame(() => 
      requestAnimationFrame(() => {
        console.log('About to call centerOnDate from Today button');
        timelineRef.current?.centerOnDate(today, { behavior: 'smooth' });
      })
    );
  };

  // Handle date selection from DayPill clicks (explicit selection with centering)
  const handleDateSelect = (dateStr: string) => {
    const newDate = toTzDay(dateStr).toDate();
    
    setSelectedDate(newDate);
    setFocusedDate(newDate);
    updateURL(newDate);
    
    // Center and open selected day
    requestAnimationFrame(() => {
      timelineRef.current?.centerOnDate(newDate, { behavior: 'smooth' });
    });
  };

  // Handle scroll focus changes (visual highlight only)
  const handleFocusChange = (dateStr: string) => {
    const newDate = toTzDay(dateStr).toDate();
    setFocusedDate(newDate);
    // DO NOT update selectedDate or URL on scroll
  };

  // Handle month popover date selection with centering
  const handleMonthDateSelect = (dateStr: string) => {
    const picked = toTzDay(dateStr).toDate();
    
    setSelectedDate(picked);
    setFocusedDate(picked);
    updateURL(picked);
    setIsMonthPopoverOpen(false);
    
    console.log('Jump to date selected - centering on:', toTzDay(picked).format('YYYY-MM-DD'));
    console.log('Timeline ref available on Jump:', !!timelineRef.current);
    
    // Await multiple animation frames for state updates to settle
    requestAnimationFrame(() => 
      requestAnimationFrame(() => {
        console.log('About to call centerOnDate from Jump to date');
        timelineRef.current?.centerOnDate(picked, { behavior: 'smooth' });
      })
    );
  };

  // Calculate summary stats for selected date
  const selectedDateStr = selectedDate.toISOString().split('T')[0];
  const daySlots = slots.filter(slot => slot.date === selectedDateStr);
  const totalSlots = daySlots.length;
  const availableSlots = daySlots.filter(slot => !slot.blackout && (slot.remaining ?? 0) > 0).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation userRole={user?.role} userName="Lowveld Farms" />

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header with Navigation Controls */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Delivery Slots</h2>
              <p className="text-gray-600">
                {selectedDate.toLocaleDateString('en', { 
                  month: 'long', 
                  year: 'numeric' 
                })} • {totalSlots} slots available
              </p>
            </div>
            
            {/* Navigation Controls - Only Today and Jump to Date */}
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToToday}
                className="text-blue-600 hover:text-blue-800"
                data-testid="today-button"
              >
                Today
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMonthPopoverOpen(true)}
                data-testid="jump-to-date-button"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Jump to date
              </Button>
            </div>
          </div>
        </div>

        {/* Day Timeline */}
        <Card className="mb-6 relative overflow-visible">
          <CardContent className="overflow-visible" style={{ minHeight: '110px', padding: '12px 24px 12px 24px' }}>
            <DayTimeline
              ref={timelineRef}
              selectedDate={selectedDate}
              focusedDate={focusedDate}
              slots={slots}
              onDateSelect={handleDateSelect}
              onFocusChange={handleFocusChange}
              className="mb-4 overflow-visible"
              tenantTz={tenantTz}
            />
            {slotsLoading && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-gray-600 text-sm">Loading timeline...</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Day Detail View */}
        <Card>
          <CardContent className="p-6">
            {slotsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading slots...</p>
              </div>
            ) : (
              <DayView
                selectedDate={selectedDate}
                slots={slots}
                className="w-full"
              />
            )}
          </CardContent>
        </Card>

        {/* Mini Month Popover */}
        <MiniMonthPopover
          isOpen={isMonthPopoverOpen}
          onClose={() => setIsMonthPopoverOpen(false)}
          selectedDate={selectedDate}
          onDateSelect={handleMonthDateSelect}
          slots={slots}
        />

      </div>
    </div>
  );
}