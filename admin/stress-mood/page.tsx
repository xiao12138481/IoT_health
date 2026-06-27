'use client';

/**
 * 管理员压力与情绪管理页面
 * 功能描述：
 * - 多人员压力状态概览与对比
 * - 人员分组与风险筛选
 * - 总体健康风险分析
 * - 批量报告生成与管理
 * - 详细历史记录查看
 */

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/layout/app-provider';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  Group,
  RefreshCw,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
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

interface PersonStressSummary {
  personId: number;
  name: string;
  latestStressScore: number | null;
  latestStressLevel: string;
  avgStressScore: number | null;
  maxStressScore: number | null;
  recordCount: number;
  latestRecordedAt: string | null;
  isAtRisk: boolean;
}

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

const getMoodLabel = (mood: string) => {
  switch (mood) {
    case 'calm': return '平静';
    case 'neutral': return '平稳';
    case 'anxious': return '焦虑';
    case 'stressed': return '紧张';
    default: return '未知';
  }
};

const getAutonomicLabel = (balance: string) => {
  switch (balance) {
    case 'balanced': return '自主神经平衡';
    case 'sympathetic': return '交感神经活跃';
    case 'hyper_aroused': return '高度唤醒';
    default: return '未知';
  }
};

export default function AdminStressMoodPage() {
  const { persons, currentPersonId, setCurrentPersonId, alarmCount } = useApp();
  /*页面核心状态*/
  const [allReports, setAllReports] = useState<StressMoodReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPersonIds, setSelectedPersonIds] = useState<number[]>([]);
  const [riskFilter, setRiskFilter] = useState<'all' | 'risk' | 'normal'>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'comparison' | 'reports'>('overview');
  const [timeRange, setTimeRange] = useState<'1d' | '3d' | '7d' | '30d'>('7d');
  // 报告筛选状态
  const [reportPersonFilter, setReportPersonFilter] = useState<number | 'all'>('all');
  const [reportLevelFilter, setReportLevelFilter] = useState<string>('all');
  const [reportDateStart, setReportDateStart] = useState<string>('');
  const [reportDateEnd, setReportDateEnd] = useState<string>('');
  const [personReportDialogOpen, setPersonReportDialogOpen] = useState(false);
  const [dialogPersonId, setDialogPersonId] = useState<number | null>(null);
  const [dialogReports, setDialogReports] = useState<StressMoodReport[]>([]);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [deletingAllReports, setDeletingAllReports] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState<number | null>(null);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [pendingDeleteAllPerson, setPendingDeleteAllPerson] = useState<{ id: number; name: string } | null>(null);
  const [dialogLevelFilter, setDialogLevelFilter] = useState<string>('all');
  const [dialogDateStart, setDialogDateStart] = useState<string>('');
  const [dialogDateEnd, setDialogDateEnd] = useState<string>('');
  const [selectedDialogReportId, setSelectedDialogReportId] = useState<number | null>(null);
  const [dialogPage, setDialogPage] = useState(1);
  const dialogPageSize = 5;

  /*加载所有人员的压力情绪报告数据*/
  const loadAllData = async () => {
    setLoading(true);
    const allReportsList: StressMoodReport[] = [];

    await Promise.all(
      persons.map(async (person) => {
        try {
          const reportsRes = await fetch(
            `/api/stress-mood-reports?person_id=${person.id}`,
            { cache: 'no-store' }
          );
          const reportsData = await reportsRes.json();
          const reports = reportsData.reports || [];
          allReportsList.push(...reports);
        } catch {
          /*忽略单个人员加载失败，继续其余人员*/
        }
      })
    );

    setAllReports(allReportsList);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, [persons]);

  /*按人员汇总最新压力评分和风险状态*/
  const personSummaries = useMemo<PersonStressSummary[]>(() => {
    return persons.map((person) => {
      const personReports = allReports.filter(r => r.person_id === person.id)
        .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
      
      const latest = personReports[0] || null;
      let latestStressScore = null;
      let latestStressLevel = 'unknown';
      let avgStressScore = null;
      let maxStressScore = null;
      let latestRecordedAt = null;
      let isAtRisk = false;

      if (latest) {
        latestStressScore = latest.stress_score;
        latestStressLevel = latest.stress_level;
        latestRecordedAt = latest.recorded_at;
        isAtRisk = ['high', 'severe', 'critical'].includes(latest.stress_level);
      }

      if (personReports.length > 0) {
        const scores = personReports.map((r) => r.stress_score || 0);
        avgStressScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        maxStressScore = Math.max(...scores);
        isAtRisk = isAtRisk || personReports.some((r) => ['high', 'severe', 'critical'].includes(r.stress_level));
      }

      return {
        personId: person.id,
        name: person.name,
        latestStressScore,
        latestStressLevel,
        avgStressScore,
        maxStressScore,
        recordCount: personReports.length,
        latestRecordedAt,
        isAtRisk,
      };
    });
  }, [persons, allReports]);

  /*根据风险筛选人员摘要*/
  const filteredSummaries = useMemo(() => {
    if (riskFilter === 'all') return personSummaries;
    if (riskFilter === 'risk') return personSummaries.filter((s) => s.isAtRisk);
    return personSummaries.filter((s) => !s.isAtRisk);
  }, [personSummaries, riskFilter]);

  /*计算页面顶部总览统计*/
  const overviewStats = useMemo(() => {
    const total = personSummaries.length;
    const atRisk = personSummaries.filter((s) => s.isAtRisk).length;
    const normal = total - atRisk;
    const avgScores = personSummaries
      .filter((s) => s.avgStressScore !== null)
      .map((s) => s.avgStressScore as number);
    const overallAvg = avgScores.length > 0
      ? Math.round(avgScores.reduce((a, b) => a + b, 0) / avgScores.length)
      : null;

    return { total, atRisk, normal, overallAvg };
  }, [personSummaries]);

  /*整理人员对比图表数据*/
  const comparisonChartData = useMemo(() => {
    const selected = selectedPersonIds.length > 0
      ? personSummaries.filter((s) => selectedPersonIds.includes(s.personId))
      : personSummaries.slice(0, 5);

    return selected.map((s) => ({
      name: s.name,
      avg: s.avgStressScore || 0,
      max: s.maxStressScore || 0,
    }));
  }, [personSummaries, selectedPersonIds]);

  /*按条件筛选全量报告列表*/
  const filteredReports = useMemo(() => {
    let filtered = [...allReports];

    /*按人员筛选*/
    if (reportPersonFilter !== 'all') {
      filtered = filtered.filter(r => r.person_id === reportPersonFilter);
    }

    /*按压力等级筛选*/
    if (reportLevelFilter !== 'all') {
      filtered = filtered.filter(r => r.stress_level === reportLevelFilter);
    }

    /*按时间范围筛选*/
    if (reportDateStart) {
      const startDate = new Date(reportDateStart);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(r => new Date(r.recorded_at) >= startDate);
    }
    if (reportDateEnd) {
      const endDate = new Date(reportDateEnd);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => new Date(r.recorded_at) <= endDate);
    }

    /*按时间倒序排列*/
    return filtered.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
  }, [allReports, reportPersonFilter, reportLevelFilter, reportDateStart, reportDateEnd]);

  /*切换人员对比勾选状态*/
  const togglePersonSelection = (personId: number) => {
    setSelectedPersonIds((prev) =>
      prev.includes(personId)
        ? prev.filter((id) => id !== personId)
        : [...prev, personId]
    );
  };

  /*切换当前筛选结果的全选状态*/
  const toggleAllSelection = () => {
    if (selectedPersonIds.length === filteredSummaries.length) {
      setSelectedPersonIds([]);
    } else {
      setSelectedPersonIds(filteredSummaries.map((s) => s.personId));
    }
  };

  const dialogPerson = persons.find((person) => person.id === dialogPersonId) || null;
  const dialogPersonSummary = personSummaries.find((summary) => summary.personId === dialogPersonId) || null;
  const selectedDialogReport = dialogReports.find((report) => report.id === selectedDialogReportId) || null;

  /*在对话框内按条件筛选该人员的报告*/
  const filteredDialogReports = useMemo(() => {
    let filtered = [...dialogReports];

    if (dialogLevelFilter !== 'all') {
      filtered = filtered.filter((report) => report.stress_level === dialogLevelFilter);
    }

    if (dialogDateStart) {
      const startDate = new Date(dialogDateStart);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((report) => new Date(report.recorded_at) >= startDate);
    }

    if (dialogDateEnd) {
      const endDate = new Date(dialogDateEnd);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((report) => new Date(report.recorded_at) <= endDate);
    }

    return filtered.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
  }, [dialogDateEnd, dialogDateStart, dialogLevelFilter, dialogReports]);

  const dialogTotalPages = Math.max(1, Math.ceil(filteredDialogReports.length / dialogPageSize));
  /*对话框内按页截取报告数据*/
  const paginatedDialogReports = useMemo(() => {
    const startIndex = (dialogPage - 1) * dialogPageSize;
    return filteredDialogReports.slice(startIndex, startIndex + dialogPageSize);
  }, [dialogPage, dialogPageSize, filteredDialogReports]);

  /*筛选条件变化后重置对话框分页*/
  useEffect(() => {
    setDialogPage(1);
  }, [dialogLevelFilter, dialogDateStart, dialogDateEnd, dialogPersonId]);

  /*保证对话框页码不超过最大页数*/
  useEffect(() => {
    if (dialogPage > dialogTotalPages) {
      setDialogPage(dialogTotalPages);
    }
  }, [dialogPage, dialogTotalPages]);

  /*导出单份压力情绪报告为文本文件*/
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

  /*打印单份压力情绪报告*/
  const printReport = (report: StressMoodReport) => {
    const personName = persons.find((person) => person.id === report.person_id)?.name ?? `人员${report.person_id}`;
    const printWindow = window.open('', '_blank', 'width=960,height=800');
    if (!printWindow) {
      alert('无法打开打印窗口，请检查浏览器是否拦截弹窗。');
      return;
    }

    const recommendationItems = report.recommendations
      .map((item, index) => `<li>${index + 1}. ${item}</li>`)
      .join('');
    const riskItems = report.risk_flags.length > 0
      ? report.risk_flags.map((item) => `<li>${item}</li>`).join('')
      : '<li>暂无明显风险提示</li>';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <title>${report.report_no}</title>
          <style>
            body { font-family: Arial, "Microsoft YaHei", sans-serif; padding: 24px; color: #0f172a; }
            h1 { font-size: 24px; margin-bottom: 8px; }
            h2 { font-size: 18px; margin: 24px 0 12px; }
            p, li { font-size: 14px; line-height: 1.7; }
            .meta { color: #475569; margin-bottom: 18px; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
            .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
            ul { padding-left: 20px; }
          </style>
        </head>
        <body>
          <h1>${report.report_title}</h1>
          <div class="meta">
            <p>报告编号：${report.report_no}</p>
            <p>监测对象：${personName}</p>
            <p>生成时间：${new Date(report.recorded_at).toLocaleString('zh-CN')}</p>
            <p>报告周期：${new Date(report.report_start).toLocaleString('zh-CN')} - ${new Date(report.report_end).toLocaleString('zh-CN')}</p>
          </div>
          <div class="grid">
            <div class="card"><strong>压力评分：</strong>${report.stress_score} 分</div>
            <div class="card"><strong>压力等级：</strong>${getStressLevelInfo(report.stress_level).label}</div>
            <div class="card"><strong>情绪状态：</strong>${getMoodLabel(report.mood_state)}</div>
            <div class="card"><strong>自主神经：</strong>${getAutonomicLabel(report.autonomic_balance)}</div>
            <div class="card"><strong>平均心率：</strong>${report.avg_heart_rate} bpm</div>
            <div class="card"><strong>HRV 均值：</strong>${report.hrv_mean} ms</div>
          </div>
          <h2>报告摘要</h2>
          <p>${report.report_summary}</p>
          <p>${report.analysis}</p>
          <h2>具体数据</h2>
          <ul>
            <li>当前心率：${report.latest_heart_rate} bpm</li>
            <li>最低心率：${report.min_heart_rate} bpm</li>
            <li>最高心率：${report.max_heart_rate} bpm</li>
            <li>SDNN：${report.hrv_sdnn} ms</li>
            <li>RMSSD：${report.hrv_rmssd} ms</li>
            <li>pNN50：${report.hrv_pnn50} %</li>
            <li>采样数量：${report.sample_count} 条</li>
          </ul>
          <h2>风险提示</h2>
          <ul>${riskItems}</ul>
          <h2>建议</h2>
          <ul>${recommendationItems}</ul>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  /*加载指定人员的报告历史*/
  const loadPersonReports = async (personId: number) => {
    setDialogLoading(true);
    try {
      const response = await fetch(`/api/stress-mood-reports?person_id=${personId}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('加载报告失败');
      }

      const data = await response.json();
      setDialogReports(data.reports || []);
    } catch {
      setDialogReports([]);
      alert('加载该用户报告历史失败');
    } finally {
      setDialogLoading(false);
    }
  };

  /*打开指定人员的报告历史对话框*/
  const handleOpenPersonReports = async (personId: number) => {
    setDialogPersonId(personId);
    setPersonReportDialogOpen(true);
    setDialogLevelFilter('all');
    setDialogDateStart('');
    setDialogDateEnd('');
    setSelectedDialogReportId(null);
    await loadPersonReports(personId);
  };

  /*打开删除该人员全部报告的确认框*/
  const requestDeleteAllReportsByPerson = (personId: number, personName: string) => {
    setPendingDeleteAllPerson({ id: personId, name: personName });
    setDeleteAllDialogOpen(true);
  };

  /*删除指定人员的全部压力情绪报告*/
  const handleDeleteAllReportsByPerson = async (personId: number, personName: string) => {
    setDeletingAllReports(true);
    try {
      const response = await fetch(`/api/stress-mood-reports?deleteAll=true&personId=${personId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('删除失败');
      }

      setAllReports((current) => current.filter((report) => report.person_id !== personId));
      if (dialogPersonId === personId) {
        setDialogReports([]);
        setSelectedDialogReportId(null);
      }
      if (reportPersonFilter === personId) {
        setReportPersonFilter('all');
      }
      setDeleteAllDialogOpen(false);
      setPendingDeleteAllPerson(null);
      alert(`${personName} 的全部压力与情绪报告已删除`);
    } catch {
      alert('删除该用户全部报告失败');
    } finally {
      setDeletingAllReports(false);
    }
  };

  /*删除单份压力情绪报告*/
  const handleDeleteSingleReport = async (report: StressMoodReport) => {
    if (!confirm('确定要删除这份报告吗？删除后将无法恢复。')) {
      return;
    }

    setDeletingReportId(report.id);
    try {
      const response = await fetch(`/api/stress-mood-reports?id=${report.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('删除失败');
      }

      setAllReports((current) => current.filter((item) => item.id !== report.id));
      setDialogReports((current) => current.filter((item) => item.id !== report.id));
      if (selectedDialogReportId === report.id) {
        setSelectedDialogReportId(null);
      }
      alert('该报告已删除');
    } catch {
      alert('删除报告失败');
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="h-7 w-7 text-blue-500" />
              压力与情绪管理中心
            </h2>
            <p className="text-sm text-muted-foreground mt-1">多人员压力监测、风险评估与健康分析</p>
          </div>
          <div className="flex gap-2">
            <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">24小时</SelectItem>
                <SelectItem value="3d">3天</SelectItem>
                <SelectItem value="7d">7天</SelectItem>
                <SelectItem value="30d">30天</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={loadAllData} disabled={loading} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </div>

        {/* 概览卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-slate-600" />
                <span className="text-xs text-muted-foreground">总监测人数</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{overviewStats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-xs text-muted-foreground">高风险人数</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{overviewStats.atRisk}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-xs text-muted-foreground">状态正常人数</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{overviewStats.normal}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <span className="text-xs text-muted-foreground">总体平均压力</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">
                {overviewStats.overallAvg !== null ? `${overviewStats.overallAvg} 分` : '--'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 主内容区 Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <Group className="h-4 w-4" />
              人员概览
            </TabsTrigger>
            <TabsTrigger value="comparison" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              数据对比
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <FileText className="h-4 w-4" />
              报告管理
            </TabsTrigger>
          </TabsList>

          {/* 概览 Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-600" />
                <span className="text-sm text-slate-700">筛选：</span>
                <Select value={riskFilter} onValueChange={(v: any) => setRiskFilter(v)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部人员</SelectItem>
                    <SelectItem value="risk">仅高风险</SelectItem>
                    <SelectItem value="normal">仅正常状态</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={toggleAllSelection}>
                {selectedPersonIds.length === filteredSummaries.length ? '取消全选' : '全选'}
              </Button>
            </div>

            <ScrollArea className="h-[500px] rounded-lg border">
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <Card key={idx}>
                      <CardContent className="pt-4">
                        <div className="h-24 flex items-center justify-center">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : filteredSummaries.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-500">
                    暂无符合条件的人员数据
                  </div>
                ) : (
                  filteredSummaries.map((summary) => {
                    const stressInfo = getStressLevelInfo(summary.latestStressLevel);
                    const isSelected = selectedPersonIds.includes(summary.personId);
                    return (
                      <Card
                        key={summary.personId}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          isSelected ? 'ring-2 ring-blue-500' : ''
                        } ${summary.isAtRisk ? 'border-red-200' : ''}`}
                        onClick={() => void handleOpenPersonReports(summary.personId)}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                                <span className="text-sm font-medium">
                                  {summary.name[0]}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium">{summary.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {summary.recordCount} 条记录
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div
                                className="flex items-center gap-2 rounded-md border px-2 py-1"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => togglePersonSelection(summary.personId)}
                                  aria-label={`选择 ${summary.name} 用于对比`}
                                />
                                <span className="text-xs text-slate-600">对比</span>
                              </div>
                              <Badge
                                style={{ backgroundColor: stressInfo.color }}
                                className="text-white"
                              >
                                {stressInfo.label}
                              </Badge>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-xs text-muted-foreground">
                                当前压力
                              </span>
                              <p className="text-lg font-bold text-slate-900">
                                {summary.latestStressScore !== null
                                  ? `${summary.latestStressScore} 分`
                                  : '--'}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">
                                平均压力
                              </span>
                              <p className="text-lg font-bold text-slate-900">
                                {summary.avgStressScore !== null
                                  ? `${summary.avgStressScore} 分`
                                  : '--'}
                              </p>
                            </div>
                          </div>

                          {summary.isAtRisk && (
                            <div className="mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded px-3 py-2">
                              <AlertTriangle className="h-3 w-3" />
                              <span>需要关注该人员状态</span>
                            </div>
                          )}
                          <div className="mt-3 text-xs text-blue-600">点击卡片查看该用户报告历史</div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* 对比 Tab */}
          <TabsContent value="comparison" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>平均压力对比</CardTitle>
                  <CardDescription>
                    {selectedPersonIds.length > 0
                      ? `${selectedPersonIds.length} 人`
                      : '前 5 人'}的平均压力对比
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    {comparisonChartData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-500">
                        暂无对比数据
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparisonChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis domain={[0, 100]} />
                          <Tooltip />
                          <Bar dataKey="avg" name="平均压力" fill="#3b82f6">
                            {comparisonChartData.map((_, index) => (
                              <Cell key={index} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>最高压力对比</CardTitle>
                  <CardDescription>
                    所选人员在该时间段内的最高压力值
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    {comparisonChartData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-500">
                        暂无对比数据
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={comparisonChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis domain={[0, 100]} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="max"
                            name="最高压力"
                            stroke="#ef4444"
                            strokeWidth={3}
                            dot={{ r: 6 }}
                            activeDot={{ r: 8 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 报告 Tab */}
          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <CardTitle>压力与情绪报告</CardTitle>
                    <CardDescription>所有人员生成的压力与情绪报告历史</CardDescription>
                  </div>
                  {/* 筛选区域 */}
                  <div className="flex flex-wrap gap-3">
                    <div className="space-y-1">
                      <span className="text-xs text-slate-500">按人员筛选</span>
                      <Select value={String(reportPersonFilter)} onValueChange={(v) => setReportPersonFilter(v === 'all' ? 'all' : Number(v))}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="选择人员" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部人员</SelectItem>
                          {persons.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-slate-500">按压力等级筛选</span>
                      <Select value={reportLevelFilter} onValueChange={setReportLevelFilter}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="选择等级" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部等级</SelectItem>
                          <SelectItem value="low">低压力</SelectItem>
                          <SelectItem value="calm">平静</SelectItem>
                          <SelectItem value="moderate">中等压力</SelectItem>
                          <SelectItem value="high">高压力</SelectItem>
                          <SelectItem value="severe">严重压力</SelectItem>
                          <SelectItem value="critical">危机状态</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-slate-500">开始日期</span>
                      <Input
                        type="date"
                        value={reportDateStart}
                        onChange={(e) => setReportDateStart(e.target.value)}
                        className="w-[180px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-slate-500">结束日期</span>
                      <Input
                        type="date"
                        value={reportDateEnd}
                        onChange={(e) => setReportDateEnd(e.target.value)}
                        className="w-[180px]"
                      />
                    </div>
                    {(reportDateStart || reportDateEnd) && (
                      <div className="flex items-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReportDateStart('');
                            setReportDateEnd('');
                          }}
                        >
                          清除日期
                        </Button>
                      </div>
                    )}
                    {reportPersonFilter !== 'all' && (
                      <div className="flex items-end">
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deletingAllReports}
                          onClick={() => {
                            const selectedPerson = persons.find((person) => person.id === reportPersonFilter);
                            if (!selectedPerson) return;
                            requestDeleteAllReportsByPerson(selectedPerson.id, selectedPerson.name);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除该用户全部报告
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {filteredReports.length === 0 ? (
                      <div className="py-12 text-center text-slate-500">
                        暂无符合条件的报告记录
                      </div>
                    ) : (
                      filteredReports.map((report) => {
                        const personName = persons.find((p) => p.id === report.person_id)?.name || `人员${report.person_id}`;
                        const stressInfo = getStressLevelInfo(report.stress_level);
                        return (
                          <div key={report.id} className="p-4 rounded-lg border">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <Badge style={{ backgroundColor: stressInfo.color }} className="text-white">
                                    {stressInfo.label}
                                  </Badge>
                                  <span className="text-sm font-medium">{personName}</span>
                                  <span className="text-xs text-slate-500">{report.report_no}</span>
                                </div>
                                <p className="text-sm text-slate-900 font-medium">
                                  {report.report_title}
                                </p>
                                <p className="text-xs text-slate-600 mt-1">
                                  {report.report_summary}
                                </p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                                  <span>压力 {report.stress_score} 分</span>
                                  <span>平均心率 {report.avg_heart_rate} bpm</span>
                                  <span>HRV {report.hrv_mean} ms</span>
                                  <span>生成于 {new Date(report.recorded_at).toLocaleString('zh-CN')}</span>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleOpenPersonReports(report.person_id)}
                              >
                                查看该用户历史
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={personReportDialogOpen} onOpenChange={setPersonReportDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <div>
              <DialogTitle>{dialogPerson?.name || '用户'}的压力与情绪报告历史</DialogTitle>
              <DialogDescription>
                {dialogPersonSummary
                  ? `共 ${dialogPersonSummary.recordCount} 份报告，最新压力等级为 ${getStressLevelInfo(dialogPersonSummary.latestStressLevel).label}`
                  : '查看该用户的历史报告记录'}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">报告数量</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{dialogPersonSummary?.recordCount ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">当前压力</p>
                <p className="mt-2 text-3xl font-bold text-blue-600">
                  {dialogPersonSummary?.latestStressScore !== null && dialogPersonSummary?.latestStressScore !== undefined
                    ? dialogPersonSummary.latestStressScore
                    : '--'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">平均压力</p>
                <p className="mt-2 text-3xl font-bold text-purple-600">
                  {dialogPersonSummary?.avgStressScore !== null && dialogPersonSummary?.avgStressScore !== undefined
                    ? dialogPersonSummary.avgStressScore
                    : '--'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">风险状态</p>
                <div className="mt-2">
                  <Badge
                    className="text-white"
                    style={{ backgroundColor: getStressLevelInfo(dialogPersonSummary?.latestStressLevel || 'unknown').color }}
                  >
                    {getStressLevelInfo(dialogPersonSummary?.latestStressLevel || 'unknown').label}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-wrap gap-3">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500">按压力等级筛选</span>
                  <Select value={dialogLevelFilter} onValueChange={setDialogLevelFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="全部等级" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部等级</SelectItem>
                      <SelectItem value="low">低压力</SelectItem>
                      <SelectItem value="calm">平静</SelectItem>
                      <SelectItem value="moderate">中等压力</SelectItem>
                      <SelectItem value="high">高压力</SelectItem>
                      <SelectItem value="severe">严重压力</SelectItem>
                      <SelectItem value="critical">危机状态</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-slate-500">开始日期</span>
                  <Input
                    type="date"
                    value={dialogDateStart}
                    onChange={(event) => setDialogDateStart(event.target.value)}
                    className="w-[180px]"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-slate-500">结束日期</span>
                  <Input
                    type="date"
                    value={dialogDateEnd}
                    onChange={(event) => setDialogDateEnd(event.target.value)}
                    className="w-[180px]"
                  />
                </div>
                {(dialogDateStart || dialogDateEnd || dialogLevelFilter !== 'all') && (
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDialogLevelFilter('all');
                        setDialogDateStart('');
                        setDialogDateEnd('');
                      }}
                    >
                      清除筛选
                    </Button>
                  </div>
                )}
                </div>
                {dialogPerson && (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deletingAllReports}
                    onClick={() => requestDeleteAllReportsByPerson(dialogPerson.id, dialogPerson.name)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除该用户全部报告
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {selectedDialogReport && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">报告详情</CardTitle>
                    <CardDescription>
                      {selectedDialogReport.report_no} · 生成于 {new Date(selectedDialogReport.recorded_at).toLocaleString('zh-CN')}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => exportReport(selectedDialogReport)}>
                      <Download className="mr-2 h-4 w-4" />
                      导出报告
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => printReport(selectedDialogReport)}>
                      打印版
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deletingReportId === selectedDialogReport.id}
                      onClick={() => void handleDeleteSingleReport(selectedDialogReport)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      删除报告
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setSelectedDialogReportId(null)}>
                      收起详情
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">压力评分</p>
                      <p className="mt-2 text-3xl font-bold text-blue-600">{selectedDialogReport.stress_score}</p>
                      <Badge className="mt-2 text-white" style={{ backgroundColor: getStressLevelInfo(selectedDialogReport.stress_level).color }}>
                        {getStressLevelInfo(selectedDialogReport.stress_level).label}
                      </Badge>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">情绪状态</p>
                      <p className="mt-2 text-lg font-semibold">{getMoodLabel(selectedDialogReport.mood_state)}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{getAutonomicLabel(selectedDialogReport.autonomic_balance)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">平均心率</p>
                      <p className="mt-2 text-3xl font-bold text-emerald-600">{selectedDialogReport.avg_heart_rate}</p>
                      <p className="mt-2 text-xs text-muted-foreground">最新 {selectedDialogReport.latest_heart_rate} bpm</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">HRV 均值</p>
                      <p className="mt-2 text-3xl font-bold text-purple-600">{selectedDialogReport.hrv_mean}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{selectedDialogReport.sample_count} 条采样</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">报告摘要</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                      <span>报告周期：{new Date(selectedDialogReport.report_start).toLocaleString('zh-CN')} - {new Date(selectedDialogReport.report_end).toLocaleString('zh-CN')}</span>
                      <span>留存截止：{new Date(selectedDialogReport.expires_at).toLocaleString('zh-CN')}</span>
                    </div>
                    <p>{selectedDialogReport.report_summary}</p>
                    <p>{selectedDialogReport.analysis}</p>
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
                        <p className="mt-1 font-semibold">{selectedDialogReport.min_heart_rate} bpm</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">最高心率</p>
                        <p className="mt-1 font-semibold">{selectedDialogReport.max_heart_rate} bpm</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">SDNN</p>
                        <p className="mt-1 font-semibold">{selectedDialogReport.hrv_sdnn} ms</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">RMSSD</p>
                        <p className="mt-1 font-semibold">{selectedDialogReport.hrv_rmssd} ms</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">pNN50</p>
                        <p className="mt-1 font-semibold">{selectedDialogReport.hrv_pnn50} %</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">采样数量</p>
                        <p className="mt-1 font-semibold">{selectedDialogReport.sample_count} 条</p>
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
                          {selectedDialogReport.risk_flags.length > 0 ? (
                            selectedDialogReport.risk_flags.map((item) => (
                              <Badge key={`${selectedDialogReport.id}-${item}`} variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
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
                          {selectedDialogReport.recommendations.map((item, index) => (
                            <p key={`${selectedDialogReport.id}-${index}`} className="rounded-lg bg-blue-50 px-3 py-2 text-blue-800">
                              {index + 1}. {item}
                            </p>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          )}

          <ScrollArea className="h-[420px] rounded-lg border">
            <div className="space-y-3 p-4">
              {dialogLoading ? (
                <div className="flex h-48 items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
                </div>
              ) : filteredDialogReports.length === 0 ? (
                <div className="py-16 text-center text-slate-500">
                  暂无符合筛选条件的报告
                </div>
              ) : (
                paginatedDialogReports.map((report) => {
                  const stressInfo = getStressLevelInfo(report.stress_level);
                  return (
                    <div
                      key={report.id}
                      className={`rounded-lg border p-4 ${selectedDialogReportId === report.id ? 'border-blue-300 bg-blue-50/40' : ''}`}
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge style={{ backgroundColor: stressInfo.color }} className="text-white">
                            {stressInfo.label}
                          </Badge>
                          <span className="text-sm font-medium text-slate-900">{report.report_title}</span>
                          <span className="text-xs text-slate-500">{report.report_no}</span>
                        </div>
                        <p className="text-sm text-slate-600">{report.report_summary}</p>
                        <div className="grid gap-2 text-xs text-slate-500 md:grid-cols-2 xl:grid-cols-4">
                          <span>压力评分：{report.stress_score} 分</span>
                          <span>平均心率：{report.avg_heart_rate} bpm</span>
                          <span>HRV：{report.hrv_mean} ms</span>
                          <span>生成时间：{new Date(report.recorded_at).toLocaleString('zh-CN')}</span>
                        </div>
                        {report.risk_flags.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {report.risk_flags.map((item) => (
                              <Badge key={`${report.id}-${item}`} variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
                                {item}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button variant="outline" size="sm" onClick={() => setSelectedDialogReportId(report.id)}>
                            查看详情
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => exportReport(report)}>
                            <Download className="mr-2 h-4 w-4" />
                            导出
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => printReport(report)}>
                            打印版
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={deletingReportId === report.id}
                            onClick={() => void handleDeleteSingleReport(report)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {filteredDialogReports.length > 0 && (
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>
                第 {dialogPage} / {dialogTotalPages} 页，共 {filteredDialogReports.length} 条记录
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={dialogPage <= 1}
                  onClick={() => setDialogPage((current) => Math.max(1, current - 1))}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={dialogPage >= dialogTotalPages}
                  onClick={() => setDialogPage((current) => Math.min(dialogTotalPages, current + 1))}
                >
                  下一页
                </Button>
                <Select value={String(dialogPage)} onValueChange={(value) => setDialogPage(Number(value))}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="跳转页码" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: dialogTotalPages }, (_, index) => (
                      <SelectItem key={index + 1} value={String(index + 1)}>
                        第 {index + 1} 页
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPersonReportDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteAllDialogOpen}
        onOpenChange={(open) => {
          setDeleteAllDialogOpen(open);
          if (!open && !deletingAllReports) {
            setPendingDeleteAllPerson(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除全部报告</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteAllPerson
                ? `确定要删除 ${pendingDeleteAllPerson.name} 的全部压力与情绪报告吗？该操作不可恢复。`
                : '该操作不可恢复，请确认是否继续。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAllReports}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deletingAllReports || !pendingDeleteAllPerson}
              onClick={() => {
                if (pendingDeleteAllPerson) {
                  void handleDeleteAllReportsByPerson(pendingDeleteAllPerson.id, pendingDeleteAllPerson.name);
                }
              }}
            >
              {deletingAllReports ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
