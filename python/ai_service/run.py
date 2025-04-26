"""
Runner script for AI insights service
"""

import os
import subprocess
import signal
import sys

def run_flask_app():
    """Run the Flask app in the background."""
    try:
        # Set the port for the Flask app
        os.environ['PORT'] = '5001'
        
        # Get the DATABASE_URL from the environment
        os.environ['DATABASE_URL'] = os.environ.get('DATABASE_URL', '')
        
        # Make sure the ANTHROPIC_API_KEY is available
        if not os.environ.get('ANTHROPIC_API_KEY'):
            print("Error: ANTHROPIC_API_KEY environment variable is not set")
            sys.exit(1)
        
        # Start the Flask app in the background
        print("Starting Flask AI insights service on port 5001...")
        process = subprocess.Popen(
            ['python3', 'python/ai_service/app.py'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Print process ID for debugging
        print(f"Flask process started with PID: {process.pid}")
        
        # Keep the script running
        try:
            # Wait for termination signal
            process.wait()
        except KeyboardInterrupt:
            # Handle CTRL+C gracefully
            process.terminate()
            print("\nFlask AI insights service terminated.")
            sys.exit(0)
    
    except Exception as e:
        print(f"Error running Flask app: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Handle SIGTERM
    def handle_sigterm(sig, frame):
        print("\nReceived SIGTERM. Shutting down...")
        sys.exit(0)
    
    signal.signal(signal.SIGTERM, handle_sigterm)
    
    # Run the Flask app
    run_flask_app()