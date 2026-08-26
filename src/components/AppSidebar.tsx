import { useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { BookOpen, Plus, Sparkles, LogOut, Layers } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNovelProject } from "@/hooks/useNovelProject";

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { projects } = useNovelProject();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <Sidebar className="border-r border-border bg-sidebar-background">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div
          onClick={() => navigate("/")}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-sidebar-foreground group-hover:text-purple-300 transition-colors">
              NovelAI Studio
            </h2>
            <p className="text-[10px] text-muted-foreground">AI 소설 집필 도구</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* 메인 메뉴 */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground px-3">
            메인 메뉴
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate("/")}
                  isActive={location.pathname === "/"}
                  className="gap-3 hover:bg-sidebar-accent"
                >
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span>프로젝트 목록</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate("/project/new")}
                  isActive={location.pathname === "/project/new"}
                  className="gap-3 hover:bg-sidebar-accent text-purple-300 font-semibold"
                >
                  <Plus className="w-4 h-4 text-purple-400" />
                  <span>새 프로젝트 생성</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 소설 프로젝트 목록 */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground px-3">
            나의 소설 목록 ({projects.length})
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {projects.map((proj) => {
                const isActive = location.pathname.startsWith(`/project/${proj.id}`);
                return (
                  <SidebarMenuItem key={proj.id}>
                    <SidebarMenuButton
                      onClick={() => navigate(`/project/${proj.id}`)}
                      isActive={isActive}
                      className="gap-3 hover:bg-sidebar-accent text-xs"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">{proj.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenuButton
          onClick={handleLogout}
          className="gap-3 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300"
        >
          <LogOut className="w-4 h-4" />
          <span>로그아웃</span>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
