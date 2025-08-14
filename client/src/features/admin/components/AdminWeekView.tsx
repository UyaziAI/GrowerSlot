/**
 * AdminWeekView - Week calendar view with time slots
 * Shows detailed hourly slots for a week period
 */
import React from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { SlotWithUsage, Booking } from '@shared/schema';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

dayjs.extend(utc);
dayjs.extend(timezone);

const TENANT_TZ = 'Africa/Johannesburg';

interface AdminWeekViewProps {
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

// Generate time segments for the day (6 AM to 8 PM)
const generateTimeSegments = () => {
  const segments = [];
  for (let hour = 6; hour <= 20; hour++) {
    segments.push(`${hour.toString().padStart(2, '0')}:00`);
  }
  return segments;
};

export default function AdminWeekView({
  selectedDate,
  slots,
  filters,
  onDateSelect,
  onSlotClick,
  onBookingClick
}: AdminWeekViewProps) {
  
  // Generate week dates
  const generateWeekDates = () => {
    const selected = dayjs(selectedDate).tz(TENANT_TZ);
    const startOfWeek = selected.startOf('week'); // Sunday
    const dates = [];
    
    for (let i = 0; i < 7; i++) {
      dates.push(startOfWeek.add(i, 'day').toDate());
    }
    
    return dates;
  };

  const weekDates = generateWeekDates();
  const timeSegments = generateTimeSegments();

  // Group slots by date and time
  const groupSlotsByDateTime = () => {
    const grouped: Record<string, Record<string, SlotWithUsage[]>> = {};
    
    weekDates.forEach(date => {
      const dateStr = dayjs(date).format('YYYY-MM-DD');
      grouped[dateStr] = {};
      
      timeSegments.forEach(time => {
        grouped[dateStr][time] = [];
      });
    });

    slots.forEach(slot => {
      const dateStr = slot.date;
      const startTime = slot.startTime.substring(0, 5); // HH:MM format
      
      if (grouped[dateStr] && grouped[dateStr][startTime]) {
        grouped[dateStr][startTime].push(slot);
      }
    });

    return grouped;
  };

  const groupedSlots = groupSlotsByDateTime();

  return (
    <div className="p-6">
      {/* Week Header */}
      <div className="grid grid-cols-8 gap-px mb-4">
        <div className="p-3 text-center text-sm font-medium text-gray-500 bg-gray-50">
          Time
        </div>
        {weekDates.map(date => {
          const dayjs_date = dayjs(date);
          const isToday = dayjs_date.isSame(dayjs().tz(TENANT_TZ), 'day');
          const isSelected = dayjs_date.isSame(dayjs(selectedDate), 'day');
          
          return (
            <div
              key={date.toISOString()}
              className={`
                p-3 text-center text-sm font-medium cursor-pointer transition-colors
                ${isSelected ? 'bg-blue-100 text-blue-800' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}
                ${isToday ? 'ring-1 ring-blue-300' : ''}
              `}
              onClick={() => onDateSelect(date)}
              data-testid={isSelected ? 'day-selected' : `day-${dayjs_date.format('YYYY-MM-DD')}`}
            >
              <div className="font-medium">{dayjs_date.format('ddd')}</div>
              <div className={`text-lg ${isToday ? 'font-bold' : ''}`}>
                {dayjs_date.date()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time Grid */}
      <div className="grid grid-cols-8 gap-px bg-gray-200 rounded-lg overflow-hidden">
        {timeSegments.map(time => (
          <React.Fragment key={time}>
            {/* Time Label */}
            <div className="p-3 bg-gray-50 text-sm font-medium text-gray-600 flex items-center justify-center border-r border-gray-200">
              {time}
            </div>
            
            {/* Time Slots for Each Day */}
            {weekDates.map(date => {
              const dateStr = dayjs(date).format('YYYY-MM-DD');
              const timeSlots = groupedSlots[dateStr]?.[time] || [];
              
              return (
                <Card
                  key={`${dateStr}-${time}`}
                  className="min-h-[60px] p-2 rounded-none border-0 bg-white hover:bg-gray-50 transition-colors"
                  data-testid={`timeslot-${dateStr}-${time}`}
                >
                  <div className="space-y-1">
                    {timeSlots.map((slot, index) => {
                      const remaining = slot.remaining ?? parseInt(slot.capacity);
                      const capacity = parseInt(slot.capacity);
                      
                      return (
                        <div
                          key={index}
                          className={`
                            text-xs p-2 rounded cursor-pointer transition-colors
                            ${slot.blackout 
                              ? 'bg-gray-100 text-gray-600 border border-gray-300' 
                              : remaining > 0 
                              ? 'bg-green-100 text-green-700 border border-green-300 hover:bg-green-200' 
                              : 'bg-red-100 text-red-700 border border-red-300'
                            }
                          `}
                          onClick={() => onSlotClick(slot)}
                          data-testid={`slot-${slot.id}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">
                              {slot.startTime} - {slot.endTime}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {slot.blackout ? 'Blocked' : `${remaining}/${capacity}`}
                            </Badge>
                          </div>
                          
                          {slot.notes && (
                            <div className="text-gray-600 truncate" title={slot.notes}>
                              {slot.notes}
                            </div>
                          )}
                          
                          {/* Booking indicators */}
                          {capacity > remaining && !slot.blackout && (
                            <div className="mt-1 space-y-1">
                              {/* TODO: Show individual bookings when booking data is available */}
                              <div className="text-xs text-gray-600">
                                {capacity - remaining} booking(s)
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}