/**
 * Month calendar view with virtualization for performance optimization
 * Uses TanStack Virtual for rendering only visible weeks
 * Follows "no fabrication" rule - only renders authentic backend data
 */
import React, { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Skeleton } from "../../../components/ui/skeleton";
import { ChevronLeft, ChevronRight, Calendar, AlertTriangle, Lock } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { type SlotResponse } from "../../../v1/endpoints";

interface CalendarMonthProps {
  slots: SlotResponse[];
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onSlotClick?: (slot: SlotResponse) => void;
  onDayClick?: (dateISO: string) => void;
  isLoading?: boolean;
  selectionMode?: boolean;
  selectedDates?: string[];
  className?: string;
}

interface WeekProps {
  weekDates: Date[];
  slots: SlotResponse[];
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onSlotClick?: (slot: SlotResponse) => void;
  onDayClick?: (dateISO: string) => void;
  selectionMode?: boolean;
  selectedDates?: string[];
}

interface DayCellProps {
  date: Date;
  daySlots: SlotResponse[];
  isSelected: boolean;
  isToday: boolean;
  isCurrentMonth: boolean;
  onDateSelect: (date: Date) => void;
  onSlotClick?: (slot: SlotResponse) => void;
  onDayClick?: (dateISO: string) => void;
  selectionMode?: boolean;
  isDateSelected?: boolean;
}

function DayCell({ 
  date, 
  daySlots, 
  isSelected, 
  isToday, 
  isCurrentMonth, 
  onDateSelect, 
  onSlotClick,
  onDayClick,
  selectionMode,
  isDateSelected
}: DayCellProps) {
  const dateStr = date.toISOString().split('T')[0];
  
  // Calculate day stats
  const totalSlots = daySlots.length;
  const blackoutSlots = daySlots.filter(slot => slot.blackout).length;
  const restrictedSlots = daySlots.filter(slot => 
    slot.restrictions && (slot.restrictions.growers?.length > 0 || slot.restrictions.cultivars?.length > 0)
  ).length;
  const availableSlots = daySlots.filter(slot => 
    !slot.blackout && (slot.usage?.remaining ?? 0) > 0
  ).length;
  
  const getStatusBadge = () => {
    if (totalSlots === 0) return null;
    if (blackoutSlots === totalSlots) return <Badge variant="destructive" className="text-xs">Blocked</Badge>;
    if (availableSlots === 0) return <Badge variant="secondary" className="text-xs">Full</Badge>;
    if (restrictedSlots > 0) return <Badge variant="outline" className="text-xs">Restricted</Badge>;
    return <Badge variant="default" className="text-xs bg-green-500">Available</Badge>;
  };

  return (
    <Card 
      className={`
        min-h-[100px] cursor-pointer transition-all duration-200 border relative
        ${isSelected ? 'ring-2 ring-blue-500 border-blue-300' : ''}
        ${isToday ? 'bg-blue-50 border-blue-200' : ''}
        ${!isCurrentMonth ? 'opacity-40 bg-gray-50' : 'hover:bg-gray-50'}
        ${totalSlots === 0 ? 'bg-gray-25' : ''}
        ${selectionMode && isDateSelected ? 'ring-2 ring-green-500 border-green-300 bg-green-50' : ''}
      `}
      onClick={() => {
        onDateSelect(date);
        onDayClick?.(dateStr);
      }}
      data-testid={`day-cell-${dateStr}`}
    >
      {/* Selection Mode Checkmark Overlay */}
      {selectionMode && isDateSelected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
      <CardContent className="p-2">
        {/* Date header */}
        <div className="flex justify-between items-start mb-1">
          <span className={`text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
            {date.getDate()}
          </span>
          {isToday && (
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
          )}
        </div>

        {/* Status badge */}
        <div className="mb-2">
          {getStatusBadge()}
        </div>

        {/* Slot indicators (max 3 visible) */}
        <div className="space-y-1">
          {daySlots.slice(0, 3).map((slot, index) => (
            <div
              key={slot.id}
              className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer flex items-center justify-between"
              onClick={(e) => {
                e.stopPropagation();
                onSlotClick?.(slot);
              }}
              data-testid={`slot-indicator-${slot.id}`}
            >
              <span className="truncate">{slot.start_time}</span>
              <div className="flex items-center space-x-1">
                {slot.blackout && <AlertTriangle className="h-3 w-3 text-red-500" />}
                {slot.restrictions && (slot.restrictions.growers?.length > 0 || slot.restrictions.cultivars?.length > 0) && 
                  <Lock className="h-3 w-3 text-yellow-500" />
                }
              </div>
            </div>
          ))}
          
          {/* Show count if more than 3 slots */}
          {daySlots.length > 3 && (
            <div className="text-xs text-gray-500 text-center">
              +{daySlots.length - 3} more
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function WeekRow({ weekDates, slots, selectedDate, onDateSelect, onSlotClick, onDayClick, selectionMode, selectedDates }: WeekProps) {
  const selectedDateStr = selectedDate.toISOString().split('T')[0];
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  // Group slots by date for this week
  const slotsByDate = useMemo(() => {
    const grouped: Record<string, SlotResponse[]> = {};
    weekDates.forEach(date => {
      grouped[date.toISOString().split('T')[0]] = [];
    });
    
    slots.forEach(slot => {
      if (grouped[slot.date]) {
        grouped[slot.date].push(slot);
      }
    });
    
    return grouped;
  }, [weekDates, slots]);

  return (
    <div className="grid grid-cols-7 gap-1" data-testid="week-row">
      {weekDates.map(date => {
        const dateStr = date.toISOString().split('T')[0];
        const daySlots = slotsByDate[dateStr] || [];
        const isSelected = dateStr === selectedDateStr;
        const isToday = dateStr === todayStr;
        const isCurrentMonth = date.getMonth() === selectedDate.getMonth();
        
        return (
          <DayCell
            key={dateStr}
            date={date}
            daySlots={daySlots}
            isSelected={isSelected}
            isToday={isToday}
            isCurrentMonth={isCurrentMonth}
            onDateSelect={onDateSelect}
            onSlotClick={onSlotClick}
            onDayClick={onDayClick}
            selectionMode={selectionMode}
            isDateSelected={selectionMode ? selectedDates?.includes(dateStr) : false}
          />
        );
      })}
    </div>
  );
}

export default function CalendarMonth({
  slots,
  selectedDate,
  onDateSelect,
  onSlotClick,
  onDayClick,
  isLoading = false,
  selectionMode = false,
  selectedDates = [],
  className = ""
}: CalendarMonthProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Generate weeks for the month view (6 weeks to cover all possible month layouts)
  const weeks = useMemo(() => {
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const startOfCalendar = new Date(startOfMonth);
    
    // Go back to Sunday of the week containing the first day of the month
    const dayOfWeek = startOfMonth.getDay();
    startOfCalendar.setDate(startOfMonth.getDate() - dayOfWeek);
    
    const weeks: Date[][] = [];
    const currentDate = new Date(startOfCalendar);
    
    // Generate 6 weeks (42 days) to cover all possible month layouts
    for (let week = 0; week < 6; week++) {
      const weekDates: Date[] = [];
      for (let day = 0; day < 7; day++) {
        weekDates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(weekDates);
    }
    
    return weeks;
  }, [selectedDate]);

  // Virtual list for weeks
  const virtualizer = useVirtualizer({
    count: weeks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Estimated height per week row
    overscan: 1, // Render 1 extra week above and below visible area
  });

  const handlePrevMonth = () => {
    const prevMonth = new Date(selectedDate);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    onDateSelect(prevMonth);
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(selectedDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    onDateSelect(nextMonth);
  };

  const monthYear = selectedDate.toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });

  if (isLoading) {
    return (
      <div className={`calendar-month ${className}`} data-testid="calendar-month-loading">
        <div className="space-y-4">
          {/* Header skeleton */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-40" />
            <div className="flex space-x-2">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
          
          {/* Weekday headers skeleton */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
          
          {/* Week rows skeleton */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }).map((_, j) => (
                <Skeleton key={j} className="h-24 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`calendar-month ${className}`} data-testid="calendar-month">
      {/* Month header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-gray-500" />
          <h2 className="text-xl font-semibold text-gray-900">{monthYear}</h2>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevMonth}
            data-testid="prev-month-btn"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextMonth}
            data-testid="next-month-btn"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-sm font-medium text-gray-500 p-2 text-center">
            {day}
          </div>
        ))}
      </div>

      {/* Virtualized weeks */}
      <div
        ref={parentRef}
        className="h-[600px] overflow-auto"
        data-testid="virtualized-weeks-container"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
              data-testid={`virtual-week-${virtualItem.index}`}
            >
              <div className="p-1">
                <WeekRow
                  weekDates={weeks[virtualItem.index]}
                  slots={slots}
                  selectedDate={selectedDate}
                  onDateSelect={onDateSelect}
                  onSlotClick={onSlotClick}
                  onDayClick={onDayClick}
                  selectionMode={selectionMode}
                  selectedDates={selectedDates}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}