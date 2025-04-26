import { DeveloperTools } from "@/components/DeveloperTools";
import { TestLoginButtons } from "@/components/TestLoginButtons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";

export default function DevLoginPage() {
  const { user, isLoading } = useAuth();
  
  // If already logged in, redirect to home
  if (user) {
    return <Redirect to="/" />;
  }
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Developer Login</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-6 text-center">
            Use the buttons below to quickly log in with test accounts.
          </p>
          
          <div className="space-y-6">
            <TestLoginButtons />
            
            <div className="border-t pt-4">
              <p className="text-sm text-gray-500 mb-3 text-center">Developer Tools</p>
              <DeveloperTools />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}