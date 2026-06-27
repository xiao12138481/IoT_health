'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Moon } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

/*睡眠摘要组件属性接口*/
interface SleepSummaryProps {
  /** 睡眠记录数据，为null时显示无数据状态 */
  sleep: {
    /** 睡眠记录ID */
    id: number;
    /** 睡眠开始时间 */
    start_time: string;
    /** 睡眠结束时间 */
    end_time: string;
    /** 深度睡眠时长（分钟） */
    deep_sleep_min: number;
    /** 浅度睡眠时长（分钟） */
    light_sleep_min: number;
    /** REM睡眠时长（分钟） */
    rem_sleep_min: number;
    /** 清醒时长（分钟） */
    awake_min: number;
    /** 睡眠质量评分（0-100） */
    score: number;
    /** 记录创建时间 */
    recorded_at: string;
  } | null;
  /** 睡眠目标时长（分钟），可选 */
  goal?: number;
}

/*睡眠阶段饼图颜色配置*/
const SLEEP_COLORS = ['#6366F1', '#818CF8', '#A5B4FC', '#E0E7FF'];

/**
 * 格式化时长显示
 * 功能：
 * - 将分钟数转换为"Xh Ym"格式的易读字符串
 * - 自动计算小时和分钟部分
 * - 如果分钟数为0，则只显示小时部分
 * - 示例：125分钟 → "2h 5m"，60分钟 → "1h"
 * @param {number} minutes - 总分钟数
 * @returns {string} 格式化后的时长字符串
 */
function formatDuration(minutes: number): string {
  /*把分钟数格式化成小时和分钟文本*/
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m > 0 ? `${m}m` : ''}`;
}

/**
 * 格式化时间显示
 * 功能：
 * - 将时间戳转换为"HH:MM"格式的时分字符串
 * - 使用中文地区格式显示
 * - 示例："2024-06-25T22:30:00Z" → "22:30"
 * @param {string} timestamp - ISO格式的时间戳
 * @returns {string} 格式化后的时间字符串（HH:MM格式）
 */
function formatTime(timestamp: string): string {
  /*把时间戳格式化成时分显示*/
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 根据睡眠评分获取睡眠等级信息
 * 功能：
 * - 根据评分范围确定睡眠等级（优秀、良好、一般、需关注）
 * - 返回对应的中文标签和Tailwind CSS样式类
 * - 用于UI中的等级显示和样式设置
 * @param {number} score - 睡眠质量评分（0-100）
 * @returns {object} 包含等级标签和样式类的对象
 */
function getSleepLevel(score: number) {
  /*根据睡眠分数返回等级文案和样式*/
  if (score >= 85) {
    return { label: '优秀', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  }
  if (score >= 70) {
    return { label: '良好', className: 'border-blue-200 bg-blue-50 text-blue-700' };
  }
  if (score >= 60) {
    return { label: '一般', className: 'border-amber-200 bg-amber-50 text-amber-700' };
  }
  return { label: '需关注', className: 'border-red-200 bg-red-50 text-red-700' };
}

/**
 * 睡眠摘要组件
 * 功能：
 * - 显示最新的睡眠记录数据
 * - 以饼图形式展示睡眠阶段分布
 * - 显示睡眠质量评分和等级
 * - 支持睡眠目标进度显示
 * - 处理无数据状态显示
 * @param {SleepSummaryProps} props - 组件属性
 * @returns {JSX.Element} 睡眠摘要组件
 */
export function SleepSummary({ sleep, goal }: SleepSummaryProps) {
  if (!sleep) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Moon className="h-5 w-5 text-indigo-500" />
            睡眠分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground">暂无睡眠数据</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalMin = sleep.deep_sleep_min + sleep.light_sleep_min + sleep.rem_sleep_min + sleep.awake_min;
  /*整理睡眠阶段饼图数据*/
  const sleepData = [
    { name: '深度睡眠', value: sleep.deep_sleep_min },
    { name: '浅度睡眠', value: sleep.light_sleep_min },
    { name: 'REM睡眠', value: sleep.rem_sleep_min },
    { name: '清醒', value: sleep.awake_min },
  ];

  /*根据睡眠分数计算文本颜色和等级标签*/
  const scoreColor = sleep.score >= 80 ? 'text-green-600' : sleep.score >= 60 ? 'text-yellow-600' : 'text-red-600';
  const sleepLevel = getSleepLevel(sleep.score);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Moon className="h-5 w-5 text-indigo-500" />
            睡眠分析
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {new Date(sleep.start_time).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-[132px_1fr_180px] lg:items-center">
          <div className="relative h-32 w-32 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sleepData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={55}
                  paddingAngle={2}
                  dataKey="value"
                  animationDuration={600}
                >
                  {sleepData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={SLEEP_COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [formatDuration(value), name]}
                  contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Score in center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <span className={`text-lg font-bold ${scoreColor}`}>{sleep.score}</span>
                <p className="text-[9px] text-muted-foreground">睡眠分</p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">总时长</span>
              <span className="text-sm font-semibold">{formatDuration(totalMin)}</span>
            </div>
            <div className="space-y-1.5">
              {sleepData.map((item, i) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: SLEEP_COLORS[i] }} />
                  <span className="text-xs text-muted-foreground flex-1">{item.name}</span>
                  <span className="text-xs font-medium tabular-nums">{formatDuration(item.value)}</span>
                </div>
              ))}
            </div>
            {goal && (
              <div className="pt-1 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">目标睡眠</span>
                  <span className="text-[10px] text-muted-foreground">{formatDuration(goal)}</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-indigo-100">
                  <div
                    className="h-1.5 rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${Math.min(100, (totalMin / goal) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-slate-50 p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-900">睡眠摘要</span>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${sleepLevel.className}`}>
                {sleepLevel.label}
              </span>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">入睡时间</span>
                <span className="font-medium text-slate-900">{formatTime(sleep.start_time)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">起床时间</span>
                <span className="font-medium text-slate-900">{formatTime(sleep.end_time)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">睡眠分等级</span>
                <span className="font-medium text-slate-900">{sleepLevel.label}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
