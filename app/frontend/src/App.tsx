import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { authService } from "./lib/auth";
import LoginPage from "@/pages/login";
import GrowerDashboard from "@/pages/grower-dashboard";
import AdminPage from "./pages/AdminPage";
import NotFound from "@/pages/not-found";

function Router() {
  const isAuthenticated = authService.isAuthenticated();
  const isAdmin = authService.isAdmin();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Switch>
      <Route path="/" component={isAdmin ? AdminPage : GrowerDashboard} />
      <Route path="/dashboard" component={isAdmin ? AdminPage : GrowerDashboard} />
      {isAdmin && <Route path="/admin" component={AdminPage} />}
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
