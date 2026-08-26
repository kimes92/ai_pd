import { useState } from "react";
import { type CharacterInfo } from "@/hooks/useStoryContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp, Trash2, User } from "lucide-react";

interface CharacterCardProps {
  character: CharacterInfo;
  index: number;
  onUpdate: (index: number, character: CharacterInfo) => void;
  onDelete: (index: number) => void;
}

export function CharacterCard({ character, index, onUpdate, onDelete }: CharacterCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleChange = (field: keyof CharacterInfo, value: string) => {
    onUpdate(index, { ...character, [field]: value });
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden border border-border">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-3.5 bg-white/5">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-3 text-left flex-1"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {character.name ? character.name.charAt(0) : <User className="w-4 h-4" />}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              {character.name || `인물 ${index + 1}`}
            </h4>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {character.personality || character.background || "인물 정보를 설정해주세요"}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onDelete(index)}
            className="h-8 w-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 text-muted-foreground"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* 펼쳐진 상세 입력 폼 */}
      {isExpanded && (
        <div className="p-4 space-y-3 border-t border-border bg-background/30 animate-in slide-in-from-top-2 duration-200">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">인물 이름</label>
            <Input
              value={character.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="예: 김영희"
              className="text-xs h-9 bg-background/50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">외모 / 나이 / 직업</label>
              <Input
                value={character.appearance}
                onChange={(e) => handleChange("appearance", e.target.value)}
                placeholder="예: 20대 후반, 검은 단발머리, 기자"
                className="text-xs h-9 bg-background/50"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">말투 / 어조</label>
              <Input
                value={character.speechStyle}
                onChange={(e) => handleChange("speechStyle", e.target.value)}
                placeholder="예: 직설적이고 도도한 반말"
                className="text-xs h-9 bg-background/50"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">성격 및 동기</label>
            <Textarea
              value={character.personality}
              onChange={(e) => handleChange("personality", e.target.value)}
              placeholder="예: 호기심이 강하고 옳다고 믿는 일에는 물러서지 않음"
              className="text-xs h-16 bg-background/50 resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">배경 / 신분 / 과거사</label>
            <Textarea
              value={character.background}
              onChange={(e) => handleChange("background", e.target.value)}
              placeholder="예: 어릴 적 유가족 사건으로 비밀을 추적하게 됨"
              className="text-xs h-16 bg-background/50 resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">타 인물과의 관계</label>
            <Input
              value={character.relationships}
              onChange={(e) => handleChange("relationships", e.target.value)}
              placeholder="예: 철수의 연인이나 비밀을 의심하고 있음"
              className="text-xs h-9 bg-background/50"
            />
          </div>
        </div>
      )}
    </div>
  );
}
