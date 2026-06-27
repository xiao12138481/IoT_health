'use client';

/**
 * 用户心率监测页面
 * 功能描述：
 * - 查看当前登录用户的实时心率数据
 * - 查看心率历史趋势图表（支持 1天/3天/7天）
 * - 查看心率区间分布统计
 * - 支持图表缩放和拖动交互
 * - 不显示人员切换功能（用户独有）
 */

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/layout/app-provider';
import { UserHeader } from '@/components/layout/user-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useZoomableTimeChart } from '@/hooks/use-zoomable-time-chart';
import { Heart, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

/*健康记录数据类型定义*/
interface HealthRecord {
  id?: number;
  heart_rate: number | null;
  recorded_at: string;
}

/*仪表板响应数据类型*/
interface DashboardResponse {
  latestRecord: {
    heart_rate: number | null;
    recorded_at: string;
  } | null;
}

/*心率区间数据类型*/
interface HeartRateZone {
  label: string;
  rangeText: string;
  hint: string;
  count: number;
  color: string;
  bg: string;
  badge: string;
  percent: number;
}

/*饼图标签属性类型*/
interface PieLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  percent?: number;
  index?: number;
}

/*趋势数据点类型*/
interface TrendPoint {
  x: number;
  y: number;
  time: string;
  axisLabel: string;
  fullTime: string;
}

/**
 * LTTB（Largest Triangle Three Buckets）数据压缩算法
 * 用于在保持图表视觉特征的同时减少数据点数量
 */
/**
 * 最大三角形三桶采样算法
 * 用于在保持数据形状的同时减少数据点数量
 * @param {TrendPoint[]} data - 原始数据点数组
 * @param {number} threshold - 目标采样数量
 * @returns {TrendPoint[]} 采样后的数据点数组
 */
function largestTriangleThreeBuckets(data: TrendPoint[], threshold: number): TrendPoint[] {
  if (threshold >= data.length || threshold === 0) {
    return data;
  }

  const sampled: TrendPoint[] = [];
  const every = (data.length - 2) / (threshold - 2);
  let a = 0;

  sampled.push(data[a]);

  for (let i = 0; i < threshold - 2; i += 1) {
    let avgX = 0;
    let avgY = 0;

    const avgRangeStart = Math.floor((i + 1) * every) + 1;
    const avgRangeEnd = Math.min(Math.floor((i + 2) * every) + 1, data.length);
    const avgRangeLength = Math.max(avgRangeEnd - avgRangeStart, 1);

    for (let idx = avgRangeStart; idx < avgRangeEnd; idx += 1) {
      avgX += data[idx].x;
      avgY += data[idx].y;
    }

    avgX /= avgRangeLength;
    avgY /= avgRangeLength;

    const rangeOffs = Math.floor(i * every) + 1;
    const rangeTo = Math.min(Math.floor((i + 1) * every) + 1, data.length - 1);

    const pointAX = data[a].x;
    const pointAY = data[a].y;

    let maxArea = -1;
    let nextA = rangeOffs;

    for (let idx = rangeOffs; idx < rangeTo; idx += 1) {
      const area = Math.abs(
        (pointAX - avgX) * (data[idx].y - pointAY) -
        (pointAX - data[idx].x) * (avgY - pointAY)
      ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        nextA = idx;
      }
    }

    sampled.push(data[nextA]);
    a = nextA;
  }

  sampled.push(data[data.length - 1]);

  return sampled;
}

// 根据时间范围获取采样大小
/**
 * 根据时间范围获取心率数据采样大小
 * @param {'1d' | '3d' | '7d'} range - 时间范围（1天/3天/7天）
 * @returns {number} 采样点数量
 */
function getHeartRateSampleSize(range: '1d' | '3d' | '7d') {
  if (range === '1d') return 180;
  if (range === '3d') return 220;
  return 260;
}

// 格式化坐标轴时间显示
/**
 * 格式化图表坐标轴时间显示
 * @param {number} timestamp - 时间戳
 * @param {'1d' | '3d' | '7d'} range - 时间范围
 * @returns {string} 格式化后的时间字符串
 */
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

// 数值限制函数
/**
 * 限制数值在指定范围内
 * @param {number} value - 原始数值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 限制后的数值
 */
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function UserHeartRatePage() {
  const { currentPersonId, alarmCount } = useApp();
  /*页面核心数据状态*/
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [currentHeartRate, setCurrentHeartRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'1d' | '3d' | '7d'>('1d');

  /*加载当前用户的心率总览和历史记录*/
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
          `/api/health-records?person_id=${currentPersonId}&type=heart_rate&start=${start.toISOString()}&end=${end.toISOString()}&limit=1000`,
          { cache: 'no-store' }
        ),
      ]);

      const dashboardData: DashboardResponse = await dashboardRes.json();
      const recordsData: { records?: HealthRecord[] } = await recordsRes.json();

      setCurrentHeartRate(dashboardData.latestRecord?.heart_rate ?? null);
      setRecords(recordsData.records || []);
    } catch {
      // 静默处理错误
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  /*页面加载和时间范围切换后自动刷新数据*/
  useEffect(() => {
    if (!currentPersonId) return;

    loadData();
    // 每5秒自动刷新数据
    const timer = setInterval(() => {
      void loadData(false);
    }, 5000);

    return () => clearInterval(timer);
  }, [currentPersonId, range]);

  /*将原始记录转换成图表点位*/
  const rawChartData = useMemo<TrendPoint[]>(() => {
    return [...records]
      .filter((record): record is HealthRecord & { heart_rate: number } => record.heart_rate !== null)
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
      .map((record) => {
        const timestamp = new Date(record.recorded_at).getTime();
        return {
          x: timestamp,
          y: record.heart_rate,
          time: new Date(record.recorded_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          axisLabel: formatAxisTime(timestamp, range),
          fullTime: new Date(record.recorded_at).toLocaleString('zh-CN'),
        };
      });
  }, [records, range]);

  /*使用采样算法压缩图表数据量*/
  const chartData = useMemo(() => {
    return largestTriangleThreeBuckets(
      rawChartData,
      Math.min(getHeartRateSampleSize(range), rawChartData.length)
    ).map((point) => ({
      x: point.x,
      time: point.time,
      axisLabel: point.axisLabel,
      value: point.y,
      fullTime: point.fullTime,
    }));
  }, [rawChartData, range]);
  const {
    overlayRef: interactionOverlayRef,
    zoomRange,
    isPanning,
    hoveredPoint,
    resetZoom,
    overlayProps,
  } = useZoomableTimeChart(chartData);

  // 切换时间范围时重置缩放
  useEffect(() => {
    resetZoom();
  }, [range, resetZoom]);

  // 计算统计数据
  const latestHR = currentHeartRate ?? (records.length > 0 ? records[0].heart_rate : null);
  const avgHR = records.length > 0 ? Math.round(records.reduce((s, r) => s + (r.heart_rate || 0), 0) / records.length) : null;
  const maxHR = records.length > 0 ? Math.max(...records.map((r) => r.heart_rate || 0)) : null;
  const minHR = records.length > 0 ? Math.min(...records.map((r) => r.heart_rate || 0)) : null;

  // 心率区间分布计算
  const zones: HeartRateZone[] = [
    {
      label: '静息',
      rangeText: '< 60 bpm',
      hint: '偏低或安静休息状态',
      count: records.filter((r) => (r.heart_rate || 0) < 60).length,
      color: '#94A3B8',
      bg: 'from-slate-50 to-slate-100',
      badge: 'bg-slate-500/10 text-slate-600',
    },
    {
      label: '正常',
      rangeText: '60 - 100 bpm',
      hint: '日常稳定心率区间',
      count: records.filter((r) => (r.heart_rate || 0) >= 60 && (r.heart_rate || 0) <= 100).length,
      color: '#22C55E',
      bg: 'from-emerald-50 to-green-50',
      badge: 'bg-emerald-500/10 text-emerald-700',
    },
    {
      label: '偏高',
      rangeText: '101 - 120 bpm',
      hint: '活动后或轻度偏高',
      count: records.filter((r) => (r.heart_rate || 0) > 100 && (r.heart_rate || 0) <= 120).length,
      color: '#F97316',
      bg: 'from-orange-50 to-amber-50',
      badge: 'bg-orange-500/10 text-orange-700',
    },
    {
      label: '剧烈',
      rangeText: '> 120 bpm',
      hint: '高强度活动或异常偏快',
      count: records.filter((r) => (r.heart_rate || 0) > 120).length,
      color: '#EF4444',
      bg: 'from-rose-50 to-red-50',
      badge: 'bg-red-500/10 text-red-700',
    },
  ].map((zone) => ({
    ...zone,
    percent: records.length > 0 ? Math.round((zone.count / records.length) * 100) : 0,
  }));

  const dominantZone = zones.reduce<(typeof zones)[number] | null>((current, zone) => {
    if (!current || zone.count > current.count) {
      return zone;
    }
    return current;
  }, null);
  const hasZoneData = zones.some((zone) => zone.count > 0);
  const RADIAN = Math.PI / 180;

  const renderZoneLabel = ({ cx, cy, midAngle, outerRadius, index }: PieLabelProps) => {
    if (
      cx === undefined ||
      cy === undefined ||
      midAngle === undefined ||
      outerRadius === undefined ||
      index === undefined
    ) {
      return null;
    }

    const zone = zones[index];
    if (!zone || zone.count === 0) {
      return null;
    }

    const radius = outerRadius + 24;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const textAnchor = x > cx ? 'start' : 'end';

    return (
      <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central">
        <tspan className="fill-slate-800 text-[12px] font-semibold">{zone.label}</tspan>
        <tspan x={x} dy={16} className="fill-slate-500 text-[11px]">
          {zone.percent}%
        </tspan>
      </text>
    );
  };

  return (
    <div className="flex flex-col">
      {/* 用户头部 - 无人员切换 */}
      <UserHeader />

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Heart className="h-7 w-7 text-red-500" />
              心率监测
            </h2>
            <p className="text-sm text-muted-foreground mt-1">您的实时心率数据与历史趋势分析</p>
          </div>
          <div className="flex gap-2">
            {(['1d', '3d', '7d'] as const).map((r) => (
              <Button
                key={r}
                variant={range === r ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRange(r)}
                className={range === r ? 'bg-red-500 hover:bg-red-600' : ''}
              >
                {r === '1d' ? '24小时' : r === '3d' ? '3天' : '7天'}
              </Button>
            ))}
          </div>
        </div>

        {/* 统计卡片行 */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: '当前心率', value: latestHR, unit: 'bpm', icon: Heart, color: 'text-red-600' },
            { label: '平均心率', value: avgHR, unit: 'bpm', icon: Activity, color: 'text-blue-600' },
            { label: '最高心率', value: maxHR, unit: 'bpm', icon: TrendingUp, color: 'text-orange-600' },
            { label: '最低心率', value: minHR, unit: 'bpm', icon: TrendingDown, color: 'text-teal-600' },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-bold tabular-nums ${stat.color}`}>
                    {stat.value ?? '--'}
                  </span>
                  <span className="text-xs text-muted-foreground">{stat.unit}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 图表区域 */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg font-semibold">心率趋势</CardTitle>
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                  LTTB 压缩 {chartData.length}/{rawChartData.length}
                </div>
                <button
                  type="button"
                  onClick={resetZoom}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-50"
                >
                  重置缩放
                </button>
              </div>
            </div>
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
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
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
                    <YAxis domain={[40, 160]} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <Tooltip
                      contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                      formatter={(value: number) => [`${value} bpm`, '心率']}
                      labelFormatter={(_label, payload) => {
                        const point = payload?.[0]?.payload as { fullTime?: string } | undefined;
                        return point?.fullTime ?? '';
                      }}
                    />
                    <ReferenceLine y={100} stroke="#EF4444" strokeDasharray="6 3" label={{ value: '上限 100', position: 'right', fill: '#EF4444', fontSize: 11 }} />
                    <ReferenceLine y={60} stroke="#F97316" strokeDasharray="6 3" label={{ value: '下限 60', position: 'right', fill: '#F97316', fontSize: 11 }} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#EF4444"
                      strokeWidth={2}
                      fill="url(#hrGrad)"
                      animationDuration={600}
                      dot={false}
                      activeDot={{ r: 4, fill: '#EF4444', strokeWidth: 2, stroke: '#fff' }}
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
                  时间：{hoveredPoint.fullTime}，心率：<span className="font-semibold text-slate-900">{hoveredPoint.value} bpm</span>
                </span>
              ) : (
                <span>将鼠标移动到趋势图上可查看该时间点的详细心率数据。</span>
              )}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              在图表区域滚动鼠标滚轮可缩放时间窗口，左键按住可左右拖动时间窗，双击或点击“重置缩放”可回到全局视图。
            </p>
          </CardContent>
        </Card>

        {/* 心率区间分布 */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg font-semibold">心率区间分布</CardTitle>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                主要区间：{dominantZone?.label ?? '--'}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-white p-4">
              <div className="h-[360px]">
                {hasZoneData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        contentStyle={{ fontSize: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}
                        formatter={(value: number, _name, item) => {
                          const payload = item.payload as HeartRateZone;
                          return [`${value} 条 (${payload.percent}%)`, `${payload.label} ${payload.rangeText}`];
                        }}
                      />
                      <Pie
                        data={zones}
                        dataKey="count"
                        nameKey="label"
                        cx="50%"
                        cy="48%"
                        innerRadius={76}
                        outerRadius={118}
                        paddingAngle={3}
                        stroke="#ffffff"
                        strokeWidth={3}
                        labelLine={false}
                        label={renderZoneLabel}
                      >
                        {zones.map((zone) => (
                          <Cell key={`${zone.label}-cell`} fill={zone.color} />
                        ))}
                      </Pie>
                      <text x="50%" y="42%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-500 text-[12px]">
                        主要区间
                      </text>
                      <text x="50%" y="49%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-900 text-[24px] font-bold">
                        {dominantZone?.label ?? '--'}
                      </text>
                      <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-500 text-[11px]">
                        总记录 {records.length}
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400">
                    暂无足够心率数据
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {zones.map((zone) => (
                  <div key={zone.label} className={`rounded-2xl border border-slate-200 bg-gradient-to-br ${zone.bg} p-3`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: zone.color }} />
                        <span className="text-sm font-semibold text-slate-900">{zone.label}</span>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${zone.badge}`}>{zone.percent}%</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{zone.rangeText}</p>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xl font-bold tabular-nums text-slate-900">{zone.count}</p>
                        <p className="text-[11px] text-slate-500">条记录</p>
                      </div>
                      <p className="text-right text-[11px] leading-5 text-slate-500">{zone.hint}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
