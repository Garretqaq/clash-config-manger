"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, User, RefreshCw, Shield, ArrowRight, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, login, checkAuth } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [captchaSvg, setCaptchaSvg] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requireCaptcha, setRequireCaptcha] = useState(false);

  useEffect(() => {
    // If already authenticated, redirect to nodes page
    if (!isLoading && isAuthenticated) {
      router.replace("/nodes");
    }
  }, [isAuthenticated, isLoading, router]);

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
      router.replace("/nodes");
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
          <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-400/30 via-indigo-400/30 to-purple-400/30 dark:from-blue-600/20 dark:via-indigo-600/20 dark:to-purple-600/20 rounded-full blur-3xl animate-[spin_15s_linear_infinite]"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-cyan-400/30 via-blue-400/30 to-indigo-400/30 dark:from-cyan-600/20 dark:via-blue-600/20 dark:to-indigo-600/20 rounded-full blur-3xl animate-[spin_20s_linear_infinite_reverse]"></div>
      </div>

      {/* Glass card container */}
      <div className="relative w-full max-w-md">
        {/* Floating decoration elements */}
        <div className="absolute -top-10 -left-10 w-20 h-20 bg-blue-500/20 dark:bg-blue-400/10 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-purple-500/20 dark:bg-purple-400/10 rounded-full blur-2xl animate-pulse delay-1000"></div>

        {/* Main glass card */}
        <div className="relative backdrop-blur-2xl bg-white/30 dark:bg-slate-900/50 rounded-3xl shadow-2xl border border-white/40 dark:border-slate-700/50 p-8 transition-all duration-300 hover:shadow-blue-500/20 hover:shadow-3xl">
          {/* Sparkle icon decoration */}
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 p-3 rounded-2xl shadow-lg shadow-blue-500/50">
            <Shield className="w-6 h-6 text-white" />
          </div>

          {/* Header */}
          <div className="text-center mt-4 mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent mb-2 font-[family-name:var(--font-heading)]">
              欢迎回来
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm font-[family-name:var(--font-body)]">
              登录到您的配置管理系统
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50/70 dark:bg-red-950/40 border border-red-200/60 dark:border-red-800/40 backdrop-blur-sm animate-in slide-in-from-top-2 duration-300">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium text-center">
                {error}
              </p>
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username input */}
            <div className="space-y-2">
              <label 
                htmlFor="username" 
                className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                用户名
              </label>
              <div className="relative group">
                <Input
                  id="username"
                  type="text"
                  placeholder="请输入用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-4 pr-4 py-3 rounded-xl bg-white/30 dark:bg-slate-800/40 border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm transition-all duration-200 focus:bg-white/50 dark:focus:bg-slate-800/60 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100"
                  required
                  autoComplete="username"
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/0 via-indigo-500/0 to-purple-500/0 group-focus-within:from-blue-500/10 group-focus-within:via-indigo-500/10 group-focus-within:to-purple-500/10 transition-all duration-300 pointer-events-none"></div>
              </div>
            </div>

            {/* Password input */}
            <div className="space-y-2">
              <label 
                htmlFor="password" 
                className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2"
              >
                <Lock className="w-4 h-4" />
                密码
              </label>
              <div className="relative group">
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-4 pr-4 py-3 rounded-xl bg-white/30 dark:bg-slate-800/40 border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm transition-all duration-200 focus:bg-white/50 dark:focus:bg-slate-800/60 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100"
                  required
                  autoComplete="current-password"
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/0 via-indigo-500/0 to-purple-500/0 group-focus-within:from-blue-500/10 group-focus-within:via-indigo-500/10 group-focus-within:to-purple-500/10 transition-all duration-300 pointer-events-none"></div>
              </div>
            </div>

            {/* Captcha section */}
            {requireCaptcha && (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                <label 
                  htmlFor="captcha" 
                  className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  验证码
                </label>
                <div className="flex gap-2">
                  <div className="relative group flex-1">
                    <Input
                      id="captcha"
                      type="text"
                      placeholder="请输入验证码"
                      value={captchaCode}
                      onChange={(e) => setCaptchaCode(e.target.value.toUpperCase())}
                      className="w-full pl-4 pr-4 py-3 rounded-xl bg-white/30 dark:bg-slate-800/40 border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm transition-all duration-200 focus:bg-white/50 dark:focus:bg-slate-800/60 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100 uppercase tracking-widest"
                      maxLength={4}
                      required
                      autoComplete="off"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={fetchCaptcha}
                    className="px-4 py-3 rounded-xl bg-white/30 dark:bg-slate-800/40 border-slate-200/50 dark:border-slate-700/50 hover:bg-white/50 dark:hover:bg-slate-800/60 transition-all duration-200 cursor-pointer backdrop-blur-sm"
                    title="刷新验证码"
                  >
                    <RefreshCw className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                  </Button>
                </div>
                {captchaSvg && (
                  <div className="mt-3 flex justify-center animate-in fade-in duration-300">
                    <div
                      className="bg-white/30 dark:bg-slate-800/60 rounded-xl overflow-hidden shadow-lg border border-slate-200/50 dark:border-slate-700/50 p-2 backdrop-blur-sm"
                      dangerouslySetInnerHTML={{ __html: atob(captchaSvg) }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Submit button */}
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 dark:from-blue-500 dark:to-indigo-500 dark:hover:from-blue-600 dark:hover:to-indigo-600 text-white font-medium shadow-lg shadow-blue-500/50 hover:shadow-xl hover:shadow-blue-500/60 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg group mt-6 cursor-pointer"
            >
              <span className="flex items-center justify-center gap-2">
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    登录中...
                  </>
                ) : (
                  <>
                    登录
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                  </>
                )}
              </span>
            </Button>
          </form>

          {/* Footer decoration */}
          <div className="mt-8 pt-6 border-t border-slate-200/30 dark:border-slate-700/30">
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              请妥善保管您的登录凭证
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
