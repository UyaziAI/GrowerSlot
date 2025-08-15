/**
 * HTTP utilities for admin interface with verbatim error handling
 * Ensures 4xx server errors are displayed exactly as received
 * Enforces global authentication for all requests
 */

export interface ApiError {
  status: number;
  message: string;
}

/**
 * Global authentication enforcement utility
 * Checks for valid auth before making any request
 */
function enforceAuthentication(): string | null {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  if (!token || !userStr) {
    // Clear any stale auth data and redirect
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    return null;
  }
  
  try {
    const user = JSON.parse(userStr);
    if (user.role !== 'admin') {
      // Not an admin, redirect to appropriate page
      window.location.href = '/';
      return null;
    }
  } catch {
    // Invalid user data, clear and redirect
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    return null;
  }
  
  return token;
}

/**
 * Fetches data with verbatim error handling for 4xx responses
 * Enforces authentication globally before any request
 * Returns exact server error message from json.error field
 */
export async function fetchWithVerbatimErrors(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  // Enforce authentication globally for all admin requests
  const token = enforceAuthentication();
  if (!token) {
    // Authentication failed, redirect already handled
    throw new Error('Authentication required');
  }
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    
    try {
      const errorData = await response.json();
      // Use exact server error message if available
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // Fallback to status text if JSON parsing fails
      errorMessage = response.statusText || errorMessage;
    }

    // Handle 401 errors by clearing auth and redirecting
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return response; // Return to avoid popup
    }

    const error = new Error(errorMessage) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  return response;
}

/**
 * Convenience wrapper for JSON responses with verbatim error handling
 * Includes global authentication enforcement
 */
export async function fetchJson<T = any>(
  url: string, 
  options: RequestInit = {}
): Promise<T> {
  const response = await fetchWithVerbatimErrors(url, options);
  return response.json();
}