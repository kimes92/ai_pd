import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useNovelProject } from "@/hooks/useNovelProject";
import { useStoryContext, type CharacterInfo } from "@/hooks/useStoryContext";
import { CharacterCard } from "@/components/novel/CharacterCard";
import { CharacterRelationshipMap } from "@/components/novel/CharacterRelationshipMap";
import { AiSchedulePanel } from "@/components/novel/AiSchedulePanel";
import { useAiTaskRunner } from "@/hooks/useAiTaskRunner";
import { AiScheduledTask } from "@/hooks/useStoryContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Save, Plus, BookOpen, Users, Sparkles, Loader2, Network } from "lucide-react";
import { toast } from "sonner";

const GENRE_PRESETS = ["판타지", "로맨스", "미스터리", "SF", "액션", "공포", "일상", "역사"];

export default function ProjectSettings() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();

  const { createProject, updateProject, getProject } = useNovelProject();
  const { settings, saveSettings, loadSettings, generateAiCharacter } = useStoryContext(id);
  useAiTaskRunner(settings, saveSettings);

  // 폼 스태이트
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("판타지");
  const [perspective, setPerspective] = useState<"1st" | "3rd_limited" | "3rd_omniscient">("3rd_limited");
  const [synopsis, setSynopsis] = useState("");
  const [description, setDescription] = useState("");
  const [writingStyle, setWritingStyle] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [characters, setCharacters] = useState<CharacterInfo[]>([
    { name: "", appearance: "", personality: "", background: "", relationships: "", speechStyle: "" },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  // AI 인물 생성 모달 스태이트
  const [showAiCharDialog, setShowAiCharDialog] = useState(false);
  const [aiCharPrompt, setAiCharPrompt] = useState("");
  const [isGeneratingChar, setIsGeneratingChar] = useState(false);

  useEffect(() => {
    if (isEditMode && id) {
      getProject(id).then((p) => {
        if (p) {
          setTitle(p.title);
          setGenre(p.genre || "판타지");
        }
      });
      loadSettings().then((s) => {
        if (s) {
          setPerspective(s.perspective || "3rd_limited");
          setSynopsis(s.synopsis || "");
          setDescription(s.description || "");
          setWritingStyle(s.writing_style || "");
          setReferenceText(s.reference_text || "");
          if (s.characters && s.characters.length > 0) {
            setCharacters(s.characters);
          }
        }
      });
    }
  }, [id, isEditMode, getProject, loadSettings]);

  // 인물 수동 추가
  const handleAddCharacter = () => {
    setCharacters((prev) => [
      ...prev,
      { name: "", appearance: "", personality: "", background: "", relationships: "", speechStyle: "" },
    ]);
  };

  // AI 인물 자동 생성 처리
  const handleGenerateAiChar = async () => {
    setIsGeneratingChar(true);
    try {
      const generated = await generateAiCharacter(aiCharPrompt);
      if (generated) {
        setCharacters((prev) => {
          // 비어있는 미작성 카드가 있으면 대체, 없으면 추가
          const hasEmpty = prev.length === 1 && prev[0].name.trim() === "";
          return hasEmpty ? [generated] : [...prev, generated];
        });
        toast.success(`'${generated.name}' 인물이 이야기 세계관에 맞춰 자동 생성되었습니다!`);
        setShowAiCharDialog(false);
        setAiCharPrompt("");
      }
    } catch (err) {
      console.error(err);
      toast.error("인물 생성 중 오류가 발생했습니다");
    } finally {
      setIsGeneratingChar(false);
    }
  };

  // 인물 수정
  const handleUpdateCharacter = (index: number, updatedChar: CharacterInfo) => {
    setCharacters((prev) => {
      const next = [...prev];
      next[index] = updatedChar;
      return next;
    });
  };

  // 인물 삭제
  const handleDeleteCharacter = (index: number) => {
    setCharacters((prev) => prev.filter((_, i) => i !== index));
  };

  // 저장 처리
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("소설 제목을 입력해주세요");
      return;
    }

    setIsSaving(true);
    try {
      let targetProjectId = id;

      if (isEditMode && id) {
        await updateProject(id, { title: title.trim(), genre });
      } else {
        const newProj = await createProject(title.trim(), genre);
        targetProjectId = newProj.id;
      }

      if (targetProjectId) {
        const filteredChars = characters.filter((c) => c.name.trim() !== "");
        await saveSettings({
          perspective,
          characters: filteredChars,
          synopsis,
          description,
          writing_style: writingStyle,
          reference_text: referenceText,
          format_rules: { dialogue: '""', thought: "''", special: "[]" },
          scheduled_tasks: settings?.scheduled_tasks || [],
          ai_notes: settings?.ai_notes || [],
        });
      }

      toast.success(isEditMode ? "설정이 수정되었습니다" : "새 소설 프로젝트가 생성되었습니다");
      navigate(`/project/${targetProjectId}`);
    } catch (err) {
      console.error("저장 실패:", err);
      toast.error("저장에 실패했습니다");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* 헤더 */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(isEditMode && id ? `/project/${id}` : "/")}
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-base font-bold text-foreground">
              {isEditMode ? "프로젝트 설정 편집" : "새 소설 프로젝트 생성"}
            </h1>
          </div>

          <Button
            type="submit"
            form="project-form"
            disabled={isSaving}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5 shadow-md"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? "저장 중..." : "설정 저장 및 시작"}
          </Button>
        </div>
      </header>

      {/* 메인 설정 폼 */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
        <form id="project-form" onSubmit={handleSave} className="space-y-8">
          {/* 섹션 1: 기본 정보 */}
          <section className="glass-card rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <BookOpen className="w-5 h-5 text-purple-400" />
              <h2 className="text-base font-bold text-foreground">1. 기본 소설 정보</h2>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                소설 제목 <span className="text-rose-400">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 별빛 속의 마법사"
                className="bg-background/50 text-sm font-semibold"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">장르 선택</label>
              <div className="flex flex-wrap gap-2">
                {GENRE_PRESETS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenre(g)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                      genre === g
                        ? "bg-purple-600 border-purple-500 text-white font-bold shadow-md"
                        : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">소설 소개 (독자용)</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="독자에게 보여줄 매혹적인 소설 소개글을 입력하세요."
                className="bg-background/50 text-xs h-20 resize-none"
              />
            </div>
          </section>

          {/* 섹션 2: 시점 및 문체 설정 */}
          <section className="glass-card rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold text-foreground">2. 서사 시점 및 문체 스타일</h2>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">서사 시점 선택</label>
              <RadioGroup
                value={perspective}
                onValueChange={(v: any) => setPerspective(v)}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
              >
                <div className="flex items-center space-x-2 border border-border rounded-xl p-3 bg-background/40 cursor-pointer hover:border-purple-500/40">
                  <RadioGroupItem value="1st" id="p1" />
                  <Label htmlFor="p1" className="cursor-pointer text-xs">
                    <span className="font-bold block">1인칭 시점</span>
                    <span className="text-[11px] text-muted-foreground">"나"의 눈으로 서술</span>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 border border-border rounded-xl p-3 bg-background/40 cursor-pointer hover:border-purple-500/40">
                  <RadioGroupItem value="3rd_limited" id="p2" />
                  <Label htmlFor="p2" className="cursor-pointer text-xs">
                    <span className="font-bold block">3인칭 제한적</span>
                    <span className="text-[11px] text-muted-foreground">특정 주인공 중심 서술 (추천)</span>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 border border-border rounded-xl p-3 bg-background/40 cursor-pointer hover:border-purple-500/40">
                  <RadioGroupItem value="3rd_omniscient" id="p3" />
                  <Label htmlFor="p3" className="cursor-pointer text-xs">
                    <span className="font-bold block">3인칭 전지적</span>
                    <span className="text-[11px] text-muted-foreground">신의 시점, 모든 심리 서술</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                전체 시놉시스 (줄거리 개요)
              </label>
              <Textarea
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                placeholder="전체 이야기의 흐름, 시작-전개-위기-절정-결말을 자유롭게 작성해주세요. AI 메인작가가 이 흐름을 참고합니다."
                className="bg-background/50 text-xs h-32 leading-relaxed"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                글 스타일 및 톤 지시
              </label>
              <Input
                value={writingStyle}
                onChange={(e) => setWritingStyle(e.target.value)}
                placeholder="예: 건조하지만 감각적인 묘사, 긴장감 넘치는 빠른 호흡, 대화 중심"
                className="bg-background/50 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                문체 참고 샘플 텍스트 (선택)
              </label>
              <Textarea
                value={referenceText}
                onChange={(e) => setReferenceText(e.target.value)}
                placeholder="AI가 참고하길 바라는 본인의 문체나 선호하는 소설 단락을 붙여넣으세요."
                className="bg-background/50 text-xs h-24 font-serif-kr"
              />
            </div>
          </section>

          {/* 섹션 3: 인물 구도 설정 */}
          <section className="glass-card rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-bold text-foreground">3. 등장인물 구도 및 관계 설정</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAiCharDialog(true)}
                  className="text-xs gap-1.5 border-purple-500/40 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  AI 인물 자동 생성 (작가2)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddCharacter}
                  className="text-xs gap-1 border-border"
                >
                  <Plus className="w-3.5 h-3.5" />
                  직접 추가
                </Button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/15 text-xs text-muted-foreground leading-relaxed space-y-1">
              <p className="font-bold text-purple-300">💡 주요 인물 및 조연/엑스트라 연출 안내</p>
              <p>
                - 여기에 등록하는 인물들은 <strong>스토리의 중심을 잡는 주연/핵심 조연</strong>입니다.
              </p>
              <p>
                - 집필 시 메인작가 AI가 등록된 주연들 외에도 이야기의 분위기와 생동감을 살리기 위한 <strong>마을 주민, 상인, 경비병, 악당 하수인 등 조연 및 엑스트라 인물들을 자유롭고 풍성하게 등장</strong>시킵니다.
              </p>
            </div>

            {/* 인물 카드 목록 */}
            <div className="space-y-3">
              {characters.map((char, idx) => (
                <CharacterCard
                  key={idx}
                  character={char}
                  index={idx}
                  onUpdate={handleUpdateCharacter}
                  onDelete={handleDeleteCharacter}
                />
              ))}
            </div>

            {/* 인물 관계도 시각화 미리보기 */}
            {characters.filter((c) => c.name.trim() !== "").length > 0 && (
              <div className="pt-4 border-t border-border/50 space-y-3">
                <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <Network className="w-4 h-4 text-indigo-400" />
                  인물 관계도 시각화 미리보기
                </h4>
                <CharacterRelationshipMap characters={characters.filter((c) => c.name.trim() !== "")} />
              </div>
            )}
          </section>

          {/* 섹션 4: AI 예약 작업 및 노트 보관함 */}
          <section className="glass-card rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold text-foreground">4. AI 예약 작업 & 노트 보관함</h2>
            </div>
            
            <AiSchedulePanel 
              settings={settings} 
              onUpdateTasks={(tasks: AiScheduledTask[]) => {
                saveSettings({ scheduled_tasks: tasks });
              }} 
            />
          </section>

          {/* 하단 저장 버튼 */}
          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-6 px-8 rounded-xl text-sm shadow-xl shadow-purple-900/30 gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "저장 중..." : "프로젝트 저장 및 집필 시작"}
            </Button>
          </div>
        </form>
      </main>

      {/* AI 인물 자동 생성 모달 */}
      <Dialog open={showAiCharDialog} onOpenChange={setShowAiCharDialog}>
        <DialogContent className="max-w-md bg-card border-purple-500/30 text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-purple-300">
              <Sparkles className="w-5 h-5 text-amber-300" />
              작가2 AI — 세계관 맞춤 인물 자동 생성
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              현재 작성된 장르와 시놉시스에 어울리고 서사 확장이 가능한 입체적 인물을 생성합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-2 text-xs">
            <div>
              <label className="font-semibold text-muted-foreground mb-1 block">
                원하는 인물 유형 / 조건 (선택)
              </label>
              <Textarea
                value={aiCharPrompt}
                onChange={(e) => setAiCharPrompt(e.target.value)}
                placeholder="예: 주인공 카일의 라이벌인 마법 기사단장, 혹은 비밀 첩자 역할"
                className="bg-background/50 h-20 resize-none text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setShowAiCharDialog(false)}
              className="text-xs"
            >
              취소
            </Button>
            <Button
              onClick={handleGenerateAiChar}
              disabled={isGeneratingChar}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5"
            >
              {isGeneratingChar ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {isGeneratingChar ? "인물 설계 중..." : "AI 인물 생성하기"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
