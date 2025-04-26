import React from 'react';
import { PageLayout } from '@/components/ui/page-layout';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import StableContentViewer from '@/components/StableContentViewer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBookOpen, faUserGraduate, faBuilding } from '@fortawesome/free-solid-svg-icons';

// Define the Department type
type Department = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
};

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = React.useState('myDepartment');

  // Fetch user with department
  const { data: userWithDept, isLoading: isUserLoading } = useQuery({
    queryKey: ['/api/user-with-department'],
    queryFn: async () => {
      const response = await fetch('/api/user-with-department');
      if (!response.ok) {
        throw new Error('Failed to fetch user with department');
      }
      return response.json();
    },
    enabled: !!user
  });

  // Fetch all departments
  const { data: departments, isLoading: isDeptLoading } = useQuery({
    queryKey: ['/api/departments'],
    queryFn: async () => {
      const response = await fetch('/api/departments');
      if (!response.ok) {
        throw new Error('Failed to fetch departments');
      }
      return response.json() as Promise<Department[]>;
    },
    enabled: !!user
  });

  if (isUserLoading || isDeptLoading) {
    return (
      <PageLayout 
        title="Learning Dashboard" 
        showBackButton={true} 
        showHomeButton={false}
        backTo="/home"
        backgroundColor="bg-blue-50/20"
      >
        <div className="space-y-4 mt-6 p-6">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout 
      title={`${userWithDept?.department?.name || ''} Learning Dashboard`}
      showBackButton={true}
      showHomeButton={false}
      backTo="/home"
      backgroundColor="bg-blue-50/20"
    >
      <div className="p-6">
        <div className="animate__animated animate__fadeIn">
          <h1 className="text-3xl font-bold mb-6">
            <FontAwesomeIcon icon={faBookOpen} className="mr-2 text-primary" />
            Your Learning Dashboard
          </h1>

          {!userWithDept?.department && (
            <Alert className="mb-6">
              <AlertTitle>No Department Assigned</AlertTitle>
              <AlertDescription>
                You haven't been assigned to a department yet. Please contact an administrator 
                for assistance. Without a department assignment, you won't be able to access 
                educational content specific to your program.
              </AlertDescription>
            </Alert>
          )}

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FontAwesomeIcon icon={faUserGraduate} className="mr-2 text-primary" />
                Student Profile
              </CardTitle>
              <CardDescription>Your academic information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium">Name</h3>
                  <p>{userWithDept?.first_name} {userWithDept?.last_name}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Email</h3>
                  <p>{userWithDept?.email}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Student ID</h3>
                  <p>{userWithDept?.role_id || 'Not assigned'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Department</h3>
                  <p>{userWithDept?.department?.name || 'Not assigned'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <h2 className="text-2xl font-bold mb-4 flex items-center">
            <FontAwesomeIcon icon={faBuilding} className="mr-2 text-primary" />
            Content Library
          </h2>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-6">
            <TabsList className="mb-4">
              {userWithDept?.department && (
                <TabsTrigger value="myDepartment">My Department</TabsTrigger>
              )}
              {user?.role === 'admin' && (
                <TabsTrigger value="allContent">All Content</TabsTrigger>
              )}
              {user?.role === 'admin' && departments && departments.map(dept => (
                <TabsTrigger key={dept.id} value={`dept-${dept.id}`}>
                  {dept.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {userWithDept?.department && (
              <TabsContent value="myDepartment">
                <StableContentViewer departmentId={userWithDept.department.id} />
              </TabsContent>
            )}
            
            {user?.role === 'admin' && (
              <TabsContent value="allContent">
                <StableContentViewer />
              </TabsContent>
            )}
            
            {user?.role === 'admin' && departments && departments.map(dept => (
              <TabsContent key={dept.id} value={`dept-${dept.id}`}>
                <StableContentViewer departmentId={dept.id} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </PageLayout>
  );
};

export default StudentDashboard;