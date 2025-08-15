import React, { useEffect } from 'react';
import { Route, useLocation } from 'wouter';
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppShell from './components/AppShell';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import GrowerPage from './pages/grower-dashboard';
import { isAuthenticated, role } from './lib/auth';

function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(to); }, [setLocation, to]);
  return null;
}

function Private({ component: C, allow }: { component: React.ComponentType<any>, allow: 'admin'|'grower'|'any' }) {
  if (!isAuthenticated()) return <Redirect to="/login" />;
  const r = role();
  if (allow !== 'any' && r !== allow) return <Redirect to={r === 'admin' ? '/admin' : '/grower'} />;
  return <AppShell><C /></AppShell>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {/* Public */}
        <Route path="/login" component={LoginPage} />
        {/* Role landings */}
        <Route path="/admin" component={() => <Private component={AdminPage} allow="admin" />} />
        <Route path="/grower" component={() => <Private component={GrowerPage} allow="grower" />} />
        {/* Root redirect */}
        <Route path="/" component={() => {
          if (!isAuthenticated()) return <Redirect to="/login" />;
          return <Redirect to={role() === 'admin' ? '/admin' : '/grower'} />;
        }} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
