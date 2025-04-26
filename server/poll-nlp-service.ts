import { spawnSync } from 'child_process';
import path from 'path';

/**
 * Service to interface with Python NLP functions for poll tagging
 */
export class PollNLPService {
  /**
   * Generate tags for a poll question using spaCy
   * Leverages the same NLP infrastructure used for forum posts
   */
  static async generateTags(question: string): Promise<string[]> {
    try {
      console.log('Generating tags for poll question...');
      
      // Use the existing forum_nlp_service.py for tag generation
      const result = spawnSync('python3', [
        path.join(process.cwd(), 'python/forum_nlp_service.py'),
        'tags',
        JSON.stringify({ text: question })
      ], { encoding: 'utf-8' });
      
      if (result.error) {
        console.error('Error executing Python script for poll tag generation:', result.error);
        return this.generateFallbackTags(question); // Fallback tags if Python fails
      }
      
      try {
        return JSON.parse(result.stdout.trim());
      } catch (parseError) {
        console.error('Error parsing Python output:', parseError);
        console.log('Python output:', result.stdout);
        console.error('Python error:', result.stderr);
        return this.generateFallbackTags(question);
      }
    } catch (error) {
      console.error('Error generating poll tags:', error);
      return this.generateFallbackTags(question);
    }
  }
  
  /**
   * Generate fallback tags if Python NLP fails
   */
  private static generateFallbackTags(question: string): string[] {
    console.log('Using fallback tag generation for poll');
    const keywords = [
      'loops', 'variables', 'functions', 'algorithms', 
      'equations', 'calculus', 'physics', 'chemistry',
      'biology', 'history', 'literature', 'programming',
      'data', 'network', 'theory', 'concept'
    ];
    
    const foundKeywords = keywords.filter(keyword => 
      question.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // If no keywords are found, extract some significant words
    if (foundKeywords.length === 0) {
      const words = question.split(/\s+/)
        .filter(word => word.length > 3)
        .map(word => word.toLowerCase())
        .slice(0, 3);
      
      return Array.from(new Set(words));
    }
    
    return foundKeywords.slice(0, 3); // Return max 3 tags
  }
}