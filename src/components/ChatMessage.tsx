import { Bot, User } from 'lucide-react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
}

const ChatMessage = ({ role, content, image }: ChatMessageProps) => {
  const isUser = role === 'user';

  return (
    <div className="flex gap-3 mb-6 w-full">
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-primary/10' : 'bg-gradient-to-br from-primary/20 to-accent/20'
      }`}>
        {isUser ? (
          <User className="w-4 h-4 text-primary" />
        ) : (
          <Bot className="w-4 h-4 text-primary" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground mb-1">
          {isUser ? '사용자' : 'Rhino3D AI 튜터'}
        </div>
        
        <div className="text-foreground/90">
          {image && (
            <img 
              src={image} 
              alt="Captured" 
              className="rounded-lg mb-3 max-w-full h-auto border border-border"
            />
          )}
          <p className="whitespace-pre-wrap break-words leading-relaxed">{content}</p>
        </div>
        
        <div className="text-xs text-muted-foreground mt-2">
          {new Date().toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
