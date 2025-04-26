import React, { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVideo, faBook, faFileAlt, faDownload, faEye, faChevronLeft, faPlay } from '@fortawesome/free-solid-svg-icons';
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import ContentPlayer from './ContentPlayer';
import 'animate.css';

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
  preview_url: string | null;  // Add preview_url field
  views: number;
  downloads: number;
  uploaded_by: number | null;
  created_at: string;
  dept_id: number | null;
  updated_at: string;
  tags?: string[];  // Smart tag suggestions
  likes_percent?: number; // Engagement percentage
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
};

interface ContentViewerProps {
  departmentId?: number;
}

const ContentViewer: React.FC<ContentViewerProps> = ({ departmentId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [activeSubject, setActiveSubject] = useState('all');
  const [activeFaculty, setActiveFaculty] = useState('all');
  const [, navigate] = useLocation();
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [facultyName, setFacultyName] = useState<string | null>(null);

  // Fetch user with department for student role filtering - always call useQuery
  // to ensure consistent hook order, but disable if not a student
  const { data: userWithDept } = useQuery({
    queryKey: ['/api/user-with-department'],
    queryFn: async () => {
      const response = await fetch('/api/user-with-department');
      if (!response.ok) {
        throw new Error('Failed to fetch user with department');
      }
      return response.json();
    },
    enabled: !!user // We'll check for student role when using this data
  });

  // Set faculty name at component level to avoid conditional hooks
  // We'll calculate this once when component loads to avoid hook order issues
  const derivedFacultyName = user?.role === 'faculty' 
    ? (user.first_name && user.last_name 
        ? `${user.first_name} ${user.last_name}` 
        : user.email.split('@')[0])
    : null;
    
  // Set faculty name state once on mount
  useEffect(() => {
    if (derivedFacultyName) {
      setFacultyName(derivedFacultyName);
    }
  }, [derivedFacultyName]);

  // Determine the API endpoint based on user role and context
  const apiEndpoint = React.useMemo(() => {
    // If faculty, fetch only their content
    if (user?.role === 'faculty' && user.id) {
      return `/api/content/faculty/${user.id}`;
    } 
    // Otherwise, fetch by department if specified
    else if (departmentId) {
      return `/api/content/department/${departmentId}`;
    }
    // Fallback to all content
    return '/api/content';
  }, [user?.role, user?.id, departmentId]);

  // Fetch content based on determined endpoint
  const { data: contentItems, isLoading, error } = useQuery({
    queryKey: [apiEndpoint],
    queryFn: async () => {
      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch content');
      }
      return response.json() as Promise<Content[]>;
    },
    enabled: !!user && (user.role !== 'faculty' || !!facultyName) // Only fetch when user is logged in and facultyName is available if user is faculty
  });

  // Apply CSS classes for animation when content loads
  useEffect(() => {
    if (contentItems && !isLoading) {
      const cards = document.querySelectorAll('.content-card');
      cards.forEach((card, i) => {
        // Use CSS classes for animation instead of motion library
        setTimeout(() => {
          card.classList.add('animate__animated', 'animate__fadeInUp');
        }, i * 100);
      });
    }
  }, [contentItems, isLoading]);

  // Helper function for back button to ensure logical navigation
  const renderBackButton = () => {
    // Get current path to determine proper back navigation
    const currentPath = window.location.pathname;
    
    // Determine the appropriate back destination based on context
    const getBackDestination = () => {
      // If we're in a department-specific view inside student dashboard
      if (currentPath.includes('/student/content')) {
        return '/student/content';
      }
      
      // If we're in admin content section
      if (currentPath.includes('/admin/content')) {
        return '/admin';
      }
      
      // Default fallbacks based on role
      return user?.role === 'admin' ? '/admin' : '/home';
    };
    
    return (
      <Button 
        variant="outline" 
        className="mb-4"
        onClick={() => navigate(getBackDestination())}
      >
        <FontAwesomeIcon icon={faChevronLeft} className="mr-2" />
        Back to {
          currentPath.includes('/student/content') ? 'Content Dashboard' :
          user?.role === 'admin' ? 'Admin Dashboard' : 'Dashboard'
        }
      </Button>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Back button at the top */}
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

  if (error) {
    return (
      <div className="space-y-4">
        {/* Back button at the top */}
        {renderBackButton()}
        
        <div className="p-6 text-center">
          <h2 className="text-2xl font-bold text-red-500">Error Loading Content</h2>
          <p className="mt-2">Unable to load content. Please try again later.</p>
          <p className="text-sm text-gray-500 mt-4">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  if (!contentItems || contentItems.length === 0) {
    return (
      <div className="space-y-4">
        {/* Back button at the top */}
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

  // Get unique content types, subjects, and faculty for filtering
  const uniqueTypes = contentItems.reduce((types: string[], item) => {
    if (!types.includes(item.type)) {
      types.push(item.type);
    }
    return types;
  }, []);
  const contentTypes = ['all', ...uniqueTypes];

  // Get unique subjects
  const uniqueSubjects = contentItems.reduce((subjects: string[], item) => {
    if (!subjects.includes(item.subject) && item.subject) {
      subjects.push(item.subject);
    }
    return subjects;
  }, []);
  const subjects = ['all', ...uniqueSubjects];

  // Get unique faculty
  const uniqueFaculty = contentItems.reduce((faculty: string[], item) => {
    if (!faculty.includes(item.faculty || '') && item.faculty) {
      faculty.push(item.faculty);
    }
    return faculty;
  }, []);
  
  // For faculty users, they should only see their own content
  // For students, they should see content from their department
  const facultyList = user?.role === 'faculty' ? 
    // For faculty, use only their name to filter, no "all" option
    [facultyName || 'Unknown Faculty'] :
    // For other roles, show all faculty
    ['all', ...uniqueFaculty];

  // If user is faculty, force activeFaculty to their name
  useEffect(() => {
    if (user?.role === 'faculty' && facultyName) {
      setActiveFaculty(facultyName);
    }
  }, [user?.role, facultyName, setActiveFaculty]);

  // Apply all filters
  const filteredContent = contentItems.filter(item => {
    // Apply content type filter
    if (activeTab !== 'all' && item.type !== activeTab) {
      return false;
    }
    
    // Apply subject filter
    if (activeSubject !== 'all' && item.subject !== activeSubject) {
      return false;
    }
    
    // Apply faculty filter - for faculty users, only show their own content
    if (user?.role === 'faculty') {
      if (facultyName && item.faculty !== facultyName) return false;
    } 
    // For non-faculty users, apply the selected faculty filter
    else if (activeFaculty !== 'all' && item.faculty !== activeFaculty) {
      return false;
    }
    
    return true;
  });

  // Helper function to get icon based on content type
  const getContentIcon = (type: string) => {
    const normalizedType = type.toLowerCase();
    switch (normalizedType) {
      case 'video':
        return faVideo;
      case 'notes':
      case 'lecture':
        return faBook;
      case 'slides':
      case 'presentation':
      case 'ppt':
      case 'pptx':
        return faFileAlt;
      case 'textbook':
      case 'doc':
      case 'docx':
      case 'pdf':
        return faBook;
      default:
        return faFileAlt;
    }
  };
  
  // Helper function to get a friendly content type name
  const getFriendlyContentType = (type: string): string => {
    const normalizedType = type.toLowerCase();
    switch (normalizedType) {
      case 'video':
        return 'Video';
      case 'notes':
      case 'lecture':
        return 'Lecture Notes';
      case 'slides':
      case 'presentation':
      case 'ppt':
      case 'pptx':
        return 'Presentation';
      case 'textbook':
      case 'doc':
      case 'docx':
        return 'Textbook';
      case 'pdf':
        return 'PDF Document';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const handleDownload = (item: Content) => {
    // Create a download notification
    toast({
      title: "Download Started",
      description: `Downloading ${item.filename}...`,
      className: "bg-green-50 border-green-200",
    });
    
    // Create a hidden anchor element for the download
    const downloadLink = document.createElement('a');
    downloadLink.href = `/api/content/${item.id}/download`;
    downloadLink.download = item.filename; // Set the filename for the download
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    
    // Trigger the download
    downloadLink.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(downloadLink);

      // Success notification after a short delay
      setTimeout(() => {
        toast({
          title: "Download Complete",
          description: `${item.filename} has been downloaded successfully.`,
          className: "bg-green-50 border-green-200",
        });
      }, 1500);
    }, 100);
  };
  
  // This function adds wiggle animation and opens content player
  const handleWatchClick = (item: Content) => {
    // Update state to open the content player
    setSelectedContent(item);
    setIsPlayerOpen(true);
    
    // Reset any existing animations on all watch buttons
    const buttons = document.querySelectorAll('.watch-button');
    buttons.forEach(button => {
      button.classList.remove('animate__animated', 'animate__shakeX', 'animate__wobble');
    });

    // Find the specific button for this item and add animation
    const buttonElement = document.querySelector(`#watch-button-${item.id}`);
    if (buttonElement) {
      // Add the wiggle effect animation
      buttonElement.classList.add('animate__animated', 'animate__wobble');
      
      // Create a subtle "ripple" effect by adding a temporary overlay
      const ripple = document.createElement('span');
      ripple.className = 'absolute inset-0 bg-primary/20 rounded-md';
      ripple.style.animation = 'ripple 0.6s ease-out';
      buttonElement.appendChild(ripple);
      
      // Remove the ripple effect after animation completes
      setTimeout(() => {
        if (buttonElement.contains(ripple)) {
          buttonElement.removeChild(ripple);
        }
      }, 600);
    }
    
    // Log view action for analytics (optional)
    console.log(`User opened content: ${item.title}`);
  };

  return (
    <div className="space-y-6">
      {/* Back button at the top */}
      {renderBackButton()}
    
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Learning Resources</h2>
        {user?.role === 'faculty' && (
          <Button>Upload New Content</Button>
        )}
      </div>

      {/* Primary filter by content type */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          {contentTypes.map(type => (
            <TabsTrigger key={type} value={type} className="capitalize">
              {type === 'all' ? 'All Types' : getFriendlyContentType(type)}
            </TabsTrigger>
          ))}
        </TabsList>
      
        {/* Additional filters for subject and faculty */}
        <div className="flex flex-wrap gap-4 mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
          <div className="flex-1 min-w-[300px]">
            <h3 className="text-sm font-medium mb-2 text-blue-800">Filter by Subject</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {subjects.map(subject => (
                <Badge 
                  key={subject} 
                  variant={activeSubject === subject ? "default" : "outline"}
                  className={`cursor-pointer ${activeSubject === subject ? 'bg-primary hover:bg-primary/90' : 'hover:bg-secondary/20'}`}
                  onClick={() => setActiveSubject(subject)}
                >
                  {subject === 'all' ? 'All Subjects' : subject}
                </Badge>
              ))}
            </div>
          </div>
          
          {/* Only show faculty filter for students and admins, not for faculty users */}
          {user?.role !== 'faculty' && (
            <div className="flex-1 min-w-[300px]">
              <h3 className="text-sm font-medium mb-2 text-blue-800">Filter by Faculty</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {facultyList.map(faculty => (
                  <Badge 
                    key={faculty} 
                    variant={activeFaculty === faculty ? "default" : "outline"}
                    className={`cursor-pointer ${activeFaculty === faculty ? 'bg-primary hover:bg-primary/90' : 'hover:bg-secondary/20'}`}
                    onClick={() => setActiveFaculty(faculty)}
                  >
                    {faculty === 'all' ? 'All Faculty' : faculty}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Filter status and results count */}
        <div className="flex justify-between items-center mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm">
            <strong>Active Filters: </strong>
            <span className="text-primary font-medium">
              {activeTab !== 'all' ? getFriendlyContentType(activeTab) : 'All Types'}
            </span>
            <span className="mx-2">•</span>
            <span className="text-primary font-medium">{activeSubject !== 'all' ? activeSubject : 'All Subjects'}</span>
            
            {/* Only show faculty filter status for non-faculty users */}
            {user?.role !== 'faculty' && (
              <>
                <span className="mx-2">•</span>
                <span className="text-primary font-medium">{activeFaculty !== 'all' ? activeFaculty : 'All Faculty'}</span>
              </>
            )}
            
            {/* Show department for students */}
            {user?.role === 'student' && userWithDept?.department && (
              <>
                <span className="mx-2">•</span>
                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md text-xs font-medium">
                  Department: {userWithDept.department.name}
                </span>
              </>
            )}
          </div>
          <Badge variant="secondary" className="ml-2">
            {filteredContent.length} result{filteredContent.length !== 1 ? 's' : ''}
          </Badge>
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
                          className="mr-2 text-primary" 
                        />
                        {item.title}
                      </CardTitle>
                      <CardDescription>{item.subject}</CardDescription>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className="capitalize font-medium" 
                      style={{ 
                        backgroundColor: item.type.toLowerCase() === 'video' ? '#e6f7ff' : 
                                         item.type.toLowerCase().includes('presentation') || 
                                         item.type.toLowerCase().includes('slides') ? '#f0f5ff' : 
                                         item.type.toLowerCase().includes('textbook') || 
                                         item.type.toLowerCase().includes('doc') ? '#f6ffed' : '#f9f0ff'
                      }}
                    >
                      {getFriendlyContentType(item.type)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{item.description || 'No description available.'}</p>
                  
                  {/* Smart Tags Display */}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {item.tags.map((tag, index) => (
                        <Badge 
                          key={`${item.id}-tag-${index}`}
                          variant="outline" 
                          className={`animate__animated animate__bounceIn text-xs`}
                          style={{ animationDelay: `${index * 0.1}s` }}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
                    {item.department && (
                      <Badge variant="secondary">
                        {item.department.name}
                      </Badge>
                    )}
                    {item.faculty && (
                      <span className="text-sm">
                        Faculty: {item.faculty}
                      </span>
                    )}
                    <span className="text-sm">
                      Added: {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-wrap justify-between gap-2">
                  <div className="flex space-x-2">
                    <Button 
                      variant="default" 
                      id={`watch-button-${item.id}`}
                      className="watch-button hover:animate__animated hover:animate__pulse relative group" 
                      onClick={() => handleWatchClick(item)}
                    >
                      <span className="absolute inset-0 bg-primary/10 transform scale-0 group-hover:scale-100 rounded-md transition-transform duration-300"></span>
                      <FontAwesomeIcon icon={faPlay} className="mr-2 animate__animated animate__pulse animate__infinite animate__slower" />
                      Watch
                    </Button>
                    <Button 
                      variant="outline" 
                      id={`download-button-${item.id}`}
                      className="download-button hover:animate__animated hover:animate__pulse"
                      onClick={(e) => {
                        // Add bounce animation when clicked
                        const button = e.currentTarget;
                        button.classList.add('animate__animated', 'animate__bounce');
                        // Remove animation classes after animation completes
                        setTimeout(() => {
                          button.classList.remove('animate__animated', 'animate__bounce');
                        }, 1000);
                        handleDownload(item);
                      }}
                    >
                      <FontAwesomeIcon icon={faDownload} className="mr-2" />
                      Download
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <FontAwesomeIcon icon={faEye} className="mr-1" />
                      <span>{item.views} views</span>
                    </div>
                    <div className="flex items-center">
                      <FontAwesomeIcon icon={faDownload} className="mr-1" />
                      <span>{item.downloads} downloads</span>
                    </div>
                  </div>
                </CardFooter>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
      
      {/* Content Player Modal */}
      <ContentPlayer
        content={selectedContent}
        open={isPlayerOpen}
        onClose={() => setIsPlayerOpen(false)}
      />
    </div>
  );
};

export default ContentViewer;