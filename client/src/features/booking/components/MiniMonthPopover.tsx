/**
 * MiniMonthPopover - Mini-month calendar for fast long-range navigation
 * Shows month grid with availability heat-dots and allows date jumping
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { SlotWithUsage } from "@shared/schema";

interface MiniMonthPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onDateSelect: (date: string) => void;
  slots: SlotWithUsage[]; // Month aggregates
  onMonthChange?: (year: number, month: number) => void;
}

export default function MiniMonthPopover({ 
  isOpen, 
  onClose, 
  selectedDate, 
  onDateSelect, 
  slots,
  onMonthChange 
}: MiniMonthPopoverProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));

  useEffect(() => {
    if (isOpen) {
      setCurrentMonth(new Date(selectedDate));
    }
  }, [isOpen, selectedDate]);

  // Generate calendar grid for current month
  const generateCalendarGrid = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // First day of the month and last day
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Start from the Sunday of the week containing the first day
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay());
    
    // Generate 6 weeks (42 days) to ensure full month coverage
    const days = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }
    
    return { days, firstDay, lastDay };
  };

  // Get availability level for a specific date
  const getAvailabilityForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const daySlots = slots.filter(slot => slot.date === dateStr);
    
    if (daySlots.length === 0) return 'none';
    
    const totalCapacity = daySlots.reduce((sum, slot) => sum + parseInt(slot.capacity), 0);
    const remaining = daySlots.reduce((sum, slot) => sum + (slot.remaining ?? parseInt(slot.capacity)), 0);
    const hasBlackouts = daySlots.some(slot => slot.blackout);
    
    if (hasBlackouts || totalCapacity === 0) return 'grey';
    
    const availabilityPct = Math.round((remaining / totalCapacity) * 100);
    if (availabilityPct >= 50) return 'green';
    if (availabilityPct >= 20) return 'amber';
    return 'red';
  };

  // Handle month navigation
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentMonth(newMonth);
    
    // Notify parent for data fetching
    if (onMonthChange) {
      onMonthChange(newMonth.getFullYear(), newMonth.getMonth());
    }
  };

  // Handle date selection
  const handleDateSelect = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    onDateSelect(dateStr);
    onClose();
  };

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent, date: Date) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleDateSelect(date);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const prevDay = new Date(date);
      prevDay.setDate(prevDay.getDate() - 1);
      // Focus management could be enhanced here
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      // Focus management could be enhanced here
    }
  };

  const { days, firstDay, lastDay } = generateCalendarGrid();
  const isCurrentMonth = currentMonth.getMonth() === new Date().getMonth() && 
                         currentMonth.getFullYear() === new Date().getFullYear();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" role="dialog" aria-labelledby="mini-month-title">
        <DialogHeader>
          <DialogTitle id="mini-month-title" className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Jump to date
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('prev')}
              data-testid="prev-month-button"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <h3 className="text-lg font-semibold">
              {currentMonth.toLocaleDateString('en', { month: 'long', year: 'numeric' })}
            </h3>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('next')}
              data-testid="next-month-button"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day Headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            <AnimatePresence mode="wait">
              {days.map((date, index) => {
                const isCurrentMonthDay = date >= firstDay && date <= lastDay;
                const isSelected = date.toDateString() === selectedDate.toDateString();
                const isToday = date.toDateString() === new Date().toDateString();
                const availability = getAvailabilityForDate(date);
                
                // Availability dot color
                const getDotColor = () => {
                  switch (availability) {
                    case 'green': return 'bg-green-500';
                    case 'amber': return 'bg-amber-500';
                    case 'red': return 'bg-red-500';
                    case 'grey': return 'bg-gray-400';
                    default: return 'bg-transparent';
                  }
                };

                return (
                  <motion.button
                    key={`${date.toISOString()}-${index}`}
                    className={`
                      relative p-2 text-sm rounded transition-all duration-150
                      ${isCurrentMonthDay 
                        ? 'text-gray-900 hover:bg-gray-100' 
                        : 'text-gray-400'
                      }
                      ${isSelected 
                        ? 'bg-blue-500 text-white hover:bg-blue-600' 
                        : ''
                      }
                      ${isToday && !isSelected 
                        ? 'ring-2 ring-blue-300 ring-opacity-50' 
                        : ''
                      }
                    `}
                    onClick={() => handleDateSelect(date)}
                    onKeyDown={(event) => handleKeyDown(event, date)}
                    disabled={!isCurrentMonthDay}
                    aria-label={`${date.toLocaleDateString('en', { 
                      weekday: 'long', 
                      month: 'long', 
                      day: 'numeric' 
                    })}`}
                    data-testid={`calendar-day-${date.toISOString().split('T')[0]}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.01 }}
                  >
                    <span>{date.getDate()}</span>
                    
                    {/* Availability Heat Dot */}
                    {isCurrentMonthDay && availability !== 'none' && (
                      <div 
                        className={`absolute bottom-1 right-1 w-2 h-2 rounded-full ${getDotColor()}`}
                        aria-hidden="true"
                      />
                    )}
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              <span>Limited</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span>Full</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <span>Blocked</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}