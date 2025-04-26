import React, { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { PageLayout } from '@/components/ui/page-layout';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudUploadAlt, faFileAlt, faFilePdf, faFileVideo, faTrash, faCheck, faChartBar, faTags } from '@fortawesome/free-solid-svg-icons';
import { Redirect, Link } from 'wouter';
import StableContentViewer from '@/components/StableContentViewer';
import ContentAnalyticsPanel from '@/components/ContentAnalyticsPanel';
import TagInput from '@/components/TagInput';
import { ContentTagsDisplay } from '@/components/ContentTagsDisplay';
import { TagAnalyticsDisplay } from '@/components/TagAnalytics';
import { ContentPermissionRequest } from '@/components/ContentPermissionRequest';
import ContentSorter from '@/components/ContentSorter';
import 'animate.css';

// File type validation
const ACCEPTED_FILE_TYPES = {
  'video/mp4': ['.mp4'],
  'application/pdf': ['.pdf'],
  'application/vnd.ms-powerpoint': ['.ppt', '.pptx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx']
};

const FILE_TYPE_ICONS = {
  'video/mp4': faFileVideo,
  'application/pdf': faFilePdf,
  'application/vnd.ms-powerpoint': faFileAlt,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': faFileAlt,
};

const getFileTypeDisplayName = (type: string) => {
  if (type.includes('video')) return 'Video';
  if (type.includes('pdf')) return 'Lecture Handout';
  if (type.includes('powerpoint') || type.includes('presentation')) return 'Presentation';
  return 'Document';
};

const FacultyContentPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('upload');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isAnalyticsPanelOpen, setIsAnalyticsPanelOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject: '',
    tags: [] as string[],
  });

  // Fetch subjects for the faculty
  const { data: subjects = [], isLoading: subjectsLoading } = useQuery<string[]>({
    queryKey: ['/api/faculty/subjects'],
    enabled: !!user && user.role === 'faculty',
    retry: 1,
    queryFn: async () => {
      const response = await fetch('/api/faculty/subjects', {
        credentials: 'include' // Important: include credentials for session cookie
      });
      if (!response.ok) throw new Error('Failed to fetch subjects');
      return response.json();
    },
    onSuccess: (data) => {
      if (!data || data.length === 0) {
        toast({
          title: "No subjects found",
          description: "Using default subjects. Contact admin if this persists.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Failed to load subjects",
        description: "Using default subjects. Try refreshing the page.",
        variant: "destructive",
      });
    }
  });
  
  // Fallback subjects if API fails
  const fallbackSubjects = [
    "Computer Science",
    "Data Structures",
    "Algorithms",
    "Database Systems",
    "Computer Networks"
  ];

  // Redirect non-faculty users
  if (user && user.role !== 'faculty') {
    return <Redirect to="/home" />;
  }

  // Dropzone setup with validation
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles?.length > 0) {
      const file = acceptedFiles[0];
      setFile(file);
      
      // Create preview for images and set icon for documents
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setFilePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
      
      // Extract title from filename
      const fileName = file.name.split('.').slice(0, -1).join('.');
      setFormData(prev => ({
        ...prev, 
        title: fileName.charAt(0).toUpperCase() + fileName.slice(1).replace(/_/g, ' ')
      }));

      toast({
        title: "File selected",
        description: `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
      });
    }
  }, [toast]);

  const { 
    getRootProps, 
    getInputProps, 
    isDragActive,
    isDragAccept,
    isDragReject
  } = useDropzone({ 
    onDrop, 
    accept: ACCEPTED_FILE_TYPES,
    maxSize: 50 * 1024 * 1024, // 50MB limit
    maxFiles: 1
  });

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.title || !formData.subject) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    // Create form data for file upload
    const uploadData = new FormData();
    uploadData.append('file', file);
    uploadData.append('title', formData.title);
    uploadData.append('description', formData.description || '');
    uploadData.append('subject', formData.subject);
    
    // Add tags to form data
    if (formData.tags && formData.tags.length > 0) {
      // Send tags as a JSON string array
      uploadData.append('tags', JSON.stringify(formData.tags));
    }
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + (100 - prev) * 0.1;
          return newProgress > 95 ? 95 : newProgress;
        });
      }, 300);
      
      // Send the file to the server
      const response = await fetch('/api/upload-content', {
        method: 'POST',
        body: uploadData,
        credentials: 'include' // Important: include credentials for session cookie
      });
      
      clearInterval(progressInterval);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload content');
      }
      
      setUploadProgress(100);
      
      const result = await response.json();
      
      toast({
        title: "Upload successful!",
        description: `${formData.title} has been uploaded successfully.`,
        variant: "default",
      });
      
      // Reset form after successful upload
      setFile(null);
      setFilePreview(null);
      setFormData({
        title: '',
        description: '',
        subject: '',
        tags: [],
      });
      
      // Switch to My Content tab
      setTimeout(() => setActiveTab('my-content'), 1000);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // Handle form changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle tag changes
  const handleTagsChange = (tags: string[]) => {
    setFormData(prev => ({ ...prev, tags }));
  };

  // Cancel upload
  const handleCancel = () => {
    setFile(null);
    setFilePreview(null);
    setFormData({
      title: '',
      description: '',
      subject: '',
      tags: [],
    });
    toast({
      title: "Upload cancelled",
      description: "Your file selection has been cleared",
    });
  };

  return (
    <PageLayout title="Faculty Content Management">
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6 flex items-center">
          <FontAwesomeIcon icon={faCloudUploadAlt} className="mr-3 text-primary" />
          Faculty Content Management
        </h1>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="upload">Upload Content</TabsTrigger>
            <TabsTrigger value="my-content">My Content</TabsTrigger>
            <TabsTrigger value="sort-content" className="animate__animated animate__fadeIn">Sort Content</TabsTrigger>
            <TabsTrigger value="permission" className="animate__animated animate__fadeIn">Request Permission</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Upload Learning Material</CardTitle>
                  <CardDescription>
                    Upload videos, lecture notes (PDF), or presentations (PPT/PPTX) for your students
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Dropzone */}
                    <div 
                      {...getRootProps()} 
                      className={`
                        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                        transition-all duration-200 animate__animated animate__pulse animate__infinite animate__slower
                        ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}
                        ${isDragAccept ? 'border-green-500 bg-green-50' : ''}
                        ${isDragReject ? 'border-red-500 bg-red-50' : ''}
                        ${file ? 'border-green-500 bg-green-50 animate__animated animate__none' : ''}
                      `}
                    >
                      <input {...getInputProps()} />
                      
                      {file ? (
                        <div className="flex flex-col items-center">
                          <div className="mb-3 text-green-600 bg-green-100 p-3 rounded-full">
                            <FontAwesomeIcon icon={FILE_TYPE_ICONS[file.type as keyof typeof FILE_TYPE_ICONS] || faFileAlt} className="text-3xl" />
                          </div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {getFileTypeDisplayName(file.type)} • {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            className="mt-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancel();
                            }}
                          >
                            <FontAwesomeIcon icon={faTrash} className="mr-2" />
                            Remove file
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <div className="mb-3 text-primary/70 bg-primary/10 p-5 rounded-full">
                            <FontAwesomeIcon icon={faCloudUploadAlt} className="text-4xl" />
                          </div>
                          <p className="font-medium">Drag & drop your file here</p>
                          <p className="text-sm text-muted-foreground mb-3">
                            or click to browse (max 50MB)
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Supported formats: MP4, PDF, PPT, PPTX
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
                        <Input 
                          id="title" 
                          name="title" 
                          value={formData.title} 
                          onChange={handleChange} 
                          placeholder="Enter a title for this content"
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea 
                          id="description" 
                          name="description" 
                          value={formData.description} 
                          onChange={handleChange} 
                          placeholder="Optional description of this learning material"
                          className="min-h-[100px]"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="subject">Subject <span className="text-red-500">*</span></Label>
                        <Select 
                          value={formData.subject}
                          onValueChange={(value) => handleSelectChange('subject', value)}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a subject" />
                          </SelectTrigger>
                          <SelectContent>
                            {subjectsLoading ? (
                              <SelectItem value="loading" disabled>Loading subjects...</SelectItem>
                            ) : subjects && subjects.length > 0 ? (
                              subjects.map((subject: string) => (
                                <SelectItem key={subject} value={subject}>
                                  {subject}
                                </SelectItem>
                              ))
                            ) : (
                              /* Use fallback subjects if API failed */
                              fallbackSubjects.map((subject) => (
                                <SelectItem key={subject} value={subject}>
                                  {subject}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label 
                          htmlFor="tags" 
                          className="flex items-center gap-2 mb-1"
                        >
                          <FontAwesomeIcon icon={faTags} className="text-primary/70" />
                          Tags
                        </Label>
                        <TagInput
                          tags={formData.tags}
                          onChange={handleTagsChange}
                          title={formData.title}
                          description={formData.description}
                          subject={formData.subject}
                          fileType={file?.type || ""}
                          filename={file?.name || ""}
                          placeholder="Add tags to help others find your content"
                        />
                      </div>
                    </div>
                    
                    {uploading && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Uploading...</span>
                          <span>{Math.round(uploadProgress)}%</span>
                        </div>
                        <Progress value={uploadProgress} className="h-2" />
                      </div>
                    )}
                  </form>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleCancel}
                    disabled={!file || uploading}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    onClick={handleSubmit} 
                    disabled={!file || uploading || !formData.title || !formData.subject}
                    className={uploading ? "" : "animate__animated animate__pulse"}
                  >
                    {uploading ? (
                      <span className="flex items-center">
                        <span className="animate-spin mr-2">⟳</span> Uploading...
                      </span>
                    ) : uploadProgress === 100 ? (
                      <span className="flex items-center">
                        <FontAwesomeIcon icon={faCheck} className="mr-2" /> Uploaded
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <FontAwesomeIcon icon={faCloudUploadAlt} className="mr-2" /> Upload Content
                      </span>
                    )}
                  </Button>
                </CardFooter>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Upload Guidelines</CardTitle>
                  <CardDescription>Tips for successful content uploads</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-medium">File Types</h3>
                    <ul className="list-disc pl-5 text-sm space-y-1 text-muted-foreground">
                      <li>Videos: MP4 format</li>
                      <li>Lecture Notes: PDF format</li>
                      <li>Presentations: PPT or PPTX format</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-medium">Size Limits</h3>
                    <p className="text-sm text-muted-foreground">
                      Maximum file size is 50MB. For larger videos, consider splitting into parts or optimizing the file.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-medium">Visibility</h3>
                    <p className="text-sm text-muted-foreground">
                      Uploaded content will be visible to all students in your department, organized by subject.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-medium">Best Practices</h3>
                    <ul className="list-disc pl-5 text-sm space-y-1 text-muted-foreground">
                      <li>Use clear, descriptive titles</li>
                      <li>Add descriptions to help students understand the content</li>
                      <li>Ensure content is appropriate and relevant to the subject</li>
                      <li>Make sure videos are properly encoded and can be played in a browser</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="my-content">
            <div className="mb-4 flex justify-end">
              <Link to="/faculty/analytics">
                <Button 
                  variant="outline" 
                  className="flex items-center gap-2 animate__animated animate__fadeIn"
                >
                  <FontAwesomeIcon icon={faChartBar} className="text-blue-500" />
                  <span>View Analytics</span>
                </Button>
              </Link>
            </div>
            <StableContentViewer />
          </TabsContent>
          
          <TabsContent value="sort-content" className="animate__animated animate__fadeIn">
            <div className="mb-6">
              {user && <ContentSorter userId={user.id} userRole="faculty" />}
            </div>
          </TabsContent>
          
          <TabsContent value="permission" className="animate__animated animate__fadeIn">
            <div className="mb-6">
              <ContentPermissionRequest />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
};

export default FacultyContentPage;