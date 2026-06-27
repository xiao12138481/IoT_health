'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/layout/app-provider';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Moon, Clock, TrendingUp, BedDouble, Download, Eye, FileText, Trash2, TimerReset, Activity } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface SleepRecord {
  id: number;
  source_sleep_session_id?: number | null;
  start_time: string;
  end_time: string;
  deep_sleep_min: number;
  light_sleep_min: number;
  rem_sleep_min: number;
  awake_min: number;
  score: number;
  recorded_at: string;
}

interface SleepReport {
  id: number;
  person_id: number;
  source_sleep_record_id: number;
  report_no: string;
  report_title: string;
  report_summary: string;
  score: number;
  sleep_level: 'excellent' | 'good' | 'fair' | 'poor';
  start_time: string;
  end_time: string;
  deep_sleep_min: number;
  light_sleep_min: number;
  rem_sleep_min: number;
  awake_min: number;
  total_sleep_min: number;
  deep_sleep_ratio: number;
  rem_sleep_ratio: number;
  awake_ratio: number;
  analysis: string;
  recommendations: string[];
  risk_flags: string[];
  recorded_at: string;
  expires_at: string;
}

interface SleepSession {
  id: number;
  person_id: number;
  scenario: 'sleep' | 'sleep_anomaly';
  status: 'active' | 'completed' | 'stopped';
  demo_mode: boolean;
  planned_epochs: number;
  completed_epochs: number;
  epoch_minutes: number;
  session_start_time: string;
  session_end_time: string;
  current_stage: 'awake' | 'light' | 'deep' | 'rem' | null;
  sleep_record_id?: number | null;
  sleep_report_id?: number | null;
  report_generated?: boolean;
  recorded_at: string;
}

interface SleepStageEvent {
  id: number;
  session_id: number;
  person_id: number;
  epoch_index: number;
  stage: 'awake' | 'light' | 'deep' | 'rem';
  simulated_at: string;
  heart_rate: number | null;
  blood_oxygen: number | null;
  body_temp: number | null;
  movement_level: number | null;
  respiratory_rate: number | null;
  recorded_at: string;
}

const SLEEP_COLORS = ['#6366F1', '#818CF8', '#A5B4FC', '#E0E7FF'];
const SLEEP_STAGE_META = {
  awake: { label: '清醒', color: '#F59E0B' },
  light: { label: '浅睡', color: '#818CF8' },
  deep: { label: '深睡', color: '#4338CA' },
  rem: { label: 'REM', color: '#06B6D4' },
} as const;

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m > 0 ? ` ${m}m` : ''}`;
}

function getSleepLevelInfo(score: number) {
  if (score >= 85) return { key: 'excellent' as const, label: '优秀', className: 'border-green-200 text-green-700' };
  if (score >= 75) return { key: 'good' as const, label: '良好', className: 'border-emerald-200 text-emerald-700' };
  if (score >= 60) return { key: 'fair' as const, label: '一般', className: 'border-yellow-200 text-yellow-700' };
  return { key: 'poor' as const, label: '较差', className: 'border-red-200 text-red-700' };
}

function getSleepStageInfo(stage: SleepStageEvent['stage'] | SleepSession['current_stage']) {
  if (!stage) {
    return { label: '未开始', color: '#CBD5E1' };
  }
  return SLEEP_STAGE_META[stage];
}

function buildDateQuery(timeFilter: '7d' | '30d' | 'all') {
  if (timeFilter === 'all') {
    return {};
  }

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (timeFilter === '7d' ? 7 : 30));
  return {
    start_date: start.toISOString(),
    end_date: end.toISOString(),
  };
}

export default function SleepPage() {
  const { persons, currentPersonId, setCurrentPersonId, alarmCount } = useApp();
  /*页面核心数据状态*/
  const [records, setRecords] = useState<SleepRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [reports, setReports] = useState<SleepReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [session, setSession] = useState<SleepSession | null>(null);
  const [sessionEvents, setSessionEvents] = useState<SleepStageEvent[]>([]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [recordLevelFilter, setRecordLevelFilter] = useState<'all' | 'excellent' | 'good' | 'fair' | 'poor'>('all');
  const [recordTimeFilter, setRecordTimeFilter] = useState<'7d' | '30d' | 'all'>('30d');
  const [reportLevelFilter, setReportLevelFilter] = useState<'all' | 'excellent' | 'good' | 'fair' | 'poor'>('all');
  const [reportTimeFilter, setReportTimeFilter] = useState<'7d' | '30d' | 'all'>('30d');
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([]);
  const [selectedReport, setSelectedReport] = useState<SleepReport | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [deletingAllFiltered, setDeletingAllFiltered] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState<number | null>(null);

  /*加载睡眠记录、当前会话和睡眠阶段事件*/
  const loadRecords = async (showLoading = true) => {
    if (!currentPersonId) return;
    if (showLoading) setRecordsLoading(true);
    if (showLoading) setSessionLoading(true);

    try {
      const params = new URLSearchParams({
        person_id: String(currentPersonId),
        limit: '120',
        include_session: 'true',
      });

      const rangeQuery = buildDateQuery(recordTimeFilter);
      Object.entries(rangeQuery).forEach(([key, value]) => params.set(key, value));

      if (recordLevelFilter !== 'all') {
        params.set('score_level', recordLevelFilter);
      }

      const res = await fetch(`/api/sleep-records?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      setRecords(data.records || []);
      setSession(data.session || null);
      setSessionEvents(data.events || []);
    } catch {
      setRecords([]);
      setSession(null);
      setSessionEvents([]);
    } finally {
      if (showLoading) setRecordsLoading(false);
      if (showLoading) setSessionLoading(false);
    }
  };

  /*加载当前人员的睡眠分析报告列表*/
  const loadReports = async (showLoading = true) => {
    if (!currentPersonId) return;
    if (showLoading) setReportsLoading(true);

    try {
      const params = new URLSearchParams({
        person_id: String(currentPersonId),
        limit: '120',
      });

      const rangeQuery = buildDateQuery(reportTimeFilter);
      Object.entries(rangeQuery).forEach(([key, value]) => params.set(key, value));

      if (reportLevelFilter !== 'all') {
        params.set('sleep_level', reportLevelFilter);
      }

      const res = await fetch(`/api/sleep-reports?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      setReports(data.reports || []);
    } catch {
      setReports([]);
    } finally {
      if (showLoading) setReportsLoading(false);
    }
  };

  /*页面加载和筛选变化后自动刷新记录与报告*/
  useEffect(() => {
    if (!currentPersonId) return;

    void loadRecords();
    void loadReports();
    const timer = setInterval(() => {
      void loadRecords(false);
      void loadReports(false);
    }, 5000);

    return () => clearInterval(timer);
  }, [currentPersonId, recordLevelFilter, recordTimeFilter, reportLevelFilter, reportTimeFilter]);

  /*记录列表变化后重置勾选状态*/
  useEffect(() => {
    setSelectedRecordIds([]);
  }, [records]);

  const latest = records.length > 0 ? records[0] : null;
  const latestReport = reports[0] ?? null;
  const avgScore = records.length > 0 ? Math.round(records.reduce((s, r) => s + r.score, 0) / records.length) : null;
  const avgDuration = records.length > 0
    ? Math.round(records.reduce((s, r) => s + (new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 60000, 0) / records.length)
    : null;
  const avgDeep = records.length > 0 ? Math.round(records.reduce((s, r) => s + r.deep_sleep_min, 0) / records.length) : null;

  const scoreData = [...records].reverse().map((r) => ({
    date: new Date(r.start_time).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
    score: r.score,
  }));

  const stageData = latest
    ? [
        { name: '深度睡眠', value: latest.deep_sleep_min },
        { name: '浅度睡眠', value: latest.light_sleep_min },
        { name: 'REM睡眠', value: latest.rem_sleep_min },
        { name: '清醒', value: latest.awake_min },
      ]
    : [];

  const sessionProgress = session ? Math.round((session.completed_epochs / Math.max(1, session.planned_epochs)) * 100) : 0;
  /*根据睡眠阶段事件汇总当前会话各阶段时长*/
  const sessionStageSummary = useMemo(() => {
    if (sessionEvents.length === 0) {
      return [];
    }

    const counts = {
      deep: 0,
      light: 0,
      rem: 0,
      awake: 0,
    };
    sessionEvents.forEach((event) => {
      counts[event.stage] += 1;
    });

    return [
      { key: 'deep', label: '深睡', value: counts.deep * (session?.epoch_minutes || 0) },
      { key: 'light', label: '浅睡', value: counts.light * (session?.epoch_minutes || 0) },
      { key: 'rem', label: 'REM', value: counts.rem * (session?.epoch_minutes || 0) },
      { key: 'awake', label: '清醒', value: counts.awake * (session?.epoch_minutes || 0) },
    ];
  }, [session, sessionEvents]);

  const currentStageInfo = getSleepStageInfo(session?.current_stage ?? null);
  const latestEvent = sessionEvents.length > 0 ? sessionEvents[sessionEvents.length - 1] : null;

  const allSelected = records.length > 0 && selectedRecordIds.length === records.length;
  const selectedCount = selectedRecordIds.length;

  /*确定当前用于生成报告的睡眠记录*/
  const selectedSourceRecord = useMemo(() => {
    if (selectedRecordIds.length === 1) {
      return records.find((record) => record.id === selectedRecordIds[0]) ?? null;
    }
    return latest;
  }, [selectedRecordIds, records, latest]);

  /*导出睡眠报告为文本文件*/
  const exportReport = (report: SleepReport) => {
    const text = [
      report.report_title,
      `报告编号：${report.report_no}`,
      `生成时间：${new Date(report.recorded_at).toLocaleString('zh-CN')}`,
      `睡眠时段：${new Date(report.start_time).toLocaleString('zh-CN')} - ${new Date(report.end_time).toLocaleString('zh-CN')}`,
      `留存截止：${new Date(report.expires_at).toLocaleString('zh-CN')}`,
      '',
      '一、核心结论',
      `睡眠评分：${report.score} 分`,
      `睡眠等级：${getSleepLevelInfo(report.score).label}`,
      `报告摘要：${report.report_summary}`,
      '',
      '二、具体数据',
      `总时长：${formatDuration(report.total_sleep_min)}`,
      `深睡：${formatDuration(report.deep_sleep_min)} (${report.deep_sleep_ratio}%)`,
      `浅睡：${formatDuration(report.light_sleep_min)}`,
      `REM：${formatDuration(report.rem_sleep_min)} (${report.rem_sleep_ratio}%)`,
      `清醒：${formatDuration(report.awake_min)} (${report.awake_ratio}%)`,
      '',
      '三、睡眠情况',
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

  /*根据当前记录生成睡眠分析报告*/
  const handleGenerateReport = async () => {
    if (!currentPersonId || !selectedSourceRecord) {
      alert('当前没有可用于生成报告的睡眠记录');
      return;
    }

    setGeneratingReport(true);
    try {
      const response = await fetch('/api/sleep-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_id: currentPersonId,
          sleep_record_id: selectedSourceRecord.id,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || '生成报告失败');
      }

      await loadReports(false);
      setSelectedReport(result.report ?? null);
      setReportDialogOpen(Boolean(result.report));
      alert('睡眠报告已生成，并已写入历史记录。');
    } catch (error) {
      alert(error instanceof Error ? error.message : '生成睡眠报告失败');
    } finally {
      setGeneratingReport(false);
    }
  };

  /*切换全部记录的勾选状态*/
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedRecordIds([]);
      return;
    }
    setSelectedRecordIds(records.map((record) => record.id));
  };

  /*切换单条睡眠记录的勾选状态*/
  const toggleSelectRecord = (id: number) => {
    setSelectedRecordIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  /*批量删除选中的睡眠记录*/
  const handleDeleteSelected = async () => {
    if (selectedRecordIds.length === 0) {
      return;
    }
    if (!confirm(`确定要删除选中的 ${selectedRecordIds.length} 条睡眠记录吗？`)) {
      return;
    }

    setDeletingSelected(true);
    try {
      const response = await fetch('/api/sleep-records', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedRecordIds }),
      });
      if (!response.ok) {
        throw new Error('删除失败');
      }

      setSelectedRecordIds([]);
      await loadRecords(false);
    } catch {
      alert('删除睡眠记录失败');
    } finally {
      setDeletingSelected(false);
    }
  };

  /*删除当前筛选结果中的全部睡眠记录*/
  const handleDeleteAllFilteredRecords = async () => {
    if (records.length === 0) {
      return;
    }
    if (!confirm(`确定要删除当前筛选结果中的 ${records.length} 条睡眠记录吗？`)) {
      return;
    }

    setDeletingAllFiltered(true);
    try {
      const response = await fetch('/api/sleep-records', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: records.map((record) => record.id) }),
      });
      if (!response.ok) {
        throw new Error('删除失败');
      }

      setSelectedRecordIds([]);
      await loadRecords(false);
    } catch {
      alert('全选删除睡眠记录失败');
    } finally {
      setDeletingAllFiltered(false);
    }
  };

  /*删除单条睡眠记录*/
  const handleDeleteOneRecord = async (id: number) => {
    if (!confirm('确定要删除这条睡眠记录吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/sleep-records?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('删除失败');
      }
      await loadRecords(false);
    } catch {
      alert('删除睡眠记录失败');
    }
  };

  /*删除单份睡眠报告*/
  const handleDeleteReport = async (id: number) => {
    if (!confirm('确定要删除这份睡眠报告吗？')) {
      return;
    }

    setDeletingReportId(id);
    try {
      const response = await fetch(`/api/sleep-reports?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('删除失败');
      }
      setReports((current) => current.filter((report) => report.id !== id));
      if (selectedReport?.id === id) {
        setSelectedReport(null);
        setReportDialogOpen(false);
      }
    } catch {
      alert('删除睡眠报告失败');
    } finally {
      setDeletingReportId(null);
    }
  };

  return (
    <div className="flex flex-col">
      <Header
        persons={persons.map((p) => ({ id: p.id, name: p.name }))}
        currentPersonId={currentPersonId}
        onPersonChange={setCurrentPersonId}
        alarmCount={alarmCount}
      />

      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Moon className="h-7 w-7 text-indigo-500" /> 睡眠分析
            </h2>
            <p className="text-sm text-muted-foreground mt-1">睡眠质量监测、历史筛选与睡眠报告管理</p>
          </div>
          <Button onClick={handleGenerateReport} disabled={generatingReport || !selectedSourceRecord} className="bg-indigo-600 hover:bg-indigo-700">
            {generatingReport ? '生成中...' : '生成睡眠报告'}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: '最近评分', value: latest?.score ?? '--', unit: '分', icon: Moon, color: 'text-indigo-600' },
            { label: '平均评分', value: avgScore ?? '--', unit: '分', icon: TrendingUp, color: 'text-teal-600' },
            { label: '平均时长', value: avgDuration ? formatDuration(avgDuration) : '--', unit: '', icon: Clock, color: 'text-blue-600' },
            { label: '平均深睡', value: avgDeep ? formatDuration(avgDeep) : '--', unit: '', icon: BedDouble, color: 'text-purple-600' },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value}</span>
                  {stat.unit && <span className="text-xs text-muted-foreground">{stat.unit}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <TimerReset className="h-5 w-5 text-indigo-600" />
                  睡眠过程时间轴
                </CardTitle>
                <CardDescription>展示当前或最近一次睡眠会话的阶段推进过程，快速演示模式下会按整晚节奏压缩播放。</CardDescription>
              </div>
              {session && (
                <Badge variant="outline" className={session.status === 'completed' ? 'border-green-200 text-green-700' : 'border-indigo-200 text-indigo-700'}>
                  {session.status === 'completed' ? '已完成' : session.status === 'active' ? '演示中' : '已停止'}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessionLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">加载中...</div>
            ) : !session ? (
              <div className="py-8 text-center text-sm text-muted-foreground">暂无睡眠过程数据，可在设置页启动“快速整晚睡眠演示”。</div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-xs text-muted-foreground">当前阶段</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: currentStageInfo.color }} />
                      <p className="text-lg font-semibold">{currentStageInfo.label}</p>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {session.scenario === 'sleep_anomaly' ? '异常睡眠演示' : '标准睡眠演示'}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-xs text-muted-foreground">会话进度</p>
                    <p className="mt-2 text-lg font-semibold">{sessionProgress}%</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {session.completed_epochs}/{session.planned_epochs} 轮，每轮 {session.epoch_minutes} 分钟
                    </p>
                  </div>
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-xs text-muted-foreground">模拟时长</p>
                    <p className="mt-2 text-lg font-semibold">{formatDuration(session.planned_epochs * session.epoch_minutes)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(session.session_start_time).toLocaleString('zh-CN')} - {new Date(session.session_end_time).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-xs text-muted-foreground">自动报告</p>
                    <p className="mt-2 text-lg font-semibold">{session.report_generated ? '已生成' : '等待完成'}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {session.status === 'completed' ? '会话结束后自动生成睡眠记录和报告' : '会话完成后自动生成'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>整晚阶段进程</span>
                    <span>{sessionEvents.length} / {session.planned_epochs} 个阶段片段</span>
                  </div>
                  <div className="overflow-hidden rounded-xl border bg-slate-50 p-3">
                    <div className="flex min-h-16 items-stretch overflow-hidden rounded-lg">
                      {Array.from({ length: session.planned_epochs }, (_, index) => {
                        const event = sessionEvents[index];
                        const stageInfo = event ? getSleepStageInfo(event.stage) : { label: '待生成', color: '#E2E8F0' };
                        return (
                          <div
                            key={`${session.id}-${index}`}
                            className="group relative flex min-w-0 flex-1 items-end justify-center border-r border-white/60 last:border-r-0"
                            style={{ backgroundColor: stageInfo.color }}
                            title={event ? `${stageInfo.label} · ${new Date(event.simulated_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : `待生成片段 ${index + 1}`}
                          >
                            <span className="pb-1 text-[10px] font-medium text-white/90">{index + 1}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {Object.entries(SLEEP_STAGE_META).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: value.color }} />
                          <span>{value.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border p-4">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-indigo-600" />
                      <p className="text-sm font-medium">最近阶段指标</p>
                    </div>
                    {latestEvent ? (
                      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">阶段时间</p>
                          <p className="mt-1 font-medium">{new Date(latestEvent.simulated_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">当前阶段</p>
                          <p className="mt-1 font-medium">{getSleepStageInfo(latestEvent.stage).label}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">心率</p>
                          <p className="mt-1 font-medium">{latestEvent.heart_rate ?? '--'} bpm</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">血氧</p>
                          <p className="mt-1 font-medium">{latestEvent.blood_oxygen ?? '--'}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">呼吸频率</p>
                          <p className="mt-1 font-medium">{latestEvent.respiratory_rate ?? '--'} 次/分</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">体动等级</p>
                          <p className="mt-1 font-medium">{latestEvent.movement_level ?? '--'} / 5</p>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-sm text-muted-foreground">当前会话尚未生成阶段事件</div>
                    )}
                  </div>

                  <div className="rounded-xl border p-4">
                    <p className="text-sm font-medium">当前会话阶段统计</p>
                    {sessionStageSummary.length > 0 ? (
                      <div className="mt-4 space-y-3">
                        {sessionStageSummary.map((item) => (
                          <div key={item.key} className="flex items-center gap-3 text-sm">
                            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: SLEEP_STAGE_META[item.key as keyof typeof SLEEP_STAGE_META].color }} />
                            <span className="flex-1 text-muted-foreground">{item.label}</span>
                            <span className="font-medium">{formatDuration(item.value)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-sm text-muted-foreground">暂无阶段统计</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">最近一次睡眠构成</CardTitle>
                {latest && (
                  <Badge variant="outline" className={getSleepLevelInfo(latest.score).className}>
                    {getSleepLevelInfo(latest.score).label}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {latest ? (
                <div className="flex items-center gap-6">
                  <div className="h-48 w-48 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stageData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2} dataKey="value" animationDuration={600}>
                          {stageData.map((_entry, index) => (
                            <Cell key={index} fill={SLEEP_COLORS[index]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number, name: string) => [formatDuration(value), name]} contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-3">
                    {stageData.map((item, i) => {
                      const totalStage = latest.deep_sleep_min + latest.light_sleep_min + latest.rem_sleep_min + latest.awake_min;
                      return (
                        <div key={item.name} className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: SLEEP_COLORS[i] }} />
                          <span className="text-sm text-muted-foreground flex-1">{item.name}</span>
                          <span className="text-sm font-medium tabular-nums">{formatDuration(item.value)}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">{Math.round((item.value / totalStage) * 100)}%</span>
                        </div>
                      );
                    })}
                    <div className="pt-2 border-t flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(latest.start_time).toLocaleString('zh-CN')} - {new Date(latest.end_time).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground">暂无睡眠记录</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">睡眠评分趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} tickCount={5} />
                    <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px' }} formatter={(value: number) => [`${value} 分`, '评分']} />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]} animationDuration={600}>
                      {scoreData.map((entry, index) => (
                        <Cell key={index} fill={entry.score >= 85 ? '#22C55E' : entry.score >= 75 ? '#10B981' : entry.score >= 60 ? '#F97316' : '#EF4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-semibold">睡眠历史记录</CardTitle>
                <CardDescription>支持按睡眠等级、时间范围筛选，并支持勾选删除、全选本页和全选删除当前筛选结果。</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={recordLevelFilter}
                  onChange={(event) => setRecordLevelFilter(event.target.value as typeof recordLevelFilter)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none"
                >
                  <option value="all">全部等级</option>
                  <option value="excellent">优秀</option>
                  <option value="good">良好</option>
                  <option value="fair">一般</option>
                  <option value="poor">较差</option>
                </select>
                <select
                  value={recordTimeFilter}
                  onChange={(event) => setRecordTimeFilter(event.target.value as typeof recordTimeFilter)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none"
                >
                  <option value="7d">近 7 天</option>
                  <option value="30d">近 30 天</option>
                  <option value="all">全部记录</option>
                </select>
                <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                  {allSelected ? '取消全选' : '全选本页'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteAllFilteredRecords}
                  disabled={records.length === 0 || deletingAllFiltered}
                >
                  {deletingAllFiltered ? '删除中...' : `全选删除${records.length > 0 ? ` (${records.length})` : ''}`}
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={selectedCount === 0 || deletingSelected}>
                  {deletingSelected ? '删除中...' : `删除选中${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {recordsLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">加载中...</div>
            ) : records.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">当前筛选条件下暂无睡眠记录</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 px-3 text-left text-xs font-medium text-muted-foreground">选择</th>
                      <th className="py-3 px-3 text-left text-xs font-medium text-muted-foreground">日期</th>
                      <th className="py-3 px-3 text-left text-xs font-medium text-muted-foreground">入睡</th>
                      <th className="py-3 px-3 text-left text-xs font-medium text-muted-foreground">起床</th>
                      <th className="py-3 px-3 text-center text-xs font-medium text-muted-foreground">总时长</th>
                      <th className="py-3 px-3 text-center text-xs font-medium text-muted-foreground">深睡</th>
                      <th className="py-3 px-3 text-center text-xs font-medium text-muted-foreground">REM</th>
                      <th className="py-3 px-3 text-center text-xs font-medium text-muted-foreground">评分</th>
                      <th className="py-3 px-3 text-center text-xs font-medium text-muted-foreground">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => {
                      const total = r.deep_sleep_min + r.light_sleep_min + r.rem_sleep_min + r.awake_min;
                      return (
                        <tr key={r.id} className="border-b hover:bg-slate-50">
                          <td className="py-3 px-3">
                            <input type="checkbox" checked={selectedRecordIds.includes(r.id)} onChange={() => toggleSelectRecord(r.id)} />
                          </td>
                          <td className="py-3 px-3">{new Date(r.start_time).toLocaleDateString('zh-CN')}</td>
                          <td className="py-3 px-3">{new Date(r.start_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="py-3 px-3">{new Date(r.end_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="py-3 px-3 text-center tabular-nums">{formatDuration(total)}</td>
                          <td className="py-3 px-3 text-center tabular-nums">{formatDuration(r.deep_sleep_min)}</td>
                          <td className="py-3 px-3 text-center tabular-nums">{formatDuration(r.rem_sleep_min)}</td>
                          <td className="py-3 px-3 text-center">
                            <Badge variant="outline" className={getSleepLevelInfo(r.score).className}>
                              {r.score}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteOneRecord(r.id)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-600" />
                  睡眠报告历史
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
                  <option value="excellent">优秀</option>
                  <option value="good">良好</option>
                  <option value="fair">一般</option>
                  <option value="poor">较差</option>
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
          <CardContent>
            {latestReport && (
              <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-indigo-600">最新报告</Badge>
                      <span className="text-xs text-slate-500">{latestReport.report_no}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900">{latestReport.report_summary}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                      <span>评分 {latestReport.score} 分</span>
                      <span>总时长 {formatDuration(latestReport.total_sleep_min)}</span>
                      <span>深睡占比 {latestReport.deep_sleep_ratio}%</span>
                      <span>留存至 {new Date(latestReport.expires_at).toLocaleDateString('zh-CN')}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setSelectedReport(latestReport); setReportDialogOpen(true); }}>
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

            {reportsLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">加载中...</div>
            ) : reports.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">当前筛选条件下暂无睡眠报告</div>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <div key={report.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={getSleepLevelInfo(report.score).className}>
                            {getSleepLevelInfo(report.score).label}
                          </Badge>
                          <span className="text-xs text-slate-500">{report.report_no}</span>
                          <span className="text-xs text-muted-foreground">{new Date(report.recorded_at).toLocaleString('zh-CN')}</span>
                        </div>
                        <div className="text-sm font-medium text-slate-900">{report.report_title}</div>
                        <p className="text-sm text-slate-700">{report.report_summary}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>评分 {report.score} 分</span>
                          <span>总时长 {formatDuration(report.total_sleep_min)}</span>
                          <span>清醒占比 {report.awake_ratio}%</span>
                          <span>留存至 {new Date(report.expires_at).toLocaleDateString('zh-CN')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setSelectedReport(report); setReportDialogOpen(true); }}>
                          <Eye className="mr-1 h-4 w-4" />
                          查看
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportReport(report)}>
                          <Download className="mr-1 h-4 w-4" />
                          导出
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteReport(report.id)} disabled={deletingReportId === report.id}>
                          {deletingReportId === report.id ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-red-500" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedReport?.report_title ?? '睡眠分析报告'}</DialogTitle>
            <DialogDescription>
              {selectedReport ? `${selectedReport.report_no} · 生成于 ${new Date(selectedReport.recorded_at).toLocaleString('zh-CN')}` : '查看睡眠报告详情'}
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">睡眠评分</p>
                    <p className="mt-2 text-3xl font-bold text-indigo-600">{selectedReport.score}</p>
                    <Badge variant="outline" className={`mt-2 ${getSleepLevelInfo(selectedReport.score).className}`}>
                      {getSleepLevelInfo(selectedReport.score).label}
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">总时长</p>
                    <p className="mt-2 text-3xl font-bold text-blue-600">{formatDuration(selectedReport.total_sleep_min)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">深睡占比</p>
                    <p className="mt-2 text-3xl font-bold text-purple-600">{selectedReport.deep_sleep_ratio}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">清醒占比</p>
                    <p className="mt-2 text-3xl font-bold text-amber-600">{selectedReport.awake_ratio}%</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">报告摘要</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                    <span>睡眠时段：{new Date(selectedReport.start_time).toLocaleString('zh-CN')} - {new Date(selectedReport.end_time).toLocaleString('zh-CN')}</span>
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
                      <p className="text-xs text-muted-foreground">深睡</p>
                      <p className="mt-1 font-semibold">{formatDuration(selectedReport.deep_sleep_min)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">浅睡</p>
                      <p className="mt-1 font-semibold">{formatDuration(selectedReport.light_sleep_min)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">REM</p>
                      <p className="mt-1 font-semibold">{formatDuration(selectedReport.rem_sleep_min)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">清醒</p>
                      <p className="mt-1 font-semibold">{formatDuration(selectedReport.awake_min)}</p>
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
                    <div className="space-y-2">
                      {selectedReport.recommendations.map((item, index) => (
                        <p key={`${selectedReport.id}-${index}`} className="rounded-lg bg-indigo-50 px-3 py-2 text-indigo-800">
                          {index + 1}. {item}
                        </p>
                      ))}
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
