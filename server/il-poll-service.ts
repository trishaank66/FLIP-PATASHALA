import { db } from './db';
import { 
  il_polls, 
  il_poll_votes,
  users,
  content,
  type IlPoll,
  type IlPollVote,
  type User,
  type IlPollWithRelations
} from '@shared/schema';
import { eq, and, desc, isNull, gte, count, lt, or, sql } from 'drizzle-orm';
import { PollNLPService } from './poll-nlp-service';
import { WebSocketManager } from './websocket-manager';

interface CreatePollParams {
  title: string;
  question: string;
  options: string[];
  created_by: number;
  subject: string;
  department_id?: number;
  content_id?: number;
  timer_duration?: number;
}

interface PollResults {
  poll: IlPollWithRelations;
  votes: { [key: string]: number };
  total: number;
  percentages: { [key: string]: number };
}

/**
 * Service for managing interactive learning polls
 */
export class PollService {
  /**
   * Create a new poll with automatic tagging and expiration timer
   */
  static async createPoll(data: CreatePollParams): Promise<IlPoll> {
    try {
      // Generate tags using spaCy via our Python service
      const tags = await PollNLPService.generateTags(data.question);
      
      // Format options as an array of option objects
      const formattedOptions = data.options.map((option, index) => ({
        id: index,
        text: option
      }));
      
      // Calculate expiration time (default: 30 seconds)
      const timerDuration = data.timer_duration || 30;
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + timerDuration);
      
      // Insert the poll into the database
      const [poll] = await db.insert(il_polls)
        .values({
          title: data.title,
          question: data.question,
          options: formattedOptions,
          created_by: data.created_by,
          subject: data.subject,
          department_id: data.department_id,
          content_id: data.content_id,
          tags,
          timer_duration: timerDuration,
          expires_at: expiresAt,
          is_active: true
        })
        .returning();
      
      // Schedule automatic closure of poll
      setTimeout(async () => {
        await this.closePoll(poll.id);
      }, timerDuration * 1000);
      
      // Notify subscribers about the new poll via WebSocket
      const pollWithRelations = await this.getPollById(poll.id);
      WebSocketManager.broadcast('poll:created', {
        poll: pollWithRelations,
        departmentId: data.department_id,
        subject: data.subject
      });
      
      return poll;
    } catch (error) {
      console.error('Error creating poll:', error);
      throw new Error('Failed to create poll');
    }
  }
  
  /**
   * Record a vote on a poll
   */
  static async voteOnPoll(pollId: number, userId: number, optionIndex: number): Promise<IlPollVote> {
    try {
      // Check if poll is still active
      const poll = await this.getPollById(pollId);
      
      if (!poll || !poll.is_active) {
        throw new Error('Poll is no longer active');
      }
      
      // Check if the option index is valid
      if (optionIndex < 0 || optionIndex >= poll.options.length) {
        throw new Error('Invalid option index');
      }
      
      // Check if user has already voted
      const existingVote = await db.select()
        .from(il_poll_votes)
        .where(and(
          eq(il_poll_votes.poll_id, pollId),
          eq(il_poll_votes.user_id, userId)
        ))
        .limit(1);
      
      if (existingVote.length > 0) {
        throw new Error('User has already voted on this poll');
      }
      
      // Record the vote
      const [vote] = await db.insert(il_poll_votes)
        .values({
          poll_id: pollId,
          user_id: userId,
          option_index: optionIndex
        })
        .returning();
      
      // Get updated results and broadcast them
      const results = await this.getPollResults(pollId);
      WebSocketManager.broadcast('poll:vote', {
        pollId,
        results,
        departmentId: poll.department_id
      });
      
      return vote;
    } catch (error) {
      console.error('Error voting on poll:', error);
      throw error;
    }
  }
  
  /**
   * Get a poll by ID with related data
   */
  static async getPollById(pollId: number): Promise<IlPollWithRelations | null> {
    try {
      const poll = await db.query.il_polls.findFirst({
        where: eq(il_polls.id, pollId),
        with: {
          creator: true,
          department: true
        }
      });
      
      return poll;
    } catch (error) {
      console.error('Error getting poll:', error);
      throw new Error('Failed to get poll');
    }
  }
  
  /**
   * Get active polls for a subject
   */
  static async getActivePolls(subject: string): Promise<IlPollWithRelations[]> {
    try {
      // Get polls that are active and not expired
      const now = new Date();
      
      const polls = await db.query.il_polls.findMany({
        where: and(
          eq(il_polls.subject, subject),
          eq(il_polls.is_active, true),
          or(
            isNull(il_polls.expires_at),
            gte(il_polls.expires_at, now)
          )
        ),
        with: {
          creator: true,
          department: true
        },
        orderBy: [desc(il_polls.created_at)]
      });
      
      return polls;
    } catch (error) {
      console.error('Error getting active polls:', error);
      throw new Error('Failed to get active polls');
    }
  }
  
  /**
   * Get polls by department
   */
  static async getPollsByDepartment(departmentId: number): Promise<IlPollWithRelations[]> {
    try {
      const polls = await db.query.il_polls.findMany({
        where: eq(il_polls.department_id, departmentId),
        with: {
          creator: true,
          department: true
        },
        orderBy: [desc(il_polls.created_at)]
      });
      
      return polls;
    } catch (error) {
      console.error('Error getting polls by department:', error);
      throw new Error('Failed to get polls by department');
    }
  }
  
  /**
   * Close a poll (mark as inactive)
   */
  static async closePoll(pollId: number): Promise<IlPoll> {
    try {
      const [poll] = await db.update(il_polls)
        .set({ is_active: false })
        .where(eq(il_polls.id, pollId))
        .returning();
      
      // Get final results and broadcast closure event
      const results = await this.getPollResults(pollId);
      WebSocketManager.broadcast('poll:closed', {
        pollId,
        results,
        departmentId: poll.department_id
      });
      
      return poll;
    } catch (error) {
      console.error('Error closing poll:', error);
      throw new Error('Failed to close poll');
    }
  }
  
  /**
   * Get poll results
   */
  static async getPollResults(pollId: number): Promise<PollResults> {
    try {
      const poll = await this.getPollById(pollId);
      
      if (!poll) {
        throw new Error('Poll not found');
      }
      
      // Get vote counts for each option
      const votes: { [key: string]: number } = {};
      const options = poll.options as any[];
      
      // Initialize vote counts
      options.forEach(option => {
        votes[option.text] = 0;
      });
      
      // Count votes for each option
      const voteCounts = await db.select({
        option_index: il_poll_votes.option_index,
        count: count()
      })
        .from(il_poll_votes)
        .where(eq(il_poll_votes.poll_id, pollId))
        .groupBy(il_poll_votes.option_index);
      
      // Map counts to option text
      voteCounts.forEach(count => {
        const optionText = options[count.option_index]?.text;
        if (optionText) {
          votes[optionText] = Number(count.count);
        }
      });
      
      // Calculate total votes
      const total = Object.values(votes).reduce((sum, count) => sum + count, 0);
      
      // Calculate percentages
      const percentages: { [key: string]: number } = {};
      if (total > 0) {
        Object.entries(votes).forEach(([option, count]) => {
          percentages[option] = Math.round((count / total) * 100);
        });
      } else {
        Object.keys(votes).forEach(option => {
          percentages[option] = 0;
        });
      }
      
      return {
        poll,
        votes,
        total,
        percentages
      };
    } catch (error) {
      console.error('Error getting poll results:', error);
      throw new Error('Failed to get poll results');
    }
  }
  
  /**
   * Find related content based on poll tags
   */
  static async findRelatedContent(pollId: number, limit: number = 3): Promise<any[]> {
    try {
      const poll = await this.getPollById(pollId);
      
      if (!poll || !poll.tags || poll.tags.length === 0) {
        return [];
      }
      
      // Find content with matching tags
      const matchingContent = await db.select()
        .from(content)
        .where(
          and(
            eq(content.is_active, true),
            // Match any content with at least one matching tag
            sql`${content.tags} && ${poll.tags}::text[]`
          )
        )
        .limit(limit);
      
      return matchingContent;
    } catch (error) {
      console.error('Error finding related content:', error);
      return [];
    }
  }
}