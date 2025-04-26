"""
AI Insights Service for FLIP Patashala

This microservice analyzes user activity and department data to provide 
insightful recommendations for administrators.

Uses:
- Flask for API endpoints
- Pandas for data manipulation
- Scikit-learn for clustering and pattern recognition
- Claude API for intelligent recommendations
"""

import os
import json
from datetime import datetime
import flask
from flask import Flask, request, jsonify
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
import psycopg2
from psycopg2.extras import RealDictCursor
import anthropic

# Initialize Flask app
app = Flask(__name__)

# Ensure Flask binds to all interfaces
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5100, debug=True)

# Initialize Claude client with API key from environment
claude = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

# The newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
MODEL = "claude-3-7-sonnet-20250219"

# Database connection info from environment variables
DB_URL = os.environ.get("DATABASE_URL")

def get_db_connection():
    """Create a database connection."""
    return psycopg2.connect(DB_URL)

@app.route('/health', methods=['GET'])
def health_check():
    """Simple health check endpoint."""
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

@app.route('/insights', methods=['GET'])
def get_insights():
    """
    Main endpoint to generate AI insights for administrators.
    
    Returns insights about:
    - Department groups with similar patterns
    - Inactive user patterns
    - AI recommendations for improving engagement
    """
    try:
        # Connect to database
        conn = get_db_connection()
        
        # ===== STEP 1: Get department data =====
        dept_data = get_department_data(conn)
        if not dept_data or len(dept_data) < 2:  # Need at least 2 departments for meaningful analysis
            return jsonify({
                "error": "Insufficient department data for analysis",
                "insights": []
            })
        
        # ===== STEP 2: Group similar departments together =====
        department_groups = cluster_departments(dept_data)
        
        # ===== STEP 3: Get inactive user data =====
        inactive_data = get_inactive_users_data(conn)
        
        # ===== STEP 4: Get verification statistics =====
        verification_stats = get_verification_stats(conn)
        
        # ===== STEP 5: Generate insights with Claude =====
        ai_recommendations = generate_ai_recommendations(dept_data, department_groups, inactive_data, verification_stats)
        
        # Combine all insights
        insights = {
            "department_clusters": department_groups,
            "inactive_user_data": inactive_data,
            "verification_stats": verification_stats,
            "ai_recommendations": ai_recommendations
        }
        
        return jsonify({"insights": insights})
        
    except Exception as e:
        app.logger.error(f"Error generating insights: {str(e)}")
        return jsonify({"error": str(e), "insights": []})
    finally:
        if 'conn' in locals():
            conn.close()

def get_department_data(conn):
    """Get department data including user counts and activity metrics."""
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Get department data with counts of active users by role
        query = """
        SELECT 
            d.id, 
            d.name, 
            COUNT(CASE WHEN u.role = 'student' AND u.is_active = true THEN 1 END) as student_count,
            COUNT(CASE WHEN u.role = 'faculty' AND u.is_active = true THEN 1 END) as faculty_count,
            COUNT(CASE WHEN u.is_active = false THEN 1 END) as inactive_users,
            COUNT(CASE WHEN u.verification_pending = true THEN 1 END) as pending_verifications
        FROM 
            departments d
        LEFT JOIN 
            users u ON d.id = u.department_id
        GROUP BY 
            d.id, d.name
        ORDER BY 
            d.name
        """
        cursor.execute(query)
        departments = cursor.fetchall()
        return departments
    finally:
        cursor.close()

def cluster_departments(dept_data):
    """
    Group similar departments together based on their characteristics.
    
    Similarities based on:
    - Number of students
    - Number of faculty
    - Percentage of inactive users
    """
    # Prepare data for analysis
    df = pd.DataFrame(dept_data)
    
    # Add helpful calculations
    df['total_users'] = df['student_count'] + df['faculty_count'] + df['inactive_users']
    # Make sure we don't divide by zero
    df['inactive_ratio'] = df['inactive_users'] / df['total_users'].apply(lambda x: max(1, x))
    df['student_faculty_ratio'] = df['student_count'] / df['faculty_count'].apply(lambda x: max(1, x))
    
    # Select what we'll use to group departments
    features = df[['student_count', 'faculty_count', 'inactive_ratio']].copy()
    
    # Handle missing values
    features = features.fillna(0)
    
    # If we don't have enough departments, don't try to group them
    if len(features) < 2:
        return [{"department_id": int(row['id']), 
                 "department_name": row['name'], 
                 "cluster": 0,
                 "group_name": "All Departments",
                 "metrics": {
                     "student_count": int(row['student_count']),
                     "faculty_count": int(row['faculty_count']),
                     "inactive_users": int(row['inactive_users']),
                     "pending_verifications": int(row['pending_verifications'])
                 }
                } for i, row in df.iterrows()]
    
    # Normalize the data for fair comparison
    std = features.std()
    std = std.replace(0, 1)  # Avoid division by zero
    features = (features - features.mean()) / std
    
    # Determine how many groups to create (max 3 for simplicity)
    n_clusters = min(3, len(features))
    
    # Group similar departments using AI
    kmeans = KMeans(n_clusters=n_clusters, random_state=42)
    df['cluster'] = kmeans.fit_predict(features)
    
    # Create descriptive names for each group
    group_descriptions = {
        0: "Large Departments",
        1: "Medium Departments",
        2: "Small Departments"
    }
    
    # If we have actual data to determine better group names
    if n_clusters <= 3:
        # Calculate average student count for each cluster
        cluster_sizes = df.groupby('cluster')['student_count'].mean().to_dict()
        
        # Sort clusters by average student count
        sorted_clusters = sorted(cluster_sizes.items(), key=lambda x: x[1], reverse=True)
        
        # Assign descriptive names
        for i, (cluster_id, _) in enumerate(sorted_clusters):
            if i == 0:
                group_descriptions[cluster_id] = "Large Departments"
            elif i == 1 and n_clusters > 1:
                group_descriptions[cluster_id] = "Medium Departments"
            elif i == 2 and n_clusters > 2:
                group_descriptions[cluster_id] = "Small Departments"
    
    # Prepare easy-to-understand results
    cluster_results = []
    for i, row in df.iterrows():
        cluster_id = int(row['cluster'])
        cluster_results.append({
            "department_id": int(row['id']),
            "department_name": row['name'],
            "cluster": cluster_id,
            "group_name": group_descriptions.get(cluster_id, f"Group {cluster_id+1}"),
            "metrics": {
                "student_count": int(row['student_count']),
                "faculty_count": int(row['faculty_count']),
                "inactive_users": int(row['inactive_users']),
                "pending_verifications": int(row['pending_verifications'])
            }
        })
    
    return cluster_results

def get_inactive_users_data(conn):
    """Get data about inactive users for analysis."""
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        query = """
        SELECT 
            u.role,
            d.name as department_name,
            COUNT(*) as count
        FROM 
            users u
        LEFT JOIN 
            departments d ON u.department_id = d.id
        WHERE 
            u.is_active = false
        GROUP BY 
            u.role, d.name
        ORDER BY 
            count DESC
        """
        cursor.execute(query)
        inactive_data = cursor.fetchall()
        return inactive_data
    finally:
        cursor.close()

def get_verification_stats(conn):
    """Get verification statistics."""
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        query = """
        SELECT 
            role, 
            COUNT(CASE WHEN verification_pending = true THEN 1 END) as pending_count,
            COUNT(CASE WHEN verification_pending = false THEN 1 END) as verified_count,
            COUNT(*) as total_count
        FROM 
            users
        WHERE 
            is_active = true
        GROUP BY 
            role
        """
        cursor.execute(query)
        stats = cursor.fetchall()
        return stats
    finally:
        cursor.close()

def generate_ai_recommendations(dept_data, clusters, inactive_data, verification_stats):
    """
    Use Claude to generate intelligent recommendations based on analyzed data.
    """
    # Format data for Claude prompt
    dept_summary = "\n".join([
        f"- {d['name']}: {d['student_count']} students, {d['faculty_count']} faculty, {d['inactive_users']} inactive users"
        for d in dept_data
    ])
    
    cluster_summary = {}
    for c in clusters:
        cluster_id = c['cluster']
        if cluster_id not in cluster_summary:
            cluster_summary[cluster_id] = []
        cluster_summary[cluster_id].append(c['department_name'])
    
    cluster_text = "\n".join([
        f"- Cluster {k}: {', '.join(v)}" for k, v in cluster_summary.items()
    ])
    
    inactive_summary = "\n".join([
        f"- {d['role']} in {d['department_name'] or 'No Department'}: {d['count']} inactive users"
        for d in inactive_data
    ])
    
    verification_summary = "\n".join([
        f"- {s['role']}: {s['pending_count']} pending, {s['verified_count']} verified (total: {s['total_count']})"
        for s in verification_stats
    ])
    
    # Construct prompt for Claude
    prompt = f"""You are an AI advisor for university administrators using FLIP Patashala, an educational management platform. 
Based on the following data, provide simple, practical insights and recommendations that even a non-technical person can understand.

DEPARTMENT SUMMARY:
{dept_summary}

DEPARTMENT GROUPS (departments with similar patterns):
{cluster_text}

INACTIVE USERS SUMMARY:
{inactive_summary}

VERIFICATION STATUS:
{verification_summary}

Please structure your response with these clear sections (use these exact headings):

# Department Insights
- Provide 1-2 simple observations about department patterns
- Use everyday language a school administrator would understand
- Explain what the department groupings mean in practical terms

# Student Engagement Tips
- Provide 1-2 practical suggestions to address inactive users
- Focus on actionable steps to improve student participation
- Keep suggestions realistic for school administrators

# Verification Improvements
- Provide 1-2 easy ways to improve the verification process
- Suggest practical changes that can be implemented quickly
- Focus on improving user experience

# Quick Wins
- Provide 1-2 simple changes that would have immediate positive impact
- Focus on administrative efficiencies that are easy to implement
- Suggest changes that would be noticed by faculty and students

Write for a non-technical audience using simple, everyday language. Avoid technical terms and explain concepts in ways that relate to school management. Each bullet point should be 1-2 sentences maximum."""

    try:
        # Call Claude API
        response = claude.messages.create(
            model=MODEL,
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        # Extract and return the recommendations
        recommendations = response.content[0].text.strip()
        return recommendations
    except Exception as e:
        app.logger.error(f"Error generating AI recommendations: {str(e)}")
        return "Unable to generate AI recommendations at this time. Please try again later."

if __name__ == '__main__':
    # Start Flask app
    app.run(debug=True, host='0.0.0.0', port=5100)