import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, Clock, InfoIcon } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import 'animate.css';

export function FacultyVerificationStatus() {
  const { user } = useAuth();

  // Query for getting verification status
  const { 
    data: verificationStatus,
    isLoading: isStatusLoading,
    error: statusError,
    refetch: refetchStatus
  } = useQuery({
    queryKey: ['/api/verification-status'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/verification-status');
      return res.json();
    },
    enabled: !!user && user.role === 'faculty'
  });

  // Refresh status every 30 seconds for pending faculty
  useEffect(() => {
    if (user?.role === 'faculty' && verificationStatus?.verification_pending) {
      const interval = setInterval(() => {
        refetchStatus();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [user, verificationStatus, refetchStatus]);

  if (!user || user.role !== 'faculty') {
    return null;
  }

  // Loading state
  if (isStatusLoading) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Verification Status</CardTitle>
          <CardDescription>Checking your verification status...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Error state - better handle auth errors
  if (statusError) {
    // Assume verification is pending if we can't get status
    return (
      <Alert className="mb-8 bg-amber-50 border-amber-200">
        <InfoIcon className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-700">Verification Pending</AlertTitle>
        <AlertDescription className="text-amber-600">
          {user.first_name 
            ? `Dr. ${user.first_name} ${user.last_name || ''}, your` 
            : 'Your'} faculty account is waiting for admin verification. This usually takes 24-48 hours.
          You'll be notified when your account is approved.
        </AlertDescription>
      </Alert>
    );
  }

  // Verified faculty
  if (!verificationStatus?.verification_pending) {
    return (
      <Card className="mb-8 animate__animated animate__fadeIn">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Verification Status
            <CheckCircle2 className="h-5 w-5 text-green-500 animate__animated animate__pulse animate__infinite" />
          </CardTitle>
          <CardDescription>Your faculty account has been verified!</CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-700">Verified Account</span>
            </div>
            <p className="text-green-600">
              {user.first_name 
                ? `Congratulations, Dr. ${user.first_name} ${user.last_name || ''}! Admin says you're good to teach!` 
                : "Admin says you're good to teach!"} Your faculty account has been verified and you now have access to all faculty features.
            </p>
            {verificationStatus?.verified_at && (
              <p className="text-sm text-green-500 mt-2">
                Verified on: {new Date(verificationStatus.verified_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </CardContent>
        
        {verificationStatus?.latest_attempt && (
          <CardFooter className="text-xs text-gray-500 border-t pt-4">
            Verification details: {verificationStatus.latest_attempt.message}
          </CardFooter>
        )}
      </Card>
    );
  }

  // Pending verification
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Verification Status
          <Clock className="h-5 w-5 text-amber-500 animate__animated animate__pulse animate__infinite" />
        </CardTitle>
        <CardDescription>Your account is awaiting admin verification</CardDescription>
      </CardHeader>
      
      <CardContent>
        <Alert className="mb-4 bg-amber-50 border-amber-200">
          <InfoIcon className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-700">Verification Pending</AlertTitle>
          <AlertDescription className="text-amber-600">
            {user.first_name 
              ? `Dr. ${user.first_name} ${user.last_name || ''}, your` 
              : 'Your'} faculty account needs to be verified by an administrator before you can access all features.
            This usually takes 24-48 hours. You'll be notified when your account is approved.
          </AlertDescription>
        </Alert>
        
        <div className="p-4 bg-gray-50 rounded border border-gray-200">
          <p className="text-gray-700 text-sm">
            <strong>What happens next?</strong><br />
            An administrator will verify your Faculty ID ({user.role_id}) and approve your account.
            Once approved, you'll have full access to all faculty features.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}