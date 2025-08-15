import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ban, Shield, X, Info, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { SlotWithUsage } from "@shared/schema";
import { authService } from "@/lib/auth";
import dayjs from 'dayjs';

interface InspectorPanelProps {
  selectedSlot: SlotWithUsage | null;
  onClose: () => void;
  dateRange: { startDate: string; endDate: string };
}

export default function InspectorPanel({ selectedSlot, onClose, dateRange }: InspectorPanelProps) {
  const [showRestrictDialog, setShowRestrictDialog] = useState(false);
  const [restrictionScope, setRestrictionScope] = useState<'slot' | 'day'>('slot');
  const [restrictionNote, setRestrictionNote] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = authService.getUser();

  // Blackout toggle mutation
  const blackoutMutation = useMutation({
    mutationFn: (data: { start_date: string; end_date: string; scope: string; note?: string }) =>
      api.blackoutSlot(selectedSlot!.id, data),
    onSuccess: () => {
      // Invalidate slots queries to refresh the grid
      queryClient.invalidateQueries({ 
        queryKey: ['slots', 'range', user?.tenantId, dateRange.startDate, dateRange.endDate] 
      });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      
      toast({
        title: "Blackout Updated",
        description: `Slot ${selectedSlot?.blackout ? 'blackout removed' : 'blackout applied'} successfully`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Blackout Failed",
        description: error.message || "Failed to update blackout status",
        variant: "destructive"
      });
    }
  });

  // Restrictions mutation
  const restrictionMutation = useMutation({
    mutationFn: (data: any) => api.applyRestrictions(data),
    onSuccess: () => {
      // Invalidate slots queries to refresh the grid
      queryClient.invalidateQueries({
        queryKey: ['slots', 'range', user?.tenantId, dateRange.startDate, dateRange.endDate]
      });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      
      toast({
        title: "Restriction Applied",
        description: `${restrictionScope === 'slot' ? 'Slot' : 'Day'} restriction applied successfully`
      });
      
      setShowRestrictDialog(false);
      setRestrictionNote('');
    },
    onError: (error: any) => {
      // Handle 403/409 errors without writing to UI
      if (error.status === 403) {
        toast({
          title: "Restriction Forbidden",
          description: "You don't have permission to apply this restriction",
          variant: "destructive"
        });
      } else if (error.status === 409) {
        toast({
          title: "Restriction Conflict",
          description: "This restriction conflicts with existing rules",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Restriction Failed",
          description: error.message || "Failed to apply restriction",
          variant: "destructive"
        });
      }
      
      // Don't update UI on failure - only show toast
    }
  });

  const handleBlackoutToggle = () => {
    if (!selectedSlot) return;
    
    const slotDate = dayjs(selectedSlot.date).format('YYYY-MM-DD');
    
    blackoutMutation.mutate({
      start_date: slotDate,
      end_date: slotDate,
      scope: 'slot',
      note: selectedSlot.blackout ? undefined : 'Blackout applied via Inspector'
    });
  };

  const handleRestrictionApply = () => {
    if (!selectedSlot) return;
    
    const restrictionData = {
      restriction_date: restrictionScope === 'day' ? dayjs(selectedSlot.date).format('YYYY-MM-DD') : null,
      slot_id: restrictionScope === 'slot' ? selectedSlot.id : null,
      grower_ids: [], // Empty for now - could be extended
      cultivar_ids: [], // Empty for now - could be extended
      note: restrictionNote || `${restrictionScope} restriction applied via Inspector`
    };
    
    restrictionMutation.mutate(restrictionData);
  };

  if (!selectedSlot) {
    return (
      <Card className="w-80 h-fit">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm">
            <span>Inspector</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Info className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">Select a slot to view details</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const availabilityPercentage = selectedSlot.capacity ? 
    Math.round(((selectedSlot.remaining || 0) / selectedSlot.capacity) * 100) : 0;

  return (
    <>
      <Card className="w-80 h-fit" data-testid="inspector-panel">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm">
            <span>Inspector</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              data-testid="inspector-close"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Slot Basic Info */}
          <div>
            <h3 className="font-medium text-sm mb-2" data-testid="slot-time">
              {selectedSlot.startTime} - {selectedSlot.endTime}
            </h3>
            <p className="text-xs text-gray-500" data-testid="slot-date">
              {dayjs(selectedSlot.date).format('dddd, MMMM D, YYYY')}
            </p>
          </div>

          <Separator />

          {/* Capacity Information */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Capacity:</span>
              <span className="font-medium" data-testid="slot-capacity">
                {selectedSlot.capacity}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Booked:</span>
              <span data-testid="slot-booked">{selectedSlot.booked || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Remaining:</span>
              <span className="font-medium" data-testid="slot-remaining">
                {selectedSlot.remaining || 0}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Available:</span>
              <Badge 
                variant={availabilityPercentage >= 50 ? 'default' : 
                        availabilityPercentage > 0 ? 'secondary' : 'destructive'}
                data-testid="availability-badge"
              >
                {availabilityPercentage}%
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Status & Notes */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Blackout:</span>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={selectedSlot.blackout}
                  onCheckedChange={handleBlackoutToggle}
                  disabled={blackoutMutation.isPending}
                  data-testid="blackout-toggle"
                />
                <Badge 
                  variant={selectedSlot.blackout ? 'destructive' : 'default'}
                  data-testid="blackout-status"
                >
                  {selectedSlot.blackout ? 'Blackout' : 'Active'}
                </Badge>
              </div>
            </div>
            
            {selectedSlot.notes && (
              <div>
                <Label className="text-xs text-gray-500">Notes:</Label>
                <p className="text-sm bg-gray-50 p-2 rounded text-gray-700" data-testid="slot-notes">
                  {selectedSlot.notes}
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-600">Quick Actions</Label>
            
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowRestrictDialog(true)}
              disabled={restrictionMutation.isPending}
              data-testid="restrict-button"
            >
              <Shield className="h-4 w-4 mr-2" />
              Apply Restriction
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleBlackoutToggle}
              disabled={blackoutMutation.isPending}
              data-testid="blackout-button"
            >
              <Ban className="h-4 w-4 mr-2" />
              {blackoutMutation.isPending ? 'Updating...' : 
               selectedSlot.blackout ? 'Remove Blackout' : 'Set Blackout'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Restriction Dialog */}
      <Dialog open={showRestrictDialog} onOpenChange={setShowRestrictDialog}>
        <DialogContent data-testid="restriction-dialog">
          <DialogHeader>
            <DialogTitle>Apply Restriction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Scope</Label>
              <Select 
                value={restrictionScope} 
                onValueChange={(value: 'slot' | 'day') => setRestrictionScope(value)}
              >
                <SelectTrigger data-testid="restriction-scope-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slot">This Slot Only</SelectItem>
                  <SelectItem value="day">Entire Day</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {restrictionScope === 'slot' 
                  ? 'Apply restriction to this specific time slot'
                  : 'Apply restriction to all slots on this date'}
              </p>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Restriction Note</Label>
              <Textarea
                value={restrictionNote}
                onChange={(e) => setRestrictionNote(e.target.value)}
                placeholder="Optional note explaining the restriction..."
                className="mt-1"
                data-testid="restriction-note-input"
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setShowRestrictDialog(false)}
                data-testid="restriction-cancel"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleRestrictionApply}
                disabled={restrictionMutation.isPending}
                data-testid="restriction-apply"
              >
                {restrictionMutation.isPending ? 'Applying...' : 'Apply Restriction'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}