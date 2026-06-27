'use client';

/**
 * 用户步行追踪页面
 * 功能描述：
 * - 查看当前用户的步行数据
 * - 使用WalkingSummary组件展示步数统计、步行距离与趋势
 */

import { Footprints } from 'lucide-react';
import { useApp } from '@/components/layout/app-provider';
import { UserHeader } from '@/components/layout/user-header';
import { WalkingSummary } from '@/components/exercise/walking-summary';

export default function UserExercisePage() {
  /*读取当前用户编号供步行组件查询数据*/
  const { currentPersonId } = useApp();

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <UserHeader />

      <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-cyan-50 p-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Footprints className="h-7 w-7 text-emerald-600" />
            步行追踪
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            保留原来的步数、距离、卡路里和步行趋势分析，单独作为步行页面使用。
          </p>
        </div>

        <WalkingSummary personId={currentPersonId} />
      </div>
    </div>
  );
}
