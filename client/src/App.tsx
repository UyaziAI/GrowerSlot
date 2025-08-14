import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { authService } from "./lib/auth";
import LoginPage from "@/pages/login";
import GrowerDashboard from "@/pages/grower-dashboard";
import CalendarPage from "@/pages/calendar-page";
import BookingRedirect from "@/pages/booking-redirect";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminSlotsPage from "@/pages/admin-slots";
import AdminCalendarPage from "@/features/admin/AdminCalendarPage";
import NotFound from "@/pages/not-found";

function Router() {
  const isAuthenticated = authService.isAuthenticated();
  const isAdmin = authService.isAdmin();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Switch>
      <Route path="/" component={isAdmin ? AdminDashboard : CalendarPage} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/booking" component={BookingRedirect} />
      <Route path="/slots" component={BookingRedirect} />
      <Route path="/dashboard" component={isAdmin ? AdminDashboard : GrowerDashboard} />
      <Route path="/grower-dashboard" component={GrowerDashboard} />
      {isAdmin && <Route path="/admin" component={AdminDashboard} />}
      {isAdmin && <Route path="/admin/slots" component={AdminSlotsPage} />}
      {isAdmin && <Route path="/admin/calendar" component={AdminCalendarPage} />}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
