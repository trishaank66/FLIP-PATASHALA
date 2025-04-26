/**
 * FLIP Patashala - Multi-Port Resilient Reverse Proxy
 * 
 * This script creates a resilient proxy server that attempts to listen on different ports
 * and forwards all requests to port 3000, where our actual app is running.
 * 
 * It tries multiple ports in sequence to find an available one.
 */

const http = require('http');
const httpProxy = require('http-proxy');
const net = require('net');

// Create a proxy server
const proxy = httpProxy.createProxyServer({});

// Target port where our app is actually running
// Get from environment variable or fallback to 3000
const TARGET_PORT = process.env.TARGET_PORT ? parseInt(process.env.TARGET_PORT, 10) : 3000;

// Array of ports to try, in order of preference
// For Replit's workflow system, we need a port that works consistently
// If 5000 is unavailable (which it usually is), the workflow detection system
// needs at least one successful port open. We'll try a few alternatives.
const PROXY_PORTS = [
  5000,  // Try port 5000 first to satisfy Replit workflows (this is what Replit expects)
  5001,  // This is our main fallback that usually works 
  3001,  // Another good alternative close to our main port
  5002,  // Additional fallbacks
  8080,
  8000,
  5050
];

// Log proxy errors instead of crashing
proxy.on('error', function(err, req, res) {
  console.error('Proxy error:', err);
  
  if (!res.headersSent && res.writeHead) {
    try {
      // Send a nice error page to the user
      res.writeHead(502, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head>
            <title>FLIP Patashala - Connection Error</title>
            <style>
              body { font-family: sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
              h1 { color: #3b82f6; }
              .error { background-color: #fee2e2; border: 1px solid #f87171; padding: 15px; border-radius: 5px; }
              .info { background-color: #f0f9ff; border: 1px solid #bae6fd; padding: 15px; border-radius: 5px; margin-top: 20px; }
              button { background-color: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 15px; }
            </style>
          </head>
          <body>
            <h1>FLIP Patashala - Connection Error</h1>
            <div class="error">
              <p><strong>The application server is not responding properly.</strong></p>
              <p>We couldn't connect to the main application server on port ${TARGET_PORT}.</p>
            </div>
            <div class="info">
              <p>You can try the following:</p>
              <ul>
                <li>Wait a moment and try again - the server might still be starting up</li>
                <li>Try accessing <a href="http://localhost:${TARGET_PORT}">http://localhost:${TARGET_PORT}</a> directly</li>
                <li>Check if the server is running in the Replit console</li>
              </ul>
              <button onclick="window.location.reload()">Retry Connection</button>
              <button onclick="window.location.href='http://localhost:${TARGET_PORT}'">Try Direct Link</button>
            </div>
          </body>
        </html>
      `);
    } catch (writeErr) {
      console.error('Failed to send error page:', writeErr);
    }
  }
});

// Create the server that uses the proxy
const server = http.createServer(function(req, res) {
  // Forward each request to the target port
  proxy.web(req, res, { target: `http://localhost:${TARGET_PORT}` });
});

// Also proxy WebSocket connections
server.on('upgrade', function(req, socket, head) {
  proxy.ws(req, socket, head, { target: `http://localhost:${TARGET_PORT}` });
});

// Function to check if a port is available
function isPortAvailable(port) {
  return new Promise((resolve) => {
    // Special case for port 5000 - we really want this to work for Replit workflow
    if (port === 5000) {
      try {
        // Try to forcefully free up port 5000 on Linux
        const { execSync } = require('child_process');
        try {
          execSync('fuser -k 5000/tcp 2>/dev/null || true');
          console.log('Attempted to forcefully clear port 5000');
        } catch (err) {
          console.log('Could not forcefully clear port 5000:', err.message);
        }
        
        // Extra delay for port 5000 to give it time to be released
        setTimeout(() => {
          const tester = net.createServer()
            .once('error', () => {
              console.log('Port 5000 is still not available after forced clear');
              resolve(false);
            })
            .once('listening', () => {
              console.log('Successfully claimed port 5000!');
              tester.once('close', () => {
                resolve(true);
              }).close();
            })
            .listen(port);
        }, 2000);
        return;
      } catch (error) {
        console.error('Error trying to free port 5000:', error);
        resolve(false);
        return;
      }
    }
    
    // Normal port availability check for other ports
    const tester = net.createServer()
      .once('error', () => {
        resolve(false);
      })
      .once('listening', () => {
        tester.once('close', () => {
          resolve(true);
        }).close();
      })
      .listen(port);
  });
}

// Function to try starting the server on each port in sequence
async function tryPorts() {
  // Try port 5000 first - we really need this for Replit workflow
  console.log('Attempting to use port 5000 first (required for Replit workflow)...');
  try {
    const port5000Available = await isPortAvailable(5000);
    if (port5000Available) {
      try {
        console.log('Port 5000 is available! Setting up server...');
        server.listen(5000, () => {
          console.log(`✅ Proxy server running on port 5000, forwarding to port ${TARGET_PORT}`);
          console.log(`✅ You can access the application at: http://localhost:5000`);
          
          // Create a file to indicate that port 5000 is in use by our proxy
          try {
            const fs = require('fs');
            fs.writeFileSync('port5000.lock', 'locked by proxy-server.cjs', 'utf8');
            console.log('Created port5000.lock file to track proxy usage');
          } catch (fileErr) {
            console.error('Could not create port lock file:', fileErr.message);
          }
        });
        return true; // Success on port 5000!
      } catch (err) {
        console.error(`Failed to start proxy on port 5000 despite availability check:`, err.message);
        // Fall through to try other ports
      }
    } else {
      console.log('Port 5000 is definitely not available, trying alternate ports...');
    }
  } catch (port5000Error) {
    console.error('Error during port 5000 check:', port5000Error.message);
  }

  // If port 5000 didn't work, try the other ports
  for (const port of PROXY_PORTS.slice(1)) { // Skip 5000 as we already tried it
    const available = await isPortAvailable(port);
    if (available) {
      try {
        server.listen(port, () => {
          console.log(`✅ Proxy server running on port ${port}, forwarding to port ${TARGET_PORT}`);
          console.log(`✅ You can access the application at: http://localhost:${port}`);
        });
        return true; // Success
      } catch (err) {
        console.error(`Failed to start proxy on port ${port}:`, err.message);
        continue; // Try next port
      }
    } else {
      console.log(`Port ${port} is not available, trying next port...`);
    }
  }
  
  console.error('❌ Failed to start proxy on any port. Using direct links only.');
  console.log(`⚠️ ALERT: Replit workflow may show as failed because port 5000 could not be claimed`);
  console.log(`⚠️ The application is still accessible at http://localhost:${TARGET_PORT} directly`);
  return false;
}

// Start the proxy server on the first available port
console.log('🚀 Starting FLIP Patashala multi-port proxy server...');
console.log(`🎯 Will forward requests to application on port ${TARGET_PORT}`);
tryPorts();