import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AlertCircle } from 'lucide-react';

export function DeveloperTools() {
  const { toast } = useToast();
  const [expandDevTools, setExpandDevTools] = useState(false);

  const testAdminLoginMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/test-admin-login");
      return res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Admin Login Successful",
        description: "You're now logged in as an admin.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!expandDevTools) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setExpandDevTools(true)}
        className="mt-4 text-xs"
      >
        Show Developer Tools
      </Button>
    );
  }

  return (
    <Card className="mt-4 border-red-300">
      <CardHeader className="py-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500" />
          Developer Tools (Testing Only)
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2">
        <div className="text-xs text-gray-500 mb-2">These tools are for testing purposes only and should not be used in production.</div>
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => testAdminLoginMutation.mutate()}
            disabled={testAdminLoginMutation.isPending}
            variant="destructive"
            size="sm"
          >
            {testAdminLoginMutation.isPending ? "Logging in..." : "Auto-Login as Admin"}
          </Button>
          <Button
            onClick={() => setExpandDevTools(false)}
            variant="outline"
            size="sm"
          >
            Hide Developer Tools
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}