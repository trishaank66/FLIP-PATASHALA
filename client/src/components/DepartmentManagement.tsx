import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getQueryFn, apiRequest } from '@/lib/queryClient';
import { Department, User } from '@shared/schema';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, BookOpen, UserMinus, Users } from 'lucide-react';
import { PageLayout } from '@/components/ui/page-layout';
import { useLocation, Link } from 'wouter';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface DepartmentManagementProps {
  userId?: number;
  showAllUsers?: boolean;
}

export function DepartmentManagement({ userId, showAllUsers = true }: DepartmentManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const userIdFromUrl = urlParams.get('user') ? parseInt(urlParams.get('user')!, 10) : undefined;
  
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>(userIdFromUrl || userId);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");

  // Fetch departments
  const { 
    data: departments, 
    isLoading: isLoadingDepartments 
  } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  // Fetch all users
  const {
    data: users,
    isLoading: isLoadingUsers
  } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  // Fetch users without department
  const {
    data: usersWithoutDept,
    isLoading: isLoadingUsersWithoutDept,
    refetch: refetchUsersWithoutDept
  } = useQuery<User[]>({
    queryKey: ['/api/users-without-department'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  // Update user department mutation
  const updateDepartmentMutation = useMutation({
    mutationFn: async ({ userId, departmentId }: { userId: number, departmentId: number | null }) => {
      const res = await apiRequest(
        'PATCH', 
        `/api/user/${userId}/department`, 
        { department_id: departmentId }
      );
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Department updated",
        description: "User's department has been updated successfully",
      });
      
      // Invalidate user queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user-with-department'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users-without-department'] });
      
      // Reset selection
      setSelectedDepartmentId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating department",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpdateDepartment = () => {
    if (!selectedUserId) {
      toast({
        title: "No user selected",
        description: "Please select a user to update their department",
        variant: "destructive",
      });
      return;
    }

    const departmentId = selectedDepartmentId === "null" 
      ? null 
      : selectedDepartmentId 
        ? parseInt(selectedDepartmentId, 10) 
        : null;
    
    // Find the selected user
    const selectedUser = users?.find(user => user.id === selectedUserId);
    
    // Check if user already has the same department
    if (selectedUser && selectedUser.department_id === departmentId) {
      toast({
        title: "No change needed",
        description: `User is already assigned to this department`,
        variant: "default",
      });
      return;
    }
    
    // Find department name for better messaging
    const departmentName = departmentId 
      ? departments?.find(d => d.id === departmentId)?.name || "Unknown" 
      : "No Department";

    updateDepartmentMutation.mutate({ 
      userId: selectedUserId, 
      departmentId 
    });
  };

  // If userId is provided, use it as the selected user
  useEffect(() => {
    if (userId) {
      setSelectedUserId(userId);
    }
  }, [userId]);

  if (isLoadingDepartments) {
    return (
      <PageLayout
        title="Department Management"
        description="Loading department information..."
        titleIcon={<BookOpen className="h-6 w-6 text-blue-600" />}
        showBackButton={true}
        showHomeButton={true}
        showAdminButton={true}
        backgroundColor="bg-blue-50/30 border-blue-100/50"
      >
        <Card className="w-full">
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
              <span className="text-lg">Loading departments...</span>
            </div>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Department Management"
      description="Assign departments to users within FLIP Patashala"
      titleIcon={<BookOpen className="h-6 w-6 text-blue-600" />}
      showBackButton={true}
      showHomeButton={true}
      showAdminButton={true}
      backgroundColor="bg-blue-50/30 border-blue-100/50"
      backTo="/admin/departments"
    >
      <Card className="w-full mb-6">
        <CardHeader>
          <CardTitle className="text-blue-700 text-xl">Department Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="all" className="text-sm">
                <span className="flex items-center">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Department Assignment
                </span>
              </TabsTrigger>
              <TabsTrigger value="nodept" className="text-sm">
                <span className="flex items-center">
                  <UserMinus className="h-4 w-4 mr-2" />
                  Students Without Department
                  {usersWithoutDept && usersWithoutDept.length > 0 && (
                    <Badge variant="destructive" className="ml-2 text-xs">
                      {usersWithoutDept.length}
                    </Badge>
                  )}
                </span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="space-y-4">
              {showAllUsers && (
                <div className="mt-0 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-base font-semibold text-blue-800">Select User</label>
                    <span className="text-xs bg-blue-50 px-3 py-1 rounded-full text-blue-600 border border-blue-100">
                      Total: {users?.length || 0}
                    </span>
                  </div>
                  {isLoadingUsers ? (
                    <div className="flex items-center p-3 bg-gray-50 rounded-md">
                      <Loader2 className="h-4 w-4 animate-spin mr-2 text-blue-600" />
                      <span>Loading users...</span>
                    </div>
                  ) : (
                    <Select
                      value={selectedUserId?.toString() || ""}
                      onValueChange={(value) => setSelectedUserId(parseInt(value, 10))}
                    >
                      <SelectTrigger className="h-12 bg-gray-50 border-2 border-blue-200 focus:ring-blue-500">
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users?.map((user) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.email} ({user.role}) - ID: {user.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="mt-2 px-1 flex justify-end">
                    <span className="text-xs text-blue-600">Click to select a user</span>
                  </div>
                </div>
              )}

              <div className="mt-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-base font-semibold text-blue-800">Select Department</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-50 px-3 py-1 rounded-full text-blue-600 border border-blue-100">
                      Total: {departments?.length || 0}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-9 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-800 border-blue-200 px-3"
                      onClick={() => {
                        toast({
                          title: "All Available Departments",
                          description: (
                            <div className="space-y-2 mt-2 max-h-[300px] overflow-y-auto pr-1">
                              <div className="font-semibold border-b pb-2 mb-2 text-blue-700">Department Directory</div>
                              {departments?.map((dept) => (
                                <div key={dept.id} className="flex items-center justify-between p-2 rounded bg-blue-50/50 mb-1 border border-blue-100">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-blue-800">{dept.name}</span>
                                    {dept.description && (
                                      <span className="text-xs text-muted-foreground">{dept.description}</span>
                                    )}
                                  </div>
                                  <span className="text-xs bg-blue-100 px-2 py-1 rounded-full">ID: {dept.id}</span>
                                </div>
                              ))}
                            </div>
                          ),
                          duration: 15000,
                        });
                      }}
                    >
                      View All Departments
                    </Button>
                  </div>
                </div>
                <Select
                  value={selectedDepartmentId || ""}
                  onValueChange={setSelectedDepartmentId}
                >
                  <SelectTrigger className="h-12 bg-gray-50 border-2 border-blue-200 focus:ring-blue-500">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">
                      None (Clear Department)
                    </SelectItem>
                    {departments?.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id.toString()}>
                        {dept.name} - {dept.description || 'No description'} (ID: {dept.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-2 px-1 flex justify-end">
                  <span className="text-xs text-blue-600">Click to select a department</span>
                </div>
              </div>

              <div className="mt-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="mb-2">
                  <h3 className="text-center font-semibold text-blue-800">Update Department Assignment</h3>
                  <p className="text-center text-xs text-gray-500 mt-1">Click the button below to save your department assignment changes</p>
                </div>
                <Button
                  onClick={handleUpdateDepartment}
                  disabled={updateDepartmentMutation.isPending || !selectedUserId || selectedDepartmentId === null}
                  className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white h-14 text-lg font-semibold"
                >
                  {updateDepartmentMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Updating Department Assignment...
                    </>
                  ) : (
                    <>
                      Update Department Assignment
                    </>
                  )}
                </Button>
                {!selectedUserId ? (
                  <p className="text-center text-xs text-amber-600 mt-2">Please select a user first</p>
                ) : selectedDepartmentId === null ? (
                  <p className="text-center text-xs text-amber-600 mt-2">Please select a department</p>
                ) : (
                  <p className="text-center text-xs text-green-600 mt-2">Ready to update</p>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="nodept">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-blue-800">Students Without Department</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchUsersWithoutDept()}
                    className="bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200"
                  >
                    <Loader2 className={`h-4 w-4 mr-2 ${isLoadingUsersWithoutDept ? 'animate-spin' : ''}`} />
                    Refresh List
                  </Button>
                </div>
                
                {isLoadingUsersWithoutDept ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600 mr-3" />
                    <span>Loading students without department...</span>
                  </div>
                ) : !usersWithoutDept || usersWithoutDept.length === 0 ? (
                  <Alert className="mb-4 bg-green-50 border-green-200">
                    <AlertTitle className="text-green-800 flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      All Students Have Departments
                    </AlertTitle>
                    <AlertDescription className="text-green-700">
                      Great! All students are assigned to departments. This helps to organize educational content efficiently.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <Alert className="mb-4 bg-amber-50 border-amber-200">
                      <AlertTitle className="text-amber-800 flex items-center">
                        <UserMinus className="h-4 w-4 mr-2" />
                        Students Without Department Access
                      </AlertTitle>
                      <AlertDescription className="text-amber-700">
                        The following students don't have a department assigned. They will have limited access to educational content.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-blue-50 hover:bg-blue-100/70">
                            <TableHead className="font-semibold">System ID</TableHead>
                            <TableHead className="font-semibold">User ID</TableHead>
                            <TableHead className="font-semibold">User</TableHead>
                            <TableHead className="font-semibold">Role</TableHead>
                            <TableHead className="font-semibold">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {usersWithoutDept.map((user) => (
                            <TableRow key={user.id} className="hover:bg-blue-50/50">
                              <TableCell>{user.id}</TableCell>
                              <TableCell>{user.role_id || 'N/A'}</TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium text-blue-800">{user.email}</span>
                                  <span className="text-xs text-gray-500">
                                    {user.first_name && user.last_name 
                                      ? `${user.first_name} ${user.last_name}`
                                      : 'No name provided'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={`${
                                  user.role === 'admin' 
                                    ? 'bg-purple-100 text-purple-800 hover:bg-purple-200' 
                                    : user.role === 'faculty'
                                      ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                      : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                                }`}>
                                  {user.role}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                                  onClick={() => {
                                    setSelectedUserId(user.id);
                                    setActiveTab("all");
                                  }}
                                >
                                  Assign Department
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </PageLayout>
  );
}