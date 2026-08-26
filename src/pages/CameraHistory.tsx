import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CameraRecord {
  timestamp: string;
  image: string;
  result: string;
}

const CameraHistory = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<CameraRecord[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('camera_history');
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
        <h1 className="text-3xl font-bold">카메라 분석 기록</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {history.length === 0 ? (
          <p className="text-muted-foreground col-span-full">카메라 분석 기록이 없습니다.</p>
        ) : (
          history.map((record, index) => (
            <Card key={index} className="p-4">
              <div className="text-sm text-muted-foreground mb-2">
                {new Date(record.timestamp).toLocaleString('ko-KR')}
              </div>
              <img 
                src={record.image} 
                alt="분석된 이미지" 
                className="w-full h-48 object-cover rounded-lg mb-3"
              />
              <div className="text-sm whitespace-pre-wrap">
                {record.result}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default CameraHistory;
