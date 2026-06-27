'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/components/layout/app-provider';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, AlertCircle, CheckCircle, Eye, Download, FileText, ImageIcon, Trash2, Sparkles, CalendarDays } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { UserHeader } from '@/components/layout/user-header';

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

/*弹性等级映射*/
const ELASTICITY_LABELS = {
  excellent: { text: '优秀', color: 'bg-green-500' },
  good: { text: '良好', color: 'bg-emerald-500' },
  moderate: { text: '一般', color: 'bg-yellow-500' },
  fair: { text: '一般', color: 'bg-yellow-500' },
  poor: { text: '较差', color: 'bg-orange-500' },
  danger: { text: '危险', color: 'bg-red-600' },
  critical: { text: '危险', color: 'bg-red-600' }
};

/*根据评分获取颜色函数*/
const getScoreColor = (score: number) => {
  if (score >= 90) return 'text-green-600';
  if (score >= 75) return 'text-emerald-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
};

/*血管模型图例*/
const VESSEL_MODEL_LEGEND = [
  { label: '优秀', color: 'bg-green-400' },
  { label: '良好', color: 'bg-emerald-400' },
  { label: '一般', color: 'bg-yellow-400' },
  { label: '较差', color: 'bg-orange-400' },
  { label: '危险', color: 'bg-red-500' },
];

/**
 * 获取当前血管健康评分对应的图例标签
 * 功能：
 * - 根据评分范围返回对应的中文标签
 * - 评分≥90：优秀
 * - 评分≥75：良好
 * - 评分≥60：一般
 * - 评分≥40：较差
 * - 评分<40：危险
 * @param {number} score - 血管健康评分（0-100）
 * @returns {string} 中文图例标签
 */
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
  generated_by?: 'ai' | 'rules';
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
  const { currentPersonId } = useApp();
  const [loading, setLoading] = useState(true);
  const [assessing, setAssessing] = useState(false);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [reports, setReports] = useState<VascularAssessmentReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<VascularAssessmentReport | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportLevelFilter, setReportLevelFilter] = useState<'all' | 'excellent' | 'good' | 'fair' | 'poor' | 'danger'>('all');
  const [reportTimeFilter, setReportTimeFilter] = useState<'7d' | '30d' | 'all'>('30d');
  const [reportGeneratedByFilter, setReportGeneratedByFilter] = useState<'all' | 'ai' | 'rules'>('all');
  const [deletingReportId, setDeletingReportId] = useState<number | null>(null);
  const [selectedReportIds, setSelectedReportIds] = useState<Set<number>>(new Set());
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [error, setError] = useState('');
  const [useAI, setUseAI] = useState(false);

  /**
   * 加载血管评估数据
   * 功能：
   * - 获取当前用户的血管评估记录数据
   * - 支持最多30条记录的限制
   * - 自动处理加载状态显示
   * - 处理API请求异常情况
   * @param {boolean} showLoading - 是否显示加载状态，默认为true
   * @returns {Promise<void>}
   */
  /*加载当前用户的血管评估原始记录*/
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

      if (reportGeneratedByFilter !== 'all') {
        params.set('generated_by', reportGeneratedByFilter);
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
  }, [currentPersonId, reportLevelFilter, reportTimeFilter, reportGeneratedByFilter]);

  /*导出血管评估报告为文本文件*/
  const exportAsTxt = (report: VascularAssessmentReport) => {
    const text = [
      report.report_title,
      `报告编号：${report.report_no}`,
      `生成时间：${new Date(report.recorded_at).toLocaleString('zh-CN')}`,
      `评估日期：${new Date(report.assessment_date).toLocaleDateString('zh-CN')}`,
      `报告周期：${new Date(report.report_start).toLocaleString('zh-CN')} - ${new Date(report.report_end).toLocaleString('zh-CN')}`,
      `留存截止：${new Date(report.expires_at).toLocaleString('zh-CN')}`,
      (report as any).generated_by ? `生成方式：${(report as any).generated_by === 'ai' ? 'AI 智能分析' : '规则引擎分析'}` : '',
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
    ].filter(Boolean).join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.report_no}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /*在 Canvas 上按宽度自动换行文本*/
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, lineHeight: number, startY: number): number => {
    const words = text.split('');
    let line = '';
    let y = startY;
    
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, 40, y);
        line = words[i];
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) {
      ctx.fillText(line, 40, y);
      y += lineHeight;
    }
    return y;
  };

  /*导出血管评估报告为图片文件*/
  const exportAsImage = async (report: VascularAssessmentReport) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 800;
      canvas.height = 2500; // 增加高度以容纳完整内容
      
      // 背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // 边框
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
      
      // 标题
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(report.report_title, canvas.width / 2, 60);
      
      // 报告信息
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#64748b';
      let y = 100;
      ctx.fillText(`报告编号：${report.report_no}`, 40, y);
      y += 24;
      ctx.fillText(`生成时间：${new Date(report.recorded_at).toLocaleString('zh-CN')}`, 40, y);
      y += 24;
      ctx.fillText(`评估日期：${new Date(report.assessment_date).toLocaleDateString('zh-CN')}`, 40, y);
      y += 24;
      ctx.fillText(`报告周期：${new Date(report.report_start).toLocaleDateString('zh-CN')} - ${new Date(report.report_end).toLocaleDateString('zh-CN')}`, 40, y);
      y += 24;
      if ((report as any).generated_by) {
        ctx.fillText(`生成方式：${(report as any).generated_by === 'ai' ? 'AI 智能分析' : '规则引擎分析'}`, 40, y);
        y += 24;
      }
      
      // 分隔线
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(canvas.width - 40, y);
      ctx.strokeStyle = '#e2e8f0';
      ctx.stroke();
      
      // 一、核心结论
      y += 40;
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('一、核心结论', 40, y);
      
      y += 35;
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(`血管健康评分：${report.health_score} 分`, 40, y);
      y += 28;
      ctx.fillText(`评估等级：${ELASTICITY_LABELS[report.elasticity_level as keyof typeof ELASTICITY_LABELS]?.text ?? report.elasticity_level}`, 40, y);
      
      y += 35;
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('报告摘要', 40, y);
      y += 28;
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#334155';
      y = wrapText(ctx, report.report_summary, canvas.width - 80, 24, y);
      
      // 分隔线
      y += 15;
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(canvas.width - 40, y);
      ctx.strokeStyle = '#e2e8f0';
      ctx.stroke();
      
      // 二、具体数据
      y += 40;
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('二、具体数据', 40, y);
      
      y += 35;
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(`收缩压：${report.systolic_min ?? '--'} ~ ${report.systolic_max ?? '--'} mmHg`, 40, y);
      y += 28;
      ctx.fillText(`收缩压极差：${report.systolic_range} mmHg`, 40, y);
      y += 28;
      ctx.fillText(`舒张压：${report.diastolic_min ?? '--'} ~ ${report.diastolic_max ?? '--'} mmHg`, 40, y);
      y += 28;
      ctx.fillText(`舒张压极差：${report.diastolic_range} mmHg`, 40, y);
      y += 28;
      ctx.fillText(`测量次数：${report.bp_measurement_count} 次`, 40, y);
      
      // 分隔线
      y += 15;
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(canvas.width - 40, y);
      ctx.strokeStyle = '#e2e8f0';
      ctx.stroke();
      
      // 三、血压波动情况
      y += 40;
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('三、血压波动情况', 40, y);
      
      y += 35;
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#334155';
      const bpSummaryList = Array.isArray(report.blood_pressure_summary) 
        ? report.blood_pressure_summary 
        : [
            `收缩压范围 ${report.systolic_min ?? '--'}~${report.systolic_max ?? '--'} mmHg，极差 ${report.systolic_range} mmHg`,
            `舒张压范围 ${report.diastolic_min ?? '--'}~${report.diastolic_max ?? '--'} mmHg，极差 ${report.diastolic_range} mmHg`,
            `共纳入 ${report.bp_measurement_count ?? 0} 次血压测量`
          ];
      bpSummaryList.forEach((item, index) => {
        ctx.fillText(`${index + 1}. ${item}`, 40, y);
        y += 24;
      });
      
      // 分隔线
      y += 15;
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(canvas.width - 40, y);
      ctx.strokeStyle = '#e2e8f0';
      ctx.stroke();
      
      // 四、评估结果
      y += 40;
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('四、评估结果', 40, y);
      
      y += 35;
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#334155';
      y = wrapText(ctx, report.assessment_result, canvas.width - 80, 24, y);
      
      const findingsText = safeGetFindings(report.findings);
      if (findingsText) {
        y = wrapText(ctx, findingsText, canvas.width - 80, 24, y);
      }
      
      // 分隔线
      y += 15;
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(canvas.width - 40, y);
      ctx.strokeStyle = '#e2e8f0';
      ctx.stroke();
      
      // 五、风险提示
      y += 40;
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('五、风险提示', 40, y);
      
      y += 35;
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#334155';
      if (report.risk_flags.length > 0) {
        report.risk_flags.forEach((item, index) => {
          ctx.fillText(`${index + 1}. ${item}`, 40, y);
          y += 24;
        });
      } else {
        ctx.fillText('暂无明显风险提示', 40, y);
        y += 24;
      }
      
      // 分隔线
      y += 15;
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(canvas.width - 40, y);
      ctx.strokeStyle = '#e2e8f0';
      ctx.stroke();
      
      // 六、建议
      y += 40;
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('六、建议', 40, y);
      
      y += 35;
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#334155';
      report.recommendations.forEach((item, index) => {
        ctx.fillText(`${index + 1}. ${item}`, 40, y);
        y += 24;
      });
      
      // 下载
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${report.report_no}.png`;
          link.click();
          URL.revokeObjectURL(url);
        }
      });
    } catch (error) {
      console.error('导出图片失败:', error);
      alert('导出图片失败，请重试');
    }
  };
  /*统一的报告导出入口*/
  const exportReport = (report: VascularAssessmentReport) => {
    exportAsTxt(report);
  };

  /*根据当前数据生成血管弹性评估报告*/
  const handleAssess = async () => {
    if (!confirm(`确定要${useAI ? '使用 AI' : ''}根据当前血压数据生成血管弹性评估报告吗？`)) return;

    setAssessing(true);
    try {
      const response = await fetch('/api/vascular-assessment-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_id: currentPersonId,
          range: reportTimeFilter === 'all' ? '30d' : reportTimeFilter,
          use_ai: useAI,
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '评估失败');
      }

      const result = await response.json();
      alert(`${useAI ? 'AI 生成' : ''}血管弹性评估报告已生成`);

      /*生成后刷新原始记录和报告列表*/
      await loadData(false);
      await loadReports(false);
      
      if (result.report) {
        setSelectedReport(result.report);
        setReportDialogOpen(true);
      }
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

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '删除失败');
      }

      const result = await response.json();
      if (result.success) {
        alert('删除成功');
      } else {
        alert('删除失败：' + result.message);
      }
      
      /*删除后刷新报告列表*/
      await loadReports(false);
      
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

  /*切换单份报告的勾选状态*/
  const toggleReportSelection = (id: number) => {
    setSelectedReportIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  /*切换当前列表的全选状态*/
  const toggleSelectAll = () => {
    if (selectedReportIds.size === reports.length) {
      setSelectedReportIds(new Set());
    } else {
      setSelectedReportIds(new Set(reports.map(r => r.id)));
    }
  };

  /*批量删除选中的报告*/
  const handleDeleteSelected = async () => {
    if (selectedReportIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedReportIds.size} 份报告吗？删除后将无法恢复。`)) return;

    setDeletingSelected(true);
    try {
      const response = await fetch(`/api/vascular-assessment-reports`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: Array.from(selectedReportIds) })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '删除失败');
      }

      const result = await response.json();
      if (result.success) {
        alert(`成功删除 ${result.deletedCount} 条报告`);
        setSelectedReportIds(new Set());
      } else {
        alert('删除失败：' + result.message);
      }
      
      await loadReports(false);
    } catch {
      alert('删除报告失败');
    } finally {
      setDeletingSelected(false);
    }
  };

  /*删除当前用户的全部血管评估报告*/
  const handleDeleteAll = async () => {
    if (reports.length === 0) return;
    if (!confirm(`确定要删除所有 ${reports.length} 份报告吗？这将清空您的所有评估报告历史。`)) return;

    setDeletingSelected(true);
    try {
      const response = await fetch(`/api/vascular-assessment-reports?deleteAll=true&personId=${currentPersonId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '删除失败');
      }

      const result = await response.json();
      if (result.success) {
        alert(`成功删除 ${result.deletedCount} 条报告`);
        setSelectedReportIds(new Set());
      } else {
        alert('删除失败：' + result.message);
      }
      
      await loadReports(false);
    } catch {
      alert('删除报告失败');
    } finally {
      setDeletingSelected(false);
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
    <div className="flex flex-col">
      <UserHeader />
      <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" />
            血管弹性评估
          </h1>
          <p className="text-gray-500 mt-1">基于血压波动评估血管健康状况</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-2 mr-4 px-3 py-1 rounded-lg border bg-slate-50">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span className="text-sm text-slate-600">AI 智能分析</span>
            <Switch
              checked={useAI}
              onCheckedChange={setUseAI}
            />
          </div>
          <Button
            onClick={handleAssess}
            disabled={assessing}
            className={useAI ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}
          >
            {assessing ? '生成中...' : (useAI ? 'AI 生成报告' : '生成血管弹性评估报告')}
          </Button>
        </div>
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
                  <div className="text-blue-700 text-sm">
                    {Array.isArray(latest.recommendations) ? (
                      <ul className="list-disc list-inside space-y-1">
                        {latest.recommendations.map((rec: string, idx: number) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{latest.recommendations || '暂无建议'}</p>
                    )}
                  </div>
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
                <div className="flex items-center gap-2 flex-wrap">
                  {reports.length > 0 && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={toggleSelectAll}
                        className="h-9"
                      >
                        {selectedReportIds.size === reports.length ? '取消全选' : '全选'}
                      </Button>
                      {selectedReportIds.size > 0 && (
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={handleDeleteSelected}
                          disabled={deletingSelected}
                          className="h-9"
                        >
                          {deletingSelected ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                          ) : null}
                          删除选中 ({selectedReportIds.size})
                        </Button>
                      )}
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={handleDeleteAll}
                        disabled={deletingSelected}
                        className="h-9"
                      >
                        {deletingSelected ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                        ) : null}
                        删除全部
                      </Button>
                    </>
                  )}
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
                    value={reportGeneratedByFilter}
                    onChange={(event) => setReportGeneratedByFilter(event.target.value as typeof reportGeneratedByFilter)}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none"
                  >
                    <option value="all">全部生成方式</option>
                    <option value="ai">AI 智能分析</option>
                    <option value="rules">规则引擎分析</option>
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
                    <div className="flex items-start gap-3 flex-1">
                      {reports.length > 0 && (
                        <div className="pt-1">
                          <input
                            type="checkbox"
                            checked={selectedReportIds.has(latestReport.id)}
                            onChange={() => toggleReportSelection(latestReport.id)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </div>
                      )}
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-600">最新报告</Badge>
                          {latestReport.generated_by && (
                            <Badge variant="outline" className={latestReport.generated_by === 'ai' ? 'border-green-200 text-green-700' : 'border-blue-200 text-blue-700'}>
                              {latestReport.generated_by === 'ai' ? 'AI 分析' : '规则分析'}
                            </Badge>
                          )}
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
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleViewReport(latestReport)}>
                        <Eye className="mr-1 h-4 w-4" />
                        查看
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Download className="mr-1 h-4 w-4" />
                            导出
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => exportAsTxt(latestReport)}>
                            <FileText className="mr-2 h-4 w-4" />
                            TXT 文本
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => exportAsImage(latestReport)}>
                            <ImageIcon className="mr-2 h-4 w-4" />
                            PNG 图片
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                    <div 
                      key={report.id} 
                      className={`rounded-lg border p-4 ${selectedReportIds.has(report.id) ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="pt-1">
                            <input
                              type="checkbox"
                              checked={selectedReportIds.has(report.id)}
                              onChange={() => toggleReportSelection(report.id)}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </div>
                          <div className="space-y-2 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={`${levelInfo.color} text-white`}>
                                {levelInfo.text}
                              </Badge>
                              {report.generated_by && (
                                <Badge variant="outline" className={report.generated_by === 'ai' ? 'border-green-200 text-green-700' : 'border-blue-200 text-blue-700'}>
                                  {report.generated_by === 'ai' ? 'AI 分析' : '规则分析'}
                                </Badge>
                              )}
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
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleViewReport(report)}>
                            <Eye className="mr-1 h-4 w-4" />
                            查看
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Download className="mr-1 h-4 w-4" />
                                导出
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => exportAsTxt(report)}>
                                <FileText className="mr-2 h-4 w-4" />
                                TXT 文本
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => exportAsImage(report)}>
                                <ImageIcon className="mr-2 h-4 w-4" />
                                PNG 图片
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
      </div>

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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      导出报告
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => exportAsTxt(selectedReport)}>
                      <FileText className="mr-2 h-4 w-4" />
                      TXT 文本
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportAsImage(selectedReport)}>
                      <ImageIcon className="mr-2 h-4 w-4" />
                      PNG 图片
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
