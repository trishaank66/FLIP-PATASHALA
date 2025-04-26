import { ReactNode } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, ShieldCheck, LogOut } from "lucide-react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faHome, faShieldAlt, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from "@/hooks/use-auth";

interface PageLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  showAdminButton?: boolean;
  backTo?: string;
  backgroundColor?: string;
  titleIcon?: ReactNode;
}

export function PageLayout({
  children,
  title,
  description,
  showBackButton = true,
  showHomeButton = true,
  showAdminButton = false,
  backTo = "/",
  backgroundColor,
  titleIcon
}: PageLayoutProps) {
  const { logoutMutation, user } = useAuth();
  const [, navigate] = useLocation();
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  const handleBack = () => {
    // If backTo prop is provided, use it (this helps with explicit navigation)
    if (backTo && backTo !== '/') {
      // Set a session flag to indicate we're using back navigation
      // This will prevent redirect loops in auth-page and SimpleDashboard
      if (backTo === '/auth') {
        sessionStorage.setItem('fromHomeBackButton', 'true');
      }
      navigate(backTo);
      return;
    }

    const currentPath = window.location.pathname;

    // Enhanced logical navigation based on current path
    // First, handle the most specific admin paths that need context-specific navigation
    if (currentPath.includes('/admin/student-approval')) {
      // From student approval back to verification tab in admin dashboard
      // We'll store this information in sessionStorage to help the admin dashboard show the correct tab
      sessionStorage.setItem('adminLastSection', 'verification');
      navigate('/admin');
      return;
    } else if (currentPath.includes('/admin/faculty-approval')) {
      // From faculty approval back to verification tab in admin dashboard
      sessionStorage.setItem('adminLastSection', 'verification');
      navigate('/admin');
      return;
    } else if (currentPath.includes('/admin/admin-approval')) {
      // From admin approval back to verification tab in admin dashboard
      sessionStorage.setItem('adminLastSection', 'verification');
      navigate('/admin');
      return;
    } else if (currentPath.includes('/admin/bulk-sync')) {
      // From bulk sync back to bulk operations tab in admin dashboard
      sessionStorage.setItem('adminLastSection', 'bulk-operations');
      navigate('/admin');
      return;
    } else if (currentPath.includes('/admin/departments')) {
      // From department management to admin dashboard with department tab active
      sessionStorage.setItem('adminLastSection', 'department-management');
      navigate('/admin');
      return;
    } else if (currentPath.includes('/admin/add-department')) {
      // From add department back to departments list
      navigate('/admin/departments');
      return;
    } else if (currentPath.includes('/admin/delete-department')) {
      // From delete department back to department management
      sessionStorage.setItem('adminLastSection', 'department-management');
      navigate('/admin');
      return;
    } else if (currentPath.includes('/admin/manage-students') || 
               currentPath.includes('/admin/add-student')) {
      // From student management back to user management tab
      sessionStorage.setItem('adminLastSection', 'user-management');
      navigate('/admin');
      return;
    } else if (currentPath.includes('/admin/manage-faculty') || 
               currentPath.includes('/admin/add-faculty')) {
      // From faculty management back to user management tab
      sessionStorage.setItem('adminLastSection', 'user-management');
      navigate('/admin');
      return;
    } else if (currentPath.includes('/admin/manage-admins') || 
               currentPath.includes('/admin/add-admin')) {
      // From admin management back to user management tab
      sessionStorage.setItem('adminLastSection', 'user-management');
      navigate('/admin');
      return;
    } else if (currentPath.includes('/admin/')) {
      // From any other admin subpage to admin dashboard
      navigate('/admin');
      return;
    } else if (currentPath === '/home') {
      // From home dashboard to auth page
      sessionStorage.setItem('fromHomeBackButton', 'true');
      navigate('/auth');
    } else if (currentPath.includes('/student/content')) {
      // From student content to home dashboard
      navigate('/home');
    } else if (currentPath === '/home' || currentPath === '/faculty' || currentPath === '/student') {
      // From role-specific pages to auth page
      sessionStorage.setItem('fromHomeBackButton', 'true');
      navigate('/auth');
    } else if (currentPath === '/') {
      // From home page to auth page (landing)
      sessionStorage.setItem('fromHomeBackButton', 'true');
      navigate('/auth');
    } else {
      // For any other page, use a smart fallback - try to go up one level
      // Splitting the path and removing the last segment
      const pathParts = currentPath.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        // Go up one level
        pathParts.pop();
        const newPath = pathParts.length > 0 ? `/${pathParts.join('/')}` : '/';
        navigate(newPath);
      } else {
        // Default to home if we can't determine parent path
        navigate('/');
      }
    }
  };

  return (
    <div className="container max-w-6xl mx-auto py-6 px-4 md:px-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          {showBackButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              className="flex items-center gap-1"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="mr-1" />
              <span>Back</span>
            </Button>
          )}
          
          {showHomeButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/")}
              className="flex items-center gap-1"
            >
              <FontAwesomeIcon icon={faHome} className="mr-1" />
              <span>Home</span>
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {user && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              className="flex items-center gap-1 border-red-200 text-red-600 hover:bg-red-50"
            >
              <FontAwesomeIcon icon={faSignOutAlt} className="mr-1" />
              <span>{logoutMutation.isPending ? "Logging out..." : "Logout"}</span>
            </Button>
          )}
          
          {showAdminButton && user?.role === 'admin' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin/departments")}
              className="flex items-center gap-1 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400"
            >
              <FontAwesomeIcon icon={faShieldAlt} className="mr-1" />
              <span>Admin Dashboard</span>
            </Button>
          )}
        </div>
      </div>

      <Card className={`w-full border mb-8 ${backgroundColor ? backgroundColor : ""}`}>
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            {titleIcon && titleIcon}
            <span className="bg-gradient-to-r from-purple-700 via-indigo-500 to-blue-600 bg-clip-text text-transparent animate__animated animate__fadeIn">{title}</span>
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}