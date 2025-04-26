import { apiRequest } from "@/lib/queryClient";

/**
 * Track user interaction with the platform
 * @param userId User ID 
 * @param interactionType Type of interaction (quiz, forum_post, poll_vote, etc.)
 * @param contentId Optional ID of the content being interacted with
 */
export const trackInteraction = async (userId: number, interactionType: string, contentId?: number) => {
  try {
    const response = await apiRequest(
      'POST',
      '/api/engagement/track',
      {
        user_id: userId,
        interaction_type: interactionType,
        content_id: contentId
      }
    );
    
    return await response.json();
  } catch (error) {
    console.error("Error tracking interaction:", error);
    // Silently fail - we don't want to interrupt the user experience
    // if tracking fails
    return null;
  }
};

/**
 * Get a user's engagement data
 * @param userId User ID
 */
export const getUserEngagement = async (userId: number) => {
  try {
    const response = await apiRequest('GET', `/api/engagement/user/${userId}`);
    return await response.json();
  } catch (error) {
    console.error("Error getting user engagement:", error);
    return null;
  }
};

/**
 * Get all student engagement data for a department
 * @param departmentId Department ID
 */
export const getDepartmentEngagement = async (departmentId: number) => {
  try {
    const response = await apiRequest('GET', `/api/engagement/department/${departmentId}`);
    return await response.json();
  } catch (error) {
    console.error("Error getting department engagement:", error);
    return null;
  }
};

/**
 * Get AI-powered engagement trends for a department
 * @param departmentId Department ID
 */
export const getDepartmentTrends = async (departmentId: number) => {
  try {
    const response = await apiRequest('GET', `/api/engagement/trends/department/${departmentId}`);
    return await response.json();
  } catch (error) {
    console.error("Error getting department trends:", error);
    return null;
  }
};