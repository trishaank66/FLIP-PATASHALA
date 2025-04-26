import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { RecommendationItem } from "./RecommendationItem";

interface SectionColor {
  bg: string;
  text: string;
  bullet: string;
}

interface RecommendationsSectionProps {
  sectionKey: string;
  title: string;
  content: string[];
  icon: ReactNode;
  color: SectionColor;
}

export function RecommendationsSection({ 
  sectionKey, 
  title, 
  content, 
  icon, 
  color 
}: RecommendationsSectionProps) {
  return (
    <div className={`p-6 border-2 rounded-lg shadow-lg mb-6 ${color.bg}`}>
      <div className="mb-5 pb-3 border-b border-amber-200">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color.text.replace('text-', 'bg-').replace('700', '100')}`}>
            {icon}
          </div>
          <h3 className={`text-xl font-bold ${color.text}`}>
            {title}
          </h3>
        </div>
        <p className="text-sm text-gray-600 ml-12">
          {title.toLowerCase().includes('student') ? 
            'Simple steps to help your students succeed' : 
          title.toLowerCase().includes('faculty') ?
            'Easy ways to support your teaching staff' :
          title.toLowerCase().includes('department') ?
            'Ideas to make your departments work better together' :
            'Important actions to improve your college'}
        </p>
      </div>
      
      {/* Summary Badge */}
      <div className="mb-4">
        <Badge 
          variant="secondary"
          className={`${color.text.replace('text-', 'bg-').replace('700', '600')} text-white`}
        >
          {content.length} Action{content.length !== 1 ? 's' : ''}
        </Badge>
      </div>
      
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {content.length > 0 ? (
          content.map((item, i) => (
            <RecommendationItem 
              key={i}
              id={`recommendation-${sectionKey}-${i}`}
              index={i}
              item={item}
              iconBgColor={color.text.replace('text-', 'bg-').replace('700', '600')}
              badgeBgColor={color.bg}
              badgeTextColor={color.text}
            />
          ))
        ) : (
          <li className="col-span-2 p-6 text-center bg-white rounded-lg border-2">
            <p className="text-gray-500">No actions found</p>
          </li>
        )}
      </ul>
    </div>
  );
}