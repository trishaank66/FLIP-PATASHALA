# FLIP Patashala Port Access Guide

## Current Port Status

- Port 3000: ✅ Available (Status code: 200)
- Port 5000: ✅ Available (Status code: 200)
- Port 5001: ❌ Unavailable
- Port 3001: ❌ Unavailable

## How to Access the Application

The application is currently running on the following ports:
- http://localhost:3000
- http://localhost:5000

## Quick Access Methods

1. **Direct URL** - Open one of these URLs in your browser:
   - http://localhost:3000
   - http://localhost:5000

2. **Launch Script** - Run this in your terminal:
   ```
   ./start-flip.sh
   ```

3. **Multiple Port Connector** - Run this in your terminal:
   ```
   node direct-connector.cjs
   ```
   Then open `connect.html` in your browser.

## Troubleshooting

If you're experiencing issues accessing the application:

1. **Check Port Status** - Run the diagnostic tool:
   ```
   node diag-tool.cjs
   ```

2. **Use the Direct Connector** - Run:
   ```
   node direct-connector.cjs
   ```

3. **Try the Minimal Solution** - Run:
   ```
   node minimal-solution.cjs
   ```

## Technical Details

The FLIP Patashala application uses a multi-port strategy to ensure accessibility in the Replit environment:

- The main application typically runs on port 5001
- A proxy server typically runs on port 3001
- The application attempts to use port 3000 first, then falls back

For developers: The application is configured to automatically detect available ports and set up the necessary redirects.
