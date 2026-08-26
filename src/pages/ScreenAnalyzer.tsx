import { useRef, useEffect, useState } from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Send } from "lucide-react";
import { useStreamingChat } from "@/hooks/useStreamingChat";
import ScreenAnalyzer from "@/components/ScreenAnalyzer";
import ChatMessage from "@/components/ChatMessage";
import { InstallPrompt } from "@/components/InstallPrompt";
import { screenCapture } from "@/utils/screenCapture";

const ScreenAnalyzerPage = () => {
  const { messages, isLoading, sendMessage, clearMessages } = useStreamingChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleAnalyze = (text: string, image: string) => {
    sendMessage(text, image);
  };

  const handleSendText = async () => {
    if (!input.trim() || isLoading) return;

    const text = input.trim();
    setInput('');

    // Try to capture current screen if available
    const image = await screenCapture.captureFrame();
    
    if (image) {
      sendMessage(text, image);
    } else {
      // Send text only if no screen capture
      sendMessage(text);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        
        <main className="flex-1 flex flex-col">
          {/* Header */}
          <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-background/80 backdrop-blur-sm border-b border-primary/20">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Rhino3D AI 튜터
                </h1>
                <p className="text-xs text-muted-foreground">
                  화면 분석 & 채팅으로 Rhino 배우기
                </p>
              </div>
            </div>
            
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMessages}
                className="text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                대화 초기화
              </Button>
            )}
          </header>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Screen Analyzer Controls */}
            <div className="max-w-4xl mx-auto">
              <ScreenAnalyzer 
                onAnalyze={handleAnalyze}
                isAnalyzing={isLoading}
              />
            </div>

            {/* Chat Messages */}
            {messages.length > 0 && (
              <div className="max-w-4xl mx-auto space-y-4">
                {messages.map((message, index) => (
                  <ChatMessage
                    key={index}
                    role={message.role}
                    content={message.content}
                    image={message.image}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Empty State */}
            {messages.length === 0 && (
              <div className="max-w-4xl mx-auto text-center py-12 space-y-4">
                <div className="text-6xl mb-4">🎓💻</div>
                <h2 className="text-2xl font-bold">Rhino3D AI 튜터</h2>
                <div className="text-muted-foreground space-y-2">
                  <p>Rhino3D의 모든 것을 물어보세요</p>
                  <p>화면 분석도 가능합니다</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-6 mt-6 text-left max-w-2xl mx-auto">
                  <h3 className="font-semibold mb-3">💡 사용 방법</h3>
                  <ol className="space-y-2 text-sm text-muted-foreground">
                    <li>1️⃣ <strong>채팅으로 질문</strong>: 하단 입력창에 Rhino3D 질문 입력</li>
                    <li>2️⃣ <strong>화면 분석</strong>: 화면 공유 후 음성/텍스트로 질문</li>
                    <li>3️⃣ AI가 전문적으로 답변해드립니다</li>
                  </ol>
                  <div className="mt-4 pt-4 border-t border-primary/20">
                    <h4 className="font-semibold text-sm mb-2">✨ 질문 예시</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• "Rhino에서 NURBS 곡선 만드는 법 알려줘"</li>
                      <li>• "Grasshopper 데이터트리가 뭐야?"</li>
                      <li>• "V-Ray 렌더링 설정 최적화 방법은?"</li>
                      <li>• (화면 공유) "이 모델 어떻게 만들어?"</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="sticky bottom-0 bg-background/80 backdrop-blur-sm border-t border-primary/20 p-4">
            <div className="max-w-4xl mx-auto flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Rhino3D 관련 질문을 입력하세요... (화면 공유 중이면 화면 분석도 함께)"
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={handleSendText}
                disabled={!input.trim() || isLoading}
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              💡 화면 공유 중이면 화면과 함께 분석, 아니면 일반 대화
            </p>
          </div>

          <InstallPrompt />
        </main>
      </div>
    </SidebarProvider>
  );
};

export default ScreenAnalyzerPage;
