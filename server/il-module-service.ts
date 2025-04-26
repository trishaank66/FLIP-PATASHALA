import { db } from "./db";
import {
  il_quizzes, il_quiz_attempts, il_forum_posts, il_forum_replies,
  il_polls, il_poll_votes, il_shared_notes, il_note_contributions,
  il_user_interactions, il_ai_tips,
  IlQuizWithRelations, IlForumPostWithRelations, IlPollWithRelations,
  IlSharedNoteWithRelations, IlForumReplyWithRelations, users
} from "@shared/schema";
import { eq, and, desc, sql, asc, isNull, or } from "drizzle-orm";
import { 
  generateTipsForUser, 
  generateClassInsights, 
  generateSystemOverview 
} from "./ai-service";

class InteractiveLearningService {
  // Quiz methods
  async getQuizzesByDepartment(departmentId: number): Promise<IlQuizWithRelations[]> {
    return db.query.il_quizzes.findMany({
      where: and(
        eq(il_quizzes.department_id, departmentId),
        eq(il_quizzes.is_active, true)
      ),
      with: {
        creator: true,
        content: true,
        department: true
      },
      orderBy: [desc(il_quizzes.created_at)]
    });
  }

  async getQuizById(quizId: number): Promise<IlQuizWithRelations | undefined> {
    const quizzes = await db.query.il_quizzes.findMany({
      where: and(
        eq(il_quizzes.id, quizId),
        eq(il_quizzes.is_active, true)
      ),
      with: {
        creator: true,
        content: true,
        department: true,
        attempts: true
      },
      limit: 1
    });
    return quizzes.length > 0 ? quizzes[0] : undefined;
  }

  async createQuizAttempt(quizId: number, studentId: number, score: number, answers: any, difficultyLevel: string, timeTaken?: number) {
    return db.insert(il_quiz_attempts).values({
      quiz_id: quizId,
      student_id: studentId,
      score,
      answers,
      difficulty_level: difficultyLevel,
      time_taken: timeTaken
    }).returning();
  }

  // Forum methods
  async getForumPostsByDepartment(departmentId: number): Promise<IlForumPostWithRelations[]> {
    return db.query.il_forum_posts.findMany({
      where: and(
        eq(il_forum_posts.department_id, departmentId),
        eq(il_forum_posts.is_active, true)
      ),
      with: {
        author: true,
        pinner: true,
        content: true,
        department: true,
        replies: {
          where: eq(il_forum_replies.is_active, true),
          with: {
            author: true
          }
        }
      },
      orderBy: [
        desc(il_forum_posts.is_pinned),
        desc(il_forum_posts.created_at)
      ]
    });
  }

  async getForumPostById(postId: number): Promise<IlForumPostWithRelations | undefined> {
    const posts = await db.query.il_forum_posts.findMany({
      where: and(
        eq(il_forum_posts.id, postId),
        eq(il_forum_posts.is_active, true)
      ),
      with: {
        author: true,
        pinner: true,
        content: true,
        department: true,
        replies: {
          where: eq(il_forum_replies.is_active, true),
          with: {
            author: true
          }
        }
      },
      limit: 1
    });
    return posts.length > 0 ? posts[0] : undefined;
  }

  async addForumReply(postId: number, userId: number, content: string): Promise<IlForumReplyWithRelations> {
    const [newReply] = await db.insert(il_forum_replies).values({
      post_id: postId,
      user_id: userId,
      content
    }).returning();

    // Track user interaction
    await this.trackUserInteraction(userId, 'forum_reply', newReply.id);

    // Get the complete reply with relations
    const replies = await db.query.il_forum_replies.findMany({
      where: eq(il_forum_replies.id, newReply.id),
      with: {
        author: true,
        post: true
      },
      limit: 1
    });
    
    return replies[0];
  }

  // Poll methods
  async getPollsByDepartment(departmentId: number): Promise<IlPollWithRelations[]> {
    return db.query.il_polls.findMany({
      where: and(
        eq(il_polls.department_id, departmentId),
        eq(il_polls.is_active, true)
      ),
      with: {
        creator: true,
        department: true,
        votes: true
      },
      orderBy: [desc(il_polls.created_at)]
    });
  }

  async voteOnPoll(pollId: number, userId: number, optionIndex: number) {
    // First check if the user has already voted
    const existingVotes = await db.select().from(il_poll_votes)
      .where(and(
        eq(il_poll_votes.poll_id, pollId),
        eq(il_poll_votes.user_id, userId)
      ));
    
    if (existingVotes.length > 0) {
      // User already voted, update their vote
      return db.update(il_poll_votes)
        .set({ option_index: optionIndex, voted_at: new Date() })
        .where(and(
          eq(il_poll_votes.poll_id, pollId),
          eq(il_poll_votes.user_id, userId)
        ))
        .returning();
    } else {
      // New vote
      const [vote] = await db.insert(il_poll_votes).values({
        poll_id: pollId,
        user_id: userId,
        option_index: optionIndex
      }).returning();

      // Track interaction
      await this.trackUserInteraction(userId, 'poll_vote', vote.id);
      
      return [vote];
    }
  }

  // Shared Notes methods
  async getSharedNotesByDepartment(departmentId: number): Promise<IlSharedNoteWithRelations[]> {
    return db.query.il_shared_notes.findMany({
      where: and(
        eq(il_shared_notes.department_id, departmentId),
        eq(il_shared_notes.is_active, true)
      ),
      with: {
        creator: true,
        department: true,
        content: true,
        contributions: {
          with: {
            contributor: true
          }
        }
      },
      orderBy: [desc(il_shared_notes.updated_at)]
    });
  }

  async getSharedNoteById(noteId: number): Promise<IlSharedNoteWithRelations | undefined> {
    const notes = await db.query.il_shared_notes.findMany({
      where: and(
        eq(il_shared_notes.id, noteId),
        eq(il_shared_notes.is_active, true)
      ),
      with: {
        creator: true,
        department: true,
        content: true,
        contributions: {
          with: {
            contributor: true
          }
        }
      },
      limit: 1
    });
    return notes.length > 0 ? notes[0] : undefined;
  }

  async contributeToNote(noteId: number, userId: number, content: string) {
    const [contribution] = await db.insert(il_note_contributions).values({
      note_id: noteId,
      user_id: userId,
      content
    }).returning();

    // Update the note's updated_at timestamp
    await db.update(il_shared_notes)
      .set({ updated_at: new Date() })
      .where(eq(il_shared_notes.id, noteId));

    // Track user interaction
    await this.trackUserInteraction(userId, 'note_contribution', contribution.id);
    
    return contribution;
  }

  // Track user interactions for the analytics
  async trackUserInteraction(userId: number, interactionType: string, interactionId: number, details?: any) {
    return db.insert(il_user_interactions).values({
      user_id: userId,
      interaction_type: interactionType,
      interaction_id: interactionId,
      interaction_details: details
    }).returning();
  }

  // AI Tips
  async getAiTipsForUser(userId: number) {
    // Get unread tips that haven't expired
    return db.select().from(il_ai_tips)
      .where(and(
        eq(il_ai_tips.user_id, userId),
        eq(il_ai_tips.is_read, false),
        or(
          isNull(il_ai_tips.expires_at),
          sql`${il_ai_tips.expires_at} > NOW()`
        )
      ))
      .orderBy(desc(il_ai_tips.created_at));
  }

  async markAiTipAsRead(tipId: number, isHelpful?: boolean) {
    return db.update(il_ai_tips)
      .set({ 
        is_read: true,
        is_helpful: isHelpful
      })
      .where(eq(il_ai_tips.id, tipId))
      .returning();
  }
  
  /**
   * Generate and store personalized AI tips for a user
   * This calls the AI service to generate tips and stores them in the database
   */
  async generatePersonalizedTips(userId: number) {
    try {
      // Get user information to determine their role
      const userInfo = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });
      
      if (!userInfo) {
        throw new Error(`User with ID ${userId} not found`);
      }
      
      // Call the AI service to generate personalized tips
      const tipsResponse = await generateTipsForUser(userId, userInfo.role);
      
      if (!tipsResponse || !tipsResponse.tips || !Array.isArray(tipsResponse.tips)) {
        throw new Error('Invalid response from tip generator');
      }
      
      // Store the generated tips in the database
      const insertPromises = tipsResponse.tips.map(async (tip: any) => {
        // Calculate expiration date (7 days from now for transient tips)
        const expiresAt = tip.type.includes('temporary') ? 
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null;
        
        return db.insert(il_ai_tips).values({
          user_id: userId,
          content: tip.content,
          tip_type: tip.type,
          priority: tip.priority,
          relevance_score: tip.relevance_score,
          expires_at: expiresAt,
          action_link: tip.action_link || null,
          context: tip.context || null,
          ui_style: tip.ui_style || 'standard',
          source_type: 'ai_generated',
          is_read: false,
          is_helpful: null
        }).returning();
      });
      
      const results = await Promise.all(insertPromises);
      return results.flat();
    } catch (error) {
      console.error('Error generating personalized tips:', error);
      return [];
    }
  }
  
  /**
   * Generate class insights for faculty members
   */
  async generateClassInsights(facultyId: number, departmentId?: number, subject?: string) {
    try {
      const insights = await generateClassInsights(facultyId, departmentId, subject);
      return insights;
    } catch (error) {
      console.error('Error generating class insights:', error);
      return null;
    }
  }
  
  /**
   * Generate system-wide insights for administrators
   */
  async generateSystemOverview() {
    try {
      const overview = await generateSystemOverview();
      return overview;
    } catch (error) {
      console.error('Error generating system overview:', error);
      return null;
    }
  }
}

export const ilService = new InteractiveLearningService();