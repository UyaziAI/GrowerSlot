import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ChevronLeft, ChevronRight, Calendar, CalendarDays, BarChart3, Settings, Plus, Edit2, Trash2, FileText, Ban, Shield } from "lucide-react";
import { useLocation } from "wouter";
import TopNavigation from "@/components/top-navigation";
import CalendarGrid from "@/features/booking/components/CalendarGrid";
import { useSlotsRange, useSlotsSingle } from "@/features/booking/hooks/useSlotsRange";
import { api } from "@/lib/api";
import { authService } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { SlotWithUsage } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const TENANT_TZ = 'Africa/Johannesburg';

type ViewMode = 'month' | 'week' | 'day';

// Bulk Create Form Schema - matching backend API
const bulkCreateSchema = z.object({
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"), 
  weekdays: z.array(z.string()).min(1, "At least one weekday must be selected"),
  slot_length_min: z.number().min(1, "Slot length must be at least 1 minute").default(60),
  capacity: z.number().min(1, "Capacity must be at least 1").default(10),
  notes: z.string().default("")
});

type BulkCreateFormData = z.infer<typeof bulkCreateSchema>;

interface BulkCreateFormProps {
  startDate: string;
  endDate: string;
  onSubmit: (data: BulkCreateFormData) => void;
  isPending: boolean;
}

function BulkCreateForm({ startDate, endDate, onSubmit, isPending }: BulkCreateFormProps) {
  const form = useForm<BulkCreateFormData>({
    resolver: zodResolver(bulkCreateSchema),
    defaultValues: {
      start_date: startDate,
      end_date: endDate,
      weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'], // Default to weekdays
      slot_length_min: 60,
      capacity: 10,
      notes: ""
    }
  });

  const weekdayOptions = [
    { id: 'mon', label: 'Monday' },
    { id: 'tue', label: 'Tuesday' },
    { id: 'wed', label: 'Wednesday' },
    { id: 'thu', label: 'Thursday' },
    { id: 'fri', label: 'Friday' },
    { id: 'sat', label: 'Saturday' },
    { id: 'sun', label: 'Sunday' }
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="start-date-input" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="end-date-input" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="weekdays"
          render={() => (
            <FormItem>
              <FormLabel>Days of Week</FormLabel>
              <div className="flex flex-wrap gap-3 mt-2">
                {weekdayOptions.map((option) => (
                  <FormField
                    key={option.id}
                    control={form.control}
                    name="weekdays"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={option.id}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(option.id)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...field.value, option.id])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== option.id
                                      )
                                    )
                              }}
                              data-testid={`weekday-${option.id}`}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal">
                            {option.label}
                          </FormLabel>
                        </FormItem>
                      )
                    }}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="slot_length_min"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slot Length (minutes)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="1"
                    {...field} 
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                    data-testid="slot-length-input"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capacity</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="1"
                    {...field} 
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                    data-testid="capacity-input"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Additional notes for these slots..."
                  {...field}
                  data-testid="notes-textarea"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button 
            type="submit" 
            disabled={isPending}
            data-testid="confirm-bulk-create"
          >
            {isPending ? 'Creating...' : 'Create Slots'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [showBulkCreateDialog, setShowBulkCreateDialog] = useState(false);
  const [showCreateSlotDialog, setShowCreateSlotDialog] = useState(false);
  const [showEditSlotDialog, setShowEditSlotDialog] = useState(false);
  const [showApplyTemplateDialog, setShowApplyTemplateDialog] = useState(false);
  const [showTemplatesDrawer, setShowTemplatesDrawer] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotWithUsage | null>(null);
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = authService.getUser();

  // Read feature flags from environment variables
  const FEATURE_ADMIN_TEMPLATES = import.meta.env.VITE_FEATURE_ADMIN_TEMPLATES === 'true';
  const FEATURE_NEXT_AVAILABLE = import.meta.env.VITE_FEATURE_NEXT_AVAILABLE === 'true';

  // RBAC enforcement - redirect non-admin users
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      setLocation('/calendar');
      return;
    }
  }, [user, setLocation]);

  // Calculate date range based on view mode using timezone normalization
  const getDateRange = () => {
    const selected = dayjs(selectedDate).tz(TENANT_TZ);
    
    switch (viewMode) {
      case 'month': {
        const startOfMonth = selected.startOf('month');
        const endOfMonth = selected.endOf('month');
        return {
          startDate: startOfMonth.format('YYYY-MM-DD'),
          endDate: endOfMonth.format('YYYY-MM-DD')
        };
      }
      case 'week': {
        const startOfWeek = selected.startOf('week');
        const endOfWeek = selected.endOf('week');
        return {
          startDate: startOfWeek.format('YYYY-MM-DD'),
          endDate: endOfWeek.format('YYYY-MM-DD')
        };
      }
      case 'day': {
        return {
          startDate: selected.format('YYYY-MM-DD'),
          endDate: selected.format('YYYY-MM-DD')
        };
      }
    }
  };

  const { startDate, endDate } = getDateRange();
  
  // Use range hook for all view modes - no client-side fabrication
  const {
    data: slots = [],
    isLoading: slotsLoading,
    error: slotsError
  } = useSlotsRange(startDate, endDate, true);

  // Admin stats with proper tenant scoping
  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats', user?.tenantId, startDate],
    queryFn: () => api.getDashboardStats(startDate),
    enabled: !!user?.tenantId,
    staleTime: 0 // Always fresh for admin
  });

  // Templates query - only enabled when feature flag is active
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['admin', 'templates', user?.tenantId],
    queryFn: () => api.getTemplates(),
    enabled: !!user?.tenantId && FEATURE_ADMIN_TEMPLATES,
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  // Navigation handlers with timezone awareness
  const navigatePrevious = () => {
    const prev = dayjs(selectedDate).subtract(1, viewMode);
    setSelectedDate(prev.toDate());
  };

  const navigateNext = () => {
    const next = dayjs(selectedDate).add(1, viewMode);
    setSelectedDate(next.toDate());
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const handleDateSelect = (date: Date | string) => {
    setSelectedDate(new Date(date));
  };

  // CRUD operations using /v1 endpoints
  const bulkCreateSlotsMutation = useMutation({
    mutationFn: (data: any) => api.bulkCreateSlots(data),
    onSuccess: () => {
      // Invalidate specific range query for immediate grid refresh
      queryClient.invalidateQueries({ queryKey: ['slots', 'range', user?.tenantId, startDate, endDate] });
      // Also invalidate general slots queries for comprehensive cache refresh
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      toast({ title: "Success", description: "Slots created successfully" });
      // Close both dialogs since they use the same mutation
      setShowBulkCreateDialog(false);
      setShowCreateSlotDialog(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create slots",
        variant: "destructive" 
      });
    }
  });

  const updateSlotMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateSlot(id, data),
    onSuccess: () => {
      // Invalidate specific range query for immediate grid refresh
      queryClient.invalidateQueries({ queryKey: ['slots', 'range', user?.tenantId, startDate, endDate] });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      toast({ title: "Success", description: "Slot updated successfully" });
      setShowEditSlotDialog(false);
      setSelectedSlot(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update slot",
        variant: "destructive" 
      });
    }
  });

  // Preview template mutation
  const previewTemplateMutation = useMutation({
    mutationFn: (data: any) => api.applyTemplate(data),
    onSuccess: (result) => {
      setPreviewResult(result);
      toast({ 
        title: "Preview Generated", 
        description: `Preview shows ${result.created} new, ${result.updated} updates, ${result.skipped} existing slots`
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Preview Failed", 
        description: error.message || "Failed to generate preview",
        variant: "destructive" 
      });
    }
  });

  // Publish template mutation
  const publishTemplateMutation = useMutation({
    mutationFn: (data: any) => api.applyTemplate(data),
    onSuccess: (result) => {
      // Invalidate specific range query for immediate grid refresh
      queryClient.invalidateQueries({ queryKey: ['slots', 'range', user?.tenantId, startDate, endDate] });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      toast({ 
        title: "Template Published", 
        description: `Applied: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped` 
      });
      
      // Reset dialog state and close
      setPreviewResult(null);
      setSelectedTemplate(null);
      setShowApplyTemplateDialog(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Publish Failed", 
        description: error.message || "Failed to publish template",
        variant: "destructive" 
      });
    }
  });

  const handleSlotClick = (slot: SlotWithUsage) => {
    setSelectedSlot(slot);
    setShowEditSlotDialog(true);
  };

  const handleBookingCreate = async (slotId: string, bookingData: any) => {
    try {
      await api.createBooking({ ...bookingData, slotId });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      toast({ title: "Success", description: "Booking created successfully" });
    } catch (error: any) {
      if (error.status === 409) {
        toast({ 
          title: "Slot Full", 
          description: "This slot is at capacity",
          variant: "destructive" 
        });
      } else if (error.status === 403) {
        toast({ 
          title: "Access Denied", 
          description: "Booking not allowed due to restrictions",
          variant: "destructive" 
        });
      } else {
        toast({ 
          title: "Error", 
          description: error.message || "Failed to create booking",
          variant: "destructive" 
        });
      }
    }
  };

  // Show empty state when no slots from backend  
  const showEmptyState = !slotsLoading && slots.length === 0;
  
  // Calculate summary stats from backend data only
  const totalSlots = slots.length;
  const availableSlots = slots.filter((slot: SlotWithUsage) => !slot.blackout && (slot.remaining ?? 0) > 0).length;
  const blackedOutSlots = slots.filter((slot: SlotWithUsage) => slot.blackout).length;

  // Early return for non-admin users
  if (!user || user.role !== 'admin') {
    return <div>Access denied. Redirecting...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation userRole={user?.role} userName="Packhouse Admin" />

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header with Admin Calendar Controls */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Calendar</h2>
              <p className="text-gray-600">
                Full calendar control for slot and booking management
              </p>
            </div>
            
            {/* View Mode Toggle - Month/Week/Day */}
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('month')}
                data-testid="month-view-button"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Month
              </Button>
              <Button
                variant={viewMode === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('week')}
                data-testid="week-view-button"
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                Week
              </Button>
              <Button
                variant={viewMode === 'day' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('day')}
                data-testid="day-view-button"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Day
              </Button>
              
              {/* CRUD Actions */}
              <div className="border-l border-gray-300 ml-2 pl-2 flex items-center space-x-2">
                {/* Templates Drawer - only visible when feature flag is enabled */}
                {FEATURE_ADMIN_TEMPLATES && (
                  <Sheet open={showTemplatesDrawer} onOpenChange={setShowTemplatesDrawer}>
                    <SheetTrigger asChild>
                      <Button size="sm" variant="outline" data-testid="templates-drawer-button">
                        <FileText className="h-4 w-4 mr-2" />
                        Templates
                      </Button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>Templates</SheetTitle>
                      </SheetHeader>
                      <div className="mt-6">
                        {templatesLoading ? (
                          <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="text-sm text-gray-600 mt-2">Loading templates...</p>
                          </div>
                        ) : templates.length === 0 ? (
                          <div className="text-center py-8">
                            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">No templates yet</p>
                            <Button className="mt-4" size="sm">
                              <Plus className="h-4 w-4 mr-2" />
                              Create Template
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {templates.map((template: any) => (
                              <div key={template.id} className="border rounded-lg p-3">
                                <h3 className="font-medium">{template.name}</h3>
                                <p className="text-sm text-gray-600">{template.description}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </SheetContent>
                  </Sheet>
                )}

                {/* Apply Template Dialog */}
                <Dialog open={showApplyTemplateDialog} onOpenChange={(open) => {
                  setShowApplyTemplateDialog(open);
                  if (!open) {
                    setPreviewResult(null);
                    setSelectedTemplate(null);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" data-testid="apply-template-button">
                      <Settings className="h-4 w-4 mr-2" />
                      Apply Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Apply Template</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                      {/* Template Selection */}
                      {!selectedTemplate ? (
                        <div>
                          <p className="text-sm text-gray-600 mb-4">
                            Select a template to apply to the date range {startDate} to {endDate}.
                          </p>
                          {templatesLoading ? (
                            <div className="text-center py-4">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                              <p className="text-sm text-gray-600 mt-2">Loading templates...</p>
                            </div>
                          ) : templates.length === 0 ? (
                            <div className="text-center py-8">
                              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                              <p className="text-gray-600">No templates available</p>
                              <p className="text-sm text-gray-500 mt-2">Create a template first to use this feature.</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {templates.map((template: any) => (
                                <div 
                                  key={template.id} 
                                  className="border rounded-lg p-3 cursor-pointer hover:border-blue-500 transition-colors"
                                  onClick={() => setSelectedTemplate(template)}
                                  data-testid={`template-${template.id}`}
                                >
                                  <h3 className="font-medium">{template.name}</h3>
                                  <p className="text-sm text-gray-600">{template.description}</p>
                                  <div className="text-xs text-gray-500 mt-1">
                                    Weekdays: {template.weekdays?.join(', ') || 'All'} | 
                                    Slot Length: {template.slot_length_min || 60}min | 
                                    Capacity: {template.capacity || 10}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          {/* Selected Template Info */}
                          <div className="border rounded-lg p-3 mb-4 bg-blue-50">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-medium">{selectedTemplate.name}</h3>
                                <p className="text-sm text-gray-600">{selectedTemplate.description}</p>
                                <div className="text-xs text-gray-500 mt-1">
                                  Range: {startDate} to {endDate}
                                </div>
                              </div>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => {
                                  setSelectedTemplate(null);
                                  setPreviewResult(null);
                                }}
                                data-testid="change-template"
                              >
                                Change
                              </Button>
                            </div>
                          </div>

                          {/* Preview Results */}
                          {previewResult && (
                            <div className="border rounded-lg p-4 mb-4 bg-gray-50">
                              <h4 className="font-medium mb-3">Preview Results</h4>
                              
                              {/* Summary Counts */}
                              <div className="grid grid-cols-3 gap-4 mb-4">
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-green-600" data-testid="preview-created-count">
                                    {previewResult.created || 0}
                                  </div>
                                  <div className="text-sm text-gray-600">New Slots</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-blue-600" data-testid="preview-updated-count">
                                    {previewResult.updated || 0}
                                  </div>
                                  <div className="text-sm text-gray-600">Updated</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-gray-600" data-testid="preview-skipped-count">
                                    {previewResult.skipped || 0}
                                  </div>
                                  <div className="text-sm text-gray-600">Unchanged</div>
                                </div>
                              </div>

                              {/* Sample Lists */}
                              {(previewResult.samples?.created?.length > 0 || 
                                previewResult.samples?.updated?.length > 0 || 
                                previewResult.samples?.skipped?.length > 0) && (
                                <div className="space-y-3">
                                  {previewResult.samples?.created?.length > 0 && (
                                    <div>
                                      <h5 className="text-sm font-medium text-green-700 mb-1">New Slots (sample)</h5>
                                      <div className="text-xs space-y-1" data-testid="preview-created-samples">
                                        {previewResult.samples.created.slice(0, 5).map((slot: any, i: number) => (
                                          <div key={i} className="text-gray-600">
                                            {slot.date} {slot.start_time}-{slot.end_time} (Capacity: {slot.capacity})
                                          </div>
                                        ))}
                                        {previewResult.samples.created.length > 5 && (
                                          <div className="text-gray-500">... and {previewResult.samples.created.length - 5} more</div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {previewResult.samples?.updated?.length > 0 && (
                                    <div>
                                      <h5 className="text-sm font-medium text-blue-700 mb-1">Updated Slots (sample)</h5>
                                      <div className="text-xs space-y-1" data-testid="preview-updated-samples">
                                        {previewResult.samples.updated.slice(0, 5).map((slot: any, i: number) => (
                                          <div key={i} className="text-gray-600">
                                            {slot.date} {slot.start_time}-{slot.end_time} (Capacity: {slot.old_capacity}→{slot.capacity})
                                          </div>
                                        ))}
                                        {previewResult.samples.updated.length > 5 && (
                                          <div className="text-gray-500">... and {previewResult.samples.updated.length - 5} more</div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            {!previewResult ? (
                              <Button 
                                onClick={() => {
                                  previewTemplateMutation.mutate({
                                    template_id: selectedTemplate.id,
                                    start_date: startDate,
                                    end_date: endDate,
                                    mode: 'preview'
                                  });
                                }}
                                disabled={previewTemplateMutation.isPending}
                                data-testid="preview-template"
                              >
                                {previewTemplateMutation.isPending ? 'Previewing...' : 'Preview Changes'}
                              </Button>
                            ) : (
                              <>
                                <Button 
                                  onClick={() => {
                                    previewTemplateMutation.mutate({
                                      template_id: selectedTemplate.id,
                                      start_date: startDate,
                                      end_date: endDate,
                                      mode: 'preview'
                                    });
                                  }}
                                  disabled={previewTemplateMutation.isPending}
                                  variant="outline"
                                  data-testid="refresh-preview"
                                >
                                  {previewTemplateMutation.isPending ? 'Refreshing...' : 'Refresh Preview'}
                                </Button>
                                <Button 
                                  onClick={() => {
                                    publishTemplateMutation.mutate({
                                      template_id: selectedTemplate.id,
                                      start_date: startDate,
                                      end_date: endDate,
                                      mode: 'publish'
                                    });
                                  }}
                                  disabled={publishTemplateMutation.isPending || (previewResult.created === 0 && previewResult.updated === 0)}
                                  data-testid="publish-template"
                                >
                                  {publishTemplateMutation.isPending ? 'Publishing...' : 'Publish Changes'}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Create Slots Dialog */}
                <Dialog open={showCreateSlotDialog} onOpenChange={setShowCreateSlotDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="create-slots-button">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Slots
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Slots</DialogTitle>
                    </DialogHeader>
                    <BulkCreateForm
                      startDate={startDate}
                      endDate={endDate}
                      onSubmit={(data) => bulkCreateSlotsMutation.mutate(data)}
                      isPending={bulkCreateSlotsMutation.isPending}
                    />
                  </DialogContent>
                </Dialog>

                <Dialog open={showBulkCreateDialog} onOpenChange={setShowBulkCreateDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="bulk-create-button">
                      <Plus className="h-4 w-4 mr-2" />
                      Bulk Create
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Bulk Create Slots</DialogTitle>
                    </DialogHeader>
                    <BulkCreateForm
                      startDate={startDate}
                      endDate={endDate}
                      onSubmit={(data) => bulkCreateSlotsMutation.mutate(data)}
                      isPending={bulkCreateSlotsMutation.isPending}
                    />
                  </DialogContent>
                </Dialog>

                {/* Blackout Button */}
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    toast({ title: "Blackout", description: "Blackout functionality not yet implemented" });
                  }}
                  data-testid="blackout-button"
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Blackout
                </Button>

                {/* Restrictions Button */}
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    toast({ title: "Restrictions", description: "Restrictions functionality not yet implemented" });
                  }}
                  data-testid="restrictions-button"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Restrictions
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Total Slots
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold">{stats.totalSlots || totalSlots}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Available</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold text-green-600">{stats.availableSlots || availableSlots}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Booked</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold text-blue-600">{stats.bookedSlots || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Blackout</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold text-red-600">{blackedOutSlots}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Date Navigation */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={navigatePrevious}
                data-testid="prev-date-button"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="text-center">
                <h2 className="text-lg font-semibold">
                  {dayjs(selectedDate).format(
                    viewMode === 'month' ? 'MMMM YYYY' :
                    viewMode === 'week' ? '[Week of] MMM D, YYYY' :
                    'dddd, MMMM D, YYYY'
                  )}
                </h2>
                <p className="text-sm text-gray-600">
                  {startDate} to {endDate}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToToday}
                  className="text-blue-600 hover:text-blue-800"
                  data-testid="today-button"
                >
                  Go to Today
                </Button>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={navigateNext}
                data-testid="next-date-button"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Calendar Content */}
        <Card className="p-0 overflow-hidden">
          <CardContent className="p-0">
            {slotsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading calendar data...</p>
              </div>
            ) : showEmptyState ? (
              <div className="text-center py-12" data-testid="empty-state">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No slots defined by admin</h3>
                <p className="text-gray-600 mb-4">
                  No slots are available for the period {startDate} to {endDate}.
                </p>
                <Button onClick={() => setShowBulkCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Slots
                </Button>
              </div>
            ) : slotsError ? (
              <div className="text-center py-12">
                <p className="text-red-600">Error loading calendar data: {slotsError.message}</p>
              </div>
            ) : (
              <AdminCalendarView
                viewMode={viewMode}
                selectedDate={selectedDate}
                slots={slots}
                onSlotClick={handleSlotClick}
                onDateSelect={handleDateSelect}
                onBookingCreate={handleBookingCreate}
              />
            )}
          </CardContent>
        </Card>

        {/* Edit Slot Dialog */}
        <Dialog open={showEditSlotDialog} onOpenChange={setShowEditSlotDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Slot</DialogTitle>
            </DialogHeader>
            {selectedSlot && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Capacity</label>
                  <p className="text-sm text-gray-600">Current: {selectedSlot.capacity}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <p className="text-sm text-gray-600">
                    {selectedSlot.blackout ? 'Blackout' : 'Active'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Usage</label>
                  <p className="text-sm text-gray-600">
                    {selectedSlot.booked || 0} booked / {selectedSlot.remaining || 0} remaining
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    onClick={() => {
                      updateSlotMutation.mutate({
                        id: selectedSlot.id,
                        data: { blackout: !selectedSlot.blackout }
                      });
                    }}
                    disabled={updateSlotMutation.isPending}
                    variant="outline"
                    data-testid="toggle-blackout"
                  >
                    {selectedSlot.blackout ? 'Remove Blackout' : 'Set Blackout'}
                  </Button>
                  <Button
                    onClick={() => {
                      updateSlotMutation.mutate({
                        id: selectedSlot.id,
                        data: { capacity: Number(selectedSlot.capacity || 0) + 50 }
                      });
                    }}
                    disabled={updateSlotMutation.isPending}
                    data-testid="increase-capacity"
                  >
                    Increase Capacity
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// Admin Calendar View Component - renders different views based on mode
function AdminCalendarView({
  viewMode,
  selectedDate,
  slots,
  onSlotClick,
  onDateSelect,
  onBookingCreate
}: {
  viewMode: ViewMode;
  selectedDate: Date;
  slots: SlotWithUsage[];
  onSlotClick: (slot: SlotWithUsage) => void;
  onDateSelect: (date: Date | string) => void;
  onBookingCreate: (slotId: string, data: any) => void;
}) {
  // Group slots by date for calendar rendering
  const slotsByDate = slots.reduce((acc, slot) => {
    const dateKey = slot.date.toString();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(slot);
    return acc;
  }, {} as Record<string, SlotWithUsage[]>);

  switch (viewMode) {
    case 'month':
      return <AdminMonthView 
        selectedDate={selectedDate} 
        slotsByDate={slotsByDate}
        onDateSelect={onDateSelect}
        onSlotClick={onSlotClick}
      />;
    case 'week':
      return <AdminWeekView 
        selectedDate={selectedDate} 
        slotsByDate={slotsByDate}
        onDateSelect={onDateSelect}
        onSlotClick={onSlotClick}
      />;
    case 'day':
      return <AdminDayView 
        selectedDate={selectedDate} 
        slots={slots.filter(s => s.date === dayjs(selectedDate).format('YYYY-MM-DD'))}
        onSlotClick={onSlotClick}
        onBookingCreate={onBookingCreate}
      />;
    default:
      return <div>Invalid view mode</div>;
  }
}

// Month view component
function AdminMonthView({ selectedDate, slotsByDate, onDateSelect, onSlotClick }: {
  selectedDate: Date;
  slotsByDate: Record<string, SlotWithUsage[]>;
  onDateSelect: (date: Date | string) => void;
  onSlotClick: (slot: SlotWithUsage) => void;
}) {
  const monthStart = dayjs(selectedDate).startOf('month');
  const monthEnd = dayjs(selectedDate).endOf('month');
  const calendarStart = monthStart.startOf('week');
  const calendarEnd = monthEnd.endOf('week');
  
  const days = [];
  let current = calendarStart;
  
  while (current.isBefore(calendarEnd) || current.isSame(calendarEnd, 'day')) {
    days.push(current);
    current = current.add(1, 'day');
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const dateKey = day.format('YYYY-MM-DD');
          const daySlots = slotsByDate[dateKey] || [];
          const isCurrentMonth = day.month() === monthStart.month();
          
          return (
            <div
              key={dateKey}
              className={`min-h-24 border rounded-lg p-2 cursor-pointer hover:bg-gray-50 ${
                isCurrentMonth ? 'bg-white' : 'bg-gray-50'
              }`}
              onClick={() => onDateSelect(day.toDate())}
              data-testid={`calendar-day-${dateKey}`}
            >
              <div className="text-sm font-medium mb-1">{day.date()}</div>
              <div className="space-y-1">
                {daySlots.slice(0, 3).map(slot => (
                  <div
                    key={slot.id}
                    className={`text-xs px-1 py-0.5 rounded cursor-pointer ${
                      slot.blackout 
                        ? 'bg-gray-200 text-gray-600' 
                        : (slot.remaining || 0) > 0 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSlotClick(slot);
                    }}
                  >
                    {slot.startTime}-{slot.endTime}
                  </div>
                ))}
                {daySlots.length > 3 && (
                  <div className="text-xs text-gray-500">+{daySlots.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Week view component
function AdminWeekView({ selectedDate, slotsByDate, onDateSelect, onSlotClick }: {
  selectedDate: Date;
  slotsByDate: Record<string, SlotWithUsage[]>;
  onDateSelect: (date: Date | string) => void;
  onSlotClick: (slot: SlotWithUsage) => void;
}) {
  const weekStart = dayjs(selectedDate).startOf('week');
  const weekDays = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));

  return (
    <div className="p-6">
      <div className="grid grid-cols-7 gap-4">
        {weekDays.map(day => {
          const dateKey = day.format('YYYY-MM-DD');
          const daySlots = slotsByDate[dateKey] || [];
          
          return (
            <div
              key={dateKey}
              className="border rounded-lg p-4 min-h-48 cursor-pointer hover:bg-gray-50"
              onClick={() => onDateSelect(day.toDate())}
              data-testid={`week-day-${dateKey}`}
            >
              <div className="font-semibold mb-3">{day.format('ddd D')}</div>
              <div className="space-y-2">
                {daySlots.map(slot => (
                  <div
                    key={slot.id}
                    className={`text-sm p-2 rounded cursor-pointer ${
                      slot.blackout 
                        ? 'bg-gray-200 text-gray-600' 
                        : (slot.remaining || 0) > 0 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSlotClick(slot);
                    }}
                  >
                    <div className="font-medium">{slot.startTime}-{slot.endTime}</div>
                    <div className="text-xs">{slot.remaining || 0}/{slot.capacity} available</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Day view component
function AdminDayView({ selectedDate, slots, onSlotClick, onBookingCreate }: {
  selectedDate: Date;
  slots: SlotWithUsage[];
  onSlotClick: (slot: SlotWithUsage) => void;
  onBookingCreate: (slotId: string, data: any) => void;
}) {
  return (
    <div className="p-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          {dayjs(selectedDate).format('dddd, MMMM D, YYYY')}
        </h3>
        {slots.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No slots defined for this day
          </div>
        ) : (
          <div className="space-y-3">
            {slots.map(slot => (
              <div
                key={slot.id}
                className={`border rounded-lg p-4 cursor-pointer hover:bg-gray-50 ${
                  slot.blackout ? 'bg-gray-100' : 'bg-white'
                }`}
                onClick={() => onSlotClick(slot)}
                data-testid={`day-slot-${slot.id}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{slot.startTime} - {slot.endTime}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Capacity: {slot.capacity} | Booked: {slot.booked || 0} | 
                      Available: {slot.remaining || 0}
                    </div>
                    {slot.notes && (
                      <div className="text-sm text-gray-500 mt-1">{slot.notes}</div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Badge 
                      variant={slot.blackout ? 'destructive' : 
                        (slot.remaining || 0) > 0 ? 'default' : 'secondary'}
                    >
                      {slot.blackout ? 'Blackout' : 
                       (slot.remaining || 0) > 0 ? 'Available' : 'Full'}
                    </Badge>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSlotClick(slot);
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}