/**
 * HTTP utilities for admin interface with verbatim error handling
 * Ensures 4xx server errors are displayed exactly as received
 * Enforces global authentication for all requests
 * Includes structured logging and request correlation
 */

import { logger, generateRequestId } from './logger';
import { authService } from './auth';

export interface ApiError {
  status: number;
  message: string;
}

/**
 * Global authentication enforcement utility
 * Checks for valid auth before making any request
 */
function enforceAuthentication(): string | null {
  const token = authService.getToken();
  const user = authService.getUser();

  if (!token) {
    // No token at all – clear auth state and redirect to login
    authService.logout();
    window.location.href = '/login';
    return null;
  }

  // If we have user info, ensure it's an admin account
  if (user && user.role !== 'admin') {
    window.location.href = '/';
    return null;
  }

  return token;
}

/**
 * Fetches data with verbatim error handling for 4xx responses
 * Enforces authentication globally before any request
 * Includes structured logging and request correlation
 * Returns exact server error message from json.error field
 */
export async function fetchWithVerbatimErrors(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const method = options.method || 'GET';

  // Enforce authentication globally for all admin requests
  const token = enforceAuthentication();
  if (!token) {
    // Authentication failed, redirect already handled
    logger.warn('auth_enforcement', 'Authentication required for request', {
      url,
      method,
      auth_reason: 'missing_token'
    }, requestId);
    throw new Error('Authentication required');
  }

  // Enhanced request context logging with call stack
  const stack = new Error().stack;
  const callerLine = stack?.split('\n')[3] || 'unknown';
  
  logger.info('admin_api_call_context', `${method} ${url}`, {
    url,
    method,
    request_id: requestId,
    caller_context: callerLine,
    has_token: !!token,
    auth_header_type: token ? 'Bearer' : null,
    gating_snapshot: {
      tokenPresent: !!token,
      authReady: !!authService.getToken(),
      localStorage_token: !!localStorage.getItem('token'),
      timestamp: new Date().toISOString()
    }
  });

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Request-ID': requestId,
        ...options.headers,
      },
      ...options,
    });

    const duration = Date.now() - startTime;

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

      // Log network failure
      logger.logNetworkFailure(method, url, response.status, duration, requestId);

      // Handle 401 errors by clearing auth and redirecting
      if (response.status === 401) {
        logger.warn('auth_failure', 'Token expired or invalid', {
          url,
          method,
          status: response.status,
          auth_reason: 'token_invalid'
        }, requestId);
        
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return response; // Return to avoid popup
      }

      const error = new Error(errorMessage) as Error & { status: number };
      error.status = response.status;
      throw error;
    }

    // Log successful request
    logger.debug('api_response', `${method} ${url} succeeded`, {
      url,
      method,
      status: response.status,
      duration
    }, requestId);

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error instanceof Error && !('status' in error)) {
      // Network error (not HTTP error)
      logger.error('network_error', `${method} ${url} network failure`, {
        url,
        method,
        duration,
        error_message: error.message
      }, requestId);
    }
    
    throw error;
  }
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