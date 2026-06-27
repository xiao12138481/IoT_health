'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/layout/auth-provider';

/**
 * 根页面组件
 * 功能描述：
 * - 根据用户登录状态自动重定向
 * - 未登录用户重定向到登录页
 * - 管理员重定向到 /admin
 * - 普通用户重定向到 /user
 */
export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    // 等待身份验证状态加载完成
    if (isLoading) return;

    if (!user) {
      // 未登录用户重定向到登录页
      router.push('/login');
    } else if (user.role === 'admin') {
      // 管理员重定向到管理员界面
      router.push('/admin');
    } else {
      // 普通用户重定向到用户界面
      router.push('/user');
    }
  }, [user, isLoading, router]);

  // 显示加载状态
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent mx-auto" />
        <p className="text-sm text-muted-foreground">正在跳转...</p>
      </div>
    </div>
  );
}
