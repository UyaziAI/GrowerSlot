/**
 * HTTP utilities for admin interface with verbatim error handling
 * Ensures 4xx server errors are displayed exactly as received
 */

export interface ApiError {
  status: number;
  message: string;
}

/**
 * Fetches data with verbatim error handling for 4xx responses
 * Includes authentication headers when token is available
 * Returns exact server error message from json.error field
 */
export async function fetchWithVerbatimErrors(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  // Get auth token from localStorage (direct access for simplicity)
  const token = localStorage.getItem('token');
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
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

    const error = new Error(errorMessage) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  return response;
}

/**
 * Convenience wrapper for JSON responses with verbatim error handling
 * Includes authentication headers automatically
 */
export async function fetchJson<T = any>(
  url: string, 
  options: RequestInit = {}
): Promise<T> {
  const response = await fetchWithVerbatimErrors(url, options);
  return response.json();
}