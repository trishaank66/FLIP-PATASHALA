#!/usr/bin/env python3
"""
Content Access Synchronization Script

This script synchronizes student data from the User Authentication module
to provide appropriate content access in the Content Management module.
It maps students to departments and ensures they have access to the right content.
"""

import pandas as pd
import json
import sys
import os
from typing import Dict, List, Any, Optional

def sync_content_access(student_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Maps students to their department content access.
    
    Args:
        student_data: List of student records with department information
        
    Returns:
        Dictionary with synchronization results
    """
    # Initialize result structure
    result = {
        "success": True,
        "synced_students": [],
        "errors": [],
        "summary": {
            "total": len(student_data),
            "synced": 0,
            "error": 0,
            "by_department": {}
        }
    }
    
    if not student_data:
        result["success"] = False
        result["errors"].append({
            "email": "N/A",
            "reason": "No student data provided"
        })
        return result
    
    # Process each student and assign content access based on department
    department_counts = {}
    
    for student in student_data:
        try:
            email = student.get("email")
            student_id = student.get("student_id")
            department_name = student.get("department_name")
            
            # Basic validation
            if not email or not student_id:
                result["errors"].append({
                    "email": email or "N/A",
                    "reason": "Missing required fields (email or student_id)"
                })
                result["summary"]["error"] += 1
                continue
                
            if not department_name:
                result["errors"].append({
                    "email": email,
                    "reason": "No department specified for content access"
                })
                result["summary"]["error"] += 1
                continue
            
            # Record the sync action
            sync_record = {
                "email": email,
                "student_id": student_id,
                "department_name": department_name,
                "subjects_faculty": f"{department_name} - All Faculty"  # This format can be adjusted as needed
            }
            
            # Update counters
            if department_name not in department_counts:
                department_counts[department_name] = 0
            department_counts[department_name] += 1
            
            result["synced_students"].append(sync_record)
            result["summary"]["synced"] += 1
            
        except Exception as e:
            result["errors"].append({
                "email": student.get("email", "N/A"),
                "reason": f"Error during sync: {str(e)}"
            })
            result["summary"]["error"] += 1
    
    # Add department statistics
    result["summary"]["by_department"] = {
        dept: {"count": count} for dept, count in department_counts.items()
    }
    
    return result

def process_student_csv(csv_content: str) -> Dict[str, Any]:
    """
    Processes CSV content and syncs student content access.
    
    Args:
        csv_content: CSV content as a string
        
    Returns:
        Dictionary with processing and sync results
    """
    try:
        # Process the CSV content using the existing function
        import io
        df = pd.read_csv(io.StringIO(csv_content))
        
        # Clean column names (strip whitespace, lowercase)
        df.columns = [col.strip().lower() for col in df.columns]
        
        # Convert DataFrame to list of dictionaries
        students = df.fillna("").to_dict(orient="records")
        
        # Sync content access
        sync_result = sync_content_access(students)
        
        return sync_result
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "synced_students": [],
            "errors": [{
                "email": "N/A",
                "reason": f"Error processing CSV content: {str(e)}"
            }],
            "summary": {
                "total": 0,
                "synced": 0,
                "error": 1,
                "by_department": {}
            }
        }

def main():
    """Main entry point for the script when run from command line."""
    # Check if JSON input is provided via stdin
    try:
        # Read JSON input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # If CSV content is provided directly
        if "csv_content" in input_data:
            result = process_student_csv(input_data["csv_content"])
            print(json.dumps(result))
            return
        
        # If student data is already provided as structured data
        if "student_data" in input_data:
            result = sync_content_access(input_data["student_data"])
            print(json.dumps(result))
            return
            
        print(json.dumps({
            "success": False,
            "error": "Invalid input format. Expected 'csv_content' or 'student_data'",
            "synced_students": [],
            "errors": [{
                "email": "N/A",
                "reason": "Invalid input format"
            }],
            "summary": {
                "total": 0,
                "synced": 0,
                "error": 1,
                "by_department": {}
            }
        }))
    
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "synced_students": [],
            "errors": [{
                "email": "N/A",
                "reason": f"Error in processing: {str(e)}"
            }],
            "summary": {
                "total": 0,
                "synced": 0,
                "error": 1,
                "by_department": {}
            }
        }))

if __name__ == "__main__":
    main()