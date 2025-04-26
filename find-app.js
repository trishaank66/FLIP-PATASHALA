/**
 * FLIP Patashala Port Finder
 * 
 * This script scans for running instances of the application
 * and creates a redirect file to the working port.
 */

// Use ESM style imports for .js files
import http from 'http';
import fs from 'fs';

console.log("\n🔍 FLIP Patashala Port Finder");
console.log("==========================\n");

// Function to check if a port is available
function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: '/',
      method: 'HEAD',
      timeout: 2000
    }, (res) => {
      console.log(`✅ Port ${port} is responding (status: ${res.statusCode})`);
      resolve({ port, available: true, statusCode: res.statusCode });
    });
    
    req.on('error', () => {
      console.log(`❌ Port ${port} is not available`);
      resolve({ port, available: false });
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.log(`❌ Port ${port} timed out`);
      resolve({ port, available: false });
    });
    
    req.end();
  });
}

// Function to create a redirect file pointing to the working port
function createRedirectFile(port) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=http://localhost:${port}">
  <title>FLIP Patashala</title>
  <script>
    window.addEventListener('load', function() {
      window.location.href = 'http://localhost:${port}';
    });
  </script>
  <style>
    body {
      font-family: sans-serif;
      text-align: center;
      margin: 3rem;
      line-height: 1.5;
    }
    h1 { color: #2563eb; }
    .btn {
      display: inline-block;
      background: #2563eb;
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      text-decoration: none;
      margin-top: 1rem;
    }
    .loading {
      width: 30px;
      height: 30px;
      border: 3px solid rgba(0,0,0,.1);
      border-radius: 50%;
      border-top-color: #2563eb;
      animation: spin 1s ease infinite;
      margin: 20px auto;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <h1>FLIP Patashala</h1>
  <div class="loading"></div>
  <p>Redirecting to port ${port}...</p>
  <p>If you're not redirected automatically, click below:</p>
  <a href="http://localhost:${port}" class="btn">Go to Application</a>
  
  <div style="margin-top: 40px; font-size: 0.9rem; color: #666;">
    <p>Having trouble? Try one of these options:</p>
    <p>
      <a href="http://localhost:3000">Port 3000</a> | 
      <a href="http://localhost:5000">Port 5000</a> | 
      <a href="http://localhost:5001">Port 5001</a> | 
      <a href="http://localhost:3001">Port 3001</a>
    </p>
  </div>
</body>
</html>`;

  // Use multiple files to ensure at least one works
  fs.writeFileSync('web-preview.html', html);
  fs.writeFileSync('index.html', html);
  
  console.log(`✅ Created redirect files to port ${port}`);
}

// Main function to check ports and create redirect
async function findWorkingPort() {
  console.log("Scanning for active ports...");
  
  // Check common ports in priority order
  const portsToCheck = [3000, 5000, 5001, 3001];
  let workingPort = null;
  
  for (const port of portsToCheck) {
    const result = await checkPort(port);
    if (result.available) {
      workingPort = port;
      break;
    }
  }
  
  if (workingPort) {
    console.log(`\n✅ Found working port: ${workingPort}`);
    createRedirectFile(workingPort);
    console.log(`\n🚀 You can access the application at: http://localhost:${workingPort}`);
    console.log("   Or open web-preview.html in your browser");
  } else {
    console.log("\n❌ No working ports found.");
    console.log("Try starting the application with:");
    console.log("npm run dev");
  }
}

// Execute the function
findWorkingPort();