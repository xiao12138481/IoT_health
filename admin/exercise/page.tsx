'use client';

/**
 * 管理员步行追踪页面
 * 功能描述：
 * - 查看当前选中人员的步行数据
 * - 支持人员切换（管理员独有功能）
 * - 显示步数统计、步行距离与趋势
 */

import { Footprints } from 'lucide-react';
import { useApp } from '@/components/layout/app-provider';
import { Header } from '@/components/layout/header';
import { WalkingSummary } from '@/components/exercise/walking-summary';

export default function AdminExercisePage() {
  /*读取管理员当前选中的人员供步行组件查询数据*/
  const { persons, currentPersonId, setCurrentPersonId, alarmCount } = useApp();

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <Header
        persons={persons}
        currentPersonId={currentPersonId}
        onPersonChange={setCurrentPersonId}
        alarmCount={alarmCount}
      />

      <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-cyan-50 p-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Footprints className="h-7 w-7 text-emerald-600" />
            步行追踪管理
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            管理员可切换监测对象，查看原来的步数、步行距离与步行趋势页面。
          </p>
        </div>

        <WalkingSummary personId={currentPersonId} />
      </div>
    </div>
  );
}
