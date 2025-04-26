import { useState } from 'react';
import { Book } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import 'animate.css';
import { cn } from '@/lib/utils';

interface DepartmentBadgeProps {
  departmentName?: string | null | undefined;
  departmentId?: number | null;
  className?: string;
  message?: string | undefined;
}

type Department = {
  id: number;
  name: string;
  description: string | null;
};

export function DepartmentBadge({ 
  departmentName: propDepartmentName, 
  departmentId,
  className,
  message
}: DepartmentBadgeProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Fetch department by ID if departmentId is provided
  const { data: department } = useQuery({
    queryKey: ['/api/departments', departmentId],
    queryFn: async () => {
      if (!departmentId) return null;
      const res = await apiRequest('GET', `/api/departments/${departmentId}`);
      return res.json() as Promise<Department>;
    },
    enabled: !!departmentId
  });
  
  // Use either the prop name or the fetched department name
  const departmentName = propDepartmentName || (department ? department.name : null);
  
  // Trigger animation on hover
  const triggerAnimation = () => {
    setIsAnimating(true);
    // Reset animation state after animation completes
    setTimeout(() => setIsAnimating(false), 1000);
  };
  
  // Check if user is admin based on message content
  const isAdmin = message && message.toLowerCase().includes('admin');
  
  if (!departmentName) {
    // Don't show "No Department" badge for anyone
    return message ? <p className="text-sm text-muted-foreground">{message}</p> : null;
  }
  
  return (
    <div className="flex flex-col items-center">
      <Badge 
        variant="secondary" 
        className={cn(
          "cursor-pointer font-semibold transition-all", 
          isAnimating && "animate__animated animate__rotateIn", 
          className
        )}
        onMouseEnter={triggerAnimation}
        onClick={triggerAnimation}
      >
        <Book className="h-4 w-4 mr-1" />
        {departmentName}
      </Badge>
      {message && <p className="text-sm text-muted-foreground mt-1">{message}</p>}
    </div>
  );
}