import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const FilterDrawer: React.FC<FilterDrawerProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50" 
        onClick={onClose}
        data-testid="filter-drawer-backdrop"
      />
      
      {/* Drawer */}
      <div 
        className="fixed right-0 top-0 h-full w-80 bg-white shadow-lg p-4"
        data-testid="filter-drawer"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" data-testid="filter-drawer-title">
            Filters
          </h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            data-testid="button-close-filter-drawer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="text-gray-500" data-testid="filter-drawer-content">
          Filters (coming soon)
        </div>
      </div>
    </div>
  );
};

export default FilterDrawer;