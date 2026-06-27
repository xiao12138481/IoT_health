'use client';

import { useState } from 'react';
import { Activity, Lock, User as UserIcon, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuth, type User } from '@/components/layout/auth-provider';

/**
 * 登录页面组件
 * 功能描述：提供管理员和普通用户的登录入口
 * 实现方式：使用用户名/密码登录，通过 API 验证身份
 */
export default function LoginPage() {
  const { login } = useAuth();
  /*登录表单状态*/
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  /*提交用户名和密码并请求登录接口*/
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();

      if (!response.ok || !data.user) {
        throw new Error(data.error || '用户名或密码错误');
      }

      login(data.user as User);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-teal-50 to-blue-50">
      <div className="absolute inset-0 bg-grid-slate-900/[0.03] -z-10"></div>
      
      {/* 登录卡片 */}
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="space-y-1 pb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-blue-600">
              <Activity className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center text-slate-900">
            物联网健康监测系统
          </CardTitle>
          <CardDescription className="text-center text-slate-500">
            请输入您的账户信息登录系统
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {/* 用户名输入 */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-slate-700">
                用户名
              </Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="username"
                  type="text"
                  placeholder="请输入用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={cn(
                    "pl-10 h-11 bg-slate-50 border-slate-200",
                    "focus:border-teal-500 focus:ring-teal-500/20"
                  )}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            {/* 密码输入 */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                密码
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(
                    "pl-10 pr-10 h-11 bg-slate-50 border-slate-200",
                    "focus:border-teal-500 focus:ring-teal-500/20"
                  )}
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}

            {/* 登录按钮 */}
            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-medium transition-all duration-200 shadow-lg shadow-teal-500/25"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  登录中...
                </div>
              ) : (
                '登录'
              )}
            </Button>

            {/* 测试账户提示 */}
            <div className="mt-6 pt-6 border-t border-slate-200">
              <p className="text-xs text-center text-slate-500 mb-2">默认管理员账户</p>
              <div className="text-xs">
                <div className="bg-slate-50 p-2 rounded-lg text-center">
                  <p className="font-medium text-slate-700">管理员</p>
                  <p className="text-slate-500">admin / admin123</p>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
