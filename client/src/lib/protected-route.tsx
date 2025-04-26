import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Route, useLocation } from "wouter";
import { useEffect } from "react";

// Simplified ProtectedRoute component to avoid potential infinite loops
export function ProtectedRoute({
  path,
  component: Component,
  requireVerification = true,
}: {
  path: string;
  component: () => React.JSX.Element;
  requireVerification?: boolean;
}) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  
  // Basic redirection effect
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate("/auth");
      } else if (requireVerification && user.verification_pending) {
        navigate("/auth");
      }
    }
  }, [isLoading, navigate, requireVerification, user]);

  // Simple conditional rendering
  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }
  
  // Only render component if user is verified (or verification not required)
  if (user && (!requireVerification || !user.verification_pending)) {
    return <Route path={path} component={Component} />;
  }
  
  // Return empty route for unauthorized state
  return <Route path={path}><div></div></Route>;
}
