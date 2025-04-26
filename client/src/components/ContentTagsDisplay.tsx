import React, { useEffect, useState } from "react";
import * as tagService from "@/lib/tag-service";
import { cn } from "@/lib/utils";
import "animate.css";

interface ContentTagsDisplayProps {
  tags: string[];
  onTagClick?: (tag: string) => void;
  className?: string;
  limit?: number;
}

/**
 * Component to display content tags with animations and color coding
 */
export const ContentTagsDisplay: React.FC<ContentTagsDisplayProps> = ({
  tags,
  onTagClick,
  className,
  limit
}) => {
  const [visibleTags, setVisibleTags] = useState<{ tag: string; animationClass: string; colorClass: string }[]>([]);
  const [showAll, setShowAll] = useState(false);
  const displayLimit = limit || 5;

  useEffect(() => {
    // Process tags with animations and colors
    const formattedTags = tags.map(tag => {
      // Default relevance of 40 for basic tags
      const relevance = 40;
      return {
        tag,
        animationClass: tagService.getTagAnimationClass(relevance),
        colorClass: tagService.getTagColorClass(relevance)
      };
    });

    setVisibleTags(formattedTags);
  }, [tags]);

  // Display either all tags or just the limited amount
  const displayedTags = showAll 
    ? visibleTags 
    : visibleTags.slice(0, displayLimit);

  // Handle clicking the "more" button
  const toggleShowAll = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowAll(!showAll);
  };

  return (
    <div className={cn("flex flex-wrap gap-2 my-2", className)}>
      {displayedTags.map((tagItem, index) => (
        <span
          key={index}
          onClick={() => onTagClick && onTagClick(tagItem.tag)}
          className={cn(
            "px-2 py-1 text-xs rounded-full border animate__animated",
            tagItem.colorClass,
            tagItem.animationClass,
            onTagClick ? "cursor-pointer hover:opacity-80" : ""
          )}
          style={{ 
            animationDelay: `${index * 100}ms`,
            animationDuration: '0.5s'
          }}
        >
          {tagItem.tag}
        </span>
      ))}

      {/* Show "more" button if there are more tags than the limit */}
      {visibleTags.length > displayLimit && (
        <button
          onClick={toggleShowAll}
          className="text-xs text-blue-600 hover:text-blue-800 underline px-2 py-1"
        >
          {showAll ? "Show less" : `+${visibleTags.length - displayLimit} more`}
        </button>
      )}
    </div>
  );
};

export default ContentTagsDisplay;