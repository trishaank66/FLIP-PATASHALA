#!/bin/bash

# FLIP Patashala Quick Start Script
# =================================
# This script provides a one-click solution to start the application
# and automatically open it in a web browser.

echo -e "\n\033[1m🚀 FLIP Patashala Quick Start\033[0m"
echo -e "==============================\n"

# Function to check if a port is available
check_port() {
  local port=$1
  local response
  response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port 2>/dev/null || echo "error")
  
  if [[ "$response" != "error" && "$response" != "000" ]]; then
    return 0  # Port is available
  else
    return 1  # Port is not available
  fi
}

# Function to find the active port
find_active_port() {
  local ports=(3000 5001 3001 5000)
  local active_port=""
  
  echo -e "\033[1m🔍 Finding active port...\033[0m"
  
  for port in "${ports[@]}"; do
    echo -e "   Checking port \033[36m$port\033[0m..."
    if check_port "$port"; then
      echo -e "   ✅ Found active application on port \033[32m$port\033[0m"
      active_port=$port
      break
    fi
  done
  
  if [[ -z "$active_port" ]]; then
    echo -e "\n\033[31m❌ No active ports found.\033[0m"
    echo -e "   Starting the application..."
    
    # Try to start the application
    echo -e "   Running \033[33mnpm run dev\033[0m in the background..."
    npm run dev > /dev/null 2>&1 &
    
    # Wait for the application to start
    echo -e "   Waiting for the application to start up..."
    for i in {1..10}; do
      sleep 2
      echo -e "   Attempt $i: Checking if application has started..."
      
      for port in "${ports[@]}"; do
        if check_port "$port"; then
          echo -e "   ✅ Application started on port \033[32m$port\033[0m"
          active_port=$port
          break 2
        fi
      done
    done
  fi
  
  echo "$active_port"
}

# Main script
active_port=$(find_active_port)

if [[ -n "$active_port" ]]; then
  echo -e "\n\033[1m🌐 Opening application in browser...\033[0m"
  
  # Create a launch.html file for reliable access
  cat > launch.html << EOF
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=http://localhost:$active_port">
  <title>FLIP Patashala - Launching</title>
  <style>
    body {
      font-family: sans-serif;
      max-width: 500px;
      margin: 40px auto;
      padding: 20px;
      text-align: center;
      line-height: 1.6;
    }
    h1 { color: #2563eb; }
    .spinner {
      width: 40px;
      height: 40px;
      margin: 20px auto;
      border: 4px solid rgba(0,0,0,.1);
      border-left-color: #2563eb;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .btn {
      display: inline-block;
      background: #2563eb;
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      text-decoration: none;
      margin-top: 20px;
    }
  </style>
  <script>
    window.addEventListener('load', function() {
      window.location.href = 'http://localhost:$active_port';
    });
  </script>
</head>
<body>
  <h1>FLIP Patashala</h1>
  <div class="spinner"></div>
  <p>Launching your application on port $active_port...</p>
  <p>If you are not redirected automatically, click the button below:</p>
  <a href="http://localhost:$active_port" class="btn">Launch Application</a>
</body>
</html>
EOF
  
  echo -e "   ✅ Created \033[36mlaunch.html\033[0m for reliable access"
  
  # Try to open the browser (platform dependent)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open "http://localhost:$active_port" || open "launch.html"
    echo -e "   ✅ Opened in browser"
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    xdg-open "http://localhost:$active_port" 2>/dev/null || xdg-open "launch.html" 2>/dev/null || \
    echo -e "   ℹ️  Please open \033[36mhttp://localhost:$active_port\033[0m in your browser"
  else
    # Windows or other
    echo -e "   ℹ️  Please open \033[36mhttp://localhost:$active_port\033[0m in your browser"
  fi
  
  echo -e "\n\033[1m✨ Success! FLIP Patashala is ready.\033[0m"
  echo -e "   Access your application at: \033[36mhttp://localhost:$active_port\033[0m"
  echo -e "   Or open the \033[36mlaunch.html\033[0m file in your browser\n"
else
  echo -e "\n\033[31m❌ Failed to start or find the application.\033[0m"
  echo -e "   Try running \033[33mnpm run dev\033[0m manually\n"
fi