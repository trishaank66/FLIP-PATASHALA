#!/usr/bin/env python3

try:
    import nltk
    print('NLTK is imported successfully.')
except ImportError as e:
    print(f'Error importing NLTK: {str(e)}')

try:
    import anthropic
    print('Anthropic is imported successfully.')
except ImportError as e:
    print(f'Error importing Anthropic: {str(e)}')