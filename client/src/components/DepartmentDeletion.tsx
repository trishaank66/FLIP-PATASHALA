import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Department } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { PageLayout } from '@/components/ui/page-layout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, XCircle, AlertCircle, Building2 } from 'lucide-react';
import 'animate.css';

export function DepartmentDeletion() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const {
    data: departments,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/departments'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/departments');
      return res.json() as Promise<Department[]>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (departmentId: number) => {
      const res = await apiRequest('DELETE', `/api/departments/${departmentId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      toast({
        title: 'Department Deleted',
        description: 'The department has been deleted successfully.',
      });
      setSelectedDepartmentId(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to delete department: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const handleDeleteConfirm = () => {
    if (selectedDepartmentId) {
      deleteMutation.mutate(selectedDepartmentId);
    }
    setIsDialogOpen(false);
  };

  const selectedDepartment = selectedDepartmentId 
    ? departments?.find(dept => dept.id === selectedDepartmentId) 
    : null;

  if (!user || user.role !== 'admin') {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Unauthorized</AlertTitle>
        <AlertDescription>
          You must be an administrator to delete departments.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <PageLayout 
      title="Delete Department" 
      titleIcon={<XCircle className="h-6 w-6 text-rose-500" />}
      backTo="/admin/departments"
      showBackButton={true}
      showHomeButton={true}
      showAdminButton={true}>
      <div className="animate__animated animate__fadeInUp">
        <Card className="shadow-md border-rose-200 dark:border-rose-900/20">
          <CardHeader className="bg-rose-50 dark:bg-rose-950/20 border-b border-rose-100 dark:border-rose-900/10">
            <CardTitle className="text-xl flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <XCircle className="h-5 w-5" />
              Delete Department
            </CardTitle>
            <CardDescription>
              Delete departments that are no longer needed. This action will remove the department from the system 
              and unassign all users from this department.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  Failed to load departments. Please try refreshing the page.
                </AlertDescription>
              </Alert>
            ) : departments && departments.length === 0 ? (
              <Alert className="mb-4">
                <Building2 className="h-4 w-4" />
                <AlertTitle>No Departments</AlertTitle>
                <AlertDescription>
                  There are no departments available to delete.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-2">Select Department to Delete</h3>
                  <Select
                    value={selectedDepartmentId?.toString() || ""}
                    onValueChange={(value) => setSelectedDepartmentId(parseInt(value))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments?.map((department) => (
                        <SelectItem key={department.id} value={department.id.toString()}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedDepartment && (
                  <div className="rounded-md border p-4 bg-muted/40">
                    <h3 className="font-medium mb-2">Department Details</h3>
                    <p className="text-sm mb-1"><strong>Name:</strong> {selectedDepartment.name}</p>
                    <p className="text-sm"><strong>Description:</strong> {selectedDepartment.description || 'No description'}</p>
                  </div>
                )}

                <Alert variant="destructive" className="bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/20">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>
                    Deleting a department will permanently remove it from the system and
                    unassign all users currently affiliated with it. This action cannot be undone.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-2 pt-2 border-t border-rose-100 dark:border-rose-900/10">
            <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="animate__animated animate__pulse animate__infinite bg-rose-600 hover:bg-rose-700"
                  disabled={!selectedDepartmentId || deleteMutation.isPending || isLoading}
                >
                  {deleteMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <XCircle className="mr-2 h-4 w-4" />
                      Delete Department
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the 
                    <span className="font-semibold"> {selectedDepartment?.name} </span> 
                    department and unassign all users currently assigned to it.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteConfirm}
                    className="bg-rose-600 hover:bg-rose-700"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      </div>
    </PageLayout>
  );
}