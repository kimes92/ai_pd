import { toast } from 'sonner';

export interface ScreenCaptureOptions {
  preferredWidth?: number;
  preferredHeight?: number;
  quality?: number;
}

export class ScreenCapture {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;

  async startCapture(options: ScreenCaptureOptions = {}): Promise<boolean> {
    try {
      // Desktop screen sharing only
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: options.preferredWidth || 1920 },
          height: { ideal: options.preferredHeight || 1080 }
        },
        audio: false
      });

      // Create video element to capture frames
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.stream;
      this.videoElement.play();

      return true;
    } catch (error) {
      console.error('Screen capture error:', error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          toast.error('화면 공유 권한이 필요합니다');
        } else if (error.name === 'NotFoundError') {
          toast.error('화면 공유를 사용할 수 없습니다');
        } else {
          toast.error('화면 캡처 중 오류가 발생했습니다');
        }
      }
      return false;
    }
  }

  async captureFrame(quality: number = 0.8): Promise<string | null> {
    if (!this.videoElement || !this.stream) {
      toast.error('화면 공유가 시작되지 않았습니다');
      return null;
    }

    try {
      // Wait for video to be ready
      if (this.videoElement.readyState < 2) {
        await new Promise(resolve => {
          this.videoElement!.addEventListener('loadeddata', resolve, { once: true });
        });
      }

      const canvas = document.createElement('canvas');
      canvas.width = this.videoElement.videoWidth;
      canvas.height = this.videoElement.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      ctx.drawImage(this.videoElement, 0, 0);

      // Convert to base64 with compression
      const imageData = canvas.toDataURL('image/jpeg', quality);
      
      // Check size (limit to 4MB)
      const sizeInMB = (imageData.length * 0.75) / (1024 * 1024);
      if (sizeInMB > 4) {
        toast.warning('이미지가 너무 큽니다. 품질을 낮춰서 재시도합니다.');
        return this.captureFrame(quality * 0.7);
      }

      return imageData;
    } catch (error) {
      console.error('Frame capture error:', error);
      toast.error('화면 캡처 중 오류가 발생했습니다');
      return null;
    }
  }

  stopCapture() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
  }

  isCapturing(): boolean {
    return this.stream !== null && this.stream.active;
  }

  getPreviewStream(): MediaStream | null {
    return this.stream;
  }
}

export const screenCapture = new ScreenCapture();
