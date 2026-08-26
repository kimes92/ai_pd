import { useEffect, useRef } from 'react';

interface VoiceWaveformProps {
  isActive: boolean;
  isSpeaking: boolean;
}

const VoiceWaveform = ({ isActive, isSpeaking }: VoiceWaveformProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Draw waveform
      const bars = 50;
      const barWidth = width / bars;
      
      for (let i = 0; i < bars; i++) {
        const x = i * barWidth;
        let barHeight;
        
        if (isActive || isSpeaking) {
          const intensity = isSpeaking ? 1.5 : 0.8;
          barHeight = Math.sin(phase + i * 0.3) * 30 * intensity + 
                     Math.random() * 20 * intensity;
        } else {
          barHeight = 5;
        }

        const gradient = ctx.createLinearGradient(0, centerY - barHeight, 0, centerY + barHeight);
        gradient.addColorStop(0, 'hsl(217, 91%, 60%)');
        gradient.addColorStop(0.5, 'hsl(188, 95%, 60%)');
        gradient.addColorStop(1, 'hsl(263, 70%, 50%)');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, centerY - barHeight / 2, barWidth - 2, barHeight);
      }

      phase += 0.1;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isActive, isSpeaking]);

  return (
    <div className="w-full h-32 flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={800}
        height={128}
        className="w-full h-full"
        style={{ filter: 'drop-shadow(0 0 20px hsl(217 91% 60% / 0.5))' }}
      />
    </div>
  );
};

export default VoiceWaveform;
