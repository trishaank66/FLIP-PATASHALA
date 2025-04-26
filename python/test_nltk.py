#!/usr/bin/env python3

try:
    import nltk
    print('NLTK is imported successfully.')
    
    # Download all required NLTK resources
    nltk.download('punkt')
    print('NLTK punkt tokenizer downloaded.')
    
    nltk.download('stopwords')
    print('NLTK stopwords downloaded.')
    
    # Download specific punkt_tab resource needed for sent_tokenize
    nltk.download('punkt_tab')
    print('NLTK punkt_tab downloaded.')
    
    # Test tokenization
    from nltk.tokenize import sent_tokenize, word_tokenize
    from nltk.corpus import stopwords
    
    # Simple implementation for text tokenization without requiring nltk's sent_tokenize
    def simple_sent_tokenize(text):
        return text.split('.')
    
    sample_text = "This is a test sentence. Here is another one."
    
    # Try the built-in tokenizer but fall back to simple implementation
    try:
        sentences = sent_tokenize(sample_text)
        print(f"NLTK sentences: {sentences}")
    except:
        print("NLTK sent_tokenize failed, using simple implementation")
        sentences = simple_sent_tokenize(sample_text)
        print(f"Simple sentences: {sentences}")
    
    try:
        words = word_tokenize(sentences[0])
        print(f"Words: {words}")
    except:
        print("NLTK word_tokenize failed, using simple implementation")
        words = sentences[0].split()
        print(f"Simple words: {words}")
    
    try:
        stop_words = set(stopwords.words('english'))
        filtered_words = [w for w in words if w.lower() not in stop_words]
        print(f"Filtered words: {filtered_words}")
    except:
        print("NLTK stopwords failed")
    
except ImportError as e:
    print(f'Error importing NLTK: {str(e)}')