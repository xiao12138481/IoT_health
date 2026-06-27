'use client';

import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { Header } from '@/components/layout/header';

/**
 * 管理员界面布局组件
 * 功能描述：
 * 1. 提供管理员界面的整体布局结构
 * 2. 包含侧边栏和主内容区域
 * 3. 确保管理员界面的一致性
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* 侧边栏 */}
      <AdminSidebar />
      {/* 主内容区域 */}
      <main className="ml-60 flex-1">
        {children}
      </main>
    </div>
  );
}