import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faDownload } from '@fortawesome/free-solid-svg-icons';
import { apiRequest } from "@/lib/queryClient";
import 'animate.css';

type Content = {
  id: number;
  title: string;
  description: string | null;
  subject: string;
  faculty: string | null;
  type: string;
  filename: string;
  url: string;
  views: number;
  downloads: number;
  uploaded_by: number | null;
  dept_id: number | null;
};

interface SimpleContentPlayerProps {
  content: Content | null;
  open: boolean;
  onClose: () => void;
}

const SimpleContentPlayer: React.FC<SimpleContentPlayerProps> = ({ content, open, onClose }) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [viewTracked, setViewTracked] = useState(false);

  // Track content view when opened
  useEffect(() => {
    const trackView = async () => {
      if (content && open && !viewTracked) {
        console.log(`Tracking view for content ID: ${content.id}`);
        try {
          await trackContentView(content.id);
          setViewTracked(true);
        } catch (err) {
          console.error('Error tracking view:', err);
        }
      }
    };
    
    trackView();
  }, [content, open, viewTracked]);

  // Reset state when content changes
  useEffect(() => {
    if (content) {
      setIsLoading(true);
      setViewTracked(false);
    }
  }, [content]);

  const trackContentView = async (contentId: number) => {
    try {
      const response = await apiRequest('POST', `/api/content/${contentId}/view`);
      if (response.ok) {
        setViewTracked(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to track content view:', err);
      return false;
    }
  };

  const handleDownload = () => {
    if (!content) return;
    
    // Create a notification
    toast({
      title: "Download Started",
      description: `Downloading ${content.filename}...`,
      className: "bg-green-50 border-green-200",
    });
    
    // Create a hidden anchor element for the download
    const downloadLink = document.createElement('a');
    downloadLink.href = `/api/content/${content.id}/download`;
    downloadLink.download = content.filename;
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
          description: `${content.filename} has been downloaded successfully.`,
          className: "bg-green-50 border-green-200",
        });
      }, 1500);
    }, 100);
  };

  // Determine content type and render appropriate player
  const renderContentPlayer = () => {
    if (!content) return null;
    
    const contentType = content.type.toLowerCase();
    const fileExtension = content.filename.split('.').pop()?.toLowerCase() || '';
    
    // Load timeout to stop spinner after a reasonable time
    useEffect(() => {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 2000);
      
      return () => clearTimeout(timer);
    }, []);
    
    if (contentType.includes('video') || fileExtension === 'mp4' || fileExtension === 'webm') {
      return (
        <div className="video-container h-full flex flex-col">
          <div className="flex-grow relative rounded-md overflow-hidden bg-gray-900">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-white">Loading video...</span>
              </div>
            )}
            <video
              controls
              autoPlay
              className="w-full h-full rounded-md"
              src={`/api/content/${content.id}/stream`}
              onLoadedData={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      );
    } else if (contentType.includes('lecture') || contentType.includes('handout') || 
               fileExtension === 'pdf') {
      // Use Google Docs Viewer for PDF lecture handouts
      const googleDocsViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(window.location.origin)}/api/content/${content.id}/stream&embedded=true`;
      
      return (
        <div className="lecture-handout-container h-full flex flex-col border border-gray-200 rounded-md overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading lecture handout...</span>
            </div>
          )}
          
          <div className="bg-gray-100 p-3 border-b flex justify-between items-center">
            <div className="flex items-center">
              <svg className="h-6 w-6 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-medium">Lecture Handout</span>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleDownload}
              className="animate__animated animate__pulse animate__infinite animate__slower"
            >
              <FontAwesomeIcon icon={faDownload} className="mr-1" />
              Download
            </Button>
          </div>
          
          <div className="flex-grow relative overflow-hidden bg-white">
            <iframe
              src={googleDocsViewerUrl}
              className="w-full h-full border-0"
              onLoad={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
              title="Lecture Handout Viewer"
            />
          </div>
        </div>
      );
    } else if (contentType.includes('slide') || contentType.includes('presentation') || 
               fileExtension === 'ppt' || fileExtension === 'pptx') {
      // Use Google Docs Viewer for presentations as well
      const googleDocsViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(window.location.origin)}/api/content/${content.id}/stream&embedded=true`;
      
      return (
        <div className="presentation-container h-full flex flex-col border border-gray-200 rounded-md overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading presentation...</span>
            </div>
          )}
          
          <div className="bg-blue-50 p-3 border-b flex justify-between items-center">
            <div className="flex items-center">
              <svg className="h-6 w-6 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
              <span className="font-medium">Presentation Slides</span>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleDownload}
              className="animate__animated animate__pulse animate__infinite animate__slower"
            >
              <FontAwesomeIcon icon={faDownload} className="mr-1" />
              Download
            </Button>
          </div>
          
          <div className="flex-grow relative overflow-hidden bg-white">
            <iframe
              src={googleDocsViewerUrl}
              className="w-full h-full border-0"
              onLoad={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
              title="Presentation Viewer"
            />
          </div>
        </div>
      );
    } else {
      // We'll only handle the three main content types as requested
      return (
        <div className="unsupported-content h-full flex flex-col items-center justify-center bg-gray-50 rounded-md p-6">
          <div className="text-center max-w-md">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium">{content.title}</h3>
            <p className="mt-2 text-sm text-gray-500">
              This content can be downloaded for viewing with an appropriate application.
            </p>
            <Button 
              onClick={handleDownload}
              className="mt-4 animate__animated animate__pulse animate__infinite animate__slower"
            >
              <FontAwesomeIcon icon={faDownload} className="mr-2" />
              Download File
            </Button>
          </div>
        </div>
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[85vh] h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle>
              {content?.title || 'View Content'}
              {content && (
                <span className="ml-2 text-sm text-muted-foreground">
                  ({content.views} {content.views === 1 ? 'view' : 'views'})
                </span>
              )}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="absolute top-4 right-4"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {content && (
            <div className="text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Subject: {content.subject}</span>
                {content.faculty && <span>By: {content.faculty}</span>}
              </div>
            </div>
          )}
        </DialogHeader>
        
        <div className="flex-grow overflow-hidden relative my-4">          
          <div className="h-full overflow-auto">
            {renderContentPlayer()}
          </div>
        </div>
        
        <DialogFooter className="flex justify-between mt-4">
          <div>
            {content && (
              <div className="flex items-center text-sm text-muted-foreground">
                <FontAwesomeIcon icon={faEye} className="mr-1" />
                <span>{content.views} views</span>
              </div>
            )}
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            
            {/* Only show download button for non-video content */}
            {content && content.type.toLowerCase() !== 'video' && (
              <Button 
                variant="default" 
                className="hover:animate__animated hover:animate__pulse"
                onClick={handleDownload}
              >
                <FontAwesomeIcon icon={faDownload} className="mr-2" />
                Download
              </Button>
            )}
            
            {/* Show disabled button with explanation for video content */}
            {content && content.type.toLowerCase() === 'video' && (
              <Button 
                variant="outline" 
                className="cursor-not-allowed opacity-70"
                disabled
                title="Video downloads are restricted"
              >
                <FontAwesomeIcon icon={faDownload} className="mr-2" />
                Download Restricted
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SimpleContentPlayer;