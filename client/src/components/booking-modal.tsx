import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { SlotWithUsage, Cultivar } from "@shared/schema";

interface BookingModalProps {
  slot: SlotWithUsage | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function BookingModal({ slot, isOpen, onClose }: BookingModalProps) {
  const [cultivarId, setCultivarId] = useState("");
  const [quantity, setQuantity] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: cultivars = [] } = useQuery<Cultivar[]>({
    queryKey: ["cultivars"],
    queryFn: () => api.getCultivars(),
    enabled: isOpen,
  });

  const bookingMutation = useMutation({
    mutationFn: (data: { slotId: string; cultivarId: string; quantity: number }) =>
      api.createBooking(data),
    onSuccess: () => {
      toast({
        title: "Booking Confirmed",
        description: "Your delivery slot has been booked successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["slots"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Booking Failed",
        description: error.message || "Failed to book slot",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setCultivarId("");
    setQuantity("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!slot || !cultivarId || !quantity) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const quantityNum = parseFloat(quantity);
    if (quantityNum <= 0 || quantityNum > slot.remaining) {
      toast({
        title: "Invalid Quantity",
        description: `Quantity must be between 0 and ${slot.remaining} tons`,
        variant: "destructive",
      });
      return;
    }

    bookingMutation.mutate({
      slotId: slot.id,
      cultivarId,
      quantity: quantityNum,
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!slot) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="modal-booking">
        <DialogHeader>
          <DialogTitle>Book Delivery Slot</DialogTitle>
        </DialogHeader>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm font-medium text-gray-900" data-testid="text-slot-date">
            {new Date(slot.date).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
          <div className="text-sm text-gray-600" data-testid="text-slot-time">
            {slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}
          </div>
          <div className="text-sm text-gray-600" data-testid="text-slot-capacity">
            {slot.remaining} / {slot.capacity} tons available
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-booking">
          <div>
            <Label htmlFor="cultivar">Cultivar</Label>
            <Select value={cultivarId} onValueChange={setCultivarId} required>
              <SelectTrigger data-testid="select-cultivar">
                <SelectValue placeholder="Select cultivar" />
              </SelectTrigger>
              <SelectContent>
                {cultivars.map((cultivar) => (
                  <SelectItem key={cultivar.id} value={cultivar.id}>
                    {cultivar.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="quantity">Quantity (tons)</Label>
            <Input
              id="quantity"
              type="number"
              step="0.1"
              max={slot.remaining}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="5.0"
              required
              data-testid="input-quantity"
            />
            <p className="mt-1 text-xs text-gray-500">
              Maximum {slot.remaining} tons available
            </p>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={bookingMutation.isPending}
              className="flex-1 bg-primary-500 hover:bg-primary-600"
              data-testid="button-confirm"
            >
              {bookingMutation.isPending ? "Booking..." : "Confirm Booking"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
