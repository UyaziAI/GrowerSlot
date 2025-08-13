import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Calendar, CalendarDays, Settings, Plus, Ban, Edit } from "lucide-react";
import TopNavigation from "@/components/top-navigation";
import CalendarGrid from "@/features/booking/components/CalendarGrid";
import { useSlotsRange, useSlotsSingle } from "@/features/booking/hooks/useSlotsRange";
import { api } from "@/lib/api";
import { authService } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { SlotWithUsage } from "@shared/schema";

type ViewMode = 'day' | 'week';

export default function AdminSlotsPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedSlot, setSelectedSlot] = useState<SlotWithUsage | null>(null);
  const [bulkForm, setBulkForm] = useState({
    startDate: '',
    endDate: '',
    startTime: '08:00',
    endTime: '16:00',
    slotDuration: 1,
    capacity: 20,
    notes: '',
  });
  const [slotEditForm, setSlotEditForm] = useState({
    capacity: '',
    notes: '',
    blackout: false,
  });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = authService.getUser();

  const isWeekViewEnabled = import.meta.env.VITE_FEATURE_WEEKVIEW === 'true';

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

  const bulkCreateMutation = useMutation({
    mutationFn: (data: any) => api.bulkCreateSlots(data),
    onSuccess: (result: any) => {
      toast({
        title: "Slots Created",
        description: `Successfully created ${result.count} slots`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/slots"] });
      setBulkForm({
        startDate: '',
        endDate: '',
        startTime: '08:00',
        endTime: '16:00',
        slotDuration: 1,
        capacity: 20,
        notes: '',
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create slots",
        variant: "destructive",
      });
    },
  });

  const updateSlotMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateSlot(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slots"] });
      toast({
        title: "Slot Updated",
        description: "Slot has been updated successfully",
      });
      setIsEditDialogOpen(false);
      setSelectedSlot(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update slot",
        variant: "destructive",
      });
    },
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

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    bulkCreateMutation.mutate(bulkForm);
  };

  const handleSlotClick = (slot: SlotWithUsage) => {
    setSelectedSlot(slot);
    setSlotEditForm({
      capacity: slot.capacity.toString(),
      notes: slot.notes || '',
      blackout: slot.blackout || false,
    });
    setIsEditDialogOpen(true);
  };

  const handleSlotUpdate = () => {
    if (!selectedSlot) return;
    
    updateSlotMutation.mutate({
      id: selectedSlot.id,
      data: {
        capacity: slotEditForm.capacity,
        notes: slotEditForm.notes,
        blackout: slotEditForm.blackout,
      },
    });
  };

  const handleToggleBlackout = (slot: SlotWithUsage) => {
    updateSlotMutation.mutate({
      id: slot.id,
      data: { blackout: !slot.blackout },
    });
  };

  // Calculate summary stats
  const totalSlots = slots.length;
  const availableSlots = slots.filter((slot: SlotWithUsage) => !slot.blackout && (slot.remaining ?? 0) > 0).length;
  const blackedOutSlots = slots.filter((slot: SlotWithUsage) => slot.blackout).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation userRole={user?.role} userName="Admin" />

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Slot Management</h2>
              <p className="text-gray-600">
                Create, manage, and monitor delivery slots
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

        {/* Date Navigation */}
        <Card className="mb-6">
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

        {/* Main Content */}
        <Tabs defaultValue="calendar" className="space-y-6">
          <TabsList>
            <TabsTrigger value="calendar">Slot Calendar</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Create</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Slots</p>
                      <p className="text-2xl font-bold">{totalSlots}</p>
                    </div>
                    <Settings className="h-8 w-8 text-gray-400" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Available</p>
                      <p className="text-2xl font-bold text-green-600">{availableSlots}</p>
                    </div>
                    <Badge variant="outline" className="text-green-700 bg-green-50">
                      Available
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Blackout</p>
                      <p className="text-2xl font-bold text-red-600">{blackedOutSlots}</p>
                    </div>
                    <Badge variant="outline" className="text-red-700 bg-red-50">
                      <Ban className="h-3 w-3 mr-1" />
                      Blackout
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Utilization</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {totalSlots > 0 ? Math.round(((totalSlots - availableSlots) / totalSlots) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

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
                    onSlotClick={handleSlotClick}
                    className="w-full"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-6">
            {/* Bulk Slot Creation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Plus className="h-5 w-5 mr-2" />
                  Bulk Slot Creation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleBulkSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={bulkForm.startDate}
                        onChange={(e) => setBulkForm({ ...bulkForm, startDate: e.target.value })}
                        required
                        data-testid="input-start-date"
                      />
                    </div>
                    <div>
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={bulkForm.endDate}
                        onChange={(e) => setBulkForm({ ...bulkForm, endDate: e.target.value })}
                        required
                        data-testid="input-end-date"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        value={bulkForm.startTime}
                        onChange={(e) => setBulkForm({ ...bulkForm, startTime: e.target.value })}
                        data-testid="input-start-time"
                      />
                    </div>
                    <div>
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        value={bulkForm.endTime}
                        onChange={(e) => setBulkForm({ ...bulkForm, endTime: e.target.value })}
                        data-testid="input-end-time"
                      />
                    </div>
                    <div>
                      <Label>Slot Duration</Label>
                      <Select 
                        value={bulkForm.slotDuration.toString()} 
                        onValueChange={(value) => setBulkForm({ ...bulkForm, slotDuration: parseFloat(value) })}
                      >
                        <SelectTrigger data-testid="select-duration">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.5">30 minutes</SelectItem>
                          <SelectItem value="1">1 hour</SelectItem>
                          <SelectItem value="2">2 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Capacity (tons)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={bulkForm.capacity}
                        onChange={(e) => setBulkForm({ ...bulkForm, capacity: parseFloat(e.target.value) || 0 })}
                        placeholder="20.0"
                        data-testid="input-capacity"
                      />
                    </div>
                    <div>
                      <Label>Notes (Optional)</Label>
                      <Input
                        value={bulkForm.notes}
                        onChange={(e) => setBulkForm({ ...bulkForm, notes: e.target.value })}
                        placeholder="Standard delivery slots"
                        data-testid="input-notes"
                      />
                    </div>
                  </div>
                  
                  <Button
                    type="submit"
                    disabled={bulkCreateMutation.isPending}
                    className="w-full bg-primary-500 hover:bg-primary-600"
                    data-testid="button-generate-slots"
                  >
                    {bulkCreateMutation.isPending ? "Generating..." : "Generate Slots"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Slot Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Slot</DialogTitle>
            <DialogDescription>
              {selectedSlot && `${selectedSlot.date} ${selectedSlot.startTime} - ${selectedSlot.endTime}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Capacity (tons)</Label>
              <Input
                type="number"
                step="0.1"
                value={slotEditForm.capacity}
                onChange={(e) => setSlotEditForm({ ...slotEditForm, capacity: e.target.value })}
                data-testid="edit-capacity"
              />
            </div>
            
            <div>
              <Label>Notes</Label>
              <Textarea
                value={slotEditForm.notes}
                onChange={(e) => setSlotEditForm({ ...slotEditForm, notes: e.target.value })}
                placeholder="Slot notes..."
                data-testid="edit-notes"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="blackout"
                checked={slotEditForm.blackout}
                onChange={(e) => setSlotEditForm({ ...slotEditForm, blackout: e.target.checked })}
                data-testid="edit-blackout"
              />
              <Label htmlFor="blackout">Mark as blackout (unavailable)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSlotUpdate} disabled={updateSlotMutation.isPending}>
              {updateSlotMutation.isPending ? "Updating..." : "Update Slot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}