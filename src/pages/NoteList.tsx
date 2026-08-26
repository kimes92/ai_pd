import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Globe, Lock, Loader2, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Note {
  id: string;
  title: string;
  content: string;
  note_date: string;
  category: string | null;
  is_public: boolean;
  user_id: string;
  created_at: string;
}

const NoteList = () => {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<Note[]>([]);
  const [publicNotes, setPublicNotes] = useState<Note[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"my" | "public">("my");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      // Fetch user's interests
      const { data: profile } = await supabase.from("profiles").select("interests").eq("id", user.id).single();

      if (profile?.interests) {
        setInterests(profile.interests);
      }

      // Fetch user's own notes
      const { data: myNotes, error: myError } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (myError) throw myError;
      setNotes(myNotes || []);

      // Fetch public notes from other users
      const { data: pubNotes, error: pubError } = await supabase
        .from("notes")
        .select("*")
        .eq("is_public", true)
        .neq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (pubError) throw pubError;
      setPublicNotes(pubNotes || []);
    } catch (error) {
      console.error("Failed to fetch notes:", error);
      toast.error("노트를 불러오는데 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredNotes = (activeTab === "my" ? notes : publicNotes).filter((note) => {
    if (!selectedCategory) return true;
    return note.category === selectedCategory;
  });

  const allCategories = [
    ...new Set([
      ...interests,
      ...(notes.map((n) => n.category).filter(Boolean) as string[]),
      ...(publicNotes.map((n) => n.category).filter(Boolean) as string[]),
    ]),
  ];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-medium">내 노트</h1>
        <Button variant="ghost" size="icon" onClick={() => navigate("/ai-note")}>
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === "my"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("my")}
        >
          내 노트 ({notes.length})
        </button>
        <button
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === "public"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("public")}
        >
          공개 노트 ({publicNotes.length})
        </button>
      </div>

      {/* Category Filter */}
      <div className="p-3 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          <Badge
            variant={selectedCategory === null ? "default" : "outline"}
            className="cursor-pointer whitespace-nowrap"
            onClick={() => setSelectedCategory(null)}
          >
            전체
          </Badge>
          {allCategories.map((category) => (
            <Badge
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              className="cursor-pointer whitespace-nowrap"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Badge>
          ))}
        </div>
      </div>

      {/* Notes List */}
      <div className="flex-1 p-4 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <p className="text-sm">{activeTab === "my" ? "작성한 노트가 없습니다" : "공개된 노트가 없습니다"}</p>
            {activeTab === "my" && (
              <Button variant="link" className="mt-2" onClick={() => navigate("/ai-note")}>
                새 노트 작성하기
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className="p-4 bg-card border border-border rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/note/${note.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-foreground truncate flex-1">{note.title}</h3>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {note.is_public ? (
                          <Globe className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        )}

                        {/* 작성자 본인일 경우 바로 에디터로 넘어가는 수정 버튼 표시 */}
                        {note.user_id === currentUserId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 ml-1 text-muted-foreground hover:text-foreground hover:bg-secondary"
                            onClick={(e) => {
                              e.stopPropagation(); // 카드 전체 클릭 이벤트(상세페이지 이동)를 방지
                              navigate(`/notes/edit/${note.id}`);
                            }}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{truncateContent(note.content)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  {note.category && (
                    <Badge variant="secondary" className="text-xs">
                      {note.category}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{formatDate(note.note_date)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NoteList;
