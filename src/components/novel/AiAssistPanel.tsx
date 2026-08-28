import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  MessageSquare,
  Film,
  Pencil,
  Send,
  Loader2,
  BookOpen,
  UserCheck,
  Zap,
} from "lucide-react";

interface AiControlPanelProps {
  onContinueWrite: (direction?: string) => void;
  onGenerateDialogue: (direction?: string) => void;
  onSuggestScenes: () => void;
  onRewriteSelection: (instruction: string) => void;
  isGenerating: boolean;
  selectedText?: string;
}

export function AiControlPanel({
  onContinueWrite,
  onGenerateDialogue,
  onSuggestScenes,
  onRewriteSelection,
  isGenerating,
  selectedText,
}: AiControlPanelProps) {
  const [direction, setDirection] = useState("");

  const handleContinue = () => onContinueWrite(direction);
  const handleDialogue = () => onGenerateDialogue(direction);
  const handleRewrite = () => {
    if (!direction) return;
    onRewriteSelection(direction);
  };

  return (
    <div className="flex flex-col h-full shrink-0 relative z-30 transition-all bg-card/90">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-black/20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">AI 어시스턴트 팀</h2>
            <p className="text-[11px] text-muted-foreground">메인작가 · 작가1 · 작가2</p>
          </div>
        </div>
      </div>

      {/* AI 역할 카드 */}
      <div className="grid grid-cols-3 gap-1.5 p-3 bg-white/5 border-b border-border text-[11px] shrink-0">
        <div className="p-2 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 flex flex-col items-center text-center">
          <BookOpen className="w-3.5 h-3.5 mb-1 text-purple-400" />
          <span className="font-bold">메인작가</span>
          <span className="text-[9px] text-purple-300/70">집필 / 이어쓰기</span>
        </div>
        <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 flex flex-col items-center text-center">
          <Zap className="w-3.5 h-3.5 mb-1 text-blue-400" />
          <span className="font-bold">작가1</span>
          <span className="text-[9px] text-blue-300/70">개연성 / 아이디어</span>
        </div>
        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex flex-col items-center text-center">
          <UserCheck className="w-3.5 h-3.5 mb-1 text-emerald-400" />
          <span className="font-bold">작가2</span>
          <span className="text-[9px] text-emerald-300/70">인물별 아크</span>
        </div>
      </div>

      {/* 컨트롤 영역 */}
      <div className="p-4 space-y-3 flex-1 overflow-y-auto novel-scrollbar">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            {selectedText ? "선택 구간 재작성 지시" : "집필 방향 / 지시사항 (선택)"}
          </label>
          <Textarea
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            placeholder={
              selectedText
                ? "예: 더 긴박하고 감정선을 생생하게 서술해줘"
                : "예: 영희가 편지를 열고 충격을 받는 연출을 넣어줘"
            }
            className="text-xs h-24 sm:h-32 bg-background/50 resize-none border-border focus:border-purple-500"
          />
        </div>

        {selectedText ? (
          <Button
            onClick={handleRewrite}
            disabled={isGenerating || !direction}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5"
          >
            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pencil className="w-3.5 h-3.5" />}
            선택 구간 재작성하기
          </Button>
        ) : (
          <div className="grid grid-cols-1 gap-2 mt-4">
            <Button
              onClick={handleContinue}
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs gap-1.5 py-5 shadow-lg shadow-purple-900/30"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
              <span className="font-bold">AI 이어쓰기 (~3000자)</span>
            </Button>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <Button
                variant="outline"
                onClick={handleDialogue}
                disabled={isGenerating}
                className="text-xs gap-1.5 border-purple-500/30 hover:bg-purple-500/10 text-purple-200"
              >
                <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                대화 생성
              </Button>

              <Button
                variant="outline"
                onClick={onSuggestScenes}
                disabled={isGenerating}
                className="text-xs gap-1.5 border-blue-500/30 hover:bg-blue-500/10 text-blue-200"
              >
                <Film className="w-3.5 h-3.5 text-blue-400" />
                장면 제안 (작가1)
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface AiOutputPanelProps {
  generatedText: string;
  isGenerating: boolean;
  onInsertText: (text: string) => void;
  onDirectMerge?: (text: string) => void;
}

export function AiOutputPanel({
  generatedText,
  isGenerating,
  onInsertText,
  onDirectMerge,
}: AiOutputPanelProps) {
  return (
    <div className="flex-1 p-4 flex flex-col h-full overflow-hidden bg-black/10 shrink-0">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          {isGenerating && <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />}
          AI 생성 출력결과
        </span>
        {generatedText && (
          <span className="text-[11px] text-muted-foreground">{generatedText.length}자</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 rounded-lg bg-background/40 border border-border novel-scrollbar text-sm leading-relaxed space-y-2 select-text font-serif-kr">
        {generatedText ? (
          <div className="whitespace-pre-wrap text-foreground/90">
            {generatedText}
            {isGenerating && <span className="inline-block w-2 h-4 ml-1 bg-purple-500 animate-pulse" />}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground/50 py-8">
            <Sparkles className="w-8 h-8 mb-2 opacity-30 text-purple-400" />
            <p>버튼을 눌러 소설 내용을 생성하세요.</p>
            <p className="text-[11px] mt-2 opacity-70">메인작가가 이전 요약 및 인물 상태를 반영하여 작성합니다.</p>
          </div>
        )}
      </div>

      {/* 본문 삽입 및 바로 병합 버튼 */}
      {generatedText && !isGenerating && (
        <div className="shrink-0 mt-3 space-y-1.5">
          {onDirectMerge && (
            <Button
              onClick={() => onDirectMerge(generatedText)}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs gap-1.5 shadow-md py-3 font-bold"
            >
              <Send className="w-4 h-4" />
              ✨ 본문 끝에 바로 합치기 (추천)
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => onInsertText(generatedText)}
            className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-500/10 text-xs gap-1.5 py-2.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            📦 임시 검토 블록으로 넣기
          </Button>
        </div>
      )}
    </div>
  );
}
