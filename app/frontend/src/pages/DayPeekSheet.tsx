import React from 'react';

export interface DayPeekSummary { 
  remaining: number; 
  booked: number; 
  blackout: boolean; 
  restricted: boolean; 
}

export interface DayPeekSheetProps {
  dateISO: string;
  summary: DayPeekSummary;
  onCreateDay: () => void;
  onBlackoutDay: () => void;
  onRestrictDay: () => void;
  onOpenEditor: () => void;
  onOpenDayView: () => void;
  onClose?: () => void;
}

const DayPeekSheet: React.FC<DayPeekSheetProps> = ({
  dateISO, 
  summary, 
  onCreateDay, 
  onBlackoutDay, 
  onRestrictDay, 
  onOpenEditor, 
  onOpenDayView, 
  onClose
}) => {
  const d = new Date(dateISO);
  const fmt = d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div 
      role="dialog" 
      aria-label={`Day ${fmt}`} 
      className="fixed inset-x-0 bottom-0 max-h-[80vh] bg-white shadow-2xl rounded-t-2xl p-4 overflow-auto"
      data-testid="day-peek-sheet"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold" data-testid="day-peek-title">{fmt}</h3>
        <button 
          onClick={onClose} 
          aria-label="Close" 
          className="px-2 py-1 rounded hover:bg-gray-100"
          data-testid="button-close-day-peek"
        >
          Close
        </button>
      </div>
      
      <div className="flex gap-2 mb-3 text-sm">
        <span className="px-2 py-1 rounded bg-gray-100" data-testid="summary-remaining">
          Remaining: {summary.remaining}
        </span>
        <span className="px-2 py-1 rounded bg-gray-100" data-testid="summary-booked">
          Booked: {summary.booked}
        </span>
        {summary.blackout && (
          <span className="px-2 py-1 rounded bg-red-100" data-testid="summary-blackout">
            ⛔ Blackout
          </span>
        )}
        {summary.restricted && (
          <span className="px-2 py-1 rounded bg-amber-100" data-testid="summary-restricted">
            🔒 Restricted
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button 
          onClick={onCreateDay} 
          className="px-3 py-2 rounded bg-black text-white"
          data-testid="button-create-slots-day"
        >
          Create Slots — Day
        </button>
        <button 
          onClick={onBlackoutDay} 
          className="px-3 py-2 rounded bg-gray-200"
          data-testid="button-blackout-day"
        >
          Blackout Day
        </button>
        <button 
          onClick={onRestrictDay} 
          className="px-3 py-2 rounded bg-gray-200"
          data-testid="button-restrict-day"
        >
          Restrict Day
        </button>
        <button 
          onClick={onOpenDayView} 
          className="px-3 py-2 rounded bg-gray-50 text-left underline"
          data-testid="button-open-day-view"
        >
          Open Day view
        </button>
        <button 
          onClick={onOpenEditor} 
          className="px-3 py-2 rounded bg-gray-50 text-left underline"
          data-testid="button-edit-day"
        >
          Edit Day
        </button>
      </div>
    </div>
  );
};

export default DayPeekSheet;