declare module 'fluent-ffmpeg';
declare module '@ffmpeg-installer/ffmpeg';
declare module 'pdf-thumbnail';

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