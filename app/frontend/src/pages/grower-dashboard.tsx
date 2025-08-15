import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import TopNavigation from "@/components/top-navigation";
import SlotCard from "@/components/slot-card";
import BookingModal from "@/components/booking-modal";
import { api } from "@/lib/api";
import { authService } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { SlotWithUsage, BookingWithDetails } from "@shared/schema";

export default function GrowerDashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState<SlotWithUsage | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = authService.getUser();

  // Enhanced authentication gating for all queries
  const isAuthReady = authService.isAuthenticated() && !!authService.getToken();

  const { data: slots = [], isLoading: slotsLoading } = useQuery<SlotWithUsage[]>({
    queryKey: ["/v1/slots", selectedDate],
    queryFn: () => api.getSlots(selectedDate),
    enabled: isAuthReady && !!selectedDate,
  });

  const { data: bookings = [] } = useQuery<BookingWithDetails[]>({
    queryKey: ["/v1/bookings"],
    queryFn: () => api.getBookings(),
    enabled: isAuthReady,
  });

  const cancelBookingMutation = useMutation({
    mutationFn: (id: string) => api.cancelBooking(id),
    onSuccess: () => {
      toast({
        title: "Booking Cancelled",
        description: "Your booking has been cancelled successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/v1/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/v1/slots"] });
    },
    onError: (error: any) => {
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel booking",
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

  const handleBookSlot = (slot: SlotWithUsage) => {
    setSelectedSlot(slot);
    setIsBookingModalOpen(true);
  };

  const handleCancelBooking = (bookingId: string) => {
    if (window.confirm('Are you sure you want to cancel this booking?')) {
      cancelBookingMutation.mutate(bookingId);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      formatted: date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
    };
  };

  const selectedDateFormatted = formatDate(selectedDate);

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation userRole={user?.role} userName="Lowveld Farms" />

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Dashboard Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Delivery Slots</h2>
          <p className="text-gray-600">Book your delivery slots and manage existing bookings</p>
        </div>

        {/* Date Selector */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDateChange('prev')}
                  data-testid="button-prev-date"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900" data-testid="text-selected-date">
                    {selectedDateFormatted.formatted}
                  </h3>
                  <p className="text-sm text-gray-500">{selectedDateFormatted.weekday}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDateChange('next')}
                  data-testid="button-next-date"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="default" size="sm">
                  Day View
                </Button>
                <Button variant="outline" size="sm">
                  Week View
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Slot Grid */}
        <div className="grid gap-4 mb-8">
          {slotsLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Loading slots...</div>
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500">No slots available for this date</div>
            </div>
          ) : (
            slots.map((slot) => (
              <SlotCard
                key={slot.id}
                slot={slot}
                onBook={handleBookSlot}
              />
            ))
          )}
        </div>

        {/* My Bookings Section */}
        <Card>
          <CardHeader>
            <CardTitle>My Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                No bookings found
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between py-4 border-b border-gray-100 last:border-b-0"
                    data-testid={`booking-${booking.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="text-sm font-medium text-gray-900">
                          {new Date(booking.slotDate).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}, {booking.slotStartTime.slice(0, 5)}-{booking.slotEndTime.slice(0, 5)}
                        </div>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          booking.status === 'confirmed' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {booking.status === 'confirmed' ? 'Confirmed' : 'Cancelled'}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {booking.quantity} tons
                        {booking.cultivarName && ` • ${booking.cultivarName}`}
                      </div>
                    </div>
                    {booking.status === 'confirmed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelBooking(booking.id)}
                        disabled={cancelBookingMutation.isPending}
                        className="text-red-600 hover:text-red-800"
                        data-testid="button-cancel-booking"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
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
