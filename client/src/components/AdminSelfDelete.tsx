import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, AlertTriangle, UserMinus } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useLocation } from 'wouter';
import 'animate.css';

export function AdminSelfDelete() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [animationClass, setAnimationClass] = useState('');
  
  // Mutation for admin self-deletion
  const selfDeleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin-self-delete');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Account Deactivated",
        description: "Your admin account has been successfully deactivated.",
      });
      
      // Force logout and redirect to login page
      setTimeout(() => {
        window.location.href = '/auth';
      }, 1500);
    },
    onError: (error: Error) => {
      toast({
        title: "Deactivation Failed",
        description: error.message || "An error occurred during deactivation.",
        variant: "destructive",
      });
      setAnimationClass('');
    }
  });

  const handleSelfDelete = () => {
    // Start warning animation
    setAnimationClass('animate__animated animate__headShake');
    
    // Allow animation to complete, then perform deletion
    setTimeout(() => {
      selfDeleteMutation.mutate();
    }, 1000);
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <Card className={`border-2 border-rose-200 hover:border-rose-300 dark:border-rose-800 dark:hover:border-rose-700 transition-all duration-200 shadow-md ${animationClass}`}>
      <CardHeader className="bg-rose-50 dark:bg-rose-950/20">
        <CardTitle className="text-base font-medium flex items-center gap-2 text-rose-700 dark:text-rose-400">
          <UserMinus className="h-5 w-5" />
          Leave Platform (Admin Account Deactivation)
        </CardTitle>
        <CardDescription>
          This lets you leave the platform by deactivating your admin access
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-rose-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            This action will permanently deactivate your admin account. You will no longer have access to the admin dashboard or any administrative functions.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-3 pt-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="destructive" 
              className="bg-rose-600 hover:bg-rose-700"
              disabled={selfDeleteMutation.isPending}
            >
              {selfDeleteMutation.isPending ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Off Account
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="animate__animated animate__fadeIn">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-rose-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Confirm Admin Sign-Off
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. Your admin account will be permanently deactivated, and you will be logged out immediately.
                <div className="bg-rose-50 dark:bg-rose-950/30 p-3 rounded-md mt-3 text-rose-600 dark:text-rose-400 text-sm border border-rose-200 dark:border-rose-800">
                  Please ensure that there is at least one other active admin to manage the system before proceeding.
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleSelfDelete}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Yes, Sign Off
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}