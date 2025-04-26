"""
AI Tip Service API

This module provides FastAPI endpoints for generating AI-based tips
and insights for the Interactive Learning module.
"""

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from pydantic import BaseModel, Field

from .tip_generator import TipGenerator

# Initialize FastAPI app
app = FastAPI(title="AI Tip Service API", 
              description="API for generating personalized educational tips")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to your actual domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection parameters from environment variables
DB_HOST = os.environ.get("PGHOST", "localhost")
DB_PORT = os.environ.get("PGPORT", "5432")
DB_NAME = os.environ.get("PGDATABASE", "postgres")
DB_USER = os.environ.get("PGUSER", "postgres")
DB_PASS = os.environ.get("PGPASSWORD", "postgres")

# Pydantic models for API
class TipRequest(BaseModel):
    user_id: int
    user_role: Optional[str] = None
    
class ClassInsightRequest(BaseModel):
    department_id: Optional[int] = None
    subject: Optional[str] = None
    faculty_id: int
    
class Tip(BaseModel):
    content: str
    type: str
    priority: int = Field(1, ge=1, le=5)
    relevance_score: float = Field(0.7, ge=0, le=1)
    action_link: Optional[str] = None
    context: Optional[str] = None
    ui_style: str = "standard"
    related_content: Optional[List[Dict[str, Any]]] = None
    
class TipResponse(BaseModel):
    tips: List[Tip]
    user_id: int
    
class ClassInsightResponse(BaseModel):
    insights: Dict[str, Any]
    department_id: Optional[int] = None
    subject: Optional[str] = None
    faculty_id: int
    
class SystemOverviewResponse(BaseModel):
    overview: Dict[str, Any]

# Database connection function
def get_db_connection():
    """Create a connection to the PostgreSQL database"""
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            cursor_factory=RealDictCursor
        )
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        raise HTTPException(status_code=500, detail="Database connection error")

# Create TipGenerator instance with DB connection
def get_tip_generator(conn=Depends(get_db_connection)):
    """Create and return a TipGenerator instance with DB connection"""
    try:
        generator = TipGenerator(conn)
        yield generator
    finally:
        conn.close()

# API endpoints
@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

@app.post("/generate-tip", response_model=TipResponse)
def generate_tip(
    request: TipRequest,
    tip_generator: TipGenerator = Depends(get_tip_generator)
):
    """
    Generate personalized tips for a user
    
    Args:
        request: TipRequest with user_id and optional user_role
        tip_generator: TipGenerator instance
        
    Returns:
        List of generated tips
    """
    try:
        tips = tip_generator.generate_tips_for_user(
            request.user_id, 
            request.user_role
        )
        
        return {
            "tips": tips,
            "user_id": request.user_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating tips: {str(e)}")

@app.post("/analyze-class", response_model=ClassInsightResponse)
def analyze_class(
    request: ClassInsightRequest,
    tip_generator: TipGenerator = Depends(get_tip_generator)
):
    """
    Generate insights for a class/department
    
    Args:
        request: ClassInsightRequest with department_id, subject, and faculty_id
        tip_generator: TipGenerator instance
        
    Returns:
        Insights about the class
    """
    try:
        insights = tip_generator.generate_tips_for_class(
            request.department_id,
            request.subject
        )
        
        return {
            "insights": insights,
            "department_id": request.department_id,
            "subject": request.subject,
            "faculty_id": request.faculty_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing class: {str(e)}")

@app.get("/system-overview", response_model=SystemOverviewResponse)
def system_overview(
    tip_generator: TipGenerator = Depends(get_tip_generator)
):
    """
    Generate system-wide overview for administrators
    
    Args:
        tip_generator: TipGenerator instance
        
    Returns:
        System-wide insights
    """
    try:
        overview = tip_generator.generate_system_overview()
        
        return {
            "overview": overview
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating system overview: {str(e)}")

# Run the API server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)