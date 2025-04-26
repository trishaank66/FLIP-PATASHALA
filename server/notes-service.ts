import { db } from './db';
import { 
  il_shared_notes, 
  il_note_contributions, 
  IlSharedNote, 
  IlNoteContribution,
  users
} from '@shared/schema';
import { and, eq, desc, like, sql } from 'drizzle-orm';
import { WebSocketManager } from './websocket-manager';
import { processImageData } from './cv-processing';
import { trackInteraction } from './engagement-service';

/**
 * Service for handling shared notes operations
 */
export class NotesService {
  /**
   * Create a new shared note session
   */
  static async createNoteSession(
    userId: number, 
    title: string, 
    content: string, 
    subject: string,
    departmentId?: number
  ): Promise<IlSharedNote> {
    const [note] = await db
      .insert(il_shared_notes)
      .values({
        title,
        content,
        created_by: userId,
        subject,
        is_active_session: true,
        department_id: departmentId
      })
      .returning();
      
    // Broadcast the new session to all users in the department or subject
    WebSocketManager.broadcast('note_session_created', {
      sessionId: note.id,
      title: note.title,
      subject: note.subject
    }, {
      departmentId,
      subject
    });
    
    return note;
  }
  
  /**
   * Get all shared note sessions for a subject
   */
  static async getNoteSessionsBySubject(subject: string): Promise<IlSharedNote[]> {
    return await db
      .select()
      .from(il_shared_notes)
      .where(and(
        eq(il_shared_notes.subject, subject),
        eq(il_shared_notes.is_active, true)
      ))
      .orderBy(desc(il_shared_notes.created_at));
  }
  
  /**
   * Get a specific shared note session
   */
  static async getNoteSession(id: number): Promise<IlSharedNote | undefined> {
    const [note] = await db
      .select()
      .from(il_shared_notes)
      .where(eq(il_shared_notes.id, id))
      .limit(1);
      
    return note;
  }
  
  /**
   * Get all contributions for a note session
   */
  static async getNoteContributions(noteId: number): Promise<(IlNoteContribution & { user_name: string })[]> {
    const results = await db
      .select({
        id: il_note_contributions.id,
        content: il_note_contributions.content,
        note_id: il_note_contributions.note_id,
        user_id: il_note_contributions.user_id,
        content_type: il_note_contributions.content_type,
        tags: il_note_contributions.tags,
        sketch_data: il_note_contributions.sketch_data,
        ai_processed: il_note_contributions.ai_processed,
        contributed_at: il_note_contributions.contributed_at,
        user_name: sql<string>`concat(${users.first_name}, ' ', ${users.last_name})`
      })
      .from(il_note_contributions)
      .innerJoin(users, eq(il_note_contributions.user_id, users.id))
      .where(eq(il_note_contributions.note_id, noteId))
      .orderBy(il_note_contributions.contributed_at);
      
    return results as (IlNoteContribution & { user_name: string })[];
  }
  
  /**
   * Add a contribution to a note session
   */
  static async addContribution(
    noteId: number,
    userId: number,
    content: string,
    contentType: 'text' | 'sketch' = 'text',
    sketchData?: string
  ): Promise<IlNoteContribution> {
    // First check if the note session is active
    const [note] = await db
      .select()
      .from(il_shared_notes)
      .where(and(
        eq(il_shared_notes.id, noteId),
        eq(il_shared_notes.is_active_session, true)
      ))
      .limit(1);
      
    if (!note) {
      throw new Error('This note session is not active');
    }
    
    // Generate tags based on content
    let tags: string[] = [];
    let aiProcessed = false;
    
    if (contentType === 'text' && content) {
      // Extract tags from text (simplified for now - could be more sophisticated)
      tags = this.extractTagsFromText(content);
      aiProcessed = true;
    } else if (contentType === 'sketch' && sketchData) {
      // Process the sketch with our CV model
      try {
        const result = await processImageData(sketchData);
        if (result.tags && result.tags.length > 0) {
          tags = result.tags;
          aiProcessed = true;
        }
      } catch (error) {
        console.error('Error processing sketch for CV tagging:', error);
        // Continue without tags if processing fails
      }
    }
    
    // Create the contribution
    const [contribution] = await db
      .insert(il_note_contributions)
      .values({
        note_id: noteId,
        user_id: userId,
        content,
        content_type: contentType,
        sketch_data: sketchData,
        tags,
        ai_processed: aiProcessed
      })
      .returning();
      
    // Get user name for broadcasting
    const [user] = await db
      .select({
        first_name: users.first_name,
        last_name: users.last_name
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    // Broadcast the new contribution to all users in the session
    const contributionWithUser = {
      ...contribution,
      user_name: user ? `${user.first_name} ${user.last_name}` : 'Unknown User'
    };
    
    WebSocketManager.broadcast(
      `note_contribution_${noteId}`, 
      contributionWithUser,
      { subject: note.subject }
    );
    
    // Track this interaction for engagement
    try {
      await trackInteraction(userId, 'note_contribution', contribution.id);
    } catch (error) {
      console.error('Error tracking note contribution interaction:', error);
    }
    
    return contribution;
  }
  
  /**
   * Update a note session status (active/inactive)
   */
  static async updateNoteSessionStatus(
    noteId: number,
    isActive: boolean,
    userId: number
  ): Promise<IlSharedNote> {
    // Check if the user is the creator of the note
    const [note] = await db
      .select()
      .from(il_shared_notes)
      .where(and(
        eq(il_shared_notes.id, noteId),
        eq(il_shared_notes.created_by, userId)
      ))
      .limit(1);
      
    if (!note) {
      throw new Error('You do not have permission to update this note session');
    }
    
    // Update the note status
    const [updatedNote] = await db
      .update(il_shared_notes)
      .set({
        is_active_session: isActive,
        ends_at: isActive ? null : new Date()
      })
      .where(eq(il_shared_notes.id, noteId))
      .returning();
      
    // Broadcast the status change
    WebSocketManager.broadcast(
      `note_session_update_${noteId}`,
      {
        id: updatedNote.id,
        is_active_session: updatedNote.is_active_session,
        ends_at: updatedNote.ends_at
      },
      { subject: updatedNote.subject }
    );
    
    return updatedNote;
  }
  
  /**
   * Delete a note session (soft delete)
   */
  static async deleteNoteSession(noteId: number, userId: number): Promise<IlSharedNote> {
    // Check if the user is the creator of the note
    const [note] = await db
      .select()
      .from(il_shared_notes)
      .where(and(
        eq(il_shared_notes.id, noteId),
        eq(il_shared_notes.created_by, userId)
      ))
      .limit(1);
      
    if (!note) {
      throw new Error('You do not have permission to delete this note session');
    }
    
    // Soft delete by marking as inactive
    const [deletedNote] = await db
      .update(il_shared_notes)
      .set({
        is_active: false,
        is_active_session: false
      })
      .where(eq(il_shared_notes.id, noteId))
      .returning();
      
    return deletedNote;
  }
  
  /**
   * Extract tags from text content
   * A simple implementation - could be enhanced with NLP
   */
  private static extractTagsFromText(text: string): string[] {
    // Simple tag extraction - could be replaced with more sophisticated NLP
    const keywords = [
      'loop', 'array', 'function', 'class', 'object',
      'algorithm', 'data structure', 'recursion', 'iteration',
      'operator', 'variable', 'constant', 'parameter',
      'database', 'query', 'sql', 'network', 'protocol',
      'client', 'server', 'api', 'rest', 'request', 'response'
    ];
    
    const tags: string[] = [];
    const lowercaseText = text.toLowerCase();
    
    keywords.forEach(keyword => {
      if (lowercaseText.includes(keyword)) {
        // Capitalize first letter of each word for display
        const formattedTag = keyword
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        tags.push(formattedTag);
      }
    });
    
    return tags;
  }
}

/**
 * Initialize the Notes Service with a test processor
 */
export async function initializeNotesService(): Promise<void> {
  console.log('Notes service initialized');
  return Promise.resolve();
}