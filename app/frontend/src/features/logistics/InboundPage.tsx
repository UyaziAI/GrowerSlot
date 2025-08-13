/**
 * Inbound logistics page - read-only consignments list with latest checkpoint
 * Feature-flagged behind VITE_FEATURE_LOGISTICS
 */
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Package, Clock, MapPin } from "lucide-react";
import { logisticsApi, type ConsignmentResponse } from "../../api/endpoints";
import { useState } from "react";

const statusColors = {
  pending: "bg-yellow-500",
  in_transit: "bg-blue-500", 
  delivered: "bg-green-500",
  rejected: "bg-red-500"
};

const checkpointIcons = {
  gate_in: MapPin,
  weigh: Package,
  quality_check: Package,
  delivered: Truck,
  rejected: Package
};

export default function InboundPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: consignments = [], isLoading } = useQuery({
    queryKey: ['consignments', selectedDate],
    queryFn: () => logisticsApi.getConsignments(selectedDate),
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded mb-4 w-1/4"></div>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-300 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Inbound Logistics</h1>
          <p className="text-gray-600">Track consignments and delivery progress</p>
        </div>

        {/* Date Selector */}
        <div className="mb-6">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Consignments List */}
        {consignments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Consignments</h3>
              <p className="text-gray-500">No consignments scheduled for {selectedDate}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {consignments.map((consignment: ConsignmentResponse) => (
              <ConsignmentCard key={consignment.id} consignment={consignment} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConsignmentCard({ consignment }: { consignment: ConsignmentResponse }) {
  const latestCheckpoint = consignment.latest_checkpoint;
  const CheckpointIcon = latestCheckpoint ? 
    checkpointIcons[latestCheckpoint.type as keyof typeof checkpointIcons] || Package : 
    Package;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            {consignment.consignment_number}
          </CardTitle>
          <Badge 
            className={`text-white ${statusColors[consignment.status as keyof typeof statusColors] || 'bg-gray-500'}`}
          >
            {consignment.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Quantity Info */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Expected:</span>
          <span className="font-medium">{consignment.expected_quantity} tons</span>
        </div>
        
        {consignment.actual_quantity && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Actual:</span>
            <span className="font-medium">{consignment.actual_quantity} tons</span>
          </div>
        )}

        {/* Latest Checkpoint */}
        {latestCheckpoint && (
          <div className="border-t pt-3">
            <div className="flex items-center space-x-2 mb-2">
              <CheckpointIcon className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-900">
                Latest Update
              </span>
            </div>
            <div className="ml-6">
              <p className="text-sm text-gray-600 capitalize">
                {latestCheckpoint.type.replace('_', ' ')}
              </p>
              <div className="flex items-center space-x-1 text-xs text-gray-500 mt-1">
                <Clock className="h-3 w-3" />
                <span>
                  {new Date(latestCheckpoint.timestamp).toLocaleString()}
                </span>
              </div>
              
              {/* Additional checkpoint data */}
              {latestCheckpoint.payload && Object.keys(latestCheckpoint.payload).length > 0 && (
                <div className="mt-2 text-xs">
                  {latestCheckpoint.payload.plate && (
                    <span className="inline-block bg-gray-100 px-2 py-1 rounded">
                      Plate: {latestCheckpoint.payload.plate}
                    </span>
                  )}
                  {latestCheckpoint.payload.weight && (
                    <span className="inline-block bg-gray-100 px-2 py-1 rounded ml-1">
                      Weight: {latestCheckpoint.payload.weight}kg
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Creation Date */}
        <div className="text-xs text-gray-500 border-t pt-2">
          Created: {new Date(consignment.created_at).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
}