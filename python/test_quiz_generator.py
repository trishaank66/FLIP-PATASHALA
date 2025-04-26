#!/usr/bin/env python3

"""
Test script for the quiz generator functionality
"""

import os
import sys
import json

# Ensure we can import from the current directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from quiz_generator import generate_questions, extract_key_sentences
    
    # Test content
    sample_content = """
    The Python programming language was created by Guido van Rossum and first released in 1991.
    Python is an interpreted, high-level, general-purpose programming language that emphasizes code readability.
    Its language constructs and object-oriented approach aim to help programmers write clear, logical code.
    Python features a dynamic type system and automatic memory management and supports multiple programming paradigms.
    These include structured, object-oriented, and functional programming.
    Python is often described as a "batteries included" language due to its comprehensive standard library.
    """
    
    print("Testing extract_key_sentences...")
    key_sentences = extract_key_sentences(sample_content, num_sentences=3)
    print(f"Extracted {len(key_sentences)} key sentences:")
    for i, sentence in enumerate(key_sentences):
        print(f"{i+1}. {sentence.strip()}")
    
    print("\nTesting generate_questions...")
    print("This will use the Anthropic API - please ensure ANTHROPIC_API_KEY is set.")
    
    try:
        questions = generate_questions(
            sample_content,
            subject="Computer Science",
            difficulty="Medium",
            num_questions=2  # Only generate 2 questions for quick testing
        )
        
        print(f"Generated {len(questions)} questions:")
        print(json.dumps(questions, indent=2))
        print("\nTest successful!")
        
    except Exception as e:
        print(f"Error generating questions: {str(e)}")
    
except ImportError as e:
    print(f"Error importing quiz_generator: {str(e)}")