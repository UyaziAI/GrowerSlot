/**
 * DayTimeline - Continuous horizontally scrollable day strip with virtualization
 * Uses stable EPOCH-based indexing with tenant timezone normalization
 */
import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
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

  // Dynamic EPOCH = today at midnight for optimal index range
  const EPOCH = useMemo(() => dayjs().tz(tenantTz).startOf('day'), [tenantTz]); // Today's midnight
  
  // Dynamic range calculation based on selected date
  const todayDayjs = useMemo(() => dayjs().tz(tenantTz).startOf('day'), [tenantTz]);
  const selectedDayjs = useMemo(() => dayjs(selectedDate).tz(tenantTz).startOf('day'), [selectedDate, tenantTz]);
  const focusedDayjs = useMemo(() => dayjs(focusedDate).tz(tenantTz).startOf('day'), [focusedDate, tenantTz]);
  
  // Calculate range expansion for selected date
  const daysDiffFromToday = selectedDayjs.diff(todayDayjs, 'day');
  const daysBefore = 30; // Fixed past range
  const daysAfter = Math.max(30, Math.abs(daysDiffFromToday) + 5); // Expand for far dates
  const totalDays = Math.min(730, daysBefore + daysAfter + 1); // Cap at 2 years max
  const todayVirtualIndex = daysBefore; // Today's position in virtualizer

  // Dynamic index calculation: today = 0, yesterday = -1, tomorrow = +1
  const indexFromDate = (d: dayjs.ConfigType) => 
    dayjs(d).tz(tenantTz).startOf('day').diff(EPOCH, 'day');
  
  const dateFromIndex = (i: number) => 
    EPOCH.add(i, 'day');
  
  // Convert index to virtualizer index (offset by daysBefore to handle negative indices)
  const toVirtualIndex = (dateIndex: number) => dateIndex + daysBefore;
  const fromVirtualIndex = (virtualIndex: number) => virtualIndex - daysBefore;
  
  // Calculate date indices (can be negative)
  const selectedDateIndex = indexFromDate(selectedDayjs);
  const focusedDateIndex = indexFromDate(focusedDayjs);
  
  // Convert to virtualizer indices (always positive)
  const selectedIndex = toVirtualIndex(selectedDateIndex);
  const focusedIndex = toVirtualIndex(focusedDateIndex);

  // Constant item width for stable calculations
  const ITEM_WIDTH = 100;
  
  // Virtualization setup with proper scroll element binding
  const virtualizer = useVirtualizer({
    horizontal: true,
    count: totalDays,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_WIDTH,
    overscan: 10,
  });
  
  // Debug: Log dynamic range expansion and EPOCH setup
  useEffect(() => {
    console.log('Dynamic EPOCH timeline setup:');
    console.log('EPOCH (today midnight):', EPOCH.format('YYYY-MM-DD'));
    console.log('Selected date:', selectedDayjs.format('YYYY-MM-DD'));
    console.log('Days diff from today:', daysDiffFromToday, '(negative = past, positive = future)');
    console.log('Range expansion - daysBefore:', daysBefore, 'daysAfter:', daysAfter);
    console.log('Total virtualizer items:', totalDays, '(capped at 730)');
    console.log('Today date index:', indexFromDate(todayDayjs), '(should be 0)');
    console.log('Today virtualizer index:', todayVirtualIndex, '(position of today in virtualizer)');
    console.log('Selected virtualizer index:', selectedIndex);
    console.log('Scroll element binding - parentRef exists:', !!parentRef.current);
    console.log('getScrollElement():', !!virtualizer.options.getScrollElement?.());
    console.log('Elements match:', virtualizer.options.getScrollElement?.() === parentRef.current);
  }, [selectedDate, totalDays, daysDiffFromToday, daysBefore, daysAfter]);

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
      const dateIndex = fromVirtualIndex(nearest.index);
      const nearestDate = dateFromIndex(dateIndex);
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

  // Centering logic using virtualizer's own scroll API
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
    
    const dateIdx = indexFromDate(d);
    const virtualIdx = toVirtualIndex(dateIdx);
    const targetDiff = d.diff(todayDayjs, 'day');
    const isWithinRange = virtualIdx >= 0 && virtualIdx < totalDays;
    
    console.log('centerOnDate target:', d.format('YYYY-MM-DD'));
    console.log('Target date index:', dateIdx, 'days from today (0=today, -1=yesterday, +1=tomorrow)');
    console.log('Target days diff from today:', targetDiff);
    console.log('Virtual index:', virtualIdx, 'within range:', isWithinRange);
    console.log('Current range: daysBefore=', daysBefore, 'daysAfter=', daysAfter, 'totalDays=', totalDays);
    console.log('Container width:', container.clientWidth, 'scrollLeft before:', container.scrollLeft);
    
    if (!isWithinRange) {
      console.warn('Target date outside current virtualizer range - may need range expansion');
      return;
    }
    
    // Use virtualizer's scroll API for reliable centering
    try {
      // Try scrollToIndex if available
      if (typeof virtualizer.scrollToIndex === 'function') {
        console.log('Using virtualizer.scrollToIndex with virtual index:', virtualIdx);
        virtualizer.scrollToIndex(virtualIdx, { align: 'center' });
      } else {
        // Fallback: compute from virtual items
        console.log('Using virtual items fallback with virtual index:', virtualIdx);
        const items = virtualizer.getVirtualItems();
        const item = items.find(v => v.index === virtualIdx);
        
        if (item) {
          const target = item.start - (container.clientWidth - ITEM_WIDTH) / 2;
          console.log('Virtual item found - start:', item.start, 'target scroll:', target);
          
          container.scrollTo({
            left: Math.max(0, target),
            behavior: opts?.behavior ?? 'smooth'
          });
        } else {
          // Force virtualizer to create the item by estimating position
          const estimatedStart = virtualIdx * ITEM_WIDTH;
          const target = estimatedStart - (container.clientWidth - ITEM_WIDTH) / 2;
          console.log('Virtual item not found - estimated start:', estimatedStart, 'target scroll:', target);
          
          container.scrollTo({
            left: Math.max(0, target),
            behavior: opts?.behavior ?? 'smooth'
          });
        }
      }
      
      // Log final scroll position after a brief delay
      setTimeout(() => {
        console.log('Final scroll position:', container.scrollLeft);
        const items = virtualizer.getVirtualItems();
        console.log('Virtual items range:', items.length > 0 ? `${items[0].index}-${items[items.length-1].index}` : 'none');
      }, 100);
      
    } catch (error) {
      console.error('Error in centerOnDate:', error);
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
        const prevDateIndex = fromVirtualIndex(focusedIndex - 1);
        const prevDate = dateFromIndex(prevDateIndex);
        onDateSelect(prevDate.format('YYYY-MM-DD'));
      }
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (focusedIndex < totalDays - 1) {
        const nextDateIndex = fromVirtualIndex(focusedIndex + 1);
        const nextDate = dateFromIndex(nextDateIndex);
        onDateSelect(nextDate.format('YYYY-MM-DD'));
      }
    }
  };

  return (
    <div className={`w-full overflow-visible ${className}`} style={{ minHeight: '120px' }}>
      <div
        ref={parentRef}

        className="overflow-x-auto overflow-y-visible flex items-center [-webkit-overflow-scrolling:touch] scrollbar-hide"
        style={{
          height: '120px',
          paddingTop: '20px',
          paddingBottom: '20px',
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
          className="overflow-visible relative flex items-center"
          style={{
            height: '80px',
            width: `${virtualizer.getTotalSize()}px`,
            position: 'relative',
            zIndex: 1
          }}
        >
          {virtualizer.getVirtualItems().map(virtualItem => {
            const dateIndex = fromVirtualIndex(virtualItem.index);
            const date = dateFromIndex(dateIndex);
            const dateStr = date.format('YYYY-MM-DD');
            const isSelected = date.isSame(selectedDayjs, 'day');
            const isFocused = date.isSame(focusedDayjs, 'day');
            const aggregates = getAggregatesForDate(date, slots);

            return (
              <div
                key={virtualItem.key}
                className="flex items-center justify-center overflow-visible"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: `${virtualItem.size}px`,
                  height: '80px',
                  transform: `translateX(${virtualItem.start}px)`
                }}
              >
                <div
                  className="overflow-visible relative flex items-center justify-center"
                  style={{ zIndex: 1 }}
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
                </div>
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