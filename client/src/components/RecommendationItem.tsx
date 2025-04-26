import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, Info } from "lucide-react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger 
} from "@/components/ui/tooltip";

interface RecommendationItemProps {
  id: string;
  index: number;
  item: string;
  iconBgColor: string;
  badgeBgColor: string;
  badgeTextColor: string;
}

export function RecommendationItem({ 
  id, 
  index, 
  item, 
  iconBgColor, 
  badgeBgColor, 
  badgeTextColor 
}: RecommendationItemProps) {
  
  const getCategory = () => {
    return index % 3 === 0 ? 'Quick Win' : index % 3 === 1 ? 'Medium Effort' : 'High Impact';
  };
  
  const getCategoryDescription = () => {
    const category = getCategory();
    if (category === 'Quick Win') {
      return "Quick Wins are simple actions that take minimal time but deliver immediate benefits. They're perfect for getting started.";
    } else if (category === 'Medium Effort') {
      return "Medium Effort tasks require more planning and time, but provide valuable improvements to your college system.";
    } else {
      return "High Impact actions may take significant effort but deliver the greatest long-term benefits for your college.";
    }
  };
  
  const handleHighlight = () => {
    const element = document.getElementById(id);
    if (element) {
      element.classList.add('recommendation-highlight');
      element.classList.add(badgeTextColor.replace('text-', 'ring-'));
      
      setTimeout(() => {
        element.classList.remove('recommendation-highlight');
        element.classList.remove(badgeTextColor.replace('text-', 'ring-'));
      }, 2000);
    }
  };
  
  return (
    <li 
      id={id}
      className="rounded-lg border-2 p-4 shadow bg-white recommendation-item animate__animated animate__fadeIn"
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full ${iconBgColor} flex items-center justify-center`}>
          <span className="font-bold text-sm text-white">{index+1}</span>
        </div>
        <div className="space-y-2 flex-1">
          <p className="text-gray-800 font-medium">{item}</p>
          <div className="flex justify-between items-center border-t border-gray-100 pt-2 mt-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className={`${badgeBgColor} ${badgeTextColor} flex items-center gap-1`}>
                    {getCategory()}
                    <Info className="h-3 w-3 ml-1" />
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{getCategoryDescription()}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <button
              className="inline-flex items-center text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-full transition-colors cursor-pointer"
              onClick={handleHighlight}
            >
              <Clock className="h-3 w-3 mr-1" />
              Try this: {index % 2 === 0 ? 'Today' : 'This week'}
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}