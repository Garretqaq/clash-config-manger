"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, User, RefreshCw, LayoutDashboard, ArrowRight, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [captchaSvg, setCaptchaSvg] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requireCaptcha, setRequireCaptcha] = useState(false);

  // Get redirect URL from query params or default to /nodes
  const callbackUrl = searchParams.get("callbackUrl") || "/nodes";

  useEffect(() => {
    // If already authenticated, redirect to callback URL or nodes page
    if (!isLoading && isAuthenticated) {
      router.replace(callbackUrl);
    }
  }, [isAuthenticated, isLoading, router, callbackUrl]);

  const fetchCaptcha = async () => {
    try {
      const response = await fetch("/api/auth/captcha");
      const data = await response.json();
      setCaptchaId(data.captchaId);
      setCaptchaSvg(data.svg);
    } catch (error) {
      console.error("Failed to fetch captcha:", error);
      setError("验证码加载失败，请重试");
    }
  };

  useEffect(() => {
    if (requireCaptcha && !captchaId) {
      fetchCaptcha();
    }
  }, [requireCaptcha]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(username, password, requireCaptcha ? captchaId : undefined, requireCaptcha ? captchaCode : undefined);
      // Redirect to callback URL or default to /nodes
      router.replace(callbackUrl);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "登录失败";
      
      // Check if we need to show captcha
      if (errorMessage.includes("验证码")) {
        setRequireCaptcha(true);
        if (!captchaId) {
          await fetchCaptcha();
        }
        setCaptchaCode("");
      }
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return null; // Or a simple spinner
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      {/* Background Pattern */}
      <div className="absolute inset-0 z-0 bg-dot-pattern opacity-50 pointer-events-none" />
      
      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="bg-primary/10 p-3 rounded-2xl mb-4">
            <LayoutDashboard className="w-8 h-8 text-primary" />
          </div>
        </div>

        <Card className="glass-strong border-muted/50 shadow-2xl">
          <CardHeader className="text-center pt-10 pb-6">
            <CardTitle className="text-2xl font-bold tracking-tight">
              Clash Config Manager
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              登录以管理您的节点和订阅配置
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder="请输入用户名"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-9 bg-background/50"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    placeholder="请输入密码"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 bg-background/50"
                    required
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {requireCaptcha && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <Label htmlFor="captcha">验证码</Label>
                  <div className="flex gap-2">
                    <Input
                      id="captcha"
                      placeholder="验证码"
                      value={captchaCode}
                      onChange={(e) => setCaptchaCode(e.target.value.toUpperCase())}
                      className="bg-background/50 uppercase tracking-widest"
                      maxLength={4}
                      required
                    />
                    <div 
                      className="h-10 rounded-md overflow-hidden border bg-background/50 cursor-pointer min-w-[100px] flex items-center justify-center relative group"
                      onClick={fetchCaptcha}
                      title="点击刷新"
                    >
                      {captchaSvg ? (
                         <div 
                           dangerouslySetInnerHTML={{ __html: atob(captchaSvg) }} 
                           className="w-full h-full flex items-center justify-center scale-90"
                         />
                      ) : (
                        <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
                      )}
                      <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <RefreshCw className="h-3 w-3 text-foreground/50" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full mt-6" 
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    登录中...
                  </span>
                ) : (
                  <span className="flex items-center">
                    登录系统
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
          
          <CardFooter className="flex justify-center border-t border-muted/50 pt-6">
             <p className="text-xs text-muted-foreground">
               Clash Config Manager &copy; {new Date().getFullYear()}
             </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
