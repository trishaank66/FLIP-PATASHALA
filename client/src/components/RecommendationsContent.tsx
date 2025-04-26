import { ReactNode, useMemo } from "react";
import { 
  GraduationCap,
  School, 
  Building2,
  Sparkles
} from "lucide-react";
import { RecommendationsSection } from "./RecommendationsSection";

type SectionColor = {
  bg: string;
  text: string;
  bullet: string;
};

interface SectionInfo {
  title: string;
  content: string[];
  icon: ReactNode;
  color: SectionColor;
}

interface RecommendationsContentProps {
  aiRecommendations: string;
}

export function RecommendationsContent({ aiRecommendations }: RecommendationsContentProps) {
  // Get color scheme based on title
  const getHeadingColor = (title: string): SectionColor => {
    if (title.toLowerCase().includes('student')) {
      return {
        bg: 'bg-indigo-50',
        text: 'text-indigo-700',
        bullet: 'bg-indigo-500'
      };
    } else if (title.toLowerCase().includes('faculty')) {
      return {
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        bullet: 'bg-purple-500'
      };
    } else if (title.toLowerCase().includes('department')) {
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        bullet: 'bg-blue-500'
      };
    } else {
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        bullet: 'bg-amber-500'
      };
    }
  };
  
  // Get icon based on title
  const getHeadingIcon = (title: string): ReactNode => {
    if (title.toLowerCase().includes('student')) {
      return <GraduationCap className="h-5 w-5" />;
    } else if (title.toLowerCase().includes('faculty')) {
      return <School className="h-5 w-5" />;
    } else if (title.toLowerCase().includes('department')) {
      return <Building2 className="h-5 w-5" />;
    } else {
      return <Sparkles className="h-5 w-5" />;
    }
  };
  
  // Parse recommendations and organize them into categories
  const sections = useMemo(() => {
    // Initialize recommendation categories
    const studentItems: string[] = [];
    const facultyItems: string[] = [];
    const departmentItems: string[] = [];
    const generalItems: string[] = [];
    
    let currentSection = '';
    
    // Parse recommendations line by line
    aiRecommendations.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      
      // Check if this is a section header
      if (trimmedLine.startsWith('# ')) {
        currentSection = trimmedLine.replace('# ', '').toLowerCase();
      } 
      // Process bullet points
      else if (trimmedLine.startsWith('- ') && currentSection) {
        const content = trimmedLine.replace('- ', '');
        
        // Sort recommendations into categories
        if (currentSection.includes('quick') || currentSection.includes('win')) {
          // Route quick wins based on content
          if (content.toLowerCase().includes('student')) {
            studentItems.push(content);
          } else if (content.toLowerCase().includes('faculty') || content.toLowerCase().includes('teacher')) {
            facultyItems.push(content);
          } else if (content.toLowerCase().includes('department') || content.toLowerCase().includes('group')) {
            departmentItems.push(content);
          } else {
            generalItems.push(content);
          }
        } else if (currentSection.includes('student')) {
          studentItems.push(content);
        } else if (currentSection.includes('faculty')) {
          facultyItems.push(content);
        } else if (currentSection.includes('department')) {
          departmentItems.push(content);
        } else {
          generalItems.push(content);
        }
      }
    });
    
    // Create section objects
    const result: SectionInfo[] = [];
    
    if (departmentItems.length > 0) {
      result.push({
        title: 'Department Recommendations',
        content: departmentItems,
        icon: getHeadingIcon('Department'),
        color: getHeadingColor('Department')
      });
    }
    
    if (studentItems.length > 0) {
      result.push({
        title: 'Student Recommendations',
        content: studentItems,
        icon: getHeadingIcon('Student'),
        color: getHeadingColor('Student')
      });
    }
    
    if (facultyItems.length > 0) {
      result.push({
        title: 'Faculty Recommendations',
        content: facultyItems,
        icon: getHeadingIcon('Faculty'),
        color: getHeadingColor('Faculty')
      });
    }
    
    if (generalItems.length > 0) {
      result.push({
        title: 'General Recommendations',
        content: generalItems,
        icon: getHeadingIcon('General'),
        color: getHeadingColor('General')
      });
    }
    
    return result;
  }, [aiRecommendations]);
  
  if (sections.length === 0) {
    return <div className="text-center p-8">No recommendations available</div>;
  }
  
  return (
    <div>
      {sections.map((section, index) => (
        <RecommendationsSection 
          key={index}
          sectionKey={section.title.replace(/\s+/g, '-').toLowerCase()}
          title={section.title}
          content={section.content}
          icon={section.icon}
          color={section.color}
        />
      ))}
    </div>
  );
}