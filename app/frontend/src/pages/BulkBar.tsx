import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CalendarDays, Plus, Ban, Lock, Copy, X, Check } from 'lucide-react';
import { fetchWithVerbatimErrors } from '../lib/http';
import { useToast } from '@/hooks/use-toast';
import { format, isBefore, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// Feature flags
const FEATURE_ADMIN_TEMPLATES = import.meta.env.VITE_FEATURE_ADMIN_TEMPLATES === 'true';

interface BulkBarProps {
  selectedDates: string[];
  onClearSelection: () => void;
  onDone: () => void;
}

interface BulkCreateForm {
  startTime: string;
  endTime: string;
  slotDuration: number;
  capacity: number;
  notes: string;
}

export function BulkBar({ selectedDates, onClearSelection, onDone }: BulkBarProps) {
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [duplicateSheetOpen, setDuplicateSheetOpen] = useState(false);
  const [bulkCreateForm, setBulkCreateForm] = useState<BulkCreateForm>({
    startTime: '08:00',
    endTime: '17:00',
    slotDuration: 60,
    capacity: 20,
    notes: ''
  });
  const [sourceDate, setSourceDate] = useState('');
  const [apiError, setApiError] = useState<string>('');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Check if any selected dates are in the past
  const today = startOfDay(toZonedTime(new Date(), 'Africa/Johannesburg'));
  const hasPastDates = selectedDates.some(dateStr => {
    const date = startOfDay(new Date(dateStr));
    return isBefore(date, today);
  });

  // Get today's date string for min attribute
  const todayISO = toZonedTime(new Date(), 'Africa/Johannesburg').toISOString().split('T')[0];

  // Compute weekday mask from selected dates
  const getWeekdayMask = (dates: string[]) => {
    const mask = [false, false, false, false, false, false, false];
    dates.forEach(dateStr => {
      const date = new Date(dateStr);
      mask[date.getDay()] = true;
    });
    return mask;
  };

  // Get min/max date range
  const getDateRange = (dates: string[]) => {
    const sorted = dates.sort();
    return {
      startDate: sorted[0],
      endDate: sorted[sorted.length - 1]
    };
  };

  // Bulk create slots mutation
  const bulkCreateMutation = useMutation({
    mutationFn: async (formData: BulkCreateForm) => {
      const { startDate, endDate } = getDateRange(selectedDates);
      const weekdays = getWeekdayMask(selectedDates);
      
      const response = await fetch('/v1/slots/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          startTime: formData.startTime,
          endTime: formData.endTime,
          slotDuration: formData.slotDuration / 60, // Convert to hours
          capacity: formData.capacity,
          notes: formData.notes,
          weekdays
        })
      });
      
      if (!response.ok) throw new Error('Failed to create slots');
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: 'Slots Created',
        description: `Successfully created ${result.count || 'multiple'} slots across ${selectedDates.length} days`
      });
      queryClient.invalidateQueries({ queryKey: ['/v1/slots'] });
      setCreateSheetOpen(false);
      onDone();
    },
    onError: (error: any) => {
      toast({
        title: 'Error', 
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Bulk blackout mutation
  const blackoutMutation = useMutation({
    mutationFn: async () => {
      const { startDate, endDate } = getDateRange(selectedDates);
      
      const response = await fetch('/v1/slots/blackout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          scope: 'day',
          note: `Bulk blackout applied to ${selectedDates.length} selected days`,
          selected_dates: selectedDates
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      setApiError('');
      toast({
        title: 'Blackout Applied',
        description: `Successfully applied blackout to ${selectedDates.length} selected days`
      });
      queryClient.invalidateQueries({ queryKey: ['/v1/slots'] });
      onDone();
    },
    onError: (error: any) => {
      setApiError(error.message);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Bulk restrictions mutation
  const restrictionsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/v1/restrictions/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_scope: selectedDates,
          restrictions: {
            growers: [],
            cultivars: [],
            note: `Bulk restrictions applied to ${selectedDates.length} selected days`
          }
        })
      });
      
      if (!response.ok) throw new Error('Failed to apply restrictions');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Restrictions Applied',
        description: `Successfully applied restrictions to ${selectedDates.length} selected days`
      });
      queryClient.invalidateQueries({ queryKey: ['/v1/slots'] });
      onDone();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to apply restrictions',
        variant: 'destructive'
      });
    }
  });

  // Duplicate slots mutation
  const duplicateMutation = useMutation({
    mutationFn: async () => {
      if (!sourceDate) throw new Error('Please select a source date');
      
      const response = await fetch('/v1/slots/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_date: sourceDate,
          target_dates: selectedDates
        })
      });
      
      if (!response.ok) throw new Error('Failed to duplicate slots');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Slots Duplicated',
        description: `Successfully duplicated slots from ${format(new Date(sourceDate), 'MMM d')} to ${selectedDates.length} selected days`
      });
      queryClient.invalidateQueries({ queryKey: ['/v1/slots'] });
      setDuplicateSheetOpen(false);
      onDone();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to duplicate slots',
        variant: 'destructive'
      });
    }
  });

  const handleBulkCreate = () => {
    bulkCreateMutation.mutate(bulkCreateForm);
  };

  if (selectedDates.length === 0) return null;

  return (
    <>
      <Card 
        className="fixed bottom-4 left-4 right-4 z-50 shadow-lg border-2 border-blue-200 bg-blue-50"
        data-testid="bulk-bar"
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Selection Info */}
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm" data-testid="selection-count">
                {selectedDates.length} days selected
              </Badge>
              <div className="text-xs text-muted-foreground hidden sm:block">
                {selectedDates.slice(0, 3).map(date => format(new Date(date), 'MMM d')).join(', ')}
                {selectedDates.length > 3 && ` +${selectedDates.length - 3} more`}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Create Slots - Range */}
              <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
                <SheetTrigger asChild>
                  <Button size="sm" data-testid="button-bulk-create">
                    <Plus className="h-4 w-4 mr-1" />
                    Create Slots — Range
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-96">
                  <SheetHeader>
                    <SheetTitle>Create Slots for {selectedDates.length} Days</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-4 mt-6">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="bulk-start-time">Start Time</Label>
                        <Input
                          id="bulk-start-time"
                          type="time"
                          value={bulkCreateForm.startTime}
                          onChange={(e) => setBulkCreateForm(prev => ({ ...prev, startTime: e.target.value }))}
                          data-testid="input-bulk-start-time"
                        />
                      </div>
                      <div>
                        <Label htmlFor="bulk-end-time">End Time</Label>
                        <Input
                          id="bulk-end-time"
                          type="time"
                          value={bulkCreateForm.endTime}
                          onChange={(e) => setBulkCreateForm(prev => ({ ...prev, endTime: e.target.value }))}
                          data-testid="input-bulk-end-time"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="bulk-duration">Slot Duration</Label>
                        <Select
                          value={bulkCreateForm.slotDuration.toString()}
                          onValueChange={(value) => setBulkCreateForm(prev => ({ ...prev, slotDuration: parseInt(value) }))}
                          data-testid="select-bulk-duration"
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 min</SelectItem>
                            <SelectItem value="60">1 hour</SelectItem>
                            <SelectItem value="120">2 hours</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="bulk-capacity">Capacity</Label>
                        <Input
                          id="bulk-capacity"
                          type="number"
                          min="1"
                          value={bulkCreateForm.capacity}
                          onChange={(e) => setBulkCreateForm(prev => ({ ...prev, capacity: parseInt(e.target.value) || 0 }))}
                          data-testid="input-bulk-capacity"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="bulk-notes">Notes</Label>
                      <Textarea
                        id="bulk-notes"
                        placeholder="Notes for all created slots..."
                        value={bulkCreateForm.notes}
                        onChange={(e) => setBulkCreateForm(prev => ({ ...prev, notes: e.target.value }))}
                        data-testid="textarea-bulk-notes"
                      />
                    </div>

                    <Button
                      onClick={handleBulkCreate}
                      disabled={bulkCreateMutation.isPending}
                      className="w-full"
                      data-testid="button-confirm-bulk-create"
                    >
                      {bulkCreateMutation.isPending ? 'Creating...' : 'Create Slots'}
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>

              {/* Blackout - Selected days */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={blackoutMutation.isPending || hasPastDates}
                    data-testid="button-bulk-blackout"
                  >
                    <Ban className="h-4 w-4 mr-1" />
                    Blackout — Selected days
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Blackout Selected Days</AlertDialogTitle>
                    <AlertDialogDescription data-testid="bulk-blackout-confirmation-text">
                      Blackout {selectedDates.length} selected days? This will prevent all new bookings for these days.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => blackoutMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      data-testid="confirm-bulk-blackout"
                    >
                      {blackoutMutation.isPending ? 'Applying...' : 'Blackout Days'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Apply Restrictions - Selected days */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={restrictionsMutation.isPending || hasPastDates}
                    data-testid="button-bulk-restrictions"
                  >
                    <Lock className="h-4 w-4 mr-1" />
                    Apply Restrictions — Selected days
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Apply Restrictions</AlertDialogTitle>
                    <AlertDialogDescription data-testid="bulk-restrictions-confirmation-text">
                      Apply restrictions to {selectedDates.length} selected days? This will limit access to specific growers or cultivars.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => restrictionsMutation.mutate()}
                      data-testid="confirm-bulk-restrictions"
                    >
                      {restrictionsMutation.isPending ? 'Applying...' : 'Apply Restrictions'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Duplicate From - Templates Feature */}
              {FEATURE_ADMIN_TEMPLATES && (
                <Sheet open={duplicateSheetOpen} onOpenChange={setDuplicateSheetOpen}>
                  <SheetTrigger asChild>
                    <Button size="sm" variant="outline" data-testid="button-bulk-duplicate">
                      <Copy className="h-4 w-4 mr-1" />
                      Duplicate From…
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-96">
                    <SheetHeader>
                      <SheetTitle>Duplicate Slots to {selectedDates.length} Days</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-4 mt-6">
                      <div>
                        <Label htmlFor="source-date">Source Date</Label>
                        <Input
                          id="source-date"
                          type="date"
                          min={todayISO}
                          value={sourceDate}
                          onChange={(e) => setSourceDate(e.target.value)}
                          data-testid="input-source-date"
                        />
                      </div>
                      <Button
                        onClick={() => duplicateMutation.mutate()}
                        disabled={duplicateMutation.isPending || !sourceDate || hasPastDates}
                        className="w-full"
                        data-testid="button-confirm-duplicate"
                      >
                        {duplicateMutation.isPending ? 'Duplicating...' : 'Duplicate Slots'}
                      </Button>

                      {/* API Error Display */}
                      {apiError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg mt-4">
                          <p className="text-sm text-red-800" data-testid="bulk-api-error-message">
                            {apiError}
                          </p>
                        </div>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              )}

              {/* Clear & Done buttons */}
              <Button
                size="sm"
                variant="ghost"
                onClick={onClearSelection}
                data-testid="button-clear-selection"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>

              <Button
                size="sm"
                onClick={onDone}
                data-testid="button-done-selection"
              >
                <Check className="h-4 w-4 mr-1" />
                Done
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}