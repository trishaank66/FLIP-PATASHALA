import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart3,
  ListFilter,
  PlusCircle,
  RefreshCcw,
  Clock,
  AlertCircle,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PollCreator } from './PollCreator';
import { PollTaker } from './PollTaker';
import { PollResultsChart } from './PollResults';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface User {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
}

interface Poll {
  id: number;
  title: string;
  question: string;
  options: { id: number; text: string }[];
  created_by: number;
  subject: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  department_id: number | null;
  timer_duration: number;
  tags: string[] | null;
  content_id: number | null;
  creator?: User;
  userVote?: number | null;
}

interface PollsSectionProps {
  user: User;
  departmentId?: number;
  subject?: string;
}

/**
 * Displays polls with tabs for active, completed, and created polls
 */
export function PollsSection({ user, departmentId, subject }: PollsSectionProps) {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [showVoteDialog, setShowVoteDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState<string | 'all'>('all');
  const [activeSort, setActiveSort] = useState<'newest' | 'oldest' | 'expiringSoon'>('newest');

  // Query all polls
  const { data: polls, isLoading, refetch } = useQuery<Poll[]>({
    queryKey: ['/api/il/polls', departmentId, subject],
    staleTime: 10 * 1000, // 10 seconds
  });

  // Refetch periodically to get latest poll data
  useEffect(() => {
    const intervalId = setInterval(() => {
      refetch();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [refetch]);

  // Filter and sort polls
  const filteredPolls = React.useMemo(() => {
    if (!polls) return { active: [], completed: [], created: [] };
    
    let filtered = polls;
    
    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(poll => 
        poll.title.toLowerCase().includes(search) || 
        poll.question.toLowerCase().includes(search) ||
        (poll.tags && poll.tags.some(tag => tag.toLowerCase().includes(search)))
      );
    }
    
    // Apply subject filter
    if (filterSubject !== 'all') {
      filtered = filtered.filter(poll => poll.subject === filterSubject);
    }
    
    // Sort active polls
    let sortedActive = filtered.filter(poll => poll.is_active);
    if (activeSort === 'newest') {
      sortedActive.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (activeSort === 'oldest') {
      sortedActive.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (activeSort === 'expiringSoon') {
      sortedActive.sort((a, b) => {
        const aExpiry = a.expires_at ? new Date(a.expires_at).getTime() : Number.MAX_SAFE_INTEGER;
        const bExpiry = b.expires_at ? new Date(b.expires_at).getTime() : Number.MAX_SAFE_INTEGER;
        return aExpiry - bExpiry;
      });
    }
    
    return {
      active: sortedActive,
      completed: filtered.filter(poll => !poll.is_active),
      created: filtered.filter(poll => poll.created_by === user.id),
    };
  }, [polls, searchTerm, filterSubject, activeSort, user.id]);

  const uniqueSubjects = React.useMemo(() => {
    if (!polls) return [];
    // Use Array.from instead of spread operator to avoid Set iteration issues
    return Array.from(new Set(polls.map(poll => poll.subject)));
  }, [polls]);

  const handlePollCreated = () => {
    setCreateDialogOpen(false);
    refetch();
    toast({
      title: "Poll Created",
      description: "Your poll has been created and is now active.",
    });
  };

  const handleVoted = () => {
    setShowVoteDialog(false);
    refetch();
    toast({
      title: "Vote Recorded",
      description: "Your vote has been recorded. View results to see current standings.",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Loading Polls...</h2>
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate__animated animate__fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold flex items-center">
          <BarChart3 className="mr-2 h-6 w-6" />
          Real-time Polls
        </h2>
        
        {user.role !== 'student' && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="animate__animated animate__pulse animate__infinite animate__slow">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Poll
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Poll</DialogTitle>
                <DialogDescription>
                  Create a real-time poll for students to engage with.
                </DialogDescription>
              </DialogHeader>
              <PollCreator 
                userId={user.id} 
                departmentId={departmentId} 
                subject={subject || ''}
                onPollCreated={handlePollCreated}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
      
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search polls by title, question or tags..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={filterSubject} onValueChange={(value) => setFilterSubject(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {uniqueSubjects.map(subject => (
                <SelectItem key={subject} value={subject}>{subject}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => refetch()}
            title="Refresh polls"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">Active Polls</TabsTrigger>
          <TabsTrigger value="completed">Completed Polls</TabsTrigger>
          <TabsTrigger value="created">Created by You</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="space-y-4 pt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Active Polls ({filteredPolls.active.length})</h3>
            <Select value={activeSort} onValueChange={(value: 'newest' | 'oldest' | 'expiringSoon') => setActiveSort(value)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">
                  <div className="flex items-center">
                    Newest First
                  </div>
                </SelectItem>
                <SelectItem value="oldest">
                  <div className="flex items-center">
                    Oldest First
                  </div>
                </SelectItem>
                <SelectItem value="expiringSoon">
                  <div className="flex items-center">
                    <Clock className="mr-2 h-4 w-4" />
                    Expiring Soon
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {filteredPolls.active.length === 0 ? (
            <EmptyState
              icon={<AlertCircle className="h-10 w-10 text-muted-foreground" />}
              title="No Active Polls"
              description="There are no active polls at the moment. Check back later or create a new poll."
            >
              {user.role !== 'student' && (
                <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create New Poll
                </Button>
              )}
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPolls.active.map(poll => (
                <div key={poll.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold line-clamp-1">{poll.title}</h3>
                    {poll.tags && poll.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {poll.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                        {poll.tags.length > 2 && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                            +{poll.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{poll.question}</p>
                  
                  <div className="flex items-center text-xs text-muted-foreground mb-3">
                    <span>
                      {poll.creator 
                        ? `By ${poll.creator.first_name || ''} ${poll.creator.last_name || ''}`
                        : 'By Faculty'}
                    </span>
                    <span className="mx-2">•</span>
                    <span>{poll.subject}</span>
                    {poll.timer_duration > 0 && (
                      <>
                        <span className="mx-2">•</span>
                        <Clock className="h-3 w-3 mr-1" />
                        <span>{poll.timer_duration}s</span>
                      </>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {!poll.userVote ? (
                      <Button 
                        variant="default" 
                        className="flex-1"
                        onClick={() => {
                          setSelectedPoll(poll);
                          setShowVoteDialog(true);
                        }}
                      >
                        Vote Now
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => {
                          setSelectedPoll(poll);
                          setShowResultsDialog(true);
                        }}
                      >
                        View Results
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="completed" className="space-y-4 pt-4">
          <h3 className="text-lg font-medium">Completed Polls ({filteredPolls.completed.length})</h3>
          
          {filteredPolls.completed.length === 0 ? (
            <EmptyState
              icon={<AlertCircle className="h-10 w-10 text-muted-foreground" />}
              title="No Completed Polls"
              description="There are no completed polls yet."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPolls.completed.map(poll => (
                <div key={poll.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-muted/10">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold line-clamp-1">{poll.title}</h3>
                    {poll.tags && poll.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {poll.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                        {poll.tags.length > 2 && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                            +{poll.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{poll.question}</p>
                  
                  <div className="flex items-center text-xs text-muted-foreground mb-3">
                    <span>
                      {poll.creator 
                        ? `By ${poll.creator.first_name || ''} ${poll.creator.last_name || ''}`
                        : 'By Faculty'}
                    </span>
                    <span className="mx-2">•</span>
                    <span>{poll.subject}</span>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setSelectedPoll(poll);
                      setShowResultsDialog(true);
                    }}
                  >
                    View Results
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="created" className="space-y-4 pt-4">
          <h3 className="text-lg font-medium">Created by You ({filteredPolls.created.length})</h3>
          
          {filteredPolls.created.length === 0 ? (
            <EmptyState
              icon={<AlertCircle className="h-10 w-10 text-muted-foreground" />}
              title="No Polls Created Yet"
              description="You haven't created any polls yet."
            >
              {user.role !== 'student' && (
                <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create New Poll
                </Button>
              )}
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPolls.created.map(poll => (
                <div key={poll.id} className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${!poll.is_active ? 'bg-muted/10' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold line-clamp-1">
                      {poll.title}
                      {!poll.is_active && <span className="ml-2 text-xs text-muted-foreground">(Completed)</span>}
                    </h3>
                    {poll.tags && poll.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {poll.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                        {poll.tags.length > 2 && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                            +{poll.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{poll.question}</p>
                  
                  <div className="flex items-center text-xs text-muted-foreground mb-3">
                    <span>{poll.subject}</span>
                    {poll.timer_duration > 0 && (
                      <>
                        <span className="mx-2">•</span>
                        <Clock className="h-3 w-3 mr-1" />
                        <span>{poll.timer_duration}s</span>
                      </>
                    )}
                    <span className="mx-2">•</span>
                    <span>Created: {new Date(poll.created_at).toLocaleDateString()}</span>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setSelectedPoll(poll);
                      setShowResultsDialog(true);
                    }}
                  >
                    View Results
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Vote Dialog */}
      {selectedPoll && (
        <Dialog open={showVoteDialog} onOpenChange={setShowVoteDialog}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedPoll.title}</DialogTitle>
              <DialogDescription>
                {selectedPoll.question}
              </DialogDescription>
            </DialogHeader>
            <PollTaker 
              pollId={selectedPoll.id} 
              userId={user.id}
              departmentId={departmentId}
              subject={selectedPoll.subject}
              onVoted={handleVoted}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Results Dialog */}
      {selectedPoll && (
        <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedPoll.title} - Results</DialogTitle>
              <DialogDescription>
                {selectedPoll.question}
              </DialogDescription>
            </DialogHeader>
            <PollResultsChart 
              pollId={selectedPoll.id} 
              userId={user.id}
              isFaculty={selectedPoll.created_by === user.id}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}