/**
 * DayTimeline - Continuous horizontally scrollable day strip with virtualization
 * Uses stable EPOCH-based indexing with tenant timezone normalization
 */
import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { SlotWithUsage } from "@shared/schema";
import DayPill from './DayPill';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

interface DayTimelineProps {
  selectedDate: Date;
  focusedDate: Date;
  slots: SlotWithUsage[];
  onDateSelect: (date: string) => void;
  onFocusChange: (date: string) => void;
  className?: string;
  tenantTz?: string;
}

interface DayTimelineRef {
  centerOnDate: (date: Date | string, opts?: ScrollToOptions) => Promise<void>;
}

// Get aggregates for a specific date with timezone normalization
const getAggregatesForDate = (date: dayjs.Dayjs, slots: SlotWithUsage[]) => {
  const dateStr = date.format('YYYY-MM-DD');
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
  className = '',
  tenantTz = 'Africa/Johannesburg'
}, ref) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<NodeJS.Timeout>();

  // Stable EPOCH and total days for virtualization (center around 2024 for wider range)
  const EPOCH = dayjs.tz('2023-01-01', tenantTz).startOf('day');
  const totalDays = 365 * 5; // 5-year window (2023-2028)

  // Timezone-aware date mapping helpers
  const indexFromDate = (d: dayjs.ConfigType) => 
    dayjs(d).tz(tenantTz).startOf('day').diff(EPOCH, 'day');
  
  const dateFromIndex = (i: number) => 
    EPOCH.add(i, 'day');

  // Convert dates to timezone-normalized dayjs objects
  const selectedDayjs = dayjs(selectedDate).tz(tenantTz).startOf('day');
  const focusedDayjs = dayjs(focusedDate).tz(tenantTz).startOf('day');
  
  // Calculate indices using stable math (no array search)
  const selectedIndex = indexFromDate(selectedDayjs);
  const focusedIndex = indexFromDate(focusedDayjs);

  // Virtualization setup with stable total count
  const virtualizer = useVirtualizer({
    count: totalDays,
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
      const nearestDate = dateFromIndex(nearest.index);
      const nearestDateStr = nearestDate.format('YYYY-MM-DD');
      const focusedDateStr = focusedDayjs.format('YYYY-MM-DD');
      
      // Update focus only, not selection
      if (nearestDateStr !== focusedDateStr) {
        onFocusChange(nearestDateStr);
      }
    }
    
    setIsScrolling(false);
  }, [focusedDayjs, onFocusChange, virtualizer, dateFromIndex]);

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

  // Centering logic using stable index math (no array search)
  const centerOnDate = useCallback(async (date: Date | string, opts?: ScrollToOptions) => {
    const container = parentRef.current;
    if (!container) {
      console.log('centerOnDate: container not available');
      return;
    }
    
    const d = dayjs(date).tz(tenantTz).startOf('day');
    console.log('centerOnDate called with:', d.format('YYYY-MM-DD'));
    console.log('EPOCH:', EPOCH.format('YYYY-MM-DD'));
    
    // Settle layout and ensure virtualizer is measured
    await Promise.resolve();
    virtualizer.measure();
    
    const idx = indexFromDate(d);
    console.log('Target index calculated:', idx, 'for date:', d.format('YYYY-MM-DD'), 'EPOCH diff:', d.diff(EPOCH, 'day'));
    console.log('Container width:', container.clientWidth, 'Total days:', totalDays);
    
    // Ensure index is within bounds
    if (idx >= 0 && idx < totalDays) {
      const offset = virtualizer.getOffsetForIndex(idx);
      console.log('Raw offset from virtualizer:', offset);
      
      if (offset != null) {
        const itemWidth = 100; // Approximate pill width
        const centerOffset = Number(offset) - (container.clientWidth - itemWidth) / 2;
        
        console.log('Scrolling to offset:', centerOffset, 'from calculated offset:', offset, 'container width:', container.clientWidth);
        
        container.scrollTo({
          left: Math.max(0, centerOffset),
          behavior: opts?.behavior ?? 'smooth'
        });
        
        // Log final scroll position after a brief delay
        setTimeout(() => {
          console.log('Final scroll position:', container.scrollLeft);
        }, 100);
      } else {
        console.log('Virtualizer returned null offset for index:', idx);
      }
    } else {
      console.log('Date index out of bounds:', idx, 'total days:', totalDays, 'EPOCH:', EPOCH.format('YYYY-MM-DD'));
    }
  }, [virtualizer, tenantTz, indexFromDate, totalDays, EPOCH]);

  // Expose centerOnDate method
  useImperativeHandle(ref, () => ({
    centerOnDate
  }), [centerOnDate]);

  // Debug: Log when component mounts/unmounts
  useEffect(() => {
    console.log('DayTimeline mounted');
    return () => console.log('DayTimeline unmounted');
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (focusedIndex > 0) {
        const prevDate = dateFromIndex(focusedIndex - 1);
        onDateSelect(prevDate.format('YYYY-MM-DD'));
      }
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (focusedIndex < totalDays - 1) {
        const nextDate = dateFromIndex(focusedIndex + 1);
        onDateSelect(nextDate.format('YYYY-MM-DD'));
      }
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        ref={parentRef}

        className="overflow-x-auto overflow-y-hidden snap-x snap-mandatory touch-pan-x overscroll-x-contain overscroll-y-none whitespace-nowrap h-[88px] flex items-stretch [-webkit-overflow-scrolling:touch] scrollbar-hide"
        style={{
          scrollSnapType: 'x mandatory',
          overscrollBehaviorX: 'contain',
          overscrollBehaviorY: 'none'
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
            const date = dateFromIndex(virtualItem.index);
            const dateStr = date.format('YYYY-MM-DD');
            const isSelected = date.isSame(selectedDayjs, 'day');
            const isFocused = date.isSame(focusedDayjs, 'day');
            const aggregates = getAggregatesForDate(date, slots);

            return (
              <div
                key={virtualItem.key}
                className="inline-flex snap-center items-stretch h-full"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: `${virtualItem.size}px`,
                  height: '100%',
                  transform: `translateX(${virtualItem.start}px)`
                }}
              >
                <motion.div
                  className="h-full flex items-center justify-center px-2"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  <DayPill
                    date={date.toDate()}
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