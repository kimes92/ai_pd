import { Button } from "@/components/ui/button";
import { Sparkles, ShieldCheck, Volume2, Loader2, Quote, MessageSquare, Code } from "lucide-react";

interface FormatToolbarProps {
  onInsertDialogue?: () => void;
  onInsertThought?: () => void;
  onInsertSpecial?: () => void;
  onInsertParen?: () => void;
  onCorrectText?: () => void;
  onCheckConsistency?: () => void;
  onToggleTTS?: () => void;
  isLoading?: boolean;
}

export function FormatToolbar({
  onInsertDialogue,
  onInsertThought,
  onInsertSpecial,
  onInsertParen,
  onCorrectText,
  onCheckConsistency,
  onToggleTTS,
  isLoading = false,
}: FormatToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-card/60 border border-border/80 backdrop-blur-md shadow-sm">
      {/* 빠른 따옴표/괄호 입력 버튼 모음 */}
      <div className="flex items-center gap-1 bg-secondary/40 p-1 rounded-lg border border-border/50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onInsertDialogue}
          className="h-7 px-2.5 text-xs font-bold text-purple-300 hover:text-purple-200 hover:bg-purple-500/20 gap-1 rounded-md"
          title="대화체 큰따옴표 입력 (&quot;&quot;)"
        >
          <Quote className="w-3 h-3 text-purple-400" />
          &quot;&quot; 대화
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onInsertThought}
          className="h-7 px-2.5 text-xs font-bold text-blue-300 hover:text-blue-200 hover:bg-blue-500/20 gap-1 rounded-md"
          title="속마음 작은따옴표 입력 ('')"
        >
          <MessageSquare className="w-3 h-3 text-blue-400" />
          &apos;&apos; 생각
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onInsertSpecial}
          className="h-7 px-2.5 text-xs font-bold text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/20 gap-1 rounded-md"
          title="시스템 대괄호 입력 ([])"
        >
          <Code className="w-3 h-3 text-emerald-400" />
          [] 시스템
        </Button>

        {onInsertParen && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onInsertParen}
            className="h-7 px-2 text-xs font-bold text-amber-300 hover:text-amber-200 hover:bg-amber-500/20 gap-1 rounded-md"
            title="설명 소괄호 입력 (())"
          >
            () 괄호
          </Button>
        )}
      </div>

      <div className="h-4 w-[1px] bg-border/60 mx-1" />

      {/* 맞춤법 교정 & AI 검토 기능 버튼 모음 */}
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCorrectText}
          disabled={isLoading}
          className="h-7 text-xs bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20 hover:text-purple-200 gap-1.5 shadow-sm"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          )}
          맞춤법 &amp; 서식 교정
        </Button>

        {onCheckConsistency && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCheckConsistency}
            disabled={isLoading}
            className="h-7 text-xs bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200 gap-1.5 shadow-sm"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            개연성 검토
          </Button>
        )}

        {onToggleTTS && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleTTS}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 gap-1"
            title="TTS 낭독"
          >
            <Volume2 className="w-3.5 h-3.5" />
            TTS
          </Button>
        )}
      </div>
    </div>
  );
}
