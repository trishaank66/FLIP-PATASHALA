import React from 'react';
import { useQuery } from "@tanstack/react-query";
import { 
  Clock, 
  CheckCircle, 
  Calendar 
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Card, 
  CardContent
} from "@/components/ui/card";
import { formatDistanceToNow } from 'date-fns';

// Define interfaces for quiz attempts
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
  quiz: IlQuiz;
}

interface CompletedQuizzesProps {
  userId: number;
}

export function CompletedQuizzes({ userId }: CompletedQuizzesProps) {
  // Fetch completed quizzes with their attempt data
  const { data: completedQuizzes = [], isLoading } = useQuery<IlQuizAttempt[]>({
    queryKey: [`/api/il/student/quiz-attempts/${userId}`],
    enabled: !!userId
  });

  // Helper function to format date
  const formatDate = (dateString: string | Date): string => {
    if (!dateString) return 'Unknown date';
    
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    // Check if the date is valid
    if (isNaN(date.getTime())) return 'Invalid date';
    
    return formatDistanceToNow(date, { addSuffix: true });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
    );
  }

  if (!completedQuizzes || completedQuizzes.length === 0) {
    return (
      <div className="bg-gray-50 p-8 rounded-lg text-center animate__animated animate__fadeIn">
        <Clock className="h-10 w-10 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500">You haven't completed any quizzes yet.</p>
        <p className="text-gray-400 text-sm mt-1">Complete a quiz to see your results here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {completedQuizzes.map((attempt) => (
        <Card key={attempt.id} className="overflow-hidden hover:shadow-md transition-shadow animate__animated animate__fadeIn">
          <CardContent className="p-0">
            <div className="flex flex-col md:flex-row">
              <div className="bg-green-50 p-4 md:w-1/4 flex items-center justify-center md:justify-start">
                <div className="text-center md:text-left">
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto md:mx-0 mb-2" />
                  <h3 className="font-medium text-green-800">{attempt.quiz.subject}</h3>
                  <div className="flex flex-wrap gap-1 mt-2 justify-center md:justify-start">
                    <Badge variant="outline" className="bg-white">
                      {attempt.quiz.difficulty}
                    </Badge>
                    <Badge variant="outline" className="bg-white text-green-700">
                      Score: {Math.round(attempt.score * 100)}%
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="p-4 md:p-6 flex-1">
                <h3 className="text-lg font-semibold mb-2">{attempt.quiz.title}</h3>
                <p className="text-gray-500 text-sm mb-4">{attempt.quiz.description || "No description available"}</p>
                
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1 text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>Completed {formatDate(attempt.completed_at)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>
                      {attempt.time_taken ? `${Math.round(attempt.time_taken / 60)} minutes` : 'Time not recorded'}
                    </span>
                  </div>
                </div>
                
                <div className="mt-4">
                  <div className="mb-1 flex justify-between items-center">
                    <span className="text-sm font-medium">Score</span>
                    <span className="text-sm font-medium">{Math.round(attempt.score * 100)}%</span>
                  </div>
                  <Progress
                    value={attempt.score * 100}
                    className="h-2"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default CompletedQuizzes;