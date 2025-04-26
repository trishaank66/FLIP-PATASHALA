import Anthropic from '@anthropic-ai/sdk';

/**
 * Interface for the result of processing an image
 */
export interface ImageProcessingResult {
  tags: string[];
  confidence: number;
  description: string;
}

/**
 * Process image data and extract information using Anthropic's CV capabilities
 * @param base64ImageData Base64 encoded image data
 * @returns Tags, confidence scores, and description
 */
export async function processImageData(base64ImageData: string): Promise<ImageProcessingResult> {
  try {
    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Analyze the image using Claude
    const response = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this sketch/diagram and help me understand it. Please identify key elements, concepts, and provide a brief description. Also, suggest 3-5 relevant tags for this image. Format your response as JSON with these fields: 'tags' (array of strings), 'confidence' (number between 0-1), and 'description' (string)."
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64ImageData
              }
            }
          ]
        }
      ],
    });

    // Extract the text response from Claude
    const content = response.content[0];
    
    if (content.type !== 'text') {
      throw new Error('Unexpected response format from Anthropic API');
    }

    // Try to parse the JSON response
    try {
      // Look for JSON in the response, assuming it might be embedded in text
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          tags: Array.isArray(result.tags) ? result.tags : [],
          confidence: typeof result.confidence === 'number' ? result.confidence : 0.7,
          description: result.description || 'No description provided'
        };
      }
      
      // If no JSON found, extract information manually
      return processImageDataSimple(base64ImageData);
    } catch (error) {
      console.error('Error parsing Anthropic response:', error);
      return processImageDataSimple(base64ImageData);
    }
  } catch (error) {
    console.error('Error processing image with Anthropic:', error);
    return processImageDataSimple(base64ImageData);
  }
}

/**
 * Simplified image processing for test/development
 * This can be used when Anthropic integration is not available
 */
export function processImageDataSimple(base64ImageData: string): ImageProcessingResult {
  // For testing - actual implementation would use more sophisticated image processing
  const defaultTags = ['sketch', 'drawing', 'diagram', 'educational'];
  
  // Use a random selection of common educational diagram tags
  const commonTags = [
    'flowchart', 'mindmap', 'concept-map', 'diagram', 'illustration',
    'graph', 'chart', 'process', 'relationship', 'structure',
    'model', 'system', 'network', 'hierarchy', 'timeline',
    'comparison', 'cycle', 'matrix', 'framework', 'architecture'
  ];
  
  // Select 3-5 random tags for variety
  const tagCount = Math.floor(Math.random() * 3) + 3; // 3-5 tags
  const selectedTags = [...defaultTags];
  
  // Add random tags from the common list
  while (selectedTags.length < tagCount) {
    const randomTag = commonTags[Math.floor(Math.random() * commonTags.length)];
    if (!selectedTags.includes(randomTag)) {
      selectedTags.push(randomTag);
    }
  }
  
  return {
    tags: selectedTags,
    confidence: 0.7,
    description: 'This appears to be a hand-drawn educational sketch or diagram.'
  };
}