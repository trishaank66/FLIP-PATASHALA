"""
Main entry point for the AI Tip Service

This module launches the FastAPI server for AI tip generation.
"""

import uvicorn
from .api import app

if __name__ == "__main__":
    # Run the API server
    uvicorn.run(app, host="0.0.0.0", port=8000)