import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Edit, Trash2, Globe, Lock, Loader2 } from "lucide-react";
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
  updated_at: string;
}

const NoteDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchNote();
    }
  }, [id]);

  const fetchNote = async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Fetch the note
      const { data: noteData, error } = await supabase.from("notes").select("*").eq("id", id).single();

      if (error) throw error;
      if (!noteData) {
        toast.error("노트를 찾을 수 없습니다");
        navigate("/notes");
        return;
      }

      setNote(noteData);
      setIsOwner(user?.id === noteData.user_id);
    } catch (error) {
      console.error("Failed to fetch note:", error);
      toast.error("노트를 불러오는데 실패했습니다");
      navigate("/notes");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("notes").delete().eq("id", id);

      if (error) throw error;

      toast.success("노트가 삭제되었습니다");
      navigate("/notes");
    } catch (error) {
      console.error("Failed to delete note:", error);
      toast.error("삭제에 실패했습니다");
    } finally {
      setIsDeleting(false);
    }
  };

  // 명조체 마커 파싱 및 렌더링
  const renderContentWithMyungjo = (content: string) => {
    const regex = /\[명\]([\s\S]*?)\[\/명\]/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`} className="whitespace-pre-wrap text-foreground leading-relaxed">
            {content.substring(lastIndex, match.index)}
          </span>,
        );
      }
      parts.push(
        <div
          key={`myungjo-${match.index}`}
          className="text-center font-serif my-4 py-2 whitespace-pre-wrap text-foreground leading-relaxed"
        >
          {match[1]}
        </div>,
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-${lastIndex}`} className="whitespace-pre-wrap text-foreground leading-relaxed">
          {content.substring(lastIndex)}
        </span>,
      );
    }

    return parts.length > 0 ? (
      parts
    ) : (
      <div className="whitespace-pre-wrap text-foreground leading-relaxed">{content}</div>
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!note) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate("/notes")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          {note.is_public ? (
            <Globe className="h-4 w-4 text-primary" />
          ) : (
            <Lock className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">{note.is_public ? "공개" : "비공개"}</span>
        </div>
        {isOwner && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              // 팝업 띄우는 대신 AI Note 작성 페이지(수정 모드)로 이동
              onClick={() => navigate(`/notes/edit/${note.id}`)}
            >
              <Edit className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="h-5 w-5 text-destructive" />
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground mb-2">{note.title}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {note.category && <Badge variant="secondary">{note.category}</Badge>}
            <span className="text-sm text-muted-foreground">{formatDate(note.note_date)}</span>
          </div>
        </div>

        <div className="prose prose-sm max-w-none">{renderContentWithMyungjo(note.content)}</div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>노트를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>이 작업은 되돌릴 수 없습니다. 노트가 영구적으로 삭제됩니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default NoteDetail;
