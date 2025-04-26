"""
Quiz Evaluator for Interactive Learning Module

This script evaluates student quiz attempts and provides personalized feedback
using the Anthropic API for more nuanced understanding of student responses.
"""

import os
import json
import anthropic

# Ensure NLTK resources are downloaded
import nltk
nltk.download('punkt')
nltk.download('stopwords')
nltk.download('punkt_tab')

# Initialize Anthropic client
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    raise ValueError("ANTHROPIC_API_KEY environment variable is not set")

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

def calculate_score(student_answers, quiz_questions):
    """
    Calculate a basic score based on correct answers, supporting different question types.
    
    Args:
        student_answers (list): List of student answers (indices for MCQ/T/F, or text for short answer)
        quiz_questions (list): List of question objects with different types
        
    Returns:
        float: Score as a percentage (0.0 to 1.0)
    """
    if not student_answers or not quiz_questions:
        return 0.0
    
    total_questions = len(quiz_questions)
    correct_count = 0
    
    for i, answer in enumerate(student_answers):
        if i >= total_questions:
            break
            
        question = quiz_questions[i]
        question_type = question.get("type", "mcq")  # Default to MCQ if type not specified
        
        if question_type == "mcq" or question_type == "true_false":
            # For multiple choice or true/false questions, check if index matches
            if isinstance(answer, int) and "correctIndex" in question and answer == question["correctIndex"]:
                correct_count += 1
                
        elif question_type == "short_answer":
            # For short answer questions, use basic text matching
            # In a real app, we'd use more sophisticated text comparison
            if "correctAnswer" in question and isinstance(answer, str):
                student_ans = answer.strip().lower()
                correct_ans = question["correctAnswer"].strip().lower()
                
                # Check if the student's answer contains key words from the correct answer
                # This is a very basic approach - in production, use NLP or better matching
                if student_ans == correct_ans or correct_ans in student_ans or student_ans in correct_ans:
                    correct_count += 1
    
    # Calculate score as percentage
    return correct_count / total_questions

def analyze_misconceptions(student_answers, quiz_questions):
    """
    Analyze student's misconceptions based on incorrect answers, supporting different question types.
    
    Args:
        student_answers (list): List of student answers (indices for MCQ/T/F, or text for short answer)
        quiz_questions (list): List of question objects with different types
        
    Returns:
        list: List of misconception objects
    """
    misconceptions = []
    
    for i, answer in enumerate(student_answers):
        if i >= len(quiz_questions):
            break
            
        question = quiz_questions[i]
        question_type = question.get("type", "mcq")  # Default to MCQ if type not specified
        
        # Check if answer is incorrect based on question type
        is_correct = False
        
        if question_type == "mcq" or question_type == "true_false":
            # For multiple choice or true/false questions
            if isinstance(answer, int) and "correctIndex" in question:
                is_correct = (answer == question["correctIndex"])
                
                if not is_correct:
                    # Get student's answer text
                    student_answer_text = (
                        question["options"][answer] if 0 <= answer < len(question["options"]) 
                        else "No answer"
                    )
                    
                    # Get correct answer text
                    correct_answer_text = (
                        question["options"][question["correctIndex"]] 
                        if 0 <= question["correctIndex"] < len(question["options"])
                        else "Unknown"
                    )
                    
                    misconceptions.append({
                        "questionIndex": i,
                        "questionType": question_type,
                        "question": question["question"],
                        "studentAnswer": student_answer_text,
                        "correctAnswer": correct_answer_text,
                        "explanation": question["explanation"]
                    })
                    
        elif question_type == "short_answer":
            # For short answer questions
            if "correctAnswer" in question and isinstance(answer, str):
                student_ans = answer.strip().lower()
                correct_ans = question["correctAnswer"].strip().lower()
                
                # Basic text matching - in production, use NLP or better matching
                is_correct = (student_ans == correct_ans or correct_ans in student_ans or student_ans in correct_ans)
                
                if not is_correct:
                    misconceptions.append({
                        "questionIndex": i,
                        "questionType": question_type,
                        "question": question["question"],
                        "studentAnswer": answer,
                        "correctAnswer": question["correctAnswer"],
                        "explanation": question["explanation"]
                    })
    
    return misconceptions

def generate_personalized_feedback(student_name, subject, score, misconceptions):
    """
    Generate personalized feedback for a student based on their performance.
    
    Args:
        student_name (str): Student's name
        subject (str): Subject of the quiz
        score (float): Score as a percentage (0.0 to 1.0)
        misconceptions (list): List of misconception objects
        
    Returns:
        dict: Feedback object with recommendations and personalized message
    """
    try:
        # If no misconceptions, provide general positive feedback
        if not misconceptions:
            return {
                "personalMessage": f"Great job, {student_name}! You've mastered this material on {subject}.",
                "improvementAreas": [],
                "recommendedResources": []
            }
        
        # For more nuanced feedback, use Anthropic API
        prompt = f"""As an educational AI tutor, provide personalized feedback for {student_name} who took a quiz on {subject}.
Their score was {score*100:.1f}%.

Here are the questions they answered incorrectly:
"""
        
        # Add misconception details to prompt
        for i, m in enumerate(misconceptions):
            prompt += f"""
Question {i+1}: {m['question']}
Student's answer: {m['studentAnswer']}
Correct answer: {m['correctAnswer']}
Explanation: {m['explanation']}
"""
        
        prompt += """
Based on these misconceptions, provide:
1. A personalized, encouraging message (1-2 sentences)
2. 2-3 specific improvement areas
3. 2-3 recommended learning resources or activities

Format your response as a JSON object with these keys:
- personalMessage: string
- improvementAreas: array of strings
- recommendedResources: array of strings

JSON only, no additional text."""

        # Call Anthropic API for personalized feedback
        response = client.messages.create(
            model="claude-3-7-sonnet-20250219",  # Use the newest Anthropic model
            max_tokens=2000,
            system="You are an expert educational tutor who provides personalized, constructive feedback.",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        content = response.content[0].text
        
        # Clean the response to get only JSON
        # Remove any potential markdown code blocks
        clean_content = content.replace("```json", "").replace("```", "").strip()
        
        # Parse the feedback
        feedback = json.loads(clean_content)
        
        # Validate and ensure we have all required fields
        if not all(k in feedback for k in ["personalMessage", "improvementAreas", "recommendedResources"]):
            raise ValueError("Missing required fields in feedback response")
            
        return feedback
        
    except Exception as e:
        print(f"Error generating personalized feedback: {str(e)}")
        # Return fallback feedback if API fails
        return {
            "personalMessage": f"Thank you for completing the {subject} quiz, {student_name}. Let's work on improving some areas.",
            "improvementAreas": [f"Review the concepts related to {m['question']}" for m in misconceptions[:2]],
            "recommendedResources": ["Review your course materials"]
        }

def suggest_next_questions(subject, difficulty, misconceptions):
    """
    Suggest next set of questions based on student performance.
    
    Args:
        subject (str): Subject of the quiz
        difficulty (str): Current difficulty level
        misconceptions (list): List of misconception objects
        
    Returns:
        list: List of suggested question concepts
    """
    # If no misconceptions, suggest more advanced concepts
    if not misconceptions:
        return []
    
    # Extract concepts from misconceptions
    concepts = [m["question"] for m in misconceptions]
    
    try:
        # Use Anthropic API to suggest related concepts to focus on
        prompt = f"""As an educational AI tutor, identify concepts a student should focus on next.

The student had difficulty with these concepts in a {subject} quiz (difficulty: {difficulty}):
{json.dumps(concepts, indent=2)}

Based on these misconceptions, provide:
A list of 3-5 specific concept areas the student should study next to improve their understanding.

Format your response as a valid JSON array of strings.
JSON only, no additional text."""

        # Call Anthropic API for suggestions
        response = client.messages.create(
            model="claude-3-7-sonnet-20250219",  # Use the newest Anthropic model
            max_tokens=1000,
            system="You are an expert educational tutor who provides targeted learning recommendations.",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        content = response.content[0].text
        
        # Clean the response to get only JSON
        # Remove any potential markdown code blocks
        clean_content = content.replace("```json", "").replace("```", "").strip()
        
        # Parse the suggestions
        suggestions = json.loads(clean_content)
        
        # Ensure we have the right format
        if isinstance(suggestions, list) and all(isinstance(s, str) for s in suggestions):
            return suggestions[:5]  # Limit to 5 suggestions
        else:
            raise ValueError("Invalid suggestion format from API")
            
    except Exception as e:
        print(f"Error generating suggested questions: {str(e)}")
        # Return fallback suggestions
        return [f"Review concepts related to {m['question']}" for m in misconceptions[:3]]

def main():
    """Test the evaluation functionality with different question types"""
    # Sample quiz with different question types
    quiz_questions = [
        # MCQ Type
        {
            "question": "What is the capital of France?",
            "options": ["Berlin", "Madrid", "Paris", "Rome"],
            "type": "mcq",
            "correctIndex": 2,
            "explanation": "Paris is the capital city of France."
        },
        # True/False Type
        {
            "question": "Mars is known as the Red Planet.",
            "options": ["True", "False"],
            "type": "true_false",
            "correctIndex": 0,
            "explanation": "Mars is indeed known as the Red Planet due to its reddish appearance."
        },
        # Short Answer Type
        {
            "question": "What is the largest planet in our solar system?",
            "options": [],
            "type": "short_answer",
            "correctAnswer": "Jupiter",
            "explanation": "Jupiter is the largest planet in our solar system, with a mass more than twice that of all other planets combined."
        }
    ]
    
    # Student answers: first correct, second correct, third incorrect
    student_answers = [
        2,                   # Correct MCQ answer (Paris)
        0,                   # Correct T/F answer (True)
        "Saturn"             # Incorrect short answer (should be Jupiter)
    ]
    
    # Calculate score and analyze misconceptions
    score = calculate_score(student_answers, quiz_questions)
    misconceptions = analyze_misconceptions(student_answers, quiz_questions)
    
    print(f"Score: {score*100:.1f}%")
    print(f"Misconceptions: {json.dumps(misconceptions, indent=2)}")
    
    # Generate personalized feedback
    feedback = generate_personalized_feedback("John Doe", "General Knowledge", score, misconceptions)
    print(f"Feedback: {json.dumps(feedback, indent=2)}")

if __name__ == "__main__":
    main()