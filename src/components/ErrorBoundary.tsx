import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Home, AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught React Error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
          <div className="max-w-md w-full glass-card p-8 rounded-2xl border border-purple-500/30 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h2 className="text-xl font-bold text-foreground">화면 표시 중 오류가 발생했습니다</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              페이지를 불러오는 도중 일시적인 문제가 발생했습니다. 아래 버튼을 눌러 새로고침하거나 메인 화면으로 돌아가실 수 있습니다.
            </p>

            {this.state.error && (
              <div className="p-3 rounded-lg bg-black/40 border border-border text-left overflow-x-auto text-[11px] text-rose-300/80 font-mono">
                {this.state.error.message}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="flex-1 text-xs gap-1.5 border-border"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                새로고침
              </Button>
              <Button
                onClick={this.handleReset}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5"
              >
                <Home className="w-3.5 h-3.5" />
                메인 화면으로
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
