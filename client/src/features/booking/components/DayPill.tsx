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
  large?: boolean; // Enable large touch-friendly mode
}

export default function DayPill({ 
  date, 
  isSelected, 
  isFocused = false,
  aggregates, 
  onClick, 
  onKeyDown, 
  'data-testid': testId,
  large = false
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
              relative rounded-full border-2 transition-all duration-200 
              ${large 
                ? (isSelected ? 'p-5 min-w-[88px] min-h-[88px]' : 'p-4 min-w-[72px] min-h-[72px]') // Selected pills are larger via padding
                : (isSelected ? 'p-4 min-w-[72px] min-h-[72px]' : 'p-3 min-w-[64px] min-h-[64px]')
              }
              ${isSelected 
                ? 'border-blue-500 bg-blue-50 shadow-lg ring-4 ring-blue-300 ring-opacity-50' 
                : isFocused 
                ? 'border-blue-300 bg-blue-50/30 shadow-md ring-2 ring-blue-200 ring-opacity-40'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }
              ${isToday && !isSelected && !isFocused ? 'ring-2 ring-blue-300 ring-opacity-30' : ''}
            `}
            onClick={onClick}
            onKeyDown={onKeyDown}
            aria-pressed={isSelected}
            aria-label={`${weekday}, ${dayNumber}. ${totalSlots} slots, ${remaining} available`}
            data-testid={testId}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            animate={{ 
              opacity: isSelected ? 1 : 0.9 
            }}
            style={{ zIndex: isSelected ? 10 : 1 }}
            transition={{ duration: 0.15 }}
          >
            {/* Main Content */}
            <div className="text-center">
              <div className={`font-medium text-gray-600 uppercase tracking-wide ${isSelected ? (large ? 'text-xs' : 'text-xs') : (large ? 'text-[10px]' : 'text-xs')}`}>
                {weekday}
              </div>
              <div className={`font-bold mt-1 ${isSelected ? (large ? 'text-2xl' : 'text-xl') : (large ? 'text-xl' : 'text-lg')} ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                {dayNumber}
              </div>
              
              {/* Availability Badge */}
              <div className={`${isSelected ? (large ? 'mt-4' : 'mt-3') : (large ? 'mt-3' : 'mt-2')}`}>
                <Badge 
                  variant={getBadgeVariant()}
                  className={`px-1.5 py-0.5 ${getBadgeColor()} ${isSelected ? (large ? 'text-xs' : 'text-xs') : (large ? 'text-[10px]' : 'text-xs')}`}
                >
                  {totalSlots === 0 ? '0' : `${remaining}`}
                </Badge>
              </div>
            </div>

            {/* Flags Row - Only show in large mode or when critical */}
            {large && (hasBlackouts || hasRestrictions || hasNotes) && (
              <div className="flex justify-center gap-1 mt-2">
                {hasBlackouts && (
                  <Ban className="w-2.5 h-2.5 text-red-500" aria-label="Blackout periods" />
                )}
                {hasRestrictions && (
                  <AlertCircle className="w-2.5 h-2.5 text-orange-500" aria-label="Restrictions apply" />
                )}
                {hasNotes && (
                  <FileText className="w-2.5 h-2.5 text-blue-500" aria-label="Special notes" />
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