/**
 * Interactive Learning Quiz Service
 * 
 * Provides methods for managing adaptive quizzes including creation, retrieval,
 * scoring, and generating adaptive learning paths.
 */

import { db } from './db';
import {
  content,
  il_quizzes,
  il_quiz_attempts,
  users,
  departments,
  InsertIlQuiz, 
  InsertIlQuizAttempt, 
  IlQuizWithRelations
} from '@shared/schema';
import { eq, and, isNull, desc, sql, count, not, or } from 'drizzle-orm';
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Define TypeScript interfaces for quiz management
interface QuizQuestion {
  question: string;
  options: string[];
  type: "mcq" | "true_false" | "short_answer";
  correctIndex?: number;
  correctAnswer?: string;
  explanation: string;
  difficulty?: string; // Added for adaptive quiz difficulty tracking
}

interface QuizEvaluationResult {
  score: number;
  misconceptions: any[];
  feedback: {
    personalMessage: string;
    improvementAreas: string[];
    recommendedResources: string[];
  };
  nextDifficulty?: string;
  suggestedConcepts?: string[];
}

/**
 * Service class for Quiz operations
 */
export class QuizService {
  /**
   * Create a new quiz
   */
  static async createQuiz(quizData: InsertIlQuiz): Promise<IlQuizWithRelations> {
    try {
      // Insert the quiz
      const [quiz] = await db.insert(il_quizzes).values(quizData).returning();
      
      // If this quiz is linked to content, update the content to show it has a quiz
      if (quiz.content_id) {
        await db.execute(sql`UPDATE content SET has_quiz = true WHERE id = ${quiz.content_id}`);
      }
      
      // Return the quiz with relations
      return await this.getQuizById(quiz.id);
    } catch (error) {
      console.error('Error creating quiz:', error);
      throw new Error('Failed to create quiz');
    }
  }

  /**
   * Get a quiz by ID with relations
   */
  static async getQuizById(id: number): Promise<IlQuizWithRelations> {
    try {
      const [quiz] = await db.select()
        .from(il_quizzes)
        .where(eq(il_quizzes.id, id));
      
      if (!quiz) {
        throw new Error('Quiz not found');
      }

      // Get the creator info
      const [creator] = await db.select()
        .from(users)
        .where(eq(users.id, quiz.created_by));
      
      // Get department info if available
      let department = undefined;
      if (quiz.department_id) {
        const [dept] = await db.select()
          .from(departments)
          .where(eq(departments.id, quiz.department_id));
        department = dept;
      }
      
      // Get content if available
      let contentItem = undefined;
      if (quiz.content_id) {
        const [contentResult] = await db.select()
          .from(content)
          .where(eq(content.id, quiz.content_id));
        contentItem = contentResult;
      }

      // Get attempts
      const attempts = await db.select()
        .from(il_quiz_attempts)
        .where(eq(il_quiz_attempts.quiz_id, id));
      
      // Construct the quiz with relations
      return {
        ...quiz,
        creator,
        department,
        content: contentItem,
        attempts
      };
    } catch (error) {
      console.error('Error getting quiz:', error);
      throw new Error('Failed to get quiz');
    }
  }

  /**
   * Get quizzes by department
   */
  static async getQuizzesByDepartment(departmentId: number): Promise<IlQuizWithRelations[]> {
    try {
      const quizzes = await db.select()
        .from(il_quizzes)
        .where(and(
          eq(il_quizzes.department_id, departmentId),
          eq(il_quizzes.is_active, true),
          eq(il_quizzes.is_published, true) // Only show published quizzes
        ))
        .orderBy(desc(il_quizzes.created_at));
      
      // Get related data for each quiz
      const quizzesWithRelations = await Promise.all(
        quizzes.map(quiz => this.getQuizById(quiz.id))
      );
      
      return quizzesWithRelations;
    } catch (error) {
      console.error('Error getting quizzes by department:', error);
      throw new Error('Failed to get quizzes');
    }
  }

  /**
   * Get quizzes created by a specific faculty member
   */
  static async getQuizzesByFaculty(facultyId: number): Promise<IlQuizWithRelations[]> {
    try {
      const quizzes = await db.select()
        .from(il_quizzes)
        .where(and(
          eq(il_quizzes.created_by, facultyId),
          eq(il_quizzes.is_active, true),
          eq(il_quizzes.is_published, true) // Only show published quizzes
        ))
        .orderBy(desc(il_quizzes.created_at));
      
      // Get related data for each quiz
      const quizzesWithRelations = await Promise.all(
        quizzes.map(quiz => this.getQuizById(quiz.id))
      );
      
      return quizzesWithRelations;
    } catch (error) {
      console.error('Error getting quizzes by faculty:', error);
      throw new Error('Failed to get quizzes');
    }
  }

  /**
   * Get quizzes associated with a specific content item
   */
  static async getQuizzesByContentId(contentId: number): Promise<IlQuizWithRelations[]> {
    try {
      const quizzes = await db.select()
        .from(il_quizzes)
        .where(and(
          eq(il_quizzes.content_id, contentId),
          eq(il_quizzes.is_active, true),
          eq(il_quizzes.is_published, true) // Only show published quizzes
        ))
        .orderBy(desc(il_quizzes.created_at));
      
      // Get related data for each quiz
      const quizzesWithRelations = await Promise.all(
        quizzes.map(quiz => this.getQuizById(quiz.id))
      );
      
      return quizzesWithRelations;
    } catch (error) {
      console.error('Error getting quizzes by content ID:', error);
      throw new Error('Failed to get quizzes');
    }
  }

  /**
   * Update a quiz
   */
  static async updateQuiz(id: number, quizData: Partial<InsertIlQuiz>): Promise<IlQuizWithRelations> {
    try {
      // Update the quiz
      const [updatedQuiz] = await db.update(il_quizzes)
        .set({ 
          ...quizData,
          updated_at: new Date()
        })
        .where(eq(il_quizzes.id, id))
        .returning();
      
      if (!updatedQuiz) {
        throw new Error('Quiz not found');
      }
      
      // Return the updated quiz with relations
      return await this.getQuizById(updatedQuiz.id);
    } catch (error) {
      console.error('Error updating quiz:', error);
      throw new Error('Failed to update quiz');
    }
  }

  /**
   * Mark a quiz as deleted (soft delete)
   */
  static async deleteQuiz(id: number): Promise<boolean> {
    try {
      const [deletedQuiz] = await db.update(il_quizzes)
        .set({ 
          is_active: false,
          updated_at: new Date()
        })
        .where(eq(il_quizzes.id, id))
        .returning();
      
      return !!deletedQuiz;
    } catch (error) {
      console.error('Error deleting quiz:', error);
      throw new Error('Failed to delete quiz');
    }
  }

  /**
   * Record a student's quiz attempt
   */
  static async recordQuizAttempt(attemptData: InsertIlQuizAttempt): Promise<number> {
    try {
      const [attempt] = await db.insert(il_quiz_attempts)
        .values(attemptData)
        .returning();
      
      return attempt.id;
    } catch (error) {
      console.error('Error recording quiz attempt:', error);
      throw new Error('Failed to record quiz attempt');
    }
  }

  /**
   * Get a student's quiz attempts for a specific quiz
   */
  static async getStudentQuizAttempts(quizId: number, studentId: number) {
    try {
      const attempts = await db.select()
        .from(il_quiz_attempts)
        .where(and(
          eq(il_quiz_attempts.quiz_id, quizId),
          eq(il_quiz_attempts.student_id, studentId)
        ))
        .orderBy(desc(il_quiz_attempts.completed_at));
      
      return attempts;
    } catch (error) {
      console.error('Error getting student quiz attempts:', error);
      throw new Error('Failed to get quiz attempts');
    }
  }
  
  /**
   * Check if a student has already attempted a quiz
   */
  static async hasStudentAttemptedQuiz(quizId: number, studentId: number): Promise<boolean> {
    try {
      const [attempt] = await db.select({ count: count() })
        .from(il_quiz_attempts)
        .where(and(
          eq(il_quiz_attempts.quiz_id, quizId),
          eq(il_quiz_attempts.student_id, studentId)
        ));
      
      return attempt.count > 0;
    } catch (error) {
      console.error('Error checking student quiz attempt:', error);
      throw new Error('Failed to check quiz attempt');
    }
  }
  
  /**
   * Get all quiz attempts for a student
   */
  static async getStudentAllAttempts(studentId: number) {
    try {
      const attempts = await db.select()
        .from(il_quiz_attempts)
        .where(eq(il_quiz_attempts.student_id, studentId))
        .orderBy(desc(il_quiz_attempts.completed_at));
      
      return attempts;
    } catch (error) {
      console.error('Error getting all student quiz attempts:', error);
      throw new Error('Failed to get quiz attempts');
    }
  }
  
  /**
   * Get all quiz attempts for a student with quiz information
   */
  static async getStudentAllAttemptsWithQuizInfo(studentId: number) {
    try {
      const attempts = await db.select({
        attempt: il_quiz_attempts,
        quiz: il_quizzes
      })
        .from(il_quiz_attempts)
        .innerJoin(il_quizzes, eq(il_quiz_attempts.quiz_id, il_quizzes.id))
        .where(eq(il_quiz_attempts.student_id, studentId))
        .orderBy(desc(il_quiz_attempts.completed_at));
      
      // Format the results
      return attempts.map(item => ({
        ...item.attempt,
        quiz: {
          id: item.quiz.id,
          title: item.quiz.title,
          description: item.quiz.description,
          subject: item.quiz.subject,
          difficulty: item.quiz.difficulty,
          content_id: item.quiz.content_id,
          department_id: item.quiz.department_id,
          created_at: item.quiz.created_at,
          created_by: item.quiz.created_by
        }
      }));
    } catch (error) {
      console.error('Error getting student quiz attempts with quiz info:', error);
      throw new Error('Failed to get quiz attempts with quiz info');
    }
  }

  /**
   * Generate quiz questions from content with specific format requirements
   * @param contentText Text content to generate questions from
   * @param subject Subject of the content
   * @param difficulty Difficulty level (Easy, Medium, Hard)
   * @param numQuestions Total number of questions to generate
   * @param format Optional object specifying question counts by type
   */
  static async generateQuizQuestions(
    contentText: string, 
    subject: string, 
    difficulty: string, 
    numQuestions: number = 15,
    format: {mcq: number, true_false: number, short_answer: number} = {mcq: 8, true_false: 4, short_answer: 3}
  ) {
    try {
      console.log('Generating quiz questions...');
      
      // Call Python script to generate questions
      const scriptPath = path.join(process.cwd(), 'python', 'quiz_generator.py');
      
      // Save content to a temporary file to avoid command line size issues
      const tempFilePath = path.join(process.cwd(), 'temp_content.txt');
      fs.writeFileSync(tempFilePath, contentText);
      
      // Format as JSON string to pass to Python
      const formatJson = JSON.stringify(format);
      
      const result = spawnSync('python3', [
        '-c', 
        `
import sys, json
sys.path.append('${path.join(process.cwd(), 'python')}')
from quiz_generator import generate_questions
with open('${tempFilePath}', 'r') as f:
    content = f.read()
format_obj = json.loads('${formatJson}')
# Pass subject only for reference, focus entirely on analyzing the content
questions = generate_questions(
    content, 
    '${subject}', # Only used for context/reference
    '${difficulty}', 
    ${numQuestions},
    mcq_count=format_obj['mcq'],
    true_false_count=format_obj['true_false'],
    short_answer_count=format_obj['short_answer'],
    content_focused=True  # New parameter to indicate we should focus only on the content
)
print(json.dumps(questions))
        `
      ], { encoding: 'utf-8' });
      
      // Clean up temp file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      
      if (result.error) {
        console.error('Error executing Python script:', result.error);
        throw new Error('Failed to generate quiz questions');
      }
      
      if (result.stderr) {
        console.error('Python script error:', result.stderr);
      }
      
      // Parse the output as JSON with better error handling
      let questions;
      try {
        const output = result.stdout.trim();
        console.log('Python output:', output.substring(0, 200) + (output.length > 200 ? '...' : ''));
        questions = JSON.parse(output);
      } catch (parseError) {
        console.error('Error parsing JSON from Python script:', parseError);
        console.error('Raw output:', result.stdout);
        // Provide fallback questions since JSON parsing failed
        questions = [
          {
            question: `What is the most important concept in "${subject}"?`,
            options: ["Option A", "Option B", "Option C", "Option D"],
            type: "mcq",
            correctIndex: 0,
            explanation: "This is a fallback question due to error in question generation."
          },
          {
            question: `True or False: "${subject}" concepts are essential for understanding the material.`,
            options: ["True", "False"],
            type: "true_false",
            correctIndex: 0,
            explanation: "This is a fallback question due to error in question generation."
          },
          {
            question: `Explain briefly why "${subject}" is important.`,
            options: [],
            type: "short_answer",
            correctAnswer: "Important concepts",
            explanation: "This is a fallback question due to error in question generation."
          }
        ];
      }
      
      // Sort questions by type to ensure correct ordering
      // MCQs first, then True/False, then Short Answer
      questions.sort((a: any, b: any) => {
        const typeOrder: Record<string, number> = { mcq: 1, true_false: 2, short_answer: 3 };
        const typeA = a.type || 'mcq'; // Default to mcq if type not specified
        const typeB = b.type || 'mcq';
        return typeOrder[typeA] - typeOrder[typeB];
      });
      
      return questions;
    } catch (error) {
      console.error('Error generating quiz questions:', error);
      throw new Error('Failed to generate quiz questions');
    }
  }

  /**
   * Enable or disable quiz for a content item
   */
  static async toggleQuizEnabled(contentId: number, isEnabled: boolean): Promise<IlQuizWithRelations> {
    try {
      // Check if a quiz exists for this content
      const existingQuizzes = await db.select()
        .from(il_quizzes)
        .where(and(
          eq(il_quizzes.content_id, contentId),
          eq(il_quizzes.is_active, true)
        ));
      
      if (existingQuizzes.length === 0) {
        // No quiz exists yet, we need to create one
        // First, let's get the content details to create a quiz
        const [contentItem] = await db.select()
          .from(content)
          .where(eq(content.id, contentId));
          
        if (!contentItem) {
          throw new Error('Content not found');
        }
        
        // Get content text for question generation
        const contentText = contentItem.description || '';
        
        // Create default questions (will be dynamically generated when students take the quiz)
        const defaultQuestions: QuizQuestion[] = [
          {
            question: "This is a placeholder question that will be replaced with a dynamically generated question",
            options: ["Option 1", "Option 2", "Option 3", "Option 4"],
            type: "mcq",
            correctIndex: 0,
            explanation: "This is a placeholder explanation."
          }
        ];
        
        // Get department ID from the content if available, or default to null
        // Access directly as any since property access is typed
        const departmentId = (contentItem as any).department_id || null;
                           
        // Get creator ID from the content
        const creatorId = contentItem.uploaded_by || 
                        (contentItem as any).faculty_id || 
                        // fallback to a system admin ID
                        1;
        
        // Create a new quiz
        const newQuizData: InsertIlQuiz = {
          title: `Quiz for ${contentItem.title}`,
          description: `Automatically generated quiz for ${contentItem.title}`,
          content_id: contentId,
          subject: contentItem.subject || 'General',
          difficulty: 'Medium', // Default starting difficulty
          created_by: creatorId,
          questions: defaultQuestions,
          is_enabled: isEnabled,
          is_published: false, // Default to unpublished
          is_adaptive: true,
          department_id: departmentId
        };
        
        // Create the quiz
        const newQuiz = await this.createQuiz(newQuizData);
        
        // Update content has_quiz flag
        await db.update(content)
          .set({ has_quiz: true })
          .where(eq(content.id, contentId));
          
        return newQuiz;
      } else {
        // Quiz exists, update its enabled status
        const quiz = existingQuizzes[0];
        
        // Update the quiz
        return await this.updateQuiz(quiz.id, { is_enabled: isEnabled });
      }
    } catch (error) {
      console.error('Error toggling quiz enabled status:', error);
      throw new Error('Failed to toggle quiz enabled status');
    }
  }
  
  /**
   * Publish or unpublish a quiz
   */
  static async toggleQuizPublished(quizId: number, isPublished: boolean): Promise<IlQuizWithRelations> {
    try {
      // Get the quiz
      const quiz = await this.getQuizById(quizId);
      
      if (!quiz.is_enabled && isPublished) {
        throw new Error('Cannot publish a disabled quiz. Enable the quiz first.');
      }
      
      // Update the quiz
      return await this.updateQuiz(quizId, { is_published: isPublished });
    } catch (error) {
      console.error('Error toggling quiz published status:', error);
      throw new Error('Failed to toggle quiz published status');
    }
  }
  
  /**
   * Get available quizzes for a student
   * These are quizzes that are enabled, published, and not yet attempted by the student
   */
  static async getAvailableQuizzesForStudent(studentId: number, departmentId: number): Promise<IlQuizWithRelations[]> {
    try {
      // Get all published quizzes for the student's department
      const publishedQuizzes = await db.select()
        .from(il_quizzes)
        .where(and(
          eq(il_quizzes.department_id, departmentId), 
          eq(il_quizzes.is_active, true),
          eq(il_quizzes.is_enabled, true),
          eq(il_quizzes.is_published, true)
        ));
      
      // Get all quizzes the student has already attempted
      const attemptedQuizIds = await db.select({ quiz_id: il_quiz_attempts.quiz_id })
        .from(il_quiz_attempts)
        .where(eq(il_quiz_attempts.student_id, studentId));
      
      // Filter out quizzes the student has already attempted
      const attemptedIds = new Set(attemptedQuizIds.map(a => a.quiz_id));
      const availableQuizzes = publishedQuizzes.filter(quiz => !attemptedIds.has(quiz.id));
      
      // Get full quiz data with relations
      const quizzesWithRelations = await Promise.all(
        availableQuizzes.map(quiz => this.getQuizById(quiz.id))
      );
      
      return quizzesWithRelations;
    } catch (error) {
      console.error('Error getting available quizzes for student:', error);
      throw new Error('Failed to get available quizzes');
    }
  }
  
  /**
   * Start a quiz for a student
   * This checks if the student can take the quiz, and returns the first question
   */
  static async startQuiz(quizId: number, studentId: number): Promise<{ 
    quiz: IlQuizWithRelations, 
    canTake: boolean, 
    firstQuestion?: QuizQuestion 
  }> {
    try {
      // Get the quiz
      const quiz = await this.getQuizById(quizId);
      
      // Check if the quiz is enabled and published
      if (!quiz.is_enabled || !quiz.is_published) {
        return { quiz, canTake: false };
      }
      
      // Check if the student has already attempted this quiz
      const hasAttempted = await this.hasStudentAttemptedQuiz(quizId, studentId);
      
      if (hasAttempted) {
        return { quiz, canTake: false };
      }
      
      // Get content info for question generation
      let contentText = '';
      // Import ContentService to extract full text
      const { ContentService } = require('./content-service');
      
      if (quiz.content) {
        if (quiz.content.type === 'Lecture Handout') {
          try {
            // Extract the full document content for better question generation
            contentText = await ContentService.extractFileContent(quiz.content.id);
            console.log(`Extracted ${contentText.length} characters of content for quiz start`);
          } catch (extractError) {
            console.error('Error extracting handout content:', extractError);
            // Fallback to description if extraction fails
            contentText = quiz.content.description || '';
          }
        } else {
          // For other content types, use description
          contentText = quiz.content.description || '';
        }
      }
      
      // Generate the first question based on quiz difficulty
      const question = await this.generateDynamicQuestion(contentText, quiz.subject, quiz.difficulty);
      
      return { 
        quiz, 
        canTake: true, 
        firstQuestion: question 
      };
    } catch (error) {
      console.error('Error starting quiz:', error);
      throw new Error('Failed to start quiz');
    }
  }
  
  /**
   * Generate a single dynamic quiz question
   */
  static async generateDynamicQuestion(
    contentText: string,
    subject: string,
    difficulty: string,
    questionType?: "mcq" | "true_false" | "short_answer"
  ): Promise<QuizQuestion> {
    try {
      // If no specific type is requested, choose randomly with weighted distribution
      // 60% MCQ, 30% True/False, 10% Short Answer
      if (!questionType) {
        const rand = Math.random();
        if (rand < 0.6) {
          questionType = "mcq";
        } else if (rand < 0.9) {
          questionType = "true_false";
        } else {
          questionType = "short_answer";
        }
      }
      
      // Generate a single question of the specified type
      const format = {
        mcq: questionType === "mcq" ? 1 : 0,
        true_false: questionType === "true_false" ? 1 : 0,
        short_answer: questionType === "short_answer" ? 1 : 0
      };
      
      // Call our question generation function
      const questions = await this.generateQuizQuestions(
        contentText,
        subject,
        difficulty,
        1, // Just one question at a time
        format
      );
      
      // Return the first (and only) question
      return questions[0];
    } catch (error) {
      console.error('Error generating dynamic question:', error);
      // Return a fallback question in case of failure
      return {
        question: `Question about ${subject}`,
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
        type: "mcq",
        correctIndex: 0,
        explanation: "Explanation will be provided after answering."
      };
    }
  }
  
  /**
   * Evaluate a student's quiz answers and provide feedback
   */
  static async evaluateQuizAnswers(
    studentName: string,
    subject: string,
    quizQuestions: QuizQuestion[],
    studentAnswers: (number | string)[]
  ): Promise<QuizEvaluationResult> {
    try {
      console.log('Evaluating quiz answers...');
      
      // Convert inputs to JSON strings for the Python script
      const questionsJson = JSON.stringify(quizQuestions).replace(/"/g, '\\"');
      const answersJson = JSON.stringify(studentAnswers).replace(/"/g, '\\"');
      
      // Call Python script to evaluate answers and generate feedback
      const scriptPath = path.join(process.cwd(), 'python', 'quiz_evaluator.py');
      
      const result = spawnSync('python3', [
        '-c', 
        `
import sys, json
sys.path.append('${path.join(process.cwd(), 'python')}')
from quiz_evaluator import calculate_score, analyze_misconceptions, generate_personalized_feedback, adapt_difficulty, suggest_next_questions

questions = json.loads("""${questionsJson}""")
answers = json.loads("""${answersJson}""")

score = calculate_score(answers, questions)
misconceptions = analyze_misconceptions(answers, questions)
feedback = generate_personalized_feedback("${studentName}", "${subject}", score, misconceptions)
current_difficulty = "${quizQuestions[0]?.difficulty || 'Medium'}"
next_difficulty = adapt_difficulty(score, current_difficulty)
suggested_concepts = suggest_next_questions("${subject}", current_difficulty, misconceptions)

result = {
    "score": score,
    "misconceptions": misconceptions,
    "feedback": feedback,
    "nextDifficulty": next_difficulty,
    "suggestedConcepts": suggested_concepts
}

print(json.dumps(result))
        `
      ], { encoding: 'utf-8' });
      
      if (result.error) {
        console.error('Error executing Python script:', result.error);
        throw new Error('Failed to evaluate quiz answers');
      }
      
      if (result.stderr) {
        console.error('Python script error:', result.stderr);
      }
      
      // Parse the output as JSON
      return JSON.parse(result.stdout.trim());
    } catch (error) {
      console.error('Error evaluating quiz answers:', error);
      throw new Error('Failed to evaluate quiz answers');
    }
  }

  /**
   * Determine the next recommended quiz difficulty based on performance
   */
  static async recommendNextDifficulty(score: number, currentDifficulty: string): Promise<string> {
    try {
      console.log(`Determining next quiz difficulty from score ${score} and current difficulty ${currentDifficulty}...`);
      
      // Normalize difficulty to match expected values
      let normalizedDifficulty = currentDifficulty;
      const validDifficulties = ["Easy", "Medium", "Hard"];
      
      if (!validDifficulties.includes(normalizedDifficulty)) {
        // Case-insensitive matching
        for (const diff of validDifficulties) {
          if (diff.toLowerCase() === normalizedDifficulty.toLowerCase()) {
            normalizedDifficulty = diff;
            break;
          }
        }
        // Default to Medium if no match found
        if (!validDifficulties.includes(normalizedDifficulty)) {
          normalizedDifficulty = "Medium";
        }
      }
      
      const result = spawnSync('python3', [
        '-c', 
        `
import sys
sys.path.append('${path.join(process.cwd(), 'python')}')
from quiz_generator import adapt_difficulty

next_difficulty = adapt_difficulty(${score}, "${normalizedDifficulty}")
print(next_difficulty)
        `
      ], { encoding: 'utf-8' });
      
      if (result.error) {
        console.error('Error executing Python script:', result.error);
        throw new Error('Failed to recommend next difficulty');
      }
      
      const nextDifficulty = result.stdout.trim();
      console.log(`Recommended difficulty: ${nextDifficulty}`);
      
      return nextDifficulty;
    } catch (error) {
      console.error('Error recommending next difficulty:', error);
      // Default to current difficulty if there's an error
      return currentDifficulty;
    }
  }

  /**
   * Complete a quiz and record the final results
   */
  static async completeQuiz(
    quizId: number,
    studentId: number,
    answers: any[],
    score: number,
    timeTaken: number | null = null
  ): Promise<IlQuizWithRelations> {
    try {
      // Get the quiz
      const quiz = await this.getQuizById(quizId);
      
      // Record the attempt
      await this.recordQuizAttempt({
        quiz_id: quizId,
        student_id: studentId,
        score,
        answers,
        time_taken: timeTaken,
        difficulty_level: quiz.difficulty
      });
      
      // Return the updated quiz with the new attempt
      return await this.getQuizById(quizId);
    } catch (error) {
      console.error('Error completing quiz:', error);
      throw new Error('Failed to complete quiz');
    }
  }
  
  /**
   * Get all quizzes for content management by faculty
   * This returns all quizzes regardless of published status
   */
  static async getQuizzesForFacultyManagement(facultyId: number): Promise<IlQuizWithRelations[]> {
    try {
      const quizzes = await db.select()
        .from(il_quizzes)
        .where(and(
          eq(il_quizzes.created_by, facultyId),
          eq(il_quizzes.is_active, true)
        ))
        .orderBy(desc(il_quizzes.created_at));
      
      // Get related data for each quiz
      const quizzesWithRelations = await Promise.all(
        quizzes.map(quiz => this.getQuizById(quiz.id))
      );
      
      return quizzesWithRelations;
    } catch (error) {
      console.error('Error getting quizzes for faculty management:', error);
      throw new Error('Failed to get quizzes for management');
    }
  }
  
  /**
   * Get active user quiz attempts for a quiz (for faculty dashboard)
   */
  static async getQuizAttemptsByQuiz(quizId: number): Promise<any[]> {
    try {
      const attempts = await db.select({
        attempt: il_quiz_attempts,
        student: users
      })
        .from(il_quiz_attempts)
        .innerJoin(users, eq(il_quiz_attempts.student_id, users.id))
        .where(eq(il_quiz_attempts.quiz_id, quizId))
        .orderBy(desc(il_quiz_attempts.completed_at));
      
      // Format the results
      return attempts.map(item => ({
        id: item.attempt.id,
        student_id: item.attempt.student_id,
        student_name: `${item.student.first_name} ${item.student.last_name}`,
        score: item.attempt.score,
        answers: item.attempt.answers,
        time_taken: item.attempt.time_taken,
        completed_at: item.attempt.completed_at,
        difficulty_level: item.attempt.difficulty_level
      }));
    } catch (error) {
      console.error('Error getting quiz attempts by quiz:', error);
      throw new Error('Failed to get quiz attempts');
    }
  }
  
  /**
   * Get quiz statistics for a specific quiz
   */
  static async getQuizStatistics(quizId: number) {
    try {
      const attempts = await db.select()
        .from(il_quiz_attempts)
        .where(eq(il_quiz_attempts.quiz_id, quizId));
      
      if (attempts.length === 0) {
        return {
          totalAttempts: 0,
          averageScore: 0,
          difficultyDistribution: {
            Easy: 0,
            Medium: 0,
            Hard: 0
          }
        };
      }
      
      // Calculate average score
      const averageScore = attempts.reduce((sum, attempt) => sum + Number(attempt.score), 0) / attempts.length;
      
      // Calculate difficulty distribution
      const difficultyDistribution = {
        Easy: 0,
        Medium: 0,
        Hard: 0
      };
      
      attempts.forEach(attempt => {
        difficultyDistribution[attempt.difficulty_level as keyof typeof difficultyDistribution]++;
      });
      
      return {
        totalAttempts: attempts.length,
        averageScore,
        difficultyDistribution
      };
    } catch (error) {
      console.error('Error getting quiz statistics:', error);
      throw new Error('Failed to get quiz statistics');
    }
  }
}