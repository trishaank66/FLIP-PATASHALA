import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface FilterableButtonProps {
  label: string;
  category: string;
  badgeStyle: string;
  onClick: () => void;
}

export function FilterableButton({ label, category, badgeStyle, onClick }: FilterableButtonProps) {
  const [isActive, setIsActive] = useState(false);
  
  const handleClick = () => {
    setIsActive(!isActive);
    onClick();
  };
  
  return (
    <Badge 
      variant={isActive ? "secondary" : "outline"} 
      className={`cursor-pointer ${isActive ? badgeStyle : "bg-white hover:bg-gray-100"}`}
      onClick={handleClick}
    >
      {label}
    </Badge>
  );
}