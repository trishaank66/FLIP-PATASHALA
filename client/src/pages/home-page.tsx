import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VerificationStatus } from "@/components/VerificationStatus";
import { FacultyVerificationStatus } from "@/components/FacultyVerificationStatus";
import { AdminDashboard } from "@/components/AdminDashboard";
import { DepartmentBadge } from "@/components/DepartmentBadge";
import SortedContentFolders from "@/components/SortedContentFolders";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { UserWithDepartment } from "@shared/schema";
import { Loader2, LogOut, BookOpen, Sparkles, BrainCircuit, Lightbulb, GraduationCap, Library, FolderOpen, Puzzle } from "lucide-react";
import { Link } from "wouter";
import { PageLayout } from "@/components/ui/page-layout";
import { useState, useEffect } from "react";
import 'animate.css';

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);

  // Telugu quotes with translations
  const teluguQuotes = [
    {
      quote: "ఫ్లిప్డ్ క్లాస్ తో ఫలితం ఘనము, ఏఐ తో అభ్యాసం అనన్యం!",
      transliteration: "Flipped class tō phalitam ghanamu, AI tō abhyāsam ananyam!",
      translation: "With flipped class, results are great. With AI, learning is unique!",
      icon: <GraduationCap className="h-6 w-6" />
    },
    {
      quote: "ఫ్లిప్డ్ క్లాస్ తో ఫలితం స్పష్టం, ఏఐ తో అభ్యాసం కాదు కష్టం!",
      transliteration: "Flipped class tō phalitam spaṣṭaṁ, AI tō abhyāsaṁ kādu kaṣṭaṁ!",
      translation: "With flipped class, results are clear. With AI, learning's not tough!",
      icon: <Sparkles className="h-6 w-6" />
    },
    {
      quote: "పుస్తకాలు కాదు ఒక్క మార్గం, ఏఐ తో ఉన్నాయి శతమార్గం!",
      transliteration: "Pustakālu kādu okka mārgaṁ, AI tō unnāyi śatamārgaṁ!",
      translation: "Books aren't the only path — with AI, there are hundreds of paths!",
      icon: <BookOpen className="h-6 w-6" />
    },
    {
      quote: "తరగతి గది కాదు చదువు గమ్యం, ఏఐ తో మారుతుంది విజ్ఞాన పథం!",
      transliteration: "Taragati gadi kādu caduvu gamyaṁ, AI tō mārutundi vijñāna pathaṁ!",
      translation: "Classroom isn't the destination — with AI, learning finds new direction!",
      icon: <BrainCircuit className="h-6 w-6" />
    },
    {
      quote: "చదువుకో ఎప్పుడైనా – ఏఐ తో ఎక్కడైనా!",
      transliteration: "Caduvukō eppuḍainā – AI tō ekkaḍainā!",
      translation: "Learn anytime – with AI, from anywhere!",
      icon: <Lightbulb className="h-6 w-6" />
    },
    {
      quote: "కృత్రిమ మేధతో డిజిటల్ ఊపు, నీ చదువులో ఇక విజయ హోరు!",
      transliteration: "Kr̥trima mēdhatō ḍijiṭal ūpu, nī caduvulō ika vijaya hōru!",
      translation: "With AI's digital surge, your studies roar with victory!",
      icon: <Sparkles className="h-6 w-6" />
    }
  ];

  // Cycle through quotes every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuoteIndex(prevIndex => 
        prevIndex === teluguQuotes.length - 1 ? 0 : prevIndex + 1
      );
    }, 8000);
    
    return () => clearInterval(interval);
  }, []);

  // Fetch the user info with department details
  const { 
    data: userWithDept,
    isLoading: isLoadingDept 
  } = useQuery<UserWithDepartment>({
    queryKey: ['/api/user-with-department'],
    queryFn: getQueryFn({ on401: 'throw' }),
    enabled: !!user, // Only run query if user is logged in
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Role-specific department messages
  const getDepartmentMessage = (): string | undefined => {
    if (!userWithDept?.department) return undefined;

    switch (user?.role) {
      case 'student':
        return `Your department is ${userWithDept.department.name}—ready to learn!`;
      case 'faculty':
        return `Your department is ${userWithDept.department.name}—start teaching!`;
      case 'admin':
        return "See departments to plan your work!";
      default:
        return undefined;
    }
  };

  return (
    <PageLayout 
      title="FLIP Patashala Dashboard" 
      showHomeButton={false}
      showBackButton={true}
      backTo="/auth"
      backgroundColor="bg-blue-50/20"
    >
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg animate__animated animate__fadeIn">
              <h2 className="font-medium text-lg mb-2">
                Welcome, {user?.first_name 
                  ? `${user.first_name} ${user.last_name || ''}` 
                  : user?.email}!
              </h2>
              <p className="text-gray-600 mb-4">
                You are logged in as a <span className="font-medium capitalize">{user?.role}</span>.
              </p>
              
              {/* Department badge with animation */}
              <div className="flex justify-center my-4">
                {isLoadingDept ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                    <span>Loading department...</span>
                  </div>
                ) : (
                  <DepartmentBadge 
                    departmentName={userWithDept?.department?.name} 
                    message={getDepartmentMessage()}
                  />
                )}
              </div>
            </div>
            
            {/* Student verification status - only shown for students */}
            {user?.role === 'student' && <VerificationStatus />}
            
            {/* Faculty verification status - only shown for faculty */}
            {user?.role === 'faculty' && <FacultyVerificationStatus />}
            
            {/* Admin faculty verification dashboard - only shown for admins */}
            {user?.role === 'admin' && <AdminDashboard />}
            
            {/* Display sorted content folders */}
            {user && (
              <div className="mt-4 animate__animated animate__fadeIn">
                <div className="flex items-center mb-3">
                  <FolderOpen className="h-5 w-5 mr-2 text-primary" />
                  <h3 className="text-lg font-medium">Class Folders</h3>
                </div>
                <SortedContentFolders userId={user.id} userRole={user.role} />
              </div>
            )}
            
            {/* Telugu Quotes with Animation */}
            <div className="mt-8 mb-10 overflow-hidden rounded-lg shadow-lg animate__animated animate__fadeIn animate__delay-1s">
              <div className="bg-blue-800 text-white py-2 px-4 flex items-center justify-between">
                <div className="flex items-center">
                  <Lightbulb className="h-5 w-5 mr-2 animate__animated animate__pulse animate__infinite" />
                  <h3 className="font-bold text-lg">Telugu Wisdom Corner</h3>
                </div>
                <div className="text-xs bg-yellow-500 text-blue-900 px-2 py-1 rounded-full font-bold animate__animated animate__fadeIn">
                  FLIP ప్రేరణ • Inspiration
                </div>
              </div>
              <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
                <div className="relative py-6 px-4">
                  {/* Background decorative elements */}
                  <div className="absolute top-0 left-0 w-full h-full opacity-10">
                    <div className="absolute top-2 left-2 w-16 h-16 rounded-full bg-white"></div>
                    <div className="absolute bottom-2 right-2 w-12 h-12 rounded-full bg-white"></div>
                    <div className="absolute top-1/2 left-1/4 w-8 h-8 rounded-full bg-white"></div>
                    <div className="absolute bottom-1/4 right-1/3 w-10 h-10 rounded-full bg-white"></div>
                  </div>
                  
                  {/* Quote content */}
                  <div className="relative z-10 text-white max-w-3xl mx-auto">
                    <div className="flex justify-center mb-3">
                      <div className="bg-white/20 p-3 rounded-full animate__animated animate__bounce">
                        {teluguQuotes[currentQuoteIndex].icon}
                      </div>
                    </div>
                    
                    {/* Telugu quote */}
                    <div key={currentQuoteIndex} className="animate__animated animate__fadeIn mb-2">
                      <h3 className="text-center text-2xl font-bold mb-2" 
                          style={{ 
                            fontFamily: "'Noto Sans Telugu', 'Ponnala', system-ui, sans-serif",
                            lineHeight: 1.6,
                            textShadow: '0 2px 4px rgba(0,0,0,0.2)'
                          }}>
                        {teluguQuotes[currentQuoteIndex].quote}
                      </h3>
                      
                      {/* Transliteration */}
                      <p className="text-center text-sm mb-3 text-white/80 italic">
                        {teluguQuotes[currentQuoteIndex].transliteration}
                      </p>
                      
                      {/* Translation with improved styling */}
                      <div className="flex items-center justify-center mt-3 px-6">
                        <div className="h-px w-12 bg-white/40 mr-4"></div>
                        <p className="text-center text-base font-medium bg-white/10 px-4 py-2 rounded-lg">
                          {teluguQuotes[currentQuoteIndex].translation}
                        </p>
                        <div className="h-px w-12 bg-white/40 ml-4"></div>
                      </div>
                    </div>
                    
                    {/* Quote indicators with improved interaction */}
                    <div className="flex justify-center space-x-3 mt-4">
                      {teluguQuotes.map((_, index) => (
                        <div 
                          key={index} 
                          className={`h-3 w-3 rounded-full transition-all duration-300 ${index === currentQuoteIndex ? 'bg-white scale-125 ring-2 ring-white/50' : 'bg-white/40 hover:bg-white/60'}`}
                          onClick={() => setCurrentQuoteIndex(index)}
                          style={{ cursor: 'pointer' }}
                        ></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Content buttons - shown for students and faculty */}
            {(user?.role === 'student' || user?.role === 'faculty') && (
              <div className="flex flex-col md:flex-row justify-center gap-4 mb-4 animate__animated animate__fadeIn">
                <Link to={user?.role === 'student' ? '/student/content' : '/faculty/content'}>
                  <Button 
                    variant="default"
                    size="lg"
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-md w-full md:w-auto"
                  >
                    <Library className="h-5 w-5" />
                    {user.role === 'student' ? 'Access Learning Content' : 'Manage Learning Content'}
                  </Button>
                </Link>
                
                {/* Interactive Learning Button */}
                <Link to="/interactive-learning">
                  <Button 
                    variant="default"
                    size="lg"
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-md w-full md:w-auto animate__animated animate__pulse"
                  >
                    <Puzzle className="h-5 w-5" />
                    Interactive Learning
                    <span className="text-xs bg-yellow-400 text-purple-900 px-1.5 py-0.5 rounded-full font-bold ml-1">New!</span>
                  </Button>
                </Link>
              </div>
            )}
            
            <div className="flex justify-center mt-4">
              <Button 
                onClick={handleLogout} 
                variant="outline"
                size="sm"
                disabled={logoutMutation.isPending}
                className="flex items-center gap-1 border-red-200 text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                {logoutMutation.isPending ? "Logging out..." : "Logout"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
