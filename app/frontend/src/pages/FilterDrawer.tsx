import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Filter } from 'lucide-react';

interface FilterDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  filters: {
    grower?: string;
    cultivar?: string;
    status?: string;
    showBlackout: boolean;
    showRestricted: boolean;
  };
  onFiltersChange: (filters: any) => void;
  growers: Array<{ id: string; name: string }>;
  cultivars: Array<{ id: string; name: string }>;
}

export function FilterDrawer({
  isOpen,
  onOpenChange,
  filters,
  onFiltersChange,
  growers,
  cultivars
}: FilterDrawerProps) {
  const handleFilterChange = (key: string, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          data-testid="button-open-filters"
        >
          <Filter className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80" data-testid="filter-drawer">
        <SheetHeader className="pb-6">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Grower Filter */}
          <div className="space-y-2">
            <Label htmlFor="grower-filter">Grower</Label>
            <Select
              value={filters.grower || ""}
              onValueChange={(value) => handleFilterChange('grower', value)}
              data-testid="select-grower-filter"
            >
              <SelectTrigger>
                <SelectValue placeholder="All growers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All growers</SelectItem>
                {growers.map((grower) => (
                  <SelectItem key={grower.id} value={grower.id}>
                    {grower.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cultivar Filter */}
          <div className="space-y-2">
            <Label htmlFor="cultivar-filter">Cultivar</Label>
            <Select
              value={filters.cultivar || ""}
              onValueChange={(value) => handleFilterChange('cultivar', value)}
              data-testid="select-cultivar-filter"
            >
              <SelectTrigger>
                <SelectValue placeholder="All cultivars" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All cultivars</SelectItem>
                {cultivars.map((cultivar) => (
                  <SelectItem key={cultivar.id} value={cultivar.id}>
                    {cultivar.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label htmlFor="status-filter">Status</Label>
            <Select
              value={filters.status || ""}
              onValueChange={(value) => handleFilterChange('status', value)}
              data-testid="select-status-filter"
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="full">Full</SelectItem>
                <SelectItem value="blackout">Blackout</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Special Filters */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-blackout"
                checked={filters.showBlackout}
                onCheckedChange={(checked) => handleFilterChange('showBlackout', checked)}
                data-testid="checkbox-show-blackout"
              />
              <Label htmlFor="show-blackout">Show blackout slots</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-restricted"
                checked={filters.showRestricted}
                onCheckedChange={(checked) => handleFilterChange('showRestricted', checked)}
                data-testid="checkbox-show-restricted"
              />
              <Label htmlFor="show-restricted">Show restricted slots</Label>
            </div>
          </div>

          {/* Reset Button */}
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onFiltersChange({
                grower: '',
                cultivar: '',
                status: '',
                showBlackout: true,
                showRestricted: true
              })}
              data-testid="button-reset-filters"
            >
              Reset Filters
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}