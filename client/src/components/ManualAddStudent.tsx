import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Department } from '@shared/schema';
import 'animate.css';
import { useLocation } from 'wouter';

// UI Components
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Loader2, ArrowLeft } from 'lucide-react';

// Define schema for manual student addition
const manualAddStudentSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters'),
  student_id: z
    .string()
    .min(1, 'Student ID is required'),
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

type ManualAddStudentFormData = z.infer<typeof manualAddStudentSchema>;

export function ManualAddStudent() {
  const { toast } = useToast();
  const [isButtonBouncing, setIsButtonBouncing] = useState(false);
  const [, navigate] = useLocation();

  // Fetch departments for dropdown
  const { data: departments, isLoading: isDepartmentsLoading } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
    refetchOnWindowFocus: false,
  });

  // Form definition
  const form = useForm<ManualAddStudentFormData>({
    resolver: zodResolver(manualAddStudentSchema),
    defaultValues: {
      email: '',
      password: '',
      student_id: '',
      department_id: '',
      first_name: '',
      last_name: '',
    },
  });

  // Add student mutation
  const addStudentMutation = useMutation({
    mutationFn: async (data: ManualAddStudentFormData) => {
      const response = await apiRequest('POST', '/api/manual-add-student', data);
      return await response.json();
    },
    onSuccess: (data) => {
      // Invalidate the users query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });

      toast({
        title: 'Success!',
        description: `Student ${data.email} was added successfully.`,
        variant: 'default',
      });

      // Reset the form
      form.reset({
        email: '',
        password: '',
        student_id: '',
        department_id: '',
        first_name: '',
        last_name: '',
      });

      // Trigger bounce animation
      setIsButtonBouncing(true);
      setTimeout(() => setIsButtonBouncing(false), 1000);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error adding student',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: ManualAddStudentFormData) => {
    addStudentMutation.mutate(data);
  };

  // Loading states
  const isLoading = isDepartmentsLoading || addStudentMutation.isPending;

  return (
    <div className="w-full max-w-4xl mx-auto animate__animated animate__fadeIn">
      {/* Back button at the top of the page */}
      <Button 
        variant="outline" 
        className="mb-4"
        onClick={() => navigate('/admin')}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Admin Dashboard
      </Button>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-center flex items-center justify-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Student Manually
          </CardTitle>
          <CardDescription className="text-center">
            Add a single student to the system with verification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Email field */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email*</FormLabel>
                      <FormControl>
                        <Input placeholder="student@example.com" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Password field */}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password*</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Student ID field */}
                <FormField
                  control={form.control}
                  name="student_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Student ID*</FormLabel>
                      <FormControl>
                        <Input placeholder="ST100001" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormDescription>
                        ID must exist in the student database for verification.
                        Try using IDs like ST100001-ST100010 (case-sensitive).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Department dropdown */}
                <FormField
                  control={form.control}
                  name="department_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department*</FormLabel>
                      <Select 
                        disabled={isLoading}
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* First Name field */}
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Last Name field */}
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="text-center mt-6">
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className={`w-full md:w-auto ${isButtonBouncing ? 'animate__animated animate__bounce' : ''}`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Student
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-xs text-muted-foreground max-w-md text-center">
            Students added manually will be pre-verified if their ID exists in the database.
            They can immediately log in with the provided credentials.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}