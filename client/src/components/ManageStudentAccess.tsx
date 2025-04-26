
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { DepartmentBadge } from '@/components/DepartmentBadge';
import { 
  Users, 
  Search, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Clock,
  UserCheck,
  UserX,
  UserMinus,
  Trash2
} from 'lucide-react';
import 'animate.css';

type Student = {
  id: number;
  email: string;
  role_id: string;
  first_name: string | null;
  last_name: string | null;
  department_name: string;
  content_access_count: number;
  last_content_access: string | null;
};

type Faculty = {
  id: number;
  email: string;
  role_id: string;
  first_name: string | null;
  last_name: string | null;
  department_name: string;
  access_status: 'allowed' | 'pending' | 'removed';
  last_upload: string | null;
};

export function ManageStudentAccess() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [activeTab, setActiveTab] = useState('students');

  // Query for students with content access
  const { data: students, isLoading: isLoadingStudents, refetch: refetchStudents } = useQuery<Student[]>({
    queryKey: ['/api/admin/students-with-access'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/students-with-access');
      return res.json();
    }
  });

  // Query for faculty with content access
  const { data: faculty, isLoading: isLoadingFaculty, refetch: refetchFaculty } = useQuery<Faculty[]>({
    queryKey: ['/api/admin/faculty-with-access'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/faculty-with-access');
      return res.json();
    }
  });
  
  // Mutation for removing student access
  const removeStudentAccessMutation = useMutation({
    mutationFn: async (studentId: number) => {
      const res = await apiRequest('POST', `/api/admin/remove-content-access/${studentId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Access Removed",
        description: "Student content access has been removed successfully.",
      });
      refetchStudents();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Remove Access",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Filter students based on search and department
  const filteredStudents = students?.filter(student => {
    const matchesSearch = 
      student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.role_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${student.first_name} ${student.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = 
      selectedDepartment === 'all' || 
      student.department_name === selectedDepartment;

    return matchesSearch && matchesDepartment;
  });

  // Filter faculty based on search, department, and access status
  const filteredFaculty = faculty?.filter(f => {
    const matchesSearch = 
      f.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.role_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${f.first_name} ${f.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = 
      selectedDepartment === 'all' || 
      f.department_name === selectedDepartment;

    return matchesSearch && matchesDepartment;
  });

  // Get unique departments
  const departments = Array.from(new Set([
    ...(students || []).map(s => s.department_name),
    ...(faculty || []).map(f => f.department_name)
  ])).filter(Boolean);

  // Split faculty by access status
  const allowedFaculty = filteredFaculty?.filter(f => f.access_status === 'allowed') || [];
  const pendingFaculty = filteredFaculty?.filter(f => f.access_status === 'pending') || [];
  const removedFaculty = filteredFaculty?.filter(f => f.access_status === 'removed') || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Content Access Management
        </CardTitle>
        <CardDescription>
          Manage content access for students and faculty members
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, ID or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="students" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Students ({filteredStudents?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="faculty" className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Faculty Access
              </TabsTrigger>
            </TabsList>

            <TabsContent value="students">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Access Count</TableHead>
                      <TableHead>Last Access</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents?.map(student => (
                      <TableRow key={student.id}>
                        <TableCell>{student.id}</TableCell>
                        <TableCell className="font-mono">{student.role_id}</TableCell>
                        <TableCell>
                          {student.first_name && student.last_name 
                            ? `${student.first_name} ${student.last_name}`
                            : student.email}
                        </TableCell>
                        <TableCell>
                          <DepartmentBadge departmentName={student.department_name} />
                        </TableCell>
                        <TableCell>{student.content_access_count}</TableCell>
                        <TableCell>
                          {student.last_content_access 
                            ? new Date(student.last_content_access).toLocaleDateString()
                            : 'Never'}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="animate__animated animate__zoomIn"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Remove Access
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Content Access</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove {student.first_name} {student.last_name}'s access to all content.
                                  They will no longer be able to view or download content from the {student.department_name} department.
                                  <br /><br />
                                  <span className="text-red-500 font-semibold">This action cannot be undone.</span>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => removeStudentAccessMutation.mutate(student.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  {removeStudentAccessMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                  ) : (
                                    <Trash2 className="h-4 w-4 mr-1" />
                                  )}
                                  Remove Access
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="faculty">
              <div className="space-y-6">
                {/* Allowed Faculty */}
                <div>
                  <h3 className="text-lg font-medium flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Faculty with Content Access ({allowedFaculty.length})
                  </h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Faculty ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Last Upload</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allowedFaculty.map(faculty => (
                          <TableRow key={faculty.id}>
                            <TableCell>{faculty.id}</TableCell>
                            <TableCell className="font-mono">{faculty.role_id}</TableCell>
                            <TableCell>
                              {faculty.first_name && faculty.last_name 
                                ? `${faculty.first_name} ${faculty.last_name}`
                                : faculty.email}
                            </TableCell>
                            <TableCell>
                              <DepartmentBadge departmentName={faculty.department_name} />
                            </TableCell>
                            <TableCell>
                              {faculty.last_upload 
                                ? new Date(faculty.last_upload).toLocaleDateString()
                                : 'Never'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  // Handle remove access
                                }}
                              >
                                <UserMinus className="h-4 w-4 mr-1" />
                                Remove Access
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Pending Faculty */}
                <div>
                  <h3 className="text-lg font-medium flex items-center gap-2 mb-3">
                    <Clock className="h-5 w-5 text-amber-600" />
                    Pending Faculty Access ({pendingFaculty.length})
                  </h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Faculty ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingFaculty.map(faculty => (
                          <TableRow key={faculty.id}>
                            <TableCell>{faculty.id}</TableCell>
                            <TableCell className="font-mono">{faculty.role_id}</TableCell>
                            <TableCell>
                              {faculty.first_name && faculty.last_name 
                                ? `${faculty.first_name} ${faculty.last_name}`
                                : faculty.email}
                            </TableCell>
                            <TableCell>
                              <DepartmentBadge departmentName={faculty.department_name} />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="default"
                                size="sm"
                                className="mr-2"
                                onClick={() => {
                                  // Handle grant access
                                }}
                              >
                                <UserCheck className="h-4 w-4 mr-1" />
                                Grant Access
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Removed Faculty */}
                <div>
                  <h3 className="text-lg font-medium flex items-center gap-2 mb-3">
                    <XCircle className="h-5 w-5 text-red-600" />
                    Removed Faculty Access ({removedFaculty.length})
                  </h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Faculty ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {removedFaculty.map(faculty => (
                          <TableRow key={faculty.id}>
                            <TableCell>{faculty.id}</TableCell>
                            <TableCell className="font-mono">{faculty.role_id}</TableCell>
                            <TableCell>
                              {faculty.first_name && faculty.last_name 
                                ? `${faculty.first_name} ${faculty.last_name}`
                                : faculty.email}
                            </TableCell>
                            <TableCell>
                              <DepartmentBadge departmentName={faculty.department_name} />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  // Handle restore access
                                }}
                              >
                                <UserCheck className="h-4 w-4 mr-1" />
                                Restore Access
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}
