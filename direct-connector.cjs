/**
 * FLIP Patashala Direct Connector
 * 
 * This script creates a specialized index.html file that uses
 * advanced techniques to connect directly to the application,
 * bypassing Replit's web preview limitations.
 */

const fs = require('fs');
const http = require('http');
const { exec } = require('child_process');

console.log("\n🔌 FLIP Patashala Direct Connector");
console.log("===============================\n");

// Get Replit environment information
function getReplitInfo() {
  return {
    slug: process.env.REPL_SLUG || 'unknown-repl',
    owner: process.env.REPL_OWNER || 'unknown-user',
    id: process.env.REPL_ID || 'unknown-id'
  };
}

// Function to check if a port is available
function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port,
      path: '/',
      method: 'HEAD',
      timeout: 2000
    }, (res) => {
      resolve({ port, available: true, statusCode: res.statusCode });
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

// Function to determine the best approach based on environment testing
async function determineApproach() {
  console.log("🔍 Testing environment conditions...");
  
  const port3000 = await checkPort(3000);
  const port5001 = await checkPort(5001);
  const port3001 = await checkPort(3001);
  
  // Check if we're in Replit environment
  const isReplit = !!process.env.REPL_ID;
  
  if (port3000.available) {
    console.log("✅ Port 3000 is available - Primary app port detected");
    return { port: 3000, approach: "direct" };
  } else if (port5001.available) {
    console.log("✅ Port 5001 is available - Alternate app port detected");
    return { port: 5001, approach: "direct" };
  } else if (port3001.available) {
    console.log("✅ Port 3001 is available - Proxy port detected");
    return { port: 3001, approach: "direct" };
  } else {
    console.log("⚠️ No active ports detected - Using multi-approach");
    return { approach: "multi" };
  }
}

// Create the advanced connector HTML file
function createConnectorFile(config) {
  console.log(`\n📝 Creating improved web connector...`);
  
  const replit = getReplitInfo();
  
  // Different based on the detected approach
  let htmlContent;
  
  if (config.approach === "direct") {
    htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FLIP Patashala - Direct Connect</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      text-align: center;
      line-height: 1.6;
      color: #333;
    }
    .card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      padding: 20px;
      margin: 20px 0;
    }
    h1 { 
      color: #2563eb;
      margin-bottom: 10px;
    }
    .btn {
      display: inline-block;
      background: #2563eb;
      color: white;
      padding: 12px 24px;
      border-radius: 5px;
      text-decoration: none;
      font-weight: 500;
      margin: 10px 5px;
      transition: 0.3s;
    }
    .btn:hover {
      background: #1d4ed8;
      transform: translateY(-2px);
    }
    .status {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      margin-left: 5px;
    }
    .status.active {
      background: #dcfce7;
      color: #166534;
    }
    .redirect-notice {
      background: #f0f9ff;
      padding: 10px;
      border-radius: 5px;
      margin: 20px 0;
    }
    .redirect-timer {
      font-weight: bold;
      color: #2563eb;
    }
    iframe {
      display: none;
    }
  </style>
  <script>
    // Auto-redirect with countdown
    let secondsLeft = 5;
    
    function updateCountdown() {
      const timerElement = document.getElementById('redirectTimer');
      if (timerElement) {
        timerElement.textContent = secondsLeft;
        
        if (secondsLeft <= 0) {
          window.location.href = "http://localhost:${config.port}";
        } else {
          secondsLeft--;
          setTimeout(updateCountdown, 1000);
        }
      }
    }
    
    window.addEventListener('load', () => {
      updateCountdown();
    });
  </script>
</head>
<body>
  <h1>FLIP Patashala</h1>
  
  <div class="card">
    <h2>Direct Connection Available</h2>
    <p>We've detected the application running on port ${config.port}.</p>
    
    <div class="redirect-notice">
      <p>Redirecting you automatically in <span id="redirectTimer" class="redirect-timer">5</span> seconds...</p>
    </div>
    
    <a href="http://localhost:${config.port}" class="btn">Connect Now</a>
  </div>
</body>
</html>`;
  } else {
    // Multi-approach for when we're not sure which port is active
    htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FLIP Patashala - Connection Hub</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      text-align: center;
      line-height: 1.6;
      color: #333;
    }
    .card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      padding: 20px;
      margin: 20px 0;
    }
    h1 { 
      color: #2563eb;
      margin-bottom: 10px;
    }
    .btn {
      display: inline-block;
      background: #2563eb;
      color: white;
      padding: 12px 24px;
      border-radius: 5px;
      text-decoration: none;
      font-weight: 500;
      margin: 10px 5px;
      transition: 0.3s;
    }
    .btn:hover {
      background: #1d4ed8;
      transform: translateY(-2px);
    }
    .btn.secondary {
      background: #4b5563;
    }
    .status {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      margin-left: 5px;
    }
    .status.checking {
      background: #fef3c7;
      color: #92400e;
    }
    .status.active {
      background: #dcfce7;
      color: #166534;
    }
    .status.inactive {
      background: #fee2e2;
      color: #b91c1c;
    }
    .ports-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .port-card {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 15px;
      transition: 0.3s;
    }
    .port-card:hover {
      border-color: #bfdbfe;
      transform: translateY(-2px);
    }
    .port-number {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 5px;
    }
    .port-type {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 10px;
    }
    .helper-text {
      font-size: 14px;
      color: #6b7280;
      margin-top: 5px;
    }
    .code {
      background: #f1f5f9;
      padding: 12px;
      border-radius: 5px;
      font-family: monospace;
      text-align: left;
      margin: 10px 0;
      overflow-x: auto;
    }
    iframe {
      display: none;
    }
  </style>
  <script>
    // Port checking functionality
    async function checkPort(port, elementId) {
      const statusElement = document.getElementById('status-' + elementId);
      const btnElement = document.getElementById('btn-' + elementId);
      
      if (statusElement) {
        statusElement.textContent = 'Checking...';
        statusElement.className = 'status checking';
      }
      
      try {
        // Create a hidden iframe to test the connection
        const frameId = 'frame-' + port;
        let frame = document.getElementById(frameId);
        
        if (!frame) {
          frame = document.createElement('iframe');
          frame.id = frameId;
          frame.style.display = 'none';
          document.body.appendChild(frame);
        }
        
        // Set a timeout for the connection attempt
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 2000);
        });
        
        // Try to load the page in the iframe
        const loadPromise = new Promise((resolve) => {
          frame.onload = () => resolve(true);
          frame.onerror = () => resolve(false);
          frame.src = 'http://localhost:' + port;
        });
        
        // Race the promises
        const result = await Promise.race([loadPromise, timeoutPromise])
          .catch(() => false);
        
        if (result) {
          if (statusElement) {
            statusElement.textContent = 'Active';
            statusElement.className = 'status active';
          }
          if (btnElement) {
            btnElement.style.opacity = '1';
            btnElement.style.pointerEvents = 'auto';
          }
          return true;
        } else {
          if (statusElement) {
            statusElement.textContent = 'Not Available';
            statusElement.className = 'status inactive';
          }
          if (btnElement) {
            btnElement.style.opacity = '0.5';
            btnElement.style.pointerEvents = 'none';
          }
          return false;
        }
      } catch (error) {
        if (statusElement) {
          statusElement.textContent = 'Error';
          statusElement.className = 'status inactive';
        }
        if (btnElement) {
          btnElement.style.opacity = '0.5';
          btnElement.style.pointerEvents = 'none';
        }
        return false;
      }
    }
    
    // Check all ports on page load
    window.addEventListener('load', async () => {
      // Check ports in parallel
      const port3000Available = await checkPort(3000, 'port3000');
      const port5001Available = await checkPort(5001, 'port5001');
      const port3001Available = await checkPort(3001, 'port3001');
      
      // Auto-redirect to first available port
      if (port3000Available) {
        window.location.href = 'http://localhost:3000';
      } else if (port5001Available) {
        window.location.href = 'http://localhost:5001';
      } else if (port3001Available) {
        window.location.href = 'http://localhost:3001';
      }
    });
  </script>
</head>
<body>
  <h1>FLIP Patashala</h1>
  
  <div class="card">
    <h2>Connection Hub</h2>
    <p>Connect to the application using one of the available ports:</p>
    
    <div class="ports-grid">
      <div class="port-card">
        <div class="port-number">3000</div>
        <div class="port-type">Primary Port</div>
        <span id="status-port3000" class="status checking">Checking...</span>
        <div class="helper-text">The main application port</div>
        <a href="http://localhost:3000" id="btn-port3000" class="btn">Connect</a>
      </div>
      
      <div class="port-card">
        <div class="port-number">5001</div>
        <div class="port-type">Alternate Port</div>
        <span id="status-port5001" class="status checking">Checking...</span>
        <div class="helper-text">Fallback application port</div>
        <a href="http://localhost:5001" id="btn-port5001" class="btn secondary">Connect</a>
      </div>
      
      <div class="port-card">
        <div class="port-number">3001</div>
        <div class="port-type">Proxy Port</div>
        <span id="status-port3001" class="status checking">Checking...</span>
        <div class="helper-text">Port forwarding service</div>
        <a href="http://localhost:3001" id="btn-port3001" class="btn secondary">Connect</a>
      </div>
    </div>
  </div>
  
  <div class="card">
    <h2>Need Help?</h2>
    <p>If you're having trouble connecting, try these solutions:</p>
    
    <div class="code">
      # Auto-detect the best port and create launcher
      node flip-launcher.cjs
      
      # One-click solution to start and connect
      ./start-flip.sh
    </div>
  </div>
</body>
</html>`;
  }
  
  // Write the main connector file
  fs.writeFileSync('connect.html', htmlContent);
  console.log("✅ Created connect.html");
  
  // Also update index.html to be our connector
  fs.writeFileSync('index.html', htmlContent);
  console.log("✅ Updated index.html");
  
  return true;
}

// Main function
async function main() {
  const config = await determineApproach();
  createConnectorFile(config);
  
  console.log("\n🎯 Direct connector is ready!");
  console.log("   Open connect.html or index.html to access the application");
  console.log("   You can also go directly to: http://localhost:3000");
}

// Run the main function
main();