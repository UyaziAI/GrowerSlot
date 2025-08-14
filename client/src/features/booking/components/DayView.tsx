/**
 * DayView - Detailed view showing all slots for a specific date
 * Handles booking modal and slot interactions
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Users, Ban, AlertCircle, FileText } from 'lucide-react';
import BookingModal from "@/components/booking-modal";
import { SlotWithUsage } from "@shared/schema";
import { api } from "@/lib/api";
import { authService } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface DayViewProps {
  selectedDate: Date;
  slots: SlotWithUsage[];
  className?: string;
}

export default function DayView({ selectedDate, slots, className = '' }: DayViewProps) {
  const [selectedSlot, setSelectedSlot] = useState<SlotWithUsage | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = authService.getUser();

  // Filter slots for the selected date
  const dateStr = selectedDate.toISOString().split('T')[0];
  const daySlots = slots.filter(slot => slot.date === dateStr);

  // Sort slots by start time
  const sortedSlots = [...daySlots].sort((a, b) => a.startTime.localeCompare(b.startTime));

  const handleSlotClick = (slot: SlotWithUsage) => {
    if (user?.role === 'grower' && !slot.blackout && (slot.remaining ?? 0) > 0) {
      setSelectedSlot(slot);
      setIsBookingModalOpen(true);
    } else if (user?.role === 'admin') {
      // Admin can view slot details (could open admin modal)
      console.log('Admin clicked slot:', slot);
    }
  };

  // Get slot status styling
  const getSlotStatus = (slot: SlotWithUsage) => {
    if (slot.blackout) return 'blackout';
    const remaining = slot.remaining ?? parseInt(slot.capacity);
    const utilization = ((parseInt(slot.capacity) - remaining) / parseInt(slot.capacity)) * 100;
    
    if (utilization >= 100) return 'full';
    if (utilization >= 70) return 'limited';
    return 'available';
  };

  const getStatusColors = (status: string) => {
    switch (status) {
      case 'available':
        return 'border-green-200 bg-green-50 hover:bg-green-100';
      case 'limited':
        return 'border-amber-200 bg-amber-50 hover:bg-amber-100';
      case 'full':
        return 'border-red-200 bg-red-50 hover:bg-red-100';
      case 'blackout':
        return 'border-gray-300 bg-gray-100 hover:bg-gray-150';
      default:
        return 'border-gray-200 bg-white hover:bg-gray-50';
    }
  };

  if (sortedSlots.length === 0) {
    return (
      <motion.div
        className={`text-center py-12 ${className}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="text-gray-500">
          <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium mb-2">No slots available</h3>
          <p>There are no delivery slots scheduled for {selectedDate.toLocaleDateString('en', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
          })}.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        <motion.div
          key={dateStr}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.15 }}
          className="space-y-3"
        >
          {/* Day Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {selectedDate.toLocaleDateString('en', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric',
                year: 'numeric'
              })}
            </h2>
            <p className="text-gray-600 mt-1">
              {sortedSlots.length} delivery {sortedSlots.length === 1 ? 'slot' : 'slots'} available
            </p>
          </div>

          {/* Slots List */}
          <div className="space-y-3">
            {sortedSlots.map((slot, index) => {
              const status = getSlotStatus(slot);
              const remaining = slot.remaining ?? slot.capacity;
              const isClickable = user?.role === 'grower' && !slot.blackout && remaining > 0;

              return (
                <motion.div
                  key={slot.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card 
                    className={`transition-all duration-200 ${getStatusColors(status)} ${
                      isClickable ? 'cursor-pointer' : 'cursor-default'
                    }`}
                    onClick={() => handleSlotClick(slot)}
                    data-testid={`slot-${slot.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        {/* Left: Time and Capacity */}
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-5 h-5 text-gray-500" />
                            <span className="font-semibold text-lg">
                              {slot.startTime} - {slot.endTime}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-600">
                              {remaining}/{parseInt(slot.capacity)} available
                            </span>
                          </div>
                        </div>

                        {/* Right: Status and Indicators */}
                        <div className="flex items-center space-x-3">
                          {/* Status Badge */}
                          <Badge 
                            variant={status === 'available' ? 'default' : 
                                   status === 'limited' ? 'secondary' : 
                                   status === 'full' ? 'destructive' : 'outline'}
                          >
                            {slot.blackout ? 'Blackout' : 
                             status === 'full' ? 'Full' :
                             status === 'limited' ? 'Limited' : 'Available'}
                          </Badge>

                          {/* Indicators */}
                          <div className="flex space-x-1">
                            {slot.blackout && (
                              <Ban className="w-4 h-4 text-red-500" aria-label="Blackout period" />
                            )}
                            {slot.restrictions && (
                              <AlertCircle className="w-4 h-4 text-orange-500" aria-label="Restrictions apply" />
                            )}
                            {slot.notes && (
                              <FileText className="w-4 h-4 text-blue-500" aria-label="Special notes" />
                            )}
                          </div>

                          {/* Action Button for Growers */}
                          {user?.role === 'grower' && isClickable && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              data-testid={`book-slot-${slot.id}`}
                            >
                              Book Slot
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Additional Info */}
                      {(slot.notes || slot.restrictions) && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          {slot.notes && (
                            <p className="text-sm text-gray-600 mb-2">
                              <strong>Note:</strong> {slot.notes}
                            </p>
                          )}
                          {slot.restrictions && (
                            <div className="text-sm text-gray-600">
                              {slot.restrictions.growers && slot.restrictions.growers.length > 0 && (
                                <p className="mb-1">
                                  <strong>Grower restrictions:</strong> {slot.restrictions.growers.join(', ')}
                                </p>
                              )}
                              {slot.restrictions.cultivars && slot.restrictions.cultivars.length > 0 && (
                                <p>
                                  <strong>Cultivar restrictions:</strong> {slot.restrictions.cultivars.join(', ')}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Booking Modal */}
      {selectedSlot && (
        <BookingModal
          isOpen={isBookingModalOpen}
          onClose={() => {
            setIsBookingModalOpen(false);
            setSelectedSlot(null);
          }}
          slot={selectedSlot}
        />
      )}
    </div>
  );
}