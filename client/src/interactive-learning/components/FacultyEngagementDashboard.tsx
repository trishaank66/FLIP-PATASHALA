import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, MinusCircle } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";

interface FacultyEngagementDashboardProps {
  departmentId: number;
}

export function FacultyEngagementDashboard({ departmentId }: FacultyEngagementDashboardProps) {
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['/api/engagement/department', departmentId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/engagement/department/${departmentId}`);
      const data = await response.json();
      return data;
    },
  });
  
  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['/api/engagement/trends/department', departmentId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/engagement/trends/department/${departmentId}`);
      const data = await response.json();
      return data;
    },
  });
  
  // Helper to get trend icon
  const getTrendIcon = (trend?: string) => {
    if (trend === 'up') return <TrendingUp className="text-green-500 h-4 w-4" />;
    if (trend === 'down') return <TrendingDown className="text-red-500 h-4 w-4" />;
    return <MinusCircle className="text-gray-500 h-4 w-4" />;
  };
  
  if (studentsLoading || trendsLoading) {
    return <LoadingState />;
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Student engagement table */}
      <Card className="md:col-span-3">
        <CardHeader>
          <CardTitle>Student Engagement</CardTitle>
          <CardDescription>Track student interactions with quizzes, forums, and polls</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="text-center">Interactions</TableHead>
                <TableHead className="text-center">Stars Earned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students && students.length > 0 ? (
                students.map((student: any) => (
                  <TableRow key={student.user_id}>
                    <TableCell>{student.name}</TableCell>
                    <TableCell className="text-center">
                      <span className="font-medium">{student.count}</span>
                      <span className="text-muted-foreground text-sm">/10</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {student.stars_earned} ⭐
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                    No student engagement data available yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Trends sidebar */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Insights</CardTitle>
          <CardDescription>AI-powered engagement trends</CardDescription>
        </CardHeader>
        <CardContent>
          {trends && trends.length > 0 ? (
            <ul className="space-y-3">
              {trends.map((trend: any) => (
                <li key={trend.student_id} className="p-3 bg-muted/50 rounded-md flex items-start">
                  <div className="mr-2 mt-1">
                    {getTrendIcon(trend.trend)}
                  </div>
                  <div>
                    <strong className="text-sm font-medium block">{trend.student_name}</strong>
                    <span className="text-sm text-muted-foreground">{trend.insight}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              No trends available yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card className="md:col-span-3">
        <CardHeader>
          <CardTitle>Student Engagement</CardTitle>
          <CardDescription>Track student interactions with quizzes, forums, and polls</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="w-full h-10" />
            ))}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Weekly Insights</CardTitle>
          <CardDescription>AI-powered engagement trends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array(3).fill(0).map((_, i) => (
              <Skeleton key={i} className="w-full h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}