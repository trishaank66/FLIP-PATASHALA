/**
 * Service for handling shared notes operations
 */
import { apiRequest, queryClient } from "@/lib/queryClient";
import { WebSocketManager } from "./websocket-manager";
import { IlSharedNote, IlNoteContribution } from "@shared/schema";

export class NotesService {
  private static wsManager: WebSocketManager = WebSocketManager.getInstance();

  /**
   * Get all shared note sessions for a subject
   */
  public static async getNoteSessions(subject: string): Promise<IlSharedNote[]> {
    const response = await apiRequest("GET", `/api/il/notes/sessions/${encodeURIComponent(subject)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch note sessions: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get a specific note session
   */
  public static async getNoteSession(sessionId: number): Promise<IlSharedNote> {
    const response = await apiRequest("GET", `/api/il/notes/sessions/${sessionId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch note session: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get all contributions for a note session
   */
  public static async getNoteContributions(sessionId: number): Promise<IlNoteContribution[]> {
    const response = await apiRequest("GET", `/api/il/notes/sessions/${sessionId}/entries`);
    if (!response.ok) {
      throw new Error(`Failed to fetch note contributions: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Create a new note session (faculty only)
   */
  public static async createNoteSession(sessionData: {
    title: string;
    content: string;
    subject: string;
    department_id?: number;
  }): Promise<IlSharedNote> {
    const response = await apiRequest("POST", "/api/il/notes/sessions", sessionData);
    if (!response.ok) {
      throw new Error(`Failed to create note session: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Add a text contribution to a note session
   */
  public static async addTextContribution(
    sessionId: number,
    content: string
  ): Promise<IlNoteContribution> {
    const response = await apiRequest("POST", `/api/il/notes/sessions/${sessionId}/entries`, {
      content,
      content_type: "text"
    });
    if (!response.ok) {
      throw new Error(`Failed to add text contribution: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Add a sketch contribution to a note session
   */
  public static async addSketchContribution(
    sessionId: number,
    sketchData: string
  ): Promise<IlNoteContribution> {
    const response = await apiRequest("POST", `/api/il/notes/sessions/${sessionId}/entries`, {
      content: "",
      content_type: "sketch",
      sketch_data: sketchData
    });
    if (!response.ok) {
      throw new Error(`Failed to add sketch contribution: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * End a note session (faculty only)
   */
  public static async endNoteSession(sessionId: number): Promise<IlSharedNote> {
    const response = await apiRequest("PUT", `/api/il/notes/sessions/${sessionId}/status`, {
      is_active_session: false
    });
    if (!response.ok) {
      throw new Error(`Failed to end note session: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Subscribe to real-time updates for a specific note session
   */
  public static subscribeToNoteSession(
    sessionId: number,
    callback: (contribution: IlNoteContribution) => void
  ): () => void {
    const eventType = `note_contribution_${sessionId}`;
    
    NotesService.wsManager.addEventListener(eventType, callback);
    
    // Return unsubscribe function
    return () => {
      NotesService.wsManager.removeEventListener(eventType, callback);
    };
  }

  /**
   * Subscribe to note session status changes
   */
  public static subscribeToSessionStatus(
    sessionId: number,
    callback: (session: IlSharedNote) => void
  ): () => void {
    const eventType = `note_session_update_${sessionId}`;
    
    NotesService.wsManager.addEventListener(eventType, callback);
    
    // Return unsubscribe function
    return () => {
      NotesService.wsManager.removeEventListener(eventType, callback);
    };
  }

  /**
   * Invalidate the cached sessions data
   */
  public static invalidateSessionsCache(subject: string): void {
    queryClient.invalidateQueries({ queryKey: [`/api/il/notes/sessions/${encodeURIComponent(subject)}`] });
  }

  /**
   * Invalidate the cached contributions data
   */
  public static invalidateContributionsCache(sessionId: number): void {
    queryClient.invalidateQueries({ queryKey: [`/api/il/notes/sessions/${sessionId}/entries`] });
  }
  
  /**
   * Send a new contribution through WebSocket (for faster real-time updates)
   */
  public static sendContributionViaWebSocket(sessionId: number, contribution: Partial<IlNoteContribution>): boolean {
    return NotesService.wsManager.send('note_contribution', {
      sessionId,
      contribution
    });
  }
}