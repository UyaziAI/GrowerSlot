/**
 * FilterDialog - Dialog for filtering calendar view
 */
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Filter } from 'lucide-react';

interface AdminCalendarFilters {
  growerId?: string;
  cultivarId?: string;
  showBlackouts?: boolean;
}

interface FilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: AdminCalendarFilters;
  onFiltersChange: (filters: AdminCalendarFilters) => void;
}

export default function FilterDialog({
  open,
  onOpenChange,
  filters,
  onFiltersChange
}: FilterDialogProps) {

  const handleApplyFilters = () => {
    // Filters are already applied via controlled components
    onOpenChange(false);
  };

  const handleClearFilters = () => {
    onFiltersChange({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Filter Calendar
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="show-blackouts">Show Blackout Periods</Label>
            <Switch
              id="show-blackouts"
              checked={filters.showBlackouts ?? true}
              onCheckedChange={(checked) => 
                onFiltersChange({ ...filters, showBlackouts: checked })
              }
            />
          </div>
          
          <div className="text-center py-4">
            <p className="text-gray-600 text-sm">
              Additional filters (grower, cultivar) will be added here
            </p>
          </div>
          
          <div className="flex justify-between">
            <Button variant="outline" onClick={handleClearFilters}>
              Clear All
            </Button>
            <div className="space-x-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleApplyFilters}>
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}