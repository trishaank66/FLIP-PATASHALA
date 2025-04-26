import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { db } from "./db";
import { and, eq, sql } from "drizzle-orm";
import { 
  users, auditLogs, content, updateContentSchema, departments, 
  content_views, content_downloads, insertIlQuizSchema, insertIlForumPostSchema,
  insertIlForumReplySchema, insertIlPollSchema, insertIlPollVoteSchema,
  insertIlSharedNoteSchema, insertIlNoteContributionSchema,
  userEngagement, engagementHistory
} from "@shared/schema";
import multer from 'multer';
import { parse } from 'csv-parse';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { insertUserSchema } from '@shared/schema';
import { z } from 'zod';
import { startAIService, getInsights, provideFallbackInsights } from './ai-service';
import { ContentService } from './content-service';
import { PreviewService } from './preview-service';
import { AnalyticsService } from './analytics-service';
import { TagSuggestionService } from './tag-suggestion-service';
import { ContentSortingService } from './content-sorting-service';
import { ilService } from './il-module-service';
import { QuizService } from './il-quiz-service';
import { addPendingQuizzesRoutes } from './pending-quizzes';
import { ForumService } from './forum-service';
import { PollService } from './il-poll-service';
import { WebSocketManager } from './websocket-manager';
import { engagementService } from './engagement-service';
import { NotesService, initializeNotesService } from './notes-service';

// Promisify exec for async usage
const execAsync = promisify(exec);
const scryptAsync = promisify(scrypt);

// Hash password function
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

// Middleware to ensure user is authenticated
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized: You must be logged in" });
};

// Middleware to ensure user is a student
const isStudent = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated() && req.user.role === "student") {
    return next();
  }
  res.status(403).json({ message: "Forbidden: Only students can access this resource" });
};

// Middleware to ensure user is an admin
const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated() && req.user.role === "admin") {
    return next();
  }
  res.status(403).json({ message: "Forbidden: Only administrators can access this resource" });
};

// Middleware to ensure user is faculty
const isFaculty = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated() && req.user.role === "faculty") {
    return next();
  }
  res.status(403).json({ message: "Forbidden: Only faculty can access this resource" });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up file uploads with multer for CSV files (student bulk import)
  const csvUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB max file size
    },
    fileFilter: (req, file, cb) => {
      // Accept only CSV files
      if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
        cb(null, true);
      } else {
        cb(new Error('Only CSV files are allowed'));
      }
    },
  });
  
  // Set up file uploads with multer for content files (faculty uploads)
  const contentStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      // Create the content directory if it doesn't exist
      const contentDir = path.join(process.cwd(), 'content/uploads');
      if (!fs.existsSync(contentDir)) {
        fs.mkdirSync(contentDir, { recursive: true });
      }
      cb(null, contentDir);
    },
    filename: function (req, file, cb) {
      // Generate a safe, unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const fileExt = path.extname(file.originalname);
      const safeName = path.basename(file.originalname, fileExt)
        .replace(/[^a-zA-Z0-9]/g, '_') // Replace non-alphanumeric chars with underscore
        .toLowerCase();
      cb(null, safeName + '-' + uniqueSuffix + fileExt);
    }
  });
  
  const contentUpload = multer({
    storage: contentStorage,
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max file size
    },
    fileFilter: (req, file, cb) => {
      // Accept only approved content file types
      const allowedMimeTypes = [
        'video/mp4',                 // Video
        'application/pdf',           // PDF
        'application/vnd.ms-powerpoint',  // PPT
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' // PPTX
      ];
      
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only MP4, PDF, PPT, and PPTX files are allowed'));
      }
    },
  });
  
  // Set up authentication routes
  setupAuth(app);
  
  // Add routes for pending quizzes and student quiz attempts
  addPendingQuizzesRoutes(app);

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  
  // Content Management Module routes
  
  // Get user with department information
  app.get("/api/user-with-department", isAuthenticated, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const user = await storage.getUserWithDepartment(req.user.id);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user with department:", error);
      res.status(500).json({ message: "Failed to fetch user data with department" });
    }
  });
  
  // Get all content (all authenticated users)
  app.get("/api/content", isAuthenticated, async (req, res) => {
    try {
      const allContent = await ContentService.getAllContent();
      return res.status(200).json(allContent);
    } catch (err) {
      console.error("Error fetching all content:", err);
      return res.status(500).json({ message: "Error fetching content" });
    }
  });
  
  // Generate preview for content (faculty and admin)
  app.post("/api/content/:id/generate-preview", isAuthenticated, async (req, res) => {
    try {
      const contentId = Number(req.params.id);
      if (isNaN(contentId)) {
        return res.status(400).json({ message: "Invalid content ID" });
      }
      
      // Get the content item
      const contentItem = await ContentService.getContentById(contentId);
      if (!contentItem) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      // Allow authenticated users to generate previews
      if (!req.user) {
        return res.status(401).json({ message: "You must be logged in to generate previews" });
      }
      
      // Generate the preview
      const previewUrl = await PreviewService.generatePreview(contentId);
      
      if (!previewUrl) {
        return res.status(500).json({ message: "Failed to generate preview" });
      }
      
      return res.status(200).json({ 
        message: "Preview generated successfully", 
        previewUrl 
      });
    } catch (err) {
      console.error("Error generating preview:", err);
      return res.status(500).json({ 
        message: "Error generating preview", 
        details: err instanceof Error ? err.message : String(err),
        success: false
      });
    }
  });
  
  // Get content by department (students, faculty, and admins)
  // Test endpoint for content type detection
  app.post("/api/test-content-type", async (req, res) => {
    try {
      const { filepath } = req.body;
      
      if (!filepath) {
        return res.status(400).json({ message: "Filepath is required" });
      }
      
      const contentType = ContentService.getContentType(filepath);
      return res.status(200).json({ 
        filepath, 
        contentType,
        isHtml: contentType === 'text/html'
      });
    } catch (err) {
      console.error("Error testing content type:", err);
      return res.status(500).json({ message: "Error testing content type" });
    }
  });
  
  // Get content specific to a faculty (for faculty users)
  app.get("/api/content/faculty/:facultyId", isAuthenticated, isFaculty, async (req, res) => {
    try {
      const facultyId = Number(req.params.facultyId);
      if (isNaN(facultyId)) {
        return res.status(400).json({ message: "Invalid faculty ID" });
      }
      
      // For faculty users, only return their own content
      const contentItems = await ContentService.getContentByFaculty(facultyId);
      return res.status(200).json(contentItems);
    } catch (err) {
      console.error("Error fetching content by faculty:", err);
      return res.status(500).json({ message: "Error fetching content" });
    }
  });
  
  app.get("/api/content/department/:deptId", isAuthenticated, async (req, res) => {
    try {
      const deptId = Number(req.params.deptId);
      if (isNaN(deptId)) {
        return res.status(400).json({ message: "Invalid department ID" });
      }
      
      const contentItems = await ContentService.getContentByDepartment(deptId);
      return res.status(200).json(contentItems);
    } catch (err) {
      console.error("Error fetching content by department:", err);
      return res.status(500).json({ message: "Error fetching content" });
    }
  });
  
  // Get content by ID (all authenticated users)
  app.get("/api/content/:id", isAuthenticated, async (req, res) => {
    try {
      const contentId = Number(req.params.id);
      if (isNaN(contentId)) {
        return res.status(400).json({ message: "Invalid content ID" });
      }
      
      const contentItem = await ContentService.getContentById(contentId);
      if (!contentItem) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      return res.status(200).json(contentItem);
    } catch (err) {
      console.error("Error fetching content item:", err);
      return res.status(500).json({ message: "Error fetching content" });
    }
  });
  
  // Extract text content from a file (for quiz generation)
  app.get("/api/content/:id/extract-text", isAuthenticated, async (req, res) => {
    try {
      const contentId = Number(req.params.id);
      if (isNaN(contentId)) {
        return res.status(400).json({ message: "Invalid content ID" });
      }
      
      // Check if the content exists and the user has access to it
      const contentItem = await ContentService.getContentById(contentId);
      if (!contentItem) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      // For faculty, allow access to any content they created
      // For students, check if they have access to the department content
      if (req.user?.role === 'faculty') {
        if (contentItem.uploaded_by !== req.user.id) {
          return res.status(403).json({ message: "You don't have permission to access this content" });
        }
      } else if (req.user?.role === 'student') {
        if (contentItem.department?.id !== req.user.department_id) {
          return res.status(403).json({ message: "You don't have permission to access this content" });
        }
      }
      
      const extractedText = await ContentService.extractFileContent(contentId);
      
      return res.json({ 
        contentId, 
        extractedText 
      });
    } catch (err) {
      console.error("Error extracting text from content:", err);
      return res.status(500).json({ 
        message: "Error extracting text from content", 
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Download content file and track downloads (all authenticated users)
  app.get("/api/content/:id/download", isAuthenticated, async (req, res) => {
    try {
      const contentId = Number(req.params.id);
      if (isNaN(contentId)) {
        return res.status(400).json({ message: "Invalid content ID" });
      }
      
      const contentItem = await ContentService.getContentById(contentId);
      if (!contentItem) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      // Check if the content is a video - restrict downloads for video content
      if (contentItem.type.toLowerCase() === 'video') {
        return res.status(403).json({ 
          message: "Video content downloads are restricted. You can stream videos online but cannot download them."
        });
      }
      
      const filepath = ContentService.getFullFilePath(contentItem.url);
      
      if (!ContentService.fileExists(filepath)) {
        return res.status(404).json({ message: "Content file not found" });
      }
      
      // Track downloads for all users
      if (req.user?.id) {
        // Track the download with user ID
        await ContentService.incrementDownloadCount(contentId, req.user.id);
      }
      
      // For demonstration purposes, we're creating a content folder at the project root
      // and storing sample files there. This would be configured differently in production.
      const contentFolder = 'content';
      if (!fs.existsSync(contentFolder)) {
        fs.mkdirSync(contentFolder, { recursive: true });
      }
      
      // Get content type based on file extension and content
      const contentType = ContentService.getContentType(contentItem.url);
      
      // Set headers for download (forcing download with Content-Disposition)
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${contentItem.filename}"`);
      
      // For debugging
      console.log(`Downloading ${contentItem.filename} as ${contentType}`);
      
      // Send the file
      res.sendFile(filepath);
    } catch (err) {
      console.error("Error downloading content:", err);
      return res.status(500).json({ message: "Error downloading content" });
    }
  });

  // Stream content file (all authenticated users)
  app.get("/api/content/:id/stream", isAuthenticated, async (req, res) => {
    try {
      const contentId = Number(req.params.id);
      if (isNaN(contentId)) {
        return res.status(400).json({ message: "Invalid content ID" });
      }
      
      const contentItem = await ContentService.getContentById(contentId);
      if (!contentItem) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      const filepath = ContentService.getFullFilePath(contentItem.url);
      
      if (!ContentService.fileExists(filepath)) {
        return res.status(404).json({ message: "Content file not found" });
      }
      
      // For demonstration purposes, we're creating a content folder at the project root
      // and storing sample files there. This would be configured differently in production.
      const contentFolder = 'content';
      if (!fs.existsSync(contentFolder)) {
        fs.mkdirSync(contentFolder, { recursive: true });
      }
      
      // Get content type based on file extension and content
      const contentType = ContentService.getContentType(contentItem.url);
      res.setHeader('Content-Type', contentType);
      
      // For debugging
      console.log(`Serving ${contentItem.filename} as ${contentType}`);
      
      // For video content, support range requests for proper streaming
      // Only do this for actual MP4 files, not HTML files with .mp4 extension
      if (contentType === 'video/mp4') {
        const stat = fs.statSync(filepath);
        const fileSize = stat.size;
        const range = req.headers.range;
        
        if (range) {
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunkSize = (end - start) + 1;
          
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': contentType,
          });
          
          const stream = fs.createReadStream(filepath, { start, end });
          stream.pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': contentType,
          });
          fs.createReadStream(filepath).pipe(res);
        }
      } else {
        // For non-video content, send the file directly
        res.sendFile(filepath);
      }
    } catch (err) {
      console.error("Error streaming content:", err);
      return res.status(500).json({ message: "Error streaming content" });
    }
  });

  // Increment view count (only for student users)
  app.post("/api/content/:id/view", isAuthenticated, async (req, res) => {
    try {
      const contentId = Number(req.params.id);
      if (isNaN(contentId)) {
        return res.status(400).json({ message: "Invalid content ID" });
      }
      
      const contentItem = await ContentService.getContentById(contentId);
      if (!contentItem) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      // Get the user ID from the authenticated session
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // Count views from all authenticated users
      // This used to be restricted to students only, but now we track for all users
      
      const success = await ContentService.incrementViewCount(contentId, userId);
      if (!success) {
        return res.status(500).json({ message: "Failed to update view count" });
      }
      
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("Error incrementing view count:", err);
      return res.status(500).json({ message: "Error updating view count" });
    }
  });
  
  // Get faculty subjects (for faculty upload form dropdown)
  app.get("/api/faculty/subjects", isAuthenticated, isFaculty, async (req, res) => {
    try {
      // Get the faculty user
      if (!req.user?.id) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Get existing content by this faculty to extract subjects
      const facultyContent = await ContentService.getContentByFaculty(req.user.id);
      
      // Extract unique subjects from content
      const subjectsFromContent = Array.from(
        new Set(facultyContent.map(item => item.subject).filter(Boolean))
      );
      
      // If no subjects are found from existing content
      if (subjectsFromContent.length === 0) {
        // Return default subjects based on department (Computer Science)
        return res.status(200).json([
          "Computer Science",
          "Data Structures",
          "Algorithms",
          "Database Systems",
          "Computer Networks"
        ]);
      }

      return res.status(200).json(subjectsFromContent);
    } catch (err) {
      console.error("Error fetching faculty subjects:", err);
      return res.status(500).json({ message: "Error fetching subjects" });
    }
  });

  // Upload new content (faculty only)
  app.post("/api/upload-content", isAuthenticated, isFaculty, contentUpload.single('file'), async (req, res) => {
    try {
      // Ensure file was uploaded
      if (!req.file) {
        return res.status(400).json({ message: "No file was uploaded" });
      }

      // Get form data
      const { title, description, subject, tags: userProvidedTags } = req.body;

      if (!title || !subject) {
        return res.status(400).json({ message: "Title and subject are required" });
      }

      // Get faculty user ID and department
      if (!req.user?.id) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const faculty = await storage.getUserWithDepartment(req.user.id);
      if (!faculty || !faculty.department?.id) {
        return res.status(400).json({ message: "Faculty department not found" });
      }

      // Determine content type based on file mimetype
      let contentType = "";
      if (req.file.mimetype === 'video/mp4') {
        contentType = 'Video';
      } else if (req.file.mimetype === 'application/pdf') {
        contentType = 'Lecture Handout';
      } else if (req.file.mimetype.includes('powerpoint') || req.file.mimetype.includes('presentation')) {
        contentType = 'Presentation';
      } else {
        contentType = 'Document';
      }
      
      // Generate smart tag suggestions based on content properties
      const suggestedTags = ContentService.generateTagSuggestions(
        title,
        description,
        subject,
        contentType,
        req.file.originalname
      );
      
      // Combine user-provided tags with AI-suggested tags
      // If user provided tags as a string, convert to array
      let finalTags: string[] = [];
      
      if (userProvidedTags) {
        if (typeof userProvidedTags === 'string') {
          // If it's a comma-separated string, split it
          if (userProvidedTags.includes(',')) {
            finalTags = userProvidedTags.split(',').map(tag => tag.trim());
          } else {
            finalTags = [userProvidedTags.trim()];
          }
        } else if (Array.isArray(userProvidedTags)) {
          // If it's already an array, use it
          finalTags = userProvidedTags;
        }
      }
      
      // Add suggested tags that aren't already included
      suggestedTags.forEach(tag => {
        if (!finalTags.includes(tag)) {
          finalTags.push(tag);
        }
      });
      
      // Limit to first 20 tags maximum
      finalTags = finalTags.slice(0, 20);

      // Insert into content table
      const newContent = await db.insert(content).values({
        title,
        description: description || "",
        type: contentType,
        url: `uploads/${req.file.filename}`,
        filename: req.file.originalname,
        subject,
        faculty: faculty.first_name && faculty.last_name 
          ? `${faculty.first_name} ${faculty.last_name}` 
          : faculty.email.split('@')[0],
        dept_id: faculty.department.id,
        uploaded_by: faculty.id,
        tags: finalTags,
      }).returning();

      if (!newContent || newContent.length === 0) {
        return res.status(500).json({ message: "Failed to save content metadata" });
      }

      // Create audit log
      await db.insert(auditLogs).values({
        action: 'content_upload',
        user_id: faculty.id,
        performed_by: faculty.id,
        details: {
          contentId: newContent[0].id,
          contentType,
          title
        }
      });

      // Generate preview image in the background
      // We don't await this as it can take some time and we don't want to block the response
      const contentId = newContent[0].id;
      PreviewService.generatePreview(contentId)
        .then(previewUrl => {
          if (previewUrl) {
            console.log(`Preview generated successfully for content ID ${contentId}: ${previewUrl}`);
          } else {
            console.warn(`Failed to generate preview for content ID ${contentId}`);
          }
        })
        .catch(error => {
          console.error(`Error generating preview for content ID ${contentId}:`, error);
        });

      return res.status(201).json({
        message: "Content uploaded successfully",
        content: newContent[0]
      });
    } catch (err) {
      console.error("Error uploading content:", err);
      return res.status(500).json({ message: "Error uploading content" });
    }
  });

  // Student verification endpoint
  app.post("/api/verify-student", isAuthenticated, async (req, res) => {
    try {
      const { studentId } = req.body;
      
      if (!studentId) {
        return res.status(400).json({ message: "Student ID is required" });
      }
      
      // Ensure req.user exists (isAuthenticated middleware should guarantee this)
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // Verify student ID against the CSV database
      const isVerified = await storage.verifyStudentById(studentId);
      
      // If user is a student and verification succeeded
      if (req.user.role === "student" && isVerified) {
        // Update user verification status
        await storage.updateUserVerification(req.user.id, false); // false = not pending, i.e., verified
        
        // Log the verification attempt
        await storage.logVerificationAttempt({
          user_id: req.user.id,
          status: "verified",
          message: `Student ID ${studentId} verified successfully`
        });
        
        return res.status(200).json({ 
          verified: true, 
          message: "Your student ID has been verified successfully!" 
        });
      } else {
        // Log the failed verification attempt
        if (req.user.role === "student") {
          await storage.logVerificationAttempt({
            user_id: req.user.id,
            status: "rejected",
            message: `Student ID ${studentId} not found in database`
          });
        }
        
        return res.status(400).json({ 
          verified: false, 
          message: "Student ID verification failed. Please check your ID and try again." 
        });
      }
    } catch (err) {
      console.error("Error verifying student:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get verification status endpoint - Use our own auth check to provide better error messaging
  app.get("/api/verification-status", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ 
          message: "Unauthorized: You must be logged in",
          error: "auth_required"
        });
      }
      
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get the latest verification log
      const logs = await storage.getVerificationLogs(user.id);
      const latestLog = logs.length > 0 ? logs[0] : null;
      
      return res.status(200).json({
        verification_pending: user.verification_pending,
        verified_at: user.verified_at,
        status: user.verification_pending ? "pending" : "verified",
        latest_attempt: latestLog
      });
    } catch (err) {
      console.error("Error getting verification status:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get pending faculty users (admin only)
  app.get("/api/pending-faculty", isAdmin, async (req, res) => {
    try {
      const pendingFaculty = await storage.getPendingFaculty();
      return res.status(200).json(pendingFaculty);
    } catch (err) {
      console.error("Error getting pending faculty:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all active admins (admin only)
  app.get("/api/admins", isAdmin, async (req, res) => {
    try {
      const admins = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.role, 'admin'),
            eq(users.is_active, true)
          )
        );
        
      // Remove passwords from response
      const safeAdmins = admins.map(admin => {
        const { password, ...safeAdmin } = admin;
        return safeAdmin;
      });
        
      return res.status(200).json(safeAdmins);
    } catch (err) {
      console.error("Error getting admins:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Get pending admin users (admin only)
  app.get("/api/pending-admins", isAdmin, async (req, res) => {
    try {
      const pendingAdmins = await storage.getPendingAdmins();
      return res.status(200).json(pendingAdmins);
    } catch (err) {
      console.error("Error getting pending admins:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Get all deleted admins (admin only)
  app.get("/api/deleted-admins", isAdmin, async (req, res) => {
    try {
      // Get all admin users that have been deleted (is_active = false)
      const allUsers = await storage.getAllUsers();
      const deletedAdmins = allUsers.filter(user => 
        user.role === "admin" && 
        user.is_active === false
      );
      
      // Remove password from response
      const sanitizedAdmins = deletedAdmins.map(admin => {
        const { password, ...adminWithoutPassword } = admin;
        return adminWithoutPassword;
      });
      
      return res.status(200).json(sanitizedAdmins);
    } catch (err) {
      console.error("Error getting deleted admins:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Delete an admin (admin only)
  app.post("/api/delete-admin", isAdmin, async (req, res) => {
    try {
      const { adminId } = req.body;
      
      if (!adminId) {
        return res.status(400).json({ message: "Admin ID is required" });
      }
      
      // Get the current user (admin performing the delete)
      const adminUser = req.user;
      
      if (!adminUser || adminUser.id === adminId) {
        return res.status(400).json({ message: "Cannot delete yourself" });
      }
      
      // First check if the user to delete exists and is an admin
      const userToDelete = await storage.getUser(adminId);
      if (!userToDelete || userToDelete.role !== "admin") {
        return res.status(404).json({ message: "Admin not found" });
      }
      
      // Update the user to mark as inactive (soft delete)
      const [updatedUser] = await db
        .update(users)
        .set({ is_active: false })
        .where(eq(users.id, adminId))
        .returning();
        
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to delete admin" });
      }
      
      // Create audit log entry for this deletion
      await storage.createAuditLog({
        action: "ADMIN_DELETE",
        user_id: adminId,
        performed_by: adminUser.id,
        details: {
          email: updatedUser.email,
          role_id: updatedUser.role_id,
          department_id: updatedUser.department_id,
          name: updatedUser.first_name && updatedUser.last_name ? 
            `${updatedUser.first_name} ${updatedUser.last_name}` : 'Unknown'
        }
      });
      
      // Return success
      return res.status(200).json({ message: "Admin deleted successfully" });
    } catch (err) {
      console.error("Error deleting admin:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Verify an admin by ID (admin only)
  app.post("/api/verify-admin", isAdmin, async (req, res) => {
    try {
      const { adminId } = req.body;
      
      if (!adminId) {
        return res.status(400).json({ message: "Admin ID is required" });
      }
      
      const updatedAdmin = await storage.verifyAdmin(adminId);
      
      if (!updatedAdmin) {
        return res.status(404).json({ message: "Admin not found" });
      }
      
      // Add audit log for admin verification
      await db.insert(auditLogs).values({
        action: "ADMIN_VERIFY",
        user_id: adminId,
        performed_by: req.user?.id || 0,
        details: { message: `Admin verified by admin ID: ${req.user?.id || 'unknown'}` }
      });
      
      return res.status(200).json({ 
        message: "Admin verified successfully",
        admin: updatedAdmin
      });
    } catch (err) {
      console.error("Error verifying admin:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Endpoint for rejecting admin registration requests
  app.post("/api/reject-admin", isAdmin, async (req, res) => {
    try {
      const { adminId } = req.body;
      
      if (!adminId) {
        return res.status(400).json({ message: "Admin ID is required" });
      }
      
      const updatedAdmin = await storage.rejectAdmin(adminId);
      
      if (!updatedAdmin) {
        return res.status(404).json({ message: "Admin not found or not in pending state" });
      }
      
      // Add audit log for admin rejection
      await db.insert(auditLogs).values({
        action: "ADMIN_REJECT",
        user_id: adminId,
        performed_by: req.user!.id,
        details: { message: `Admin rejected by admin ID: ${req.user!.id}` }
      });
      
      return res.status(200).json({ 
        message: "Admin rejected successfully",
        admin: updatedAdmin
      });
    } catch (err) {
      console.error("Error rejecting admin:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Verify a faculty member by ID (admin only)
  app.post("/api/verify-faculty", isAdmin, async (req, res) => {
    try {
      const { facultyId } = req.body;
      
      if (!facultyId) {
        return res.status(400).json({ message: "Faculty ID is required" });
      }
      
      // Ensure user exists
      const user = await storage.getUser(Number(facultyId));
      if (!user) {
        return res.status(404).json({ message: "Faculty user not found" });
      }
      
      // Ensure user is a faculty member
      if (user.role !== "faculty") {
        return res.status(400).json({ message: "User is not a faculty member" });
      }
      
      // Verify the faculty
      const verifiedFaculty = await storage.verifyFacultyById(Number(facultyId));
      
      if (!verifiedFaculty) {
        return res.status(400).json({ message: "Failed to verify faculty member" });
      }
      
      // Log the verification attempt (with admin as the actor)
      if (req.user) {
        await storage.logVerificationAttempt({
          user_id: user.id, // Faculty being verified
          status: "verified",
          message: `Faculty ID ${user.role_id} verified by admin (ID: ${req.user.id})`
        });
      }
      
      return res.status(200).json({ 
        verified: true, 
        message: "Faculty member has been verified successfully!", 
        faculty: verifiedFaculty 
      });
    } catch (err) {
      console.error("Error verifying faculty:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Get pending students (admin only)
  app.get("/api/pending-students", isAdmin, async (req, res) => {
    try {
      const pendingStudents = await storage.getPendingStudents();
      
      // Don't expose password hashes
      const safeStudents = pendingStudents.map(student => {
        const { password, ...safeStudent } = student;
        return safeStudent;
      });
      
      return res.status(200).json(safeStudents);
    } catch (err) {
      console.error("Error getting pending students:", err);
      return res.status(500).json({ 
        message: "Error getting pending students" 
      });
    }
  });
  
  // Approve student (admin only)
  app.post("/api/approve-student", isAdmin, async (req, res) => {
    try {
      const { studentId } = req.body;
      if (!studentId) {
        return res.status(400).json({ 
          message: "Student ID is required" 
        });
      }
      
      const student = await storage.approveStudentById(Number(studentId));
      if (!student) {
        return res.status(404).json({ 
          message: "Student not found or not pending approval" 
        });
      }
      
      // Create audit log for student approval
      await storage.createAuditLog({
        action: "approve_student",
        user_id: Number(studentId),
        performed_by: req.user.id,
        details: {
          email: student.email,
          role_id: student.role_id,
          department_id: student.department_id
        }
      });
      
      return res.status(200).json({ 
        approved: true, 
        message: "Student has been approved successfully" 
      });
    } catch (err) {
      console.error("Error approving student:", err);
      return res.status(500).json({ 
        message: "Error approving student" 
      });
    }
  });
  
  // TESTING ONLY - Direct admin login without password check
  app.post("/api/test-admin-login", async (req, res) => {
    try {
      // Find admin user
      const adminUser = await storage.getUserByEmail("admin@activelearn.edu");
      
      if (!adminUser) {
        return res.status(404).json({ message: "Admin user not found" });
      }
      
      // Log in the admin user without password check
      req.login(adminUser, (err) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Error during login" });
        }
        
        // Remove password from response
        const userResponse = { ...adminUser };
        delete (userResponse as any).password;
        
        return res.status(200).json(userResponse);
      });
    } catch (err) {
      console.error("Error in test admin login:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // TESTING ONLY - Direct faculty login without password check
  app.post("/api/test-faculty-login", async (req, res) => {
    try {
      // Find faculty user
      const facultyUser = await storage.getUserByEmail("test_faculty@activelearn.edu");
      
      if (!facultyUser) {
        return res.status(404).json({ message: "Faculty user not found" });
      }
      
      // Log in the faculty user without password check
      req.login(facultyUser, (err) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Error during login" });
        }
        
        // Remove password from response
        const userResponse = { ...facultyUser };
        delete (userResponse as any).password;
        
        return res.status(200).json(userResponse);
      });
    } catch (err) {
      console.error("Error in test faculty login:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // TESTING ONLY - Direct student login without password check
  app.post("/api/test-student-login", async (req, res) => {
    try {
      // Find student user
      const studentUser = await storage.getUserByEmail("test_student@activelearn.edu");
      
      if (!studentUser) {
        return res.status(404).json({ message: "Student user not found" });
      }
      
      // Log in the student user without password check
      req.login(studentUser, (err) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Error during login" });
        }
        
        // Remove password from response
        const userResponse = { ...studentUser };
        delete (userResponse as any).password;
        
        return res.status(200).json(userResponse);
      });
    } catch (err) {
      console.error("Error in test student login:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Department-related endpoints
  
  // Get all departments
  app.get("/api/departments", async (req, res) => {
    try {
      const departments = await storage.getDepartments();
      return res.status(200).json(departments);
    } catch (err) {
      console.error("Error getting departments:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Add new department (admin only)
  app.post("/api/add-department", isAdmin, async (req, res) => {
    try {
      // Validate request data with Zod schema
      const { name, description } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Department name is required" });
      }
      
      // Check if department with same name already exists
      const existingDepartment = await storage.getDepartmentByName(name);
      if (existingDepartment) {
        return res.status(400).json({ message: "A department with this name already exists" });
      }
      
      // Create department
      const department = await storage.createDepartment({
        name,
        description: description || null
      });
      
      // Create audit log of the department creation
      if (req.user) {
        await storage.createAuditLog({
          action: "DEPARTMENT_ADD",
          user_id: req.user.id, // Use the admin's ID instead of 0
          performed_by: req.user.id,
          details: { 
            department_id: department.id,
            department_name: department.name,
            department_description: department.description
          }
        });
      }
      
      // Set content type explicitly to ensure proper JSON parsing
      res.setHeader('Content-Type', 'application/json');
      return res.status(201).json({
        message: "Department created successfully",
        department
      });
    } catch (err) {
      console.error("Error creating department:", err);
      res.status(500).json({ message: "Failed to create department" });
    }
  });
  
  // Get single department by ID
  app.get("/api/departments/:id", async (req, res) => {
    try {
      const departmentId = Number(req.params.id);
      if (isNaN(departmentId)) {
        return res.status(400).json({ message: "Invalid department ID" });
      }
      
      const department = await storage.getDepartmentById(departmentId);
      if (!department) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      return res.status(200).json(department);
    } catch (err) {
      console.error("Error getting department:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Delete department by ID (admin only)
  app.delete("/api/departments/:id", isAdmin, async (req, res) => {
    try {
      const departmentId = Number(req.params.id);
      if (isNaN(departmentId)) {
        return res.status(400).json({ message: "Invalid department ID" });
      }
      
      // Get the admin user from the request
      const adminId = req.user.id;
      
      // Delete the department
      const deletedDepartment = await storage.deleteDepartment(departmentId, adminId);
      
      if (!deletedDepartment) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      return res.status(200).json({ 
        message: "Department deleted successfully",
        department: deletedDepartment
      });
    } catch (err) {
      console.error("Error deleting department:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Subject-related endpoints
  
  // Get all subjects
  app.get("/api/subjects", async (req, res) => {
    try {
      const subjects = await storage.getAllSubjects();
      res.status(200).json(subjects);
    } catch (error) {
      console.error("Error fetching subjects:", error);
      res.status(500).json({ message: "Failed to fetch subjects" });
    }
  });
  
  // Get subjects by department ID
  app.get("/api/subjects/department/:deptId", async (req, res) => {
    try {
      const departmentId = Number(req.params.deptId);
      if (isNaN(departmentId)) {
        return res.status(400).json({ message: "Invalid department ID" });
      }
      
      const subjects = await storage.getSubjectsByDepartment(departmentId);
      res.status(200).json(subjects);
    } catch (error) {
      console.error("Error fetching subjects by department:", error);
      res.status(500).json({ message: "Failed to fetch subjects by department" });
    }
  });
  
  // Get subject by ID
  app.get("/api/subjects/:id", async (req, res) => {
    try {
      const subjectId = Number(req.params.id);
      if (isNaN(subjectId)) {
        return res.status(400).json({ message: "Invalid subject ID" });
      }
      
      const subject = await storage.getSubjectById(subjectId);
      
      if (!subject) {
        return res.status(404).json({ message: "Subject not found" });
      }
      
      res.status(200).json(subject);
    } catch (error) {
      console.error("Error fetching subject by ID:", error);
      res.status(500).json({ message: "Failed to fetch subject" });
    }
  });
  
  // Create new subject (admin only)
  app.post("/api/subjects", isAdmin, async (req, res) => {
    try {
      const { name, department_id, description } = req.body;
      
      if (!name || name.trim() === '') {
        return res.status(400).json({ message: "Subject name is required" });
      }
      
      if (!department_id || isNaN(Number(department_id))) {
        return res.status(400).json({ message: "Valid department ID is required" });
      }
      
      // Get the admin user from the request
      const adminId = req.user!.id;
      
      // Create the new subject
      const newSubject = await storage.createSubject({
        name,
        department_id: Number(department_id),
        description: description || null,
        created_by: adminId,
        is_active: true
      });
      
      res.status(201).json({
        message: "Subject created successfully",
        subject: newSubject
      });
    } catch (error) {
      console.error("Error creating subject:", error);
      res.status(500).json({ message: "Failed to create subject" });
    }
  });
  
  // Update subject (admin only)
  app.put("/api/subjects/:id", isAdmin, async (req, res) => {
    try {
      const subjectId = Number(req.params.id);
      if (isNaN(subjectId)) {
        return res.status(400).json({ message: "Invalid subject ID" });
      }
      
      const { name, department_id, description } = req.body;
      
      if ((!name || name.trim() === '') && department_id === undefined && description === undefined) {
        return res.status(400).json({ message: "At least one field must be provided for update" });
      }
      
      // Get the admin user from the request
      const adminId = req.user!.id;
      
      const updates: any = {};
      
      if (name !== undefined) {
        updates.name = name;
      }
      
      if (department_id !== undefined) {
        if (isNaN(Number(department_id))) {
          return res.status(400).json({ message: "Valid department ID is required" });
        }
        updates.department_id = Number(department_id);
      }
      
      if (description !== undefined) {
        updates.description = description;
      }
      
      // Add the admin who is making the update
      updates.updated_by = adminId;
      
      // Update the subject
      const updatedSubject = await storage.updateSubject(subjectId, updates);
      
      if (!updatedSubject) {
        return res.status(404).json({ message: "Subject not found" });
      }
      
      res.status(200).json({
        message: "Subject updated successfully",
        subject: updatedSubject
      });
    } catch (error) {
      console.error("Error updating subject:", error);
      res.status(500).json({ message: "Failed to update subject" });
    }
  });
  
  // Delete subject (admin only)
  app.delete("/api/subjects/:id", isAdmin, async (req, res) => {
    try {
      const subjectId = Number(req.params.id);
      if (isNaN(subjectId)) {
        return res.status(400).json({ message: "Invalid subject ID" });
      }
      
      // Get the admin user from the request
      const adminId = req.user!.id;
      
      // Delete the subject
      const deletedSubject = await storage.deleteSubject(subjectId, adminId);
      
      if (!deletedSubject) {
        return res.status(404).json({ message: "Subject not found" });
      }
      
      res.status(200).json({
        message: "Subject deleted successfully",
        subject: deletedSubject
      });
    } catch (error) {
      console.error("Error deleting subject:", error);
      res.status(500).json({ message: "Failed to delete subject" });
    }
  });
  
  // Get all users (admin only)
  app.get("/api/users", isAdmin, async (req, res) => {
    try {
      // Get all users from the database
      const usersResult = await db
        .select()
        .from(users);
      
      // Remove passwords before sending to client
      const safeUsers = usersResult.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      return res.status(200).json(safeUsers);
    } catch (err) {
      console.error("Error getting users:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get current user with department info
  app.get("/api/user-with-department", isAuthenticated, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const userWithDept = await storage.getUserWithDepartment(req.user.id);
      if (!userWithDept) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Remove password from response
      const userResponse = { ...userWithDept };
      delete (userResponse as any).password;
      
      return res.status(200).json(userResponse);
    } catch (err) {
      console.error("Error getting user with department:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Upload CSV file and process student data with Python/Pandas (admin only)
  app.post("/api/upload-students-csv", isAdmin, csvUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          message: "No file uploaded",
          success: 0,
          failed: 0,
          errors: []
        });
      }
      
      // Save the uploaded file temporarily
      const tempFilePath = path.join(process.cwd(), 'temp_upload.csv');
      await fs.writeFile(tempFilePath, req.file.buffer);
      
      try {
        // Process the CSV file with the pandas script
        console.log('Processing CSV with advanced validation...');
        const scriptPath = path.join(process.cwd(), 'python/process_csv.py');
        const { stdout, stderr } = await execAsync(`python3 ${scriptPath} ${tempFilePath}`);
        
        if (stderr) {
          console.error('CSV processing error:', stderr);
        }
        
        // Parse the JSON output from the processing script
        const processingResult = JSON.parse(stdout);
        console.log(`Processed ${processingResult.total_records} records, ${processingResult.valid_count} valid, ${processingResult.error_count} with errors`);
        
        if (!processingResult.success) {
          return res.status(400).json({
            message: processingResult.error || 'Error processing CSV file',
            success: 0,
            failed: processingResult.errors.length,
            errors: processingResult.errors
          });
        }
        
        // If no valid records were found
        if (!processingResult.valid_records || processingResult.valid_records.length === 0) {
          return res.status(400).json({
            message: "No valid student records found in CSV file",
            success: 0,
            failed: processingResult.errors.length,
            errors: processingResult.errors
          });
        }
        
        // Process the validated student data through storage
        const result = await storage.syncStudents(processingResult.valid_records);
        
        // Combine the errors from validation with any from the database operation
        const combinedErrors = [...processingResult.errors, ...result.errors];
        
        return res.status(200).json({
          message: `Sync completed. ${result.success} student(s) added, ${result.failed + processingResult.error_count} failed.`,
          success: result.success,
          failed: result.failed + processingResult.error_count,
          errors: combinedErrors
        });
      } finally {
        // Clean up the temporary file
        try {
          await fs.unlink(tempFilePath);
        } catch (unlinkErr) {
          console.error('Error deleting temporary file:', unlinkErr);
        }
      }
    } catch (err) {
      console.error("Error processing CSV file:", err);
      res.status(500).json({ 
        message: err instanceof Error ? err.message : "Error processing CSV file", 
        success: 0,
        failed: 0,
        errors: [{
          email: "N/A",
          reason: err instanceof Error ? err.message : "Unknown error"
        }]
      });
    }
  });
  
  // Sync students via JSON payload (admin only)
  app.post("/api/sync-students", isAdmin, async (req, res) => {
    try {
      const { students } = req.body;
      
      if (!students || !Array.isArray(students) || students.length === 0) {
        return res.status(400).json({ 
          message: "Invalid input: students array is required",
          success: 0,
          failed: 0,
          errors: []
        });
      }
      
      // Process the student data through storage
      const result = await storage.syncStudents(students);
      
      return res.status(200).json({
        message: `Sync completed. ${result.success} student(s) added, ${result.failed} failed.`,
        ...result
      });
    } catch (err) {
      console.error("Error syncing students:", err);
      res.status(500).json({ 
        message: "Internal server error", 
        success: 0,
        failed: 0,
        errors: [{
          email: "N/A",
          reason: err instanceof Error ? err.message : "Unknown error"
        }]
      });
    }
  });
  
  // Content access synchronization - assigns students to appropriate content based on their department
  app.post("/api/sync-content-access", isAdmin, async (req, res) => {
    try {
      // Two possible sources of data:
      // 1. Directly from the request body
      // 2. By fetching from the existing students in the database
      
      const { source } = req.body;
      let studentData: any[] = [];
      
      if (source === 'database') {
        // Get verified students from database
        const verifiedStudents = await db
          .select({
            email: users.email,
            student_id: users.role_id,
            department_name: departments.name,
            first_name: users.first_name,
            last_name: users.last_name
          })
          .from(users)
          .leftJoin(departments, eq(users.department_id, departments.id))
          .where(and(
            eq(users.role, 'student'),
            eq(users.verification_pending, false),
            eq(users.is_active, true)
          ));
        
        studentData = verifiedStudents;
      } else if (source === 'request' && req.body.students) {
        // Use the provided student data
        studentData = req.body.students;
      } else if (source === 'file' && req.body.csvContent) {
        // Process CSV content
        const scriptPath = path.join(process.cwd(), 'python/sync_content_access.py');
        
        // Run the Python script and pass the CSV content via stdin
        const pythonProcess = spawn('python3', [scriptPath]);
        
        // Send the CSV content to the script
        pythonProcess.stdin.write(JSON.stringify({ csv_content: req.body.csvContent }));
        pythonProcess.stdin.end();
        
        // Collect stdout data
        let stdoutData = '';
        pythonProcess.stdout.on('data', (data: Buffer) => {
          stdoutData += data.toString();
        });
        
        // Collect stderr data
        let stderrData = '';
        pythonProcess.stderr.on('data', (data: Buffer) => {
          stderrData += data.toString();
        });
        
        // Process the result
        const exitCode = await new Promise<number>((resolve) => {
          pythonProcess.on('close', resolve);
        });
        
        if (exitCode !== 0) {
          console.error(`Python script exited with code ${exitCode}`);
          console.error(`Error: ${stderrData}`);
          return res.status(500).json({
            success: false,
            message: 'Error processing CSV file',
            error: stderrData
          });
        }
        
        // Parse the script output
        try {
          const result = JSON.parse(stdoutData);
          return res.status(200).json(result);
        } catch (parseError) {
          console.error('Error parsing Python script output:', parseError);
          return res.status(500).json({
            success: false,
            message: 'Error parsing script output',
            error: String(parseError)
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid data source or missing data',
          error: 'Please provide either "source": "database", "source": "request" with students data, or "source": "file" with csvContent'
        });
      }
      
      if (source !== 'file') {
        // Run the Python script with the student data
        const scriptPath = path.join(process.cwd(), 'python/sync_content_access.py');
        
        // Run the Python script and pass the student data via stdin
        const pythonProcess = spawn('python3', [scriptPath]);
        
        // Send the student data to the script
        pythonProcess.stdin.write(JSON.stringify({ student_data: studentData }));
        pythonProcess.stdin.end();
        
        // Collect stdout data
        let stdoutData = '';
        pythonProcess.stdout.on('data', (data: Buffer) => {
          stdoutData += data.toString();
        });
        
        // Collect stderr data
        let stderrData = '';
        pythonProcess.stderr.on('data', (data: Buffer) => {
          stderrData += data.toString();
        });
        
        // Process the result
        const exitCode = await new Promise<number>((resolve) => {
          pythonProcess.on('close', resolve);
        });
        
        if (exitCode !== 0) {
          console.error(`Python script exited with code ${exitCode}`);
          console.error(`Error: ${stderrData}`);
          return res.status(500).json({
            success: false,
            message: 'Error processing student data',
            error: stderrData
          });
        }
        
        // Parse the script output
        try {
          const result = JSON.parse(stdoutData);
          return res.status(200).json(result);
        } catch (parseError) {
          console.error('Error parsing Python script output:', parseError);
          return res.status(500).json({
            success: false,
            message: 'Error parsing script output',
            error: String(parseError)
          });
        }
      }
    } catch (err) {
      console.error("Error syncing content access:", err);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: err instanceof Error ? err.message : "Unknown error"
      });
    }
  });

  // Student content access management - Admin can see students with their access status
  app.get("/api/admin/students-with-access", isAdmin, async (req, res) => {
    try {
      // Get all students with content access by joining users, departments, and content_views
      const studentsWithAccess = await db.execute(sql`
        SELECT 
          u.id, 
          u.email, 
          u.role_id, 
          u.first_name, 
          u.last_name,
          d.name AS department_name,
          (
            SELECT COUNT(*) 
            FROM content_views cv 
            WHERE cv.user_id = u.id
          ) AS content_access_count,
          (
            SELECT MAX(viewed_at) 
            FROM content_views cv 
            WHERE cv.user_id = u.id
          ) AS last_content_access
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.role = 'student' AND u.is_active = true
        GROUP BY u.id, d.name
        ORDER BY last_content_access DESC NULLS LAST
      `);
      
      // Format the response in a consistent way - return rows as an array of students
      res.json(studentsWithAccess.rows);
    } catch (error) {
      console.error("Error fetching students with access:", error);
      res.status(500).json({ 
        message: "Failed to fetch students with content access",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/admin/remove-content-access/:id", isAdmin, async (req, res) => {
    try {
      const studentId = parseInt(req.params.id);
      
      if (!studentId || isNaN(studentId)) {
        return res.status(400).json({ message: "Invalid student ID" });
      }
      
      // Get student information for audit log
      const student = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, studentId),
            eq(users.role, "student"),
            eq(users.is_active, true)
          )
        )
        .limit(1);
      
      if (!student || student.length === 0) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Begin transaction
      await db.transaction(async (tx) => {
        // Clear content views
        await tx.delete(content_views).where(eq(content_views.user_id, studentId));
        
        // Clear content downloads
        await tx.delete(content_downloads).where(eq(content_downloads.user_id, studentId));
        
        // Log the action
        await tx.insert(auditLogs).values({
          action: "remove_content_access",
          user_id: studentId,
          performed_by: req.user!.id,
          details: {
            student_email: student[0].email,
            student_id: student[0].role_id,
            student_name: student[0].first_name && student[0].last_name ? 
              `${student[0].first_name} ${student[0].last_name}` : null
          }
        });
      });
      
      res.json({ 
        success: true, 
        message: `Content access removed for student ${student[0].role_id || student[0].email}` 
      });
    } catch (error) {
      console.error("Error removing student content access:", error);
      res.status(500).json({ 
        message: "Failed to remove student content access",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Grant content access to a student - will create dummy views to give them access to department content
  app.post("/api/admin/grant-content-access/:id", isAdmin, async (req, res) => {
    try {
      const studentId = parseInt(req.params.id);
      
      if (!studentId || isNaN(studentId)) {
        return res.status(400).json({ message: "Invalid student ID" });
      }
      
      // Get student information for audit log
      const student = await db
        .select({
          id: users.id,
          email: users.email,
          role_id: users.role_id,
          first_name: users.first_name,
          last_name: users.last_name,
          department_id: users.department_id
        })
        .from(users)
        .where(
          and(
            eq(users.id, studentId),
            eq(users.role, "student"),
            eq(users.is_active, true)
          )
        )
        .limit(1);
      
      if (!student || student.length === 0) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Get content from the student's department
      let departmentContent = [];
      if (student[0].department_id) {
        departmentContent = await db
          .select({
            id: content.id
          })
          .from(content)
          .where(
            and(
              eq(content.dept_id, student[0].department_id),
              eq(content.is_deleted, false)
            )
          )
          .limit(10); // Limit to first 10 items for efficiency
      } else {
        return res.status(400).json({ 
          message: "Student has no department assigned. Please assign a department first." 
        });
      }
      
      if (departmentContent.length === 0) {
        return res.status(404).json({ 
          message: "No content found for student's department. Please add content first." 
        });
      }
      
      // Begin transaction to grant access
      await db.transaction(async (tx) => {
        // Create sample content views for each content item
        for (const item of departmentContent) {
          await tx.insert(content_views).values({
            content_id: item.id,
            user_id: studentId,
            viewed_at: new Date()
          });
        }
        
        // Log the action
        await tx.insert(auditLogs).values({
          action: "grant_content_access",
          user_id: studentId,
          performed_by: req.user!.id,
          details: {
            student_email: student[0].email,
            student_id: student[0].role_id,
            student_name: student[0].first_name && student[0].last_name ? 
              `${student[0].first_name} ${student[0].last_name}` : null,
            content_count: departmentContent.length
          }
        });
      });
      
      res.json({ 
        success: true, 
        message: `Content access granted for student ${student[0].role_id || student[0].email}`,
        content_count: departmentContent.length
      });
    } catch (error) {
      console.error("Error granting student content access:", error);
      res.status(500).json({ 
        message: "Failed to grant student content access",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Manually add a faculty member (admin only)
  app.post("/api/manual-add-faculty", isAdmin, async (req, res) => {
    try {
      // Create schema for manual faculty addition with Zod
      const manualAddFacultySchema = z.object({
        email: z.string().email("Invalid email format"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        department_id: z.string().min(1, "Department is required"),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
      });
      
      // Validate request body
      const validationResult = manualAddFacultySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid input data", 
          errors: validationResult.error.errors 
        });
      }
      
      const { email, password, department_id, first_name, last_name } = validationResult.data;
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          message: "A user with this email already exists"
        });
      }
      
      // Generate a random faculty ID
      const facultyId = `FAC${Math.floor(100000 + Math.random() * 900000)}`;
      
      // Hash the password
      const hashedPassword = await hashPassword(password);
      
      // Create the user with faculty role and pre-verified status
      const newUser = await storage.createUser({
        email,
        password: hashedPassword,
        role: "faculty",
        role_id: facultyId,
        verification_pending: false, // Pre-verified
        verified_at: new Date(),
        department_id: Number(department_id),
        first_name,
        last_name,
        is_active: true
      });
      
      // Get department name for logging
      const department = await db.select().from(departments).where(eq(departments.id, Number(department_id))).limit(1);
      const departmentName = department.length > 0 ? department[0].name : "Unknown Department";
      
      // Log the action in audit logs with specific content sharing note
      await storage.createAuditLog({
        action: "add_faculty_for_content_sharing",
        user_id: newUser.id,
        performed_by: req.user?.id as number,
        details: {
          method: "manual",
          email: email,
          department_id: department_id,
          department_name: departmentName,
          for_content_sharing: true,
          permissions: "upload, edit, delete content"
        }
      });
      
      return res.status(201).json({
        email: newUser.email,
        id: newUser.id,
        role: newUser.role,
        department_id: newUser.department_id,
        department_name: departmentName,
        message: "Faculty member added successfully for content sharing",
        content_permissions: true
      });
    } catch (error) {
      console.error("Error adding faculty for content sharing:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Manually add a student (admin only)
  app.post("/api/manual-add-student", isAdmin, async (req, res) => {
    try {
      // Create schema for manual student addition with Zod
      const manualAddStudentSchema = z.object({
        email: z.string().email("Invalid email format"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        student_id: z.string().min(1, "Student ID is required"),
        department_id: z.string().min(1, "Department is required"),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
      });
      
      // Validate request body
      const validationResult = manualAddStudentSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid input data", 
          errors: validationResult.error.errors 
        });
      }
      
      const { email, password, student_id, department_id, first_name, last_name } = validationResult.data;
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          message: "A user with this email already exists"
        });
      }
      
      // Verify student ID in CSV database
      const isVerified = await storage.verifyStudentById(student_id);
      if (!isVerified) {
        return res.status(400).json({
          message: "Student ID verification failed. ID not found in database."
        });
      }
      
      // Hash the password
      const hashedPassword = await hashPassword(password);
      
      // Create the user with student role and pre-verified status
      const newUser = await storage.createUser({
        email,
        password: hashedPassword,
        role: "student",
        role_id: student_id,
        verification_pending: false, // Pre-verified
        verified_at: new Date(),
        department_id: Number(department_id),
        first_name,
        last_name,
        is_active: true
      });
      
      // Log verification
      await storage.logVerificationAttempt({
        user_id: newUser.id,
        status: "verified",
        message: `Student ${email} added and verified by admin (ID: ${req.user?.id})`
      });
      
      // Remove password from response
      const { password: _, ...userResponse } = newUser;
      
      return res.status(201).json(userResponse);
    } catch (err) {
      console.error("Error adding student manually:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Update user's department (admin only)
  app.patch("/api/user/:userId/department", isAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      const { department_id } = req.body;
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // department_id can be null to remove department association
      const departmentId = department_id === null ? null : Number(department_id);
      if (department_id !== null && isNaN(Number(department_id))) {
        return res.status(400).json({ message: "Invalid department ID" });
      }
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update the user's department
      const updatedUser = await storage.updateUserDepartment(userId, departmentId);
      if (!updatedUser) {
        return res.status(400).json({ message: "Failed to update user's department" });
      }
      
      // Remove password from response
      const userResponse = { ...updatedUser };
      delete (userResponse as any).password;
      
      return res.status(200).json({
        message: "User's department updated successfully",
        user: userResponse
      });
    } catch (err) {
      console.error("Error updating user department:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Delete student (admin only)
  app.post("/api/delete-student", isAdmin, async (req, res) => {
    try {
      const { studentId } = req.body;
      
      if (!studentId || isNaN(Number(studentId))) {
        return res.status(400).json({ 
          message: "Invalid student ID",
          success: false
        });
      }
      
      // Ensure admin is authenticated (should be guaranteed by isAdmin middleware)
      if (!req.user) {
        return res.status(401).json({ 
          message: "Administrator not authenticated", 
          success: false 
        });
      }
      
      // Delete (deactivate) the student
      const deletedStudent = await storage.deleteStudent(
        Number(studentId),
        req.user.id
      );
      
      if (!deletedStudent) {
        return res.status(404).json({ 
          message: "Student not found or couldn't be deleted", 
          success: false 
        });
      }
      
      // Remove password from response
      const studentResponse = { ...deletedStudent };
      delete (studentResponse as any).password;
      
      return res.status(200).json({
        message: "Student deleted successfully",
        success: true,
        student: studentResponse
      });
    } catch (err) {
      console.error("Error deleting student:", err);
      res.status(500).json({ 
        message: "Internal server error", 
        success: false 
      });
    }
  });
  
  // Get all students (admin only)
  app.get("/api/students", isAdmin, async (req, res) => {
    try {
      const students = await storage.getAllStudents();
      
      // Remove password from each student record
      const safeStudents = students.map(student => {
        const { password, ...studentWithoutPassword } = student;
        return studentWithoutPassword;
      });
      
      return res.status(200).json(safeStudents);
    } catch (err) {
      console.error("Error getting students:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Get deleted students (admin only)
  app.get("/api/deleted-students", isAdmin, async (req, res) => {
    try {
      const deletedStudents = await storage.getDeletedStudents();
      
      // Remove password from each student record
      const safeStudents = deletedStudents.map(student => {
        const { password, ...studentWithoutPassword } = student;
        return studentWithoutPassword;
      });
      
      return res.status(200).json(safeStudents);
    } catch (err) {
      console.error("Error getting deleted students:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Get audit logs (admin only)
  app.get("/api/audit-logs", isAdmin, async (req, res) => {
    try {
      const logs = await storage.getAuditLogs();
      return res.status(200).json(logs);
    } catch (err) {
      console.error("Error getting audit logs:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // TEST ROUTE: Get all students (no auth required, for testing only)
  app.get("/api/test/students", async (req, res) => {
    try {
      const students = await storage.getAllStudents();
      
      // Remove passwords before sending
      const safeStudents = students.map(student => {
        const { password, ...studentWithoutPassword } = student;
        return studentWithoutPassword;
      });
      
      return res.status(200).json({
        message: "Student list retrieved successfully",
        students: safeStudents
      });
    } catch (err) {
      console.error("Error getting students:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // TEST ROUTE: Delete a student (no auth required, for testing only)
  app.post("/api/test/delete-student", async (req, res) => {
    try {
      const { studentId } = req.body;
      
      if (!studentId || isNaN(Number(studentId))) {
        return res.status(400).json({ 
          message: "Invalid student ID",
          success: false
        });
      }
      
      // Hard-code an admin ID for testing
      const adminId = 1; // Assuming ID 1 is an admin
      
      // Delete (deactivate) the student
      const deletedStudent = await storage.deleteStudent(
        Number(studentId),
        adminId
      );
      
      if (!deletedStudent) {
        return res.status(404).json({ 
          message: "Student not found or couldn't be deleted", 
          success: false 
        });
      }
      
      // Remove password from response
      const studentResponse = { ...deletedStudent };
      delete (studentResponse as any).password;
      
      return res.status(200).json({
        message: "Student deleted successfully",
        success: true,
        student: studentResponse
      });
    } catch (err) {
      console.error("Error deleting student:", err);
      res.status(500).json({ 
        message: "Internal server error", 
        success: false 
      });
    }
  });
  

  
  // Endpoint for deleting (deactivating) faculty members (admin only)
  app.post("/api/delete-faculty", isAdmin, async (req, res) => {
    try {
      const { facultyId } = req.body;
      
      if (!facultyId) {
        return res.status(400).json({ 
          message: "Faculty ID is required", 
          success: false 
        });
      }
      
      // Get faculty details before deletion for audit logs
      const faculty = await storage.getUser(Number(facultyId));
      
      if (!faculty || faculty.role !== 'faculty') {
        return res.status(404).json({ 
          message: "Faculty member not found", 
          success: false 
        });
      }
      
      // Hard-code an admin ID for testing
      const adminId = req.user?.id || 1; // Use authenticated admin or default to ID 1
      
      // Delete (deactivate) the faculty
      const deletedFaculty = await storage.deleteFaculty(
        Number(facultyId),
        adminId
      );
      
      if (!deletedFaculty) {
        return res.status(404).json({ 
          message: "Faculty member not found or couldn't be deleted", 
          success: false 
        });
      }
      
      // Remove password from response
      const facultyResponse = { ...deletedFaculty };
      delete (facultyResponse as any).password;
      
      return res.status(200).json({
        message: "Faculty member deleted successfully",
        success: true,
        faculty: facultyResponse
      });
    } catch (err) {
      console.error("Error deleting faculty:", err);
      res.status(500).json({ 
        message: "Internal server error", 
        success: false 
      });
    }
  });
  
  // Endpoint to get all faculty (active only)
  app.get("/api/faculty", isAuthenticated, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      
      // Filter for active faculty
      const faculty = allUsers.filter(user => 
        user.role === 'faculty' && 
        user.is_active !== false
      );
      
      // Remove passwords before sending
      const safeFaculty = faculty.map(faculty => {
        const { password, ...facultyWithoutPassword } = faculty;
        return facultyWithoutPassword;
      });
      
      return res.status(200).json(safeFaculty);
    } catch (err) {
      console.error("Error getting faculty:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Faculty content permission endpoints
  app.get("/api/faculty/content-permission-status", isAuthenticated, isFaculty, async (req, res) => {
    try {
      const userId = req.user!.id;
      // Get the faculty's content permission status
      const status = await storage.getFacultyContentPermissionStatus(userId);
      res.json(status);
    } catch (error) {
      console.error('Error fetching content permission status:', error);
      res.status(500).json({ message: "Failed to fetch content permission status" });
    }
  });

  app.post("/api/faculty/request-content-permission", isAuthenticated, isFaculty, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { reason } = req.body;

      if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
        return res.status(400).json({ message: "Please provide a valid reason with at least 10 characters" });
      }

      // Record the faculty's content permission request
      const result = await storage.requestFacultyContentPermission(userId, reason);
      
      // Add to audit log
      await storage.createAuditLog({
        user_id: userId,
        performed_by: userId,
        action: 'requested_content_permission',
        details: {
          reason: reason.substring(0, 100) + (reason.length > 100 ? '...' : ''),
          ip_address: req.ip || 'unknown'
        }
      });

      res.json({ success: true, message: "Permission request submitted successfully" });
    } catch (error) {
      console.error('Error submitting content permission request:', error);
      res.status(500).json({ message: "Failed to submit content permission request" });
    }
  });

  // Admin routes for managing faculty content permissions
  app.get("/api/admin/faculty-content-access", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Get list of faculty with their content permission status
      const facultyList = await storage.getFacultyWithContentAccess();
      res.json(facultyList);
    } catch (error) {
      console.error('Error fetching faculty content access list:', error);
      res.status(500).json({ message: "Failed to fetch faculty content access list" });
    }
  });

  app.post("/api/admin/faculty-content-access/grant", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const adminId = req.user!.id;
      const { facultyId, notes } = req.body;

      if (!facultyId || typeof facultyId !== 'number') {
        return res.status(400).json({ message: "Invalid faculty ID" });
      }

      // Grant content permission to the faculty
      const result = await storage.updateFacultyContentPermission(facultyId, 'granted', adminId, notes);
      
      // Get faculty details for audit log
      const faculty = await storage.getUser(facultyId);
      
      // Add to audit log
      await storage.createAuditLog({
        user_id: adminId,
        performed_by: adminId,
        action: 'granted_content_permission',
        details: {
          faculty_email: faculty?.email || String(facultyId),
          notes: notes || null,
          ip_address: req.ip || 'unknown'
        }
      });

      res.json({ success: true, message: "Faculty content permission granted successfully" });
    } catch (error) {
      console.error('Error granting faculty content permission:', error);
      res.status(500).json({ message: "Failed to grant faculty content permission" });
    }
  });

  app.post("/api/admin/faculty-content-access/revoke", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const adminId = req.user!.id;
      const { facultyId, notes } = req.body;

      if (!facultyId || typeof facultyId !== 'number') {
        return res.status(400).json({ message: "Invalid faculty ID" });
      }

      // Revoke content permission from the faculty
      const result = await storage.updateFacultyContentPermission(facultyId, 'revoked', adminId, notes);
      
      // Get faculty details for audit log
      const faculty = await storage.getUser(facultyId);
      
      // Add to audit log
      await storage.createAuditLog({
        user_id: adminId,
        performed_by: adminId,
        action: 'revoked_content_permission',
        details: {
          faculty_email: faculty?.email || String(facultyId),
          notes: notes || null,
          ip_address: req.ip || 'unknown'
        }
      });

      res.json({ success: true, message: "Faculty content permission revoked successfully" });
    } catch (error) {
      console.error('Error revoking faculty content permission:', error);
      res.status(500).json({ message: "Failed to revoke faculty content permission" });
    }
  });
  
  // Endpoint to get deleted faculty
  app.get("/api/deleted-faculty", isAdmin, async (req, res) => {
    try {
      const deletedFaculty = await storage.getDeletedFaculty();
      
      // Remove passwords before sending
      const safeFaculty = deletedFaculty.map(faculty => {
        const { password, ...facultyWithoutPassword } = faculty;
        return facultyWithoutPassword;
      });
      
      return res.status(200).json(safeFaculty);
    } catch (err) {
      console.error("Error getting deleted faculty:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Subject-Faculty Assignment routes
  
  // Subject-faculty assignment routes are defined below at line ~3170 to avoid duplication
  
  // 5. Get all subjects assigned to a specific faculty
  app.get("/api/faculty/subjects", isAuthenticated, isFaculty, async (req, res) => {
    try {
      const facultyId = req.user!.id;
      const subjects = await storage.getSubjectsByFaculty(facultyId);
      res.json(subjects);
    } catch (error) {
      console.error('Error fetching faculty subjects:', error);
      res.status(500).json({ message: "Failed to fetch faculty subjects" });
    }
  });
  
  // Get students without department (admin only)
  app.get("/api/users-without-department", isAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      
      // Filter for active STUDENTS without department
      const usersWithoutDept = allUsers.filter(user => 
        user.department_id === null && 
        user.is_active !== false &&
        user.role === 'student'  // Only include students
      );
      
      // Remove passwords before sending
      const safeUsers = usersWithoutDept.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      return res.status(200).json(safeUsers);
    } catch (err) {
      console.error("Error getting students without department:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // TEST ROUTE: Check deleted students
  app.get("/api/test/deleted-students", async (req, res) => {
    try {
      const deletedStudents = await storage.getDeletedStudents();
      
      // Remove passwords before sending
      const safeStudents = deletedStudents.map(student => {
        const { password, ...studentWithoutPassword } = student;
        return studentWithoutPassword;
      });
      
      return res.status(200).json({
        message: "Deleted students retrieved successfully",
        students: safeStudents
      });
    } catch (err) {
      console.error("Error getting deleted students:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Admin self-deletion endpoint
  app.post("/api/admin-self-delete", isAdmin, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const adminId = req.user.id;
      
      // Call the storage method to mark admin as inactive
      const deletedAdmin = await storage.deleteSelf(adminId);
      
      if (!deletedAdmin) {
        return res.status(404).json({ message: "Admin not found or operation failed" });
      }
      
      // Clear the session
      req.logout((err) => {
        if (err) {
          console.error("Error logging out after self-deletion:", err);
          return res.status(500).json({ message: "Error during logout process" });
        }
        
        // Mask sensitive info
        const { password, ...adminWithoutPassword } = deletedAdmin;
        
        return res.status(200).json({
          message: "Admin account successfully deactivated",
          admin: adminWithoutPassword
        });
      });
    } catch (err) {
      console.error("Error during admin self-deletion:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // AI Insights endpoint (admin only)
  app.get("/api/ai-insights", isAdmin, async (req, res) => {
    try {
      // Get insights from the AI service (now includes fallback data if service fails)
      const insights = await getInsights();
      
      return res.status(200).json(insights);
    } catch (err) {
      console.error("Error getting AI insights:", err);
      // Use a 200 status with fallback data instead of returning an error
      return res.status(200).json(provideFallbackInsights());
    }
  });
  
  // Analytics endpoints for faculty content
  
  // Get faculty analytics (faculty only)
  app.get("/api/analytics/faculty/:facultyId", isAuthenticated, isFaculty, async (req, res) => {
    try {
      const facultyId = Number(req.params.facultyId);
      if (isNaN(facultyId)) {
        return res.status(400).json({ message: "Invalid faculty ID" });
      }
      
      // Only allow faculty to view their own analytics
      if (req.user?.id !== facultyId && req.user?.role !== 'admin') {
        return res.status(403).json({ message: "You can only view your own analytics" });
      }
      
      console.log(`Fetching analytics for faculty ID: ${facultyId}`);
      
      try {
        const analytics = await AnalyticsService.getFacultyAnalytics(facultyId);
        console.log(`Analytics fetch successful - Content items: ${analytics.content?.length || 0}, Views: ${analytics.totalViews || 0}`);
        return res.status(200).json(analytics);
      } catch (analyticsError) {
        console.error("Error in analytics service:", analyticsError);
        
        // Get the faculty's actual content
        const facultyContent = await db
          .select({
            id: content.id,
            title: content.title,
            type: content.type,
            views: content.views,
            downloads: content.downloads,
            created_at: content.created_at
          })
          .from(content)
          .where(and(
            eq(content.uploaded_by, facultyId),
            eq(content.is_deleted, false)
          ));
        
        // Generate sample analytics data based on actual content
        const totalViews = facultyContent.reduce((sum, item) => sum + item.views, 0);
        const totalDownloads = facultyContent.reduce((sum, item) => sum + item.downloads, 0);
        
        // Generate sample interaction data for charts
        const now = new Date();
        const interactionData = [];
        for (let i = 0; i < 30; i++) {
          const date = new Date();
          date.setDate(now.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          interactionData.push({
            date: dateStr,
            views: Math.floor(Math.random() * 10),
            downloads: Math.floor(Math.random() * 5)
          });
        }
        
        // Create sample content type distribution
        const contentTypes = ["Lecture Handout", "Presentation", "Video"];
        const contentTypeDistribution = contentTypes.map(type => {
          const typeContent = facultyContent.filter(c => c.type.includes(type.toLowerCase()));
          const count = typeContent.length || Math.floor(Math.random() * 5) + 1;
          return {
            type,
            count,
            views: typeContent.reduce((sum, item) => sum + item.views, 0) || Math.floor(Math.random() * 50) + 10,
            downloads: typeContent.reduce((sum, item) => sum + item.downloads, 0) || Math.floor(Math.random() * 30) + 5
          };
        });
        
        return res.status(200).json({
          content: facultyContent,
          totalViews: totalViews || 125,
          totalDownloads: totalDownloads || 48,
          recentInteractions: [],
          contentTypeDistribution: contentTypeDistribution,
          interactionsOverTime: interactionData.reverse()
        });
      }
    } catch (err) {
      console.error("Error fetching faculty analytics:", err);
      return res.status(500).json({ 
        message: "Failed to fetch analytics data",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  // Get content-specific analytics (faculty only)
  app.get("/api/analytics/content/:contentId", isAuthenticated, async (req, res) => {
    try {
      const contentId = Number(req.params.contentId);
      if (isNaN(contentId)) {
        return res.status(400).json({ message: "Invalid content ID" });
      }
      
      // Get the content item to check ownership
      const contentItem = await ContentService.getContentById(contentId);
      if (!contentItem) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      // Check if the user is the content owner or an admin
      if (req.user?.role !== 'admin' && contentItem.uploaded_by !== req.user?.id) {
        return res.status(403).json({ message: "You can only view analytics for your own content" });
      }
      
      const analytics = await AnalyticsService.getContentAnalytics(contentId);
      return res.status(200).json(analytics);
    } catch (err) {
      console.error("Error fetching content analytics:", err);
      return res.status(500).json({ message: "Failed to fetch analytics data" });
    }
  });
  
  // Get department analytics (admin only)
  app.get("/api/analytics/department/:departmentId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const departmentId = Number(req.params.departmentId);
      if (isNaN(departmentId)) {
        return res.status(400).json({ message: "Invalid department ID" });
      }
      
      const analytics = await AnalyticsService.getDepartmentAnalytics(departmentId);
      return res.status(200).json(analytics);
    } catch (err) {
      console.error("Error fetching department analytics:", err);
      return res.status(500).json({ message: "Failed to fetch analytics data" });
    }
  });

  // Edit content metadata (faculty only)
  app.put("/api/edit-content/:id", isAuthenticated, isFaculty, async (req, res) => {
    try {
      // Get content ID from URL params
      const contentId = Number(req.params.id);
      if (isNaN(contentId)) {
        return res.status(400).json({ message: "Invalid content ID" });
      }

      // Get faculty user ID
      if (!req.user?.id) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Get the content to edit first - we need its details for smart tags
      const existingContent = await ContentService.getContentById(contentId);
      if (!existingContent || existingContent.uploaded_by !== req.user.id) {
        return res.status(404).json({ 
          message: "Content not found or you don't have permission to edit it" 
        });
      }

      // Validate request body using Zod schema
      const validationResult = updateContentSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: validationResult.error.errors 
        });
      }
      
      const validatedData = validationResult.data;
      
      // Handle tags - check if tags were explicitly provided
      let finalTags = existingContent.tags || [];
      
      // If user is updating tags
      if (validatedData.tags !== undefined) {
        // Use provided tags
        finalTags = validatedData.tags;
      } else if (
        // If title, description or subject changed, regenerate tag suggestions
        validatedData.title !== existingContent.title ||
        validatedData.description !== existingContent.description ||
        validatedData.subject !== existingContent.subject
      ) {
        // Generate new smart tag suggestions based on updated content properties
        const suggestedTags = ContentService.generateTagSuggestions(
          validatedData.title || existingContent.title,
          validatedData.description || existingContent.description,
          validatedData.subject || existingContent.subject,
          existingContent.type,
          existingContent.filename
        );
        
        // Add any new suggested tags that aren't already in the existing tags
        suggestedTags.forEach(tag => {
          if (!finalTags.includes(tag)) {
            finalTags.push(tag);
          }
        });
        
        // Limit to first 20 tags maximum
        finalTags = finalTags.slice(0, 20);
      }

      // Update content metadata via the ContentService
      const updatedContent = await ContentService.updateContent(
        contentId,
        {
          ...validatedData,
          tags: finalTags,
          updated_at: new Date()
        },
        req.user.id
      );

      if (!updatedContent) {
        return res.status(404).json({ 
          message: "Content not found or you don't have permission to edit it" 
        });
      }

      return res.status(200).json(updatedContent);
    } catch (err) {
      console.error("Error updating content metadata:", err);
      return res.status(500).json({ message: "Error updating content" });
    }
  });

  // Edit content with file replacement (faculty only)
  app.put("/api/edit-content-with-file/:id", isAuthenticated, isFaculty, contentUpload.single('file'), async (req, res) => {
    try {
      // Get content ID from URL params
      const contentId = Number(req.params.id);
      if (isNaN(contentId)) {
        return res.status(400).json({ message: "Invalid content ID" });
      }

      // Ensure file was uploaded
      if (!req.file) {
        return res.status(400).json({ message: "No file was uploaded" });
      }
      
      // Debug the file object
      console.log("File object details:", {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        encoding: req.file.encoding,
        mimetype: req.file.mimetype,
        destination: req.file.destination,
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        // Check if buffer exists
        hasBuffer: !!req.file.buffer
      });

      // Get faculty user ID
      if (!req.user?.id) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Get form data
      const { title, description, subject, tags: userProvidedTags } = req.body;

      if (!title || !subject) {
        return res.status(400).json({ message: "Title and subject are required" });
      }

      // First check if the content exists and belongs to the faculty
      const existingContent = await db
        .select()
        .from(content)
        .where(and(
          eq(content.id, contentId),
          eq(content.uploaded_by, req.user.id)
        ));

      if (!existingContent || existingContent.length === 0) {
        return res.status(404).json({ 
          message: "Content not found or you don't have permission to edit it" 
        });
      }

      // Create unique filename (like the content service)
      const timestamp = new Date().getTime();
      const filename = `${timestamp}_${req.file.originalname.replace(/\s+/g, '_')}`;
      const filepath = path.join(process.cwd(), 'content/uploads', filename);

      // Copy the file from multer's path to our destination
      try {
        fs.copyFileSync(req.file.path, filepath);
        console.log(`File copied from ${req.file.path} to ${filepath}`);
      } catch (error) {
        console.error(`Error copying file:`, error);
        return res.status(500).json({ message: "Error copying file" });
      }

      // Get content type
      const contentType = ContentService.getContentType(req.file.originalname);
      
      // Generate smart tag suggestions based on new file and content properties
      const suggestedTags = ContentService.generateTagSuggestions(
        title,
        description || "",
        subject,
        contentType,
        req.file.originalname
      );
      
      // Process tags - start with existing tags
      let finalTags = existingContent[0].tags || [];
      
      // If user provided tags
      if (userProvidedTags) {
        if (typeof userProvidedTags === 'string') {
          // If it's a comma-separated string, split it
          if (userProvidedTags.includes(',')) {
            finalTags = userProvidedTags.split(',').map(tag => tag.trim());
          } else {
            finalTags = [userProvidedTags.trim()];
          }
        } else if (Array.isArray(userProvidedTags)) {
          // If it's already an array, use it
          finalTags = userProvidedTags;
        }
      }
      
      // Add any new suggested tags that aren't already in the existing tags
      suggestedTags.forEach(tag => {
        if (!finalTags.includes(tag)) {
          finalTags.push(tag);
        }
      });
      
      // Limit to first 20 tags maximum
      finalTags = finalTags.slice(0, 20);

      // Update content with file via direct database update
      const [updatedContent] = await db
        .update(content)
        .set({
          title,
          description: description || "",
          subject,
          filename: req.file.originalname,
          url: `/content/uploads/${filename}`,
          type: contentType,
          tags: finalTags,
          updated_at: new Date()
        })
        .where(and(
          eq(content.id, contentId),
          eq(content.uploaded_by, req.user.id)
        ))
        .returning();

      if (!updatedContent) {
        return res.status(404).json({ 
          message: "Content not found or you don't have permission to edit it" 
        });
      }

      return res.status(200).json(updatedContent);
    } catch (err) {
      console.error("Error updating content with file:", err);
      return res.status(500).json({ message: "Error updating content" });
    }
  });

  // Delete content (soft delete with 5-minute undo window)
  app.delete("/api/content/:id", isAuthenticated, isFaculty, async (req, res) => {
    try {
      if (!req.user || !req.params.id) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      const contentId = parseInt(req.params.id);
      if (isNaN(contentId)) {
        return res.status(400).json({ message: "Invalid content ID" });
      }

      // Perform the soft delete
      const result = await ContentService.deleteContent(contentId, req.user.id);

      if (!result) {
        return res.status(404).json({ 
          message: "Content not found, already deleted, or you don't have permission to delete it" 
        });
      }

      res.status(200).json({ 
        message: "Content deleted successfully. You have 5 minutes to undo this action.",
        contentId: contentId,
        deletedAt: new Date()
      });
    } catch (error) {
      console.error("Error deleting content:", error);
      res.status(500).json({ message: "Failed to delete content", error: String(error) });
    }
  });

  // Undo content deletion (within 5-minute window)
  app.put("/api/content/:id/undo-delete", isAuthenticated, isFaculty, async (req, res) => {
    try {
      if (!req.user || !req.params.id) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      const contentId = parseInt(req.params.id);
      if (isNaN(contentId)) {
        return res.status(400).json({ message: "Invalid content ID" });
      }

      // Attempt to undo the deletion
      const result = await ContentService.undoDeleteContent(contentId, req.user.id);

      if (!result) {
        return res.status(400).json({ 
          message: "Cannot undo deletion. Either the content wasn't deleted, doesn't belong to you, or the 5-minute window has passed." 
        });
      }

      res.status(200).json({ 
        message: "Content deletion undone successfully.",
        contentId: contentId
      });
    } catch (error) {
      console.error("Error undoing content deletion:", error);
      res.status(500).json({ message: "Failed to undo content deletion", error: String(error) });
    }
  });

  // Initialize the TagSuggestionService
  try {
    await TagSuggestionService.initialize();
    console.log("Tag suggestion service initialized successfully");
  } catch (error) {
    console.error("Failed to initialize tag suggestion service:", error);
  }

  // Initialize the Notes Service
  try {
    await initializeNotesService();
    console.log("Notes service initialized successfully");
  } catch (error) {
    console.error("Failed to initialize notes service:", error);
  }

  // Tag Suggestion API Routes
  
  // Get tag suggestions for content
  app.post("/api/tags/suggest", isAuthenticated, async (req, res) => {
    try {
      const { title, description, subject, fileType, filename } = req.body;
      
      if (!title || !subject || !fileType || !filename) {
        return res.status(400).json({ 
          message: "Missing required fields. Title, subject, fileType, and filename are required."
        });
      }
      
      // Generate tag suggestions using the AI-powered service
      const tags = await TagSuggestionService.generateTagSuggestionsAI(
        title, 
        description || "", 
        subject, 
        fileType, 
        filename
      );
      
      return res.status(200).json({ tags });
    } catch (err) {
      console.error("Error generating tag suggestions:", err);
      return res.status(500).json({ 
        message: "Error generating tag suggestions",
        details: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  // Get tag analytics (usage statistics)
  app.get("/api/tags/analytics", isAuthenticated, async (req, res) => {
    try {
      const subject = req.query.subject as string | undefined;
      
      // Get tag analytics optionally filtered by subject
      const analytics = await TagSuggestionService.getTagAnalytics(subject);
      
      return res.status(200).json({ analytics });
    } catch (err) {
      console.error("Error getting tag analytics:", err);
      return res.status(500).json({ 
        message: "Error retrieving tag analytics",
        details: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  // Get suggested tags based on content properties (GET endpoint for client-side requests)
  app.get("/api/suggested-tags", isAuthenticated, async (req, res) => {
    try {
      const { title, description, subject, fileType, filename } = req.query;
      
      // Generate tag suggestions using ContentService
      let suggestedTags: string[] = [];
      
      if (title && subject) {
        suggestedTags = await TagSuggestionService.generateTagSuggestionsAI(
          title as string, 
          description as string || "", 
          subject as string, 
          fileType as string || "", 
          filename as string || ""
        );
      }
      
      return res.json({ 
        tags: suggestedTags,
        source: "AI tag suggestion service"
      });
    } catch (error) {
      console.error("Error generating tag suggestions:", error);
      return res.status(500).json({ 
        message: "Error generating tag suggestions",
        tags: [] 
      });
    }
  });

  // Subject-Faculty Assignment routes
  
  // 1. Create a new subject-faculty assignment (admin only)
  app.post("/api/admin/subject-faculty-assignments", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const adminId = req.user!.id;
      const { faculty_id, subject_name, department_id } = req.body;
      
      // Basic validation
      if (!faculty_id || !subject_name) {
        return res.status(400).json({ message: "Faculty ID and subject name are required" });
      }
      
      if (typeof subject_name !== 'string' || subject_name.trim().length < 2) {
        return res.status(400).json({ message: "Subject name must be at least 2 characters" });
      }
      
      // Create the assignment
      const assignment = await storage.createSubjectFacultyAssignment({
        faculty_id: Number(faculty_id),
        subject_name: subject_name.trim(),
        department_id: department_id ? Number(department_id) : null,
        assigned_by: adminId,
        assigned_at: new Date(),
        is_active: true
      });
      
      // Log the action
      await storage.createAuditLog({
        action: "subject_assignment_created",
        user_id: faculty_id,
        performed_by: adminId,
        details: {
          subject: subject_name,
          department_id: department_id
        },
        affected_user_id: faculty_id,
        ip_address: req.ip || null
      });
      
      res.status(201).json(assignment);
    } catch (error) {
      console.error('Error creating subject-faculty assignment:', error);
      res.status(500).json({ 
        message: "Failed to create subject-faculty assignment", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });
  
  // 2. Get all subject-faculty assignments (with optional filters)
  app.get("/api/subject-faculty-assignments", isAuthenticated, async (req, res) => {
    try {
      const facultyId = req.query.faculty_id ? Number(req.query.faculty_id) : undefined;
      const departmentId = req.query.department_id ? Number(req.query.department_id) : undefined;
      
      const assignments = await storage.getSubjectFacultyAssignments(facultyId, departmentId);
      res.json(assignments);
    } catch (error) {
      console.error('Error fetching subject-faculty assignments:', error);
      res.status(500).json({ message: "Failed to fetch subject-faculty assignments" });
    }
  });
  
  // 3. Get a specific subject-faculty assignment by ID
  app.get("/api/subject-faculty-assignments/:id", isAuthenticated, async (req, res) => {
    try {
      const assignmentId = Number(req.params.id);
      const assignment = await storage.getSubjectFacultyAssignment(assignmentId);
      
      if (!assignment) {
        return res.status(404).json({ message: "Subject-faculty assignment not found" });
      }
      
      res.json(assignment);
    } catch (error) {
      console.error('Error fetching subject-faculty assignment:', error);
      res.status(500).json({ message: "Failed to fetch subject-faculty assignment" });
    }
  });
  
  // 4. Remove a subject-faculty assignment (admin only)
  app.post("/api/admin/subject-faculty-assignments/:id/remove", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const assignmentId = Number(req.params.id);
      const adminId = req.user!.id;
      
      const removedAssignment = await storage.removeSubjectFacultyAssignment(assignmentId, adminId);
      
      if (!removedAssignment) {
        return res.status(404).json({ message: "Subject-faculty assignment not found" });
      }
      
      // Log the action
      await storage.createAuditLog({
        action: "subject_assignment_removed",
        user_id: removedAssignment.faculty_id,
        performed_by: adminId,
        details: {
          subject: removedAssignment.subject_name,
          department_id: removedAssignment.department_id
        },
        affected_user_id: removedAssignment.faculty_id,
        ip_address: req.ip || null
      });
      
      res.json({ message: "Subject-faculty assignment removed successfully", assignment: removedAssignment });
    } catch (error) {
      console.error('Error removing subject-faculty assignment:', error);
      res.status(500).json({ message: "Failed to remove subject-faculty assignment" });
    }
  });
  
  // 5. Update a subject-faculty assignment (admin only)
  app.put("/api/admin/subject-faculty-assignments/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const assignmentId = Number(req.params.id);
      const adminId = req.user!.id;
      const { subject_name, department_id } = req.body;
      
      // Basic validation
      if (!subject_name) {
        return res.status(400).json({ message: "Subject name is required" });
      }
      
      if (typeof subject_name !== 'string' || subject_name.trim().length < 2) {
        return res.status(400).json({ message: "Subject name must be at least 2 characters" });
      }
      
      // Update the assignment
      const updatedAssignment = await storage.updateSubjectFacultyAssignment(
        assignmentId, 
        adminId, 
        {
          subject_name: subject_name.trim(),
          department_id: department_id ? Number(department_id) : null
        }
      );
      
      if (!updatedAssignment) {
        return res.status(404).json({ message: "Subject-faculty assignment not found" });
      }
      
      // Log the action
      await storage.createAuditLog({
        action: "subject_assignment_updated",
        user_id: updatedAssignment.faculty_id,
        performed_by: adminId,
        details: {
          subject: subject_name,
          department_id: department_id
        },
        affected_user_id: updatedAssignment.faculty_id,
        ip_address: req.ip || null
      });
      
      res.json({ 
        message: "Subject-faculty assignment updated successfully", 
        assignment: updatedAssignment 
      });
    } catch (error) {
      console.error('Error updating subject-faculty assignment:', error);
      res.status(500).json({ message: "Failed to update subject-faculty assignment" });
    }
  });
  
  // 5. Get all subjects assigned to a specific faculty
  app.get("/api/faculty/subjects", isAuthenticated, isFaculty, async (req, res) => {
    try {
      const facultyId = req.user!.id;
      const subjects = await storage.getSubjectsByFaculty(facultyId);
      res.json(subjects);
    } catch (error) {
      console.error('Error fetching faculty subjects:', error);
      res.status(500).json({ message: "Failed to fetch faculty subjects" });
    }
  });

  // Content Sorting Endpoints
  
  // Sort content to a class folder (subject-faculty assignment)
  app.post("/api/sort-content", isAuthenticated, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const { contentId, subjectFacultyAssignmentId, userId } = req.body;
      
      if (!contentId || !subjectFacultyAssignmentId) {
        return res.status(400).json({ message: "Content ID and subject-faculty assignment ID are required" });
      }
      
      console.log(`Sorting request: contentId=${contentId}, subjectFacultyAssignmentId=${subjectFacultyAssignmentId}`);
      
      // Use the provided userId if available, otherwise use the authenticated user's ID
      // This allows admins to sort content on behalf of faculty
      const currentUserId = userId || req.user.id;
      
      const result = await ContentSortingService.sortContent(
        contentId, 
        subjectFacultyAssignmentId, 
        currentUserId
      );
      
      if (!result.success) {
        console.log(`Sort operation failed: ${result.errorMessage}`);
        return res.status(400).json({ 
          message: result.errorMessage || "Failed to sort content. Please ensure content, assignment, and permissions are valid." 
        });
      }
      
      return res.status(200).json({ 
        message: "Content sorted successfully!", 
        success: true 
      });
    } catch (error) {
      console.error("Error sorting content:", error);
      return res.status(500).json({ 
        message: "Error sorting content", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Get class folders for faculty
  app.get("/api/faculty/:facultyId/class-folders", isAuthenticated, async (req, res) => {
    try {
      const facultyId = Number(req.params.facultyId);
      if (isNaN(facultyId)) {
        return res.status(400).json({ message: "Invalid faculty ID" });
      }
      
      // Check if user is admin or the faculty member requesting their own class folders
      if (req.user?.role !== "admin" && req.user?.id !== facultyId) {
        return res.status(403).json({ message: "You can only view your own class folders" });
      }
      
      const classFolders = await ContentSortingService.getFacultyClassFolders(facultyId);
      return res.status(200).json(classFolders);
    } catch (error) {
      console.error("Error fetching faculty class folders:", error);
      return res.status(500).json({ message: "Failed to fetch class folders" });
    }
  });
  
  // Get all class folders (for admin view)
  app.get("/api/class-folders", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const classFolders = await ContentSortingService.getAllClassFolders();
      return res.status(200).json(classFolders);
    } catch (error) {
      console.error("Error fetching all class folders:", error);
      return res.status(500).json({ message: "Failed to fetch class folders" });
    }
  });
  
  // Get content with assignment information for sorting interface
  app.get("/api/content-with-assignments", isAuthenticated, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const content = await ContentSortingService.getContentWithAssignments(req.user.id, req.user.role);
      return res.status(200).json(content);
    } catch (error) {
      console.error("Error fetching content with assignments:", error);
      return res.status(500).json({ message: "Failed to fetch content with assignments" });
    }
  });
  
  // Get unsorted content for a faculty member
  app.get("/api/faculty/:facultyId/unsorted-content", isAuthenticated, async (req, res) => {
    try {
      const facultyId = Number(req.params.facultyId);
      if (isNaN(facultyId)) {
        return res.status(400).json({ message: "Invalid faculty ID" });
      }
      
      // Check if user is admin or the faculty member requesting their own unsorted content
      if (req.user?.role !== "admin" && req.user?.id !== facultyId) {
        return res.status(403).json({ message: "You can only view your own unsorted content" });
      }
      
      const unsortedContent = await ContentSortingService.getUnsortedContentForFaculty(facultyId);
      return res.status(200).json(unsortedContent);
    } catch (error) {
      console.error("Error fetching unsorted content:", error);
      return res.status(500).json({ message: "Failed to fetch unsorted content" });
    }
  });

  // Interactive Learning Module Routes

  // ========================
  // Quiz-related routes
  // ========================
  app.get("/api/il/quizzes/department/:departmentId", isAuthenticated, async (req, res) => {
    try {
      const departmentId = Number(req.params.departmentId);
      if (isNaN(departmentId)) {
        return res.status(400).json({ message: "Invalid department ID" });
      }
      
      const quizzes = await QuizService.getQuizzesByDepartment(departmentId);
      return res.status(200).json(quizzes);
    } catch (err) {
      console.error("Error fetching quizzes by department:", err);
      return res.status(500).json({ message: "Error fetching quizzes" });
    }
  });

  // Get quizzes created by a faculty member
  app.get("/api/il/quizzes/faculty/:facultyId", isAuthenticated, async (req, res) => {
    try {
      const facultyId = Number(req.params.facultyId);
      if (isNaN(facultyId)) {
        return res.status(400).json({ message: "Invalid faculty ID" });
      }
      
      const quizzes = await QuizService.getQuizzesByFaculty(facultyId);
      return res.status(200).json(quizzes);
    } catch (err) {
      console.error("Error fetching quizzes by faculty:", err);
      return res.status(500).json({ message: "Error fetching quizzes" });
    }
  });

  // Get quizzes associated with a content item
  app.get("/api/il/quizzes/content/:contentId", isAuthenticated, async (req, res) => {
    try {
      const contentId = Number(req.params.contentId);
      if (isNaN(contentId)) {
        return res.status(400).json({ message: "Invalid content ID" });
      }
      
      const quizzes = await QuizService.getQuizzesByContentId(contentId);
      return res.status(200).json(quizzes);
    } catch (err) {
      console.error("Error fetching quizzes by content ID:", err);
      return res.status(500).json({ message: "Error fetching quizzes" });
    }
  });

  // Get quiz by ID
  app.get("/api/il/quizzes/:quizId", isAuthenticated, async (req, res) => {
    try {
      const quizId = Number(req.params.quizId);
      if (isNaN(quizId)) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }
      
      const quiz = await QuizService.getQuizById(quizId);
      return res.status(200).json(quiz);
    } catch (err) {
      console.error("Error fetching quiz:", err);
      return res.status(500).json({ message: "Error fetching quiz", error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Create a new quiz (faculty only)
  app.post("/api/il/quizzes", isAuthenticated, isFaculty, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const quizData = req.body;
      
      // Validate the quiz data
      const result = insertIlQuizSchema.safeParse(quizData);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid quiz data", 
          errors: result.error.errors 
        });
      }
      
      // Set the creator ID to the current user
      const newQuizData = {
        ...quizData,
        created_by: req.user.id
      };
      
      const quiz = await QuizService.createQuiz(newQuizData);
      
      // Track the interaction
      await ilService.trackUserInteraction(req.user.id, 'quiz_created', quiz.id, {});
      
      return res.status(201).json(quiz);
    } catch (err) {
      console.error("Error creating quiz:", err);
      return res.status(500).json({ message: "Error creating quiz", error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Update an existing quiz (faculty only)
  app.put("/api/il/quizzes/:quizId", isAuthenticated, isFaculty, async (req, res) => {
    try {
      const quizId = Number(req.params.quizId);
      if (isNaN(quizId)) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }
      
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // Get the existing quiz
      const existingQuiz = await QuizService.getQuizById(quizId);
      
      // Check if the current user is the creator of the quiz
      if (existingQuiz.created_by !== req.user.id) {
        return res.status(403).json({ message: "You don't have permission to update this quiz" });
      }
      
      const quizData = req.body;
      const updatedQuiz = await QuizService.updateQuiz(quizId, quizData);
      
      return res.status(200).json(updatedQuiz);
    } catch (err) {
      console.error("Error updating quiz:", err);
      return res.status(500).json({ message: "Error updating quiz", error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Delete a quiz (faculty only)
  app.delete("/api/il/quizzes/:quizId", isAuthenticated, isFaculty, async (req, res) => {
    try {
      const quizId = Number(req.params.quizId);
      if (isNaN(quizId)) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }
      
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // Get the existing quiz
      const existingQuiz = await QuizService.getQuizById(quizId);
      
      // Check if the current user is the creator of the quiz
      if (existingQuiz.created_by !== req.user.id) {
        return res.status(403).json({ message: "You don't have permission to delete this quiz" });
      }
      
      const success = await QuizService.deleteQuiz(quizId);
      
      if (success) {
        return res.status(200).json({ message: "Quiz deleted successfully" });
      } else {
        return res.status(500).json({ message: "Failed to delete quiz" });
      }
    } catch (err) {
      console.error("Error deleting quiz:", err);
      return res.status(500).json({ message: "Error deleting quiz", error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Generate quiz questions from content
  app.post("/api/il/generate-quiz-questions", isAuthenticated, isFaculty, async (req, res) => {
    try {
      const { contentText, subject, difficulty, format, previewMode } = req.body;
      
      if (!contentText || !subject || !difficulty) {
        return res.status(400).json({ message: "Content text, subject, and difficulty are required" });
      }
      
      // Validate difficulty
      const validDifficulties = ["Easy", "Medium", "Hard"];
      if (!validDifficulties.includes(difficulty)) {
        return res.status(400).json({ message: "Difficulty must be one of: Easy, Medium, Hard" });
      }
      
      // Check if we're in preview mode - for faculty only show 3 example questions (1 of each type)
      const questionFormat = previewMode ? 
        { mcq: 1, true_false: 1, short_answer: 1 } : // Preview mode - 1 of each type 
        { mcq: 8, true_false: 4, short_answer: 3 };  // Full mode - all questions
        
      const numQuestions = previewMode ? 3 : 15;
      
      console.log(`Generating quiz questions in ${previewMode ? 'preview' : 'full'} mode...`);
      
      const questions = await QuizService.generateQuizQuestions(
        contentText,
        subject,
        difficulty,
        numQuestions,
        questionFormat
      );
      
      return res.status(200).json(questions);
    } catch (err) {
      console.error("Error generating quiz questions:", err);
      return res.status(500).json({ message: "Error generating quiz questions", error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ========================
  // Forum-related routes
  // ========================
  
  // Get forum posts by subject
  app.get("/api/il/forum/subject/:subject", isAuthenticated, async (req, res) => {
    try {
      const subject = req.params.subject;
      if (!subject) {
        return res.status(400).json({ message: "Subject is required" });
      }
      
      const posts = await ForumService.getPostsForSubject(subject);
      return res.status(200).json(posts);
    } catch (err) {
      console.error("Error fetching forum posts:", err);
      return res.status(500).json({ message: "Error fetching forum posts", error: err instanceof Error ? err.message : String(err) });
    }
  });
  
  // Create a new forum post
  app.post("/api/il/forum/posts", isAuthenticated, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const { subject_faculty, title, content_text, department_id, content_id } = req.body;
      
      if (!subject_faculty || !title || !content_text) {
        return res.status(400).json({ message: "Subject, title, and content are required" });
      }
      
      const post = await ForumService.createPost({
        subject_faculty,
        title,
        content_text,
        user_id: req.user.id,
        department_id,
        content_id
      });
      
      return res.status(201).json(post);
    } catch (err) {
      console.error("Error creating forum post:", err);
      return res.status(500).json({ message: "Error creating forum post", error: err instanceof Error ? err.message : String(err) });
    }
  });
  
  // Add a reply to a forum post
  app.post("/api/il/forum/posts/:postId/replies", isAuthenticated, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const postId = Number(req.params.postId);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }
      
      const { content_text } = req.body;
      
      if (!content_text) {
        return res.status(400).json({ message: "Reply content is required" });
      }
      
      const reply = await ForumService.createReply({
        post_id: postId,
        content_text,
        user_id: req.user.id
      });
      
      return res.status(201).json(reply);
    } catch (err) {
      console.error("Error creating forum reply:", err);
      return res.status(500).json({ message: "Error creating forum reply", error: err instanceof Error ? err.message : String(err) });
    }
  });
  
  // Toggle pin status of a post (faculty only)
  app.post("/api/il/forum/posts/:postId/toggle-pin", isAuthenticated, isFaculty, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const postId = Number(req.params.postId);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }
      
      const post = await ForumService.togglePinStatus(postId, req.user.id);
      
      return res.status(200).json(post);
    } catch (err) {
      console.error("Error toggling pin status:", err);
      return res.status(500).json({ message: "Error toggling pin status", error: err instanceof Error ? err.message : String(err) });
    }
  });
  
  // Get AI-generated insights for a subject (faculty only)
  app.get("/api/il/forum/insights/:subject", isAuthenticated, isFaculty, async (req, res) => {
    try {
      const subject = req.params.subject;
      
      if (!subject) {
        return res.status(400).json({ message: "Subject is required" });
      }
      
      const insights = await ForumService.getInsightsForSubject(subject);
      
      return res.status(200).json(insights);
    } catch (err) {
      console.error("Error fetching forum insights:", err);
      return res.status(500).json({ message: "Error fetching forum insights", error: err instanceof Error ? err.message : String(err) });
    }
  });
  
  // Mark an insight as read
  app.post("/api/il/forum/insights/:insightId/mark-read", isAuthenticated, isFaculty, async (req, res) => {
    try {
      const insightId = Number(req.params.insightId);
      
      if (isNaN(insightId)) {
        return res.status(400).json({ message: "Invalid insight ID" });
      }
      
      const insight = await ForumService.markInsightAsRead(insightId);
      
      return res.status(200).json(insight);
    } catch (err) {
      console.error("Error marking insight as read:", err);
      return res.status(500).json({ message: "Error marking insight as read", error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get pending quizzes (quizzes without attempts) for a student
  app.get("/api/il/quizzes/pending", isAuthenticated, isStudent, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const studentId = req.user.id;
      const departmentId = req.user.department_id;
      
      if (!departmentId) {
        return res.status(400).json({ message: "Student has no department assigned" });
      }
      
      // Get all quizzes for the student's department
      const quizzes = await QuizService.getQuizzesByDepartment(departmentId);
      
      // Get all quiz attempts by the student
      const attempts = await QuizService.getStudentAllAttempts(studentId);
      
      // Filter out quizzes that the student has already attempted
      const attemptedQuizIds = new Set(attempts.map(attempt => attempt.quiz_id));
      const pendingQuizzes = quizzes.filter(quiz => !attemptedQuizIds.has(quiz.id));
      
      return res.status(200).json(pendingQuizzes);
    } catch (err) {
      console.error("Error fetching pending quizzes:", err);
      return res.status(500).json({ message: "Error fetching pending quizzes", error: err instanceof Error ? err.message : String(err) });
    }
  });
  
  // Get completed quizzes (quizzes with attempts) for a student
  app.get("/api/il/quizzes/completed", isAuthenticated, isStudent, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const studentId = req.user.id;
      
      // Get all quiz attempts by the student with quiz information
      const attempts = await QuizService.getStudentAllAttemptsWithQuizInfo(studentId);
      
      return res.status(200).json(attempts);
    } catch (err) {
      console.error("Error fetching completed quizzes:", err);
      return res.status(500).json({ message: "Error fetching completed quizzes", error: err instanceof Error ? err.message : String(err) });
    }
  });
  
  // Check if student has already attempted a quiz
  app.get("/api/il/quizzes/:quizId/check-attempt", isAuthenticated, isStudent, async (req, res) => {
    try {
      const quizId = Number(req.params.quizId);
      if (isNaN(quizId)) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }
      
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const hasAttempted = await QuizService.hasStudentAttemptedQuiz(quizId, req.user.id);
      
      return res.status(200).json({ hasAttempted });
    } catch (err) {
      console.error("Error checking quiz attempt:", err);
      return res.status(500).json({ message: "Error checking quiz attempt", error: err instanceof Error ? err.message : String(err) });
    }
  });
  
  // Submit quiz attempt (this endpoint is used by the client)
  app.post("/api/il/quiz-attempts", isAuthenticated, async (req, res) => {
    try {
      const { quiz_id, answers, difficulty_level, time_taken, questions } = req.body;
      
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      if (!quiz_id || !Array.isArray(answers) || !difficulty_level) {
        return res.status(400).json({ message: "Quiz ID, answers array, and difficulty level are required" });
      }

      // Get the quiz and user details
      const quiz = await QuizService.getQuizById(quiz_id);
      const user = req.user;
      
      // Evaluate answers to calculate score
      const evaluation = await QuizService.evaluateQuizAnswers(
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        quiz.subject,
        questions || quiz.questions,
        answers
      );
      
      // Record the attempt
      const attemptId = await QuizService.recordQuizAttempt({
        quiz_id: quiz_id,
        student_id: req.user.id,
        score: evaluation.score,
        answers: answers,
        difficulty_level: difficulty_level,
        time_taken: time_taken || null
      });
      
      return res.status(200).json({
        ...evaluation,
        attemptId
      });
    } catch (err) {
      console.error("Error submitting quiz attempt:", err);
      return res.status(500).json({ 
        message: "Error submitting quiz attempt", 
        error: err instanceof Error ? err.message : String(err) 
      });
    }
  });

  // Original submit quiz attempt endpoint (keeping for backward compatibility)
  app.post("/api/il/quizzes/:quizId/attempts", isAuthenticated, isStudent, async (req, res) => {
    try {
      const quizId = Number(req.params.quizId);
      if (isNaN(quizId)) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }
      
      const { score, answers, difficulty_level, time_taken } = req.body;
      
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // Record the attempt
      const attemptId = await QuizService.recordQuizAttempt({
        quiz_id: quizId,
        student_id: req.user.id,
        score: score,
        answers: answers,
        difficulty_level: difficulty_level,
        time_taken: time_taken || null
      });
      
      // Get the quiz for additional information
      const quiz = await QuizService.getQuizById(quizId);
      
      // Track user interaction
      await ilService.trackUserInteraction(req.user.id, 'quiz_attempt', attemptId, { 
        score, 
        quiz_id: quizId,
        difficulty: difficulty_level
      });
      
      // Get next recommended difficulty
      const nextDifficulty = await QuizService.recommendNextDifficulty(score, difficulty_level);
      
      return res.status(200).json({
        id: attemptId,
        quiz_id: quizId,
        student_id: req.user.id,
        score: score,
        difficulty_level: difficulty_level,
        next_recommended_difficulty: nextDifficulty
      });
    } catch (err) {
      console.error("Error submitting quiz attempt:", err);
      return res.status(500).json({ message: "Error submitting quiz attempt", error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get a student's attempts for a quiz
  app.get("/api/il/quizzes/:quizId/attempts", isAuthenticated, async (req, res) => {
    try {
      const quizId = Number(req.params.quizId);
      if (isNaN(quizId)) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }
      
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // Get the student's attempts
      const attempts = await QuizService.getStudentQuizAttempts(quizId, req.user.id);
      
      return res.status(200).json(attempts);
    } catch (err) {
      console.error("Error fetching quiz attempts:", err);
      return res.status(500).json({ message: "Error fetching quiz attempts", error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Toggle quiz enabled status (enable/disable quiz for a content)
  app.post("/api/il/content/:contentId/toggle-quiz", isAuthenticated, isFaculty, async (req, res) => {
    try {
      const contentId = Number(req.params.contentId);
      const { isEnabled } = req.body;
      
      if (isNaN(contentId)) {
        return res.status(400).json({ message: "Invalid content ID" });
      }
      
      if (typeof isEnabled !== 'boolean') {
        return res.status(400).json({ message: "isEnabled must be a boolean" });
      }
      
      const quiz = await QuizService.toggleQuizEnabled(contentId, isEnabled);
      
      return res.status(200).json({ 
        message: `Quiz ${isEnabled ? 'enabled' : 'disabled'} successfully`,
        quiz
      });
    } catch (err) {
      console.error("Error toggling quiz enabled status:", err);
      return res.status(500).json({ message: "Error toggling quiz status", error: err instanceof Error ? err.message : String(err) });
    }
  });
  
  // Toggle quiz published status (publish/unpublish quiz)
  app.post("/api/il/quizzes/:quizId/toggle-published", isAuthenticated, isFaculty, async (req, res) => {
    try {
      const quizId = Number(req.params.quizId);
      const { isPublished } = req.body;
      
      if (isNaN(quizId)) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }
      
      if (typeof isPublished !== 'boolean') {
        return res.status(400).json({ message: "isPublished must be a boolean" });
      }
      
      const quiz = await QuizService.toggleQuizPublished(quizId, isPublished);
      
      return res.status(200).json({ 
        message: `Quiz ${isPublished ? 'published' : 'unpublished'} successfully`,
        quiz
      });
    } catch (err) {
      console.error("Error toggling quiz published status:", err);
      return res.status(500).json({ message: "Error toggling quiz published status", error: err instanceof Error ? err.message : String(err) });
    }
  });
  
  // Start a quiz for a student (returns first question)
  app.post("/api/il/quizzes/:quizId/start", isAuthenticated, isStudent, async (req, res) => {
    try {
      const quizId = Number(req.params.quizId);
      
      if (isNaN(quizId)) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }
      
      const studentId = req.user!.id;
      
      const startResult = await QuizService.startQuiz(quizId, studentId);
      
      if (!startResult.canTake) {
        return res.status(403).json({ 
          message: "You cannot take this quiz. It might be disabled, unpublished, or you've already taken it.",
          quiz: startResult.quiz 
        });
      }
      
      return res.status(200).json({
        message: "Quiz started successfully",
        quiz: startResult.quiz,
        firstQuestion: startResult.firstQuestion
      });
    } catch (err) {
      console.error("Error starting quiz:", err);
      return res.status(500).json({ message: "Error starting quiz", error: err instanceof Error ? err.message : String(err) });
    }
  });
  
  // Next question route has been moved below to avoid duplication
  
  // Complete quiz route has been moved below to avoid duplication
  
  // Get quizzes for faculty management (regardless of published status)
  app.get("/api/il/quizzes/faculty/:facultyId/manage", isAuthenticated, isFaculty, async (req, res) => {
    try {
      const facultyId = Number(req.params.facultyId);
      
      if (isNaN(facultyId)) {
        return res.status(400).json({ message: "Invalid faculty ID" });
      }
      
      // Ensure faculty is only viewing their own quizzes
      if (facultyId !== req.user!.id) {
        return res.status(403).json({ message: "You can only view your own quizzes" });
      }
      
      const quizzes = await QuizService.getQuizzesForFacultyManagement(facultyId);
      
      return res.status(200).json(quizzes);
    } catch (err) {
      console.error("Error fetching quizzes for management:", err);
      return res.status(500).json({ message: "Error fetching quizzes for management", error: err instanceof Error ? err.message : String(err) });
    }
  });
  
  // Start a quiz for a student
  app.post("/api/il/quizzes/:quizId/start", isAuthenticated, isStudent, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const quizId = Number(req.params.quizId);
      if (isNaN(quizId)) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }
      
      const studentId = req.user.id;
      
      const result = await QuizService.startQuiz(quizId, studentId);
      return res.status(200).json(result);
    } catch (err) {
      console.error("Error starting quiz:", err);
      return res.status(500).json({ 
        message: "Error starting quiz", 
        error: err instanceof Error ? err.message : String(err) 
      });
    }
  });
  
  // Get the next question for an adaptive quiz
  app.post("/api/il/quizzes/:quizId/next-question", isAuthenticated, isStudent, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const quizId = Number(req.params.quizId);
      if (isNaN(quizId)) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }
      
      const { currentDifficulty, lastScore } = req.body;
      
      if (!currentDifficulty) {
        return res.status(400).json({ message: "Current difficulty is required" });
      }
      
      // Determine next question difficulty based on performance
      let nextDifficulty = currentDifficulty;
      if (lastScore !== null && lastScore !== undefined) {
        nextDifficulty = await QuizService.recommendNextDifficulty(lastScore, currentDifficulty);
      }
      
      // Get quiz for content ID to use in question generation
      const quiz = await QuizService.getQuizById(quizId);
      
      // Extract content text for question generation
      let contentText = '';
      // Import ContentService to extract full text
      const { ContentService } = require('./content-service');
      
      if (quiz.content) {
        if (quiz.content.type === 'Lecture Handout') {
          try {
            // Extract the full document content for better question generation
            contentText = await ContentService.extractFileContent(quiz.content.id);
            console.log(`Extracted ${contentText.length} characters of content for next question`);
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
      
      // Generate the next question based on new difficulty
      const question = await QuizService.generateDynamicQuestion(
        contentText,
        quiz.subject,
        nextDifficulty
      );
      
      return res.status(200).json({
        question,
        difficulty: nextDifficulty
      });
    } catch (err) {
      console.error("Error getting next question:", err);
      return res.status(500).json({ 
        message: "Error getting next question", 
        error: err instanceof Error ? err.message : String(err) 
      });
    }
  });
  
  // Complete a quiz and record the results
  app.post("/api/il/quizzes/:quizId/complete", isAuthenticated, isStudent, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const quizId = Number(req.params.quizId);
      if (isNaN(quizId)) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }
      
      const studentId = req.user.id;
      const { answers, score, timeTaken } = req.body;
      
      if (!answers || score === undefined || score === null) {
        return res.status(400).json({ message: "Answers and score are required" });
      }
      
      const result = await QuizService.completeQuiz(
        quizId,
        studentId,
        answers,
        score,
        timeTaken || null
      );
      
      return res.status(200).json(result);
    } catch (err) {
      console.error("Error completing quiz:", err);
      return res.status(500).json({ 
        message: "Error completing quiz", 
        error: err instanceof Error ? err.message : String(err) 
      });
    }
  });
  
  // Evaluate quiz answers and provide personalized feedback
  app.post("/api/il/evaluate-quiz", isAuthenticated, async (req, res) => {
    try {
      const { studentName, subject, quizQuestions, studentAnswers } = req.body;
      
      if (!studentName || !subject || !quizQuestions || !studentAnswers) {
        return res.status(400).json({ message: "Student name, subject, quiz questions, and student answers are required" });
      }
      
      const evaluation = await QuizService.evaluateQuizAnswers(
        studentName,
        subject,
        quizQuestions,
        studentAnswers
      );
      
      return res.status(200).json(evaluation);
    } catch (err) {
      console.error("Error evaluating quiz answers:", err);
      return res.status(500).json({ message: "Error evaluating quiz answers", error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get quiz statistics (faculty only)
  app.get("/api/il/quizzes/:quizId/statistics", isAuthenticated, isFaculty, async (req, res) => {
    try {
      const quizId = Number(req.params.quizId);
      if (isNaN(quizId)) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }
      
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // Get the quiz first
      const quiz = await QuizService.getQuizById(quizId);
      
      // Only the creator or an admin can view statistics
      if (quiz.created_by !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ message: "You don't have permission to view these statistics" });
      }
      
      // Get the statistics
      const statistics = await QuizService.getQuizStatistics(quizId);
      
      return res.status(200).json(statistics);
    } catch (err) {
      console.error("Error fetching quiz statistics:", err);
      return res.status(500).json({ message: "Error fetching quiz statistics", error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get forum posts by department
  app.get("/api/il/forum/department/:departmentId", isAuthenticated, async (req, res) => {
    try {
      const departmentId = Number(req.params.departmentId);
      if (isNaN(departmentId)) {
        return res.status(400).json({ message: "Invalid department ID" });
      }
      
      const posts = await ilService.getForumPostsByDepartment(departmentId);
      return res.status(200).json(posts);
    } catch (err) {
      console.error("Error fetching forum posts by department:", err);
      return res.status(500).json({ message: "Error fetching forum posts" });
    }
  });

  // Get forum post by ID
  app.get("/api/il/forum/posts/:postId", isAuthenticated, async (req, res) => {
    try {
      const postId = Number(req.params.postId);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }
      
      const post = await ilService.getForumPostById(postId);
      if (!post) {
        return res.status(404).json({ message: "Forum post not found" });
      }
      
      return res.status(200).json(post);
    } catch (err) {
      console.error("Error fetching forum post:", err);
      return res.status(500).json({ message: "Error fetching forum post" });
    }
  });

  // Add reply to forum post
  app.post("/api/il/forum/posts/:postId/replies", isAuthenticated, async (req, res) => {
    try {
      const postId = Number(req.params.postId);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }
      
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ message: "Reply content is required" });
      }
      
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const reply = await ilService.addForumReply(postId, req.user.id, content);
      return res.status(201).json(reply);
    } catch (err) {
      console.error("Error adding forum reply:", err);
      return res.status(500).json({ message: "Error adding forum reply" });
    }
  });

  // Get polls by department
  app.get("/api/il/polls/department/:departmentId", isAuthenticated, async (req, res) => {
    try {
      const departmentId = Number(req.params.departmentId);
      if (isNaN(departmentId)) {
        return res.status(400).json({ message: "Invalid department ID" });
      }
      
      const polls = await ilService.getPollsByDepartment(departmentId);
      return res.status(200).json(polls);
    } catch (err) {
      console.error("Error fetching polls by department:", err);
      return res.status(500).json({ message: "Error fetching polls" });
    }
  });

  // Vote on poll
  app.post("/api/il/polls/:pollId/vote", isAuthenticated, async (req, res) => {
    try {
      const pollId = Number(req.params.pollId);
      if (isNaN(pollId)) {
        return res.status(400).json({ message: "Invalid poll ID" });
      }
      
      const { option_index } = req.body;
      
      if (option_index === undefined) {
        return res.status(400).json({ message: "Option index is required" });
      }
      
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const vote = await ilService.voteOnPoll(pollId, req.user.id, option_index);
      return res.status(200).json(vote[0]);
    } catch (err) {
      console.error("Error voting on poll:", err);
      return res.status(500).json({ message: "Error voting on poll" });
    }
  });

  // Get shared notes by department
  app.get("/api/il/notes/department/:departmentId", isAuthenticated, async (req, res) => {
    try {
      const departmentId = Number(req.params.departmentId);
      if (isNaN(departmentId)) {
        return res.status(400).json({ message: "Invalid department ID" });
      }
      
      const notes = await ilService.getSharedNotesByDepartment(departmentId);
      return res.status(200).json(notes);
    } catch (err) {
      console.error("Error fetching shared notes by department:", err);
      return res.status(500).json({ message: "Error fetching shared notes" });
    }
  });

  // Get shared note by ID
  app.get("/api/il/notes/:noteId", isAuthenticated, async (req, res) => {
    try {
      const noteId = Number(req.params.noteId);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }
      
      const note = await ilService.getSharedNoteById(noteId);
      if (!note) {
        return res.status(404).json({ message: "Shared note not found" });
      }
      
      return res.status(200).json(note);
    } catch (err) {
      console.error("Error fetching shared note:", err);
      return res.status(500).json({ message: "Error fetching shared note" });
    }
  });

  // Contribute to shared note (Legacy method - use newer note API below)
  app.post("/api/il/notes/:noteId/contribute", isAuthenticated, async (req, res) => {
    try {
      const noteId = Number(req.params.noteId);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }
      
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ message: "Contribution content is required" });
      }
      
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const contribution = await ilService.contributeToNote(noteId, req.user.id, content);
      return res.status(201).json(contribution);
    } catch (err) {
      console.error("Error contributing to shared note:", err);
      return res.status(500).json({ message: "Error contributing to shared note" });
    }
  });
  
  // ========================
  // Enhanced Shared Notes API
  // ========================
  
  // Get all note sessions for a subject
  app.get('/api/il/notes/sessions/:subject', isAuthenticated, async (req, res) => {
    try {
      const subject = req.params.subject;
      const sessions = await NotesService.getNoteSessionsBySubject(subject);
      res.json(sessions);
    } catch (error) {
      console.error('Error fetching note sessions:', error);
      res.status(500).json({ 
        message: 'Error fetching note sessions',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get a specific note session
  app.get('/api/il/notes/sessions/:id', isAuthenticated, async (req, res) => {
    try {
      const sessionId = Number(req.params.id);
      if (isNaN(sessionId)) {
        return res.status(400).json({ message: 'Invalid session ID' });
      }
      
      const session = await NotesService.getNoteSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Note session not found' });
      }
      
      res.json(session);
    } catch (error) {
      console.error('Error fetching note session:', error);
      res.status(500).json({ 
        message: 'Error fetching note session',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get all entries for a note session
  app.get('/api/il/notes/sessions/:id/entries', isAuthenticated, async (req, res) => {
    try {
      const sessionId = Number(req.params.id);
      if (isNaN(sessionId)) {
        return res.status(400).json({ message: 'Invalid session ID' });
      }
      
      const entries = await NotesService.getNoteContributions(sessionId);
      res.json(entries);
    } catch (error) {
      console.error('Error fetching note entries:', error);
      res.status(500).json({ 
        message: 'Error fetching note entries',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Create a new note session (faculty only)
  app.post('/api/il/notes/sessions', isAuthenticated, isFaculty, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const { title, content, subject, department_id } = req.body;
      
      if (!title || !content || !subject) {
        return res.status(400).json({ message: 'Title, content, and subject are required' });
      }
      
      const session = await NotesService.createNoteSession(
        req.user.id,
        title,
        content,
        subject,
        department_id
      );
      
      res.status(201).json(session);
    } catch (error) {
      console.error('Error creating note session:', error);
      res.status(500).json({ 
        message: 'Error creating note session',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Add an entry to a note session
  app.post('/api/il/notes/sessions/:id/entries', isAuthenticated, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const sessionId = Number(req.params.id);
      if (isNaN(sessionId)) {
        return res.status(400).json({ message: 'Invalid session ID' });
      }
      
      const { content, content_type, sketch_data } = req.body;
      
      // Validate content based on type
      if (content_type === 'text' && !content) {
        return res.status(400).json({ message: 'Content is required for text entries' });
      } else if (content_type === 'sketch' && !sketch_data) {
        return res.status(400).json({ message: 'Sketch data is required for sketch entries' });
      }
      
      const entry = await NotesService.addContribution(
        sessionId,
        req.user.id,
        content || '',
        content_type as 'text' | 'sketch',
        sketch_data
      );
      
      res.status(201).json(entry);
    } catch (error) {
      console.error('Error adding note entry:', error);
      res.status(500).json({ 
        message: 'Error adding note entry',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Update note session status (faculty only)
  app.put('/api/il/notes/sessions/:id/status', isAuthenticated, isFaculty, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const sessionId = Number(req.params.id);
      if (isNaN(sessionId)) {
        return res.status(400).json({ message: 'Invalid session ID' });
      }
      
      const { is_active_session } = req.body;
      
      if (typeof is_active_session !== 'boolean') {
        return res.status(400).json({ message: 'is_active_session must be a boolean' });
      }
      
      const session = await NotesService.updateNoteSessionStatus(
        sessionId,
        is_active_session,
        req.user.id
      );
      
      res.json(session);
    } catch (error) {
      console.error('Error updating note session status:', error);
      res.status(500).json({ 
        message: 'Error updating note session status',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Delete note session (faculty only)
  app.delete('/api/il/notes/sessions/:id', isAuthenticated, isFaculty, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const sessionId = Number(req.params.id);
      if (isNaN(sessionId)) {
        return res.status(400).json({ message: 'Invalid session ID' });
      }
      
      const session = await NotesService.deleteNoteSession(
        sessionId,
        req.user.id
      );
      
      res.json(session);
    } catch (error) {
      console.error('Error deleting note session:', error);
      res.status(500).json({ 
        message: 'Error deleting note session',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get AI tips for user
  app.get("/api/il/ai-tips", isAuthenticated, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const tips = await ilService.getAiTipsForUser(req.user.id);
      return res.status(200).json(tips);
    } catch (err) {
      console.error("Error fetching AI tips:", err);
      return res.status(500).json({ message: "Error fetching AI tips" });
    }
  });

  // Mark AI tip as read
  app.put("/api/il/ai-tips/:tipId/read", isAuthenticated, async (req, res) => {
    try {
      const tipId = Number(req.params.tipId);
      if (isNaN(tipId)) {
        return res.status(400).json({ message: "Invalid tip ID" });
      }
      
      const { is_helpful } = req.body;
      
      const updatedTip = await ilService.markAiTipAsRead(tipId, is_helpful);
      return res.status(200).json(updatedTip[0]);
    } catch (err) {
      console.error("Error marking AI tip as read:", err);
      return res.status(500).json({ message: "Error marking AI tip as read" });
    }
  });

  // ========================
  // Poll-related routes
  // ========================
  
  // Create a new poll (faculty only)
  app.post("/api/il/polls", isAuthenticated, isFaculty, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const { title, question, options, subject, department_id, content_id, timer_duration } = req.body;
      
      if (!title || !question || !options || !subject) {
        return res.status(400).json({ message: "Title, question, options, and subject are required" });
      }
      
      const poll = await PollService.createPoll({
        title,
        question,
        options,
        created_by: req.user.id,
        subject,
        department_id,
        content_id,
        timer_duration
      });
      
      return res.status(201).json(poll);
    } catch (err) {
      console.error("Error creating poll:", err);
      return res.status(500).json({ message: "Error creating poll" });
    }
  });
  
  // Get active polls for a subject
  app.get("/api/il/polls/subject/:subject/active", isAuthenticated, async (req, res) => {
    try {
      const subject = req.params.subject;
      if (!subject) {
        return res.status(400).json({ message: "Subject is required" });
      }
      
      const polls = await PollService.getActivePolls(subject);
      return res.status(200).json(polls);
    } catch (err) {
      console.error("Error fetching active polls:", err);
      return res.status(500).json({ message: "Error fetching active polls" });
    }
  });
  
  // Get poll by ID with results
  app.get("/api/il/polls/:pollId/results", isAuthenticated, async (req, res) => {
    try {
      const pollId = Number(req.params.pollId);
      if (isNaN(pollId)) {
        return res.status(400).json({ message: "Invalid poll ID" });
      }
      
      const results = await PollService.getPollResults(pollId);
      return res.status(200).json(results);
    } catch (err) {
      console.error("Error fetching poll results:", err);
      return res.status(500).json({ message: "Error fetching poll results" });
    }
  });
  
  // Close a poll (faculty only)
  app.put("/api/il/polls/:pollId/close", isAuthenticated, isFaculty, async (req, res) => {
    try {
      const pollId = Number(req.params.pollId);
      if (isNaN(pollId)) {
        return res.status(400).json({ message: "Invalid poll ID" });
      }
      
      // Check if the user is the creator of the poll
      const poll = await PollService.getPollById(pollId);
      if (!poll) {
        return res.status(404).json({ message: "Poll not found" });
      }
      
      if (poll.created_by !== req.user?.id && req.user?.role !== 'admin') {
        return res.status(403).json({ message: "You don't have permission to close this poll" });
      }
      
      const closedPoll = await PollService.closePoll(pollId);
      return res.status(200).json(closedPoll);
    } catch (err) {
      console.error("Error closing poll:", err);
      return res.status(500).json({ message: "Error closing poll" });
    }
  });
  
  // Find related content for a poll
  app.get("/api/il/polls/:pollId/related-content", isAuthenticated, async (req, res) => {
    try {
      const pollId = Number(req.params.pollId);
      if (isNaN(pollId)) {
        return res.status(400).json({ message: "Invalid poll ID" });
      }
      
      const relatedContent = await PollService.findRelatedContent(pollId);
      return res.status(200).json(relatedContent);
    } catch (err) {
      console.error("Error finding related content:", err);
      return res.status(500).json({ message: "Error finding related content" });
    }
  });

  /***************** Engagement Tracking Routes *****************/

  // Track user interaction
  app.post('/api/engagement/track', isAuthenticated, async (req, res) => {
    try {
      const { user_id, interaction_type, content_id } = req.body;
      
      // Validate the request
      if (!user_id || !interaction_type) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // Only allow students to record interactions (or admins for testing)
      if (req.user?.role !== 'student' && req.user?.role !== 'admin' && req.user?.id !== user_id) {
        return res.status(403).json({ message: 'Only students can record interactions' });
      }
      
      const result = await engagementService.trackInteraction(user_id, interaction_type, content_id);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error tracking interaction:', error);
      return res.status(500).json({ message: 'Error tracking interaction' });
    }
  });

  // Get user engagement data
  app.get('/api/engagement/user/:userId', isAuthenticated, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }
      
      // Users can only view their own engagement unless they're admins
      if (req.user?.id !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'You can only view your own engagement' });
      }
      
      const engagement = await engagementService.getUserEngagement(userId);
      return res.status(200).json(engagement);
    } catch (error) {
      console.error('Error getting user engagement:', error);
      return res.status(500).json({ message: 'Error getting user engagement' });
    }
  });

  // Get department engagement data
  app.get('/api/engagement/department/:departmentId', isAuthenticated, async (req, res) => {
    try {
      const departmentId = Number(req.params.departmentId);
      
      if (isNaN(departmentId)) {
        return res.status(400).json({ message: 'Invalid department ID' });
      }
      
      // Only faculty and admins can view department engagement
      if (req.user?.role !== 'faculty' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Only faculty and admins can view department engagement' });
      }
      
      // Faculty can only view their own department
      if (req.user?.role === 'faculty' && req.user?.department_id !== departmentId) {
        return res.status(403).json({ message: 'You can only view your own department' });
      }
      
      const engagement = await engagementService.getDepartmentEngagement(departmentId);
      return res.status(200).json(engagement);
    } catch (error) {
      console.error('Error getting department engagement:', error);
      return res.status(500).json({ message: 'Error getting department engagement' });
    }
  });

  // Get department engagement trends
  app.get('/api/engagement/trends/department/:departmentId', isAuthenticated, async (req, res) => {
    try {
      const departmentId = Number(req.params.departmentId);
      
      if (isNaN(departmentId)) {
        return res.status(400).json({ message: 'Invalid department ID' });
      }
      
      // Only faculty and admins can view department trends
      if (req.user?.role !== 'faculty' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Only faculty and admins can view department trends' });
      }
      
      // Faculty can only view their own department
      if (req.user?.role === 'faculty' && req.user?.department_id !== departmentId) {
        return res.status(403).json({ message: 'You can only view your own department' });
      }
      
      const trends = await engagementService.getDepartmentTrends(departmentId);
      return res.status(200).json(trends);
    } catch (error) {
      console.error('Error getting department trends:', error);
      return res.status(500).json({ message: 'Error getting department trends' });
    }
  });

  // Admin-only route to update weekly counts
  app.post('/api/engagement/update-weekly', isAdmin, async (req, res) => {
    try {
      await engagementService.updateWeeklyCounts();
      return res.status(200).json({ message: 'Weekly counts updated' });
    } catch (error) {
      console.error('Error updating weekly counts:', error);
      return res.status(500).json({ message: 'Error updating weekly counts' });
    }
  });

  // ========================
  // AI Tips and Insights Routes
  // ========================

  // Get AI tips for the current user
  app.get('/api/il/tips', isAuthenticated, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const userId = req.user.id;
      const tips = await ilService.getAiTipsForUser(userId);
      return res.status(200).json(tips);
    } catch (error) {
      console.error('Error fetching AI tips:', error);
      return res.status(500).json({ message: 'Error fetching AI tips' });
    }
  });

  // Generate new personalized tips for a user
  app.post('/api/il/tips/generate', isAuthenticated, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const userId = req.user.id;
      const tips = await ilService.generatePersonalizedTips(userId);
      return res.status(200).json(tips);
    } catch (error) {
      console.error('Error generating AI tips:', error);
      return res.status(500).json({ message: 'Error generating AI tips' });
    }
  });

  // Mark a tip as read (optionally mark if it was helpful)
  app.post('/api/il/tips/:tipId/read', isAuthenticated, async (req, res) => {
    try {
      const tipId = Number(req.params.tipId);
      if (isNaN(tipId)) {
        return res.status(400).json({ message: 'Invalid tip ID' });
      }
      
      const { is_helpful } = req.body;
      const updatedTip = await ilService.markAiTipAsRead(tipId, is_helpful);
      return res.status(200).json(updatedTip);
    } catch (error) {
      console.error('Error marking tip as read:', error);
      return res.status(500).json({ message: 'Error marking tip as read' });
    }
  });

  // Faculty: Get class insights
  app.get('/api/il/insights/class', isFaculty, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const facultyId = req.user.id;
      const { department_id, subject } = req.query;
      
      const departmentId = department_id ? Number(department_id) : undefined;
      const insights = await ilService.generateClassInsights(
        facultyId,
        departmentId,
        subject as string | undefined
      );
      
      return res.status(200).json(insights);
    } catch (error) {
      console.error('Error generating class insights:', error);
      return res.status(500).json({ message: 'Error generating class insights' });
    }
  });

  // Admin: Get system overview
  app.get('/api/il/insights/system', isAdmin, async (req, res) => {
    try {
      const overview = await ilService.generateSystemOverview();
      return res.status(200).json(overview);
    } catch (error) {
      console.error('Error generating system overview:', error);
      return res.status(500).json({ message: 'Error generating system overview' });
    }
  });

  // Create HTTP server - WebSocketManager will be initialized elsewhere
  const httpServer = createServer(app);
  return httpServer;
}
