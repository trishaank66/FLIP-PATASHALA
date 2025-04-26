import { useState, useEffect, ReactNode } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { RecommendationsContent } from "./RecommendationsContent";
import { 
  Loader2, 
  Lightbulb, 
  BarChart3, 
  UserX, 
  Users, 
  School, 
  Building2,
  GraduationCap,
  CheckCircle,
  Clock,
  BrainCircuit,
  Sparkles,
  Home,
  Building,
  Info,
  Shield,
  Presentation,
  ArrowRight,
  Target,
  LayoutGrid
} from "lucide-react";
import { FaLightbulb } from "react-icons/fa";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import 'animate.css';

// Helper functions for the recommendations section
type SectionColor = {
  bg: string;
  text: string;
  bullet: string;
};

// Interface for our recommendations section structure
interface SectionInfo {
  title: string;
  content: string[];
  icon: ReactNode;
  color: SectionColor;
}

// Define a type that has a custom index signature with string keys + the special 'order' property
interface SectionsData {
  [key: string]: SectionInfo | string[];
  order: string[];
}

// Get color scheme based on heading title
const getHeadingColor = (title: string): SectionColor => {
  const headingKey = title.toLowerCase();
  
  if (headingKey.includes('department')) {
    return {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      bullet: 'bg-blue-500'
    };
  } else if (headingKey.includes('student') || headingKey.includes('engagement')) {
    return {
      bg: 'bg-green-50',
      text: 'text-green-700',
      bullet: 'bg-green-500'
    };
  } else if (headingKey.includes('verification')) {
    return {
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      bullet: 'bg-purple-500'
    };
  } else if (headingKey.includes('quick') || headingKey.includes('win')) {
    return {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      bullet: 'bg-amber-500'
    };
  }
  
  // Default color scheme
  return {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    bullet: 'bg-gray-500'
  };
};

// Get icon based on heading title
const getHeadingIcon = (title: string): ReactNode => {
  const headingKey = title.toLowerCase();
  
  if (headingKey.includes('department')) {
    return <Building2 className="h-5 w-5 text-blue-600" />;
  } else if (headingKey.includes('student') || headingKey.includes('engagement')) {
    return <GraduationCap className="h-5 w-5 text-green-600" />;
  } else if (headingKey.includes('verification')) {
    return <CheckCircle className="h-5 w-5 text-purple-600" />;
  } else if (headingKey.includes('quick') || headingKey.includes('win')) {
    return <Sparkles className="h-5 w-5 text-amber-600" />;
  }
  
  // Default icon
  return <Lightbulb className="h-5 w-5 text-gray-600" />;
};

interface InsightsResponse {
  insights: {
    department_clusters?: Array<{
      department_id: number;
      department_name: string;
      cluster: number;
      group_name?: string; // Added for more human-readable group names
      metrics: {
        student_count: number;
        faculty_count: number;
        inactive_users: number;
        pending_verifications: number;
      };
    }>;
    inactive_user_data?: Array<{
      role: string;
      department_name: string | null;
      count: number;
    }>;
    verification_stats?: Array<{
      role: string;
      pending_count: number;
      verified_count: number;
      total_count: number;
    }>;
    ai_recommendations?: string;
    error?: string;
    message?: string;
  };
}

export function AIInsights() {
  const [activeTab, setActiveTab] = useState("overview");
  
  // Fetch AI insights from the server
  const { data, isLoading, isError, error: queryError } = useQuery<InsightsResponse>({
    queryKey: ["/api/ai-insights"],
    queryFn: getQueryFn({ on401: "throw" }),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  // Format recommendations as bullet points for better readability
  const formatRecommendations = (text: string) => {
    // Split the text by numbered points (1., 2., etc.) or bullet points
    const lines = text.split(/\n\s*(?:\d+\.|•|\*)\s+/);
    
    // Filter out empty lines and format
    return lines
      .filter(line => line.trim().length > 0)
      .map((line, index) => (
        <li key={index} className="mb-2">{line.trim()}</li>
      ));
  };
  
  // Get cluster color based on cluster ID
  const getClusterColor = (clusterId: number) => {
    const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-amber-500", "bg-pink-500"];
    return colors[clusterId % colors.length];
  };
  
  // Generate dynamic insights for each cluster based on its characteristics
  const getClusterInsight = (clusterId: number, groupName: string, departments: any[]) => {
    // Calculate aggregate metrics
    const totalStudents = departments.reduce((sum, dept) => sum + dept.metrics.student_count, 0);
    const totalFaculty = departments.reduce((sum, dept) => sum + dept.metrics.faculty_count, 0);
    const avgStudentFacultyRatio = totalStudents / Math.max(1, totalFaculty);
    const highInactiveCount = departments.filter(d => d.metrics.inactive_users > 5).length;
    const pendingVerificationsCount = departments.reduce((sum, dept) => sum + dept.metrics.pending_verifications, 0);
    
    // Size classification
    const sizeClassification = totalStudents > 100 ? "large" : totalStudents > 50 ? "medium" : "small";
    
    // Generate insights based on data patterns
    if (sizeClassification === "large") {
      return `This is a large-sized department group with ${totalStudents} total students and an average student-to-faculty ratio of ${avgStudentFacultyRatio.toFixed(1)}:1. These departments need scalable learning methods and strategic resource allocation.`;
    } else if (sizeClassification === "medium") {
      return `This is a mid-sized department group with good flexibility for implementing flipped learning. With ${totalStudents} students spread across ${departments.length} departments, this group balances personalized attention with collaborative activities.`;
    } else {
      return `This intimate department group has ${totalStudents} students and ${totalFaculty} faculty members, offering excellent opportunities for personalized mentoring and specialized flipped learning approaches.`;
    }
  };
  
  // Generate actionable items based on cluster characteristics
  const getClusterActionItems = (clusterId: number, departments: any[]) => {
    const totalStudents = departments.reduce((sum, dept) => sum + dept.metrics.student_count, 0);
    const totalFaculty = departments.reduce((sum, dept) => sum + dept.metrics.faculty_count, 0);
    const avgStudentFacultyRatio = totalStudents / Math.max(1, totalFaculty);
    const highInactiveCount = departments.filter(d => d.metrics.inactive_users > 5).length;
    const pendingVerificationsCount = departments.reduce((sum, dept) => sum + dept.metrics.pending_verifications, 0);
    
    const actionItems = [];
    
    // Student-faculty ratio recommendations
    if (avgStudentFacultyRatio > 15) {
      actionItems.push(`Consider recruiting ${Math.ceil(totalStudents/15 - totalFaculty)} more faculty members to improve personal attention and feedback quality`);
    } else if (avgStudentFacultyRatio < 5) {
      actionItems.push(`Great faculty coverage! Focus on cross-department collaboration to maximize faculty expertise`);
    }
    
    // Inactive users recommendations
    if (highInactiveCount > 0) {
      actionItems.push(`Address inactive users in ${highInactiveCount} departments with engagement campaigns or surveys to understand barriers`);
    } else {
      actionItems.push(`Excellent active participation! Consider sharing engagement strategies with other department groups`);
    }
    
    // Verification recommendations
    if (pendingVerificationsCount > 0) {
      actionItems.push(`Expedite verification for ${pendingVerificationsCount} pending users to boost platform adoption rates`);
    } else {
      actionItems.push(`All users verified! Focus on introducing advanced flipped learning content`);
    }
    
    // Add one custom recommendation based on department size
    if (totalStudents > 100) {
      actionItems.push(`Create separate flipped learning pathways for specialized subgroups within larger departments`);
    } else if (totalStudents > 50) {
      actionItems.push(`Implement peer-to-peer teaching strategies to enhance student participation`);
    } else {
      actionItems.push(`Develop personalized feedback systems taking advantage of the small class sizes`);
    }
    
    // Return 3-4 most relevant items to avoid overwhelming
    return actionItems.slice(0, 4);
  };
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center">
          <Loader2 className="h-5 w-5 animate-spin mr-2 text-primary" />
          <p>Loading AI insights...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }
  
  if (isError) {
    return (
      <Card className="border-red-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-red-600">Failed to load insights</CardTitle>
        </CardHeader>
        <CardContent>
          <p>There was an error loading the AI insights. Please try again later.</p>
          <p className="text-sm text-gray-500 mt-2">Error details: {queryError ? (queryError instanceof Error ? queryError.message : String(queryError)) : "Unknown error"}</p>
        </CardContent>
      </Card>
    );
  }
  
  // If there's no data at all, show a message
  if (!data) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>No insights available</CardTitle>
        </CardHeader>
        <CardContent>
          <p>There is not enough data to generate insights yet. Add more users and departments to get AI-powered recommendations.</p>
        </CardContent>
      </Card>
    );
  }
  
  // Extract data from response with fallbacks for any missing properties
  const { 
    department_clusters = [], 
    inactive_user_data = [], 
    verification_stats = [], 
    ai_recommendations = "",
    error: errorMessage = null 
  } = data.insights || {};
  
  // If we received an error in the insights object, display a notice but continue with the available data
  const isUsingDemoData = errorMessage ? true : false;
  
  return (
    <div className="space-y-6 animate__animated animate__fadeIn">
      {/* Demo Data Warning */}
      {isUsingDemoData && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-4 animate__animated animate__fadeIn">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <FaLightbulb className="h-5 w-5 text-amber-500" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800">Sample Data Displayed</h3>
              <div className="mt-2 text-sm text-amber-700">
                <p>We're showing example data because: {errorMessage}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Header with animation */}
      <div className="flex items-center space-x-2 animate__animated animate__bounceIn">
        <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
          <FaLightbulb className="h-6 w-6 text-amber-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">AI Insights</h2>
          <p className="text-gray-600">
            Simple insights to help your college thrive - no complicated tech talk!
          </p>
        </div>
      </div>
      
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-1">
            <Home className="h-4 w-4" />
            <span>Quick Summary</span>
          </TabsTrigger>
          <TabsTrigger value="departments" className="flex items-center gap-1">
            <Building className="h-4 w-4" />
            <span>Department Families</span>
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="flex items-center gap-1">
            <Lightbulb className="h-4 w-4" />
            <span>Recommendations</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="pt-4">
          {/* Overview Dashboard Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 mb-6 rounded-lg border border-blue-100 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="col-span-2">
                <h3 className="text-lg font-medium text-blue-800 mb-2 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  College-Wide Overview
                </h3>
                <p className="text-sm text-blue-700 mb-4">
                  This dashboard gives you a bird's-eye view of your entire college at a glance. See how departments are performing, track verification progress, and identify areas that need your attention.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col items-center bg-white p-3 rounded-lg border border-blue-100">
                    <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-center">Department Health</span>
                    <p className="text-xs text-center text-gray-600 mt-1">See which departments are thriving or need help</p>
                  </div>
                  
                  <div className="flex flex-col items-center bg-white p-3 rounded-lg border border-blue-100">
                    <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center mb-2">
                      <UserX className="h-5 w-5 text-red-600" />
                    </div>
                    <span className="text-sm font-medium text-center">Engagement Tracking</span>
                    <p className="text-xs text-center text-gray-600 mt-1">Monitor inactive users who need re-engagement</p>
                  </div>
                  
                  <div className="flex flex-col items-center bg-white p-3 rounded-lg border border-blue-100">
                    <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-center">Verification Status</span>
                    <p className="text-xs text-center text-gray-600 mt-1">Track approval progress for all user roles</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg border border-blue-100 flex flex-col justify-center">
                <div className="text-center mb-3">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-purple-100 mb-2">
                    <BrainCircuit className="h-7 w-7 text-purple-600" />
                  </div>
                  <h4 className="font-medium text-purple-800">AI-Powered Analysis</h4>
                </div>
                <p className="text-xs text-center text-gray-600">
                  All metrics are automatically analyzed by our AI system to provide you with clear, actionable insights without needing technical expertise.
                </p>
                <div className="mt-3 flex justify-center">
                  <div className="inline-flex items-center gap-1.5 bg-purple-100 px-3 py-1.5 rounded-full text-purple-800 text-xs font-medium">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Updated in real-time</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Department Overview */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-blue-700 flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Your College Departments
                  </CardTitle>
                  <Badge variant="outline" className="bg-white text-blue-700">
                    {department_clusters.length} Total
                  </Badge>
                </div>
                <CardDescription className="text-blue-700/70">
                  At a glance: who's in your college
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="bg-white p-3 rounded-lg border border-blue-100 mb-3">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                    <p className="text-xs text-blue-700">
                      Colors below show which departments are in the same "family" - scroll down to "Department Families" tab to learn more!
                    </p>
                  </div>
                </div>
                
                {department_clusters.map((dept) => (
                  <div key={dept.department_id} className="flex items-center justify-between mb-3 p-2 bg-white rounded-lg border border-blue-100 hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${getClusterColor(dept.cluster)}`} />
                      <span className="font-medium">{dept.department_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 bg-indigo-50 py-1 px-2 rounded-full">
                        <div className="relative">
                          <GraduationCap className="h-3.5 w-3.5 text-indigo-600" />
                          <span className="absolute -top-1 -right-1 flex h-2 w-2 bg-indigo-200 rounded-full"></span>
                        </div>
                        <span className="text-xs font-medium text-indigo-700">{dept.metrics.student_count} Students</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-teal-50 py-1 px-2 rounded-full">
                        <div className="relative">
                          <Presentation className="h-3.5 w-3.5 text-teal-600" />
                          <span className="absolute -top-1 -right-1 flex h-2 w-2 bg-teal-200 rounded-full"></span>
                        </div>
                        <span className="text-xs font-medium text-teal-700">{dept.metrics.faculty_count} Faculty</span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            
            {/* Inactive Users */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-red-600 flex items-center gap-2">
                    <UserX className="h-5 w-5" />
                    Inactive Users
                  </CardTitle>
                  <Badge variant="outline" className="bg-red-50">
                    {inactive_user_data.reduce((sum, item) => sum + item.count, 0)} Total
                  </Badge>
                </div>
                <CardDescription>
                  Users who are no longer active on the platform
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                {inactive_user_data.length > 0 ? (
                  <div className="space-y-3">
                    {inactive_user_data.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-100 hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-2">
                          {item.role === 'student' ? (
                            <GraduationCap className="h-4 w-4 text-red-500" />
                          ) : (
                            <School className="h-4 w-4 text-red-500" />
                          )}
                          <span className="font-medium capitalize">{item.role}s</span>
                        </div>
                        <div className="flex items-center gap-1 bg-red-50 py-1 px-3 rounded-full">
                          <span className="text-sm">
                            {item.department_name || "No Department"}:
                          </span>
                          <span className="font-medium text-red-600">{item.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-green-50 rounded-lg">
                    <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-sm text-green-700 font-medium">No inactive users detected</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Verification Stats */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-green-600 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Verification Status
                  </CardTitle>
                </div>
                <CardDescription>
                  User verification status by role
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                {verification_stats.map((stat, index) => (
                  <div key={index} className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="capitalize font-medium">{stat.role}s</span>
                      <span className="text-sm">
                        <span className="text-amber-600">{stat.pending_count} pending</span> / 
                        <span className="text-green-600 ml-1">{stat.verified_count} verified</span>
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ 
                          width: `${(stat.verified_count / (stat.total_count || 1)) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            
            {/* Top Recommendations Card */}
            <Card className="bg-amber-50 border-amber-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-amber-700 flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Key Insights
                </CardTitle>
                <CardDescription className="text-amber-700/70">
                  AI-powered recommendations for your platform
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                {ai_recommendations ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-white rounded-lg border border-amber-200 shadow-sm mb-1">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                            <Sparkles className="h-4.5 w-4.5 text-amber-600" />
                          </div>
                          <h3 className="font-semibold text-amber-800 text-lg">Top Priorities</h3>
                        </div>
                        <div className="flex items-center text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">
                          <Lightbulb className="h-3 w-3 mr-1" />
                          <span>Updated today</span>
                        </div>
                      </div>
                      
                      <div className="space-y-4 pl-8">
                        {ai_recommendations
                          .split('\n')
                          .filter(line => line.trim())
                          .filter(line => !line.startsWith('#')) // Filter out lines starting with #
                          .slice(0, 3)
                          .map((line, index) => (
                            <div key={index} className="relative">
                              <div className="absolute left-[-20px] top-1 w-4 h-4 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 flex items-center justify-center">
                                <span className="font-bold text-[10px] text-white">•</span>
                              </div>
                              <p className="text-sm text-amber-900 bg-amber-50/70 p-2 rounded-lg border border-amber-100">
                                {line.trim().replace(/^#\s*/, '').replace(/^\d+\.\s*/, '')}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 bg-white rounded-lg border border-amber-100">
                    <div className="h-12 w-12 bg-amber-50 rounded-full flex items-center justify-center mb-3">
                      <Lightbulb className="h-6 w-6 text-amber-400" />
                    </div>
                    <p className="text-amber-800 text-center font-medium">No insights available yet</p>
                    <p className="text-xs text-amber-600/80 text-center mt-1">Add more users and departments to get AI-powered recommendations</p>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <div className="flex items-center w-full">
                  <p className="text-xs text-amber-700/70">
                    <span className="inline-flex items-center">
                      <BrainCircuit className="h-3 w-3 mr-1 text-amber-600" />
                      AI-generated insights based on platform activity
                    </span>
                  </p>
                </div>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
        
        {/* Departments Tab */}
        <TabsContent value="departments" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Department Family Groups
              </CardTitle>
              <CardDescription>
                Scientifically grouped departments with similar metrics for smarter decision-making and resource allocation
              </CardDescription>
            </CardHeader>
            {/* Explanation visualization for Department Family Groups */}
            <div className="px-6 py-4 border-t border-b">
              <div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50">
                <h3 className="text-lg font-medium text-blue-800 mb-3 flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-blue-600" />
                  What Are Department Family Groups?
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="p-3 bg-white rounded-lg border border-blue-100 shadow-sm">
                    <div className="flex justify-center mb-2">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Target className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                    <h4 className="text-sm font-medium text-center mb-1">AI-Powered Grouping</h4>
                    <p className="text-xs text-center text-gray-600">Our AI analyzes department size, faculty counts, and activity patterns</p>
                  </div>
                  
                  <div className="p-3 bg-white rounded-lg border border-blue-100 shadow-sm">
                    <div className="flex justify-center mb-2">
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Sparkles className="h-6 w-6 text-green-600" />
                      </div>
                    </div>
                    <h4 className="text-sm font-medium text-center mb-1">Practical Benefits</h4>
                    <p className="text-xs text-center text-gray-600">Get tailored strategies for departments with similar needs and challenges</p>
                  </div>
                  
                  <div className="p-3 bg-white rounded-lg border border-blue-100 shadow-sm">
                    <div className="flex justify-center mb-2">
                      <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                        <ArrowRight className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                    <h4 className="text-sm font-medium text-center mb-1">Actionable Insights</h4>
                    <p className="text-xs text-center text-gray-600">Each group comes with specific recommendations you can implement today</p>
                  </div>
                </div>
                
                <div className="p-3 bg-white rounded-lg border border-blue-100">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Info className="h-4 w-4 text-blue-600" />
                    How We Group Departments:
                  </h4>
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-xs font-medium text-blue-700">1</span>
                      </div>
                      <p className="text-xs text-gray-700">AI analyzes student count, faculty ratio, and activity levels</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-xs font-medium text-blue-700">2</span>
                      </div>
                      <p className="text-xs text-gray-700">Similar departments are grouped into "families" (shown by color)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-xs font-medium text-blue-700">3</span>
                      </div>
                      <p className="text-xs text-gray-700">Each family gets unique insights and action items based on their specific needs</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <CardContent>
              {/* AI Clustering Tech Explanation */}
              <div className="bg-slate-50 p-4 rounded-lg border mb-6 shadow-sm">
                <h3 className="text-slate-800 font-medium text-md mb-2 flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-blue-600" />
                  How Department Families Work
                </h3>
                <div className="text-sm space-y-2 text-slate-700">
                  <p className="flex items-start gap-2">
                    <span className="bg-blue-100 text-blue-800 font-mono px-1.5 py-0.5 rounded text-xs mt-0.5">1</span>
                    <span>Our AI engine uses <strong>KMeans clustering</strong> (from scikit-learn) to analyze your departments</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="bg-blue-100 text-blue-800 font-mono px-1.5 py-0.5 rounded text-xs mt-0.5">2</span>
                    <span>Departments are grouped based on <strong>3 key metrics</strong>: student count, faculty count, and inactive user ratio</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="bg-blue-100 text-blue-800 font-mono px-1.5 py-0.5 rounded text-xs mt-0.5">3</span>
                    <span>Up to 3 distinct family groups are created (Large, Medium, Small) for practical management</span>
                  </p>
                </div>
              </div>
              
              {/* Key Benefits Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 shadow-sm">
                  <h3 className="text-blue-700 font-medium mb-1 flex items-center gap-1.5">
                    <Lightbulb className="h-4 w-4 text-blue-600" />
                    Save Time
                  </h3>
                  <p className="text-blue-700/80 text-xs">
                    Apply the same solutions to all departments within a family instead of creating unique plans for each
                  </p>
                </div>
                
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 shadow-sm">
                  <h3 className="text-blue-700 font-medium mb-1 flex items-center gap-1.5">
                    <School className="h-4 w-4 text-blue-600" />
                    Targeted Resources
                  </h3>
                  <p className="text-blue-700/80 text-xs">
                    Efficiently allocate faculty, training, and materials based on the unique needs of each department family
                  </p>
                </div>
                
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 shadow-sm">
                  <h3 className="text-blue-700 font-medium mb-1 flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-blue-600" />
                    Balanced Workload
                  </h3>
                  <p className="text-blue-700/80 text-xs">
                    Equitably distribute administrative attention across department families rather than tackling everything at once
                  </p>
                </div>
              </div>
              
              {/* Cluster Groups */}
              <div className="space-y-6">
                {/* Create a section for each department group */}
                {Array.from(new Set(department_clusters.map(d => d.cluster))).map(clusterId => {
                  const clusterDepartments = department_clusters.filter(d => d.cluster === clusterId);
                  // Get group name from the first department in this cluster (they all have the same group name)
                  const groupName = clusterDepartments[0]?.group_name || `Group ${clusterId + 1}`;
                  return (
                    <div key={clusterId} className="border rounded-lg p-5 shadow-sm">
                      <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full ${getClusterColor(clusterId)}`} />
                        <span className="animate__animated animate__fadeIn">{groupName}</span>
                        <Badge variant="outline" className="ml-2 bg-white">{clusterDepartments.length} Departments</Badge>
                      </h3>
                      <div className="bg-blue-50 p-4 mb-4 rounded-lg border border-blue-100 text-blue-700">
                        <div className="flex items-start gap-2">
                          <Sparkles className="h-5 w-5 text-blue-600 mt-0.5 animate__animated animate__bounceIn" />
                          <div className="space-y-2">
                            <p className="text-sm font-medium">
                              <strong>Family Insights:</strong> {getClusterInsight(clusterId, groupName, clusterDepartments)}
                            </p>
                            <ul className="text-sm list-disc pl-5 space-y-1">
                              {getClusterActionItems(clusterId, clusterDepartments).map((item: string, i: number) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {clusterDepartments.map(dept => (
                          <div key={dept.department_id} className="border rounded p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
                            <h4 className="font-medium mb-3 text-lg flex items-center gap-2">
                              <Building2 className="h-5 w-5 text-blue-500" />
                              {dept.department_name}
                            </h4>
                            
                            <div className="grid grid-cols-1 gap-y-3 text-sm">
                              <div className="bg-blue-50 rounded-lg p-2 border border-blue-100 flex justify-between">
                                <div className="flex items-center gap-1">
                                  <Users className="h-4 w-4 text-blue-500" />
                                  <span className="font-semibold">{dept.metrics.student_count} Students</span>
                                </div>
                                <div>
                                  <Badge variant="outline" className="bg-white text-blue-700">
                                    {dept.metrics.student_count > 20 ? 'Large Class' : dept.metrics.student_count > 10 ? 'Medium Class' : 'Small Class'}
                                  </Badge>
                                </div>
                              </div>
                              
                              <div className="bg-green-50 rounded-lg p-2 border border-green-100 flex justify-between">
                                <div className="flex items-center gap-1">
                                  <School className="h-4 w-4 text-green-500" />
                                  <span className="font-semibold">{dept.metrics.faculty_count} Faculty</span>
                                </div>
                                <div>
                                  <Badge variant="outline" className="bg-white text-green-700">
                                    {dept.metrics.student_count / Math.max(1, dept.metrics.faculty_count) > 10 
                                      ? 'High Student/Faculty Ratio' 
                                      : 'Good Student/Faculty Ratio'}
                                  </Badge>
                                </div>
                              </div>
                              
                              <div className="bg-red-50 rounded-lg p-2 border border-red-100 flex justify-between">
                                <div className="flex items-center gap-1">
                                  <UserX className="h-4 w-4 text-red-500" />
                                  <span className="font-semibold">{dept.metrics.inactive_users} Inactive</span>
                                </div>
                                <div>
                                  <Badge variant="outline" className={`bg-white ${dept.metrics.inactive_users > 5 ? 'text-red-700' : 'text-green-700'}`}>
                                    {dept.metrics.inactive_users > 5 ? 'Needs Attention' : 'Good Activity'}
                                  </Badge>
                                </div>
                              </div>
                              
                              <div className="bg-amber-50 rounded-lg p-2 border border-amber-100 flex justify-between">
                                <div className="flex items-center gap-1">
                                  <Lightbulb className="h-4 w-4 text-amber-500" />
                                  <span className="font-semibold">{dept.metrics.pending_verifications} Pending</span>
                                </div>
                                <div>
                                  <Badge variant="outline" className={`bg-white ${dept.metrics.pending_verifications > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                                    {dept.metrics.pending_verifications > 0 ? 'Action Needed' : 'All Verified'}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="pt-4">
          <Card className="border-amber-200">
            <CardHeader className="bg-amber-50 border-b border-amber-100">
              <div className="flex items-center">
                <FaLightbulb className="h-5 w-5 text-amber-500 mr-2 animate__animated animate__pulse animate__infinite" />
                <CardTitle>Recommendations</CardTitle>
              </div>
              <CardDescription>
                Easy-to-follow advice to improve your college - no technical knowledge needed!
              </CardDescription>
            </CardHeader>
            
            {/* Recommendations Visualization */}
            <div className="px-6 py-4 border-b border-amber-100 bg-gradient-to-r from-amber-50/50 to-orange-50/50">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-amber-800 mb-3 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-600" />
                  Why These Recommendations Matter
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="p-3 bg-white rounded-lg border border-amber-200 shadow-sm">
                    <div className="flex justify-center mb-2">
                      <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <FaLightbulb className="h-6 w-6 text-amber-500" />
                      </div>
                    </div>
                    <h4 className="text-sm font-medium text-center mb-1">AI-Powered Analysis</h4>
                    <p className="text-xs text-center text-gray-600">Our AI studies patterns in your college data to find opportunities for improvement</p>
                  </div>
                  
                  <div className="p-3 bg-white rounded-lg border border-amber-200 shadow-sm">
                    <div className="flex justify-center mb-2">
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Clock className="h-6 w-6 text-green-600" />
                      </div>
                    </div>
                    <h4 className="text-sm font-medium text-center mb-1">Quick Wins</h4>
                    <p className="text-xs text-center text-gray-600">Focus on high-impact actions you can take immediately with minimal resources</p>
                  </div>
                  
                  <div className="p-3 bg-white rounded-lg border border-amber-200 shadow-sm">
                    <div className="flex justify-center mb-2">
                      <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                        <Presentation className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                    <h4 className="text-sm font-medium text-center mb-1">Plain Language</h4>
                    <p className="text-xs text-center text-gray-600">All advice is written in simple terms - no technical expertise needed!</p>
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded-lg border border-amber-200 mb-4">
                  <h4 className="text-sm font-medium mb-2 text-amber-800">How We Generate These Recommendations:</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-shrink-0 h-7 w-7 bg-amber-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-amber-800">1</span>
                      </div>
                      <p className="text-xs text-gray-700">Our AI analyzes your department activity, user engagement, and verification patterns</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-shrink-0 h-7 w-7 bg-amber-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-amber-800">2</span>
                      </div>
                      <p className="text-xs text-gray-700">We identify areas for improvement based on best practices in flipped learning</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-shrink-0 h-7 w-7 bg-amber-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-amber-800">3</span>
                      </div>
                      <p className="text-xs text-gray-700">Recommendations are prioritized by impact and ease of implementation</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-shrink-0 h-7 w-7 bg-amber-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-amber-800">4</span>
                      </div>
                      <p className="text-xs text-gray-700">Each suggestion comes with simple steps you can follow without technical expertise</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-center">
                  <div className="inline-flex items-center gap-2 bg-amber-100 px-4 py-2 rounded-full text-amber-800 text-sm font-medium animate__animated animate__pulse animate__infinite animate__slow">
                    <Sparkles className="h-4 w-4" />
                    <span>Scroll down to see your personalized recommendations!</span>
                    <Sparkles className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>
            <CardContent className="pt-6">
              {ai_recommendations ? (
                <RecommendationsContent aiRecommendations={ai_recommendations} />
              ) : (
                <div className="p-8 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                  <FaLightbulb className="h-12 w-12 text-amber-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">No recommendations yet</h3>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">
                    Add more users, departments, and activity to get personalized AI recommendations for your college.
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-amber-50 border-t border-amber-100 p-4">
              <div className="flex items-start gap-2">
                <FaLightbulb className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-700 mb-1">How to use these suggestions:</p>
                  <ul className="text-xs text-amber-600 space-y-1 list-disc pl-4">
                    <li>Pick one suggestion to try today</li>
                    <li>Start with simple suggestions for immediate results</li>
                    <li>The list updates automatically as your college grows</li>
                    <li>No technical knowledge needed - just follow the steps!</li>
                  </ul>
                </div>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}