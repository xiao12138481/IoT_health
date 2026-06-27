'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Activity,
  Heart,
  Wind,
  Thermometer,
  Trophy,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

/*健康评分组件属性*/
interface HealthScoreProps {
  /** 心率值（bpm），可为null表示无数据 */
  heartRate: number | null;
  /** 血氧饱和度（%），可为null表示无数据 */
  bloodOxygen: number | null;
  /** 体温值（°C），可为null表示无数据 */
  bodyTemp: number | null;
  /** 步数统计，可为null表示无数据 */
  steps: number | null;
  /** 睡眠评分（0-100），可为null表示无数据 */
  sleepScore: number | null;
  /** 是否存在未处理的报警 */
  hasActiveAlarms: boolean;
}

/**
 * 健康评分组件
 * 功能：
 * - 根据多项健康指标计算综合健康评分
 * - 显示环形进度图表展示评分结果
 * - 根据评分等级显示不同的颜色和状态
 * - 展示各项健康指标的当前值
 * @param {HealthScoreProps} props - 组件属性
 * @returns {JSX.Element} 健康评分组件
 */
export function HealthScore({
  heartRate,
  bloodOxygen,
  bodyTemp,
  steps,
  sleepScore,
  hasActiveAlarms,
}: HealthScoreProps) {
  /*根据各项健康指标累计计算综合健康评分*/
  let score = 100;
  
  /*心率偏离正常范围时扣分*/
  if (heartRate !== null) {
    if (heartRate < 60) score -= Math.max(0, 60 - heartRate) * 0.5;
    else if (heartRate > 100) score -= Math.max(0, heartRate - 100) * 0.5;
  } else {
    score -= 10;
  }
  
  /*血氧低于正常范围时扣分*/
  if (bloodOxygen !== null) {
    if (bloodOxygen < 95) score -= Math.max(0, 95 - bloodOxygen) * 2;
  } else {
    score -= 10;
  }
  
  /*体温偏离正常范围时扣分*/
  if (bodyTemp !== null) {
    if (bodyTemp < 36.0) score -= Math.max(0, 36.0 - bodyTemp) * 10;
    else if (bodyTemp > 37.3) score -= Math.max(0, bodyTemp - 37.3) * 10;
  } else {
    score -= 10;
  }
  
  /*步数未达到目标时按比例扣分*/
  if (steps !== null) {
    const stepsProgress = Math.min(100, (steps / 8000) * 100);
    score -= (100 - stepsProgress) * 0.1;
  } else {
    score -= 10;
  }
  
  /*睡眠分较低时额外扣分*/
  if (sleepScore !== null) {
    if (sleepScore < 60) score -= (60 - sleepScore) * 0.2;
  } else {
    score -= 10;
  }
  
  /*存在未处理报警时增加风险扣分*/
  if (hasActiveAlarms) {
    score -= 15;
  }
  
  const finalScore = Math.max(0, Math.round(score));
  
  /*根据最终分数映射健康等级和颜色样式*/
  let level: 'excellent' | 'good' | 'fair' | 'warning';
  let levelText: string;
  let colorClass: string;
  let circleColor: string;
  
  if (finalScore >= 90) {
    level = 'excellent';
    levelText = '优秀';
    colorClass = 'text-emerald-500';
    circleColor = 'from-emerald-400 to-green-600';
  } else if (finalScore >= 75) {
    level = 'good';
    levelText = '良好';
    colorClass = 'text-blue-500';
    circleColor = 'from-blue-400 to-blue-600';
  } else if (finalScore >= 60) {
    level = 'fair';
    levelText = '一般';
    colorClass = 'text-amber-500';
    circleColor = 'from-amber-400 to-orange-600';
  } else {
    level = 'warning';
    levelText = '需关注';
    colorClass = 'text-red-500';
    circleColor = 'from-red-400 to-red-600';
  }
  
  return (
    <Card className="relative overflow-hidden p-6">
      {/* 背景装饰 */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-slate-100/50 to-slate-50" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">健康评分</p>
            <p className="text-xs text-muted-foreground/70">今日综合健康指数</p>
          </div>
          <Trophy className={cn('h-6 w-6', colorClass)} />
        </div>
        
        <div className="flex items-center gap-6">
          {/* 环形进度 */}
          <div className="relative">
            <svg className="w-32 h-32 transform -rotate-90">
              {/* 背景环 */}
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="10"
              />
              {/* 进度环 */}
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke={
                  level === 'excellent' ? '#22c55e' :
                  level === 'good' ? '#3b82f6' :
                  level === 'fair' ? '#f59e0b' : '#ef4444'
                }
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray="351.86"
                strokeDashoffset={351.86 - (finalScore / 100) * 351.86}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className={cn('text-3xl font-bold', colorClass)}>
                {finalScore}
              </span>
              <span className="text-xs text-muted-foreground mt-1">分</span>
            </div>
          </div>
          
          {/* 健康指标 */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-sm font-semibold',
                colorClass
              )}>
                {levelText}
              </span>
              {hasActiveAlarms ? (
                <span className="flex items-center gap-1 text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                  <Activity className="h-3 w-3" />
                  有未处理报警
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                  <Heart className="h-3 w-3" />
                  状态稳定
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" />
                <span className="font-medium text-slate-700">
                  {heartRate !== null ? `${heartRate} bpm` : '--'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Wind className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-slate-700">
                  {bloodOxygen !== null ? `${bloodOxygen}%` : '--'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-orange-500" />
                <span className="font-medium text-slate-700">
                  {bodyTemp !== null ? `${bodyTemp.toFixed(1)}°C` : '--'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="font-medium text-slate-700">
                  {steps !== null ? `${steps.toLocaleString()} 步` : '--'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
