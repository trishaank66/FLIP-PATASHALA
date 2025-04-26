import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface WebSocketClient extends WebSocket {
  userId?: number;
  departmentId?: number;
  subjects?: string[];
  isAlive: boolean;
}

interface BroadcastOptions {
  includeUser?: number;
  excludeUser?: number;
  departmentId?: number;
  subject?: string;
}

/**
 * Manager for WebSocket connections and real-time updates
 */
export class WebSocketManager {
  private static wss: WebSocketServer;
  private static clients: Set<WebSocketClient> = new Set();
  private static pingInterval: NodeJS.Timeout;
  private static initialized: boolean = false;
  
  /**
   * Check if WebSocket server is already initialized
   */
  static isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Initialize WebSocket server
   */
  static initialize(server: Server): void {
    // Only initialize if we haven't already created a WebSocket server
    if (this.wss) {
      console.log('WebSocket server already initialized');
      return;
    }
    
    // Create WebSocket server on a specific path to avoid
    // conflict with Vite's HMR WebSocket
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });
    
    // Mark as initialized
    this.initialized = true;
    
    console.log('WebSocket server initialized');
    
    this.wss.on('connection', (ws: WebSocketClient) => {
      ws.isAlive = true;
      this.clients.add(ws);
      
      console.log(`WebSocket client connected. Total clients: ${this.clients.size}`);
      
      // Handle ping/pong to detect disconnected clients
      ws.on('pong', () => {
        ws.isAlive = true;
      });
      
      // Handle client authentication
      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          
          if (data.type === 'auth') {
            ws.userId = data.userId;
            ws.departmentId = data.departmentId;
            ws.subjects = data.subjects || [];
            console.log(`WebSocket client authenticated: User ${ws.userId}`);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });
      
      // Handle client disconnect
      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`WebSocket client disconnected. Remaining clients: ${this.clients.size}`);
      });
    });
    
    // Set up ping interval to detect disconnected clients
    this.pingInterval = setInterval(() => {
      this.wss.clients.forEach((socket: WebSocket) => {
        const ws = socket as WebSocketClient;
        if (ws.isAlive === false) {
          this.clients.delete(ws);
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
    
    // Clean up on server shutdown
    process.on('SIGINT', () => {
      clearInterval(this.pingInterval);
      this.wss.close();
      process.exit(0);
    });
  }
  
  /**
   * Broadcast a message to all connected clients or a subset based on options
   */
  static broadcast(eventType: string, data: any, options: BroadcastOptions = {}): void {
    const message = JSON.stringify({
      type: eventType,
      data
    });
    
    this.clients.forEach(client => {
      // Skip if client socket is not open
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }
      
      // Skip if options specify to exclude this user
      if (options.excludeUser !== undefined && client.userId === options.excludeUser) {
        return;
      }
      
      // Skip if options specify to include only specific user
      if (options.includeUser !== undefined && client.userId !== options.includeUser) {
        return;
      }
      
      // Skip if options specify department and client is not in that department
      if (options.departmentId !== undefined && client.departmentId !== options.departmentId) {
        return;
      }
      
      // Skip if options specify subject and client is not subscribed to that subject
      if (options.subject !== undefined && !client.subjects?.includes(options.subject)) {
        return;
      }
      
      // Send the message
      client.send(message);
    });
  }
  
  /**
   * Send a message to a specific user
   */
  static sendToUser(userId: number, eventType: string, data: any): void {
    this.broadcast(eventType, data, { includeUser: userId });
  }
  
  /**
   * Send a message to users in a specific department
   */
  static sendToDepartment(departmentId: number, eventType: string, data: any): void {
    this.broadcast(eventType, data, { departmentId });
  }
  
  /**
   * Send a message to users subscribed to a specific subject
   */
  static sendToSubject(subject: string, eventType: string, data: any): void {
    this.broadcast(eventType, data, { subject });
  }
}