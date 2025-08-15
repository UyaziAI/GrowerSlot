/**
 * Calendar-style slot layout with Day and Week views
 * Inspired by Playtomic's time-grid booking UI
 */
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Lock, AlertTriangle, Clock, User } from "lucide-react";
import { type SlotResponse } from "../../../v1/endpoints";
import { getTimeSegments } from "../hooks/useSlotsRange";

interface CalendarGridProps {
  slots: SlotResponse[];
  viewMode: 'day' | 'week';
  selectedDate: Date;
  onSlotClick?: (slot: SlotResponse) => void;
  className?: string;
}

interface SlotCardProps {
  slot: SlotResponse;
  onClick?: () => void;
  className?: string;
}

function SlotCard({ slot, onClick, className = "" }: SlotCardProps) {
  const usage = slot.usage;
  const capacity = usage?.capacity ?? 0;
  const booked = usage?.booked ?? 0;
  const remaining = usage?.remaining ?? 0;
  
  const utilizationPercent = capacity > 0 ? (booked / capacity) * 100 : 0;
  
  // Status determination
  const isBlackedOut = slot.blackout;
  const isRestricted = slot.restrictions && (slot.restrictions.growers?.length > 0 || slot.restrictions.cultivars?.length > 0);
  const isFull = remaining <= 0;
  const isLimited = remaining > 0 && remaining < capacity * 0.3; // Less than 30% remaining
  
  const getStatusColor = () => {
    if (isBlackedOut) return "bg-gray-500";
    if (isFull) return "bg-red-500";
    if (isLimited) return "bg-yellow-500";
    return "bg-green-500";
  };
  
  const getBackgroundClass = () => {
    if (isBlackedOut) return "bg-gray-100 opacity-60";
    if (isFull) return "bg-red-50";
    if (isLimited) return "bg-yellow-50";
    return "bg-white hover:bg-green-50";
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card 
            className={`${getBackgroundClass()} cursor-pointer transition-all duration-200 border-l-4 min-h-[80px] ${className}`}
            style={{ borderLeftColor: getStatusColor() }}
            onClick={onClick}
            data-testid={`slot-card-${slot.id}`}
          >
            <CardContent className="p-3">
              {/* Time and Status Row */}
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium">
                    {slot.start_time} - {slot.end_time}
                  </span>
                </div>
                
                <div className="flex space-x-1">
                  {isBlackedOut && (
                    <Badge variant="secondary" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Blackout
                    </Badge>
                  )}
                  {isRestricted && (
                    <Badge variant="outline" className="text-xs">
                      <Lock className="h-3 w-3 mr-1" />
                      Restricted
                    </Badge>
                  )}
                </div>
              </div>

              {/* Capacity Progress Bar */}
              {!isBlackedOut && (
                <div className="mb-2">
                  <Progress 
                    value={utilizationPercent} 
                    className="h-2 mb-1"
                    data-testid={`capacity-bar-${slot.id}`}
                  />
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>{booked.toFixed(1)}/{capacity.toFixed(1)} {slot.resource_unit}</span>
                    <span className={`font-medium ${remaining <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {remaining.toFixed(1)} remaining
                    </span>
                  </div>
                </div>
              )}

              {/* Notes indicator */}
              {slot.notes && (
                <div className="text-xs text-gray-500 truncate">
                  📝 {slot.notes}
                </div>
              )}
            </CardContent>
          </Card>
        </TooltipTrigger>
        
        <TooltipContent>
          <div className="p-2 max-w-xs">
            <div className="font-medium mb-1">
              {slot.start_time} - {slot.end_time}
            </div>
            
            {!isBlackedOut && (
              <div className="text-sm mb-2">
                <div>Capacity: {capacity} {slot.resource_unit}</div>
                <div>Booked: {booked} {slot.resource_unit}</div>
                <div>Remaining: {remaining} {slot.resource_unit}</div>
                <div>Utilization: {utilizationPercent.toFixed(1)}%</div>
              </div>
            )}
            
            {isRestricted && slot.restrictions && (
              <div className="text-sm text-orange-600 mb-2">
                <div className="font-medium">Restrictions:</div>
                {slot.restrictions.growers?.length > 0 && (
                  <div>• Growers: {slot.restrictions.growers.length} specific</div>
                )}
                {slot.restrictions.cultivars?.length > 0 && (
                  <div>• Cultivars: {slot.restrictions.cultivars.length} specific</div>
                )}
              </div>
            )}
            
            {slot.notes && (
              <div className="text-sm text-gray-600">
                <div className="font-medium">Notes:</div>
                <div>{slot.notes}</div>
              </div>
            )}
            
            {isBlackedOut && (
              <div className="text-sm text-gray-600">
                This slot is blacked out and unavailable for booking.
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function CalendarGrid({ 
  slots, 
  viewMode, 
  selectedDate, 
  onSlotClick, 
  className = "" 
}: CalendarGridProps) {
  const timeSegments = getTimeSegments(6, 20, 30); // 6 AM to 8 PM, 30-min segments
  
  // Group slots by date for week view
  const slotsByDate = slots.reduce((acc, slot) => {
    const dateKey = slot.date.toString();
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(slot);
    return acc;
  }, {} as Record<string, SlotResponse[]>);

  // Generate date columns for week view
  const getWeekDates = (date: Date) => {
    const dates = [];
    const startOfWeek = new Date(date);
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek); // Start from Sunday
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      dates.push(currentDate);
    }
    return dates;
  };

  const weekDates = viewMode === 'week' ? getWeekDates(selectedDate) : [selectedDate];
  
  // Helper to find slot at specific time for a date
  const findSlotAtTime = (dateStr: string, timeStr: string) => {
    const daySlots = slotsByDate[dateStr] || [];
    return daySlots.find(slot => 
      slot.start_time <= timeStr && slot.end_time > timeStr
    );
  };

  // Calculate slot span in grid units (30-min segments)
  const getSlotSpan = (slot: SlotResponse) => {
    const start = new Date(`2000-01-01T${slot.start_time}`);
    const end = new Date(`2000-01-01T${slot.end_time}`);
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    return Math.max(1, Math.floor(durationMinutes / 30));
  };

  // Get grid position for slot
  const getSlotPosition = (slot: SlotResponse) => {
    const slotStart = slot.start_time;
    const segmentIndex = timeSegments.findIndex(segment => segment.time === slotStart);
    return segmentIndex >= 0 ? segmentIndex : 0;
  };

  if (viewMode === 'day') {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const daySlots = slotsByDate[dateStr] || [];
    
    return (
      <div className={`calendar-grid-day ${className}`} data-testid="calendar-grid-day">
        <div className="grid grid-cols-1 gap-2">
          {daySlots.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No slots available for this date
            </div>
          ) : (
            daySlots.map(slot => (
              <SlotCard
                key={slot.id}
                slot={slot}
                onClick={() => onSlotClick?.(slot)}
                className="w-full"
              />
            ))
          )}
        </div>
      </div>
    );
  }

  // Week view with time grid
  return (
    <div className={`calendar-grid-week ${className}`} data-testid="calendar-grid-week">
      <div className="overflow-x-auto">
        <div className="min-w-full">
          {/* Header with days */}
          <div className="grid grid-cols-8 gap-1 mb-2 sticky top-0 bg-white z-10">
            <div className="text-sm font-medium text-gray-500 p-2">Time</div>
            {weekDates.map(date => {
              const dateStr = date.toISOString().split('T')[0];
              const isToday = dateStr === new Date().toISOString().split('T')[0];
              return (
                <div key={dateStr} className={`text-sm font-medium p-2 text-center rounded ${
                  isToday ? 'bg-blue-100 text-blue-800' : 'text-gray-700'
                }`}>
                  <div>{date.toLocaleDateString('en', { weekday: 'short' })}</div>
                  <div className="text-xs">{date.getDate()}</div>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="space-y-1">
            {timeSegments.map((segment, segmentIndex) => (
              <div key={segment.time} className="grid grid-cols-8 gap-1 min-h-[60px]">
                {/* Time label */}
                <div className="text-xs text-gray-500 p-2 border-r">
                  {segment.minute === 0 ? segment.label : ''}
                </div>
                
                {/* Date columns */}
                {weekDates.map(date => {
                  const dateStr = date.toISOString().split('T')[0];
                  const slot = findSlotAtTime(dateStr, segment.time);
                  
                  if (slot) {
                    const span = getSlotSpan(slot);
                    const position = getSlotPosition(slot);
                    
                    // Only render if this is the starting segment for the slot
                    if (position === segmentIndex) {
                      return (
                        <div key={`${dateStr}-${segment.time}`} className="relative" style={{ gridRowEnd: `span ${span}` }}>
                          <SlotCard
                            slot={slot}
                            onClick={() => onSlotClick?.(slot)}
                            className="h-full"
                          />
                        </div>
                      );
                    }
                    return <div key={`${dateStr}-${segment.time}`} />; // Placeholder for spanned slots
                  }
                  
                  return (
                    <div key={`${dateStr}-${segment.time}`} className="border border-gray-100 bg-gray-50 rounded hover:bg-gray-100 transition-colors" />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}