import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useNovelEpisode, type NovelEpisode } from "@/hooks/useNovelEpisode";
import { useStoryContext } from "@/hooks/useStoryContext";
import { useCharacterArcs } from "@/hooks/useCharacterArcs";
import { useChunkGeneration } from "@/hooks/useChunkGeneration";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { useAiTaskRunner } from "@/hooks/useAiTaskRunner";
import { callAI } from "@/lib/aiHelper";

import { AiControlPanel, AiOutputPanel } from "@/components/novel/AiAssistPanel";
import { AiTextBlock } from "@/components/novel/AiTextBlock";
import { FormatToolbar } from "@/components/novel/FormatToolbar";
import { TTSOverlay } from "@/components/novel/TTSOverlay";
import { ChunkProgress } from "@/components/novel/ChunkProgress";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Save, Sparkles, CheckCircle2, ShieldAlert, AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AiBlockItem {
  id: string;
  text: string;
}

export default function NovelEditor() {
  const { id: projectId, epId } = useParams<{ id: string; epId: string }>();
  const isNewEpisode = !epId || epId === "new";
  const navigate = useNavigate();

  // Hooks
  const { currentEpisode, loadEpisode, createEpisode, updateEpisode } = useNovelEpisode(projectId);
  const { settings, summaries, loadSettings, loadSummaries, buildAiContext, saveSettings } = useStoryContext(projectId);
  const { arcs, saveArc, buildCharacterContext } = useCharacterArcs(projectId || "");
  const { state: chunkState, generateChunk, generateDialogue, suggestScenes, rewriteSelection, reset: resetChunk } = useChunkGeneration();
  const tts = useTextToSpeech();
  useAiTaskRunner(settings, saveSettings);

  // State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [aiBlocks, setAiBlocks] = useState<AiBlockItem[]>([]);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [showTTS, setShowTTS] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [selectedText, setSelectedText] = useState("");

  // Consistency Check Modal State
  const [consistencyResult, setConsistencyResult] = useState<any>(null);
  const [isCheckingConsistency, setIsCheckingConsistency] = useState(false);
  const [showConsistencyDialog, setShowConsistencyDialog] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initial Data Load
  useEffect(() => {
    if (projectId) {
      loadSettings();
      loadSummaries();
    }
  }, [projectId, loadSettings, loadSummaries]);

  useEffect(() => {
    if (!isNewEpisode && epId) {
      loadEpisode(epId).then((ep) => {
        if (ep) {
          setTitle(ep.title);
          setContent(ep.content);
        }
      });
    } else if (isNewEpisode && projectId) {
      setTitle("새 회차");
      setContent("");
    }
  }, [isNewEpisode, epId, projectId, loadEpisode]);

  // Selection handler for rewrite
  const handleSelectText = () => {
    const ta = textareaRef.current;
    if (ta) {
      const sel = ta.value.substring(ta.selectionStart, ta.selectionEnd);
      if (sel.trim().length > 0) {
        setSelectedText(sel);
      } else {
        setSelectedText("");
      }
    }
  };

  // Format insertions
  const insertFormat = (open: string, close: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.substring(start, end);
    const replacement = `${open}${selected || "내용입력"}${close}`;
    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + open.length, start + open.length + (selected.length || 4));
    }, 0);
  };

  // AI Assist Panel Handlers
  const handleContinueWrite = async (direction?: string) => {
    const aiContext = buildAiContext();
    const charCtx = buildCharacterContext();
    await generateChunk({
      projectSettings: aiContext.projectSettings,
      storySummaries: aiContext.storySummaries,
      characterContext: charCtx,
      currentText: content,
      userDirection: direction,
    });
  };

  const handleGenerateDialogue = async (direction?: string) => {
    const aiContext = buildAiContext();
    const charCtx = buildCharacterContext();
    await generateDialogue({
      projectSettings: aiContext.projectSettings,
      storySummaries: aiContext.storySummaries,
      characterContext: charCtx,
      currentText: content,
      userDirection: direction,
    });
  };

  const handleSuggestScenes = async () => {
    const aiContext = buildAiContext();
    await suggestScenes({
      projectSettings: aiContext.projectSettings,
      storySummaries: aiContext.storySummaries,
      currentText: content,
    });
  };

  const handleRewriteSelection = async (instruction: string) => {
    if (!selectedText) return;
    const aiContext = buildAiContext();
    await rewriteSelection({
      projectSettings: aiContext.projectSettings,
      selectedText,
      userDirection: instruction,
    });
  };

  // Insert generated AI text as an interactive AI Block
  const handleInsertAiText = (generatedText: string) => {
    if (!generatedText.trim()) return;
    const blockId = Date.now().toString();
    setAiBlocks((prev) => [...prev, { id: blockId, text: generatedText }]);
    resetChunk();
    toast.success("AI 생성 블록이 본문에 삽입되었습니다 (수정/확정 가능)");
  };

  // AI Block Confirm (merge into main content)
  const handleConfirmBlock = (blockId: string) => {
    const block = aiBlocks.find((b) => b.id === blockId);
    if (!block) return;
    setContent((prev) => (prev ? prev + "\n\n" + block.text : block.text));
    setAiBlocks((prev) => prev.filter((b) => b.id !== blockId));
    toast.success("본문으로 확정되었습니다");
  };

  // AI Block Edit
  const handleEditBlock = (blockId: string, newText: string) => {
    setAiBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, text: newText } : b)));
  };

  // AI Block Delete
  const handleDeleteBlock = (blockId: string) => {
    setAiBlocks((prev) => prev.filter((b) => b.id !== blockId));
  };

  // AI Block Rewrite
  const handleRewriteBlock = async (blockId: string, instruction: string) => {
    const block = aiBlocks.find((b) => b.id === blockId);
    if (!block) return;
    const aiContext = buildAiContext();
    const result = await rewriteSelection({
      projectSettings: aiContext.projectSettings,
      selectedText: block.text,
      userDirection: instruction,
    });
    if (result) {
      handleEditBlock(blockId, result);
      toast.success("AI가 블록을 재작성했습니다");
    }
  };

  // Grammar & Novel Format Correction (Custom AI / Supabase Fallback)
  const handleCorrectText = async () => {
    if (!content.trim()) return toast.error("교정할 본문 텍스트가 없습니다");
    setIsCorrecting(true);
    try {
      // 1. Try Supabase function if available
      if (import.meta.env.VITE_SUPABASE_URL) {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/correct-text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: content, correctionType: "novel" }),
        });

        if (response.ok) {
          const { correctedText } = await response.json();
          if (correctedText) {
            setContent(correctedText);
            toast.success("소설 서식 및 맞춤법 교정 완료!");
            return;
          }
        }
      }
    } catch {
      // Fallback
    }

    // 2. Fallback: Use active AI Provider (Local AI / Gemini / OpenAI)
    try {
      const systemPrompt = `당신은 웹소설 전문 맞춤법, 띄어쓰기 및 서식 교정 에디터 AI입니다.
주어진 본문의 오탈자를 교정하고, 웹소설 표준 문체 및 문장 호흡에 맞춰 다듬으세요.

[규칙]
- 대화체는 "", 속마음은 '', 시스템 메세지는 [] 서식을 철저히 적용하세요.
- 전체 스토리 줄거리, 등장인물의 고유 말투나 대사는 절대로 변경하지 마세요.
- 오직 교정된 본문 텍스트 전체만 출력하세요. (인사말, 교정 내역 설명 등 메타 텍스트 금지)`;

      const corrected = await callAI(systemPrompt, content);
      if (corrected) {
        setContent(corrected);
        toast.success("소설 서식 및 맞춤법 교정 완료! (AI 에디터 적용)");
      }
    } catch (err: any) {
      console.error("교정 오류:", err);
      toast.error("맞춤법 교정에 실패했습니다");
    } finally {
      setIsCorrecting(false);
    }
  };

  // Writer 1 AI Consistency Check
  const handleCheckConsistency = async () => {
    if (!content.trim()) return toast.error("검토할 본문 텍스트가 없습니다");
    setIsCheckingConsistency(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/story-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: "consistency-check",
          currentText: content,
          previousSummaries: summaries,
          characterArcs: arcs,
        }),
      });

      if (!response.ok) throw new Error("개연성 검토 실패");
      const data = await response.json();
      setConsistencyResult(data);
      setShowConsistencyDialog(true);
    } catch (err) {
      console.error("개연성 검토 오류:", err);
      toast.error("개연성 검토에 실패했습니다");
    } finally {
      setIsCheckingConsistency(false);
    }
  };

  // Save Episode & Auto-generate Summary & Character Arcs (Writer 1 & Writer 2)
  const handleSave = async () => {
    if (!title.trim()) return toast.error("회차 제목을 입력해주세요");
    if (!content.trim() && aiBlocks.length === 0) return toast.error("본문 내용을 작성해주세요");

    // Merge pending AI blocks before saving
    let finalContent = content;
    if (aiBlocks.length > 0) {
      const unconfirmed = aiBlocks.map((b) => b.text).join("\n\n");
      finalContent = finalContent ? finalContent + "\n\n" + unconfirmed : unconfirmed;
      setAiBlocks([]);
      setContent(finalContent);
    }

    setIsSaving(true);
    try {
      let activeEpId = epId;

      if (isNewEpisode) {
        const newEp = await createEpisode(title.trim());
        activeEpId = newEp.id;
        await updateEpisode(newEp.id, { title: title.trim(), content: finalContent, status: "draft" });
      } else if (epId) {
        await updateEpisode(epId, { title: title.trim(), content: finalContent });
      }

      toast.success("에피소드가 저장되었습니다!");

      // 비동기로 작가1 & 작가2 AI가 스토리 요약 및 인물별 아크 자동 생성
      if (activeEpId && projectId) {
        void (async () => {
          try {
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/story-review`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({
                action: "generate-summary",
                currentText: finalContent,
                characters: settings?.characters || [],
              }),
            });

            if (response.ok) {
              const { summary, character_arcs: newArcs } = await response.json();

              // 1. story_summaries 테이블 저장
              if (summary) {
                await (supabase as any).from("story_summaries").upsert(
                  {
                    episode_id: activeEpId,
                    project_id: projectId,
                    episode_number: currentEpisode?.episode_number || 1,
                    events: summary.events || [],
                    character_changes: summary.character_changes || {},
                    foreshadowing: summary.foreshadowing || [],
                    world_state: summary.world_state || "",
                    key_dialogue: summary.key_dialogue || [],
                    unresolved: summary.unresolved || [],
                  },
                  { onConflict: "episode_id" }
                );
              }

              // 2. character_arcs 테이블 저장 (작가2 AI 담당)
              if (newArcs && Array.isArray(newArcs)) {
                for (const arcData of newArcs) {
                  await saveArc({
                    project_id: projectId,
                    character_name: arcData.character_name,
                    episode_number: currentEpisode?.episode_number || 1,
                    emotional_state: arcData.emotional_state || "",
                    location: arcData.location || "",
                    goals: arcData.goals || "",
                    known_info: arcData.known_info || [],
                    unknown_info: arcData.unknown_info || [],
                    relationships: arcData.relationships || {},
                    growth_notes: arcData.growth_notes || "",
                    conflicts: arcData.conflicts || "",
                    next_possibilities: arcData.next_possibilities || "",
                  });
                }
              }
            }
          } catch (e) {
            console.error("스토리 요약 및 인물 아크 자동 생성 오류:", e);
          }
        })();
      }
    } catch (err) {
      console.error("저장 실패:", err);
      toast.error("저장에 실패했습니다");
    } finally {
      setIsSaving(false);
    }
  };

  const totalChars = content.length + aiBlocks.reduce((acc, b) => acc + b.text.length, 0);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col h-screen overflow-hidden">
      {/* 헤더 바 */}
      <header className="border-b border-border bg-card/70 backdrop-blur-md h-14 px-4 flex items-center justify-between shrink-0 z-40">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/project/${projectId}`)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="에피소드 제목 입력"
            className="bg-transparent border-none text-sm font-bold focus-visible:ring-0 focus-visible:bg-white/5 max-w-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5 shadow-md"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? "저장 중..." : "에피소드 저장"}
          </Button>
        </div>
      </header>

      {/* 메인 작업 영역: 에디터 + AI 패널 (3-Column Grid) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden relative">
        {/* 본문 에디터 영역 (1열) */}
        <div className={`flex flex-col p-4 sm:p-6 overflow-y-auto novel-scrollbar w-full space-y-4 border-r border-border transition-all ${aiPanelOpen ? 'lg:col-span-6' : 'lg:col-span-12'}`}>
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              {/* 포맷 툴바 */}
              <FormatToolbar
                onInsertDialogue={() => insertFormat('"', '"')}
                onInsertThought={() => insertFormat("'", "'")}
                onInsertSpecial={() => insertFormat("[", "]")}
                onInsertParen={() => insertFormat("(", ")")}
                onCorrectText={handleCorrectText}
                onCheckConsistency={handleCheckConsistency}
                onToggleTTS={() => setShowTTS(!showTTS)}
                isLoading={isCorrecting || isCheckingConsistency}
              />
            </div>
            
            {/* 데스크탑 AI 토글 버튼 */}
            <Button
              variant={aiPanelOpen ? "secondary" : "outline"}
              size="sm"
              onClick={() => setAiPanelOpen(!aiPanelOpen)}
              className="hidden lg:flex gap-1.5 border-purple-500/30 text-purple-300 hover:bg-purple-900/50 shadow-sm shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              {aiPanelOpen ? 'AI 패널 숨기기' : 'AI 패널 열기'}
            </Button>
          </div>

          {/* 메인 텍스트 에디터 */}
          <div className="flex-1 flex flex-col glass-card rounded-2xl p-4 sm:p-6 editor-glow relative">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onSelect={handleSelectText}
              placeholder="여기에 소설 본문을 작성하세요... (대화체는 &quot;&quot;, 생각은 '', 특별메시지는 [] 사용)"
              className="flex-1 min-h-[400px] sm:min-h-[500px] bg-transparent border-none resize-none novel-editor-content text-base sm:text-lg focus-visible:ring-0 text-foreground/90 leading-loose"
            />

            {/* AI 생성 미확정 블록들 */}
            {aiBlocks.length > 0 && (
              <div className="mt-6 border-t border-purple-500/20 pt-4 space-y-3">
                <p className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  미확정 AI 생성 블록 ({aiBlocks.length}개)
                </p>
                {aiBlocks.map((block) => (
                  <AiTextBlock
                    key={block.id}
                    id={block.id}
                    text={block.text}
                    onConfirm={handleConfirmBlock}
                    onEdit={handleEditBlock}
                    onDelete={handleDeleteBlock}
                    onRewrite={handleRewriteBlock}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI 패널 열려 있을 시 (2열, 3열) */}
        {aiPanelOpen && (
          <>
            {/* AI 컨트롤 패널 (2열) */}
            <div className="lg:col-span-3 flex flex-col border-r border-border overflow-hidden bg-card/90">
              <AiControlPanel
                onContinueWrite={handleContinueWrite}
                onGenerateDialogue={handleGenerateDialogue}
                onSuggestScenes={handleSuggestScenes}
                onRewriteSelection={handleRewriteSelection}
                isGenerating={chunkState.isGenerating}
                selectedText={selectedText}
              />
            </div>
            
            {/* AI 출력 결과 패널 (3열) */}
            <div className="lg:col-span-3 flex flex-col overflow-hidden bg-black/10">
              <AiOutputPanel
                generatedText={chunkState.generatedText}
                isGenerating={chunkState.isGenerating}
                onInsertText={handleInsertAiText}
              />
            </div>
          </>
        )}

        {/* 모바일용 플로팅 토글 버튼 */}
        {!aiPanelOpen && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setAiPanelOpen(true)}
            className="fixed right-4 top-20 z-40 bg-purple-950/80 border-purple-500/30 text-purple-200 hover:bg-purple-900/80 shadow-lg backdrop-blur-md lg:hidden"
            title="AI 패널 열기"
          >
            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
          </Button>
        )}
      </div>

      {/* TTS 보이스 오버레이 바 (플로팅) */}
      {showTTS && (
        <TTSOverlay
          isPlaying={tts.isPlaying}
          isPaused={tts.isPaused}
          progress={tts.progress}
          currentSentenceIndex={tts.currentSentenceIndex}
          totalSentences={tts.totalSentences}
          rate={tts.rate}
          availableVoices={tts.availableVoices}
          selectedVoice={tts.selectedVoice}
          onPlay={() => tts.speak(content)}
          onPause={tts.pause}
          onResume={tts.resume}
          onStop={tts.stop}
          onSkipForward={tts.skipForward}
          onSkipBackward={tts.skipBackward}
          onRateChange={tts.setRate}
          onVoiceChange={tts.setVoice}
          onClose={() => {
            tts.stop();
            setShowTTS(false);
          }}
        />
      )}

      {/* 상태바 */}
      <footer className="border-t border-border bg-card/80 h-10 px-4 flex items-center justify-between text-xs shrink-0 z-30">
        <ChunkProgress
          currentChunk={chunkState.currentChunk}
          isGenerating={chunkState.isGenerating}
          charCount={totalChars}
          targetCount={10000}
        />

        <div className="flex items-center gap-3 text-muted-foreground">
          <span>{settings?.perspective === "1st" ? "1인칭" : "3인칭"}</span>
          <span>·</span>
          <span>명조체 모드</span>
        </div>
      </footer>

      {/* 작가1 AI 개연성 검토결과 모달 */}
      <Dialog open={showConsistencyDialog} onOpenChange={setShowConsistencyDialog}>
        <DialogContent className="max-w-md bg-card border-purple-500/30 text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-purple-300">
              <ShieldAlert className="w-5 h-5 text-purple-400" />
              작가1 AI - 스토리 개연성 검토 리포트
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              이전 회차 요약 및 인물 상태와 본문의 모순 여부를 분석했습니다.
            </DialogDescription>
          </DialogHeader>

          {consistencyResult && (
            <div className="space-y-4 my-2 text-xs">
              <div className="flex items-center justify-between p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <span className="font-semibold text-purple-200">개연성 일치 점수</span>
                <span className="text-lg font-extrabold text-purple-300">
                  {consistencyResult.score ?? 100}점
                </span>
              </div>

              {/* 모순 및 문제점 */}
              {consistencyResult.issues && consistencyResult.issues.length > 0 ? (
                <div className="space-y-2">
                  <p className="font-semibold text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> 발견된 모순 및 위험 요소:
                  </p>
                  <ul className="space-y-1.5">
                    {consistencyResult.issues.map((iss: any, idx: number) => (
                      <li key={idx} className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-200">
                        <strong className="text-rose-300">[{iss.type}]</strong> {iss.description}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>이전 스토리와의 모순이나 개연성 문제점이 발견되지 않았습니다!</span>
                </div>
              )}

              {/* 작가1 AI 조언 */}
              {consistencyResult.writerAdvice && (
                <div className="p-3 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 space-y-1">
                  <p className="font-bold text-indigo-300">💡 작가1 AI의 집필 조언:</p>
                  <p>{consistencyResult.writerAdvice}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
