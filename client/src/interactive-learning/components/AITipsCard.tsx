import React, { useState } from 'react';
import { AlertCircle, CheckCircle, X, BookOpen, MessageSquare, BarChart4, ArrowRight, ThumbsUp, ThumbsDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Link, useLocation } from 'wouter';

export type AITip = {
  id: number;
  content: string;
  tip_type: string;
  priority: number;
  relevance_score: number;
  expires_at: string | null;
  action_link: string | null;
  context: string | null;
  ui_style: string;
  source_type: string;
  is_read: boolean;
  is_helpful: boolean | null;
  created_at: string;
};

type AITipsCardProps = {
  tip: AITip;
  onDismiss?: () => void;
};

export const AITipsCard: React.FC<AITipsCardProps> = ({ tip, onDismiss }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Determine the icon based on tip type
  const getTipIcon = () => {
    switch (tip.tip_type) {
      case 'quiz':
        return <BookOpen className="h-5 w-5" />;
      case 'forum':
        return <MessageSquare className="h-5 w-5" />;
      case 'poll':
        return <BarChart4 className="h-5 w-5" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5" />;
      case 'success':
        return <CheckCircle className="h-5 w-5" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  // Determine card style based on priority and UI style
  const getCardStyle = () => {
    const baseClasses = "relative rounded-lg shadow-md p-4";
    
    // Priority-based styling (more prominent for higher priority)
    const priorityClasses = tip.priority >= 4 
      ? "border-l-4" 
      : "border";
    
    // UI style-based coloring
    switch (tip.ui_style) {
      case 'warning':
        return `${baseClasses} ${priorityClasses} border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20`;
      case 'error':
        return `${baseClasses} ${priorityClasses} border-red-500 bg-red-50 dark:bg-red-900/20`;
      case 'success':
        return `${baseClasses} ${priorityClasses} border-green-500 bg-green-50 dark:bg-green-900/20`;
      case 'info':
        return `${baseClasses} ${priorityClasses} border-blue-500 bg-blue-50 dark:bg-blue-900/20`;
      default:
        return `${baseClasses} ${priorityClasses} border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20`;
    }
  };

  // Mark tip as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async ({ tipId, isHelpful }: { tipId: number, isHelpful?: boolean }) => {
      const response = await apiRequest('POST', `/api/il/tips/${tipId}/read`, { is_helpful: isHelpful });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/il/tips'] });
      
      if (onDismiss) {
        onDismiss();
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to mark tip as read',
        variant: 'destructive',
      });
      console.error('Error marking tip as read:', error);
    }
  });

  // Handle tip feedback
  const handleFeedback = (isHelpful: boolean) => {
    markAsReadMutation.mutate({ tipId: tip.id, isHelpful });
  };

  // Handle action click
  const handleActionClick = () => {
    if (tip.action_link) {
      // Mark as read before navigating
      markAsReadMutation.mutate({ tipId: tip.id });
      
      // Navigate to the action link
      navigate(tip.action_link);
    }
  };

  // Handle dismiss
  const handleDismiss = () => {
    markAsReadMutation.mutate({ tipId: tip.id });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className={getCardStyle()}
      >
        {/* Close button */}
        <button 
          onClick={handleDismiss} 
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          aria-label="Dismiss tip"
        >
          <X className="h-4 w-4" />
        </button>
        
        <div className="flex items-start">
          {/* Icon */}
          <div className="mr-3 mt-0.5">
            {getTipIcon()}
          </div>
          
          {/* Content */}
          <div className="flex-1">
            <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">
              {tip.content}
            </p>
            
            {/* Context tags if present */}
            {tip.context && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tip.context.split(';').map((tag, index) => (
                  <span 
                    key={index} 
                    className="px-2 py-1 text-xs rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    {tag.trim()}
                  </span>
                ))}
              </div>
            )}
            
            {/* Action button */}
            {tip.action_link && (
              <div className="mt-3">
                <button
                  onClick={handleActionClick}
                  className="flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                >
                  Take action <ArrowRight className="ml-1 h-3 w-3" />
                </button>
              </div>
            )}
            
            {/* Feedback buttons */}
            <div className="mt-3 flex items-center space-x-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">Was this helpful?</p>
              <button
                onClick={() => handleFeedback(true)}
                className="flex items-center text-xs text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                disabled={markAsReadMutation.isPending}
              >
                <ThumbsUp className="mr-1 h-3 w-3" />
                Yes
              </button>
              <button
                onClick={() => handleFeedback(false)}
                className="flex items-center text-xs text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                disabled={markAsReadMutation.isPending}
              >
                <ThumbsDown className="mr-1 h-3 w-3" />
                No
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AITipsCard;