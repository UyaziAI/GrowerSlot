import { authService } from "./auth";
import { fetchJson } from "./http";
import { logger } from "./logger";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Use the global authentication enforcement from fetchJson
  // Convert /api endpoints to /v1 endpoints for consistency
  const v1Endpoint = endpoint.startsWith('/') ? `/v1${endpoint}` : `/v1/${endpoint}`;
  
  logger.debug('api_request_legacy', `Legacy API client redirecting to ${v1Endpoint}`, {
    original_endpoint: endpoint,
    v1_endpoint: v1Endpoint
  });
  
  try {
    return await fetchJson<T>(v1Endpoint, options);
  } catch (error: any) {
    // Convert to ApiError for compatibility
    throw new ApiError(error.status || 500, error.message);
  }
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => apiRequest('/auth/me'),

  // Slots
  getSlots: (date: string) =>
    apiRequest(`/slots?date=${date}`),

  bulkCreateSlots: (data: any) =>
    apiRequest('/slots/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSlot: (id: string, data: any) =>
    apiRequest(`/slots/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Bookings
  createBooking: (data: any) =>
    apiRequest('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getBookings: () =>
    apiRequest('/bookings'),

  cancelBooking: (id: string) =>
    apiRequest(`/bookings/${id}`, {
      method: 'DELETE',
    }),

  // Reference data
  getGrowers: () => apiRequest('/growers'),
  getCultivars: () => apiRequest('/cultivars'),

  // Admin
  getDashboardStats: (date: string) =>
    apiRequest(`/admin/stats?date=${date}`),
};
