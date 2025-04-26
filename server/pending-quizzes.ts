import { QuizService } from './il-quiz-service';
import { Express, Request, Response } from 'express';

/**
 * Add routes for pending quizzes and student quiz attempts
 */
export function addPendingQuizzesRoutes(app: Express) {
  // Get all pending (unattempted) quizzes for a student in a department
  app.get("/api/il/quizzes/department/:departmentId/pending", async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const departmentId = parseInt(req.params.departmentId);
      const studentId = req.user.id;
      
      // Get all quizzes for the department
      const allQuizzes = await QuizService.getQuizzesByDepartment(departmentId);
      
      // Filter to only published quizzes
      const publishedQuizzes = allQuizzes.filter(quiz => quiz.is_published);
      
      // For each quiz, check if the student has attempted it
      const pendingQuizzes = [];
      for (const quiz of publishedQuizzes) {
        const hasAttempted = await QuizService.hasStudentAttemptedQuiz(quiz.id, studentId);
        if (!hasAttempted) {
          pendingQuizzes.push(quiz);
        }
      }
      
      res.json(pendingQuizzes);
    } catch (error) {
      console.error("Error fetching pending quizzes:", error);
      res.status(500).json({ error: "Failed to fetch pending quizzes" });
    }
  });
  
  // Get all quiz attempts for a student with quiz information
  app.get("/api/il/student/quiz-attempts/:studentId", async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const studentId = parseInt(req.params.studentId);
      
      // Check if the requesting user is the student or a faculty/admin
      if (req.user.id !== studentId && req.user.role !== 'faculty' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Not authorized to view these attempts" });
      }
      
      // Get all quiz attempts by the student with quiz information
      const attempts = await QuizService.getStudentAllAttemptsWithQuizInfo(studentId);
      
      return res.json(attempts);
    } catch (error) {
      console.error("Error fetching student's quiz attempts:", error);
      res.status(500).json({ error: "Failed to fetch quiz attempts" });
    }
  });
}