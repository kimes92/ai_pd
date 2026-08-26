import { useState, useRef, KeyboardEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Keyboard, Plus, Trash2, Pencil, Check, X, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  useShortcuts,
  expandTrailingTrigger,
  expandLastWord,
  type Shortcut,
} from "@/hooks/useShortcuts";

export const ShortcutsDialog = () => {
  const { shortcuts, map, upsert, remove, loading } = useShortcuts();
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState("");
  const [expansion, setExpansion] = useState("");
  const [editing, setEditing] = useState<Shortcut | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [testText, setTestText] = useState("");
  const [lastEvent, setLastEvent] = useState<string>("");
  const testRef = useRef<HTMLTextAreaElement>(null);

  const handleTestChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    const expanded = expandTrailingTrigger(v, map);
    if (expanded !== v) {
      const m = v.slice(0, -1).match(/(\S+)$/);
      if (m) setLastEvent(`스페이스 펼침: ${m[1]} → ${map.get(m[1])}`);
    }
    setTestText(expanded);
  };

  const handleTestKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const m = testText.match(/(\S+)$/);
      const expanded = expandLastWord(testText, map);
      if (m && map.get(m[1])) {
        setLastEvent(`엔터 펼침: ${m[1]} → ${map.get(m[1])}`);
      } else if (m) {
        setLastEvent(`매칭 없음: "${m[1]}" 는 사전에 없음 (엔터 = 줄바꿈)`);
      } else {
        setLastEvent("엔터 (빈 줄)");
      }
      setTestText(expanded + "\n");
      setTimeout(() => {
        const ta = testRef.current;
        if (ta) {
          ta.focus();
          const end = ta.value.length;
          ta.setSelectionRange(end, end);
        }
      }, 0);
    }
  };

  const reset = () => {
    setTrigger("");
    setExpansion("");
    setEditing(null);
  };

  const handleSave = async () => {
    const t = trigger.trim();
    if (!t || !expansion) {
      toast.error("약어와 펼칠 내용을 모두 입력하세요");
      return;
    }
    if (/\s/.test(t)) {
      toast.error("약어에는 공백을 넣을 수 없습니다");
      return;
    }
    const { error } = await upsert(t, expansion, editing?.id);
    if (error) {
      toast.error("저장 실패: " + error.message);
      return;
    }
    toast.success(editing ? "수정되었습니다" : "추가되었습니다");
    reset();
  };

  const startEdit = (s: Shortcut) => {
    setEditing(s);
    setTrigger(s.trigger);
    setExpansion(s.expansion);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="단축어 사전">
          <Keyboard className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>단축어 사전</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-xs text-muted-foreground">
            약어 입력 후 <b>스페이스</b> 또는 <b>엔터</b>를 누르면 자동으로 펼쳐집니다.
          </p>

          <div className="grid grid-cols-[110px_1fr_auto] gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">약어</Label>
              <Input
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                placeholder="rh"
                maxLength={32}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">펼칠 내용</Label>
              <Input
                value={expansion}
                onChange={(e) => setExpansion(e.target.value)}
                placeholder="Rhino3D"
              />
            </div>
            <Button size="icon" onClick={handleSave} title={editing ? "수정 저장" : "추가"}>
              {editing ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
          {editing && (
            <Button variant="ghost" size="sm" onClick={reset} className="gap-1">
              <X className="h-3.5 w-3.5" /> 편집 취소
            </Button>
          )}

          <div className="border-t border-border pt-2 max-h-[40vh] overflow-y-auto">
            {loading && shortcuts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">불러오는 중...</p>
            ) : shortcuts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                등록된 단축어가 없습니다
              </p>
            ) : (
              <ul className="space-y-1">
                {shortcuts.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/50 text-sm"
                  >
                    <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono shrink-0">
                      {s.trigger}
                    </code>
                    <span className="text-muted-foreground shrink-0">→</span>
                    <span className="flex-1 truncate">{s.expansion}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => startEdit(s)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={async () => {
                        const { error } = await remove(s.id);
                        if (error) toast.error("삭제 실패");
                        else toast.success("삭제됨");
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 실시간 테스트 모드 */}
          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1">
                <FlaskConical className="h-3.5 w-3.5" /> 실시간 테스트 모드
              </Label>
              <Button
                variant={testMode ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  setTestMode((v) => !v);
                  setLastEvent("");
                  setTestText("");
                }}
              >
                {testMode ? "끄기" : "켜기"}
              </Button>
            </div>
            {testMode && (
              <>
                <p className="text-xs text-muted-foreground">
                  여기에 직접 타이핑해서 스페이스/엔터 즉시 펼침을 확인하세요. (AI 교정 X)
                </p>
                <Textarea
                  ref={testRef}
                  value={testText}
                  onChange={handleTestChange}
                  onKeyDown={handleTestKeyDown}
                  placeholder={`예: ${shortcuts[0]?.trigger ?? "rh"} 를 친 뒤 스페이스`}
                  className="min-h-[100px] text-sm"
                  autoFocus
                />
                <div className="text-xs px-2 py-1.5 rounded bg-muted/60 font-mono min-h-[26px]">
                  {lastEvent || "대기 중..."}
                </div>
                <div className="text-xs text-muted-foreground">
                  로드된 사전: <b>{map.size}</b>개
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};