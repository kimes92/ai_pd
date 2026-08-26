import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
}

interface AnalysisResult {
  brand: string;
  shape: string;
  storeName: string;
  address: string;
  text: string;
  productInfo: string;
}

const CameraCapture = ({ onCapture }: CameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const autoAnalyzeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      setStream(mediaStream);
      setIsActive(true);
      toast.success('카메라가 활성화되었습니다');
    } catch (error) {
      console.error('Camera access error:', error);
      toast.error('카메라 접근 권한이 필요합니다');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsActive(false);
      setAnalysisResult(null);
    }
    if (autoAnalyzeTimerRef.current) {
      clearTimeout(autoAnalyzeTimerRef.current);
      autoAnalyzeTimerRef.current = null;
    }
  };

  const toggleCamera = async () => {
    if (!isExpanded) {
      setIsExpanded(true);
      await startCamera();
    } else {
      stopCamera();
      setIsExpanded(false);
    }
  };

  const captureImage = () => {
    if (!videoRef.current) return null;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg');
      return imageData;
    }
    return null;
  };

  const analyzeImage = async () => {
    const imageData = captureImage();
    if (!imageData) return;

    setIsAnalyzing(true);
    toast.info('이미지 분석 중...');

    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { 
          messages: [{
            role: 'user',
            content: `이 이미지를 분석해주세요. 

다음 카테고리에 해당하는지 확인하고 정보를 찾아주세요:
- 신발, 자동차, 오토바이, 가방 브랜드
- 의류 브랜드
- 매장 (브랜드 매장, 쇼핑몰, 백화점)
- 식당, 카페
- 관광지, 랜드마크

각 항목을 명확하게 구분하여 답변해주세요:
브랜드: 
형태: 
매장명: 
주소: 
텍스트: 
제품 정보:`
          }],
          image: imageData 
        }
      });

      if (error) throw error;

      const response = data.response || '';
      setAnalysisResult({
        brand: extractInfo(response, '브랜드'),
        shape: extractInfo(response, '형태'),
        storeName: extractInfo(response, '매장'),
        address: extractInfo(response, '주소'),
        text: extractInfo(response, '텍스트'),
        productInfo: extractInfo(response, '제품')
      });

      const history = JSON.parse(localStorage.getItem('camera_history') || '[]');
      history.unshift({
        timestamp: new Date().toISOString(),
        image: imageData,
        result: response
      });
      localStorage.setItem('camera_history', JSON.stringify(history.slice(0, 50)));

      toast.success('분석 완료!');
      onCapture(imageData);
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('분석 중 오류가 발생했습니다');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const extractInfo = (text: string, keyword: string): string => {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.includes(keyword)) {
        return line.split(':')[1]?.trim() || '정보 없음';
      }
    }
    return '정보 없음';
  };

  const getSearchUrl = (query: string): string => {
    if (!query || query === '정보 없음' || query === '해당없음') return '';
    return `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`;
  };

  const SearchLink = ({ query }: { query: string }) => {
    const url = getSearchUrl(query);
    if (!url) return null;
    
    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="inline-flex ml-2 text-primary hover:text-primary/80 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="w-4 h-4" />
      </a>
    );
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // 축소된 버튼 상태
  if (!isExpanded) {
    return (
      <Button
        onClick={toggleCamera}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <Camera className="h-4 w-4" />
        카메라
        <ChevronDown className="h-3 w-3" />
      </Button>
    );
  }

  // 확장된 카메라 뷰
  return (
    <div className="space-y-3">
      <div className="relative rounded-lg overflow-hidden border border-primary/20 bg-card">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-48 object-cover"
        />
        
        <div className="absolute top-2 right-2">
          <Button
            onClick={toggleCamera}
            variant="secondary"
            size="sm"
            className="h-8 px-2"
          >
            <ChevronUp className="h-4 w-4 mr-1" />
            접기
          </Button>
        </div>
        
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
          <Button
            onClick={stopCamera}
            variant="destructive"
            size="sm"
            disabled={isAnalyzing}
          >
            <CameraOff className="mr-1 h-4 w-4" />
            끄기
          </Button>
          
          <Button
            onClick={analyzeImage}
            size="sm"
            disabled={isAnalyzing}
          >
            {isAnalyzing ? '분석 중...' : '📷 분석'}
          </Button>
        </div>
      </div>

      {analysisResult && (
        <div className="bg-card border border-primary/20 rounded-lg p-3 space-y-2 text-sm">
          <h3 className="font-semibold">분석 결과</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">브랜드:</span>
              <p className="inline-flex items-center ml-1">
                {analysisResult.brand}
                <SearchLink query={analysisResult.brand} />
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">형태:</span>
              <p className="inline-flex items-center ml-1">
                {analysisResult.shape}
              </p>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">제품:</span>
              <p className="inline-flex items-center ml-1">
                {analysisResult.productInfo}
                <SearchLink query={`${analysisResult.brand} ${analysisResult.productInfo}`} />
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraCapture;