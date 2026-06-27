'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/components/layout/app-provider';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Droplets, TrendingDown, Activity, AlertTriangle } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
} from 'recharts';

interface HealthRecord {
  blood_oxygen: number | null;
  recorded_at: string;
}

interface DashboardResponse {
  latestRecord: {
    blood_oxygen: number | null;
    recorded_at: string;
  } | null;
}

export default function BloodOxygenPage() {
  const { persons, currentPersonId, setCurrentPersonId, alarmCount } = useApp();
  /*页面核心数据状态*/
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [currentBloodOxygen, setCurrentBloodOxygen] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'1d' | '3d' | '7d'>('1d');

  /*加载当前人员的血氧总览和历史记录*/
  async function loadData(showLoading = true) {
    if (!currentPersonId) return;
    if (showLoading) setLoading(true);

    try {
      const end = new Date();
      const start = new Date();
      if (range === '1d') start.setDate(start.getDate() - 1);
      else if (range === '3d') start.setDate(start.getDate() - 3);
      else start.setDate(start.getDate() - 7);

      const [dashboardRes, recordsRes] = await Promise.all([
        fetch(`/api/dashboard?person_id=${currentPersonId}`, { cache: 'no-store' }),
        fetch(
          `/api/health-records?person_id=${currentPersonId}&type=blood_oxygen&start=${start.toISOString()}&end=${end.toISOString()}&limit=1000`,
          { cache: 'no-store' }
        ),
      ]);
      const dashboardData: DashboardResponse = await dashboardRes.json();
      const recordsData: { records?: HealthRecord[] } = await recordsRes.json();

      setCurrentBloodOxygen(dashboardData.latestRecord?.blood_oxygen ?? null);
      setRecords(recordsData.records || []);
    } catch {
      // Silently handle
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  /*页面加载和时间范围切换后自动刷新数据*/
  useEffect(() => {
    if (!currentPersonId) return;

    loadData();
    const timer = setInterval(() => {
      void loadData(false);
    }, 5000);

    return () => clearInterval(timer);
  }, [currentPersonId, range]);

  /*整理血氧折线图数据*/
  const chartData = records.map((r) => ({
    time: new Date(r.recorded_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    value: r.blood_oxygen,
  }));

  const latest = currentBloodOxygen ?? (records.length > 0 ? records[0].blood_oxygen : null);
  const avg = records.length > 0 ? Math.round(records.reduce((s, r) => s + (r.blood_oxygen || 0), 0) / records.length) : null;
  const min = records.length > 0 ? Math.min(...records.map((r) => r.blood_oxygen || 0)) : null;
  const lowCount = records.filter((r) => (r.blood_oxygen || 0) < 95).length;

  /*统计不同血氧区间的分布情况*/
  const distData = [
    { range: '90%以下', count: records.filter((r) => (r.blood_oxygen || 0) < 90).length, fill: '#EF4444' },
    { range: '90-94%', count: records.filter((r) => (r.blood_oxygen || 0) >= 90 && (r.blood_oxygen || 0) < 95).length, fill: '#F97316' },
    { range: '95-97%', count: records.filter((r) => (r.blood_oxygen || 0) >= 95 && (r.blood_oxygen || 0) < 98).length, fill: '#3B82F6' },
    { range: '98-100%', count: records.filter((r) => (r.blood_oxygen || 0) >= 98).length, fill: '#22C55E' },
  ];

  return (
    <div className="flex flex-col">
      <Header persons={persons.map((p) => ({ id: p.id, name: p.name }))} currentPersonId={currentPersonId} onPersonChange={setCurrentPersonId} alarmCount={alarmCount} />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Droplets className="h-7 w-7 text-blue-500" /> 血氧监测
            </h2>
            <p className="text-sm text-muted-foreground mt-1">血氧饱和度(SpO2)实时监测与历史趋势</p>
          </div>
          <div className="flex gap-2">
            {(['1d', '3d', '7d'] as const).map((r) => (
              <Button key={r} variant={range === r ? 'default' : 'outline'} size="sm" onClick={() => setRange(r)} className={range === r ? 'bg-blue-500 hover:bg-blue-600' : ''}>
                {r === '1d' ? '24小时' : r === '3d' ? '3天' : '7天'}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: '当前血氧', value: latest, unit: '%', icon: Droplets, color: 'text-blue-600' },
            { label: '平均血氧', value: avg, unit: '%', icon: Activity, color: 'text-teal-600' },
            { label: '最低血氧', value: min, unit: '%', icon: TrendingDown, color: 'text-orange-600' },
            { label: '低血氧次数', value: lowCount, unit: '次', icon: AlertTriangle, color: 'text-red-600' },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value ?? '--'}</span>
                  <span className="text-xs text-muted-foreground">{stat.unit}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg font-semibold">血氧趋势</CardTitle></CardHeader>
          <CardContent>
            <div className="h-80">
              {loading ? (
                <div className="flex items-center justify-center h-full"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="spo2Grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94A3B8' }} interval="preserveStartEnd" />
                    <YAxis domain={[85, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }} formatter={(value: number) => [`${value}%`, '血氧']} />
                    <ReferenceLine y={95} stroke="#EF4444" strokeDasharray="6 3" label={{ value: '下限 95%', position: 'right', fill: '#EF4444', fontSize: 11 }} />
                    <Area type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} fill="url(#spo2Grad)" animationDuration={600} dot={false} activeDot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg font-semibold">血氧分布</CardTitle></CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickCount={4} />
                  <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }} formatter={(value: number) => [`${value} 次`, '记录数']} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} animationDuration={600}>
                    {distData.map((entry, index) => (
                      <Bar key={index} dataKey="count" fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
