import { useAuth } from "@/hooks/use-auth";
import { PageLayout } from "@/components/ui/page-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { 
  Braces, BookOpen, MessageCircle, BarChart4, PenTool, 
  HeartPulse, BookOpenCheck, Sparkles, BrainCircuit, PlusCircle,
  EyeIcon, Clock, Award, RotateCw, Send, ThumbsUp, ThumbsDown,
  Users, Calendar, Tag, PinIcon, X, Check, CheckCircle
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import 'animate.css';
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow, parseISO } from "date-fns";
import { QuizCreator } from "../components/QuizManager";
import { QuizTaker } from "../components/QuizTaker";
import PendingQuizzes from "../components/PendingQuizzes";
import CompletedQuizzes from "../components/CompletedQuizzes";
import { ForumSection } from "../components/ForumSection";
import { PollsSection } from "../components/PollsSection";
import { EngagementCounter } from "../components/EngagementCounter";
import { FacultyEngagementDashboard } from "../components/FacultyEngagementDashboard";
import { SharedNotesSection } from "../components/SharedNotesSection";
import AITipsSection from "../components/AITipsSection";
import ClassInsightsSection from "../components/ClassInsightsSection";
import SystemOverviewSection from "../components/SystemOverviewSection";

// Define types for our API responses
interface User {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

interface Department {
  id: number;
  name: string;
  description: string | null;
}

interface Content {
  id: number;
  title: string;
  description: string | null;
  subject: string;
  type: string;
  filename: string;
  url: string;
}

interface IlQuiz {
  id: number;
  title: string;
  description: string | null;
  content_id: number | null;
  subject: string;
  difficulty: string;
  created_by: number;
  questions: any;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  department_id: number | null;
  creator?: User;
  content?: Content;
  department?: Department;
  attempts?: IlQuizAttempt[];
}

interface IlQuizAttempt {
  id: number;
  quiz_id: number;
  student_id: number;
  score: number;
  answers: any;
  time_taken: number | null;
  completed_at: string;
  difficulty_level: string;
  student?: User;
}

interface IlForumPost {
  id: number;
  title: string;
  content_text: string;
  user_id: number;
  subject: string;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
  pinned_by: number | null;
  content_id: number | null;
  department_id: number | null;
  is_active: boolean;
  author?: User;
  pinner?: User;
  content?: Content;
  department?: Department;
  replies?: IlForumReply[];
}

interface IlForumReply {
  id: number;
  post_id: number;
  content: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  author?: User;
  post?: IlForumPost;
}

interface IlPoll {
  id: number;
  title: string;
  question: string;
  options: any;
  created_by: number;
  subject: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  department_id: number | null;
  creator?: User;
  department?: Department;
  votes?: IlPollVote[];
}

interface IlPollVote {
  id: number;
  poll_id: number;
  user_id: number;
  option_index: number;
  voted_at: string;
  user?: User;
  poll?: IlPoll;
}

interface IlSharedNote {
  id: number;
  title: string;
  note_content: string;
  created_by: number;
  subject: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  department_id: number | null;
  content_id: number | null;
  creator?: User;
  department?: Department;
  content?: Content;
  contributions?: IlNoteContribution[];
}

interface IlNoteContribution {
  id: number;
  note_id: number;
  user_id: number;
  content: string;
  contributed_at: string;
  contributor?: User;
  note?: IlSharedNote;
}

interface IlAiTip {
  id: number;
  user_id: number;
  content: string;
  type: string; // This maps to tip_type in AITip
  is_read: boolean;
  is_helpful: boolean | null;
  created_at: string;
  expires_at: string | null;
  user?: User;
  // Additional fields needed to match AITip type
  tip_type: string; // Same as type field above
  priority: number;
  relevance_score: number;
  action_link: string | null;
  context: string | null;
  ui_style: string;
  source_type: string;
}

/**
 * Interactive Learning Module main page with tabs for different features
 */
export default function InteractiveLearningPage() {
  const { user } = useAuth();
  
  if (!user) {
    return (
      <PageLayout title="Interactive Learning">
        <Card className="p-8 text-center">
          <CardContent>
            <p>Please log in to access the Interactive Learning features.</p>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }
  const [animationClass, setAnimationClass] = useState("animate__fadeIn");
  const [activeFeature, setActiveFeature] = useState("dashboard");
  const [createQuizMode, setCreateQuizMode] = useState(false);
  const [activeQuizId, setActiveQuizId] = useState<number | null>(null);
  const { toast } = useToast();
  
  // Get user department ID for fetching relevant content
  const departmentId = user?.department_id || 1;
  
  useEffect(() => {
    // Trigger a pulse animation after initial fade in
    const timer = setTimeout(() => {
      setAnimationClass("animate__pulse");
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);

  // Get AI tips for the user
  const { 
    data: rawAiTips, 
    isLoading: isLoadingTips 
  } = useQuery<IlAiTip[]>({
    queryKey: ['/api/il/ai-tips'],
    enabled: activeFeature === "dashboard",
  });
  
  // Transform IlAiTip to match AITip interface completely
  const aiTips = useMemo(() => {
    if (!rawAiTips) return [];
    return rawAiTips.map(tip => ({
      id: tip.id,
      content: tip.content || '',
      tip_type: tip.tip_type || tip.type || 'info',
      priority: tip.priority || 1,
      relevance_score: tip.relevance_score || 0.5,
      expires_at: tip.expires_at || null,
      action_link: tip.action_link || null,
      context: tip.context || null,
      ui_style: tip.ui_style || 'standard',
      source_type: tip.source_type || 'system',
      is_read: tip.is_read || false,
      is_helpful: tip.is_helpful,
      created_at: tip.created_at || new Date().toISOString()
    }));
  }, [rawAiTips]);
  
  // Define types for insights data
  type ClassInsight = {
    insights: {
      subject_averages: Record<string, number>;
      most_challenging_subject: {
        name: string;
        average_score: number;
      };
      struggling_students: Record<string, { name: string; average: number }>;
      excelling_students: Record<string, { name: string; average: number }>;
      class_average: number;
      average_engagement: number;
      total_students: number;
    };
    department_id?: number;
    subject?: string;
    faculty_id: number;
  };

  type SystemOverview = {
    overview: {
      statistics: {
        active_users: number;
        total_quizzes: number;
        total_posts: number;
        total_votes: number;
        total_notes: number;
      };
      department_activity: Array<{
        name: string;
        user_count: number;
        interaction_count: number;
        avg_per_user: number;
      }>;
      activity_trend: Record<string, number>;
    };
  };

  // Get class insights data (for faculty)
  const {
    data: classInsights,
    isLoading: isLoadingClassInsights
  } = useQuery<ClassInsight>({
    queryKey: ['/api/il/insights/class'],
    enabled: activeFeature === "dashboard" && user.role === 'faculty',
  });
  
  // Get system overview data (for admin)
  const {
    data: systemOverview,
    isLoading: isLoadingSystemOverview
  } = useQuery<SystemOverview>({
    queryKey: ['/api/il/insights/system'],
    enabled: activeFeature === "dashboard" && user.role === 'admin',
  });
  
  // Mark an AI tip as read with feedback
  const markTipReadMutation = useMutation({
    mutationFn: async ({ tipId, isHelpful }: { tipId: number, isHelpful?: boolean }) => {
      const response = await apiRequest(
        "PUT", 
        `/api/il/ai-tips/${tipId}/read`, 
        { is_helpful: isHelpful }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/il/ai-tips'] });
    },
  });
  
  // Fetch quizzes for the user's department
  const { 
    data: quizzes, 
    isLoading: isLoadingQuizzes 
  } = useQuery<IlQuiz[]>({
    queryKey: [`/api/il/quizzes/department/${departmentId}`],
    enabled: activeFeature === "quizzes",
  });
  
  // Fetch forum posts for the user's department
  const { 
    data: forumPosts, 
    isLoading: isLoadingForumPosts 
  } = useQuery<IlForumPost[]>({
    queryKey: [`/api/il/forum/department/${departmentId}`],
    enabled: activeFeature === "forum",
  });
  
  // Fetch polls for the user's department
  const { 
    data: polls, 
    isLoading: isLoadingPolls 
  } = useQuery<IlPoll[]>({
    queryKey: [`/api/il/polls/department/${departmentId}`],
    enabled: activeFeature === "polls",
  });
  
  // Fetch shared notes for the user's department
  const { 
    data: sharedNotes, 
    isLoading: isLoadingSharedNotes 
  } = useQuery<IlSharedNote[]>({
    queryKey: [`/api/il/notes/department/${departmentId}`],
    enabled: activeFeature === "notes",
  });
  
  const handleMarkTipAsRead = (tipId: number, isHelpful?: boolean) => {
    markTipReadMutation.mutate(
      { tipId, isHelpful },
      {
        onSuccess: () => {
          toast({
            title: "Feedback saved",
            description: isHelpful ? "Thank you for your feedback!" : "We'll try to improve our suggestions",
          });
        },
        onError: () => {
          toast({
            title: "Error saving feedback",
            description: "Please try again later",
            variant: "destructive",
          });
        }
      }
    );
  };
  
  const handleFeatureSelection = (feature: string) => {
    setActiveFeature(feature);
    
    // Adding a fun animation when changing tabs
    setAnimationClass("animate__fadeIn");
    setTimeout(() => {
      setAnimationClass("");
    }, 1000);
  };
  
  // Format date strings for display
  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
    } catch (error) {
      return "Unknown date";
    }
  };
  
  // Show sample feature card for development/preview
  const showFeaturePreview = (feature: string) => {
    toast({
      title: `${feature} Feature Preview`,
      description: "This feature will be available soon. We're working on it!",
      variant: "default",
    });
  };
  
  return (
    <PageLayout 
      title="Interactive Learning" 
      backgroundColor="bg-gradient-to-br from-blue-50/30 to-indigo-50/30"
    >
      <Card className="w-full shadow-lg border-blue-200">
        <CardHeader className="bg-gradient-to-r from-[#1877F2] to-[#3b5998] text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-6 w-6 animate__animated animate__bounce" />
              <CardTitle className="text-xl">Interactive Learning Hub</CardTitle>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-white/10 text-white border-white/20">
                Beta
              </Badge>
              <Badge variant="secondary" className="bg-yellow-400 hover:bg-yellow-500 text-blue-900 border-none">
                {user?.role === 'student' ? 'Student' : user?.role === 'faculty' ? 'Faculty' : 'User'}
              </Badge>
            </div>
          </div>
          <CardDescription className="text-blue-100">
            Enhance your learning with interactive quizzes, forums, polls, and collaborative notes
          </CardDescription>
        </CardHeader>
        
        <Tabs defaultValue="dashboard" onValueChange={handleFeatureSelection} className="w-full">
          <TabsList className="w-full justify-start px-4 pt-2 bg-white border-b">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-blue-50">
              <div className="flex items-center gap-1">
                <Sparkles className="h-4 w-4" />
                <span>Dashboard</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="quizzes" className="data-[state=active]:bg-blue-50">
              <div className="flex items-center gap-1">
                <BookOpenCheck className="h-4 w-4" />
                <span>Quizzes</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="forum" className="data-[state=active]:bg-blue-50">
              <div className="flex items-center gap-1">
                <MessageCircle className="h-4 w-4" />
                <span>Forum</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="polls" className="data-[state=active]:bg-blue-50">
              <div className="flex items-center gap-1">
                <BarChart4 className="h-4 w-4" />
                <span>Polls</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="notes" className="data-[state=active]:bg-blue-50">
              <div className="flex items-center gap-1">
                <PenTool className="h-4 w-4" />
                <span>Shared Notes</span>
              </div>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className={`animate__animated ${animationClass}`}>
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Left column */}
                  <div className="flex-1 space-y-6">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <HeartPulse className="h-5 w-5 text-red-500" />
                          Welcome, {user?.first_name || user?.email}!
                        </CardTitle>
                        <CardDescription>
                          Your interactive learning journey at a glance
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <StatusCard 
                            title="Quizzes Completed" 
                            value="3" 
                            icon={<BookOpen className="h-5 w-5 text-blue-500" />} 
                          />
                          <StatusCard 
                            title="Forum Posts" 
                            value="7" 
                            icon={<MessageCircle className="h-5 w-5 text-purple-500" />} 
                          />
                          <StatusCard 
                            title="Poll Responses" 
                            value="12" 
                            icon={<BarChart4 className="h-5 w-5 text-green-500" />} 
                          />
                          <StatusCard 
                            title="Note Contributions" 
                            value="5" 
                            icon={<PenTool className="h-5 w-5 text-amber-500" />} 
                          />
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Student engagement counter */}
                    {user.role === 'student' && (
                      <EngagementCounter userId={user.id} />
                    )}
                    
                    {/* Show traditional progress card for non-students */}
                    {user.role !== 'student' && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Award className="h-5 w-5 text-amber-500" />
                            Your Recent Progress
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Overall Engagement</span>
                                <span className="font-medium">68%</span>
                              </div>
                              <Progress value={68} className="h-2" />
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Quiz Performance</span>
                                <span className="font-medium">75%</span>
                              </div>
                              <Progress value={75} className="h-2" />
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Discussion Participation</span>
                                <span className="font-medium">42%</span>
                              </div>
                              <Progress value={42} className="h-2" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                  
                  {/* Right column */}
                  <div className="flex-1 space-y-6">
                    {/* AI Tips Section */}
                    <AITipsSection 
                      tips={aiTips || []} 
                      isLoading={isLoadingTips} 
                      onMarkRead={handleMarkTipAsRead} 
                      formatDate={formatDate}
                    />
                    
                    {/* Class Insights Section - only visible to faculty */}
                    {user.role === 'faculty' && (
                      <ClassInsightsSection 
                        insights={classInsights} 
                        isLoading={isLoadingClassInsights}
                        departmentId={departmentId}
                      />
                    )}
                    
                    {/* System Overview Section - only visible to admin */}
                    {user.role === 'admin' && (
                      <SystemOverviewSection 
                        overview={systemOverview} 
                        isLoading={isLoadingSystemOverview}
                      />
                    )}
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <RotateCw className="h-5 w-5 text-green-500" />
                          Recent Activity
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {/* Sample activity items - will be replaced with actual data */}
                          <ActivityItem 
                            icon={<BookOpen className="h-4 w-4 text-blue-500" />}
                            title="Completed a quiz on Data Structures"
                            time="2 hours ago"
                          />
                          <ActivityItem 
                            icon={<MessageCircle className="h-4 w-4 text-purple-500" />}
                            title="Replied to 'Big O Notation Question'"
                            time="Yesterday"
                          />
                          <ActivityItem 
                            icon={<BarChart4 className="h-4 w-4 text-green-500" />}
                            title="Voted on 'Preferred Programming Languages'"
                            time="2 days ago"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
                
                {/* Faculty Engagement Dashboard */}
                {user.role === 'faculty' && (
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-4">
                      <BarChart4 className="h-5 w-5 text-blue-600" />
                      <span>Student Engagement Analytics</span>
                    </h2>
                    <FacultyEngagementDashboard departmentId={departmentId} />
                  </div>
                )}
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BookOpenCheck className="h-5 w-5 text-blue-600" />
                      Recommended Learning Activities
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <RecommendedActivity
                        title="Python Data Structures Quiz"
                        description="Test your knowledge of lists, tuples, and dictionaries"
                        icon={<BookOpen className="h-6 w-6 text-blue-500" />}
                        action={() => showFeaturePreview("Quiz")}
                      />
                      <RecommendedActivity
                        title="Algorithm Efficiency Discussion"
                        description="Join the conversation about sorting algorithms"
                        icon={<MessageCircle className="h-6 w-6 text-purple-500" />}
                        action={() => showFeaturePreview("Forum")}
                      />
                      <RecommendedActivity
                        title="Collaborative Notes on OOP"
                        description="Contribute to shared notes on object-oriented programming"
                        icon={<PenTool className="h-6 w-6 text-amber-500" />}
                        action={() => showFeaturePreview("Notes")}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </TabsContent>

          {/* Quizzes Tab */}
          <TabsContent value="quizzes" className={`animate__animated ${animationClass}`}>
            <CardContent className="pt-6">
              {/* Create Quiz Mode */}
              {user?.role === 'faculty' && createQuizMode && (
                <div className="mb-4">
                  <Button 
                    variant="ghost" 
                    onClick={() => setCreateQuizMode(false)}
                    className="mb-4"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  
                  <QuizCreator
                    onQuizCreated={() => setCreateQuizMode(false)}
                  />
                </div>
              )}
              
              {/* Take Quiz Mode */}
              {activeQuizId && (
                <div className="mb-4">
                  <Button 
                    variant="ghost" 
                    onClick={() => setActiveQuizId(null)}
                    className="mb-4"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Back to Quizzes
                  </Button>
                  
                  <QuizTaker
                    quizId={activeQuizId}
                    onComplete={() => setActiveQuizId(null)}
                  />
                </div>
              )}
              
              {/* Quiz List Mode */}
              {!createQuizMode && !activeQuizId && (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                      <BookOpenCheck className="h-5 w-5 text-blue-600" />
                      <span>Available Quizzes</span>
                    </h2>
                    
                    {user?.role === 'faculty' && (
                      <Button 
                        className="gap-1"
                        onClick={() => setCreateQuizMode(true)}
                      >
                        <PlusCircle className="h-4 w-4" />
                        <span>Create Quiz</span>
                      </Button>
                    )}
                  </div>
                  
                  {user?.role === 'student' ? (
                    <Tabs defaultValue="pending" className="mb-6">
                      <TabsList className="mb-2">
                        <TabsTrigger value="pending" className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>Pending Quizzes</span>
                        </TabsTrigger>
                        <TabsTrigger value="completed" className="flex items-center gap-1">
                          <Check className="h-4 w-4" />
                          <span>Completed Quizzes</span>
                        </TabsTrigger>
                      </TabsList>
                      
                      {/* Pending Quizzes Tab */}
                      <TabsContent value="pending">
                        <PendingQuizzes 
                          departmentId={user.department_id} 
                          onStartQuiz={(quizId) => setActiveQuizId(quizId)}
                        />
                      </TabsContent>
                      
                      {/* Completed Quizzes Tab */}
                      <TabsContent value="completed">
                        <CompletedQuizzes userId={user.id} />
                      </TabsContent>
                    </Tabs>
                  ) : (
                    // Faculty/Admin View - just show all quizzes
                    <>
                      {isLoadingQuizzes ? (
                        <div className="space-y-4">
                          <Skeleton className="h-28 w-full rounded-lg" />
                          <Skeleton className="h-28 w-full rounded-lg" />
                          <Skeleton className="h-28 w-full rounded-lg" />
                        </div>
                      ) : quizzes && quizzes.length > 0 ? (
                        <div className="space-y-4">
                          {quizzes.map((quiz) => (
                            <QuizCard
                              key={quiz.id}
                              title={quiz.title}
                              description={quiz.description || "No description available"}
                              subject={quiz.subject}
                              difficultyLevels={[quiz.difficulty]}
                              onStartQuiz={() => setActiveQuizId(quiz.id)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-8 rounded-lg text-center">
                          <BookOpen className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-500">No quizzes available yet.</p>
                          <p className="text-gray-400 text-sm mt-1">Create a quiz to get started.</p>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </CardContent>
          </TabsContent>

          {/* Forum Tab */}
          <TabsContent value="forum" className={`animate__animated ${animationClass}`}>
            <CardContent className="p-0">
              {/* Use the ForumSection component with user's subject */}
              <ForumSection subject={user && user.department_id ? `Department ${user.department_id}` : "General"} />
            </CardContent>
          </TabsContent>

          {/* Polls Tab */}
          <TabsContent value="polls" className={`animate__animated ${animationClass}`}>
            <CardContent className="pt-6">
              <PollsSection 
                user={{
                  id: user.id,
                  email: user.email,
                  first_name: user.first_name,
                  last_name: user.last_name,
                  role: user.role
                }}
                departmentId={user.department_id || undefined}
                subject={user.role === 'faculty' ? undefined : undefined}
              />
            </CardContent>
          </TabsContent>

          {/* Shared Notes Tab */}
          <TabsContent value="notes" className={`animate__animated ${animationClass}`}>
            <CardContent className="p-0">
              <SharedNotesSection departmentId={departmentId} />
            </CardContent>
          </TabsContent>
        </Tabs>
        
        <CardFooter className="bg-gray-50 border-t border-gray-100 flex justify-between items-center">
          <p className="text-xs text-gray-500">
            Interactive Learning Module • Version 1.0 Beta
          </p>
          <div className="flex items-center gap-1">
            <HeartPulse className="h-4 w-4 text-red-500" />
            <span className="text-xs text-gray-600">Powered by Flip Patashala AI</span>
          </div>
        </CardFooter>
      </Card>
    </PageLayout>
  );
}

// Component for status cards in the dashboard
function StatusCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-gray-700 text-sm font-medium">{title}</span>
      </div>
      <p className="text-xl font-bold text-gray-800 ml-6">{value}</p>
    </div>
  );
}

// Component for activity items
function ActivityItem({ icon, title, time }: { icon: React.ReactNode; title: string; time: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-gray-100 p-1.5 rounded-full">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm text-gray-700">{title}</p>
        <p className="text-xs text-gray-500">{time}</p>
      </div>
    </div>
  );
}

// Component for recommended activities
function RecommendedActivity({ 
  title, 
  description, 
  icon,
  action
}: { 
  title: string; 
  description: string; 
  icon: React.ReactNode;
  action: () => void;
}) {
  return (
    <Card className="bg-white hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-gray-50 rounded-full shrink-0">
            {icon}
          </div>
          <div>
            <h3 className="font-medium text-gray-800 mb-1">{title}</h3>
            <p className="text-sm text-gray-600 mb-3">{description}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={action}
            >
              Start Activity
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Component for quiz cards
function QuizCard({ 
  title, 
  description, 
  subject,
  difficultyLevels,
  onStartQuiz
}: { 
  title: string; 
  description: string; 
  subject: string;
  difficultyLevels: string[];
  onStartQuiz?: () => void;
}) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          <div className="bg-blue-50 p-4 md:w-1/4 flex items-center justify-center md:justify-start">
            <div className="text-center md:text-left">
              <BookOpenCheck className="h-8 w-8 text-blue-500 mx-auto md:mx-0 mb-2" />
              <h3 className="font-medium text-blue-800">{subject}</h3>
              <div className="flex flex-wrap gap-1 mt-2 justify-center md:justify-start">
                {difficultyLevels.map((level, i) => (
                  <Badge key={i} variant="outline" className="bg-white/60 text-xs">
                    {level}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          
          <div className="p-4 md:w-3/4">
            <h3 className="font-semibold text-gray-800 mb-1">{title}</h3>
            <p className="text-sm text-gray-600 mb-4">{description}</p>
            
            <div className="flex items-center text-sm text-gray-500 mb-4">
              <div className="flex items-center mr-4">
                <EyeIcon className="h-4 w-4 mr-1" />
                <span>125 attempts</span>
              </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                <span>~15 minutes</span>
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button onClick={onStartQuiz}>Start Quiz</Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Interface for author information
interface Author {
  name: string;
  role: string;
  avatarUrl: string;
}

// Component for forum post cards
function ForumPostCard({ 
  title, 
  content, 
  author,
  replyCount,
  isPinned,
  postedAt
}: { 
  title: string; 
  content: string;
  author: Author;
  replyCount: number;
  isPinned: boolean;
  postedAt: string;
}) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="w-10 h-10">
            <AvatarImage src={author.avatarUrl} />
            <AvatarFallback>{author.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-800">{title}</h3>
              {isPinned && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
                  Pinned
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-gray-700">{author.name}</span>
              <span className="text-xs text-gray-500">•</span>
              <Badge variant="outline" className="text-xs bg-gray-50">{author.role}</Badge>
              <span className="text-xs text-gray-500">•</span>
              <span className="text-xs text-gray-500">{postedAt}</span>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">{content}</p>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center text-sm text-gray-500">
                <MessageCircle className="h-4 w-4 mr-1" />
                <span>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
              </div>
              
              <Button variant="outline">View Discussion</Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Component for poll cards
function PollCard({ 
  question, 
  options,
  totalVotes,
  hasVoted,
  author
}: { 
  question: string;
  options: Array<{ text: string; votes: number }>;
  totalVotes: number;
  hasVoted: boolean;
  author: Author;
}) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="bg-green-50/70 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src={author.avatarUrl} />
              <AvatarFallback>{author.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
            </Avatar>
            
            <div>
              <h3 className="font-semibold text-gray-800">{question}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-600">{author.name}</span>
                <span className="text-xs text-gray-500">•</span>
                <Badge variant="outline" className="text-xs bg-white/50">{author.role}</Badge>
              </div>
            </div>
          </div>
          
          <Badge variant="outline" className="bg-green-100/70 text-green-800 border-green-200">
            {totalVotes} votes
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <div className="space-y-3">
          {options.map((option, i) => {
            const percentage = Math.round((option.votes / totalVotes) * 100) || 0;
            
            return (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{option.text}</span>
                  <span className="text-sm font-medium text-gray-700">{percentage}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div 
                    className="bg-green-500 h-2.5 rounded-full" 
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500">{option.votes} votes</div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-6 flex justify-end">
          {hasVoted ? (
            <Badge variant="outline" className="bg-gray-50 text-gray-700">
              You've voted
            </Badge>
          ) : (
            <Button>Cast Your Vote</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Component for shared note cards
function SharedNoteCard({ 
  title, 
  description, 
  subject,
  contributorsCount,
  lastUpdated
}: { 
  title: string; 
  description: string; 
  subject: string;
  contributorsCount: number;
  lastUpdated: string;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-2/3">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-amber-100 hover:bg-amber-200 text-amber-800 border-none">
                {subject}
              </Badge>
            </div>
            
            <h3 className="font-semibold text-gray-800 mb-1">{title}</h3>
            <p className="text-sm text-gray-600 mb-4">{description}</p>
          </div>
          
          <div className="w-full md:w-1/3 flex flex-col justify-between">
            <div className="text-sm text-gray-600">
              <div className="flex items-center mb-2">
                <PenTool className="h-4 w-4 mr-1 text-amber-500" />
                <span>{contributorsCount} contributors</span>
              </div>
              <div className="flex items-center mb-3">
                <Clock className="h-4 w-4 mr-1 text-gray-400" />
                <span>Updated {lastUpdated}</span>
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button variant="outline" className="mr-2">View</Button>
              <Button>Contribute</Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}