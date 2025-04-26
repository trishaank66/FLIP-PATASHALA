/**
 * FLIP Patashala Minimal Solution
 * 
 * This script provides the simplest possible solution to
 * the port access issue by creating a minimal HTML file that
 * uses both client-side and meta redirect to port 3000.
 */

const fs = require('fs');

console.log("Creating Minimal Solution...");

// Create a super simple HTML file with multiple redirect mechanisms
const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=http://localhost:3000">
  <title>FLIP Patashala</title>
  <script>
    // Instant redirect
    window.location.href = "http://localhost:3000";
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
  <p>Redirecting to application...</p>
  <a href="http://localhost:3000">GO TO APP</a>
</body>
</html>`;

// Write to multiple files to ensure at least one works
fs.writeFileSync('index.html', html);
fs.writeFileSync('app.html', html);
fs.writeFileSync('redirect.html', html);

console.log("✅ Created redirect files");
console.log("✅ Updated index.html");

console.log("\nAccess the app in any of these ways:");
console.log("1. Refresh the web preview");
console.log("2. Open app.html");
console.log("3. Open redirect.html");
console.log("4. Go directly to: http://localhost:3000");