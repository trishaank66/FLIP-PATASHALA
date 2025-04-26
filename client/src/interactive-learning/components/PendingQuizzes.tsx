import React from 'react';
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Card, 
  CardContent
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Import the IlQuiz interface from InteractiveLearningPage
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

interface PendingQuizzesProps {
  departmentId: number | null;
  onStartQuiz: (quizId: number) => void;
}

export function PendingQuizzes({ departmentId, onStartQuiz }: PendingQuizzesProps) {
  // Fetch pending quizzes
  const { data: pendingQuizzes = [], isLoading } = useQuery<IlQuiz[]>({
    queryKey: [`/api/il/quizzes/department/${departmentId}/pending`],
    enabled: !!departmentId
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
    );
  }

  if (!pendingQuizzes || pendingQuizzes.length === 0) {
    return (
      <div className="bg-gray-50 p-8 rounded-lg text-center animate__animated animate__fadeIn">
        <BookOpen className="h-10 w-10 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500">You've completed all available quizzes!</p>
        <p className="text-gray-400 text-sm mt-1">Check back later for new quizzes from your instructors.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pendingQuizzes.map((quiz) => (
        <Card key={quiz.id} className="overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-0">
            <div className="flex flex-col md:flex-row">
              <div className="bg-blue-50 p-4 md:w-1/4 flex items-center justify-center md:justify-start">
                <div className="text-center md:text-left">
                  <BookOpen className="h-8 w-8 text-blue-500 mx-auto md:mx-0 mb-2" />
                  <h3 className="font-medium text-blue-800">{quiz.subject}</h3>
                  <div className="flex flex-wrap gap-1 mt-2 justify-center md:justify-start">
                    <Badge variant="outline" className="bg-white">
                      {quiz.difficulty}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="p-4 md:p-6 flex-1">
                <h3 className="text-lg font-semibold mb-2">{quiz.title}</h3>
                <p className="text-gray-500 text-sm mb-4">{quiz.description || "No description available"}</p>
                
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200">
                      {quiz.questions ? (
                        typeof quiz.questions === 'string' ? 
                          `${JSON.parse(quiz.questions).length} Questions` : 
                          `${quiz.questions.length} Questions`
                      ) : "Quiz"}
                    </Badge>
                  </div>
                  <button
                    onClick={() => onStartQuiz(quiz.id)}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors"
                  >
                    <span>Start Quiz</span>
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default PendingQuizzes;