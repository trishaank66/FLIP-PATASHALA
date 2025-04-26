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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FolderIcon, FileIcon, Video, FileText, Presentation } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  contents?: ContentItem[];
}

const SortedContentFolders: React.FC<{ userId: number, userRole: string }> = ({ userId, userRole }) => {
  const [classFolders, setClassFolders] = useState<ClassFolder[]>([]);
  const [allContent, setAllContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("folders");
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Get content with assignment information
        const contentResponse = await apiRequest('GET', '/api/content-with-assignments');
        const contentData: ContentItem[] = await contentResponse.json();
        
        // Get class folders based on user role
        let foldersResponse;
        if (userRole === 'admin') {
          foldersResponse = await apiRequest('GET', '/api/class-folders');
        } else if (userRole === 'faculty') {
          foldersResponse = await apiRequest('GET', `/api/faculty/${userId}/class-folders`);
        } else {
          // For students, we'll just show content that's assigned to their department
          // This data is already available in contentData
          setAllContent(contentData);
          setLoading(false);
          return;
        }
        
        const foldersData: ClassFolder[] = await foldersResponse.json();
        
        // Group content by folder
        const foldersWithContent = foldersData.map(folder => {
          const folderContents = contentData.filter(
            item => item.subject_faculty_assignment_id === folder.id
          );
          return {
            ...folder,
            contents: folderContents
          };
        });
        
        setClassFolders(foldersWithContent);
        setAllContent(contentData);
      } catch (error) {
        console.error('Error loading content folders:', error);
        toast({
          title: "Error",
          description: "Failed to load content folders. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [userId, userRole, toast]);

  const getContentTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'video':
        return <Video className="h-5 w-5 text-red-500" />;
      case 'pdf':
      case 'lecture handout':
        return <FileText className="h-5 w-5 text-blue-500" />;
      case 'presentation':
      case 'ppt':
      case 'pptx':
        return <Presentation className="h-5 w-5 text-orange-500" />;
      default:
        return <FileIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  // For students, show a flat list of content that's in their assigned folders
  if (userRole === 'student') {
    const sortedContent = allContent.filter(item => item.subject_faculty_assignment_id !== null);
    
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FolderIcon className="h-6 w-6 text-primary" />
            <span>Your Course Materials</span>
          </CardTitle>
          <CardDescription>
            Access all your course materials sorted by subject
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading your course materials...</span>
            </div>
          ) : sortedContent.length === 0 ? (
            <div className="text-center py-8">
              <FolderIcon className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">No course materials are available yet.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Faculty</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedContent.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell className="flex items-center space-x-1">
                        {getContentTypeIcon(item.type)}
                        <span>{item.type}</span>
                      </TableCell>
                      <TableCell>{item.assignment_details?.subject_name || 'Unknown'}</TableCell>
                      <TableCell>{item.assignment_details?.faculty_name || 'Unknown'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="mr-2"
                          onClick={() => {
                            // Logic to view content would go here
                            window.open(`/content/view/${item.id}`, '_blank');
                          }}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            // Logic to download content would go here
                            window.open(`/content/download/${item.id}`, '_blank');
                          }}
                        >
                          Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // For faculty and admin, show content organized by folders
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FolderIcon className="h-6 w-6 text-primary" />
          <span>Sorted Content Folders</span>
        </CardTitle>
        <CardDescription>
          View and manage content organized into class folders
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="folders" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="folders">
              <FolderIcon className="h-4 w-4 mr-2" />
              Folder View
            </TabsTrigger>
            <TabsTrigger value="list">
              <FileIcon className="h-4 w-4 mr-2" />
              List View
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="folders">
            {loading ? (
              <div className="flex items-center justify-center min-h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Loading content folders...</span>
              </div>
            ) : classFolders.length === 0 ? (
              <div className="text-center py-8">
                <FolderIcon className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">No class folders have been created yet.</p>
              </div>
            ) : (
              <Accordion type="multiple" className="w-full">
                {classFolders.map((folder) => (
                  <AccordionItem value={`folder-${folder.id}`} key={folder.id}>
                    <AccordionTrigger className="hover:bg-muted/50 px-4 rounded-md">
                      <div className="flex items-center">
                        <FolderIcon className="h-5 w-5 mr-2 text-primary" />
                        <span>{folder.folder_name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{folder.contents?.length || 0} items</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {folder.contents && folder.contents.length > 0 ? (
                        <div className="rounded-md border mt-2">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Title</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {folder.contents.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell className="font-medium">{item.title}</TableCell>
                                  <TableCell className="flex items-center space-x-1">
                                    {getContentTypeIcon(item.type)}
                                    <span>{item.type}</span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="mr-2"
                                      onClick={() => {
                                        // Logic to view content would go here
                                        window.open(`/content/view/${item.id}`, '_blank');
                                      }}
                                    >
                                      View
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        // Logic to download content would go here
                                        window.open(`/content/download/${item.id}`, '_blank');
                                      }}
                                    >
                                      Download
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="text-muted-foreground px-4 py-2">This folder is empty.</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </TabsContent>
          
          <TabsContent value="list">
            {loading ? (
              <div className="flex items-center justify-center min-h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Loading content...</span>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Folder</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allContent
                      .filter(item => item.subject_faculty_assignment_id !== null)
                      .map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.title}</TableCell>
                          <TableCell className="flex items-center space-x-1">
                            {getContentTypeIcon(item.type)}
                            <span>{item.type}</span>
                          </TableCell>
                          <TableCell>
                            {item.assignment_details?.folder_name || 'Unknown'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="mr-2"
                              onClick={() => {
                                // Logic to view content would go here
                                window.open(`/content/view/${item.id}`, '_blank');
                              }}
                            >
                              View
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                // Logic to download content would go here
                                window.open(`/content/download/${item.id}`, '_blank');
                              }}
                            >
                              Download
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">
          {activeTab === 'folders'
            ? `Showing ${classFolders.length} class folders with content`
            : `Showing ${allContent.filter(item => item.subject_faculty_assignment_id !== null).length} sorted content items`}
        </p>
      </CardFooter>
    </Card>
  );
};

export default SortedContentFolders;