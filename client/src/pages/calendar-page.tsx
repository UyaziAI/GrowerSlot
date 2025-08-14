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

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date()); // drives DayView + URL
  const [focusedDate, setFocusedDate] = useState(new Date());   // purely visual highlight in scroller
  const [isMonthPopoverOpen, setIsMonthPopoverOpen] = useState(false);
  const timelineRef = useRef<{ centerOnDate: (date: Date, opts?: ScrollToOptions) => Promise<void> }>(null);
  const user = authService.getUser();

  // Helper function for next frame delay
  const nextFrame = () => new Promise(resolve => 
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );

  // URL state management with timezone handling and initial today selection
  useEffect(() => {
    const initializeDate = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const dateParam = urlParams.get('date');
      
      // Tenant timezone with fallback
      const tenantTz = 'Africa/Johannesburg'; // TODO: Get from tenant settings
      
      let initialDate: Date;
      if (dateParam) {
        const parsedDate = new Date(dateParam);
        if (!isNaN(parsedDate.getTime())) {
          initialDate = parsedDate;
        } else {
          // Invalid date param, fallback to today
          initialDate = new Date();
        }
      } else {
        // No date param, default to today in tenant timezone
        initialDate = new Date();
      }
      
      // Normalize to start of day for consistent behavior
      initialDate.setHours(0, 0, 0, 0);
      
      // Set both selected and focused to the same initial date (OPEN scheduler on first load)
      setSelectedDate(initialDate);
      setFocusedDate(initialDate);
      
      // Update URL to reflect the selected date
      updateURL(initialDate);
      
      // Ensure virtualizer is measured before centering
      await nextFrame();
      timelineRef.current?.centerOnDate(initialDate);
    };
    
    initializeDate();
  }, []);

  // Update URL when date changes (no hard navigate)
  const updateURL = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
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
  const goToToday = async () => {
    const tenantTz = 'Africa/Johannesburg'; // TODO: Get from tenant settings
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    setSelectedDate(today);
    setFocusedDate(today);
    updateURL(today);
    
    await nextFrame();
    timelineRef.current?.centerOnDate(today, { behavior: 'smooth' });
  };

  // Handle date selection from DayPill clicks (explicit selection with centering)
  const handleDateSelect = async (dateStr: string) => {
    const newDate = new Date(dateStr);
    newDate.setHours(0, 0, 0, 0);
    
    setSelectedDate(newDate);
    setFocusedDate(newDate);
    updateURL(newDate);
    
    await nextFrame();
    timelineRef.current?.centerOnDate(newDate, { behavior: 'smooth' });
  };

  // Handle scroll focus changes (visual highlight only)
  const handleFocusChange = (dateStr: string) => {
    const newDate = new Date(dateStr);
    setFocusedDate(newDate);
    // DO NOT update selectedDate or URL on scroll
  };

  // Handle month popover date selection with centering
  const handleMonthDateSelect = async (dateStr: string) => {
    const picked = new Date(dateStr);
    picked.setHours(0, 0, 0, 0);
    
    setSelectedDate(picked);
    setFocusedDate(picked);
    updateURL(picked);
    setIsMonthPopoverOpen(false);
    
    await nextFrame();
    timelineRef.current?.centerOnDate(picked, { behavior: 'smooth' });
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
        <Card className="mb-6">
          <CardContent className="p-6">
            {slotsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600 text-sm">Loading timeline...</p>
              </div>
            ) : (
              <DayTimeline
                ref={timelineRef}
                selectedDate={selectedDate}
                focusedDate={focusedDate}
                slots={slots}
                onDateSelect={handleDateSelect}
                onFocusChange={handleFocusChange}
                className="mb-4"
              />
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