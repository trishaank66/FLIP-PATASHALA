import { db } from './db';
import { 
  il_forum_posts, 
  il_forum_replies, 
  il_forum_insights,
  users,
  type IlForumPost,
  type IlForumReply,
  type IlForumInsight
} from '@shared/schema';
import { eq, and, desc, isNull, gte, asc } from 'drizzle-orm';
import { ForumNLPService } from './forum-nlp-service';

interface CreatePostParams {
  subject_faculty: string;
  title: string;
  content_text: string;
  user_id: number;
  department_id?: number;
  content_id?: number;
}

interface CreateReplyParams {
  post_id: number;
  content_text: string;
  user_id: number;
}

export class ForumService {
  /**
   * Create a new forum post with automatically generated tags
   */
  static async createPost(data: CreatePostParams): Promise<IlForumPost> {
    try {
      // Generate tags using spaCy via our Python service
      const tags = await ForumNLPService.generateTags(data.content_text);
      
      // Insert the post into the database
      const [post] = await db.insert(il_forum_posts)
        .values({
          title: data.title,
          content: data.content_text,
          user_id: data.user_id,
          subject: data.subject_faculty,
          tags,
          department_id: data.department_id,
          content_id: data.content_id,
          is_active: true
        })
        .returning();
      
      // Generate new insights periodically
      const shouldGenerateInsight = await this.shouldGenerateNewInsight(data.subject_faculty);
      if (shouldGenerateInsight) {
        await this.generateNewInsight(data.subject_faculty);
      }
      
      return post;
    } catch (error) {
      console.error('Error creating forum post:', error);
      throw new Error('Failed to create forum post');
    }
  }
  
  /**
   * Create a reply to a forum post
   */
  static async createReply(data: CreateReplyParams): Promise<IlForumReply> {
    try {
      // Insert the reply into the database
      const [reply] = await db.insert(il_forum_replies)
        .values({
          post_id: data.post_id,
          content: data.content_text,
          user_id: data.user_id,
          is_active: true
        })
        .returning();
      
      // Get the post to check subject
      const [post] = await db.select()
        .from(il_forum_posts)
        .where(eq(il_forum_posts.id, data.post_id));
      
      if (post) {
        // Check if we should generate a new insight
        const shouldGenerateInsight = await this.shouldGenerateNewInsight(post.subject);
        if (shouldGenerateInsight) {
          await this.generateNewInsight(post.subject);
        }
      }
      
      return reply;
    } catch (error) {
      console.error('Error creating forum reply:', error);
      throw new Error('Failed to create forum reply');
    }
  }
  
  /**
   * Toggle the pinned status of a post (faculty only)
   */
  static async togglePinStatus(postId: number, facultyId: number): Promise<IlForumPost> {
    try {
      // Get the current post
      const [post] = await db.select()
        .from(il_forum_posts)
        .where(eq(il_forum_posts.id, postId));
      
      if (!post) {
        throw new Error('Post not found');
      }
      
      // Update the pin status
      const [updatedPost] = await db.update(il_forum_posts)
        .set({ 
          is_pinned: !post.is_pinned,
          pinned_by: !post.is_pinned ? facultyId : null 
        })
        .where(eq(il_forum_posts.id, postId))
        .returning();
      
      return updatedPost;
    } catch (error) {
      console.error('Error toggling pin status:', error);
      throw new Error('Failed to toggle pin status');
    }
  }
  
  /**
   * Get all posts for a specific subject
   */
  static async getPostsForSubject(subject: string): Promise<any[]> {
    try {
      // Get top-level posts first (no parent_id)
      const posts = await db.select({
        post: il_forum_posts,
        user: users
      })
        .from(il_forum_posts)
        .innerJoin(users, eq(il_forum_posts.user_id, users.id))
        .where(and(
          eq(il_forum_posts.subject, subject),
          eq(il_forum_posts.is_active, true)
        ))
        .orderBy(desc(il_forum_posts.is_pinned), desc(il_forum_posts.created_at));
      
      // Format posts for consistency
      const formattedPosts = await Promise.all(posts.map(async item => {
        // Get replies for each post
        const replies = await db.select({
          reply: il_forum_replies,
          user: users
        })
          .from(il_forum_replies)
          .innerJoin(users, eq(il_forum_replies.user_id, users.id))
          .where(and(
            eq(il_forum_replies.post_id, item.post.id),
            eq(il_forum_replies.is_active, true)
          ))
          .orderBy(asc(il_forum_replies.created_at));
        
        // Format the replies
        const formattedReplies = replies.map(r => ({
          id: r.reply.id,
          post_id: r.reply.post_id,
          content: r.reply.content,
          user_id: r.reply.user_id,
          user_name: `${r.user.first_name} ${r.user.last_name}`,
          created_at: r.reply.created_at,
          updated_at: r.reply.updated_at
        }));
        
        // Format the post with user info and replies
        return {
          id: item.post.id,
          title: item.post.title,
          content: item.post.content,
          user_id: item.post.user_id,
          user_name: `${item.user.first_name} ${item.user.last_name}`,
          subject: item.post.subject,
          tags: item.post.tags || [],
          created_at: item.post.created_at,
          updated_at: item.post.updated_at,
          is_pinned: item.post.is_pinned || false,
          pinned_by: item.post.pinned_by,
          content_id: item.post.content_id,
          department_id: item.post.department_id,
          replies: formattedReplies
        };
      }));
      
      return formattedPosts;
    } catch (error) {
      console.error('Error getting forum posts:', error);
      throw new Error('Failed to get forum posts');
    }
  }
  
  /**
   * Check if we should generate a new insight
   */
  private static async shouldGenerateNewInsight(subject: string): Promise<boolean> {
    try {
      // Get the most recent insight
      const [latestInsight] = await db.select()
        .from(il_forum_insights)
        .where(eq(il_forum_insights.subject_faculty, subject))
        .orderBy(desc(il_forum_insights.created_at))
        .limit(1);
      
      // If no insight exists or the latest one is older than 1 hour, generate a new one
      if (!latestInsight) return true;
      
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      
      return latestInsight.created_at < oneHourAgo;
    } catch (error) {
      console.error('Error checking insight generation:', error);
      return false;
    }
  }
  
  /**
   * Generate a new insight using NLTK via our Python service
   */
  private static async generateNewInsight(subject: string): Promise<void> {
    try {
      // Get recent post texts (last 24 hours)
      const recentPosts = await db.select({ content: il_forum_posts.content })
        .from(il_forum_posts)
        .where(and(
          eq(il_forum_posts.subject, subject),
          eq(il_forum_posts.is_active, true),
          gte(il_forum_posts.created_at, new Date(Date.now() - 24 * 60 * 60 * 1000))
        ))
        .orderBy(desc(il_forum_posts.created_at))
        .limit(50);
      
      // Get recent replies too
      const recentReplies = await db.select({ 
        content: il_forum_replies.content,
        post: il_forum_posts
      })
        .from(il_forum_replies)
        .innerJoin(il_forum_posts, eq(il_forum_replies.post_id, il_forum_posts.id))
        .where(and(
          eq(il_forum_posts.subject, subject),
          eq(il_forum_replies.is_active, true),
          gte(il_forum_replies.created_at, new Date(Date.now() - 24 * 60 * 60 * 1000))
        ))
        .orderBy(desc(il_forum_replies.created_at))
        .limit(50);
      
      // Combine post and reply texts
      const allTexts = [
        ...recentPosts.map(p => p.content),
        ...recentReplies.map(r => r.content)
      ];
      
      if (allTexts.length === 0) return;
      
      // Generate insight
      const insightText = await ForumNLPService.generateInsight(allTexts);
      
      // Save the insight
      await db.insert(il_forum_insights)
        .values({
          subject_faculty: subject,
          insight_text: insightText,
          is_read: false
        });
    } catch (error) {
      console.error('Error generating insight:', error);
    }
  }
  
  /**
   * Get insights for a specific subject
   */
  static async getInsightsForSubject(subject: string): Promise<IlForumInsight[]> {
    try {
      const insights = await db.select()
        .from(il_forum_insights)
        .where(eq(il_forum_insights.subject_faculty, subject))
        .orderBy(desc(il_forum_insights.created_at))
        .limit(5);
      
      return insights;
    } catch (error) {
      console.error('Error getting insights:', error);
      throw new Error('Failed to get insights');
    }
  }
  
  /**
   * Mark an insight as read
   */
  static async markInsightAsRead(insightId: number): Promise<IlForumInsight> {
    try {
      const [updatedInsight] = await db.update(il_forum_insights)
        .set({ is_read: true })
        .where(eq(il_forum_insights.id, insightId))
        .returning();
      
      return updatedInsight;
    } catch (error) {
      console.error('Error marking insight as read:', error);
      throw new Error('Failed to mark insight as read');
    }
  }
}