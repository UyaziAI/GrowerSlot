/**
 * Structured logging utility for frontend diagnostics
 * Provides dev-friendly JSON logging with prod-safe sampling
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  message: string;
  ctx?: Record<string, any>;
  requestId?: string;
}

export interface NetworkLogEntry extends LogEntry {
  method: string;
  path: string;
  status: number;
  duration: number;
  requestId: string;
}

class Logger {
  private ringBuffer: LogEntry[] = [];
  private maxBufferSize = 200;
  private isDev = import.meta.env.DEV;
  private debugLogsEnabled = import.meta.env.VITE_FEATURE_DEBUG_LOGS === 'true';

  private shouldLog(level: LogLevel): boolean {
    if (!this.isDev) {
      // Prod: only warn/error/fatal
      return ['warn', 'error', 'fatal'].includes(level);
    }
    // Dev: all levels
    return true;
  }

  private createEntry(level: LogLevel, event: string, message: string, ctx?: Record<string, any>, requestId?: string): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      event,
      message,
      ctx: this.sanitizeContext(ctx),
      requestId
    };
  }

  private sanitizeContext(ctx?: Record<string, any>): Record<string, any> | undefined {
    if (!ctx) return undefined;

    const sanitized = { ...ctx };
    
    // Remove sensitive data
    const sensitiveKeys = ['password', 'token', 'authorization', 'cookie', 'secret', 'key'];
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private addToBuffer(entry: LogEntry): void {
    this.ringBuffer.push(entry);
    if (this.ringBuffer.length > this.maxBufferSize) {
      this.ringBuffer.shift();
    }
  }

  private log(level: LogLevel, event: string, message: string, ctx?: Record<string, any>, requestId?: string): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createEntry(level, event, message, ctx, requestId);
    
    // Add to ring buffer for debug overlay
    this.addToBuffer(entry);

    // Console output in dev
    if (this.isDev) {
      const consoleMethod = level === 'fatal' || level === 'error' ? 'error' :
                           level === 'warn' ? 'warn' : 'log';
      console[consoleMethod](JSON.stringify(entry, null, 2));
    }
  }

  debug(event: string, message: string, ctx?: Record<string, any>, requestId?: string): void {
    this.log('debug', event, message, ctx, requestId);
  }

  info(event: string, message: string, ctx?: Record<string, any>, requestId?: string): void {
    this.log('info', event, message, ctx, requestId);
  }

  warn(event: string, message: string, ctx?: Record<string, any>, requestId?: string): void {
    this.log('warn', event, message, ctx, requestId);
  }

  error(event: string, message: string, ctx?: Record<string, any>, requestId?: string): void {
    this.log('error', event, message, ctx, requestId);
  }

  fatal(event: string, message: string, ctx?: Record<string, any>, requestId?: string): void {
    this.log('fatal', event, message, ctx, requestId);
  }

  // Network-specific logging
  logNetworkFailure(method: string, path: string, status: number, duration: number, requestId: string, error?: Error): void {
    const entry: NetworkLogEntry = {
      ...this.createEntry('error', 'network_failure', `${method} ${path} failed with ${status}`, {
        method,
        path: this.sanitizePath(path),
        status,
        duration,
        error_message: error?.message
      }, requestId),
      method,
      path: this.sanitizePath(path),
      status,
      duration,
      requestId
    };

    this.addToBuffer(entry);

    if (this.isDev) {
      console.error(JSON.stringify(entry, null, 2));
    }
  }

  private sanitizePath(path: string): string {
    // Remove query parameters that might contain sensitive data
    return path.split('?')[0];
  }

  // Get logs for debug overlay
  getLogs(): LogEntry[] {
    return [...this.ringBuffer];
  }

  // Filter logs for debug overlay
  filterLogs(level?: LogLevel, event?: string): LogEntry[] {
    return this.ringBuffer.filter(entry => {
      if (level && entry.level !== level) return false;
      if (event && entry.event !== event) return false;
      return true;
    });
  }

  // Export logs as JSON
  exportLogs(): string {
    return JSON.stringify(this.ringBuffer, null, 2);
  }

  // Clear ring buffer
  clear(): void {
    this.ringBuffer = [];
  }

  // Check if debug overlay should be enabled
  isDebugEnabled(): boolean {
    return this.debugLogsEnabled;
  }
}

// Singleton instance
export const logger = new Logger();

// Generate request ID for correlation
export function generateRequestId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}