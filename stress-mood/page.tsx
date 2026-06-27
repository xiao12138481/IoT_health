'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { useApp } from '@/components/layout/app-provider';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Activity, CalendarDays, Download, Eye, FileText, Info, TrendingUp, Trash2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface StressMoodRecord {
  id: number;
  person_id: number;
  hrv_mean: number | null;
  hrv_sdnn: number | null;
  hrv_rmssd: number | null;
  hrv_pnn50: number | null;
  stress_score: number;
  stress_level: string;
  mood_state: string;
  autonomic_balance: string;
  analysis: string | null;
  recommendations: string | null;
  recorded_at: string;
}

interface StressTrendPoint {
  x: number;
  time: string;
  axisLabel: string;
  fullTime: string;
  stressScore: number;
  hrvMean: number | null;
}

interface StressMoodReport {
  id: number;
  person_id: number;
  report_no: string;
  report_title: string;
  report_summary: string;
  stress_score: number;
  stress_level: string;
  mood_state: string;
  autonomic_balance: string;
  avg_heart_rate: number;
  latest_heart_rate: number;
  min_heart_rate: number;
  max_heart_rate: number;
  sample_count: number;
  hrv_mean: number;
  hrv_sdnn: number;
  hrv_rmssd: number;
  hrv_pnn50: number;
  analysis: string;
  recommendations: string[];
  risk_flags: string[];
  report_start: string;
  report_end: string;
  recorded_at: string;
  expires_at: string;
}

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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function StressMoodPage() {
  const { persons, currentPersonId, setCurrentPersonId, alarmCount } = useApp();
  /*图表交互和页面核心状态*/
  const stressOverlayRef = useRef<HTMLDivElement | null>(null);
  const hrvOverlayRef = useRef<HTMLDivElement | null>(null);
  const panStateRef = useRef<{
    startClientX: number;
    startRange: { startX: number; endX: number };
    containerWidth: number;
  } | null>(null);
  const [records, setRecords] = useState<StressMoodRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'1d' | '3d' | '7d'>('1d');
  const [generating, setGenerating] = useState(false);
  const [reports, setReports] = useState<StressMoodReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<StressMoodReport | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportLevelFilter, setReportLevelFilter] = useState<'all' | 'low' | 'moderate' | 'high' | 'severe'>('all');
  const [reportTimeFilter, setReportTimeFilter] = useState<'7d' | '30d' | 'all'>('30d');
  const [deletingReportId, setDeletingReportId] = useState<number | null>(null);
  const [zoomRange, setZoomRange] = useState<{ startX: number; endX: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  /*加载当前人员指定时间范围内的压力情绪记录*/
  const loadData = async (showLoading = true) => {
    if (!currentPersonId) return;
    if (showLoading) setLoading(true);
    try {
      const end = new Date();
      const start = new Date();
      if (range === '1d') start.setDate(start.getDate() - 1);
      else if (range === '3d') start.setDate(start.getDate() - 3);
      else start.setDate(start.getDate() - 7);

      const res = await fetch(
        `/api/stress-mood?person_id=${currentPersonId}&start_date=${start.toISOString()}&end_date=${end.toISOString()}`
      );
      const data = await res.json();
      setRecords(data.data || data.records || []);
    } catch {
      // Silently handle
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  /*加载压力情绪分析报告列表*/
  const loadReports = async (showLoading = true) => {
    if (!currentPersonId) {
      return;
    }

    if (showLoading) {
      setReportsLoading(true);
    }

    try {
      const params = new URLSearchParams({
        person_id: String(currentPersonId),
      });

      if (reportLevelFilter !== 'all') {
        params.set('stress_level', reportLevelFilter);
      }

      if (reportTimeFilter !== 'all') {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - (reportTimeFilter === '7d' ? 7 : 30));
        params.set('start_date', start.toISOString());
        params.set('end_date', end.toISOString());
      }

      const response = await fetch(`/api/stress-mood-reports?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('加载报告失败');
      }

      const data = await response.json();
      setReports(data.reports || []);
    } catch {
      setReports([]);
    } finally {
      if (showLoading) {
        setReportsLoading(false);
      }
    }
  };

  /*页面加载和时间范围切换后自动刷新原始记录*/
  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      void loadData(false);
    }, 5000);

    return () => clearInterval(timer);
  }, [currentPersonId, range]);

  /*筛选条件变化后重新加载报告列表*/
  useEffect(() => {
    void loadReports();
  }, [currentPersonId, reportLevelFilter, reportTimeFilter]);

  /*切换时间范围后重置图表缩放*/
  useEffect(() => {
    setZoomRange(null);
  }, [currentPersonId, range]);

  /*整理压力和 HRV 双指标图表数据*/
  const chartData = useMemo<StressTrendPoint[]>(() => {
    return [...records]
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
      .map((record) => {
        const timestamp = new Date(record.recorded_at).getTime();
        return {
          x: timestamp,
          time: new Date(record.recorded_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          axisLabel: formatAxisTime(timestamp, range),
          fullTime: new Date(record.recorded_at).toLocaleString('zh-CN'),
          stressScore: record.stress_score,
          hrvMean: record.hrv_mean,
        };
      });
  }, [records, range]);

  /*缩放范围超出边界时自动纠正*/
  useEffect(() => {
    if (!zoomRange || chartData.length < 2) {
      return;
    }

    const fullStart = chartData[0].x;
    const fullEnd = chartData[chartData.length - 1].x;
    const nextStart = clamp(zoomRange.startX, fullStart, fullEnd);
    const nextEnd = clamp(zoomRange.endX, fullStart, fullEnd);

    if (nextStart !== zoomRange.startX || nextEnd !== zoomRange.endX) {
      if (nextEnd - nextStart <= 0) {
        setZoomRange(null);
      } else {
        setZoomRange({ startX: nextStart, endX: nextEnd });
      }
    }
  }, [chartData, zoomRange]);

  /*处理滚轮缩放图表窗口*/
  const handleChartWheel = (event: {
    preventDefault: () => void;
    clientX: number;
    deltaY: number;
    currentTarget: HTMLDivElement;
  }) => {
    if (chartData.length < 3) {
      return;
    }

    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const cursorRatio = clamp((event.clientX - rect.left) / rect.width, 0, 1);

    const fullStart = chartData[0].x;
    const fullEnd = chartData[chartData.length - 1].x;
    const currentStart = zoomRange?.startX ?? fullStart;
    const currentEnd = zoomRange?.endX ?? fullEnd;
    const currentSpan = currentEnd - currentStart;
    const fullSpan = fullEnd - fullStart;

    if (currentSpan <= 0 || fullSpan <= 0) {
      return;
    }

    const anchorX = currentStart + currentSpan * cursorRatio;
    const zoomFactor = event.deltaY > 0 ? 1.18 : 0.82;
    const minSpan = Math.max(fullSpan / 40, 30 * 60 * 1000);
    const nextSpan = clamp(currentSpan * zoomFactor, minSpan, fullSpan);

    let nextStart = anchorX - (anchorX - currentStart) * (nextSpan / currentSpan);
    let nextEnd = nextStart + nextSpan;

    if (nextStart < fullStart) {
      nextStart = fullStart;
      nextEnd = fullStart + nextSpan;
    }

    if (nextEnd > fullEnd) {
      nextEnd = fullEnd;
      nextStart = fullEnd - nextSpan;
    }

    if (nextSpan >= fullSpan * 0.98) {
      setZoomRange(null);
      return;
    }

    setZoomRange({
      startX: Math.max(fullStart, nextStart),
      endX: Math.min(fullEnd, nextEnd),
    });
  };

  /*代理交互层的滚轮事件*/
  const handleInteractionWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    handleChartWheel(event);
  };

  /*开始拖拽平移图表*/
  const handleInteractionPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || chartData.length < 2) {
      return;
    }

    event.preventDefault();

    const fullStart = chartData[0].x;
    const fullEnd = chartData[chartData.length - 1].x;
    const currentRange = zoomRange ?? { startX: fullStart, endX: fullEnd };

    if (currentRange.endX - currentRange.startX >= fullEnd - fullStart) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    panStateRef.current = {
      startClientX: event.clientX,
      startRange: currentRange,
      containerWidth: rect.width,
    };
    setIsPanning(true);
  };

  /*拖拽过程中平移图表*/
  const handleInteractionPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    let panState = panStateRef.current;
    if (!panState && (event.buttons & 1) === 1 && chartData.length >= 2) {
      const fullStart = chartData[0].x;
      const fullEnd = chartData[chartData.length - 1].x;
      const currentRange = zoomRange ?? { startX: fullStart, endX: fullEnd };

      if (currentRange.endX - currentRange.startX < fullEnd - fullStart) {
        const rect = event.currentTarget.getBoundingClientRect();
        panState = {
          startClientX: event.clientX,
          startRange: currentRange,
          containerWidth: rect.width,
        };
        panStateRef.current = panState;
        setIsPanning(true);
      }
    }

    if (!panState || chartData.length < 2) {
      return;
    }

    event.preventDefault();

    const fullStart = chartData[0].x;
    const fullEnd = chartData[chartData.length - 1].x;
    const fullSpan = fullEnd - fullStart;
    const windowSpan = panState.startRange.endX - panState.startRange.startX;
    const deltaRatio = (event.clientX - panState.startClientX) / Math.max(panState.containerWidth, 1);
    const deltaX = deltaRatio * windowSpan;

    let nextStart = panState.startRange.startX - deltaX;
    let nextEnd = panState.startRange.endX - deltaX;

    if (nextStart < fullStart) {
      nextStart = fullStart;
      nextEnd = fullStart + windowSpan;
    }

    if (nextEnd > fullEnd) {
      nextEnd = fullEnd;
      nextStart = fullEnd - windowSpan;
    }

    if (windowSpan >= fullSpan) {
      setZoomRange(null);
      return;
    }

    setZoomRange({
      startX: nextStart,
      endX: nextEnd,
    });
  };

  /*结束拖拽并释放指针捕获*/
  const handleInteractionPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    panStateRef.current = null;
    setIsPanning(false);
  };

  /*给图表交互层注册原生滚轮监听*/
  useEffect(() => {
    const overlays = [stressOverlayRef.current, hrvOverlayRef.current].filter(
      (item): item is HTMLDivElement => item instanceof HTMLDivElement
    );

    if (overlays.length === 0) {
      return;
    }

    const cleanups = overlays.map((overlay) => {
      const nativeWheelHandler = (event: WheelEvent) => {
        event.preventDefault();
        event.stopPropagation();

        handleChartWheel({
          preventDefault: () => event.preventDefault(),
          clientX: event.clientX,
          deltaY: event.deltaY,
          currentTarget: overlay,
        });
      };

      overlay.addEventListener('wheel', nativeWheelHandler, { passive: false });
      return () => overlay.removeEventListener('wheel', nativeWheelHandler);
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [chartData, zoomRange]);

  const latest = records.length > 0 ? records[0] : null;
  const avgStress = records.length > 0 
    ? Math.round(records.reduce((s, r) => s + (r.stress_score || 0), 0) / records.length) 
    : null;
  const maxStress = records.length > 0 
    ? Math.max(...records.map((r) => r.stress_score || 0)) 
    : null;
  const minStress = records.length > 0 
    ? Math.min(...records.map((r) => r.stress_score || 0)) 
    : null;
  
  /*统计不同压力等级的数据条数*/
  const stats = {
    low: records.filter(r => r.stress_level === 'low' || r.stress_level === 'calm').length,
    moderate: records.filter(r => r.stress_level === 'moderate').length,
    high: records.filter(r => r.stress_level === 'high').length,
    severe: records.filter(r => r.stress_level === 'severe' || r.stress_level === 'critical').length,
  };

  /*把压力等级转换为显示文案和颜色*/
  const getStressLevelInfo = (level: string) => {
    switch (level) {
      case 'calm':
      case 'low': return { label: '低压力', color: '#22C55E' };
      case 'moderate': return { label: '中等压力', color: '#EAB308' };
      case 'high': return { label: '高压力', color: '#F97316' };
      case 'critical':
      case 'severe': return { label: '严重压力', color: '#EF4444' };
      default: return { label: '未知', color: '#64748B' };
    }
  };

  /*把情绪状态代码转换为中文标签*/
  const getMoodLabel = (mood: string) => {
    switch (mood) {
      case 'calm': return '平静';
      case 'relaxed': return '放松';
      case 'moderate': return '一般';
      case 'neutral': return '正常';
      case 'stressed': return '压力大';
      case 'anxious': return '焦虑';
      default: return mood;
    }
  };

  /*把自主神经状态转换为中文标签*/
  const getAutonomicLabel = (balance: string) => {
    switch (balance) {
      case 'parasympathetic': return '副交感';
      case 'sympathetic': return '交感';
      case 'hyper_aroused': return '交感亢进';
      case 'moderate': return '轻度波动';
      case 'balanced': return '平衡';
      default: return balance;
    }
  };

  /*导出压力情绪报告为文本文件*/
  const exportReport = (report: StressMoodReport) => {
    const personName = persons.find((person) => person.id === report.person_id)?.name ?? `人员${report.person_id}`;
    const text = [
      `${report.report_title}`,
      `报告编号：${report.report_no}`,
      `监测对象：${personName}`,
      `生成时间：${new Date(report.recorded_at).toLocaleString('zh-CN')}`,
      `报告周期：${new Date(report.report_start).toLocaleString('zh-CN')} - ${new Date(report.report_end).toLocaleString('zh-CN')}`,
      `留存截止：${new Date(report.expires_at).toLocaleString('zh-CN')}`,
      '',
      '一、核心结论',
      `压力评分：${report.stress_score} 分`,
      `压力等级：${getStressLevelInfo(report.stress_level).label}`,
      `情绪状态：${getMoodLabel(report.mood_state)}`,
      `自主神经：${getAutonomicLabel(report.autonomic_balance)}`,
      `报告摘要：${report.report_summary}`,
      '',
      '二、具体数据',
      `采样条数：${report.sample_count} 条`,
      `平均心率：${report.avg_heart_rate} bpm`,
      `当前心率：${report.latest_heart_rate} bpm`,
      `最低心率：${report.min_heart_rate} bpm`,
      `最高心率：${report.max_heart_rate} bpm`,
      `HRV 均值：${report.hrv_mean} ms`,
      `SDNN：${report.hrv_sdnn} ms`,
      `RMSSD：${report.hrv_rmssd} ms`,
      `pNN50：${report.hrv_pnn50} %`,
      '',
      '三、压力情况',
      report.analysis,
      '',
      '四、风险提示',
      ...(report.risk_flags.length > 0 ? report.risk_flags.map((item, index) => `${index + 1}. ${item}`) : ['暂无明显风险提示']),
      '',
      '五、建议',
      ...report.recommendations.map((item, index) => `${index + 1}. ${item}`),
      '',
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.report_no}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /*打开报告详情对话框*/
  const handleViewReport = (report: StressMoodReport) => {
    setSelectedReport(report);
    setReportDialogOpen(true);
  };

  /*删除单份压力情绪报告*/
  const handleDeleteReport = async (id: number) => {
    if (!confirm('确定要删除这份报告吗？删除后将无法再导出。')) {
      return;
    }

    setDeletingReportId(id);
    try {
      const response = await fetch(`/api/stress-mood-reports?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('删除失败');
      }

      setReports((current) => current.filter((report) => report.id !== id));
      if (selectedReport?.id === id) {
        setReportDialogOpen(false);
        setSelectedReport(null);
      }
    } catch {
      alert('删除报告失败');
    } finally {
      setDeletingReportId(null);
    }
  };

  /*根据当前时间范围的心率数据生成报告*/
  const handleGenerateFromHeartRate = async () => {
    if (!currentPersonId) return;
    
    if (!confirm('确定要根据当前时间范围内的心率数据生成压力与情绪报告吗？')) return;
    
    setGenerating(true);
    try {
      const response = await fetch('/api/stress-mood-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          person_id: currentPersonId,
          range,
        })
      });
      
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || '生成失败');
      }
      
      const result = await response.json();
      await loadReports(false);
      setSelectedReport(result.report ?? null);
      setReportDialogOpen(Boolean(result.report));
      alert('压力与情绪报告已生成，并已写入历史记录。');
    } catch (error) {
      alert(error instanceof Error ? error.message : '生成报告失败');
    } finally {
      setGenerating(false);
    }
  };

  const latestStressInfo = latest ? getStressLevelInfo(latest.stress_level) : null;
  const latestReport = reports[0] ?? null;

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
              <Activity className="h-7 w-7 text-blue-500" />
              压力与情绪监测
            </h2>
            <p className="text-sm text-muted-foreground mt-1">基于心率变异性(HRV)的压力评估与情绪分析</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleGenerateFromHeartRate}
              disabled={generating}
              className="bg-green-600 hover:bg-green-700"
            >
              {generating ? '生成中...' : '根据心率生成压力与情绪报告'}
            </Button>
            {(['1d', '3d', '7d'] as const).map((r) => (
              <Button
                key={r}
                variant={range === r ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRange(r)}
                className={range === r ? 'bg-blue-500 hover:bg-blue-600' : ''}
              >
                {r === '1d' ? '24小时' : r === '3d' ? '3天' : '7天'}
              </Button>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: '当前压力', value1: latest?.stress_score, unit: '分', icon: Activity, color: 'text-blue-600' },
            { label: '平均压力', value1: avgStress, unit: '分', icon: TrendingUp, color: 'text-purple-600' },
            { label: '最高压力', value1: maxStress, unit: '分', icon: TrendingUp, color: 'text-red-600' },
            { label: '最低压力', value1: minStress, unit: '分', icon: TrendingUp, color: 'text-green-600' },
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
                  <span className="text-xs text-muted-foreground">{stat.unit}</span>
                </div>
                {idx === 0 && latestStressInfo && (
                  <Badge 
                    className="mt-2" 
                    style={{ backgroundColor: latestStressInfo.color }}
                  >
                    {latestStressInfo.label}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Stress distribution stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">压力统计分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: '低压力', count: stats.low, color: '#22C55E' },
                { label: '中等压力', count: stats.moderate, color: '#EAB308' },
                { label: '高压力', count: stats.high, color: '#F97316' },
                { label: '严重压力', count: stats.severe, color: '#EF4444' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: `${item.color}15` }}>
                  <div 
                    className="h-10 w-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: item.color }}
                  >
                    <span className="text-white font-bold">{item.count}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: item.color }}>
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-foreground">条记录</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">压力趋势与 HRV</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">压力趋势</h3>
                  <p className="text-xs text-slate-500">查看压力分数随时间的变化</p>
                </div>
                <Badge className="bg-blue-600">压力分数</Badge>
              </div>
              <div
                className={cn(
                  'relative h-72 overscroll-contain select-none rounded-xl border border-slate-100 bg-white',
                  isPanning ? 'cursor-grabbing' : 'cursor-default'
                )}
                onDoubleClick={() => setZoomRange(null)}
              >
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
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
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                      <Tooltip
                        contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                        formatter={(value: number) => [`${value} 分`, '压力分数']}
                        labelFormatter={(_label, payload) => {
                          const point = payload?.[0]?.payload as { fullTime?: string } | undefined;
                          return point?.fullTime ?? '';
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="stressScore"
                        stroke="#2563EB"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5, fill: '#2563EB', strokeWidth: 2, stroke: '#fff' }}
                        name="压力分数"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                <div
                  ref={stressOverlayRef}
                  className="absolute inset-0 z-10"
                  onWheel={handleInteractionWheel}
                  onPointerDown={handleInteractionPointerDown}
                  onPointerMove={handleInteractionPointerMove}
                  onPointerUp={handleInteractionPointerUp}
                  onPointerCancel={handleInteractionPointerUp}
                  onContextMenu={(event) => event.preventDefault()}
                />
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">HRV 趋势</h3>
                  <p className="text-xs text-slate-500">查看 HRV 均值随时间的变化</p>
                </div>
                <Badge className="bg-emerald-600">HRV(ms)</Badge>
              </div>
              <div
                className={cn(
                  'relative h-72 overscroll-contain select-none rounded-xl border border-slate-100 bg-white',
                  isPanning ? 'cursor-grabbing' : 'cursor-default'
                )}
                onDoubleClick={() => setZoomRange(null)}
              >
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
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
                      <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                      <Tooltip
                        contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                        formatter={(value) => [`${value ?? '--'} ms`, 'HRV 均值']}
                        labelFormatter={(_label, payload) => {
                          const point = payload?.[0]?.payload as { fullTime?: string } | undefined;
                          return point?.fullTime ?? '';
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="hrvMean"
                        stroke="#10B981"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }}
                        name="HRV(ms)"
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                <div
                  ref={hrvOverlayRef}
                  className="absolute inset-0 z-10"
                  onWheel={handleInteractionWheel}
                  onPointerDown={handleInteractionPointerDown}
                  onPointerMove={handleInteractionPointerMove}
                  onPointerUp={handleInteractionPointerUp}
                  onPointerCancel={handleInteractionPointerUp}
                  onContextMenu={(event) => event.preventDefault()}
                />
              </div>
            </div>

            <p className="text-xs text-slate-500">
              在任意趋势图区域滚动鼠标滚轮可缩放时间窗口，左键按住可左右拖动时间窗，双击可重置到全局视图。
            </p>
          </CardContent>
        </Card>

        {/* Latest Analysis & Records */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            {/* Latest Analysis */}
            {latest && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold">最新分析</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">压力等级</span>
                      <Badge style={{ backgroundColor: getStressLevelInfo(latest.stress_level).color }} className="mt-1">
                        {getStressLevelInfo(latest.stress_level).label}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">情绪状态</span>
                      <p className="text-sm font-medium">{getMoodLabel(latest.mood_state)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">自主神经</span>
                      <p className="text-sm font-medium">{getAutonomicLabel(latest.autonomic_balance)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">HRV 均值</span>
                      <p className="text-sm font-medium">{latest.hrv_mean} ms</p>
                    </div>
                  </div>
                  {latest.analysis && (
                    <div>
                      <span className="text-xs text-muted-foreground">分析结果</span>
                      <p className="text-sm mt-1">{latest.analysis}</p>
                    </div>
                  )}
                  {latest.recommendations && (
                    <div>
                      <span className="text-xs text-muted-foreground">建议</span>
                      <p className="text-sm mt-1 text-blue-700">{latest.recommendations}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Info className="h-5 w-5 text-slate-500" />
                  压力评分参考与建议
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    {
                      label: '低压力',
                      range: '0 - 29',
                      color: '#22C55E',
                      description: '您当前的状态非常好！',
                      recommendations: [
                        '保持规律作息与健康习惯',
                        '每天坚持适度运动',
                        '维持积极乐观的心态',
                        '保持稳定社交互动',
                      ],
                    },
                    {
                      label: '中等压力',
                      range: '30 - 49',
                      color: '#EAB308',
                      description: '需要适当关注和调节',
                      recommendations: [
                        '每天做 10-15 分钟深呼吸或冥想',
                        '尝试 4-7-8 呼吸法放松',
                        '保证 7-8 小时睡眠',
                        '每周安排 2-3 次休闲活动',
                      ],
                    },
                    {
                      label: '高压力',
                      range: '50 - 69',
                      color: '#F97316',
                      description: '需要积极采取减压措施',
                      recommendations: [
                        '每天进行 20-30 分钟放松训练',
                        '减少咖啡因摄入',
                        '增加户外活动与日照',
                        '尝试肌肉渐进放松训练',
                      ],
                    },
                    {
                      label: '严重压力',
                      range: '70 - 100',
                      color: '#EF4444',
                      description: '需要高度重视，及时干预',
                      recommendations: [
                        '立即暂停高压活动并深呼吸',
                        '尽快咨询心理咨询师或医生',
                        '保证充足休息，避免过劳',
                        '主动寻求家人朋友支持',
                      ],
                    },
                  ].map((item, idx) => (
                    <div key={idx} className="rounded-xl border p-4" style={{ backgroundColor: `${item.color}10`, borderColor: `${item.color}40` }}>
                      <div className="mb-3 flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full"
                          style={{ backgroundColor: item.color }}
                        >
                          <span className="text-sm font-bold text-white">{idx + 1}</span>
                        </div>
                        <div>
                          <span className="text-sm font-bold" style={{ color: item.color }}>
                            {item.label}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">{item.range} 分</span>
                        </div>
                      </div>
                      <p className="mb-3 text-sm text-muted-foreground">{item.description}</p>
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        {item.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1 text-green-500">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Reports List */}
          <Card>
            <CardHeader className="pb-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-emerald-600" />
                    压力与情绪报告历史
                  </CardTitle>
                  <CardDescription>每次生成报告都会形成一条历史记录，报告留存 30 天，可随时查看和导出。</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={reportLevelFilter}
                    onChange={(event) => setReportLevelFilter(event.target.value as typeof reportLevelFilter)}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none"
                  >
                    <option value="all">全部等级</option>
                    <option value="low">低压力</option>
                    <option value="moderate">中等压力</option>
                    <option value="high">高压力</option>
                    <option value="severe">严重压力</option>
                  </select>
                  <select
                    value={reportTimeFilter}
                    onChange={(event) => setReportTimeFilter(event.target.value as typeof reportTimeFilter)}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none"
                  >
                    <option value="7d">近 7 天</option>
                    <option value="30d">近 30 天</option>
                    <option value="all">全部留存</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-1">
              {latestReport && (
                <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-600">最新报告</Badge>
                        <span className="text-xs text-slate-500">{latestReport.report_no}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-900">{latestReport.report_summary}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                        <span>压力 {latestReport.stress_score} 分</span>
                        <span>平均心率 {latestReport.avg_heart_rate} bpm</span>
                        <span>HRV {latestReport.hrv_mean} ms</span>
                        <span>留存至 {new Date(latestReport.expires_at).toLocaleDateString('zh-CN')}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleViewReport(latestReport)}>
                        <Eye className="mr-1 h-4 w-4" />
                        查看
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => exportReport(latestReport)}>
                        <Download className="mr-1 h-4 w-4" />
                        导出
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3 max-h-[40rem] overflow-y-auto">
                {reportsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  </div>
                ) : reports.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    当前筛选条件下暂无报告
                  </div>
                ) : (
                  reports.map((report) => {
                    const stressInfo = getStressLevelInfo(report.stress_level);
                    const isAbnormal = report.stress_level === 'high' || report.stress_level === 'severe';
                    return (
                      <div 
                        key={report.id} 
                        className={`p-4 rounded-lg border transition-all ${isAbnormal ? 'border-red-200 bg-red-50' : 'border-slate-100'}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge style={{ backgroundColor: stressInfo.color }}>
                                {stressInfo.label}
                              </Badge>
                              <span className="text-xs text-slate-500">{report.report_no}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(report.recorded_at).toLocaleString('zh-CN')}
                              </span>
                            </div>
                            <div className="text-sm font-medium text-slate-900">
                              {report.report_title}
                            </div>
                            <p className="text-sm text-slate-700">
                              {report.report_summary}
                            </p>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>压力 {report.stress_score} 分</span>
                              <span>情绪 {getMoodLabel(report.mood_state)}</span>
                              <span>平均心率 {report.avg_heart_rate} bpm</span>
                              <span>HRV {report.hrv_mean} ms</span>
                              <span>留存至 {new Date(report.expires_at).toLocaleDateString('zh-CN')}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleViewReport(report)}>
                              <Eye className="mr-1 h-4 w-4" />
                              查看
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => exportReport(report)}>
                              <Download className="mr-1 h-4 w-4" />
                              导出
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteReport(report.id)}
                              disabled={deletingReportId === report.id}
                            >
                              {deletingReportId === report.id ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-red-500" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedReport?.report_title ?? '压力与情绪报告'}</DialogTitle>
            <DialogDescription>
              {selectedReport
                ? `${selectedReport.report_no} · 生成于 ${new Date(selectedReport.recorded_at).toLocaleString('zh-CN')}`
                : '查看报告详情'}
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">压力评分</p>
                    <p className="mt-2 text-3xl font-bold text-blue-600">{selectedReport.stress_score}</p>
                    <Badge className="mt-2" style={{ backgroundColor: getStressLevelInfo(selectedReport.stress_level).color }}>
                      {getStressLevelInfo(selectedReport.stress_level).label}
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">情绪状态</p>
                    <p className="mt-2 text-lg font-semibold">{getMoodLabel(selectedReport.mood_state)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{getAutonomicLabel(selectedReport.autonomic_balance)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">平均心率</p>
                    <p className="mt-2 text-3xl font-bold text-emerald-600">{selectedReport.avg_heart_rate}</p>
                    <p className="mt-2 text-xs text-muted-foreground">最新 {selectedReport.latest_heart_rate} bpm</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">HRV 均值</p>
                    <p className="mt-2 text-3xl font-bold text-purple-600">{selectedReport.hrv_mean}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{selectedReport.sample_count} 条采样</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">报告摘要</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      报告周期：{new Date(selectedReport.report_start).toLocaleString('zh-CN')} - {new Date(selectedReport.report_end).toLocaleString('zh-CN')}
                    </span>
                    <span>留存截止：{new Date(selectedReport.expires_at).toLocaleString('zh-CN')}</span>
                  </div>
                  <p>{selectedReport.report_summary}</p>
                  <p>{selectedReport.analysis}</p>
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">具体数据</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">最低心率</p>
                      <p className="mt-1 font-semibold">{selectedReport.min_heart_rate} bpm</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">最高心率</p>
                      <p className="mt-1 font-semibold">{selectedReport.max_heart_rate} bpm</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">SDNN</p>
                      <p className="mt-1 font-semibold">{selectedReport.hrv_sdnn} ms</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">RMSSD</p>
                      <p className="mt-1 font-semibold">{selectedReport.hrv_rmssd} ms</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">pNN50</p>
                      <p className="mt-1 font-semibold">{selectedReport.hrv_pnn50} %</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">采样数量</p>
                      <p className="mt-1 font-semibold">{selectedReport.sample_count} 条</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">风险提示与建议</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">风险提示</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedReport.risk_flags.length > 0 ? (
                          selectedReport.risk_flags.map((item) => (
                            <Badge key={item} variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
                              {item}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-slate-500">暂无明显风险提示</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">建议</p>
                      <div className="mt-2 space-y-2">
                        {selectedReport.recommendations.map((item, index) => (
                          <p key={`${selectedReport.id}-${index}`} className="rounded-lg bg-blue-50 px-3 py-2 text-blue-800">
                            {index + 1}. {item}
                          </p>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          <DialogFooter>
            {selectedReport && (
              <>
                <Button variant="outline" onClick={() => exportReport(selectedReport)}>
                  <Download className="mr-2 h-4 w-4" />
                  导出报告
                </Button>
                <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
                  关闭
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
