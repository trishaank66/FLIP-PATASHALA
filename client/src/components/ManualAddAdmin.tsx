import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle, UserPlus, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Link } from 'wouter';
import { PageLayout } from '@/components/ui/page-layout';
import 'animate.css';

// Form schema with validation
const AdminFormSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  first_name: z.string().min(1, { message: "First name is required" }),
  last_name: z.string().min(1, { message: "Last name is required" }),
  role_id: z.string().optional(),
});

type AdminFormValues = z.infer<typeof AdminFormSchema>;

export function ManualAddAdmin() {
  const { toast } = useToast();
  const [success, setSuccess] = useState(false);

  // Form initialization
  const form = useForm<AdminFormValues>({
    resolver: zodResolver(AdminFormSchema),
    defaultValues: {
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      role_id: '',
    },
  });

  // Create new admin mutation
  const createAdminMutation = useMutation({
    mutationFn: async (values: AdminFormValues) => {
      const formValues = {
        ...values,
        role: 'admin',
        // Admin accounts are immediately verified
        verification_pending: false,
      };
      const res = await apiRequest('POST', '/api/register', formValues);
      return res.json();
    },
    onSuccess: () => {
      setSuccess(true);
      toast({
        title: "Admin Created",
        description: "New admin account has been created successfully!",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/admins'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (values: AdminFormValues) => {
    createAdminMutation.mutate(values);
  };

  return (
    <PageLayout
      title="Add New Admin"
      description="Create a new administrator account"
      titleIcon={<UserPlus className="h-6 w-6 text-blue-600" />}
      showBackButton={true}
      showHomeButton={true}
      showAdminButton={true}
      backTo="/"
      backgroundColor="bg-blue-50/30 border-blue-100/50"
    >
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-blue-600" />
            Create Administrator Account
          </CardTitle>
          <CardDescription>
            Add a new admin account with full system access
          </CardDescription>
        </CardHeader>

        <CardContent>
          {success && (
            <Alert className="mb-6 bg-green-50 border-green-200 animate__animated animate__fadeIn">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Admin Created Successfully</AlertTitle>
              <AlertDescription className="text-green-700">
                The new admin account has been created and can now log in immediately.
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="First name" 
                          {...field} 
                          autoComplete="given-name"
                        />
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
                        <Input 
                          placeholder="Last name" 
                          {...field} 
                          autoComplete="family-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="admin@college.edu" 
                        {...field} 
                        autoComplete="email"
                      />
                    </FormControl>
                    <FormDescription>
                      This will be the admin's login username
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
                      <Input 
                        placeholder="Password" 
                        type="password" 
                        {...field} 
                        autoComplete="new-password"
                      />
                    </FormControl>
                    <FormDescription>
                      Must be at least 6 characters long
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin ID (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Admin ID (e.g., A001)" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Optional identifier for this admin within the system
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full" 
                disabled={createAdminMutation.isPending}
              >
                {createAdminMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create Admin Account
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>

        <CardFooter className="flex justify-between border-t pt-4">
          <Link to="/admin">
            <Button variant="outline" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </PageLayout>
  );
}