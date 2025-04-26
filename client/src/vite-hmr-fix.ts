/**
 * This script helps fix Vite HMR connection issues
 * It will attempt to reconnect to the Vite dev server repeatedly
 * when in development mode, and even try alternate ports.
 */

// Only run in development mode
if (import.meta.env.DEV) {
  console.log('[HMR Fix] Initializing enhanced HMR connection handler...');

  // Store the original WebSocket constructor
  const OriginalWebSocket = window.WebSocket;
  
  // Flag to track if we've connected successfully
  let hmrConnected = false;
  
  // Flag to track which port we're connecting to
  let usingPort = window.location.port || "5000"; // Default to 5000
  const portOptions = ["3000", "5000", "8080", "5050", "4000"];
  let alternatePortIndex = 0;
  let hasTriedPortSwitch = false;
  
  // Figure out which port we're currently on
  if (portOptions.includes(usingPort)) {
    // Remove current port from options
    alternatePortIndex = portOptions.indexOf(usingPort);
    portOptions.splice(alternatePortIndex, 1);
  }
  
  // Get the first alternate port
  let alternatePort = portOptions[0];
  
  console.log(`[HMR Fix] Initial port detection: ${usingPort}, alternate ports: ${portOptions.join(', ')}`);
  
  // Keep track of which ports we've tried
  let currentPortIndex = 0;
  
  // Function to manually try alternative port connection
  const tryAlternatePort = () => {
    if (!hmrConnected && currentPortIndex < portOptions.length) {
      const portToTry = portOptions[currentPortIndex];
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.hostname;
      const path = "/__vite_hmr";
      
      console.log(`[HMR Fix] Trying port ${portToTry} (attempt ${currentPortIndex + 1}/${portOptions.length}) for HMR connection...`);
      
      try {
        // Directly create a WebSocket to the alternate port
        const alternateUrl = `${protocol}//${host}:${portToTry}${path}`;
        console.log(`[HMR Fix] Attempting direct connection to: ${alternateUrl}`);
        
        const socket = new OriginalWebSocket(alternateUrl);
        
        socket.addEventListener('open', () => {
          console.log(`[HMR Fix] Successfully connected to port ${portToTry}!`);
          hmrConnected = true;
          
          // If we got a connection on a different port than current, redirect
          if (portToTry !== usingPort) {
            console.log(`[HMR Fix] Redirecting to working port ${portToTry}...`);
            // Redirect to the working port
            window.location.href = `${window.location.protocol}//${window.location.hostname}:${portToTry}${window.location.pathname}${window.location.search}`;
          }
        });
        
        socket.addEventListener('error', () => {
          console.log(`[HMR Fix] Failed to connect to port ${portToTry}`);
          // Try next port
          currentPortIndex++;
          
          // If there are more ports to try, try the next one after a small delay
          if (currentPortIndex < portOptions.length) {
            setTimeout(tryAlternatePort, 500);
          } else {
            console.log('[HMR Fix] Tried all alternate ports without success');
            
            // After trying all ports, set a fallback message for the user
            if (!document.getElementById('connection-status-message')) {
              const fallbackMessage = document.createElement('div');
              fallbackMessage.id = 'connection-status-message';
              fallbackMessage.style.position = 'fixed';
              fallbackMessage.style.top = '0';
              fallbackMessage.style.left = '0';
              fallbackMessage.style.right = '0';
              fallbackMessage.style.backgroundColor = '#f8d7da';
              fallbackMessage.style.color = '#721c24';
              fallbackMessage.style.padding = '10px';
              fallbackMessage.style.textAlign = 'center';
              fallbackMessage.style.zIndex = '9999';
              fallbackMessage.style.fontFamily = 'sans-serif';
              fallbackMessage.innerHTML = 'Connection to development server lost. <button id="try-direct" style="background: #721c24; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Try Direct Connection</button>';
              document.body.appendChild(fallbackMessage);
              
              document.getElementById('try-direct')?.addEventListener('click', () => {
                window.location.href = `${window.location.protocol}//${window.location.hostname}:3000${window.location.pathname}${window.location.search}`;
              });
            }
          }
        });
        
        socket.addEventListener('close', () => {
          console.log(`[HMR Fix] Connection to port ${portToTry} closed`);
        });
      } catch (error) {
        console.error('[HMR Fix] Error attempting port connection:', error);
        // Try next port
        currentPortIndex++;
        if (currentPortIndex < portOptions.length) {
          setTimeout(tryAlternatePort, 500);
        }
      }
    }
  };
  
  // Create a more aggressive wrapper for WebSocket with multiple reconnection attempts
  class ReconnectingWebSocket extends OriginalWebSocket {
    private static isReconnecting = false;
    private static reconnectAttempts = 0;
    private static maxReconnectAttempts = 15; // Increased from 10
    private static reconnectBackoff = 500; // Faster initial backoff (500ms)
    private static reconnectMaxBackoff = 5000; // Shorter max backoff (5s)
    
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols);
      
      const urlStr = url.toString();
      console.log(`[HMR Fix] Creating WebSocket connection to: ${urlStr}`);
      
      // The first successful connection marks the HMR as connected
      this.addEventListener('open', () => {
        console.log(`[HMR Fix] WebSocket connection opened successfully: ${urlStr}`);
        hmrConnected = true;
        
        // Reset reconnection attempts on successful connection
        ReconnectingWebSocket.reconnectAttempts = 0;
        
        // Let's inform user about the successful connection
        const notifySuccess = document.createElement('div');
        notifySuccess.style.position = 'fixed';
        notifySuccess.style.bottom = '10px';
        notifySuccess.style.right = '10px';
        notifySuccess.style.backgroundColor = '#4CAF50';
        notifySuccess.style.color = 'white';
        notifySuccess.style.padding = '8px 12px';
        notifySuccess.style.borderRadius = '4px';
        notifySuccess.style.zIndex = '9999';
        notifySuccess.style.opacity = '0.9';
        notifySuccess.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        notifySuccess.style.transition = 'opacity 0.5s';
        notifySuccess.innerHTML = 'Connected to development server successfully!';
        document.body.appendChild(notifySuccess);
        
        // Remove the notification after 3 seconds
        setTimeout(() => {
          notifySuccess.style.opacity = '0';
          setTimeout(() => document.body.removeChild(notifySuccess), 500);
        }, 3000);
      });
      
      // Handle HMR specific connections
      if (urlStr.includes('/__vite_hmr') || urlStr.includes('vite-hmr')) {
        const forceReconnect = () => {
          if (ReconnectingWebSocket.isReconnecting) return;
          
          ReconnectingWebSocket.isReconnecting = true;
          ReconnectingWebSocket.reconnectAttempts++;
          
          // Calculate backoff with exponential increase (capped)
          const backoff = Math.min(
            ReconnectingWebSocket.reconnectBackoff * Math.pow(1.5, ReconnectingWebSocket.reconnectAttempts - 1),
            ReconnectingWebSocket.reconnectMaxBackoff
          );
          
          console.log(`[HMR Fix] Scheduling reconnect attempt ${ReconnectingWebSocket.reconnectAttempts} in ${backoff}ms`);
          
          setTimeout(() => {
            // If we've made several attempts without success, try the alternate port
            if (ReconnectingWebSocket.reconnectAttempts === 5 || 
                ReconnectingWebSocket.reconnectAttempts === 10) {
              tryAlternatePort();
            }
            
            console.log(`[HMR Fix] Attempting reconnect ${ReconnectingWebSocket.reconnectAttempts}...`);
            
            try {
              // For Vite HMR specifically, modify the URL to ensure it works
              let reconnectUrl = urlStr;
              
              // Force ws protocol
              if (window.location.protocol === 'https:') {
                reconnectUrl = reconnectUrl.replace('wss:', 'ws:');
              }
              
              // Try to create a new connection with the same URL
              new ReconnectingWebSocket(reconnectUrl, protocols);
              console.log(`[HMR Fix] Reconnection attempt ${ReconnectingWebSocket.reconnectAttempts} initiated`);
            } catch (error) {
              console.error('[HMR Fix] Reconnection failed:', error);
            }
            
            ReconnectingWebSocket.isReconnecting = false;
            
            // If we've tried too many times, reset and try the alternate port
            if (ReconnectingWebSocket.reconnectAttempts >= ReconnectingWebSocket.maxReconnectAttempts) {
              console.log('[HMR Fix] Maximum reconnection attempts reached, trying page reload');
              ReconnectingWebSocket.reconnectAttempts = 0;
              window.location.reload();
            }
          }, backoff);
        };
        
        // Enhance connection error handling
        this.addEventListener('close', (event) => {
          console.log(`[HMR Fix] Connection closed: ${event.code} ${event.reason}`);
          hmrConnected = false;
          forceReconnect();
        });
        
        this.addEventListener('error', (event) => {
          console.log('[HMR Fix] Connection error:', event);
          hmrConnected = false;
          forceReconnect();
        });
      }
    }
  }
  
  // Replace the global WebSocket with our enhanced version
  window.WebSocket = ReconnectingWebSocket as any;
  
  console.log('[HMR Fix] Enhanced WebSocket reconnection enabled for development mode');
  
  // Try alternate port if no connection after 5 seconds
  setTimeout(() => {
    if (!hmrConnected) {
      console.log('[HMR Fix] No HMR connection after 5 seconds, trying alternate port...');
      tryAlternatePort();
    }
  }, 5000);
  
  // Additionally set up a periodic check for the HMR connection
  setInterval(() => {
    // If we detect the Vite server is disconnected, try to recover
    const viteHmrElement = document.querySelector('[data-vite-dev-id="vite-error-overlay"]');
    if (viteHmrElement) {
      console.log('[HMR Fix] Detected Vite HMR error overlay, attempting recovery...');
      
      // First try alternate port
      tryAlternatePort();
      
      // If that doesn't help after a bit, force reload
      setTimeout(() => {
        if (document.querySelector('[data-vite-dev-id="vite-error-overlay"]')) {
          console.log('[HMR Fix] Forcing page reload to recover from HMR error');
          window.location.reload();
        }
      }, 5000);
    }
  }, 15000); // Check every 15 seconds
}

export {};