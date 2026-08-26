import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen, Clock, FileText, ChevronRight } from "lucide-react";

interface Episode {
  id: string;
  episode_number: number;
  title: string;
  char_count: number;
  status: "draft" | "corrected" | "finalized";
  updated_at: string;
}

interface EpisodeListProps {
  episodes: Episode[];
  projectId: string;
  onCreateNew: () => void;
}

export function EpisodeList({ episodes, projectId, onCreateNew }: EpisodeListProps) {
  const navigate = useNavigate();

  const getStatusBadge = (status: Episode["status"]) => {
    switch (status) {
      case "finalized":
        return <span className="text-xs px-2.5 py-0.5 rounded-full badge-finalized">완성</span>;
      case "corrected":
        return <span className="text-xs px-2.5 py-0.5 rounded-full badge-corrected">교정완료</span>;
      default:
        return <span className="text-xs px-2.5 py-0.5 rounded-full badge-draft">초안</span>;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      {/* 헤더 & 새 에피소드 버튼 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-400" />
            에피소드 목록 ({episodes.length}회차)
          </h3>
          <p className="text-xs text-muted-foreground">목표: 1편당 약 A4 20장 (10,000자 이상)</p>
        </div>
        <Button
          onClick={onCreateNew}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs gap-1.5 shadow-md"
        >
          <Plus className="w-4 h-4" />
          새 회차 작성
        </Button>
      </div>

      {/* 에피소드 카드리스트 */}
      {episodes.length === 0 ? (
        <div className="text-center py-12 glass-card rounded-xl">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">작성된 회차가 없습니다.</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">첫 번째 에피소드를 작성하고 AI 메인작가와 협업하세요.</p>
          <Button onClick={onCreateNew} size="sm" className="bg-purple-600 text-white text-xs">
            첫 회차 시작하기
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {episodes.map((ep) => (
            <div
              key={ep.id}
              onClick={() => navigate(`/project/${projectId}/episode/${ep.id}`)}
              className="glass-card rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-purple-500/40 transition-all group"
            >
              <div className="flex items-center gap-4">
                {/* 회차 뱃지 */}
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] text-purple-400 font-bold">Ep</span>
                  <span className="text-sm font-bold text-purple-300 leading-none">{ep.episode_number}</span>
                </div>

                {/* 제목 및 세부정보 */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground group-hover:text-purple-300 transition-colors">
                    {ep.title || `에피소드 ${ep.episode_number}`}
                  </h4>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {ep.char_count.toLocaleString()}자 (약 {(ep.char_count / 500).toFixed(1)}장)
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(ep.updated_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 우측 상태 및 화살표 */}
              <div className="flex items-center gap-3">
                {getStatusBadge(ep.status)}
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
