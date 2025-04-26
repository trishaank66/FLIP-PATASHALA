import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUsers, faUserEdit, faTimesCircle, faCheckCircle, faClock, 
  faSearch, faFilter, faInfoCircle, faUserPlus 
} from '@fortawesome/free-solid-svg-icons';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import 'animate.css';

type Department = {
  id: number;
  name: string;
}

type FacultyWithAccess = {
  id: number;
  email: string;
  role_id: string;
  first_name: string | null;
  last_name: string | null;
  department_id: number | null;
  department_name: string | null;
  content_permission: 'granted' | 'revoked' | 'pending';
  content_upload_count?: number;
  last_upload_date?: string;
}

export function FacultyContentAccessList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyWithAccess | null>(null);
  const [showDialogType, setShowDialogType] = useState<'grant' | 'revoke' | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [activeTab, setActiveTab] = useState<string>('pending');
  const [showInactiveFaculty, setShowInactiveFaculty] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch faculty content access list
  const { data: facultyList = [], isLoading } = useQuery<FacultyWithAccess[]>({
    queryKey: ['/api/admin/faculty-content-access'],
    retry: 1,
  });

  // Fetch departments for filter
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['/api/admin/departments'],
    retry: 1,
  });

  // Handle status update (grant/revoke)
  const updateStatusMutation = useMutation({
    mutationFn: async (data: { 
      facultyId: number; 
      action: 'grant' | 'revoke'; 
      notes: string;
    }) => {
      const response = await apiRequest(
        'POST', 
        `/api/admin/faculty-content-access/${data.action}`, 
        { 
          facultyId: data.facultyId,
          notes: data.notes
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${data.action} content access`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Reset state and invalidate queries
      setSelectedFaculty(null);
      setShowDialogType(null);
      setAdminNotes('');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/faculty-content-access'] });
      
      toast({
        title: "Permission updated",
        description: "Faculty content access has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const handleSubmit = () => {
    if (!selectedFaculty || !showDialogType) return;
    
    updateStatusMutation.mutate({
      facultyId: selectedFaculty.id,
      action: showDialogType,
      notes: adminNotes.trim(),
    });
  };

  // Format date for better display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Filter faculty based on search, department, and status
  const filteredFaculty = facultyList.filter(faculty => {
    const matchesSearch = 
      searchQuery === '' || 
      faculty.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (faculty.first_name && faculty.first_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (faculty.last_name && faculty.last_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      faculty.role_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDepartment = 
      selectedDepartment === 'all' || 
      faculty.department_id === parseInt(selectedDepartment);
    
    const matchesStatus = 
      statusFilter === 'all' || 
      faculty.content_permission === statusFilter;
    
    // Filter by tab selection
    const matchesTab = 
      (activeTab === 'pending' && faculty.content_permission === 'pending') ||
      (activeTab === 'granted' && faculty.content_permission === 'granted') ||
      (activeTab === 'revoked' && faculty.content_permission === 'revoked') ||
      (activeTab === 'all');
    
    return matchesSearch && matchesDepartment && matchesStatus && matchesTab;
  });

  // Status badge renderer
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'granted':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
            <FontAwesomeIcon icon={faCheckCircle} className="mr-1" /> Approved
          </Badge>
        );
      case 'revoked':
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-200">
            <FontAwesomeIcon icon={faTimesCircle} className="mr-1" /> Revoked
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 animate__animated animate__pulse animate__infinite animate__slower">
            <FontAwesomeIcon icon={faClock} className="mr-1" /> Pending
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">Unknown</Badge>
        );
    }
  };

  return (
    <div className="animate__animated animate__fadeIn">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold mb-2 flex items-center">
            <FontAwesomeIcon icon={faUsers} className="mr-3 text-primary" />
            Faculty Content Access
          </CardTitle>
          <CardDescription>
            Manage faculty permissions for content creation and sharing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="pending" className="relative">
                  Pending
                  {facultyList.filter(f => f.content_permission === 'pending').length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate__animated animate__heartBeat animate__infinite">
                      {facultyList.filter(f => f.content_permission === 'pending').length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="granted">Approved</TabsTrigger>
                <TabsTrigger value="revoked">Revoked</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Search by name, email or faculty ID..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="w-full md:w-64">
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <span className="flex items-center">
                    <FontAwesomeIcon icon={faFilter} className="mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Filter by department" />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch 
                id="show-inactive" 
                checked={showInactiveFaculty} 
                onCheckedChange={setShowInactiveFaculty} 
              />
              <Label htmlFor="show-inactive" className="cursor-pointer">Show Inactive</Label>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : filteredFaculty.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FontAwesomeIcon icon={faInfoCircle} className="text-3xl mb-2" />
              <p>No faculty found with the current filters</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableCaption>Faculty content management permissions</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Faculty ID</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFaculty.map((faculty) => (
                    <TableRow key={faculty.id} className="animate__animated animate__fadeIn">
                      <TableCell className="font-medium">
                        {faculty.first_name && faculty.last_name 
                          ? `${faculty.first_name} ${faculty.last_name}`
                          : faculty.email}
                        <div className="text-xs text-muted-foreground">{faculty.email}</div>
                      </TableCell>
                      <TableCell>{faculty.role_id}</TableCell>
                      <TableCell>{faculty.department_name || 'Not assigned'}</TableCell>
                      <TableCell>{renderStatusBadge(faculty.content_permission)}</TableCell>
                      <TableCell className="text-right">
                        {faculty.content_permission === 'pending' && (
                          <div className="flex justify-end space-x-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="text-green-600 border-green-200 hover:bg-green-50 animate__animated animate__bounceIn"
                                  onClick={() => {
                                    setSelectedFaculty(faculty);
                                    setShowDialogType('grant');
                                    setAdminNotes('');
                                  }}
                                >
                                  <FontAwesomeIcon icon={faCheckCircle} className="mr-1" />
                                  <span className="hidden md:inline">Approve</span>
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Approve Content Permission</DialogTitle>
                                  <DialogDescription>
                                    You are about to grant content permission to {faculty.first_name || faculty.email}.
                                    This will allow them to upload and manage content across departments.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="admin-notes">Admin Notes (Optional)</Label>
                                    <Textarea 
                                      id="admin-notes" 
                                      placeholder="Add notes about why this permission is being granted..."
                                      value={adminNotes}
                                      onChange={(e) => setAdminNotes(e.target.value)}
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button 
                                    type="submit" 
                                    onClick={handleSubmit} 
                                    disabled={updateStatusMutation.isPending}
                                  >
                                    {updateStatusMutation.isPending ? 'Processing...' : 'Approve Permission'}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="text-red-600 border-red-200 hover:bg-red-50 animate__animated animate__bounceIn animate__delay-1s"
                                  onClick={() => {
                                    setSelectedFaculty(faculty);
                                    setShowDialogType('revoke');
                                    setAdminNotes('');
                                  }}
                                >
                                  <FontAwesomeIcon icon={faTimesCircle} className="mr-1" />
                                  <span className="hidden md:inline">Deny</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Deny Content Permission</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    You are about to deny content permission for {faculty.first_name || faculty.email}.
                                    They will not be able to upload or manage content across departments.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="deny-reason">Reason for Denial (Optional)</Label>
                                    <Textarea 
                                      id="deny-reason" 
                                      placeholder="Provide a reason for denying this permission request..."
                                      value={adminNotes}
                                      onChange={(e) => setAdminNotes(e.target.value)}
                                    />
                                  </div>
                                </div>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={handleSubmit}
                                    disabled={updateStatusMutation.isPending}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    {updateStatusMutation.isPending ? 'Processing...' : 'Deny Permission'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}

                        {faculty.content_permission === 'granted' && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => {
                                  setSelectedFaculty(faculty);
                                  setShowDialogType('revoke');
                                  setAdminNotes('');
                                }}
                              >
                                <FontAwesomeIcon icon={faTimesCircle} className="mr-1" />
                                <span className="hidden md:inline">Revoke</span>
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Revoke Content Permission</DialogTitle>
                                <DialogDescription>
                                  You are about to revoke content permission from {faculty.first_name || faculty.email}.
                                  They will no longer be able to upload and manage content across departments.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="revoke-reason">Reason for Revocation (Optional)</Label>
                                  <Textarea 
                                    id="revoke-reason" 
                                    placeholder="Provide a reason for revoking this permission..."
                                    value={adminNotes}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button 
                                  type="submit" 
                                  onClick={handleSubmit} 
                                  disabled={updateStatusMutation.isPending}
                                  variant="destructive"
                                >
                                  {updateStatusMutation.isPending ? 'Processing...' : 'Revoke Permission'}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}

                        {faculty.content_permission === 'revoked' && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-green-600 border-green-200 hover:bg-green-50"
                                onClick={() => {
                                  setSelectedFaculty(faculty);
                                  setShowDialogType('grant');
                                  setAdminNotes('');
                                }}
                              >
                                <FontAwesomeIcon icon={faCheckCircle} className="mr-1" />
                                <span className="hidden md:inline">Grant</span>
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Grant Content Permission</DialogTitle>
                                <DialogDescription>
                                  You are about to grant content permission to {faculty.first_name || faculty.email}.
                                  This will allow them to upload and manage content across departments.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="grant-reason">Admin Notes (Optional)</Label>
                                  <Textarea 
                                    id="grant-reason" 
                                    placeholder="Add notes about why this permission is being granted..."
                                    value={adminNotes}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button 
                                  type="submit" 
                                  onClick={handleSubmit} 
                                  disabled={updateStatusMutation.isPending}
                                >
                                  {updateStatusMutation.isPending ? 'Processing...' : 'Grant Permission'}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-start space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center">
            <FontAwesomeIcon icon={faInfoCircle} className="mr-2 text-primary/70" />
            <span>
              Approved faculty can upload and manage content across all departments.
            </span>
          </div>
          <div>
            <span className="text-xs">
              Content permissions are audited and logged for security purposes.
            </span>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}