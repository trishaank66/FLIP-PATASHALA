import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import { Loader2, FileUp, Database, RefreshCw } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Type definitions for the sync results
interface StudentSyncResult {
  success: boolean;
  synced_students: Array<{
    email: string;
    student_id: string;
    department_name: string;
    subjects_faculty: string;
  }>;
  errors: Array<{
    email: string;
    reason: string;
  }>;
  summary: {
    total: number;
    synced: number;
    error: number;
    by_department: Record<string, { count: number }>;
  };
  message?: string;
  error?: string;
}

export default function StudentSyncPanel() {
  const [csvContent, setCsvContent] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('database');
  const [syncResult, setSyncResult] = useState<StudentSyncResult | null>(null);
  const { toast } = useToast();

  // Mutation for syncing content access
  const syncMutation = useMutation({
    mutationFn: async (syncData: { source: string; csvContent?: string }) => {
      const response = await apiRequest('POST', '/api/sync-content-access', syncData);
      return response.json();
    },
    onSuccess: (data: StudentSyncResult) => {
      setSyncResult(data);
      if (data.success) {
        toast({
          title: 'Content Access Sync Successful',
          description: `Synced ${data.summary.synced} student(s) across ${Object.keys(data.summary.by_department).length} department(s).`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Content Access Sync Failed',
          description: data.message || 'Failed to sync student content access',
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync Error',
        description: `Error syncing student content access: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Handle the sync action
  const handleSync = () => {
    if (activeTab === 'database') {
      // Sync from existing database students
      syncMutation.mutate({ source: 'database' });
    } else if (activeTab === 'csv' && csvContent.trim()) {
      // Sync from CSV content
      syncMutation.mutate({ source: 'file', csvContent });
    } else {
      toast({
        title: 'Missing Data',
        description: 'Please provide CSV content or select database sync',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Student Content Access Sync
        </CardTitle>
        <CardDescription>
          Synchronize students for content access based on their departments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="database" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Database
            </TabsTrigger>
            <TabsTrigger value="csv" className="flex items-center gap-2">
              <FileUp className="h-4 w-4" />
              CSV Upload
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="database">
            <div className="p-4 bg-muted/40 rounded-md">
              <p className="mb-2 text-sm">
                This option will sync all verified students from the database with their respective departments
                for content access.
              </p>
              <p className="text-sm text-muted-foreground">
                Only students with verified status and assigned to departments will be processed.
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="csv">
            <div className="space-y-4">
              <div className="p-4 bg-muted/40 rounded-md mb-2">
                <p className="text-sm">
                  Paste CSV content with the following headers:
                </p>
                <code className="text-xs block mt-1 p-2 bg-muted rounded">
                  email,student_id,department_name,first_name,last_name
                </code>
              </div>
              <Textarea
                placeholder="Paste CSV content here..."
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Results display */}
        {syncResult && (
          <div className="mt-4 border rounded-md p-4">
            <h3 className="font-medium mb-2">Sync Results</h3>
            
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-muted/30 p-3 rounded-md">
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold">{syncResult.summary.total}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-md">
                <p className="text-sm text-green-700">Synced Successfully</p>
                <p className="text-2xl font-bold text-green-700">{syncResult.summary.synced}</p>
              </div>
              <div className="bg-red-100 p-3 rounded-md">
                <p className="text-sm text-red-700">Errors</p>
                <p className="text-2xl font-bold text-red-700">{syncResult.summary.error}</p>
              </div>
            </div>
            
            {/* Department breakdown */}
            {Object.keys(syncResult.summary.by_department).length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Departments</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(syncResult.summary.by_department).map(([dept, data]) => (
                    <div key={dept} className="bg-muted/20 p-2 rounded-md">
                      <p className="text-sm font-medium">{dept}</p>
                      <p className="text-sm text-muted-foreground">{data.count} student(s)</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Errors display */}
            {syncResult.errors.length > 0 && (
              <div className="mt-4">
                <Alert variant="destructive">
                  <AlertTitle>Sync Errors</AlertTitle>
                  <AlertDescription>
                    <p className="mb-2">The following errors occurred during sync:</p>
                    <ul className="list-disc pl-5 text-sm space-y-1 max-h-[200px] overflow-y-auto">
                      {syncResult.errors.map((err, i) => (
                        <li key={i}>
                          <span className="font-medium">{err.email || 'N/A'}:</span> {err.reason}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline" onClick={() => setSyncResult(null)} disabled={syncMutation.isPending || !syncResult}>
          Clear Results
        </Button>
        <Button onClick={handleSync} disabled={syncMutation.isPending} className="relative">
          {syncMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-pulse" />
              Sync Content Access
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}