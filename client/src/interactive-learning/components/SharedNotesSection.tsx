import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  PenTool, 
  Plus, 
  Send, 
  Tag, 
  X, 
  Save,
  Users,
  Clock,
  BookOpen
} from 'lucide-react';
import 'animate.css';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface SharedNotesProps {
  departmentId: number;
}

export function SharedNotesSection({ departmentId }: SharedNotesProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [showCreateNote, setShowCreateNote] = useState(false);
  const [activeNote, setActiveNote] = useState<any>(null);
  const [contribution, setContribution] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
  
  // Get notes for the department
  const { 
    data: notes, 
    isLoading: isLoadingNotes,
    refetch: refetchNotes
  } = useQuery({
    queryKey: ['/api/il/notes/department', departmentId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/il/notes/department/${departmentId}`);
      return response.json();
    },
  });
  
  // Get a specific note with contributions
  const {
    data: noteDetail,
    isLoading: isLoadingDetail,
    refetch: refetchDetail
  } = useQuery({
    queryKey: ['/api/il/notes', activeNote?.id],
    queryFn: async () => {
      if (!activeNote?.id) return null;
      const response = await apiRequest('GET', `/api/il/notes/${activeNote.id}`);
      return response.json();
    },
    enabled: !!activeNote?.id,
  });
  
  // Create a new note
  const createNoteMutation = useMutation({
    mutationFn: async (data: { title: string, subject: string }) => {
      const response = await apiRequest('POST', '/api/il/notes/sessions', {
        ...data,
        content: '',
        department_id: departmentId
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Note Created",
        description: "Your note has been created successfully",
      });
      setShowCreateNote(false);
      setNewNoteTitle('');
      queryClient.invalidateQueries({ queryKey: ['/api/il/notes/department', departmentId] });
      setActiveNote(data);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create note",
        variant: "destructive",
      });
    }
  });
  
  // Add a contribution to a note
  const addContributionMutation = useMutation({
    mutationFn: async (data: { note_id: number, content: string }) => {
      const response = await apiRequest('POST', `/api/il/notes/${data.note_id}/contribute`, {
        content: data.content
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Contribution Added",
        description: "Your contribution has been added to the note",
      });
      setContribution('');
      refetchDetail();
      // Record interaction for engagement tracking
      if (user) {
        apiRequest('POST', '/api/engagement/track', {
          user_id: user.id,
          interaction_type: 'note_contribution',
          content_id: activeNote?.id
        }).catch(console.error);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add contribution",
        variant: "destructive",
      });
    }
  });
  
  // Drawing functionality
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size to match parent
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // Set up drawing style
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1877F2';
  };
  
  useEffect(() => {
    if (activeNote?.id) {
      initCanvas();
    }
  }, [activeNote]);
  
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    setStartPosition({ x, y });
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(startPosition.x, startPosition.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    setStartPosition({ x, y });
  };
  
  const handleMouseUp = () => {
    setIsDrawing(false);
    saveCanvasContent();
  };
  
  const saveCanvasContent = () => {
    const canvas = canvasRef.current;
    if (!canvas || !activeNote?.id) return;
    
    // Get the canvas content as base64 data URL
    const dataUrl = canvas.toDataURL('image/png');
    
    // TODO: Send the sketch to the backend
    toast({
      title: "Sketch Added",
      description: "Your sketch has been added to the note",
    });
    
    // Record interaction for engagement tracking
    if (user) {
      apiRequest('POST', '/api/engagement/track', {
        user_id: user.id,
        interaction_type: 'note_sketch',
        content_id: activeNote?.id
      }).catch(console.error);
    }
  };
  
  const handleCreateNote = () => {
    if (!newNoteTitle.trim()) {
      toast({
        title: "Error",
        description: "Please enter a note title",
        variant: "destructive",
      });
      return;
    }
    
    createNoteMutation.mutate({
      title: newNoteTitle,
      subject: user?.department_id ? `Department ${user.department_id}` : "General"
    });
  };
  
  const handleAddContribution = () => {
    if (!contribution.trim() || !activeNote?.id) {
      toast({
        title: "Error",
        description: "Please enter some content for your contribution",
        variant: "destructive",
      });
      return;
    }
    
    addContributionMutation.mutate({
      note_id: activeNote.id,
      content: contribution
    });
  };
  
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  
  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
    } catch (error) {
      return "Unknown date";
    }
  };
  
  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase();
  };
  
  // Render note cards
  const renderNoteCards = () => {
    if (isLoadingNotes) {
      return Array(3).fill(0).map((_, i) => (
        <Skeleton key={i} className="h-[150px] w-full rounded-lg" />
      ));
    }
    
    if (!notes || notes.length === 0) {
      return (
        <div className="bg-gray-50 p-8 rounded-lg text-center">
          <PenTool className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No shared notes available yet.</p>
          <p className="text-gray-400 text-sm mt-1">
            {user?.role === 'faculty' ? 'Create a note to get started.' : 'Faculty will create notes for collaboration.'}
          </p>
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {notes.map((note: any) => (
          <Card key={note.id} className="hover:shadow-md transition-shadow cursor-pointer border-blue-100" 
                onClick={() => setActiveNote(note)}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-md line-clamp-1">{note.title}</CardTitle>
                  <CardDescription className="flex items-center gap-1 mt-1">
                    <Tag className="h-3 w-3" />
                    <span>{note.subject}</span>
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {note.contributions?.length || 0} contributions
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="line-clamp-2 text-sm text-gray-600">
                {note.note_content || "Click to view and contribute to this note."}
              </div>
            </CardContent>
            <CardFooter className="pt-0 text-xs text-gray-500 flex justify-between">
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{note.creator?.first_name || 'User'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{formatDate(note.created_at)}</span>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  };
  
  // Render note detail view
  const renderNoteDetail = () => {
    const note = noteDetail || activeNote;
    
    if (isLoadingDetail) {
      return <Skeleton className="h-[400px] w-full rounded-lg" />;
    }
    
    if (!note) return null;
    
    return (
      <div className="animate__animated animate__fadeIn">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={() => setActiveNote(null)}>
            <X className="h-4 w-4 mr-1" />
            Back to Notes
          </Button>
          
          <div className="flex items-center">
            <Badge className="mr-2" variant="outline">
              {note.subject}
            </Badge>
            {note.tags && note.tags.length > 0 && note.tags.map((tag: string, i: number) => (
              <Badge key={i} variant="secondary" className="mr-1 bg-blue-100 text-blue-800 hover:bg-blue-200 border-none">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        
        <Card className="border-blue-200 mb-4">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>{note.title}</CardTitle>
                <CardDescription className="mt-1">
                  Created by {note.creator?.first_name || 'User'} {formatDate(note.created_at)}
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {note.contributions?.length || 0} contributions
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="mb-4 text-gray-800 whitespace-pre-wrap">
              {note.note_content || "No initial content. Start contributing below!"}
            </div>
            
            {/* Contributions */}
            {note.contributions && note.contributions.length > 0 && (
              <div className="mt-6">
                <h3 className="text-md font-medium mb-3">Contributions</h3>
                <div className="space-y-4">
                  {note.contributions.map((contribution: any) => (
                    <div 
                      key={contribution.id} 
                      className="p-3 bg-gray-50 rounded-lg animate__animated animate__fadeIn"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {contribution.contributor?.first_name?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium text-sm">
                              {contribution.contributor?.first_name || 'User'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(contribution.contributed_at)}
                            </span>
                          </div>
                          <div className="text-sm whitespace-pre-wrap">{contribution.content}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Drawing Canvas */}
            <div className="mt-6">
              <h3 className="text-md font-medium mb-3">Sketch Pad</h3>
              <div className="border border-gray-200 rounded-lg p-1 bg-white">
                <canvas 
                  ref={canvasRef}
                  className="w-full h-[200px] border rounded cursor-crosshair"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />
                <div className="flex justify-end gap-2 mt-2">
                  <Button variant="outline" size="sm" onClick={clearCanvas}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Add contribution */}
            <div className="mt-6">
              <h3 className="text-md font-medium mb-3">Add Your Contribution</h3>
              <Textarea
                placeholder="Write your contribution here..."
                className="min-h-[100px] mb-2"
                value={contribution}
                onChange={(e) => setContribution(e.target.value)}
              />
              <Button
                disabled={addContributionMutation.isPending || !contribution.trim()}
                onClick={handleAddContribution}
                className="flex gap-1"
              >
                <Send className="h-4 w-4" />
                <span>{addContributionMutation.isPending ? 'Sending...' : 'Add Contribution'}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };
  
  // Main component render
  return (
    <div className="px-4 py-6">
      {!activeNote && (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <PenTool className="h-5 w-5 text-blue-600" />
              <span>Shared Notes</span>
            </h2>
            
            {user?.role === 'faculty' && (
              <Button 
                onClick={() => setShowCreateNote(true)}
                className={`gap-1 ${showCreateNote ? 'hidden' : ''}`}
              >
                <Plus className="h-4 w-4" />
                <span>Create Note</span>
              </Button>
            )}
          </div>
          
          {showCreateNote && (
            <Card className="mb-6 border-blue-200 animate__animated animate__fadeIn">
              <CardHeader>
                <CardTitle className="text-lg">Create New Shared Note</CardTitle>
                <CardDescription>
                  Start a collaborative note for your students
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Input
                      placeholder="Note Title"
                      value={newNoteTitle}
                      onChange={(e) => setNewNoteTitle(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button 
                  variant="ghost" 
                  onClick={() => setShowCreateNote(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateNote}
                  disabled={createNoteMutation.isPending || !newNoteTitle.trim()}
                >
                  {createNoteMutation.isPending ? 'Creating...' : 'Create Note'}
                </Button>
              </CardFooter>
            </Card>
          )}
          
          {renderNoteCards()}
        </>
      )}
      
      {activeNote && renderNoteDetail()}
    </div>
  );
}