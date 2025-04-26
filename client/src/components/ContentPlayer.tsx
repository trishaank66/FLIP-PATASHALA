import React, { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, X } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faEye, faDownload, faFileAlt, faPlay, faPause, faVolumeUp, faVolumeMute } from '@fortawesome/free-solid-svg-icons';

// Define paths to sample files on server
const samplePdfPath = '/content/samples/dummy lecture handout.pdf';
const sampleVideoPath = '/content/samples/videoplayback.mp4';
const sampleSlidesPath = '/content/samples/samplepptx.pptx';

// Use no worker configuration for PDF.js
// This gives us more reliable operation without external dependencies
pdfjs.GlobalWorkerOptions.workerSrc = '';
console.log(`Using PDF.js ${pdfjs.version} with simplified configuration for reliability`);

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

interface ContentPlayerProps {
  content: Content | null;
  open: boolean;
  onClose: () => void;
}

const ContentPlayer: React.FC<ContentPlayerProps> = ({ content, open, onClose }) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewTracked, setViewTracked] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Track content view once when opened
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
      setError(null);
      setNumPages(null);
      setCurrentPage(1);
      setViewTracked(false);
      setIsPlaying(false);
      setProgress(0);
      setIsMuted(false);
    }
  }, [content]);

  const trackContentView = async (contentId: number) => {
    try {
      await apiRequest('POST', `/api/content/${contentId}/view`);
      setViewTracked(true);
    } catch (err) {
      console.error('Failed to track content view:', err);
      // Continue showing content even if tracking fails
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

    // Create a hidden anchor element to trigger the download
    const downloadLink = document.createElement('a');
    downloadLink.href = `/api/content/${content.id}/download`;
    downloadLink.download = content.filename;
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);

    // Trigger the download
    downloadLink.click();

    // Remove the element after download is triggered
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

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
  };

  const changePage = (offset: number) => {
    if (!numPages) return;
    const newPage = currentPage + offset;
    if (newPage >= 1 && newPage <= numPages) {
      setCurrentPage(newPage);
    }
  };

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  const togglePlay = () => {
    if (videoRef.current) {
      setIsPlaying(!isPlaying);
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const percent = parseFloat(e.target.value);
      videoRef.current.currentTime = (videoRef.current.duration * percent) / 100;
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  };

  // Determine content type and render appropriate player
  const renderContentPlayer = () => {
    if (!content) return null;

    // Use direct file URL for streaming
    const fileUrl = `/api/content/${content.id}/stream`;
    // Fallback to sample content if needed
    const sampleUrl = content.type.toLowerCase().includes('pdf') ? 
      '/content/samples/dummy lecture handout.pdf' :
      '/content/samples/samplepptx.pptx';

    const contentType = content.type.toLowerCase();

    // PDF viewer component - simplified to use iframe for reliability
    const PdfViewer = ({ src }: { src: string }) => {
      // We'll always use the HTML fallback for reliability
      return (
        <div className="pdf-viewer-container h-full">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading content...</span>
            </div>
          )}
          <iframe
            src={samplePdfPath}
            className="w-full h-full border-0 rounded-md shadow-lg"
            onLoad={() => setIsLoading(false)}
          />
        </div>
      );
    };

    // Helper to determine if we need to use a fallback HTML version
    const tryFallback = () => {
      fallbackUsed = true;
      if (contentType.includes('pdf') || contentType.includes('lecture') || contentType.includes('note')) {
        return samplePdfPath;
      } else if (contentType.includes('video')) {
        return sampleVideoPath;
      } else if (contentType.includes('slide') || contentType.includes('presentation') || contentType.includes('ppt')) {
        return sampleSlidesPath;
      }
      return samplePdfPath; // Default fallback
    };

    // Main content renderer
    try {
      if (contentType.includes('video')) {
        return (
          <div className="video-container h-full flex flex-col">
            <div className="flex-grow relative">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Loading video...</span>
                </div>
              )}
              <video
                ref={videoRef}
                controlsList="nodownload" 
                onContextMenu={e => e.preventDefault()}
                className="w-full h-full rounded-md shadow-lg"
                src={`/api/content/${content.id}/stream`}
                onLoadStart={() => setIsLoading(true)}
                onLoadedData={() => setIsLoading(false)}
                onError={(e) => {
                  console.error("Video load error:", e);
                  setError("Failed to load video. Please try again later.");
                }}
              >
                Your browser does not support the video tag.
              </video>
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent">
                <div className="flex items-center justify-between">
                  <button 
                    onClick={togglePlay}
                    className="text-white hover:text-primary"
                  >
                    {isPlaying ? <FontAwesomeIcon icon={faPause} /> : <FontAwesomeIcon icon={faPlay} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={progress}
                    onChange={handleProgressChange}
                    className="flex-grow mx-4"
                  />
                  <button 
                    onClick={toggleMute}
                    className="text-white hover:text-primary"
                  >
                    <FontAwesomeIcon icon={isMuted ? faVolumeMute : faVolumeUp} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      } else if (contentType.includes('pdf') || contentType.includes('lecture') || contentType.includes('note')) {
        const fileUrl = `/api/content/${content.id}/stream`;
        return (
          <div className="pdf-container h-full flex flex-col border border-gray-200 rounded-md overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Loading document...</span>
              </div>
            )}

            <div className="bg-gray-50 p-3 border-b flex justify-between items-center">
              <div className="flex items-center">
                <FontAwesomeIcon icon={faFileAlt} className="h-5 w-5 text-red-500 mr-2" />
                <span className="font-medium">PDF Document: {content.filename}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <FontAwesomeIcon icon={faDownload} className="mr-2" />
                Download PDF
              </Button>
            </div>

            <div className="flex-grow relative overflow-hidden bg-white">
              <iframe
                src={fileUrl}
                className="w-full h-full border-0"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setError("Failed to load PDF. Please try downloading instead.");
                }}
              />
            </div>
          </div>
        );
      } else if (contentType.includes('slide') || contentType.includes('presentation') || contentType.includes('ppt')) {
        const fileUrl = `/api/content/${content.id}/stream`;
        return (
          <div className="presentation-viewer-container h-full flex flex-col border border-gray-200 rounded-md overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Loading presentation...</span>
              </div>
            )}

            <div className="bg-blue-50 p-3 border-b flex justify-between items-center">
              <div className="flex items-center">
                <FontAwesomeIcon icon={faFileAlt} className="h-5 w-5 text-blue-500 mr-2" />
                <span className="font-medium">Presentation: {content.filename}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <FontAwesomeIcon icon={faDownload} className="mr-2" />
                Download Presentation
              </Button>
            </div>

            <div className="flex-grow relative overflow-hidden bg-white">
              <iframe
                src={fileUrl}
                className="w-full h-full border-0"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setError("Failed to load presentation. Please try downloading instead.");
                }}
              />
            </div>
          </div>
        );
      } else {
        // Generic content handler for other file types
        return (
          <div className="generic-content h-full flex flex-col items-center justify-center">
            <div className="p-8 text-center">
              <h3 className="text-lg font-semibold mb-2">Preview not available</h3>
              <p className="text-muted-foreground mb-4">
                This file type ({content.filename}) cannot be previewed directly.
              </p>
              <Button 
                onClick={(e) => {
                  const button = e.currentTarget;
                  button.classList.add('animate__animated', 'animate__bounce');
                  setTimeout(() => {
                    button.classList.remove('animate__animated', 'animate__bounce');
                  }, 1000);
                  handleDownload();
                }}
                className="hover:animate__animated hover:animate__pulse"
              >
                <FontAwesomeIcon icon={faDownload} className="mr-2" />
                Download File
              </Button>
            </div>
          </div>
        );
      }
    } catch (e) {
      console.error("Error rendering content:", e);
      return (
        <div className="error-container p-8 text-center">
          <h3 className="text-lg font-semibold mb-2 text-red-500">Error Displaying Content</h3>
          <p className="text-muted-foreground mb-4">
            There was a problem displaying this content. Please try downloading the file instead.
          </p>
          <Button 
            onClick={(e) => {
              const button = e.currentTarget;
              button.classList.add('animate__animated', 'animate__bounce');
              setTimeout(() => {
                button.classList.remove('animate__animated', 'animate__bounce');
              }, 1000);
              handleDownload();
            }}
            className="hover:animate__animated hover:animate__pulse"
          >
            <FontAwesomeIcon icon={faDownload} className="mr-2" />
            Download File
          </Button>
        </div>
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[85vh] h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle className="pr-10">
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
            <DialogDescription>
              <div className="flex justify-between">
                <span>{content.subject}</span>
                {content.faculty && <span>By: {content.faculty}</span>}
              </div>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-grow overflow-hidden relative">
          {error && (
            <div className="absolute top-0 left-0 right-0 bg-amber-50 text-amber-700 p-2 text-sm border-b border-amber-200">
              {error}
            </div>
          )}

          <div className="h-full overflow-auto pt-2">
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
                onClick={(e) => {
                  // Add bounce animation when clicked
                  const button = e.currentTarget;
                  button.classList.add('animate__animated', 'animate__bounce');

                  // Remove animation classes after animation completes
                  setTimeout(() => {
                    button.classList.remove('animate__animated', 'animate__bounce');
                  }, 1000);

                  handleDownload();
                }}
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

export default ContentPlayer;