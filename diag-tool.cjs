/**
 * FLIP Patashala Diagnostic Tool
 * 
 * This script analyzes the port environment, creates specialized
 * access files for the Replit environment, and provides detailed
 * diagnostics on port availability.
 */

const fs = require('fs');
const http = require('http');
const { exec } = require('child_process');

console.log("\n📊 FLIP Patashala Diagnostic Tool");
console.log("===============================\n");

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

// Get active processes on ports (Linux/Mac)
function getProcessesOnPorts() {
  return new Promise((resolve) => {
    exec('netstat -tlnp 2>/dev/null || ss -tlnp 2>/dev/null || lsof -i -P -n 2>/dev/null | grep LISTEN', (error, stdout) => {
      if (error) {
        resolve("Could not get process information");
        return;
      }
      resolve(stdout);
    });
  });
}

// Check for Replit-specific environment
function isReplitEnvironment() {
  return !!process.env.REPL_ID;
}

// Create specialized redirect for Replit
function createReplitRedirect(ports) {
  // Find the first available port
  const availablePort = ports.find(p => p.available)?.port || 3001;
  
  // Create special index.html and index-redirect.html
  const redirectHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>FLIP Patashala - Redirecting</title>
  <meta http-equiv="refresh" content="0;url=http://localhost:${availablePort}">
  <script>
    window.location.href = "http://localhost:${availablePort}";
  </script>
  <style>
    body {
      font-family: system-ui, sans-serif;
      text-align: center;
      margin: 2rem;
    }
    .btn {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 0.25rem;
      text-decoration: none;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <h1>FLIP Patashala</h1>
  <p>Redirecting to the application...</p>
  <a href="http://localhost:${availablePort}" class="btn">Go Now</a>
</body>
</html>`;

  fs.writeFileSync('index-redirect.html', redirectHtml);
  fs.writeFileSync('index.html', redirectHtml);
  
  console.log(`✅ Created specialized Replit redirects to port ${availablePort}`);
}

// Create specialized PORT-ACCESS.md guide
function createPortAccessGuide(ports) {
  const availablePorts = ports.filter(p => p.available).map(p => p.port);
  
  const guideContent = `# FLIP Patashala Port Access Guide

## Current Port Status

${ports.map(p => `- Port ${p.port}: ${p.available ? '✅ Available' : '❌ Unavailable'}${p.available ? ` (Status code: ${p.statusCode})` : ''}`).join('\n')}

## How to Access the Application

The application is currently running on the following ports:
${availablePorts.length > 0 ? availablePorts.map(port => `- http://localhost:${port}`).join('\n') : '- No available ports detected'}

## Quick Access Methods

1. **Direct URL** - Open one of these URLs in your browser:
   ${availablePorts.map(port => `- http://localhost:${port}`).join('\n   ')}

2. **Launch Script** - Run this in your terminal:
   \`\`\`
   ./start-flip.sh
   \`\`\`

3. **Multiple Port Connector** - Run this in your terminal:
   \`\`\`
   node direct-connector.cjs
   \`\`\`
   Then open \`connect.html\` in your browser.

## Troubleshooting

If you're experiencing issues accessing the application:

1. **Check Port Status** - Run the diagnostic tool:
   \`\`\`
   node diag-tool.cjs
   \`\`\`

2. **Use the Direct Connector** - Run:
   \`\`\`
   node direct-connector.cjs
   \`\`\`

3. **Try the Minimal Solution** - Run:
   \`\`\`
   node minimal-solution.cjs
   \`\`\`

## Technical Details

The FLIP Patashala application uses a multi-port strategy to ensure accessibility in the Replit environment:

- The main application typically runs on port 5001
- A proxy server typically runs on port 3001
- The application attempts to use port 3000 first, then falls back

For developers: The application is configured to automatically detect available ports and set up the necessary redirects.
`;

  fs.writeFileSync('PORT-ACCESS.md', guideContent);
  console.log('✅ Created PORT-ACCESS.md guide');
}

// Main function
async function main() {
  console.log("🔍 Checking environment...");
  const isReplit = isReplitEnvironment();
  console.log(`Environment: ${isReplit ? 'Replit' : 'Local'}`);
  
  console.log("\n🔍 Checking port status...");
  const ports = [
    await checkPort(3000),
    await checkPort(5000),
    await checkPort(5001),
    await checkPort(3001)
  ];
  
  ports.forEach(p => {
    console.log(`Port ${p.port}: ${p.available ? '✅ Available' : '❌ Unavailable'}${p.available ? ` (Status code: ${p.statusCode})` : ''}`);
  });
  
  console.log("\n🔍 Checking processes on ports...");
  const processInfo = await getProcessesOnPorts();
  console.log(processInfo || "No detailed process information available");
  
  if (isReplit) {
    console.log("\n🔧 Creating specialized Replit redirects...");
    createReplitRedirect(ports);
  }
  
  console.log("\n📝 Creating port access guide...");
  createPortAccessGuide(ports);
  
  // Create specialized cookie file to help debug session issues
  console.log("\n🔧 Creating specialized cookie debug file...");
  fs.writeFileSync('cookies.txt', `FLIP_PORT_DIAGNOSTICS=${JSON.stringify({
    timestamp: new Date().toISOString(),
    ports: ports.map(p => ({ port: p.port, available: p.available })),
    isReplit
  })}`);
  console.log("✅ Created cookies.txt debug file");
  
  console.log("\n✨ Diagnostic complete!");
  console.log("   Check PORT-ACCESS.md for detailed access instructions");
  
  // Create a simple launcher
  if (ports.some(p => p.available)) {
    const availablePort = ports.find(p => p.available).port;
    console.log(`\n🚀 You can access the application at: http://localhost:${availablePort}`);
  } else {
    console.log("\n❌ No available ports detected.");
    console.log("   Try running: npm run dev");
  }
}

// Run the main function
main();