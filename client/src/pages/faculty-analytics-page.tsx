import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Redirect, useLocation } from 'wouter';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChartBar, faArrowLeft, faSpinner, 
  faChartLine, faFileAlt, faCalendarAlt, faUsers
} from '@fortawesome/free-solid-svg-icons';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Cell, AreaChart, Area
} from 'recharts';
import { PageLayout } from '@/components/ui/page-layout';

// Define chart colors (visually appealing, colorblind-friendly palette)
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const FacultyAnalyticsPage: React.FC = () => {
  const { user, isLoading: userLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [, navigate] = useLocation();

  // Go back to faculty content page
  const handleBackClick = () => {
    navigate('/faculty/content');
  };

  // Redirect if not faculty
  if (!userLoading && (!user || user.role !== 'faculty')) {
    return <Redirect to="/auth" />;
  }

  if (userLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <FontAwesomeIcon icon={faSpinner} className="animate-spin text-3xl text-primary" />
      </div>
    );
  }

  // Fetch faculty analytics data
  const { data: analyticsData, isLoading, error } = useQuery({
    queryKey: [`/api/analytics/faculty/${user.id}`],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/faculty/${user.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      return await response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Handle loading state for analytics data
  if (isLoading) {
    return (
      <PageLayout
        title="Content Analytics"
        description="Loading content analytics data..."
        showBackButton={true}
        showHomeButton={true}
        backTo="/faculty/content"
        backgroundColor="bg-blue-50/30"
      >
        <div className="container max-w-7xl py-8">
          <div className="flex items-center justify-center h-[60vh]">
            <FontAwesomeIcon icon={faSpinner} className="animate-spin text-3xl text-primary" />
          </div>
        </div>
      </PageLayout>
    );
  }

  // Handle error state
  if (error) {
    return (
      <PageLayout
        title="Analytics Error"
        description="There was a problem loading your analytics"
        showBackButton={true}
        showHomeButton={true}
        backTo="/faculty/content"
        backgroundColor="bg-red-50/30"
      >
        <div className="container max-w-7xl py-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-red-500">Failed to load analytics data. Please try again later.</p>
              <Button className="mt-4" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    );
  }

  if (!analyticsData) {
    return null;
  }

  // Process data for visualization
  const contentWithPopularity = analyticsData.content
    .sort((a: any, b: any) => (b.views + b.downloads) - (a.views + a.downloads))
    .map((item: any, index: number) => ({
      ...item,
      popularity: item.views + item.downloads,
      shortTitle: item.title.length > 25 ? item.title.substring(0, 25) + '...' : item.title
    }));

  // Get content type distribution and format for pie chart
  const contentTypeDistribution = analyticsData.contentTypeDistribution ? 
    analyticsData.contentTypeDistribution.map(item => ({
      name: item.type.charAt(0).toUpperCase() + item.type.slice(1),
      value: item.count
    })) : [];

  // Get interactions over time
  const interactionsOverTime = analyticsData.interactionsOverTime;

  // Calculate summary metrics
  const totalViews = analyticsData.content.reduce((sum: number, item: any) => sum + item.views, 0);
  const totalDownloads = analyticsData.content.reduce((sum: number, item: any) => sum + item.downloads, 0);
  const totalContent = analyticsData.content.length;
  const avgEngagement = totalContent > 0 
    ? Math.round((totalViews + totalDownloads) / totalContent) 
    : 0;

  // Get trending content (most recent with highest engagement)
  const trendingContent = [...analyticsData.content]
    .sort((a: any, b: any) => {
      // First sort by engagement (views + downloads)
      const engagementDiff = (b.views + b.downloads) - (a.views + a.downloads);
      if (engagementDiff !== 0) return engagementDiff;

      // If engagement is the same, sort by recency
      return new Date(b.upload_date).getTime() - new Date(a.upload_date).getTime();
    })
    .slice(0, 3); // Get top 3 trending

  // Get AI-suggested content improvements
  const getContentSuggestion = () => {
    const suggestions = [
      "Try adding more video content to increase student engagement",
      "Students tend to engage more with content that includes visual elements",
      "Consider adding more interactive elements to your content",
      "Regular updates to your content can help maintain student interest",
      "Adding study guides before exams may increase student engagement"
    ];

    // Logic to choose a suggestion based on content analysis
    const videoCount = analyticsData.content.filter((c: any) => c.type.toLowerCase().includes('video')).length;
    const totalCount = analyticsData.content.length;

    if (videoCount / totalCount < 0.3) return suggestions[0];

    return suggestions[Math.floor(Math.random() * suggestions.length)];
  };

  return (
    <PageLayout
      title="Content Analytics"
      description="Detailed insights into your teaching materials"
      showBackButton={true}
      showHomeButton={true}
      backTo="/faculty/content"
      backgroundColor="bg-blue-50/20"
    >
      <Helmet>
        <title>Content Analytics | Active Learn</title>
      </Helmet>
      <div className="container max-w-7xl py-6">
        <Button 
          variant="outline" 
          className="mb-4"
          onClick={() => window.history.back()}
        >
          <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
          Back to Content Management
        </Button>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div className="flex items-center mb-4 sm:mb-0">
            <Button 
              variant="outline" 
              className="mr-4 flex items-center gap-2 border-gray-300 hover:bg-gray-100" 
              onClick={handleBackClick}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              Back to Content
            </Button>
            <h1 className="text-2xl font-bold flex items-center">
              <FontAwesomeIcon icon={faChartBar} className="mr-3 text-blue-500" />
              Your Content Insights
            </h1>
          </div>
          <div className="text-sm text-gray-500">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>

        {/* Analytics Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate__animated animate__fadeIn">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-blue-700">Total Views</p>
                  <h3 className="text-3xl font-bold text-blue-900 mt-1">{Number(totalViews).toFixed(2)}</h3>
                </div>
                <div className="p-3 rounded-full bg-blue-200 text-blue-600">
                  <FontAwesomeIcon icon={faChartLine} size="lg" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-green-700">Downloads</p>
                  <h3 className="text-3xl font-bold text-green-900 mt-1">{Number(totalDownloads).toFixed(2)}</h3>
                </div>
                <div className="p-3 rounded-full bg-green-200 text-green-600">
                  <FontAwesomeIcon icon={faFileAlt} size="lg" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-amber-700">Content Count</p>
                  <h3 className="text-3xl font-bold text-amber-900 mt-1">{totalContent}</h3>
                </div>
                <div className="p-3 rounded-full bg-amber-200 text-amber-600">
                  <FontAwesomeIcon icon={faCalendarAlt} size="lg" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-purple-700">Avg. Engagement</p>
                  <h3 className="text-3xl font-bold text-purple-900 mt-1">{avgEngagement}</h3>
                </div>
                <div className="p-3 rounded-full bg-purple-200 text-purple-600">
                  <FontAwesomeIcon icon={faUsers} size="lg" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Analytics Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-background border border-gray-200 p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">Overview</TabsTrigger>
            <TabsTrigger value="content" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">Content Performance</TabsTrigger>
            <TabsTrigger value="trends" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">Engagement Trends</TabsTrigger>
            <TabsTrigger value="insights" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">Usage Pattern Insights</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Content by Popularity */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Top Content by Popularity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <div className="flex items-start gap-2">
                        <div className="p-2 rounded-full bg-blue-100 text-blue-700">
                          <FontAwesomeIcon icon={faChartBar} />
                        </div>
                        <div>
                          <p className="text-blue-800 text-sm">
                            <span className="font-medium">What you're seeing:</span> Your most popular teaching materials
                          </p>
                          <p className="mt-1 text-xs text-blue-600">
                            <span className="font-medium">Why it matters:</span> Understanding what content students like helps you create more of what works
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {analyticsData.content.length > 0 ? (
                    <div className="relative">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {/* Left side: Bar chart (vertical) */}
                        <div className="md:col-span-3 h-[400px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={contentWithPopularity.slice(0, 5)} // Show top 5 content items
                              layout="vertical"
                              margin={{ top: 20, right: 30, left: 150, bottom: 20 }}
                            >
                              <defs>
                                <linearGradient id="viewsGradientBar" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9}/>
                                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.9}/>
                                </linearGradient>
                                <linearGradient id="downloadsGradientBar" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.9}/>
                                  <stop offset="95%" stopColor="#4ade80" stopOpacity={0.9}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={true} vertical={false} />
                              <XAxis 
                                type="number" 
                                tickLine={false}
                                axisLine={{ stroke: '#E5E7EB' }}
                                domain={[0, 'dataMax + 5']}
                              />
                              <YAxis 
                                type="category" 
                                dataKey="title"
                                width={150}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12 }}
                                tickFormatter={(value) => value.length > 20 ? `${value.substring(0, 20)}...` : value}
                              />
                              <Tooltip 
                                contentStyle={{
                                  borderRadius: '8px',
                                  border: '1px solid #e2e8f0',
                                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                  padding: '8px',
                                  fontSize: '12px'
                                }}
                                formatter={(value: any, name: string) => {
                                  const iconStyle = {
                                    display: 'inline-block',
                                    width: '10px',
                                    height: '10px',
                                    marginRight: '5px',
                                    borderRadius: '2px',
                                    verticalAlign: 'middle',
                                    backgroundColor: name === 'Views' ? '#3b82f6' : '#22c55e'
                                  };

                                  return [
                                    <div>
                                      <span style={iconStyle}></span>
                                      <span>{value} students</span>
                                    </div>,
                                    name
                                  ];
                                }}
                                labelFormatter={(label) => {
                                  const item = contentWithPopularity.find(item => item.shortTitle === label);
                                  return item ? <strong style={{fontSize: '13px'}}>{item.title}</strong> : label;
                                }}
                              />
                              <Legend 
                                align="center"
                                verticalAlign="top"
                                iconType="circle" 
                                formatter={(value) => (
                                  <span style={{fontSize: '12px', fontWeight: 500}}>
                                    {value}
                                  </span>
                                )}
                              />
                              <Bar 
                                dataKey="views" 
                                fill="url(#viewsGradientBar)" 
                                name="Views"
                                barSize={20}
                                radius={[0, 4, 4, 0]}
                                label={{
                                  position: 'right',
                                  formatter: (value: number) => `${value}`,
                                  fill: '#3b82f6',
                                  fontSize: 12,
                                  fontWeight: 'bold'
                                }}
                                animationDuration={1200}
                              />
                              <Bar 
                                dataKey="downloads" 
                                fill="url(#downloadsGradientBar)" 
                                name="Downloads"
                                barSize={20}
                                radius={[0, 4, 4, 0]}
                                label={{
                                  position: 'right',
                                  formatter: (value: number) => `${value}`,
                                  fill: '#22c55e',
                                  fontSize: 12,
                                  fontWeight: 'bold'
                                }}
                                animationBegin={300}
                                animationDuration={1200}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Right side: Content rankings with popularity metrics */}
                        <div className="md:col-span-2 h-[400px] overflow-y-auto">
                          <div className="bg-blue-50 rounded-lg border border-blue-100 p-4 sticky top-0 z-10">
                            <h3 className="font-bold text-blue-900 mb-3 flex items-center">
                              <FontAwesomeIcon icon={faChartBar} className="mr-2" />
                              Top Content Rankings
                            </h3>

                            <div className="space-y-3">
                              {contentWithPopularity.slice(0, 5).map((item, index) => (
                                <div 
                                  key={`rank-${index}`} 
                                  className={`bg-white rounded-lg p-3 shadow-sm border transition-all hover:shadow-md ${
                                    index === 0 ? 'border-amber-200 bg-amber-50/50' : 'border-gray-100'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                                      index === 0 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                      #{index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-medium text-gray-900 truncate">
                                        {item.title}
                                      </h4>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                          {item.type}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <div className="flex justify-between text-xs mb-1">
                                        <span className="text-gray-600">Views</span>
                                        <span className="font-medium text-blue-600">{item.views}</span>
                                      </div>
                                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div 
                                          className="h-full bg-blue-500 rounded-full"
                                          style={{ 
                                            width: `${(item.views / Math.max(...contentWithPopularity.map(i => i.views))) * 100}%` 
                                          }}
                                        ></div>
                                      </div>
                                    </div>

                                    <div>
                                      <div className="flex justify-between text-xs mb-1">
                                        <span className="text-gray-600">Downloads</span>
                                        <span className="font-medium text-green-600">{item.downloads}</span>
                                      </div>
                                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div 
                                          className="h-full bg-green-500 rounded-full"
                                          style={{ 
                                            width: `${(item.downloads / Math.max(...contentWithPopularity.map(i => i.downloads))) * 100}%` 
                                          }}
                                        ></div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Key insights section */}
                            <div className="mt-4 border-t border-gray-200 pt-4">
                              <h4 className="font-medium text-gray-900 mb-2">Key Actions to Take:</h4>
                              <div className="space-y-1">
                                {contentWithPopularity.find(item => (item.downloads / item.views) * 100 < 50) ? (
                                  <div className="flex items-start text-xs">
                                    <div className="min-w-[16px] mr-1 text-blue-500 font-bold">→</div>
                                    <p className="text-gray-700">
                                      Add downloadable summaries to content with low download rates
                                    </p>
                                  </div>
                                ) : (
                                  <div className="flex items-start text-xs">
                                    <div className="min-w-[16px] mr-1 text-green-500">✓</div>
                                    <p className="text-gray-700">
                                      Your download rates are excellent - maintain your current approach
                                    </p>
                                  </div>
                                )}

                                <div className="flex items-start text-xs">
                                  <div className="min-w-[16px] mr-1 text-blue-500 font-bold">→</div>
                                  <p className="text-gray-700">
                                    Create more content similar to your top-ranked items to drive engagement
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-gray-500">
                      <p>No content data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Content Type Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Content Type Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                      <div className="flex items-start gap-2">
                        <div className="p-2 rounded-full bg-purple-100 text-purple-700">
                          <FontAwesomeIcon icon={faChartLine} />
                        </div>
                        <div>
                          <p className="text-purple-800 text-sm">
                            <span className="font-medium">What you're seeing:</span> Distribution of your content types
                          </p>
                          <p className="mt-1 text-xs text-purple-600">
                            <span className="font-medium">Why it matters:</span> A balanced mix of content types helps address different learning styles
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {analyticsData.contentTypeDistribution && analyticsData.contentTypeDistribution.length > 0 ? (
                    <div className="flex flex-col">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {/* Left side: Pie Chart */}
                        <div className="md:col-span-2 h-[280px] flex justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                              <Pie
                                data={contentTypeDistribution}
                                cx="50%"
                                cy="50%"
                                innerRadius={0}     
                                outerRadius={80}
                                fill="#8884d8"
                                paddingAngle={4}
                                dataKey="value"
                                nameKey="name"
                                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                labelLine={true}
                                animationDuration={1500}
                                isAnimationActive={true}
                              >
                                {contentTypeDistribution.map((entry: any, index: number) => {
                                  // Remove icons but keep type name for simplicity
                                  return (
                                    <Cell 
                                      key={`cell-${index}`} 
                                      fill={COLORS[index % COLORS.length]} 
                                      stroke="#fff"
                                      strokeWidth={2}
                                    />
                                  );
                                })}
                              </Pie>
                              <Tooltip 
                                formatter={(value, name) => [
                                  `${value} items (${((value / contentTypeDistribution.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(0)}%)`, 
                                  name
                                ]}
                                contentStyle={{
                                  borderRadius: '8px',
                                  border: '1px solid #e2e8f0',
                                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                  padding: '10px',
                                  fontSize: '13px'
                                }}
                              />
                              <Legend 
                                verticalAlign="middle"
                                align="right"
                                layout="vertical"
                                iconType="circle"
                                iconSize={10}
                                formatter={(value, entry) => {
                                  const dataEntry = contentTypeDistribution.find(item => item.name === value);
                                  const percent = ((dataEntry?.value || 0) / contentTypeDistribution.reduce((sum, item) => sum + item.value, 0) * 100).toFixed(0);

                                  return (
                                    <span style={{ fontSize: '13px', color: entry.color, fontWeight: 500 }}>
                                      {value} ({percent}%)
                                    </span>
                                  );
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Right side: Top Content & Insights */}
                        <div className="md:col-span-3 flex flex-col">
                          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 mb-4 h-full">
                            <h3 className="font-bold text-blue-900 text-base mb-3">
                              Top Content By Type
                            </h3>
                            <div className="space-y-4">
                              {contentTypeDistribution.sort((a, b) => b.value - a.value).map((entry: any, index: number) => (
                                <div key={`insight-${index}`} className="border-b border-blue-100 pb-3 last:border-0 last:pb-0">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium text-gray-700">{entry.name}</span>
                                    <span className="text-sm font-bold" style={{ color: COLORS[index % COLORS.length] }}>
                                      {entry.value} files
                                    </span>
                                  </div>

                                  {/* Progress bar showing percentage */}
                                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full rounded-full" 
                                      style={{ 
                                        backgroundColor: COLORS[index % COLORS.length],
                                        width: `${(entry.value / contentTypeDistribution.reduce((sum, item) => sum + item.value, 0) * 100)}%` 
                                      }}
                                    ></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action insights */}
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-white rounded-lg border border-gray-200">
                          <h3 className="font-bold text-gray-800 mb-2">Analysis</h3>
                          <ul className="space-y-2 text-sm">
                            {contentTypeDistribution.length > 1 && 
                              contentTypeDistribution.sort((a, b) => b.value - a.value)[0].value / 
                              contentTypeDistribution.reduce((sum, item) => sum + item.value, 0) > 0.6 ? (
                              <li className="flex items-start gap-2">
                                <div className="min-w-[20px] mt-0.5 text-amber-500">▲</div>
                                <p className="text-gray-700">
                                  <span className="font-medium">{contentTypeDistribution.sort((a, b) => b.value - a.value)[0].name}</span> dominates your content mix ({((contentTypeDistribution.sort((a, b) => b.value - a.value)[0].value / contentTypeDistribution.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(0)}%). Consider diversifying your content types.
                                </p>
                              </li>
                            ) : (
                              <li className="flex items-start gap-2">
                                <div className="min-w-[20px] mt-0.5 text-green-500">✓</div>
                                <p className="text-gray-700">
                                  Your content has a healthy distribution across different types, supporting diverse learning styles.
                                </p>
                              </li>
                            )}
                            {contentTypeDistribution.find(entry => entry.name.toLowerCase().includes('video')) ? (
                              <li className="flex items-start gap-2">
                                <div className="min-w-[20px] mt-0.5 text-blue-500">i</div>
                                <p className="text-gray-700">
                                  Video content is present, which typically generates 30% higher engagement than other formats.
                                </p>
                              </li>
                            ) : (
                              <li className="flex items-start gap-2">
                                <div className="min-w-[20px] mt-0.5 text-amber-500">▲</div>
                                <p className="text-gray-700">
                                  No video content detected. Adding videos can improve engagement by up to 30%.
                                </p>
                              </li>
                            )}
                          </ul>
                        </div>

                        <div className="p-4 bg-white rounded-lg border border-gray-200">
                          <h3 className="font-bold text-gray-800 mb-2">Action Items</h3>
                          <ul className="space-y-2 text-sm">
                            {contentTypeDistribution.find(entry => entry.name.toLowerCase().includes('lecture')) && 
                             !contentTypeDistribution.find(entry => entry.name.toLowerCase().includes('video')) ? (
                              <li className="flex items-start gap-2">
                                <div className="min-w-[20px] mt-0.5 text-blue-500">1</div>
                                <p className="text-gray-700">
                                  <span className="font-medium">Convert lecture notes to short videos</span> to boost engagement from text-only learners.
                                </p>
                              </li>
                            ) : (
                              <li className="flex items-start gap-2">
                                <div className="min-w-[20px] mt-0.5 text-blue-500">1</div>
                                <p className="text-gray-700">
                                  <span className="font-medium">Create summary PDFs</span> for your most viewed content to improve download rates.
                                </p>
                              </li>
                            )}

                            <li className="flex items-start gap-2">
                              <div className="min-w-[20px] mt-0.5 text-blue-500">2</div>
                              <p className="text-gray-700">
                                <span className="font-medium">Aim for balanced distribution</span> with approximately 30% per content type for optimal learning outcomes.
                              </p>
                            </li>

                            <li className="flex items-start gap-2">
                              <div className="min-w-[20px] mt-0.5 text-blue-500">3</div>
                              <p className="text-gray-700">
                                <span className="font-medium">Add supplementary materials</span> in underrepresented formats to support different learning styles.
                              </p>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-gray-500">
                      <p>No content type data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Content Performance Tab */}
          <TabsContent value="content">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detailed Content Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Table explanation box */}
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex">
                      <div className="pr-4 border-r border-blue-200">
                        <h3 className="text-blue-800 font-bold text-sm flex items-center">
                          <span className="mr-2">💡</span>
                          Understanding Likes %
                        </h3>
                      </div>
                      <div className="pl-4">
                        <p className="text-sm text-blue-700">
                          Likes % shows how many students who viewed your content also downloaded it.
                        </p>
                        <div className="mt-3 flex items-center gap-6">
                          <div className="flex items-center">
                            <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
                            <span className="text-xs text-green-800">80-100% = Excellent</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-4 h-4 rounded-full bg-yellow-500 mr-2"></div>
                            <span className="text-xs text-yellow-800">50-79% = Good</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-4 h-4 rounded-full bg-red-500 mr-2"></div>
                            <span className="text-xs text-red-800">0-49% = Needs Improvement</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-blue-50">
                            <th className="p-3 text-left font-medium text-blue-900">Title</th>
                            <th className="p-3 text-left font-medium text-blue-900">Type</th>
                            <th className="p-3 text-left font-medium text-blue-900">Views</th>
                            <th className="p-3 text-left font-medium text-blue-900">Downloads</th>
                            <th className="p-3 text-left font-medium text-blue-900">
                              <div className="flex items-center gap-1">
                                <span>Likes %</span>
                                <span className="text-xs text-blue-600">(Downloads÷Views)</span>
                              </div>
                            </th>
                            <th className="p-3 text-left font-medium text-blue-900">Upload Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {analyticsData.content.map((item: any, index: number) => (
                            <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                              <td className="p-3 font-medium">{item.title}</td>
                              <td className="p-3">{item.type}</td>
                              <td className="p-3">
                                <div className="flex items-center">
                                  <span className="text-blue-600 mr-1">👁️</span> {item.views}
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center">
                                  <span className="text-green-600 mr-1">📥</span> {item.downloads}
                                </div>
                              </td>
                              <td className="p-3">
                                {item.likes_percent > 0 ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 h-4 bg-gray-200 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full ${
                                          item.likes_percent >= 80 ? 'bg-green-500' : 
                                          item.likes_percent >= 50 ? 'bg-yellow-500' : 
                                          'bg-red-500'
                                        }`}
                                        style={{ width: `${item.likes_percent}%` }}
                                      ></div>
                                    </div>
                                    <span 
                                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        item.likes_percent >= 80 ? 'bg-green-100 text-green-800' : 
                                        item.likes_percent >= 50 ? 'bg-yellow-100 text-yellow-800' : 
                                        'bg-red-100 text-red-800'
                                      }`}
                                    >
                                      {item.likes_percent}%
                                    </span>
                                    <div className="text-xs text-gray-500">
                                      ({item.downloads}/{item.views})
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-gray-500">N/A</span>
                                )}
                              </td>
                              <td className="p-3 text-gray-500">
                                {new Date(item.upload_date).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Engagement Trends Tab */}
          <TabsContent value="trends">
            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Content Engagement Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                      <div className="flex items-start gap-2">
                        <div className="p-2 rounded-full bg-green-100 text-green-700">
                          <FontAwesomeIcon icon={faChartLine} />
                        </div>
                        <div>
                          <p className="text-green-800 text-sm">
                            <span className="font-medium">What you're seeing:</span> How student engagement changes over time
                          </p>
                          <p className="mt-1 text-xs text-green-600">
                            <span className="font-medium">Why it matters:</span> Track if your content maintains interest or shows seasonal patterns
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {interactionsOverTime && interactionsOverTime.length > 0 ? (
                    <div className="h-[400px] relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={interactionsOverTime}
                          margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(date) => {
                              const d = new Date(date);
                              return `${d.toLocaleDateString('en-US', { month: 'short' })} ${d.getDate()}`;
                            }}
                          />
                          <YAxis 
                            axisLine={false}
                            tickLine={false}
                            tickCount={5}
                            domain={[0, 'auto']}
                          />
                          <Tooltip 
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                const date = new Date(label);
                                const formattedDate = `${date.toLocaleDateString('en-US', { month: 'short' })} ${date.getDate()}`;

                                const viewsValue = Number(payload[0].value).toFixed(0);
                                const downloadsValue = Number(payload[1].value).toFixed(0);

                                // Determine if this is a peak activity day
                                const isPeak = Number(viewsValue) > 7;

                                return (
                                  <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200 min-w-[200px]">
                                    <div className="font-bold text-gray-800 mb-2">{formattedDate}</div>
                                    <div className="flex items-center text-blue-500 mb-1">
                                      <span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
                                      <span className="font-medium">{viewsValue} {viewsValue === "1" ? "time" : "times"}</span>
                                    </div>
                                    <div className="flex items-center text-green-500">
                                      <span className="w-3 h-3 rounded-full bg-green-500 mr-2"></span>
                                      <span className="font-medium">{downloadsValue} {downloadsValue === "1" ? "time" : "times"}</span>
                                    </div>

                                    {isPeak && (
                                      <div className="mt-3 pt-2 border-t border-gray-200">
                                        <div className="text-blue-700 font-medium">Peak activity day!</div>
                                        <div className="text-blue-600">{viewsValue} views</div>
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            }}
                            cursor={{ stroke: '#ddd', strokeWidth: 2, strokeDasharray: '5 5' }}
                          />
                          <Legend 
                            verticalAlign="bottom" 
                            height={36}
                            formatter={(value) => (
                              <span className="text-sm font-medium" style={{ color: value === 'views' ? '#3b82f6' : '#22c55e' }}>
                                {value.charAt(0).toUpperCase() + value.slice(1)}
                              </span>
                            )}
                            iconType="circle"
                            iconSize={10}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="views" 
                            stroke="#3b82f6" 
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 8, fill: '#3b82f6', stroke: 'white', strokeWidth: 2 }}
                            name="Views"
                            animationDuration={2000}
                            animationBegin={0}
                            isAnimationActive={true}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="downloads" 
                            stroke="#22c55e" 
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 8, fill: '#22c55e', stroke: 'white', strokeWidth: 2 }}
                            name="Downloads"
                            animationDuration={2000}
                            animationBegin={300}
                            isAnimationActive={true}
                          />
                        </LineChart>
                      </ResponsiveContainer>

                      {/* What you can do with this information section */}
                      <div className="mt-6 bg-blue-50 rounded-lg p-4 border border-blue-100">
                        <h3 className="text-blue-800 font-semibold mb-2 text-lg flex items-center">
                          <span className="mr-2">😊</span>
                          What you can do with this information:
                        </h3>
                        <ul className="space-y-2">
                          <li className="flex items-start">
                            <span className="text-blue-600 mr-2">✓</span>
                            <span>Post new content just before peak usage days (weekends or exam periods)</span>
                          </li>
                          <li className="flex items-start">
                            <span className="text-blue-600 mr-2">✓</span>
                            <span>If you see few downloads, try adding summary PDFs students can save</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-gray-500">
                      <p>No trend data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Usage Pattern Insights Tab */}
          <TabsContent value="insights">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Usage Pattern Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                      <div className="flex items-start gap-2">
                        <div className="p-2 rounded-full bg-amber-100 text-amber-700">
                          <FontAwesomeIcon icon={faChartLine} />
                        </div>
                        <div>
                          <p className="text-amber-800 text-sm">
                            <span className="font-medium">What you're seeing:</span> AI analysis of your content performance
                          </p>
                          <p className="mt-1 text-xs text-amber-600">
                            <span className="font-medium">Why it matters:</span> Get personalized recommendations to improve student engagement
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Content Suggestion */}
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <h3 className="text-md font-semibold text-blue-800 mb-2">Content Improvement Suggestion</h3>
                      <p className="text-blue-700">{getContentSuggestion()}</p>
                    </div>

                    {/* Trending Content */}
                    <div>
                      <h3 className="text-md font-semibold mb-4">Your Trending Content</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {trendingContent.map((item: any, index: number) => (
                          <Card key={index} className="bg-white">
                            <CardContent className="pt-6">
                              <h4 className="font-medium text-gray-900 mb-1 truncate" title={item.title}>
                                {item.title}
                              </h4>
                              <p className="text-xs text-gray-500 mb-3">{item.type}</p>
                              <div className="flex justify-between text-sm">
                                <div>
                                  <span className="font-medium text-blue-600">{Number(item.views).toFixed(2)}</span>
                                  <span className="text-gray-500 ml-1">views</span>
                                </div>
                                <div>
                                  <span className="font-medium text-green-600">{Number(item.downloads).toFixed(2)}</span>
                                  <span className="text-gray-500 ml-1">downloads</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>

                    {/* Usage Patterns */}
                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                      <h3 className="text-md font-semibold text-purple-800 mb-2">Usage Pattern Insights</h3>
                      <p className="text-purple-700">
                        {analyticsData.usagePatterns?.insight || 
                          "Students typically engage with your content more during weekdays, with peaks on Mondays and Wednesdays. Weekends show less engagement overall."}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
};

export default FacultyAnalyticsPage;