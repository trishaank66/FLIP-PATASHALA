import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Department } from '@shared/schema';
import 'animate.css';

// UI Components
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Loader2, ArrowLeft, BookOpen, Upload } from 'lucide-react';
import { Link } from 'wouter';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Define schema for manual faculty addition
const manualAddFacultySchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters'),
  department_id: z
    .string()
    .min(1, 'Department is required'),
  first_name: z
    .string()
    .optional(),
  last_name: z
    .string()
    .optional(),
});

type ManualAddFacultyFormData = z.infer<typeof manualAddFacultySchema>;

export function ManualAddFaculty() {
  const { toast } = useToast();
  const [isButtonBouncing, setIsButtonBouncing] = useState(false);

  // Fetch departments for dropdown
  const { data: departments, isLoading: isDepartmentsLoading } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
    refetchOnWindowFocus: false,
  });

  // Form definition
  const form = useForm<ManualAddFacultyFormData>({
    resolver: zodResolver(manualAddFacultySchema),
    defaultValues: {
      email: '',
      password: '',
      department_id: '',
      first_name: '',
      last_name: '',
    },
  });

  // Add faculty mutation
  const addFacultyMutation = useMutation({
    mutationFn: async (data: ManualAddFacultyFormData) => {
      const response = await apiRequest('POST', '/api/manual-add-faculty', data);
      return await response.json();
    },
    onSuccess: (data) => {
      // Invalidate the users query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pending-faculty'] });

      toast({
        title: 'Success!',
        description: `Faculty ${data.email} was added successfully.`,
        variant: 'default',
      });

      // Reset the form
      form.reset({
        email: '',
        password: '',
        department_id: '',
        first_name: '',
        last_name: '',
      });

      // Animate the button
      setIsButtonBouncing(true);
      setTimeout(() => setIsButtonBouncing(false), 1000);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to add faculty: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Submit handler
  const onSubmit = (data: ManualAddFacultyFormData) => {
    addFacultyMutation.mutate(data);
  };

  const isLoading = form.formState.isSubmitting || addFacultyMutation.isPending;

  return (
    <Card className="w-full shadow-md max-w-3xl mx-auto animate__animated animate__fadeInUp animate__faster">
      <CardHeader className="bg-teal-50 border-b space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Link to="/admin">
              <Button variant="ghost" size="icon" className="mr-2 animate__animated animate__pulse animate__infinite animate__slower">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <CardTitle className="text-xl font-bold text-teal-800 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-teal-600 animate__animated animate__bounce animate__slow" />
              <span className="animate__animated animate__fadeIn animate__delay-1s">Add Faculty for Content Sharing</span>
            </CardTitle>
          </div>
        </div>
        <CardDescription className="text-teal-700 animate__animated animate__fadeIn animate__delay-1s">
          Add new faculty members who can upload and share content with students
        </CardDescription>
      </CardHeader>
      
      <div className="px-6 pt-4">
        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
          <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-700 dark:text-blue-300">Content Management Feature</AlertTitle>
          <AlertDescription className="text-blue-600 dark:text-blue-400">
            Faculty members added here will be able to upload and share educational content with students in their department.
          </AlertDescription>
        </Alert>
      </div>
      
      <CardContent className="pt-6 pb-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="faculty@college.edu" {...field} className="border-teal-200 focus-visible:ring-teal-500" />
                    </FormControl>
                    <FormDescription>
                      Faculty institutional email address
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Initial password" {...field} className="border-teal-200 focus-visible:ring-teal-500" />
                    </FormControl>
                    <FormDescription>
                      Temporary password for first login
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="First name" {...field} className="border-teal-200 focus-visible:ring-teal-500" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Last name" {...field} className="border-teal-200 focus-visible:ring-teal-500" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="department_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select
                      disabled={isDepartmentsLoading}
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="border-teal-200 focus-visible:ring-teal-500">
                          <SelectValue placeholder="Select a department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments?.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id.toString()}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Department where faculty will upload content
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="col-span-1 md:col-span-2 rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                  <Upload className="h-4 w-4" />
                  Content Upload Permissions
                </div>
                <p className="text-sm text-green-600 dark:text-green-400">
                  Faculty will be able to upload videos, lecture notes, presentations, and other educational content for students in their department.
                </p>
              </div>
            </div>

            <div className="text-center mt-6">
              <Button 
                type="submit" 
                disabled={isLoading}
                className={`w-full md:w-auto bg-teal-600 hover:bg-teal-700 ${isButtonBouncing ? 'animate__animated animate__bounce' : ''}`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Faculty for Content
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-center bg-teal-50 border-t">
        <div className="max-w-md text-center space-y-2">
          <p className="text-xs text-teal-700">
            Faculty added here will be automatically verified and can immediately log in to upload content.
          </p>
          <p className="text-xs text-teal-700">
            All content uploads will be tracked and visible to students in the faculty member's department.
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}