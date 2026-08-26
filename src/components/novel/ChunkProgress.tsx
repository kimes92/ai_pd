import { FileText, Sparkles } from "lucide-react";

interface ChunkProgressProps {
  currentChunk: number;
  isGenerating: boolean;
  charCount: number;
  targetCount?: number; // 기본 10000자
}

export function ChunkProgress({
  currentChunk,
  isGenerating,
  charCount,
  targetCount = 10000,
}: ChunkProgressProps) {
  const percentage = Math.min(100, Math.round((charCount / targetCount) * 100));
  const a4Pages = (charCount / 500).toFixed(1);

  return (
    <div className="flex items-center gap-3 text-xs bg-secondary/40 border border-border px-3 py-1.5 rounded-lg">
      <div className="flex items-center gap-1.5 text-foreground font-medium">
        <FileText className="w-3.5 h-3.5 text-purple-400" />
        <span>{charCount.toLocaleString()}자</span>
        <span className="text-muted-foreground">/ {targetCount.toLocaleString()}자 목표</span>
      </div>

      <span className="text-purple-300 font-bold bg-purple-500/10 px-2 py-0.5 rounded text-[11px]">
        약 A4 {a4Pages}장
      </span>

      {/* 프로그레스 바 */}
      <div className="w-24 bg-secondary h-2 rounded-full overflow-hidden hidden sm:block">
        <div
          className={`h-full progress-fill ${
            percentage >= 100
              ? "bg-emerald-500"
              : percentage >= 50
              ? "bg-purple-500"
              : "bg-indigo-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {isGenerating && (
        <span className="flex items-center gap-1 text-[11px] text-amber-400 font-medium animate-pulse ml-auto">
          <Sparkles className="w-3 h-3" />
          메인작가 AI 집필 중 (청크 #{currentChunk + 1})...
        </span>
      )}
    </div>
  );
}
