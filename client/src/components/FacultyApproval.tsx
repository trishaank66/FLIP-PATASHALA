import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertCircle, CheckCircle2, UserCheck, Info, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { PageLayout } from '@/components/ui/page-layout';
import { DepartmentBadge } from '@/components/DepartmentBadge';
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

export function FacultyApproval() {
  const { toast } = useToast();
  const [approvingId, setApprovingId] = useState<number | null>(null);

  // Query pending faculty members
  const { 
    data: pendingFaculty,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['/api/pending-faculty'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/pending-faculty');
      return res.json() as Promise<User[]>;
    }
  });

  // Approve faculty mutation
  const approveFacultyMutation = useMutation({
    mutationFn: async (facultyId: number) => {
      const res = await apiRequest('POST', '/api/verify-faculty', { id: facultyId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pending-faculty'] });
      queryClient.invalidateQueries({ queryKey: ['/api/faculty'] });
      queryClient.invalidateQueries({ queryKey: ['/api/audit-logs'] });
      toast({
        title: "Faculty Approved",
        description: "Faculty member has been verified successfully!",
      });
      setApprovingId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Approval Failed",
        description: error.message,
        variant: "destructive",
      });
      setApprovingId(null);
    }
  });

  // Handle faculty approval
  const handleApprove = (facultyId: number) => {
    setApprovingId(facultyId);
    approveFacultyMutation.mutate(facultyId);
  };

  // Loading state
  if (isLoading) {
    return (
      <PageLayout
        title="Faculty Verification"
        description="Loading pending faculty members..."
        titleIcon={<UserCheck className="h-6 w-6 text-purple-600" />}
        showBackButton={true}
        showHomeButton={false}
        showAdminButton={true}
        backgroundColor="bg-purple-50/30 border-purple-100/50"
      >
        <Card className="w-full">
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
              <span className="text-lg">Loading pending faculty members...</span>
            </div>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <PageLayout
        title="Faculty Verification"
        description="Error loading faculty data"
        titleIcon={<UserCheck className="h-6 w-6 text-purple-600" />}
        showBackButton={true}
        showHomeButton={false}
        showAdminButton={true}
        backgroundColor="bg-purple-50/30 border-purple-100/50"
      >
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load pending faculty data. Please refresh the page.
          </AlertDescription>
        </Alert>
      </PageLayout>
    );
  }

  // Empty state - no pending faculty
  if (!pendingFaculty || pendingFaculty.length === 0) {
    return (
      <PageLayout
        title="Faculty Verification"
        description="No pending faculty members to verify"
        titleIcon={<CheckCircle2 className="h-6 w-6 text-green-600" />}
        showBackButton={true}
        showHomeButton={false}
        showAdminButton={true}
        backgroundColor="bg-purple-50/30 border-purple-100/50"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Faculty Verification
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </CardTitle>
            <CardDescription>No pending faculty members to verify</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>All Caught Up!</AlertTitle>
              <AlertDescription>
                There are no faculty members waiting for verification at this time.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex justify-end border-t pt-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              className="animate__animated animate__fadeIn"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </CardFooter>
        </Card>
      </PageLayout>
    );
  }

  // Main content - pending faculty members
  return (
    <PageLayout
      title="Faculty Verification"
      description="Verify pending faculty members"
      titleIcon={<UserCheck className="h-6 w-6 text-purple-600" />}
      showBackButton={true}
      showHomeButton={false}
      showAdminButton={true}
      backgroundColor="bg-purple-50/30 border-purple-100/50"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Faculty Verification
            <UserCheck className="h-5 w-5 text-primary animate__animated animate__pulse animate__infinite" />
          </CardTitle>
          <CardDescription>
            The following faculty members are waiting for verification.
            Check faculty IDs to build your team!
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>System ID</TableHead>
                    <TableHead>Faculty ID</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingFaculty.map(faculty => (
                    <TableRow key={faculty.id} className={
                      approvingId === faculty.id
                        ? 'animate__animated animate__fadeOut animate__faster'
                        : 'animate__animated animate__fadeIn'
                    }>
                      <TableCell>{faculty.id}</TableCell>
                      <TableCell className="py-3">
                        <div className="bg-purple-50 text-purple-800 px-2 py-1 rounded-md inline-block">
                          <span className="font-mono font-medium">{faculty.role_id || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{faculty.email}</TableCell>
                      <TableCell className="font-medium">
                        {faculty.first_name && faculty.last_name 
                          ? `${faculty.first_name} ${faculty.last_name}`
                          : <span className="text-gray-400 italic">Not provided</span>}
                      </TableCell>
                      <TableCell>
                        {faculty.department_id ? (
                          <DepartmentBadge departmentId={faculty.department_id} />
                        ) : (
                          <span className="text-gray-400 italic">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => handleApprove(faculty.id)}
                          disabled={approvingId === faculty.id}
                          className="animate__animated animate__slideInLeft hover:animate__headShake"
                        >
                          {approvingId === faculty.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Approving...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-end border-t pt-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </CardFooter>
      </Card>
    </PageLayout>
  );
}