import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';
import { AppProvider } from '@/components/layout/app-provider';
import { AuthProvider } from '@/components/layout/auth-provider';

/**
 * 根布局组件
 * 功能描述：
 * - 提供应用程序的整体布局结构
 * - 集成身份验证提供者（AuthProvider）
 * - 集成应用程序提供者（AppProvider）
 * - 设置页面元数据
 */
export const metadata: Metadata = {
  title: {
    default: '物联网健康监测系统',
    template: '%s | 健康监测',
  },
  description: '基于智能手环的物联网健康监测平台，实时监测心率、血氧、睡眠等健康指标',
  keywords: ['健康监测', '物联网', '智能手环', '心率', '血氧', '睡眠分析'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased bg-slate-50">
        {/* 身份验证提供者 - 管理用户登录状态和权限 */}
        <AuthProvider>
          {/* 应用程序提供者 - 管理被监测人员等数据 */}
          <AppProvider>
            {children}
          </AppProvider>
        </AuthProvider>
        {isDev && <Inspector />}
      </body>
    </html>
  );
}
