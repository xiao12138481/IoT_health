'use client';

/**
 * 管理员血压监测页面
 * 功能描述：
 * - 查看被监测人员的血压数据
 * - 支持人员切换（管理员独有）
 * - 支持血压趋势图表缩放和拖动
 */

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/layout/app-provider';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useZoomableTimeChart } from '@/hooks/use-zoomable-time-chart';
import { Activity, TrendingUp, TrendingDown, Info } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

/*血压健康记录数据类型*/
interface HealthRecord {
  systolic_bp: number | null;
  diastolic_bp: number | null;
  recorded_at: string;
}

/*血压仪表板响应数据类型*/
interface DashboardResponse {
  latestBloodPressure: {
    systolic_bp: number | null;
    diastolic_bp: number | null;
    recorded_at: string;
  } | null;
}

/*血压趋势数据点类型*/
interface BloodPressureTrendPoint {
  x: number;
  time: string;
  axisLabel: string;
  fullTime: string;
  systolic: number | null;
  diastolic: number | null;
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

/*数值限制函数*/
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function AdminBloodPressurePage() {
  const { persons, currentPersonId, setCurrentPersonId, alarmCount } = useApp();
  /*页面核心数据状态*/
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [currentBloodPressure, setCurrentBloodPressure] = useState<DashboardResponse['latestBloodPressure']>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'1d' | '3d' | '7d'>('1d');

  /*加载管理员当前选中人员的血压数据*/
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
          `/api/health-records?person_id=${currentPersonId}&type=blood_pressure&start=${start.toISOString()}&end=${end.toISOString()}&limit=1000`,
          { cache: 'no-store' }
        ),
      ]);
      const dashboardData: DashboardResponse = await dashboardRes.json();
      const recordsData: { records?: HealthRecord[] } = await recordsRes.json();

      setCurrentBloodPressure(dashboardData.latestBloodPressure ?? null);
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

  /*整理血压双折线图数据*/
  const chartData = useMemo<BloodPressureTrendPoint[]>(() => {
    return [...records]
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
      .map((record) => {
        const timestamp = new Date(record.recorded_at).getTime();
        return {
          x: timestamp,
          time: new Date(record.recorded_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          axisLabel: formatAxisTime(timestamp, range),
          fullTime: new Date(record.recorded_at).toLocaleString('zh-CN'),
          systolic: record.systolic_bp,
          diastolic: record.diastolic_bp,
        };
      });
  }, [records, range]);

  const {
    overlayRef: interactionOverlayRef,
    zoomRange,
    isPanning,
    hoveredPoint,
    resetZoom,
    overlayProps,
  } = useZoomableTimeChart(chartData);

  /*切换人员或时间范围时重置图表缩放*/
  useEffect(() => {
    resetZoom();
  }, [currentPersonId, range, resetZoom]);

  const latest = currentBloodPressure ?? (records.length > 0 ? records[0] : null);
  const avgSystolic = records.length > 0 
    ? Math.round(records.reduce((s, r) => s + (r.systolic_bp || 0), 0) / records.length) 
    : null;
  const avgDiastolic = records.length > 0 
    ? Math.round(records.reduce((s, r) => s + (r.diastolic_bp || 0), 0) / records.length) 
    : null;
  const maxSystolic = records.length > 0 
    ? Math.max(...records.map((r) => r.systolic_bp || 0)) 
    : null;
  const minSystolic = records.length > 0 
    ? Math.min(...records.map((r) => r.systolic_bp || 0)) 
    : null;

  /*按血压标准划分当前数据类别*/
  const categories = [
    { label: '正常', condition: (s: number, d: number) => s < 120 && d < 80, color: '#22C55E' },
    { label: '偏高', condition: (s: number, d: number) => s >= 120 && s < 130 && d < 80, color: '#EAB308' },
    { label: '高血压1期', condition: (s: number, d: number) => (s >= 130 && s < 140) || (d >= 80 && d < 90), color: '#F97316' },
    { label: '高血压2期', condition: (s: number, d: number) => s >= 140 || d >= 90, color: '#EF4444' },
  ];

  const latestCategory = latest 
    ? categories.find(c => c.condition(latest.systolic_bp || 0, latest.diastolic_bp || 0)) 
    : null;

  return (
    <div className="flex flex-col">
      <Header
        persons={persons.map((p) => ({ id: p.id, name: p.name }))}
        currentPersonId={currentPersonId}
        onPersonChange={setCurrentPersonId}
        alarmCount={alarmCount}
      />

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="h-7 w-7 text-purple-500" />
              血压监测
            </h2>
            <p className="text-sm text-muted-foreground mt-1">收缩压/舒张压历史趋势分析（管理员视图）</p>
          </div>
          <div className="flex gap-2">
            {(['1d', '3d', '7d'] as const).map((r) => (
              <Button
                key={r}
                variant={range === r ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRange(r)}
                className={range === r ? 'bg-purple-500 hover:bg-purple-600' : ''}
              >
                {r === '1d' ? '24小时' : r === '3d' ? '3天' : '7天'}
              </Button>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: '当前血压', value1: latest?.systolic_bp, value2: latest?.diastolic_bp, unit: 'mmHg', icon: Activity, color: 'text-purple-600' },
            { label: '平均收缩压', value1: avgSystolic, unit: 'mmHg', icon: TrendingUp, color: 'text-blue-600' },
            { label: '最高收缩压', value1: maxSystolic, unit: 'mmHg', icon: TrendingUp, color: 'text-red-600' },
            { label: '最低收缩压', value1: minSystolic, unit: 'mmHg', icon: TrendingDown, color: 'text-green-600' },
          ].map((stat, idx) => (
            <Card key={idx}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  {stat.value1 !== null && stat.value1 !== undefined && (
                    <span className={`text-2xl font-bold tabular-nums ${stat.color}`}>
                      {stat.value1}
                    </span>
                  )}
                  {stat.value2 !== null && stat.value2 !== undefined && (
                    <>
                      <span className="text-lg text-muted-foreground">/</span>
                      <span className={`text-xl font-bold tabular-nums ${stat.color}`}>
                        {stat.value2}
                      </span>
                    </>
                  )}
                  <span className="text-xs text-muted-foreground">{stat.unit}</span>
                </div>
                {idx === 0 && latestCategory && (
                  <Badge 
                    className="mt-2" 
                    style={{ backgroundColor: latestCategory.color }}
                  >
                    {latestCategory.label}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">血压趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'relative h-80 overscroll-contain select-none',
                isPanning ? 'cursor-grabbing' : 'cursor-default'
              )}
              onDoubleClick={resetZoom}
            >
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="systolicGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#9333EA" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#9333EA" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="diastolicGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
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
                    <YAxis domain={[50, 180]} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <Tooltip
                      contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                      formatter={(value: number, name: string) => [
                        `${value} mmHg`, 
                        name === 'systolic' ? '收缩压' : '舒张压'
                      ]}
                      labelFormatter={(_label, payload) => {
                        const point = payload?.[0]?.payload as { fullTime?: string } | undefined;
                        return point?.fullTime ?? '';
                      }}
                    />
                    <ReferenceLine y={140} stroke="#EF4444" strokeDasharray="6 3" label={{ value: '高压', position: 'right', fill: '#EF4444', fontSize: 11 }} />
                    <ReferenceLine y={90} stroke="#F97316" strokeDasharray="6 3" label={{ value: '低压', position: 'right', fill: '#F97316', fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="systolic"
                      stroke="#9333EA"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, fill: '#9333EA', strokeWidth: 2, stroke: '#fff' }}
                      name="systolic"
                    />
                    <Line
                      type="monotone"
                      dataKey="diastolic"
                      stroke="#7C3AED"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#7C3AED', strokeWidth: 2, stroke: '#fff' }}
                      name="diastolic"
                    />
                  </LineChart>
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
                  时间：{hoveredPoint.fullTime}，收缩压：<span className="font-semibold text-slate-900">{hoveredPoint.systolic ?? '--'} mmHg</span>，舒张压：<span className="font-semibold text-slate-900">{hoveredPoint.diastolic ?? '--'} mmHg</span>
                </span>
              ) : (
                <span>将鼠标移动到趋势图上可查看该时间点的详细血压数据。</span>
              )}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              在图表区域滚动鼠标滚轮可缩放时间窗口，左键按住可左右拖动时间窗，双击可重置到全局视图。
            </p>
          </CardContent>
        </Card>

        {/* Info card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Info className="h-5 w-5 text-slate-500" />
              血压分级参考
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: '正常', range: '收缩压 < 120 且 舒张压 < 80', color: '#22C55E' },
                { label: '血压偏高', range: '120 ≤ 收缩压 < 130 且 舒张压 < 80', color: '#EAB308' },
                { label: '高血压1期', range: '130 ≤ 收缩压 < 140 或 80 ≤ 舒张压 < 90', color: '#F97316' },
                { label: '高血压2期', range: '收缩压 ≥ 140 或 舒张压 ≥ 90', color: '#EF4444' },
              ].map((item, idx) => (
                <div key={idx} className="p-4 rounded-lg" style={{ backgroundColor: `${item.color}15` }}>
                  <span className="text-sm font-bold" style={{ color: item.color }}>
                    {item.label}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">{item.range}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
