import { authService } from "./auth";

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
  const url = `/v1${endpoint}`;
  const token = authService.getToken();
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  const response = await fetch(url, config);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(response.status, errorData.error || response.statusText);
  }

  return response.json();
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
    
  getSlotsRange: (startDate: string, endDate: string) =>
    apiRequest(`/slots/range?start_date=${startDate}&end_date=${endDate}`),

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

  getSlotUsage: (id: string) =>
    apiRequest(`/slots/${id}/usage`),

  applyRestrictions: (data: any) =>
    apiRequest('/restrictions/apply', {
      method: 'POST',
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

  // Templates
  getTemplates: () =>
    apiRequest('/admin/templates'),

  createTemplate: (data: any) =>
    apiRequest('/admin/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTemplate: (id: string, data: any) =>
    apiRequest(`/admin/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteTemplate: (id: string) =>
    apiRequest(`/admin/templates/${id}`, {
      method: 'DELETE',
    }),

  applyTemplate: (data: any) =>
    apiRequest('/slots/apply-template', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
