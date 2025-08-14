import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Calendar, CalendarDays, BarChart3, Settings, Mail } from "lucide-react";
import TopNavigation from "@/components/top-navigation";
import CalendarGrid from "@/features/booking/components/CalendarGrid";
import { useSlotsRange, useSlotsSingle } from "@/features/booking/hooks/useSlotsRange";
import { api } from "@/lib/api";
import { authService } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { SlotWithUsage } from "@shared/schema";

type ViewMode = 'day' | 'week';

export default function AdminDashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = authService.getUser();

  // Enable Week view (blueprint requirement - MVP must have Day/Week availability views)
  const isWeekViewEnabled = true; // import.meta.env.VITE_FEATURE_WEEKVIEW === 'true';

  // Calculate date range based on view mode
  const getDateRange = () => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    if (viewMode === 'day') {
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

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats", startDate],
    queryFn: () => api.getDashboardStats(startDate),
  });

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

  // Calculate summary stats
  const totalSlots = slots.length;
  const availableSlots = slots.filter((slot: SlotWithUsage) => !slot.blackout && (slot.remaining ?? 0) > 0).length;
  const blackedOutSlots = slots.filter((slot: SlotWithUsage) => slot.blackout).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation userRole={user?.role} userName="Packhouse Admin" />

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Dashboard</h2>
              <p className="text-gray-600">
                Manage delivery slots and monitor packhouse operations
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

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Total Slots
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold">{stats.totalSlots || totalSlots}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Available</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold text-green-600">{stats.availableSlots || availableSlots}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Booked</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold text-blue-600">{stats.bookedSlots || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Blackout</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold text-red-600">{blackedOutSlots}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation and Summary */}
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
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Calendar View */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Slot Overview</TabsTrigger>
            <TabsTrigger value="management">Quick Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Calendar Grid */}
            <Card className="p-0 overflow-hidden">
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
                    onSlotClick={(slot) => {
                      // Admin can click to view slot details (could open modal)
                      console.log('Admin clicked slot:', slot);
                    }}
                    className="w-full"
                  />
                )}
              </CardContent>
            </Card>

            {/* Legend */}
            <Card>
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
          </TabsContent>

          <TabsContent value="management" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Settings className="h-5 w-5 mr-2" />
                    Full Slot Management
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    Access comprehensive slot management tools including bulk creation, editing, and restrictions.
                  </p>
                  <Button 
                    className="w-full" 
                    onClick={() => window.location.href = '/admin/slots'}
                    data-testid="goto-slot-management"
                  >
                    Manage Slots
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2" />
                    Reports & Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    View detailed reports on slot utilization, booking patterns, and performance metrics.
                  </p>
                  <Button variant="outline" className="w-full" disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Mail className="h-5 w-5 mr-2" />
                    Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    Configure automated notifications for slot availability, capacity alerts, and booking confirmations.
                  </p>
                  <Button variant="outline" className="w-full" disabled>
                    Configure
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}