import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocation } from 'wouter';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  FileUp, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Database,
  Download,
  ArrowLeft
} from 'lucide-react';
import 'animate.css';

interface SyncResult {
  message: string;
  success: number;
  failed: number;
  errors: Array<{ email: string; reason: string }>;
}

export function StudentBulkSync() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [_, navigate] = useLocation();

  // CSV template for download - now formatted to match our Python processor
  const csvTemplate = 'email,student_id,first_name,last_name,department_name\n' +
                     'student1@example.com,ST100001,John,Doe,CSE\n' +
                     'student2@example.com,ST100002,Jane,Smith,IT\n' +
                     'student3@example.com,ST100003,Alex,Johnson,ECE';

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please select a CSV file",
          variant: "destructive",
        });
      }
    }
  };

  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest('POST', '/api/upload-students-csv', formData, {
        isFormData: true
      });
      
      // Simulate progress since we can't track real progress with fetch API
      const simulateProgress = () => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += 5;
          if (progress >= 90) {
            clearInterval(interval);
          }
          setUploadProgress(progress);
        }, 100);
      };
      
      simulateProgress();
      return await response.json() as SyncResult;
    },
    onSuccess: (result) => {
      setSyncResult(result);
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      
      if (result.failed > 0) {
        setShowErrorDialog(true);
      } else {
        toast({
          title: "Students synced successfully",
          description: `${result.success} students were added to the system.`,
          variant: "default",
        });
      }
      
      // Reset file and progress
      setFile(null);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });

  // Handle file upload
  const handleUpload = () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to upload",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    uploadMutation.mutate(formData);
  };

  // Handle drag events
  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle drop event
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please select a CSV file",
          variant: "destructive",
        });
      }
    }
  };

  // Download CSV template
  const downloadTemplate = () => {
    const blob = new Blob([csvTemplate], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast({
      title: "Template downloaded",
      description: "The CSV template has been downloaded.",
      variant: "default",
    });
  };

  // Navigate back to admin dashboard
  const handleBack = () => {
    navigate('/admin');
    console.log("Navigating back to admin dashboard");
  };

  return (
    <div className="w-full max-w-4xl mx-auto animate__animated animate__fadeIn">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        className="mb-4 pl-2 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-blue-600"
        onClick={handleBack}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Admin Dashboard
      </Button>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-center flex items-center justify-center gap-2">
            <Database className="h-5 w-5" />
            Student Bulk Synchronization
          </CardTitle>
          <CardDescription className="text-center">
            Upload a CSV file to add multiple students at once.
            <span className="block mt-1 text-xs text-muted-foreground">
              Advanced data validation and processing
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* File upload area */}
          <div 
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${dragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/30'}
              ${file ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              className="hidden"
            />
            
            <div className="flex flex-col items-center justify-center gap-2">
              <FileUp className={`h-12 w-12 ${file ? 'text-green-500' : 'text-muted-foreground'}`} />
              
              {file ? (
                <div className="animate__animated animate__fadeIn">
                  <p className="text-lg font-medium">Selected file:</p>
                  <p className="text-primary font-semibold break-all max-w-md mx-auto">{file.name}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {(file.size / 1024).toFixed(2)} KB • Click to change
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-lg">Drag and drop your CSV file here, or click to browse</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Only CSV files are accepted
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar (visible during upload) */}
          {uploadMutation.isPending && (
            <div className="mt-6 animate__animated animate__fadeIn">
              <p className="text-center mb-2">
                {uploadProgress < 30 ? (
                  "Uploading CSV file..."
                ) : uploadProgress < 60 ? (
                  "Validating data format and structure..."
                ) : (
                  "Processing and syncing with database..."
                )}
              </p>
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-center mt-1 text-muted-foreground">
                Analyzing data for errors before processing
              </p>
            </div>
          )}

          {/* Summary (visible after successful upload) */}
          {syncResult && !uploadMutation.isPending && (
            <div className="mt-6 p-4 bg-muted rounded-lg animate__animated animate__fadeIn">
              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Sync Summary
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-lg">
                  <p className="text-green-700 dark:text-green-300 font-medium">Successful</p>
                  <p className="text-2xl font-bold">{syncResult.success}</p>
                </div>
                <div className="bg-red-100 dark:bg-red-900/20 p-3 rounded-lg">
                  <p className="text-red-700 dark:text-red-300 font-medium">Failed</p>
                  <p className="text-2xl font-bold">{syncResult.failed}</p>
                </div>
              </div>
              {syncResult.failed > 0 && (
                <Button 
                  variant="outline" 
                  className="mt-3 w-full"
                  onClick={() => setShowErrorDialog(true)}
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  View Error Details
                </Button>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={downloadTemplate} 
            variant="outline" 
            className="w-full sm:w-auto"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!file || uploadMutation.isPending}
            className="w-full sm:w-auto"
          >
            {uploadMutation.isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Processing...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Sync Students
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Error details dialog */}
      <AlertDialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Sync Errors
            </AlertDialogTitle>
            <AlertDialogDescription>
              The following errors occurred during student synchronization:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="bg-muted p-2 rounded-lg max-h-[50vh] overflow-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider">Email</th>
                    <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {syncResult?.errors.map((error, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-background/50' : ''}>
                      <td className="py-2 px-3 text-sm">{error.email}</td>
                      <td className="py-2 px-3 text-sm">{error.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction onClick={() => setShowErrorDialog(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}