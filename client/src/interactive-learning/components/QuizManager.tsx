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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  BookOpenCheck, 
  Plus, 
  Minus, 
  Check, 
  X, 
  Clock, 
  BarChart,
  BookOpen,
  Pencil,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Sparkles,
  Play,
  Edit,
  ChevronLeft,
  ChevronRight,
  Eye
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import 'animate.css';

// Type definitions
interface Content {
  id: number;
  title: string;
  description: string | null;
  subject: string;
  type: string;
  faculty: string | null;
  filename: string;
  url: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  type?: string;  // "mcq", "true_false", or "short_answer"
  correctAnswer?: number;  // Used for MCQ and T/F
  correctIndex?: number;   // Alternative field name from API
  correctAnswer_text?: string;  // Used for short answer
  explanation: string;
}

interface QuizData {
  title: string;
  description: string;
  subject: string;
  difficulty: string;
  content_id: number | null;
  questions: QuizQuestion[];
  created_by: number;
  department_id: number;
}

interface QuizAttempt {
  quiz_id: number;
  student_id: number;
  answers: number[];
  time_taken: number | null;
  score: number;
  difficulty_level: string;
}

interface QuizEvaluation {
  score: number;
  misconceptions: string[];
  feedback: string;
}

interface Quiz {
  id: number;
  title: string;
  description: string;
  subject: string;
  difficulty: string;
  content_id: number | null;
  questions: QuizQuestion[];
  created_at: string;
  created_by: number;
  department_id: number;
}

/**
 * QuizCreator component for faculty to create adaptive quizzes
 * 
 * Workflow:
 * 1. Select subject and handout content
 * 2. Auto-generate questions (no manual option needed)
 * 3. Preview quiz before publishing
 * 4. Publish quiz after confirmation
 */
export function QuizCreator({ 
  contentId = null,
  contentTitle = "",
  onQuizCreated 
}: { 
  contentId?: number | null;
  contentTitle?: string;
  onQuizCreated: () => void;
}) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  
  // Form state
  const [quizData, setQuizData] = useState<QuizData>({
    title: contentTitle ? `Quiz on ${contentTitle}` : "",
    description: "",
    subject: "",
    difficulty: "Medium", // We'll keep this in state but not show UI for it
    content_id: contentId,
    questions: [],
    created_by: user?.id ?? 0,
    department_id: user?.department_id ?? 0
  });
  
  // Update the user ID and department ID when user data changes
  useEffect(() => {
    if (user) {
      setQuizData(prev => ({
        ...prev,
        created_by: user.id,
        department_id: user.department_id ?? 0
      }));
    }
  }, [user]);
  
  // Get faculty's teaching subjects
  const { data: facultySubjects = [] } = useQuery<string[]>({
    queryKey: ['/api/faculty/subjects'],
    enabled: user?.role === 'faculty',
  });
  
  // Get handout content for selected subject
  const { data: subjectHandouts = [] } = useQuery<Content[]>({
    queryKey: ['/api/content/department', user?.department_id, quizData.subject, 'Lecture Handout'],
    enabled: !contentId && !!quizData.subject && !!user?.department_id,
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/content/department/${user?.department_id}`);
      const allContent = await res.json();
      // Filter to only include handouts from the selected subject
      return allContent.filter((content: Content) => 
        content.subject === quizData.subject && 
        content.type?.toLowerCase().includes('handout')
      );
    }
  });
  
  // Create quiz mutation
  const createQuizMutation = useMutation({
    mutationFn: async (data: QuizData) => {
      const response = await apiRequest("POST", "/api/il/quizzes", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Quiz created successfully",
        description: "Students can now take this quiz!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/il/quizzes'] });
      onQuizCreated();
    },
    onError: (error) => {
      toast({
        title: "Error creating quiz",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Generate questions mutation
  const generateQuestionsMutation = useMutation({
    mutationFn: async ({ contentId, subject, difficulty }: { 
      contentId: number; 
      subject: string; 
      difficulty: string;
    }) => {
      // Get the extracted text content from the handout file
      const textRes = await apiRequest("GET", `/api/content/${contentId}/extract-text`);
      const textData = await textRes.json();
      
      // Send the request to generate questions - STRICTLY follow the format
      const response = await apiRequest(
        "POST", 
        "/api/il/generate-quiz-questions", 
        { 
          contentText: textData.extractedText || "Sample content for quiz generation",
          subject,
          difficulty,
          numQuestions: 15, // Total of 15 questions
          previewMode: true, // Only send 3 questions for faculty preview
          format: {
            mcq: 8,       // 8 multiple choice questions
            true_false: 4, // 4 true/false questions
            short_answer: 3 // 3 short answer questions
          }
        }
      );
      return response.json();
    },
    onSuccess: (data) => {
      setQuizData(prev => ({
        ...prev,
        questions: data
      }));
      setCurrentStep(3); // Move to question review step
      setGeneratingQuestions(false);
    },
    onError: (error) => {
      toast({
        title: "Error generating questions",
        description: error.message,
        variant: "destructive",
      });
      setGeneratingQuestions(false);
    },
  });
  
  const handleInputChange = (field: keyof QuizData, value: any) => {
    setQuizData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleQuestionChange = (index: number, field: keyof QuizQuestion, value: any) => {
    setQuizData(prev => {
      const updatedQuestions = [...prev.questions];
      updatedQuestions[index] = {
        ...updatedQuestions[index],
        [field]: value
      };
      return {
        ...prev,
        questions: updatedQuestions
      };
    });
  };
  
  const handleOptionChange = (questionIndex: number, optionIndex: number, value: string) => {
    setQuizData(prev => {
      const updatedQuestions = [...prev.questions];
      const updatedOptions = [...updatedQuestions[questionIndex].options];
      updatedOptions[optionIndex] = value;
      
      updatedQuestions[questionIndex] = {
        ...updatedQuestions[questionIndex],
        options: updatedOptions
      };
      
      return {
        ...prev,
        questions: updatedQuestions
      };
    });
  };
  
  const addQuestion = () => {
    setQuizData(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          question: "",
          options: ["", "", "", ""],
          correctAnswer: 0,
          explanation: ""
        }
      ]
    }));
  };
  
  const removeQuestion = (index: number) => {
    setQuizData(prev => {
      const updatedQuestions = [...prev.questions];
      updatedQuestions.splice(index, 1);
      return {
        ...prev,
        questions: updatedQuestions
      };
    });
  };
  
  const generateQuestionsFromContent = () => {
    if (!quizData.content_id) {
      toast({
        title: "Content required",
        description: "Please select content to generate questions from",
        variant: "destructive",
      });
      return;
    }
    
    if (!quizData.subject) {
      toast({
        title: "Subject required",
        description: "Please enter a subject for the quiz",
        variant: "destructive",
      });
      return;
    }
    
    setGeneratingQuestions(true);
    generateQuestionsMutation.mutate({
      contentId: quizData.content_id,
      subject: quizData.subject,
      difficulty: quizData.difficulty
    });
  };
  
  const validateQuizData = () => {
    if (!quizData.title) return "Please enter a quiz title";
    if (!quizData.subject) return "Please enter a subject";
    if (quizData.questions.length === 0) return "Please add at least one question";
    
    for (let i = 0; i < quizData.questions.length; i++) {
      const q = quizData.questions[i];
      if (!q.question) return `Question ${i + 1} is missing text`;
      
      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j]) return `Question ${i + 1}, Option ${j + 1} is missing text`;
      }
    }
    
    return null;
  };
  
  const handleCreateQuiz = () => {
    const error = validateQuizData();
    if (error) {
      toast({
        title: "Validation Error",
        description: error,
        variant: "destructive",
      });
      return;
    }
    
    createQuizMutation.mutate(quizData);
  };
  
  return (
    <div className="animate__animated animate__fadeIn">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-blue-600" />
            Create Adaptive Quiz
          </CardTitle>
          <CardDescription>
            Create personalized quizzes based on your course materials
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quiz-title">Quiz Title</Label>
                <Input
                  id="quiz-title"
                  value={quizData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter quiz title"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="quiz-description">Description</Label>
                <Textarea
                  id="quiz-description"
                  value={quizData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe the quiz content and goals"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="quiz-subject">Subject</Label>
                <Select
                  value={quizData.subject}
                  onValueChange={(value) => handleInputChange('subject', value)}
                >
                  <SelectTrigger id="quiz-subject">
                    <SelectValue placeholder="Select a subject you teach" />
                  </SelectTrigger>
                  <SelectContent>
                    {facultySubjects.length === 0 ? (
                      <SelectItem value="none" disabled>No subjects found</SelectItem>
                    ) : (
                      facultySubjects.map((subject) => (
                        <SelectItem key={subject} value={subject}>
                          {subject}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {facultySubjects.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No subjects found. Please contact an admin to assign subjects to you.
                  </p>
                )}
              </div>
              
              {/* Difficulty level is hidden as it's automatically adjusted based on student performance */}
              
              {!contentId && (
                <div className="space-y-2">
                  <Label htmlFor="quiz-content">Link to Handout</Label>
                  <Select
                    value={quizData.content_id?.toString() || "none"}
                    onValueChange={(value) => handleInputChange('content_id', value === "none" ? null : parseInt(value))}
                    disabled={!quizData.subject || subjectHandouts.length === 0}
                  >
                    <SelectTrigger id="quiz-content">
                      <SelectValue placeholder={
                        !quizData.subject 
                          ? "Select a subject first" 
                          : subjectHandouts.length === 0 
                            ? "No handouts found for this subject" 
                            : "Select a handout"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {!quizData.subject ? (
                        <SelectItem value="none" disabled>Select a subject first</SelectItem>
                      ) : subjectHandouts.length === 0 ? (
                        <SelectItem value="none" disabled>No handouts found for this subject</SelectItem>
                      ) : (
                        <>
                          <SelectItem value="none">None</SelectItem>
                          {subjectHandouts.map((content) => (
                            <SelectItem key={content.id} value={content.id.toString()}>
                              {content.title}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  {quizData.subject && subjectHandouts.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      No handouts found for this subject. Upload lecture handouts first.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-md">
                <h3 className="font-medium text-blue-700 mb-1">
                  Generate Questions from Handout
                </h3>
                <p className="text-sm text-blue-600">
                  Our AI will analyze your handout content and create adaptive quiz questions for your students.
                </p>
              </div>
              
              {quizData.content_id ? (
                <div className="flex justify-center">
                  <Button 
                    onClick={generateQuestionsFromContent}
                    disabled={generatingQuestions}
                    className="w-full md:w-auto animate__animated animate__pulse animate__infinite"
                  >
                    {generatingQuestions ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Adaptive Quiz...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Start Taking Adaptive Quiz
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="text-center p-6 border border-dashed border-amber-200 rounded-md bg-amber-50">
                  <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-2" />
                  <h3 className="text-amber-800 font-medium mb-1">Content Required</h3>
                  <p className="text-amber-700 text-sm">
                    Please go back and select a handout to generate questions from.
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setCurrentStep(1)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back to Content Selection
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {currentStep === 3 && (
            <div className="space-y-6">
              <Tabs defaultValue={previewMode ? "preview" : "edit"} onValueChange={(value) => setPreviewMode(value === "preview")}>
                <div className="flex justify-between items-center">
                  <h3 className="font-medium text-gray-700">
                    Questions ({quizData.questions.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <TabsList>
                      <TabsTrigger value="edit" className="flex items-center gap-1">
                        <Edit className="h-4 w-4" />
                        <span>Edit</span>
                      </TabsTrigger>
                      <TabsTrigger value="preview" className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        <span>Preview</span>
                      </TabsTrigger>
                    </TabsList>
                    
                    {!previewMode && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={addQuestion}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Question
                      </Button>
                    )}
                  </div>
                </div>
                
                <TabsContent value="edit" className="space-y-6 mt-4">
                  {quizData.questions.map((question, qIndex) => (
                    <Card key={qIndex} className="border-blue-100">
                      <CardHeader className="bg-blue-50 pb-2">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <Label htmlFor={`question-${qIndex}`}>Question {qIndex + 1}</Label>
                            <Textarea
                              id={`question-${qIndex}`}
                              value={question.question}
                              onChange={(e) => handleQuestionChange(qIndex, 'question', e.target.value)}
                              placeholder="Enter your question"
                              className="mt-1"
                            />
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => removeQuestion(qIndex)}
                            className="ml-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="space-y-4">
                          <h4 className="text-sm font-medium text-gray-700">Options</h4>
                          <RadioGroup 
                            value={
                              (question.correctAnswer !== undefined 
                                ? question.correctAnswer 
                                : question.correctIndex)?.toString() || "0"
                            } 
                            onValueChange={(value) => handleQuestionChange(qIndex, 'correctAnswer', parseInt(value))}
                          >
                            {question.options.map((option, oIndex) => (
                              <div key={oIndex} className="flex items-start space-x-2 py-1">
                                <RadioGroupItem value={oIndex.toString()} id={`q${qIndex}-option-${oIndex}`} />
                                <div className="flex-1">
                                  <Label 
                                    htmlFor={`q${qIndex}-option-${oIndex}`}
                                    className="w-full"
                                  >
                                    <Input
                                      value={option}
                                      onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                                      placeholder={`Option ${oIndex + 1}`}
                                      className="mt-0"
                                    />
                                  </Label>
                                </div>
                              </div>
                            ))}
                          </RadioGroup>
                          
                          <div className="pt-2">
                            <Label htmlFor={`explanation-${qIndex}`}>Explanation (optional)</Label>
                            <Textarea
                              id={`explanation-${qIndex}`}
                              value={question.explanation}
                              onChange={(e) => handleQuestionChange(qIndex, 'explanation', e.target.value)}
                              placeholder="Explain the correct answer"
                              className="mt-1"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {quizData.questions.length === 0 && (
                    <div className="text-center py-8 border border-dashed border-gray-300 rounded-md">
                      <p className="text-gray-500">No questions added yet</p>
                      <Button 
                        variant="outline" 
                        onClick={addQuestion}
                        className="mt-2"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Question
                      </Button>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="preview" className="mt-4">
                  <Card className="animate__animated animate__fadeIn">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpenCheck className="h-5 w-5 text-blue-600" />
                        {quizData.title}
                      </CardTitle>
                      <CardDescription>
                        {quizData.description || "Test your knowledge with this interactive quiz"}
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
                              <span className="font-medium">Subject:</span> {quizData.subject}
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="font-medium">Difficulty:</span> {quizData.difficulty} (Adapts to student performance)
                            </li>
                            <li className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-500" />
                              <span>Estimated time: 5-10 minutes</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <BarChart className="h-4 w-4 text-gray-500" />
                              <span>Questions: {quizData.questions.length}</span>
                            </li>
                          </ul>
                        </div>
                        
                        {quizData.questions.length > 0 ? (
                          <div className="p-4 border rounded-md">
                            <h3 className="font-medium text-lg mb-1">
                              Sample Question Preview
                            </h3>
                            <p className="mb-3">{quizData.questions[0].question}</p>
                            
                            <RadioGroup 
                              value={
                                (quizData.questions[0].correctAnswer !== undefined 
                                  ? quizData.questions[0].correctAnswer 
                                  : quizData.questions[0].correctIndex)?.toString() || "0"
                              }
                            >
                              {quizData.questions[0].options.map((option, index) => (
                                <div key={index} className="flex items-center space-x-2 py-1">
                                  <RadioGroupItem value={index.toString()} id={`preview-option-${index}`} />
                                  <Label htmlFor={`preview-option-${index}`}>{option}</Label>
                                </div>
                              ))}
                            </RadioGroup>
                            
                            <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-md">
                              <p className="text-sm text-green-700 font-medium mb-1">
                                <strong>Important:</strong> This is just a preview of sample questions.
                              </p>
                              <ul className="text-sm text-green-600 list-disc list-inside space-y-1">
                                <li>Students will see ONE question at a time in an adaptive sequence</li>
                                <li>The full quiz contains 15 questions (8 MCQs, 4 True/False, 3 Short Answer)</li>
                                <li>Each question adapts to student performance on previous questions</li>
                                <li>Difficulty increases or decreases based on correct/incorrect answers</li>
                                <li>Students receive personalized feedback at the end of the quiz</li>
                              </ul>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 border border-dashed border-gray-300 rounded-md">
                            <p className="text-gray-500">No questions to preview</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          {currentStep > 1 && (
            <Button
              variant="outline"
              onClick={() => setCurrentStep(currentStep - 1)}
            >
              Back
            </Button>
          )}
          
          {currentStep < 3 ? (
            <Button onClick={() => setCurrentStep(currentStep + 1)}>
              Next
            </Button>
          ) : (
            <Button 
              onClick={handleCreateQuiz} 
              disabled={createQuizMutation.isPending}
            >
              {createQuizMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Create Quiz
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * QuizTaker component for students to take quizzes
 * This is an adaptive quiz where each question adapts based on previous performance
 */
export function QuizTaker({ 
  quizId,
  onComplete
}: { 
  quizId: number;
  onComplete: () => void;
}) {
  const { user } = useAuth();
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [answeredQuestions, setAnsweredQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | string | null>(null);
  const [userAnswers, setUserAnswers] = useState<(number | string)[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<(number | string)[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [evaluation, setEvaluation] = useState<QuizEvaluation | null>(null);
  const [currentQuestionPerfLevel, setCurrentQuestionPerfLevel] = useState('medium'); // 'easy', 'medium', 'hard'
  
  // Fetch quiz data
  const { 
    data: quiz = {} as Quiz,
    isLoading: isLoadingQuiz 
  } = useQuery<Quiz>({
    queryKey: [`/api/il/quizzes/${quizId}`],
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
  
  // Submit quiz attempt
  const submitQuizMutation = useMutation({
    mutationFn: async (data: any) => { // Using any to accommodate different answer types
      console.log("Submitting quiz attempt:", data);
      const response = await apiRequest("POST", "/api/il/quiz-attempts", data);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Quiz submission error:", errorText);
        throw new Error(`Error submitting quiz: ${response.status} ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setEvaluation(data);
      setQuizCompleted(true);
      toast({
        title: "Quiz completed!",
        description: `You scored ${Math.round(data.score * 100)}%`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/il/quizzes/${quizId}`] });
    },
    onError: (error) => {
      console.error("Quiz submission error:", error);
      toast({
        title: "Error submitting quiz",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
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
    const totalScore = userAnswers.reduce((sum, _, index) => {
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
    }, 0) / userAnswers.length;
    
    // Add the current question and answer
    if (currentQuestion && selectedAnswer !== null) {
      setUserAnswers(prev => [...prev, selectedAnswer]);
    }
    
    // Run the evaluation
    evaluateQuizMutation.mutate({
      studentName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
      subject: quiz.subject,
      quizQuestions: [...answeredQuestions, currentQuestion].filter(Boolean),
      studentAnswers: [...userAnswers, selectedAnswer].filter(Boolean)
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
              {quiz.description || "Test your knowledge with this interactive quiz"}
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
                    <span className="font-medium">Difficulty:</span> {quiz.difficulty}
                  </li>
                  <li className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span>Estimated time: 10-15 minutes</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <BarChart className="h-4 w-4 text-gray-500" />
                    <span>Questions: {quiz.questions.length}</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-amber-50 p-4 rounded-md">
                <h3 className="font-medium text-amber-700 mb-1">Instructions</h3>
                <ul className="list-disc list-inside text-sm text-amber-600 space-y-1">
                  <li>Read each question carefully</li>
                  <li>Select the best answer for each question</li>
                  <li>You can navigate between questions</li>
                  <li>Submit when you have answered all questions</li>
                  <li>Your results will be available immediately</li>
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
                  {evaluation.feedback}
                </p>
              </div>
              
              {evaluation.misconceptions.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-800">Areas to Review</h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-1">
                    {evaluation.misconceptions.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="bg-blue-50 p-4 rounded-md">
                <h3 className="font-medium text-blue-700 mb-1">What Next?</h3>
                <p className="text-sm text-blue-600">
                  Based on your performance, we recommend trying {evaluation.score > 0.7 ? "harder" : "similar"} quizzes on this topic to {evaluation.score > 0.7 ? "challenge yourself further" : "strengthen your understanding"}.
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
  
  // Taking the quiz
  // Make sure activeQuestions is properly loaded
  if (!activeQuestions || activeQuestions.length === 0) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2">Preparing questions...</span>
      </div>
    );
  }
  
  const currentQ = activeQuestions[currentQuestion];
  const maxQuestions = 5; // Same as in handleNextQuestion
  const progress = ((currentQuestion + 1) / maxQuestions) * 100;
  
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
            <span>Question {currentQuestion + 1} of {maxQuestions} (Adaptive)</span>
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
              {currentQuestionPerfLevel === 'easy' ? 'Basic' : 
               currentQuestionPerfLevel === 'medium' ? 'Intermediate' : 'Advanced'} 
              Level
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-6">
            <div className="text-lg font-medium">
              {currentQ.question}
            </div>
            
            {(currentQ.type === 'mcq' || currentQ.type === 'true_false' || !currentQ.type) && (
              <RadioGroup 
                value={selectedAnswers[currentQuestion]?.toString() || ""}
                onValueChange={(value) => handleAnswerSelect(parseInt(value))}
                className="space-y-3"
              >
                {currentQ.options.map((option: string, index: number) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                    <Label htmlFor={`option-${index}`} className="flex-1">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
            
            {currentQ.type === 'short_answer' && (
              <div>
                <Label htmlFor="short-answer">Your answer:</Label>
                <Textarea 
                  id="short-answer"
                  value={selectedAnswers[currentQuestion]?.toString() || ""}
                  onChange={(e) => handleAnswerSelect(e.target.value)}
                  placeholder="Type your answer here..."
                  className="mt-2"
                />
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button 
            onClick={handleNextQuestion}
            disabled={selectedAnswers[currentQuestion] === undefined}
            className="animate__animated animate__pulse animate__infinite"
          >
            {activeQuestions.length >= maxQuestions ? (
              submitQuizMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Finalizing...
                </>
              ) : (
                "Finish Quiz"
              )
            ) : (
              "Continue"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}