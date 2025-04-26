import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle, InfoIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import 'animate.css';

// VerificationStatus component displays the verification status and
// provides a form for students to submit their ID for verification
export function VerificationStatus() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [studentId, setStudentId] = useState('');
  const [wasVerified, setWasVerified] = useState(false);

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
    enabled: !!user
  });

  // Mutation for verifying student ID
  const verifyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', '/api/verify-student', { studentId: id });
      return res.json();
    },
    onSuccess: () => {
      setWasVerified(true);
      queryClient.invalidateQueries({ queryKey: ['/api/verification-status'] });
      toast({
        title: "Verification Successful",
        description: "Your student ID has been verified successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      toast({
        title: "Student ID Required",
        description: "Please enter your student ID to verify your account.",
        variant: "destructive",
      });
      return;
    }
    verifyMutation.mutate(studentId);
  };

  if (!user) {
    return null;
  }

  // Don't show verification status for non-students or admins
  if (user.role !== 'student' && user.role !== 'admin') {
    return (
      <Alert className="mb-8">
        <InfoIcon className="h-4 w-4" />
        <AlertTitle>Verification Required</AlertTitle>
        <AlertDescription>
          {user.first_name 
            ? `${user.first_name} ${user.last_name || ''}, your` 
            : 'Your'} account requires manual verification by an administrator.
        </AlertDescription>
      </Alert>
    );
  }

  // For admins, show a message about automatic student verification
  if (user.role === 'admin') {
    return (
      <Alert className="mb-8 bg-blue-50 border-blue-500">
        <InfoIcon className="h-4 w-4 text-blue-500" />
        <AlertTitle className="text-blue-700">Admin Information</AlertTitle>
        <AlertDescription className="text-blue-600">
          {user.first_name 
            ? `${user.first_name}, students` 
            : 'Students'} are automatically verified against the CSV database. No admin action is required.
        </AlertDescription>
      </Alert>
    );
  }

  // Error state - show appropriate message
  if (statusError) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Verification Status
            <AlertCircle className="h-5 w-5 text-amber-500" />
          </CardTitle>
          <CardDescription>
            {user.first_name 
              ? `${user.first_name}, your account requires verification` 
              : "Your account requires verification"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 bg-yellow-50 border-yellow-300">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-700">Verification Required</AlertTitle>
            <AlertDescription className="text-yellow-600">
              {user.first_name 
                ? `${user.first_name} ${user.last_name || ''}, please` 
                : 'Please'} enter your student ID below to verify your account.
            </AlertDescription>
          </Alert>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student-id">Student ID</Label>
              <Input
                id="student-id"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Enter your student ID (e.g., S001)"
              />
              <p className="text-xs text-gray-500">
                Your student ID should match the format in our database (e.g., S001).
              </p>
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={verifyMutation.isPending}
            >
              {verifyMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Student ID"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isStatusLoading) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Verification Status</CardTitle>
          <CardDescription>
            {user.first_name 
              ? `${user.first_name}, we're checking your verification status...` 
              : "Checking your verification status..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Show verification status for students
  return (
    <Card className={`mb-8 ${wasVerified ? 'animate__animated animate__pulse' : ''}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Verification Status
          {!verificationStatus?.verification_pending && (
            <CheckCircle2 className="h-5 w-5 text-green-500 animate__animated animate__pulse animate__infinite" />
          )}
        </CardTitle>
        <CardDescription>
          {verificationStatus?.verification_pending 
            ? user.first_name 
              ? `${user.first_name}, your account requires verification to access all features.` 
              : "Your account requires verification to access all features."
            : user.first_name 
              ? `${user.first_name}, your account has been verified!` 
              : "Your account has been verified!"}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {verificationStatus?.verification_pending ? (
          <>
            <Alert className="mb-4 bg-yellow-50 border-yellow-300">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-700">Verification Required</AlertTitle>
              <AlertDescription className="text-yellow-600">
                {user.first_name 
                  ? `${user.first_name} ${user.last_name || ''}, please` 
                  : 'Please'} enter your student ID below to verify your account.
              </AlertDescription>
            </Alert>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="student-id">Student ID</Label>
                <Input
                  id="student-id"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="Enter your student ID (e.g., S001)"
                />
                <p className="text-xs text-gray-500">
                  Your student ID should match the format in our database (e.g., S001).
                </p>
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={verifyMutation.isPending}
              >
                {verifyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Student ID"
                )}
              </Button>
            </form>
          </>
        ) : (
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-700">Verified Account</span>
            </div>
            <p className="text-green-600">
              {user.first_name 
                ? `Congratulations, ${user.first_name} ${user.last_name || ''}!` 
                : 'Congratulations!'} Your student ID has been verified and your account is now fully activated.
              You have access to all student features.
            </p>
            {verificationStatus?.verified_at && (
              <p className="text-sm text-green-500 mt-2">
                Verified on: {new Date(verificationStatus.verified_at).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
      
      {verificationStatus?.latest_attempt && (
        <CardFooter className="text-xs text-gray-500 border-t pt-4">
          Last verification attempt: {new Date(verificationStatus.latest_attempt.created_at).toLocaleString()} - 
          {verificationStatus.latest_attempt.status === 'verified' ? (
            <span className="text-green-500 ml-1">Successful</span>
          ) : (
            <span className="text-red-500 ml-1">Failed</span>
          )}
        </CardFooter>
      )}
    </Card>
  );
}