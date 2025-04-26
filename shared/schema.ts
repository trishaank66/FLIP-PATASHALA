import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, pgEnum, unique, doublePrecision } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Departments table for group badges
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  created_at: timestamp("created_at").notNull().defaultNow()
});

// Subjects table for centralized subject management
export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  department_id: integer("department_id").references(() => departments.id),
  created_at: timestamp("created_at").notNull().defaultNow(),
  created_by: integer("created_by").notNull().references(() => users.id), // Admin who created the subject
  is_active: boolean("is_active").notNull().default(true)
}, (table) => {
  return {
    // Enforce unique subject-department combinations
    uniqSubjectDept: unique().on(table.name, table.department_id)
  };
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("student"),
  role_id: text("role_id"),  // For student ID, faculty ID, or admin code
  first_name: text("first_name"),  // User's first name
  last_name: text("last_name"),    // User's last name
  department_id: integer("department_id").references(() => departments.id), // Foreign key to departments
  verification_pending: boolean("verification_pending").notNull().default(true),
  verified_at: timestamp("verified_at"),  // Timestamp when verification happened
  is_active: boolean("is_active").notNull().default(true) // Flag to mark if user is active or deleted
});

// Table for tracking verification attempts
export const verificationLogs = pgTable("verification_logs", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id),
  status: text("status").notNull(), // 'pending', 'verified', 'rejected'
  message: text("message"),
  created_at: timestamp("created_at").notNull().defaultNow()
});

// Table for audit logs to track user actions (like deletions)
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(), // e.g., 'delete_student'
  user_id: integer("user_id").notNull().references(() => users.id), // User affected
  performed_by: integer("performed_by").notNull().references(() => users.id), // Admin who performed the action
  details: jsonb("details"), // Additional context as JSON
  created_at: timestamp("created_at").notNull().defaultNow(),
  affected_user_id: integer("affected_user_id").references(() => users.id), // Optional user affected by this action
  ip_address: text("ip_address") // IP address of the user who performed the action
});

// Faculty content permission requests table
export const facultyContentPermissions = pgTable("faculty_content_permissions", {
  id: serial("id").primaryKey(),
  faculty_id: integer("faculty_id").notNull().references(() => users.id),
  status: text("status").notNull().default('pending'), // 'pending', 'granted', 'revoked'
  reason: text("reason"), // Faculty's reason for requesting permission
  review_notes: text("review_notes"), // Admin notes on approval/rejection
  reviewed_by: integer("reviewed_by").references(() => users.id), // Admin who reviewed the request
  requested_at: timestamp("requested_at").notNull().defaultNow(),
  reviewed_at: timestamp("reviewed_at"),
  is_active: boolean("is_active").notNull().default(true)
});

// Content Management Module tables
export const content = pgTable("content", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  subject: varchar("subject", { length: 255 }).notNull(),
  faculty: varchar("faculty", { length: 255 }),
  type: varchar("type", { length: 255 }).notNull(), // video, note, slideshow, application/pdf, etc
  filename: varchar("filename", { length: 255 }).notNull(),
  url: varchar("url", { length: 255 }).notNull(),
  preview_url: varchar("preview_url", { length: 255 }), // Store URL to the preview image/thumbnail
  views: integer("views").notNull().default(0), // Track how many times content has been viewed
  downloads: integer("downloads").notNull().default(0), // Track how many times content has been downloaded
  likes_percent: integer("likes_percent").default(0), // Percentage of users who liked the content
  tags: text("tags").array(), // Store content tags as a string array for filtering and organization
  uploaded_by: integer("uploaded_by").references(() => users.id),
  dept_id: integer("dept_id").references(() => departments.id),
  subject_faculty_assignment_id: integer("subject_faculty_assignment_id").references(() => subjectFacultyAssignments.id), // Link content to subject-faculty assignments
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
  is_deleted: boolean("is_deleted").notNull().default(false), // Flag to mark content as deleted
  deleted_at: timestamp("deleted_at"), // Timestamp when content was deleted (for undo window)
  has_quiz: boolean("has_quiz").default(false) // Flag indicating if this content has an associated quiz
});

// Table for tracking content views by users
export const content_views = pgTable("content_views", {
  id: serial("id").primaryKey(),
  content_id: integer("content_id").notNull().references(() => content.id),
  user_id: integer("user_id").notNull().references(() => users.id),
  viewed_at: timestamp("viewed_at").notNull().defaultNow()
});

// Table for tracking content downloads by users
export const content_downloads = pgTable("content_downloads", {
  id: serial("id").primaryKey(),
  content_id: integer("content_id").notNull().references(() => content.id),
  user_id: integer("user_id").notNull().references(() => users.id),
  downloaded_at: timestamp("downloaded_at").notNull().defaultNow()
});

// Table for subject-faculty assignments
export const subjectFacultyAssignments = pgTable("subject_faculty_assignments", {
  id: serial("id").primaryKey(),
  faculty_id: integer("faculty_id").notNull().references(() => users.id),
  subject_name: varchar("subject_name", { length: 255 }).notNull(),
  department_id: integer("department_id").references(() => departments.id),
  assigned_by: integer("assigned_by").notNull().references(() => users.id), // Admin who assigned the subject
  assigned_at: timestamp("assigned_at").notNull().defaultNow(),
  is_active: boolean("is_active").notNull().default(true),
}, (table) => {
  return {
    // Enforce unique faculty-subject-department combinations
    unq: unique().on(table.faculty_id, table.subject_name, table.department_id)
  };
});

// Define explicit relations between tables
export const departmentsRelations = relations(departments, ({ many }) => ({
  users: many(users),
  content: many(content),
  subjects: many(subjects),
  subjectAssignments: many(subjectFacultyAssignments)
}));

// Subject relations
export const subjectsRelations = relations(subjects, ({ one }) => ({
  department: one(departments, {
    fields: [subjects.department_id],
    references: [departments.id],
  }),
  creator: one(users, {
    fields: [subjects.created_by],
    references: [users.id],
  })
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  department: one(departments, {
    fields: [users.department_id],
    references: [departments.id],
  }),
  uploadedContent: many(content),
  subjectAssignments: many(subjectFacultyAssignments)
}));

export const contentRelations = relations(content, ({ one }) => ({
  department: one(departments, {
    fields: [content.dept_id],
    references: [departments.id],
  }),
  uploader: one(users, {
    fields: [content.uploaded_by],
    references: [users.id],
  })
}));

export const subjectFacultyAssignmentsRelations = relations(subjectFacultyAssignments, ({ one }) => ({
  faculty: one(users, {
    fields: [subjectFacultyAssignments.faculty_id],
    references: [users.id],
  }),
  department: one(departments, {
    fields: [subjectFacultyAssignments.department_id],
    references: [departments.id],
  }),
  admin: one(users, {
    fields: [subjectFacultyAssignments.assigned_by],
    references: [users.id],
  })
}));

// Department schemas
export const insertDepartmentSchema = createInsertSchema(departments).pick({
  name: true,
  description: true,
});

export const updateUserDepartmentSchema = z.object({
  department_id: z.number().nullable(),
});

// User schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  role: true,
  role_id: true,
  verification_pending: true,
  first_name: true,
  last_name: true,
}).extend({
  department_id: z.number().optional().nullable(),
  verified_at: z.date().optional(),
  is_active: z.boolean().optional().default(true),
});

export const loginUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
});

// Schema for verification logs
export const insertVerificationLogSchema = createInsertSchema(verificationLogs).pick({
  user_id: true,
  status: true,
  message: true,
});

// Schema for audit logs
export const insertAuditLogSchema = createInsertSchema(auditLogs).pick({
  action: true,
  user_id: true,
  performed_by: true,
}).extend({
  details: z.record(z.any()).optional(),
  affected_user_id: z.number().optional(),
  ip_address: z.string().optional()
});

// Schema for faculty content permissions
export const insertFacultyContentPermissionSchema = createInsertSchema(facultyContentPermissions).pick({
  faculty_id: true,
  status: true,
  reason: true,
}).extend({
  review_notes: z.string().optional(),
  reviewed_by: z.number().optional(),
});

// Schema for content views
export const insertContentViewSchema = createInsertSchema(content_views).pick({
  content_id: true,
  user_id: true,
});

// Schema for content downloads
export const insertContentDownloadSchema = createInsertSchema(content_downloads).pick({
  content_id: true,
  user_id: true,
});

// Content schemas
export const insertContentSchema = createInsertSchema(content).pick({
  title: true,
  description: true,
  subject: true,
  faculty: true,
  type: true,
  filename: true,
  url: true,
  preview_url: true,
  uploaded_by: true,
  dept_id: true,
  tags: true
});

// Schema for updating content
export const updateContentSchema = createInsertSchema(content).pick({
  title: true,
  description: true,
  subject: true,
}).extend({
  preview_url: z.string().optional(),
  tags: z.array(z.string()).optional(),
  updated_at: z.date().optional(),
});

// Schema for subjects
export const insertSubjectSchema = createInsertSchema(subjects).pick({
  name: true,
  description: true,
  department_id: true,
  created_by: true,
}).extend({
  is_active: z.boolean().optional().default(true),
});

export const updateSubjectSchema = createInsertSchema(subjects).pick({
  name: true,
  description: true,
  department_id: true,
}).extend({
  is_active: z.boolean().optional(),
});

// Type definitions
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type UpdateUserDepartment = z.infer<typeof updateUserDepartmentSchema>;
export type Department = typeof departments.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertVerificationLog = z.infer<typeof insertVerificationLogSchema>;
export type VerificationLog = typeof verificationLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertFacultyContentPermission = z.infer<typeof insertFacultyContentPermissionSchema>;
export type FacultyContentPermission = typeof facultyContentPermissions.$inferSelect;
export type InsertContentView = z.infer<typeof insertContentViewSchema>;
export type ContentView = typeof content_views.$inferSelect;
export type InsertContentDownload = z.infer<typeof insertContentDownloadSchema>;
export type ContentDownload = typeof content_downloads.$inferSelect;
export type InsertContent = z.infer<typeof insertContentSchema>;
export type UpdateContent = z.infer<typeof updateContentSchema>;
export type Content = typeof content.$inferSelect;
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type UpdateSubject = z.infer<typeof updateSubjectSchema>;
export type Subject = typeof subjects.$inferSelect;

// Type for user with department
export type UserWithDepartment = User & {
  department?: Department | null;
};

// Type for content with related data
export type ContentWithRelations = Content & {
  department?: Department;
  uploader?: User;
};

// Type for subject with relations
export type SubjectWithRelations = Subject & {
  department?: Department;
  creator?: User;
};

// Schema for subject-faculty assignments
export const insertSubjectFacultyAssignmentSchema = createInsertSchema(subjectFacultyAssignments).pick({
  faculty_id: true,
  subject_name: true,
  department_id: true,
  assigned_by: true,
}).extend({
  is_active: z.boolean().optional().default(true),
});

export type InsertSubjectFacultyAssignment = z.infer<typeof insertSubjectFacultyAssignmentSchema>;
export type SubjectFacultyAssignment = typeof subjectFacultyAssignments.$inferSelect;

// Type for subject-faculty assignment with relations
export type SubjectFacultyAssignmentWithRelations = SubjectFacultyAssignment & {
  faculty?: User;
  department?: Department;
  admin?: User;
};

// Interactive Learning Module Tables

// Engagement Tracking tables
export const userEngagement = pgTable("user_engagement", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id),
  count: integer("count").notNull().default(0),
  stars_earned: integer("stars_earned").notNull().default(0),
  previous_week_count: integer("previous_week_count").notNull().default(0),
  last_updated: timestamp("last_updated").notNull().defaultNow(),
  created_at: timestamp("created_at").notNull().defaultNow()
});

// Engagement History table - tracks individual interaction events
export const engagementHistory = pgTable("engagement_history", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id),
  interaction_type: text("interaction_type").notNull(), // 'quiz', 'forum_post', 'poll_vote'
  content_id: integer("content_id"),
  created_at: timestamp("created_at").notNull().defaultNow()
});

// Quizzes table for storing adaptive quiz content
export const il_quizzes = pgTable("il_quizzes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  content_id: integer("content_id").references(() => content.id), // Link to CM content (PDF, etc.)
  subject: text("subject").notNull(),
  difficulty: text("difficulty").notNull().default("Medium"), // Easy, Medium, Hard
  created_by: integer("created_by").notNull().references(() => users.id), // Faculty who created
  questions: jsonb("questions").notNull(), // Array of question objects
  is_published: boolean("is_published").notNull().default(false), // Is the quiz visible to students
  is_enabled: boolean("is_enabled").notNull().default(false), // Is the quiz functionality turned on
  is_adaptive: boolean("is_adaptive").notNull().default(true), // Should the quiz adapt difficulty based on performance
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
  is_active: boolean("is_active").notNull().default(true),
  department_id: integer("department_id").references(() => departments.id)
});

// Quiz attempts by students
export const il_quiz_attempts = pgTable("il_quiz_attempts", {
  id: serial("id").primaryKey(),
  quiz_id: integer("quiz_id").notNull().references(() => il_quizzes.id),
  student_id: integer("student_id").notNull().references(() => users.id),
  score: doublePrecision("score").notNull(), // Percentage score
  answers: jsonb("answers").notNull(), // Student's answers
  time_taken: integer("time_taken"), // Time in seconds
  completed_at: timestamp("completed_at").notNull().defaultNow(),
  difficulty_level: text("difficulty_level").notNull() // The difficulty level of the quiz when taken
});

// Quiz relations defined later in the file

// Discussion Forum Posts
export const il_forum_posts = pgTable("il_forum_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  user_id: integer("user_id").notNull().references(() => users.id),
  subject: text("subject").notNull(),
  tags: text("tags").array(), // Tags to link to CM content
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
  is_pinned: boolean("is_pinned").default(false),
  pinned_by: integer("pinned_by").references(() => users.id),
  content_id: integer("content_id").references(() => content.id), // Optional link to CM content
  department_id: integer("department_id").references(() => departments.id),
  is_active: boolean("is_active").notNull().default(true)
});

// Forum Replies
export const il_forum_replies = pgTable("il_forum_replies", {
  id: serial("id").primaryKey(),
  post_id: integer("post_id").notNull().references(() => il_forum_posts.id),
  content: text("content").notNull(),
  user_id: integer("user_id").notNull().references(() => users.id),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
  is_active: boolean("is_active").notNull().default(true)
});

// Forum Insights for faculty
export const il_forum_insights = pgTable("il_forum_insights", {
  id: serial("id").primaryKey(),
  subject_faculty: text("subject_faculty").notNull(),
  insight_text: text("insight_text").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
  is_read: boolean("is_read").notNull().default(false)
});

// Polls
export const il_polls = pgTable("il_polls", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  question: text("question").notNull(),
  options: jsonb("options").notNull(), // Array of option objects
  created_by: integer("created_by").notNull().references(() => users.id), // Faculty who created
  subject: text("subject").notNull(),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
  expires_at: timestamp("expires_at"), // Optional expiration time
  department_id: integer("department_id").references(() => departments.id),
  tags: text("tags").array(), // Auto-generated tags for polls
  timer_duration: integer("timer_duration").notNull().default(30), // Duration in seconds
  content_id: integer("content_id").references(() => content.id) // Optional link to related content
});

// Poll votes
export const il_poll_votes = pgTable("il_poll_votes", {
  id: serial("id").primaryKey(),
  poll_id: integer("poll_id").notNull().references(() => il_polls.id),
  user_id: integer("user_id").notNull().references(() => users.id),
  option_index: integer("option_index").notNull(), // Index of the selected option
  voted_at: timestamp("voted_at").notNull().defaultNow()
});

// Shared Notes
export const il_shared_notes = pgTable("il_shared_notes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  created_by: integer("created_by").notNull().references(() => users.id),
  subject: text("subject").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
  is_active: boolean("is_active").notNull().default(true),
  is_active_session: boolean("is_active_session").notNull().default(false), // Whether this is currently active for collaboration
  ends_at: timestamp("ends_at"), // When the session is scheduled to end
  department_id: integer("department_id").references(() => departments.id),
  content_id: integer("content_id").references(() => content.id) // Optional link to CM content
});

// Shared Note Contributions
export const il_note_contributions = pgTable("il_note_contributions", {
  id: serial("id").primaryKey(),
  note_id: integer("note_id").notNull().references(() => il_shared_notes.id),
  user_id: integer("user_id").notNull().references(() => users.id),
  content: text("content").notNull(), // The text content contributed
  content_type: varchar("content_type", { length: 10 }).notNull().default("text"), // 'text' or 'sketch'
  sketch_data: text("sketch_data"), // Base64 encoded image data for sketches
  tags: text("tags").array(), // Array of auto-generated tags
  ai_processed: boolean("ai_processed").notNull().default(false), // Whether AI has processed this contribution
  contributed_at: timestamp("contributed_at").notNull().defaultNow()
});

// User Interactions Tracker
export const il_user_interactions = pgTable("il_user_interactions", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id),
  interaction_type: text("interaction_type").notNull(), // quiz, forum_post, forum_reply, poll_vote, note
  interaction_id: integer("interaction_id").notNull(), // ID of the related entity
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  interaction_details: jsonb("interaction_details") // Additional details
});

// AI Tips
export const il_ai_tips = pgTable("il_ai_tips", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id),
  content: text("content").notNull(), // The tip content
  type: text("type").notNull(), // quiz, forum, poll, engagement, etc.
  is_read: boolean("is_read").notNull().default(false),
  is_helpful: boolean("is_helpful"), // User feedback on tip helpfulness
  created_at: timestamp("created_at").notNull().defaultNow(),
  expires_at: timestamp("expires_at"), // Optional expiration for time-sensitive tips
  source_id: integer("source_id"), // Quiz ID, Forum ID, Poll ID, etc.
  source_type: text("source_type"), // Specific type of source (quiz_attempt, forum_post, poll_vote)
  relevance_score: doublePrecision("relevance_score").default(0.7), // How relevant this tip is (0-1)
  action_link: text("action_link"), // Link to take action on this tip
  context: text("context"), // Additional context for the tip
  priority: integer("priority").default(1), // Priority level (1-5)
  ui_style: text("ui_style").default('standard') // UI styling for the tip card
});

// Defining relations for Interactive Learning tables
export const ilQuizzesRelations = relations(il_quizzes, ({ one, many }) => ({
  creator: one(users, {
    fields: [il_quizzes.created_by],
    references: [users.id],
  }),
  content: one(content, {
    fields: [il_quizzes.content_id],
    references: [content.id],
  }),
  department: one(departments, {
    fields: [il_quizzes.department_id],
    references: [departments.id],
  }),
  attempts: many(il_quiz_attempts)
}));

export const ilQuizAttemptsRelations = relations(il_quiz_attempts, ({ one }) => ({
  quiz: one(il_quizzes, {
    fields: [il_quiz_attempts.quiz_id],
    references: [il_quizzes.id],
  }),
  student: one(users, {
    fields: [il_quiz_attempts.student_id],
    references: [users.id],
  })
}));

export const ilForumPostsRelations = relations(il_forum_posts, ({ one, many }) => ({
  author: one(users, {
    fields: [il_forum_posts.user_id],
    references: [users.id],
  }),
  pinner: one(users, {
    fields: [il_forum_posts.pinned_by],
    references: [users.id],
  }),
  content: one(content, {
    fields: [il_forum_posts.content_id],
    references: [content.id],
  }),
  department: one(departments, {
    fields: [il_forum_posts.department_id],
    references: [departments.id],
  }),
  replies: many(il_forum_replies)
}));

export const ilForumRepliesRelations = relations(il_forum_replies, ({ one }) => ({
  post: one(il_forum_posts, {
    fields: [il_forum_replies.post_id],
    references: [il_forum_posts.id],
  }),
  author: one(users, {
    fields: [il_forum_replies.user_id],
    references: [users.id],
  })
}));

export const ilPollsRelations = relations(il_polls, ({ one, many }) => ({
  creator: one(users, {
    fields: [il_polls.created_by],
    references: [users.id],
  }),
  department: one(departments, {
    fields: [il_polls.department_id],
    references: [departments.id],
  }),
  votes: many(il_poll_votes)
}));

export const ilPollVotesRelations = relations(il_poll_votes, ({ one }) => ({
  poll: one(il_polls, {
    fields: [il_poll_votes.poll_id],
    references: [il_polls.id],
  }),
  voter: one(users, {
    fields: [il_poll_votes.user_id],
    references: [users.id],
  })
}));

export const ilSharedNotesRelations = relations(il_shared_notes, ({ one, many }) => ({
  creator: one(users, {
    fields: [il_shared_notes.created_by],
    references: [users.id],
  }),
  department: one(departments, {
    fields: [il_shared_notes.department_id],
    references: [departments.id],
  }),
  content: one(content, {
    fields: [il_shared_notes.content_id],
    references: [content.id],
  }),
  contributions: many(il_note_contributions)
}));

export const ilNoteContributionsRelations = relations(il_note_contributions, ({ one }) => ({
  note: one(il_shared_notes, {
    fields: [il_note_contributions.note_id],
    references: [il_shared_notes.id],
  }),
  contributor: one(users, {
    fields: [il_note_contributions.user_id],
    references: [users.id],
  })
}));

export const ilUserInteractionsRelations = relations(il_user_interactions, ({ one }) => ({
  user: one(users, {
    fields: [il_user_interactions.user_id],
    references: [users.id],
  })
}));

export const ilAiTipsRelations = relations(il_ai_tips, ({ one }) => ({
  user: one(users, {
    fields: [il_ai_tips.user_id],
    references: [users.id],
  })
}));

// Relations for engagement tracking tables
export const userEngagementRelations = relations(userEngagement, ({ one }) => ({
  user: one(users, {
    fields: [userEngagement.user_id],
    references: [users.id],
  })
}));

export const engagementHistoryRelations = relations(engagementHistory, ({ one }) => ({
  user: one(users, {
    fields: [engagementHistory.user_id],
    references: [users.id],
  })
}));

// Schemas for Interactive Learning tables
export const insertIlQuizSchema = createInsertSchema(il_quizzes).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertIlQuizAttemptSchema = createInsertSchema(il_quiz_attempts).omit({
  id: true,
  completed_at: true,
});

export const insertIlForumPostSchema = createInsertSchema(il_forum_posts).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertIlForumReplySchema = createInsertSchema(il_forum_replies).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertIlPollSchema = createInsertSchema(il_polls).omit({
  id: true,
  created_at: true,
});

export const insertIlPollVoteSchema = createInsertSchema(il_poll_votes).omit({
  id: true,
  voted_at: true,
});

export const insertIlSharedNoteSchema = createInsertSchema(il_shared_notes).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertIlNoteContributionSchema = createInsertSchema(il_note_contributions).omit({
  id: true,
  contributed_at: true,
});

export const insertIlUserInteractionSchema = createInsertSchema(il_user_interactions).omit({
  id: true,
  timestamp: true,
});

export const insertIlAiTipSchema = createInsertSchema(il_ai_tips).omit({
  id: true,
  created_at: true,
});

export const insertIlForumInsightSchema = createInsertSchema(il_forum_insights).omit({
  id: true,
  created_at: true,
});

// Schemas for engagement tracking
export const insertUserEngagementSchema = createInsertSchema(userEngagement).omit({
  id: true,
  created_at: true,
  last_updated: true,
});

export const insertEngagementHistorySchema = createInsertSchema(engagementHistory).omit({
  id: true,
  created_at: true,
});

// Types for Interactive Learning tables
export type IlQuiz = typeof il_quizzes.$inferSelect;
export type InsertIlQuiz = z.infer<typeof insertIlQuizSchema>;

export type IlQuizAttempt = typeof il_quiz_attempts.$inferSelect;
export type InsertIlQuizAttempt = z.infer<typeof insertIlQuizAttemptSchema>;

export type IlForumPost = typeof il_forum_posts.$inferSelect;
export type InsertIlForumPost = z.infer<typeof insertIlForumPostSchema>;

export type IlForumReply = typeof il_forum_replies.$inferSelect;
export type InsertIlForumReply = z.infer<typeof insertIlForumReplySchema>;

export type IlPoll = typeof il_polls.$inferSelect;
export type InsertIlPoll = z.infer<typeof insertIlPollSchema>;

export type IlPollVote = typeof il_poll_votes.$inferSelect;
export type InsertIlPollVote = z.infer<typeof insertIlPollVoteSchema>;

export type IlSharedNote = typeof il_shared_notes.$inferSelect;
export type InsertIlSharedNote = z.infer<typeof insertIlSharedNoteSchema>;

export type IlNoteContribution = typeof il_note_contributions.$inferSelect;
export type InsertIlNoteContribution = z.infer<typeof insertIlNoteContributionSchema>;

export type IlUserInteraction = typeof il_user_interactions.$inferSelect;
export type InsertIlUserInteraction = z.infer<typeof insertIlUserInteractionSchema>;

export type IlAiTip = typeof il_ai_tips.$inferSelect;
export type InsertIlAiTip = z.infer<typeof insertIlAiTipSchema>;

export type IlForumInsight = typeof il_forum_insights.$inferSelect;
export type InsertIlForumInsight = z.infer<typeof insertIlForumInsightSchema>;

// Types for engagement tracking
export type UserEngagement = typeof userEngagement.$inferSelect;
export type InsertUserEngagement = z.infer<typeof insertUserEngagementSchema>;

export type EngagementHistory = typeof engagementHistory.$inferSelect;
export type InsertEngagementHistory = z.infer<typeof insertEngagementHistorySchema>;

// Types with relations
export type IlQuizWithRelations = IlQuiz & {
  creator?: User;
  content?: Content;
  department?: Department;
  attempts?: IlQuizAttempt[];
};

export type IlForumPostWithRelations = IlForumPost & {
  author?: User;
  pinner?: User;
  content?: Content;
  department?: Department;
  replies?: IlForumReply[];
};

export type IlForumReplyWithRelations = IlForumReply & {
  post?: IlForumPost;
  author?: User;
};

export type IlPollWithRelations = IlPoll & {
  creator?: User;
  department?: Department;
  votes?: IlPollVote[];
};

export type IlSharedNoteWithRelations = IlSharedNote & {
  creator?: User;
  department?: Department;
  content?: Content;
  contributions?: IlNoteContribution[];
};