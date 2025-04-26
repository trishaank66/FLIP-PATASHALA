#!/usr/bin/env python3
"""
NLP Setup Script for Forum Module
Downloads and configures spaCy and NLTK resources
"""
import subprocess
import sys
import importlib.util

def check_install(package):
    """Check if a package is installed"""
    try:
        importlib.util.find_spec(package)
        return True
    except ImportError:
        return False

def install_package(package):
    """Install a Python package"""
    subprocess.check_call([sys.executable, "-m", "pip", "install", package])
    print(f"Installed {package} successfully")

def setup_nlp():
    """Setup NLP dependencies for the forum module"""
    print("Setting up NLP dependencies...")
    
    # Check and install spaCy
    if not check_install("spacy"):
        print("Installing spaCy...")
        install_package("spacy")
    
    # Check and install NLTK
    if not check_install("nltk"):
        print("Installing NLTK...")
        install_package("nltk")
    
    # Download spaCy English model
    print("Downloading spaCy English model...")
    subprocess.check_call([sys.executable, "-m", "spacy", "download", "en_core_web_sm"])
    
    # Download NLTK data
    print("Downloading NLTK data...")
    import nltk
    nltk.download('vader_lexicon')
    nltk.download('punkt')
    
    print("NLP setup complete!")

if __name__ == "__main__":
    setup_nlp()