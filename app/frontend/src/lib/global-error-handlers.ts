/**
 * Global error handlers for comprehensive error capture
 * Integrates with structured logging system
 */

import { logger } from './logger';

export function setupGlobalErrorHandlers(): void {
  // Capture unhandled JavaScript errors
  window.addEventListener('error', (event) => {
    logger.error('unhandled_error', 'Unhandled JavaScript error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error_stack: event.error?.stack
    });
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('unhandled_rejection', 'Unhandled Promise rejection', {
      reason: event.reason?.toString(),
      promise: event.promise?.toString(),
      stack: event.reason?.stack
    });
  });

  // Capture console errors (optional - for catching logged errors)
  if (import.meta.env.DEV) {
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // Still call original console.error
      originalConsoleError.apply(console, args);
      
      // Log to our structured logger if it's not already from our logger
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      if (!message.includes('"level":')) { // Avoid logging our own log entries
        logger.error('console_error', 'Console error captured', {
          console_args: args.length,
          message: message.slice(0, 500) // Limit length
        });
      }
    };
  }
}

// React Query error handler
export function setupReactQueryErrorHandler() {
  return {
    onError: (error: Error, query: any) => {
      logger.error('react_query_error', 'React Query error', {
        error_message: error.message,
        query_key: query?.queryKey,
        query_state: query?.state?.status,
        error_stack: error.stack
      });
    }
  };
}