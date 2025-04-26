import { spawnSync } from 'child_process';
import path from 'path';

/**
 * Service to interface with Python NLP functions for forum analysis
 */
export class ForumNLPService {
  /**
   * Generate tags for a forum post using spaCy
   */
  static async generateTags(text: string): Promise<string[]> {
    try {
      console.log('Generating tags for post...');
      
      const result = spawnSync('python3', [
        path.join(process.cwd(), 'python/forum_nlp_service.py'),
        'tags',
        JSON.stringify({ text })
      ], { encoding: 'utf-8' });
      
      if (result.error) {
        console.error('Error executing Python script for tag generation:', result.error);
        return this.generateFallbackTags(text); // Fallback tags if Python fails
      }
      
      try {
        return JSON.parse(result.stdout.trim());
      } catch (parseError) {
        console.error('Error parsing Python output:', parseError);
        console.log('Python output:', result.stdout);
        console.error('Python error:', result.stderr);
        return this.generateFallbackTags(text);
      }
    } catch (error) {
      console.error('Error generating tags:', error);
      return this.generateFallbackTags(text);
    }
  }
  
  /**
   * Generate insights from forum posts using NLTK
   */
  static async generateInsight(texts: string[]): Promise<string> {
    try {
      console.log('Generating insights from posts...');
      
      if (!texts || texts.length === 0) {
        return 'No posts to analyze yet.';
      }
      
      const result = spawnSync('python3', [
        path.join(process.cwd(), 'python/forum_nlp_service.py'),
        'insight',
        JSON.stringify({ texts })
      ], { encoding: 'utf-8' });
      
      if (result.error) {
        console.error('Error executing Python script for insight generation:', result.error);
        return this.generateFallbackInsight(); // Fallback message if Python fails
      }
      
      try {
        return JSON.parse(result.stdout.trim());
      } catch (parseError) {
        console.error('Error parsing Python output:', parseError);
        console.log('Python output:', result.stdout);
        console.error('Python error:', result.stderr);
        return this.generateFallbackInsight();
      }
    } catch (error) {
      console.error('Error generating insight:', error);
      return this.generateFallbackInsight();
    }
  }
  
  /**
   * Generate fallback tags if Python NLP fails
   */
  private static generateFallbackTags(text: string): string[] {
    console.log('Using fallback tag generation');
    const keywords = [
      'loops', 'variables', 'functions', 'algorithms', 
      'equations', 'calculus', 'physics', 'chemistry',
      'biology', 'history', 'literature', 'programming'
    ];
    
    const foundKeywords = keywords.filter(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // If no keywords are found, extract some significant words
    if (foundKeywords.length === 0) {
      const words = text.split(/\s+/)
        .map(word => word.toLowerCase().replace(/[^a-z0-9]/g, ''))
        .filter(word => word.length > 4);
      
      // Get unique words
      const uniqueWords = [...new Set(words)];
      
      return uniqueWords.slice(0, 3);
    }
    
    return foundKeywords;
  }
  
  /**
   * Generate fallback insight if Python NLP fails
   */
  private static generateFallbackInsight(): string {
    const insights = [
      'Students seem to be actively discussing topics.',
      'Some questions may need your attention.',
      'Consider addressing recent questions in your next class.',
      'The discussion is progressing normally.'
    ];
    
    return insights[Math.floor(Math.random() * insights.length)];
  }
}