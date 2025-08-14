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
  aggregates: DayAggregates;
  onClick: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  'data-testid'?: string;
}

export default function DayPill({ 
  date, 
  isSelected, 
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
          <motion.button
            className={`
              relative p-3 rounded-lg border-2 transition-all duration-200 min-w-[80px]
              ${isSelected 
                ? 'border-blue-500 bg-blue-50 shadow-md' 
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }
              ${isToday ? 'ring-2 ring-blue-300 ring-opacity-50' : ''}
            `}
            onClick={onClick}
            onKeyDown={onKeyDown}
            aria-pressed={isSelected}
            aria-label={`${weekday}, ${dayNumber}. ${totalSlots} slots, ${remaining} available`}
            data-testid={testId}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            animate={{ 
              scale: isSelected ? 1.05 : 1,
              opacity: isSelected ? 1 : 0.9 
            }}
            transition={{ duration: 0.15 }}
          >
            {/* Main Content */}
            <div className="text-center">
              <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                {weekday}
              </div>
              <div className={`text-lg font-bold mt-1 ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                {dayNumber}
              </div>
              
              {/* Availability Badge */}
              <div className="mt-2">
                <Badge 
                  variant={getBadgeVariant()}
                  className={`text-xs px-2 py-1 ${getBadgeColor()}`}
                >
                  {totalSlots === 0 ? 'None' : `${remaining}/${totalSlots}`}
                </Badge>
              </div>
            </div>

            {/* Flags Row */}
            {(hasBlackouts || hasRestrictions || hasNotes) && (
              <div className="flex justify-center gap-1 mt-2">
                {hasBlackouts && (
                  <Ban className="w-3 h-3 text-red-500" aria-label="Blackout periods" />
                )}
                {hasRestrictions && (
                  <AlertCircle className="w-3 h-3 text-orange-500" aria-label="Restrictions apply" />
                )}
                {hasNotes && (
                  <FileText className="w-3 h-3 text-blue-500" aria-label="Special notes" />
                )}
              </div>
            )}

            {/* Today Indicator */}
            {isToday && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>
            )}
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-gray-800 text-white">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}