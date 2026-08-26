import { useNavigate } from "react-router-dom";
import { useNovelProject } from "@/hooks/useNovelProject";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen, LogOut, Sparkles, Layers, Clock, ArrowRight } from "lucide-react";

export default function ProjectList() {
  const navigate = useNavigate();
  const { projects, isLoading } = useNovelProject();
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const getGenreColor = (genre: string) => {
    switch (genre) {
      case "판타지":
        return "genre-fantasy";
      case "로맨스":
        return "genre-romance";
      case "미스터리":
        return "genre-mystery";
      case "SF":
        return "genre-sf";
      case "액션":
        return "genre-action";
      case "공포":
        return "genre-horror";
      case "일상":
        return "genre-daily";
      case "역사":
        return "genre-history";
      default:
        return "genre-default";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <span className="text-xs px-2.5 py-0.5 rounded-full badge-completed">완결</span>;
      case "paused":
        return <span className="text-xs px-2.5 py-0.5 rounded-full badge-paused">휴재중</span>;
      default:
        return <span className="text-xs px-2.5 py-0.5 rounded-full badge-in-progress">연재중</span>;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold gradient-text">NovelAI Studio</h1>
              <p className="text-[11px] text-muted-foreground">AI 소설 집필 어시스턴트</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {user?.email}님, 환영합니다
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-xs gap-1.5 border-border hover:bg-white/5"
            >
              <LogOut className="w-3.5 h-3.5" />
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8">
        {/* Banner Section */}
        <div className="relative rounded-2xl p-6 sm:p-8 overflow-hidden bg-gradient-to-r from-purple-950/80 via-indigo-950/60 to-background border border-purple-500/20 shadow-2xl">
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              메인작가 + 작가1 + 작가2 AI 협업 시스템
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              나만의 소설 세계관을 <br className="hidden sm:inline" />
              AI 어시스턴트 팀과 함께 완성하세요
            </h2>
            <p className="text-sm text-purple-200/70 leading-relaxed">
              1편당 10,000자 이상, 3000자 청크 생성, 개연성 자동 검토, 인물별 입체적 아크 추적까지.
              스토리 파괴 없는 소설 집필을 경험해보세요.
            </p>

            <div className="pt-2">
              <Button
                onClick={() => navigate("/project/new")}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white gap-2 py-5 px-6 rounded-xl font-bold shadow-lg shadow-purple-900/40"
              >
                <Plus className="w-5 h-5" />
                새 소설 프로젝트 생성
              </Button>
            </div>
          </div>

          <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-gradient-to-l from-purple-600/10 to-transparent pointer-events-none hidden md:block" />
        </div>

        {/* Project Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-400" />
              소설 프로젝트 목록 ({projects.length})
            </h3>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 glass-card animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-16 glass-card rounded-2xl p-8 border border-dashed border-border">
              <Layers className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <h4 className="text-base font-bold text-foreground">아직 프로젝트가 없습니다</h4>
              <p className="text-xs text-muted-foreground mt-1 mb-6">
                새 프로젝트를 생성하여 인칭, 시놉시스, 인물 구도를 설정하고 첫 회차 작성을 시작하세요.
              </p>
              <Button
                onClick={() => navigate("/project/new")}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5"
              >
                <Plus className="w-4 h-4" />첫 프로젝트 만들기
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => navigate(`/project/${proj.id}`)}
                  className="glass-card rounded-2xl overflow-hidden flex flex-col cursor-pointer group hover:border-purple-500/40 transition-all duration-300 shadow-lg"
                >
                  {/* 상단 장르 색상 띠 */}
                  <div className={`h-2.5 w-full ${getGenreColor(proj.genre)}`} />

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-semibold text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-md border border-purple-500/20">
                          {proj.genre || "장르 미지정"}
                        </span>
                        {getStatusBadge(proj.status)}
                      </div>

                      <h4 className="text-lg font-bold text-foreground group-hover:text-purple-300 transition-colors line-clamp-1">
                        {proj.title}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5 font-medium text-foreground/80">
                        <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                        총 {proj.episode_count || 0}화
                      </span>

                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(proj.updated_at).toLocaleDateString("ko-KR")}
                      </span>

                      <span className="text-purple-400 font-medium group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                        입장 <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
