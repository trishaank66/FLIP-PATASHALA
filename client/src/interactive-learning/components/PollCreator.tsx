import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { PollService } from '../services/poll-service';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Form validation schema
const pollFormSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }).max(100),
  question: z.string().min(10, { message: "Question must be at least 10 characters" }).max(300),
  options: z
    .array(
      z.object({
        text: z.string().min(1, { message: "Option text is required" }).max(200),
      })
    )
    .min(2, { message: "At least 2 options are required" })
    .max(10, { message: "Maximum 10 options allowed" }),
  timerDuration: z.number().min(0).optional(),
  timerEnabled: z.boolean().default(false),
});

type PollFormValues = z.infer<typeof pollFormSchema>;

interface PollCreatorProps {
  userId: number;
  subject: string;
  departmentId?: number;
  contentId?: number;
  onPollCreated?: () => void;
}

/**
 * Poll creator component for faculty
 */
export function PollCreator({ userId, subject, departmentId, contentId, onPollCreated }: PollCreatorProps) {
  const { toast } = useToast();
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  
  // Form definition using react-hook-form
  const form = useForm<PollFormValues>({
    resolver: zodResolver(pollFormSchema),
    defaultValues: {
      title: "",
      question: "",
      options: [{ text: "" }, { text: "" }],
      timerEnabled: false,
      timerDuration: 60, // 60 seconds default
    },
  });
  
  // Timer options in seconds
  const timerOptions = [
    { value: 30, label: "30 seconds" },
    { value: 60, label: "1 minute" },
    { value: 120, label: "2 minutes" },
    { value: 300, label: "5 minutes" },
    { value: 600, label: "10 minutes" },
    { value: 900, label: "15 minutes" },
  ];
  
  // Field array for dynamic options
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "options",
  });
  
  // Create poll mutation
  const createPollMutation = useMutation({
    mutationFn: (values: PollFormValues) => {
      return PollService.createPoll({
        title: values.title,
        question: values.question,
        options: values.options.map(option => option.text),
        created_by: userId,
        subject,
        department_id: departmentId,
        content_id: contentId,
        timer_duration: values.timerEnabled ? values.timerDuration : undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: "Poll Created",
        description: "Your poll has been created successfully",
      });
      
      if (onPollCreated) {
        onPollCreated();
      }
    },
    onError: (error) => {
      toast({
        title: "Error Creating Poll",
        description: error instanceof Error ? error.message : "Failed to create the poll",
        variant: "destructive",
      });
    },
  });
  
  // Generate tags for poll question
  const generateTags = async (question: string) => {
    try {
      // Simple client-side keyword extraction for common educational terms
      const educationalKeywords = [
        'learn', 'understand', 'explain', 'describe', 'analyze', 
        'evaluate', 'compare', 'contrast', 'define', 'identify',
        'math', 'science', 'history', 'language', 'programming',
        'concept', 'theory', 'principle', 'method', 'technique'
      ];
      
      // Get words from the question (lowercase, no punctuation)
      const words = question.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3); // Only words longer than 3 characters
      
      // Find educational terms in the question
      const foundKeywords = words.filter(word => 
        educationalKeywords.some(keyword => word.includes(keyword) || keyword.includes(word))
      );
      
      // Use the most relevant keywords as tags (max 5)
      // Create a Set to deduplicate keywords, then convert to array
      const uniqueKeywords = new Set<string>();
      foundKeywords.forEach(kw => uniqueKeywords.add(kw));
      const extractedTags = Array.from(uniqueKeywords).slice(0, 5);
      
      // Convert first letter to uppercase for each tag
      const formattedTags = extractedTags.map(tag => 
        tag.charAt(0).toUpperCase() + tag.slice(1)
      );
      
      setSuggestedTags(formattedTags);
    } catch (error) {
      console.error("Error generating tags:", error);
    }
  };
  
  // Handle form submission
  const onSubmit = async (values: PollFormValues) => {
    try {
      await createPollMutation.mutateAsync(values);
    } catch (error) {
      // Error is handled in mutation callbacks
      console.error("Error in createPollMutation:", error);
    }
  };
  
  return (
    <Card className="w-full animate__animated animate__fadeIn">
      <CardHeader>
        <CardTitle>Create a New Poll</CardTitle>
        <CardDescription>Create an interactive poll for your students</CardDescription>
      </CardHeader>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {/* Poll Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Poll Title</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter a title for your poll" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Poll Question */}
            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter your poll question" 
                      {...field} 
                      onChange={(e) => {
                        field.onChange(e);
                        // Generate tags when question is changed
                        if (e.target.value.length > 20) {
                          generateTags(e.target.value);
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Timer Settings */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="timerEnabled"
                  checked={form.watch("timerEnabled")}
                  onChange={(e) => form.setValue("timerEnabled", e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="timerEnabled" className="flex items-center gap-1.5 text-sm font-medium">
                  <Clock className="h-4 w-4" />
                  <span>Enable Timer</span>
                </label>
              </div>
              
              {form.watch("timerEnabled") && (
                <FormField
                  control={form.control}
                  name="timerDuration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timer Duration</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select timer duration" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {timerOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value.toString()}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            
            {/* Poll Options */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <FormLabel>Options</FormLabel>
                <span className="text-xs text-muted-foreground">
                  {fields.length} of 10 options
                </span>
              </div>
              
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <FormField
                    control={form.control}
                    name={`options.${index}.text`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input 
                            placeholder={`Option ${index + 1}`} 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {fields.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4 text-gray-400" />
                    </Button>
                  )}
                </div>
              ))}
              
              {fields.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => append({ text: "" })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Option
                </Button>
              )}
            </div>
            
            {/* Suggested Tags */}
            {suggestedTags.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Suggested Tags:</div>
                <div className="flex flex-wrap gap-2">
                  {suggestedTags.map((tag, index) => (
                    <Badge key={index} variant="outline">{tag}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  These tags will be used to help organize and recommend your poll
                </p>
              </div>
            )}
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button
              type="submit"
              disabled={createPollMutation.isPending}
            >
              {createPollMutation.isPending ? 'Creating...' : 'Create Poll'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}