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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, Users, Ban, AlertCircle, FileText, Lock, Search } from 'lucide-react';
import BookingModal from "@/components/booking-modal";
import NextAvailableDialog from "@/components/NextAvailableDialog";
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
  const [isNextAvailableOpen, setIsNextAvailableOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = authService.getUser();
  
  // Feature flag for Next Available
  const isNextAvailableEnabled = import.meta.env.VITE_FEATURE_NEXT_AVAILABLE === 'true';

  // Filter slots for the selected date
  const dateStr = selectedDate.toISOString().split('T')[0];
  const daySlots = slots.filter(slot => slot.date === dateStr);

  // Sort slots by start time
  const sortedSlots = [...daySlots].sort((a, b) => a.startTime.localeCompare(b.startTime));

  const handleSlotClick = (slot: SlotWithUsage) => {
    if (user?.role === 'grower') {
      // Check if slot is bookable
      if (!slot.blackout && (slot.remaining ?? 0) > 0 && !hasRestrictions(slot)) {
        setSelectedSlot(slot);
        setIsBookingModalOpen(true);
      }
      // For restricted/blackout/full slots, do nothing (tooltip will show reason)
    } else if (user?.role === 'admin') {
      // Admin can view slot details (could open admin modal)
      console.log('Admin clicked slot:', slot);
    }
  };
  
  // Check if grower is restricted from booking this slot
  const hasRestrictions = (slot: SlotWithUsage): boolean => {
    if (!slot.restrictions || !user) return false;
    
    // If there are grower restrictions and current user not in allowed list
    if (slot.restrictions.growers && slot.restrictions.growers.length > 0) {
      return !slot.restrictions.growers.includes(user.id);
    }
    
    // No restrictions apply
    return false;
  };
  
  // Get unavailability reason for tooltip
  const getUnavailabilityReason = (slot: SlotWithUsage): string => {
    if (slot.blackout) {
      return "Blackout";
    }
    if ((slot.remaining ?? 0) <= 0) {
      return "No capacity";
    }
    if (hasRestrictions(slot)) {
      if (slot.restrictions?.growers && slot.restrictions.growers.length > 0) {
        return "Grower restriction";
      }
      if (slot.restrictions?.cultivars && slot.restrictions.cultivars.length > 0) {
        return `Cultivar restriction: only ${slot.restrictions.cultivars.join(', ')}`;
      }
    }
    return "";
  };
  
  // Check if slot is bookable for grower
  const isSlotBookable = (slot: SlotWithUsage): boolean => {
    if (user?.role !== 'grower') return false;
    return !slot.blackout && (slot.remaining ?? 0) > 0 && !hasRestrictions(slot);
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

          {/* Next Available Button for Growers */}
          {user?.role === 'grower' && isNextAvailableEnabled && (
            <div className="mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsNextAvailableOpen(true)}
                className="flex items-center gap-2"
                data-testid="button-next-available-grower"
              >
                <Search className="w-4 h-4" />
                Find Next Available
              </Button>
            </div>
          )}

          {/* Slots List */}
          <TooltipProvider>
            <div className="space-y-3">
              {sortedSlots.map((slot, index) => {
                const status = getSlotStatus(slot);
                const remaining = slot.remaining ?? slot.capacity;
                const isBookable = isSlotBookable(slot);
                const unavailabilityReason = getUnavailabilityReason(slot);
                const showRestrictionIcon = hasRestrictions(slot);

                return (
                  <motion.div
                    key={slot.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card 
                          className={`transition-all duration-200 ${getStatusColors(status)} ${
                            isBookable ? 'cursor-pointer' : 'cursor-default'
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
                            data-testid={`status-badge-${slot.id}`}
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
                            {showRestrictionIcon && (
                              <Lock 
                                className="w-4 h-4 text-orange-500" 
                                aria-label="🔒 Restricted" 
                                data-testid={`restriction-icon-${slot.id}`}
                              />
                            )}
                            {slot.notes && (
                              <FileText className="w-4 h-4 text-blue-500" aria-label="Special notes" />
                            )}
                          </div>

                          {/* Action Button for Growers */}
                          {user?.role === 'grower' && isBookable && (
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
                    </TooltipTrigger>
                    
                    {/* Tooltip for unavailable slots */}
                    {!isBookable && unavailabilityReason && (
                      <TooltipContent 
                        side="top" 
                        className="max-w-xs"
                        data-testid={`tooltip-${slot.id}`}
                      >
                        <p>{unavailabilityReason}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </motion.div>
              );
            })}
          </div>
        </TooltipProvider>
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
      
      {/* Next Available Dialog */}
      {isNextAvailableEnabled && (
        <NextAvailableDialog
          isOpen={isNextAvailableOpen}
          onClose={() => setIsNextAvailableOpen(false)}
          onSlotJump={(slotId: string) => {
            // Jump to slot functionality - for grower view this is read-only
            console.log('Grower jumping to slot:', slotId);
            setIsNextAvailableOpen(false);
          }}
        />
      )}
    </div>
  );
}