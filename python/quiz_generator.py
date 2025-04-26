"""
Quiz Generator for Interactive Learning Module

This script generates adaptive quiz questions from learning content using 
NLTK for basic text processing and the Anthropic API for advanced question generation.
"""

import os
import json
import random
import re
import nltk
from nltk.tokenize import sent_tokenize, word_tokenize
from nltk.corpus import stopwords
import anthropic

# Initialize NLTK resources once
nltk.download('punkt', quiet=True)
nltk.download('stopwords', quiet=True)
nltk.download('punkt_tab', quiet=True)

# Initialize Anthropic client
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    raise ValueError("ANTHROPIC_API_KEY environment variable is not set")

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

def extract_key_sentences(text, num_sentences=10):
    """
    Extract key sentences from text for question generation.

    Args:
        text (str): The input text content
        num_sentences (int): Number of key sentences to extract

    Returns:
        list: List of key sentences
    """
    # Tokenize sentences
    sentences = sent_tokenize(text)

    # If we have fewer sentences than requested, return all sentences
    if len(sentences) <= num_sentences:
        return sentences

    # Simple metric for sentence importance: length after removing stopwords
    stop_words = set(stopwords.words('english'))

    def sentence_importance(s):
        # Remove stopwords and count remaining words
        words = word_tokenize(s.lower())
        filtered_words = [w for w in words if w.isalnum() and w not in stop_words]

        # Bonus for sentences with numbers, as they often contain key facts
        has_numbers = any(w.isdigit() for w in words)
        numbers_bonus = 5 if has_numbers else 0

        return len(filtered_words) + numbers_bonus

    # Score sentences and get top ones
    scored_sentences = [(s, sentence_importance(s)) for s in sentences]
    sorted_sentences = sorted(scored_sentences, key=lambda x: x[1], reverse=True)

    # Extract just the top N sentences
    return [s[0] for s in sorted_sentences[:num_sentences]]

def generate_questions(content, subject, difficulty, num_questions=15, mcq_count=8, true_false_count=4, short_answer_count=3, content_focused=True):
    """
    Generate questions from content using Anthropic Claude.

    Args:
        content (str): The content text to generate questions from
        subject (str): The subject area of the content (only used as context)
        difficulty (str): Difficulty level ("Easy", "Medium", "Hard")
        num_questions (int): Total number of questions to generate (default 15: 8 MCQs, 4 T/F, 3 Short Answer)
        content_focused (bool): If True, focus exclusively on content text, ignore subject metadata

    Returns:
        list: List of question objects with different question types
    """
    # Extract key sentences for more focused question generation
    key_points = extract_key_sentences(content, num_sentences=min(15, num_questions * 2))

    # Calculate number of each question type
    num_mcq = min(8, num_questions - 7)  # 8 MCQs by default
    num_tf = min(4, num_questions - num_mcq - 3)  # 4 T/F by default
    num_short = min(3, num_questions - num_mcq - num_tf)  # 3 Short Answer by default

    # Generate prompt based on difficulty
    difficulty_description = {
        "Easy": "simple recall and basic comprehension questions that test fundamental understanding",
        "Medium": "application and analysis questions that require deeper understanding of the concepts",
        "Hard": "evaluation and synthesis questions that require critical thinking and connecting multiple concepts"
    }

    # Calculate specific question counts based on parameters
    if mcq_count + true_false_count + short_answer_count != num_questions:
        # Adjust to ensure the total matches
        mcq_count = mcq_count
        true_false_count = true_false_count
        short_answer_count = short_answer_count

    # Determine the prompt focus
    if content_focused:
        # When content_focused is True, we emphasize analyzing the CONTENT only
        prompt_prefix = f"""You are an expert educator. Create a mix of {difficulty} question types STRICTLY and EXCLUSIVELY BASED ON THE FOLLOWING HANDOUT CONTENT ONLY, not on general knowledge about {subject} or any other subject. 

IMPORTANT: Your questions MUST be derived word-by-word from the content below. DO NOT make up any information. DO NOT create questions about concepts not explicitly mentioned in the text. If the content is brief, focus on the details it provides rather than inventing information."""
    else:
        # Regular prompt with subject reference
        prompt_prefix = f"""You are an expert educator in {subject}. Create a mix of {difficulty} question types based on the following content:"""

    # Process content for chunking if needed
    total_content_length = len(content)
    content_chunks = []

    # Keep key points for reference
    key_points_str = ' '.join(key_points) if key_points else ""

    # Split content if it's very long to avoid context limits while ensuring good coverage
    if total_content_length > 40000:
        # For very long content, we'll use strategic chunking approach
        # Keep first part which usually has critical information
        first_part = content[0:10000]

        # Extract multiple chunks from throughout the content
        mid_point = total_content_length // 2
        chunk_size = 8000  # Adjust based on model's context window

        # Get chunks from beginning, middle, and end
        content_chunks = [
            first_part,
            content[mid_point - chunk_size // 2:mid_point + chunk_size // 2],  # Middle chunk
            content[total_content_length - chunk_size:total_content_length]     # End chunk
        ]

        # Also include any section with headings that seem important
        import re
        heading_pattern = r"(#+\s+.*?$|^[A-Z\s]+:.+$)"
        potential_headings = re.findall(heading_pattern, content, re.MULTILINE)
        if potential_headings:
            # Take a chunk around some key headings that weren't in our existing chunks
            for heading in potential_headings[:5]:  # Limit to a few key headings
                heading_pos = content.find(heading)
                if heading_pos > 0 and all(heading_pos not in range(chunk[0], chunk[-1]) for chunk in content_chunks):
                    # If heading isn't in our existing chunks, take a chunk around it
                    start_pos = max(0, heading_pos - 2000)
                    end_pos = min(total_content_length, heading_pos + 6000)
                    content_chunks.append(content[start_pos:end_pos])
    else:
        # For content that fits in context window, use full content
        content_chunks = [content]

    # Carefully constructed prompt for Anthropic Claude
    prompt = f"""{prompt_prefix}
1. {mcq_count} multiple-choice questions (MCQs) with exactly 4 options each
2. {true_false_count} true/false questions with exactly 2 options each ("True" and "False")
3. {short_answer_count} short answer questions (no options, students will type their answers)

For {difficulty} level, focus on {difficulty_description[difficulty]}.

Content (ANALYZE THIS CONTENT WORD-BY-WORD - ALL QUESTIONS MUST COME DIRECTLY FROM THIS TEXT):
{content_chunks[0]}

"""

    # If we have multiple chunks, add a note about additional content
    if len(content_chunks) > 1:
        prompt += f"""
## IMPORTANT: There is more content that continues. Make sure questions cover all parts of the content.

Additional content parts:
"""
        for i, chunk in enumerate(content_chunks[1:], 1):
            prompt += f"""
CONTENT PART {i+1}:
{chunk}

"""

    prompt += f"""
For multiple-choice questions:
- Create a clear, direct question
- Provide exactly 4 answer options (make them realistic and challenging)
- Indicate which answer is correct (index 0-3)
- Add a brief explanation of why the answer is correct

For true/false questions:
- Create a statement that is either true or false
- The options should be exactly ["True", "False"]
- Indicate which answer is correct (0 for True, 1 for False)
- Add a brief explanation of why the statement is true or false

For short answer questions:
- Create a question that requires a brief written response
- The options array should be empty []
- Instead of correctIndex, provide a correctAnswer with the expected answer text
- Add guidelines for what constitutes an acceptable answer

Format your response as valid JSON array of objects with these properties:
- question: the question text
- options: array of possible answers (4 for MCQ, 2 for T/F, empty for short answer)
- type: "mcq", "true_false", or "short_answer"
- correctIndex: integer index of the correct answer (for MCQ and T/F only)
- correctAnswer: expected answer text (for short answer only)
- explanation: explanation of the correct answer or acceptable responses

JSON Example:
[
  {{
    "question": "What is the capital of France?",
    "options": ["Berlin", "Madrid", "Paris", "Rome"],
    "type": "mcq",
    "correctIndex": 2,
    "explanation": "Paris is the capital city of France."
  }},
  {{
    "question": "Python was first released in 1991.",
    "options": ["True", "False"],
    "type": "true_false",
    "correctIndex": 0,
    "explanation": "Python was indeed first released in 1991 by Guido van Rossum."
  }},
  {{
    "question": "Explain why Python is considered a 'batteries included' language.",
    "options": [],
    "type": "short_answer",
    "correctAnswer": "Python has a comprehensive standard library",
    "explanation": "A good answer should mention Python's extensive standard library that provides modules and packages for many common programming tasks."
  }}
]

Generate only valid JSON with no additional text or commentary."""

    # Call Anthropic API
    try:
        response = client.messages.create(
            model="claude-3-7-sonnet-20250219",  # Use the newest Anthropic model
            max_tokens=4000,
            system="You are an expert education content creator who specializes in creating adaptive learning questions.",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        content = response.content[0].text

        # Extract JSON from the response
        json_pattern = r"```json(.*?)```"
        json_match = re.search(json_pattern, content, re.DOTALL)

        if json_match:
            json_str = json_match.group(1).strip()
        else:
            # If no code block, try to extract JSON directly
            json_str = content.strip()

        # Clean up any leading or trailing text
        # Find the first [ and last ] to extract just the JSON array
        try:
            first_bracket = json_str.find('[')
            last_bracket = json_str.rfind(']')
            if first_bracket >= 0 and last_bracket > first_bracket:
                json_str = json_str[first_bracket:last_bracket+1]

            # Try to strip any markdown or extra text
            json_str = json_str.replace('```', '')

            # Parse JSON and validate format
            questions = json.loads(json_str)
        except (ValueError, json.JSONDecodeError) as e:
            print(f"JSON parsing error: {e}")
            print(f"Raw content from Anthropic: {content[:500]}")
            # Provide fallback questions with subject as topic
            topic = "handout content" if content_focused else subject
            return generate_fallback_questions(topic, num_questions, content_focused)

        # Ensure we have the right structure
        validated_questions = []
        mcq_count = 0
        tf_count = 0
        short_count = 0

        for q in questions:
            # Skip if essential fields are missing
            if not all(k in q for k in ["question", "options", "explanation"]):
                continue

            # Add type if missing
            if "type" not in q:
                # Try to infer the type based on options
                if len(q["options"]) == 0:
                    q["type"] = "short_answer"
                elif len(q["options"]) == 2 and "True" in q["options"] and "False" in q["options"]:
                    q["type"] = "true_false"
                else:
                    q["type"] = "mcq"

            # Validate based on question type
            if q["type"] == "mcq":
                # Skip if we already have enough MCQs
                if mcq_count >= num_mcq:
                    continue

                # Ensure options are exactly 4 for MCQs
                if len(q["options"]) > 4:
                    q["options"] = q["options"][:4]
                elif len(q["options"]) < 4:
                    while len(q["options"]) < 4:
                        q["options"].append(f"Option {len(q['options']) + 1}")

                # Ensure correctIndex is valid for MCQs
                if "correctIndex" not in q or not (0 <= q["correctIndex"] < 4):
                    q["correctIndex"] = 0

                mcq_count += 1

            elif q["type"] == "true_false":
                # Skip if we already have enough T/F questions
                if tf_count >= num_tf:
                    continue

                # Ensure options are exactly ["True", "False"] for T/F
                q["options"] = ["True", "False"]

                # Ensure correctIndex is valid for T/F (0 or 1)
                if "correctIndex" not in q or not (0 <= q["correctIndex"] < 2):
                    q["correctIndex"] = 0

                tf_count += 1

            elif q["type"] == "short_answer":
                # Skip if we already have enough short answer questions
                if short_count >= num_short:
                    continue

                # Empty options for short answer
                q["options"] = []

                # Ensure correctAnswer is present
                if "correctAnswer" not in q or not q["correctAnswer"]:
                    q["correctAnswer"] = "Answer not provided"

                short_count += 1

            validated_questions.append(q)

            # Break if we have enough questions of each type
            if mcq_count >= num_mcq and tf_count >= num_tf and short_count >= num_short:
                break

        # If we don't have enough questions, add fallbacks
        while mcq_count < num_mcq:
            validated_questions.append({
                "question": f"MCQ question about {subject}",
                "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
                "type": "mcq",
                "correctIndex": 0,
                "explanation": "This is a placeholder MCQ."
            })
            mcq_count += 1

        while tf_count < num_tf:
            validated_questions.append({
                "question": f"True/False question about {subject}",
                "options": ["True", "False"],
                "type": "true_false",
                "correctIndex": 0,
                "explanation": "This is a placeholder True/False question."
            })
            tf_count += 1

        while short_count < num_short:
            validated_questions.append({
                "question": f"Short answer question about {subject}",
                "options": [],
                "type": "short_answer",
                "correctAnswer": "Sample answer",
                "explanation": "This is a placeholder short answer question."
            })
            short_count += 1

        return validated_questions  # Return all questions

    except Exception as e:
        print(f"Error generating questions: {str(e)}")
        # Return simple fallback questions if API fails, maintaining content_focused setting
        return generate_fallback_questions(subject, num_questions, content_focused)

def generate_fallback_questions(subject, num_questions=15, content_focused=False):
    """
    Generate simple fallback questions if the API call fails.
    This ensures the system doesn't crash completely if there's an API issue.

    Args:
        subject (str): The subject area or content title
        num_questions (int): Total number of questions to generate
        content_focused (bool): Whether to focus on content rather than subject

    Returns:
        list: List of fallback question objects with different question types
    """
    # Default distribution: 8 MCQs, 4 T/F, 3 Short Answer
    num_mcq = min(8, num_questions - 7)
    num_tf = min(4, num_questions - num_mcq - 3)
    num_short = min(3, num_questions - num_mcq - num_tf)

    fallback_questions = []

    # Choose the question focus text
    question_topic = "handout content" if content_focused else subject

    # Generate MCQs
    for i in range(num_mcq):
        fallback_questions.append({
            "question": f"MCQ question {i+1} about the {question_topic}.",
            "options": [
                "First option", 
                "Second option", 
                "Third option", 
                "Fourth option"
            ],
            "type": "mcq",
            "correctIndex": 0,
            "explanation": "This is a placeholder MCQ explanation."
        })

    # Generate True/False questions
    for i in range(num_tf):
        fallback_questions.append({
            "question": f"True/False statement {i+1} about the {question_topic}.",
            "options": ["True", "False"],
            "type": "true_false",
            "correctIndex": 0,
            "explanation": "This is a placeholder True/False explanation."
        })

    # Generate Short Answer questions
    for i in range(num_short):
        fallback_questions.append({
            "question": f"Short answer question {i+1} about the {question_topic}.",
            "options": [],
            "type": "short_answer",
            "correctAnswer": "Placeholder answer",
            "explanation": "This is a placeholder short answer explanation."
        })

    return fallback_questions

def adapt_difficulty(score, current_difficulty):
    """
    Determine the next difficulty level based on student performance.

    Args:
        score (float): Score from previous attempt (0.0 to 1.0)
        current_difficulty (str): Current difficulty level

    Returns:
        str: Recommended next difficulty level
    """
    difficulties = ["Easy", "Medium", "Hard"]

    # Normalize current_difficulty to match one of our expected values
    if current_difficulty not in difficulties:
        # Handle case insensitive matching
        for i, diff in enumerate(difficulties):
            if diff.lower() == current_difficulty.lower():
                current_difficulty = diff
                break
        else:
            # Default to Medium if we can't match
            current_difficulty = "Medium"

    current_idx = difficulties.index(current_difficulty)

    # More granular difficulty adjustment
    if score >= 0.85:  # Excellent performance
        next_idx = min(current_idx + 1, 2)  # Move up but don't exceed Hard
    elif score <= 0.40:  # Poor performance
        next_idx = max(current_idx - 1, 0)  # Move down but don't go below Easy
    else:  # Adequate performance
        next_idx = current_idx  # Stay at current level

    return difficulties[next_idx]

def main():
    """Test the quiz generation functionality"""
    sample_content = """
    The Python programming language was created by Guido van Rossum and first released in 1991.
    Python is an interpreted, high-level, general-purpose programming language that emphasizes code readability.
    Its language constructs and object-oriented approach aim to help programmers write clear, logical code.
    Python features a dynamic type system and automatic memory management and supports multiple programming paradigms.
    These include structured, object-oriented, and functional programming.
    Python is often described as a "batteries included" language due to its comprehensive standard library.
    """

    questions = generate_questions(sample_content, "Computer Science", "Medium", 3)
    print(json.dumps(questions, indent=2))

if __name__ == "__main__":
    main()