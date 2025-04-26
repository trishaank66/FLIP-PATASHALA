import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertCircle, UserMinus, RefreshCw, UserX, Users, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useLocation, Link } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type AuditLog = {
  id: number;
  action: string;
  user_id: number;
  performed_by: number;
  details: any;
  created_at: string;
};

export function DeleteAdmin() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [adminToDelete, setAdminToDelete] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAnimating, setDeleteAnimating] = useState<number | null>(null);

  // Query for active admins
  const { 
    data: admins,
    isLoading: isAdminsLoading,
    error: adminsError,
    refetch: refetchAdmins
  } = useQuery({
    queryKey: ['/api/admins'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admins');
      return res.json() as Promise<User[]>;
    }
  });
  
  // Query for deleted admins
  const { 
    data: deletedAdmins,
    isLoading: isDeletedLoading,
    error: deletedError,
    refetch: refetchDeleted
  } = useQuery({
    queryKey: ['/api/deleted-admins'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/deleted-admins');
      return res.json() as Promise<User[]>;
    }
  });
  
  // Query for audit logs related to admins
  const { 
    data: auditLogs,
    isLoading: isLogsLoading,
    error: logsError,
    refetch: refetchLogs
  } = useQuery({
    queryKey: ['/api/audit-logs-admin'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/audit-logs');
      // Filter for admin-related logs on the client side
      return res.json().then((logs: AuditLog[]) => 
        logs.filter(log => 
          log.action.includes("ADMIN") || 
          (log.details?.role === "admin")
        )
      );
    }
  });

  // Mutation for deleting admin
  const deleteAdminMutation = useMutation({
    mutationFn: async (adminId: number) => {
      const res = await apiRequest('POST', '/api/delete-admin', { adminId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admins'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deleted-admins'] });
      queryClient.invalidateQueries({ queryKey: ['/api/audit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/audit-logs-admin'] });
      toast({
        title: "Admin Deleted",
        description: "Administrator has been removed successfully!",
      });
      setDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion Failed",
        description: error.message,
        variant: "destructive",
      });
      setDeleteDialogOpen(false);
    }
  });

  // Handle confirm delete
  const handleConfirmDelete = () => {
    if (adminToDelete && adminToDelete.id) {
      // Set the animation flag
      setDeleteAnimating(adminToDelete.id);
      
      // Wait for the animation to run before making the API call
      setTimeout(() => {
        deleteAdminMutation.mutate(adminToDelete.id);
        setDeleteAnimating(null);
      }, 600);
    }
  };

  // Handle opening delete dialog
  const openDeleteDialog = (admin: User) => {
    setAdminToDelete(admin);
    setDeleteDialogOpen(true);
  };

  // Format date string
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Loading state
  if (isAdminsLoading && isDeletedLoading && isLogsLoading) {
    return (
      <PageLayout
        title="Admin Management"
        description="Loading administrator data..."
        titleIcon={<ShieldCheck className="h-6 w-6 text-blue-600" />}
        showBackButton={true}
        showHomeButton={true}
        showAdminButton={true}
        backTo="/"
        backgroundColor="bg-blue-50/30 border-blue-100/50"
      >
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
              <span className="text-lg">Loading administrator data...</span>
            </div>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  // Error states
  const hasError = adminsError || deletedError || logsError;
  if (hasError) {
    return (
      <PageLayout
        title="Admin Management"
        description="Error loading administrator data"
        titleIcon={<ShieldCheck className="h-6 w-6 text-blue-600" />}
        showBackButton={true}
        showHomeButton={true}
        showAdminButton={true}
        backTo="/"
        backgroundColor="bg-blue-50/30 border-blue-100/50"
      >
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load administrator data. Please refresh the page.
          </AlertDescription>
        </Alert>
      </PageLayout>
    );
  }

  // Filter to only show verified admins
  const activeAdmins = admins?.filter(user => 
    user.role === 'admin' && 
    user.is_active !== false &&
    !user.verification_pending
  ) || [];
  
  return (
    <PageLayout
      title="Delete Admin"
      description="Remove administrator accounts from the system"
      titleIcon={<ShieldCheck className="h-6 w-6 text-blue-600" />}
      showBackButton={true}
      showHomeButton={true}
      showAdminButton={true}
      backTo="/"
      backgroundColor="bg-blue-50/30 border-blue-100/50"
    >
      <div className="space-y-4">
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active" className="flex items-center gap-1">
              <ShieldCheck className="h-4 w-4" />
              Active Admins ({activeAdmins.length})
            </TabsTrigger>
            <TabsTrigger value="deleted" className="flex items-center gap-1">
              <UserX className="h-4 w-4" />
              Deleted Admins ({deletedAdmins?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-1">
              <RefreshCw className="h-4 w-4" />
              Audit Logs ({auditLogs?.length || 0})
            </TabsTrigger>
          </TabsList>
          
          {/* Active Admins Tab */}
          <TabsContent value="active" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Active Administrators
                </CardTitle>
                <CardDescription>
                  Manage administrator accounts. Active administrators have full system access.
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                {isAdminsLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : activeAdmins.length === 0 ? (
                  <Alert>
                    <AlertTitle>No Administrators Found</AlertTitle>
                    <AlertDescription>
                      There are no active administrators in the system.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Admin ID</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeAdmins.map(admin => (
                          <TableRow 
                            key={admin.id}
                            className={deleteAnimating === admin.id ? 'animate__animated animate__slideOutLeft animate__faster' : ''}
                          >
                            <TableCell className="font-mono">{admin.role_id || '-'}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{admin.email}</TableCell>
                            <TableCell className="font-medium">
                              {admin.first_name && admin.last_name 
                                ? `${admin.first_name} ${admin.last_name}`
                                : 'Not provided'}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => openDeleteDialog(admin)}
                                className="animate__animated animate__slideInLeft hover:animate__headShake"
                              >
                                <UserMinus className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
              
              <CardFooter className="flex justify-end border-t pt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchAdmins()}
                  disabled={isAdminsLoading}
                >
                  {isAdminsLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Refresh
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          {/* Deleted Admins Tab */}
          <TabsContent value="deleted" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserX className="h-5 w-5" />
                  Deleted Administrators
                </CardTitle>
                <CardDescription>
                  Administrator accounts that have been removed. These accounts cannot log in.
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                {isDeletedLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : !deletedAdmins || deletedAdmins.length === 0 ? (
                  <Alert>
                    <AlertTitle>No Deleted Administrators</AlertTitle>
                    <AlertDescription>
                      There are no deleted administrator accounts in the system.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Admin ID</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deletedAdmins.map(admin => (
                          <TableRow key={admin.id}>
                            <TableCell className="font-mono">{admin.role_id || '-'}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{admin.email}</TableCell>
                            <TableCell className="font-medium">
                              {admin.first_name && admin.last_name 
                                ? `${admin.first_name} ${admin.last_name}`
                                : 'Not provided'}
                            </TableCell>
                            <TableCell>
                              <span className="text-red-500">Deleted</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
              
              <CardFooter className="flex justify-end border-t pt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchDeleted()}
                  disabled={isDeletedLoading}
                >
                  {isDeletedLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Refresh
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          {/* Audit Logs Tab */}
          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Admin Audit Logs
                </CardTitle>
                <CardDescription>
                  System activity log showing administrator additions, deletions, and verifications.
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                {isLogsLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : !auditLogs || auditLogs.length === 0 ? (
                  <Alert>
                    <AlertTitle>No Admin Audit Logs</AlertTitle>
                    <AlertDescription>
                      There are no administrator-related audit logs recorded in the system.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>User ID</TableHead>
                          <TableHead>Performed By</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.map(log => (
                          <TableRow key={log.id}>
                            <TableCell>{formatDate(log.created_at)}</TableCell>
                            <TableCell>{log.action}</TableCell>
                            <TableCell>{log.user_id}</TableCell>
                            <TableCell>{log.performed_by}</TableCell>
                            <TableCell>
                              {log.details ? (
                                <div className="font-mono text-xs">
                                  {log.details.email && log.details.first_name && log.details.last_name
                                    ? `${log.details.first_name} ${log.details.last_name}`
                                    : (log.details.email || JSON.stringify(log.details))}
                                </div>
                              ) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
              
              <CardFooter className="flex justify-end border-t pt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchLogs()}
                  disabled={isLogsLoading}
                >
                  {isLogsLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Refresh
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Administrator Deletion</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this administrator? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            
            {adminToDelete && (
              <div className="space-y-2 py-4">
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <div className="font-semibold">Name:</div>
                  <div>{adminToDelete.first_name && adminToDelete.last_name 
                    ? `${adminToDelete.first_name} ${adminToDelete.last_name}`
                    : 'Not provided'}</div>
                  
                  <div className="font-semibold">Email:</div>
                  <div>{adminToDelete.email}</div>
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={deleteAdminMutation.isPending}
                className="animate__animated animate__headShake animate__repeat-1 animate__delay-1s"
              >
                {deleteAdminMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <UserMinus className="mr-2 h-4 w-4" />
                    Delete Administrator
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  );
}