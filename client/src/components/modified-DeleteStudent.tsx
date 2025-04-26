import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertCircle, Trash2, RefreshCw, UserX, Users, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Link } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export function DeleteStudent() {
  const { toast } = useToast();
  const [studentToDelete, setStudentToDelete] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAnimating, setDeleteAnimating] = useState<number | null>(null);

  // Query for active students
  const { 
    data: students,
    isLoading: isStudentsLoading,
    error: studentsError,
    refetch: refetchStudents
  } = useQuery({
    queryKey: ['/api/students'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/students');
      return res.json() as Promise<User[]>;
    }
  });
  
  // Query for deleted students
  const { 
    data: deletedStudents,
    isLoading: isDeletedLoading,
    error: deletedError,
    refetch: refetchDeleted
  } = useQuery({
    queryKey: ['/api/deleted-students'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/deleted-students');
      return res.json() as Promise<User[]>;
    }
  });
  
  // Query for audit logs
  const { 
    data: auditLogs,
    isLoading: isLogsLoading,
    error: logsError,
    refetch: refetchLogs
  } = useQuery({
    queryKey: ['/api/audit-logs'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/audit-logs');
      return res.json() as Promise<AuditLog[]>;
    }
  });

  // Mutation for deleting student
  const deleteStudentMutation = useMutation({
    mutationFn: async (studentId: number) => {
      const res = await apiRequest('POST', '/api/delete-student', { studentId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deleted-students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/audit-logs'] });
      toast({
        title: "Student Deleted",
        description: "Student has been removed successfully!",
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
    if (studentToDelete && studentToDelete.id) {
      // Set the animation flag
      setDeleteAnimating(studentToDelete.id);
      
      // Wait for the animation to run before making the API call
      setTimeout(() => {
        deleteStudentMutation.mutate(studentToDelete.id);
        setDeleteAnimating(null);
      }, 600);
    }
  };

  // Handle opening delete dialog
  const openDeleteDialog = (student: User) => {
    setStudentToDelete(student);
    setDeleteDialogOpen(true);
  };

  // Format date string
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Loading state
  if (isStudentsLoading && isDeletedLoading && isLogsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Delete Student</CardTitle>
          <CardDescription>Loading student data...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Error states
  const hasError = studentsError || deletedError || logsError;
  if (hasError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load student data. Please refresh the page.
        </AlertDescription>
      </Alert>
    );
  }

  // Filter to only show students
  const activeStudents = students?.filter(user => user.role === 'student' && user.is_active !== false) || [];
  
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
            Active Students ({activeStudents.length})
          </TabsTrigger>
          <TabsTrigger value="deleted" className="flex items-center gap-1">
            <UserX className="h-4 w-4" />
            Deleted Students ({deletedStudents?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1">
            <RefreshCw className="h-4 w-4" />
            Audit Logs ({auditLogs?.length || 0})
          </TabsTrigger>
        </TabsList>
        
        {/* Active Students Tab */}
        <TabsContent value="active" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Active Students
              </CardTitle>
              <CardDescription>
                Manage student accounts. Active students can log in and access the system.
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {isStudentsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : activeStudents.length === 0 ? (
                <Alert>
                  <AlertTitle>No Students Found</AlertTitle>
                  <AlertDescription>
                    There are no active students in the system.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Verified</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeStudents.map(student => (
                        <TableRow 
                          key={student.id}
                          className={deleteAnimating === student.id ? 'animate__animated animate__fadeOutLeft animate__faster' : ''}
                        >
                          <TableCell className="font-mono">{student.role_id || '-'}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{student.email}</TableCell>
                          <TableCell className="font-medium">
                            {student.first_name && student.last_name 
                              ? `${student.first_name} ${student.last_name}`
                              : 'Not provided'}
                          </TableCell>
                          <TableCell>
                            {student.verification_pending ? (
                              <span className="text-amber-500">Pending</span>
                            ) : (
                              <span className="text-green-500">Verified</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => openDeleteDialog(student)}
                              className="hover:animate__animated hover:animate__headShake"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
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
                onClick={() => refetchStudents()}
                disabled={isStudentsLoading}
              >
                {isStudentsLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Deleted Students Tab */}
        <TabsContent value="deleted" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserX className="h-5 w-5" />
                Deleted Students
              </CardTitle>
              <CardDescription>
                Students who have been removed. These accounts cannot log in.
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {isDeletedLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !deletedStudents || deletedStudents.length === 0 ? (
                <Alert>
                  <AlertTitle>No Deleted Students</AlertTitle>
                  <AlertDescription>
                    There are no deleted students in the system.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deletedStudents.map(student => (
                        <TableRow key={student.id}>
                          <TableCell className="font-mono">{student.role_id || '-'}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{student.email}</TableCell>
                          <TableCell className="font-medium">
                            {student.first_name && student.last_name 
                              ? `${student.first_name} ${student.last_name}`
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
                Audit Logs
              </CardTitle>
              <CardDescription>
                System activity log showing student deletions and other critical actions.
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {isLogsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !auditLogs || auditLogs.length === 0 ? (
                <Alert>
                  <AlertTitle>No Audit Logs</AlertTitle>
                  <AlertDescription>
                    There are no audit logs recorded in the system.
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
            <DialogTitle>Confirm Student Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this student? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {studentToDelete && (
            <div className="space-y-2 py-4">
              <div className="grid grid-cols-2 gap-1 text-sm">
                <div className="font-semibold">Name:</div>
                <div>{studentToDelete.first_name && studentToDelete.last_name 
                  ? `${studentToDelete.first_name} ${studentToDelete.last_name}`
                  : 'Not provided'}</div>
                
                <div className="font-semibold">Email:</div>
                <div>{studentToDelete.email}</div>
                
                <div className="font-semibold">Student ID:</div>
                <div className="font-mono">{studentToDelete.role_id || '-'}</div>
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
              disabled={deleteStudentMutation.isPending}
              className="animate__animated animate__headShake animate__repeat-1 animate__delay-1s"
            >
              {deleteStudentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Student
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}