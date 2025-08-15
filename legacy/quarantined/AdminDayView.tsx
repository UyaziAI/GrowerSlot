/**
 * AdminDayView - Detailed day view showing all slots and bookings
 * Provides detailed CRUD interface for individual slots
 */
import React from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { SlotWithUsage, Booking } from '@shared/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, UserPlus, AlertTriangle } from 'lucide-react';

dayjs.extend(utc);
dayjs.extend(timezone);

const TENANT_TZ = 'Africa/Johannesburg';

interface AdminDayViewProps {
  selectedDate: Date;
  slots: SlotWithUsage[];
  filters: {
    growerId?: string;
    cultivarId?: string;
    showBlackouts?: boolean;
  };
  onSlotClick: (slot: SlotWithUsage) => void;
  onBookingClick: (booking: Booking) => void;
}

export default function AdminDayView({
  selectedDate,
  slots,
  filters,
  onSlotClick,
  onBookingClick
}: AdminDayViewProps) {
  
  const selectedDateStr = dayjs(selectedDate).tz(TENANT_TZ).format('YYYY-MM-DD');
  const daySlots = slots.filter(slot => slot.date === selectedDateStr);

  // Sort slots by start time
  const sortedSlots = [...daySlots].sort((a, b) => 
    a.startTime.localeCompare(b.startTime)
  );

  // Calculate day summary
  const totalCapacity = daySlots.reduce((sum, slot) => sum + parseInt(slot.capacity), 0);
  const totalRemaining = daySlots.reduce((sum, slot) => sum + (slot.remaining ?? parseInt(slot.capacity)), 0);
  const totalBooked = totalCapacity - totalRemaining;
  const utilizationPct = totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0;

  const getSlotStatusBadge = (slot: SlotWithUsage) => {
    if (slot.blackout) {
      return <Badge variant="secondary">Blackout</Badge>;
    }
    
    const remaining = slot.remaining ?? parseInt(slot.capacity);
    const capacity = parseInt(slot.capacity);
    
    if (remaining === capacity) {
      return <Badge variant="outline">Available</Badge>;
    } else if (remaining > 0) {
      return <Badge variant="default">Partial</Badge>;
    } else {
      return <Badge variant="destructive">Full</Badge>;
    }
  };

  return (
    <div className="p-6">
      {/* Day Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {dayjs(selectedDate).tz(TENANT_TZ).format('dddd, MMMM D, YYYY')}
            </h2>
            <p className="text-gray-600">
              {daySlots.length} slot{daySlots.length !== 1 ? 's' : ''} defined
            </p>
          </div>
          
          {/* Day Summary */}
          {daySlots.length > 0 && (
            <Card className="w-64">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600">Total Capacity</div>
                    <div className="font-semibold">{totalCapacity}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Booked</div>
                    <div className="font-semibold">{totalBooked}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Available</div>
                    <div className="font-semibold text-green-600">{totalRemaining}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Utilization</div>
                    <div className="font-semibold">{utilizationPct}%</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Empty State */}
      {daySlots.length === 0 && (
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No slots defined</h3>
          <p className="text-gray-600 mb-6">
            No slots have been defined for {dayjs(selectedDate).tz(TENANT_TZ).format('MMMM D, YYYY')}.
          </p>
          <Button data-testid="button-create-slot">
            Create Slot
          </Button>
        </div>
      )}

      {/* Slots List */}
      {sortedSlots.length > 0 && (
        <div className="space-y-4">
          {sortedSlots.map((slot) => {
            const remaining = slot.remaining ?? parseInt(slot.capacity);
            const capacity = parseInt(slot.capacity);
            const booked = capacity - remaining;
            
            return (
              <Card
                key={slot.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onSlotClick(slot)}
                data-testid={`slot-card-${slot.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {slot.startTime} - {slot.endTime}
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      {getSlotStatusBadge(slot)}
                      {slot.restrictions && (
                        slot.restrictions.growers?.length > 0 || 
                        slot.restrictions.cultivars?.length > 0
                      ) && (
                        <Badge variant="outline" className="text-amber-600">
                          Restricted
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Capacity Info */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Capacity</h4>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-medium">{capacity}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Booked:</span>
                          <span className="font-medium">{booked}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Available:</span>
                          <span className="font-medium text-green-600">{remaining}</span>
                        </div>
                      </div>
                      
                      {/* Capacity Bar */}
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${capacity > 0 ? (booked / capacity) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Notes & Details */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Details</h4>
                      <div className="space-y-1 text-sm text-gray-600">
                        {slot.notes && (
                          <div>
                            <span className="font-medium">Notes:</span> {slot.notes}
                          </div>
                        )}
                        {slot.blackout && (
                          <div className="text-red-600 font-medium">
                            Blackout period - No bookings allowed
                          </div>
                        )}
                        {slot.restrictions && (
                          <div>
                            {slot.restrictions.growers?.length > 0 && (
                              <div>
                                <span className="font-medium">Grower restrictions:</span> {slot.restrictions.growers.length} grower(s)
                              </div>
                            )}
                            {slot.restrictions.cultivars?.length > 0 && (
                              <div>
                                <span className="font-medium">Cultivar restrictions:</span> {slot.restrictions.cultivars.length} cultivar(s)
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Actions</h4>
                      <div className="flex flex-col space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Open edit slot dialog
                            console.log('Edit slot:', slot.id);
                          }}
                          data-testid={`button-edit-slot-${slot.id}`}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Slot
                        </Button>
                        
                        {!slot.blackout && remaining > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              // TODO: Open create booking dialog
                              console.log('Create booking for slot:', slot.id);
                            }}
                            data-testid={`button-create-booking-${slot.id}`}
                          >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Add Booking
                          </Button>
                        )}
                        
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Open delete confirmation
                            console.log('Delete slot:', slot.id);
                          }}
                          data-testid={`button-delete-slot-${slot.id}`}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* TODO: Show bookings for this slot when booking data is available */}
                  {booked > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Bookings</h4>
                      <div className="text-sm text-gray-600">
                        {booked} booking(s) - Individual booking details will be shown here
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}