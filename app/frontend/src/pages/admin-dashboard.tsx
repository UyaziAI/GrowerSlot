import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Ban, Mail, Download, BarChart3 } from "lucide-react";
import TopNavigation from "@/components/top-navigation";
import SlotCard from "@/components/slot-card";
import { api } from "@/lib/api";
import { authService } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { SlotWithUsage } from "@shared/schema";

export default function AdminDashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkForm, setBulkForm] = useState({
    startDate: '',
    endDate: '',
    startTime: '08:00',
    endTime: '16:00',
    slotDuration: 1,
    capacity: 20,
    notes: '',
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = authService.getUser();

  const { data: slots = [], isLoading: slotsLoading } = useQuery<SlotWithUsage[]>({
    queryKey: ["/api/slots", selectedDate],
    queryFn: () => api.getSlots(selectedDate),
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats", selectedDate],
    queryFn: () => api.getDashboardStats(selectedDate),
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
    const currentDate = new Date(selectedDate);
    const newDate = new Date(currentDate);
    
    if (direction === 'prev') {
      newDate.setDate(currentDate.getDate() - 1);
    } else {
      newDate.setDate(currentDate.getDate() + 1);
    }
    
    setSelectedDate(newDate.toISOString().split('T')[0]);
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    bulkCreateMutation.mutate(bulkForm);
  };

  const handleToggleBlackout = (slot: SlotWithUsage) => {
    updateSlotMutation.mutate({
      id: slot.id,
      data: { blackout: !slot.blackout },
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation 
        title="Grower Slot Admin" 
        userRole={user?.role} 
        userName="Demo Packhouse" 
      />

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Admin Tabs */}
        <Tabs defaultValue="slots" className="space-y-8">
          <TabsList>
            <TabsTrigger value="slots">Slot Management</TabsTrigger>
            <TabsTrigger value="bookings">Bookings Overview</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="slots">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Slot Generation Form */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Generate Slots</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleBulkSubmit} className="space-y-4" data-testid="form-bulk-slots">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label>Slot Duration (hours)</Label>
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
                      </div>
                      
                      <div>
                        <Label>Notes (Optional)</Label>
                        <Textarea
                          value={bulkForm.notes}
                          onChange={(e) => setBulkForm({ ...bulkForm, notes: e.target.value })}
                          placeholder="Standard delivery slots"
                          data-testid="textarea-notes"
                        />
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

                {/* Today's Slots Management */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Today's Slots</CardTitle>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDateChange('prev')}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-gray-600 font-medium">
                          {formatDate(selectedDate)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDateChange('next')}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {slotsLoading ? (
                        <div className="text-center py-4 text-gray-500">Loading...</div>
                      ) : slots.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">No slots for this date</div>
                      ) : (
                        slots.map((slot) => (
                          <SlotCard
                            key={slot.id}
                            slot={slot}
                            onToggleBlackout={handleToggleBlackout}
                            isAdmin={true}
                          />
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Stats & Actions */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Today's Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Total Slots</span>
                          <span className="text-sm font-medium text-gray-900" data-testid="stat-total-slots">
                            {stats.totalSlots}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Available</span>
                          <span className="text-sm font-medium text-green-600" data-testid="stat-available-slots">
                            {stats.availableSlots}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Booked</span>
                          <span className="text-sm font-medium text-amber-600" data-testid="stat-booked-slots">
                            {stats.bookedSlots}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Blackout</span>
                          <span className="text-sm font-medium text-gray-600" data-testid="stat-blackout-slots">
                            {stats.blackoutSlots}
                          </span>
                        </div>
                        <hr className="border-gray-200" />
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Total Capacity</span>
                          <span className="text-sm font-medium text-gray-900">
                            {stats.totalCapacity} tons
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Booked</span>
                          <span className="text-sm font-medium text-primary-600">
                            {stats.bookedCapacity} tons
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">Loading stats...</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        data-testid="button-add-restriction"
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        Add Restrictions
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        data-testid="button-send-notification"
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        Send Notification
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        data-testid="button-export-csv"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        data-testid="button-view-reports"
                      >
                        <BarChart3 className="mr-2 h-4 w-4" />
                        View Reports
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bookings">
            <Card>
              <CardHeader>
                <CardTitle>Bookings Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  Bookings overview coming soon...
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  Reports section coming soon...
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
