import React, { useState, useEffect } from 'react';
import * as tagService from '@/lib/tag-service';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { ContentTagsDisplay } from './ContentTagsDisplay';
import { cn } from '@/lib/utils';
import "animate.css";

interface TagAnalyticsProps {
  subject?: string;
  className?: string;
}

/**
 * Component for displaying tag analytics and statistics
 */
export function TagAnalyticsDisplay({ subject, className }: TagAnalyticsProps) {
  const [analytics, setAnalytics] = useState<tagService.TagAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('popularity');

  // Fetch tag analytics when the component mounts or subject changes
  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const data = await tagService.getTagAnalytics(subject);
        // Sort data by frequency (most used first)
        const sortedData = [...data].sort((a, b) => b.frequency - a.frequency);
        setAnalytics(sortedData);
        setError(null);
      } catch (err) {
        console.error('Error fetching tag analytics:', err);
        setError('Failed to load tag analytics. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [subject]);

  // Prepare data for the charts
  const popularityData = analytics.slice(0, 10).map(item => ({
    name: item.tag,
    frequency: item.frequency
  }));

  const engagementData = analytics.slice(0, 10).map(item => ({
    name: item.tag,
    averageViews: parseFloat(item.averageViews.toFixed(1)),
    averageDownloads: parseFloat(item.averageDownloads.toFixed(1)),
  }));

  // Handle tag click to filter content (placeholder)
  const handleTagClick = (tag: string) => {
    console.log(`Filtering by tag: ${tag}`);
    // This would normally navigate or filter content by the selected tag
  };

  // Calculate maximum frequency for chart scaling
  const maxFrequency = Math.max(...analytics.map(item => item.frequency));
  const frequencyDomain = [0, Math.max(5, Math.ceil(maxFrequency * 1.1))];
  
  // Calculate maximum engagement metrics for chart scaling
  const maxViews = Math.max(...analytics.map(item => item.averageViews));
  const maxDownloads = Math.max(...analytics.map(item => item.averageDownloads));
  const engagementDomain = [0, Math.max(5, Math.ceil(Math.max(maxViews, maxDownloads) * 1.1))];

  if (loading) {
    return (
      <Card className={cn("w-full h-72 flex items-center justify-center", className)}>
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle>Tag Analytics</CardTitle>
          <CardDescription>
            Insights about tag usage and engagement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-red-500 py-8">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Tag Analytics</span>
          {subject && (
            <span className="text-sm font-normal text-muted-foreground">
              Subject: {subject}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Insights about tag usage and engagement
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="popularity" onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="popularity">Popularity</TabsTrigger>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="cloud">Tag Cloud</TabsTrigger>
          </TabsList>

          <TabsContent value="popularity" className="animate__animated animate__fadeIn">
            <div className="h-72 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={popularityData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={frequencyDomain} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tickFormatter={(value) => 
                      value.length > 12 
                        ? `${value.substring(0, 12)}...` 
                        : value
                    }
                  />
                  <Tooltip 
                    formatter={(value) => [`${value} uses`, 'Frequency']}
                    labelFormatter={(label) => `Tag: ${label}`}
                  />
                  <Legend />
                  <Bar dataKey="frequency" fill="#8884d8" name="Usage Count" animationDuration={1000} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="engagement" className="animate__animated animate__fadeIn">
            <div className="h-72 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={engagementData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={engagementDomain} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tickFormatter={(value) => 
                      value.length > 12 
                        ? `${value.substring(0, 12)}...` 
                        : value
                    }
                  />
                  <Tooltip 
                    formatter={(value) => [`${value} per content`, '']}
                  />
                  <Legend />
                  <Bar dataKey="averageViews" fill="#82ca9d" name="Avg Views" animationDuration={1000} />
                  <Bar dataKey="averageDownloads" fill="#ffc658" name="Avg Downloads" animationDuration={1500} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="cloud" className="animate__animated animate__fadeIn">
            <div className="min-h-[288px] flex items-center justify-center p-6">
              <ContentTagsDisplay 
                tags={analytics.map(item => item.tag)}
                onTagClick={handleTagClick}
                limit={50}
                className="justify-center"
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}