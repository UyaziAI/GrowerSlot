import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Truck, Bell, LogOut } from "lucide-react";
import { authService } from "@/lib/auth";

interface TopNavigationProps {
  title?: string;
  userRole?: string;
  userName?: string;
}

export default function TopNavigation({ 
  title = "Grower Slot", 
  userRole, 
  userName 
}: TopNavigationProps) {
  const handleLogout = () => {
    authService.logout();
    window.location.reload();
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-primary-500 rounded-lg flex items-center justify-center mr-3">
              <Truck className="text-white text-sm h-5 w-5" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          </div>
          <div className="flex items-center space-x-4">
            {userRole && (
              <Badge variant={userRole === 'admin' ? 'default' : 'secondary'}>
                {userRole === 'admin' ? 'Admin' : 'Grower'}
              </Badge>
            )}
            {userName && (
              <div className="hidden md:block text-sm text-gray-600">
                <span data-testid="text-username">{userName}</span>
              </div>
            )}
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600">
              <Bell className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-gray-400 hover:text-gray-600"
              data-testid="button-logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
