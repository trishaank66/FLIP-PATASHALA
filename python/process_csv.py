#!/usr/bin/env python3
"""
CSV Processing Script for Student Data

This script uses pandas to process CSV data for student synchronization.
It validates the data, performs basic data cleansing, and outputs a 
standardized JSON format.
"""

import pandas as pd
import json
import sys
import os
from typing import Dict, List, Optional, Any

def validate_student_data(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Validates the student data DataFrame and returns validation results.
    
    Args:
        df: pandas DataFrame containing student data
        
    Returns:
        Dictionary with validation results including valid records and errors
    """
    # Initialize result structure
    result = {
        "valid_records": [],
        "errors": []
    }
    
    if df.empty:
        return result
    
    # Check required columns
    required_columns = ['email', 'student_id']
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        # If required columns are missing, return error with no valid records
        result["errors"].append({
            "email": "N/A",
            "reason": f"CSV file is missing required columns: {', '.join(missing_columns)}"
        })
        return result
    
    # Process each row
    for idx, row in df.iterrows():
        # Skip rows with missing required fields
        if pd.isna(row['email']) or pd.isna(row['student_id']):
            result["errors"].append({
                "email": row.get('email', 'N/A') if not pd.isna(row.get('email', 'N/A')) else 'N/A',
                "reason": "Missing required field (email or student_id)"
            })
            continue
        
        # Validate email format
        email = str(row['email']).strip()
        if '@' not in email or '.' not in email:
            result["errors"].append({
                "email": email,
                "reason": "Invalid email format"
            })
            continue
        
        # Prepare student record
        student_record = {
            "email": email,
            "student_id": str(row['student_id']).strip(),
            "department_name": str(row['department_name']).strip() if 'department_name' in row and not pd.isna(row['department_name']) else None,
            "first_name": str(row['first_name']).strip() if 'first_name' in row and not pd.isna(row['first_name']) else None,
            "last_name": str(row['last_name']).strip() if 'last_name' in row and not pd.isna(row['last_name']) else None
        }
        
        result["valid_records"].append(student_record)
    
    return result

def process_csv_file(file_path: str) -> Dict[str, Any]:
    """
    Processes a CSV file containing student data.
    
    Args:
        file_path: Path to the CSV file
        
    Returns:
        Dictionary with processing results
    """
    try:
        # Check if file exists
        if not os.path.exists(file_path):
            return {
                "success": False,
                "error": f"File not found: {file_path}",
                "valid_records": [],
                "errors": [{
                    "email": "N/A",
                    "reason": f"File not found: {file_path}"
                }]
            }
        
        # Read the CSV file
        df = pd.read_csv(file_path)
        
        # Clean column names (strip whitespace, lowercase)
        df.columns = [col.strip().lower() for col in df.columns]
        
        # Validate the data
        validation_result = validate_student_data(df)
        
        return {
            "success": True,
            "valid_records": validation_result["valid_records"],
            "errors": validation_result["errors"],
            "total_records": len(df),
            "valid_count": len(validation_result["valid_records"]),
            "error_count": len(validation_result["errors"])
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "valid_records": [],
            "errors": [{
                "email": "N/A",
                "reason": f"Error processing CSV: {str(e)}"
            }]
        }

def process_csv_content(csv_content: str) -> Dict[str, Any]:
    """
    Processes CSV content as a string.
    
    Args:
        csv_content: CSV content as a string
        
    Returns:
        Dictionary with processing results
    """
    try:
        # Read CSV from string
        import io
        df = pd.read_csv(io.StringIO(csv_content))
        
        # Clean column names (strip whitespace, lowercase)
        df.columns = [col.strip().lower() for col in df.columns]
        
        # Validate the data
        validation_result = validate_student_data(df)
        
        return {
            "success": True,
            "valid_records": validation_result["valid_records"],
            "errors": validation_result["errors"],
            "total_records": len(df),
            "valid_count": len(validation_result["valid_records"]),
            "error_count": len(validation_result["errors"])
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "valid_records": [],
            "errors": [{
                "email": "N/A",
                "reason": f"Error processing CSV content: {str(e)}"
            }]
        }

def main():
    """Main entry point for the script when run from command line."""
    # Check command line arguments
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "No file path provided",
            "valid_records": [],
            "errors": [{
                "email": "N/A",
                "reason": "No file path provided"
            }]
        }))
        sys.exit(1)
    
    file_path = sys.argv[1]
    result = process_csv_file(file_path)
    
    # Output result as JSON to stdout
    print(json.dumps(result))

if __name__ == "__main__":
    main()