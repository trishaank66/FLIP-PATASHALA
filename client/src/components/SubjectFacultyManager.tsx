import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { InsertSubject, SubjectWithRelations, Department, User, InsertSubjectFacultyAssignment, SubjectFacultyAssignmentWithRelations, UpdateSubjectFacultyAssignment } from '@shared/schema';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2, Book, Pencil, Check, X, BookOpen, UserCog } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import 'animate.css';

export function SubjectFacultyManager() {
  const { toast } = useToast();
  const [isCreateSubjectOpen, setIsCreateSubjectOpen] = useState(false);
  const [isEditSubjectOpen, setIsEditSubjectOpen] = useState(false);
  const [subjectToEdit, setSubjectToEdit] = useState<SubjectWithRelations | null>(null);
  const [isAssignSubjectOpen, setIsAssignSubjectOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("subject-management");

  // Form states
  const [newSubject, setNewSubject] = useState<InsertSubject>({
    name: '',
    description: '',
    department_id: 0,
    created_by: 0,
    is_active: true
  });

  const [subjectAssignment, setSubjectAssignment] = useState<InsertSubjectFacultyAssignment>({
    faculty_id: 0,
    subject_name: '',
    department_id: 0,
    assigned_by: 0,
    is_active: true
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
      return res.json() as Promise<SubjectWithRelations[]>;
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
      const res = await apiRequest('PATCH', `/api/subjects/${id}`, data);
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
      const res = await apiRequest('POST', '/api/subject-faculty-assignments', data);
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
      await apiRequest('DELETE', `/api/subject-faculty-assignments/${id}`);
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

  //Update Subject Faculty Assignment Mutation
  const updateSubjectFacultyAssignment = useMutation({
    mutationFn: async (data: UpdateSubjectFacultyAssignment) => {
      const res = await apiRequest('PATCH', `/api/subject-faculty-assignments/${data.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subject-faculty-assignments'] });
      toast({
        title: "Assignment Updated",
        description: "The subject assignment has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Assignment",
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
      created_by: 0,
      is_active: true
    });
  };

  const resetAssignmentForm = () => {
    setSubjectAssignment({
      faculty_id: 0,
      subject_name: '',
      department_id: 0,
      assigned_by: 0,
      is_active: true
    });
  };

  // Handle subject form submission
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.name || !newSubject.department_id) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in subject name and select a department",
        variant: "destructive"
      });
      return;
    }
    
    try {
      await createSubjectMutation.mutateAsync({
        ...newSubject,
        created_by: user?.id || 0
      });
      setIsCreateSubjectOpen(false);
      resetSubjectForm();
    } catch (error) {
      console.error("Error creating subject:", error);
    }
  };

  // Handle subject deletion
  const handleDeleteSubject = async (subjectId: number) => {
    try {
      await deleteSubjectMutation.mutateAsync(subjectId);
    } catch (error) {
      console.error("Error deleting subject:", error);
    }
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
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="subject-management" className="flex items-center gap-2">
            <Book className="h-4 w-4" />
            <span>Subject Management</span>
          </TabsTrigger>
          <TabsTrigger value="faculty-assignments" className="flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            <span>Faculty Subject Assignments</span>
          </TabsTrigger>
        </TabsList>

        {/* Subject Management Tab */}
        <TabsContent value="subject-management" className="space-y-4 pt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Manage Subjects</h3>
            <Dialog open={isCreateSubjectOpen} onOpenChange={setIsCreateSubjectOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="animate__animated animate__bounceIn"
                  variant="default"
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
                    <Button type="submit" disabled={createSubjectMutation.isPending}>
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
                <Card key={subject.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base font-medium">{subject.name}</CardTitle>
                      <div className="flex gap-2">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8"
                          onClick={() => handleEditSubject(subject)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-red-50 dark:hover:bg-red-950/20 animate__animated animate__zoomIn"
                          onClick={() => handleDeleteSubject(subject.id)}
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
        </TabsContent>

        {/* Faculty Assignments Tab */}
        <TabsContent value="faculty-assignments" className="space-y-4 pt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-600 animate__animated animate__fadeIn">Subject-Faculty Assignments</span>
              <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 animate__animated animate__bounceIn">Key Management Area</Badge>
            </h3>
            <Dialog open={isAssignSubjectOpen} onOpenChange={setIsAssignSubjectOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="animate__animated animate__bounceIn animate__infinite animate__slower bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 shadow-md hover:shadow-lg transition-all duration-200"
                  variant="default"
                >
                  <Plus className="h-4 w-4 mr-2 animate__animated animate__pulse animate__infinite" />
                  Assign Subject
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Subject to Faculty</DialogTitle>
                  <DialogDescription>
                    Assign a subject to a faculty member to allow them to upload content for this subject.
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
                          {faculty?.filter(f => f.role === 'faculty').map(faculty => (
                            <SelectItem key={faculty.id} value={faculty.id.toString()}>
                              {faculty.first_name ? `${faculty.first_name} ${faculty.last_name || ''}` : faculty.email}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject_name">Subject Name</Label>
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
                    <Button type="submit" disabled={assignSubjectMutation.isPending}>
                      {assignSubjectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Assign Subject
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Assignment list */}
          <div className="space-y-4">
            {assignments?.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No subject assignments yet. Assign subjects to faculty members to get started.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {faculty?.filter(f => f.role === 'faculty').map(facultyMember => {
                      const facultyAssignments = assignments?.filter(a => a.faculty_id === facultyMember.id) || [];

                      if (facultyAssignments.length === 0) return null;

                      return (
                        <div key={facultyMember.id} className="space-y-2">
                          <h4 className="font-medium flex items-center gap-2 p-2 rounded-md bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900 animate__animated animate__fadeIn">
                            <UserCog className="h-5 w-5 text-blue-600 dark:text-blue-400 animate__animated animate__pulse" />
                            <span className="font-semibold text-blue-700 dark:text-blue-300">
                              {facultyMember.first_name 
                                ? `${facultyMember.first_name} ${facultyMember.last_name || ''}` 
                                : facultyMember.email}
                            </span>
                            <Badge variant="outline" className="ml-auto text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                              Faculty Member
                            </Badge>
                          </h4>
                          <div className="pl-6 space-y-2">
                            {facultyAssignments.map(assignment => (
                              <div key={assignment.id} className="flex justify-between items-center p-2 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 rounded-md animate__animated animate__fadeIn hover:shadow-sm transition-all duration-200">
                                <div className="flex items-center gap-2">
                                  <BookOpen className="h-4 w-4 text-indigo-600 animate__animated animate__pulse" />
                                  <span className="font-medium text-indigo-700 dark:text-indigo-300">{assignment.subject_name}</span>
                                  <Badge variant="outline" className="ml-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                                    {getDepartmentName(assignment.department_id)}
                                  </Badge>
                                </div>
                                <div className="flex gap-2">
                                  <Select
                                    value=""
                                    onValueChange={(value) => {
                                      const subject = subjects?.find(s => s.name === value);
                                      if (subject) {
                                        updateSubjectFacultyAssignment.mutate({
                                          id: assignment.id,
                                          subject_name: value,
                                          department_id: subject.department_id
                                        });
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="w-[180px]">
                                      <SelectValue placeholder="Replace with..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {subjects?.map(subject => (
                                        <SelectItem key={subject.id} value={subject.name}>
                                          {subject.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-red-50 dark:hover:bg-red-950/20 animate__animated animate__zoomIn"
                                    onClick={() => removeAssignmentMutation.mutate(assignment.id)}
                                    title="Remove Assignment"
                                  >
                                    <Trash2 className="h-4 w-4 animate__animated animate__headShake animate__delay-2s" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <Separator className="my-4" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Subject Dialog */}
      <Dialog open={isEditSubjectOpen} onOpenChange={setIsEditSubjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
            <DialogDescription>
              Update the subject details.
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
              <Button variant="outline" onClick={() => setIsEditSubjectOpen(false)} type="button">
                Cancel
              </Button>
              <Button type="submit" disabled={updateSubjectMutation.isPending}>
                {updateSubjectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update Subject
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SubjectFacultyManager;