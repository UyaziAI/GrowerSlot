import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, MapPin } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface NextAvailableSlot {
  slot_id: string;
  date: string;
  start_time: string;
  end_time: string;
  remaining: number;
  notes?: string;
}

interface NextAvailableResponse {
  slots: NextAvailableSlot[];
  total: number;
}

const nextAvailableSchema = z.object({
  from_datetime: z.string().min(1, "From datetime is required"),
  grower_id: z.string().optional(),
  cultivar_id: z.string().optional(),
  limit: z.number().min(1).max(50).default(10)
});

type NextAvailableFormData = z.infer<typeof nextAvailableSchema>;

interface NextAvailableDialogProps {
  onSlotJump?: (slotId: string, date: string) => void;
}

export default function NextAvailableDialog({ onSlotJump }: NextAvailableDialogProps) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<NextAvailableResponse | null>(null);
  const { toast } = useToast();

  // Check feature flag
  const isEnabled = import.meta.env.VITE_FEATURE_NEXT_AVAILABLE === 'true';

  // Don't render if feature is disabled
  if (!isEnabled) {
    return null;
  }

  const form = useForm<NextAvailableFormData>({
    resolver: zodResolver(nextAvailableSchema),
    defaultValues: {
      from_datetime: new Date().toISOString().slice(0, 16), // Format: 2025-08-15T08:00
      grower_id: "",
      cultivar_id: "",
      limit: 10
    }
  });

  // Get grower and cultivar options for dropdowns
  const { data: growers = [] } = useQuery({
    queryKey: ['growers'],
    queryFn: () => api.getGrowers(),
    enabled: open
  });

  const { data: cultivars = [] } = useQuery({
    queryKey: ['cultivars'],
    queryFn: () => api.getCultivars(),
    enabled: open
  });

  const findAvailableMutation = useMutation({
    mutationFn: async (data: NextAvailableFormData) => {
      // Convert local datetime to ISO with timezone
      const localDateTime = new Date(data.from_datetime);
      const isoDateTime = localDateTime.toISOString().replace('Z', '+02:00'); // Africa/Johannesburg offset
      
      const payload = {
        from_datetime: isoDateTime,
        grower_id: data.grower_id || undefined,
        cultivar_id: data.cultivar_id || undefined,
        limit: data.limit
      };

      const response = await fetch('/v1/slots/next-available', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json() as Promise<NextAvailableResponse>;
    },
    onSuccess: (data) => {
      setResults(data);
      toast({
        title: "Search Complete",
        description: `Found ${data.total} available slots`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Search Failed",
        description: error.message || "Failed to find available slots",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: NextAvailableFormData) => {
    findAvailableMutation.mutate(data);
  };

  const handleSlotJump = (slot: NextAvailableSlot) => {
    if (onSlotJump) {
      onSlotJump(slot.slot_id, slot.date);
      setOpen(false);
      toast({
        title: "Jumped to Slot",
        description: `Navigated to ${slot.date} ${slot.start_time}`,
      });
    }
  };

  const resetDialog = () => {
    setResults(null);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) {
        resetDialog();
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-next-available">
          <Search className="w-4 h-4 mr-2" />
          Find Next Available
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-next-available">
        <DialogHeader>
          <DialogTitle>Find Next Available Slots</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="from_datetime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Date & Time</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        data-testid="input-from-datetime"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="limit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Results</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="50"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 10)}
                        data-testid="input-limit"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="grower_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grower (Optional)</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-grower">
                          <SelectValue placeholder="Any grower" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Any grower</SelectItem>
                        {growers.map((grower: any) => (
                          <SelectItem key={grower.id} value={grower.id}>
                            {grower.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cultivar_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cultivar (Optional)</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-cultivar">
                          <SelectValue placeholder="Any cultivar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Any cultivar</SelectItem>
                        {cultivars.map((cultivar: any) => (
                          <SelectItem key={cultivar.id} value={cultivar.id}>
                            {cultivar.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              disabled={findAvailableMutation.isPending}
              className="w-full"
              data-testid="button-submit-search"
            >
              {findAvailableMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Find Available Slots
                </>
              )}
            </Button>
          </form>
        </Form>

        {results && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Available Slots</h3>
              <Badge variant="secondary" data-testid="text-results-count">
                {results.total} found
              </Badge>
            </div>

            {results.slots.length === 0 ? (
              <Card data-testid="card-no-results">
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    No available slots found matching your criteria.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto" data-testid="list-results">
                {results.slots.map((slot, index) => (
                  <Card key={slot.slot_id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {new Date(slot.date).toLocaleDateString()}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {slot.start_time} - {slot.end_time}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {slot.remaining} remaining
                            </Badge>
                            {slot.notes && (
                              <span className="text-sm text-muted-foreground">
                                {slot.notes}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSlotJump(slot)}
                          data-testid={`button-jump-slot-${index}`}
                        >
                          <MapPin className="w-4 h-4 mr-1" />
                          Jump to Slot
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}