import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Trash2, MapPin, Mic } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import CameraCapture from '@/components/CameraCapture';
import VoiceRecorder from '@/components/VoiceRecorder';
import ChatMessage from '@/components/ChatMessage';
import { InstallPrompt } from '@/components/InstallPrompt';
import { useStreamingChat } from '@/hooks/useStreamingChat';
import { toast } from 'sonner';

const Index = () => {
  const [input, setInput] = useState('');
  const [voiceMode, setVoiceMode] = useState<'idle' | 'recording'>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, isLoading, sendMessage, clearMessages } = useStreamingChat();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Location error:', error);
        }
      );
    }
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const messageText = input;
    setInput('');
    
    const locationContext = location 
      ? `\n[현재 위치: 위도 ${location.lat.toFixed(4)}, 경도 ${location.lng.toFixed(4)}]`
      : '';
    
    await sendMessage(messageText + locationContext);
  };

  const handleImageCapture = async (imageData: string) => {
    await sendMessage('이 이미지를 분석해주세요', imageData);
  };

  const handleVoiceUpdate = (text: string) => {
    setLiveTranscript(text);
  };

  const handleModeChange = (mode: 'idle' | 'recording') => {
    setVoiceMode(mode);
    if (mode === 'idle') {
      setLiveTranscript('');
    }
  };

  const handleRecordingStop = async (fullText: string) => {
    if (fullText.trim()) {
      // 음성 변환 완료 후 자동으로 AI에게 전송
      await sendMessage(fullText);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <InstallPrompt />
        
        <div className="flex-1 flex flex-col">
          {/* Header - 컴팩트 */}
          <header className="border-b border-primary/20 bg-card/50 backdrop-blur-lg sticky top-0 z-10">
            <div className="container mx-auto px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <span className="text-lg">🤖</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    AI 비서
                  </h1>
                </div>
                {location && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                  </span>
                )}
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMessages}
                className="text-muted-foreground hover:text-foreground h-8 px-2"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 container mx-auto px-3 py-3 max-w-3xl flex flex-col">
            {/* 상단 컨트롤 영역 - 카메라 + 음성 */}
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <CameraCapture onCapture={handleImageCapture} />
              <VoiceRecorder
                onTranscriptUpdate={handleVoiceUpdate}
                onModeChange={handleModeChange}
                onRecordingStop={handleRecordingStop}
              />
            </div>

            {/* 실시간 음성 인식 표시 */}
            {voiceMode === 'recording' && liveTranscript && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-3">
                <div className="flex items-start gap-2">
                  <Mic className="w-4 h-4 text-destructive mt-0.5 animate-pulse" />
                  <p className="text-sm text-foreground flex-1">
                    {liveTranscript}
                  </p>
                </div>
              </div>
            )}

            {/* Chat Messages */}
            <div className="flex-1 space-y-3 mb-3 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">👋</div>
                  <h2 className="text-xl font-bold mb-1 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    안녕하세요!
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    음성, 카메라, 또는 텍스트로 대화해보세요
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <ChatMessage
                    key={idx}
                    role={msg.role}
                    content={msg.content}
                    image={msg.image}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Text Input - 하단 고정 */}
            <div className="sticky bottom-0 bg-background/95 backdrop-blur-lg border-t border-primary/20 pt-3 pb-2 -mx-3 px-3">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="메시지를 입력하세요..."
                  disabled={isLoading}
                  className="flex-1 bg-card border-primary/20 focus:border-primary h-10"
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="h-10 w-10"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;