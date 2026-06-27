'use client';

/**
 * 管理员血氧监测页面
 * 功能描述：
 * - 查看被监测人员的血氧数据
 * - 支持人员切换（管理员独有）
 * - 查看血氧趋势和分布数据
 */

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/layout/app-provider';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useZoomableTimeChart } from '@/hooks/use-zoomable-time-chart';
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

/*血氧健康记录数据类型*/
interface HealthRecord {
  blood_oxygen: number | null;
  recorded_at: string;
}

/*血氧仪表板响应数据类型*/
interface DashboardResponse {
  latestRecord: {
    blood_oxygen: number | null;
    recorded_at: string;
  } | null;
}

/*时间轴格式化函数*/
function formatAxisTime(timestamp: number, range: '1d' | '3d' | '7d') {
  const date = new Date(timestamp);
  if (range === '1d') {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  if (range === '3d') {
    return date.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  });
}

export default function AdminBloodOxygenPage() {
  const { persons, currentPersonId, setCurrentPersonId, alarmCount } = useApp();
  /*页面核心数据状态*/
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [currentBloodOxygen, setCurrentBloodOxygen] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'1d' | '3d' | '7d'>('1d');

  /*加载管理员当前选中人员的血氧数据*/
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

  /*页面加载和切换人员后自动刷新数据*/
  useEffect(() => {
    if (!currentPersonId) return;

    loadData();
    const timer = setInterval(() => {
      void loadData(false);
    }, 5000);

    return () => clearInterval(timer);
  }, [currentPersonId, range]);

  /*整理血氧折线图数据*/
  const chartData = useMemo(() => records
    .map((record) => {
      const timestamp = new Date(record.recorded_at).getTime();
      return {
        x: timestamp,
        time: new Date(record.recorded_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        axisLabel: formatAxisTime(timestamp, range),
        fullTime: new Date(record.recorded_at).toLocaleString('zh-CN'),
        value: record.blood_oxygen,
      };
    })
    .sort((a, b) => a.x - b.x), [records, range]);
  const {
    overlayRef: interactionOverlayRef,
    zoomRange,
    isPanning,
    hoveredPoint,
    resetZoom,
    overlayProps,
  } = useZoomableTimeChart(chartData);

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
            <p className="text-sm text-muted-foreground mt-1">血氧饱和度(SpO2)实时监测与历史趋势（管理员视图）</p>
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
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg font-semibold">血氧趋势</CardTitle>
              <button
                type="button"
                onClick={resetZoom}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-50"
              >
                重置缩放
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'relative h-80 overscroll-contain select-none',
                isPanning ? 'cursor-grabbing' : 'cursor-default',
              )}
              onDoubleClick={resetZoom}
            >
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
                    <XAxis
                      type="number"
                      dataKey="x"
                      scale="time"
                      domain={zoomRange ? [zoomRange.startX, zoomRange.endX] : ['dataMin', 'dataMax']}
                      allowDataOverflow
                      tick={{ fontSize: 11, fill: '#94A3B8' }}
                      minTickGap={range === '1d' ? 24 : 42}
                      tickMargin={10}
                      tickFormatter={(value: number) => formatAxisTime(value, range)}
                    />
                    <YAxis domain={[85, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <Tooltip
                      contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                      formatter={(value: number) => [`${value}%`, '血氧']}
                      labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullTime || ''}
                    />
                    <ReferenceLine y={95} stroke="#EF4444" strokeDasharray="6 3" label={{ value: '下限 95%', position: 'right', fill: '#EF4444', fontSize: 11 }} />
                    <Area type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} fill="url(#spo2Grad)" animationDuration={600} dot={false} activeDot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
              <div
                ref={interactionOverlayRef}
                className="absolute inset-0 z-10"
                {...overlayProps}
              />
            </div>
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {hoveredPoint ? (
                <span>
                  时间：{hoveredPoint.fullTime}，血氧：<span className="font-semibold text-slate-900">{hoveredPoint.value ?? '--'}%</span>
                </span>
              ) : (
                <span>将鼠标移动到趋势图上可查看该时间点的详细血氧数据。</span>
              )}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              在图表区域滚动鼠标滚轮可缩放时间窗口，左键按住可左右拖动时间窗，双击或点击“重置缩放”可回到全局视图。
            </p>
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
