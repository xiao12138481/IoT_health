'use client';

import { Activity, Bell, HeartPulse, Moon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/*压力快照数据结构*/
interface StressSnapshot {
  /** 压力评分（0-100） */
  stress_score: number;
  /** 压力等级：low（轻松）、moderate（中等）、high（偏高）、severe（高压） */
  stress_level: string;
  /** 情绪状态描述 */
  mood_state: string;
  /** 自主神经平衡状态 */
  autonomic_balance: string;
  /** 心率变异性均值（毫秒） */
  hrv_mean: number | null;
  /** 记录时间 */
  recorded_at?: string | null;
}

/*血管快照数据结构*/
interface VascularSnapshot {
  /** 血管健康评分（0-100） */
  health_score: number;
  /** 血管弹性等级 */
  elasticity_level: string;
  /** 记录时间 */
  recorded_at?: string | null;
  /** 评估日期 */
  assessment_date?: string | null;
}

/*健康洞察面板组件属性*/
interface HealthInsightPanelProps {
  /** 未处理报警数量 */
  alarmCount: number;
  /** 睡眠评分（0-100），可为null表示无数据 */
  sleepScore: number | null;
  /** 压力数据快照 */
  stressData?: StressSnapshot | null;
  /** 血管数据快照 */
  vascularData?: VascularSnapshot | null;
}

/*压力等级标签映射表*/
const STRESS_LEVEL_LABELS: Record<string, string> = {
  low: '轻松',
  moderate: '中等',
  high: '偏高',
  severe: '高压',
};

/*血管弹性等级标签映射表*/
const VASCULAR_LEVEL_LABELS: Record<string, string> = {
  excellent: '优秀',
  good: '良好',
  moderate: '一般',
  fair: '一般',
  poor: '较差',
  danger: '危险',
  critical: '危险',
};

/**
 * 获取压力等级对应的标签样式
 * 功能：
 * - 根据压力等级返回对应的颜色样式类名
 * - 支持不同压力等级（severe/high、moderate、low）的样式区分
 * @param {string} level - 压力等级字符串
 * @returns {string} 对应的Tailwind CSS类名字符串
 */
function getStressBadgeClass(level: string) {
  /*根据压力等级返回对应的标签样式*/
  if (level === 'severe' || level === 'high') {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  if (level === 'moderate') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

/**
 * 获取血管弹性等级对应的标签样式
 * 功能：
 * - 根据血管弹性等级返回对应的颜色样式类名
 * - 支持不同血管健康等级（danger/critical/poor、moderate/fair、good/excellent）的样式区分
 * @param {string} level - 血管弹性等级字符串
 * @returns {string} 对应的Tailwind CSS类名字符串
 */
function getVascularBadgeClass(level: string) {
  /*根据血管弹性等级返回对应的标签样式*/
  if (level === 'danger' || level === 'critical' || level === 'poor') {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  if (level === 'moderate' || level === 'fair') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

/**
 * 健康洞察面板组件
 * 功能：
 * - 整合报警、睡眠、压力和血管健康数据
 * - 提供综合健康状态总览
 * - 显示各项健康指标的当前状态和建议
 * - 使用卡片布局提升可读性和信息密度
 * @param {HealthInsightPanelProps} props - 组件属性
 * @returns {JSX.Element} 健康洞察面板组件
 */
export function HealthInsightPanel({
  alarmCount,
  sleepScore,
  stressData,
  vascularData,
}: HealthInsightPanelProps) {
  /*整合报警、睡眠、压力和血管数据用于总览展示*/
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">健康洞察</CardTitle>
        <CardDescription>整合报警、睡眠、压力和血管状态，减少总览空白并提升可读性</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bell className="h-4 w-4 text-red-500" />
              未处理报警
            </div>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-2xl font-bold text-slate-900">{alarmCount}</span>
              <span className="pb-1 text-xs text-muted-foreground">条</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {alarmCount > 0 ? '建议优先处理异常指标' : '当前没有待处理告警'}
            </p>
          </div>
          <div className="rounded-xl border bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Moon className="h-4 w-4 text-indigo-500" />
              最近睡眠分
            </div>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-2xl font-bold text-slate-900">{sleepScore ?? '--'}</span>
              <span className="pb-1 text-xs text-muted-foreground">分</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {sleepScore === null ? '暂无睡眠记录' : sleepScore >= 80 ? '恢复状态较好' : sleepScore >= 60 ? '建议保持作息' : '需要重点补足睡眠'}
            </p>
          </div>
        </div>

        <div className="rounded-xl border p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Activity className="h-4 w-4 text-violet-600" />
                压力与情绪
              </div>
              <p className="mt-1 text-xs text-muted-foreground">来自最新 HRV 与压力分析</p>
            </div>
            <Badge variant="outline" className={getStressBadgeClass(stressData?.stress_level || 'low')}>
              {stressData ? STRESS_LEVEL_LABELS[stressData.stress_level] || stressData.stress_level : '暂无数据'}
            </Badge>
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-xs text-muted-foreground">压力分数</p>
              <p className="mt-1 font-semibold text-slate-900">{stressData?.stress_score ?? '--'}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-xs text-muted-foreground">情绪状态</p>
              <p className="mt-1 font-semibold text-slate-900">{stressData?.mood_state || '--'}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-xs text-muted-foreground">HRV 均值</p>
              <p className="mt-1 font-semibold text-slate-900">
                {typeof stressData?.hrv_mean === 'number' ? `${Math.round(stressData.hrv_mean)} ms` : '--'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <HeartPulse className="h-4 w-4 text-cyan-600" />
                血管弹性
              </div>
              <p className="mt-1 text-xs text-muted-foreground">基于最近一次血管弹性评估</p>
            </div>
            <Badge variant="outline" className={getVascularBadgeClass(vascularData?.elasticity_level || 'good')}>
              {vascularData ? VASCULAR_LEVEL_LABELS[vascularData.elasticity_level] || vascularData.elasticity_level : '暂无数据'}
            </Badge>
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-xs text-muted-foreground">健康评分</p>
              <p className="mt-1 font-semibold text-slate-900">{vascularData?.health_score ?? '--'}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-xs text-muted-foreground">评估时间</p>
              <p className="mt-1 font-semibold text-slate-900">
                {vascularData?.assessment_date
                  ? new Date(vascularData.assessment_date).toLocaleDateString('zh-CN')
                  : vascularData?.recorded_at
                    ? new Date(vascularData.recorded_at).toLocaleDateString('zh-CN')
                    : '--'}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
