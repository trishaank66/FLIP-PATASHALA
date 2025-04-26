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
  </style>
</head>
<body>
  <h1>FLIP Patashala</h1>
  
  <div class="card">
    <h2>Web Preview Configuration</h2>
    <p>Replit's web preview needs to be configured to work with this application:</p>
    
    <div class="code">
      <strong>Option 1:</strong> Click the link below to open in a new tab:<br>
      <a href="https://3000-${process.env.REPL_SLUG}-${process.env.REPL_OWNER}.${process.env.REPL_SLUG}.repl.co" target="_blank" class="btn">
        Open App in New Tab
      </a>
    </div>
    
    <div class="code">
      <strong>Option 2:</strong> Use this URL in your browser:<br>
      <code>https://3000-${process.env.REPL_SLUG}-${process.env.REPL_OWNER}.${process.env.REPL_SLUG}.repl.co</code>
    </div>
  </div>
  
  <div class="card">
    <h2>Advanced Users</h2>
    <p>If you're developing in the Replit environment:</p>
    
    <div class="code">
      1. Check application status:<br>
      <code>$ node flip-launcher.cjs</code>
      <br><br>
      2. Get direct access to the app:<br>
      <code>$ ./start-flip.sh</code>
    </div>
  </div>
  
  <div class="port-note">
    <p>This application uses port 3000 for its main interface. Replit's web preview system can be used by specifically directing it to port 3000.</p>
  </div>
</body>
</html>`;

// Save the specialized index.html file
fs.writeFileSync('index.html', htmlContent);

console.log("✅ Created specialized web preview fix");
console.log("✅ You can now access the web preview directly");
console.log(`✅ Or use: https://3000-${process.env.REPL_SLUG}-${process.env.REPL_OWNER}.${process.env.REPL_SLUG}.repl.co`);

// Create .replit file if it doesn't exist
if (!fs.existsSync('.replit')) {
  const replitConfig = `run = "npm run dev"
entrypoint = "server/index.ts"
hidden = [".build", ".config"]

[nix]
channel = "stable-22_11"

[env]
PORT = "3000"
XDG_CONFIG_HOME = "/home/runner/.config"

[packager]
language = "nodejs"
  [packager.features]
  packageSearch = true
  guessImports = true
  enabledForHosting = false

[languages]

[languages.javascript]
pattern = "**/{*.js,*.jsx,*.ts,*.tsx}"

[languages.javascript.languageServer]
start = "typescript-language-server --stdio"

[deployment]
build = ["npm", "run", "build"]
run = ["node", "server/index.js"]
deploymentTarget = "cloudrun"

[unitTest]
language = "nodejs"

[debugger]
support = true

[debugger.interactive]
transport = "localhost:0"
startCommand = ["dap-node"]

[debugger.interactive.initializeMessage]
command = "initialize"
type = "request"

[debugger.interactive.initializeMessage.arguments]
clientID = "replit"
clientName = "replit.com"
columnsStartAt1 = true
linesStartAt1 = true
locale = "en-us"
pathFormat = "path"
supportsInvalidatedEvent = true
supportsProgressReporting = true
supportsRunInTerminalRequest = true
supportsVariablePaging = true
supportsVariableType = true

[debugger.interactive.launchMessage]
command = "launch"
type = "request"

[debugger.interactive.launchMessage.arguments]
console = "externalTerminal"
cwd = "."
pauseForSourceMap = false
program = "./index.js"
request = "launch"
sourceMaps = true
stopOnEntry = false
type = "pwa-node"

[auth]
pageEnabled = false
buttonEnabled = false`;

  fs.writeFileSync('.replit', replitConfig);
  console.log("✅ Created .replit configuration file");
}

// Add a gitignore entry to avoid overwriting our solution
if (!fs.existsSync('.gitignore')) {
  fs.writeFileSync('.gitignore', 'node_modules\n.DS_Store\n');
  console.log("✅ Created .gitignore file");
}

console.log("\n🎯 Web preview fix complete!");
console.log("   Refresh the web preview to see the changes");