import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ChevronLeft, ChevronRight, Calendar, CalendarDays, BarChart3, Settings, Plus, Edit2, Trash2, FileText, Ban, Shield } from "lucide-react";
import { useLocation } from "wouter";
import TopNavigation from "@/components/top-navigation";
import CalendarGrid from "@/features/booking/components/CalendarGrid";
import { useSlotsRange, useSlotsSingle } from "@/features/booking/hooks/useSlotsRange";
import { api } from "@/lib/api";
import { authService } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { SlotWithUsage } from "@shared/schema";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const TENANT_TZ = 'Africa/Johannesburg';

type ViewMode = 'month' | 'week' | 'day';

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [showBulkCreateDialog, setShowBulkCreateDialog] = useState(false);
  const [showEditSlotDialog, setShowEditSlotDialog] = useState(false);
  const [showApplyTemplateDialog, setShowApplyTemplateDialog] = useState(false);
  const [showTemplatesDrawer, setShowTemplatesDrawer] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotWithUsage | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = authService.getUser();

  // Read feature flags from environment variables
  const FEATURE_ADMIN_TEMPLATES = import.meta.env.VITE_FEATURE_ADMIN_TEMPLATES === 'true';
  const FEATURE_NEXT_AVAILABLE = import.meta.env.VITE_FEATURE_NEXT_AVAILABLE === 'true';

  // RBAC enforcement - redirect non-admin users
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      setLocation('/calendar');
      return;
    }
  }, [user, setLocation]);

  // Calculate date range based on view mode using timezone normalization
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
    }
  };

  const { startDate, endDate } = getDateRange();
  
  // Use range hook for all view modes - no client-side fabrication
  const {
    data: slots = [],
    isLoading: slotsLoading,
    error: slotsError
  } = useSlotsRange(startDate, endDate, true);

  // Admin stats with proper tenant scoping
  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats', user?.tenantId, startDate],
    queryFn: () => api.getDashboardStats(startDate),
    enabled: !!user?.tenantId,
    staleTime: 0 // Always fresh for admin
  });

  // Templates query - only enabled when feature flag is active
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['admin', 'templates', user?.tenantId],
    queryFn: () => api.getTemplates(),
    enabled: !!user?.tenantId && FEATURE_ADMIN_TEMPLATES,
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  // Navigation handlers with timezone awareness
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

  const handleDateSelect = (date: Date | string) => {
    setSelectedDate(new Date(date));
  };

  // CRUD operations using /v1 endpoints
  const bulkCreateSlotsMutation = useMutation({
    mutationFn: (data: any) => api.bulkCreateSlots(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      toast({ title: "Success", description: "Slots created successfully" });
      setShowBulkCreateDialog(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create slots",
        variant: "destructive" 
      });
    }
  });

  const updateSlotMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateSlot(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      toast({ title: "Success", description: "Slot updated successfully" });
      setShowEditSlotDialog(false);
      setSelectedSlot(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update slot",
        variant: "destructive" 
      });
    }
  });

  const applyTemplateMutation = useMutation({
    mutationFn: (data: any) => api.applyTemplate(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      toast({ 
        title: "Template Applied", 
        description: `Created: ${result.created}, Updated: ${result.updated}, Skipped: ${result.skipped}` 
      });
      setShowApplyTemplateDialog(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to apply template",
        variant: "destructive" 
      });
    }
  });

  const handleSlotClick = (slot: SlotWithUsage) => {
    setSelectedSlot(slot);
    setShowEditSlotDialog(true);
  };

  const handleBookingCreate = async (slotId: string, bookingData: any) => {
    try {
      await api.createBooking({ ...bookingData, slotId });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      toast({ title: "Success", description: "Booking created successfully" });
    } catch (error: any) {
      if (error.status === 409) {
        toast({ 
          title: "Slot Full", 
          description: "This slot is at capacity",
          variant: "destructive" 
        });
      } else if (error.status === 403) {
        toast({ 
          title: "Access Denied", 
          description: "Booking not allowed due to restrictions",
          variant: "destructive" 
        });
      } else {
        toast({ 
          title: "Error", 
          description: error.message || "Failed to create booking",
          variant: "destructive" 
        });
      }
    }
  };

  // Show empty state when no slots from backend  
  const showEmptyState = !slotsLoading && slots.length === 0;
  
  // Calculate summary stats from backend data only
  const totalSlots = slots.length;
  const availableSlots = slots.filter((slot: SlotWithUsage) => !slot.blackout && (slot.remaining ?? 0) > 0).length;
  const blackedOutSlots = slots.filter((slot: SlotWithUsage) => slot.blackout).length;

  // Early return for non-admin users
  if (!user || user.role !== 'admin') {
    return <div>Access denied. Redirecting...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation userRole={user?.role} userName="Packhouse Admin" />

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header with Admin Calendar Controls */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Calendar</h2>
              <p className="text-gray-600">
                Full calendar control for slot and booking management
              </p>
            </div>
            
            {/* View Mode Toggle - Month/Week/Day */}
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('month')}
                data-testid="month-view-button"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Month
              </Button>
              <Button
                variant={viewMode === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('week')}
                data-testid="week-view-button"
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                Week
              </Button>
              <Button
                variant={viewMode === 'day' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('day')}
                data-testid="day-view-button"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Day
              </Button>
              
              {/* CRUD Actions */}
              <div className="border-l border-gray-300 ml-2 pl-2 flex items-center space-x-2">
                {/* Templates Drawer - only visible when feature flag is enabled */}
                {FEATURE_ADMIN_TEMPLATES && (
                  <Sheet open={showTemplatesDrawer} onOpenChange={setShowTemplatesDrawer}>
                    <SheetTrigger asChild>
                      <Button size="sm" variant="outline" data-testid="templates-drawer-button">
                        <FileText className="h-4 w-4 mr-2" />
                        Templates
                      </Button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>Templates</SheetTitle>
                      </SheetHeader>
                      <div className="mt-6">
                        {templatesLoading ? (
                          <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="text-sm text-gray-600 mt-2">Loading templates...</p>
                          </div>
                        ) : templates.length === 0 ? (
                          <div className="text-center py-8">
                            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">No templates yet</p>
                            <Button className="mt-4" size="sm">
                              <Plus className="h-4 w-4 mr-2" />
                              Create Template
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {templates.map((template: any) => (
                              <div key={template.id} className="border rounded-lg p-3">
                                <h3 className="font-medium">{template.name}</h3>
                                <p className="text-sm text-gray-600">{template.description}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </SheetContent>
                  </Sheet>
                )}

                {/* Apply Template Dialog */}
                <Dialog open={showApplyTemplateDialog} onOpenChange={setShowApplyTemplateDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" data-testid="apply-template-button">
                      <Settings className="h-4 w-4 mr-2" />
                      Apply Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Apply Template</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                      <p className="text-sm text-gray-600 mb-4">
                        Apply a template to create or modify slots for the selected date range.
                      </p>
                      <Button 
                        onClick={() => {
                          applyTemplateMutation.mutate({ mode: 'preview' });
                        }}
                        disabled={applyTemplateMutation.isPending}
                        data-testid="preview-template"
                      >
                        {applyTemplateMutation.isPending ? 'Previewing...' : 'Preview Changes'}
                      </Button>
                      <Button 
                        className="ml-2"
                        disabled={true}
                        data-testid="publish-template"
                      >
                        Publish (Disabled)
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={showBulkCreateDialog} onOpenChange={setShowBulkCreateDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="bulk-create-button">
                      <Plus className="h-4 w-4 mr-2" />
                      Bulk Create
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Bulk Create Slots</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                      <p className="text-sm text-gray-600 mb-4">
                        Create multiple slots for the selected date range.
                      </p>
                      <Button 
                        onClick={() => {
                          // Mock bulk create - would use actual form
                          bulkCreateSlotsMutation.mutate({
                            startDate,
                            endDate,
                            capacity: 100,
                            timeSlots: ['08:00', '10:00', '14:00', '16:00']
                          });
                        }}
                        disabled={bulkCreateSlotsMutation.isPending}
                        data-testid="confirm-bulk-create"
                      >
                        {bulkCreateSlotsMutation.isPending ? 'Creating...' : 'Create Slots'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Blackout Button */}
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    toast({ title: "Blackout", description: "Blackout functionality not yet implemented" });
                  }}
                  data-testid="blackout-button"
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Blackout
                </Button>

                {/* Restrictions Button */}
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    toast({ title: "Restrictions", description: "Restrictions functionality not yet implemented" });
                  }}
                  data-testid="restrictions-button"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Restrictions
                </Button>
              </div>
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

        {/* Date Navigation */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={navigatePrevious}
                data-testid="prev-date-button"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="text-center">
                <h2 className="text-lg font-semibold">
                  {dayjs(selectedDate).format(
                    viewMode === 'month' ? 'MMMM YYYY' :
                    viewMode === 'week' ? '[Week of] MMM D, YYYY' :
                    'dddd, MMMM D, YYYY'
                  )}
                </h2>
                <p className="text-sm text-gray-600">
                  {startDate} to {endDate}
                </p>
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
                onClick={navigateNext}
                data-testid="next-date-button"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Calendar Content */}
        <Card className="p-0 overflow-hidden">
          <CardContent className="p-0">
            {slotsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading calendar data...</p>
              </div>
            ) : showEmptyState ? (
              <div className="text-center py-12" data-testid="empty-state">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No slots defined by admin</h3>
                <p className="text-gray-600 mb-4">
                  No slots are available for the period {startDate} to {endDate}.
                </p>
                <Button onClick={() => setShowBulkCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Slots
                </Button>
              </div>
            ) : slotsError ? (
              <div className="text-center py-12">
                <p className="text-red-600">Error loading calendar data: {slotsError.message}</p>
              </div>
            ) : (
              <AdminCalendarView
                viewMode={viewMode}
                selectedDate={selectedDate}
                slots={slots}
                onSlotClick={handleSlotClick}
                onDateSelect={handleDateSelect}
                onBookingCreate={handleBookingCreate}
              />
            )}
          </CardContent>
        </Card>

        {/* Edit Slot Dialog */}
        <Dialog open={showEditSlotDialog} onOpenChange={setShowEditSlotDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Slot</DialogTitle>
            </DialogHeader>
            {selectedSlot && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Capacity</label>
                  <p className="text-sm text-gray-600">Current: {selectedSlot.capacity}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <p className="text-sm text-gray-600">
                    {selectedSlot.blackout ? 'Blackout' : 'Active'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Usage</label>
                  <p className="text-sm text-gray-600">
                    {selectedSlot.booked || 0} booked / {selectedSlot.remaining || 0} remaining
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    onClick={() => {
                      updateSlotMutation.mutate({
                        id: selectedSlot.id,
                        data: { blackout: !selectedSlot.blackout }
                      });
                    }}
                    disabled={updateSlotMutation.isPending}
                    variant="outline"
                    data-testid="toggle-blackout"
                  >
                    {selectedSlot.blackout ? 'Remove Blackout' : 'Set Blackout'}
                  </Button>
                  <Button
                    onClick={() => {
                      updateSlotMutation.mutate({
                        id: selectedSlot.id,
                        data: { capacity: Number(selectedSlot.capacity || 0) + 50 }
                      });
                    }}
                    disabled={updateSlotMutation.isPending}
                    data-testid="increase-capacity"
                  >
                    Increase Capacity
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// Admin Calendar View Component - renders different views based on mode
function AdminCalendarView({
  viewMode,
  selectedDate,
  slots,
  onSlotClick,
  onDateSelect,
  onBookingCreate
}: {
  viewMode: ViewMode;
  selectedDate: Date;
  slots: SlotWithUsage[];
  onSlotClick: (slot: SlotWithUsage) => void;
  onDateSelect: (date: Date | string) => void;
  onBookingCreate: (slotId: string, data: any) => void;
}) {
  // Group slots by date for calendar rendering
  const slotsByDate = slots.reduce((acc, slot) => {
    const dateKey = slot.date.toString();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(slot);
    return acc;
  }, {} as Record<string, SlotWithUsage[]>);

  switch (viewMode) {
    case 'month':
      return <AdminMonthView 
        selectedDate={selectedDate} 
        slotsByDate={slotsByDate}
        onDateSelect={onDateSelect}
        onSlotClick={onSlotClick}
      />;
    case 'week':
      return <AdminWeekView 
        selectedDate={selectedDate} 
        slotsByDate={slotsByDate}
        onDateSelect={onDateSelect}
        onSlotClick={onSlotClick}
      />;
    case 'day':
      return <AdminDayView 
        selectedDate={selectedDate} 
        slots={slots.filter(s => s.date === dayjs(selectedDate).format('YYYY-MM-DD'))}
        onSlotClick={onSlotClick}
        onBookingCreate={onBookingCreate}
      />;
    default:
      return <div>Invalid view mode</div>;
  }
}

// Month view component
function AdminMonthView({ selectedDate, slotsByDate, onDateSelect, onSlotClick }: {
  selectedDate: Date;
  slotsByDate: Record<string, SlotWithUsage[]>;
  onDateSelect: (date: Date | string) => void;
  onSlotClick: (slot: SlotWithUsage) => void;
}) {
  const monthStart = dayjs(selectedDate).startOf('month');
  const monthEnd = dayjs(selectedDate).endOf('month');
  const calendarStart = monthStart.startOf('week');
  const calendarEnd = monthEnd.endOf('week');
  
  const days = [];
  let current = calendarStart;
  
  while (current.isBefore(calendarEnd) || current.isSame(calendarEnd, 'day')) {
    days.push(current);
    current = current.add(1, 'day');
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const dateKey = day.format('YYYY-MM-DD');
          const daySlots = slotsByDate[dateKey] || [];
          const isCurrentMonth = day.month() === monthStart.month();
          
          return (
            <div
              key={dateKey}
              className={`min-h-24 border rounded-lg p-2 cursor-pointer hover:bg-gray-50 ${
                isCurrentMonth ? 'bg-white' : 'bg-gray-50'
              }`}
              onClick={() => onDateSelect(day.toDate())}
              data-testid={`calendar-day-${dateKey}`}
            >
              <div className="text-sm font-medium mb-1">{day.date()}</div>
              <div className="space-y-1">
                {daySlots.slice(0, 3).map(slot => (
                  <div
                    key={slot.id}
                    className={`text-xs px-1 py-0.5 rounded cursor-pointer ${
                      slot.blackout 
                        ? 'bg-gray-200 text-gray-600' 
                        : (slot.remaining || 0) > 0 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSlotClick(slot);
                    }}
                  >
                    {slot.startTime}-{slot.endTime}
                  </div>
                ))}
                {daySlots.length > 3 && (
                  <div className="text-xs text-gray-500">+{daySlots.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Week view component
function AdminWeekView({ selectedDate, slotsByDate, onDateSelect, onSlotClick }: {
  selectedDate: Date;
  slotsByDate: Record<string, SlotWithUsage[]>;
  onDateSelect: (date: Date | string) => void;
  onSlotClick: (slot: SlotWithUsage) => void;
}) {
  const weekStart = dayjs(selectedDate).startOf('week');
  const weekDays = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));

  return (
    <div className="p-6">
      <div className="grid grid-cols-7 gap-4">
        {weekDays.map(day => {
          const dateKey = day.format('YYYY-MM-DD');
          const daySlots = slotsByDate[dateKey] || [];
          
          return (
            <div
              key={dateKey}
              className="border rounded-lg p-4 min-h-48 cursor-pointer hover:bg-gray-50"
              onClick={() => onDateSelect(day.toDate())}
              data-testid={`week-day-${dateKey}`}
            >
              <div className="font-semibold mb-3">{day.format('ddd D')}</div>
              <div className="space-y-2">
                {daySlots.map(slot => (
                  <div
                    key={slot.id}
                    className={`text-sm p-2 rounded cursor-pointer ${
                      slot.blackout 
                        ? 'bg-gray-200 text-gray-600' 
                        : (slot.remaining || 0) > 0 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSlotClick(slot);
                    }}
                  >
                    <div className="font-medium">{slot.startTime}-{slot.endTime}</div>
                    <div className="text-xs">{slot.remaining || 0}/{slot.capacity} available</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Day view component
function AdminDayView({ selectedDate, slots, onSlotClick, onBookingCreate }: {
  selectedDate: Date;
  slots: SlotWithUsage[];
  onSlotClick: (slot: SlotWithUsage) => void;
  onBookingCreate: (slotId: string, data: any) => void;
}) {
  return (
    <div className="p-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          {dayjs(selectedDate).format('dddd, MMMM D, YYYY')}
        </h3>
        {slots.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No slots defined for this day
          </div>
        ) : (
          <div className="space-y-3">
            {slots.map(slot => (
              <div
                key={slot.id}
                className={`border rounded-lg p-4 cursor-pointer hover:bg-gray-50 ${
                  slot.blackout ? 'bg-gray-100' : 'bg-white'
                }`}
                onClick={() => onSlotClick(slot)}
                data-testid={`day-slot-${slot.id}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{slot.startTime} - {slot.endTime}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Capacity: {slot.capacity} | Booked: {slot.booked || 0} | 
                      Available: {slot.remaining || 0}
                    </div>
                    {slot.notes && (
                      <div className="text-sm text-gray-500 mt-1">{slot.notes}</div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Badge 
                      variant={slot.blackout ? 'destructive' : 
                        (slot.remaining || 0) > 0 ? 'default' : 'secondary'}
                    >
                      {slot.blackout ? 'Blackout' : 
                       (slot.remaining || 0) > 0 ? 'Available' : 'Full'}
                    </Badge>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSlotClick(slot);
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}