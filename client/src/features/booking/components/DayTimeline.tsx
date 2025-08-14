/**
 * DayTimeline - Continuous horizontally scrollable day strip with virtualization
 * Replaces WeekScroller with infinite scrolling and snap-to-center selection
 */
import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import { SlotWithUsage } from "@shared/schema";
import DayPill from './DayPill';

interface DayTimelineProps {
  selectedDate: Date;
  focusedDate: Date;
  slots: SlotWithUsage[];
  onDateSelect: (date: string) => void;
  onFocusChange: (date: string) => void;
  className?: string;
}

interface DayTimelineRef {
  centerOnDate: (date: Date) => void;
}

// Date mapping helpers for precise day-level calculations
const EPOCH = new Date('2024-01-01'); // Stable epoch for consistent mapping

const dateFromIndex = (index: number): Date => {
  const date = new Date(EPOCH);
  date.setDate(EPOCH.getDate() + index);
  return date;
};

const indexFromDate = (date: Date): number => {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0); // Start of day
  const epochStart = new Date(EPOCH);
  epochStart.setHours(0, 0, 0, 0);
  return Math.floor((normalizedDate.getTime() - epochStart.getTime()) / (24 * 60 * 60 * 1000));
};

// Generate date range for virtualization (360-day window around center)
const generateDateRange = (centerDate: Date) => {
  const centerIndex = indexFromDate(centerDate);
  const dates = [];
  
  for (let i = -180; i < 180; i++) { // 180 days before and after
    dates.push(dateFromIndex(centerIndex + i));
  }
  
  return dates;
};

// Get aggregates for a specific date
const getAggregatesForDate = (date: Date, slots: SlotWithUsage[]) => {
  const dateStr = date.toISOString().split('T')[0];
  const daySlots = slots.filter(slot => slot.date === dateStr);
  
  const totalSlots = daySlots.length;
  const capacityTotal = daySlots.reduce((sum, slot) => sum + parseInt(slot.capacity), 0);
  const bookedTotal = daySlots.reduce((sum, slot) => sum + (parseInt(slot.capacity) - (slot.remaining ?? parseInt(slot.capacity))), 0);
  const remaining = daySlots.reduce((sum, slot) => sum + (slot.remaining ?? parseInt(slot.capacity)), 0);
  
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
    utilizationPct: capacityTotal > 0 ? Math.round((bookedTotal / capacityTotal) * 100) : 0,
    hasBlackouts,
    hasRestrictions,
    hasNotes,
    firstSlotTime,
    availabilityLevel
  };
};

const DayTimeline = forwardRef<DayTimelineRef, DayTimelineProps>(({ 
  selectedDate,
  focusedDate, 
  slots, 
  onDateSelect,
  onFocusChange, 
  className = '' 
}, ref) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [dates] = useState(() => generateDateRange(selectedDate));
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<NodeJS.Timeout>();

  // Find indices for selected and focused dates
  const selectedIndex = dates.findIndex(
    date => date.toISOString().split('T')[0] === selectedDate.toISOString().split('T')[0]
  );
  
  const focusedIndex = dates.findIndex(
    date => date.toISOString().split('T')[0] === focusedDate.toISOString().split('T')[0]
  );

  // Virtualization setup
  const virtualizer = useVirtualizer({
    count: dates.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimated width per day pill
    horizontal: true,
    overscan: 5
  });

  // Debounced scroll handler for focus changes only (no auto-selection)
  const handleScrollEnd = useCallback(() => {
    if (!parentRef.current) return;
    
    const container = parentRef.current;
    const mid = container.scrollLeft + container.clientWidth / 2;
    
    // Find the nearest item to center
    const items = virtualizer.getVirtualItems();
    let nearest = items[0];
    let minDistance = Infinity;
    
    items.forEach(item => {
      const itemCenter = (item.start || 0) + 50; // 50 is half of estimated item width
      const distance = Math.abs(itemCenter - mid);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = item;
      }
    });
    
    if (nearest) {
      const nearestDate = dates[nearest.index];
      const nearestDateStr = nearestDate.toISOString().split('T')[0];
      const focusedDateStr = focusedDate.toISOString().split('T')[0];
      
      // Update focus only, not selection
      if (nearestDateStr !== focusedDateStr) {
        onFocusChange(nearestDateStr);
      }
    }
    
    setIsScrolling(false);
  }, [dates, focusedDate, onFocusChange, virtualizer]);

  // Handle scroll events with debouncing
  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;

    const handleScroll = () => {
      setIsScrolling(true);
      
      // Clear existing timeout
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      
      // Set new timeout for scroll end detection
      scrollTimeout.current = setTimeout(handleScrollEnd, 150);
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, [handleScrollEnd]);

  // Centering logic via imperative handle
  const centerOnDate = useCallback((date: Date) => {
    const container = parentRef.current;
    if (!container) return;
    
    const targetIndex = dates.findIndex(
      d => d.toISOString().split('T')[0] === date.toISOString().split('T')[0]
    );
    
    if (targetIndex !== -1) {
      const offset = virtualizer.getOffsetForIndex(targetIndex);
      const centerOffset = (offset || 0) - (container.clientWidth - 100) / 2;
      
      container.scrollTo({
        left: Math.max(0, centerOffset),
        behavior: 'smooth'
      });
    }
  }, [dates, virtualizer]);

  // Expose centerOnDate method
  useImperativeHandle(ref, () => ({
    centerOnDate
  }), [centerOnDate]);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (focusedIndex > 0) {
        const prevDate = dates[focusedIndex - 1];
        onDateSelect(prevDate.toISOString().split('T')[0]);
      }
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (focusedIndex < dates.length - 1) {
        const nextDate = dates[focusedIndex + 1];
        onDateSelect(nextDate.toISOString().split('T')[0]);
      }
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        ref={parentRef}
        className="overflow-x-auto scrollbar-hide"
        style={{
          height: '120px',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain'
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="tablist"
        aria-label="Day timeline"
      >
        <div
          style={{
            height: '100%',
            width: `${virtualizer.getTotalSize()}px`,
            position: 'relative'
          }}
        >
          {virtualizer.getVirtualItems().map(virtualItem => {
            const date = dates[virtualItem.index];
            const dateStr = date.toISOString().split('T')[0];
            const isSelected = dateStr === selectedDate.toISOString().split('T')[0];
            const isFocused = dateStr === focusedDate.toISOString().split('T')[0];
            const aggregates = getAggregatesForDate(date, slots);

            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: `${virtualItem.size}px`,
                  height: '100%',
                  transform: `translateX(${virtualItem.start}px)`,
                  scrollSnapAlign: 'center'
                }}
              >
                <motion.div
                  className="h-full flex items-center justify-center px-2"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  <DayPill
                    date={date}
                    isSelected={isSelected}
                    isFocused={isFocused}
                    aggregates={aggregates}
                    onClick={() => onDateSelect(dateStr)}
                    onKeyDown={(event: React.KeyboardEvent) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onDateSelect(dateStr);
                      }
                    }}
                    data-testid={`day-pill-${dateStr}`}
                    large={true} // Enable large touch-friendly mode
                  />
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

DayTimeline.displayName = 'DayTimeline';
export default DayTimeline;