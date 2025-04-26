import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import DevLoginPage from "@/pages/DevLoginPage";
import SimpleDashboard from "@/pages/SimpleDashboard";
import { AuthProvider } from "./hooks/use-auth";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import StudentDashboard from "@/components/StudentDashboard";
import FacultyContentPage from "@/pages/faculty-content-page";
import FacultyAnalyticsPage from "@/pages/faculty-analytics-page";
import InteractiveLearningPage from "./interactive-learning/pages/InteractiveLearningPage";

// Admin components
import { StudentApproval } from "@/components/StudentApproval";
import { StudentBulkSync } from "@/components/StudentBulkSync";
import { ManualAddStudent } from "@/components/ManualAddStudent";
import { ManualAddFaculty } from "@/components/ManualAddFaculty";
import { ManualAddAdmin } from "@/components/ManualAddAdmin";
import { DepartmentCreation } from "@/components/DepartmentCreation";
import { DepartmentDeletion } from "@/components/DepartmentDeletion";
import { DepartmentManagement } from "@/components/DepartmentManagement";
import { DeleteStudent } from "@/components/DeleteStudent";
import { FacultyManagement } from "@/components/FacultyManagement";
import { DeleteAdmin } from "@/components/DeleteAdmin";
import { FacultyApproval } from "@/components/FacultyApproval";
import { AdminApproval } from "@/components/AdminApproval";

// Simple protected route implementation
function ProtectedComponent({ 
  component, 
  requireVerification = true 
}: { 
  component: React.ComponentType<any>; 
  requireVerification?: boolean 
}) {
  const Component = component;
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate("/auth");
      } else if (requireVerification && user.verification_pending) {
        navigate("/auth");
      }
    }
  }, [isLoading, navigate, requireVerification, user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || (requireVerification && user.verification_pending)) {
    return null; // Will be redirected by the effect
  }

  return <Component />;
}

// Admin routes need an additional admin check
function AdminProtectedComponent({ component }: { component: React.ComponentType<any> }) {
  const Component = component;
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate("/auth");
      } else if (user.verification_pending) {
        navigate("/auth");
      } else if (user.role !== "admin") {
        navigate("/"); // Redirect non-admins back to home
      }
    }
  }, [isLoading, navigate, user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.verification_pending || user.role !== "admin") {
    return null; // Will be redirected by the effect
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      {/* SimpleDashboard now acts as a proper landing page with login/register options */}
      <Route path="/" component={SimpleDashboard} />

      {/* User dashboard after login (protected) */}
      <Route path="/home">
        {() => <ProtectedComponent component={HomePage} />}
      </Route>

      {/* Student Content Dashboard */}
      <Route path="/student/content">
        {() => <ProtectedComponent component={StudentDashboard} />}
      </Route>

      {/* Faculty Content Upload */}
      <Route path="/faculty/content">
        {() => <ProtectedComponent component={FacultyContentPage} />}
      </Route>

      {/* Faculty Analytics Page */}
      <Route path="/faculty/analytics">
        {() => <ProtectedComponent component={FacultyAnalyticsPage} />}
      </Route>

      {/* Interactive Learning Module */}
      <Route path="/interactive-learning">
        {() => <ProtectedComponent component={InteractiveLearningPage} />}
      </Route>

      {/* Authentication pages */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/dev-login" component={DevLoginPage} />

      {/* Admin functionality is handled in /home route */}

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;