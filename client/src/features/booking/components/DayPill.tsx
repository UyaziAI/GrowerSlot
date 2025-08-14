/**
 * DayPill - Individual day button in WeekScroller
 * Shows weekday, date, availability badge, and tiny flags
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Ban, FileText } from 'lucide-react';

export interface DayAggregates {
  totalSlots: number;
  capacityTotal: number;
  bookedTotal: number;
  remaining: number;
  utilizationPct: number;
  hasBlackouts: boolean;
  hasRestrictions: boolean;
  hasNotes: boolean;
  firstSlotTime: string | null;
  availabilityLevel: 'green' | 'amber' | 'red' | 'grey';
}

interface DayPillProps {
  date: Date;
  isSelected: boolean;
  isFocused?: boolean; // Visual highlight from scroll
  aggregates: DayAggregates;
  onClick: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  'data-testid'?: string;
}

export default function DayPill({ 
  date, 
  isSelected, 
  isFocused = false,
  aggregates, 
  onClick, 
  onKeyDown, 
  'data-testid': testId
}: DayPillProps) {
  const { 
    totalSlots, 
    remaining, 
    hasBlackouts, 
    hasRestrictions, 
    hasNotes, 
    firstSlotTime, 
    availabilityLevel 
  } = aggregates;

  // Get availability badge colors
  const getBadgeVariant = () => {
    switch (availabilityLevel) {
      case 'green': return 'default';
      case 'amber': return 'secondary';
      case 'red': return 'destructive';
      case 'grey': return 'outline';
      default: return 'outline';
    }
  };

  const getBadgeColor = () => {
    switch (availabilityLevel) {
      case 'green': return 'bg-green-500 text-white';
      case 'amber': return 'bg-amber-500 text-white';
      case 'red': return 'bg-red-500 text-white';
      case 'grey': return 'bg-gray-400 text-white';
      default: return 'bg-gray-200 text-gray-600';
    }
  };

  // Format date components
  const weekday = date.toLocaleDateString('en', { weekday: 'short' });
  const dayNumber = date.getDate();
  const isToday = date.toDateString() === new Date().toDateString();

  // Tooltip content
  const tooltipContent = (
    <div className="text-sm">
      <div className="font-semibold">{date.toLocaleDateString('en', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      })}</div>
      {totalSlots > 0 ? (
        <>
          <div className="mt-1">
            <span className="text-green-400">{remaining}</span> available of {totalSlots} slots
          </div>
          {firstSlotTime && (
            <div>First slot: {firstSlotTime}</div>
          )}
          {(hasBlackouts || hasRestrictions || hasNotes) && (
            <div className="mt-1 text-xs text-gray-300">
              {hasBlackouts && '• Blackout periods'}
              {hasRestrictions && '• Restrictions apply'}
              {hasNotes && '• Special notes'}
            </div>
          )}
        </>
      ) : (
        <div className="mt-1 text-gray-400">No slots available</div>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={`
              relative flex items-center justify-center overflow-hidden rounded-full border-2 transition-all duration-200 
              w-[84px] h-[84px] flex-shrink-0
              ${isSelected 
                ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-300' 
                : isFocused 
                ? 'border-blue-300 bg-blue-50/30 shadow-sm ring-1 ring-blue-200'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }
              ${isToday && !isSelected && !isFocused ? 'ring-1 ring-blue-300 ring-opacity-50' : ''}
            `}
            onClick={onClick}
            onKeyDown={onKeyDown}
            aria-pressed={isSelected}
            aria-label={`${weekday}, ${dayNumber}. ${totalSlots} slots, ${remaining} available`}
            data-testid={testId}
            style={{ zIndex: isSelected ? 10 : 1 }}
          >
            {/* Main Content - Fixed container to prevent growth */}
            <div className="text-center w-full h-full flex flex-col justify-center items-center overflow-hidden">
              <div className="font-medium text-gray-600 uppercase tracking-wide text-xs truncate w-full px-1">
                {weekday}
              </div>
              <div className={`font-bold text-lg leading-none ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                {dayNumber}
              </div>
              
              {/* Availability Badge - Increased size for longer labels */}
              <div className="mt-1">
                <div className={`
                  inline-flex items-center justify-center px-1.5 py-0.5 rounded text-xs font-medium
                  min-w-[24px] max-w-[56px] h-4 overflow-hidden
                  ${getBadgeColor()}
                `}>
                  <span className="truncate text-xs leading-none">
                    {totalSlots === 0 ? '0' : remaining > 999 ? '999+' : `${remaining}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Flags Row - Positioned absolutely to not affect layout */}
            {(hasBlackouts || hasRestrictions || hasNotes) && (
              <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                {hasBlackouts && (
                  <Ban className="w-2 h-2 text-red-500" aria-label="Blackout periods" />
                )}
                {hasRestrictions && (
                  <AlertCircle className="w-2 h-2 text-orange-500" aria-label="Restrictions apply" />
                )}
                {hasNotes && (
                  <FileText className="w-2 h-2 text-blue-500" aria-label="Special notes" />
                )}
              </div>
            )}

            {/* Today Indicator */}
            {isToday && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-gray-800 text-white">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}