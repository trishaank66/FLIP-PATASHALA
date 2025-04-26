import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Setup request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Global variable to track server initialization
const globalAny = global as any;
globalAny.__serverInitialized = false;

(async () => {
  // Attempt to kill any processes using port 5000
  try {
    if (process.platform === 'linux') {
      log('Checking for and killing any processes using port 5000...');
      const { execSync } = require('child_process');
      // Find and kill any process using port 5000
      execSync('fuser -k 5000/tcp 2>/dev/null || true');
      log('Cleared port 5000');
    }
  } catch (error) {
    log('Could not kill previous processes, continuing anyway');
  }

  const server = await registerRoutes(app);

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  // Vite setup for development, static files for production
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Check for --port flag in command line arguments
  const portArgIndex = process.argv.findIndex(arg => arg === '--port');
  const defaultPort = portArgIndex >= 0 && process.argv[portArgIndex + 1] 
    ? parseInt(process.argv[portArgIndex + 1], 10) 
    : 3000; // Changed default to 3000 since we know this works
  
  // IMPORTANT: For Replit's workflow system, we need to ensure the application is accessible.
  // Port 5000 is expected by Replit's workflow system, but is often already in use.
  // We'll prioritize port 3000 for our application and rely on the proxy server
  // to handle port 5000 or alternate ports if needed.
  const portsToTry = [
    3000,  // Make 3000 the primary port for our application - this works most reliably
    5001,  // Alternate backup port
    8080,  // Additional fallback
    4000,  // Additional fallback 
    5000   // Try 5000 last since it's consistently unavailable in this environment
  ];
  
  // Function to start the server on an available port
  const startServer = async () => {
    // Try each port in sequence
    for (let i = 0; i < portsToTry.length; i++) {
      const port = portsToTry[i];
      
      try {
        // Check if port is available using net module
        const portAvailable = await new Promise<boolean>((resolve) => {
          // Use dynamic import instead of require
          import('net').then(net => {
            const tester = net.createServer()
              .once('error', async () => {
                log(`Port ${port} is already in use, attempting to free it...`);
                
                // If this is port 5000, try to forcefully free it
                if (port === 5000 && process.platform === 'linux') {
                  try {
                    // Try to kill any process using the port
                    const { execSync } = await import('child_process');
                    execSync('fuser -k 5000/tcp 2>/dev/null || true');
                    log('Forcefully cleared port 5000, retrying...');
                    
                    // Wait a moment for the port to be released
                    setTimeout(() => {
                      // Try again
                      const retryTester = net.createServer()
                        .once('error', () => {
                          log(`Port ${port} is still in use after attempt to free it, trying next port...`);
                          resolve(false);
                        })
                        .once('listening', () => {
                          retryTester.close(() => resolve(true));
                        })
                        .listen(port, '0.0.0.0');
                    }, 1000);
                    return;
                  } catch (error) {
                    log(`Failed to forcefully free port 5000: ${(error as Error).message}`);
                  }
                }
                
                log(`Port ${port} is already in use, trying next port...`);
                resolve(false);
              })
              .once('listening', () => {
                tester.close(() => resolve(true));
              })
              .listen(port, '0.0.0.0');
          }).catch(err => {
            log(`Error testing port: ${err.message}`);
            resolve(false);
          });
        });
        
        if (!portAvailable) continue;
        
        // Port is available, start the server
        server.listen(port, '0.0.0.0', () => {
          // Only initialize once
          if (!globalAny.__serverInitialized) {
            globalAny.__serverInitialized = true;
            globalAny.__serverPort = port;
            
            log(`Server running on http://0.0.0.0:${port}`);
            log(`Local access via: http://localhost:${port}`);
            log(`External access via port ${port}`);
            
            // Always start the multi-port proxy server to ensure Replit workflows work
            try {
              log(`Setting up resilient multi-port proxy server...`);
              
              // Start our enhanced multi-port proxy server in a separate process
              import('child_process').then(({ spawn }) => {
                log('Launching resilient proxy process...');
                // Pass the actual server port as an environment variable
                const proxyProcess = spawn('node', ['proxy-server.cjs'], {
                  stdio: ['inherit', 'inherit', 'inherit'],
                  detached: true,
                  env: { 
                    ...process.env,
                    TARGET_PORT: port.toString()
                  }
                });
                
                proxyProcess.on('error', (err) => {
                  log(`Error starting proxy process: ${err.message}`);
                });
                
                // Don't wait for the proxy to exit
                proxyProcess.unref();
                
                log(`Launched multi-port proxy server in a separate process`);
              }).catch(error => {
                log(`Failed to spawn proxy process: ${error.message}`);
              });
            } catch (error) {
              log(`Failed to set up multi-port proxy server: ${(error as Error).message}`);
            }
            
            // Initialize WebSocket server
            import('./websocket-manager')
              .then(({ WebSocketManager }) => {
                if (!WebSocketManager.isInitialized()) {
                  WebSocketManager.initialize(server);
                  log("WebSocket server initialized for real-time polls and notifications");
                }
              })
              .catch((wsError: Error) => {
                log(`Warning: WebSocket initialization failed: ${wsError.message}`);
                log("Real-time features may be limited, but the application will continue to function");
              });
          }
        });
        
        // Server started successfully
        return;
      } catch (error) {
        log(`Error starting server on port ${port}: ${(error as Error).message}`);
        // Continue to next port
      }
    }
    
    // If we get here, all ports failed
    log(`All ports are in use. Please restart the application or specify a different port.`);
    process.exit(1);
  };
  
  // Start the server
  await startServer();
})();
