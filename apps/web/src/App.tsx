import { lazy, Suspense } from 'react';
import { ApolloProvider } from '@apollo/client';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { apolloClient } from "./lib/apollo";
import { AuthProvider, useAuth } from "./lib/auth";
import { PatientModalProvider } from "./components/PatientModalContext";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Leads = lazy(() => import("./pages/Leads"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Patients = lazy(() => import("./pages/Patients"));
const Settings = lazy(() => import("./pages/Settings"));
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function LoginRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  // Don't redirect while auth is still loading
  if (loading) return null;
  
  // Only redirect if React auth state confirms user is logged in
  if (user) {
    const from = (location.state as any)?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <PatientModalProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                <Route 
                  path="/login" 
                  element={
                    <LoginRoute>
                      <Login />
                    </LoginRoute>
                  } 
                />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/leads"
                  element={
                    <ProtectedRoute>
                      <Leads />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/schedule"
                  element={
                    <ProtectedRoute>
                      <Agenda />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patients"
                  element={
                    <ProtectedRoute>
                      <Patients />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </PatientModalProvider>
        </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ApolloProvider>
  );
}

export default App;
