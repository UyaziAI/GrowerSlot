import { Button } from '@/components/ui/button';

export interface DayPeekSummary {
  remaining: number;
  booked: number;
  blackout: boolean;
  restricted: boolean;
}

interface DayPeekSheetProps {
  dateISO: string;
  summary: DayPeekSummary;
  onCreateDay: () => void;
  onBlackoutDay: () => void;
  onRestrictDay: () => void;
  onOpenEditor: () => void;
  onOpenDayView: () => void;
  onClose: () => void;
}

export default function DayPeekSheet({
  dateISO,
  summary,
  onCreateDay,
  onBlackoutDay,
  onRestrictDay,
  onOpenEditor,
  onOpenDayView,
  onClose,
}: DayPeekSheetProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 sm:items-center">
      <div className="bg-white rounded-t-xl sm:rounded-xl w-full max-w-md mx-4 sm:mb-4">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{new Date(dateISO).toLocaleDateString()}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="p-4 border-b">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Remaining</span>
              <div className="font-medium">{summary.remaining}</div>
            </div>
            <div>
              <span className="text-gray-500">Booked</span>
              <div className="font-medium">{summary.booked}</div>
            </div>
          </div>
          {summary.blackout && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
              Blackout period
            </div>
          )}
          {summary.restricted && (
            <div className="mt-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
              Restricted access
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 space-y-2">
          <Button onClick={onCreateDay} className="w-full justify-start">
            Create Slots
          </Button>
          <Button onClick={onBlackoutDay} variant="outline" className="w-full justify-start">
            {summary.blackout ? 'Remove Blackout' : 'Set Blackout'}
          </Button>
          <Button onClick={onRestrictDay} variant="outline" className="w-full justify-start">
            {summary.restricted ? 'Remove Restrictions' : 'Add Restrictions'}
          </Button>
          <Button onClick={onOpenEditor} variant="outline" className="w-full justify-start">
            Edit Day
          </Button>
          <Button onClick={onOpenDayView} variant="outline" className="w-full justify-start">
            Open Day View
          </Button>
        </div>
      </div>
    </div>
  );
}