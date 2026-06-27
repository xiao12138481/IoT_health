'use client';

/**
 * 用户正念呼吸训练页面
 * 功能描述：
 * - 个人正念呼吸训练
 * - 分场景呼吸引导，实时观察心率回落和血氧改善
 * - 适合助眠、减压和平复心慌
 */

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/layout/app-provider';
import { UserHeader } from '@/components/layout/user-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  Clock3,
  Droplets,
  Heart,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Wind,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type ScenarioKey = 'sleep' | 'stress' | 'palpitation';
type DurationMinutes = 1 | 3 | 5;
type PhaseKey = 'inhale' | 'hold' | 'exhale' | 'rest';

interface DashboardResponse {
  person: {
    id: number;
    name: string;
  } | null;
  latestRecord: {
    heart_rate: number | null;
    blood_oxygen: number | null;
    recorded_at: string;
  } | null;
}

interface BaselineMetrics {
  heartRate: number;
  bloodOxygen: number;
}

interface BreathPhase {
  key: PhaseKey;
  label: string;
  seconds: number;
  instruction: string;
}

interface ScenarioConfig {
  title: string;
  subtitle: string;
  description: string;
  accentClass: string;
  softClass: string;
  icon: typeof Moon;
  focus: string;
  expectedResult: string;
  tip: string;
  phases: BreathPhase[];
  heartRateDrop: Record<DurationMinutes, number>;
  bloodOxygenRise: Record<DurationMinutes, number>;
}

interface SessionMetrics {
  heartRate: number;
  bloodOxygen: number;
}

interface TrendPoint {
  second: number;
  timeLabel: string;
  heartRate: number;
  bloodOxygen: number;
}

const DURATION_OPTIONS: DurationMinutes[] = [1, 3, 5];

const SCENARIOS: Record<ScenarioKey, ScenarioConfig> = {
  sleep: {
    title: '助眠呼吸',
    subtitle: '睡前放松神经，帮助更快进入安静状态',
    description: '节奏更慢，呼气更长，适合夜间入睡前或午休前使用。',
    accentClass: 'bg-indigo-600',
    softClass: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    icon: Moon,
    focus: '把注意力放到腹部起伏，吸气时感受身体展开，呼气时主动放松肩颈。',
    expectedResult: '训练后心率会逐步回落，血氧轻微提升，身体进入更平稳的准备入睡状态。',
    tip: '建议配合柔和灯光或闭眼训练，结束后尽量避免立即查看手机。',
    phases: [
      { key: 'inhale', label: '吸气', seconds: 4, instruction: '用鼻缓慢吸气，腹部自然鼓起。' },
      { key: 'hold', label: '停顿', seconds: 2, instruction: '短暂停留，让气息稳定沉下来。' },
      { key: 'exhale', label: '呼气', seconds: 6, instruction: '用嘴慢慢呼气，尽量把呼气拉长。' },
      { key: 'rest', label: '静息', seconds: 1, instruction: '感受身体放松，再进入下一轮。' },
    ],
    heartRateDrop: { 1: 4, 3: 8, 5: 11 },
    bloodOxygenRise: { 1: 0.3, 3: 0.8, 5: 1.2 },
  },
  stress: {
    title: '减压呼吸',
    subtitle: '稳定节奏，快速降低紧绷感与烦躁感',
    description: '适合工作间隙、会议后或情绪紧绷时做短时间恢复。',
    accentClass: 'bg-teal-600',
    softClass: 'border-teal-200 bg-teal-50 text-teal-700',
    icon: Wind,
    focus: '每次呼气时主动放松下颌和肩膀，把注意力放在呼气变长的感觉上。',
    expectedResult: '训练过程中可明显看到心率下降，血氧逐步回升，主观紧张度缓解。',
    tip: '建议背部坐直，双脚踩稳地面，配合均匀节奏完成整个训练。',
    phases: [
      { key: 'inhale', label: '吸气', seconds: 4, instruction: '吸气 4 秒，注意气息均匀。' },
      { key: 'hold', label: '停顿', seconds: 2, instruction: '停顿 2 秒，让呼吸变得更稳。' },
      { key: 'exhale', label: '呼气', seconds: 5, instruction: '缓慢呼气，感受胸口逐渐放松。' },
      { key: 'rest', label: '静息', seconds: 1, instruction: '停留 1 秒，准备下一轮。' },
    ],
    heartRateDrop: { 1: 5, 3: 10, 5: 13 },
    bloodOxygenRise: { 1: 0.4, 3: 0.9, 5: 1.4 },
  },
  palpitation: {
    title: '平复心慌',
    subtitle: '通过更长呼气帮助快速恢复稳定感',
    description: '适合短时心慌、紧张性心跳快时，帮助尽快回到可控节奏。',
    accentClass: 'bg-rose-600',
    softClass: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: Shield,
    focus: '盯住呼气，心里默数呼气节拍，让心跳和呼气一起慢下来。',
    expectedResult: '训练后可看到心率回落幅度更明显，血氧稳定回升，主观慌乱感减轻。',
    tip: '如果伴随胸痛、明显头晕或持续不缓解，请停止训练并尽快联系医生。',
    phases: [
      { key: 'inhale', label: '吸气', seconds: 3, instruction: '轻柔吸气，不要用力过猛。' },
      { key: 'hold', label: '停顿', seconds: 1, instruction: '短暂停顿，保持肩膀放松。' },
      { key: 'exhale', label: '呼气', seconds: 6, instruction: '更慢地呼气，把呼气拉到更长。' },
      { key: 'rest', label: '静息', seconds: 1, instruction: '短暂停留，感受心跳渐稳。' },
    ],
    heartRateDrop: { 1: 6, 3: 11, 5: 15 },
    bloodOxygenRise: { 1: 0.4, 3: 1.0, 5: 1.5 },
  },
};

/**
 * 限制数值范围
 * 功能：
 * - 确保数值在指定的最小值和最大值之间
 * - 如果值小于最小值，返回最小值
 * - 如果值大于最大值，返回最大值
 * - 如果值在范围内，返回原值
 * @param {number} value - 原始数值
 * @param {number} min - 允许的最小值
 * @param {number} max - 允许的最大值
 * @returns {number} 限制后的数值
 */
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * 四舍五入到一位小数
 * 功能：
 * - 将数值四舍五入保留一位小数
 * - 用于血氧等需要一位小数精度的指标显示
 * @param {number} value - 原始数值
 * @returns {number} 四舍五入后的一位小数数值
 */
function roundToOne(value: number) {
  return Math.round(value * 10) / 10;
}

/**
 * 缓出动画函数
 * 功能：
 * - 实现二次缓出动画效果
 * - 用于训练进度动画，使结束时的变化更平滑
 * - 公式：1 - (1 - progress)²
 * @param {number} progress - 进度值（0-1）
 * @returns {number} 缓出处理后的进度值
 */
function easeOut(progress: number) {
  return 1 - (1 - progress) * (1 - progress);
}

/**
 * 格式化秒数为时间字符串
 * 功能：
 * - 将总秒数转换为"MM:SS"格式的时间字符串
 * - 分钟和秒数都使用两位数字显示（如 01:30）
 * - 自动处理分钟和秒数的计算
 * @param {number} totalSeconds - 总秒数
 * @returns {string} 格式化后的时间字符串（MM:SS格式）
 */
function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * 获取当前呼吸阶段
 * 功能：
 * - 根据已过去的时间和呼吸阶段配置计算当前所处的呼吸阶段
 * - 计算当前阶段内的秒数（phaseSecond）
 * - 计算当前阶段的进度百分比（phaseProgress）
 * - 计算完整的呼吸周期长度（cycleLength）
 * - 处理循环呼吸逻辑，支持多个呼吸阶段循环
 * @param {BreathPhase[]} phases - 呼吸阶段配置数组
 * @param {number} elapsedSeconds - 已过去的秒数
 * @returns {object} 包含当前阶段、阶段秒数、阶段进度和周期长度的对象
 */
function getBreathPhase(phases: BreathPhase[], elapsedSeconds: number) {
  const cycleLength = phases.reduce((sum, phase) => sum + phase.seconds, 0);
  const cycleSecond = elapsedSeconds % cycleLength;
  let cursor = 0;

  for (const phase of phases) {
    if (cycleSecond < cursor + phase.seconds) {
      return {
        phase,
        phaseSecond: cycleSecond - cursor,
        phaseProgress: phase.seconds === 0 ? 0 : (cycleSecond - cursor) / phase.seconds,
        cycleLength,
      };
    }
    cursor += phase.seconds;
  }

  return {
    phase: phases[0],
    phaseSecond: 0,
    phaseProgress: 0,
    cycleLength,
  };
}

/**
 * 获取会话指标数据
 * 功能：
 * - 根据基线数据、场景配置、训练时长和已过去时间计算实时健康指标
 * - 结合呼吸阶段计算呼吸波动对心率的影响
 * - 使用缓出动画函数平滑训练进度
 * - 计算训练期间的心率下降和血氧上升效果
 * - 确保计算出的指标在合理范围内（心率50-130，血氧92-100）
 * @param {BaselineMetrics} baseline - 基线健康指标（训练前的心率和血氧）
 * @param {ScenarioConfig} scenario - 训练场景配置
 * @param {DurationMinutes} duration - 训练时长（分钟）
 * @param {number} elapsedSeconds - 已过去的秒数
 * @param {number} totalSeconds - 总训练秒数
 * @returns {SessionMetrics} 包含实时心率和血氧的指标对象
 */
function getSessionMetrics(
  baseline: BaselineMetrics,
  scenario: ScenarioConfig,
  duration: DurationMinutes,
  elapsedSeconds: number,
  totalSeconds: number
): SessionMetrics {
  const breathState = getBreathPhase(scenario.phases, elapsedSeconds);
  const progress = totalSeconds === 0 ? 0 : clamp(elapsedSeconds / totalSeconds, 0, 1);
  const smoothProgress = easeOut(progress);
  const maxHeartRateDrop = scenario.heartRateDrop[duration];
  const maxBloodOxygenRise = scenario.bloodOxygenRise[duration];

  let breathWave = 0;
  if (breathState.phase.key === 'inhale') {
    breathWave = 1.4 * breathState.phaseProgress;
  } else if (breathState.phase.key === 'hold') {
    breathWave = 1.2;
  } else if (breathState.phase.key === 'exhale') {
    breathWave = 1.2 - 2.2 * breathState.phaseProgress;
  } else {
    breathWave = -0.6;
  }

  const heartRate = Math.round(clamp(
    baseline.heartRate - maxHeartRateDrop * smoothProgress + breathWave,
    50,
    130
  ));

  const bloodOxygen = roundToOne(clamp(
    baseline.bloodOxygen + maxBloodOxygenRise * smoothProgress - breathWave * 0.08,
    92,
    100
  ));

  return {
    heartRate,
    bloodOxygen,
  };
}

export default function UserMindfulBreathingPage() {
  const { currentPersonId, alarmCount, isLoading } = useApp();
  /*训练场景和会话状态*/
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>('stress');
  const [durationMinutes, setDurationMinutes] = useState<DurationMinutes>(3);
  const [demoMode, setDemoMode] = useState(false);
  const [loadingBaseline, setLoadingBaseline] = useState(true);
  const [personName, setPersonName] = useState('');
  const [baseline, setBaseline] = useState<BaselineMetrics>({ heartRate: 82, bloodOxygen: 97.2 });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const scenario = SCENARIOS[scenarioKey];
  const totalSeconds = durationMinutes * 60;
  const speedMultiplier = demoMode ? 5 : 1;
  const progressValue = totalSeconds === 0 ? 0 : (elapsedSeconds / totalSeconds) * 100;
  const remainingSeconds = Math.max(totalSeconds - elapsedSeconds, 0);
  /*根据当前进度计算实时指标*/
  const liveMetrics = useMemo(
    () => getSessionMetrics(baseline, scenario, durationMinutes, elapsedSeconds, totalSeconds),
    [baseline, scenario, durationMinutes, elapsedSeconds, totalSeconds]
  );

  const currentPhase = useMemo(
    () => getBreathPhase(scenario.phases, elapsedSeconds),
    [scenario, elapsedSeconds]
  );

  /*生成训练过程中的趋势图数据*/
  const trendData = useMemo<TrendPoint[]>(() => {
    const upperBound = Math.max(elapsedSeconds, 0);
    const step = totalSeconds > 180 ? 5 : 1;
    const points: TrendPoint[] = [];

    for (let second = 0; second <= upperBound; second += step) {
      const metrics = getSessionMetrics(baseline, scenario, durationMinutes, second, totalSeconds);
      points.push({
        second,
        timeLabel: formatSeconds(second),
        heartRate: metrics.heartRate,
        bloodOxygen: metrics.bloodOxygen,
      });
    }

    if (upperBound > 0 && points[points.length - 1]?.second !== upperBound) {
      const metrics = getSessionMetrics(baseline, scenario, durationMinutes, upperBound, totalSeconds);
      points.push({
        second: upperBound,
        timeLabel: formatSeconds(upperBound),
        heartRate: metrics.heartRate,
        bloodOxygen: metrics.bloodOxygen,
      });
    }

    if (points.length === 0) {
      points.push({
        second: 0,
        timeLabel: '00:00',
        heartRate: baseline.heartRate,
        bloodOxygen: baseline.bloodOxygen,
      });
    }

    return points;
  }, [baseline, scenario, durationMinutes, elapsedSeconds, totalSeconds]);

  const heartRateDelta = baseline.heartRate - liveMetrics.heartRate;
  const bloodOxygenDelta = roundToOne(liveMetrics.bloodOxygen - baseline.bloodOxygen);
  /*根据呼吸阶段计算动画缩放比例*/
  const phaseScale = useMemo(() => {
    if (currentPhase.phase.key === 'inhale') {
      return 1 + currentPhase.phaseProgress * 0.32;
    }
    if (currentPhase.phase.key === 'hold') {
      return 1.32;
    }
    if (currentPhase.phase.key === 'exhale') {
      return 1.32 - currentPhase.phaseProgress * 0.26;
    }
    return 1.06;
  }, [currentPhase]);

  /*切换人员后加载基线心率和血氧*/
  useEffect(() => {
    if (!currentPersonId) {
      return;
    }

    let isMounted = true;

    async function loadBaseline() {
      setLoadingBaseline(true);

      try {
        const response = await fetch(`/api/dashboard?person_id=${currentPersonId}`, { cache: 'no-store' });
        const data: DashboardResponse = await response.json();

        if (!isMounted) {
          return;
        }

        setPersonName(data.person?.name ?? '用户');
        setBaseline({
          heartRate: data.latestRecord?.heart_rate ?? 82,
          bloodOxygen: roundToOne(data.latestRecord?.blood_oxygen ?? 97.2),
        });
      } catch {
        if (!isMounted) {
          return;
        }

        setPersonName('用户');
        setBaseline({ heartRate: 82, bloodOxygen: 97.2 });
      } finally {
        if (isMounted) {
          setLoadingBaseline(false);
        }
      }
    }

    void loadBaseline();

    return () => {
      isMounted = false;
    };
  }, [currentPersonId]);

  /*切换场景或时长后重置训练状态*/
  useEffect(() => {
    setElapsedSeconds(0);
    setIsRunning(false);
    setIsCompleted(false);
  }, [scenarioKey, durationMinutes, currentPersonId]);

  /*训练开始后按秒推进会话进度*/
  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds((previous) => {
        const nextValue = Math.min(previous + speedMultiplier, totalSeconds);

        if (nextValue >= totalSeconds) {
          window.clearInterval(timer);
          setIsRunning(false);
          setIsCompleted(true);
        }

        return nextValue;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning, totalSeconds, speedMultiplier]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
          <p className="text-sm text-muted-foreground">正在初始化训练场景...</p>
        </div>
      </div>
    );
  }

  const ScenarioIcon = scenario.icon;

  return (
    <div className="flex flex-col">
      <UserHeader />

      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <Wind className="h-7 w-7 text-teal-600" />
              正念呼吸训练
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              分场景呼吸引导，实时观察心率回落和血氧改善，适合助眠、减压和平复心慌。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={demoMode ? 'default' : 'outline'}
              onClick={() => setDemoMode((previous) => !previous)}
              className={demoMode ? 'bg-teal-600 hover:bg-teal-700' : ''}
            >
              {demoMode ? '演示加速中' : '开启演示加速'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setElapsedSeconds(0);
                setIsCompleted(false);
                setIsRunning(false);
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              重置训练
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {(Object.entries(SCENARIOS) as [ScenarioKey, ScenarioConfig][]).map(([key, item]) => {
            const ItemIcon = item.icon;
            const isActive = scenarioKey === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setScenarioKey(key)}
                className={`rounded-2xl border p-5 text-left transition-all ${
                  isActive ? `${item.softClass} shadow-sm` : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <div className={`rounded-xl p-2 ${isActive ? item.accentClass : 'bg-slate-100'}`}>
                        <ItemIcon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-slate-600'}`} />
                      </div>
                      <Badge variant="outline">{item.title}</Badge>
                    </div>
                    <p className="text-sm font-medium text-slate-900">{item.subtitle}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <ScenarioIcon className="h-5 w-5 text-slate-700" />
                    {scenario.title}
                  </CardTitle>
                  <CardDescription>
                    建议在安静坐姿下完成本轮训练。
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DURATION_OPTIONS.map((option) => (
                    <Button
                      key={option}
                      size="sm"
                      variant={durationMinutes === option ? 'default' : 'outline'}
                      className={durationMinutes === option ? scenario.accentClass : ''}
                      onClick={() => setDurationMinutes(option)}
                    >
                      {option} 分钟
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                  <div className="flex items-center justify-between">
                    <Badge className={scenario.accentClass}>{currentPhase.phase.label}</Badge>
                    <span className="text-sm text-muted-foreground">
                      剩余 {formatSeconds(remainingSeconds)}
                    </span>
                  </div>

                  <div className="flex flex-col items-center justify-center pt-8 pb-12">
                    <div
                      className={`flex h-52 w-52 items-center justify-center rounded-full bg-white shadow-inner ring-8 ${
                        scenarioKey === 'sleep'
                          ? 'ring-indigo-100'
                          : scenarioKey === 'stress'
                            ? 'ring-teal-100'
                            : 'ring-rose-100'
                      }`}
                      style={{
                        transform: `scale(${phaseScale})`,
                        transition: 'transform 900ms linear',
                      }}
                    >
                      <div className={`flex h-36 w-36 flex-col items-center justify-center rounded-full text-white ${scenario.accentClass}`}>
                        <span className="text-sm opacity-90">{currentPhase.phase.label}</span>
                        <span className="mt-1 text-3xl font-bold">
                          {currentPhase.phase.seconds - currentPhase.phaseSecond}
                        </span>
                      </div>
                    </div>
                    <p className="mt-14 text-center text-sm text-slate-700">{currentPhase.phase.instruction}</p>
                  </div>

                  <Progress value={progressValue} className="h-3" />
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>训练进度 {Math.round(progressValue)}%</span>
                    <span>{formatSeconds(elapsedSeconds)} / {formatSeconds(totalSeconds)}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Card>
                      <CardContent className="pt-5">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Heart className="h-4 w-4 text-rose-500" />
                          实时心率
                        </div>
                        <div className="mt-3 flex items-end gap-2">
                          <span className="text-3xl font-bold text-slate-900">{liveMetrics.heartRate}</span>
                          <span className="pb-1 text-sm text-muted-foreground">bpm</span>
                        </div>
                        <p className="mt-2 text-xs text-emerald-600">
                          较开始 {heartRateDelta >= 0 ? `下降 ${heartRateDelta}` : `上升 ${Math.abs(heartRateDelta)}`} bpm
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-5">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Droplets className="h-4 w-4 text-sky-500" />
                          实时血氧
                        </div>
                        <div className="mt-3 flex items-end gap-2">
                          <span className="text-3xl font-bold text-slate-900">{liveMetrics.bloodOxygen.toFixed(1)}</span>
                          <span className="pb-1 text-sm text-muted-foreground">%</span>
                        </div>
                        <p className="mt-2 text-xs text-emerald-600">
                          较开始 {bloodOxygenDelta >= 0 ? `提升 ${bloodOxygenDelta.toFixed(1)}` : `下降 ${Math.abs(bloodOxygenDelta).toFixed(1)}`}%
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium text-slate-900">本轮训练说明</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{scenario.focus}</p>
                    <p className="mt-3 text-sm text-slate-600">{scenario.expectedResult}</p>
                    <p className="mt-3 text-sm text-slate-500">{scenario.tip}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    <div className="flex items-center gap-2 font-medium text-slate-900">
                      <Clock3 className="h-4 w-4 text-slate-500" />
                      节奏方案
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {scenario.phases.map((phase) => (
                        <Badge key={`${phase.key}-${phase.seconds}`} variant="outline">
                          {phase.label} {phase.seconds}s
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      className={isRunning ? 'bg-slate-700 hover:bg-slate-800' : scenario.accentClass}
                      onClick={() => {
                        if (isRunning) {
                          setIsRunning(false);
                          return;
                        }

                        setIsRunning(true);
                        setIsCompleted(false);
                      }}
                      disabled={loadingBaseline}
                    >
                      {isRunning ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                      {isRunning ? '暂停训练' : elapsedSeconds === 0 ? '开始训练' : '继续训练'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setElapsedSeconds(0);
                        setIsRunning(false);
                        setIsCompleted(false);
                      }}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      重新开始
                    </Button>
                  </div>

                  {isCompleted && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      已完成 {durationMinutes} 分钟 {scenario.title}。当前模拟显示心率下降 {heartRateDelta} bpm，血氧提升 {bloodOxygenDelta.toFixed(1)}%，可直观看到放松改善。
                    </div>
                  )}

                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">开始前 vs 当前</CardTitle>
                <CardDescription>帮助快速判断这一轮呼吸练习的放松效果。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Heart className="h-4 w-4 text-rose-500" />
                      心率变化
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm text-slate-500">开始前</span>
                      <span className="text-lg font-semibold">{baseline.heartRate} bpm</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-slate-500">当前</span>
                      <span className="text-lg font-semibold text-emerald-600">{liveMetrics.heartRate} bpm</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Droplets className="h-4 w-4 text-sky-500" />
                      血氧变化
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm text-slate-500">开始前</span>
                      <span className="text-lg font-semibold">{baseline.bloodOxygen.toFixed(1)}%</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-slate-500">当前</span>
                      <span className="text-lg font-semibold text-emerald-600">{liveMetrics.bloodOxygen.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">场景建议</CardTitle>
                <CardDescription>根据当下目标选择更合适的呼吸训练组合。</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="font-medium text-slate-900">1 分钟</p>
                  <p className="mt-2 text-slate-600">适合情绪刚起波动时快速拉回节奏，最适合减压或平复心慌。</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="font-medium text-slate-900">3 分钟</p>
                  <p className="mt-2 text-slate-600">兼顾可执行性与效果，适合办公间隙和居家训练，是默认推荐时长。</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="font-medium text-slate-900">5 分钟</p>
                  <p className="mt-2 text-slate-600">更适合助眠或明显心慌后恢复，实时效果会更明显。</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-teal-600" />
              训练过程指标变化
            </CardTitle>
            <CardDescription>随着训练推进，心率会逐步回落，血氧缓慢回升，方便直观看到放松改善。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="timeLabel" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis
                    yAxisId="left"
                    domain={[
                      Math.max(45, baseline.heartRate - scenario.heartRateDrop[durationMinutes] - 6),
                      Math.min(135, baseline.heartRate + 6),
                    ]}
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[
                      Math.max(92, baseline.bloodOxygen - 0.8),
                      Math.min(100, baseline.bloodOxygen + scenario.bloodOxygenRise[durationMinutes] + 0.8),
                    ]}
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }}
                    formatter={(value: number, name: string) => [
                      name === 'heartRate' ? `${value} bpm` : `${value.toFixed(1)}%`,
                      name === 'heartRate' ? '心率' : '血氧',
                    ]}
                    labelFormatter={(label) => `训练时间 ${label}`}
                  />
                  <ReferenceLine yAxisId="left" y={baseline.heartRate} stroke="#FDA4AF" strokeDasharray="4 4" />
                  <ReferenceLine yAxisId="right" y={baseline.bloodOxygen} stroke="#93C5FD" strokeDasharray="4 4" />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="heartRate"
                    stroke="#E11D48"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                    name="heartRate"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="bloodOxygen"
                    stroke="#0284C7"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                    name="bloodOxygen"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {loadingBaseline && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            正在读取当前监测对象的最新心率和血氧，训练基线会自动更新。
          </div>
        )}
      </div>
    </div>
  );
}
