import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  CheckCircle2, 
  UserCheck, 
  AlertCircle, 
  Info, 
  Users, 
  Database, 
  UserPlus, 
  Trash2,
  GraduationCap,
  CheckSquare,
  UserCog,
  UserMinus,
  Building2,
  Home,
  ArrowLeft,
  ShieldCheck,
  Settings,
  XCircle,
  Lightbulb,
  BookOpen,
  Book
} from 'lucide-react';
import { AdminSelfDelete } from '@/components/AdminSelfDelete';
import { AIInsights } from '@/components/AIInsights';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { DepartmentManagement } from '@/components/DepartmentManagement';
import { DepartmentCreation } from '@/components/DepartmentCreation';
import { DepartmentDeletion } from '@/components/DepartmentDeletion';
import { StudentBulkSync } from '@/components/StudentBulkSync';
import { ManualAddStudent } from '@/components/ManualAddStudent';
import { ManualAddFaculty } from '@/components/ManualAddFaculty';
import { DeleteStudent } from '@/components/DeleteStudent';
import { FacultyManagement } from '@/components/FacultyManagement';
import { ManualAddAdmin } from '@/components/ManualAddAdmin';
import { DeleteAdmin } from '@/components/DeleteAdmin';
import { AdminApproval } from '@/components/AdminApproval';
import { StudentApproval } from '@/components/StudentApproval';
import StudentSyncPanel from '@/components/StudentSyncPanel';
import { ManageStudentAccess } from '@/components/ManageStudentAccess';
import { FacultyContentAccessList } from '@/components/FacultyContentAccessList';
import { SubjectFacultyManager } from '@/components/SubjectFacultyManager';
import { SubjectAssignmentManager } from '@/components/SubjectAssignmentManager';
import ContentSorter from '@/components/ContentSorter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import 'animate.css';

type User = {
  id: number;
  email: string;
  role: string;
  role_id: string | null;
  verification_pending: boolean;
  verified_at: string | null;
  first_name: string | null;
  last_name: string | null;
};

export function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bounceActive, setBounceActive] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState(() => {
    // Check if we have a last section stored from navigation
    const lastSection = sessionStorage.getItem('adminLastSection');
    // If found, use it and then clear it
    if (lastSection) {
      sessionStorage.removeItem('adminLastSection');
      return lastSection;
    }
    // Default tab
    return "department-management";
  });
  
  const [, navigate] = useLocation();
  
  // Use direct links to different sections instead of trying to use tabs
  const navigateTo = (section: string) => {
    // Just set the active tab instead of navigating to a separate page
    setActiveTab(section);
    console.log(`Changing admin tab to: ${section}`);
  };

  // Query for pending faculty
  const { 
    data: pendingFaculty,
    isLoading: isPendingLoading,
    error: pendingError,
    refetch: refetchPending
  } = useQuery({
    queryKey: ['/api/pending-faculty'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/pending-faculty');
      return res.json() as Promise<User[]>;
    },
    enabled: !!user && user.role === 'admin'
  });

  // Mutation for verifying faculty
  const verifyFacultyMutation = useMutation({
    mutationFn: async (facultyId: number) => {
      const res = await apiRequest('POST', '/api/verify-faculty', { facultyId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pending-faculty'] });
      toast({
        title: "Faculty Verified",
        description: "Faculty member has been verified successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Handle verify button click with bounce animation
  const handleVerify = (facultyId: number) => {
    // Set this faculty ID to have active bounce
    setBounceActive(prev => ({ ...prev, [facultyId]: true }));
    
    // Remove bounce after animation completes
    setTimeout(() => {
      setBounceActive(prev => ({ ...prev, [facultyId]: false }));
      // Actually perform the verification
      verifyFacultyMutation.mutate(facultyId);
    }, 1000);
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  // Loading state
  if (isPendingLoading) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Faculty Verification</CardTitle>
          <CardDescription>Loading pending faculty members...</CardDescription>
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
      <Alert variant="destructive" className="mb-8">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load pending faculty members. Please refresh the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-center items-center mb-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight flex items-center justify-center gap-2 bg-gradient-to-r from-purple-700 via-indigo-500 to-blue-600 bg-clip-text text-transparent animate__animated animate__fadeIn">
            <ShieldCheck className="h-8 w-8 text-primary" />
            FLIP Patashala Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-2 animate__animated animate__fadeIn">
            Welcome, {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.email}! 
            Manage your institution's platform here.
          </p>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex justify-between items-center mb-4">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-2"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </Button>
        </div>
        
        <Card className="mb-6 border-primary/10 shadow-md">
          <CardHeader className="pb-3 bg-muted/30">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary animate__animated animate__pulse animate__infinite animate__slower" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-600 animate__animated animate__fadeIn">Admin Control Center</span>
              <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 animate__animated animate__bounceIn ml-2">
                Central Hub
              </Badge>
            </CardTitle>
            <CardDescription className="animate__animated animate__fadeIn">Manage all aspects of FLIP Patashala from this dashboard</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 pb-4">
            <TabsList className="w-full grid grid-cols-7 gap-2 bg-muted/50 p-2 rounded-lg shadow-inner">
              <TabsTrigger value="user-management" className="flex items-center gap-2 font-semibold data-[state=active]:bg-gradient-to-br data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-all duration-200 animate__animated animate__fadeIn">
                <UserCog className="h-4 w-4" />
                <span>User Management</span>
              </TabsTrigger>
              <TabsTrigger value="department-management" className="flex items-center gap-2 font-semibold data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-600 data-[state=active]:to-teal-600 data-[state=active]:text-white hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all duration-200 animate__animated animate__fadeIn animate__delay-1s">
                <Building2 className="h-4 w-4" />
                <span>Departments</span>
              </TabsTrigger>
              <TabsTrigger value="verification" className="flex items-center gap-2 font-semibold data-[state=active]:bg-gradient-to-br data-[state=active]:from-teal-600 data-[state=active]:to-green-600 data-[state=active]:text-white hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-all duration-200 animate__animated animate__fadeIn animate__delay-2s">
                <CheckSquare className="h-4 w-4" />
                <span>Verification</span>
              </TabsTrigger>
              <TabsTrigger value="subject-assignment" className="flex items-center gap-2 font-semibold data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all duration-200 animate__animated animate__fadeIn animate__delay-3s">
                <Book className="h-4 w-4" />
                <span>Subject Manager</span>
              </TabsTrigger>
              <TabsTrigger value="content-management" className="flex items-center gap-2 font-semibold data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all duration-200 animate__animated animate__fadeIn animate__delay-3s">
                <BookOpen className="h-4 w-4" />
                <span>Content Access</span>
              </TabsTrigger>
              <TabsTrigger value="bulk-operations" className="flex items-center gap-2 font-semibold data-[state=active]:bg-gradient-to-br data-[state=active]:from-orange-600 data-[state=active]:to-amber-600 data-[state=active]:text-white hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-all duration-200 animate__animated animate__fadeIn animate__delay-4s">
                <Database className="h-4 w-4" />
                <span>Bulk Actions</span>
              </TabsTrigger>
              <TabsTrigger value="ai-insights" className="flex items-center gap-2 font-semibold data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-500 data-[state=active]:to-yellow-400 data-[state=active]:text-white hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all duration-200 animate__animated animate__fadeIn animate__delay-5s">
                <Lightbulb className="h-4 w-4 animate__animated animate__pulse animate__infinite animate__slow" />
                <span>AI Insights</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2 font-semibold data-[state=active]:bg-gradient-to-br data-[state=active]:from-rose-600 data-[state=active]:to-red-600 data-[state=active]:text-white hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all duration-200 animate__animated animate__fadeIn animate__delay-6s">
                <Settings className="h-4 w-4" />
                <span>Admin Sign Off</span>
              </TabsTrigger>
            </TabsList>
          </CardContent>
        </Card>
        
        <TabsContent value="user-management">
          <div className="space-y-8">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-6 bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent animate__animated animate__fadeIn">
              <Users className="h-5 w-5 text-indigo-600 animate__animated animate__pulse animate__infinite animate__slow" />
              Complete User Management
              <Badge className="ml-2 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 animate__animated animate__bounceIn">
                User Hub
              </Badge>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                  <GraduationCap className="h-4 w-4 text-indigo-600" />
                  Student Management
                </h3>
                <div className="space-y-4">
                  <Card className="border-2 hover:border-primary/50 transition-all duration-200 shadow-md">
                    <CardHeader className="bg-indigo-50 dark:bg-indigo-950/20 pb-3">
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        Add New Student
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3">
                      <Button 
                        variant="default"
                        className="w-full bg-indigo-600 hover:bg-indigo-700"
                        onClick={() => navigateTo("add-student")}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        <span>Add Student</span>
                      </Button>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-2 hover:border-primary/50 transition-all duration-200 shadow-md">
                    <CardHeader className="bg-rose-50 dark:bg-rose-950/20 pb-3">
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        <Trash2 className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                        Manage Students
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3">
                      <Button 
                        variant="default"
                        className="w-full bg-rose-600 hover:bg-rose-700"
                        onClick={() => navigateTo("manage-students")}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        <span>Manage Students</span>
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                  <UserCheck className="h-4 w-4 text-teal-600" />
                  Faculty Management
                </h3>
                <div className="space-y-4">
                  <Card className="border-2 hover:border-primary/50 transition-all duration-200 shadow-md">
                    <CardHeader className="bg-teal-50 dark:bg-teal-950/20 pb-3">
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        <UserCog className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                        Add New Faculty
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3">
                      <Button 
                        variant="default"
                        className="w-full bg-teal-600 hover:bg-teal-700"
                        onClick={() => navigateTo("add-faculty")}
                      >
                        <UserCog className="h-4 w-4 mr-2" />
                        <span>Add Faculty</span>
                      </Button>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-2 hover:border-primary/50 transition-all duration-200 shadow-md">
                    <CardHeader className="bg-orange-50 dark:bg-orange-950/20 pb-3">
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        <UserMinus className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        Manage Faculty
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3">
                      <Button 
                        variant="default"
                        className="w-full bg-orange-600 hover:bg-orange-700"
                        onClick={() => navigateTo("manage-faculty")}
                      >
                        <UserMinus className="h-4 w-4 mr-2" />
                        <span>Manage Faculty</span>
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  Admin Management
                </h3>
                <div className="space-y-4">
                  <Card className="border-2 hover:border-primary/50 transition-all duration-200 shadow-md">
                    <CardHeader className="bg-blue-50 dark:bg-blue-950/20 pb-3">
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        Add New Admin
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3">
                      <Button 
                        variant="default"
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        onClick={() => navigateTo("add-admin")}
                      >
                        <ShieldCheck className="h-4 w-4 mr-2" />
                        <span>Add Admin</span>
                      </Button>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-2 hover:border-primary/50 transition-all duration-200 shadow-md">
                    <CardHeader className="bg-purple-50 dark:bg-purple-950/20 pb-3">
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        <UserMinus className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        Manage Admins
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3">
                      <Button 
                        variant="default"
                        className="w-full bg-purple-600 hover:bg-purple-700"
                        onClick={() => navigateTo("manage-admins")}
                      >
                        <UserMinus className="h-4 w-4 mr-2" />
                        <span>Manage Admins</span>
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="department-management">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-2 hover:border-primary/50 transition-all duration-200 shadow-md">
              <CardHeader className="bg-blue-50 dark:bg-blue-950/20">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Department Dashboard
                </CardTitle>
                <CardDescription>
                  View and manage all academic departments 
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Browse departments, view affiliated users, and update department assignments
                </p>
                <Button 
                  variant="default"
                  className="w-full"
                  onClick={() => navigateTo("departments")}
                >
                  <Users className="h-4 w-4 mr-2" />
                  <span>Department List & Management</span>
                </Button>
              </CardContent>
            </Card>
            
            <Card className="border-2 hover:border-primary/50 transition-all duration-200 shadow-md animate__animated animate__fadeIn">
              <CardHeader className="bg-green-50 dark:bg-green-950/20">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  Add New Department
                </CardTitle>
                <CardDescription>
                  Create a new department for your institution
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Add a new department to the system with a custom name and description
                </p>
                <Button 
                  variant="default"
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => navigateTo("add-group")}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  <span>Create New Department</span>
                </Button>
              </CardContent>
            </Card>
            
            <Card className="border-2 hover:border-primary/50 transition-all duration-200 shadow-md animate__animated animate__fadeInUp">
              <CardHeader className="bg-rose-50 dark:bg-rose-950/20">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  Remove Departments
                </CardTitle>
                <CardDescription>
                  Delete departments and reassign members
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Remove obsolete departments while ensuring all users are properly reassigned
                </p>
                <Button 
                  variant="default"
                  className="w-full bg-rose-600 hover:bg-rose-700"
                  onClick={() => navigateTo("delete-department")}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  <span>Delete Department Tool</span>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="content-management">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-6 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent animate__animated animate__fadeIn">
              <BookOpen className="h-5 w-5 text-purple-600 animate__animated animate__pulse animate__infinite animate__slow" />
              Content Access Management
              <Badge className="ml-2 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 animate__animated animate__bounceIn">
                Learning Center
              </Badge>
            </h2>
            
            <div className="grid grid-cols-1 gap-6">
              <StudentSyncPanel />
              
              <div className="border-t border-dashed border-gray-200 pt-6">
                <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                  <UserCog className="h-4 w-4 text-indigo-600" />
                  Manage Student Content Access
                </h3>
                <ManageStudentAccess />
              </div>
              
              <div className="border-t border-dashed border-gray-200 pt-6">
                <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  Faculty Content Access Management
                </h3>
                <FacultyContentAccessList />
              </div>
              
              <div className="border-t border-dashed border-gray-200 pt-6 animate__animated animate__fadeIn">
                <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                  <BookOpen className="h-4 w-4 text-indigo-600 animate__animated animate__pulse animate__infinite animate__slow" />
                  <span className="bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent font-semibold">
                    Content Sorting into Class Folders
                  </span>
                  <Badge variant="outline" className="ml-2 bg-indigo-100 text-indigo-800 animate__animated animate__bounceIn animate__delay-1s">
                    New Feature
                  </Badge>
                </h3>
                <div className="bg-indigo-50 dark:bg-indigo-950/10 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800 mb-4 animate__animated animate__fadeIn animate__delay-1s">
                  <div className="flex items-center gap-2 text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-2">
                    <Info className="h-4 w-4" />
                    <span>Content Organization</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-0">
                    You can now sort content into class folders for better organization! This helps students and faculty find content more easily by organizing it into subject-specific folders.
                  </p>
                </div>
                {user && <ContentSorter userId={user.id} userRole="admin" />}
              </div>
              
              <div className="border-t border-dashed border-gray-200 pt-6 animate__animated animate__fadeIn">
                <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                  <Book className="h-4 w-4 text-purple-600 animate__animated animate__pulse animate__infinite animate__slow" />
                  <span className="bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent font-semibold">
                    Subject Management & Faculty Assignments
                  </span>
                  <Badge variant="outline" className="ml-2 bg-purple-100 text-purple-800 animate__animated animate__bounceIn animate__delay-1s">
                    New Features
                  </Badge>
                </h3>
                <div className="bg-purple-50 dark:bg-purple-950/10 p-4 rounded-lg border border-purple-100 dark:border-purple-800 mb-4 animate__animated animate__fadeIn animate__delay-1s">
                  <div className="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">
                    <Info className="h-4 w-4" />
                    <span>Subject Assignment Controls</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-0">
                    You can now manage subjects and faculty assignments including creation, deletion, and updates - all in one place! Click on "Faculty Subject Assignments" tab below to see assignment options.
                  </p>
                </div>
                <SubjectFacultyManager />
              </div>
              
              <div className="border-t border-dashed border-gray-200 pt-6 mt-6">
                <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                  <UserPlus className="h-4 w-4 text-teal-600" />
                  Add Faculty for Content Sharing
                </h3>
                <Card className="border-2 hover:border-teal-500 transition-all duration-200 shadow-md">
                  <CardHeader className="bg-teal-50 dark:bg-teal-950/20 pb-3">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <UserPlus className="h-5 w-5 text-teal-600 dark:text-teal-400 animate__animated animate__bounce animate__infinite animate__slower" />
                      Add Faculty for Content Creation
                    </CardTitle>
                    <CardDescription>
                      Add new faculty members who can upload and share content with students
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-3">
                    <Button 
                      variant="default"
                      className="w-full bg-teal-600 hover:bg-teal-700 animate__animated animate__bounceIn"
                      onClick={() => navigateTo("add-faculty")}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      <span>Add Faculty for Content Sharing</span>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="verification">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-2 hover:border-primary/50 transition-all duration-200 shadow-md">
              <CardHeader className="bg-amber-50 dark:bg-amber-950/20">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  Student Verification
                </CardTitle>
                <CardDescription>
                  Review and approve pending student registrations
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Verify student IDs and approve pending student accounts to grant system access
                </p>
                <Button 
                  variant="default"
                  className="w-full bg-amber-600 hover:bg-amber-700"
                  onClick={() => navigateTo("student-approval")}
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  <span>Review Student Applications</span>
                </Button>
              </CardContent>
            </Card>
            
            <Card className="border-2 hover:border-primary/50 transition-all duration-200 shadow-md animate__animated animate__fadeIn">
              <CardHeader className="bg-purple-50 dark:bg-purple-950/20">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  Faculty Verification
                </CardTitle>
                <CardDescription>
                  Approve faculty members waiting for verification
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Verify and approve faculty members who have registered on the platform
                </p>
                <Button 
                  variant="default"
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  onClick={() => navigateTo("faculty")}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  <span>Review Faculty Applications</span>
                </Button>
              </CardContent>
            </Card>
            
            <Card className="border-2 hover:border-primary/50 transition-all duration-200 shadow-md animate__animated animate__fadeIn">
              <CardHeader className="bg-blue-50 dark:bg-blue-950/20">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Admin Verification
                </CardTitle>
                <CardDescription>
                  Approve administrator registration requests
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Review and approve new admin accounts requesting verification
                </p>
                <Button 
                  variant="default"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={() => navigateTo("admin-approval")}
                >
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  <span>Review Admin Requests</span>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="bulk-operations">
          <Card className="border-2 hover:border-primary/50 transition-all duration-200 shadow-md animate__animated animate__fadeIn">
            <CardHeader className="bg-cyan-50 dark:bg-cyan-950/20">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Database className="h-5 w-5 text-cyan-600 dark:text-cyan-400 animate__animated animate__pulse animate__infinite animate__slow" />
                Bulk Student Addition
              </CardTitle>
              <CardDescription>
                Efficiently add multiple students at once via CSV import
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="rounded-md border p-4 mb-4 bg-cyan-50/50 dark:bg-cyan-950/10 animate__animated animate__fadeIn animate__delay-1s">
                <div className="flex items-center gap-2 text-sm font-medium text-cyan-700 dark:text-cyan-300 mb-2">
                  <Database className="h-4 w-4" />
                  Student CSV Bulk Import
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload a CSV file to add or update multiple student records at once
                </p>
                <Button 
                  variant="default"
                  className="w-full bg-cyan-600 hover:bg-cyan-700 animate__animated animate__bounceIn animate__delay-2s"
                  onClick={() => navigateTo("sync-students")}
                >
                  <Database className="h-4 w-4 mr-2" />
                  <span>Bulk Add Students</span>
                </Button>
              </div>
              
              <div className="text-xs text-muted-foreground mt-2 animate__animated animate__fadeIn animate__delay-3s">
                <p className="flex items-center gap-1 mb-1">
                  <Info className="h-3 w-3" /> 
                  CSV file must include student ID, email, and department
                </p>
                <p className="flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Existing students will be updated if they match by email
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="student-approval" className="mt-4">
          <StudentApproval />
        </TabsContent>
        
        <TabsContent value="faculty" className="mt-4">
          {isPendingLoading ? (
            <Card>
              <CardHeader>
                <CardTitle>Faculty Verification</CardTitle>
                <CardDescription>Loading pending faculty members...</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </CardContent>
            </Card>
          ) : pendingError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Failed to load pending faculty members. Please refresh the page.
              </AlertDescription>
            </Alert>
          ) : !pendingFaculty || pendingFaculty.length === 0 ? (
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
            </Card>
          ) : (
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
                  {pendingFaculty.map(faculty => (
                    <div 
                      key={faculty.id}
                      className="p-4 border rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                    >
                      <div>
                        <div className="font-medium">{faculty.email}</div>
                        <div className="text-sm text-gray-500">
                          Faculty ID: <span className="font-mono">{faculty.role_id}</span>
                        </div>
                      </div>
                      
                      <Button
                        onClick={() => handleVerify(faculty.id)}
                        disabled={verifyFacultyMutation.isPending}
                        className={`${bounceActive[faculty.id] ? 'animate__animated animate__bounce' : ''}`}
                      >
                        {verifyFacultyMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <UserCheck className="mr-2 h-4 w-4" />
                            Verify Faculty
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
              
              <CardFooter className="flex justify-between border-t pt-4">
                <div className="text-sm text-gray-500">
                  {pendingFaculty.length} {pendingFaculty.length === 1 ? 'faculty' : 'faculty members'} pending verification
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchPending()}>
                  Refresh
                </Button>
              </CardFooter>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="departments" className="mt-4">
          <DepartmentManagement showAllUsers={true} />
        </TabsContent>
        
        {/* Sync functionality moved to content-management tab */}
        
        <TabsContent value="add-student" className="mt-4">
          <ManualAddStudent />
        </TabsContent>
        
        <TabsContent value="add-faculty" className="mt-4 animate__animated animate__fadeIn animate__faster">
          <ManualAddFaculty />
        </TabsContent>
        
        <TabsContent value="add-group" className="mt-4 animate__animated animate__fadeIn">
          <DepartmentCreation />
        </TabsContent>
        
        <TabsContent value="delete-department" className="mt-4 animate__animated animate__fadeInUp">
          <DepartmentDeletion />
        </TabsContent>
        
        <TabsContent value="manage-students" className="mt-4">
          <DeleteStudent />
        </TabsContent>
        
        <TabsContent value="manage-faculty" className="mt-4 animate__animated animate__fadeIn">
          <FacultyManagement />
        </TabsContent>
        
        <TabsContent value="add-admin" className="mt-4 animate__animated animate__fadeIn">
          <ManualAddAdmin />
        </TabsContent>
        
        <TabsContent value="manage-admins" className="mt-4 animate__animated animate__fadeIn">
          <DeleteAdmin />
        </TabsContent>
        
        <TabsContent value="admin-approval" className="mt-4 animate__animated animate__fadeIn">
          <AdminApproval />
        </TabsContent>
        
        <TabsContent value="subject-assignment" className="mt-4 animate__animated animate__fadeIn">
          <div className="p-2">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-6 bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
              <Book className="h-5 w-5 text-emerald-600 animate__animated animate__pulse animate__infinite animate__slow" />
              Subject Assignment Manager
              <Badge className="ml-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 animate__animated animate__bounceIn">
                Academic Management
              </Badge>
            </h2>
            <SubjectAssignmentManager />
          </div>
        </TabsContent>
        
        <TabsContent value="ai-insights" className="mt-4 animate__animated animate__fadeIn">
          <div className="p-2">
            <AIInsights />
          </div>
        </TabsContent>
        
        <TabsContent value="settings" className="mt-4 animate__animated animate__fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-2 hover:border-primary/50 transition-all duration-200 shadow-md">
              <CardHeader className="bg-blue-50 dark:bg-blue-950/20">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Admin Sign Off
                </CardTitle>
                <CardDescription>
                  Deactivate your admin account
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Complete your work as an administrator by safely signing off from the platform
                </p>
                <div className="bg-blue-50/50 dark:bg-blue-950/10 p-4 rounded-md border border-blue-100 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Admin Information</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-20">Email:</span>
                      <span className="text-xs font-medium">{user?.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-20">Admin ID:</span>
                      <span className="text-xs font-medium">{user?.role_id || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-20">Status:</span>
                      <span className="text-xs font-medium flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="space-y-6">
              <AdminSelfDelete />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}