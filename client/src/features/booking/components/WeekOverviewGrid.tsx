/**
 * Week Overview Grid - Shows 7 day cards with summary availability
 * Replaces hourly calendar layout per Blueprint Section 7 UX plan
 */
import React from 'react';
import { SlotWithUsage } from "@shared/schema";
import DayCard from './DayCard';

interface WeekOverviewGridProps {
  anchorDate: Date; // Start of 7-day range
  slots: SlotWithUsage[];
  onSelectDate: (date: string) => void;
  className?: string;
}

interface DaySummary {
  date: string;
  weekday: string;
  totalSlots: number;
  totalCapacity: number;
  booked: number;
  remaining: number;
  utilization: number;
  hasBlackout: boolean;
  hasRestrictions: boolean;
  earliestTime?: string;
  notes?: string;
}

export default function WeekOverviewGrid({ 
  anchorDate, 
  slots, 
  onSelectDate, 
  className = "" 
}: WeekOverviewGridProps) {
  
  // Generate 7 days starting from anchorDate (Sunday)
  const generateWeekDates = (startDate: Date): string[] => {
    const dates = [];
    const current = new Date(startDate);
    
    for (let i = 0; i < 7; i++) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  };

  // Aggregate slot data per day
  const aggregateByDay = (slotsData: SlotWithUsage[]): Record<string, DaySummary> => {
    const weekDates = generateWeekDates(anchorDate);
    const summaries: Record<string, DaySummary> = {};

    // Do NOT initialize summaries for days without slots - only process backend data
    
    // Aggregate slot data from backend only
    slotsData.forEach(slot => {
      const slotDate = slot.date.toString();
      
      // Only create summary if slot exists in backend
      if (!summaries[slotDate]) {
        const dateObj = new Date(slotDate);
        summaries[slotDate] = {
          date: slotDate,
          weekday: dateObj.toLocaleDateString('en', { weekday: 'short' }),
          totalSlots: 0,
          totalCapacity: 0,
          booked: 0,
          remaining: 0,
          utilization: 0,
          hasBlackout: false,
          hasRestrictions: false,
          earliestTime: undefined,
          notes: undefined
        };
      }

      const summary = summaries[slotDate];
      const capacity = Number(slot.capacity) || 0;
      const booked = Number(slot.booked) || 0;
      const remaining = Number(slot.remaining ?? capacity - booked) || 0;

      summary.totalSlots++;
      summary.totalCapacity += capacity;
      summary.booked += booked;
      summary.remaining += remaining;

      if (slot.blackout) {
        summary.hasBlackout = true;
      }

      if (slot.restrictions && (slot.restrictions.growers?.length > 0 || slot.restrictions.cultivars?.length > 0)) {
        summary.hasRestrictions = true;
      }

      // Track earliest time
      if (!summary.earliestTime || slot.startTime < summary.earliestTime) {
        summary.earliestTime = slot.startTime;
      }

      // Collect notes (if any)
      if (slot.notes && !summary.notes) {
        summary.notes = slot.notes;
      }
    });

    // Calculate utilization percentages
    Object.values(summaries).forEach(summary => {
      if (summary.totalCapacity > 0) {
        summary.utilization = (summary.booked / summary.totalCapacity) * 100;
      }
    });

    return summaries;
  };

  const daySummaries = aggregateByDay(slots);
  const weekDates = generateWeekDates(anchorDate);

  return (
    <div className={`week-overview-grid ${className}`}>
      {/* Desktop: 7 columns, 1 row */}
      <div className="hidden lg:grid lg:grid-cols-7 gap-4">
        {weekDates.map(date => (
          <DayCard
            key={date}
            summary={daySummaries[date]}
            onSelect={() => onSelectDate(date)}
            data-testid={`day-card-${date}`}
          />
        ))}
      </div>

      {/* Tablet: 3-4 columns, multiple rows */}
      <div className="hidden md:grid lg:hidden md:grid-cols-4 gap-4">
        {weekDates.map(date => (
          <DayCard
            key={date}
            summary={daySummaries[date]}
            onSelect={() => onSelectDate(date)}
            data-testid={`day-card-${date}`}
          />
        ))}
      </div>

      {/* Mobile: 2 columns, scrollable */}
      <div className="md:hidden grid grid-cols-2 gap-3 overflow-x-auto">
        {weekDates.map(date => (
          <DayCard
            key={date}
            summary={daySummaries[date]}
            onSelect={() => onSelectDate(date)}
            compact
            data-testid={`day-card-${date}`}
          />
        ))}
      </div>
    </div>
  );
}