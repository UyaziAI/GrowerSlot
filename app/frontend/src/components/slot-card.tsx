import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Weight, Sprout } from "lucide-react";
import { SlotWithUsage } from "@shared/schema";

interface SlotCardProps {
  slot: SlotWithUsage;
  onBook?: (slot: SlotWithUsage) => void;
  onEdit?: (slot: SlotWithUsage) => void;
  onToggleBlackout?: (slot: SlotWithUsage) => void;
  isAdmin?: boolean;
}

export default function SlotCard({ 
  slot, 
  onBook, 
  onEdit, 
  onToggleBlackout, 
  isAdmin = false 
}: SlotCardProps) {
  const getStatusBadge = () => {
    if (slot.blackout) {
      return <Badge variant="secondary">Blackout</Badge>;
    }
    
    if (slot.remaining <= 0) {
      return <Badge variant="destructive">Full</Badge>;
    }
    
    if (slot.remaining < Number(slot.capacity) * 0.5) {
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Limited</Badge>;
    }
    
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Available</Badge>;
  };

  const isBookable = !slot.blackout && slot.remaining > 0;
  
  return (
    <div 
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200 ${
        !isBookable ? 'opacity-60' : ''
      }`}
      data-testid={`card-slot-${slot.id}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <div className="text-lg font-semibold text-gray-900" data-testid="text-time-range">
              {slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}
            </div>
            {getStatusBadge()}
          </div>
          
          {!slot.blackout && (
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center">
                <Weight className="mr-1 h-4 w-4" />
                <span data-testid="text-capacity">
                  {slot.remaining} / {slot.capacity} tons remaining
                </span>
              </div>
              <div className="flex items-center">
                <Sprout className="mr-1 h-4 w-4" />
                <span>All cultivars</span>
              </div>
            </div>
          )}
          
          {slot.notes && (
            <div className="mt-2 text-sm text-gray-500" data-testid="text-notes">
              {slot.notes}
            </div>
          )}
          
          {isAdmin && (
            <div className="mt-1 text-xs text-gray-600">
              {slot.bookingCount} bookings
            </div>
          )}
        </div>
        
        <div className="flex-shrink-0">
          {isAdmin ? (
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onToggleBlackout?.(slot)}
                className="text-sm text-amber-600 hover:text-amber-800"
                data-testid="button-blackout"
              >
                {slot.blackout ? 'Remove' : 'Blackout'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit?.(slot)}
                className="text-sm text-secondary-600 hover:text-secondary-800"
                data-testid="button-edit"
              >
                Edit
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => onBook?.(slot)}
              disabled={!isBookable}
              className={`w-full sm:w-auto px-6 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                isBookable
                  ? 'bg-primary-500 text-white hover:bg-primary-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              data-testid="button-book"
            >
              {slot.blackout ? 'Unavailable' : slot.remaining <= 0 ? 'Fully Booked' : 'Book Slot'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
