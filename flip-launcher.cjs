#!/usr/bin/env node

/**
 * FLIP Patashala Advanced Port Management System
 * 
 * This utility provides a comprehensive solution for accessing the application
 * regardless of port conflicts in the Replit environment.
 * 
 * Features:
 * - Intelligent port scanning with retry mechanism
 * - Checks for Vite dev server and Express API separately
 * - Creates optimized access files
 * - Handles Replit-specific environment challenges
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("\n🚀 FLIP Patashala Advanced Port Management System");
console.log("=============================================\n");

// Configuration
const PORTS_TO_CHECK = [3000, 5001, 3001, 5000, 8080, 4000];
const TIMEOUT_MS = 3000;
const RETRY_COUNT = 3;
const RETRY_DELAY_MS = 1000;
const LAUNCH_FILE = 'launch.html'; 

// Port scanning with retries
async function checkPortWithRetry(port, retries = RETRY_COUNT) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await checkPort(port);
      if (result.available) {
        return result;
      }
      // Only log retry message if we're going to retry
      if (attempt < retries) {
        console.log(`  Port ${port} check attempt ${attempt} failed, retrying...`);
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    } catch (err) {
      if (attempt < retries) {
        console.log(`  Error checking port ${port}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }
  return { port, available: false };
}

// Check individual port
function checkPort(port) {
  console.log(`⏳ Testing port ${port}...`);
  return new Promise((resolve) => {
    const req = http.request({
      method: 'HEAD',
      hostname: 'localhost',
      port: port,
      path: '/',
      timeout: TIMEOUT_MS
    }, (res) => {
      // Check for expected headers to determine if it's our app
      const isViteDevServer = res.headers['server']?.includes('vite') || 
                               res.headers['x-vite-dev-server-id'];
      const isExpressServer = res.headers['x-powered-by']?.includes('Express');
      
      resolve({
        port,
        available: true,
        statusCode: res.statusCode,
        isViteDevServer,
        isExpressServer,
        headers: res.headers
      });
    });
    
    req.on('error', () => {
      resolve({ port, available: false });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ port, available: false });
    });
    
    req.end();
  });
}

// Create optimized launch file
function createLaunchFile(port, details = {}) {
  console.log(`\n📝 Creating optimized launcher for port ${port}...`);
  
  // Determine what kind of server we're connecting to
  let serverType = "Application";
  if (details.isViteDevServer) serverType = "Vite Development Server";
  if (details.isExpressServer) serverType = "Express API Server";
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=http://localhost:${port}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FLIP Patashala - Launch Portal</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      max-width: 600px;
      margin: 40px auto;
      padding: 20px;
      text-align: center;
      background-color: #f8fafc;
      color: #334155;
      line-height: 1.6;
    }
    h1 {
      color: #2563eb;
      margin-bottom: 10px;
    }
    .status-card {
      background-color: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      padding: 20px;
      margin: 20px 0;
    }
    .loader {
      display: inline-block;
      width: 40px;
      height: 40px;
      border: 5px solid #e2e8f0;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 1s ease-in-out infinite;
      margin: 20px 0;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .btn {
      display: inline-block;
      background-color: #3b82f6;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 500;
      margin-top: 20px;
      transition: all 0.2s;
    }
    .btn:hover {
      background-color: #1d4ed8;
      transform: translateY(-2px);
    }
    .server-badge {
      display: inline-block;
      background-color: #dbeafe;
      color: #1e40af;
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 14px;
      margin-top: 10px;
    }
    .details {
      margin-top: 20px;
      font-size: 14px;
      color: #64748b;
    }
    .details pre {
      text-align: left;
      background: #f1f5f9;
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
    }
  </style>
  <script>
    // Auto-navigate after short delay
    setTimeout(() => {
      window.location.href = "http://localhost:${port}";
    }, 1500);
    
    // Track if we successfully navigated
    let hasNavigated = false;
    
    // Check if the port is still available
    async function checkPortStatus() {
      if (hasNavigated) return;
      
      try {
        const response = await fetch("http://localhost:${port}", {
          method: 'HEAD',
          cache: 'no-store',
          mode: 'no-cors'
        });
        
        // If we got here, the port is still available
        document.getElementById('status').textContent = "Connected! Redirecting...";
        document.getElementById('statusIndicator').style.color = "#10b981";
      } catch (error) {
        // Port is no longer available
        document.getElementById('status').textContent = "Connection lost! Please restart the application.";
        document.getElementById('statusIndicator').style.color = "#ef4444";
        document.getElementById('redirectMsg').style.display = 'none';
        document.getElementById('errorMsg').style.display = 'block';
      }
    }
    
    // Record that navigation happened
    function markAsNavigated() {
      hasNavigated = true;
    }
    
    // Start checking port status
    window.addEventListener('load', () => {
      checkPortStatus();
      // Check every 3 seconds
      setInterval(checkPortStatus, 3000);
    });
    
    // Mark as navigated when leaving
    window.addEventListener('beforeunload', markAsNavigated);
  </script>
</head>
<body>
  <h1>FLIP Patashala</h1>
  <div class="status-card">
    <div class="server-badge">${serverType}</div>
    <div class="loader"></div>
    <h2 id="statusIndicator" style="color: #10b981;">✓ Port ${port} is active</h2>
    <p id="status">Connected! Redirecting to application...</p>
    
    <div id="redirectMsg">
      <p>You'll be automatically redirected in a moment.</p>
      <a href="http://localhost:${port}" class="btn" onclick="markAsNavigated()">Launch Application Now</a>
    </div>
    
    <div id="errorMsg" style="display: none;">
      <p style="color: #ef4444;">The application server is no longer responding.</p>
      <button class="btn" onclick="window.location.reload()" style="background-color: #6b7280;">
        Retry Connection
      </button>
    </div>
  </div>
  
  <div class="details">
    <p>Application running on port ${port} with status code ${details.statusCode || 'unknown'}</p>
    <p>If you need to restart the server, run the following command in the terminal:</p>
    <pre>node flip-launcher.cjs</pre>
  </div>
</body>
</html>`;

  fs.writeFileSync(LAUNCH_FILE, html);
  console.log(`✅ Created ${LAUNCH_FILE} - redirecting to port ${port}`);
  
  // Also update index.html as a simple direct redirect
  try {
    const indexContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=http://localhost:${port}">
  <title>FLIP Patashala</title>
  <script>window.location.href = "http://localhost:${port}";</script>
</head>
<body>
  <p>Redirecting to FLIP Patashala...</p>
  <p>If you are not redirected, <a href="http://localhost:${port}">click here</a> or open <a href="${LAUNCH_FILE}">${LAUNCH_FILE}</a>.</p>
</body>
</html>`;

    fs.writeFileSync('index.html', indexContent);
    console.log(`✅ Updated index.html to redirect to port ${port}`);
  } catch (err) {
    console.log(`⚠️ Could not update index.html, but ${LAUNCH_FILE} will work`);
  }
}

// Create an "app is not running" helper file
function createNotRunningHelper() {
  console.log("\n❌ No active application ports were found");
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FLIP Patashala - Application Not Running</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      max-width: 600px;
      margin: 40px auto;
      padding: 20px;
      text-align: center;
      background-color: #f8fafc;
      color: #334155;
      line-height: 1.6;
    }
    h1 {
      color: #2563eb;
      margin-bottom: 10px;
    }
    .card {
      background-color: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      padding: 20px;
      margin: 20px 0;
    }
    .status-icon {
      font-size: 48px;
      margin: 20px 0;
    }
    .btn {
      display: inline-block;
      background-color: #3b82f6;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 500;
      margin-top: 20px;
      transition: all 0.2s;
    }
    .btn:hover {
      background-color: #1d4ed8;
      transform: translateY(-2px);
    }
    .steps {
      text-align: left;
      background: #f1f5f9;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .steps ol {
      margin-left: 20px;
      padding-left: 0;
    }
    .steps li {
      margin-bottom: 10px;
    }
    .code {
      background: #e2e8f0;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <h1>FLIP Patashala</h1>
  
  <div class="card">
    <div class="status-icon">⚠️</div>
    <h2>Application Not Running</h2>
    <p>The FLIP Patashala application doesn't seem to be running.</p>
    
    <div class="steps">
      <h3>How to start the application:</h3>
      <ol>
        <li>Go to the Replit workflow panel (sidebar)</li>
        <li>Click on "Start application" to run the workflow</li>
        <li>Wait for the application to start (may take a minute)</li>
        <li>Run <span class="code">node flip-launcher.cjs</span> to find the active port</li>
        <li>Open the <span class="code">launch.html</span> file that gets created</li>
      </ol>
    </div>
    
    <button class="btn" onclick="window.location.reload()">
      Check Again
    </button>
  </div>
</body>
</html>`;

  fs.writeFileSync(LAUNCH_FILE, html);
  console.log(`✅ Created ${LAUNCH_FILE} with troubleshooting information`);
  
  // Also update index.html with basic troubleshooting
  try {
    const indexContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>FLIP Patashala - Not Running</title>
</head>
<body>
  <h1>FLIP Patashala</h1>
  <p>The application doesn't appear to be running.</p>
  <p>Please restart the application workflow and then run: <code>node flip-launcher.cjs</code></p>
  <p>For detailed instructions, open <a href="${LAUNCH_FILE}">${LAUNCH_FILE}</a>.</p>
</body>
</html>`;

    fs.writeFileSync('index.html', indexContent);
    console.log(`✅ Updated index.html with troubleshooting information`);
  } catch (err) {
    console.log(`⚠️ Could not update index.html, but ${LAUNCH_FILE} will work`);
  }
}

// Try to free up ports that might be in use
async function tryToFreePort(port) {
  console.log(`\n🔄 Attempting to free port ${port}...`);
  
  try {
    // Try different approaches based on platform
    if (process.platform === 'win32') {
      execSync(`netstat -ano | findstr :${port} | findstr LISTENING`);
    } else {
      // For Linux/macOS
      execSync(`lsof -i :${port} | grep LISTEN`);
      execSync(`pkill -f "node.*${port}"`, { stdio: 'ignore' });
    }
    console.log(`✅ Commands to free port ${port} completed`);
    
    // Verify if port was freed
    await new Promise(resolve => setTimeout(resolve, 1000));
    const checkResult = await checkPort(port);
    
    if (!checkResult.available) {
      console.log(`✅ Successfully freed port ${port}`);
      return true;
    } else {
      console.log(`❌ Port ${port} is still in use`);
      return false;
    }
  } catch (error) {
    console.log(`⚠️ No process found using port ${port} or unable to kill`);
    return false;
  }
}

// Main function
async function main() {
  console.log("🔍 Scanning for active application ports...");
  
  // Check all ports in parallel with retry
  const results = await Promise.all(
    PORTS_TO_CHECK.map(port => checkPortWithRetry(port))
  );
  
  // Filter to find available ports
  const availablePorts = results.filter(result => result.available);
  
  if (availablePorts.length > 0) {
    // Sort by priority (using the order in PORTS_TO_CHECK)
    availablePorts.sort((a, b) => 
      PORTS_TO_CHECK.indexOf(a.port) - PORTS_TO_CHECK.indexOf(b.port)
    );
    
    const bestPort = availablePorts[0];
    
    console.log(`\n✅ Found working application on port ${bestPort.port}!`);
    console.log(`   Status code: ${bestPort.statusCode || 'unknown'}`);
    
    if (bestPort.isViteDevServer) console.log("   Server type: Vite Development Server");
    if (bestPort.isExpressServer) console.log("   Server type: Express API Server");
    
    // Create optimized launch file
    createLaunchFile(bestPort.port, bestPort);
    
    console.log("\n🎯 Access the application via:");
    console.log(`   1. Open ${LAUNCH_FILE} (recommended)`);
    console.log(`   2. Direct URL: http://localhost:${bestPort.port}`);
    console.log(`   3. Open index.html (also updated)`);
    
    return true;
  } else {
    // No ports available - let's try to free common ports
    const attemptedFree = await tryToFreePort(3000);
    if (attemptedFree) {
      console.log("Retrying port scan after attempting to free ports...");
      
      // Check if port 3000 is now available
      const retryCheck = await checkPortWithRetry(3000, 1);
      if (retryCheck.available) {
        console.log(`\n✅ Successfully freed and connected to port 3000!`);
        createLaunchFile(3000, retryCheck);
        
        console.log("\n🎯 Access the application via:");
        console.log(`   1. Open ${LAUNCH_FILE} (recommended)`);
        console.log(`   2. Direct URL: http://localhost:3000`);
        
        return true;
      }
    }
    
    // Create a helper file since the app isn't running
    createNotRunningHelper();
    
    console.log("\n📋 Troubleshooting steps:");
    console.log("   1. Start the application workflow in Replit");
    console.log("   2. Wait for the server to start up completely");
    console.log("   3. Run this tool again: node flip-launcher.cjs");
    
    return false;
  }
}

// Run the program
main()
  .then(success => {
    if (success) {
      console.log("\n✨ Port management completed successfully!");
    } else {
      console.log("\n⚠️ Application does not appear to be running!");
    }
  })
  .catch(err => {
    console.error("An error occurred:", err);
  });