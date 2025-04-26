import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Building2, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { insertDepartmentSchema, type Department } from '@shared/schema';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PageLayout } from '@/components/ui/page-layout';
import 'animate.css';

export function DepartmentCreation() {
  const { toast } = useToast();
  const [showAnimation, setShowAnimation] = useState(false);
  const [createdDepartment, setCreatedDepartment] = useState<Department | null>(null);

  const form = useForm({
    resolver: zodResolver(insertDepartmentSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      try {
        const res = await apiRequest('POST', '/api/add-department', data);
        
        // Handle non-OK responses
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ message: 'Invalid response format' }));
          throw new Error(errorData.message || 'Failed to create department');
        }
        
        // Parse JSON response safely
        const responseText = await res.text();
        return JSON.parse(responseText);
      } catch (error) {
        if (error instanceof SyntaxError) {
          // Handle JSON parsing errors
          console.error('Invalid JSON response:', error);
          throw new Error('Server returned an invalid response format');
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      // Reset form and show success state
      form.reset();
      setCreatedDepartment(data.department);
      
      // Show success toast
      toast({
        title: "Success",
        description: "Department created successfully!",
        variant: "default"
      });
      
      // Refresh departments list
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
    },
    onError: (error: Error) => {
      // Show error toast
      toast({
        title: "Error",
        description: error.message || "Failed to create department",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: { name: string; description: string }) => {
    // Trigger animation
    setShowAnimation(true);
    
    // Submit after animation delay
    setTimeout(() => {
      createDepartmentMutation.mutate(data);
      setShowAnimation(false);
    }, 800); // Delay to allow animation to complete
  };

  const handleCreateNewDepartment = () => {
    setCreatedDepartment(null);
  };

  const renderDepartmentForm = () => (
    <Card>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., AI Group, Cloud Computing, Data Science" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Provide a brief description of this department" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button 
              type="submit" 
              disabled={createDepartmentMutation.isPending}
              className={`w-full ${showAnimation ? 'animate__animated animate__lightSpeedIn' : ''}`}
            >
              {createDepartmentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Department...
                </>
              ) : (
                <>
                  <Building2 className="mr-2 h-4 w-4" />
                  Create Department
                </>
              )}
            </Button>
          </form>
        </Form>
        
        <div className="text-sm text-muted-foreground mt-6 pt-4 border-t">
          Departments help organize users in FLIP Patashala.
        </div>
      </CardContent>
    </Card>
  );
  
  const renderSuccessCard = () => (
    <Card>
      <CardContent>
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Success!</AlertTitle>
          <AlertDescription>
            <strong>{createdDepartment?.name}</strong> has been added to your department list.
            {createdDepartment?.description && (
              <p className="mt-2 text-sm opacity-80">{createdDepartment.description}</p>
            )}
          </AlertDescription>
        </Alert>
        
        <Button 
          onClick={handleCreateNewDepartment}
          className="w-full mt-6 animate__animated animate__lightSpeedIn"
        >
          <Building2 className="mr-2 h-4 w-4" />
          Create Another Department
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <PageLayout 
      title={createdDepartment ? "Department Created Successfully" : "Add New Department"}
      description={createdDepartment 
        ? "You've added a new department to FLIP Patashala" 
        : "Create a new department to organize students and faculty"
      }
      titleIcon={createdDepartment 
        ? <CheckCircle2 className="h-6 w-6 text-green-600 animate__animated animate__bounceIn" /> 
        : <Building2 className={`h-6 w-6 text-green-600 ${showAnimation ? 'animate__animated animate__lightSpeedIn' : ''}`} />
      }
      showBackButton={true}
      showHomeButton={true}
      showAdminButton={true}
      backTo="/admin/departments"
      backgroundColor={createdDepartment ? "bg-green-50/50 border-green-100" : "bg-green-50/30 border-green-100/50"}
    >
      {createdDepartment ? renderSuccessCard() : renderDepartmentForm()}
    </PageLayout>
  );
}