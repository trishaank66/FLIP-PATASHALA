import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import AITipsCard, { AITip } from './AITipsCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AITipsSectionProps {
  tips?: AITip[];
  isLoading?: boolean;
  onMarkRead?: (tipId: number, isHelpful?: boolean) => void;
  formatDate?: (date: string) => string;
}

const AITipsSection: React.FC<AITipsSectionProps> = ({ 
  tips: externalTips, 
  isLoading: externalIsLoading,
  onMarkRead,
  formatDate: externalFormatDate
}) => {
  const [expandedSection, setExpandedSection] = useState(true);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Use external tips if provided, or fetch them if not
  const { 
    data: fetchedTips, 
    isLoading: isLoadingFetchedTips,
    error: tipsError
  } = useQuery<AITip[]>({
    queryKey: ['/api/il/tips'],
    refetchOnWindowFocus: false,
    enabled: !externalTips, // Only fetch if external tips aren't provided
  });
  
  // Use external tips if provided, otherwise use fetched tips
  const tips = externalTips || fetchedTips;
  const isLoadingTips = externalIsLoading !== undefined ? externalIsLoading : isLoadingFetchedTips;
  
  // Generate new tips mutation
  const generateTipsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/il/tips/generate');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/il/tips'] });
      toast({
        title: 'Tips Generated',
        description: 'New personalized tips have been generated for you.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to generate new tips. Please try again later.',
        variant: 'destructive',
      });
      console.error('Error generating tips:', error);
    }
  });
  
  // Handle tip removal (client-side only for smooth animation)
  const handleDismissTip = (tipId: number) => {
    if (tips) {
      queryClient.setQueryData<AITip[]>(
        ['/api/il/tips'], 
        (oldTips) => oldTips ? oldTips.filter(tip => tip.id !== tipId) : []
      );
    }
  };
  
  // Handle generate new tips
  const handleGenerateTips = () => {
    generateTipsMutation.mutate();
  };
  
  // Handle toggle section expansion
  const toggleExpand = () => {
    setExpandedSection(!expandedSection);
  };
  
  // Loading state
  if (isLoadingTips) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center">
            <Sparkles className="h-5 w-5 mr-2 text-indigo-500" />
            AI Tips & Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </CardContent>
      </Card>
    );
  }
  
  // Error state
  if (tipsError) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center">
            <Sparkles className="h-5 w-5 mr-2 text-indigo-500" />
            AI Tips & Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Error loading tips. Please try again later.</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2" 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/il/tips'] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center cursor-pointer" onClick={toggleExpand}>
            <Sparkles className="h-5 w-5 mr-2 text-indigo-500" />
            AI Tips & Insights
          </CardTitle>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleGenerateTips}
            disabled={generateTipsMutation.isPending}
          >
            {generateTipsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Tips
              </>
            )}
          </Button>
        </div>
        <CardDescription>
          Personalized recommendations based on your learning patterns
        </CardDescription>
      </CardHeader>
      
      {expandedSection && (
        <CardContent>
          {(!tips || tips.length === 0) ? (
            <div className="text-center py-6">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                You have no active tips at the moment.
              </p>
              <Button 
                variant="outline" 
                onClick={handleGenerateTips}
                disabled={generateTipsMutation.isPending}
              >
                {generateTipsMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Personalized Tips
                  </>
                )}
              </Button>
            </div>
          ) : (
            <motion.div 
              className="space-y-4"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.1
                  }
                }
              }}
            >
              {tips.map((tip) => (
                <motion.div
                  key={tip.id}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0 }
                  }}
                >
                  <AITipsCard 
                    tip={tip} 
                    onDismiss={() => handleDismissTip(tip.id)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default AITipsSection;