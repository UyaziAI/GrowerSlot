import { QueryClient } from "@tanstack/react-query";
import { logger } from "./logger";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Log query failures
        logger.warn('query_failure', 'React Query retry', {
          failure_count: failureCount,
          error_message: error?.message,
          error_status: error?.status
        });
        
        // Don't retry on auth errors (401) or client errors (4xx)
        if (error?.status === 401 || (error?.status >= 400 && error?.status < 500)) {
          return false;
        }
        
        return failureCount < 3;
      },
      onError: (error: any) => {
        logger.error('react_query_error', 'Query failed', {
          error_message: error?.message,
          error_status: error?.status,
          error_stack: error?.stack
        });
      }
    },
    mutations: {
      onError: (error: any, variables: any, context: any) => {
        logger.error('mutation_error', 'Mutation failed', {
          error_message: error?.message,
          error_status: error?.status,
          mutation_variables: typeof variables === 'object' ? Object.keys(variables || {}) : undefined
        });
      }
    }
  }
});