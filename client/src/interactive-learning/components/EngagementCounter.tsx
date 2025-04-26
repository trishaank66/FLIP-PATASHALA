import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import 'animate.css';

interface EngagementCounterProps {
  userId: number;
}

export function EngagementCounter({ userId }: EngagementCounterProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/engagement/user', userId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/engagement/user/${userId}`);
      const data = await response.json();
      return data;
    },
  });
  
  const [showStarAnimation, setShowStarAnimation] = useState(false);
  const prevCount = useRef(0);
  
  // Show star animation when a star is earned
  useEffect(() => {
    if (data && prevCount.current === 9 && data.count === 0) {
      setShowStarAnimation(true);
      setTimeout(() => setShowStarAnimation(false), 3000);
    }
    if (data) {
      prevCount.current = data.count;
    }
  }, [data]);
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Engagement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-4">
            <div className="animate-pulse w-24 h-24 rounded-full bg-gray-200"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Engagement</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Progress counter */}
        <div className="counter-display my-3 flex flex-col items-center">
          <span className="count text-3xl font-bold text-[#1877F2]">{data?.count || 0}/10</span> 
          <span className="text-sm text-gray-600 mb-2">interactions</span>
          
          <Progress className="w-full h-3" value={((data?.count || 0)/10) * 100} />
        </div>
        
        {/* Stars earned display */}
        <div className="stars-earned mt-3 text-center">
          <span className="text-sm font-medium">Stars earned: {data?.stars_earned || 0}</span>
          <div className="star-icons mt-1">
            {Array(data?.stars_earned || 0).fill(0).map((_, i) => (
              <span key={i} className="star-icon text-xl mx-1">⭐</span>
            ))}
          </div>
        </div>
        
        {/* Star animation on achievement */}
        {showStarAnimation && (
          <div className="star-achievement fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
                          bg-white rounded-lg shadow-lg p-6 text-center z-50 animate__animated animate__bounceIn">
            <div className="gold-star text-5xl mb-3">⭐</div>
            <p className="text-lg font-medium">Awesome job!</p>
            <p>You've earned a star!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}