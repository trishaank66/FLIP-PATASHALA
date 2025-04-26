/**
 * Client-side WebSocket manager for real-time communication
 */
export class WebSocketManager {
  private static instance: WebSocketManager;
  private socket: WebSocket | null = null;
  private eventListeners: Map<string, Array<(data: any) => void>> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: number = 2000;
  private reconnectTimer: number | null = null;
  private isConnecting: boolean = false;
  private userId: number | null = null;
  private departmentId: number | null = null;
  private subjects: string[] = [];
  
  /**
   * Get the WebSocketManager instance (singleton)
   */
  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }
  
  /**
   * Initialize the WebSocketManager with user information
   */
  public static initialize(userId: number, departmentId: number | null, subjects: string[]): WebSocketManager {
    const instance = WebSocketManager.getInstance();
    instance.userId = userId;
    instance.departmentId = departmentId;
    instance.subjects = subjects;
    instance.connect();
    return instance;
  }
  
  /**
   * Connect to the WebSocket server
   */
  private connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return; // Already connected or connecting
    }
    
    if (this.isConnecting) {
      return; // Already trying to connect
    }
    
    this.isConnecting = true;
    
    // Use the correct protocol based on whether the page is served via HTTPS
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      this.socket = new WebSocket(wsUrl);
      
      this.socket.onopen = () => {
        console.log('WebSocket connection established');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Authenticate with server
        this.authenticate();
      };
      
      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.socket.onclose = () => {
        console.log('WebSocket connection closed');
        this.isConnecting = false;
        this.attemptReconnect();
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        // Let onclose handle reconnection
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }
  
  /**
   * Authenticate with the WebSocket server
   */
  private authenticate(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.userId) {
      return;
    }
    
    this.socket.send(JSON.stringify({
      type: 'auth',
      userId: this.userId,
      departmentId: this.departmentId,
      subjects: this.subjects
    }));
  }
  
  /**
   * Attempt to reconnect to the WebSocket server
   */
  private attemptReconnect(): void {
    if (this.reconnectTimer !== null) {
      return; // Already trying to reconnect
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectTimeout * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
  
  /**
   * Handle incoming messages
   */
  private handleMessage(message: any): void {
    const { type, data } = message;
    
    if (!type) {
      return;
    }
    
    // Call event listeners for this event type
    const listeners = this.eventListeners.get(type) || [];
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in WebSocket event listener for type '${type}':`, error);
      }
    });
  }
  
  /**
   * Send a message to the WebSocket server
   */
  public send(type: string, data: any): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return false;
    }
    
    try {
      this.socket.send(JSON.stringify({ type, data }));
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      return false;
    }
  }
  
  /**
   * Add an event listener for a specific event type
   */
  public addEventListener(type: string, listener: (data: any) => void): void {
    const listeners = this.eventListeners.get(type) || [];
    listeners.push(listener);
    this.eventListeners.set(type, listeners);
  }
  
  /**
   * Remove an event listener
   */
  public removeEventListener(type: string, listener: (data: any) => void): void {
    const listeners = this.eventListeners.get(type) || [];
    const updatedListeners = listeners.filter(l => l !== listener);
    this.eventListeners.set(type, updatedListeners);
  }
  
  /**
   * Check if the WebSocket is connected
   */
  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
  
  /**
   * Disconnect from the WebSocket server
   */
  public disconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}