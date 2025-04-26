import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, UserCheck, AlertCircle, Info, ChevronLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { DepartmentBadge } from '@/components/DepartmentBadge';
import { useLocation } from 'wouter';
import { PageLayout } from '@/components/ui/page-layout';
import 'animate.css';

type User = {
  id: number;
  email: string;
  role: string;
  role_id: string | null;
  department_id: number | null;
  verification_pending: boolean;
  verified_at: string | null;
  is_active: boolean;
  first_name: string | null;
  last_name: string | null;
};

export function StudentApproval() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [bounceActive, setBounceActive] = useState<Record<number, boolean>>({});

  // Query for pending students
  const { 
    data: pendingStudents,
    isLoading: isPendingLoading,
    error: pendingError,
    refetch: refetchPending
  } = useQuery({
    queryKey: ['/api/pending-students'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/pending-students');
      return res.json() as Promise<User[]>;
    }
  });

  // Mutation for approving students
  const approveStudentMutation = useMutation({
    mutationFn: async (studentId: number) => {
      const res = await apiRequest('POST', '/api/approve-student', { studentId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pending-students'] });
      toast({
        title: "Student Approved",
        description: "Student has been approved successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Approval Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Handle approve button click with bounce animation
  const handleApprove = (studentId: number) => {
    // Set this student ID to have active bounce
    setBounceActive(prev => ({ ...prev, [studentId]: true }));
    
    // Remove bounce after animation completes
    setTimeout(() => {
      setBounceActive(prev => ({ ...prev, [studentId]: false }));
      // Actually perform the approval
      approveStudentMutation.mutate(studentId);
    }, 1000);
  };

  // Content to render within the PageLayout based on state
  const renderContent = () => {
    // Loading state
    if (isPendingLoading) {
      return (
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Student Approval</CardTitle>
            <CardDescription>Loading pending students...</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      );
    }

    // Error state
    if (pendingError) {
      return (
        <Alert variant="destructive" className="w-full">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load pending students. Please refresh the page.
          </AlertDescription>
        </Alert>
      );
    }

    // No pending students state
    if (!pendingStudents || pendingStudents.length === 0) {
      return (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Student Approval
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </CardTitle>
            <CardDescription>No pending students to approve</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>All Caught Up!</AlertTitle>
              <AlertDescription>
                There are no students waiting for approval at this time.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      );
    }

    // Students pending approval state
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Student Approval
            <UserCheck className="h-5 w-5 text-primary animate__animated animate__pulse animate__infinite" />
          </CardTitle>
          <CardDescription>
            The following students have registered and are waiting for approval.
            Approve students to grant them access to the platform.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {pendingStudents.map(student => (
              <div 
                key={student.id}
                className="p-5 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-2">
                    <div className="font-medium flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      {student.first_name && student.last_name ? (
                        <>
                          <span className="text-base">{student.first_name} {student.last_name}</span>
                          <span className="hidden sm:inline text-gray-400">•</span>
                          <span className="text-xs text-muted-foreground">
                            {student.email}
                          </span>
                        </>
                      ) : (
                        student.email
                      )}
                    </div>
                    <div className="flex items-center flex-wrap gap-2">
                      <div className="bg-blue-50 text-blue-800 px-2 py-1 rounded-md text-xs font-medium flex items-center">
                        <span>System ID: {student.id}</span>
                      </div>
                      <div className="bg-amber-50 text-amber-800 px-2 py-1 rounded-md text-xs font-medium flex items-center">
                        <span className="font-mono">{student.role_id}</span>
                      </div>
                      {student.department_id && (
                        <DepartmentBadge departmentId={student.department_id} />
                      )}
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => handleApprove(student.id)}
                    disabled={approveStudentMutation.isPending}
                    className={`${bounceActive[student.id] ? 'animate__animated animate__bounce' : ''} mt-3 sm:mt-0`}
                  >
                    {approveStudentMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Approving...
                      </>
                    ) : (
                      <>
                        <UserCheck className="mr-2 h-4 w-4" />
                        Approve Student
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between border-t pt-4">
          <div className="text-sm text-gray-500">
            {pendingStudents.length} {pendingStudents.length === 1 ? 'student' : 'students'} pending approval
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchPending()}>
            Refresh
          </Button>
        </CardFooter>
      </Card>
    );
  };

  // Wrap everything in the PageLayout with back button
  return (
    <PageLayout
      title="Student Approval"
      description="Review and approve student registration requests"
      titleIcon={<UserCheck className="h-6 w-6 text-amber-600" />}
      showBackButton={true}
      showHomeButton={false}
      showAdminButton={true}
      backgroundColor="bg-amber-50/20"
    >
      {renderContent()}
    </PageLayout>
  );
}