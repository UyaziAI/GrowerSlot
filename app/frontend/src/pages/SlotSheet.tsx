import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Clock, Users, Ban, Lock, Trash2, AlertTriangle } from 'lucide-react';
import { fetchJson } from '../lib/http';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface SlotData {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked: number;
  blackout: boolean;
  notes: string;
  restrictions: {
    growers?: string[];
    cultivars?: string[];
  };
}

interface SlotSheetProps {
  slot: SlotData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SlotSheet({ slot, isOpen, onClose }: SlotSheetProps) {
  const [capacity, setCapacity] = useState(slot?.capacity || 20);
  const [notes, setNotes] = useState(slot?.notes || '');
  const [isBlackout, setIsBlackout] = useState(slot?.blackout || false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update local state when slot changes
  React.useEffect(() => {
    if (slot) {
      setCapacity(slot.capacity);
      setNotes(slot.notes);
      setIsBlackout(slot.blackout);
    }
  }, [slot]);

  // Update slot mutation
  const updateSlotMutation = useMutation({
    mutationFn: async (updates: Partial<SlotData>) => {
      if (!slot) return;
      return fetchJson(`/v1/slots/${slot.id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
    },
    onSuccess: () => {
      toast({
        title: 'Slot Updated',
        description: 'Slot has been updated successfully'
      });
      queryClient.invalidateQueries({ queryKey: ['/v1/slots'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Blackout slot mutation
  const blackoutMutation = useMutation({
    mutationFn: async (blackout: boolean) => {
      if (!slot) return;
      return fetchJson(`/v1/slots/${slot.id}/blackout`, {
        method: 'PATCH',
        body: JSON.stringify({
          blackout,
          note: blackout ? 'Slot blacked out from management' : 'Blackout removed from management'
        })
      });
    },
    onSuccess: () => {
      toast({
        title: 'Slot Updated',
        description: `Slot ${isBlackout ? 'blacked out' : 'blackout removed'} successfully`
      });
      queryClient.invalidateQueries({ queryKey: ['/v1/slots'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Delete slot mutation
  const deleteSlotMutation = useMutation({
    mutationFn: async () => {
      if (!slot) return;
      return fetchJson(`/v1/slots/${slot.id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({
        title: 'Slot Deleted',
        description: 'Empty slot has been removed'
      });
      queryClient.invalidateQueries({ queryKey: ['/v1/slots'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Restrictions mutation
  const restrictionsMutation = useMutation({
    mutationFn: async () => {
      if (!slot) return;
      
      const response = await fetch('/v1/restrictions/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_ids: [slot.id],
          restrictions: {
            growers: [],
            cultivars: [],
            note: 'Slot restrictions applied from management'
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Restrictions Applied',
        description: 'Slot restrictions have been applied'
      });
      queryClient.invalidateQueries({ queryKey: ['/v1/slots'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleSaveChanges = () => {
    updateSlotMutation.mutate({
      capacity,
      notes
    });
  };

  const handleBlackoutToggle = (blackout: boolean) => {
    setIsBlackout(blackout);
    blackoutMutation.mutate(blackout);
  };

  const handleDeleteSlot = () => {
    deleteSlotMutation.mutate();
  };

  const handleRestrictSlot = () => {
    restrictionsMutation.mutate();
  };

  if (!slot) return null;

  const remaining = slot.capacity - slot.booked;
  const isEmpty = slot.booked === 0;
  const timeRange = `${slot.start_time} - ${slot.end_time}`;
  const formattedDate = format(new Date(slot.date), 'EEEE, MMMM d, yyyy');

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="bottom" 
        className="h-[90vh] overflow-y-auto rounded-t-lg"
        data-testid="slot-sheet"
      >
        <SheetHeader className="pb-6">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Clock className="h-5 w-5" />
            Slot Management
          </SheetTitle>
          <div className="text-sm text-muted-foreground">
            {formattedDate} • {timeRange}
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Status Overview */}
          <Card data-testid="slot-overview-section">
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {slot.capacity}
                  </div>
                  <div className="text-sm text-gray-600">Capacity</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {remaining}
                  </div>
                  <div className="text-sm text-gray-600">Remaining</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {slot.booked}
                  </div>
                  <div className="text-sm text-gray-600">Booked</div>
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap gap-2">
                {slot.blackout && (
                  <Badge variant="destructive" className="text-xs">
                    <Ban className="h-3 w-3 mr-1" />
                    Blacked Out
                  </Badge>
                )}
                {slot.restrictions && (slot.restrictions.growers?.length || slot.restrictions.cultivars?.length) ? (
                  <Badge variant="outline" className="text-xs">
                    <Lock className="h-3 w-3 mr-1" />
                    Restricted
                  </Badge>
                ) : null}
                {isEmpty && (
                  <Badge variant="secondary" className="text-xs">
                    Empty Slot
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Slot Settings */}
          <Card data-testid="slot-settings-section">
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="slot-capacity">Capacity</Label>
                <Input
                  id="slot-capacity"
                  type="number"
                  min="1"
                  value={capacity}
                  onChange={(e) => setCapacity(parseInt(e.target.value) || 0)}
                  data-testid="input-slot-capacity"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slot-notes">Notes</Label>
                <Textarea
                  id="slot-notes"
                  placeholder="Add notes for this slot..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  data-testid="textarea-slot-notes"
                />
              </div>

              <Button
                onClick={handleSaveChanges}
                disabled={updateSlotMutation.isPending}
                className="w-full"
                data-testid="button-save-slot"
              >
                {updateSlotMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>

          <Separator />

          {/* Slot Actions */}
          <div className="space-y-4" data-testid="slot-actions-section">
            <h3 className="text-lg font-semibold">Slot Actions</h3>

            {/* Blackout Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="blackout-toggle">Blackout Slot</Label>
                <p className="text-sm text-muted-foreground">
                  Prevent new bookings for this slot
                </p>
              </div>
              <Switch
                id="blackout-toggle"
                checked={isBlackout}
                onCheckedChange={handleBlackoutToggle}
                disabled={blackoutMutation.isPending}
                data-testid="switch-blackout-slot"
              />
            </div>

            {/* Restrict Slot */}
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleRestrictSlot}
              disabled={restrictionsMutation.isPending}
              data-testid="button-restrict-slot"
            >
              <Lock className="h-4 w-4 mr-2" />
              {restrictionsMutation.isPending ? 'Applying...' : 'Restrict Slot'}
            </Button>

            {/* Delete Slot (only if empty) */}
            {isEmpty && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="w-full justify-start"
                    data-testid="button-delete-slot-trigger"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Empty Slot
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Slot</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this empty slot? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteSlot}
                      className="bg-destructive text-destructive-foreground"
                      data-testid="button-confirm-delete-slot"
                    >
                      {deleteSlotMutation.isPending ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {!isEmpty && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Slot has bookings
                  </p>
                  <p className="text-sm text-amber-700">
                    Cannot delete slot with {slot.booked} existing booking{slot.booked > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}