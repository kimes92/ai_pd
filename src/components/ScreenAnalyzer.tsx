import { useState, useRef, useEffect } from 'react';
import { Monitor, MonitorOff, Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { screenCapture } from '@/utils/screenCapture';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

interface ScreenAnalyzerProps {
  onAnalyze: (text: string, image: string) => void;
  isAnalyzing: boolean;
}

const ScreenAnalyzer = ({ onAnalyze, isAnalyzing }: ScreenAnalyzerProps) => {
  const isMobile = useIsMobile();
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [countdown, setCountdown] = useState<number | null>(3);
  const [autoStartCancelled, setAutoStartCancelled] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Auto-start countdown for desktop
  useEffect(() => {
    if (!isMobile && !autoStartCancelled && countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (!isMobile && !autoStartCancelled && countdown === 0) {
      setCountdown(null);
      handleStartCapture();
    }
  }, [countdown, isMobile, autoStartCancelled]);

  useEffect(() => {
    return () => {
      if (isCapturing) {
        screenCapture.stopCapture();
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isCapturing, isRecording]);

  const handleStartCapture = async () => {
    const success = await screenCapture.startCapture();
    if (success) {
      setIsCapturing(true);
      const stream = screenCapture.getPreviewStream();
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
      }
      toast.success('화면 공유가 시작되었습니다');
    }
  };

  const handleStopCapture = () => {
    screenCapture.stopCapture();
    setIsCapturing(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    toast.info('화면 공유가 종료되었습니다');
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await convertAudioToText(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success('음성 녹음이 시작되었습니다');
    } catch (error) {
      console.error('Recording error:', error);
      toast.error('마이크 권한이 필요합니다');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const convertAudioToText = async (audioBlob: Blob) => {
    try {
      toast.info('음성을 텍스트로 변환 중...');
      
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-to-text`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ audio: base64Audio }),
          }
        );

        if (!response.ok) throw new Error('Transcription failed');

        const data = await response.json();
        const text = data.text;
        
        setTranscript(text);
        toast.success('음성 인식 완료!');

        // Capture screen and analyze
        if (isCapturing) {
          const image = await screenCapture.captureFrame();
          if (image) {
            onAnalyze(text, image);
          }
        } else {
          toast.warning('화면 공유를 먼저 시작해주세요');
        }
      };
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error('음성 인식에 실패했습니다');
    }
  };

  // Mobile not supported UI
  if (isMobile) {
    return (
      <Card className="p-8 text-center bg-card/50 backdrop-blur-sm border-primary/20">
        <div className="text-6xl mb-4">🚫</div>
        <h3 className="text-xl font-bold mb-2">모바일 버전은 지원하지 않습니다</h3>
        <p className="text-muted-foreground mb-6">데스크탑 환경에서 이용해주세요</p>
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm font-semibold mb-2">📱 모바일 전용 기능:</p>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>• 📸 카메라 AI</p>
            <p>• 🎤 음성 AI</p>
          </div>
        </div>
      </Card>
    );
  }

  // Countdown UI
  if (countdown !== null && countdown > 0) {
    return (
      <Card className="p-8 text-center bg-card/50 backdrop-blur-sm border-primary/20">
        <div className="text-6xl mb-4">⏱️</div>
        <h3 className="text-2xl font-bold mb-2">{countdown}초 후 화면 분석 시작...</h3>
        <p className="text-muted-foreground mb-6">화면 공유 권한을 요청합니다</p>
        <Button
          variant="outline"
          onClick={() => {
            setAutoStartCancelled(true);
            setCountdown(null);
          }}
        >
          취소
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Screen Preview */}
      {isCapturing && (
        <Card className="p-4 bg-card/50 backdrop-blur-sm border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <p className="text-sm text-muted-foreground">화면 공유 활성화됨</p>
          </div>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-h-[200px] rounded-lg object-cover bg-black"
          />
        </Card>
      )}

      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={isCapturing ? handleStopCapture : handleStartCapture}
          variant={isCapturing ? "destructive" : "default"}
          disabled={isAnalyzing}
        >
          {isCapturing ? (
            <>
              <MonitorOff className="w-4 h-4 mr-2" />
              화면 공유 중지
            </>
          ) : (
            <>
              <Monitor className="w-4 h-4 mr-2" />
              화면 공유 시작
            </>
          )}
        </Button>

        <Button
          onClick={isRecording ? handleStopRecording : handleStartRecording}
          variant={isRecording ? "destructive" : "secondary"}
          disabled={!isCapturing || isAnalyzing}
        >
          {isRecording ? (
            <>
              <MicOff className="w-4 h-4 mr-2" />
              녹음 중지
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 mr-2" />
              음성 질문
            </>
          )}
        </Button>

        {isAnalyzing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            분석 중...
          </div>
        )}
      </div>

      {/* Status Messages */}
      {isCapturing && !isRecording && !isAnalyzing && (
        <Card className="p-4 bg-muted/50 border-primary/20">
          <p className="text-sm text-muted-foreground text-center">
            💬 음성 버튼을 눌러 질문하면 AI가 현재 화면을 분석하여 답변합니다
          </p>
        </Card>
      )}
      
      {isRecording && (
        <Card className="p-4 bg-amber-500/10 border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <p className="text-sm font-medium">질문 듣는 중...</p>
          </div>
        </Card>
      )}
      
      {isAnalyzing && (
        <Card className="p-4 bg-primary/10 border-primary/20">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-sm font-medium">AI가 화면을 분석하고 있습니다...</p>
          </div>
        </Card>
      )}

      {/* Last Transcript */}
      {transcript && (
        <Card className="p-3 bg-muted">
          <p className="text-sm text-muted-foreground">마지막 질문:</p>
          <p className="text-sm font-medium">{transcript}</p>
        </Card>
      )}
    </div>
  );
};

export default ScreenAnalyzer;
