'use client';

import { Activity } from 'lucide-react';
import { useApp } from '@/components/layout/app-provider';
import { Header } from '@/components/layout/header';
import { ExerciseSummary } from '@/components/dashboard/exercise-summary';

export default function SportTrainingPage() {
  /*读取当前选中的人员供专项运动组件查询数据*/
  const { persons, currentPersonId, setCurrentPersonId, alarmCount } = useApp();

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <Header
        persons={persons.map((person) => ({ id: person.id, name: person.name }))}
        currentPersonId={currentPersonId}
        onPersonChange={setCurrentPersonId}
        alarmCount={alarmCount}
      />

      <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
        <div className="rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-cyan-50 p-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Activity className="h-7 w-7 text-violet-600" />
            专项运动
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            将新增的四种运动状态能力单独拆为一个页面，与原来的步行页面分开使用。
          </p>
        </div>

        <ExerciseSummary personId={currentPersonId} />
      </div>
    </div>
  );
}
