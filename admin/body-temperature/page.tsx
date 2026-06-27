'use client';

/**
 * 管理员体温监测页面
 * 功能描述：
 * - 查看被监测人员的体温数据
 * - 支持人员切换（管理员独有）
 * - 查看体温趋势和分布数据
 */

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/layout/app-provider';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useZoomableTimeChart } from '@/hooks/use-zoomable-time-chart';
import { Thermometer, TrendingUp, TrendingDown, AlertTriangle, Activity } from 'lucide-react';
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
  Cell,
} from 'recharts';

/*体温健康记录数据类型*/
interface HealthRecord {
  body_temp: number | null;
  recorded_at: string;
}

/*体温仪表板响应数据类型*/
interface DashboardResponse {
  latestRecord: {
    body_temp: number | null;
    recorded_at: string;
  } | null;
  threshold: {
    body_temp_min: string;
    body_temp_max: string;
  } | null;
}

/*判断体温状态函数*/
function getTemperatureStatus(value: number, min: number, max: number) {
  if (value > max) return 'high';
  if (value < min) return 'low';
  return 'normal';
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

export default function AdminBodyTemperaturePage() {
  const { persons, currentPersonId, setCurrentPersonId, alarmCount } = useApp();
  /*页面核心数据状态*/
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [currentBodyTemp, setCurrentBodyTemp] = useState<number | null>(null);
  const [threshold, setThreshold] = useState<{ body_temp_min: string; body_temp_max: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'1d' | '3d' | '7d'>('1d');

  /*加载管理员当前选中人员的体温数据*/
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
          `/api/health-records?person_id=${currentPersonId}&type=body_temp&start=${start.toISOString()}&end=${end.toISOString()}&limit=1000`,
          { cache: 'no-store' }
        ),
      ]);

      const dashboardData: DashboardResponse = await dashboardRes.json();
      const recordsData: { records?: HealthRecord[] } = await recordsRes.json();

      setCurrentBodyTemp(dashboardData.latestRecord?.body_temp ?? null);
      setThreshold(dashboardData.threshold ?? null);
      setRecords(recordsData.records || []);
    } catch {
      setRecords([]);
      setCurrentBodyTemp(null);
      setThreshold(null);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  /*页面加载和切换人员后自动刷新数据*/
  useEffect(() => {
    if (!currentPersonId) return;

    void loadData();
    const timer = setInterval(() => {
      void loadData(false);
    }, 5000);

    return () => clearInterval(timer);
  }, [currentPersonId, range]);

  /*计算当前体温阈值范围*/
  const tempMin = Number(threshold?.body_temp_min ?? '36.0');
  const tempMax = Number(threshold?.body_temp_max ?? '37.3');

  /*整理体温折线图数据*/
  const chartData = useMemo(() => {
    return records.map((record) => ({
      x: new Date(record.recorded_at).getTime(),
      time: new Date(record.recorded_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      axisLabel: formatAxisTime(new Date(record.recorded_at).getTime(), range),
      value: record.body_temp,
      fullTime: new Date(record.recorded_at).toLocaleString('zh-CN'),
    }));
  }, [records, range]);
  const {
    overlayRef: interactionOverlayRef,
    zoomRange,
    isPanning,
    hoveredPoint,
    resetZoom,
    overlayProps,
  } = useZoomableTimeChart(chartData);

  const latest = currentBodyTemp ?? (records.length > 0 ? records[0].body_temp : null);
  const avg = records.length > 0
    ? Number((records.reduce((sum, record) => sum + (record.body_temp || 0), 0) / records.length).toFixed(1))
    : null;
  const min = records.length > 0 ? Math.min(...records.map((record) => record.body_temp || Infinity)) : null;
  const max = records.length > 0 ? Math.max(...records.map((record) => record.body_temp || -Infinity)) : null;
  const abnormalCount = records.filter((record) => {
    const value = record.body_temp;
    return typeof value === 'number' && (value > tempMax || value < tempMin);
  }).length;

  const distributionData = [
    { label: '偏低', count: records.filter((record) => (record.body_temp || 0) < tempMin).length, fill: '#3B82F6' },
    { label: '正常', count: records.filter((record) => (record.body_temp || 0) >= tempMin && (record.body_temp || 0) <= tempMax).length, fill: '#22C55E' },
    { label: '偏高', count: records.filter((record) => (record.body_temp || 0) > tempMax && (record.body_temp || 0) < 38).length, fill: '#F97316' },
    { label: '发热', count: records.filter((record) => (record.body_temp || 0) >= 38).length, fill: '#EF4444' },
  ];

  const latestStatus = latest !== null ? getTemperatureStatus(latest, tempMin, tempMax) : 'normal';

  return (
    <div className="flex flex-col">
      <Header
        persons={persons.map((person) => ({ id: person.id, name: person.name }))}
        currentPersonId={currentPersonId}
        onPersonChange={setCurrentPersonId}
        alarmCount={alarmCount}
      />

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Thermometer className="h-7 w-7 text-orange-500" />
              体温监测
            </h2>
            <p className="text-sm text-muted-foreground mt-1">体温实时监测、历史趋势与异常分布分析（管理员视图）</p>
          </div>
          <div className="flex gap-2">
            {(['1d', '3d', '7d'] as const).map((item) => (
              <Button
                key={item}
                variant={range === item ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRange(item)}
                className={range === item ? 'bg-orange-500 hover:bg-orange-600' : ''}
              >
                {item === '1d' ? '24小时' : item === '3d' ? '3天' : '7天'}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: '当前体温', value: latest !== null ? latest.toFixed(1) : '--', unit: '°C', icon: Thermometer, color: 'text-orange-600' },
            { label: '平均体温', value: avg !== null ? avg.toFixed(1) : '--', unit: '°C', icon: Activity, color: 'text-teal-600' },
            { label: '最高体温', value: max !== null ? max.toFixed(1) : '--', unit: '°C', icon: TrendingUp, color: 'text-red-600' },
            { label: '异常次数', value: abnormalCount, unit: '次', icon: AlertTriangle, color: 'text-amber-600' },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value}</span>
                  <span className="text-xs text-muted-foreground">{stat.unit}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">当前状态</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border p-4 bg-slate-50">
                <div>
                  <p className="text-sm text-muted-foreground">当前体温状态</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{latest !== null ? `${latest.toFixed(1)}°C` : '--'}</p>
                </div>
                <div className={`rounded-full px-3 py-1 text-sm font-medium ${
                  latestStatus === 'high'
                    ? 'bg-red-100 text-red-700'
                    : latestStatus === 'low'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                }`}>
                  {latestStatus === 'high' ? '偏高' : latestStatus === 'low' ? '偏低' : '正常'}
                </div>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>正常阈值：{tempMin.toFixed(1)} ~ {tempMax.toFixed(1)} °C</p>
                <p>最低体温：{min !== null && Number.isFinite(min) ? `${min.toFixed(1)} °C` : '--'}</p>
                <p>最高体温：{max !== null && Number.isFinite(max) ? `${max.toFixed(1)} °C` : '--'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg font-semibold">体温趋势</CardTitle>
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
                  <div className="flex items-center justify-center h-full">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F97316" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
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
                      <YAxis domain={[35.5, 39.5]} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                      <Tooltip
                        contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                        formatter={(value: number) => [`${value.toFixed(1)}°C`, '体温']}
                        labelFormatter={(_value, payload) => payload?.[0]?.payload?.fullTime || ''}
                      />
                      <ReferenceLine y={tempMin} stroke="#3B82F6" strokeDasharray="6 3" label={{ value: `下限 ${tempMin.toFixed(1)}°C`, position: 'right', fill: '#3B82F6', fontSize: 11 }} />
                      <ReferenceLine y={tempMax} stroke="#EF4444" strokeDasharray="6 3" label={{ value: `上限 ${tempMax.toFixed(1)}°C`, position: 'right', fill: '#EF4444', fontSize: 11 }} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#F97316"
                        strokeWidth={2}
                        fill="url(#tempGrad)"
                        animationDuration={600}
                        dot={false}
                        activeDot={{ r: 4, fill: '#F97316', strokeWidth: 2, stroke: '#fff' }}
                      />
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
                    时间：{hoveredPoint.fullTime}，体温：<span className="font-semibold text-slate-900">{typeof hoveredPoint.value === 'number' ? `${hoveredPoint.value.toFixed(1)}°C` : '--'}</span>
                  </span>
                ) : (
                  <span>将鼠标移动到趋势图上可查看该时间点的详细体温数据。</span>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                在图表区域滚动鼠标滚轮可缩放时间窗口，左键按住可左右拖动时间窗，双击或点击“重置缩放”可回到全局视图。
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">体温区间分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickCount={4} />
                  <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }} formatter={(value: number) => [`${value} 次`, '记录数']} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} animationDuration={600}>
                    {distributionData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
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
