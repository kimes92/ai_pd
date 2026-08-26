import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ChatRecord {
  timestamp: string;
  message: string;
  response: string;
}

const ChatHistory = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<ChatRecord[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('chat_history');
    if (stored) {
      setHistory(JSON.parse(stored));
    }
  }, []);

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold">대화 기록</h1>
      </div>
      <div className="space-y-4">
        {history.length === 0 ? (
          <p className="text-muted-foreground">대화 기록이 없습니다.</p>
        ) : (
          history.map((record, index) => (
            <Card key={index} className="p-4">
              <div className="text-sm text-muted-foreground mb-2">
                {new Date(record.timestamp).toLocaleString('ko-KR')}
              </div>
              <div className="space-y-2">
                <div>
                  <strong>질문:</strong> {record.message}
                </div>
                <div>
                  <strong>답변:</strong> {record.response}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatHistory;
