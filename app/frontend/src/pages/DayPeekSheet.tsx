import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CalendarDays, Plus, Ban, Lock, Eye, Edit } from 'lucide-react';
import { format, isBefore, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface DayPeekSummary {
  remaining: number;
  booked: number;
  blackout: boolean;
  restricted: boolean;
}

interface DayPeekSheetProps {
  dateISO: string;
  summary: DayPeekSummary;
  isOpen: boolean;
  onClose: () => void;
  onCreateDay: () => void;
  onBlackoutDay: () => void;
  onRestrictDay: () => void;
  onOpenEditor: () => void;
  onOpenDayView: () => void;
}

export function DayPeekSheet({
  dateISO,
  summary,
  isOpen,
  onClose,
  onCreateDay,
  onBlackoutDay,
  onRestrictDay,
  onOpenEditor,
  onOpenDayView
}: DayPeekSheetProps) {
  const date = new Date(dateISO);
  const formattedDate = format(date, 'EEEE, MMM d, yyyy');
  const dayName = format(date, 'EEE'); // For confirmation dialogs
  
  // Check if date is in the past (using Africa/Johannesburg timezone)
  const today = startOfDay(toZonedTime(new Date(), 'Africa/Johannesburg'));
  const targetDate = startOfDay(date);
  const isPastDate = isBefore(targetDate, today);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="bottom" 
        className="h-auto max-h-[80vh] rounded-t-lg"
        data-testid="day-peek-sheet"
      >
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="h-5 w-5" />
            {formattedDate}
          </SheetTitle>
        </SheetHeader>

        {/* Summary Chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Badge 
            variant={summary.remaining > 0 ? "default" : "secondary"}
            className="text-sm"
            data-testid="badge-remaining"
          >
            {summary.remaining} Remaining
          </Badge>
          <Badge 
            variant={summary.booked > 0 ? "default" : "outline"}
            className="text-sm"
            data-testid="badge-booked"
          >
            {summary.booked} Booked
          </Badge>
          {summary.blackout && (
            <Badge 
              variant="destructive" 
              className="text-sm"
              data-testid="badge-blackout"
            >
              ⛔ Blackout
            </Badge>
          )}
          {summary.restricted && (
            <Badge 
              variant="secondary" 
              className="text-sm"
              data-testid="badge-restricted"
            >
              🔒 Restricted
            </Badge>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Primary Actions */}
          <div className="grid grid-cols-1 gap-2">
            <Button
              onClick={onCreateDay}
              className="w-full justify-start"
              disabled={isPastDate}
              data-testid="button-create-day"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Slots — Day
            </Button>
            
            <div className="grid grid-cols-2 gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="justify-start"
                    disabled={isPastDate}
                    data-testid="button-blackout-day"
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Blackout Day
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Blackout Day</AlertDialogTitle>
                    <AlertDialogDescription data-testid="blackout-confirmation-text">
                      Blackout {dayName} {dateISO}? This will prevent all new bookings for this day.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onBlackoutDay}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      data-testid="confirm-blackout-day"
                    >
                      Blackout Day
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="justify-start"
                    disabled={isPastDate}
                    data-testid="button-restrict-day"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Restrict Day
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Restrict Day</AlertDialogTitle>
                    <AlertDialogDescription data-testid="restrict-confirmation-text">
                      Apply restrictions to {dayName} {dateISO}? This will limit access to specific growers or cultivars.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onRestrictDay}
                      data-testid="confirm-restrict-day"
                    >
                      Apply Restrictions
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Past Date Warning */}
          {isPastDate && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800" data-testid="past-date-warning">
                Actions disabled for past dates. Select today or a future date to make changes.
              </p>
            </div>
          )}

          {/* Navigation Links */}
          <div className="pt-4 border-t">
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={onOpenDayView}
                variant="ghost"
                className="justify-start"
                data-testid="link-open-day-view"
              >
                <Eye className="h-4 w-4 mr-2" />
                Open Day View
              </Button>
              <Button
                onClick={onOpenEditor}
                variant="ghost"
                className="justify-start"
                data-testid="link-edit-day"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Day
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}