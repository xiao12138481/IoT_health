'use client';

import { Footprints } from 'lucide-react';
import { useApp } from '@/components/layout/app-provider';
import { Header } from '@/components/layout/header';
import { WalkingSummary } from '@/components/exercise/walking-summary';

export default function ExercisePage() {
  /*读取当前选中的人员供步行组件查询数据*/
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
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-cyan-50 p-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Footprints className="h-7 w-7 text-emerald-600" />
            步行追踪
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            保留原来的步行与步数分析，并作为独立页面继续使用。
          </p>
        </div>

        <WalkingSummary personId={currentPersonId} />
      </div>
    </div>
  );
}
