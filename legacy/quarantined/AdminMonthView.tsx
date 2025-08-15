/**
 * AdminMonthView - Month calendar grid showing slots and bookings
 * Renders only backend-provided data, no client-side fabrication
 */
import React from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { SlotWithUsage, Booking } from '@shared/schema';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

dayjs.extend(utc);
dayjs.extend(timezone);

const TENANT_TZ = 'Africa/Johannesburg';

interface AdminMonthViewProps {
  selectedDate: Date;
  slots: SlotWithUsage[];
  filters: {
    growerId?: string;
    cultivarId?: string;
    showBlackouts?: boolean;
  };
  onDateSelect: (date: Date) => void;
  onSlotClick: (slot: SlotWithUsage) => void;
  onBookingClick: (booking: Booking) => void;
}

interface DayCell {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  slots: SlotWithUsage[];
}

export default function AdminMonthView({
  selectedDate,
  slots,
  filters,
  onDateSelect,
  onSlotClick,
  onBookingClick
}: AdminMonthViewProps) {
  
  // Generate calendar grid for the month
  const generateMonthGrid = (): DayCell[] => {
    const selected = dayjs(selectedDate).tz(TENANT_TZ);
    const startOfMonth = selected.startOf('month');
    const endOfMonth = selected.endOf('month');
    const startOfCalendar = startOfMonth.startOf('week'); // Start from Sunday
    const endOfCalendar = endOfMonth.endOf('week');
    
    const days: DayCell[] = [];
    let current = startOfCalendar;
    
    while (current.isBefore(endOfCalendar) || current.isSame(endOfCalendar, 'day')) {
      const dateStr = current.format('YYYY-MM-DD');
      const daySlots = slots.filter(slot => slot.date === dateStr);
      
      days.push({
        date: current.toDate(),
        isCurrentMonth: current.isSame(selected, 'month'),
        isToday: current.isSame(dayjs().tz(TENANT_TZ), 'day'),
        isSelected: current.isSame(selected, 'day'),
        slots: daySlots
      });
      
      current = current.add(1, 'day');
    }
    
    return days;
  };

  const monthGrid = generateMonthGrid();

  // Get status color for day based on slots
  const getDayStatus = (daySlots: SlotWithUsage[]) => {
    if (daySlots.length === 0) return 'none';
    
    const hasBlackouts = daySlots.some(slot => slot.blackout);
    if (hasBlackouts) return 'blackout';
    
    const totalCapacity = daySlots.reduce((sum, slot) => sum + parseInt(slot.capacity), 0);
    const totalRemaining = daySlots.reduce((sum, slot) => sum + (slot.remaining ?? parseInt(slot.capacity)), 0);
    
    if (totalCapacity === 0) return 'none';
    
    const availabilityPct = Math.round((totalRemaining / totalCapacity) * 100);
    
    if (availabilityPct >= 50) return 'available';
    if (availabilityPct >= 20) return 'limited';
    return 'full';
  };

  const getStatusColors = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-50 border-green-200 text-green-800';
      case 'limited': return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'full': return 'bg-red-50 border-red-200 text-red-800';
      case 'blackout': return 'bg-gray-50 border-gray-200 text-gray-600';
      default: return 'bg-white border-gray-200 text-gray-900';
    }
  };

  return (
    <div className="p-6">
      {/* Month Header */}
      <div className="grid grid-cols-7 gap-px mb-4">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-3 text-center text-sm font-medium text-gray-500 bg-gray-50">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
        {monthGrid.map((cell, index) => {
          const status = getDayStatus(cell.slots);
          const statusColors = getStatusColors(status);
          
          return (
            <Card
              key={index}
              className={`
                min-h-[120px] p-2 cursor-pointer transition-all duration-200 rounded-none border-0
                ${cell.isCurrentMonth ? statusColors : 'bg-gray-50 text-gray-400'}
                ${cell.isSelected ? 'ring-2 ring-blue-500' : ''}
                ${cell.isToday ? 'ring-1 ring-blue-300' : ''}
                hover:shadow-sm
              `}
              onClick={() => onDateSelect(cell.date)}
              data-testid={cell.isSelected ? 'day-selected' : `day-${dayjs(cell.date).format('YYYY-MM-DD')}`}
            >
              {/* Day Number */}
              <div className="flex items-center justify-between mb-2">
                <span className={`
                  text-sm font-medium
                  ${cell.isToday ? 'bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center' : ''}
                `}>
                  {dayjs(cell.date).date()}
                </span>
                
                {/* Slot Count Badge */}
                {cell.slots.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {cell.slots.length}
                  </Badge>
                )}
              </div>

              {/* Slots Preview */}
              <div className="space-y-1">
                {cell.slots.slice(0, 3).map((slot, slotIndex) => {
                  const remaining = slot.remaining ?? parseInt(slot.capacity);
                  const capacity = parseInt(slot.capacity);
                  
                  return (
                    <div
                      key={slotIndex}
                      className={`
                        text-xs p-1 rounded cursor-pointer
                        ${slot.blackout 
                          ? 'bg-gray-100 text-gray-600' 
                          : remaining > 0 
                          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                          : 'bg-red-100 text-red-700'
                        }
                      `}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSlotClick(slot);
                      }}
                      data-testid={`slot-${slot.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">
                          {slot.startTime} - {slot.endTime}
                        </span>
                        <span className="ml-1">
                          {slot.blackout ? 'Blocked' : `${remaining}/${capacity}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
                
                {/* Show "more" indicator if there are additional slots */}
                {cell.slots.length > 3 && (
                  <div className="text-xs text-gray-500 pl-1">
                    +{cell.slots.length - 3} more
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}