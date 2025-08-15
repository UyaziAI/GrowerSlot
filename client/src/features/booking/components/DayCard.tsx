/**
 * Day Card component - Shows daily availability summary
 * Part of Week Overview Grid replacing hourly calendar layout
 */
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock, AlertTriangle, Clock } from "lucide-react";

interface DaySummary {
  date: string;
  weekday: string;
  totalSlots: number;
  totalCapacity: number;
  booked: number;
  remaining: number;
  utilization: number;
  hasBlackout: boolean;
  hasRestrictions: boolean;
  earliestTime?: string;
  notes?: string;
}

interface DayCardProps {
  summary: DaySummary;
  onSelect: () => void;
  compact?: boolean;
  className?: string;
}

export default function DayCard({ 
  summary, 
  onSelect, 
  compact = false, 
  className = "" 
}: DayCardProps) {
  
  // Determine availability badge color based on remaining capacity
  const getAvailabilityBadge = () => {
    if (summary.totalCapacity === 0 || summary.hasBlackout) {
      return { variant: "secondary" as const, text: "No Capacity", color: "bg-gray-400" };
    }
    
    const remainingPercent = (summary.remaining / summary.totalCapacity) * 100;
    
    if (remainingPercent >= 50) {
      return { variant: "default" as const, text: "Available", color: "bg-green-500" };
    } else if (remainingPercent >= 20) {
      return { variant: "outline" as const, text: "Limited", color: "bg-amber-500" };
    } else if (remainingPercent > 0) {
      return { variant: "destructive" as const, text: "Nearly Full", color: "bg-red-500" };
    } else {
      return { variant: "destructive" as const, text: "Full", color: "bg-red-600" };
    }
  };

  const availabilityBadge = getAvailabilityBadge();
  
  // Format date for display
  const formatDate = () => {
    const dateObj = new Date(summary.date);
    return dateObj.getDate();
  };

  // Create accessibility label
  const getAriaLabel = () => {
    const dateObj = new Date(summary.date);
    const fullDate = dateObj.toLocaleDateString('en', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
    
    return `${fullDate}, ${availabilityBadge.text}, ${summary.totalSlots} slots, ${summary.remaining} capacity remaining${summary.hasRestrictions ? ', has restrictions' : ''}${summary.hasBlackout ? ', blackout period' : ''}`;
  };

  // Determine card styling based on status
  const getCardClass = () => {
    const baseClass = "cursor-pointer transition-all duration-200 hover:shadow-md border-l-4";
    
    if (summary.hasBlackout) {
      return `${baseClass} bg-gray-100 opacity-75 border-l-gray-400`;
    }
    
    const remainingPercent = summary.totalCapacity > 0 ? (summary.remaining / summary.totalCapacity) * 100 : 0;
    
    if (remainingPercent >= 50) {
      return `${baseClass} bg-white hover:bg-green-50 border-l-green-500`;
    } else if (remainingPercent >= 20) {
      return `${baseClass} bg-white hover:bg-amber-50 border-l-amber-500`;
    } else if (remainingPercent > 0) {
      return `${baseClass} bg-white hover:bg-red-50 border-l-red-500`;
    } else {
      return `${baseClass} bg-red-50 border-l-red-600`;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card 
            className={`${getCardClass()} ${compact ? 'min-h-[100px]' : 'min-h-[120px]'} ${className}`}
            onClick={onSelect}
            role="button"
            tabIndex={0}
            aria-label={getAriaLabel()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect();
              }
            }}
          >
            <CardContent className={compact ? "p-3" : "p-4"}>
              {/* Header with weekday and date */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className={`font-medium ${compact ? 'text-sm' : 'text-base'}`}>
                    {summary.weekday}
                  </div>
                  <div className={`text-2xl font-bold ${compact ? 'text-xl' : 'text-2xl'}`}>
                    {formatDate()}
                  </div>
                </div>
                <Badge variant={availabilityBadge.variant} className={compact ? 'text-xs' : ''}>
                  {availabilityBadge.text}
                </Badge>
              </div>

              {/* Quick facts */}
              <div className={`space-y-1 ${compact ? 'text-xs' : 'text-sm'} text-gray-600`}>
                {summary.totalSlots > 0 && (
                  <div className="flex items-center justify-between">
                    <span>{summary.totalSlots} slots</span>
                    {summary.earliestTime && (
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {summary.earliestTime}
                      </span>
                    )}
                  </div>
                )}
                
                {summary.totalCapacity > 0 && (
                  <div className="flex items-center justify-between">
                    <span>{summary.remaining} remaining</span>
                    <span>{Math.round(summary.utilization)}% booked</span>
                  </div>
                )}

                {/* Indicators */}
                <div className="flex items-center space-x-2 mt-2">
                  {summary.hasRestrictions && (
                    <div className="flex items-center text-amber-600">
                      <Lock className="h-3 w-3 mr-1" />
                      <span className="text-xs">Restricted</span>
                    </div>
                  )}
                  
                  {summary.hasBlackout && (
                    <div className="flex items-center text-gray-500">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      <span className="text-xs">Blackout</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        
        <TooltipContent side="top" className="max-w-sm">
          <div className="space-y-1">
            <div className="font-medium">{summary.weekday}, {formatDate()}</div>
            <div>Total Capacity: {summary.totalCapacity}</div>
            <div>Available: {summary.remaining}</div>
            <div>Utilization: {Math.round(summary.utilization)}%</div>
            {summary.hasRestrictions && (
              <div className="text-amber-600">⚠️ Has restrictions</div>
            )}
            {summary.hasBlackout && (
              <div className="text-red-600">🚫 Blackout period</div>
            )}
            {summary.notes && (
              <div className="text-sm text-gray-600 mt-1">
                Note: {summary.notes}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}