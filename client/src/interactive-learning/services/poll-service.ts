import { apiRequest } from "@/lib/queryClient";

interface PollOption {
  id: number;
  text: string;
}

interface Poll {
  id: number;
  title: string;
  question: string;
  options: PollOption[];
  created_by: number;
  subject: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  timer_duration: number;
  tags: string[] | null;
  content_id?: number | null;
  department_id?: number | null;
  creator?: {
    id: number;
    first_name: string | null;
    last_name: string | null;
  };
}

interface PollVote {
  poll_id: number;
  option_id: number;
  user_id: number;
}

interface PollResults {
  poll: Poll;
  votes: { [key: string]: number };
  total: number;
  percentages: { [key: string]: number };
}

interface CreatePollData {
  title: string;
  question: string;
  options: string[];
  subject: string;
  created_by: number;
  timer_duration?: number;
  department_id?: number;
  content_id?: number;
}

/**
 * Service for interacting with the polls API
 */
export class PollService {
  /**
   * Create a new poll
   */
  static async createPoll(data: CreatePollData): Promise<Poll> {
    const response = await apiRequest("POST", "/api/il/polls", data);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to create poll");
    }
    return await response.json();
  }
  
  /**
   * Get active polls for a subject
   */
  static async getActivePolls(subject: string): Promise<Poll[]> {
    const response = await apiRequest("GET", `/api/il/polls/subject/${encodeURIComponent(subject)}/active`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch active polls");
    }
    return await response.json();
  }
  
  /**
   * Get polls for a department
   */
  static async getPollsByDepartment(departmentId: number): Promise<Poll[]> {
    const response = await apiRequest("GET", `/api/il/polls/department/${departmentId}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch department polls");
    }
    return await response.json();
  }
  
  /**
   * Get a specific poll
   */
  static async getPoll(pollId: number): Promise<Poll> {
    const response = await apiRequest("GET", `/api/il/polls/${pollId}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch poll");
    }
    return await response.json();
  }
  
  /**
   * Get results for a poll
   */
  static async getPollResults(pollId: number): Promise<PollResults> {
    const response = await apiRequest("GET", `/api/il/polls/${pollId}/results`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch poll results");
    }
    return await response.json();
  }
  
  /**
   * Vote on a poll
   */
  static async voteOnPoll(pollId: number, optionId: number, userId: number): Promise<PollResults> {
    const response = await apiRequest("POST", `/api/il/polls/${pollId}/vote`, {
      option_id: optionId,
      user_id: userId
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to vote on poll");
    }
    return await response.json();
  }
  
  /**
   * Close a poll (faculty/admin only)
   */
  static async closePoll(pollId: number): Promise<Poll> {
    const response = await apiRequest("PUT", `/api/il/polls/${pollId}/close`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to close poll");
    }
    return await response.json();
  }
  
  /**
   * Get related content for a poll
   */
  static async getRelatedContent(pollId: number): Promise<any[]> {
    const response = await apiRequest("GET", `/api/il/polls/${pollId}/related-content`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch related content");
    }
    return await response.json();
  }
}