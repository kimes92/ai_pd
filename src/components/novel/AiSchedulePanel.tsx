import { useState } from "react";
import { AiScheduledTask, AiNote, NovelSettings } from "@/hooks/useStoryContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Calendar, Plus, Trash2, BookText, FileText } from "lucide-react";

interface AiSchedulePanelProps {
  settings: NovelSettings | null;
  onUpdateTasks: (tasks: AiScheduledTask[]) => void;
}

const TASK_TYPES = ["새로운 에피소드 아이디어", "기존 인물간 관계 설정", "빌런 설정", "새로운 인물 구상", "세계관 확장"];
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function AiSchedulePanel({ settings, onUpdateTasks }: AiSchedulePanelProps) {
  const [taskType, setTaskType] = useState(TASK_TYPES[0]);
  const [scheduleTime, setScheduleTime] = useState("14:00");
  const [scheduleDays, setScheduleDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [targetConcept, setTargetConcept] = useState("");

  const tasks = settings?.scheduled_tasks || [];
  const notes = settings?.ai_notes || [];

  const handleToggleDay = (dayIndex: number) => {
    if (scheduleDays.includes(dayIndex)) {
      setScheduleDays(scheduleDays.filter(d => d !== dayIndex));
    } else {
      setScheduleDays([...scheduleDays, dayIndex].sort());
    }
  };

  const handleAddTask = () => {
    if (!targetConcept.trim()) return;
    const newTask: AiScheduledTask = {
      id: `task_${Date.now()}`,
      taskType,
      scheduleDays,
      scheduleTime,
      targetConcept,
    };
    onUpdateTasks([...tasks, newTask]);
    setTargetConcept("");
  };

  const handleRemoveTask = (taskId: string) => {
    onUpdateTasks(tasks.filter(t => t.id !== taskId));
  };

  return (
    <div className="space-y-6">
      {/* Task Creation Form */}
      <div className="bg-background/40 border border-border p-4 rounded-xl space-y-4">
        <h4 className="text-sm font-bold flex items-center gap-2 text-indigo-300">
          <Clock className="w-4 h-4" />
          새로운 예약 작업 추가
        </h4>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">작업 종류</label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="w-full bg-background/50 border border-border rounded-md text-xs p-2 text-foreground"
            >
              {TASK_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">실행 시간 (HH:MM)</label>
            <Input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="bg-background/50 h-8 text-xs"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> 반복 요일
          </label>
          <div className="flex gap-2">
            {DAYS.map((day, idx) => (
              <button
                key={day}
                type="button"
                onClick={() => handleToggleDay(idx)}
                className={`w-8 h-8 rounded-full text-xs font-bold transition-colors ${
                  scheduleDays.includes(idx) 
                    ? "bg-indigo-600 text-white" 
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">세부 지시 (어떤 부분을 구상할까요?)</label>
          <Textarea
            value={targetConcept}
            onChange={(e) => setTargetConcept(e.target.value)}
            placeholder="예: 주인공 카일의 과거 트라우마와 연결되는 빌런을 만들어줘."
            className="bg-background/50 h-16 text-xs resize-none"
          />
        </div>

        <Button
          type="button"
          onClick={handleAddTask}
          disabled={!targetConcept.trim() || scheduleDays.length === 0}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          예약 추가하기
        </Button>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
          <BookText className="w-4 h-4 text-purple-400" />
          현재 예약된 작업 목록 ({tasks.length})
        </h4>
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">예약된 작업이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-start justify-between bg-purple-900/10 border border-purple-500/20 p-3 rounded-lg">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-purple-300">{task.taskType}</span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-200 px-2 py-0.5 rounded-full">
                      {task.scheduleTime} ({task.scheduleDays.map(d => DAYS[d]).join(",")})
                    </span>
                  </div>
                  <p className="text-xs text-foreground/80 line-clamp-2">{task.targetConcept}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveTask(task.id)}
                  className="h-6 w-6 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Note Box */}
      <div className="pt-6 border-t border-border space-y-3">
        <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
          <FileText className="w-4 h-4 text-emerald-400" />
          AI 작성 노트 보관함 ({notes.length})
        </h4>
        <p className="text-[11px] text-muted-foreground">
          AI가 예약된 시간에 작성한 설정들이 이곳에 맥락과 함께 누적 저장됩니다. 메인 에디터에서 자동으로 이 내용들을 참고합니다.
        </p>
        
        {notes.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-border rounded-xl">
            <p className="text-xs text-muted-foreground">아직 작성된 노트가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto novel-scrollbar pr-2">
            {[...notes].reverse().map((note) => (
              <div key={note.id} className="bg-emerald-900/10 border border-emerald-500/20 p-3 rounded-lg space-y-2">
                <div className="flex justify-between items-start">
                  <h5 className="text-xs font-bold text-emerald-300">{note.title}</h5>
                  <span className="text-[10px] text-muted-foreground">{new Date(note.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto novel-scrollbar">
                  {note.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
