import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from "@/hooks/use-toast";
import { PollService } from '../services/poll-service';
import { WebSocketManager } from '../services/websocket-manager';
import { trackInteraction } from '../services/engagement-service';
import { Clock, User, ThumbsUp, AlertTriangle } from 'lucide-react';
import 'animate.css';

interface PollOption {
  id: number;
  text: string;
}

interface Poll {
  id: number;
  title: string;
  question: string;
  options: PollOption[];
  created_by: number;
  subject: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  timer_duration: number;
  tags: string[] | null;
  creator?: {
    id: number;
    first_name: string | null;
    last_name: string | null;
  };
}

interface PollResults {
  poll: Poll;
  votes: { [key: string]: number };
  total: number;
  percentages: { [key: string]: number };
}

interface PollTakerProps {
  pollId: number;
  userId: number;
  departmentId?: number;
  subject: string;
  onVoted?: () => void;
}

/**
 * Poll taker component for students to vote
 */
export function PollTaker({ pollId, userId, departmentId, subject, onVoted }: PollTakerProps) {
  const { toast } = useToast();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [results, setResults] = useState<PollResults | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);
  
  // Initialize WebSocket for real-time updates
  useEffect(() => {
    const wsManager = WebSocketManager.getInstance();
    
    // Listen for poll closed events
    const handlePollClosed = (data: any) => {
      if (data.pollId === pollId) {
        setResults(data.results);
        setExpired(true);
        toast({
          title: "Poll Closed",
          description: "The poll has been closed by the instructor",
        });
      }
    };
    
    wsManager.addEventListener('poll:closed', handlePollClosed);
    
    return () => {
      wsManager.removeEventListener('poll:closed', handlePollClosed);
    };
  }, [pollId, toast]);
  
  // Fetch poll data
  const { data: poll, isLoading, isError } = useQuery({
    queryKey: ['/api/il/polls', pollId],
    queryFn: async () => {
      return await PollService.getPoll(pollId);
    },
  });
  
  // Check if user has already voted
  useEffect(() => {
    if (poll) {
      // Check if poll has expired
      if (poll.expires_at) {
        const expiresAt = new Date(poll.expires_at).getTime();
        const now = new Date().getTime();
        if (now > expiresAt) {
          setExpired(true);
        } else {
          // Set up timer to count down to expiration
          const timeLeftMs = Math.max(0, expiresAt - now);
          setTimeLeft(Math.floor(timeLeftMs / 1000));
          
          const timer = setInterval(() => {
            setTimeLeft((prevTime) => {
              if (prevTime === null || prevTime <= 1) {
                clearInterval(timer);
                setExpired(true);
                return 0;
              }
              return prevTime - 1;
            });
          }, 1000);
          
          return () => clearInterval(timer);
        }
      }
      
      // After a successful poll fetch, check if user has voted
      PollService.getPollResults(pollId)
        .then((pollResults) => {
          setResults(pollResults);
          const userVotes = Object.entries(pollResults.votes).reduce((total, [option, votes]) => {
            // This is simplified; in a real app we'd track which users voted for what options
            // For this demo, we're just assuming if there are any votes, the user might have voted
            return total + votes;
          }, 0);
          
          if (userVotes > 0) {
            // For demo purposes we don't track individual user votes,
            // so we're considering the user has voted if there are any votes
            // In a real app, we'd check if the user's ID is in the voters list
            // setHasVoted(true);
          }
        })
        .catch((error) => {
          console.error("Error checking if user has voted:", error);
        });
    }
  }, [poll, pollId]);
  
  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: () => {
      if (selectedOption === null) {
        throw new Error("Please select an option to vote");
      }
      return PollService.voteOnPoll(pollId, selectedOption, userId);
    },
    onSuccess: (data) => {
      setResults(data);
      setHasVoted(true);
      toast({
        title: "Vote Recorded",
        description: "Your vote has been recorded successfully",
      });
      
      // Track this interaction for engagement tracking
      trackInteraction(userId, 'poll_vote', pollId);
      
      if (onVoted) {
        onVoted();
      }
    },
    onError: (error) => {
      toast({
        title: "Error Voting",
        description: error instanceof Error ? error.message : "Failed to record your vote",
        variant: "destructive",
      });
    },
  });
  
  // Handle option selection
  const handleOptionSelect = (optionId: number) => {
    setSelectedOption(optionId);
  };
  
  // Handle vote submission
  const handleVote = () => {
    if (selectedOption === null) {
      toast({
        title: "Please Select an Option",
        description: "You must select an option to vote",
        variant: "destructive",
      });
      return;
    }
    
    voteMutation.mutate();
  };
  
  if (isLoading) {
    return (
      <Card className="w-full animate__animated animate__fadeIn">
        <CardContent className="pt-6">
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (isError || !poll) {
    return (
      <Card className="w-full animate__animated animate__fadeIn">
        <CardContent className="pt-6">
          <div className="text-center py-4 text-destructive">
            Error loading poll. Please try again later.
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Format creator name if available
  const creatorName = poll.creator 
    ? `${poll.creator.first_name || ''} ${poll.creator.last_name || ''}`.trim() || 'Faculty' 
    : 'Faculty';
  
  return (
    <Card className="w-full animate__animated animate__fadeIn">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl font-bold">{poll.title}</CardTitle>
            <CardDescription className="mt-1">
              {poll.question}
            </CardDescription>
          </div>
          
          {!expired && timeLeft !== null && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{timeLeft}s left</span>
            </Badge>
          )}
          
          {expired && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Poll Closed</span>
            </Badge>
          )}
        </div>
        
        <div className="flex items-center mt-2 text-sm text-muted-foreground">
          <User className="h-3 w-3 mr-1" />
          <span>Created by {creatorName}</span>
        </div>
      </CardHeader>
      
      <CardContent>
        {hasVoted || expired ? (
          <div className="space-y-6 pt-2">
            <div className="bg-muted/30 p-4 rounded-lg text-center">
              {hasVoted ? (
                <div className="flex flex-col items-center">
                  <ThumbsUp className="h-6 w-6 text-green-500 mb-2" />
                  <p className="font-medium">Your vote has been recorded!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You'll see the results when the poll closes
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <AlertTriangle className="h-6 w-6 text-amber-500 mb-2" />
                  <p className="font-medium">This poll is now closed</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You can no longer vote in this poll
                  </p>
                </div>
              )}
            </div>
            
            {results && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Results:</h3>
                {poll.options.map((option: PollOption) => {
                  const votes = results.votes[option.text] || 0;
                  const percentage = results.percentages[option.text] || 0;
                  
                  return (
                    <div key={option.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{option.text}</span>
                        <span>{votes} votes ({Math.round(percentage)}%)</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
                
                <div className="text-xs text-right text-muted-foreground">
                  Total votes: {results.total}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-3">
              {poll.options.map((option) => (
                <div
                  key={option.id}
                  className={`p-3 border rounded-md cursor-pointer transition-colors ${
                    selectedOption === option.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => handleOptionSelect(option.id)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border ${
                        selectedOption === option.id
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground'
                      }`}
                    >
                      {selectedOption === option.id && (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-1 h-1 rounded-full bg-white"></div>
                        </div>
                      )}
                    </div>
                    <span>{option.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      
      {!hasVoted && !expired && (
        <CardFooter className="flex justify-end pt-2">
          <Button
            onClick={handleVote}
            disabled={selectedOption === null || voteMutation.isPending}
          >
            {voteMutation.isPending ? 'Submitting...' : 'Submit Vote'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}