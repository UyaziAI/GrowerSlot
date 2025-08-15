import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { format, isBefore, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Plus } from 'lucide-react';

interface CreateSlotsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  focusedDate: string; // ISO date string
  tenantId: string;
}

interface CreateSlotsForm {
  slot_length_min: number;
  capacity: number;
  notes: string;
}

export function CreateSlotsDialog({ isOpen, onClose, focusedDate, tenantId }: CreateSlotsDialogProps) {
  const [form, setForm] = useState<CreateSlotsForm>({
    slot_length_min: 60,
    capacity: 20,
    notes: ''
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Check if focused date is in the past
  const today = startOfDay(toZonedTime(new Date(), 'Africa/Johannesburg'));
  const targetDate = startOfDay(new Date(focusedDate));
  const isPastDate = isBefore(targetDate, today);
  
  const formattedDate = format(new Date(focusedDate), 'EEEE, MMMM d, yyyy');
  
  // Get weekday for the focused date (0=Sunday, 1=Monday, etc.)
  const focusedWeekday = new Date(focusedDate).getDay();
  const weekdayMask = [false, false, false, false, false, false, false];
  weekdayMask[focusedWeekday] = true;
  
  const createSlotsMutation = useMutation({
    mutationFn: async (formData: CreateSlotsForm) => {
      const response = await fetch('/v1/slots/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: focusedDate,
          endDate: focusedDate,
          startTime: '08:00',
          endTime: '17:00',
          slotDuration: formData.slot_length_min / 60, // Convert minutes to hours
          capacity: formData.capacity,
          notes: formData.notes,
          weekdays: weekdayMask
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create slots');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Slots created',
        description: `Successfully created slots for ${formattedDate}`
      });
      
      // Invalidate slots query for the specific date range
      queryClient.invalidateQueries({ 
        queryKey: ['slots', tenantId, focusedDate, focusedDate] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/v1/slots'] 
      });
      
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create slots',
        variant: 'destructive'
      });
    }
  });
  
  const handleSubmit = () => {
    if (isPastDate) return;
    createSlotsMutation.mutate(form);
  };
  
  const canSubmit = !isPastDate && form.capacity > 0;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="create-slots-dialog">
        <DialogHeader>
          <DialogTitle>Create Slots (Day)</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Date Display */}
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium" data-testid="focused-date-display">
              {formattedDate}
            </p>
            {isPastDate && (
              <p className="text-sm text-destructive mt-1" data-testid="past-date-error">
                Cannot create slots for past dates
              </p>
            )}
          </div>
          
          {/* Slot Duration */}
          <div className="space-y-2">
            <Label htmlFor="slot-duration">Slot Duration</Label>
            <Select
              value={form.slot_length_min.toString()}
              onValueChange={(value) => setForm(prev => ({ ...prev, slot_length_min: parseInt(value) }))}
              data-testid="select-slot-duration"
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
          
          {/* Capacity */}
          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity</Label>
            <Input
              id="capacity"
              type="number"
              min="1"
              value={form.capacity}
              onChange={(e) => setForm(prev => ({ ...prev, capacity: parseInt(e.target.value) || 0 }))}
              data-testid="input-capacity"
            />
          </div>
          
          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add notes for these slots..."
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              data-testid="textarea-notes"
            />
          </div>
        </div>
        
        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || createSlotsMutation.isPending}
            className="flex-1"
            data-testid="button-create-slots"
          >
            <Plus className="h-4 w-4 mr-2" />
            {createSlotsMutation.isPending ? 'Creating...' : 'Create Slots (Day)'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}