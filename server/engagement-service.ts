import { db } from './db';
import { userEngagement, engagementHistory, users, departments } from '@shared/schema';
import { and, eq, sql } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

// Function to track user interactions (exported for use in other services)
export async function trackInteraction(userId: number, interactionType: string, interactionId?: number): Promise<any> {
  return engagementService.trackInteraction(userId, interactionType, interactionId);
}

export class EngagementService {
  private anthropic: Anthropic;
  
  constructor() {
    // Initialize Anthropic client
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  
  /**
   * Record a new interaction and update the user's count
   */
  async trackInteraction(userId: number, interactionType: string, contentId?: number): Promise<any> {
    // Start a transaction
    return db.transaction(async (tx) => {
      // Record the interaction in history
      await tx.insert(engagementHistory).values({
        user_id: userId,
        interaction_type: interactionType,
        content_id: contentId
      });
      
      // Check if user exists in the engagement table
      const existingRecord = await tx.select().from(userEngagement)
        .where(eq(userEngagement.user_id, userId))
        .limit(1);
      
      if (existingRecord.length > 0) {
        // User exists, update count
        const current = existingRecord[0];
        let newCount = current.count + 1;
        let starsEarned = current.stars_earned;
        let starEarned = false;
        
        // Check if user reached 10 interactions
        if (newCount >= 10) {
          starEarned = true;
          starsEarned += 1;
          newCount = 0; // Reset counter for next star
        }
        
        // Update the record
        const [updated] = await tx.update(userEngagement)
          .set({
            count: newCount,
            stars_earned: starsEarned,
            last_updated: new Date()
          })
          .where(eq(userEngagement.user_id, userId))
          .returning();
        
        return {
          ...updated,
          star_earned: starEarned
        };
      } else {
        // New user, create record
        const [created] = await tx.insert(userEngagement)
          .values({
            user_id: userId,
            count: 1,
            stars_earned: 0,
            previous_week_count: 0,
            last_updated: new Date(),
            created_at: new Date()
          })
          .returning();
        
        return {
          ...created,
          star_earned: false
        };
      }
    });
  }
  
  /**
   * Get interaction data for a specific user
   */
  async getUserEngagement(userId: number): Promise<any> {
    const result = await db.select().from(userEngagement)
      .where(eq(userEngagement.user_id, userId))
      .limit(1);
    
    if (result.length === 0) {
      // User doesn't have engagement data yet
      return {
        user_id: userId,
        count: 0,
        stars_earned: 0,
        previous_week_count: 0,
        last_updated: new Date().toISOString()
      };
    }
    
    return result[0];
  }
  
  /**
   * Get interaction data for all users in a department
   */
  async getDepartmentEngagement(departmentId: number): Promise<any[]> {
    const result = await db.select({
      user_id: userEngagement.user_id,
      count: userEngagement.count,
      stars_earned: userEngagement.stars_earned,
      previous_week_count: userEngagement.previous_week_count,
      last_updated: userEngagement.last_updated,
      first_name: users.first_name,
      last_name: users.last_name
    })
    .from(userEngagement)
    .innerJoin(users, eq(userEngagement.user_id, users.id))
    .where(eq(users.department_id, departmentId));
    
    return result.map(user => ({
      ...user,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || `Student ${user.user_id}`
    }));
  }
  
  /**
   * Generate insights about user engagement trends using Claude API
   */
  async getDepartmentTrends(departmentId: number): Promise<any[]> {
    // Get users in the department with their engagement data
    const users = await this.getDepartmentEngagement(departmentId);
    
    if (users.length === 0) {
      return [];
    }
    
    try {
      // Format data for Claude API
      const userData = users.map(user => ({
        user_id: user.user_id,
        name: user.name,
        current_count: user.count,
        previous_count: user.previous_week_count,
        change: user.count - user.previous_week_count,
        stars_earned: user.stars_earned
      }));
      
      // Prepare the prompt for Claude
      let prompt = `Analyze the following student engagement data and provide a brief, simple insight for each student about their interaction trend:
      
      `;
      
      // Add user data to prompt
      userData.forEach(user => {
        prompt += `Student ID: ${user.user_id}
        Name: ${user.name}
        Current Week Interactions: ${user.current_count}
        Previous Week Interactions: ${user.previous_count}
        Change: ${user.change}
        Total Stars Earned: ${user.stars_earned}
        
        `;
      });
      
      prompt += `For each student, provide a JSON object with: 
      1. student_id (number)
      2. student_name (string)
      3. insight (a simple one-sentence observation about their engagement trend)
      4. trend (either "up", "down", or "stable")
      
      Format the response as a JSON array of these objects. Keep the insights very simple, in everyday language a teacher would use.`;
      
      try {
        // Call Claude API
        const response = await this.anthropic.messages.create({
          model: "claude-3-7-sonnet-20250219", // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        });
        
        // Parse the response - handle content blocks safely
        const firstContentBlock = response.content[0];
        
        if (!firstContentBlock) {
          console.warn('Empty response from Claude API');
          return this.generateBasicInsights(userData);
        }
        
        // Check if it's a text block (type: 'text')
        if ('type' in firstContentBlock && firstContentBlock.type === 'text' && 'text' in firstContentBlock) {
          const content = firstContentBlock.text as string;
          
          // Look for JSON in the response
          // Use a regex that's compatible with our TypeScript version
          const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
          
          if (jsonMatch) {
            try {
              const insights = JSON.parse(jsonMatch[0]);
              return insights;
            } catch (jsonError) {
              console.warn('Error parsing JSON from Claude response:', jsonError);
            }
          }
        }
      } catch (apiError) {
        console.error("Error calling Claude API:", apiError);
      }
      
      // Fallback if anything goes wrong with Claude API
      return this.generateBasicInsights(userData);
    } catch (error) {
      console.error("Error generating engagement trends:", error);
      // Fallback to basic insights for any other errors
      return this.generateBasicInsights(users);
    }
  }
  
  /**
   * Generate basic insights without AI as a fallback
   */
  private generateBasicInsights(users: any[]): any[] {
    return users.map(user => {
      const current = user.count || user.current_count || 0;
      const previous = user.previous_week_count || user.previous_count || 0;
      const change = current - previous;
      const name = user.name || `Student ${user.user_id}`;
      
      let trend = 'stable';
      let insight = `Steady at ${current} interactions`;
      
      if (change > 0) {
        trend = 'up';
        insight = `Increased from ${previous} to ${current} interactions`;
      } else if (change < 0) {
        trend = 'down';
        insight = `Decreased from ${previous} to ${current} interactions`;
      }
      
      return {
        student_id: user.user_id,
        student_name: name,
        insight,
        trend
      };
    });
  }
  
  /**
   * Update previous week counts for all users (to be run weekly)
   */
  async updateWeeklyCounts(): Promise<void> {
    await db.update(userEngagement).set({
      previous_week_count: sql`${userEngagement.count}`
    });
  }
}

export const engagementService = new EngagementService();