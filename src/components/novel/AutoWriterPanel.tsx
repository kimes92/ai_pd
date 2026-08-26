import { useState } from "react";
import { AutoWriterState } from "@/hooks/useAutoWriterEngine";
import { NovelSettings } from "@/hooks/useStoryContext";
import { NovelEpisode } from "@/hooks/useNovelEpisode";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Power,
  Zap,
  BookOpen,
  UserCheck,
  Loader2,
  Send,
  Play,
  MessageSquarePlus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Bot,
  Settings,
  Key,
} from "lucide-react";
import { toast } from "sonner";

interface AutoWriterPanelProps {
  autoState: AutoWriterState;
  settings: NovelSettings | null;
  episodes: NovelEpisode[];
  onToggleAutoMode: () => void;
  onRunOneCycle: () => void;
  onAddFeedback: (episodeId: string, instruction: string, episodeTitle?: string) => void;
  onApplyFeedbackNow: (feedbackId: string) => void;
}

const STEP_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  idle: { label: "대기 중", color: "text-muted-foreground", icon: Clock },
  writing: { label: "메인작가 초안 집필 중...", color: "text-purple-400", icon: BookOpen },
  reviewing: { label: "검수작가 개연성/OOC 검토 중...", color: "text-blue-400", icon: Zap },
  revising: { label: "메인작가 피드백 반영 및 교정 중...", color: "text-pink-400", icon: BookOpen },
  "updating-arcs": { label: "설정관리 인물 아크 갱신 중...", color: "text-emerald-400", icon: UserCheck },
  "applying-feedback": { label: "피드백 즉시 반영 중...", color: "text-amber-400", icon: MessageSquarePlus },
};

export function AutoWriterPanel({
  autoState,
  settings,
  episodes,
  onToggleAutoMode,
  onRunOneCycle,
  onAddFeedback,
  onApplyFeedbackNow,
}: AutoWriterPanelProps) {
  const [feedbackEpId, setFeedbackEpId] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  
  // API 설정 상태
  const [apiProvider, setApiProvider] = useState(localStorage.getItem("ai_provider") || "gemini");
  const [apiKey, setApiKey] = useState(localStorage.getItem("ai_api_key") || "");
  const [showApiSettings, setShowApiSettings] = useState(!localStorage.getItem("ai_api_key"));

  const handleSaveApiSettings = () => {
    localStorage.setItem("ai_provider", apiProvider);
    localStorage.setItem("ai_api_key", apiKey);
    toast.success("API 설정이 저장되었습니다.");
    setShowApiSettings(false);
  };

  const stepInfo = STEP_LABELS[autoState.currentStep] || STEP_LABELS.idle;
  const StepIcon = stepInfo.icon;
  const feedbacks = settings?.user_feedbacks || [];
  const pendingFeedbacks = feedbacks.filter((f) => f.status === "pending");
  const appliedFeedbacks = feedbacks.filter((f) => f.status === "applied");

  const handleSubmitFeedback = () => {
    if (!feedbackEpId || !feedbackText.trim()) return;
    const ep = episodes.find((e) => e.id === feedbackEpId);
    onAddFeedback(feedbackEpId, feedbackText.trim(), ep?.title);
    setFeedbackText("");
  };

  return (
    <div className="space-y-6">
      {/* ===== 자동화 ON/OFF 토글 ===== */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
              autoState.isAutoMode
                ? "bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/30"
                : "bg-secondary/60"
            }`}>
              <Bot className={`w-5 h-5 ${autoState.isAutoMode ? "text-white" : "text-muted-foreground"}`} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">AI 작가팀 자동화</h3>
              <p className="text-[11px] text-muted-foreground">
                {autoState.isAutoMode ? "파이프라인 활성화됨" : "비활성 상태"}
              </p>
            </div>
          </div>

          <button
            onClick={onToggleAutoMode}
            className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
              autoState.isAutoMode
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30"
                : "bg-secondary/60 border border-border"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${
                autoState.isAutoMode ? "translate-x-7" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* 수동 1사이클 버튼 */}
        {!autoState.isAutoMode && (
          <Button
            onClick={onRunOneCycle}
            disabled={autoState.isProcessing}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5 py-4"
          >
            {autoState.isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            수동으로 1사이클 실행
          </Button>
        )}

        {/* API 설정 토글 버튼 */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowApiSettings(!showApiSettings)}
          className="w-full text-xs h-8 text-muted-foreground border-border bg-background/50"
        >
          <Settings className="w-3.5 h-3.5 mr-1.5" />
          AI 모델 및 API 키 설정
        </Button>

        {/* API 설정 패널 */}
        {showApiSettings && (
          <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-3 mt-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">AI 제공자</label>
              <select
                value={apiProvider}
                onChange={(e) => setApiProvider(e.target.value)}
                className="w-full bg-background/50 border border-border rounded-md text-xs p-2 text-foreground"
              >
                <option value="gemini">Google Gemini (추천)</option>
                <option value="openai">OpenAI (ChatGPT)</option>
                <option value="local">Local AI (Ollama - 로컬 전용)</option>
              </select>
            </div>
            
            {apiProvider !== "local" && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">API 키</label>
                <div className="relative">
                  <Key className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="API 키를 입력하세요"
                    className="w-full bg-background/50 border border-border rounded-md text-xs p-2 pl-8 text-foreground"
                  />
                </div>
              </div>
            )}
            
            <Button
              onClick={handleSaveApiSettings}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
            >
              저장하기
            </Button>
          </div>
        )}

        {/* 현재 진행 상태 표시 */}
        <div className="p-3 rounded-xl bg-background/40 border border-border">
          <div className="flex items-center gap-2">
            {autoState.isProcessing ? (
              <Loader2 className={`w-4 h-4 animate-spin ${stepInfo.color}`} />
            ) : (
              <StepIcon className={`w-4 h-4 ${stepInfo.color}`} />
            )}
            <span className={`text-xs font-semibold ${stepInfo.color}`}>{stepInfo.label}</span>
          </div>

          {/* 파이프라인 시각 표시 */}
          <div className="flex items-center gap-1 mt-3">
            {["writing", "reviewing", "revising", "updating-arcs"].map((step, idx) => {
              const isActive = autoState.currentStep === step;
              const isDone =
                ["writing", "reviewing", "revising", "updating-arcs"].indexOf(autoState.currentStep) > idx ||
                autoState.currentStep === "idle";
              return (
                <div key={step} className="flex items-center gap-1 flex-1">
                  <div
                    className={`h-1.5 rounded-full flex-1 transition-all duration-500 ${
                      isActive
                        ? "bg-gradient-to-r from-purple-500 to-indigo-500 animate-pulse"
                        : isDone && autoState.pipelineLog.length > 0
                        ? "bg-emerald-500/60"
                        : "bg-border"
                    }`}
                  />
                  {idx < 3 && <span className="text-[8px] text-muted-foreground">→</span>}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
            <span>초안</span>
            <span>검수</span>
            <span>교정</span>
            <span>설정</span>
          </div>
        </div>
      </div>

      {/* ===== 피드백 입력 폼 ===== */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
          <MessageSquarePlus className="w-4 h-4 text-amber-400" />
          에피소드 피드백 입력
        </h4>
        <p className="text-[11px] text-muted-foreground">
          특정 에피소드에 "주인공 공격 이펙트를 더 강화해줘" 같은 피드백을 남기면 AI가 반영합니다.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">에피소드 선택</label>
            <select
              value={feedbackEpId}
              onChange={(e) => setFeedbackEpId(e.target.value)}
              className="w-full bg-background/50 border border-border rounded-md text-xs p-2 text-foreground"
            >
              <option value="">에피소드를 선택하세요</option>
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  Ep.{ep.episode_number} - {ep.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">피드백 지시사항</label>
            <Textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder='예: "주인공이 좀더 강한 이펙트의 공격을 하게 해줘"'
              className="bg-background/50 h-20 text-xs resize-none"
            />
          </div>

          <Button
            onClick={handleSubmitFeedback}
            disabled={!feedbackEpId || !feedbackText.trim()}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            피드백 전달하기
          </Button>
        </div>

        {/* 대기 중인 피드백 목록 */}
        {pendingFeedbacks.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-border">
            <h5 className="text-xs font-semibold text-amber-300 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              대기 중인 피드백 ({pendingFeedbacks.length})
            </h5>
            {pendingFeedbacks.map((fb) => (
              <div
                key={fb.id}
                className="flex items-start justify-between bg-amber-900/10 border border-amber-500/20 p-2 rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-[10px] text-amber-300 font-semibold">{fb.episodeTitle || fb.episodeId}</p>
                  <p className="text-xs text-foreground/80 mt-0.5">{fb.instruction}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onApplyFeedbackNow(fb.id)}
                  disabled={autoState.isProcessing}
                  className="text-[10px] text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 shrink-0"
                >
                  즉시 반영
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* 반영 완료된 피드백 */}
        {appliedFeedbacks.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-border">
            <h5 className="text-xs font-semibold text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              반영 완료 ({appliedFeedbacks.length})
            </h5>
            {appliedFeedbacks.slice(-5).reverse().map((fb) => (
              <div key={fb.id} className="text-[11px] text-muted-foreground bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10">
                <span className="text-emerald-300">{fb.episodeTitle || fb.episodeId}</span>: {fb.instruction.substring(0, 60)}...
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== 실행 로그 타임라인 ===== */}
      <div className="glass-card rounded-2xl p-6 space-y-3">
        <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
          <Power className="w-4 h-4 text-purple-400" />
          파이프라인 실행 로그
        </h4>

        <div className="max-h-64 overflow-y-auto novel-scrollbar space-y-1.5 pr-2">
          {autoState.pipelineLog.length === 0 && (settings?.auto_writer_log || []).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">아직 실행 기록이 없습니다.</p>
          ) : (
            [...(autoState.pipelineLog.length > 0 ? autoState.pipelineLog : settings?.auto_writer_log || [])]
              .reverse()
              .slice(0, 30)
              .map((log) => {
                const agentColors: Record<string, string> = {
                  "메인작가 AI": "text-purple-300 bg-purple-500/10 border-purple-500/20",
                  "검수작가 AI": "text-blue-300 bg-blue-500/10 border-blue-500/20",
                  "설정관리 AI": "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
                  "편집 작가 AI": "text-amber-300 bg-amber-500/10 border-amber-500/20",
                  시스템: "text-gray-300 bg-gray-500/10 border-gray-500/20",
                  사용자: "text-rose-300 bg-rose-500/10 border-rose-500/20",
                };
                const colorClass = agentColors[log.agentName] || agentColors["시스템"];
                return (
                  <div key={log.id} className={`p-2 rounded-lg border ${colorClass} text-[11px]`}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="font-bold">{log.agentName}</span>
                      <span className="text-[9px] opacity-60">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="opacity-80">{log.summary}</p>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}
