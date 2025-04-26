import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import * as tagService from "@/lib/tag-service";
import { cn } from "@/lib/utils";
import "animate.css";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestedTags?: string[];
  title?: string;
  description?: string;
  subject?: string;
  fileType?: string;
  filename?: string;
  className?: string;
  placeholder?: string;
  maxTags?: number;
}

/**
 * A component for inputting and managing tags
 * Can display AI-suggested tags and allow user to add/remove tags
 */
export default function TagInput({
  tags = [],
  onChange,
  suggestedTags = [],
  title = "",
  description = "",
  subject = "",
  fileType = "",
  filename = "",
  className = "",
  placeholder = "Add a tag...",
  maxTags = 10
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [aiTags, setAiTags] = useState<string[]>(suggestedTags);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Fetch AI tag suggestions when relevant properties change
  useEffect(() => {
    const fetchSuggestions = async () => {
      // Only fetch if we have the minimum required properties
      if (title && subject && fileType && filename) {
        setIsLoadingSuggestions(true);
        try {
          const suggestions = await tagService.getSuggestedTags({
            title,
            description,
            subject,
            fileType,
            filename
          });
          
          // Filter out suggestions that are already in the tags list
          const filteredSuggestions = suggestions.filter(
            tag => !tags.includes(tag)
          );
          
          setAiTags(filteredSuggestions);
        } catch (error) {
          console.error("Error fetching tag suggestions:", error);
        } finally {
          setIsLoadingSuggestions(false);
        }
      }
    };

    // Only fetch if we don't already have suggestions
    if (aiTags.length === 0 && suggestedTags.length === 0) {
      fetchSuggestions();
    }
  }, [title, description, subject, fileType, filename, tags, suggestedTags]);

  // Add a tag to the list
  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (
      trimmedTag &&
      !tags.includes(trimmedTag) &&
      tags.length < maxTags
    ) {
      const newTags = [...tags, trimmedTag];
      onChange(newTags);
      setInputValue('');
      
      // Remove the tag from AI suggestions if it exists there
      if (aiTags.includes(trimmedTag)) {
        setAiTags(aiTags.filter(t => t !== trimmedTag));
      }
    }
  };

  // Remove a tag from the list
  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  // Handle input submission via Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue) {
      e.preventDefault();
      addTag(inputValue);
    }
  };

  // Handle adding suggested tag
  const handleAddSuggested = (tag: string) => {
    addTag(tag);
  };

  // Toggle suggestion visibility
  const toggleSuggestions = () => {
    setShowSuggestions(!showSuggestions);
  };

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="flex flex-wrap gap-2 mb-2">
        {/* Display current tags */}
        {tags.map((tag, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-sm rounded-full border",
              tagService.getTagColorClass(40), // Default relevance score
              "animate__animated animate__fadeIn"
            )}
            style={{ animationDuration: '0.3s' }}
          >
            <span>{tag}</span>
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Tag input */}
      <div className="flex gap-2">
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1"
          disabled={tags.length >= maxTags}
        />
        <Button
          type="button"
          onClick={() => addTag(inputValue)}
          disabled={!inputValue.trim() || tags.length >= maxTags}
          size="sm"
        >
          Add
        </Button>
      </div>

      {/* Tag suggestions section */}
      {aiTags.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-medium text-gray-700">
              AI Suggested Tags
            </h4>
            <button
              type="button"
              onClick={toggleSuggestions}
              className="text-xs text-blue-600 hover:underline"
            >
              {showSuggestions ? 'Hide' : 'Show'}
            </button>
          </div>

          {showSuggestions && (
            <div className="flex flex-wrap gap-2">
              {aiTags.map((tag, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleAddSuggested(tag)}
                  className={cn(
                    "px-2 py-1 text-xs rounded-full border animate__animated",
                    tagService.getTagColorClass(60), // Higher relevance for suggestions
                    tagService.getTagAnimationClass(60)
                  )}
                  style={{ 
                    animationDelay: `${index * 50}ms`,
                    animationDuration: '0.5s'
                  }}
                  disabled={tags.length >= maxTags}
                >
                  + {tag}
                </button>
              ))}
              
              {isLoadingSuggestions && (
                <span className="text-xs text-gray-500">
                  Loading suggestions...
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Max tags info */}
      <div className="text-xs text-gray-500 mt-1">
        {tags.length}/{maxTags} tags
      </div>
    </div>
  );
}