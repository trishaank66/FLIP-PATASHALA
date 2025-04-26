import React from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/hooks/use-auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRoundPlus, UsersRound, School, BookOpen, Database, Book } from 'lucide-react';
import { Redirect } from 'wouter';
import StudentSyncPanel from '@/components/StudentSyncPanel';

export default function AdminDashboard() {
  const { user, isLoading } = useAuth();

  // Redirect if not admin
  if (!isLoading && (!user || user.role !== 'admin')) {
    return <Redirect to="/auth" />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Admin Dashboard | Active Learn</title>
      </Helmet>
      <div className="container max-w-7xl py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Manage users, content, and system settings
            </p>
          </div>
        </div>

        <Tabs defaultValue="content">
          <TabsList className="mb-6">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <UsersRound className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="content" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Content
            </TabsTrigger>
            <TabsTrigger value="subjects" className="flex items-center gap-2">
              <Book className="h-4 w-4" />
              Subjects
            </TabsTrigger>
            <TabsTrigger value="departments" className="flex items-center gap-2">
              <School className="h-4 w-4" />
              Departments
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              System
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserRoundPlus className="h-5 w-5" />
                    User Management
                  </CardTitle>
                  <CardDescription>
                    Add, edit, or remove users from the system
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p>User management features will be implemented here.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="content">
            <div className="grid gap-6">
              <StudentSyncPanel />
            </div>
          </TabsContent>

          <TabsContent value="subjects">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Book className="h-5 w-5" />
                    Subject & Faculty Management
                  </CardTitle>
                  <CardDescription>
                    Manage subjects and faculty assignments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SubjectFacultyManager />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="departments">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <School className="h-5 w-5" />
                    Department Management
                  </CardTitle>
                  <CardDescription>
                    Manage academic departments and their settings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p>Department management features will be implemented here.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="system">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    System Settings
                  </CardTitle>
                  <CardDescription>
                    Configure system-wide settings and integrations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p>System settings will be implemented here.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}