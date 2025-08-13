/**
 * API client with authentication header support
 * Configured for the unified blueprint structure
 */
import { authService } from '../core/auth';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
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
      throw new ApiError(response.status, errorData.detail || response.statusText);
    }

    return response.json();
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  // Slot endpoints
  async getSlots(date?: string) {
    const params = date ? `?date=${date}` : '';
    return this.request(`/v1/slots${params}`);
  }

  async getSlotsRange(startDate: string, endDate: string) {
    const params = `?start_date=${startDate}&end_date=${endDate}`;
    return this.request(`/v1/slots/range${params}`);
  }

  async bulkCreateSlots(data: any) {
    return this.request('/v1/slots/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSlot(id: string, data: any) {
    return this.request(`/v1/slots/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getSlotUsage(id: string) {
    return this.request(`/v1/slots/${id}/usage`);
  }

  // Booking endpoints
  async createBooking(data: any) {
    return this.request('/v1/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getBookings(date?: string, growerId?: string) {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (growerId) params.append('grower_id', growerId);
    const queryString = params.toString();
    
    return this.request(`/v1/bookings${queryString ? '?' + queryString : ''}`);
  }

  async cancelBooking(id: string) {
    return this.request(`/v1/bookings/${id}`, {
      method: 'DELETE',
    });
  }

  // Restriction endpoints
  async applyRestrictions(data: any) {
    return this.request('/v1/restrictions/apply', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Logistics endpoints
  async createConsignment(data: any) {
    return this.request('/v1/logistics/consignments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getConsignments(date?: string) {
    const params = date ? `?date=${date}` : '';
    return this.request(`/v1/logistics/consignments${params}`);
  }

  async createCheckpoint(consignmentId: string, data: any) {
    return this.request(`/v1/logistics/consignments/${consignmentId}/checkpoints`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Legacy compatibility methods (for existing frontend)
  async getDashboardStats(date: string) {
    // This would need to be implemented in the FastAPI backend
    // For now, return mock data to maintain compatibility
    const slots = await this.getSlots(date);
    const totalSlots = slots.length;
    const availableSlots = slots.filter((s: any) => !s.blackout && s.usage.remaining > 0).length;
    const bookedSlots = slots.filter((s: any) => s.usage.booked > 0).length;
    
    return {
      totalSlots,
      availableSlots,
      bookedSlots,
      utilizationRate: totalSlots > 0 ? (bookedSlots / totalSlots) * 100 : 0
    };
  }

  async getGrowers() {
    // Implement when needed
    return [];
  }

  async getCultivars() {
    // Implement when needed  
    return [];
  }
}

export const apiClient = new ApiClient();