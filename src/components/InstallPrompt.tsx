import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(isInStandaloneMode);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if user already dismissed the prompt
    const dismissed = localStorage.getItem('install-prompt-dismissed');
    
    if (!isInStandaloneMode && !dismissed) {
      if (iOS) {
        // Show iOS instructions after a delay
        setTimeout(() => setShowPrompt(true), 3000);
      } else {
        // Handle Android/Desktop
        const handler = (e: Event) => {
          e.preventDefault();
          setDeferredPrompt(e as BeforeInstallPromptEvent);
          setShowPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
          window.removeEventListener('beforeinstallprompt', handler);
        };
      }
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('install-prompt-dismissed', 'true');
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <Card className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 p-4 shadow-lg z-50 bg-card border-border">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Download className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">앱 설치하기</h3>
          </div>
          
          {isIOS ? (
            <p className="text-sm text-muted-foreground mb-3">
              Safari 공유 버튼 
              <span className="inline-block mx-1 px-2 py-0.5 bg-secondary rounded text-xs">⬆️</span>
              을 눌러 "홈 화면에 추가"를 선택하세요.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mb-3">
              AI Pal을 홈 화면에 설치하여 빠르게 접근하세요.
            </p>
          )}

          {!isIOS && deferredPrompt && (
            <Button 
              onClick={handleInstallClick}
              className="w-full"
              size="sm"
            >
              지금 설치하기
            </Button>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};
