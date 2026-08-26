import { useState } from "react";
import { type CharacterInfo } from "@/hooks/useStoryContext";
import { User, Swords, Shield, Heart, HelpCircle, ArrowRightLeft, Sparkles } from "lucide-react";

interface CharacterRelationshipMapProps {
  characters: CharacterInfo[];
}

export function CharacterRelationshipMap({ characters }: CharacterRelationshipMapProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);

  if (!characters || characters.length === 0) {
    return (
      <div className="p-8 text-center glass-card rounded-2xl">
        <User className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
        <p className="text-sm font-medium text-foreground">등록된 등장인물이 없습니다.</p>
        <p className="text-xs text-muted-foreground mt-1">
          설정 창에서 인물을 등록하거나 'AI 인물 자동 생성'을 이용해 추가해보세요.
        </p>
      </div>
    );
  }

  const getRelationIcon = (relText: string) => {
    if (relText.includes("적대") || relText.includes("숙적") || relText.includes("경계") || relText.includes("싸움")) {
      return <Swords className="w-3.5 h-3.5 text-rose-400" />;
    }
    if (relText.includes("연인") || relText.includes("짝사랑") || relText.includes("애정") || relText.includes("호감")) {
      return <Heart className="w-3.5 h-3.5 text-pink-400" />;
    }
    if (relText.includes("동맹") || relText.includes("신뢰") || relText.includes("친구") || relText.includes("조력")) {
      return <Shield className="w-3.5 h-3.5 text-emerald-400" />;
    }
    return <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />;
  };

  const filtered = selectedCharacter
    ? characters.filter((c) => c.name === selectedCharacter)
    : characters;

  return (
    <div className="space-y-4">
      {/* 헤더 설명 */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 text-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="font-bold">인물 관계도 & 서사 연결 망</span>
        </div>
        <span className="text-[11px] text-purple-300/70">
          인물을 클릭하면 개별 서사 관계가 하이라이트됩니다
        </span>
      </div>

      {/* 인물 필터 칩 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCharacter(null)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
            selectedCharacter === null
              ? "bg-purple-600 border-purple-500 text-white font-bold"
              : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          전체 보기 ({characters.length}명)
        </button>
        {characters.map((c) => (
          <button
            key={c.name}
            onClick={() => setSelectedCharacter(c.name)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
              selectedCharacter === c.name
                ? "bg-purple-600 border-purple-500 text-white font-bold"
                : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* 인물 카드 및 관계망 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((char) => (
          <div
            key={char.name}
            className="glass-card rounded-2xl p-4 space-y-3 border border-border hover:border-purple-500/40 transition-all shadow-lg"
          >
            {/* 헤더: 이름 & 기본 프로필 */}
            <div className="flex items-start gap-3 border-b border-border/50 pb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md">
                {char.name ? char.name.charAt(0) : <User className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-foreground truncate">{char.name}</h4>
                <p className="text-xs text-purple-300/80 truncate">
                  {char.appearance || "외모 미기록"}
                </p>
                <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                  말투: {char.speechStyle || "기본 말투"}
                </p>
              </div>
            </div>

            {/* 성격 & 배경 */}
            <div className="text-xs space-y-1.5">
              <div>
                <span className="text-muted-foreground font-semibold">성격/동기: </span>
                <span className="text-foreground/90">{char.personality || "미기록"}</span>
              </div>
              {char.background && (
                <div>
                  <span className="text-muted-foreground font-semibold">배경/비밀: </span>
                  <span className="text-foreground/80">{char.background}</span>
                </div>
              )}
            </div>

            {/* 관계 설정 박스 */}
            <div className="pt-2 border-t border-border/40">
              <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5 mb-1.5">
                {getRelationIcon(char.relationships || "")}
                주요 인물 관계 및 서사 고리
              </span>
              <div className="p-2.5 rounded-xl bg-background/50 border border-border text-xs leading-relaxed text-foreground/90">
                {char.relationships ? (
                  char.relationships
                ) : (
                  <span className="text-muted-foreground italic">
                    등록된 구체적 인물 관계가 없습니다. 설정에서 추가해보세요.
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
