import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { InsertSubject, SubjectWithRelations, Department, User, InsertSubjectFacultyAssignment, SubjectFacultyAssignmentWithRelations } from '@shared/schema';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2, Book, Pencil, Check, X, BookOpen, UserCog, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import 'animate.css';
import { useAuth } from '@/hooks/use-auth';

// Dummy subjects for the dropdown
const dummySubjects = [
  { id: 1, name: "Mathematics", description: "Advanced mathematics course", department_id: 1 },
  { id: 2, name: "Physics", description: "Physics fundamentals", department_id: 1 },
  { id: 3, name: "Chemistry", description: "Organic and inorganic chemistry", department_id: 1 },
  { id: 4, name: "Computer Science", description: "Fundamentals of programming", department_id: 2 },
  { id: 5, name: "Data Structures", description: "Advanced data structures and algorithms", department_id: 2 },
  { id: 6, name: "Database Systems", description: "Relational database concepts", department_id: 2 },
  { id: 7, name: "Accounting", description: "Financial accounting principles", department_id: 3 },
  { id: 8, name: "Economics", description: "Micro and macroeconomics", department_id: 3 }
];

export function SubjectAssignmentManager() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCreateSubjectOpen, setIsCreateSubjectOpen] = useState(false);
  const [isEditSubjectOpen, setIsEditSubjectOpen] = useState(false);
  const [subjectToEdit, setSubjectToEdit] = useState<SubjectWithRelations | null>(null);
  const [isAssignSubjectOpen, setIsAssignSubjectOpen] = useState(false);
  const [isReplaceAssignmentOpen, setIsReplaceAssignmentOpen] = useState(false);
  const [assignmentToReplace, setAssignmentToReplace] = useState<SubjectFacultyAssignmentWithRelations | null>(null);
  const [activeTab, setActiveTab] = useState("subject-management");

  // Form states
  const [newSubject, setNewSubject] = useState<InsertSubject>({
    name: '',
    description: '',
    department_id: 0,
    created_by: user?.id || 0,
    is_active: true
  });

  const [subjectAssignment, setSubjectAssignment] = useState<InsertSubjectFacultyAssignment>({
    faculty_id: 0,
    subject_name: '',
    department_id: 0,
    assigned_by: user?.id || 0,
    is_active: true
  });

  const [replacementAssignment, setReplacementAssignment] = useState({
    new_subject_name: '',
    faculty_id: 0,
    old_assignment_id: 0
  });

  // Fetch subjects
  const {
    data: subjects,
    isLoading: isSubjectsLoading,
    error: subjectsError,
    refetch: refetchSubjects
  } = useQuery({
    queryKey: ['/api/subjects'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/subjects');
      const data = await res.json() as SubjectWithRelations[];
      return data.length > 0 ? data : dummySubjects;
    }
  });

  // Fetch departments for dropdown
  const {
    data: departments,
    isLoading: isDepartmentsLoading
  } = useQuery({
    queryKey: ['/api/departments'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/departments');
      return res.json() as Promise<Department[]>;
    }
  });

  // Fetch faculty for dropdown
  const {
    data: faculty,
    isLoading: isFacultyLoading
  } = useQuery({
    queryKey: ['/api/faculty'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/faculty');
      return res.json() as Promise<User[]>;
    }
  });

  // Fetch subject-faculty assignments
  const {
    data: assignments,
    isLoading: isAssignmentsLoading,
    error: assignmentsError,
    refetch: refetchAssignments
  } = useQuery({
    queryKey: ['/api/subject-faculty-assignments'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/subject-faculty-assignments');
      return res.json() as Promise<SubjectFacultyAssignmentWithRelations[]>;
    }
  });

  // Create subject mutation
  const createSubjectMutation = useMutation({
    mutationFn: async (data: InsertSubject) => {
      const res = await apiRequest('POST', '/api/subjects', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subjects'] });
      setIsCreateSubjectOpen(false);
      resetSubjectForm();
      toast({
        title: "Subject Created",
        description: "The subject has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Subject",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update subject mutation
  const updateSubjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<InsertSubject> }) => {
      const res = await apiRequest('PUT', `/api/subjects/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subjects'] });
      setIsEditSubjectOpen(false);
      setSubjectToEdit(null);
      toast({
        title: "Subject Updated",
        description: "The subject has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Subject",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete subject mutation
  const deleteSubjectMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/subjects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subjects'] });
      toast({
        title: "Subject Deleted",
        description: "The subject has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Delete Subject",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Assign subject to faculty mutation
  const assignSubjectMutation = useMutation({
    mutationFn: async (data: InsertSubjectFacultyAssignment) => {
      const res = await apiRequest('POST', '/api/admin/subject-faculty-assignments', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subject-faculty-assignments'] });
      setIsAssignSubjectOpen(false);
      resetAssignmentForm();
      toast({
        title: "Subject Assigned",
        description: "The subject has been assigned to faculty successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Assign Subject",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Remove subject assignment mutation
  const removeAssignmentMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('POST', `/api/admin/subject-faculty-assignments/${id}/remove`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subject-faculty-assignments'] });
      toast({
        title: "Assignment Removed",
        description: "The subject assignment has been removed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Remove Assignment",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Replace subject assignment mutation
  const replaceAssignmentMutation = useMutation({
    mutationFn: async (data: { old_assignment_id: number, new_subject_name: string }) => {
      const res = await apiRequest('PUT', `/api/admin/subject-faculty-assignments/${data.old_assignment_id}`, { 
        subject_name: data.new_subject_name
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subject-faculty-assignments'] });
      setIsReplaceAssignmentOpen(false);
      setAssignmentToReplace(null);
      toast({
        title: "Assignment Replaced",
        description: "The subject assignment has been replaced successfully.",
      });
    },
    onError: (error: Error) => {
      console.error('Replace assignment error:', error);
      toast({
        title: "Failed to Replace Assignment",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Reset form states
  const resetSubjectForm = () => {
    setNewSubject({
      name: '',
      description: '',
      department_id: 0,
      created_by: user?.id || 0,
      is_active: true
    });
  };

  const resetAssignmentForm = () => {
    setSubjectAssignment({
      faculty_id: 0,
      subject_name: '',
      department_id: 0,
      assigned_by: user?.id || 0,
      is_active: true
    });
  };

  // Handle subject form submission
  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    createSubjectMutation.mutate(newSubject);
  };

  // Handle subject update form submission
  const handleUpdateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (subjectToEdit) {
      updateSubjectMutation.mutate({
        id: subjectToEdit.id,
        data: {
          name: newSubject.name,
          description: newSubject.description,
          department_id: newSubject.department_id,
          is_active: newSubject.is_active
        }
      });
    }
  };

  // Handle assignment form submission
  const handleAssignSubject = (e: React.FormEvent) => {
    e.preventDefault();
    assignSubjectMutation.mutate(subjectAssignment);
  };

  // Handle replace assignment form submission
  const handleReplaceAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (assignmentToReplace) {
      replaceAssignmentMutation.mutate({
        old_assignment_id: assignmentToReplace.id,
        new_subject_name: replacementAssignment.new_subject_name
      });
    }
  };

  // Set up edit form when a subject is selected for editing
  const handleEditSubject = (subject: SubjectWithRelations) => {
    setSubjectToEdit(subject);
    setNewSubject({
      name: subject.name,
      description: subject.description || '',
      department_id: subject.department_id || 0,
      created_by: subject.created_by,
      is_active: subject.is_active
    });
    setIsEditSubjectOpen(true);
  };

  // Set up replace form when an assignment is selected for replacement
  const handleReplaceSubjectAssignment = (assignment: SubjectFacultyAssignmentWithRelations) => {
    setAssignmentToReplace(assignment);
    setReplacementAssignment({
      new_subject_name: '',
      faculty_id: assignment.faculty_id,
      old_assignment_id: assignment.id
    });
    setIsReplaceAssignmentOpen(true);
  };

  // Get a department's name by ID
  const getDepartmentName = (deptId: number | null) => {
    if (!deptId) return 'No Department';
    const dept = departments?.find(d => d.id === deptId);
    return dept ? dept.name : 'Unknown Department';
  };

  // Get a faculty's name by ID
  const getFacultyName = (facultyId: number) => {
    const facultyMember = faculty?.find(f => f.id === facultyId);
    return facultyMember 
      ? `${facultyMember.first_name || ''} ${facultyMember.last_name || ''}`.trim() || facultyMember.email
      : 'Unknown Faculty';
  };

  // Loading state
  if (isSubjectsLoading || isDepartmentsLoading || isFacultyLoading || isAssignmentsLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (subjectsError || assignmentsError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load subjects or assignments. Please refresh the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 animate__animated animate__fadeIn">
      <div className="bg-gradient-to-r from-emerald-100 to-cyan-100 dark:from-emerald-950/40 dark:to-cyan-950/40 p-4 rounded-lg mb-6 shadow-md">
        <h2 className="text-xl font-semibold flex items-center gap-2 mb-2 bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
          <BookOpen className="h-5 w-5 text-emerald-600 animate__animated animate__pulse animate__infinite animate__slow" />
          Subject Assignment Manager
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Manage subjects and faculty assignments in a comprehensive way. Create subjects, assign them to faculty, and manage existing assignments.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="subject-management" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white">
            <Book className="h-4 w-4" />
            <span>Subject Management</span>
          </TabsTrigger>
          <TabsTrigger value="faculty-assignments" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white">
            <UserCog className="h-4 w-4" />
            <span>Faculty Subject Assignments</span>
          </TabsTrigger>
          <TabsTrigger value="manage-assignments" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white">
            <RefreshCw className="h-4 w-4" />
            <span>Modify Assignments</span>
          </TabsTrigger>
        </TabsList>

        {/* Subject Management Tab */}
        <TabsContent value="subject-management" className="space-y-4 pt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Book className="h-5 w-5 text-emerald-600" />
              <span className="bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
                Create & Manage Subjects
              </span>
            </h3>
            <Dialog open={isCreateSubjectOpen} onOpenChange={setIsCreateSubjectOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="animate__animated animate__bounceIn bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Subject
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Subject</DialogTitle>
                  <DialogDescription>
                    Add a new subject to a department. This will be available for faculty to assign content to.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateSubject} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Subject Name</Label>
                    <Input
                      id="name"
                      value={newSubject.name}
                      onChange={e => setNewSubject({...newSubject, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newSubject.description || ''}
                      onChange={e => setNewSubject({...newSubject, description: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Select 
                      value={newSubject.department_id ? newSubject.department_id.toString() : ''} 
                      onValueChange={value => setNewSubject({...newSubject, department_id: parseInt(value)})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Departments</SelectLabel>
                          {departments?.map(dept => (
                            <SelectItem key={dept.id} value={dept.id.toString()}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button 
                      type="submit" 
                      disabled={createSubjectMutation.isPending}
                      className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
                    >
                      {createSubjectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Create Subject
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Subject list */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects?.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No subjects created yet. Create your first subject to get started.
                </CardContent>
              </Card>
            ) : (
              subjects?.map(subject => (
                <Card key={subject.id} className="hover:shadow-md transition-shadow border-l-4 border-l-emerald-500">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base font-medium">{subject.name}</CardTitle>
                      <div className="flex gap-2">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 animate__animated animate__fadeIn"
                          onClick={() => handleEditSubject(subject)}
                          title="Edit Subject"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-red-50 dark:hover:bg-red-950/20 animate__animated animate__zoomIn"
                          onClick={() => deleteSubjectMutation.mutate(subject.id)}
                          title="Delete Subject"
                        >
                          <Trash2 className="h-4 w-4 animate__animated animate__headShake animate__delay-2s" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription>
                      <Badge variant="outline" className="bg-muted/50">
                        {getDepartmentName(subject.department_id)}
                      </Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {subject.description || 'No description available'}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Edit Subject Dialog */}
          <Dialog open={isEditSubjectOpen} onOpenChange={setIsEditSubjectOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Subject</DialogTitle>
                <DialogDescription>
                  Update the subject information.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdateSubject} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Subject Name</Label>
                  <Input
                    id="edit-name"
                    value={newSubject.name}
                    onChange={e => setNewSubject({...newSubject, name: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={newSubject.description || ''}
                    onChange={e => setNewSubject({...newSubject, description: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-department">Department</Label>
                  <Select 
                    value={newSubject.department_id ? newSubject.department_id.toString() : ''} 
                    onValueChange={value => setNewSubject({...newSubject, department_id: parseInt(value)})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Departments</SelectLabel>
                        {departments?.map(dept => (
                          <SelectItem key={dept.id} value={dept.id.toString()}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={updateSubjectMutation.isPending}
                    className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
                  >
                    {updateSubjectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Update Subject
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Faculty Assignments Tab */}
        <TabsContent value="faculty-assignments" className="space-y-4 pt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <UserCog className="h-5 w-5 text-emerald-600" />
              <span className="bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
                Assign Subjects to Faculty
              </span>
            </h3>
            <Dialog open={isAssignSubjectOpen} onOpenChange={setIsAssignSubjectOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="animate__animated animate__bounceIn bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Assignment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Subject to Faculty</DialogTitle>
                  <DialogDescription>
                    Assign a subject to a faculty member. They will be able to manage content for this subject.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAssignSubject} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="faculty">Faculty Member</Label>
                    <Select 
                      value={subjectAssignment.faculty_id ? subjectAssignment.faculty_id.toString() : ''} 
                      onValueChange={value => setSubjectAssignment({...subjectAssignment, faculty_id: parseInt(value)})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a faculty member" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Faculty</SelectLabel>
                          {faculty?.filter(f => f.role === 'faculty').map(f => (
                            <SelectItem key={f.id} value={f.id.toString()}>
                              {`${f.first_name || ''} ${f.last_name || ''}`.trim() || f.email}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Select 
                      value={subjectAssignment.subject_name} 
                      onValueChange={value => {
                        const subject = subjects?.find(s => s.name === value);
                        setSubjectAssignment({
                          ...subjectAssignment, 
                          subject_name: value,
                          department_id: subject?.department_id || 0
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a subject" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Subjects</SelectLabel>
                          {subjects?.map(subject => (
                            <SelectItem key={subject.id} value={subject.name}>
                              {subject.name} ({getDepartmentName(subject.department_id)})
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button 
                      type="submit" 
                      disabled={assignSubjectMutation.isPending}
                      className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
                    >
                      {assignSubjectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Assign Subject
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Faculty-Subject Assignments List */}
          {assignments?.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No subject assignments yet. Assign a subject to a faculty member to get started.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {faculty?.filter(f => f.role === 'faculty').map(facultyMember => {
                const facultyAssignments = assignments?.filter(a => a.faculty_id === facultyMember.id);
                if (facultyAssignments?.length === 0) return null;
                
                return (
                  <Card key={facultyMember.id} className="hover:shadow-md transition-shadow border-l-4 border-l-cyan-500 animate__animated animate__fadeIn">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        <UserCog className="h-4 w-4 text-cyan-600" />
                        {`${facultyMember.first_name || ''} ${facultyMember.last_name || ''}`.trim() || facultyMember.email}
                      </CardTitle>
                      <CardDescription>
                        {facultyMember.email}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <h4 className="text-sm font-medium mb-2">Assigned Subjects:</h4>
                      <div className="flex flex-wrap gap-2">
                        {facultyAssignments?.map(assignment => (
                          <Badge 
                            key={assignment.id} 
                            className="flex items-center gap-1 bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100 animate__animated animate__fadeIn"
                          >
                            <Book className="h-3 w-3" />
                            {assignment.subject_name}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Manage Assignments Tab */}
        <TabsContent value="manage-assignments" className="space-y-4 pt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-emerald-600" />
              <span className="bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
                Modify Faculty Subject Assignments
              </span>
            </h3>
          </div>

          {/* All Current Assignments with Remove/Replace options */}
          {assignments?.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No subject assignments yet. Assign a subject to a faculty member first.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card className="border-2 border-dashed border-emerald-200 dark:border-emerald-800">
                <CardHeader>
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-emerald-600" />
                    Current Faculty Subject Assignments
                  </CardTitle>
                  <CardDescription>
                    Remove or replace assignments as needed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Faculty</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Subject</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Department</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignments?.map(assignment => (
                          <tr key={assignment.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 animate__animated animate__fadeIn">
                            <td className="px-4 py-3 text-sm">{getFacultyName(assignment.faculty_id)}</td>
                            <td className="px-4 py-3 text-sm">
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
                                {assignment.subject_name}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm">{getDepartmentName(assignment.department_id)}</td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center gap-2">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 animate__animated animate__fadeIn"
                                  onClick={() => handleReplaceSubjectAssignment(assignment)}
                                  title="Replace Assignment"
                                >
                                  <RefreshCw className="h-4 w-4 mr-1" />
                                  Replace
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-8 text-destructive hover:text-destructive/90 hover:bg-red-50 dark:hover:bg-red-950/20 animate__animated animate__fadeIn"
                                  onClick={() => removeAssignmentMutation.mutate(assignment.id)}
                                  title="Remove Assignment"
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Remove
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Replace Assignment Dialog */}
          <Dialog open={isReplaceAssignmentOpen} onOpenChange={setIsReplaceAssignmentOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Replace Subject Assignment</DialogTitle>
                <DialogDescription>
                  Replace the current subject assignment with a new subject.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleReplaceAssignment} className="space-y-4">
                {assignmentToReplace && (
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                    <p className="text-sm font-medium">Current Assignment:</p>
                    <div className="flex flex-col gap-1 mt-1">
                      <span className="text-sm">
                        <strong>Faculty:</strong> {getFacultyName(assignmentToReplace.faculty_id)}
                      </span>
                      <span className="text-sm">
                        <strong>Subject:</strong> {assignmentToReplace.subject_name}
                      </span>
                      <span className="text-sm">
                        <strong>Department:</strong> {getDepartmentName(assignmentToReplace.department_id)}
                      </span>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="new-subject">New Subject</Label>
                  <Select 
                    value={replacementAssignment.new_subject_name} 
                    onValueChange={value => setReplacementAssignment({...replacementAssignment, new_subject_name: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a new subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Subjects</SelectLabel>
                        {subjects?.map(subject => (
                          <SelectItem key={subject.id} value={subject.name}>
                            {subject.name} ({getDepartmentName(subject.department_id)})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={replaceAssignmentMutation.isPending || !replacementAssignment.new_subject_name}
                    className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
                  >
                    {replaceAssignmentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Replace Assignment
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}