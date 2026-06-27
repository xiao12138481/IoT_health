'use client';

/**
 * 健康指标卡片组件
 * 功能描述：
 * - 显示健康指标数值
 * - 指标状态（正常/偏高/偏低）
 * - 阈值范围显示
 * - 步数进度条
 * - 更新时间显示
 * 
 * 支持的指标：
 * - 心率（红色）
 * - 血氧（蓝色）
 * - 体温（橙色）
 * - 血压（紫色）
 * - 步数（绿色）
 * 
 * 关联页面：
 * - 管理员健康总览
 * - 用户健康总览
 */

import { Card } from '@/components/ui/card';
import { Heart, Droplets, Thermometer, Footprints, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

/*健康指标卡片组件属性*/
interface MetricCardProps {
  /** 指标标题 */
  title: string;
  /** 指标主数值 */
  value: number | string;
  /** 指标副数值（用于血压等双值指标） */
  value2?: number | string;
  /** 指标单位 */
  unit: string;
  /** 指标副单位 */
  unit2?: string;
  /** 图标类型：heart（心率）、oxygen（血氧）、temperature（体温）、steps（步数）、bloodpressure（血压） */
  icon: 'heart' | 'oxygen' | 'temperature' | 'steps' | 'bloodpressure';
  /** 颜色主题：red（红色）、blue（蓝色）、orange（橙色）、green（绿色）、purple（紫色） */
  color: 'red' | 'blue' | 'orange' | 'green' | 'purple';
  /** 状态：normal（正常）、high（偏高）、low（偏低） */
  status: 'normal' | 'high' | 'low';
  /** 最小值阈值 */
  min?: number;
  /** 最大值阈值 */
  max?: number;
  /** 副最小值阈值（用于血压等双值指标） */
  min2?: number;
  /** 副最大值阈值（用于血压等双值指标） */
  max2?: number;
  /** 目标值（用于步数等目标导向指标） */
  goal?: number;
  /** 是否为步数指标 */
  isSteps?: boolean;
  /** 是否为血压指标 */
  isBloodPressure?: boolean;
  /** 记录时间 */
  recordedAt?: string;
}

const iconMap = {
  heart: Heart,
  oxygen: Droplets,
  temperature: Thermometer,
  steps: Footprints,
  bloodpressure: Activity,
};

const colorConfig = {
  red: {
    bg: 'from-red-50 to-rose-50',
    iconBg: 'from-red-100 to-rose-100',
    iconText: 'text-red-600',
    valueText: 'text-red-700',
    border: 'border-red-100',
    accent: 'bg-red-500',
  },
  blue: {
    bg: 'from-blue-50 to-cyan-50',
    iconBg: 'from-blue-100 to-cyan-100',
    iconText: 'text-blue-600',
    valueText: 'text-blue-700',
    border: 'border-blue-100',
    accent: 'bg-blue-500',
  },
  orange: {
    bg: 'from-orange-50 to-amber-50',
    iconBg: 'from-orange-100 to-amber-100',
    iconText: 'text-orange-600',
    valueText: 'text-orange-700',
    border: 'border-orange-100',
    accent: 'bg-orange-500',
  },
  green: {
    bg: 'from-green-50 to-emerald-50',
    iconBg: 'from-green-100 to-emerald-100',
    iconText: 'text-green-600',
    valueText: 'text-green-700',
    border: 'border-green-100',
    accent: 'bg-green-500',
  },
  purple: {
    bg: 'from-purple-50 to-violet-50',
    iconBg: 'from-purple-100 to-violet-100',
    iconText: 'text-purple-600',
    valueText: 'text-purple-700',
    border: 'border-purple-100',
    accent: 'bg-purple-500',
  },
};

const statusLabels = {
  normal: '正常',
  high: '偏高',
  low: '偏低',
};

/**
 * 健康指标卡片组件
 * 功能：
 * - 显示健康指标的数值和状态
 * - 支持多种指标类型（心率、血氧、体温、血压、步数）
 * - 显示阈值范围和目标进度
 * - 提供交互式悬停效果
 * - 显示记录更新时间
 * @param {MetricCardProps} props - 组件属性
 * @returns {JSX.Element} 健康指标卡片组件
 */
export function MetricCard({
  title,
  value,
  value2,
  unit,
  unit2,
  icon,
  color,
  status,
  min,
  max,
  min2,
  max2,
  goal,
  isSteps,
  isBloodPressure,
  recordedAt,
}: MetricCardProps) {
  /*根据配置映射当前图标和配色方案*/
  const Icon = iconMap[icon];
  const cfg = colorConfig[color];

  /*计算步数进度和阈值显示条件*/
  const progressPercent = isSteps && goal ? Math.min(100, Math.round(((value as number) / goal) * 100)) : 0;
  const hasMin = min !== undefined;
  const hasMax = max !== undefined;
  const hasMin2 = min2 !== undefined;
  const hasMax2 = max2 !== undefined;

  /*根据卡片类型生成阈值或目标说明文本*/
  let thresholdText: string | null = null;

  if (isBloodPressure && (hasMin || hasMax || hasMin2 || hasMax2)) {
    thresholdText = `${hasMin ? min : '--'}~${hasMax ? max : '--'} / ${hasMin2 ? min2 : '--'}~${hasMax2 ? max2 : '--'}`;
  } else if (hasMin || hasMax) {
    thresholdText = `${hasMin ? min : '--'}~${hasMax ? max : '--'}`;
  } else if (isSteps && goal) {
    thresholdText = `目标 ${goal.toLocaleString()}`;
  }

  return (
    <Card className={cn(
      'relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5',
      'bg-gradient-to-br',
      cfg.bg,
      cfg.border
    )}>
      {/* 装饰角 */}
      <div className={cn(
        'absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-20',
        cfg.accent
      )} />
      
      <div className="relative z-10 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground/80">{title}</p>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className={cn('text-3xl font-bold tabular-nums tracking-tight', cfg.valueText)}>
                {value}
              </span>
              <span className="text-sm text-muted-foreground/70">{unit}</span>
              {isBloodPressure && value2 !== undefined && (
                <>
                  <span className="text-lg text-muted-foreground/50">/</span>
                  <span className={cn('text-2xl font-bold tabular-nums', cfg.valueText)}>
                    {value2}
                  </span>
                  <span className="text-sm text-muted-foreground/70">{unit2 || unit}</span>
                </>
              )}
            </div>
          </div>
          <div className={cn(
            'flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm',
            cfg.iconBg
          )}>
            <Icon className={cn('h-6 w-6', cfg.iconText)} />
          </div>
        </div>

        {/* 状态和进度 */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status === 'high' ? (
              <TrendingUp className="h-4 w-4 text-red-500" />
            ) : status === 'low' ? (
              <TrendingDown className="h-4 w-4 text-orange-500" />
            ) : (
              <Minus className="h-4 w-4 text-green-500" />
            )}
            <span
              className={cn(
                'text-xs font-semibold',
                status === 'normal' 
                  ? 'text-green-700' 
                  : status === 'high' 
                    ? 'text-red-700' 
                    : 'text-orange-700'
              )}
            >
              {statusLabels[status]}
            </span>
          </div>
          {isSteps && goal ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground/70">{progressPercent}%</span>
            </div>
          ) : null}
        </div>

        {/* 阈值信息 */}
        {thresholdText ? (
          <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/60 px-2.5 py-1">
            <span className="text-[11px] text-muted-foreground">
              {isBloodPressure || isSteps ? thresholdText : `${thresholdText} ${unit}`}
            </span>
          </div>
        ) : null}

        {/* 步数进度条 */}
        {isSteps && goal ? (
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/60">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700 ease-out',
                cfg.accent
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        ) : null}

        {/* 更新时间 */}
        {recordedAt && (
          <p className="mt-3 text-[11px] text-muted-foreground/60 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            更新于 {new Date(recordedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </Card>
  );
}
