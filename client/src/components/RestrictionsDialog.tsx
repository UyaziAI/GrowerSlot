import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const restrictionsSchema = z.object({
  scope: z.enum(['slot', 'day', 'week'], { required_error: "Scope is required" }),
  grower_ids: z.array(z.string()).min(1, "At least one grower must be selected"),
  cultivar_ids: z.array(z.string()).min(1, "At least one cultivar must be selected"),
  note: z.string().optional()
});

type RestrictionsFormData = z.infer<typeof restrictionsSchema>;

interface RestrictionsDialogProps {
  slotId?: string;
  selectedDate?: string;
  onSuccess?: () => void;
}

export default function RestrictionsDialog({ slotId, selectedDate, onSuccess }: RestrictionsDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedGrowers, setSelectedGrowers] = useState<string[]>([]);
  const [selectedCultivars, setSelectedCultivars] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<RestrictionsFormData>({
    resolver: zodResolver(restrictionsSchema),
    defaultValues: {
      scope: slotId ? 'slot' : 'day',
      grower_ids: [],
      cultivar_ids: [],
      note: ""
    }
  });

  // Get growers and cultivars for selection
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

  const applyRestrictionsMutation = useMutation({
    mutationFn: async (data: RestrictionsFormData) => {
      const payload = {
        scope: data.scope,
        grower_ids: data.grower_ids,
        cultivar_ids: data.cultivar_ids,
        note: data.note || undefined,
        // Include slot/date context based on scope
        ...(data.scope === 'slot' && slotId && { slot_id: slotId }),
        ...(data.scope !== 'slot' && selectedDate && { restriction_date: selectedDate })
      };

      const response = await fetch('/v1/restrictions/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate slots queries to refresh the grid
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      queryClient.invalidateQueries({ queryKey: ['slotsRange'] });
      
      toast({
        title: "Restrictions Applied",
        description: `Successfully applied restrictions to ${data.affected_count || 'selected'} slots`,
      });
      
      setOpen(false);
      resetForm();
      onSuccess?.();
    },
    onError: (error: any) => {
      if (error.message.includes('403') || error.message.includes('Forbidden')) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to apply restrictions",
          variant: "destructive",
        });
      } else if (error.message.includes('409') || error.message.includes('Conflict')) {
        toast({
          title: "Restriction Conflict",
          description: "A conflicting restriction already exists for this scope",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to apply restrictions",
          variant: "destructive",
        });
      }
    },
  });

  const resetForm = () => {
    form.reset();
    setSelectedGrowers([]);
    setSelectedCultivars([]);
  };

  const handleGrowerSelect = (growerId: string) => {
    const updated = selectedGrowers.includes(growerId)
      ? selectedGrowers.filter(id => id !== growerId)
      : [...selectedGrowers, growerId];
    
    setSelectedGrowers(updated);
    form.setValue('grower_ids', updated);
  };

  const handleCultivarSelect = (cultivarId: string) => {
    const updated = selectedCultivars.includes(cultivarId)
      ? selectedCultivars.filter(id => id !== cultivarId)
      : [...selectedCultivars, cultivarId];
    
    setSelectedCultivars(updated);
    form.setValue('cultivar_ids', updated);
  };

  const onSubmit = (data: RestrictionsFormData) => {
    applyRestrictionsMutation.mutate(data);
  };

  const getScopeDescription = (scope: string) => {
    switch (scope) {
      case 'slot': return `Specific slot${slotId ? ` (${slotId})` : ''}`;
      case 'day': return `All slots on ${selectedDate || 'selected date'}`;
      case 'week': return `All slots in the week containing ${selectedDate || 'selected date'}`;
      default: return scope;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) {
        resetForm();
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-restrictions">
          <Shield className="w-4 h-4 mr-2" />
          Apply Restrictions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-restrictions">
        <DialogHeader>
          <DialogTitle>Apply Slot Restrictions</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Scope Selection */}
            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Restriction Scope</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-scope">
                        <SelectValue placeholder="Select restriction scope" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {slotId && (
                        <SelectItem value="slot">Single Slot</SelectItem>
                      )}
                      <SelectItem value="day">Entire Day</SelectItem>
                      <SelectItem value="week">Entire Week</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {getScopeDescription(field.value)}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Grower Selection */}
            <div className="space-y-3">
              <FormLabel>Restricted Growers</FormLabel>
              <div className="space-y-2">
                {growers.map((grower: any) => (
                  <div
                    key={grower.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedGrowers.includes(grower.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                    onClick={() => handleGrowerSelect(grower.id)}
                    data-testid={`grower-option-${grower.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{grower.name}</span>
                      {selectedGrowers.includes(grower.id) && (
                        <Badge variant="default">Selected</Badge>
                      )}
                    </div>
                    {grower.contact_email && (
                      <p className="text-sm text-muted-foreground">{grower.contact_email}</p>
                    )}
                  </div>
                ))}
              </div>
              {form.formState.errors.grower_ids && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.grower_ids.message}
                </p>
              )}
            </div>

            {/* Cultivar Selection */}
            <div className="space-y-3">
              <FormLabel>Restricted Cultivars</FormLabel>
              <div className="space-y-2">
                {cultivars.map((cultivar: any) => (
                  <div
                    key={cultivar.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedCultivars.includes(cultivar.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                    onClick={() => handleCultivarSelect(cultivar.id)}
                    data-testid={`cultivar-option-${cultivar.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{cultivar.name}</span>
                      {selectedCultivars.includes(cultivar.id) && (
                        <Badge variant="default">Selected</Badge>
                      )}
                    </div>
                    {cultivar.description && (
                      <p className="text-sm text-muted-foreground">{cultivar.description}</p>
                    )}
                  </div>
                ))}
              </div>
              {form.formState.errors.cultivar_ids && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.cultivar_ids.message}
                </p>
              )}
            </div>

            {/* Note Field */}
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Restriction Note (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Explain why this restriction is being applied..."
                      {...field}
                      data-testid="input-note"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Summary Card */}
            {(selectedGrowers.length > 0 || selectedCultivars.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Restriction Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm font-medium">Growers:</span>
                    {selectedGrowers.map(id => {
                      const grower = growers.find((g: any) => g.id === id);
                      return (
                        <Badge key={id} variant="outline">
                          {grower?.name}
                        </Badge>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm font-medium">Cultivars:</span>
                    {selectedCultivars.map(id => {
                      const cultivar = cultivars.find((c: any) => c.id === id);
                      return (
                        <Badge key={id} variant="outline">
                          {cultivar?.name}
                        </Badge>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Submit Button */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={applyRestrictionsMutation.isPending || selectedGrowers.length === 0 || selectedCultivars.length === 0}
                data-testid="button-submit-restrictions"
              >
                {applyRestrictionsMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Apply Restrictions
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}