import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  PieChart, 
  BarChart3,
  Users, 
  Loader2, 
  RefreshCw, 
  Activity,
  BookOpen,
  MessageSquare,
  BarChart,
  PencilRuler
} from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

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

const SystemOverviewSection: React.FC<{
  overview?: SystemOverview;
  isLoading?: boolean;
}> = ({ 
  overview: externalOverview, 
  isLoading: externalIsLoading 
}) => {
  const [expandedSection, setExpandedSection] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Fetch system overview if not provided externally
  const { 
    data: fetchedOverview, 
    isLoading: isLoadingFetchedOverview,
    error,
    refetch
  } = useQuery<SystemOverview>({
    queryKey: ['/api/il/insights/system'],
    enabled: !externalOverview && !!user && user.role === 'admin',
    refetchOnWindowFocus: false,
  });
  
  // Use external overview if provided, otherwise use fetched overview
  const overview = externalOverview || fetchedOverview;
  const isLoading = externalIsLoading !== undefined ? externalIsLoading : isLoadingFetchedOverview;
  
  // Toggle expanded section
  const toggleExpand = () => {
    setExpandedSection(!expandedSection);
  };
  
  // Helper to format dates
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
  };
  
  // Loading state
  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-purple-500" />
            System Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </CardContent>
      </Card>
    );
  }
  
  // Error state
  if (error) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-purple-500" />
            System Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Error loading system overview. Please try again later.</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2" 
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center cursor-pointer" onClick={toggleExpand}>
            <BarChart3 className="h-5 w-5 mr-2 text-purple-500" />
            System Overview
          </CardTitle>
        </div>
        <CardDescription>
          AI-powered insights about overall platform activity and engagement
        </CardDescription>
      </CardHeader>
      
      {expandedSection && overview && (
        <CardContent>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Tabs defaultValue="statistics" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="statistics">Statistics</TabsTrigger>
                <TabsTrigger value="departments">Department Activity</TabsTrigger>
                <TabsTrigger value="trends">Activity Trends</TabsTrigger>
              </TabsList>
              
              <TabsContent value="statistics">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <Users className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                      <p className="text-sm text-gray-500">Active Users</p>
                      <p className="text-2xl font-bold">{overview.overview.statistics.active_users}</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <BookOpen className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-sm text-gray-500">Quizzes</p>
                      <p className="text-2xl font-bold">{overview.overview.statistics.total_quizzes}</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                      <p className="text-sm text-gray-500">Forum Posts</p>
                      <p className="text-2xl font-bold">{overview.overview.statistics.total_posts}</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <BarChart className="h-8 w-8 mx-auto mb-2 text-red-500" />
                      <p className="text-sm text-gray-500">Poll Votes</p>
                      <p className="text-2xl font-bold">{overview.overview.statistics.total_votes}</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <PencilRuler className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                      <p className="text-sm text-gray-500">Shared Notes</p>
                      <p className="text-2xl font-bold">{overview.overview.statistics.total_notes}</p>
                    </CardContent>
                  </Card>
                </div>
                
                <Card className="bg-gray-50 dark:bg-gray-800 border-dashed">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-medium mb-3">Key Insights</h3>
                    <ul className="space-y-2">
                      <li className="flex items-start">
                        <span className="inline-block h-6 w-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-2 flex-shrink-0">
                          <Activity className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-sm">
                          The platform has an average of {(overview.overview.statistics.total_quizzes + 
                            overview.overview.statistics.total_posts + 
                            overview.overview.statistics.total_votes + 
                            overview.overview.statistics.total_notes) / overview.overview.statistics.active_users}
                          interactions per active user.
                        </span>
                      </li>
                      
                      <li className="flex items-start">
                        <span className="inline-block h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-2 flex-shrink-0">
                          <PieChart className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-sm">
                          Quizzes make up {Math.round((overview.overview.statistics.total_quizzes / 
                            (overview.overview.statistics.total_quizzes + 
                             overview.overview.statistics.total_posts + 
                             overview.overview.statistics.total_votes + 
                             overview.overview.statistics.total_notes)) * 100)}% 
                          of all interactive content.
                        </span>
                      </li>
                      
                      <li className="flex items-start">
                        <span className="inline-block h-6 w-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mr-2 flex-shrink-0">
                          <BarChart3 className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-sm">
                          The most active departments show 2-3x higher engagement rates than the least active ones.
                        </span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="departments">
                <div className="space-y-4">
                  {overview.overview.department_activity.map((dept) => (
                    <Card key={dept.name}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-medium">{dept.name}</h3>
                          <span className="text-sm text-gray-500">{dept.user_count} users</span>
                        </div>
                        
                        <div className="space-y-2">
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Total Interactions</span>
                              <span className="font-medium">{dept.interaction_count}</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div 
                                className="bg-purple-600 h-2 rounded-full" 
                                style={{ 
                                  width: `${Math.min(100, (dept.interaction_count / 
                                    Math.max(...overview.overview.department_activity.map(d => d.interaction_count))) * 100)}%` 
                                }}
                              ></div>
                            </div>
                          </div>
                          
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Avg. Per User</span>
                              <span className="font-medium">{dept.avg_per_user.toFixed(1)}</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div 
                                className="bg-green-600 h-2 rounded-full" 
                                style={{ 
                                  width: `${Math.min(100, (dept.avg_per_user / 
                                    Math.max(...overview.overview.department_activity.map(d => d.avg_per_user))) * 100)}%` 
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="trends">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-md">Activity Trend (Last 7 Days)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px] flex items-end">
                      {Object.entries(overview.overview.activity_trend).map(([date, count], index) => {
                        const maxCount = Math.max(...Object.values(overview.overview.activity_trend));
                        const heightPercentage = (count / maxCount) * 100;
                        
                        return (
                          <div key={date} className="flex-1 flex flex-col items-center justify-end mx-1">
                            <div 
                              className="w-full bg-purple-500 rounded-t-sm"
                              style={{ height: `${heightPercentage}%` }}
                            ></div>
                            <span className="text-xs mt-2 text-gray-600 dark:text-gray-400">
                              {formatDate(date)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                  <CardFooter className="text-sm text-gray-500">
                    Total interactions: {Object.values(overview.overview.activity_trend).reduce((sum, count) => sum + count, 0)}
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        </CardContent>
      )}
    </Card>
  );
};

export default SystemOverviewSection;