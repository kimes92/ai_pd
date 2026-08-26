import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import Auth from "./pages/Auth";
import ProjectList from "./pages/ProjectList";
import ProjectDashboard from "./pages/ProjectDashboard";
import ProjectSettings from "./pages/ProjectSettings";
import NovelEditor from "./pages/NovelEditor";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />

      {/* 메인 대시보드 — 프로젝트 목록 */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ProjectList />
          </ProtectedRoute>
        }
      />

      {/* 새 프로젝트 생성 */}
      <Route
        path="/project/new"
        element={
          <ProtectedRoute>
            <ProjectSettings />
          </ProtectedRoute>
        }
      />

      {/* 프로젝트 대시보드 */}
      <Route
        path="/project/:id"
        element={
          <ProtectedRoute>
            <ProjectDashboard />
          </ProtectedRoute>
        }
      />

      {/* 프로젝트 설정 편집 */}
      <Route
        path="/project/:id/settings"
        element={
          <ProtectedRoute>
            <ProjectSettings />
          </ProtectedRoute>
        }
      />

      {/* 새 에피소드 작성 */}
      <Route
        path="/project/:id/episode/new"
        element={
          <ProtectedRoute>
            <NovelEditor />
          </ProtectedRoute>
        }
      />

      {/* 에피소드 편집 */}
      <Route
        path="/project/:id/episode/:epId"
        element={
          <ProtectedRoute>
            <NovelEditor />
          </ProtectedRoute>
        }
      />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename="/ai_pd/">
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
