import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface CreateSlotsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  focusedDate: string;
  tenantId: string;
}

export default function CreateSlotsDialog({
  isOpen,
  onClose,
  focusedDate,
  tenantId,
}: CreateSlotsDialogProps) {
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [slotDuration, setSlotDuration] = useState(60);
  const [capacity, setCapacity] = useState(10);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Creating slots for date:', focusedDate, {
      startTime,
      endTime,
      slotDuration,
      capacity,
      tenantId,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Create Slots — Day</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {new Date(focusedDate).toLocaleDateString()}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Slot Duration (minutes)
            </label>
            <input
              type="number"
              value={slotDuration}
              onChange={(e) => setSlotDuration(Number(e.target.value))}
              className="w-full border rounded px-3 py-2"
              min="15"
              max="480"
              step="15"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Capacity per slot
            </label>
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-full border rounded px-3 py-2"
              min="1"
              required
            />
          </div>

          {/* Footer */}
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Create Slots
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}