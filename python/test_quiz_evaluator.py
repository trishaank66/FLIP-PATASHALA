#!/usr/bin/env python3

"""
Test script for the quiz evaluator functionality
"""

import os
import sys
import json

# Ensure we can import from the current directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from quiz_evaluator import calculate_score, analyze_misconceptions, generate_personalized_feedback
    
    # Test data - sample quiz questions and student answers
    quiz_questions = [
        {
            "question": "What is the capital of France?",
            "options": ["Berlin", "Madrid", "Paris", "Rome"],
            "correctIndex": 2,
            "explanation": "Paris is the capital city of France."
        },
        {
            "question": "Which planet is known as the Red Planet?",
            "options": ["Venus", "Mars", "Jupiter", "Saturn"],
            "correctIndex": 1,
            "explanation": "Mars is known as the Red Planet due to its reddish appearance."
        },
        {
            "question": "Who developed the theory of relativity?",
            "options": ["Isaac Newton", "Albert Einstein", "Nikola Tesla", "Marie Curie"],
            "correctIndex": 1,
            "explanation": "Albert Einstein developed the theory of relativity in the early 20th century."
        }
    ]
    
    # Student got first and third questions correct, second question wrong
    student_answers = [2, 0, 1]
    
    print("Testing score calculation...")
    score = calculate_score(student_answers, quiz_questions)
    print(f"Score: {score * 100:.1f}%")
    
    print("\nTesting misconception analysis...")
    misconceptions = analyze_misconceptions(student_answers, quiz_questions)
    print(f"Found {len(misconceptions)} misconceptions:")
    print(json.dumps(misconceptions, indent=2))
    
    print("\nTesting personalized feedback generation...")
    print("This will use the Anthropic API - please ensure ANTHROPIC_API_KEY is set.")
    
    try:
        feedback = generate_personalized_feedback(
            "Test Student",
            "General Knowledge",
            score,
            misconceptions
        )
        
        print("Generated feedback:")
        print(json.dumps(feedback, indent=2))
        print("\nTest successful!")
        
    except Exception as e:
        print(f"Error generating feedback: {str(e)}")
    
except ImportError as e:
    print(f"Error importing quiz_evaluator: {str(e)}")