import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart, 
  LightbulbIcon, 
  Loader2, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  Users,
  Clock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

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

const ClassInsightsSection: React.FC<{ 
  departmentId?: number;
  subjects?: string[];
  insights?: ClassInsight;
  isLoading?: boolean;
}> = ({ 
  departmentId, 
  subjects = [],
  insights: externalInsights,
  isLoading: externalIsLoading
}) => {
  const [expandedSection, setExpandedSection] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string | undefined>(
    subjects && subjects.length > 0 ? subjects[0] : undefined
  );
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Fetch class insights if external insights are not provided
  const { 
    data: fetchedInsights, 
    isLoading: isLoadingFetchedInsights,
    error: insightsError,
    refetch: refetchInsights
  } = useQuery<ClassInsight>({
    queryKey: ['/api/il/insights/class', departmentId, selectedSubject],
    queryFn: async () => {
      let url = '/api/il/insights/class';
      const params = new URLSearchParams();
      
      if (departmentId) {
        params.append('department_id', departmentId.toString());
      }
      if (selectedSubject) {
        params.append('subject', selectedSubject);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch class insights');
      }
      return response.json();
    },
    enabled: !externalInsights && !!user && user.role === 'faculty',
    refetchOnWindowFocus: false,
  });
  
  // Use external insights if provided, otherwise use fetched insights
  const insights = externalInsights || fetchedInsights;
  const isLoadingInsights = externalIsLoading !== undefined ? externalIsLoading : isLoadingFetchedInsights;
  
  // Toggle expanded section
  const toggleExpand = () => {
    setExpandedSection(!expandedSection);
  };
  
  // Handle subject change
  const handleSubjectChange = (value: string) => {
    setSelectedSubject(value);
  };
  
  // Loading state
  if (isLoadingInsights) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center">
            <BarChart className="h-5 w-5 mr-2 text-blue-500" />
            Class Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }
  
  // Error state
  if (insightsError) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center">
            <BarChart className="h-5 w-5 mr-2 text-blue-500" />
            Class Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Error loading class insights. Please try again later.</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2" 
            onClick={() => refetchInsights()}
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
            <BarChart className="h-5 w-5 mr-2 text-blue-500" />
            Class Insights
          </CardTitle>
          
          {subjects && subjects.length > 0 && (
            <Select value={selectedSubject} onValueChange={handleSubjectChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <CardDescription>
          AI-powered insights about student performance and engagement
        </CardDescription>
      </CardHeader>
      
      {expandedSection && insights && (
        <CardContent>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Overview metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6 flex items-center">
                  <Users className="h-10 w-10 p-2 rounded-full bg-blue-100 text-blue-600 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Total Students</p>
                    <p className="text-2xl font-bold">{insights.insights.total_students}</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6 flex items-center">
                  <BarChart className="h-10 w-10 p-2 rounded-full bg-green-100 text-green-600 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Class Average</p>
                    <p className="text-2xl font-bold">{insights.insights.class_average.toFixed(1)}%</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6 flex items-center">
                  <Clock className="h-10 w-10 p-2 rounded-full bg-purple-100 text-purple-600 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Avg. Engagement</p>
                    <p className="text-2xl font-bold">{insights.insights.average_engagement.toFixed(1)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Subject performance */}
            <div className="mb-6">
              <h3 className="text-md font-medium mb-3 flex items-center">
                <LightbulbIcon className="h-4 w-4 mr-2 text-yellow-500" />
                Subject Performance
              </h3>
              
              <div className="space-y-3">
                {Object.entries(insights.insights.subject_averages).map(([subject, average]) => (
                  <div key={subject} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{subject}</span>
                      <span className="text-sm font-medium">{average.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${Math.min(100, average)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm flex items-start">
                  <LightbulbIcon className="h-4 w-4 mr-2 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>{insights.insights.most_challenging_subject.name}</strong> appears to be the most challenging 
                    subject with an average score of {insights.insights.most_challenging_subject.average_score.toFixed(1)}%. 
                    Consider providing additional resources or review sessions for this topic.
                  </span>
                </p>
              </div>
            </div>
            
            {/* Student performance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Excelling students */}
              <div>
                <h3 className="text-md font-medium mb-3 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
                  Excelling Students
                </h3>
                
                <div className="space-y-2">
                  {Object.entries(insights.insights.excelling_students).map(([id, student]) => (
                    <div key={id} className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                      <span className="text-sm">{student.name}</span>
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">{student.average.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Struggling students */}
              <div>
                <h3 className="text-md font-medium mb-3 flex items-center">
                  <TrendingDown className="h-4 w-4 mr-2 text-red-500" />
                  Needs Attention
                </h3>
                
                <div className="space-y-2">
                  {Object.entries(insights.insights.struggling_students).map(([id, student]) => (
                    <div key={id} className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                      <span className="text-sm">{student.name}</span>
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">{student.average.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </CardContent>
      )}
    </Card>
  );
};

export default ClassInsightsSection;