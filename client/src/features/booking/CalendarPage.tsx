/**
 * Calendar page with Day/Week toggle and calendar grid
 */
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import CalendarGrid from "./components/CalendarGrid";
import { useSlotsRange, useSlotsSingle } from "./hooks/useSlotsRange";
import { type SlotResponse } from "../../v1/endpoints";
import { authService } from "../../core/auth";

type ViewMode = 'day' | 'week';

export default function CalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const user = authService.getUser();
  const isWeekViewEnabled = import.meta.env.VITE_FEATURE_WEEKVIEW === 'true';

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
  // Enhanced authentication gating for all admin queries  
  const isAuthReady = authService.isAuthenticated() && !!authService.getToken();

  const {
    data: slots = [],
    isLoading,
    error
  } = viewMode === 'day' 
    ? useSlotsSingle(startDate, isAuthReady)
    : useSlotsRange(startDate, endDate, isWeekViewEnabled && isAuthReady);

  // Navigation handlers
  const navigateDate = (direction: 'prev' | 'next') => {
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

  const handleSlotClick = (slot: SlotResponse) => {
    // TODO: Integrate with existing booking flow
    console.log('Slot clicked:', slot);
    // Could open booking modal or navigate to booking page
  };

  // Calculate summary stats
  const totalSlots = slots.length;
  const availableSlots = slots.filter(slot => !slot.blackout && (slot.usage?.remaining ?? 0) > 0).length;
  const blackedOutSlots = slots.filter(slot => slot.blackout).length;
  const restrictedSlots = slots.filter(slot => slot.restrictions && 
    (slot.restrictions.growers?.length > 0 || slot.restrictions.cultivars?.length > 0)).length;

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-6">
          <CardContent>
            <div className="text-center text-red-600">
              <h3 className="text-lg font-semibold mb-2">Error Loading Slots</h3>
              <p>Failed to load slot data. Please try again.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="calendar-page">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Slot Calendar</h1>
              <p className="text-gray-600">
                View and manage delivery slots {viewMode === 'week' ? 'by week' : 'by day'}
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
                  onClick={() => navigateDate('prev')}
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
                  onClick={() => navigateDate('next')}
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
        <Card className="p-0 overflow-hidden">
          <CardContent className="p-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading slots...</p>
              </div>
            ) : (
              <CalendarGrid
                slots={slots}
                viewMode={viewMode}
                selectedDate={selectedDate}
                onSlotClick={handleSlotClick}
                className="w-full"
              />
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <Card className="mt-6">
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
                <span>Limited ({"<30%"} remaining)</span>
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
    </div>
  );
}