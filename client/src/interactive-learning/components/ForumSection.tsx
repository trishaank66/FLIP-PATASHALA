import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PinIcon, MessageCircleIcon, RefreshCcwIcon, PlusIcon, LightbulbIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { trackInteraction } from '../services/engagement-service';
import 'animate.css';

// Define types
interface ForumPost {
  id: number;
  title: string;
  content: string;
  user_id: number;
  user_name: string;
  subject: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
  pinned_by: number | null;
  content_id: number | null;
  department_id: number | null;
  replies: ForumReply[];
}

interface ForumReply {
  id: number;
  post_id: number;
  content: string;
  user_id: number;
  user_name: string;
  created_at: string;
  updated_at: string;
}

interface ForumInsight {
  id: number;
  subject_faculty: string;
  insight_text: string;
  created_at: string;
  is_read: boolean;
}

// Define form validation schemas
const createPostSchema = z.object({
  title: z.string().min(5, { message: "Title must be at least 5 characters" }),
  content_text: z.string().min(10, { message: "Content must be at least 10 characters" }),
});

const createReplySchema = z.object({
  content_text: z.string().min(5, { message: "Reply must be at least 5 characters" }),
});

// Format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString();
};

export function ForumSection({ subject }: { subject: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [replyPostId, setReplyPostId] = useState<number | null>(null);
  const [showInsights, setShowInsights] = useState(false);

  // Query for posts
  const {
    data: posts,
    isLoading,
    error,
    refetch
  } = useQuery<ForumPost[]>({
    queryKey: ["/api/il/forum/subject", subject],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/il/forum/subject/${encodeURIComponent(subject)}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch posts: ${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!subject,
    onError: (err) => {
      console.error('Error fetching posts:', err);
      toast({
        title: "Connection Error",
        description: "Having trouble connecting to the forum. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Query for insights (faculty only)
  const {
    data: insights,
    isLoading: insightsLoading,
    refetch: refetchInsights,
  } = useQuery<ForumInsight[]>({
    queryKey: ["/api/il/forum/insights", subject],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/il/forum/insights/${encodeURIComponent(subject)}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch insights: ${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!subject && user?.role === 'faculty',
    onError: (err) => {
      console.error('Error fetching insights:', err);
      toast({
        title: "Connection Error",
        description: "Having trouble connecting to insights. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Create post form
  const newPostForm = useForm<z.infer<typeof createPostSchema>>({
    resolver: zodResolver(createPostSchema),
    defaultValues: {
      title: "",
      content_text: "",
    },
  });

  // Create reply form
  const replyForm = useForm<z.infer<typeof createReplySchema>>({
    resolver: zodResolver(createReplySchema),
    defaultValues: {
      content_text: "",
    },
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createPostSchema>) => {
      const response = await apiRequest("POST", "/api/il/forum/posts", {
        ...data,
        subject_faculty: subject,
        department_id: user?.department_id,
      });
      if (!response.ok) {
        throw new Error(`Failed to create post: ${response.status} ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      setIsNewPostOpen(false);
      newPostForm.reset();
      toast({
        title: "Post created",
        description: "Your post has been successfully created",
      });
      
      // Track this interaction for engagement tracking
      if (user?.id) {
        trackInteraction(user.id, 'forum_post_create', data.id);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/il/forum/subject", subject] });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating post",
        description: error.message || "Failed to create post. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create reply mutation
  const createReplyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createReplySchema> & { postId: number }) => {
      const response = await apiRequest(
        "POST", 
        `/api/il/forum/posts/${data.postId}/replies`, 
        { content_text: data.content_text }
      );
      if (!response.ok) {
        throw new Error(`Failed to create reply: ${response.status} ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      setReplyPostId(null);
      replyForm.reset();
      toast({
        title: "Reply submitted",
        description: "Your reply has been posted successfully",
      });
      
      // Track this interaction for engagement tracking
      if (user?.id) {
        trackInteraction(user.id, 'forum_reply_create', data.id);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/il/forum/subject", subject] });
    },
    onError: (error: any) => {
      toast({
        title: "Error submitting reply",
        description: error.message || "Failed to submit reply. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Toggle pin status mutation (faculty only)
  const togglePinMutation = useMutation({
    mutationFn: async (postId: number) => {
      const response = await apiRequest("POST", `/api/il/forum/posts/${postId}/toggle-pin`, {});
      if (!response.ok) {
        throw new Error(`Failed to toggle pin: ${response.status} ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Pin status updated",
        description: "The post pin status has been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/il/forum/subject", subject] });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating pin status",
        description: error.message || "Failed to update pin status. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mark insight as read mutation
  const markInsightReadMutation = useMutation({
    mutationFn: async (insightId: number) => {
      const response = await apiRequest("POST", `/api/il/forum/insights/${insightId}/mark-read`, {});
      if (!response.ok) {
        throw new Error(`Failed to mark insight as read: ${response.status} ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      refetchInsights();
    },
    onError: (error: any) => {
      toast({
        title: "Error marking insight as read",
        description: error.message || "Failed to mark insight as read.",
        variant: "destructive",
      });
    },
  });

  // Submit handlers
  const onSubmitPost = (data: z.infer<typeof createPostSchema>) => {
    createPostMutation.mutate(data);
  };

  const onSubmitReply = (data: z.infer<typeof createReplySchema>) => {
    if (replyPostId) {
      createReplyMutation.mutate({ ...data, postId: replyPostId });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Forum</CardTitle>
          </CardHeader>
          <CardContent>
            <p>There was an error loading the forum posts. Please try again later.</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCcwIcon className="mr-2 h-4 w-4" /> Retry
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold animate__animated animate__fadeIn">
          <MessageCircleIcon className="inline-block mr-2" /> Discussion Forum
        </h2>
        <div className="space-x-2">
          {/* Show AI Insights button for faculty only */}
          {user?.role === 'faculty' && (
            <Button 
              variant="outline" 
              onClick={() => setShowInsights(!showInsights)}
              className={insights?.some(i => !i.is_read) ? "relative animate__animated animate__pulse animate__infinite" : ""}
            >
              <LightbulbIcon className="mr-2 h-4 w-4" /> 
              AI Insights
              {insights?.some(i => !i.is_read) && (
                <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full"></span>
              )}
            </Button>
          )}
          <Button onClick={() => setIsNewPostOpen(true)}>
            <PlusIcon className="mr-2 h-4 w-4" /> New Post
          </Button>
        </div>
      </div>

      {/* AI Insights section for faculty */}
      {showInsights && user?.role === 'faculty' && (
        <Card className="mb-6 animate__animated animate__fadeIn bg-muted/30">
          <CardHeader>
            <CardTitle className="flex items-center">
              <LightbulbIcon className="mr-2 h-5 w-5 text-yellow-500" /> 
              AI-Generated Insights
            </CardTitle>
            <CardDescription>
              The system has analyzed student discussions and generated these insights
            </CardDescription>
          </CardHeader>
          <CardContent>
            {insightsLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : insights && insights.length > 0 ? (
              <div className="space-y-4">
                {insights.map((insight) => (
                  <Card 
                    key={insight.id} 
                    className={`border-l-4 ${insight.is_read ? 'border-l-muted-foreground/50' : 'border-l-primary'}`}
                  >
                    <CardContent className="pt-4">
                      <p className={insight.is_read ? "text-muted-foreground" : "font-medium"}>
                        {insight.insight_text}
                      </p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-muted-foreground">
                          Generated: {formatDate(insight.created_at)}
                        </span>
                        {!insight.is_read && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => markInsightReadMutation.mutate(insight.id)}
                          >
                            Mark as read
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground italic">No insights generated yet. Insights are generated automatically based on forum activity.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Posts list */}
      <div className="space-y-4">
        {posts && posts.length > 0 ? (
          posts.map((post) => (
            <Card 
              key={post.id} 
              className={`animate__animated animate__fadeIn ${post.is_pinned ? 'border-primary bg-primary/5' : ''}`}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center">
                      {post.is_pinned && <PinIcon className="mr-2 h-4 w-4 text-primary" />}
                      {post.title}
                    </CardTitle>
                    <CardDescription>
                      Posted by {post.user_name} on {formatDate(post.created_at)}
                    </CardDescription>
                  </div>
                  {/* Pin/Unpin button for faculty */}
                  {user?.role === 'faculty' && (
                    <Button 
                      variant={post.is_pinned ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => togglePinMutation.mutate(post.id)}
                    >
                      <PinIcon className="h-4 w-4 mr-1" />
                      {post.is_pinned ? 'Unpin' : 'Pin'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line">{post.content}</p>

                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {post.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-4">
                <div>
                  <span className="text-sm text-muted-foreground">
                    {post.replies?.length || 0} {post.replies?.length === 1 ? 'reply' : 'replies'}
                  </span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setReplyPostId(post.id)}
                >
                  Reply
                </Button>
              </CardFooter>

              {/* Replies section */}
              {post.replies && post.replies.length > 0 && (
                <Accordion type="single" collapsible defaultValue="replies">
                  <AccordionItem value="replies" className="border-t-0">
                    <AccordionTrigger className="px-6">
                      {post.replies.length} {post.replies.length === 1 ? 'Reply' : 'Replies'}
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-4">
                      <div className="space-y-4">
                        {post.replies.map((reply) => (
                          <div 
                            key={reply.id} 
                            className="py-3 px-4 bg-muted/30 rounded-md"
                          >
                            <div className="flex justify-between">
                              <span className="font-medium">{reply.user_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(reply.created_at)}
                              </span>
                            </div>
                            <p className="mt-2 whitespace-pre-line">{reply.content}</p>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </Card>
          ))
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No posts yet</CardTitle>
              <CardDescription>
                Be the first to start a discussion in this forum!
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button onClick={() => setIsNewPostOpen(true)}>
                <PlusIcon className="mr-2 h-4 w-4" /> Create New Post
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>

      {/* New Post Dialog */}
      <Dialog open={isNewPostOpen} onOpenChange={setIsNewPostOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Discussion Post</DialogTitle>
            <DialogDescription>
              Share your thoughts, questions, or insights with others.
            </DialogDescription>
          </DialogHeader>

          <Form {...newPostForm}>
            <form onSubmit={newPostForm.handleSubmit(onSubmitPost)} className="space-y-6">
              <FormField
                control={newPostForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter a title for your post" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={newPostForm.control}
                name="content_text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter your post content"
                        className="min-h-[200px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Your post will automatically be tagged with relevant keywords.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsNewPostOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createPostMutation.isPending}
                >
                  {createPostMutation.isPending && (
                    <div className="mr-2 animate-spin w-4 h-4 border-2 border-background border-t-transparent rounded-full"></div>
                  )}
                  Post
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Reply Dialog */}
      <Dialog 
        open={replyPostId !== null} 
        onOpenChange={(open) => !open && setReplyPostId(null)}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Reply to Post</DialogTitle>
            <DialogDescription>
              Share your thoughts or answer the question.
            </DialogDescription>
          </DialogHeader>

          <Form {...replyForm}>
            <form onSubmit={replyForm.handleSubmit(onSubmitReply)} className="space-y-6">
              <FormField
                control={replyForm.control}
                name="content_text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Reply</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter your reply"
                        className="min-h-[150px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setReplyPostId(null)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createReplyMutation.isPending}
                >
                  {createReplyMutation.isPending && (
                    <div className="mr-2 animate-spin w-4 h-4 border-2 border-background border-t-transparent rounded-full"></div>
                  )}
                  Submit Reply
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}