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
import { trackInteraction } from "../services/engagement-service";
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

// Type definitions
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
 * QuizTaker component for students to take quizzes
 * For adaptive quizzes, automatically adjusts difficulty based on performance
 */
export function QuizTaker({ 
  quizId,
  onComplete
}: { 
  quizId: number;
  onComplete: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Quiz state
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startingQuiz, setStartingQuiz] = useState(false);
  
  // Question state
  const [currentQuestion, setCurrentQuestion] = useState<number>(0);
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([]);
  const [answeredQuestions, setAnsweredQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<(number | string | null)[]>([]);
  const [userAnswers, setUserAnswers] = useState<(number | string)[]>([]);
  
  // Adaptive quiz state
  const [currentDifficulty, setCurrentDifficulty] = useState<string>('Medium');
  const [currentQuestionPerfLevel, setCurrentQuestionPerfLevel] = useState<string>('medium');
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [totalQuestions] = useState(5); // Max number of questions
  
  // Evaluation state
  const [evaluation, setEvaluation] = useState<QuizEvaluation | null>(null);

  // Fetch quiz
  const { data: quiz, isLoading: isLoadingQuiz } = useQuery<Quiz>({
    queryKey: [`/api/il/quizzes/${quizId}`],
    enabled: !!quizId,
  });

  // Start quiz mutation
  const startQuizMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/il/quizzes/${quizId}/start`, {
        studentId: user?.id
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.canTake && data.firstQuestion) {
        // Initialize with the first question
        setActiveQuestions([data.firstQuestion]);
        setCurrentQuestion(0);
        setQuestionCount(1);
        setCurrentDifficulty(data.firstQuestion.difficulty || 'Medium');
        setCurrentQuestionPerfLevel(data.firstQuestion.difficulty?.toLowerCase() || 'medium');
      } else {
        toast({
          title: "Cannot start quiz",
          description: "You may have already taken this quiz or it's not available.",
          variant: "destructive",
        });
        onComplete();
      }
      setStartingQuiz(false);
    },
    onError: (error) => {
      toast({
        title: "Error starting quiz",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive"
      });
      setStartingQuiz(false);
      onComplete();
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
        // Add new question to active questions
        setActiveQuestions(prev => [...prev, data.question]);
        
        // Move to next question
        setCurrentQuestion(prev => prev + 1);
        
        // Update difficulty
        setCurrentDifficulty(data.difficulty);
        setCurrentQuestionPerfLevel(data.difficulty.toLowerCase());
        
        // Reset selected answer
        setSelectedAnswer(null);
        
        // Increment question count
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
      
      // Track this interaction for engagement tracking
      if (user?.id) {
        trackInteraction(user.id, 'quiz_complete', quizId);
      }
      
      // Invalidate queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ['/api/il/student-quizzes'] });
    },
    onError: (error) => {
      toast({
        title: "Error completing quiz",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive"
      });
    }
  });

  // Timer for quiz
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (quizStarted && !quizCompleted) {
      timer = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [quizStarted, quizCompleted]);

  // Start quiz when user clicks start
  useEffect(() => {
    if (quizStarted && !startingQuiz && activeQuestions.length === 0) {
      setStartingQuiz(true);
      startQuizMutation.mutate();
    }
  }, [quizStarted, startingQuiz, activeQuestions.length]);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Handle answer selection
  const handleAnswerSelect = (answer: number | string) => {
    setSelectedAnswer(answer);
    
    // Store in selectedAnswers array at current index
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestion] = answer;
    setSelectedAnswers(newAnswers);
  };

  // Evaluate if the current answer is correct
  const evaluateAnswer = (): number => {
    if (selectedAnswer === null || !activeQuestions[currentQuestion]) return 0;
    
    const question = activeQuestions[currentQuestion];
    let isCorrect = false;
    
    if (question.type === 'short_answer' && typeof selectedAnswer === 'string') {
      const correctAnswer = question.correctAnswer?.toLowerCase() || '';
      isCorrect = selectedAnswer.toLowerCase().includes(correctAnswer);
    } else {
      const correctIndex = question.correctIndex;
      isCorrect = selectedAnswer === correctIndex;
    }
    
    return isCorrect ? 1 : 0;
  };

  // Proceed to next question
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

  // Submit quiz
  const handleSubmit = () => {
    if (!user) return;
    
    // Get the final score (average of all answers)
    const totalScore = userAnswers.reduce((sum: number, _, index) => {
      // Get the question that was answered
      const question = activeQuestions[index];
      
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
    if (activeQuestions[currentQuestion] && selectedAnswer !== null) {
      setUserAnswers(prev => [...prev, selectedAnswer]);
    }
    
    // Run the evaluation
    evaluateQuizMutation.mutate({
      studentName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
      subject: quiz?.subject || '',
      quizQuestions: activeQuestions,
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

  // Loading state
  if (isLoadingQuiz) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2">Loading quiz...</span>
      </div>
    );
  }

  // Error state
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

  // Quiz start screen
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
                    <span>Estimated time: 8-10 minutes</span>
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

  // Quiz completed screen
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

  // Loading questions state
  if (activeQuestions.length === 0 || startQuizMutation.isPending) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2">Preparing questions...</span>
      </div>
    );
  }

  // Taking quiz - current question display
  const currentQ = activeQuestions[currentQuestion];
  const progress = (questionCount / totalQuestions) * 100;
  
  if (!currentQ) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2">Loading question...</span>
      </div>
    );
  }

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
              {currentQ.question}
            </div>
            
            {currentQ.type === 'mcq' && (
              <RadioGroup 
                value={selectedAnswer !== null ? String(selectedAnswer) : undefined}
                onValueChange={(value) => handleAnswerSelect(parseInt(value))}
              >
                <div className="space-y-3">
                  {currentQ.options.map((option, idx) => (
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
            
            {currentQ.type === 'true_false' && (
              <RadioGroup 
                value={selectedAnswer !== null ? String(selectedAnswer) : undefined}
                onValueChange={(value) => handleAnswerSelect(parseInt(value))}
              >
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="0" id="true" />
                    <Label htmlFor="true" className="cursor-pointer">True</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1" id="false" />
                    <Label htmlFor="false" className="cursor-pointer">False</Label>
                  </div>
                </div>
              </RadioGroup>
            )}
            
            {currentQ.type === 'short_answer' && (
              <div className="space-y-2">
                <Label htmlFor="short-answer">Your answer:</Label>
                <Textarea 
                  id="short-answer"
                  placeholder="Type your answer here..."
                  value={selectedAnswer as string || ''}
                  onChange={(e) => handleAnswerSelect(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleNextQuestion}>
            {questionCount >= totalQuestions ? "Finish Quiz" : "Next Question"}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}