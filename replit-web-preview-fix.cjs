/**
 * FLIP Patashala Replit Web Preview Fix
 * 
 * This script creates a lightweight HTML file that properly handles 
 * Replit's web preview environment constraints.
 */

const fs = require('fs');

console.log("Creating Replit Web Preview Fix...");

// Create a super simple HTML file specifically for Replit web preview
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FLIP Patashala</title>
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
    .code {
      background: #f1f5f9;
      padding: 15px;
      border-radius: 5px;
      font-family: monospace;
      text-align: left;
      margin: 15px 0;
      overflow-x: auto;
    }
    .port-note {
      font-size: 14px;
      color: #666;
      margin-top: 20px;
      background: #f8fafc;
      padding: 10px;
      border-radius: 5px;
    }
    iframe {
      width: 100%;
      height: 0;
      border: 0;
    }
  </style>
  <script>
    // Function to attempt to open multiple possible ports
    function tryConnectToApp() {
      const ports = [3000, 5001, 3001, 5000];
      let foundPort = false;
      
      ports.forEach(port => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = \`http://localhost:\${port}\`;
        iframe.onload = () => {
          if (!foundPort) {
            foundPort = true;
            // Redirect to the port that worked
            window.location.href = \`http://localhost:\${port}\`;
          }
        };
        document.body.appendChild(iframe);
      });
    }
    
    // Execute connection attempts on page load
    window.addEventListener('load', tryConnectToApp);
  </script>
</head>
<body>
  <h1>FLIP Patashala</h1>
  
  <div class="card">
    <h2>Accessing the Application</h2>
    <p>The application is running on one of these ports:</p>
    
    <div class="code">
      <a href="http://localhost:3000" target="_blank" class="btn">Port 3000 (Primary)</a>
      <a href="http://localhost:5001" target="_blank" class="btn" style="background:#4b5563">Port 5001 (Alternate)</a>
    </div>
  </div>
  
  <div class="card">
    <h2>Having Trouble?</h2>
    <p>Try one of these solutions:</p>
    
    <div class="code">
      1. Run the port launcher:<br>
      <code>$ node flip-launcher.cjs</code>
      <br><br>
      2. Use the quick start script:<br>
      <code>$ ./start-flip.sh</code>
      <br><br>
      3. Open the generated access file:<br>
      <code>$ open launch.html</code>
    </div>
  </div>
  
  <div class="port-note">
    <p>This page will automatically try to detect and connect to the running application.</p>
    <p>If automatic detection fails, use the buttons above to try specific ports.</p>
  </div>
  
  <!-- Hidden iframes for port detection (don't remove) -->
  <iframe id="port3000" src="about:blank"></iframe>
  <iframe id="port5001" src="about:blank"></iframe>
</body>
</html>`;

// Save the specialized index.html file
fs.writeFileSync('index.html', htmlContent);

console.log("✅ Created specialized web preview index.html");

// Create standalone web-preview.html file
fs.writeFileSync('web-preview.html', htmlContent);
console.log("✅ Created web-preview.html (use this as a backup)");

// Create another web preview page with a simpler approach
const simpleHtmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>FLIP Patashala - Direct Access</title>
  <style>
    body {
      font-family: sans-serif;
      margin: 40px auto;
      max-width: 650px;
      line-height: 1.6;
      padding: 0 10px;
      text-align: center;
    }
    .btn {
      display: inline-block;
      background: #4338ca;
      color: white;
      padding: 10px 20px;
      margin: 10px;
      text-decoration: none;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <h1>FLIP Patashala</h1>
  <p>Click one of the links below to access the application:</p>
  <p>
    <a href="http://localhost:3000" target="_blank" class="btn">Access via Port 3000</a>
    <a href="http://localhost:5001" target="_blank" class="btn">Access via Port 5001</a>
  </p>
  <p><small>If the buttons don't work, use the terminal to run: <code>node flip-launcher.cjs</code></small></p>
</body>
</html>`;

fs.writeFileSync('direct-access.html', simpleHtmlContent);
console.log("✅ Created direct-access.html");

console.log("\n🎯 Web preview fix complete!");
console.log("   Refresh the web preview to see the changes");