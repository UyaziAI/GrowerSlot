/**
 * Debug overlay for viewing and filtering logs during development
 * Only enabled when VITE_FEATURE_DEBUG_LOGS=true
 */

import React, { useState, useEffect } from 'react';
import { logger, LogEntry, LogLevel } from '../lib/logger';
import { X, Download, Filter, Trash2 } from 'lucide-react';

interface DebugOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DebugOverlay({ isOpen, onClose }: DebugOverlayProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'all'>('all');
  const [filterEvent, setFilterEvent] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen || !autoRefresh) return;

    const interval = setInterval(() => {
      const filteredLogs = filterLevel === 'all' 
        ? logger.getLogs() 
        : logger.filterLogs(filterLevel);
      
      const eventFiltered = filterEvent 
        ? filteredLogs.filter(log => log.event.includes(filterEvent))
        : filteredLogs;
        
      setLogs(eventFiltered);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, autoRefresh, filterLevel, filterEvent]);

  const handleExport = () => {
    const dataStr = logger.exportLogs();
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `debug-logs-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    logger.clear();
    setLogs([]);
  };

  const getLevelColor = (level: LogLevel): string => {
    switch (level) {
      case 'fatal': return 'text-red-800 bg-red-100';
      case 'error': return 'text-red-700 bg-red-50';
      case 'warn': return 'text-yellow-700 bg-yellow-50';
      case 'info': return 'text-blue-700 bg-blue-50';
      case 'debug': return 'text-gray-700 bg-gray-50';
      default: return 'text-gray-700 bg-gray-50';
    }
  };

  if (!isOpen || !logger.isDebugEnabled()) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-11/12 h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Debug Logs ({logs.length})</h2>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-sm">
              <input 
                type="checkbox" 
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh
            </label>
            <button 
              onClick={handleExport}
              className="p-1 hover:bg-gray-100 rounded"
              title="Export logs"
            >
              <Download className="h-4 w-4" />
            </button>
            <button 
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded"
              title="Clear logs"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 p-4 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <select 
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value as LogLevel | 'all')}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="all">All Levels</option>
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
              <option value="fatal">Fatal</option>
            </select>
          </div>
          <input 
            type="text"
            placeholder="Filter by event..."
            value={filterEvent}
            onChange={(e) => setFilterEvent(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-auto font-mono text-xs">
          {logs.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No logs match current filters</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="border-b p-2 hover:bg-gray-50">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getLevelColor(log.level)}`}>
                    {log.level.toUpperCase()}
                  </span>
                  <span className="text-gray-500">{log.timestamp}</span>
                  <span className="font-medium">{log.event}</span>
                  {log.requestId && (
                    <span className="text-xs text-blue-600 bg-blue-100 px-1 rounded">
                      {log.requestId}
                    </span>
                  )}
                </div>
                <div className="text-gray-800 mb-1">{log.message}</div>
                {log.ctx && (
                  <details className="text-gray-600">
                    <summary className="cursor-pointer text-xs">Context</summary>
                    <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto">
                      {JSON.stringify(log.ctx, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}