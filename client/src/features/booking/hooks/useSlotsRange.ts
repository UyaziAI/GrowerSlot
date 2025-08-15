/**
 * TanStack Query hook for fetching slots within a date range
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SlotWithUsage } from "@shared/schema";
import { authService } from "@/lib/auth";

// Helper to normalize numeric fields
const toNum = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
};

const normalizeSlot = (s: any): SlotWithUsage => ({
  ...s,
  capacity: toNum(s.capacity, 0),
  booked: toNum(s.booked, 0),
  remaining: toNum(s.remaining ?? (toNum(s.capacity, 0) - toNum(s.booked, 0)), 0),
});

export function useSlotsRange(startDate: string, endDate: string, enabled: boolean = true) {
  const user = authService.getUser();
  const tenantId = user?.tenantId || '';
  
  return useQuery({
    queryKey: ['slots', 'range', tenantId, startDate, endDate],
    queryFn: async () => {
      const slots = await api.getSlotsRange(startDate, endDate);
      return Array.isArray(slots) ? slots.map(normalizeSlot) : [];
    },
    enabled: enabled && !!startDate && !!endDate && !!tenantId,
    staleTime: 0, // No stale time for admin views - always fresh data
    refetchOnWindowFocus: true, // Aggressive refetching for admin
  });
}

export function useSlotsSingle(date: string, enabled: boolean = true) {
  const user = authService.getUser();
  const tenantId = user?.tenantId || '';
  
  return useQuery<SlotWithUsage[]>({
    queryKey: ['slots', tenantId, date],
    queryFn: async () => {
      const slots = await api.getSlots(date);
      return Array.isArray(slots) ? slots.map(normalizeSlot) : [];
    },
    enabled: enabled && !!date && !!tenantId,
    staleTime: 0, // No stale time for admin views
    refetchOnWindowFocus: true,
  });
}

// Helper to group slots by date for calendar grid
export function groupSlotsByDate(slots: SlotWithUsage[]): Record<string, SlotWithUsage[]> {
  return slots.reduce((acc, slot) => {
    const dateKey = slot.date.toString();
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(slot);
    return acc;
  }, {} as Record<string, SlotWithUsage[]>);
}

// Helper to get time segments for grid
export function getTimeSegments(startHour: number = 6, endHour: number = 18, segmentMinutes: number = 30) {
  const segments = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += segmentMinutes) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      segments.push({
        time,
        hour,
        minute,
        label: minute === 0 ? `${hour}:00` : `${hour}:${minute}`
      });
    }
  }
  return segments;
}