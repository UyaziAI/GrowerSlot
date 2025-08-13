import { useEffect } from 'react';
import { useLocation } from 'wouter';

// Component to redirect old booking routes to calendar
export default function BookingRedirect() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    // Redirect to calendar page
    setLocation('/calendar');
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to calendar...</p>
      </div>
    </div>
  );
}