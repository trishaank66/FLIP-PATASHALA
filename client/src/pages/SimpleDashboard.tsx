import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TestLoginButtons } from '@/components/TestLoginButtons';
import { useAuth } from '@/hooks/use-auth';
import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { LogIn, UserPlus, GraduationCap, Loader2, School } from 'lucide-react';
import { PageLayout } from '@/components/ui/page-layout';
import 'animate.css';

export default function SimpleDashboard() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [showTestLogins, setShowTestLogins] = useState(false);

  const handleLoginClick = () => {
    // Use wouter's navigate for SPA navigation
    navigate('/auth');
  };

  const handleRegisterClick = () => {
    // Use wouter's navigate for SPA navigation
    navigate('/auth');
    // We can't pass state with direct location change, 
    // but we'll improve the login/register tab handling in auth-page.tsx
  };

  // If the user is logged in, navigate to the home dashboard
  // But don't redirect if they're intentionally going back to the landing page
  useEffect(() => {
    // Check if this is from a back button press using our session flag
    const isBackNavigation = sessionStorage.getItem('fromHomeBackButton') === 'true';

    // Only redirect if not a back navigation and user is properly logged in
    if (!isLoading && user && !user.verification_pending && !isBackNavigation) {
      console.log("User already logged in, redirecting to home dashboard");
      navigate('/home');
    }

    // We'll clear the flag in auth-page.tsx since that's where we check it next
  }, [isLoading, user, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageLayout
      title="Welcome to FLIP Patashala"
      description="Your gateway to interactive learning"
      titleIcon={<School className="h-6 w-6 text-blue-600" />}
      showBackButton={false}
      showHomeButton={false}
      backgroundColor="bg-blue-50/20"
    >
      <div className="space-y-8 animate__animated animate__fadeIn">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-purple-700 via-indigo-600 to-blue-600 text-white p-8 rounded-lg shadow-md animate__animated animate__fadeIn">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-4 animate__animated animate__fadeInDown">Transform Your Learning Experience</h1>
            <p className="text-lg mb-6 animate__animated animate__fadeInUp animate__delay-1s">
              Join <span className="font-bold text-amber-300">FLIP Patashala</span> to access a comprehensive platform for students, faculty, and administrators.
              Connect with your departments, access course materials, and manage your academic journey.
            </p>

            <div className="flex flex-wrap gap-4">
              <Button 
                size="lg" 
                onClick={handleLoginClick}
                className="bg-white text-blue-600 hover:bg-blue-50"
              >
                <LogIn className="mr-2 h-5 w-5" />
                Login to Your Account
              </Button>
              <Button 
                size="lg" 
                onClick={handleRegisterClick}
                className="bg-blue-800 text-white hover:bg-blue-700"
              >
                <UserPlus className="mr-2 h-5 w-5" />
                Register Now
              </Button>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-2 border-indigo-200 hover:border-indigo-300 transition-all duration-300 shadow-md">
            <CardHeader className="bg-indigo-50">
              <CardTitle className="flex items-center gap-2 text-indigo-700">
                <GraduationCap className="h-5 w-5 text-indigo-600" />
                For Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 font-bold">•</span> 
                  <span>Access learning materials</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 font-bold">•</span> 
                  <span>Track your academic progress</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 font-bold">•</span> 
                  <span>Interact with faculty</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 font-bold">•</span> 
                  <span>Manage your department resources</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 border-teal-200 hover:border-teal-300 transition-all duration-300 shadow-md">
            <CardHeader className="bg-teal-50">
              <CardTitle className="flex items-center gap-2 text-teal-700">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600">
                  <path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"></path>
                  <path d="M19 21V8a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v13"></path>
                  <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
                  <path d="M19 7V5a2 2 0 0 0-2-2h-2"></path>
                </svg>
                For Faculty
              </CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-teal-500 font-bold">•</span> 
                    <span>Manage course materials</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-teal-500 font-bold">•</span> 
                    <span>Track student performance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-teal-500 font-bold">•</span> 
                    <span>Research collaboration tools</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter className="pt-4">
                <Link to="/faculty/content">
                  <Button className="w-full bg-teal-600 hover:bg-teal-700">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                      <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4M17 8l-5-5-5 5M12 4.2v10.3"/>
                    </svg>
                    Manage Learning Resources
                  </Button>
                </Link>
              </CardFooter>
          </Card>

          <Card className="border-2 border-purple-200 hover:border-purple-300 transition-all duration-300 shadow-md">
            <CardHeader className="bg-purple-50">
              <CardTitle className="flex items-center gap-2 text-purple-700">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                For Administrators
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-bold">•</span> 
                  <span>Verify and manage users</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-bold">•</span> 
                  <span>Department administration</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-bold">•</span> 
                  <span>Bulk student synchronization</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-bold">•</span> 
                  <span>Comprehensive audit logging</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Development Tools Section - Hidden by Default */}
        <div className="pt-4 border-t border-gray-200">
          <Button 
            variant="link" 
            className="text-gray-500 text-sm"
            onClick={() => setShowTestLogins(!showTestLogins)}
          >
            {showTestLogins ? "Hide Development Tools" : "Show Development Tools"}
          </Button>

          {showTestLogins && (
            <Card className="mt-4 bg-gray-50">
              <CardHeader>
                <CardTitle>Development Test Logins</CardTitle>
                <CardDescription>Quick access accounts for development purposes only</CardDescription>
              </CardHeader>
              <CardContent>
                <TestLoginButtons onClick={() => navigate(user?.role === 'faculty' ? "/faculty/content" : "/student/content")}/>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageLayout>
  );
}