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

// Fixed pill sizing constants (px)
const PILL_SIZE = 84;         // increased size to accommodate longer labels like "155.5"
const RING_SELECTED = 2;      // Tailwind ring-2 (px) for selected state
const SHADOW_SPACE = 4;       // space for shadows and subtle effects
const SAFETY = 6;             // adequate safety margin for ring clipping prevention

// Track height = pill size + ring + shadow + safety
const ITEM_TRACK = PILL_SIZE + (RING_SELECTED * 2) + SHADOW_SPACE + SAFETY; // e.g. 84 + 4 + 4 + 6 = 98px

// Even padding top/bottom for the scroll lane (px)
const RAIL_PAD_Y = 8; // further reduced for snug fit while preventing clipping

// Rail/container heights
const RAIL_MIN_HEIGHT = ITEM_TRACK + (RAIL_PAD_Y * 2); // e.g. 98 + 16 = 114px

// Sticky month header height
const MONTH_HEADER_HEIGHT = 32; // height for sticky month header

// Development verification
if (import.meta.env.DEV) {
  console.log('DayTimeline fixed sizing constants:', { 
    PILL_SIZE, RING_SELECTED, SHADOW_SPACE, SAFETY,
    ITEM_TRACK, RAIL_MIN_HEIGHT, RAIL_PAD_Y, MONTH_HEADER_HEIGHT
  });
}

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
const getAggregatesForDate = (date: dayjs.Dayjs, slots: SlotWithUsage[]): DayAggregates => {
  const dateStr = date.format('YYYY-MM-DD');
  const daySlots = slots.filter(slot => slot.date === dateStr);
  
  const totalSlots = daySlots.length;
  
  // If no slots exist for this date, return empty state (no availability data)
  if (totalSlots === 0) {
    return {
      totalSlots: 0,
      capacityTotal: 0,
      bookedTotal: 0,
      remaining: 0,
      utilizationPct: 0,
      hasBlackouts: false,
      hasRestrictions: false,
      hasNotes: false,
      firstSlotTime: null,
      availabilityLevel: 'grey'
    };
  }
  
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
  
  // Availability threshold calculation only for days with actual slots
  const availabilityPct = capacityTotal > 0 ? Math.round((remaining / capacityTotal) * 100) : 0;
  let availabilityLevel: 'green' | 'amber' | 'red' | 'grey';
  
  if (hasBlackouts) {
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
  
  // Track current visible month for sticky header
  const [currentMonth, setCurrentMonth] = useState<string>('');
  
  // Update current month on initial render and selected date changes
  useEffect(() => {
    if (selectedDate) {
      const monthLabel = dayjs(selectedDate).tz(tenantTz).format('MMMM YYYY').toUpperCase();
      setCurrentMonth(monthLabel);
    }
  }, [selectedDate, tenantTz]);

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

  // Update month header based on center pill
  const updateMonthHeader = useCallback(() => {
    if (!parentRef.current) return;
    
    const container = parentRef.current;
    const mid = container.scrollLeft + container.clientWidth / 2;
    
    // Find the nearest item to center
    const items = virtualizer.getVirtualItems();
    if (items.length === 0) return;
    
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
      const monthLabel = nearestDate.format('MMMM YYYY').toUpperCase();
      
      // Update month header if different
      if (monthLabel !== currentMonth) {
        setCurrentMonth(monthLabel);
      }
    }
  }, [virtualizer, currentMonth, fromVirtualIndex, dateFromIndex]);

  // Update month header when virtualizer items change (after render/scroll)
  useEffect(() => {
    updateMonthHeader();
  }, [updateMonthHeader]);

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
      
      // Update month header immediately during scroll (if updateMonthHeader is available)
      if (typeof updateMonthHeader === 'function') {
        updateMonthHeader();
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
  }, [handleScrollEnd, updateMonthHeader]);

  // Centering logic using scrollIntoView for better reliability
  const centerOnDate = useCallback(async (date: Date | string, opts?: ScrollToOptions) => {
    const container = parentRef.current;
    if (!container) {
      console.log('centerOnDate: container not available');
      return;
    }
    
    const d = dayjs(date).tz(tenantTz).startOf('day');
    const dateStr = d.format('YYYY-MM-DD');
    
    // Settle layout and ensure virtualizer is measured
    await Promise.resolve();
    virtualizer.measure();
    
    const dateIdx = indexFromDate(d);
    const virtualIdx = toVirtualIndex(dateIdx);
    const isWithinRange = virtualIdx >= 0 && virtualIdx < totalDays;
    
    if (!isWithinRange) {
      console.warn('Target date outside current virtualizer range');
      return;
    }
    
    // Try to find the target pill element
    const targetPill = container.querySelector(`[data-testid="day-pill-${dateStr}"], [data-testid="pill-selected"]`);
    
    if (targetPill) {
      // Use scrollIntoView for precise centering
      targetPill.scrollIntoView({
        behavior: opts?.behavior === 'instant' ? 'instant' : 'smooth',
        block: 'nearest',
        inline: 'center'
      });
      
      // Set focus for accessibility
      if (targetPill instanceof HTMLElement) {
        targetPill.focus();
      }
      
      // Update month header after centering
      setTimeout(() => updateMonthHeader(), 100);
    } else {
      // Fallback: use virtualizer scrollToIndex
      if (typeof virtualizer.scrollToIndex === 'function') {
        virtualizer.scrollToIndex(virtualIdx, { align: 'center' });
        // Update month header after programmatic centering
        setTimeout(() => updateMonthHeader(), 100);
      }
    }
  }, [virtualizer, tenantTz, indexFromDate, totalDays, updateMonthHeader]);

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
    <div className={`w-full overflow-visible ${className}`} style={{ minHeight: RAIL_MIN_HEIGHT + MONTH_HEADER_HEIGHT }}>
      {/* Sticky Month Header */}
      <div 
        className="sticky top-0 z-20 w-full bg-white border-b border-gray-200 flex items-center justify-center"
        style={{ height: MONTH_HEADER_HEIGHT }}
        role="banner"
        aria-live="polite"
        aria-label={`Current month: ${currentMonth}`}
      >
        <h2 className="text-sm font-bold text-gray-700 tracking-wide">
          {currentMonth}
        </h2>
      </div>
      
      <div
        ref={parentRef}
        className="overflow-x-auto overflow-y-visible flex items-center [-webkit-overflow-scrolling:touch] scrollbar-hide"
        style={{
          height: RAIL_MIN_HEIGHT,
          paddingTop: RAIL_PAD_Y,
          paddingBottom: RAIL_PAD_Y,
          scrollSnapType: 'x mandatory',
          overscrollBehaviorX: 'contain',
          overscrollBehaviorY: 'none'
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="tablist"
        aria-label="Day timeline"
        data-testid="timeline-rail"
      >
        <div
          className="overflow-visible relative flex items-center"
          style={{
            height: ITEM_TRACK,
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
            
            // No flank logic needed with uniform sizing

            return (
              <div
                key={virtualItem.key}
                className="flex items-center justify-center overflow-visible"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: `${virtualItem.size}px`,
                  height: ITEM_TRACK,
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
                    data-testid={isSelected ? 'pill-selected' : `day-pill-${dateStr}`}
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