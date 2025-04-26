import React, { useState, useEffect } from 'react';
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  BookOpenCheck, 
  Check, 
  Clock, 
  BarChart,
  BookOpen,
  Loader2,
  ChevronRight,
  Sparkles
} from "lucide-react";
import 'animate.css';

interface QuizQuestion {
  question: string;
  options: string[];
  type: "mcq" | "true_false" | "short_answer";
  correctIndex?: number;
  correctAnswer?: string;
  explanation: string;
  difficulty?: string;
}

interface Quiz {
  id: number;
  title: string;
  description: string | null;
  subject: string;
  difficulty: string;
  questions: QuizQuestion[];
  is_published: boolean;
  is_enabled: boolean;
  is_adaptive: boolean;
  content_id: number | null;
  created_by: number;
  department_id: number | null;
}

interface QuizEvaluation {
  score: number;
  misconceptions: string[];
  feedback: {
    personalMessage: string;
    improvementAreas: string[];
    recommendedResources: string[];
  };
  nextDifficulty?: string;
  suggestedConcepts?: string[];
}

/**
 * AdaptiveQuizTaker component for students to take adaptive quizzes
 * Questions dynamically adjust difficulty based on performance
 */
export function AdaptiveQuizTaker({ 
  quizId,
  onComplete
}: { 
  quizId: number;
  onComplete: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [answeredQuestions, setAnsweredQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | string | null>(null);
  const [userAnswers, setUserAnswers] = useState<(number | string)[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [evaluation, setEvaluation] = useState<QuizEvaluation | null>(null);
  const [currentDifficulty, setCurrentDifficulty] = useState('Medium'); // 'Easy', 'Medium', 'Hard'
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [totalQuestions] = useState(10); // Fixed number of questions per quiz
  const [startingQuiz, setStartingQuiz] = useState(false);
  
  // Fetch quiz basic info
  const { 
    data: quiz, 
    isLoading: isLoadingQuiz 
  } = useQuery<Quiz>({
    queryKey: [`/api/il/quizzes/${quizId}`],
  });
  
  // Start quiz mutation (gets first question)
  const startQuizMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/il/quizzes/${quizId}/start`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.firstQuestion) {
        setCurrentQuestion(data.firstQuestion);
        setCurrentDifficulty(data.firstQuestion.difficulty || 'Medium');
        setQuizStarted(true);
        setQuestionCount(1);
      } else {
        toast({
          title: "Cannot start quiz",
          description: data.message || "You may have already completed this quiz or it may be disabled",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error starting quiz",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive"
      });
    }
  });
  
  // Get next question mutation
  const nextQuestionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/il/quizzes/${quizId}/next-question`, {
        currentDifficulty,
        lastScore,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.question) {
        // Add current question to answered questions
        if (currentQuestion) {
          setAnsweredQuestions(prev => [...prev, currentQuestion]);
        }
        
        // Set the new question
        setCurrentQuestion(data.question);
        setCurrentDifficulty(data.difficulty);
        setSelectedAnswer(null);
        setQuestionCount(prev => prev + 1);
      }
    },
    onError: (error) => {
      toast({
        title: "Error loading next question",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive"
      });
    }
  });
  
  // Complete quiz mutation
  const completeQuizMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/il/quizzes/${quizId}/complete`, {
        answers: userAnswers,
        score: evaluation?.score || 0,
        timeTaken: elapsedTime
      });
      return response.json();
    },
    onSuccess: () => {
      setQuizCompleted(true);
      toast({
        title: "Quiz completed!",
        description: "Your answers have been recorded",
      });
      
      // Stop the timer
      setQuizStarted(false);
    },
    onError: (error) => {
      toast({
        title: "Error completing quiz",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive"
      });
    }
  });
  
  // Start timer on quiz start
  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (quizStarted && !quizCompleted) {
      timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [quizStarted, quizCompleted]);
  
  // Initialize when starting quiz
  React.useEffect(() => {
    if (quizStarted && !currentQuestion && !startingQuiz) {
      setStartingQuiz(true);
      startQuizMutation.mutate();
    }
  }, [quizStarted, currentQuestion, startingQuiz]);
  
  // Format elapsed time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  // Handle selecting an answer to a question
  const handleAnswerSelect = (answer: number | string) => {
    setSelectedAnswer(answer);
  };
  
  // Evaluate the current answer and score it
  const evaluateAnswer = (): number => {
    if (!currentQuestion || selectedAnswer === null) return 0;
    
    // Check if the answer is correct
    let isCorrect = false;
    
    // Check correctness based on question type
    if (currentQuestion.type === 'short_answer' && typeof selectedAnswer === 'string') {
      // Basic text matching (server will handle more sophisticated matching)
      const correctAnswer = currentQuestion.correctAnswer?.toLowerCase() || '';
      isCorrect = selectedAnswer.toLowerCase().includes(correctAnswer);
    } else {
      // MCQ or True/False
      const correctIndex = currentQuestion.correctIndex;
      isCorrect = selectedAnswer === correctIndex;
    }
    
    // Score: 1 for correct, 0 for incorrect
    return isCorrect ? 1 : 0;
  };
  
  // Proceed to the next question
  const handleNextQuestion = () => {
    // Check if an answer was selected
    if (selectedAnswer === null) {
      toast({
        title: "Please answer the question",
        description: "You need to select an answer before continuing",
        variant: "destructive",
      });
      return;
    }
    
    // Save this answer
    setUserAnswers(prev => [...prev, selectedAnswer]);
    
    // Score the answer
    const score = evaluateAnswer();
    setLastScore(score);
    
    // Check if we've reached the question limit
    if (questionCount >= totalQuestions) {
      // We've reached our question limit, submit the quiz
      handleSubmit();
      return;
    }
    
    // Request the next question
    nextQuestionMutation.mutate();
  };
  
  // Submit the completed quiz
  const handleSubmit = () => {
    if (!user) return;
    
    // Get the final score (average of all answers)
    const totalScore = userAnswers.reduce((sum: number, _, index) => {
      // Get the question that was answered
      const question = index === userAnswers.length - 1 
        ? currentQuestion 
        : answeredQuestions[index];
        
      if (!question) return sum;
      
      // Check if answer is correct
      const answer = userAnswers[index];
      
      let isCorrect = false;
      if (question.type === 'short_answer' && typeof answer === 'string') {
        const correctAnswer = question.correctAnswer?.toLowerCase() || '';
        isCorrect = answer.toLowerCase().includes(correctAnswer);
      } else {
        const correctIndex = question.correctIndex;
        isCorrect = answer === correctIndex;
      }
      
      return sum + (isCorrect ? 1 : 0);
    }, 0) / (userAnswers.length || 1); // Prevent division by zero
    
    // Add the current question and answer
    if (currentQuestion && selectedAnswer !== null) {
      setUserAnswers(prev => [...prev, selectedAnswer]);
    }
    
    // Run the evaluation
    evaluateQuizMutation.mutate({
      studentName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
      subject: quiz?.subject || '',
      quizQuestions: [...answeredQuestions, currentQuestion].filter(Boolean) as QuizQuestion[],
      studentAnswers: [...userAnswers, selectedAnswer].filter((a): a is number | string => a !== null)
    });
  };
  
  // Evaluate the entire quiz and provide personalized feedback
  const evaluateQuizMutation = useMutation({
    mutationFn: async (data: {
      studentName: string;
      subject: string;
      quizQuestions: QuizQuestion[];
      studentAnswers: (number | string)[];
    }) => {
      const response = await apiRequest("POST", "/api/il/evaluate-quiz", data);
      return response.json();
    },
    onSuccess: (data) => {
      // Save the evaluation
      setEvaluation(data);
      
      // Complete the quiz
      completeQuizMutation.mutate();
    },
    onError: (error) => {
      toast({
        title: "Error evaluating quiz",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive"
      });
    }
  });
  
  if (isLoadingQuiz) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2">Loading quiz...</span>
      </div>
    );
  }
  
  if (!quiz) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Quiz not found</p>
        <Button variant="outline" onClick={onComplete} className="mt-4">
          Back to Quizzes
        </Button>
      </div>
    );
  }
  
  if (!quizStarted) {
    return (
      <div className="animate__animated animate__fadeIn">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpenCheck className="h-5 w-5 text-blue-600" />
              {quiz.title}
            </CardTitle>
            <CardDescription>
              {quiz.description || "Test your knowledge with this adaptive quiz"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  <h3 className="font-medium text-blue-700">Quiz Information</h3>
                </div>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <span className="font-medium">Subject:</span> {quiz.subject}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="font-medium">Starting Difficulty:</span> {quiz.difficulty}
                  </li>
                  <li className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span>Estimated time: 15-20 minutes</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <BarChart className="h-4 w-4 text-gray-500" />
                    <span>Questions: {totalQuestions}</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-amber-50 p-4 rounded-md">
                <h3 className="font-medium text-amber-700 mb-1 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Adaptive Quiz
                </h3>
                <p className="text-sm text-amber-700 mb-2">
                  This is an adaptive quiz that adjusts to your performance:
                </p>
                <ul className="list-disc list-inside text-sm text-amber-600 space-y-1">
                  <li>Questions will adapt based on your answers</li>
                  <li>Correct answers lead to more challenging questions</li>
                  <li>Incorrect answers lead to easier questions</li>
                  <li>You'll get personalized feedback at the end</li>
                  <li>Your results will help guide your future learning</li>
                </ul>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => setQuizStarted(true)}>
              Start Quiz
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  if (quizCompleted && evaluation) {
    return (
      <div className="animate__animated animate__fadeIn">
        <Card>
          <CardHeader className="bg-blue-50">
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Quiz Completed!
            </CardTitle>
            <CardDescription>
              {quiz.title} - {quiz.subject}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-3xl font-bold mb-1">
                  {Math.round(evaluation.score * 100)}%
                </div>
                <p className="text-gray-600">
                  Time taken: {formatTime(elapsedTime)}
                </p>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <h3 className="font-medium text-gray-800">Personalized Feedback</h3>
                <p className="text-gray-600">
                  {evaluation.feedback.personalMessage}
                </p>
              </div>
              
              {evaluation.feedback.improvementAreas.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-800">Areas to Review</h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-1">
                    {evaluation.feedback.improvementAreas.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {evaluation.feedback.recommendedResources.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-800">Recommended Resources</h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-1">
                    {evaluation.feedback.recommendedResources.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="bg-blue-50 p-4 rounded-md">
                <h3 className="font-medium text-blue-700 mb-1">What Next?</h3>
                <p className="text-sm text-blue-600">
                  Based on your performance, we recommend exploring {evaluation.nextDifficulty || 'similar'} difficulty content related to {quiz.subject}.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={onComplete}>
              Back to Quizzes
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  // Taking the quiz - showing current question
  if (!currentQuestion || startQuizMutation.isPending) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2">Preparing questions...</span>
      </div>
    );
  }
  
  const progress = (questionCount / totalQuestions) * 100;
  
  return (
    <div className="animate__animated animate__fadeIn">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">{quiz.title}</CardTitle>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="font-mono">{formatTime(elapsedTime)}</span>
            </div>
          </div>
          <div className="flex justify-between text-sm text-gray-500">
            <span>Question {questionCount} of {totalQuestions} (Adaptive)</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="w-full bg-gray-200 h-1 mt-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-1 transition-all duration-300 ease-in-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center gap-1 justify-end">
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              {currentDifficulty === 'Easy' ? 'Basic' : 
               currentDifficulty === 'Medium' ? 'Intermediate' : 'Advanced'} 
              Level
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-6">
            <div className="text-lg font-medium">
              {currentQuestion.question}
            </div>
            
            {currentQuestion.type === 'mcq' && (
              <RadioGroup 
                value={selectedAnswer !== null ? String(selectedAnswer) : undefined}
                onValueChange={(value) => handleAnswerSelect(parseInt(value))}
              >
                <div className="space-y-3">
                  {currentQuestion.options.map((option, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <RadioGroupItem value={String(idx)} id={`option-${idx}`} />
                      <Label htmlFor={`option-${idx}`} className="cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            )}
            
            {currentQuestion.type === 'true_false' && (
              <RadioGroup 
                value={selectedAnswer !== null ? String(selectedAnswer) : undefined}
                onValueChange={(value) => handleAnswerSelect(parseInt(value))}
              >
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="0" id="true-option" />
                    <Label htmlFor="true-option" className="cursor-pointer">True</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1" id="false-option" />
                    <Label htmlFor="false-option" className="cursor-pointer">False</Label>
                  </div>
                </div>
              </RadioGroup>
            )}
            
            {currentQuestion.type === 'short_answer' && (
              <div className="space-y-2">
                <Label htmlFor="short-answer">Your Answer</Label>
                <Textarea 
                  id="short-answer" 
                  placeholder="Type your answer here..." 
                  value={typeof selectedAnswer === 'string' ? selectedAnswer : ''}
                  onChange={(e) => handleAnswerSelect(e.target.value)}
                  className="min-h-24"
                />
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div /> {/* Empty div to maintain layout */}
          
          {nextQuestionMutation.isPending || completeQuizMutation.isPending || evaluateQuizMutation.isPending ? (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {completeQuizMutation.isPending || evaluateQuizMutation.isPending ? 'Submitting...' : 'Loading next...'}
            </Button>
          ) : (
            <Button onClick={handleNextQuestion}>
              {questionCount < totalQuestions ? (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              ) : (
                <>
                  Submit Quiz
                  <Check className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}