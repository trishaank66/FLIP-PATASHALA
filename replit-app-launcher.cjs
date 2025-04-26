/**
 * FLIP Patashala Replit App Launcher
 * 
 * This script creates a simplified launcher that directly 
 * opens the right port in the Replit environment.
 */

const fs = require('fs');
const http = require('http');
const { exec } = require('child_process');

console.log("\n🚀 FLIP Patashala Replit App Launcher");
console.log("===================================\n");

// Check active ports
async function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: '/',
      method: 'HEAD',
      timeout: 2000
    }, (res) => {
      console.log(`✅ Port ${port} is active (status: ${res.statusCode})`);
      resolve(true);
    });
    
    req.on('error', () => {
      console.log(`❌ Port ${port} is not available`);
      resolve(false);
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.log(`❌ Port ${port} timed out`);
      resolve(false);
    });
    
    req.end();
  });
}

// Create an extremely simple HTML launcher
function createSimpleLauncher(port) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=http://localhost:${port}">
  <title>FLIP Patashala</title>
  <script>
    window.location.href = "http://localhost:${port}";
  </script>
  <style>
    body {
      font-family: sans-serif;
      text-align: center;
      margin: 40px;
    }
    a {
      display: inline-block;
      margin: 20px;
      padding: 10px 20px;
      background: blue;
      color: white;
      text-decoration: none;
      border-radius: 5px;
    }
  </style>
</head>
<body>
  <h1>FLIP Patashala</h1>
  <p>Redirecting to port ${port}...</p>
  <a href="http://localhost:${port}">GO TO APP</a>
</body>
</html>`;

  // Write to multiple files to ensure at least one works
  fs.writeFileSync('go-to-app.html', html);
  fs.writeFileSync('app.html', html);
  
  // Also update index.html and index-redirect.html
  fs.writeFileSync('index.html', html);
  fs.writeFileSync('index-redirect.html', html);
  
  console.log(`✅ Created redirect files to port ${port}`);
}

// Main function
async function main() {
  console.log("🔍 Checking for active ports...");
  
  // Try ports in this order (based on what we've seen in the logs)
  const portsToTry = [3001, 5001, 3000, 5000];
  let activePort = null;
  
  for (const port of portsToTry) {
    const isActive = await checkPort(port);
    if (isActive) {
      activePort = port;
      break;
    }
  }
  
  if (!activePort) {
    console.log("\n❌ No active ports detected");
    console.log("Try starting the application with: npm run dev");
    return;
  }
  
  console.log(`\n✅ Found active port: ${activePort}`);
  console.log("Creating simplified launcher...");
  
  createSimpleLauncher(activePort);
  
  console.log("\n🎯 Launcher ready!");
  console.log(`You can access the application at: http://localhost:${activePort}`);
  console.log("Or open one of these files in your browser:");
  console.log("- go-to-app.html");
  console.log("- app.html");
}

// Run main function
main();