/**
 * WeekScroller - Horizontal list of 7 DayPills with swipe support
 * Shows selected date + 6 neighbors with availability indicators
 */
import React from 'react';
import { motion } from 'framer-motion';
import { SlotWithUsage } from "@shared/schema";
import DayPill from './DayPill';

interface WeekScrollerProps {
  selectedDate: Date;
  slots: SlotWithUsage[];
  onDateSelect: (date: string) => void;
  className?: string;
}

export default function WeekScroller({ 
  selectedDate, 
  slots, 
  onDateSelect, 
  className = '' 
}: WeekScrollerProps) {
  // Generate 7 days centered around selected date
  const generateWeekDays = () => {
    const days = [];
    const startOfWeek = new Date(selectedDate);
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const weekDays = generateWeekDays();

  // Aggregate slots by date for each day pill
  const getAggregatesForDate = (date: Date): {
    totalSlots: number;
    capacityTotal: number;
    bookedTotal: number;
    remaining: number;
    utilizationPct: number;
    hasBlackouts: boolean;
    hasRestrictions: boolean;
    hasNotes: boolean;
    firstSlotTime: string | null;
    availabilityLevel: 'green' | 'amber' | 'red' | 'grey';
  } => {
    const dateStr = date.toISOString().split('T')[0];
    const daySlots = slots.filter(slot => slot.date === dateStr);
    
    const totalSlots = daySlots.length;
    const capacityTotal = daySlots.reduce((sum, slot) => sum + parseInt(slot.capacity), 0);
    const bookedTotal = daySlots.reduce((sum, slot) => sum + (parseInt(slot.capacity) - (slot.remaining ?? parseInt(slot.capacity))), 0);
    const remaining = daySlots.reduce((sum, slot) => sum + (slot.remaining ?? parseInt(slot.capacity)), 0);
    const utilizationPct = capacityTotal > 0 ? Math.round((bookedTotal / capacityTotal) * 100) : 0;
    
    // Flags
    const hasBlackouts = daySlots.some(slot => slot.blackout);
    const hasRestrictions = daySlots.some(slot => 
      slot.restrictions && (slot.restrictions.growers?.length > 0 || slot.restrictions.cultivars?.length > 0)
    );
    const hasNotes = daySlots.some(slot => slot.notes);
    const firstSlotTime = daySlots.length > 0 ? daySlots[0].startTime : null;
    
    // Availability threshold calculation
    const availabilityPct = capacityTotal > 0 ? Math.round((remaining / capacityTotal) * 100) : 0;
    let availabilityLevel: 'green' | 'amber' | 'red' | 'grey';
    
    if (hasBlackouts || totalSlots === 0) {
      availabilityLevel = 'grey';
    } else if (availabilityPct >= 50) {
      availabilityLevel = 'green';
    } else if (availabilityPct >= 20) {
      availabilityLevel = 'amber';
    } else {
      availabilityLevel = 'red';
    }

    return {
      totalSlots,
      capacityTotal,
      bookedTotal,
      remaining,
      utilizationPct,
      hasBlackouts,
      hasRestrictions,
      hasNotes,
      firstSlotTime,
      availabilityLevel
    };
  };

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent, date: Date) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const prevDay = new Date(date);
      prevDay.setDate(prevDay.getDate() - 1);
      onDateSelect(prevDay.toISOString().split('T')[0]);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      onDateSelect(nextDay.toISOString().split('T')[0]);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Week Scroller Container */}
      <div 
        className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {weekDays.map((day, index) => {
          const dateStr = day.toISOString().split('T')[0];
          const isSelected = dateStr === selectedDate.toISOString().split('T')[0];
          const aggregates = getAggregatesForDate(day);

          return (
            <motion.div
              key={dateStr}
              className="flex-shrink-0 snap-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <DayPill
                date={day}
                isSelected={isSelected}
                aggregates={aggregates}
                onClick={() => onDateSelect(dateStr)}
                onKeyDown={(event: React.KeyboardEvent) => handleKeyDown(event, day)}
                data-testid={`day-pill-${dateStr}`}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}