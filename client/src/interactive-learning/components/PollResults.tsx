import React, { useEffect, useState } from 'react';
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
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from '@tanstack/react-query';
import { PollService } from '../services/poll-service';
import { WebSocketManager } from '../services/websocket-manager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  TooltipItem,
} from 'chart.js';
import { Download, X, Clock, AlarmClock, FilePlus, BarChart3, PieChart } from 'lucide-react';

// Register Chart.js components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

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

interface PollResultsProps {
  pollId: number;
  userId: number;
  isFaculty: boolean;
  onClosePoll?: () => void;
}

/**
 * Poll results component with charts
 */
export function PollResultsChart({ pollId, userId, isFaculty, onClosePoll }: PollResultsProps) {
  const { toast } = useToast();
  const [results, setResults] = useState<PollResults | null>(null);
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [relatedContent, setRelatedContent] = useState<any[]>([]);
  
  // Initialize WebSocket for real-time updates
  useEffect(() => {
    const wsManager = WebSocketManager.getInstance();
    
    // Listen for poll vote updates
    const handlePollVote = (data: any) => {
      if (data.pollId === pollId) {
        setResults(data.results);
      }
    };
    
    // Listen for poll closed events
    const handlePollClosed = (data: any) => {
      if (data.pollId === pollId) {
        setResults(data.results);
        toast({
          title: "Poll Closed",
          description: "The poll has been closed",
        });
      }
    };
    
    wsManager.addEventListener('poll:vote', handlePollVote);
    wsManager.addEventListener('poll:closed', handlePollClosed);
    
    return () => {
      wsManager.removeEventListener('poll:vote', handlePollVote);
      wsManager.removeEventListener('poll:closed', handlePollClosed);
    };
  }, [pollId, toast]);
  
  // Fetch poll results
  const { data: pollResults, isLoading, isError } = useQuery({
    queryKey: ['/api/il/polls', pollId, 'results'],
    queryFn: async () => {
      return await PollService.getPollResults(pollId);
    },
    refetchInterval: 5000, // Refetch every 5 seconds in case WebSocket fails
  });
  
  // Fetch related content
  useEffect(() => {
    if (results?.poll) {
      PollService.getRelatedContent(pollId)
        .then(content => {
          setRelatedContent(content);
        })
        .catch(error => {
          console.error("Error fetching related content:", error);
        });
    }
  }, [pollId, results?.poll]);
  
  // Update local results when poll results change
  useEffect(() => {
    if (pollResults) {
      setResults(pollResults);
      
      // Calculate time left if poll is active and has expiration
      if (pollResults.poll.is_active && pollResults.poll.expires_at) {
        const expiresAt = new Date(pollResults.poll.expires_at).getTime();
        const now = new Date().getTime();
        const timeLeftMs = Math.max(0, expiresAt - now);
        setTimeLeft(Math.floor(timeLeftMs / 1000));
        
        // Set up timer to update time left
        const timer = setInterval(() => {
          setTimeLeft((prevTime) => {
            if (prevTime === null || prevTime <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prevTime - 1;
          });
        }, 1000);
        
        return () => clearInterval(timer);
      } else {
        setTimeLeft(null);
      }
    }
  }, [pollResults]);
  
  // Close poll mutation (for faculty)
  const closePollMutation = useMutation({
    mutationFn: () => {
      return PollService.closePoll(pollId);
    },
    onSuccess: () => {
      toast({
        title: "Poll Closed",
        description: "The poll has been closed successfully",
      });
      
      if (onClosePoll) {
        onClosePoll();
      }
    },
    onError: (error) => {
      toast({
        title: "Error Closing Poll",
        description: error instanceof Error ? error.message : "Failed to close the poll",
        variant: "destructive",
      });
    },
  });
  
  // Export results as CSV
  const exportResults = () => {
    if (!results) return;
    
    const { poll, votes, percentages } = results;
    const headers = ["Option", "Votes", "Percentage"];
    const rows = poll.options.map(option => [
      option.text,
      votes[option.text] || 0,
      `${percentages[option.text] || 0}%`
    ]);
    
    const csvContent = [
      `Poll: ${poll.title}`,
      `Question: ${poll.question}`,
      "",
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    link.setAttribute("href", url);
    link.setAttribute("download", `poll-results-${pollId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Generate colors for the chart
  const generateChartColors = (count: number) => {
    const baseColors = [
      'rgba(37, 99, 235, 0.8)',   // blue-600
      'rgba(220, 38, 38, 0.8)',   // red-600
      'rgba(5, 150, 105, 0.8)',   // emerald-600
      'rgba(217, 119, 6, 0.8)',   // amber-600
      'rgba(124, 58, 237, 0.8)',  // violet-600
      'rgba(236, 72, 153, 0.8)',  // pink-600
      'rgba(77, 124, 15, 0.8)',   // lime-700
      'rgba(14, 165, 233, 0.8)',  // sky-500
      'rgba(168, 85, 247, 0.8)',  // purple-500
      'rgba(234, 88, 12, 0.8)'    // orange-600
    ];
    
    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(baseColors[i % baseColors.length]);
    }
    
    return colors;
  };
  
  // Prepare chart data
  const prepareChartData = () => {
    if (!results) return null;
    
    const { poll, votes } = results;
    const labels = poll.options.map(option => option.text);
    const data = poll.options.map(option => votes[option.text] || 0);
    const backgroundColor = generateChartColors(labels.length);
    
    return {
      labels,
      datasets: [
        {
          label: 'Votes',
          data,
          backgroundColor,
          borderColor: backgroundColor.map(color => color.replace(", 0.8)", ", 1)")),
          borderWidth: 1,
        },
      ],
    };
  };
  
  const chartData = prepareChartData();
  
  // Chart options
  const pieChartOptions = {
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        callbacks: {
          label: (tooltipItem: TooltipItem<'pie'>) => {
            const label = tooltipItem.label || '';
            const value = tooltipItem.parsed || 0;
            const dataset = tooltipItem.dataset;
            const total = dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return `${label}: ${value} votes (${percentage}%)`;
          }
        }
      }
    },
    maintainAspectRatio: false,
  };
  
  const barChartOptions = {
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (tooltipItem: TooltipItem<'bar'>) => {
            const value = tooltipItem.parsed.y || 0;
            const dataset = tooltipItem.dataset;
            const total = dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return `${value} votes (${percentage}%)`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
        },
      },
    },
    maintainAspectRatio: false,
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
  
  if (isError || !results || !chartData) {
    return (
      <Card className="w-full animate__animated animate__fadeIn">
        <CardContent className="pt-6">
          <div className="text-center py-4 text-destructive">
            Error loading poll results. Please try again later.
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const { poll, total } = results;
  const hasExpired = !poll.is_active || (timeLeft !== null && timeLeft <= 0);
  
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
          
          <div className="flex items-center space-x-2">
            {!hasExpired && timeLeft !== null && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{timeLeft}s left</span>
              </Badge>
            )}
            
            {hasExpired && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <AlarmClock className="h-3 w-3" />
                <span>Poll Closed</span>
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex justify-between items-center mt-4">
          <span className="text-sm text-muted-foreground">
            Created by {creatorName} • {total} {total === 1 ? 'vote' : 'votes'}
          </span>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportResults}
              className="flex items-center gap-1"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            
            {isFaculty && poll.is_active && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => closePollMutation.mutate()}
                disabled={closePollMutation.isPending}
                className="flex items-center gap-1"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {closePollMutation.isPending ? 'Closing...' : 'Close Poll'}
                </span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="mb-4">
          <Tabs defaultValue="pie" onValueChange={(value) => setChartType(value as 'pie' | 'bar')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pie" className="flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                <span>Pie Chart</span>
              </TabsTrigger>
              <TabsTrigger value="bar" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span>Bar Chart</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="pie" className="mt-4">
              <div className="w-full h-[300px] flex items-center justify-center">
                <Pie data={chartData} options={pieChartOptions} />
              </div>
            </TabsContent>
            
            <TabsContent value="bar" className="mt-4">
              <div className="w-full h-[300px] flex items-center justify-center">
                <Bar data={chartData} options={barChartOptions} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        {relatedContent.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium mb-2">Related Content</h3>
            <div className="space-y-2">
              {relatedContent.map((content) => (
                <Button 
                  key={content.id}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-left"
                  asChild
                >
                  <a 
                    href={`/content/${content.id}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <FilePlus className="h-4 w-4" />
                    <span>{content.title}</span>
                  </a>
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      
      {poll.tags && poll.tags.length > 0 && (
        <CardFooter className="flex flex-wrap gap-2 text-xs text-muted-foreground border-t pt-4">
          <span>Tags:</span>
          {poll.tags.map((tag, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </CardFooter>
      )}
    </Card>
  );
}