import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVideo, faBook, faFileAlt, faDownload, faEye, faChevronLeft, faPlay, faPencilAlt, faTrash, faUndo, faImage, faHeart } from '@fortawesome/free-solid-svg-icons';
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import SimpleContentPlayer from './SimpleContentPlayer';
import 'animate.css';

// UI imports for the edit modal
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// UI imports for the delete alert dialog
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
         AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, 
         AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Define the content item type
type Content = {
  id: number;
  title: string;
  description: string | null;
  subject: string;
  faculty: string | null;
  type: string;
  filename: string;
  url: string;
  preview_url: string | null;
  views: number;
  downloads: number;
  likes_percent: number; // Added for engagement hints
  uploaded_by: number | null;
  created_at: string;
  dept_id: number | null;
  updated_at: string;
  department?: {
    id: number;
    name: string;
    description: string | null;
    created_at: string;
  } | null;
  uploader?: {
    id: number;
    email: string;
    first_name: string | null;
    last_name: string | null;
    role: string;
  } | null;
  tags?: string[]; // Added tags field
};

interface ContentViewerProps {
  departmentId?: number;
}

// Helper functions outside of the component to avoid hook-related issues
const getContentIcon = (type: string) => {
  const normalizedType = type.toLowerCase();
  // Focus only on three content types as requested
  switch (normalizedType) {
    case 'video':
      return faVideo;
    case 'notes':
    case 'lecture':
    case 'pdf':  // PDF files treated as lecture handouts
      return faBook;
    case 'slides':
    case 'presentation':
    case 'ppt':
    case 'pptx':
      return faFileAlt;
    default:
      // Default to one of our three main categories based on extension
      const fileExtension = normalizedType.split('.').pop()?.toLowerCase();
      if (fileExtension === 'pdf') return faBook;
      if (fileExtension === 'pptx' || fileExtension === 'ppt') return faFileAlt;
      if (fileExtension === 'mp4' || fileExtension === 'webm') return faVideo;

      // If we can't determine, use a generic icon
      return faFileAlt;
  }
};

// Map database content types to UI display types - focusing on only 3 content types
const getFriendlyContentType = (type: string): string => {
  const normalizedType = type.toLowerCase();

  // Map to our three main content types
  if (normalizedType === 'video') return 'Video';
  if (normalizedType === 'notes' || normalizedType === 'pdf') return 'Lecture Handout';
  if (normalizedType === 'slideshow' || normalizedType === 'ppt') return 'Presentation';

  // If the string contains these terms, map accordingly
  if (normalizedType.includes('video')) return 'Video';
  if (normalizedType.includes('note') || normalizedType.includes('pdf') || 
      normalizedType.includes('doc') || normalizedType.includes('lecture')) return 'Lecture Handout';
  if (normalizedType.includes('slide') || normalizedType.includes('presentation') || 
      normalizedType.includes('ppt')) return 'Presentation';

  // Check file extension as last resort
  const fileExtension = normalizedType.split('.').pop()?.toLowerCase();
  if (fileExtension === 'mp4' || fileExtension === 'webm') return 'Video';
  if (fileExtension === 'pdf' || fileExtension === 'doc' || fileExtension === 'docx') return 'Lecture Handout';
  if (fileExtension === 'ppt' || fileExtension === 'pptx') return 'Presentation';

  // Return generic type if we can't map it
  return 'Other';
};

// Get engagement hint based on likes percentage
const getEngagementHint = (likesPercent: number): string => {
  if (likesPercent >= 80) {
    return "Highly recommended by students!";
  } else if (likesPercent >= 60) {
    return "Very popular among students!";
  } else if (likesPercent >= 40) {
    return "Students find this helpful!";
  } else if (likesPercent >= 20) {
    return "Worth checking out!";
  } else {
    return "Recently added";
  }
};

// Content viewer component with delete functionality
const StableContentViewer: React.FC<ContentViewerProps> = ({ departmentId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // All state declarations first to maintain consistent hook order
  const [activeTab, setActiveTab] = useState('all');
  const [activeSubject, setActiveSubject] = useState('all');
  const [activeFaculty, setActiveFaculty] = useState('all');
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<Content | null>(null);
  const [contentToDelete, setContentToDelete] = useState<Content | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  // Get faculty name for filtering
  const facultyName = user?.role === 'faculty' 
    ? (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.email.split('@')[0])
    : null;

  // For student users, always fetch their department info
  const { data: userWithDept } = useQuery({
    queryKey: ['/api/user-with-department'],
    queryFn: async () => {
      const response = await fetch('/api/user-with-department');
      if (!response.ok) throw new Error('Failed to fetch user with department');
      return response.json();
    },
    enabled: !!user
  });

  // Determine API endpoint based on user role
  let apiEndpoint = '/api/content';
  if (user?.role === 'faculty' && user.id) {
    apiEndpoint = `/api/content/faculty/${user.id}`;
  } else if (departmentId) {
    apiEndpoint = `/api/content/department/${departmentId}`;
  }

  // Fetch content
  const { data: contentItems, isLoading, error } = useQuery({
    queryKey: [apiEndpoint],
    queryFn: async () => {
      const response = await fetch(apiEndpoint);
      if (!response.ok) throw new Error('Failed to fetch content');
      return response.json() as Promise<Content[]>;
    },
    enabled: !!user
  });

  // Delete content mutation
  const deleteContentMutation = useMutation({
    mutationFn: async (contentId: number) => {
      const response = await apiRequest('DELETE', `/api/content/${contentId}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to delete content');
      }
      return contentId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });

      // Show success toast with undo button
      if (contentToDelete) {
        toast({
          title: "Content Deleted",
          description: (
            <div className="flex flex-col">
              <span>{contentToDelete.title} has been deleted</span>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 self-start animate__animated animate__fadeIn"
                onClick={() => handleUndoDelete(contentToDelete.id)}
              >
                <FontAwesomeIcon icon={faUndo} className="mr-2" />
                Undo (5 min window)
              </Button>
            </div>
          ),
          duration: 10000, // 10 seconds to give time to see the undo button
        });
      }

      setContentToDelete(null);
      setIsAlertOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
      setContentToDelete(null);
      setIsAlertOpen(false);
    }
  });

  // Undo delete mutation
  const undoDeleteMutation = useMutation({
    mutationFn: async (contentId: number) => {
      const response = await apiRequest('PUT', `/api/content/${contentId}/undo-delete`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to restore content');
      }
      return contentId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      toast({
        title: "Content Restored",
        description: "The content has been successfully restored.",
        className: "bg-green-50 border-green-200",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Restore Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Generate preview mutation
  const generatePreviewMutation = useMutation({
    mutationFn: async (contentId: number) => {
      const response = await apiRequest('POST', `/api/content/${contentId}/generate-preview`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to generate preview');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      toast({
        title: "Preview Generated",
        description: "The preview has been successfully generated.",
        className: "bg-green-50 border-green-200",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Preview Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // For faculty users, enforce filtering by their name
  if (user?.role === 'faculty' && facultyName && activeFaculty !== facultyName) {
    setTimeout(() => setActiveFaculty(facultyName), 0);
  }

  // Handle delete content
  const handleDeleteClick = (content: Content) => {
    setContentToDelete(content);
    setIsAlertOpen(true);
  };

  // Handle confirm delete
  const handleConfirmDelete = () => {
    if (contentToDelete) {
      deleteContentMutation.mutate(contentToDelete.id);
    }
  };

  // Handle undo delete
  const handleUndoDelete = (contentId: number) => {
    undoDeleteMutation.mutate(contentId);
  };

  // Handle generate preview
  const generatePreview = (contentId: number) => {
    generatePreviewMutation.mutate(contentId);
  };

  // Helper function to handle download
  const handleDownload = (item: Content) => {
    toast({
      title: "Download Started",
      description: `Downloading ${item.filename}...`,
      className: "bg-green-50 border-green-200",
    });

    const downloadLink = document.createElement('a');
    downloadLink.href = `/api/content/${item.id}/download`;
    downloadLink.download = item.filename;
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();

    setTimeout(() => {
      document.body.removeChild(downloadLink);
      setTimeout(() => {
        toast({
          title: "Download Complete",
          description: `${item.filename} has been downloaded successfully.`,
          className: "bg-green-50 border-green-200",
        });
      }, 1500);
    }, 100);
  };

  // Helper function to handle watch click
  const handleWatchClick = (item: Content) => {
    setSelectedContent(item);
    setIsPlayerOpen(true);

    const buttons = document.querySelectorAll('.watch-button');
    buttons.forEach(button => {
      button.classList.remove('animate__animated', 'animate__shakeX', 'animate__wobble');
    });

    const buttonElement = document.querySelector(`#watch-button-${item.id}`);
    if (buttonElement) {
      buttonElement.classList.add('animate__animated', 'animate__wobble');

      const ripple = document.createElement('span');
      ripple.className = 'absolute inset-0 bg-primary/20 rounded-md';
      ripple.style.animation = 'ripple 0.6s ease-out';
      buttonElement.appendChild(ripple);

      setTimeout(() => {
        if (buttonElement.contains(ripple)) {
          buttonElement.removeChild(ripple);
        }
      }, 600);
    }
  };

  // Helper function for back button
  const renderBackButton = () => {
    const currentPath = window.location.pathname;

    let backDestination = '/home';
    if (currentPath.includes('/student/content')) {
      backDestination = '/student/content';
    } else if (currentPath.includes('/admin/content')) {
      backDestination = '/admin';
    } else if (user?.role === 'admin') {
      backDestination = '/admin';
    }

    return (
      <Button 
        variant="outline" 
        className="mb-4"
        onClick={() => navigate(backDestination)}
      >
        <FontAwesomeIcon icon={faChevronLeft} className="mr-2" />
        Back to {
          currentPath.includes('/student/content') ? 'Content Dashboard' :
          user?.role === 'admin' ? 'Admin Dashboard' : 'Dashboard'
        }
      </Button>
    );
  };

  // Handle loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        {renderBackButton()}
        <h2 className="text-2xl font-bold">Content Library</h2>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="w-full">
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-28" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="space-y-4">
        {renderBackButton()}
        <div className="p-6 text-center">
          <h2 className="text-2xl font-bold text-red-500">Error Loading Content</h2>
          <p className="mt-2">Unable to load content. Please try again later.</p>
          <p className="text-sm text-gray-500 mt-4">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  // Handle empty state
  if (!contentItems || contentItems.length === 0) {
    return (
      <div className="space-y-4">
        {renderBackButton()}
        <div className="p-6 text-center">
          <h2 className="text-2xl font-bold">No Content Available</h2>
          <p className="mt-2">There are no learning resources available at this time.</p>
          {user?.role === 'faculty' && (
            <div className="mt-6">
              <Button>Upload New Content</Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Extract content types and map them to our 3 main display types to avoid duplicates
  const uniqueDisplayTypes = Array.from(
    new Set(contentItems.map(item => getFriendlyContentType(item.type)))
  ).filter(type => type !== 'Other');

  // Always keep 'all' as the first tab
  const contentTypes = ['all', ...uniqueDisplayTypes];

  const uniqueSubjects = Array.from(
    new Set(contentItems.filter(item => item.subject).map(item => item.subject))
  );
  const subjects = ['all', ...uniqueSubjects];

  const uniqueFaculty = Array.from(
    new Set(contentItems.filter(item => item.faculty).map(item => item.faculty as string))
  );

  // For faculty users, they should only see their own content
  const facultyList = user?.role === 'faculty' 
    ? [facultyName || 'Unknown Faculty'] 
    : ['all', ...uniqueFaculty];

  // Apply all filters to content
  const filteredContent = contentItems.filter(item => {
    // Apply content type filter - for tabs we're now using display type names, not database types
    if (activeTab !== 'all') {
      const itemDisplayType = getFriendlyContentType(item.type);
      if (itemDisplayType !== activeTab) {
        return false;
      }
    }

    // Apply subject filter
    if (activeSubject !== 'all' && item.subject !== activeSubject) {
      return false;
    }

    // Apply faculty filter
    if (user?.role === 'faculty') {
      if (facultyName && item.faculty !== facultyName) return false;
    } else if (activeFaculty !== 'all' && item.faculty !== activeFaculty) {
      return false;
    }

    return true;
  });

  // Render content content player if an item is selected
  if (isPlayerOpen && selectedContent) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          className="mb-4"
          onClick={() => setIsPlayerOpen(false)}
        >
          <FontAwesomeIcon icon={faChevronLeft} className="mr-2" />
          Back to Content List
        </Button>

        <SimpleContentPlayer
          content={selectedContent}
          open={true}
          onClose={() => setIsPlayerOpen(false)}
        />
      </div>
    );
  }

  // Render the main content list view
  return (
    <div className="space-y-6">
      {renderBackButton()}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Learning Resources</h2>
        {user?.role === 'faculty' && (
          <Button>Upload New Content</Button>
        )}
      </div>

      {/* Edit Content Modal */}
      <EditContentModal 
        content={editingContent} 
        open={!!editingContent} 
        onClose={() => setEditingContent(null)} 
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent className="max-w-[450px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">
              <FontAwesomeIcon icon={faTrash} className="mr-2" />
              Delete Content
            </AlertDialogTitle>
            <AlertDialogDescription>
              <p>Are you sure you want to delete "{contentToDelete?.title}"?</p>
              <p className="text-sm mt-2 text-gray-600">
                Content will be soft-deleted and can be restored within a 5-minute window.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-gray-300"
              onClick={() => setContentToDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              onClick={handleConfirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          {contentTypes.map(type => (
            <TabsTrigger 
              key={type} 
              value={type}
              className="capitalize"
            >
              {type === 'all' ? 'All Types' : type}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium mr-2">Filter By:</span>

          {/* Subject filter dropdown */}
          <select 
            value={activeSubject}
            onChange={(e) => setActiveSubject(e.target.value)}
            className="px-3 py-1 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">All Subjects</option>
            {subjects
              .filter(s => s !== 'all')
              .map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))
            }
          </select>

          {/* Faculty filter dropdown - not shown for faculty users */}
          {user?.role !== 'faculty' && (
            <select 
              value={activeFaculty}
              onChange={(e) => setActiveFaculty(e.target.value)}
              className="px-3 py-1 rounded-md border border-input bg-background text-sm"
            >
              <option value="all">All Faculty</option>
              {facultyList
                .filter(f => f !== 'all')
                .map(faculty => (
                  <option key={faculty} value={faculty}>{faculty}</option>
                ))
              }
            </select>
          )}
        </div>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredContent.length === 0 ? (
            <div className="p-8 text-center border rounded-lg">
              <h3 className="text-lg font-semibold mb-2">No content found with these filters</h3>
              <p className="text-muted-foreground mb-4">Try changing your filter selections to see more content.</p>
              <Button 
                variant="outline" 
                onClick={() => {
                  setActiveTab('all');
                  setActiveSubject('all');
                  setActiveFaculty('all');
                }}
              >
                Reset All Filters
              </Button>
            </div>
          ) : (
            filteredContent.map(item => (
              <Card key={item.id} className="content-card w-full">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center">
                        <FontAwesomeIcon 
                          icon={getContentIcon(item.type)} 
                          className="mr-2 text-blue-500" 
                        />
                        {item.title}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {item.subject} • {getFriendlyContentType(item.type)}
                        {item.faculty && <span> • By {item.faculty}</span>}
                      </CardDescription>

                      {/* Engagement hint with heart icon and animation - separate from CardDescription */}
                      {item.likes_percent > 0 && (
                        <div className="mt-1 flex items-center text-red-500 animate__animated animate__bounceIn">
                          <FontAwesomeIcon icon={faHeart} className="mr-1" />
                          <span>{getEngagementHint(item.likes_percent)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex">
                      <Badge variant="outline" className="ml-2 flex items-center gap-1">
                        <FontAwesomeIcon icon={faEye} className="text-xs" />
                        {item.views}
                      </Badge>
                      <Badge variant="outline" className="ml-2 flex items-center gap-1">
                        <FontAwesomeIcon icon={faDownload} className="text-xs" />
                        {item.downloads}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Preview image with fade-in animation */}
                    {item.preview_url && (
                      <div className="w-full md:w-1/3 mb-2 md:mb-0 animate__animated animate__fadeIn">
                        <div className="rounded-md overflow-hidden border bg-gray-50 aspect-video flex items-center justify-center">
                          {item.preview_url.endsWith('.svg') ? (
                            // For SVG previews, use an iframe to properly render the SVG
                            <iframe 
                              src={item.preview_url} 
                              className="w-full h-full border-0"
                              title={`Preview of ${item.title}`}
                              sandbox="allow-same-origin"
                            />
                          ) : (
                            // For regular image previews, use an img tag
                            <img 
                              src={item.preview_url} 
                              alt={`Preview of ${item.title}`}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                // If image fails to load, show a fallback icon
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement!.innerHTML = `
                                  <div class="flex flex-col items-center justify-center w-full h-full p-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400 mb-2">
                                      <rect x="2" y="6" width="20" height="12" rx="2" ry="2"></rect>
                                      <path d="M12 12h.01"></path>
                                    </svg>
                                    <span class="text-sm text-gray-400">No preview available</span>
                                  </div>
                                `;
                              }}
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    <div className={item.preview_url ? "w-full md:w-2/3" : "w-full"}>
                      <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                      <ContentTagsDisplay tags={item.tags || []} className="mt-2" />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="gap-3">
                  <Button 
                    id={`watch-button-${item.id}`}
                    className="watch-button relative overflow-hidden"
                    onClick={() => handleWatchClick(item)}
                  >
                    <FontAwesomeIcon icon={faPlay} className="mr-2" />
                    Watch
                  </Button>
                  {/* Only show active download button for non-video content */}
                  {item.type.toLowerCase() !== 'video' ? (
                    <Button 
                      variant="outline" 
                      className="animate__animated animate__bounce animate__delay-1s"
                      onClick={() => handleDownload(item)}
                    >
                      <FontAwesomeIcon icon={faDownload} className="mr-2" />
                      Download
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="cursor-not-allowed opacity-70"
                      disabled
                      title="Video downloads are restricted"
                    >
                      <FontAwesomeIcon icon={faDownload} className="mr-2" />
                      Limited Access
                    </Button>
                  )}

                  {/* Only show edit/delete buttons for faculty users and their own content */}
                  {user?.role === 'faculty' && 
                   item.uploaded_by === user.id && (
                    <>
                      <Button 
                        variant="outline"
                        className="animate__animated animate__lightSpeedIn edit-button"
                        onClick={() => setEditingContent(item)}
                      >
                        <FontAwesomeIcon icon={faPencilAlt} className="mr-2" />
                        Edit
                      </Button>

                      <Button 
                        variant="outline"
                        className="animate__animated animate__zoomIn delete-button ml-auto text-red-600 hover:text-red-800 hover:bg-red-50"
                        onClick={() => handleDeleteClick(item)}
                      >
                        <FontAwesomeIcon icon={faTrash} className="mr-2" />
                        Delete
                      </Button>
                    </>
                  )}
                </CardFooter>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// EditContentModal Component for editing content
const EditContentModal = ({ content, open, onClose }: { content: Content | null, open: boolean, onClose: () => void }) => {
  const { toast } = useToast();
  const [title, setTitle] = useState(content?.title || '');
  const [description, setDescription] = useState(content?.description || '');
  const [subject, setSubject] = useState(content?.subject || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when content changes
  useEffect(() => {
    if (content) {
      setTitle(content.title);
      setDescription(content.description || '');
      setSubject(content.subject);
    }
  }, [content]);

  // File input reference
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Mutation for updating content metadata only
  const updateContentMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; subject: string }) => {
      const response = await apiRequest(
        "PUT", 
        `/api/edit-content/${content?.id}`, 
        data
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update content');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Content Updated",
        description: "The content has been updated successfully.",
        className: "bg-green-50 border-green-200",
      });
      // Invalidate content queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/content'] });
      queryClient.invalidateQueries({ queryKey: ['/api/content/faculty'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for updating content with file replacement
  const updateContentWithFileMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      // Special handling for FormData - can't use apiRequest directly
      const response = await fetch(`/api/edit-content-with-file/${content?.id}`, {
        method: 'PUT',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error occurred' }));
        throw new Error(error.message || `Failed to update content: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Content Updated",
        description: "The content and file have been updated successfully.",
        className: "bg-green-50 border-green-200",
      });
      // Invalidate content queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/content'] });
      queryClient.invalidateQueries({ queryKey: ['/api/content/faculty'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !subject) {
      toast({        title: "Validation Error",
        description: "Title and subject are required.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      if (selectedFile) {
        // Update content with file replacement
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('subject', subject);
        formData.append('file', selectedFile);

        await updateContentWithFileMutation.mutateAsync(formData);
      } else {
        // Update only content metadata
        await updateContentMutation.mutateAsync({
          title,
          description,
          subject
        });
      }
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Content</DialogTitle>
          <DialogDescription>
            Update the content details. Fill in the form below and click save when you're done.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3"
              required
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="subject" className="text-right">
              Subject
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="col-span-3"
              required
            />
          </div>

          <div className="grid grid-cols-4 gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="file" className="text-right">
              Replace File
            </Label>
            <div className="col-span-3">
              <Input
                id="file"
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="col-span-3"
                accept=".pdf,.ppt,.pptx,.mp4"
              />
              <p className="text-xs text-gray-500 mt-1">
                Current file: {content?.filename}
              </p>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || (!title || !subject)}>
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ContentTagsDisplay = ({ tags, className }: { tags: string[], className?: string }) => {
  return (
    <div className={className}>
      {tags.map((tag, index) => (
        <span key={index} className="bg-gray-200 text-gray-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">
          {tag}
        </span>
      ))}
    </div>
  );
};

export default StableContentViewer;