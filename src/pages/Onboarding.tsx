import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Check } from 'lucide-react';

const INTEREST_OPTIONS = [
  { id: 'religion', label: '종교', emoji: '🙏' },
  { id: 'meeting', label: '회의', emoji: '💼' },
  { id: 'lecture', label: '강의', emoji: '📚' },
  { id: 'diary', label: '일기', emoji: '📔' },
  { id: 'study', label: '학습', emoji: '✏️' },
  { id: 'work', label: '업무', emoji: '💻' },
  { id: 'creative', label: '창작', emoji: '🎨' },
  { id: 'health', label: '건강', emoji: '🏃' },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        navigate('/auth');
      } else {
        setUserId(session.user.id);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate('/auth');
      } else {
        setUserId(session.user.id);
        // Check if already completed onboarding
        checkOnboarding(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkOnboarding = async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', userId)
      .single();

    if (profile?.onboarding_completed) {
      navigate('/');
    }
  };

  const toggleInterest = (interestId: string) => {
    setSelectedInterests(prev => 
      prev.includes(interestId)
        ? prev.filter(id => id !== interestId)
        : [...prev, interestId]
    );
  };

  const handleComplete = async () => {
    if (selectedInterests.length === 0) {
      toast.error('최소 1개 이상의 관심사를 선택해주세요');
      return;
    }

    if (!userId) {
      toast.error('로그인이 필요합니다');
      navigate('/auth');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          interests: selectedInterests,
          onboarding_completed: true,
        })
        .eq('id', userId);

      if (error) throw error;

      toast.success('환영합니다! 노트를 시작해보세요.');
      navigate('/');
    } catch (error) {
      console.error('Failed to save interests:', error);
      toast.error('저장에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!userId) {
      navigate('/auth');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
        })
        .eq('id', userId);

      if (error) throw error;

      navigate('/');
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">관심사 선택</CardTitle>
          <CardDescription>
            어떤 용도로 노트를 사용하시나요?<br />
            맞춤형 서비스를 제공해드립니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {INTEREST_OPTIONS.map((interest) => {
              const isSelected = selectedInterests.includes(interest.id);
              return (
                <button
                  key={interest.id}
                  onClick={() => toggleInterest(interest.id)}
                  className={`
                    relative p-4 rounded-lg border-2 transition-all duration-200
                    flex flex-col items-center gap-2 text-center
                    ${isSelected 
                      ? 'border-primary bg-primary/10 shadow-sm' 
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }
                  `}
                >
                  <span className="text-2xl">{interest.emoji}</span>
                  <span className="font-medium text-sm">{interest.label}</span>
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <Button 
              className="w-full" 
              onClick={handleComplete}
              disabled={isLoading || selectedInterests.length === 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  저장 중...
                </>
              ) : (
                `시작하기 (${selectedInterests.length}개 선택)`
              )}
            </Button>
            <Button 
              variant="ghost" 
              className="w-full text-muted-foreground"
              onClick={handleSkip}
              disabled={isLoading}
            >
              건너뛰기
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
