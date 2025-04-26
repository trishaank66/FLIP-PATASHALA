import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertCircle, UserMinus, RefreshCw, UserX, Users, ArrowLeft } from 'lucide-react';
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

type AuditLog = {
  id: number;
  action: string;
  user_id: number;
  performed_by: number;
  details: any;
  created_at: string;
};

export function FacultyManagement() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [facultyToDelete, setFacultyToDelete] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAnimating, setDeleteAnimating] = useState<number | null>(null);

  // Query for active faculty
  const { 
    data: faculty,
    isLoading: isFacultyLoading,
    error: facultyError,
    refetch: refetchFaculty
  } = useQuery({
    queryKey: ['/api/faculty'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/faculty');
      return res.json() as Promise<User[]>;
    }
  });
  
  // Query for deleted faculty
  const { 
    data: deletedFaculty,
    isLoading: isDeletedLoading,
    error: deletedError,
    refetch: refetchDeleted
  } = useQuery({
    queryKey: ['/api/deleted-faculty'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/deleted-faculty');
      return res.json() as Promise<User[]>;
    }
  });
  
  // Query for audit logs related to faculty
  const { 
    data: auditLogs,
    isLoading: isLogsLoading,
    error: logsError,
    refetch: refetchLogs
  } = useQuery({
    queryKey: ['/api/audit-logs-faculty'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/audit-logs');
      // Filter for faculty-related logs on the client side
      return res.json().then((logs: AuditLog[]) => 
        logs.filter(log => 
          log.action.includes("FACULTY") || 
          (log.details?.role === "faculty")
        )
      );
    }
  });

  // Mutation for deleting faculty
  const deleteFacultyMutation = useMutation({
    mutationFn: async (facultyId: number) => {
      const res = await apiRequest('POST', '/api/delete-faculty', { facultyId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faculty'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deleted-faculty'] });
      queryClient.invalidateQueries({ queryKey: ['/api/audit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/audit-logs-faculty'] });
      toast({
        title: "Faculty Deleted",
        description: "Faculty member has been removed successfully!",
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
    if (facultyToDelete && facultyToDelete.id) {
      // Set the animation flag
      setDeleteAnimating(facultyToDelete.id);
      
      // Wait for the animation to run before making the API call
      setTimeout(() => {
        deleteFacultyMutation.mutate(facultyToDelete.id);
        setDeleteAnimating(null);
      }, 600);
    }
  };

  // Handle opening delete dialog
  const openDeleteDialog = (faculty: User) => {
    setFacultyToDelete(faculty);
    setDeleteDialogOpen(true);
  };

  // Format date string
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Loading state
  if (isFacultyLoading && isDeletedLoading && isLogsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Faculty Management</CardTitle>
          <CardDescription>Loading faculty data...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Error states
  const hasError = facultyError || deletedError || logsError;
  if (hasError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load faculty data. Please refresh the page.
        </AlertDescription>
      </Alert>
    );
  }

  // Filter to only show verified faculty
  const activeFaculty = faculty?.filter(user => 
    user.role === 'faculty' && 
    user.is_active !== false &&
    !user.verification_pending
  ) || [];
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <Link to="/admin">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
      
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active" className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            Active Faculty ({activeFaculty.length})
          </TabsTrigger>
          <TabsTrigger value="deleted" className="flex items-center gap-1">
            <UserX className="h-4 w-4" />
            Deleted Faculty ({deletedFaculty?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1">
            <RefreshCw className="h-4 w-4" />
            Audit Logs ({auditLogs?.length || 0})
          </TabsTrigger>
        </TabsList>
        
        {/* Active Faculty Tab */}
        <TabsContent value="active" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Active Faculty
              </CardTitle>
              <CardDescription>
                Manage faculty accounts. Active faculty can log in and access the system.
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {isFacultyLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : activeFaculty.length === 0 ? (
                <Alert>
                  <AlertTitle>No Faculty Found</AlertTitle>
                  <AlertDescription>
                    There are no active faculty members in the system.
                  </AlertDescription>
                </Alert>
              ) : (
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
                      {activeFaculty.map(faculty => (
                        <TableRow 
                          key={faculty.id}
                          className={deleteAnimating === faculty.id ? 'animate__animated animate__slideOutLeft animate__faster' : ''}
                        >
                          <TableCell>{faculty.id}</TableCell>
                          <TableCell className="font-mono">{faculty.role_id || '-'}</TableCell>
                          <TableCell>{faculty.email}</TableCell>
                          <TableCell>
                            {faculty.first_name && faculty.last_name 
                              ? `${faculty.first_name} ${faculty.last_name}`
                              : 'Not provided'}
                          </TableCell>
                          <TableCell>
                            <DepartmentBadge departmentId={faculty.department_id} />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => navigate(`/admin/departments?user=${faculty.id}`)}
                                className="animate__animated animate__slideInLeft"
                              >
                                <Users className="h-4 w-4 mr-1" />
                                Change Dept
                              </Button>
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => openDeleteDialog(faculty)}
                                className="animate__animated animate__slideInLeft hover:animate__headShake"
                              >
                                <UserMinus className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </div>
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
                onClick={() => refetchFaculty()}
                disabled={isFacultyLoading}
              >
                {isFacultyLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Deleted Faculty Tab */}
        <TabsContent value="deleted" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserX className="h-5 w-5" />
                Deleted Faculty
              </CardTitle>
              <CardDescription>
                Faculty members who have been removed. These accounts cannot log in.
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {isDeletedLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !deletedFaculty || deletedFaculty.length === 0 ? (
                <Alert>
                  <AlertTitle>No Deleted Faculty</AlertTitle>
                  <AlertDescription>
                    There are no deleted faculty members in the system.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>System ID</TableHead>
                        <TableHead>Faculty ID</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deletedFaculty.map(faculty => (
                        <TableRow key={faculty.id}>
                          <TableCell>{faculty.id}</TableCell>
                          <TableCell className="font-mono">{faculty.role_id || '-'}</TableCell>
                          <TableCell>{faculty.email}</TableCell>
                          <TableCell>
                            {faculty.first_name && faculty.last_name 
                              ? `${faculty.first_name} ${faculty.last_name}`
                              : 'Not provided'}
                          </TableCell>
                          <TableCell>
                            <DepartmentBadge departmentId={faculty.department_id} />
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
                Faculty Audit Logs
              </CardTitle>
              <CardDescription>
                System activity log showing faculty additions, deletions, and verifications.
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {isLogsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !auditLogs || auditLogs.length === 0 ? (
                <Alert>
                  <AlertTitle>No Faculty Audit Logs</AlertTitle>
                  <AlertDescription>
                    There are no faculty-related audit logs recorded in the system.
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
                                {log.details.email ? log.details.email : JSON.stringify(log.details)}
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
      
      {/* Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="animate__animated animate__fadeInDown animate__faster">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <UserMinus className="h-5 w-5" />
              Confirm Faculty Deletion
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this faculty member? This action will deactivate the account and prevent login.
            </DialogDescription>
          </DialogHeader>
          
          {facultyToDelete && (
            <div className="py-4 px-2 border rounded-md bg-gray-50 dark:bg-gray-900">
              <div><strong>System ID:</strong> {facultyToDelete.id}</div>
              <div><strong>Email:</strong> {facultyToDelete.email}</div>
              <div><strong>Faculty ID:</strong> {facultyToDelete.role_id || 'Not specified'}</div>
              <div><strong>Name:</strong> {
                facultyToDelete.first_name && facultyToDelete.last_name 
                  ? `${facultyToDelete.first_name} ${facultyToDelete.last_name}`
                  : 'Not provided'
              }</div>
              <div><strong>Department:</strong> <DepartmentBadge departmentId={facultyToDelete.department_id} /></div>
            </div>
          )}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteFacultyMutation.isPending}
              className="animate__animated animate__pulse animate__infinite"
            >
              {deleteFacultyMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <UserMinus className="mr-2 h-4 w-4" />
                  Delete Faculty
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}