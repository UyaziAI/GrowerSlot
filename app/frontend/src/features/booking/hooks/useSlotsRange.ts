/**
 * TanStack Query hook for fetching slots within a date range
 */
import { useQuery } from "@tanstack/react-query";
import { slotsApi, type SlotResponse } from "../../../v1/endpoints";

export function useSlotsRange(startDate: string, endDate: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['slots-range', startDate, endDate],
    queryFn: () => slotsApi.getSlotsRange(startDate, endDate),
    enabled: enabled && !!startDate && !!endDate,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 30, // 30 seconds for real-time updates
  });
}

export function useSlotsSingle(date: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['slots', date],
    queryFn: () => slotsApi.getSlots(date),
    enabled: enabled && !!date,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 30, // 30 seconds
  });
}

// Helper to group slots by date for calendar grid
export function groupSlotsByDate(slots: SlotResponse[]): Record<string, SlotResponse[]> {
  return slots.reduce((acc, slot) => {
    const dateKey = slot.date.toString();
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(slot);
    return acc;
  }, {} as Record<string, SlotResponse[]>);
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