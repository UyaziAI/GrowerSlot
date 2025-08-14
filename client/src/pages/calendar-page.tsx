import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar, CalendarDays } from "lucide-react";
import TopNavigation from "@/components/top-navigation";
import BookingModal from "@/components/booking-modal";
import CalendarGrid from "@/features/booking/components/CalendarGrid";
import { useSlotsRange, useSlotsSingle } from "@/features/booking/hooks/useSlotsRange";
import { api } from "@/lib/api";
import { authService } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { SlotWithUsage, BookingWithDetails } from "@shared/schema";

type ViewMode = 'day' | 'week';

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedSlot, setSelectedSlot] = useState<SlotWithUsage | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = authService.getUser();

  // Enable Week view (blueprint requirement - MVP must have Day/Week availability views)
  const isWeekViewEnabled = true; // import.meta.env.VITE_FEATURE_WEEKVIEW === 'true';

  // Calculate date range based on view mode
  const getDateRange = () => {
    if (viewMode === 'day') {
      const dateStr = selectedDate.toISOString().split('T')[0];
      return { startDate: dateStr, endDate: dateStr };
    } else {
      // Week view - get start of week (Sunday) to end of week (Saturday)
      const startOfWeek = new Date(selectedDate);
      const dayOfWeek = startOfWeek.getDay();
      startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      return {
        startDate: startOfWeek.toISOString().split('T')[0],
        endDate: endOfWeek.toISOString().split('T')[0]
      };
    }
  };

  const { startDate, endDate } = getDateRange();
  
  // Use appropriate hook based on view mode
  const {
    data: slots = [],
    isLoading: slotsLoading
  } = viewMode === 'day' 
    ? useSlotsSingle(startDate)
    : useSlotsRange(startDate, endDate, isWeekViewEnabled);

  const handleDateChange = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    }
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const handleBookSlot = (slot: SlotWithUsage) => {
    setSelectedSlot(slot);
    setIsBookingModalOpen(true);
  };

  // Handle day card click in week view - navigate to day view
  const handleDateSelect = (date: string) => {
    setSelectedDate(new Date(date));
    setViewMode('day');
  };

  // Calculate summary stats
  const totalSlots = slots.length;
  const availableSlots = slots.filter((slot: SlotWithUsage) => !slot.blackout && (slot.remaining ?? 0) > 0).length;
  const blackedOutSlots = slots.filter((slot: SlotWithUsage) => slot.blackout).length;
  const restrictedSlots = slots.filter((slot: SlotWithUsage) => slot.restrictions && (slot.restrictions.growers?.length > 0 || slot.restrictions.cultivars?.length > 0)).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation userRole={user?.role} userName="Lowveld Farms" />

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Dashboard Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Delivery Slots</h2>
              <p className="text-gray-600">
                View and book delivery slots {viewMode === 'week' ? 'by week' : 'by day'}
              </p>
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'day' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('day')}
                data-testid="day-view-button"
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                Day
              </Button>
              {isWeekViewEnabled && (
                <Button
                  variant={viewMode === 'week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('week')}
                  data-testid="week-view-button"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Week
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Navigation and Stats */}
        <div className="flex flex-col lg:flex-row gap-6 mb-6">
          {/* Date Navigation */}
          <Card className="flex-1">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDateChange('prev')}
                  data-testid="prev-date-button"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="text-center">
                  <h2 className="text-lg font-semibold">
                    {viewMode === 'day' 
                      ? selectedDate.toLocaleDateString('en', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })
                      : `Week of ${startDate} to ${endDate}`
                    }
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToToday}
                    className="text-blue-600 hover:text-blue-800"
                    data-testid="today-button"
                  >
                    Go to Today
                  </Button>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDateChange('next')}
                  data-testid="next-date-button"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <Card className="lg:w-96">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-green-700 bg-green-50">
                  {availableSlots} Available
                </Badge>
                <Badge variant="outline" className="text-gray-700 bg-gray-50">
                  {totalSlots} Total
                </Badge>
                {blackedOutSlots > 0 && (
                  <Badge variant="outline" className="text-red-700 bg-red-50">
                    {blackedOutSlots} Blackout
                  </Badge>
                )}
                {restrictedSlots > 0 && (
                  <Badge variant="outline" className="text-orange-700 bg-orange-50">
                    {restrictedSlots} Restricted
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calendar Grid */}
        <Card className="p-0 overflow-hidden mb-6">
          <CardContent className="p-6">
            {slotsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading slots...</p>
              </div>
            ) : (
              <CalendarGrid
                slots={slots}
                viewMode={viewMode}
                selectedDate={selectedDate}
                onSlotClick={handleBookSlot}
                onDateSelect={handleDateSelect}
                className="w-full"
              />
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span>Available</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                <span>Limited (&lt;30% remaining)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span>Full</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-gray-500 rounded"></div>
                <span>Blackout</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <BookingModal
        slot={selectedSlot}
        isOpen={isBookingModalOpen}
        onClose={() => {
          setIsBookingModalOpen(false);
          setSelectedSlot(null);
        }}
      />
    </div>
  );
}