/**
 * BulkCreateSlotsDialog - Dialog for creating multiple slots
 */
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';

interface BulkCreateSlotsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
}

export default function BulkCreateSlotsDialog({
  open,
  onOpenChange,
  selectedDate
}: BulkCreateSlotsDialogProps) {
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      // TODO: Implement bulk slot creation
      console.log('Creating slots for date:', selectedDate);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create slots:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Slots</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={selectedDate.toISOString().split('T')[0]}
              readOnly
            />
          </div>
          
          <div className="text-center py-8">
            <Plus className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">
              Bulk slot creation interface will be implemented here
            </p>
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Slots'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}