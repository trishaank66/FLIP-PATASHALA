#!/usr/bin/env python3

import sys
import json
import os
import re
from typing import List, Dict, Any, Optional

# Import NLP libraries
import spacy
import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer

# Make sure NLTK data is downloaded
try:
    nltk.data.find('vader_lexicon')
except LookupError:
    nltk.download('vader_lexicon')

try:
    nltk.data.find('punkt')
except LookupError:
    nltk.download('punkt')

# Load spaCy model - using the smaller model for efficiency
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    # If model not found, download it
    os.system("python -m spacy download en_core_web_sm")
    nlp = spacy.load("en_core_web_sm")

# Function to clean text
def clean_text(text: str) -> str:
    # Remove special characters and extra spaces
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'[^\w\s]', ' ', text)
    return text.strip().lower()

# Function to extract tags from text
def extract_tags(text: str, max_tags: int = 5) -> List[str]:
    # Clean the text
    cleaned_text = clean_text(text)
    
    # Process with spaCy
    doc = nlp(cleaned_text)
    
    # Extract nouns and named entities as potential tags
    nouns = [token.text for token in doc if token.pos_ in ('NOUN', 'PROPN') and len(token.text) > 3]
    entities = [ent.text for ent in doc.ents if ent.label_ in ('ORG', 'PRODUCT', 'PERSON', 'GPE', 'LOC', 'EVENT', 'WORK_OF_ART')]
    
    # Combine and count occurrences
    all_candidates = nouns + entities
    tag_counts = {}
    for tag in all_candidates:
        tag = tag.lower()
        tag_counts[tag] = tag_counts.get(tag, 0) + 1
    
    # Sort by count and select top tags
    sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)
    
    # Return only unique tags up to max_tags
    unique_tags = []
    for tag, _ in sorted_tags:
        if tag not in unique_tags and len(tag) > 3:  # Ignore short tags
            unique_tags.append(tag)
        if len(unique_tags) == max_tags:
            break
    
    return unique_tags

# Function to generate insights from multiple posts
def generate_insight(texts: List[str]) -> str:
    if not texts:
        return "No posts to analyze yet."
    
    # Initialize sentiment analyzer
    sia = SentimentIntensityAnalyzer()
    
    # Analyze sentiments of all texts
    sentiments = [sia.polarity_scores(text) for text in texts]
    
    # Calculate average sentiment
    avg_sentiment = {
        'neg': sum(s['neg'] for s in sentiments) / len(sentiments),
        'neu': sum(s['neu'] for s in sentiments) / len(sentiments),
        'pos': sum(s['pos'] for s in sentiments) / len(sentiments),
        'compound': sum(s['compound'] for s in sentiments) / len(sentiments)
    }
    
    # Get dominant sentiment
    if avg_sentiment['compound'] >= 0.05:
        dominant_sentiment = "positive"
    elif avg_sentiment['compound'] <= -0.05:
        dominant_sentiment = "negative"
    else:
        dominant_sentiment = "neutral"
    
    # Extract common topics
    all_text = " ".join(texts)
    common_topics = extract_tags(all_text, max_tags=3)
    
    # Generate the insight message
    insight = ""
    
    # Add sentiment analysis
    if dominant_sentiment == "positive":
        insight += "Students are showing positive engagement. "
    elif dominant_sentiment == "negative":
        insight += "Students may be struggling with some concepts. "
    else:
        insight += "Students are neutrally engaged with the content. "
    
    # Add topics insight
    if common_topics:
        insight += f"Common topics include: {', '.join(common_topics)}. "
    
    # Add recommendations based on sentiment
    if dominant_sentiment == "positive":
        insight += "Consider building on this enthusiasm with more challenging concepts."
    elif dominant_sentiment == "negative":
        insight += "You might want to revisit these topics or provide additional resources."
    else:
        insight += "Consider adding more engaging examples or interactive elements."
    
    return insight

# Main function
def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Insufficient arguments"}))
        sys.exit(1)
    
    command = sys.argv[1]
    data = json.loads(sys.argv[2])
    
    try:
        if command == "tags":
            text = data.get("text", "")
            tags = extract_tags(text)
            print(json.dumps(tags))
        
        elif command == "insight":
            texts = data.get("texts", [])
            insight = generate_insight(texts)
            print(json.dumps(insight))
        
        else:
            print(json.dumps({"error": f"Unknown command: {command}"}))
    
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()