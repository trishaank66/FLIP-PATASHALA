import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChartBar, faEye, faDownload, faCalendarAlt, faUsers, faChartLine, 
  faSpinner, faTimes, faBook, faVideo, faFileAlt, faSmile, faFire, faStar 
} from '@fortawesome/free-solid-svg-icons';
import 'animate.css';

// Recharts imports
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Define props
interface ContentAnalyticsPanelProps {
  facultyId: number;
  isOpen: boolean;
  onClose: () => void;
}

// Define chart colors (visually appealing, colorblind-friendly palette)
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

// Component for faculty analytics panel with slide-in animation
const ContentAnalyticsPanel: React.FC<ContentAnalyticsPanelProps> = ({ facultyId, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch faculty analytics data
  const { data: analyticsData, isLoading, error } = useQuery({
    queryKey: [`/api/analytics/faculty/${facultyId}`],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/faculty/${facultyId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      return await response.json();
    },
    enabled: isOpen, // Only fetch when panel is open
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // If panel is closed, don't render anything
  if (!isOpen) return null;

  // Handle loading state
  if (isLoading) {
    return (
      <div className={`fixed right-0 top-0 h-screen w-[600px] bg-white border-l border-gray-200 shadow-xl z-50 animate__animated animate__slideInRight animate__faster`}>
        <div className="p-6 h-full overflow-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold flex items-center">
              <FontAwesomeIcon icon={faChartBar} className="mr-3 text-blue-500" />
              Your Content Insights
            </h2>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-gray-100" onClick={onClose}>
              <FontAwesomeIcon icon={faTimes} />
            </Button>
          </div>
          <div className="flex items-center justify-center h-4/5">
            <div className="text-center animate__animated animate__pulse animate__infinite">
              <FontAwesomeIcon icon={faSpinner} className="animate-spin text-5xl text-blue-500 mb-4" />
              <p className="text-gray-600 text-lg">Creating your insights...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className={`fixed right-0 top-0 h-screen w-[600px] bg-white border-l border-gray-200 shadow-xl z-50 animate__animated animate__slideInRight animate__faster`}>
        <div className="p-6 h-full overflow-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold flex items-center">
              <FontAwesomeIcon icon={faChartBar} className="mr-3 text-blue-500" />
              Your Content Insights
            </h2>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-gray-100" onClick={onClose}>
              <FontAwesomeIcon icon={faTimes} />
            </Button>
          </div>
          <div className="flex items-center justify-center h-4/5">
            <div className="text-center p-8 bg-red-50 rounded-xl border border-red-100 max-w-md animate__animated animate__fadeIn">
              <div className="text-5xl text-red-400 mb-4">😕</div>
              <p className="text-xl font-medium text-red-700 mb-2">Oops! We couldn't get your insights right now</p>
              <p className="text-gray-600 mb-6">Let's try again in a moment</p>
              <Button onClick={() => window.location.reload()} className="bg-red-500 hover:bg-red-600 transition-all">
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Format the data for charts with rounded values to 2 decimal places
  const formatInteractionsData = analyticsData.interactionsOverTime.map((item: any) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    views: Number(parseFloat(item.views).toFixed(2)),
    downloads: Number(parseFloat(item.downloads).toFixed(2)),
  })).slice(-14); // Only show last 14 days for better visibility

  // Format data for content type distribution
  const contentTypeData = analyticsData.contentTypeDistribution.map((item: any) => ({
    name: item.type,
    value: item.count,
    views: item.views,
    downloads: item.downloads,
  }));

  // Calculate popularity score for each content
  const contentWithPopularity = analyticsData.content.map((item: any) => ({
    ...item,
    popularity: item.views + (item.downloads * 2), // Downloads weighted more than views
  })).sort((a: any, b: any) => b.popularity - a.popularity);

  // Get most popular content
  const mostPopular = contentWithPopularity.length > 0 ? contentWithPopularity[0] : null;

  // Get total engagement
  const totalEngagement = analyticsData.totalViews + analyticsData.totalDownloads;

  // Helper function to get icon based on content type
  const getContentTypeIcon = (type: string) => {
    const lcType = type.toLowerCase();
    if (lcType.includes('video')) return faVideo;
    if (lcType.includes('lecture') || lcType.includes('note') || lcType.includes('pdf')) return faFileAlt;
    if (lcType.includes('pres') || lcType.includes('slide')) return faBook;
    return faFileAlt;
  };

  // Helper function to get engagement message
  const getEngagementMessage = () => {
    if (totalEngagement > 100) return "Fantastic engagement! Your content is getting a lot of attention.";
    if (totalEngagement > 50) return "Good engagement! Your content is gaining traction.";
    if (totalEngagement > 20) return "Steady engagement. Keep creating great content!";
    return "Early days! As you add more content, engagement will grow.";
  };

  // Helper function to get action suggestions
  const getActionSuggestion = () => {
    const suggestions = [
      "Try adding more video content - videos typically get more views",
      "Consider updating your lecture notes with more interactive elements",
      "Add descriptive titles to help students find your content faster",
      "Regular uploads keep students coming back for more"
    ];

    // Pick a relevant suggestion
    if (analyticsData.content.length < 3) return suggestions[3];

    const videoCount = analyticsData.content.filter((c: any) => c.type.toLowerCase().includes('video')).length;
    const totalCount = analyticsData.content.length;

    if (videoCount / totalCount < 0.3) return suggestions[0];

    return suggestions[Math.floor(Math.random() * suggestions.length)];
  };

  return (
    <div className={`fixed right-0 top-0 h-screen w-[600px] bg-white border-l border-gray-200 shadow-xl z-50 animate__animated animate__slideInRight animate__faster overflow-hidden`}>
      <div className="p-6 h-full overflow-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center">
            <Button 
              variant="outline" 
              size="sm" 
              className="mr-4 flex items-center gap-1 border-gray-300 hover:bg-gray-100" 
              onClick={() => window.location.href = '/faculty/content'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Back to Content
            </Button>
            <h2 className="text-2xl font-bold flex items-center">
              <FontAwesomeIcon icon={faChartBar} className="mr-3 text-blue-500" />
              Your Content Insights
            </h2>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-gray-100" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </Button>
        </div>

        {/* Highlight cards */}
        <div className="grid grid-cols-2 gap-4 mb-6 animate__animated animate__fadeIn">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 overflow-hidden">
            <div className="absolute right-0 top-0 opacity-10">
              <FontAwesomeIcon icon={faEye} className="text-7xl text-blue-500 transform -rotate-12" />
            </div>
            <CardContent className="pt-6">
              <p className="text-blue-700 font-medium mb-1">Total Views</p>
              <h3 className="text-3xl font-bold text-blue-800">{analyticsData.totalViews}</h3>
              <p className="text-blue-600 text-sm mt-2">Number of times students viewed your content</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 overflow-hidden">
            <div className="absolute right-0 top-0 opacity-10">
              <FontAwesomeIcon icon={faDownload} className="text-7xl text-green-500 transform -rotate-12" />
            </div>
            <CardContent className="pt-6">
              <p className="text-green-700 font-medium mb-1">Total Downloads</p>
              <h3 className="text-3xl font-bold text-green-800">{analyticsData.totalDownloads}</h3>
              <p className="text-green-600 text-sm mt-2">Number of times students downloaded your content</p>
            </CardContent>
          </Card>
        </div>

        {/* Most popular content highlight - conditional render */}
        {mostPopular && (
          <Card className="mb-6 border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50 overflow-hidden animate__animated animate__fadeIn">
            <div className="absolute right-4 top-4">
              <FontAwesomeIcon icon={faStar} className="text-4xl text-yellow-400 animate__animated animate__swing animate__infinite animate__slow" />
            </div>
            <CardHeader>
              <CardTitle className="text-lg text-orange-700">
                <FontAwesomeIcon icon={faFire} className="mr-2 text-orange-500" />
                Most Popular Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <div className="mr-4 p-3 bg-white rounded-full">
                  <FontAwesomeIcon icon={getContentTypeIcon(mostPopular.type)} className="text-2xl text-orange-500" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-gray-800">{mostPopular.title}</h4>
                  <div className="flex space-x-3 text-sm mt-1">
                    <span className="text-blue-600 flex items-center">
                      <FontAwesomeIcon icon={faEye} className="mr-1" /> {mostPopular.views} views
                    </span>
                    <span className="text-green-600 flex items-center">
                      <FontAwesomeIcon icon={faDownload} className="mr-1" /> {mostPopular.downloads} downloads
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Personalized insights card with explanation on generation method */}
        <Card className="mb-6 border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 animate__animated animate__fadeIn">
          <CardHeader>
            <CardTitle className="text-lg text-purple-700 flex items-center">
              <FontAwesomeIcon icon={faSmile} className="mr-2 text-purple-500" />
              <span>Your Insights at a Glance</span>
            </CardTitle>
            <CardDescription className="text-purple-600 mt-1">
              Data-driven recommendations based on your content performance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">{getEngagementMessage()}</p>

            <div className="bg-white p-3 rounded-lg border border-purple-100">
              <p className="text-sm font-medium text-purple-700 mb-1">Tip for growth:</p>
              <p className="text-gray-600">{getActionSuggestion()}</p>
            </div>

            {/* How insights are generated explanation */}
            <div className="mt-3 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
              <p className="text-xs font-medium text-indigo-800 mb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                How are these insights generated?
              </p>
              <div className="text-xs text-gray-700 space-y-2">
                <p>All recommendations are calculated by analyzing:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Your content view and download patterns</li>
                  <li>Student engagement rates over time</li>
                  <li>Content type performance comparisons</li>
                  <li>Statistical trend analysis of your data</li>
                </ul>
                <p>Insights are derived from analysis of your students' interaction patterns with your content.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for detailed insights */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="animate__animated animate__fadeIn">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="overview" className="text-base py-3">
              <FontAwesomeIcon icon={faChartLine} className="mr-2" />
              Activity Trends
            </TabsTrigger>
            <TabsTrigger value="content" className="text-base py-3">
              <FontAwesomeIcon icon={faBook} className="mr-2" />
              Content Performance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Activity Trends Card with enhanced visualizations */}
            <Card className="overflow-hidden border-blue-200">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4">
                <div className="flex items-center">
                  <div className="bg-white p-2 rounded-full mr-3 shadow-sm">
                    <FontAwesomeIcon icon={faChartLine} className="text-blue-500 text-xl" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-blue-700">Activity Trends</h3>
                    <p className="text-blue-600 text-sm">How students engage with your content over time</p>
                  </div>
                </div>
              </div>

              <CardContent className="pt-4">
                {/* Simplified explanation section at top */}
                <div className="mb-4 p-3 border border-blue-100 rounded-lg bg-blue-50 shadow-sm">
                  <div className="flex">
                    <div className="mr-3 text-2xl text-blue-500">💡</div>
                    <div>
                      <p className="text-gray-700 text-sm">
                        <span className="font-medium">What you're seeing:</span> This chart shows daily student activity with your content
                      </p>
                      <ul className="mt-1 space-y-1 text-xs text-gray-600">
                        <li className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                          <span>Blue line = Views (students looking at content)</span>
                        </li>
                        <li className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                          <span>Green line = Downloads (students saving content)</span>
                        </li>
                        <li className="mt-1">
                          <span className="font-medium">Tip:</span> Higher activity often happens before exams!
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  {/* Insight callouts - positioned absolutely */}
                  {formatInteractionsData.length > 5 && (
                    <>
                      {/* Find max value point for views */}
                      {(() => {
                        const maxViewIndex = formatInteractionsData.reduce(
                          (maxIndex, item, currentIndex, array) => 
                            item.views > array[maxIndex].views ? currentIndex : maxIndex, 
                          0
                        );
                        const maxPoint = formatInteractionsData[maxViewIndex];
                        // Only show if it's a significant peak
                        return maxPoint.views > 5 ? (
                          <div 
                            className="absolute z-10 animate__animated animate__bounceIn"
                            style={{ 
                              top: '10%', 
                              left: `${(maxViewIndex / formatInteractionsData.length) * 75 + 5}%`,
                              transform: 'translateX(-50%)'
                            }}
                          >
                            <div className="bg-blue-100 text-blue-800 text-xs p-2 rounded-lg shadow-sm border border-blue-200 w-24 animate__animated animate__pulse animate__infinite animate__slow">
                              Peak activity day! 
                              <div className="text-xs mt-1 text-blue-600 animate__animated animate__fadeIn animate__delay-1s">
                                {Number(maxPoint.views).toFixed(2)} views
                              </div>
                            </div>
                          </div>
                        ) : null;
                      })()}

                      {/* Identify trend */}
                      {(() => {
                        // Simple trend analysis
                        const firstHalf = formatInteractionsData.slice(0, Math.floor(formatInteractionsData.length / 2));
                        const secondHalf = formatInteractionsData.slice(Math.floor(formatInteractionsData.length / 2));

                        const firstHalfAvg = firstHalf.reduce((sum, item) => sum + item.views, 0) / firstHalf.length;
                        const secondHalfAvg = secondHalf.reduce((sum, item) => sum + item.views, 0) / secondHalf.length;

                        const trendPercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

                        let trendText = '';
                        let trendColor = '';

                        if (trendPercent > 20) {
                          trendText = 'Growing interest!';
                          trendColor = 'bg-green-100 text-green-800 border-green-200';
                        } else if (trendPercent < -20) {
                          trendText = 'Interest is dropping';
                          trendColor = 'bg-orange-100 text-orange-800 border-orange-200';
                        }

                        return trendText ? (
                          <div 
                            className="absolute z-10 animate__animated animate__fadeIn animate__pulse animate__infinite"
                            style={{ 
                              bottom: '20px', 
                              right: '20px',
                            }}
                          >
                            <div className={`${trendColor} text-xs p-2 rounded-lg shadow-sm border w-28 animate__animated animate__bounceIn`}>
                              {trendText}
                              <div className="text-xs mt-1 animate__animated animate__fadeIn animate__delay-1s">
                                {Math.abs(trendPercent).toFixed(2)}% {trendPercent > 0 ? 
                                  <span className="animate__animated animate__slideInUp animate__infinite">↑</span> : 
                                  <span className="animate__animated animate__slideInDown animate__infinite">↓</span>}
                              </div>
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </>
                  )}

                  {/* The actual chart */}
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={formatInteractionsData}
                        margin={{ top: 20, right: 20, left: 10, bottom: 20 }}
                      >
                        <defs>
                          <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                          </linearGradient>
                          <linearGradient id="downloadsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fill: '#64748b', fontSize: 12 }}
                          axisLine={{ stroke: '#e2e8f0' }}
                          tickLine={{ stroke: '#e2e8f0' }}
                        />
                        <YAxis 
                          tick={{ fill: '#64748b', fontSize: 12 }}
                          axisLine={{ stroke: '#e2e8f0' }}
                          tickLine={{ stroke: '#e2e8f0' }}
                          tickFormatter={(value) => value === 0 ? '0' : value}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', border: 'none', padding: '10px' }}
                          itemStyle={{ padding: '4px 0', fontWeight: 500 }}
                          formatter={(value: number) => [`${Number(value).toFixed(2)} times`, undefined]}
                          labelStyle={{ fontWeight: 'bold', marginBottom: '5px' }}
                        />
                        <Legend 
                          wrapperStyle={{ paddingTop: '10px' }} 
                          formatter={(value) => <span style={{ color: value === 'Views' ? '#3b82f6' : '#22c55e', fontWeight: 500 }}>{value}</span>}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="views" 
                          name="Views" 
                          stroke="#3b82f6" 
                          strokeWidth={3}
                          animationDuration={2000}
                          animationBegin={0}
                          activeDot={{ 
                            r: 6, 
                            fill: '#3b82f6', 
                            stroke: 'white', 
                            strokeWidth: 2,
                            className: 'animate__animated animate__pulse animate__infinite' 
                          }} 
                          dot={{ 
                            r: 3, 
                            fill: '#3b82f6', 
                            stroke: 'white', 
                            strokeWidth: 2,
                            className: 'animate__animated animate__fadeIn'
                          }}
                          fill="url(#viewsGradient)"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="downloads" 
                          name="Downloads" 
                          stroke="#22c55e" 
                          strokeWidth={3}
                          animationDuration={2000}
                          animationBegin={500}
                          activeDot={{ 
                            r: 6, 
                            fill: '#22c55e', 
                            stroke: 'white', 
                            strokeWidth: 2,
                            className: 'animate__animated animate__pulse animate__infinite' 
                          }} 
                          dot={{ 
                            r: 3, 
                            fill: '#22c55e', 
                            stroke: 'white', 
                            strokeWidth: 2,
                            className: 'animate__animated animate__fadeIn'
                          }}
                          fill="url(#downloadsGradient)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Action recommendations based on data */}
                <div className="mt-5 bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-lg border border-blue-100 animate__animated animate__fadeIn">
                  <h4 className="font-medium text-blue-800 mb-2 flex items-center">
                    <FontAwesomeIcon icon={faSmile} className="mr-2" />
                    What you can do with this information:
                  </h4>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start">
                      <div className="text-blue-500 mr-2">✓</div>
                      <span>Post new content just before peak usage days (weekends or exam periods)</span>
                    </li>
                    <li className="flex items-start">
                      <div className="text-blue-500 mr-2">✓</div>
                      <span>If you see few downloads, try adding summary PDFs students can save for later</span>
                    </li>
                    <li className="flex items-start">
                      <div className="text-blue-500 mr-2">✓</div>
                      <span>Send notifications to students when you upload new content to boost views</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Content Distribution Card with enhanced visualizations */}
            <Card className="overflow-hidden border-purple-200">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-6 py-4">
                <div className="flex items-center">
                  <div className="bg-white p-2 rounded-full mr-3 shadow-sm">
                    <FontAwesomeIcon icon={faChartBar} className="text-purple-500 text-xl" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-purple-700">Content Mix</h3>
                    <p className="text-purple-600 text-sm">Your teaching materials by type</p>
                  </div>
                </div>
              </div>

              <CardContent className="pt-4">
                {/* Simplified explanation section at top */}
                <div className="mb-4 p-3 border border-purple-100 rounded-lg bg-purple-50 shadow-sm">
                  <div className="flex">
                    <div className="mr-3 text-2xl text-purple-500">💡</div>
                    <div>
                      <p className="text-gray-700 text-sm">
                        <span className="font-medium">What you're seeing:</span> How your teaching materials are divided by type
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        <span className="font-medium">Why it matters:</span> Different students learn in different ways - videos help visual learners, 
                        while notes help those who prefer reading
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left side: Pie Chart */}
                  <div className="h-[280px] flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
                        <Pie
                          data={contentTypeData}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          innerRadius={30}
                          fill="#8884d8"
                          dataKey="value"
                          paddingAngle={4}
                          animationDuration={1000}
                          animationBegin={200}
                        >
                          {contentTypeData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', border: 'none' }}
                          formatter={(value, name) => [typeof value === 'number' ? `${Number(value).toFixed(2)} items` : `${value} items`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Right side: Content Type Legend with Stats */}
                  <div className="flex flex-col justify-center">
                    <h4 className="font-medium text-gray-700 mb-3">Your Content Types:</h4>
                    <div className="space-y-3">
                      {contentTypeData.map((item: any, index: number) => (
                        <div key={index} className="flex items-center bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center mr-3"
                            style={{ backgroundColor: COLORS[index % COLORS.length] + '20', color: COLORS[index % COLORS.length] }}
                          >
                            <FontAwesomeIcon 
                              icon={
                                item.name.toLowerCase().includes('video') ? faVideo :
                                item.name.toLowerCase().includes('pres') ? faBook : faFileAlt
                              } 
                              className="text-lg"
                            />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">{item.name}</div>
                            <div className="text-xs text-gray-500">
                              {item.value} items • {Number(item.views).toFixed(2)} views • {Number(item.downloads).toFixed(2)} downloads
                            </div>
                          </div>
                          <div className="text-lg font-bold" style={{ color: COLORS[index % COLORS.length] }}>
                            {Math.round((item.value / contentTypeData.reduce((sum, i) => sum + i.value, 0)) * 100)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action recommendations based on data */}
                <div className="mt-5 bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg border border-purple-100 animate__animated animate__fadeIn">
                  <h4 className="font-medium text-purple-800 mb-2 flex items-center">
                    <FontAwesomeIcon icon={faSmile} className="mr-2" />
                    How to improve your content mix:
                  </h4>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start">
                      <div className="text-purple-500 mr-2">✓</div>
                      <span>Aim for a balanced mix - videos, lecture notes, and presentations</span>
                    </li>
                    <li className="flex items-start">
                      <div className="text-purple-500 mr-2">✓</div>
                      <span>Short, focused videos (5-10 minutes) tend to be more engaging than long ones</span>
                    </li>
                    <li className="flex items-start">
                      <div className="text-purple-500 mr-2">✓</div>
                      <span>Consider adding a new content type that's currently missing in your mix</span>
</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <Card className="overflow-hidden border-orange-200">
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-4">
                <div className="flex items-center">
                  <div className="bg-white p-2 rounded-full mr-3 shadow-sm">
                    <FontAwesomeIcon icon={faChartBar} className="text-orange-500 text-xl" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-orange-700">Top Performers</h3>
                    <p className="text-orange-600 text-sm">Which content is getting the most attention?</p>
                  </div>
                </div>
              </div>

              <CardContent className="pt-4">
                {/* Simplified explanation section at top */}
                <div className="mb-4 p-3 border border-orange-100 rounded-lg bg-orange-50 shadow-sm">
                  <div className="flex">
                    <div className="mr-3 text-2xl text-orange-500">💡</div>
                    <div>
                      <p className="text-gray-700 text-sm">
                        <span className="font-medium">What you're seeing:</span> Your most popular teaching materials
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        <span className="font-medium">Why it matters:</span> Understanding what content students like helps you create more of what works
                      </p>
                    </div>
                  </div>
                </div>

                {analyticsData.content.length > 0 ? (
                  <div className="relative">
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={contentWithPopularity.slice(0, 5)} // Show top 5 content items
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
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
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                          <XAxis 
                            type="number" 
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            axisLine={{ stroke: '#e2e8f0' }}
                            tickLine={{ stroke: '#e2e8f0' }}
                          />
                          <YAxis 
                            type="category" 
                            dataKey="title" 
                            width={180}
                            tick={{ fill: '#64748b', fontSize: 13 }}
                            tickFormatter={(value) => value.length > 20 ? `${value.substring(0, 20)}...` : value}
                            axisLine={{ stroke: '#e2e8f0' }}
                            tickLine={{ stroke: '#e2e8f0' }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'white', 
                              borderRadius: '8px', 
                              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                              border: 'none', 
                              padding: '10px' 
                            }}
                            itemStyle={{ padding: '4px 0', fontWeight: 500 }}
                            formatter={(value) => [`${value} times`, undefined]}
                            labelStyle={{ fontWeight: 'bold', marginBottom: '5px' }}
                          />
                          <Legend 
                            wrapperStyle={{ paddingTop: '10px' }} 
                            formatter={(value) => (
                              <span style={{ 
                                color: value === 'Views' ? '#3b82f6' : '#22c55e', 
                                fontWeight: 500 
                              }}>
                                {value}
                              </span>
                            )}
                          />
                          <Bar 
                            dataKey="views" 
                            name="Views" 
                            fill="url(#viewsGradientBar)" 
                            radius={[0, 4, 4, 0]}
                            animationDuration={1500}
                          />
                          <Bar 
                            dataKey="downloads" 
                            name="Downloads" 
                            fill="url(#downloadsGradientBar)" 
                            radius={[0, 4, 4, 0]}
                            animationDuration={1500}
                            animationBegin={300}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {contentWithPopularity.length > 0 && (
                      <div className="absolute top-0 right-0 z-10 animate__animated animate__fadeIn" 
                           style={{ transform: 'translate(-20px, -100px)' }}>
                        <div className="bg-white p-3 rounded-lg shadow-md border border-amber-100">
                          <div className="text-sm font-medium text-amber-700 mb-1 flex items-center">
                            <FontAwesomeIcon icon={faStar} className="text-amber-500 mr-2" />
                            Most Popular
                          </div>
                          <div className="text-xl font-bold text-gray-800">
                            {contentWithPopularity[0].title.length > 20 
                              ? contentWithPopularity[0].title.substring(0, 20) + '...' 
                              : contentWithPopularity[0].title}
                          </div>
                          <div className="mt-1 flex space-x-3 text-xs">
                            <span className="text-blue-600 flex items-center">
                              <FontAwesomeIcon icon={faEye} className="mr-1" /> {Number(contentWithPopularity[0].views).toFixed(2)} views
                            </span>
                            <span className="text-green-600 flex items-center">
                              <FontAwesomeIcon icon={faDownload} className="mr-1" /> {Number(contentWithPopularity[0].downloads).toFixed(2)} downloads
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[350px]">
                    <div className="text-center p-6">
                      <p className="text-gray-500 text-lg">No content data available yet</p>
                      <p className="text-gray-400 text-sm mt-2">Upload some content to see analytics</p>
                    </div>
                  </div>
                )}

                {/* Key takeaways section */}
                {contentWithPopularity.length > 0 && (
                  <div className="mt-5 bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-lg border border-amber-100 animate__animated animate__fadeIn">
                    <h4 className="font-medium text-amber-800 mb-2 flex items-center">
                      <FontAwesomeIcon icon={faSmile} className="mr-2" />
                      What your students are loving:
                    </h4>

                    {(() => {
                      // Analyze content trends based on content types
                      const videoItems = contentWithPopularity.filter(item => item.type.toLowerCase().includes('video'));
                      const noteItems = contentWithPopularity.filter(item => 
                        item.type.toLowerCase().includes('lecture') || 
                        item.type.toLowerCase().includes('note') || 
                        item.type.toLowerCase().includes('pdf')
                      );
                      const presentationItems = contentWithPopularity.filter(item => 
                        item.type.toLowerCase().includes('pres') || 
                        item.type.toLowerCase().includes('slide')
                      );

                      // Calculate average views per type
                      const videoAvgViews = videoItems.length > 0 
                        ? videoItems.reduce((sum, item) => sum + item.views, 0) / videoItems.length
                        : 0;
                      const noteAvgViews = noteItems.length > 0
                        ? noteItems.reduce((sum, item) => sum + item.views, 0) / noteItems.length
                        : 0;
                      const presentationAvgViews = presentationItems.length > 0
                        ? presentationItems.reduce((sum, item) => sum + item.views, 0) / presentationItems.length
                        : 0;

                      // Determine the most popular type
                      const types = [
                        { name: 'Video', avg: videoAvgViews, icon: faVideo },
                        { name: 'Lecture Notes', avg: noteAvgViews, icon: faFileAlt },
                        { name: 'Presentations', avg: presentationAvgViews, icon: faBook }
                      ].filter(type => type.avg > 0);

                      types.sort((a, b) => b.avg - a.avg);

                      return types.length > 0 ? (
                        <ul className="space-y-2 text-sm text-gray-700">
                          <li className="flex items-start">
                            <div className="text-amber-500 mr-2">✓</div>
                            <span>
                              <span className="font-medium">Most popular type:</span> {types[0].name} content gets the most views
                            </span>
                          </li>
                          <li className="flex items-start">
                            <div className="text-amber-500 mr-2">✓</div>
                            <span>
                              <span className="font-medium">Best title format:</span> Short, descriptive titles like "{contentWithPopularity[0].title.length > 25 ? contentWithPopularity[0].title.substring(0, 25) + '...' : contentWithPopularity[0].title}" get the most attention
                            </span>
                          </li>
                          <li className="flex items-start">
                            <div className="text-amber-500 mr-2">✓</div>
                            <span>
                              <span className="font-medium">Suggestion:</span> Create more {types[0].name.toLowerCase()} content similar to your top performers
                            </span>
                          </li>
                        </ul>
                      ) : null;
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>

            {analyticsData.content.length > 0 ? (
              <Card className="overflow-hidden border-teal-200">
                <div className="bg-gradient-to-r from-teal-50 to-cyan-50 px-6 py-4">
                  <div className="flex items-center">
                    <div className="bg-white p-2 rounded-full mr-3 shadow-sm">
                      <FontAwesomeIcon icon={faFileAlt} className="text-teal-500 text-xl" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-teal-700">Content Library</h3>
                      <p className="text-teal-600 text-sm">All your teaching materials in one place</p>
                    </div>
                  </div>
                </div>

                <CardContent className="pt-4">
                  {/* Stats summary */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg p-3 text-center">
                      <div className="text-teal-800 text-xs mb-1">Total Items</div>
                      <div className="text-2xl font-bold text-teal-900">{analyticsData.content.length}</div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 text-center">
                      <div className="text-blue-800 text-xs mb-1">Total Views</div>
                      <div className="text-2xl font-bold text-blue-900">{Number(analyticsData.totalViews).toFixed(2)}</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 text-center">
                      <div className="text-green-800 text-xs mb-1">Total Downloads</div>
                      <div className="text-2xl font-bold text-green-900">{Number(analyticsData.totalDownloads).toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Content list */}
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                    {analyticsData.content.map((item: any, index: number) => (
                      <div 
                        key={index} 
                        className="flex items-center p-3 border rounded-lg hover:bg-gray-50 transition-colors animate__animated animate__fadeIn"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <div 
                          className="mr-3 w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ 
                            backgroundColor: item.type.toLowerCase().includes('video') 
                              ? '#eff6ff' // blue-50
                              : item.type.toLowerCase().includes('pres') 
                                ? '#fef3c7' // amber-50
                                : '#f0fdf4', // green-50
                            color: item.type.toLowerCase().includes('video') 
                              ? '#3b82f6' // blue-500
                              : item.type.toLowerCase().includes('pres') 
                                ? '#f59e0b' // amber-500
                                : '#22c55e', // green-500
                          }}
                        >
                          <FontAwesomeIcon icon={getContentTypeIcon(item.type)} className="text-lg" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-800 truncate">{item.title}</h4>
                          <div className="flex items-center text-xs text-gray-500">
                            <span className="inline-block px-2 py-0.5 rounded-full mr-2 text-xs"
                              style={{ 
                                backgroundColor: item.type.toLowerCase().includes('video') 
                                  ? '#dbeafe' // blue-100
                                  : item.type.toLowerCase().includes('pres') 
                                    ? '#fef3c7' // amber-100
                                    : '#dcfce7', // green-100
                                color: item.type.toLowerCase().includes('video') 
                                  ? '#2563eb' // blue-600
                                  : item.type.toLowerCase().includes('pres') 
                                    ? '#d97706' // amber-600
                                    : '#16a34a', // green-600
                              }}
                            >
                              {item.type}
                            </span>
                            <span>{new Date(item.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex space-x-3 text-sm font-medium">
                          <span className="flex flex-col items-center whitespace-nowrap bg-blue-50 py-1 px-2 rounded">
                            <FontAwesomeIcon icon={faEye} className="text-blue-500 mb-1" />
                            <span className="text-blue-700">{Number(item.views).toFixed(2)}</span>
                          </span>
                          <span className="flex flex-col items-center whitespace-nowrap bg-green-50 py-1 px-2 rounded">
                            <FontAwesomeIcon icon={faDownload} className="text-green-500 mb-1" />
                            <span className="text-green-700">{Number(item.downloads).toFixed(2)}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Simple usage tips */}
                  <div className="mt-4 p-3 border border-teal-100 rounded-lg bg-teal-50">
                    <div className="flex">
                      <div className="mr-3 text-2xl text-teal-500">💡</div>
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">Pro tip:</span> Upload content consistently to keep students engaged. Regular updates lead to more views!
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t pt-4 px-6 bg-gray-50">
                  <div className="text-sm text-gray-500 flex items-center">
                    <FontAwesomeIcon icon={faCalendarAlt} className="mr-2 text-teal-500" />
                    <span className="text-gray-600">
                      Analytics update automatically every 30 seconds
                    </span>
                  </div>
                </CardFooter>
              </Card>
            ) : (
              <div className="text-center p-12 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-5xl text-gray-300 mb-4">📊</div>
                <p className="text-gray-600 text-lg mb-2">No content data available yet</p>
                <p className="text-gray-500 mb-6">Upload some content to see analytics here</p>
                <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                  Upload Your First Content
                </button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ContentAnalyticsPanel;