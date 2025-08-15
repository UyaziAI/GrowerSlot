import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { CalendarPlus } from 'lucide-react';

interface BulkCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
}

interface BulkCreateForm {
  start_date: string;
  end_date: string;
  slot_length_min: number;
  capacity: number;
  notes: string;
  weekdays: boolean[];
}

export function BulkCreateDialog({ isOpen, onClose, tenantId }: BulkCreateDialogProps) {
  const today = format(toZonedTime(new Date(), 'Africa/Johannesburg'), 'yyyy-MM-dd');
  const todayPlus7 = format(addDays(toZonedTime(new Date(), 'Africa/Johannesburg'), 7), 'yyyy-MM-dd');
  
  const [form, setForm] = useState<BulkCreateForm>({
    start_date: today,
    end_date: todayPlus7,
    slot_length_min: 60,
    capacity: 20,
    notes: '',
    weekdays: [false, true, true, true, true, true, false] // Mon-Fri default
  });
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Validate dates
  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    const todayStart = startOfDay(toZonedTime(new Date(), 'Africa/Johannesburg'));
    const startDate = startOfDay(new Date(form.start_date));
    const endDate = startOfDay(new Date(form.end_date));
    
    if (isBefore(startDate, todayStart)) {
      newErrors.start_date = 'Start date cannot be in the past';
    }
    
    if (isBefore(endDate, startDate)) {
      newErrors.end_date = 'End date must be after start date';
    }
    
    if (!form.weekdays.some(Boolean)) {
      newErrors.weekdays = 'Select at least one weekday';
    }
    
    if (form.capacity < 1) {
      newErrors.capacity = 'Capacity must be at least 1';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const bulkCreateMutation = useMutation({
    mutationFn: async (formData: BulkCreateForm) => {
      const response = await fetch('/v1/slots/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: formData.start_date,
          endDate: formData.end_date,
          startTime: '08:00',
          endTime: '17:00',
          slotDuration: formData.slot_length_min / 60, // Convert minutes to hours
          capacity: formData.capacity,
          notes: formData.notes,
          weekdays: formData.weekdays
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
        description: `Successfully created slots from ${form.start_date} to ${form.end_date}`
      });
      
      // Invalidate slots query for the range
      queryClient.invalidateQueries({ 
        queryKey: ['slots', tenantId, form.start_date, form.end_date] 
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
    if (!validateForm()) return;
    bulkCreateMutation.mutate(form);
  };
  
  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const canSubmit = !Object.keys(errors).length && form.capacity > 0;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg" data-testid="bulk-create-dialog">
        <DialogHeader>
          <DialogTitle>Bulk Create Slots (Range)</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={form.start_date}
                min={today}
                onChange={(e) => {
                  setForm(prev => ({ ...prev, start_date: e.target.value }));
                  setErrors(prev => ({ ...prev, start_date: '' }));
                }}
                data-testid="input-start-date"
              />
              {errors.start_date && (
                <p className="text-sm text-destructive" data-testid="error-start-date">
                  {errors.start_date}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={form.end_date}
                min={form.start_date}
                onChange={(e) => {
                  setForm(prev => ({ ...prev, end_date: e.target.value }));
                  setErrors(prev => ({ ...prev, end_date: '' }));
                }}
                data-testid="input-end-date"
              />
              {errors.end_date && (
                <p className="text-sm text-destructive" data-testid="error-end-date">
                  {errors.end_date}
                </p>
              )}
            </div>
          </div>
          
          {/* Weekdays */}
          <div className="space-y-2">
            <Label>Weekdays</Label>
            <div className="flex gap-2 flex-wrap">
              {weekdayLabels.map((label, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Checkbox
                    id={`weekday-${index}`}
                    checked={form.weekdays[index]}
                    onCheckedChange={(checked) => {
                      const newWeekdays = [...form.weekdays];
                      newWeekdays[index] = !!checked;
                      setForm(prev => ({ ...prev, weekdays: newWeekdays }));
                      setErrors(prev => ({ ...prev, weekdays: '' }));
                    }}
                    data-testid={`checkbox-weekday-${index}`}
                  />
                  <Label htmlFor={`weekday-${index}`} className="text-sm">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
            {errors.weekdays && (
              <p className="text-sm text-destructive" data-testid="error-weekdays">
                {errors.weekdays}
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
              onChange={(e) => {
                setForm(prev => ({ ...prev, capacity: parseInt(e.target.value) || 0 }));
                setErrors(prev => ({ ...prev, capacity: '' }));
              }}
              data-testid="input-capacity"
            />
            {errors.capacity && (
              <p className="text-sm text-destructive" data-testid="error-capacity">
                {errors.capacity}
              </p>
            )}
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
            disabled={!canSubmit || bulkCreateMutation.isPending}
            className="flex-1"
            data-testid="button-bulk-create"
          >
            <CalendarPlus className="h-4 w-4 mr-2" />
            {bulkCreateMutation.isPending ? 'Creating...' : 'Bulk Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}