'use client';

// 安全处理 findings 字段的辅助函数
const safeGetFindings = (findings: any): string => {
  if (!findings) return '';
  if (typeof findings === 'string') return findings;
  if (typeof findings === 'object') {
    // 如果是对象，格式化显示
    return Object.entries(findings)
      .map(([key, value]) => `${key}: ${value}`)
      .join('；');
  }
  return String(findings);
};

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertCircle, CheckCircle, CalendarDays, Download, Eye, FileText, Trash2 } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area } from 'recharts';

// 弹性等级映射
const ELASTICITY_LABELS = {
  excellent: { text: '优秀', color: 'bg-green-500' },
  good: { text: '良好', color: 'bg-emerald-500' },
  moderate: { text: '一般', color: 'bg-yellow-500' },
  fair: { text: '一般', color: 'bg-yellow-500' },
  poor: { text: '较差', color: 'bg-orange-500' },
  danger: { text: '危险', color: 'bg-red-600' },
  critical: { text: '危险', color: 'bg-red-600' }
};

const getScoreColor = (score: number) => {
  if (score >= 90) return 'text-green-600';
  if (score >= 75) return 'text-emerald-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
};

const VESSEL_MODEL_LEGEND = [
  { label: '优秀', color: 'bg-green-400' },
  { label: '良好', color: 'bg-emerald-400' },
  { label: '一般', color: 'bg-yellow-400' },
  { label: '较差', color: 'bg-orange-400' },
  { label: '危险', color: 'bg-red-500' },
];

const getCurrentVesselLegendLabel = (score: number) => {
  if (score >= 90) return '优秀';
  if (score >= 75) return '良好';
  if (score >= 60) return '一般';
  if (score >= 40) return '较差';
  return '危险';
};

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

const VesselModel = ({ healthScore }: { healthScore: number }) => {
  const currentLegendLabel = getCurrentVesselLegendLabel(healthScore);

  const getVesselStyle = () => {
    let className = 'h-16 w-full rounded-full transition-all duration-1000';
    
    if (healthScore >= 90) {
      return `${className} bg-gradient-to-r from-green-300 via-green-400 to-green-500 shadow-lg shadow-green-300`;
    } else if (healthScore >= 75) {
      return `${className} bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-500 shadow-lg shadow-emerald-300`;
    } else if (healthScore >= 60) {
      return `${className} bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-500 shadow-lg shadow-yellow-300`;
    } else if (healthScore >= 40) {
      return `${className} bg-gradient-to-r from-orange-300 via-orange-400 to-orange-500 shadow-lg shadow-orange-300`;
    } else {
      return `${className} bg-gradient-to-r from-red-400 via-red-500 to-red-600 shadow-lg shadow-red-400`;
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Activity className="h-5 w-5" />
        血管弹性模型
      </h3>
      <div className="relative">
        <div className={getVesselStyle()}></div>
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/90">
          <div className="flex items-center gap-1 rounded-full bg-red-500/80 px-2 py-1 text-xs font-semibold shadow-lg shadow-red-300">
            <span className="animate-pulse">{'>>'}</span>
            <span>血流</span>
          </div>
        </div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/90">
          <div className="flex items-center gap-1 rounded-full bg-red-500/80 px-2 py-1 text-xs font-semibold shadow-lg shadow-red-300">
            <span className="animate-pulse">{'>>'}</span>
            <span>流向</span>
          </div>
        </div>
      </div>
      <div className="flex justify-between text-sm text-gray-500">
        <span>健康</span>
        <span>血管壁弹性</span>
        <span>硬化</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span className="font-medium text-slate-700">颜色等级：</span>
        {VESSEL_MODEL_LEGEND.map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors ${
              item.label === currentLegendLabel
                ? 'border border-slate-300 bg-white font-semibold text-slate-900 shadow-sm'
                : ''
            }`}
          >
            <span className={`h-3 w-3 rounded-sm ${item.color}`} />
            <span>{item.label}</span>
            {item.label === currentLegendLabel && (
              <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">当前</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const ScoreDisplay = ({ score, level }: { score: number; level: string }) => {
  const levelInfo = ELASTICITY_LABELS[level as keyof typeof ELASTICITY_LABELS] || ELASTICITY_LABELS.moderate;

  return (
    <div className="text-center space-y-4">
      <div className="relative inline-block">
        <svg className="w-48 h-48 transform -rotate-90">
          <circle cx="96" cy="96" r="80" fill="none" stroke="#e5e7eb" strokeWidth="12" />
          <circle
            cx="96"
            cy="96"
            r="80"
            fill="none"
            stroke="url(#scoreGradient)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${score * 5.026} 502.6`}
            className="transition-all duration-1000"
          />
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-5xl font-bold ${getScoreColor(score)}`}>{score}</span>
          <span className="text-gray-500 text-sm">血管健康评分</span>
        </div>
      </div>
      <Badge className={`${levelInfo.color} text-white px-4 py-1 text-base`}>
        {levelInfo.text}
      </Badge>
    </div>
  );
};

const StatisticsCards = ({ assessments }: { assessments: any[] }) => {
  if (assessments.length === 0) return null;

  const latest = assessments[0];
  const avgScore = assessments.reduce((sum, a) => sum + a.health_score, 0) / assessments.length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">最新评分</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" style={{ color: getScoreColor(latest.health_score) }}>
            {latest.health_score}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {new Date(latest.assessment_date).toLocaleDateString('zh-CN')}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">平均评分</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" style={{ color: getScoreColor(Math.round(avgScore)) }}>
            {Math.round(avgScore)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {assessments.length} 次评估
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">血压极差</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">收缩压</span>
              <span className="font-medium">{latest.systolic_range} mmHg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">舒张压</span>
              <span className="font-medium">{latest.diastolic_range} mmHg</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default function VascularAssessmentPage() {
  /*页面核心状态*/
  const [loading, setLoading] = useState(true);
  const [assessing, setAssessing] = useState(false);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [reports, setReports] = useState<VascularAssessmentReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<VascularAssessmentReport | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportLevelFilter, setReportLevelFilter] = useState<'all' | 'excellent' | 'good' | 'fair' | 'poor' | 'danger'>('all');
  const [reportTimeFilter, setReportTimeFilter] = useState<'7d' | '30d' | 'all'>('30d');
  const [deletingReportId, setDeletingReportId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [currentPersonId, setCurrentPersonId] = useState(1);

  /*加载当前人员的血管评估原始记录*/
  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError('');
      const response = await fetch(`/api/vascular-assessments?person_id=${currentPersonId}&limit=30`);
      if (!response.ok) throw new Error('加载数据失败');
      const result = await response.json();
      setAssessments(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  /*加载血管评估报告列表*/
  const loadReports = async (showLoading = true) => {
    try {
      if (showLoading) setReportsLoading(true);

      const params = new URLSearchParams({
        person_id: String(currentPersonId),
      });

      if (reportLevelFilter !== 'all') {
        params.set('elasticity_level', reportLevelFilter);
      }

      if (reportTimeFilter !== 'all') {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - (reportTimeFilter === '7d' ? 7 : 30));
        params.set('start_date', start.toISOString());
        params.set('end_date', end.toISOString());
      }

      const response = await fetch(`/api/vascular-assessment-reports?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('加载报告失败');

      const result = await response.json();
      setReports(result.reports || []);
    } catch {
      setReports([]);
    } finally {
      if (showLoading) setReportsLoading(false);
    }
  };

  /*页面加载后持续刷新原始评估记录*/
  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      void loadData(false);
    }, 5000);

    return () => clearInterval(timer);
  }, [currentPersonId]);

  /*筛选条件变化后重新加载报告列表*/
  useEffect(() => {
    void loadReports();
  }, [currentPersonId, reportLevelFilter, reportTimeFilter]);

  /*导出血管评估报告为文本文件*/
  const exportReport = (report: VascularAssessmentReport) => {
    const text = [
      report.report_title,
      `报告编号：${report.report_no}`,
      `生成时间：${new Date(report.recorded_at).toLocaleString('zh-CN')}`,
      `评估日期：${new Date(report.assessment_date).toLocaleDateString('zh-CN')}`,
      `报告周期：${new Date(report.report_start).toLocaleString('zh-CN')} - ${new Date(report.report_end).toLocaleString('zh-CN')}`,
      `留存截止：${new Date(report.expires_at).toLocaleString('zh-CN')}`,
      '',
      '一、核心结论',
      `血管健康评分：${report.health_score} 分`,
      `评估等级：${ELASTICITY_LABELS[report.elasticity_level as keyof typeof ELASTICITY_LABELS]?.text ?? report.elasticity_level}`,
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
      ...(report.risk_flags.length > 0 ? report.risk_flags.map((item, index) => `${index + 1}. ${item}`) : ['暂无明显风险提示']),
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

  /*根据当前数据生成血管弹性评估报告*/
  const handleAssess = async () => {
    if (!confirm('确定要根据当前血压数据生成血管弹性评估报告吗？')) return;

    setAssessing(true);
    try {
      const response = await fetch('/api/vascular-assessment-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_id: currentPersonId,
          range: reportTimeFilter === 'all' ? '30d' : reportTimeFilter,
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '评估失败');
      }

      const result = await response.json();
      alert('血管弹性评估报告已生成，并已写入历史记录。');
      await loadData(false);
      await loadReports(false);
      setSelectedReport(result.report ?? null);
      setReportDialogOpen(Boolean(result.report));
    } catch (err) {
      alert(err instanceof Error ? err.message : '评估失败');
    } finally {
      setAssessing(false);
    }
  };

  /*打开报告详情对话框*/
  const handleViewReport = (report: VascularAssessmentReport) => {
    setSelectedReport(report);
    setReportDialogOpen(true);
  };

  /*删除单份血管评估报告*/
  const handleDeleteReport = async (id: number) => {
    if (!confirm('确定要删除这份评估报告吗？删除后将无法再次导出。')) return;

    setDeletingReportId(id);
    try {
      const response = await fetch(`/api/vascular-assessment-reports?id=${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('删除失败');
      setReports((current) => current.filter((report) => report.id !== id));
      if (selectedReport?.id === id) {
        setSelectedReport(null);
        setReportDialogOpen(false);
      }
    } catch {
      alert('删除报告失败');
    } finally {
      setDeletingReportId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const hasData = assessments.length > 0;
  const latest = assessments[0];
  const latestReport = reports[0] ?? null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" />
            血管弹性评估
          </h1>
          <p className="text-gray-500 mt-1">基于血压波动评估血管健康状况</p>
        </div>
        <Button
          onClick={handleAssess}
          disabled={assessing}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {assessing ? '生成中...' : '生成血管弹性评估报告'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!hasData ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <Activity className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">暂无评估记录</h3>
            <p className="text-gray-500 mb-4">点击上方“生成血管弹性评估报告”按钮，基于您的血压数据生成评估报告</p>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>提示</AlertTitle>
              <AlertDescription>血管弹性评估需要至少3次血压测量记录才能进行准确评估</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>血管健康评分</CardTitle>
                <CardDescription>最新评估结果</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ScoreDisplay score={latest.health_score} level={latest.elasticity_level} />
                <VesselModel healthScore={latest.health_score} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>评估详情</CardTitle>
                <CardDescription>{new Date(latest.assessment_date).toLocaleDateString('zh-CN')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className={latest.elasticity_level === 'critical' || latest.elasticity_level === 'danger' ? 'border-red-500' : latest.elasticity_level === 'poor' ? 'border-orange-500' : ''}>
                  {latest.elasticity_level === 'excellent' || latest.elasticity_level === 'good' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>评估结果</AlertTitle>
                  <AlertDescription>{latest.assessment_result || latest.findings || '暂无评估结果'}</AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <h4 className="font-medium">血压波动数据</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-sm text-gray-500">收缩压</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-lg font-bold">{latest.systolic_min}</span>
                        <span className="text-gray-400">-</span>
                        <span className="text-lg font-bold">{latest.systolic_max}</span>
                      </div>
                      <div className="text-sm text-orange-600 mt-1">极差: {latest.systolic_range} mmHg</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-sm text-gray-500">舒张压</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-lg font-bold">{latest.diastolic_min}</span>
                        <span className="text-gray-400">-</span>
                        <span className="text-lg font-bold">{latest.diastolic_max}</span>
                      </div>
                      <div className="text-sm text-orange-600 mt-1">极差: {latest.diastolic_range} mmHg</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    基于 {latest.bp_measurement_count} 次血压测量
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 mb-2">💡 健康建议</h4>
                  <p className="text-blue-700 text-sm">{latest.recommendations}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <StatisticsCards assessments={assessments} />

          <Card>
            <CardHeader>
              <CardTitle>健康趋势</CardTitle>
              <CardDescription>近30天血管健康评分变化</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[...assessments].reverse()}>
                    <defs>
                      <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="assessment_date"
                      tickFormatter={(date) => new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis domain={[0, 100]} />
                    <Tooltip
                      formatter={(value: number) => [`${value} 分`, '血管健康评分']}
                      labelFormatter={(label) => new Date(label).toLocaleDateString('zh-CN')}
                    />
                    <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="3 3" label="警戒线" />
                    <ReferenceLine y={90} stroke="#10b981" strokeDasharray="3 3" label="优秀线" />
                    <Area
                      type="monotone"
                      dataKey="health_score"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#scoreFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    评估报告历史
                  </CardTitle>
                  <CardDescription>每次生成报告都会形成一条历史记录，留存 30 天，可随时查看和导出。</CardDescription>
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
                    <option value="danger">危险</option>
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
                <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-600">最新报告</Badge>
                        <span className="text-xs text-slate-500">{latestReport.report_no}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-900">{latestReport.report_summary}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                        <span>评分 {latestReport.health_score} 分</span>
                        <span>收缩压极差 {latestReport.systolic_range} mmHg</span>
                        <span>舒张压极差 {latestReport.diastolic_range} mmHg</span>
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

              <div className="space-y-3">
                {reportsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  </div>
                ) : reports.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    当前筛选条件下暂无评估报告
                  </div>
                ) : reports.map((report) => {
                  const levelInfo = ELASTICITY_LABELS[report.elasticity_level as keyof typeof ELASTICITY_LABELS] || ELASTICITY_LABELS.fair;
                  return (
                    <div key={report.id} className="rounded-lg border p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={`${levelInfo.color} text-white`}>
                              {levelInfo.text}
                            </Badge>
                            <span className="text-xs text-slate-500">{report.report_no}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(report.recorded_at).toLocaleString('zh-CN')}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-slate-900">{report.report_title}</div>
                          <p className="text-sm text-slate-700">{report.report_summary}</p>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>评分 {report.health_score} 分</span>
                            <span>测量 {report.bp_measurement_count} 次</span>
                            <span>极差 S{report.systolic_range}/D{report.diastolic_range}</span>
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
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedReport?.report_title ?? '血管弹性评估报告'}</DialogTitle>
            <DialogDescription>
              {selectedReport
                ? `${selectedReport.report_no} · 生成于 ${new Date(selectedReport.recorded_at).toLocaleString('zh-CN')}`
                : '查看血管弹性评估报告详情'}
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">血管评分</p>
                    <p className={`mt-2 text-3xl font-bold ${getScoreColor(selectedReport.health_score)}`}>{selectedReport.health_score}</p>
                    <Badge className={`mt-2 ${ELASTICITY_LABELS[selectedReport.elasticity_level as keyof typeof ELASTICITY_LABELS]?.color ?? 'bg-slate-500'} text-white`}>
                      {ELASTICITY_LABELS[selectedReport.elasticity_level as keyof typeof ELASTICITY_LABELS]?.text ?? selectedReport.elasticity_level}
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">测量次数</p>
                    <p className="mt-2 text-3xl font-bold text-blue-600">{selectedReport.bp_measurement_count}</p>
                    <p className="mt-2 text-xs text-muted-foreground">次血压测量</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">收缩压极差</p>
                    <p className="mt-2 text-3xl font-bold text-orange-600">{selectedReport.systolic_range}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{selectedReport.systolic_min ?? '--'} ~ {selectedReport.systolic_max ?? '--'} mmHg</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">舒张压极差</p>
                    <p className="mt-2 text-3xl font-bold text-purple-600">{selectedReport.diastolic_range}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{selectedReport.diastolic_min ?? '--'} ~ {selectedReport.diastolic_max ?? '--'} mmHg</p>
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
                    <span>评估日期：{new Date(selectedReport.assessment_date).toLocaleDateString('zh-CN')}</span>
                    <span>留存截止：{new Date(selectedReport.expires_at).toLocaleString('zh-CN')}</span>
                  </div>
                  <p>{selectedReport.report_summary}</p>
                  <p>{selectedReport.assessment_result}</p>
                  <p>{safeGetFindings(selectedReport.findings)}</p>
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
                        <p className="mt-1 font-semibold">{selectedReport.systolic_min ?? '--'} ~ {selectedReport.systolic_max ?? '--'} mmHg</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">舒张压范围</p>
                        <p className="mt-1 font-semibold">{selectedReport.diastolic_min ?? '--'} ~ {selectedReport.diastolic_max ?? '--'} mmHg</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {Array.isArray(selectedReport.blood_pressure_summary) ? (
                        selectedReport.blood_pressure_summary.map((item, index) => (
                          <p key={`${selectedReport.id}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
                            {index + 1}. {item}
                          </p>
                        ))
                      ) : (
                        <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
                          <p>收缩压范围 {selectedReport.systolic_min ?? '--'}~{selectedReport.systolic_max ?? '--'} mmHg，极差 {selectedReport.systolic_range} mmHg</p>
                          <p className="mt-1">舒张压范围 {selectedReport.diastolic_min ?? '--'}~{selectedReport.diastolic_max ?? '--'} mmHg，极差 {selectedReport.diastolic_range} mmHg</p>
                          <p className="mt-1">共纳入 {selectedReport.bp_measurement_count ?? 0} 次血压测量</p>
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
                        <p key={`${selectedReport.report_no}-${index}`} className="rounded-lg bg-blue-50 px-3 py-2 text-blue-800">
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
