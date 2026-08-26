import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  X,
  FastForward,
} from "lucide-react";

interface TTSOverlayProps {
  isPlaying: boolean;
  isPaused: boolean;
  progress: number;
  currentSentenceIndex: number;
  totalSentences: number;
  rate: number;
  availableVoices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
  onRateChange: (rate: number) => void;
  onVoiceChange: (voice: SpeechSynthesisVoice) => void;
  onClose: () => void;
}

export function TTSOverlay({
  isPlaying,
  isPaused,
  progress,
  currentSentenceIndex,
  totalSentences,
  rate,
  availableVoices,
  selectedVoice,
  onPlay,
  onPause,
  onResume,
  onStop,
  onSkipForward,
  onSkipBackward,
  onRateChange,
  onVoiceChange,
  onClose,
}: TTSOverlayProps) {
  const rates = [0.8, 1.0, 1.2, 1.5, 2.0];

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-2xl bg-card/95 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-3 shadow-2xl space-y-2 animate-in slide-in-from-bottom-4 duration-300">
      {/* 프로그레스 바 */}
      <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        {/* 컨트롤러 상태 설명 */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Volume2 className="w-4 h-4 animate-pulse" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground truncate">
              {isPlaying ? "소설 낭독 중..." : isPaused ? "일시정지됨" : "TTS 보이스 오버레이"}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              문장 {totalSentences > 0 ? `${currentSentenceIndex + 1} / ${totalSentences}` : "0 / 0"} ({progress}%)
            </p>
          </div>
        </div>

        {/* 재생 조작 버튼들 */}
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={onSkipBackward}
            disabled={!isPlaying && !isPaused}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <SkipBack className="w-4 h-4" />
          </Button>

          {isPlaying && !isPaused ? (
            <Button
              size="icon"
              onClick={onPause}
              className="h-9 w-9 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-md"
            >
              <Pause className="w-4 h-4" />
            </Button>
          ) : isPaused ? (
            <Button
              size="icon"
              onClick={onResume}
              className="h-9 w-9 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-md"
            >
              <Play className="w-4 h-4 ml-0.5" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={onPlay}
              className="h-9 w-9 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-full shadow-md"
            >
              <Play className="w-4 h-4 ml-0.5" />
            </Button>
          )}

          <Button
            size="icon"
            variant="ghost"
            onClick={onSkipForward}
            disabled={!isPlaying && !isPaused}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <SkipForward className="w-4 h-4" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={onStop}
            disabled={!isPlaying && !isPaused}
            className="h-8 w-8 text-rose-400 hover:bg-rose-500/10"
          >
            <Square className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* 배속 및 음성 선택 */}
        <div className="flex items-center gap-2">
          {/* 배속 선택 */}
          <div className="flex items-center bg-secondary/60 p-0.5 rounded-lg border border-border">
            {rates.map((r) => (
              <button
                key={r}
                onClick={() => onRateChange(r)}
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  rate === r
                    ? "bg-purple-600 text-white font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r}x
              </button>
            ))}
          </div>

          {/* 닫기 버튼 */}
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="h-7 w-7 text-muted-foreground hover:text-foreground ml-1"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
