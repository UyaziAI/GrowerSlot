import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface BulkCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
}

export default function BulkCreateDialog({
  isOpen,
  onClose,
  tenantId,
}: BulkCreateDialogProps) {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [slotDuration, setSlotDuration] = useState(60);
  const [capacity, setCapacity] = useState(10);
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5]); // Mon-Fri

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Bulk creating slots:', {
      startDate,
      endDate,
      startTime,
      endTime,
      slotDuration,
      capacity,
      weekdays,
      tenantId,
    });
    onClose();
  };

  const toggleWeekday = (day: number) => {
    setWeekdays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Bulk Create Slots</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Days of Week</label>
            <div className="grid grid-cols-7 gap-1">
              {weekdayLabels.map((label, index) => {
                const dayValue = index + 1;
                const isSelected = weekdays.includes(dayValue);
                return (
                  <button
                    key={dayValue}
                    type="button"
                    onClick={() => toggleWeekday(dayValue)}
                    className={`p-2 text-xs rounded text-center ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

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