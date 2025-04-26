import React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

export function TestLoginButtons() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const handleTestLogin = async (endpoint: string, role: string) => {
    try {
      const response = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to login as ${role}`);
      }

      // Clear any existing auth states
      localStorage.clear();

      toast({
        title: "Test login successful",
        description: `Logged in as test ${role}`,
      });

      // Wait for the user data to be updated before navigating
      await new Promise(resolve => setTimeout(resolve, 500));

      // Force a full page reload to clear any stale state
      window.location.href = '/home';

    } catch (error) {
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col gap-2 mt-6 border-t pt-4">
      <h3 className="text-sm font-medium text-gray-500">For Testing Only:</h3>
      <div className="flex flex-wrap gap-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => handleTestLogin('test-admin-login', 'admin')}
        >
          Login as Admin
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => handleTestLogin('test-faculty-login', 'faculty')}
        >
          Login as Faculty
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => handleTestLogin('test-student-login', 'student')}
        >
          Login as Student
        </Button>
      </div>
      <p className="text-xs text-gray-400 mt-1">
        These buttons bypass normal authentication for testing purposes
      </p>
    </div>
  );
}