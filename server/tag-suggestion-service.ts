/**
 * Enhanced Smart Tag Suggestion Service with AI
 * This service uses advanced NLP and AI techniques to suggest appropriate tags 
 * for content based on content analysis, domain knowledge, and statistical relevance.
 */

import path from 'path';
import { content as contentTable } from '@shared/schema';
import { db } from './db';
import { eq } from 'drizzle-orm';

// Define educational concept keywords for different subjects
const subjectKeywords: Record<string, string[]> = {
  "Computer Science": [
    "algorithm", "data structure", "programming", "software", "database", 
    "networking", "cybersecurity", "artificial intelligence", "machine learning",
    "web development", "mobile development", "cloud computing", "big data"
  ],
  "Mathematics": [
    "algebra", "calculus", "geometry", "statistics", "probability", 
    "equations", "theorem", "proof", "linear", "matrix", "numerical",
    "optimization", "integration", "differentiation"
  ],
  "Physics": [
    "mechanics", "thermodynamics", "electromagnetism", "optics", "quantum", 
    "relativity", "nuclear", "particle", "waves", "circuits",
    "kinematics", "dynamics", "energy", "momentum"
  ],
  "Chemistry": [
    "organic", "inorganic", "analytical", "physical", "biochemistry", 
    "reaction", "synthesis", "catalyst", "polymer", "compound",
    "molecular", "atomic", "bonding", "equilibrium"
  ],
  "Biology": [
    "cell", "genetics", "ecology", "evolution", "microbiology", 
    "physiology", "anatomy", "botany", "zoology", "molecular",
    "organism", "metabolism", "biodiversity", "ecosystem"
  ],
  "Engineering": [
    "mechanical", "electrical", "civil", "chemical", "structural", 
    "design", "analysis", "system", "circuit", "construction",
    "materials", "control", "process", "mechanism"
  ],
  "Economics": [
    "microeconomics", "macroeconomics", "econometrics", "finance", "market", 
    "policy", "trade", "development", "monetary", "fiscal",
    "equilibrium", "demand", "supply", "inflation"
  ]
};

// Define educational format tags based on content type
const formatTags: Record<string, string[]> = {
  "lecture handout": ["notes", "reference", "study material", "handout"],
  "video": ["video lecture", "demonstration", "tutorial", "visual explanation"],
  "presentation": ["slides", "presentation", "visual aids", "lecture slides"]
};

// Define pedagogical tags for different content purposes
const pedagogicalTags: string[] = [
  "beginners", "advanced", "introduction", "comprehensive", 
  "practice", "revision", "exam preparation", "conceptual", 
  "problem-solving", "application", "case study", "discussion"
];

// Define file extension to content type mapping
const fileExtensionTypes: Record<string, string> = {
  ".pdf": "document",
  ".docx": "document",
  ".pptx": "presentation",
  ".ppt": "presentation",
  ".mp4": "video",
  ".mov": "video",
  ".avi": "video"
};

// Term frequency - Inverse document frequency (TF-IDF) data structures
interface DocInterface {
  id: number;
  text: string;
  tags: string[];
}

interface TermFrequency {
  [term: string]: number;
}

interface InverseDocumentFrequency {
  [term: string]: number;
}

export class TagSuggestionService {
  // In-memory corpus for TF-IDF calculations
  private static corpus: DocInterface[] = [];
  private static documentFrequency: InverseDocumentFrequency = {};
  private static termFrequencies: Map<number, TermFrequency> = new Map();
  private static isInitialized = false;
  
  /**
   * Initialize the service by loading existing content for corpus building
   * Must be called before using advanced tag suggestion features
   */
  static async initialize(): Promise<void> {
    try {
      // Fetch all content items to build the corpus
      const contentItems = await db.select({
        id: contentTable.id,
        title: contentTable.title,
        description: contentTable.description,
        tags: contentTable.tags
      })
      .from(contentTable)
      .where(eq(contentTable.is_deleted, false));
      
      // Build the corpus
      this.corpus = contentItems.map(item => ({
        id: item.id,
        text: `${item.title} ${item.description || ''}`.toLowerCase(),
        tags: item.tags || []
      }));
      
      // Calculate document frequencies
      this.calculateDocumentFrequencies();
      
      // Calculate term frequencies for each document
      this.corpus.forEach(doc => {
        this.termFrequencies.set(doc.id, this.calculateTermFrequency(doc.text));
      });
      
      this.isInitialized = true;
      console.log(`Tag suggestion service initialized with ${this.corpus.length} documents`);
    } catch (error) {
      console.error('Failed to initialize tag suggestion service:', error);
    }
  }
  
  /**
   * Generate smart tag suggestions for content with enhanced AI features
   * @param title Content title
   * @param description Content description
   * @param subject Content subject
   * @param fileType Content file type
   * @param filename Original filename
   * @returns Array of suggested tags
   */
  static async generateTagSuggestionsAI(
    title: string,
    description: string | null | undefined,
    subject: string,
    fileType: string,
    filename: string
  ): Promise<string[]> {
    // Initialize if not already done
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const suggestedTags: Set<string> = new Set();
    
    // Normalize inputs for better matching
    const normalizedTitle = (title || "").toLowerCase();
    const normalizedDesc = (description || "").toLowerCase();
    const normalizedSubject = (subject || "").toLowerCase();
    const normalizedFileType = (fileType || "").toLowerCase();
    const fileExtension = path.extname(filename).toLowerCase();
    
    // 1. Add tags based on file type
    this.addFormatTags(normalizedFileType, suggestedTags);
    
    // 2. Add subject-related tags
    this.addSubjectTags(normalizedSubject, suggestedTags);
    
    // 3. Look for pedagogical indicators in title and description
    this.addPedagogicalTags(normalizedTitle, normalizedDesc, suggestedTags);
    
    // 4. Add additional tags based on filename
    this.addFilenameTags(filename, fileExtension, suggestedTags);
    
    // 5. Get TF-IDF based keyword extraction
    if (this.corpus.length > 0) {
      const tfidfTags = await this.extractKeywordsByTFIDF(
        `${normalizedTitle} ${normalizedDesc}`, 
        normalizedSubject
      );
      
      tfidfTags.forEach((tag: string) => suggestedTags.add(tag));
    } else {
      // Fallback to basic keyword extraction if corpus is empty
      this.extractKeywords(normalizedTitle, normalizedDesc, suggestedTags);
    }
    
    // 6. Get similar content tags based on cosine similarity
    if (this.corpus.length > 0) {
      const similarContentTags = await this.getSimilarContentTags(
        `${normalizedTitle} ${normalizedDesc}`,
        normalizedSubject
      );
      
      similarContentTags.forEach((tag: string) => suggestedTags.add(tag));
    }
    
    // 7. Add trending tags from the same subject area
    const trendingTags = await this.getTrendingTagsBySubject(normalizedSubject);
    trendingTags.forEach((tag: string) => suggestedTags.add(tag));
    
    // Add confidence scores for tags
    const scoredTags = Array.from(suggestedTags).map(tag => ({
      tag,
      score: this.calculateTagRelevanceScore(tag, normalizedTitle, normalizedDesc, normalizedSubject)
    }));
    
    // Sort by score and limit to best 15 tags
    return scoredTags
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map(item => item.tag);
  }
  
  /**
   * Generate smart tag suggestions for content (legacy method)
   * @param title Content title
   * @param description Content description
   * @param subject Content subject
   * @param fileType Content file type
   * @param filename Original filename
   * @returns Array of suggested tags
   */
  static generateTagSuggestions(
    title: string,
    description: string | null | undefined,
    subject: string,
    fileType: string,
    filename: string
  ): string[] {
    const suggestedTags: Set<string> = new Set();
    
    // Normalize inputs for better matching
    const normalizedTitle = (title || "").toLowerCase();
    const normalizedDesc = (description || "").toLowerCase();
    const normalizedSubject = (subject || "").toLowerCase();
    const normalizedFileType = (fileType || "").toLowerCase();
    const fileExtension = path.extname(filename).toLowerCase();
    
    // 1. Add tags based on file type
    this.addFormatTags(normalizedFileType, suggestedTags);
    
    // 2. Add subject-related tags
    this.addSubjectTags(normalizedSubject, suggestedTags);
    
    // 3. Look for pedagogical indicators in title and description
    this.addPedagogicalTags(normalizedTitle, normalizedDesc, suggestedTags);
    
    // 4. Add additional tags based on filename
    this.addFilenameTags(filename, fileExtension, suggestedTags);
    
    // 5. Extract keywords from title and description
    this.extractKeywords(normalizedTitle, normalizedDesc, suggestedTags);
    
    // Limit to a maximum of 10 tags to avoid overwhelming
    return Array.from(suggestedTags).slice(0, 10);
  }
  
  /**
   * Add tags based on content format/type
   */
  private static addFormatTags(fileType: string, suggestedTags: Set<string>): void {
    // Default to broader category if specific type not found
    let contentFormat = "document";
    
    if (fileType.includes("video")) {
      contentFormat = "video";
      suggestedTags.add("video");
    } else if (fileType.includes("pdf") || fileType.includes("handout")) {
      contentFormat = "lecture handout";
      suggestedTags.add("pdf");
    } else if (fileType.includes("ppt") || fileType.includes("presentation") || fileType.includes("slide")) {
      contentFormat = "presentation";
      suggestedTags.add("presentation");
    }
    
    // Add relevant format tags
    const typeTags = formatTags[contentFormat] || [];
    typeTags.forEach(tag => suggestedTags.add(tag));
  }
  
  /**
   * Add tags based on subject area
   */
  private static addSubjectTags(subject: string, suggestedTags: Set<string>): void {
    // Add the subject itself as a tag
    if (subject) {
      suggestedTags.add(subject.trim());
      
      // Find the most relevant subject category
      let bestMatchSubject = "";
      let bestMatchScore = 0;
      
      for (const [subjectCategory, keywords] of Object.entries(subjectKeywords)) {
        const subjectLower = subjectCategory.toLowerCase();
        
        // Check if subject directly contains the category
        if (subject.includes(subjectLower)) {
          bestMatchSubject = subjectCategory;
          break;
        }
        
        // Calculate match score based on keyword presence
        let matchScore = 0;
        for (const keyword of keywords) {
          if (subject.includes(keyword.toLowerCase())) {
            matchScore++;
          }
        }
        
        if (matchScore > bestMatchScore) {
          bestMatchScore = matchScore;
          bestMatchSubject = subjectCategory;
        }
      }
      
      // Add keywords from matching subject category
      if (bestMatchSubject && subjectKeywords[bestMatchSubject]) {
        // Add 2-3 most relevant keywords from the subject area
        const relevantKeywords = subjectKeywords[bestMatchSubject]
          .filter(keyword => subject.includes(keyword.toLowerCase()))
          .slice(0, 3);
        
        relevantKeywords.forEach(keyword => suggestedTags.add(keyword));
      }
    }
  }
  
  /**
   * Add pedagogical tags based on title and description content
   */
  private static addPedagogicalTags(title: string, description: string, suggestedTags: Set<string>): void {
    const combinedText = `${title} ${description}`;
    
    pedagogicalTags.forEach(tag => {
      if (combinedText.includes(tag.toLowerCase())) {
        suggestedTags.add(tag);
      }
    });
    
    // Check for specific educational patterns
    if (/\bintro(?:duction)?\b|\bbegin(?:ner)?s?\b|\bbasics?\b/i.test(combinedText)) {
      suggestedTags.add("introduction");
      suggestedTags.add("beginners");
    }
    
    if (/\badvanced\b|\bin-depth\b|\bcomprehensive\b/i.test(combinedText)) {
      suggestedTags.add("advanced");
    }
    
    if (/\bexam\b|\btest\b|\bprep(?:aration)?\b|\brevis(?:ion)?\b/i.test(combinedText)) {
      suggestedTags.add("exam preparation");
    }
    
    if (/\bpractice\b|\bexercise\b|\bproblem\b|\bquestion\b/i.test(combinedText)) {
      suggestedTags.add("practice");
    }
    
    if (/\btutorial\b|\bhow[- ]to\b|\bstep[- ]by[- ]step\b/i.test(combinedText)) {
      suggestedTags.add("tutorial");
    }
  }
  
  /**
   * Add tags based on filename and extension
   */
  private static addFilenameTags(filename: string, extension: string, suggestedTags: Set<string>): void {
    // Add tag based on file extension type
    const extensionType = fileExtensionTypes[extension];
    if (extensionType) {
      suggestedTags.add(extensionType);
    }
    
    const filenameLower = filename.toLowerCase();
    
    // Check for common patterns in educational filenames
    if (/\blecture\b|\blesson\b/i.test(filenameLower)) {
      suggestedTags.add("lecture");
    }
    
    if (/\blab\b|\bpractical\b|\bexperiment\b/i.test(filenameLower)) {
      suggestedTags.add("practical");
    }
    
    if (/\bchapter\b|\bmodule\b|\bunit\b/i.test(filenameLower)) {
      suggestedTags.add("chapter");
    }
    
    // Check for numerical indicators (like Chapter 1, Part 2, etc.)
    const chapterMatch = filenameLower.match(/\b(?:chapter|module|unit|part|session)\s*(\d+)/i);
    if (chapterMatch && chapterMatch[1]) {
      suggestedTags.add(`chapter ${chapterMatch[1]}`);
    }
  }
  
  /**
   * Extract meaningful keywords from title and description
   */
  private static extractKeywords(title: string, description: string, suggestedTags: Set<string>): void {
    const combinedText = `${title} ${description}`;
    const words = combinedText.split(/\s+/);
    
    // Common educational terms worth tagging
    const educationalTerms = [
      "fundamental", "concept", "theory", "principle", "framework",
      "analysis", "review", "overview", "summary", "guide",
      "experiment", "research", "study", "investigation", "assessment",
      "evaluation", "critique", "application", "implementation"
    ];
    
    educationalTerms.forEach(term => {
      if (combinedText.includes(term)) {
        suggestedTags.add(term);
      }
    });
    
    // Look for multi-word phrases that might be important concepts
    const combinedTextNormalized = combinedText.replace(/[.,;:!?()[\]{}'"]/g, ' ');
    const phrases = this.extractPhrases(combinedTextNormalized);
    
    // Add up to 3 important phrases as tags
    phrases.slice(0, 3).forEach(phrase => {
      if (phrase.length > 3 && phrase.split(' ').length <= 3) {
        suggestedTags.add(phrase);
      }
    });
  }
  
  /**
   * Extract potentially important phrases from text
   */
  private static extractPhrases(text: string): string[] {
    // Common stopwords to filter out
    const stopwords = new Set([
      "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "with",
      "by", "about", "as", "into", "like", "through", "after", "before", "between",
      "from", "of", "this", "that", "these", "those", "is", "are", "was", "were",
      "be", "been", "being", "have", "has", "had", "do", "does", "did", "will",
      "would", "shall", "should", "can", "could", "may", "might", "must", "it"
    ]);
    
    // Split text into words
    const words = text.toLowerCase().split(/\s+/).filter(word => 
      word.length > 2 && !stopwords.has(word)
    );
    
    // Extract 1-3 word phrases
    const phrases: string[] = [];
    
    // Single words (important terms)
    words.forEach(word => {
      if (word.length > 4) {  // Only longer words as single-word tags
        phrases.push(word);
      }
    });
    
    // Two-word phrases
    for (let i = 0; i < words.length - 1; i++) {
      phrases.push(`${words[i]} ${words[i+1]}`);
    }
    
    // Three-word phrases
    for (let i = 0; i < words.length - 2; i++) {
      phrases.push(`${words[i]} ${words[i+1]} ${words[i+2]}`);
    }
    
    return phrases;
  }
  
  /**
   * Calculate document frequencies for the corpus
   * Builds the IDF part of TF-IDF
   */
  private static calculateDocumentFrequencies(): void {
    const termDocCounts: Record<string, number> = {};
    const totalDocs = this.corpus.length;
    
    // Count number of documents containing each term
    this.corpus.forEach(doc => {
      const terms = this.tokenizeText(doc.text);
      const uniqueTerms = new Set(terms);
      
      uniqueTerms.forEach(term => {
        termDocCounts[term] = (termDocCounts[term] || 0) + 1;
      });
    });
    
    // Calculate IDF for each term
    this.documentFrequency = {};
    Object.keys(termDocCounts).forEach(term => {
      this.documentFrequency[term] = Math.log(totalDocs / (termDocCounts[term] || 1));
    });
  }
  
  /**
   * Calculate term frequency for a document
   * Builds the TF part of TF-IDF
   */
  private static calculateTermFrequency(text: string): TermFrequency {
    const terms = this.tokenizeText(text);
    const termFreq: TermFrequency = {};
    
    // Count occurrences of each term
    terms.forEach(term => {
      termFreq[term] = (termFreq[term] || 0) + 1;
    });
    
    return termFreq;
  }
  
  /**
   * Tokenize text into meaningful terms for TF-IDF
   */
  private static tokenizeText(text: string): string[] {
    // Common stopwords to filter out
    const stopwords = new Set([
      "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "with",
      "by", "about", "as", "into", "like", "through", "after", "before", "between",
      "from", "of", "this", "that", "these", "those", "is", "are", "was", "were",
      "be", "been", "being", "have", "has", "had", "do", "does", "did", "will",
      "would", "shall", "should", "can", "could", "may", "might", "must", "it"
    ]);
    
    // Tokenize and normalize
    return text.toLowerCase()
      .replace(/[.,;:!?()[\]{}'"]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopwords.has(word));
  }
  
  /**
   * Extract keywords using TF-IDF
   */
  private static async extractKeywordsByTFIDF(text: string, subject: string): Promise<string[]> {
    // Calculate term frequency for the input text
    const termFreq = this.calculateTermFrequency(text);
    
    // Calculate TF-IDF scores for each term
    const tfidfScores: { term: string, score: number }[] = [];
    
    Object.keys(termFreq).forEach(term => {
      const tf = termFreq[term];
      const idf = this.documentFrequency[term] || Math.log(this.corpus.length / 1);
      const tfidf = tf * idf;
      
      tfidfScores.push({ term, score: tfidf });
    });
    
    // Sort by score and take top N
    const topTerms = tfidfScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(item => item.term);
    
    // Filter out terms that are too short or too common
    return topTerms.filter(term => 
      term.length > 3 && 
      !subject.includes(term) && 
      this.documentFrequency[term] && 
      this.documentFrequency[term] > 0.5
    );
  }
  
  /**
   * Get tags from similar content based on cosine similarity
   */
  private static async getSimilarContentTags(text: string, subject: string): Promise<string[]> {
    // Calculate term frequency vector for input text
    const textTerms = this.calculateTermFrequency(text);
    
    // Calculate cosine similarity with all documents in corpus
    const similarities: { docId: number, similarity: number }[] = [];
    
    this.corpus.forEach(doc => {
      const docTerms = this.termFrequencies.get(doc.id) || {};
      const similarity = this.calculateCosineSimilarity(textTerms, docTerms);
      
      similarities.push({ docId: doc.id, similarity });
    });
    
    // Get tags from the most similar documents
    const similarTags = new Set<string>();
    
    similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3) // Use top 3 similar documents
      .forEach(item => {
        const doc = this.corpus.find(d => d.id === item.docId);
        if (doc && doc.tags && doc.tags.length > 0) {
          doc.tags.forEach(tag => similarTags.add(tag));
        }
      });
    
    return Array.from(similarTags).slice(0, 5); // Return max 5 tags from similar content
  }
  
  /**
   * Calculate cosine similarity between two term frequency vectors
   */
  private static calculateCosineSimilarity(
    vector1: TermFrequency, 
    vector2: TermFrequency
  ): number {
    // Calculate dot product
    let dotProduct = 0;
    Object.keys(vector1).forEach(term => {
      if (vector2[term]) {
        dotProduct += vector1[term] * vector2[term];
      }
    });
    
    // Calculate magnitudes
    const magnitude1 = Math.sqrt(
      Object.values(vector1).reduce((sum, val) => sum + val * val, 0)
    );
    
    const magnitude2 = Math.sqrt(
      Object.values(vector2).reduce((sum, val) => sum + val * val, 0)
    );
    
    // Avoid division by zero
    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    
    return dotProduct / (magnitude1 * magnitude2);
  }
  
  /**
   * Get trending tags within a subject area
   */
  private static async getTrendingTagsBySubject(subject: string): Promise<string[]> {
    // Count tag frequency across all content in the same subject
    const tagCounts = new Map<string, number>();
    
    // Find documents related to this subject
    const subjectDocs = this.corpus.filter(doc => 
      doc.text.includes(subject.toLowerCase())
    );
    
    // Count tag occurrences
    subjectDocs.forEach(doc => {
      if (doc.tags && doc.tags.length > 0) {
        doc.tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      }
    });
    
    // Sort by frequency and return top tags
    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);
  }
  
  /**
   * Calculate relevance score for a tag based on various factors
   */
  private static calculateTagRelevanceScore(
    tag: string, 
    title: string, 
    description: string, 
    subject: string
  ): number {
    let score = 0;
    const combinedText = `${title} ${description}`;
    
    // 1. Direct presence in title is the strongest signal
    if (title.includes(tag)) {
      score += 5;
    }
    
    // 2. Direct presence in description
    if (description.includes(tag)) {
      score += 3;
    }
    
    // 3. Relevance to subject
    if (subject.includes(tag)) {
      score += 4;
    }
    
    // 4. Length-based score (prefer medium-length tags)
    const tagLength = tag.length;
    if (tagLength > 3 && tagLength < 15) {
      score += 2;
    } else if (tagLength >= 15 && tagLength < 25) {
      score += 1;
    }
    
    // 5. Educational relevance
    const educationalTerms = [
      "concept", "theory", "principle", "practice", "exercise",
      "assignment", "lecture", "tutorial", "example", "study"
    ];
    
    if (educationalTerms.some(term => tag.includes(term))) {
      score += 2;
    }
    
    // 6. Frequency in text (rudimentary TF)
    const tagRegex = new RegExp(tag, 'gi');
    const occurrences = (combinedText.match(tagRegex) || []).length;
    score += Math.min(occurrences, 3); // Cap at 3 to avoid domination by frequent terms
    
    return score;
  }
  
  /**
   * Generate animation class for tag display
   * Returns a random animation class for visual appeal
   */
  static getTagAnimationClass(): string {
    const animations = [
      "animate__bounceIn", 
      "animate__fadeIn",
      "animate__flipInX", 
      "animate__lightSpeedInRight",
      "animate__zoomIn"
    ];
    
    const randomIndex = Math.floor(Math.random() * animations.length);
    return animations[randomIndex];
  }
  
  /**
   * Get tag analytics for a given subject
   * Returns statistics about tag usage for data science analytics
   */
  static async getTagAnalytics(subject?: string): Promise<any> {
    try {
      // Initialize if needed
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Build a map of all tags and their frequencies
      const tagFrequencies = new Map<string, number>();
      const tagViews = new Map<string, number>();
      const tagDownloads = new Map<string, number>();
      
      // Get content items with tags, views, and downloads
      const contentItems = await db.select({
        tags: contentTable.tags,
        views: contentTable.views,
        downloads: contentTable.downloads,
        subject: contentTable.subject
      })
      .from(contentTable)
      .where(eq(contentTable.is_deleted, false));
      
      // Filter by subject if provided
      const filteredItems = subject 
        ? contentItems.filter(item => item.subject.toLowerCase().includes(subject.toLowerCase()))
        : contentItems;
      
      // Calculate frequencies
      filteredItems.forEach(item => {
        if (item.tags && item.tags.length > 0) {
          item.tags.forEach(tag => {
            // Update frequency
            tagFrequencies.set(tag, (tagFrequencies.get(tag) || 0) + 1);
            
            // Update view count
            tagViews.set(tag, (tagViews.get(tag) || 0) + item.views);
            
            // Update download count
            tagDownloads.set(tag, (tagDownloads.get(tag) || 0) + item.downloads);
          });
        }
      });
      
      // Convert to array of analytics objects
      const tagAnalytics = Array.from(tagFrequencies.entries()).map(([tag, frequency]) => ({
        tag,
        frequency,
        views: tagViews.get(tag) || 0,
        downloads: tagDownloads.get(tag) || 0,
        engagement: (tagViews.get(tag) || 0) + (tagDownloads.get(tag) || 0),
        averageViews: frequency > 0 ? (tagViews.get(tag) || 0) / frequency : 0,
        averageDownloads: frequency > 0 ? (tagDownloads.get(tag) || 0) / frequency : 0
      }));
      
      // Sort by engagement (views + downloads)
      return tagAnalytics.sort((a, b) => b.engagement - a.engagement);
    } catch (error) {
      console.error("Error getting tag analytics:", error);
      return [];
    }
  }
}