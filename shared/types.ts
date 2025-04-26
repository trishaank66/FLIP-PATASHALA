// Analytics types
export interface ContentWithViewsDownloads {
  id: number;
  title: string;
  type: string;
  views: number;
  downloads: number;
  created_at: Date | string;
}

export interface ChartDataPoint {
  date: string;
  count: number;
}

export interface UserContentInteraction {
  type: 'view' | 'download';
  content_id: number;
  content_title?: string;  // Optional title for display purposes
  content_type?: string;   // Optional type for display purposes
  timestamp: Date | string;
  user: {
    id: number;
    email: string;
    first_name: string | null;
    last_name: string | null;
    role: string;
  };
}

export interface ContentTypeDistribution {
  type: string;
  count: number;
  views: number;
  downloads: number;
}