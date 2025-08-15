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
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DebugOverlay } from "./components/DebugOverlay";
import { setupReactQueryErrorHandler } from "./lib/global-error-handlers";
import { logger } from "./lib/logger";
import { useState, useEffect } from "react";

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
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [debugOverlayOpen, setDebugOverlayOpen] = useState(false);

  // Setup React Query error handling
  useEffect(() => {
    const errorHandler = setupReactQueryErrorHandler();
    queryClient.setQueryDefaults([''], errorHandler);
  }, []);

  // Debug overlay toggle (Ctrl+Shift+L in dev)
  useEffect(() => {
    if (!logger.isDebugEnabled()) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'L') {
        event.preventDefault();
        setDebugOverlayOpen(prev => !prev);
        logger.debug('debug_overlay', `Debug overlay ${debugOverlayOpen ? 'closed' : 'opened'}`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [debugOverlayOpen]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
          <DebugOverlay 
            isOpen={debugOverlayOpen} 
            onClose={() => setDebugOverlayOpen(false)} 
          />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
