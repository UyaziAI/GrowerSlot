/**
 * useSlotsRange - React Query hook for fetching slots by date range
 * No placeholderData or keepPreviousData for admin views
 */
import { useQuery } from '@tanstack/react-query';
import { SlotWithUsage } from '@shared/schema';
import { authService } from '@/lib/auth';

const fetchSlotsRange = async (
  startDate: string,
  endDate: string,
  tenantId: string
): Promise<SlotWithUsage[]> => {
  const params = new URLSearchParams({
    start: startDate,
    end: endDate
  });

  const response = await fetch(`/api/slots/range?${params}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch slots: ${response.statusText}`);
  }

  return response.json();
};

export function useSlotsRange(
  startDate: string,
  endDate: string,
  growerView: boolean = false
) {
  const user = authService.getUser();
  const tenantId = user?.tenantId || '';
  
  // Build query key with tenant and date range for proper cache invalidation
  const queryKey = ['slots', 'range', tenantId, startDate, endDate];
  
  return useQuery({
    queryKey,
    queryFn: () => fetchSlotsRange(startDate, endDate, tenantId),
    enabled: !!user && !!tenantId,
    staleTime: growerView ? 30000 : 0, // Shorter cache for admin views
    // No placeholderData or keepPreviousData for admin - show loading instead
    refetchOnWindowFocus: !growerView // More aggressive refetching for admin
  });
}