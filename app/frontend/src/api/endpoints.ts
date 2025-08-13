/**
 * Typed API endpoints following the blueprint specification
 */
import { apiClient } from './client';

// Types matching the Pydantic schemas
export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: string;
  email: string;
  role: string;
  tenant_id: string;
  grower_id?: string;
}

export interface SlotResponse {
  id: string;
  tenant_id: string;
  date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  resource_unit: string;
  blackout: boolean;
  notes?: string;
  restrictions?: {
    growers: string[];
    cultivars: string[];
  };
  usage?: {
    capacity: number;
    booked: number;
    remaining: number;
  };
}

export interface BookingCreate {
  slot_id: string;
  grower_id: string;
  cultivar_id?: string;
  quantity: number;
}

export interface BookingResponse {
  id: string;
  slot_id: string;
  tenant_id: string;
  grower_id: string;
  cultivar_id?: string;
  quantity: number;
  status: string;
  created_at: string;
  grower_name?: string;
  cultivar_name?: string;
}

export interface ConsignmentResponse {
  id: string;
  booking_id: string;
  tenant_id: string;
  consignment_number: string;
  supplier_id: string;
  transporter_id?: string;
  expected_quantity: number;
  actual_quantity?: number;
  status: string;
  created_at: string;
  latest_checkpoint?: {
    type: string;
    timestamp: string;
    payload: Record<string, any>;
  };
}

// API methods
export const authApi = {
  login: (data: LoginRequest): Promise<TokenResponse> => apiClient.login(data.email, data.password),
  getCurrentUser: (): Promise<UserResponse> => apiClient.getCurrentUser(),
};

export const slotsApi = {
  getSlots: (date?: string): Promise<SlotResponse[]> => apiClient.getSlots(date),
  bulkCreateSlots: (data: any): Promise<{ count: number; message: string }> => apiClient.bulkCreateSlots(data),
  updateSlot: (id: string, data: any): Promise<SlotResponse> => apiClient.updateSlot(id, data),
  getSlotUsage: (id: string): Promise<{ capacity: number; booked: number; remaining: number }> => apiClient.getSlotUsage(id),
};

export const bookingsApi = {
  createBooking: (data: BookingCreate): Promise<BookingResponse> => apiClient.createBooking(data),
  getBookings: (date?: string, growerId?: string): Promise<BookingResponse[]> => apiClient.getBookings(date, growerId),
  cancelBooking: (id: string): Promise<{ message: string }> => apiClient.cancelBooking(id),
};

export const restrictionsApi = {
  applyRestrictions: (data: any): Promise<{ message: string }> => apiClient.applyRestrictions(data),
};

export const logisticsApi = {
  createConsignment: (data: any): Promise<ConsignmentResponse> => apiClient.createConsignment(data),
  getConsignments: (date?: string): Promise<ConsignmentResponse[]> => apiClient.getConsignments(date),
  createCheckpoint: (consignmentId: string, data: any): Promise<any> => apiClient.createCheckpoint(consignmentId, data),
};