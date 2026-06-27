'use client';

import { UserSidebar } from '@/components/layout/user-sidebar';
import { UserHeader } from '@/components/layout/user-header';

/**
 * 用户界面布局组件
 * 功能描述：
 * 1. 提供用户界面的整体布局结构
 * 2. 包含侧边栏和主内容区域
 * 3. 确保用户界面的一致性
 */
export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* 侧边栏 */}
      <UserSidebar />
      {/* 主内容区域 */}
      <main className="ml-60 flex-1">
        {/* 用户头部组件（如果需要的话） */}
        {children}
      </main>
    </div>
  );
}