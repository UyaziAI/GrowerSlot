import { Button } from '@/components/ui/button';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FilterDrawer({ isOpen, onClose }: FilterDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
      <div className="bg-white w-80 h-full shadow-xl">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Filters</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filter Content */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Date Range</label>
            <div className="space-y-2">
              <input
                type="date"
                className="w-full border rounded px-3 py-2"
                placeholder="Start date"
              />
              <input
                type="date"
                className="w-full border rounded px-3 py-2"
                placeholder="End date"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <div className="space-y-1">
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" defaultChecked />
                Available
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" defaultChecked />
                Booked
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                Blackout
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                Restricted
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Growers</label>
            <select className="w-full border rounded px-3 py-2">
              <option value="">All growers</option>
              <option value="grower1">Grower 1</option>
              <option value="grower2">Grower 2</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={onClose} className="flex-1">
              Apply Filters
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}