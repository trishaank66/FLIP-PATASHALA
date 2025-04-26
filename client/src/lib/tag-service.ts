/**
 * Tag Service - Client-side service for tag management and suggestions
 */

/**
 * Interface for tag analytics data
 */
export interface TagAnalytics {
  tag: string;
  frequency: number;
  averageViews: number;
  averageDownloads: number;
  recentUsage: boolean;
}

/**
 * Get tag suggestions from the server based on content properties
 */
export async function getSuggestedTags(params: {
  title?: string;
  description?: string;
  subject?: string;
  fileType?: string;
  filename?: string;
}): Promise<string[]> {
  try {
    // Build query params
    const queryParams = new URLSearchParams();

    if (params.title) queryParams.append('title', params.title);
    if (params.description) queryParams.append('description', params.description);
    if (params.subject) queryParams.append('subject', params.subject);
    if (params.fileType) queryParams.append('fileType', params.fileType);
    if (params.filename) queryParams.append('filename', params.filename);

    const response = await fetch(`/api/suggested-tags?${queryParams.toString()}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      console.error('Failed to fetch tag suggestions', response.statusText);
      return [];
    }

    const data = await response.json();
    return data.tags || [];
  } catch (error) {
    console.error('Error fetching tag suggestions:', error);
    return [];
  }
}

/**
 * Get the tags used in a department
 */
export async function getDepartmentTags(departmentId: number): Promise<{ tag: string; count: number }[]> {
  try {
    const response = await fetch(`/api/department/${departmentId}/tags`, {
      credentials: 'include',
    });

    if (!response.ok) {
      console.error('Failed to fetch department tags', response.statusText);
      return [];
    }

    const data = await response.json();
    return data.tags || [];
  } catch (error) {
    console.error('Error fetching department tags:', error);
    return [];
  }
}

/**
 * Get popular tags across the platform
 */
export async function getPopularTags(limit = 10): Promise<{ tag: string; count: number }[]> {
  try {
    const response = await fetch(`/api/popular-tags?limit=${limit}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      console.error('Failed to fetch popular tags', response.statusText);
      return [];
    }

    const data = await response.json();
    return data.tags || [];
  } catch (error) {
    console.error('Error fetching popular tags:', error);
    return [];
  }
}

/**
 * Get tag statistics for a specific subject
 */
export async function getSubjectTagStats(subject: string): Promise<{ 
  totalTags: number;
  uniqueTags: number;
  topTags: { tag: string; count: number }[];
  recentTags: string[];
}> {
  try {
    const response = await fetch(`/api/subject/${encodeURIComponent(subject)}/tag-stats`, {
      credentials: 'include',
    });

    if (!response.ok) {
      console.error('Failed to fetch subject tag stats', response.statusText);
      return {
        totalTags: 0,
        uniqueTags: 0,
        topTags: [],
        recentTags: [],
      };
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching subject tag stats:', error);
    return {
      totalTags: 0,
      uniqueTags: 0,
      topTags: [],
      recentTags: [],
    };
  }
}

/**
 * Calculate a relevance score for a tag based on its frequency and recency
 */
export function calculateTagRelevance(
  tag: string,
  allTags: { tag: string; count: number }[],
  recentTags: string[]
): number {
  // Base relevance from frequency (0-70 points)
  const tagInfo = allTags.find(t => t.tag === tag);
  const frequencyScore = tagInfo 
    ? Math.min(70, (tagInfo.count / Math.max(...allTags.map(t => t.count))) * 70) 
    : 0;

  // Recency boost (0-30 points)
  const recencyIndex = recentTags.indexOf(tag);
  const recencyScore = recencyIndex >= 0 
    ? Math.max(0, 30 - (recencyIndex * 3)) 
    : 0;

  return frequencyScore + recencyScore;
}

/**
 * Get colored CSS class for a tag based on relevance score
 */
export function getTagColorClass(relevance: number): string {
  if (relevance >= 80) return 'bg-green-100 text-green-800 hover:bg-green-200';
  if (relevance >= 60) return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
  if (relevance >= 40) return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
  if (relevance >= 20) return 'bg-orange-100 text-orange-800 hover:bg-orange-200';
  return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
}

/**
 * Generate tag animation class based on relevance
 */
export function getTagAnimationClass(relevance: number): string {
  if (relevance >= 80) return 'animate__animated animate__pulse';
  if (relevance >= 60) return 'animate__animated animate__fadeIn';
  if (relevance >= 40) return 'animate__animated animate__fadeIn animate__slower';
  return '';
}

/**
 * Get tag analytics data
 */
export async function getTagAnalytics(subject?: string): Promise<TagAnalytics[]> {
  try {
    let url = '/api/tag-analytics';
    if (subject) {
      url += `?subject=${encodeURIComponent(subject)}`;
    }

    const response = await fetch(url, {
      credentials: 'include',
    });

    if (!response.ok) {
      console.error('Failed to fetch tag analytics', response.statusText);
      return [];
    }

    const data = await response.json();
    return data.analytics || [];
  } catch (error) {
    console.error('Error fetching tag analytics:', error);
    return [];
  }
}

export class TagSuggestionService {
  getSuggestions(params: any): Promise<string[]> {
    return Promise.resolve([]); // Minimal implementation
  }
}