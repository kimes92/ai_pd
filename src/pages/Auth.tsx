import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, Sparkles, BookOpen } from 'lucide-react';
import { z } from 'zod';

const usernameSchema = z.string()
  .min(3, '아이디는 최소 3자 이상이어야 합니다')
  .max(20, '아이디는 최대 20자까지 가능합니다')
  .regex(/^[a-zA-Z0-9]+$/, '아이디는 영문자와 숫자만 사용 가능합니다');

const passwordSchema = z.string()
  .min(6, '비밀번호는 최소 6자 이상이어야 합니다')
  .max(50, '비밀번호는 최대 50자까지 가능합니다');

const Auth = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('demouser');
  const [password, setPassword] = useState('password123');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

  const passwordMismatch = activeTab === 'signup' && confirmPassword.length > 0 && password !== confirmPassword;

  useEffect(() => {
    // 세션이 이미 존재하면 바로 메인 대시보드(/)로 이동
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        navigate('/', { replace: true });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate('/', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async () => {
    try {
      usernameSchema.parse(username);
      passwordSchema.parse(password);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setIsLoading(true);
    
    try {
      const email = `${username}@ainote.local`;
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          // 계정이 없으면 자동으로 회원가입 후 로그인 시도
          await autoSignUpAndLogin(email, password, username);
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('로그인 성공!');
        navigate('/', { replace: true });
      }
    } catch (error) {
      toast.error('로그인 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  // 자동 가입 및 로그인 처리 헬퍼
  const autoSignUpAndLogin = async (email: string, pass: string, uname: string) => {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: pass,
    });

    if (signUpError) {
      toast.error('로그인 실패: 아이디 또는 비밀번호를 확인해주세요');
      return;
    }

    if (signUpData.user) {
      // 프로필 생성 (옵션)
      await (supabase as any).from('profiles').upsert({
        id: signUpData.user.id,
        username: uname,
        onboarding_completed: true,
      });

      toast.success('새 계정이 자동 생성되어 로그인되었습니다!');
      navigate('/', { replace: true });
    }
  };

  const handleSignup = async () => {
    try {
      usernameSchema.parse(username);
      passwordSchema.parse(password);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    if (password !== confirmPassword) {
      toast.error('비밀번호가 일치하지 않습니다');
      return;
    }

    setIsLoading(true);
    
    try {
      const email = `${username}@ainote.local`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          toast.error('이미 사용 중인 아이디입니다');
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (data.user) {
        await (supabase as any).from('profiles').upsert({
          id: data.user.id,
          username: username,
          onboarding_completed: true,
        });

        toast.success('회원가입 완료!');
        navigate('/', { replace: true });
      }
    } catch (error) {
      toast.error('회원가입 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  // 1-클릭 데모 체험 로그인
  const handleDemoLogin = async () => {
    setIsLoading(true);
    const demoEmail = 'demo@novelai.local';
    const demoPass = 'demopass123';

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPass,
      });

      if (error) {
        // 데모 계정이 없으면 생성
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: demoEmail,
          password: demoPass,
        });

        if (signUpErr && !signUpErr.message.includes('User already registered')) {
          toast.error('체험 로그인 실패: ' + signUpErr.message);
          return;
        }

        if (signUpData?.user) {
          await (supabase as any).from('profiles').upsert({
            id: signUpData.user.id,
            username: 'demo_user',
            onboarding_completed: true,
          });
        }

        // 재로그인
        await supabase.auth.signInWithPassword({
          email: demoEmail,
          password: demoPass,
        });
      }

      toast.success('체험 계정으로 로그인되었습니다!');
      navigate('/', { replace: true });
    } catch (err) {
      console.error(err);
      toast.error('체험 로그인 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'login') {
      handleLogin();
    } else {
      handleSignup();
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass-card border-purple-500/20 shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/30 mb-1">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-extrabold gradient-text">NovelAI Studio</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            AI 소설 집필 어시스턴트에 오신 것을 환영합니다
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 1-클릭 체험 로그인 버튼 */}
          <Button
            type="button"
            onClick={handleDemoLogin}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-5 rounded-xl shadow-lg shadow-purple-900/30 gap-2 text-sm"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BookOpen className="h-4 w-4" />
            )}
            ⚡ 1초 만에 바로 체험해보기 (클릭)
          </Button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-border"></div>
            <span className="flex-shrink mx-3 text-[11px] text-muted-foreground">또는 기존 계정 사용</span>
            <div className="flex-grow border-t border-border"></div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'signup')}>
            <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
              <TabsTrigger value="login" className="text-xs">로그인</TabsTrigger>
              <TabsTrigger value="signup" className="text-xs">회원가입</TabsTrigger>
            </TabsList>
            
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">아이디</label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="영문자, 숫자 (예: demoUser)"
                  autoComplete="username"
                  disabled={isLoading}
                  className="bg-background/50 text-xs h-9"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">비밀번호</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호 6자 이상"
                    autoComplete={activeTab === 'login' ? 'current-password' : 'new-password'}
                    disabled={isLoading}
                    className="bg-background/50 text-xs h-9 pr-8"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-2 text-muted-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {activeTab === 'signup' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">비밀번호 확인</label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="비밀번호 다시 입력"
                      autoComplete="new-password"
                      disabled={isLoading}
                      className={`bg-background/50 text-xs h-9 pr-8 ${passwordMismatch ? 'border-destructive' : ''}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-2 text-muted-foreground"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  {passwordMismatch && (
                    <p className="text-[11px] text-destructive">비밀번호가 일치하지 않습니다</p>
                  )}
                </div>
              )}

              <TabsContent value="login" className="mt-2">
                <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs h-9" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '로그인'}
                </Button>
              </TabsContent>

              <TabsContent value="signup" className="mt-2">
                <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs h-9" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '회원가입'}
                </Button>
              </TabsContent>
            </form>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
