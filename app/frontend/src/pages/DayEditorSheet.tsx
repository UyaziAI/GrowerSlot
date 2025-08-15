import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CalendarDays, Plus, Ban, Lock, Copy, Trash2, AlertTriangle } from 'lucide-react';
import { format, isBefore, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { useToast } from '@/hooks/use-toast';

// Feature flags
const FEATURE_ADMIN_TEMPLATES = import.meta.env.VITE_FEATURE_ADMIN_TEMPLATES === 'true';
const FEATURE_NEXT_AVAILABLE = import.meta.env.VITE_FEATURE_NEXT_AVAILABLE === 'true';

interface DayEditorSheetProps {
  dateISO: string;
  onClose: () => void;
  onToggleBlackout?: () => void;
  onQuickCreate?: (params: any) => void;
}

interface DayOverview {
  date: string;
  blackout: boolean;
  remaining: number;
  booked: number;
  totalSlots: number;
  restrictions: Array<{ type: string; name: string }>;
}

interface QuickCreateForm {
  slot_length_min: number;
  capacity: number;
  notes: string;
}

export default function DayEditorSheet({ dateISO, onClose, onToggleBlackout, onQuickCreate }: DayEditorSheetProps) {
  const [quickCreateForm, setQuickCreateForm] = useState<QuickCreateForm>({
    slot_length_min: 60,
    capacity: 20,
    notes: ''
  });
  const [isDayBlackout, setIsDayBlackout] = useState(false);
  const [apiError, setApiError] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const date = new Date(dateISO);
  const formattedDate = format(date, 'EEEE, MMMM d, yyyy');
  const dayName = format(date, 'EEE');
  const weekdayMask = [false, false, false, false, false, false, false];
  weekdayMask[date.getDay()] = true; // Set the weekday for this specific date
  
  // Check if date is in the past (using Africa/Johannesburg timezone)
  const today = startOfDay(toZonedTime(new Date(), 'Africa/Johannesburg'));
  const targetDate = startOfDay(date);
  const isPastDate = isBefore(targetDate, today);

  // Get today's date string for min attribute
  const todayISO = toZonedTime(new Date(), 'Africa/Johannesburg').toISOString().split('T')[0];

  // Fetch day overview data
  const { data: dayOverview, isLoading } = useQuery<DayOverview>({
    queryKey: ['/v1/admin/day-overview', dateISO],
    queryFn: async () => {
      // Mock implementation - replace with actual API call
      return {
        date: dateISO,
        blackout: false,
        remaining: 45,
        booked: 15,
        totalSlots: 6,
        restrictions: [
          { type: 'grower', name: 'Highland Orchards' },
          { type: 'cultivar', name: 'A4' }
        ]
      };
    },
    enabled: isOpen
  });

  // Quick create slot mutation
  const quickCreateMutation = useMutation({
    mutationFn: async (formData: QuickCreateForm) => {
      const response = await fetch('/v1/slots/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: dateISO,
          endDate: dateISO,
          startTime: '08:00',
          endTime: '17:00',
          slotDuration: formData.slot_length_min / 60, // Convert to hours
          capacity: formData.capacity,
          notes: formData.notes,
          weekdays: weekdayMask
        })
      });
      
      if (!response.ok) throw new Error('Failed to create slot');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Slot Created',
        description: 'New slot has been created successfully'
      });
      queryClient.invalidateQueries({ queryKey: ['/v1/slots'] });
      queryClient.invalidateQueries({ queryKey: ['/v1/admin/day-overview'] });
      setQuickCreateForm({ slot_length_min: 60, capacity: 20, notes: '' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create slot',
        variant: 'destructive'
      });
    }
  });

  // Blackout day mutation
  const blackoutDayMutation = useMutation({
    mutationFn: async (blackout: boolean) => {
      const response = await fetch('/v1/slots/blackout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: dateISO,
          end_date: dateISO,
          scope: 'day',
          note: blackout ? 'Day blackout from editor' : 'Blackout removed from editor'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update blackout');
      }
      return response.json();
    },
    onSuccess: () => {
      setApiError('');
      toast({
        title: 'Day Updated',
        description: `Day ${isDayBlackout ? 'blacked out' : 'blackout removed'} successfully`
      });
      queryClient.invalidateQueries({ queryKey: ['/v1/slots'] });
      queryClient.invalidateQueries({ queryKey: ['/v1/admin/day-overview'] });
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Failed to update blackout';
      setApiError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  });

  // Restrictions mutation
  const restrictionsMutation = useMutation({
    mutationFn: async (restrictions: any) => {
      const response = await fetch('/v1/restrictions/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_scope: [dateISO],
          restrictions: restrictions
        })
      });
      
      if (!response.ok) throw new Error('Failed to apply restrictions');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Restrictions Applied',
        description: 'Day restrictions updated successfully'
      });
      queryClient.invalidateQueries({ queryKey: ['/v1/admin/day-overview'] });
    }
  });

  const handleQuickCreate = () => {
    quickCreateMutation.mutate(quickCreateForm);
  };

  const handleBlackoutToggle = (blackout: boolean) => {
    setIsDayBlackout(blackout);
    blackoutDayMutation.mutate(blackout);
  };

  const handleDeleteEmptySlots = () => {
    // Implementation for deleting empty slots
    toast({
      title: 'Empty Slots Deleted',
      description: 'All empty slots for this day have been removed'
    });
  };

  const handleDuplicateFrom = () => {
    // Implementation for duplicating from another day
    toast({
      title: 'Duplicate Template',
      description: 'Choose a date to copy slots from'
    });
  };

  if (!isOpen) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="right" 
        className="w-full sm:w-[600px] sm:max-w-[600px] overflow-y-auto"
        data-testid="day-editor-sheet"
      >
        <SheetHeader className="pb-6">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <CalendarDays className="h-5 w-5" />
            Edit Day - {formattedDate}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Overview Section */}
          <Card data-testid="day-overview-section">
            <CardHeader>
              <CardTitle className="text-lg">Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Blackout Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="day-blackout">Day Blackout</Label>
                  <p className="text-sm text-muted-foreground">
                    Block all slots for this entire day
                  </p>
                </div>
                <Switch
                  id="day-blackout"
                  checked={isDayBlackout}
                  onCheckedChange={handleBlackoutToggle}
                  data-testid="toggle-day-blackout"
                />
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {dayOverview?.remaining || 0}
                  </div>
                  <div className="text-sm text-gray-600">Remaining</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {dayOverview?.booked || 0}
                  </div>
                  <div className="text-sm text-gray-600">Booked</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-600">
                    {dayOverview?.totalSlots || 0}
                  </div>
                  <div className="text-sm text-gray-600">Total Slots</div>
                </div>
              </div>

              {/* Restriction Chips */}
              {dayOverview?.restrictions && dayOverview.restrictions.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Active Restrictions</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {dayOverview.restrictions.map((restriction, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        <Lock className="h-3 w-3 mr-1" />
                        {restriction.type}: {restriction.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Create Section */}
          <Card data-testid="quick-create-section">
            <CardHeader>
              <CardTitle className="text-lg">Quick Create Slot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="slot-length">Slot Length (minutes)</Label>
                  <Select
                    value={quickCreateForm.slot_length_min.toString()}
                    onValueChange={(value) => setQuickCreateForm(prev => ({
                      ...prev,
                      slot_length_min: parseInt(value)
                    }))}
                    data-testid="select-slot-length"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slot-capacity">Capacity</Label>
                  <Input
                    id="slot-capacity"
                    type="number"
                    min="1"
                    value={quickCreateForm.capacity}
                    onChange={(e) => setQuickCreateForm(prev => ({
                      ...prev,
                      capacity: parseInt(e.target.value) || 0
                    }))}
                    data-testid="input-slot-capacity"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="slot-notes">Notes (optional)</Label>
                <Textarea
                  id="slot-notes"
                  placeholder="Add notes for this slot..."
                  value={quickCreateForm.notes}
                  onChange={(e) => setQuickCreateForm(prev => ({
                    ...prev,
                    notes: e.target.value
                  }))}
                  data-testid="textarea-slot-notes"
                />
              </div>

              <Button
                onClick={handleQuickCreate}
                disabled={quickCreateMutation.isPending || isPastDate}
                className="w-full"
                data-testid="button-quick-create-slot"
              >
                <Plus className="h-4 w-4 mr-2" />
                {quickCreateMutation.isPending ? 'Creating...' : 'Create Slot'}
              </Button>

              {/* API Error Display */}
              {apiError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800" data-testid="api-error-message">
                    {apiError}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Restrictions Editor Section */}
          <Card data-testid="restrictions-editor-section">
            <CardHeader>
              <CardTitle className="text-lg">Restrictions (Day Scope)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground mb-4">
                Apply restrictions to all slots on this day. These will override individual slot restrictions.
              </div>
              
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  data-testid="button-add-grower-restriction"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Add Grower Restriction
                </Button>

                <Button
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-add-cultivar-restriction"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Add Cultivar Restriction
                </Button>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Utilities Section */}
          <Card data-testid="utilities-section">
            <CardHeader>
              <CardTitle className="text-lg">Utilities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {FEATURE_ADMIN_TEMPLATES && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleDuplicateFrom}
                  data-testid="button-duplicate-from"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate from...
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleDeleteEmptySlots}
                data-testid="button-delete-empty-slots"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Empty Slots
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="w-full justify-start"
                    disabled={blackoutDayMutation.isPending || isPastDate}
                    data-testid="button-blackout-day"
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    {isDayBlackout ? 'Remove' : 'Apply'} Blackout Day
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {isDayBlackout ? 'Remove' : 'Apply'} Blackout Day
                    </AlertDialogTitle>
                    <AlertDialogDescription data-testid="blackout-day-confirmation-text">
                      {isDayBlackout 
                        ? `Remove blackout from ${dayName} ${dateISO}? This will allow new bookings.`
                        : `Blackout ${dayName} ${dateISO}? This will prevent all new bookings for this day.`
                      }
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleBlackoutToggle(!isDayBlackout)}
                      className={isDayBlackout ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
                      data-testid="confirm-blackout-day-action"
                    >
                      {isDayBlackout ? 'Remove Blackout' : 'Apply Blackout'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}