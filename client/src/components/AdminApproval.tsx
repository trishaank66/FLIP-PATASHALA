import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck, 
  Info, 
  RefreshCw,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
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

export function AdminApproval() {
  const { toast } = useToast();
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);

  // Query pending admin users
  const { 
    data: pendingAdmins,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['/api/pending-admins'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/pending-admins');
      return res.json() as Promise<User[]>;
    }
  });

  // Approve admin mutation
  const approveAdminMutation = useMutation({
    mutationFn: async (adminId: number) => {
      const res = await apiRequest('POST', '/api/verify-admin', { adminId: adminId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pending-admins'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admins'] });
      queryClient.invalidateQueries({ queryKey: ['/api/audit-logs'] });
      toast({
        title: "Admin Approved",
        description: "Administrator has been verified successfully!",
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

  // Reject admin mutation
  const rejectAdminMutation = useMutation({
    mutationFn: async (adminId: number) => {
      const res = await apiRequest('POST', '/api/reject-admin', { adminId: adminId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pending-admins'] });
      queryClient.invalidateQueries({ queryKey: ['/api/audit-logs'] });
      toast({
        title: "Admin Rejected",
        description: "Administrator application has been rejected.",
      });
      setRejectingId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Rejection Failed",
        description: error.message,
        variant: "destructive",
      });
      setRejectingId(null);
    }
  });

  // Handle admin approval
  const handleApprove = (adminId: number) => {
    setApprovingId(adminId);
    approveAdminMutation.mutate(adminId);
  };

  // Handle admin rejection
  const handleReject = (adminId: number) => {
    setRejectingId(adminId);
    rejectAdminMutation.mutate(adminId);
  };

  // Loading state
  if (isLoading) {
    return (
      <PageLayout
        title="Admin Verification"
        description="Loading pending administrator requests..."
        titleIcon={<ShieldCheck className="h-6 w-6 text-blue-600" />}
        showBackButton={true}
        showHomeButton={false}
        showAdminButton={true}
        backgroundColor="bg-blue-50/30 border-blue-100/50"
      >
        <Card className="w-full">
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
              <span className="text-lg">Loading pending administrator requests...</span>
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
        title="Admin Verification"
        description="Error loading admin data"
        titleIcon={<ShieldCheck className="h-6 w-6 text-blue-600" />}
        showBackButton={true}
        showHomeButton={false}
        showAdminButton={true}
        backgroundColor="bg-blue-50/30 border-blue-100/50"
      >
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load pending administrator data. Please refresh the page.
          </AlertDescription>
        </Alert>
      </PageLayout>
    );
  }

  // Empty state - no pending admin requests
  if (!pendingAdmins || pendingAdmins.length === 0) {
    return (
      <PageLayout
        title="Admin Verification"
        description="No pending administrator requests"
        titleIcon={<CheckCircle2 className="h-6 w-6 text-green-600" />}
        showBackButton={true}
        showHomeButton={false}
        showAdminButton={true}
        backgroundColor="bg-blue-50/30 border-blue-100/50"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Admin Verification
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </CardTitle>
            <CardDescription>No pending administrator requests</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>All Caught Up!</AlertTitle>
              <AlertDescription>
                There are no administrator registration requests waiting for verification at this time.
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

  // Main content - pending admin requests
  return (
    <PageLayout
      title="Admin Verification"
      description="Verify pending administrator registration requests"
      titleIcon={<ShieldCheck className="h-6 w-6 text-blue-600" />}
      showBackButton={true}
      showHomeButton={false}
      showAdminButton={true}
      backgroundColor="bg-blue-50/30 border-blue-100/50"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Admin Verification
            <ShieldCheck className="h-5 w-5 text-primary animate__animated animate__pulse animate__infinite" />
          </CardTitle>
          <CardDescription>
            The following administrator registration requests are waiting for your verification.
            Only approve admins you know and trust.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>System ID</TableHead>
                    <TableHead>Admin ID</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingAdmins.map(admin => (
                    <TableRow key={admin.id} className={
                      approvingId === admin.id || rejectingId === admin.id
                        ? 'animate__animated animate__fadeOut animate__faster'
                        : 'animate__animated animate__fadeIn'
                    }>
                      <TableCell>{admin.id}</TableCell>
                      <TableCell className="py-3">
                        <div className="bg-blue-50 text-blue-800 px-2 py-1 rounded-md inline-block">
                          <span className="font-mono font-medium">{admin.role_id || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{admin.email}</TableCell>
                      <TableCell className="font-medium">
                        {admin.first_name && admin.last_name 
                          ? `${admin.first_name} ${admin.last_name}`
                          : <span className="text-gray-400 italic">Not provided</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => handleApprove(admin.id)}
                            disabled={approvingId === admin.id || rejectingId === admin.id}
                            className="animate__animated animate__slideInLeft hover:animate__headShake"
                          >
                            {approvingId === admin.id ? (
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
                          
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleReject(admin.id)}
                            disabled={approvingId === admin.id || rejectingId === admin.id}
                            className="animate__animated animate__slideInLeft hover:animate__headShake"
                          >
                            {rejectingId === admin.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                Rejecting...
                              </>
                            ) : (
                              <>
                                <X className="h-4 w-4 mr-1" />
                                Reject
                              </>
                            )}
                          </Button>
                        </div>
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