import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FolderIcon, Filter, FileType } from "lucide-react";

interface ContentItem {
  id: number;
  title: string;
  type: string;
  filename: string;
  preview_url: string | null;
  views: number;
  downloads: number;
  subject_faculty_assignment_id: number | null;
  assignment_details: {
    id: number;
    subject_name: string;
    department_name: string | null;
    faculty_id: number;
    faculty_name: string;
    folder_name: string;
  } | null;
}

interface ClassFolder {
  id: number;
  subject_name: string;
  department_name: string | null;
  faculty_id?: number;
  faculty_name?: string;
  folder_name: string;
}

const ContentSorter: React.FC<{ userId: number, userRole: string }> = ({ userId, userRole }) => {
  // Early return if user is not faculty - only faculty should be able to sort content
  if (userRole !== 'faculty') {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FolderIcon className="h-6 w-6 text-primary" />
            <span>Content Sorter</span>
          </CardTitle>
          <CardDescription>
            Content sorting is only available for faculty members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Content sorting allows faculty to organize their uploaded content into class folders.
            This functionality is restricted to faculty members to maintain proper content organization.
          </p>
        </CardContent>
      </Card>
    );
  }
  const [content, setContent] = useState<ContentItem[]>([]);
  const [classFolders, setClassFolders] = useState<ClassFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortingContentId, setSortingContentId] = useState<number | null>(null);
  // Track selected folders for each content item separately
  const [selectedFolders, setSelectedFolders] = useState<Record<number, string>>({});
  const [filterType, setFilterType] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Get content with assignment information
        const contentResponse = await apiRequest('GET', '/api/content-with-assignments');
        const contentData = await contentResponse.json();
        
        // Get class folders based on user role
        let foldersResponse;
        if (userRole === 'admin') {
          foldersResponse = await apiRequest('GET', '/api/class-folders');
        } else {
          foldersResponse = await apiRequest('GET', `/api/faculty/${userId}/class-folders`);
        }
        const foldersData = await foldersResponse.json();
        
        setContent(contentData);
        setClassFolders(foldersData);
      } catch (error) {
        console.error('Error loading content and folders:', error);
        toast({
          title: "Error",
          description: "Failed to load content and folders. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [userId, userRole, toast]);

  const sortContent = async (contentId: number, folderId: number) => {
    try {
      // Set the id of the content we're currently sorting
      setSortingContentId(contentId);
      
      const response = await apiRequest('POST', '/api/sort-content', {
        contentId, 
        subjectFacultyAssignmentId: folderId,
        userId: userId  // Include userId in the request
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to sort content');
      }
      
      // Update local state to reflect the change
      setContent(prevContent => prevContent.map(item => {
        if (item.id === contentId) {
          const folder = classFolders.find(f => f.id === folderId);
          return {
            ...item,
            subject_faculty_assignment_id: folderId,
            assignment_details: folder ? {
              id: folder.id,
              subject_name: folder.subject_name,
              department_name: folder.department_name,
              faculty_id: folder.faculty_id || 0,
              faculty_name: folder.faculty_name || 'Unknown',
              folder_name: folder.folder_name
            } : null
          };
        }
        return item;
      }));
      
      // Reset the selected folder for this content item after successful sorting
      const updatedFolders = { ...selectedFolders };
      delete updatedFolders[contentId];
      setSelectedFolders(updatedFolders);
      
      toast({
        title: "Success",
        description: "Content sorted successfully!",
      });
    } catch (error) {
      console.error('Error sorting content:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to sort content",
        variant: "destructive",
      });
    } finally {
      setSortingContentId(null);
    }
  };

  const handleSortContent = (contentId: number) => {
    // Get the selected folder for this specific content item
    const selectedFolder = selectedFolders[contentId];
    
    if (!selectedFolder) {
      toast({
        title: "Selection required",
        description: "Please select a class folder to sort to",
        variant: "destructive",
      });
      return;
    }
    
    const folderId = parseInt(selectedFolder, 10);
    sortContent(contentId, folderId);
  };
  
  const getContentTypeIcon = (type: string) => {
    const normalizedType = type.toLowerCase();
    switch (true) {
      case normalizedType.includes('video') || normalizedType === 'mp4':
        return <FileType className="h-5 w-5 text-red-500" />;
      case normalizedType.includes('pdf') || normalizedType.includes('lecture'):
        return <FileType className="h-5 w-5 text-blue-500" />;
      case normalizedType.includes('presentation') || normalizedType.includes('ppt'):
        return <FileType className="h-5 w-5 text-orange-500" />;
      default:
        return <FileType className="h-5 w-5 text-gray-500" />;
    }
  };
  
  const filteredContent = filterType === 'all' 
    ? content 
    : filterType === 'sorted' 
      ? content.filter(item => item.subject_faculty_assignment_id !== null)
      : content.filter(item => item.subject_faculty_assignment_id === null);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading content and folders...</span>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FolderIcon className="h-6 w-6 text-primary" />
          <span>Content Sorter</span>
        </CardTitle>
        <CardDescription>
          Organize your content into class folders for better student access
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter content" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Content</SelectItem>
                <SelectItem value="sorted">Sorted Content</SelectItem>
                <SelectItem value="unsorted">Unsorted Content</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="rounded-md border">
          <Table>
            <TableCaption>Organize content into subject class folders</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Current Folder</TableHead>
                <TableHead>Sort To</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContent.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No content found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredContent.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell className="flex items-center space-x-1">
                      {getContentTypeIcon(item.type)}
                      <span>{item.type}</span>
                    </TableCell>
                    <TableCell>
                      {item.assignment_details 
                        ? item.assignment_details.folder_name
                        : <span className="text-muted-foreground italic">Unsorted</span>}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={selectedFolders[item.id] || ''}
                        onValueChange={(value) => {
                          setSelectedFolders(prev => ({
                            ...prev,
                            [item.id]: value
                          }));
                        }}
                      >
                        <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="Select a class folder" />
                        </SelectTrigger>
                        <SelectContent>
                          {classFolders.map((folder) => (
                            <SelectItem key={folder.id} value={folder.id.toString()}>
                              {folder.folder_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        onClick={() => handleSortContent(item.id)}
                        disabled={sortingContentId === item.id || !selectedFolders[item.id]}
                      >
                        {sortingContentId === item.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sorting...
                          </>
                        ) : (
                          'Sort Content'
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <p className="text-sm text-muted-foreground">
          {filterType === 'all' 
            ? `Showing all ${content.length} content items` 
            : filterType === 'sorted'
              ? `Showing ${filteredContent.length} sorted content items`
              : `Showing ${filteredContent.length} unsorted content items`}
        </p>
      </CardFooter>
    </Card>
  );
};

export default ContentSorter;