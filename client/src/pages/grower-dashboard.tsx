import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Plus, MapPin, Clock, Truck, Calendar } from "lucide-react";
import { Link } from "wouter";
import TopNavigation from "@/components/top-navigation";
import { api } from "@/lib/api";
import { authService } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { BookingWithDetails } from "@shared/schema";

export default function GrowerDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = authService.getUser();

  // Fetch user's bookings
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['bookings', user?.tenantId],
    queryFn: () => api.getBookings(),
  });

  // Cancel booking mutation
  const cancelBookingMutation = useMutation({
    mutationFn: (bookingId: string) => api.cancelBooking(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast({
        title: "Booking cancelled",
        description: "Your booking has been successfully cancelled.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel booking",
        variant: "destructive",
      });
    },
  });

  const handleCancelBooking = (bookingId: string) => {
    if (window.confirm('Are you sure you want to cancel this booking?')) {
      cancelBookingMutation.mutate(bookingId);
    }
  };

  // Get stats from bookings
  const totalBookings = bookings.length;
  const upcomingBookings = bookings.filter((booking: BookingWithDetails) => 
    new Date(booking.slotDate) >= new Date()
  ).length;
  const completedBookings = totalBookings - upcomingBookings;
  const totalQuantity = bookings.reduce((sum: number, booking: BookingWithDetails) => 
    sum + parseFloat(booking.quantity), 0
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation userRole={user?.role} userName="Lowveld Farms" />

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Dashboard Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h2>
              <p className="text-gray-600">
                View your bookings and manage deliveries
              </p>
            </div>
            
            {/* Quick Action */}
            <Link href="/calendar">
              <Button className="flex items-center space-x-2" data-testid="book-slot-button">
                <Calendar className="h-4 w-4" />
                <span>Book New Slot</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                <CalendarDays className="h-4 w-4 mr-2" />
                Total Bookings
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold">{totalBookings}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                Upcoming
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-blue-600">{upcomingBookings}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                <Truck className="h-4 w-4 mr-2" />
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-green-600">{completedBookings}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                <MapPin className="h-4 w-4 mr-2" />
                Total Quantity
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold">{totalQuantity.toFixed(1)} tons</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Link href="/calendar">
                <Button variant="outline" className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span>View Calendar</span>
                </Button>
              </Link>
              <Link href="/calendar">
                <Button variant="outline" className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Book Delivery Slot</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* My Bookings Section */}
        <Card>
          <CardHeader>
            <CardTitle>My Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {bookingsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading bookings...</p>
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-12">
                <CalendarDays className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings yet</h3>
                <p className="text-gray-600 mb-4">Start by booking your first delivery slot</p>
                <Link href="/calendar">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Book Your First Slot
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking: BookingWithDetails) => {
                  const isUpcoming = new Date(booking.slotDate) >= new Date();
                  const slotDate = new Date(booking.slotDate);
                  
                  return (
                    <div
                      key={booking.id}
                      className="border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50"
                      data-testid={`booking-${booking.id}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-4">
                          <div>
                            <div className="font-medium">
                              {slotDate.toLocaleDateString('en', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="text-sm text-gray-600">
                              {booking.slotStartTime} - {booking.slotEndTime}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">{booking.quantity} tons</div>
                            <div className="text-sm text-gray-600">
                              {booking.cultivarName || 'N/A'}
                            </div>
                          </div>
                          <div>
                            <Badge variant={isUpcoming ? "default" : "secondary"}>
                              {isUpcoming ? "Upcoming" : "Completed"}
                            </Badge>
                          </div>
                        </div>
                        {/* Notes would be part of slot details if needed */}
                      </div>
                      {isUpcoming && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelBooking(booking.id)}
                          disabled={cancelBookingMutation.isPending}
                          data-testid={`cancel-booking-${booking.id}`}
                        >
                          {cancelBookingMutation.isPending ? "Cancelling..." : "Cancel"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}