'use client';

/*安全处理 findings 字段的辅助函数*/
const safeGetFindings = (findings: any): string => {
  if (!findings) return '';
  if (typeof findings === 'string') return findings;
  if (typeof findings === 'object') {
    /*如果是对象，格式化显示*/
    return Object.entries(findings)
      .map(([key, value]) => `${key}: ${value}`)
      .join('；');
  }
  return String(findings);
};

/**
 * 管理员血管弹性评估管理页面
 * 功能描述：
 * - 多人员血管健康状态概览
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
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  Group,
  RefreshCw,
  Trash2,
  TrendingUp,
  Users,
  Activity as VesselIcon,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';

/*血管评估报告数据类型*/
interface VascularAssessmentReport {
  id: number;
  person_id: number;
  report_no: string;
  report_title: string;
  report_summary: string;
  health_score: number;
  elasticity_level: string;
  systolic_max: number | null;
  systolic_min: number | null;
  systolic_range: number;
  diastolic_max: number | null;
  diastolic_min: number | null;
  diastolic_range: number;
  bp_measurement_count: number;
  findings: string;
  assessment_result: string;
  recommendations: string[];
  blood_pressure_summary: string[];
  risk_flags: string[];
  assessment_date: string;
  report_start: string;
  report_end: string;
  recorded_at: string;
  expires_at: string;
}

/*人员血管评估摘要数据类型*/
interface PersonVascularSummary {
  personId: number;
  name: string;
  latestScore: number | null;
  latestLevel: string;
  avgScore: number | null;
  maxRange: { systolic: number; diastolic: number } | null;
  reportCount: number;
  latestDate: string | null;
  isAtRisk: boolean;
}

/*弹性级别标签配置*/
const ELASTICITY_LABELS = {
  excellent: { text: '优秀', color: '#22c55e' },
  good: { text: '良好', color: '#10b981' },
  moderate: { text: '一般', color: '#eab308' },
  fair: { text: '一般', color: '#eab308' },
  poor: { text: '较差', color: '#f97316' },
  danger: { text: '危险', color: '#dc2626' },
  critical: { text: '危险', color: '#dc2626' },
} as const;

/*根据评分获取颜色函数*/
const getScoreColor = (score: number) => {
  if (score >= 90) return '#22c55e';
  if (score >= 75) return '#10b981';
  if (score >= 60) return '#eab308';
  if (score >= 40) return '#f97316';
  return '#dc2626';
};

/*获取级别信息函数*/
const getLevelInfo = (level: string) => {
  return ELASTICITY_LABELS[level as keyof typeof ELASTICITY_LABELS] || ELASTICITY_LABELS.fair;
};

export default function AdminVascularAssessmentPage() {
  const { persons, currentPersonId, setCurrentPersonId, alarmCount } = useApp();
  /*页面核心状态*/
  const [allReports, setAllReports] = useState<VascularAssessmentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPersonIds, setSelectedPersonIds] = useState<number[]>([]);
  const [riskFilter, setRiskFilter] = useState<'all' | 'risk' | 'normal'>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'comparison' | 'reports'>('overview');
  const [reportPersonFilter, setReportPersonFilter] = useState<number | 'all'>('all');
  const [reportLevelFilter, setReportLevelFilter] = useState<string>('all');
  const [reportDateStart, setReportDateStart] = useState<string>('');
  const [reportDateEnd, setReportDateEnd] = useState<string>('');
  const [personReportDialogOpen, setPersonReportDialogOpen] = useState(false);
  const [dialogPersonId, setDialogPersonId] = useState<number | null>(null);
  const [dialogReports, setDialogReports] = useState<VascularAssessmentReport[]>([]);
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

  /*加载所有人员的血管评估报告数据*/
  const loadAllData = async () => {
    setLoading(true);
    try {
      const reportPromises = persons.map((person) =>
        fetch(`/api/vascular-assessment-reports?person_id=${person.id}`, { cache: 'no-store' })
          .then((response) => response.json())
          .catch(() => ({ reports: [] }))
      );

      const reportResults = await Promise.all(reportPromises);
      const reports = reportResults.flatMap((result) => result.reports || []);
      setAllReports(reports);
    } catch (error) {
      console.error('加载血管评估报告失败', error);
      setAllReports([]);
    } finally {
      setLoading(false);
    }
  };

  /*人员列表变化后重新加载全部报告*/
  useEffect(() => {
    void loadAllData();
  }, [persons]);

  /*按人员汇总最新评分和风险状态*/
  const personSummaries = useMemo<PersonVascularSummary[]>(() => {
    return persons.map((person) => {
      const personReports = allReports
        .filter((report) => report.person_id === person.id)
        .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());

      const latest = personReports[0] || null;
      let latestScore: number | null = null;
      let latestLevel = 'fair';
      let avgScore: number | null = null;
      let maxRange: { systolic: number; diastolic: number } | null = null;
      let latestDate: string | null = null;
      let isAtRisk = false;

      if (latest) {
        latestScore = latest.health_score;
        latestLevel = latest.elasticity_level;
        latestDate = latest.recorded_at;
        isAtRisk = ['poor', 'danger', 'critical'].includes(latest.elasticity_level);
      }

      if (personReports.length > 0) {
        avgScore = Math.round(
          personReports.reduce((sum, report) => sum + (report.health_score || 0), 0) / personReports.length
        );
        maxRange = personReports.reduce(
          (currentMax, report) => ({
            systolic: Math.max(currentMax.systolic, report.systolic_range || 0),
            diastolic: Math.max(currentMax.diastolic, report.diastolic_range || 0),
          }),
          { systolic: 0, diastolic: 0 }
        );
        isAtRisk =
          isAtRisk || personReports.some((report) => ['poor', 'danger', 'critical'].includes(report.elasticity_level));
      }

      return {
        personId: person.id,
        name: person.name,
        latestScore,
        latestLevel,
        avgScore,
        maxRange,
        reportCount: personReports.length,
        latestDate,
        isAtRisk,
      };
    });
  }, [allReports, persons]);

  /*根据风险筛选人员摘要*/
  const filteredSummaries = useMemo(() => {
    if (riskFilter === 'all') return personSummaries;
    if (riskFilter === 'risk') return personSummaries.filter((summary) => summary.isAtRisk);
    return personSummaries.filter((summary) => !summary.isAtRisk);
  }, [personSummaries, riskFilter]);

  /*计算页面顶部总览统计*/
  const overviewStats = useMemo(() => {
    const total = personSummaries.length;
    const atRisk = personSummaries.filter((summary) => summary.isAtRisk).length;
    const normal = total - atRisk;
    const avgScores = personSummaries
      .filter((summary) => summary.avgScore !== null)
      .map((summary) => summary.avgScore as number);
    const overallAvg =
      avgScores.length > 0 ? Math.round(avgScores.reduce((sum, score) => sum + score, 0) / avgScores.length) : null;

    return { total, atRisk, normal, overallAvg };
  }, [personSummaries]);

  /*整理人员对比图表数据*/
  const comparisonChartData = useMemo(() => {
    const selected =
      selectedPersonIds.length > 0
        ? personSummaries.filter((summary) => selectedPersonIds.includes(summary.personId))
        : personSummaries.slice(0, 5);

    return selected.map((summary) => ({
      name: summary.name,
      平均评分: summary.avgScore || 0,
      最新评分: summary.latestScore || 0,
      收缩压极差: summary.maxRange?.systolic || 0,
      舒张压极差: summary.maxRange?.diastolic || 0,
    }));
  }, [personSummaries, selectedPersonIds]);

  /*按条件筛选全量血管评估报告*/
  const filteredReports = useMemo(() => {
    let filtered = [...allReports];

    if (reportPersonFilter !== 'all') {
      filtered = filtered.filter((report) => report.person_id === reportPersonFilter);
    }

    if (reportLevelFilter !== 'all') {
      filtered = filtered.filter((report) => report.elasticity_level === reportLevelFilter);
    }

    if (reportDateStart) {
      const startDate = new Date(reportDateStart);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((report) => new Date(report.recorded_at) >= startDate);
    }

    if (reportDateEnd) {
      const endDate = new Date(reportDateEnd);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((report) => new Date(report.recorded_at) <= endDate);
    }

    return filtered.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
  }, [allReports, reportDateEnd, reportDateStart, reportLevelFilter, reportPersonFilter]);

  /*切换人员对比勾选状态*/
  const togglePersonSelection = (personId: number) => {
    setSelectedPersonIds((current) =>
      current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId]
    );
  };

  /*切换当前筛选结果的全选状态*/
  const toggleAllSelection = () => {
    if (selectedPersonIds.length === filteredSummaries.length) {
      setSelectedPersonIds([]);
    } else {
      setSelectedPersonIds(filteredSummaries.map((summary) => summary.personId));
    }
  };

  const dialogPerson = persons.find((person) => person.id === dialogPersonId) || null;
  const dialogPersonSummary = personSummaries.find((summary) => summary.personId === dialogPersonId) || null;
  const selectedDialogReport = dialogReports.find((report) => report.id === selectedDialogReportId) || null;

  /*在对话框内按条件筛选该人员的报告*/
  const filteredDialogReports = useMemo(() => {
    let filtered = [...dialogReports];

    if (dialogLevelFilter !== 'all') {
      filtered = filtered.filter((report) => report.elasticity_level === dialogLevelFilter);
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
  }, [dialogDateEnd, dialogDateStart, dialogLevelFilter, dialogPersonId]);

  /*保证对话框页码不超过最大页数*/
  useEffect(() => {
    if (dialogPage > dialogTotalPages) {
      setDialogPage(dialogTotalPages);
    }
  }, [dialogPage, dialogTotalPages]);

  /*导出单份血管评估报告为文本文件*/
  const exportReport = (report: VascularAssessmentReport) => {
    const personName = persons.find((person) => person.id === report.person_id)?.name ?? `人员${report.person_id}`;
    const text = [
      report.report_title,
      `报告编号：${report.report_no}`,
      `监测对象：${personName}`,
      `生成时间：${new Date(report.recorded_at).toLocaleString('zh-CN')}`,
      `评估日期：${new Date(report.assessment_date).toLocaleDateString('zh-CN')}`,
      `报告周期：${new Date(report.report_start).toLocaleString('zh-CN')} - ${new Date(report.report_end).toLocaleString('zh-CN')}`,
      `留存截止：${new Date(report.expires_at).toLocaleString('zh-CN')}`,
      '',
      '一、核心结论',
      `血管健康评分：${report.health_score} 分`,
      `评估等级：${getLevelInfo(report.elasticity_level).text}`,
      `报告摘要：${report.report_summary}`,
      '',
      '二、具体数据',
      `收缩压：${report.systolic_min ?? '--'} ~ ${report.systolic_max ?? '--'} mmHg`,
      `收缩压极差：${report.systolic_range} mmHg`,
      `舒张压：${report.diastolic_min ?? '--'} ~ ${report.diastolic_max ?? '--'} mmHg`,
      `舒张压极差：${report.diastolic_range} mmHg`,
      `测量次数：${report.bp_measurement_count} 次`,
      '',
      '三、血压波动情况',
      ...(Array.isArray(report.blood_pressure_summary) 
        ? report.blood_pressure_summary.map((item, index) => `${index + 1}. ${item}`)
        : [
            `1. 收缩压范围 ${report.systolic_min ?? '--'}~${report.systolic_max ?? '--'} mmHg，极差 ${report.systolic_range} mmHg`,
            `2. 舒张压范围 ${report.diastolic_min ?? '--'}~${report.diastolic_max ?? '--'} mmHg，极差 ${report.diastolic_range} mmHg`,
            `3. 共纳入 ${report.bp_measurement_count ?? 0} 次血压测量`
          ]),
      '',
      '四、评估结果',
      report.assessment_result,
      safeGetFindings(report.findings),
      '',
      '五、风险提示',
      ...(report.risk_flags.length > 0
        ? report.risk_flags.map((item, index) => `${index + 1}. ${item}`)
        : ['暂无明显风险提示']),
      '',
      '六、建议',
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

  /*打印单份血管评估报告*/
  const printReport = (report: VascularAssessmentReport) => {
    const personName = persons.find((person) => person.id === report.person_id)?.name ?? `人员${report.person_id}`;
    const printWindow = window.open('', '_blank', 'width=960,height=800');
    if (!printWindow) {
      alert('无法打开打印窗口，请检查浏览器是否拦截弹窗。');
      return;
    }

    const recommendationItems = report.recommendations
      .map((item, index) => `<li>${index + 1}. ${item}</li>`)
      .join('');
    const riskItems =
      report.risk_flags.length > 0
        ? report.risk_flags.map((item) => `<li>${item}</li>`).join('')
        : '<li>暂无明显风险提示</li>';
    const bpSummaryItems = (Array.isArray(report.blood_pressure_summary) 
      ? report.blood_pressure_summary 
      : [
          `收缩压范围 ${report.systolic_min ?? '--'}~${report.systolic_max ?? '--'} mmHg，极差 ${report.systolic_range} mmHg`,
          `舒张压范围 ${report.diastolic_min ?? '--'}~${report.diastolic_max ?? '--'} mmHg，极差 ${report.diastolic_range} mmHg`,
          `共纳入 ${report.bp_measurement_count ?? 0} 次血压测量`
        ])
      .map((item, index) => `<li>${index + 1}. ${item}</li>`)
      .join('');

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
            <p>评估日期：${new Date(report.assessment_date).toLocaleDateString('zh-CN')}</p>
            <p>报告周期：${new Date(report.report_start).toLocaleString('zh-CN')} - ${new Date(report.report_end).toLocaleString('zh-CN')}</p>
          </div>
          <div class="grid">
            <div class="card"><strong>血管健康评分：</strong>${report.health_score} 分</div>
            <div class="card"><strong>评估等级：</strong>${getLevelInfo(report.elasticity_level).text}</div>
            <div class="card"><strong>测量次数：</strong>${report.bp_measurement_count} 次</div>
            <div class="card"><strong>收缩压极差：</strong>${report.systolic_range} mmHg</div>
            <div class="card"><strong>舒张压极差：</strong>${report.diastolic_range} mmHg</div>
            <div class="card"><strong>收缩压范围：</strong>${report.systolic_min ?? '--'} ~ ${report.systolic_max ?? '--'} mmHg</div>
          </div>
          <h2>报告摘要</h2>
          <p>${report.report_summary}</p>
          <p>${report.assessment_result}</p>
          <p>${safeGetFindings(report.findings)}</p>
          <h2>血压波动情况</h2>
          <ul>${bpSummaryItems}</ul>
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
      const response = await fetch(`/api/vascular-assessment-reports?person_id=${personId}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('加载报告失败');
      }

      const data = await response.json();
      setDialogReports(data.reports || []);
    } catch {
      setDialogReports([]);
      alert('加载该用户血管弹性评估报告失败');
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

  /*删除指定人员的全部血管评估报告*/
  const handleDeleteAllReportsByPerson = async (personId: number, personName: string) => {
    setDeletingAllReports(true);
    try {
      const response = await fetch(`/api/vascular-assessment-reports?deleteAll=true&personId=${personId}`, {
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
      alert(`${personName} 的全部血管弹性评估报告已删除`);
    } catch {
      alert('删除该用户全部血管弹性评估报告失败');
    } finally {
      setDeletingAllReports(false);
    }
  };

  /*删除单份血管评估报告*/
  const handleDeleteSingleReport = async (report: VascularAssessmentReport) => {
    if (!confirm('确定要删除这份报告吗？删除后将无法恢复。')) {
      return;
    }

    setDeletingReportId(report.id);
    try {
      const response = await fetch(`/api/vascular-assessment-reports?id=${report.id}`, {
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
        persons={persons}
        currentPersonId={currentPersonId}
        onPersonChange={setCurrentPersonId}
        alarmCount={alarmCount}
      />

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <VesselIcon className="h-7 w-7 text-blue-600" />
              血管弹性评估管理
            </h2>
            <p className="text-sm text-muted-foreground mt-1">多人员血管健康监测、风险评估与对比分析</p>
          </div>
          <Button onClick={() => void loadAllData()} disabled={loading} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新数据
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="mb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-600" />
                <span className="text-xs text-muted-foreground">总监测人数</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{overviewStats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-xs text-muted-foreground">高风险人数</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{overviewStats.atRisk}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-xs text-muted-foreground">状态正常人数</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{overviewStats.normal}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <span className="text-xs text-muted-foreground">总体平均评分</span>
              </div>
              <p
                className="text-2xl font-bold"
                style={{ color: overviewStats.overallAvg !== null ? getScoreColor(overviewStats.overallAvg) : '#64748b' }}
              >
                {overviewStats.overallAvg !== null ? `${overviewStats.overallAvg} 分` : '--'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'overview' | 'comparison' | 'reports')}
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

          <TabsContent value="overview" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-600" />
                <span className="text-sm text-slate-700">筛选：</span>
                <Select
                  value={riskFilter}
                  onValueChange={(value) => setRiskFilter(value as 'all' | 'risk' | 'normal')}
                >
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
              <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <Card key={index}>
                      <CardContent className="pt-4">
                        <div className="flex h-32 items-center justify-center">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : filteredSummaries.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-500">暂无符合条件的人员数据</div>
                ) : (
                  filteredSummaries.map((summary) => {
                    const levelInfo = getLevelInfo(summary.latestLevel);
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
                          <div className="mb-3 flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                                <span className="text-sm font-medium">{summary.name[0]}</span>
                              </div>
                              <div>
                                <p className="font-medium">{summary.name}</p>
                                <p className="text-xs text-muted-foreground">{summary.reportCount} 份报告</p>
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
                              <Badge style={{ backgroundColor: levelInfo.color }} className="text-white">
                                {levelInfo.text}
                              </Badge>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-xs text-muted-foreground">最新评分</span>
                              <p
                                className="text-lg font-bold"
                                style={{ color: summary.latestScore !== null ? getScoreColor(summary.latestScore) : '#64748b' }}
                              >
                                {summary.latestScore !== null ? `${summary.latestScore} 分` : '--'}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">平均评分</span>
                              <p
                                className="text-lg font-bold"
                                style={{ color: summary.avgScore !== null ? getScoreColor(summary.avgScore) : '#64748b' }}
                              >
                                {summary.avgScore !== null ? `${summary.avgScore} 分` : '--'}
                              </p>
                            </div>
                          </div>

                          {summary.maxRange && (
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                              <span>收缩压极差 {summary.maxRange.systolic} mmHg</span>
                              <span>舒张压极差 {summary.maxRange.diastolic} mmHg</span>
                            </div>
                          )}

                          {summary.isAtRisk && (
                            <div className="mt-3 flex items-center gap-2 rounded bg-red-50 px-3 py-2 text-xs text-red-600">
                              <AlertTriangle className="h-3 w-3" />
                              <span>需要关注该人员血管健康状态</span>
                            </div>
                          )}

                          {summary.latestDate && (
                            <div className="mt-3 text-xs text-muted-foreground">
                              <Calendar className="mr-1 inline h-3 w-3" />
                              {new Date(summary.latestDate).toLocaleDateString('zh-CN')}
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

          <TabsContent value="comparison" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>评分对比</CardTitle>
                  <CardDescription>
                    {selectedPersonIds.length > 0 ? `${selectedPersonIds.length} 人` : '前 5 人'}的血管健康评分对比
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    {comparisonChartData.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-slate-500">暂无对比数据</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparisonChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis domain={[0, 100]} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="最新评分" fill="#3b82f6" />
                          <Bar dataKey="平均评分" fill="#10b981" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>血压极差对比</CardTitle>
                  <CardDescription>人员收缩压和舒张压极差对比</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    {comparisonChartData.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-slate-500">暂无对比数据</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparisonChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="收缩压极差" fill="#f97316" />
                          <Bar dataKey="舒张压极差" fill="#8b5cf6" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>综合评估雷达图</CardTitle>
                <CardDescription>多维度健康指标综合对比</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  {comparisonChartData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-slate-500">暂无对比数据</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={comparisonChartData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="name" />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        <Radar name="最新评分" dataKey="最新评分" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                        <Radar name="平均评分" dataKey="平均评分" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                        <Tooltip />
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div>
                    <CardTitle>血管弹性评估报告</CardTitle>
                    <CardDescription>所有人员生成的血管弹性评估报告历史</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="space-y-1">
                      <span className="text-xs text-slate-500">按人员筛选</span>
                      <Select
                        value={String(reportPersonFilter)}
                        onValueChange={(value) => setReportPersonFilter(value === 'all' ? 'all' : Number(value))}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="选择人员" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部人员</SelectItem>
                          {persons.map((person) => (
                            <SelectItem key={person.id} value={String(person.id)}>
                              {person.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-slate-500">按等级筛选</span>
                      <Select value={reportLevelFilter} onValueChange={setReportLevelFilter}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="选择等级" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部等级</SelectItem>
                          <SelectItem value="excellent">优秀</SelectItem>
                          <SelectItem value="good">良好</SelectItem>
                          <SelectItem value="fair">一般</SelectItem>
                          <SelectItem value="moderate">一般</SelectItem>
                          <SelectItem value="poor">较差</SelectItem>
                          <SelectItem value="danger">危险</SelectItem>
                          <SelectItem value="critical">危险</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-slate-500">开始日期</span>
                      <Input
                        type="date"
                        value={reportDateStart}
                        onChange={(event) => setReportDateStart(event.target.value)}
                        className="w-[180px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-slate-500">结束日期</span>
                      <Input
                        type="date"
                        value={reportDateEnd}
                        onChange={(event) => setReportDateEnd(event.target.value)}
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
                      <div className="py-12 text-center text-slate-500">暂无符合条件的报告记录</div>
                    ) : (
                      filteredReports.map((report) => {
                        const personName = persons.find((person) => person.id === report.person_id)?.name || `人员${report.person_id}`;
                        const levelInfo = getLevelInfo(report.elasticity_level);
                        return (
                          <div key={`${report.id}-${report.report_no}`} className="rounded-lg border p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                  <Badge style={{ backgroundColor: levelInfo.color }} className="text-white">
                                    {levelInfo.text}
                                  </Badge>
                                  <span className="text-sm font-medium">{personName}</span>
                                  <span className="text-xs text-slate-500">{report.report_no}</span>
                                </div>
                                <p className="text-sm font-medium text-slate-900">{report.report_title}</p>
                                <p className="text-sm text-slate-700">{report.report_summary}</p>
                                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                                  <span>评分 {report.health_score} 分</span>
                                  <span>测量 {report.bp_measurement_count} 次</span>
                                  <span>收缩压极差 {report.systolic_range} mmHg</span>
                                  <span>舒张压极差 {report.diastolic_range} mmHg</span>
                                  <span>生成于 {new Date(report.recorded_at).toLocaleString('zh-CN')}</span>
                                  <span>留存至 {new Date(report.expires_at).toLocaleDateString('zh-CN')}</span>
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
              <DialogTitle>{dialogPerson?.name || '用户'}的血管弹性评估报告历史</DialogTitle>
              <DialogDescription>
                {dialogPersonSummary
                  ? `共 ${dialogPersonSummary.reportCount} 份报告，最新评估等级为 ${getLevelInfo(dialogPersonSummary.latestLevel).text}`
                  : '查看该用户的历史报告记录'}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">报告数量</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{dialogPersonSummary?.reportCount ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">当前评分</p>
                <p className="mt-2 text-3xl font-bold text-blue-600">
                  {dialogPersonSummary?.latestScore !== null && dialogPersonSummary?.latestScore !== undefined
                    ? dialogPersonSummary.latestScore
                    : '--'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">平均评分</p>
                <p className="mt-2 text-3xl font-bold text-purple-600">
                  {dialogPersonSummary?.avgScore !== null && dialogPersonSummary?.avgScore !== undefined
                    ? dialogPersonSummary.avgScore
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
                    style={{ backgroundColor: getLevelInfo(dialogPersonSummary?.latestLevel || 'fair').color }}
                  >
                    {getLevelInfo(dialogPersonSummary?.latestLevel || 'fair').text}
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
                    <span className="text-xs text-slate-500">按评估等级筛选</span>
                    <Select value={dialogLevelFilter} onValueChange={setDialogLevelFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="全部等级" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部等级</SelectItem>
                        <SelectItem value="excellent">优秀</SelectItem>
                        <SelectItem value="good">良好</SelectItem>
                        <SelectItem value="fair">一般</SelectItem>
                        <SelectItem value="moderate">一般</SelectItem>
                        <SelectItem value="poor">较差</SelectItem>
                        <SelectItem value="danger">危险</SelectItem>
                        <SelectItem value="critical">危险</SelectItem>
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
                      {selectedDialogReport.report_no} · 生成于{' '}
                      {new Date(selectedDialogReport.recorded_at).toLocaleString('zh-CN')}
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
                      <p className="text-xs text-muted-foreground">血管健康评分</p>
                      <p className="mt-2 text-3xl font-bold text-blue-600">{selectedDialogReport.health_score}</p>
                      <Badge
                        className="mt-2 text-white"
                        style={{ backgroundColor: getLevelInfo(selectedDialogReport.elasticity_level).color }}
                      >
                        {getLevelInfo(selectedDialogReport.elasticity_level).text}
                      </Badge>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">测量次数</p>
                      <p className="mt-2 text-3xl font-bold text-emerald-600">{selectedDialogReport.bp_measurement_count}</p>
                      <p className="mt-2 text-xs text-muted-foreground">次血压测量</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">收缩压极差</p>
                      <p className="mt-2 text-3xl font-bold text-orange-600">{selectedDialogReport.systolic_range}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {selectedDialogReport.systolic_min ?? '--'} ~ {selectedDialogReport.systolic_max ?? '--'} mmHg
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">舒张压极差</p>
                      <p className="mt-2 text-3xl font-bold text-purple-600">{selectedDialogReport.diastolic_range}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {selectedDialogReport.diastolic_min ?? '--'} ~ {selectedDialogReport.diastolic_max ?? '--'} mmHg
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">报告摘要</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                      <span>
                        报告周期：{new Date(selectedDialogReport.report_start).toLocaleString('zh-CN')} -{' '}
                        {new Date(selectedDialogReport.report_end).toLocaleString('zh-CN')}
                      </span>
                      <span>评估日期：{new Date(selectedDialogReport.assessment_date).toLocaleDateString('zh-CN')}</span>
                      <span>留存截止：{new Date(selectedDialogReport.expires_at).toLocaleString('zh-CN')}</span>
                    </div>
                    <p>{selectedDialogReport.report_summary}</p>
                    <p>{selectedDialogReport.assessment_result}</p>
                    <p>{safeGetFindings(selectedDialogReport.findings)}</p>
                  </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold">具体数据与血压波动情况</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">收缩压范围</p>
                          <p className="mt-1 font-semibold">
                            {selectedDialogReport.systolic_min ?? '--'} ~ {selectedDialogReport.systolic_max ?? '--'} mmHg
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">舒张压范围</p>
                          <p className="mt-1 font-semibold">
                            {selectedDialogReport.diastolic_min ?? '--'} ~ {selectedDialogReport.diastolic_max ?? '--'} mmHg
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {Array.isArray(selectedDialogReport.blood_pressure_summary) ? (
                          selectedDialogReport.blood_pressure_summary.map((item, index) => (
                            <p
                              key={`${selectedDialogReport.id}-${index}`}
                              className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700"
                            >
                              {index + 1}. {item}
                            </p>
                          ))
                        ) : (
                          <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
                            <p>收缩压范围 {selectedDialogReport.systolic_min ?? '--'}~{selectedDialogReport.systolic_max ?? '--'} mmHg，极差 {selectedDialogReport.systolic_range} mmHg</p>
                            <p className="mt-1">舒张压范围 {selectedDialogReport.diastolic_min ?? '--'}~{selectedDialogReport.diastolic_max ?? '--'} mmHg，极差 {selectedDialogReport.diastolic_range} mmHg</p>
                            <p className="mt-1">共纳入 {selectedDialogReport.bp_measurement_count ?? 0} 次血压测量</p>
                          </div>
                        )}
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
                              <Badge
                                key={`${selectedDialogReport.id}-${item}`}
                                variant="outline"
                                className="border-orange-200 bg-orange-50 text-orange-700"
                              >
                                {item}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-slate-500">暂无明显风险提示</span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {selectedDialogReport.recommendations.map((item, index) => (
                          <p
                            key={`${selectedDialogReport.report_no}-${index}`}
                            className="rounded-lg bg-blue-50 px-3 py-2 text-blue-800"
                          >
                            {index + 1}. {item}
                          </p>
                        ))}
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
                <div className="py-16 text-center text-slate-500">暂无符合筛选条件的报告</div>
              ) : (
                paginatedDialogReports.map((report) => {
                  const levelInfo = getLevelInfo(report.elasticity_level);
                  return (
                    <div
                      key={`${report.id}-${report.report_no}`}
                      className={`rounded-lg border p-4 ${
                        selectedDialogReportId === report.id ? 'border-blue-300 bg-blue-50/40' : ''
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge style={{ backgroundColor: levelInfo.color }} className="text-white">
                            {levelInfo.text}
                          </Badge>
                          <span className="text-sm font-medium text-slate-900">{report.report_title}</span>
                          <span className="text-xs text-slate-500">{report.report_no}</span>
                        </div>
                        <p className="text-sm text-slate-600">{report.report_summary}</p>
                        <div className="grid gap-2 text-xs text-slate-500 md:grid-cols-2 xl:grid-cols-4">
                          <span>健康评分：{report.health_score} 分</span>
                          <span>测量次数：{report.bp_measurement_count} 次</span>
                          <span>收缩压极差：{report.systolic_range} mmHg</span>
                          <span>生成时间：{new Date(report.recorded_at).toLocaleString('zh-CN')}</span>
                        </div>
                        {report.risk_flags.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {report.risk_flags.map((item) => (
                              <Badge
                                key={`${report.id}-${item}`}
                                variant="outline"
                                className="border-orange-200 bg-orange-50 text-orange-700"
                              >
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
                ? `确定要删除 ${pendingDeleteAllPerson.name} 的全部血管弹性评估报告吗？该操作不可恢复。`
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
