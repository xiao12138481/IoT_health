'use client';

/**
 * 用户专项运动训练页面
 * 功能描述：
 * - 展示由模拟程序推送的专项运动数据
 * - 用户端仅展示数据，不提供手动手环控制或录入操作
 */

import { Activity } from 'lucide-react';
import { useApp } from '@/components/layout/app-provider';
import { UserHeader } from '@/components/layout/user-header';
import { ExerciseSummary } from '@/components/dashboard/exercise-summary';

export default function UserSportTrainingPage() {
  /*读取当前用户编号供专项运动组件查询数据*/
  const { currentPersonId } = useApp();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <UserHeader />

      <div className="mx-auto w-full max-w-7xl space-y-4 p-4 lg:p-5">
        <div className="rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-cyan-50 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                <Activity className="h-7 w-7 text-violet-600" />
                专项运动
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                用户端仅展示由模拟程序推送的专项运动数据，不再提供手动手环控制或录入操作。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:w-[280px]">
              <div className="rounded-xl bg-white/80 p-3">
                <p className="text-xs text-muted-foreground">展示模式</p>
                <p className="mt-1 font-semibold text-slate-900">模拟同步</p>
              </div>
              <div className="rounded-xl bg-white/80 p-3">
                <p className="text-xs text-muted-foreground">刷新节奏</p>
                <p className="mt-1 font-semibold text-slate-900">约 3 秒</p>
              </div>
            </div>
          </div>
        </div>

        <ExerciseSummary personId={currentPersonId} viewMode="readonly" />
      </div>
    </div>
  );
}
