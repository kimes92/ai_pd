import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useNovelProject, type NovelProject } from "@/hooks/useNovelProject";
import { useNovelEpisode } from "@/hooks/useNovelEpisode";
import { useStoryContext } from "@/hooks/useStoryContext";
import { useCharacterArcs } from "@/hooks/useCharacterArcs";
import { useAiTaskRunner } from "@/hooks/useAiTaskRunner";
import { useAutoWriterEngine } from "@/hooks/useAutoWriterEngine";

import { EpisodeList } from "@/components/novel/EpisodeList";
import { StoryTimeline } from "@/components/novel/StoryTimeline";
import { CharacterArcPanel } from "@/components/novel/CharacterArcPanel";
import { CharacterRelationshipMap } from "@/components/novel/CharacterRelationshipMap";
import { AutoWriterPanel } from "@/components/novel/AutoWriterPanel";

import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, BookOpen, GitCommit, UserCheck, Layers, Network, Bot } from "lucide-react";

export default function ProjectDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject } = useNovelProject();
  const { episodes, createEpisode, updateEpisode, isLoading: episodesLoading } = useNovelEpisode(id);
  const { settings, summaries, loadSettings, loadSummaries, saveSettings } = useStoryContext(id);
  const { getArcSummaries, isLoading: arcsLoading } = useCharacterArcs(id || "");
  useAiTaskRunner(settings, saveSettings);
  const { autoState, toggleAutoMode, runOneCycle, addFeedback, applyFeedbackNow } = useAutoWriterEngine(
    settings, saveSettings, episodes, updateEpisode, createEpisode
  );

  const [project, setProject] = useState<NovelProject | null>(null);
  const [activeTab, setActiveTab] = useState<"episodes" | "relationships" | "arcs" | "timeline" | "settings" | "automation">("episodes");

  useEffect(() => {
    if (id) {
      getProject(id).then((p) => p && setProject(p));
      loadSettings();
      loadSummaries();
    }
  }, [id, getProject, loadSettings, loadSummaries]);

  const handleCreateEpisode = async () => {
    if (!id) return;
    try {
      const newEp = await createEpisode();
      navigate(`/project/${id}/episode/${newEp.id}`);
    } catch (err) {
      console.error("에피소드 생성 실패:", err);
    }
  };

  if (!id || !project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const totalChars = episodes.reduce((acc, ep) => acc + (ep.char_count || 0), 0);
  const totalA4Pages = (totalChars / 500).toFixed(1);
  const arcSummaries = getArcSummaries();
  const characterList = settings?.characters || [];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* 헤더 네비게이션 */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-purple-400 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                  {project.genre || "장르미지정"}
                </span>
                <h1 className="text-base font-bold text-foreground truncate max-w-xs sm:max-w-md">
                  {project.title}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/project/${id}/settings`)}
              className="text-xs gap-1.5 border-border hover:bg-white/5"
            >
              <Settings className="w-3.5 h-3.5" />
              프로젝트 설정
            </Button>
          </div>
        </div>
      </header>

      {/* 대시보드 요약 정보 바 */}
      <section className="bg-card/30 border-b border-border py-4 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-3 rounded-xl glass-card">
            <p className="text-xs text-muted-foreground">총 에피소드</p>
            <p className="text-lg font-extrabold text-purple-300">{episodes.length}회차</p>
          </div>
          <div className="p-3 rounded-xl glass-card">
            <p className="text-xs text-muted-foreground">총 집필 분량</p>
            <p className="text-lg font-extrabold text-indigo-300">
              {totalChars.toLocaleString()}자 (약 {totalA4Pages}장)
            </p>
          </div>
          <div className="p-3 rounded-xl glass-card">
            <p className="text-xs text-muted-foreground">주요 인물 수</p>
            <p className="text-lg font-extrabold text-emerald-300">
              {characterList.length}명
            </p>
          </div>
          <div className="p-3 rounded-xl glass-card">
            <p className="text-xs text-muted-foreground">시점 설정</p>
            <p className="text-lg font-extrabold text-amber-300">
              {settings?.perspective === "1st"
                ? "1인칭"
                : settings?.perspective === "3rd_limited"
                ? "3인칭 제한적"
                : "3인칭 전지적"}
            </p>
          </div>
        </div>
      </section>

      {/* 탭 네비게이션 & 메인 영역 */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        {/* 탭 버튼들 */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
          <Button
            variant={activeTab === "episodes" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("episodes")}
            className={`text-xs gap-1.5 rounded-lg ${
              activeTab === "episodes" ? "bg-purple-600 text-white" : "text-muted-foreground"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            에피소드 목록 ({episodes.length})
          </Button>

          <Button
            variant={activeTab === "relationships" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("relationships")}
            className={`text-xs gap-1.5 rounded-lg ${
              activeTab === "relationships" ? "bg-purple-600 text-white" : "text-muted-foreground"
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            인물 관계도 ({characterList.length})
          </Button>

          <Button
            variant={activeTab === "arcs" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("arcs")}
            className={`text-xs gap-1.5 rounded-lg ${
              activeTab === "arcs" ? "bg-purple-600 text-white" : "text-muted-foreground"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            인물별 스토리 아크 ({arcSummaries.length})
          </Button>

          <Button
            variant={activeTab === "timeline" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("timeline")}
            className={`text-xs gap-1.5 rounded-lg ${
              activeTab === "timeline" ? "bg-purple-600 text-white" : "text-muted-foreground"
            }`}
          >
            <GitCommit className="w-3.5 h-3.5" />
            스토리 타임라인 ({summaries.length})
          </Button>

          <Button
            variant={activeTab === "settings" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("settings")}
            className={`text-xs gap-1.5 rounded-lg ${
              activeTab === "settings" ? "bg-purple-600 text-white" : "text-muted-foreground"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            설정 요약
          </Button>

          <Button
            variant={activeTab === "automation" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("automation")}
            className={`text-xs gap-1.5 rounded-lg ${
              activeTab === "automation" ? "bg-emerald-600 text-white" : "text-muted-foreground"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            🤖 AI 자동화
            {autoState.isAutoMode && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </Button>
        </div>

        {/* 탭 1: 에피소드 목록 */}
        {activeTab === "episodes" && (
          <EpisodeList
            episodes={episodes}
            projectId={id}
            onCreateNew={handleCreateEpisode}
          />
        )}

        {/* 탭 2: 인물 관계도 */}
        {activeTab === "relationships" && (
          <div className="space-y-4">
            <CharacterRelationshipMap characters={characterList} />
          </div>
        )}

        {/* 탭 3: 인물별 스토리 아크 (작가2 AI) */}
        {activeTab === "arcs" && (
          <div className="space-y-4 max-w-3xl">
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 text-xs">
              <p className="font-bold mb-1">🎭 작가2 AI의 인물별 스토리 아크 추적 시스템</p>
              <p className="text-purple-300/80">
                각 인물의 감정 상태, 알고 있는 것/모르는 것, 목표, 관계 변화를 독립적으로 추적하여 스토리의 입체감과 개연성을 보장합니다.
              </p>
            </div>
            <CharacterArcPanel arcs={arcSummaries} isLoading={arcsLoading} />
          </div>
        )}

        {/* 탭 4: 스토리 타임라인 (작가1 AI) */}
        {activeTab === "timeline" && (
          <div className="max-w-3xl">
            <StoryTimeline summaries={summaries} />
          </div>
        )}

        {/* 탭 5: 설정 요약 */}
        {activeTab === "settings" && (
          <div className="max-w-3xl space-y-4">
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h4 className="text-base font-bold text-foreground">시놉시스 및 개요</h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/project/${id}/settings`)}
                  className="text-xs"
                >
                  편집하기
                </Button>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1 font-semibold">전체 시놉시스</p>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {settings?.synopsis || "등록된 시놉시스가 없습니다."}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1 font-semibold">글 스타일 및 톤</p>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {settings?.writing_style || "기본 스타일"}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1 font-semibold">서식 포맷 규칙</p>
                <div className="flex items-center gap-3 text-xs text-purple-300 font-mono">
                  <span>대화체: {"\"\""}</span>
                  <span>생각: {"''"}</span>
                  <span>특별메시지: []</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 탭 6: AI 자동화 */}
        {activeTab === "automation" && (
          <div className="max-w-3xl">
            <AutoWriterPanel
              autoState={autoState}
              settings={settings}
              episodes={episodes}
              onToggleAutoMode={toggleAutoMode}
              onRunOneCycle={runOneCycle}
              onAddFeedback={addFeedback}
              onApplyFeedbackNow={applyFeedbackNow}
            />
          </div>
        )}
      </main>
    </div>
  );
}
