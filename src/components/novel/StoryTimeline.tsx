import { type StorySummary } from "@/hooks/useStoryContext";
import { GitCommit, Sparkles, MapPin, AlertCircle, MessageSquare } from "lucide-react";

interface StoryTimelineProps {
  summaries: StorySummary[];
  isLoading?: boolean;
}

export function StoryTimeline({ summaries, isLoading }: StoryTimelineProps) {
  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        스토리 타임라인 로딩 중...
      </div>
    );
  }

  if (!summaries || summaries.length === 0) {
    return (
      <div className="text-center py-12 glass-card rounded-xl">
        <GitCommit className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground">타임라인 데이터가 없습니다.</p>
        <p className="text-xs text-muted-foreground mt-1">
          에피소드를 저장할 때마다 작가1 AI가 스토리 요약과 타임라인을 자동 생성합니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative pl-6">
      {/* 타임라인 수직선 */}
      <div className="timeline-line" />

      {summaries.map((s) => (
        <div key={s.id || s.episode_number} className="relative group">
          {/* 노드 점 */}
          <div className="timeline-dot absolute -left-6 top-1.5" />

          {/* 에피소드 요약 카드 */}
          <div className="glass-card rounded-xl p-4 space-y-3 border-l-2 border-l-purple-500">
            {/* 회차 제목 */}
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-xs font-bold text-purple-400">
                Ep.{s.episode_number} 스토리 요약
              </span>
              {s.world_state && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-blue-400" />
                  {s.world_state}
                </span>
              )}
            </div>

            {/* 주요 사건 */}
            {s.events && s.events.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-foreground mb-1">주요 사건</h5>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {s.events.map((e, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-purple-400 font-bold">·</span>
                      <span className="text-foreground/90">{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 인물 변화 */}
            {s.character_changes && Object.keys(s.character_changes).length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-emerald-400 mb-1">인물 상태 변화</h5>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(s.character_changes).map(([name, change]) => (
                    <span
                      key={name}
                      className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                    >
                      <strong>{name}</strong>: {change}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 복선 / 떡밥 */}
            {s.foreshadowing && s.foreshadowing.length > 0 && (
              <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/15">
                <h5 className="text-[11px] font-semibold text-amber-400 flex items-center gap-1 mb-1">
                  <Sparkles className="w-3 h-3" />
                  새로운 복선 및 떡밥
                </h5>
                <ul className="text-[11px] text-amber-300/80 space-y-0.5">
                  {s.foreshadowing.map((f, idx) => (
                    <li key={idx}>- {f}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 미해결 과제 */}
            {s.unresolved && s.unresolved.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-rose-300">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>미해결 갈등: {s.unresolved.join(", ")}</span>
              </div>
            )}

            {/* 명대사 */}
            {s.key_dialogue && s.key_dialogue.length > 0 && (
              <div className="flex items-start gap-1.5 text-xs italic text-purple-300/90 font-serif-kr bg-purple-500/5 p-2 rounded">
                <MessageSquare className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  {s.key_dialogue.map((d, idx) => (
                    <p key={idx}>{d}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
