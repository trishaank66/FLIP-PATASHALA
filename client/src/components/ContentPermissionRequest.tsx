import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faTimesCircle, faClock, faLock, faUnlock, faInfoCircle, faUserShield } from '@fortawesome/free-solid-svg-icons';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';
import 'animate.css';

// Define the schema for content permission request form
const contentPermissionSchema = z.object({
  reason: z.string()
    .min(10, { message: 'Reason must be at least 10 characters' })
    .max(500, { message: 'Reason must not exceed 500 characters' }),
});

type ContentPermissionFormData = z.infer<typeof contentPermissionSchema>;

// Define access status type
type AccessStatus = {
  status: 'granted' | 'revoked' | 'pending' | 'none';
  requested_at?: string;
  reviewed_at?: string;
  reviewed_by?: string;
};

export function ContentPermissionRequest() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [requestEnabled, setRequestEnabled] = useState(true);

  // Create form
  const form = useForm<ContentPermissionFormData>({
    resolver: zodResolver(contentPermissionSchema),
    defaultValues: {
      reason: '',
    },
  });

  // Fetch current content permission status
  const { data: accessStatus, isLoading: statusLoading } = useQuery<AccessStatus>({
    queryKey: ['/api/faculty/content-permission-status'],
    enabled: !!user,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Update request enabled based on access status
  useEffect(() => {
    if (accessStatus) {
      setRequestEnabled(accessStatus.status === 'none' || accessStatus.status === 'revoked');
    }
  }, [accessStatus]);

  // Handle permission request submission
  const permissionRequestMutation = useMutation({
    mutationFn: async (data: ContentPermissionFormData) => {
      const response = await apiRequest('POST', '/api/faculty/request-content-permission', data);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit permission request');
      }
      
      return response.json();
    },
    onSuccess: () => {
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/faculty/content-permission-status'] });
      toast({
        title: 'Request submitted',
        description: 'Your content permission request has been sent to admins for review.',
      });
      setRequestEnabled(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Request failed',
        description: error.message || 'Failed to submit permission request',
        variant: 'destructive',
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: ContentPermissionFormData) => {
    permissionRequestMutation.mutate(data);
  };

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Render status badge based on access status
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'granted':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-200 animate__animated animate__fadeIn">
            <FontAwesomeIcon icon={faCheckCircle} className="mr-1" /> Approved
          </Badge>
        );
      case 'revoked':
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-200 animate__animated animate__fadeIn">
            <FontAwesomeIcon icon={faTimesCircle} className="mr-1" /> Revoked
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 animate__animated animate__pulse animate__infinite">
            <FontAwesomeIcon icon={faClock} className="mr-1" /> Pending
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200">
            <FontAwesomeIcon icon={faLock} className="mr-1" /> No Access
          </Badge>
        );
    }
  };

  return (
    <div className="animate__animated animate__fadeIn">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold mb-2 flex items-center">
                <FontAwesomeIcon icon={faUserShield} className="mr-3 text-primary" />
                Content Permission Request
              </CardTitle>
              <CardDescription>
                Request access to upload and manage content across departments
              </CardDescription>
            </div>
            {accessStatus && (
              <div className="flex items-center">
                <span className="mr-2 text-sm text-muted-foreground">Status:</span>
                {renderStatusBadge(accessStatus.status)}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <>
              {accessStatus?.status === 'granted' && (
                <Alert className="mb-6 bg-green-50 border-green-200 text-green-800">
                  <FontAwesomeIcon icon={faUnlock} className="h-4 w-4 mr-2" />
                  <AlertTitle>Access Granted</AlertTitle>
                  <AlertDescription>
                    You have been granted permission to upload and manage content across departments.
                    {accessStatus.reviewed_at && (
                      <div className="text-sm mt-2">
                        <span className="font-medium">Approved on:</span> {formatDate(accessStatus.reviewed_at)}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {accessStatus?.status === 'pending' && (
                <Alert className="mb-6 bg-yellow-50 border-yellow-200 text-yellow-800">
                  <FontAwesomeIcon icon={faClock} className="h-4 w-4 mr-2" />
                  <AlertTitle>Request Pending</AlertTitle>
                  <AlertDescription>
                    Your content permission request is currently under review by administrators.
                    {accessStatus.requested_at && (
                      <div className="text-sm mt-2">
                        <span className="font-medium">Requested on:</span> {formatDate(accessStatus.requested_at)}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {accessStatus?.status === 'revoked' && (
                <Alert className="mb-6 bg-red-50 border-red-200 text-red-800">
                  <FontAwesomeIcon icon={faLock} className="h-4 w-4 mr-2" />
                  <AlertTitle>Access Revoked</AlertTitle>
                  <AlertDescription>
                    Your content permission has been revoked. You may submit a new request.
                    {accessStatus.reviewed_at && (
                      <div className="text-sm mt-2">
                        <span className="font-medium">Revoked on:</span> {formatDate(accessStatus.reviewed_at)}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="mb-6 animate__animated animate__fadeIn animate__delay-1s">
                <h3 className="text-lg font-medium mb-2">Content Permission Benefits</h3>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  <li className="animate__animated animate__fadeInLeft animate__delay-1s">Upload and manage content across all departments</li>
                  <li className="animate__animated animate__fadeInLeft animate__delay-2s">Collaborate with faculty from different disciplines</li>
                  <li className="animate__animated animate__fadeInLeft animate__delay-3s">Create interdisciplinary learning materials</li>
                  <li className="animate__animated animate__fadeInLeft animate__delay-4s">Access analytics across various departments</li>
                </ul>
              </div>

              {requestEnabled && (
                <>
                  <Separator className="my-6" />
                  
                  <div className="mb-4 animate__animated animate__fadeIn animate__delay-2s">
                    <h3 className="text-lg font-medium mb-2 animate__animated animate__headShake">Submit New Request</h3>
                    <p className="text-muted-foreground mb-4 animate__animated animate__fadeIn animate__delay-3s">
                      Please explain why you need access to content management across departments. 
                      Your request will be reviewed by an administrator.
                    </p>
                    
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="reason"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Reason for Request <span className="text-red-500">*</span></FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Explain why you need content management permissions"
                                  className="min-h-[120px]" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                Be specific about your educational goals and how this access will benefit students
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="flex justify-end">
                          <Button 
                            type="submit" 
                            disabled={permissionRequestMutation.isPending}
                            className={`animate__animated ${permissionRequestMutation.isPending ? 'animate__pulse animate__infinite' : 'animate__bounceIn animate__delay-4s'}`}
                          >
                            {permissionRequestMutation.isPending ? (
                              <span className="flex items-center">
                                <span className="animate-spin mr-2">⟳</span> Submitting...
                              </span>
                            ) : (
                              <span className="flex items-center">
                                <FontAwesomeIcon icon={faUserShield} className="mr-2 animate__animated animate__tada animate__infinite animate__slower" />
                                Submit Request
                              </span>
                            )}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-start">
          <div className="w-full animate__animated animate__fadeIn animate__delay-5s">
            <div className="flex items-center text-sm text-muted-foreground mb-2">
              <FontAwesomeIcon icon={faInfoCircle} className="mr-2 text-primary/70 animate__animated animate__pulse animate__infinite animate__slower" />
              <span>
                Note: Requests are typically reviewed within 1-2 business days.
              </span>
            </div>
            <div className="text-xs text-muted-foreground animate__animated animate__fadeIn animate__delay-6s">
              By requesting permission, you agree to follow the institution's content guidelines.
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}