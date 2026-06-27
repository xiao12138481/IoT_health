'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity,
  CalendarRange,
  Clock3,
  Flame,
  Footprints,
  Gauge,
  HeartPulse,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Route,
  Square,
  Trash2,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/*运动类型定义*/
type SportType = 'running' | 'swimming' | 'cycling' | 'other';
/*会话状态定义*/
type SessionStatus = 'idle' | 'running' | 'paused';

/*运动记录数据结构*/
interface ExerciseRecord {
  /** 记录ID */
  id: number;
  /** 运动类型标识符 */
  sport_type: string;
  /** 运动时长（分钟） */
  duration_min: number;
  /** 运动距离（公里），可选 */
  distance_km?: number | null;
  /** 消耗卡路里 */
  calories: number;
  /** 配速（分钟/公里），可选 */
  pace_min_per_km?: number | null;
  /** 平均速度（公里/小时），可选 */
  average_speed_kmh?: number | null;
  /** 平均心率（次/分钟），可选 */
  average_heart_rate?: number | null;
  /** 体能年龄（岁），可选 */
  fitness_age?: number | null;
  /** 心率区间分布，可选 */
  heart_rate_zones?: Record<string, number> | null;
  /** 配速分段数据，可选 */
  pace_segments?: Array<{ minute: number; pace_min_per_km: number }> | null;
  /** 备注信息，可选 */
  notes: string | null;
  /** 运动开始时间，可选 */
  started_at?: string | null;
  /** 运动结束时间，可选 */
  ended_at?: string | null;
  /** 暂停次数，可选 */
  pause_count?: number | null;
  /** 记录创建时间 */
  recorded_at: string;
}

/*运动类型细分数据结构*/
interface SportBreakdown {
  /** 运动类型名称 */
  name: string;
  /** 运动类型图标 */
  icon: string;
  /** 总时长（分钟） */
  duration_min: number;
  /** 总卡路里消耗 */
  calories: number;
  /** 总距离（公里），可选 */
  distance_km?: number;
  /** 记录条数 */
  count: number;
}

/*今日运动汇总数据结构*/
interface TodaySummary {
  /** 总运动时长（分钟） */
  total_duration_min: number;
  /** 总卡路里消耗 */
  total_calories: number;
  /** 总运动距离（公里），可选 */
  total_distance_km?: number;
  /** 平均速度（公里/小时），可选 */
  avg_speed_kmh?: number;
  /** 平均心率（次/分钟），可选 */
  avg_heart_rate?: number;
  /** 最新体能年龄（岁），可选 */
  latest_fitness_age?: number | null;
  /** 心率区间细分数据，可选 */
  heart_rate_zone_breakdown?: Record<string, { key: string; name: string; color: string; duration_min: number }>;
  /** 运动类型细分数据 */
  sport_breakdown: Record<string, SportBreakdown>;
  /** 记录总数 */
  record_count: number;
}

/*运动摘要组件属性接口*/
interface ExerciseSummaryProps {
  /** 人员ID，为null时显示无数据状态 */
  personId?: number | null;
  /** 视图模式：interactive（交互式）或 readonly（只读） */
  viewMode?: 'interactive' | 'readonly';
}

/*运动类型详细配置*/
const SPORT_TYPES: Record<
  SportType,
  { name: string; icon: string; color: string; calorieFactor: number; badgeClass: string }
> = {
  running: {
    name: '跑步',
    icon: '🏃',
    color: '#ef4444',
    calorieFactor: 11.5,
    badgeClass: 'border-red-200 bg-red-50 text-red-700',
  },
  swimming: {
    name: '游泳',
    icon: '🏊',
    color: '#3b82f6',
    calorieFactor: 10.5,
    badgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  cycling: {
    name: '骑行',
    icon: '🚴',
    color: '#06b6d4',
    calorieFactor: 8.2,
    badgeClass: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  },
  other: {
    name: '其他',
    icon: '🏅',
    color: '#f59e0b',
    calorieFactor: 7.3,
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
  },
};

/*空汇总数据，用于初始化状态*/
const EMPTY_SUMMARY: TodaySummary = {
  total_duration_min: 0,
  total_calories: 0,
  total_distance_km: 0,
  avg_speed_kmh: 0,
  avg_heart_rate: 0,
  latest_fitness_age: null,
  heart_rate_zone_breakdown: {},
  sport_breakdown: {},
  record_count: 0,
};

/*心率区间配置*/
const HEART_RATE_ZONES: Record<string, { name: string; color: string }> = {
  extreme: { name: '极限', color: '#ef4444' },
  anaerobic: { name: '无氧耐力', color: '#f97316' },
  aerobic: { name: '有氧耐力', color: '#22c55e' },
  fat_burn: { name: '燃脂', color: '#3b82f6' },
  warm_up: { name: '热身', color: '#a855f7' },
};

/**
 * 解析运动类型
 * 功能：
 * - 将字符串类型的运动类型转换为类型安全的SportType
 * - 如果类型不在预定义范围内，默认返回'other'
 * - 确保类型安全，避免运行时错误
 * @param {string | null | undefined} type - 原始运动类型字符串
 * @returns {SportType} 解析后的运动类型
 */
function resolveSportType(type: string | null | undefined): SportType {
  if (type === 'running' || type === 'swimming' || type === 'cycling' || type === 'other') {
    return type;
  }
  return 'other';
}

/**
 * 计算卡路里消耗
 * 功能：
 * - 根据运动类型和时长计算消耗的卡路里
 * - 使用预定义的卡路里因子进行计算
 * - 确保结果非负，避免负数卡路里
 * @param {SportType} sportType - 运动类型
 * @param {number} durationMin - 运动时长（分钟）
 * @returns {number} 消耗的卡路里数
 */
function calculateCalories(sportType: SportType, durationMin: number) {
  return Math.max(0, Math.round(durationMin * SPORT_TYPES[sportType].calorieFactor));
}

/**
 * 计算配速
 * 功能：
 * - 根据距离和时长计算配速（分钟/公里）
 * - 处理无效输入（距离或时长为0或负数）
 * - 返回null表示无法计算配速
 * @param {number} distanceKm - 运动距离（公里）
 * @param {number} durationMin - 运动时长（分钟）
 * @returns {number | null} 配速值（分钟/公里），无法计算时返回null
 */
function calculatePace(distanceKm: number, durationMin: number) {
  if (distanceKm <= 0 || durationMin <= 0) {
    return null;
  }
  return durationMin / distanceKm;
}

/**
 * 格式化经过时间
 * 功能：
 * - 将毫秒数转换为"HH:MM:SS"格式的时间字符串
 * - 自动计算小时、分钟和秒数
 * - 使用两位数字显示，不足两位时补零
 * - 示例：3661000毫秒 → "01:01:01"
 * @param {number} milliseconds - 经过的毫秒数
 * @returns {string} 格式化后的时间字符串（HH:MM:SS格式）
 */
function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

/**
 * 格式化配速显示
 * 功能：
 * - 将配速值（分钟/公里）转换为"MM'SS\""格式的易读字符串
 * - 处理无效输入（null、undefined、非有限数）
 * - 分钟和秒数都使用两位数字显示
 * - 示例：6.5分钟/公里 → "06'30\""
 * @param {number | null | undefined} value - 配速值（分钟/公里）
 * @returns {string} 格式化后的配速字符串，无效输入返回"--"
 */
function formatPace(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) {
    return '--';
  }
  const min = Math.floor(value);
  const sec = Math.round((value - min) * 60);
  return `${String(min).padStart(2, '0')}'${String(sec).padStart(2, '0')}"`;
}

function formatSpeed(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) {
    return '--';
  }
  return value.toFixed(1);
}

function formatHeartRate(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) {
    return '--';
  }
  return String(Math.round(value));
}

function formatFitnessAge(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) {
    return '--';
  }
  return String(Math.round(value));
}

function getChartDomain(values: number[], padding = 0.4): [number, number] {
  const validValues = values.filter((value) => Number.isFinite(value));
  if (validValues.length === 0) {
    return [0, 1];
  }

  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  if (min === max) {
    const safePadding = Math.max(0.2, padding);
    return [
      Number(Math.max(0, min - safePadding).toFixed(2)),
      Number((max + safePadding).toFixed(2)),
    ];
  }

  return [
    Number(Math.max(0, min - padding).toFixed(2)),
    Number((max + padding).toFixed(2)),
  ];
}

function formatDuration(minutes: number) {
  if (minutes <= 0) {
    return '0 分钟';
  }
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remain = rounded % 60;
  if (hours === 0) {
    return `${remain} 分钟`;
  }
  if (remain === 0) {
    return `${hours} 小时`;
  }
  return `${hours} 小时 ${remain} 分钟`;
}

function getRecordStartTime(record: ExerciseRecord) {
  return record.started_at || record.recorded_at;
}

/**
 * 获取运动建议
 * 功能：
 * - 根据今日运动汇总数据生成个性化的运动建议
 * - 考虑运动时长和记录数量
 * - 提供不同强度级别的建议
 * @param {TodaySummary} summary - 今日运动汇总数据
 * @returns {string} 个性化的运动建议文本
 */
function getRecommendation(summary: TodaySummary) {
  if (summary.record_count === 0) {
    return '今天还没有运动记录，建议先完成一次 20 至 30 分钟的轻中强度训练。';
  }
  if ((summary.total_duration_min || 0) < 30) {
    return '今日运动时长偏少，可以再补一组 10 至 15 分钟的轻量活动。';
  }
  if ((summary.total_duration_min || 0) < 60) {
    return '今日节奏不错，注意补水和拉伸，保持当前强度即可。';
  }
  return '今日运动量较充足，建议以恢复和放松为主，避免连续高强度训练。';
}

function renderPieLabel({
  name,
  percent,
}: {
  name?: string;
  percent?: number;
}) {
  if (!name || !percent || percent < 0.08) {
    return '';
  }
  return `${name} ${Math.round(percent * 100)}%`;
}

/**
 * 运动摘要组件
 * 功能：
 * - 显示今日运动汇总数据
 * - 支持交互式运动记录添加和删除
 * - 显示运动类型细分和心率区间分布
 * - 提供运动建议和实时计时功能
 * @param {ExerciseSummaryProps} props - 组件属性
 * @returns {JSX.Element} 运动摘要组件
 */
export function ExerciseSummary({ personId, viewMode = 'interactive' }: ExerciseSummaryProps) {
  const isReadOnly = viewMode === 'readonly';
  /*运动记录、汇总和交互状态*/
  const [records, setRecords] = useState<ExerciseRecord[]>([]);
  const [todaySummary, setTodaySummary] = useState<TodaySummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [selectedSportType, setSelectedSportType] = useState<SportType>('running');
  const [distanceKm, setDistanceKm] = useState('3');
  const [notes, setNotes] = useState('');

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [elapsedBeforePauseMs, setElapsedBeforePauseMs] = useState(0);
  const [currentRunStartedAt, setCurrentRunStartedAt] = useState<number | null>(null);
  const [pauseCount, setPauseCount] = useState(0);
  const [tick, setTick] = useState(0);

  const [historySportFilter, setHistorySportFilter] = useState<'all' | SportType>('all');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  /*加载当前人员的运动记录和今日汇总*/
  const loadExerciseData = async (showLoading = true) => {
    if (!personId) {
      setRecords([]);
      setTodaySummary(EMPTY_SUMMARY);
      setLoading(false);
      return;
    }

    if (showLoading) {
      setLoading(true);
    }

    try {
      const [recordsResponse, summaryResponse] = await Promise.all([
        fetch(`/api/exercise-records?person_id=${personId}&limit=200`, { cache: 'no-store' }),
        fetch(`/api/exercise-records?person_id=${personId}&summary=true`, { cache: 'no-store' }),
      ]);

      const recordsJson = await recordsResponse.json();
      const summaryJson = await summaryResponse.json();

      setRecords(Array.isArray(recordsJson.records) ? recordsJson.records : []);
      setTodaySummary({
        ...EMPTY_SUMMARY,
        ...(summaryJson || {}),
        sport_breakdown: summaryJson?.sport_breakdown || {},
      });
    } catch (error) {
      console.error('Failed to load exercise data:', error);
      setRecords([]);
      setTodaySummary(EMPTY_SUMMARY);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  /*人员变化后重新加载运动数据*/
  useEffect(() => {
    void loadExerciseData();
  }, [personId]);

  /*只读模式下定时刷新模拟运动数据*/
  useEffect(() => {
    if (!personId || !isReadOnly) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void loadExerciseData(false);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [isReadOnly, personId]);

  /*运动进行中按秒刷新计时器*/
  useEffect(() => {
    if (sessionStatus !== 'running') {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sessionStatus]);

  /*记录列表变化后清理无效勾选项*/
  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => records.some((record) => record.id === id)));
  }, [records]);

  /*计算当前会话的实时展示数据*/
  const currentDistanceKm = Number(distanceKm || 0);
  const currentElapsedMs =
    elapsedBeforePauseMs +
    (sessionStatus === 'running' && currentRunStartedAt ? Date.now() - currentRunStartedAt : 0) +
    tick * 0;
  const currentDurationMin = Number((currentElapsedMs / 60000).toFixed(1));
  const currentCalories = calculateCalories(selectedSportType, currentDurationMin);
  const currentPace = calculatePace(currentDistanceKm, currentDurationMin);

  const latestRecord = records[0] || null;
  const latestSportType = latestRecord ? resolveSportType(latestRecord.sport_type) : 'running';

  const displayedDistance =
    isReadOnly || sessionStatus === 'idle'
      ? Number((latestRecord?.distance_km || todaySummary.total_distance_km || 0).toFixed(1))
      : Number(currentDistanceKm.toFixed(1));
  const displayedDuration =
    isReadOnly || sessionStatus === 'idle'
      ? latestRecord?.duration_min || todaySummary.total_duration_min || 0
      : currentDurationMin;
  const displayedCalories = isReadOnly || sessionStatus === 'idle' ? latestRecord?.calories || 0 : currentCalories;
  const displayedPace =
    isReadOnly || sessionStatus === 'idle'
      ? latestRecord?.pace_min_per_km || calculatePace(latestRecord?.distance_km || 0, latestRecord?.duration_min || 0)
      : currentPace;
  const displayedSpeed =
    isReadOnly || sessionStatus === 'idle'
      ? latestRecord?.average_speed_kmh || todaySummary.avg_speed_kmh || (displayedPace ? 60 / displayedPace : null)
      : (currentPace ? 60 / currentPace : null);
  const displayedAverageHeartRate =
    isReadOnly || sessionStatus === 'idle'
      ? latestRecord?.average_heart_rate || todaySummary.avg_heart_rate || 0
      : Math.max(88, Math.min(182, Math.round(112 + currentDurationMin * 0.7 + (selectedSportType === 'running' ? 18 : selectedSportType === 'swimming' ? 12 : selectedSportType === 'cycling' ? 9 : 4))));
  const displayedFitnessAge =
    isReadOnly || sessionStatus === 'idle'
      ? latestRecord?.fitness_age || todaySummary.latest_fitness_age || null
      : Math.max(18, Math.min(80, 46 - Math.round(currentDurationMin / 15) + (displayedAverageHeartRate > 145 ? 2 : 0)));

  /*整理运动类型饼图数据*/
  const pieChartData = useMemo(
    () =>
      Object.entries(todaySummary.sport_breakdown).map(([key, item]) => {
        const sportType = resolveSportType(key);
        return {
          name: item.name,
          icon: item.icon,
          value: item.duration_min,
          color: SPORT_TYPES[sportType].color,
          calories: item.calories,
        };
      }),
    [todaySummary.sport_breakdown]
  );

  /*整理心率区间分布数据*/
  const heartRateZoneData = useMemo(
    () =>
      Object.entries(todaySummary.heart_rate_zone_breakdown || {})
        .map(([key, item]) => ({
          key,
          name: item.name || HEART_RATE_ZONES[key]?.name || key,
          value: item.duration_min || 0,
          color: item.color || HEART_RATE_ZONES[key]?.color || '#94a3b8',
        }))
        .filter((item) => item.value > 0),
    [todaySummary.heart_rate_zone_breakdown]
  );

  /*整理最近一次运动的配速趋势数据*/
  const latestPaceTrend = useMemo(
    () =>
      (latestRecord?.pace_segments || [])
        .map((item, index) => ({
          minute: item.minute || index + 1,
          pace: item.pace_min_per_km,
          label: `${item.minute || index + 1}分`,
        }))
        .filter((item) => item.pace && Number.isFinite(item.pace)),
    [latestRecord?.pace_segments]
  );
  const latestPaceDomain = useMemo(
    () => getChartDomain(latestPaceTrend.map((item) => item.pace), 0.4),
    [latestPaceTrend]
  );

  /*按运动类型和开始日期筛选历史记录*/
  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const sportType = resolveSportType(record.sport_type);
      if (historySportFilter !== 'all' && sportType !== historySportFilter) {
        return false;
      }

      if (!historyStartDate) {
        return true;
      }

      const filterDate = new Date(historyStartDate);
      filterDate.setHours(0, 0, 0, 0);
      return new Date(getRecordStartTime(record)) >= filterDate;
    });
  }, [historySportFilter, historyStartDate, records]);
  /*整理最近 7 条训练记录的图表数据*/
  const recentSessionChartData = useMemo(
    () =>
      filteredRecords
        .slice(0, 7)
        .reverse()
        .map((record) => {
          const sportType = resolveSportType(record.sport_type);
          const startedAt = new Date(getRecordStartTime(record));
          return {
            key: record.id,
            label: `${startedAt.getMonth() + 1}/${startedAt.getDate()}`,
            duration: Math.round(record.duration_min || 0),
            calories: record.calories || 0,
            sportName: SPORT_TYPES[sportType].name,
            color: SPORT_TYPES[sportType].color,
          };
        }),
    [filteredRecords]
  );

  const allFilteredSelected =
    filteredRecords.length > 0 && filteredRecords.every((record) => selectedIds.includes(record.id));

  /*切换当前筛选结果的全选状态*/
  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const filteredIdSet = new Set(filteredRecords.map((record) => record.id));
      setSelectedIds((current) => current.filter((id) => !filteredIdSet.has(id)));
      return;
    }

    const next = new Set(selectedIds);
    filteredRecords.forEach((record) => next.add(record.id));
    setSelectedIds(Array.from(next));
  };

  /*切换单条运动记录的勾选状态*/
  const toggleSelectOne = (id: number) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  /*重置当前运动草稿和计时状态*/
  const resetDraft = () => {
    setSessionStatus('idle');
    setSessionStartedAt(null);
    setElapsedBeforePauseMs(0);
    setCurrentRunStartedAt(null);
    setPauseCount(0);
    setNotes('');
    setDistanceKm('3');
  };

  /*开始一次新的运动记录*/
  const handleStart = () => {
    if (!personId) {
      return;
    }
    if (currentDistanceKm <= 0) {
      alert('请输入有效的运动距离。');
      return;
    }
    const now = Date.now();
    setSessionStartedAt(new Date(now).toISOString());
    setElapsedBeforePauseMs(0);
    setCurrentRunStartedAt(now);
    setPauseCount(0);
    setSessionStatus('running');
  };

  /*暂停当前运动会话*/
  const handlePause = () => {
    if (sessionStatus !== 'running' || !currentRunStartedAt) {
      return;
    }
    setElapsedBeforePauseMs((value) => value + (Date.now() - currentRunStartedAt));
    setCurrentRunStartedAt(null);
    setPauseCount((value) => value + 1);
    setSessionStatus('paused');
  };

  /*继续当前已暂停的运动会话*/
  const handleResume = () => {
    if (sessionStatus !== 'paused') {
      return;
    }
    setCurrentRunStartedAt(Date.now());
    setSessionStatus('running');
  };

  /*结束运动并保存为正式记录*/
  const handleEnd = async () => {
    if (!personId || !sessionStartedAt) {
      return;
    }

    const finalElapsedMs =
      elapsedBeforePauseMs + (sessionStatus === 'running' && currentRunStartedAt ? Date.now() - currentRunStartedAt : 0);
    const finalDurationMin = Number((finalElapsedMs / 60000).toFixed(1));

    if (finalDurationMin <= 0 || currentDistanceKm <= 0) {
      alert('请先开始运动，并填写有效的距离。');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/exercise-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_id: personId,
          sport_type: selectedSportType,
          distance_km: currentDistanceKm,
          duration_min: finalDurationMin,
          calories: calculateCalories(selectedSportType, finalDurationMin),
          average_speed_kmh: currentPace ? Number((60 / currentPace).toFixed(2)) : null,
          average_heart_rate: Math.max(
            88,
            Math.min(
              182,
              Math.round(112 + finalDurationMin * 0.7 + (selectedSportType === 'running' ? 18 : selectedSportType === 'swimming' ? 12 : selectedSportType === 'cycling' ? 9 : 4))
            )
          ),
          fitness_age: Math.max(
            18,
            Math.min(
              80,
              46 - Math.round(finalDurationMin / 15) + ((currentPace ? Math.round(112 + finalDurationMin * 0.7) : 135) > 145 ? 2 : 0)
            )
          ),
          notes: notes || null,
          started_at: sessionStartedAt,
          ended_at: new Date().toISOString(),
          pause_count: pauseCount,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || '保存运动记录失败');
      }

      resetDraft();
      await loadExerciseData(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存运动记录失败');
    } finally {
      setSaving(false);
    }
  };

  /*删除单条运动记录*/
  const handleDeleteOne = async (id: number) => {
    if (!confirm('确定删除这条运动记录吗？')) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/exercise-records?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('删除失败');
      }
      await loadExerciseData(false);
      setSelectedIds((current) => current.filter((item) => item !== id));
    } catch {
      alert('删除运动记录失败');
    } finally {
      setDeleting(false);
    }
  };

  /*批量删除已勾选的运动记录*/
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      return;
    }

    if (!confirm(`确定删除已选中的 ${selectedIds.length} 条运动记录吗？`)) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch('/api/exercise-records', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || '批量删除失败');
      }
      setSelectedIds([]);
      await loadExerciseData(false);
    } catch {
      alert('批量删除运动记录失败');
    } finally {
      setDeleting(false);
    }
  };

  const todayAveragePace = calculatePace(todaySummary.total_distance_km || 0, todaySummary.total_duration_min || 0);
  const suggestion = getRecommendation(todaySummary);

  if (!personId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          当前未选择监测对象，暂时无法查看运动追踪数据。
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-cyan-50">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Footprints className="h-5 w-5 text-emerald-600" />
                运动追踪
              </CardTitle>
              <CardDescription className="mt-1">
                {isReadOnly
                  ? '专项运动数据由模拟程序自动推送并同步展示，用户端仅查看结果。'
                  : '支持跑步、游泳、骑行、其他四种状态，提供开始、暂停、结束和历史管理。'}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-emerald-200 bg-white text-emerald-700">
                今日 {todaySummary.record_count} 次记录
              </Badge>
              {isReadOnly ? (
                <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                  数据来源：模拟程序
                </Badge>
              ) : (
                <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                  当前状态：
                  {sessionStatus === 'idle' ? '未开始' : sessionStatus === 'running' ? '进行中' : '已暂停'}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isReadOnly ? (
            <div className="rounded-2xl border bg-white/80 p-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">模拟同步状态</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {latestRecord
                      ? `最近一次同步：${new Date(getRecordStartTime(latestRecord)).toLocaleString('zh-CN')}`
                      : '暂未收到模拟运动数据'}
                  </p>
                </div>
                {latestRecord ? (
                  <Badge variant="outline" className={SPORT_TYPES[latestSportType].badgeClass}>
                    {SPORT_TYPES[latestSportType].icon} {SPORT_TYPES[latestSportType].name}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-3 grid gap-2 text-sm md:grid-cols-3 xl:grid-cols-6">
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <p className="text-xs text-muted-foreground">最近记录时长</p>
                  <p className="mt-1 font-semibold text-slate-900">{latestRecord ? formatDuration(latestRecord.duration_min) : '--'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <p className="text-xs text-muted-foreground">平均配速</p>
                  <p className="mt-1 font-semibold text-slate-900">{latestRecord ? formatPace(latestRecord.pace_min_per_km) : '--'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <p className="text-xs text-muted-foreground">平均速度</p>
                  <p className="mt-1 font-semibold text-slate-900">{latestRecord ? `${formatSpeed(latestRecord.average_speed_kmh)} km/h` : '--'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <p className="text-xs text-muted-foreground">平均心率</p>
                  <p className="mt-1 font-semibold text-slate-900">{latestRecord ? `${formatHeartRate(latestRecord.average_heart_rate)} bpm` : '--'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <p className="text-xs text-muted-foreground">体能年龄</p>
                  <p className="mt-1 font-semibold text-slate-900">{latestRecord ? `${formatFitnessAge(latestRecord.fitness_age)} 岁` : '--'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <p className="text-xs text-muted-foreground">最近暂停次数</p>
                  <p className="mt-1 font-semibold text-slate-900">{latestRecord?.pause_count ?? 0} 次</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm text-muted-foreground">运动状态</label>
                  <Select
                    value={selectedSportType}
                    onValueChange={(value) => setSelectedSportType(resolveSportType(value))}
                    disabled={sessionStatus !== 'idle'}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SPORT_TYPES).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.icon} {config.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-2 block text-sm text-muted-foreground">距离 (km)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={distanceKm}
                    onChange={(event) => setDistanceKm(event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-muted-foreground">备注</label>
                  <Input
                    placeholder="例如：晨跑、泳池训练"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-2xl border bg-white/80 p-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">本次计时</p>
                    <p className="mt-1 text-3xl font-bold tracking-wide text-slate-900">{formatElapsed(currentElapsedMs)}</p>
                  </div>
                  <Badge variant="outline" className={SPORT_TYPES[selectedSportType].badgeClass}>
                    {SPORT_TYPES[selectedSportType].icon} {SPORT_TYPES[selectedSportType].name}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sessionStatus === 'idle' && (
                    <Button onClick={handleStart} className="bg-emerald-600 hover:bg-emerald-700">
                      <Play className="mr-2 h-4 w-4" />
                      开始
                    </Button>
                  )}
                  {sessionStatus === 'running' && (
                    <>
                      <Button variant="outline" onClick={handlePause}>
                        <Pause className="mr-2 h-4 w-4" />
                        暂停
                      </Button>
                      <Button onClick={handleEnd} disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />}
                        结束
                      </Button>
                    </>
                  )}
                  {sessionStatus === 'paused' && (
                    <>
                      <Button onClick={handleResume} className="bg-emerald-600 hover:bg-emerald-700">
                        <Play className="mr-2 h-4 w-4" />
                        继续
                      </Button>
                      <Button variant="outline" onClick={handleEnd} disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />}
                        结束
                      </Button>
                    </>
                  )}
                  {sessionStatus === 'idle' && (
                    <Button variant="ghost" onClick={resetDraft}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      清空
                    </Button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>开始时间：{sessionStartedAt ? new Date(sessionStartedAt).toLocaleString('zh-CN') : '--'}</span>
                  <span>暂停次数：{pauseCount}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock3 className="h-4 w-4 text-slate-600" />
              运动时间
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-3xl font-bold text-slate-900">{Math.round(displayedDuration)}</span>
              <span className="pb-1 text-sm text-muted-foreground">分钟</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{isReadOnly || sessionStatus === 'idle' ? '最近一次或今日累计时长' : '当前训练计时结果'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Gauge className="h-4 w-4 text-violet-600" />
              平均配速
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-3xl font-bold text-violet-600">{formatPace(displayedPace)}</span>
              <span className="pb-1 text-sm text-muted-foreground">/km</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{isReadOnly || sessionStatus === 'idle' ? '最近一次或今日平均配速' : '按当前时长和距离实时计算'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Flame className="h-4 w-4 text-orange-600" />
              消耗热量
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-3xl font-bold text-orange-600">{displayedCalories}</span>
              <span className="pb-1 text-sm text-muted-foreground">kcal</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{isReadOnly || sessionStatus === 'idle' ? '最近一次或今日累计消耗' : '按运动类型和时长估算'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Route className="h-4 w-4 text-sky-600" />
              平均速度
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-3xl font-bold text-sky-600">{formatSpeed(displayedSpeed)}</span>
              <span className="pb-1 text-sm text-muted-foreground">km/h</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">结合距离与时长自动换算</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HeartPulse className="h-4 w-4 text-rose-600" />
              平均心率
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-3xl font-bold text-rose-600">{formatHeartRate(displayedAverageHeartRate)}</span>
              <span className="pb-1 text-sm text-muted-foreground">bpm</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">用于辅助判断训练强度与心率区间</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4 text-emerald-600" />
              体能年龄
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-3xl font-bold text-emerald-600">{formatFitnessAge(displayedFitnessAge)}</span>
              <span className="pb-1 text-sm text-muted-foreground">岁</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">结合运动强度、时长和心率给出估算</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">今日运动时间分布</CardTitle>
            <CardDescription>按运动类型统计今日累计时长</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-56 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : pieChartData.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">今日还没有完成的运动记录</div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr] lg:items-center">
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        labelLine={false}
                        label={renderPieLabel}
                      >
                        {pieChartData.map((item) => (
                          <Cell key={item.name} fill={item.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value} 分钟`, '今日时长']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {pieChartData.map((item) => (
                    <div key={item.name} className="rounded-xl border p-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-lg">{item.icon}</span>
                          <span className="font-medium text-slate-900">{item.name}</span>
                        </div>
                        <span className="text-sm text-slate-600">{item.value} 分钟</span>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">消耗约 {item.calories} kcal</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">今日心率区间分布</CardTitle>
            <CardDescription>围绕极限、无氧耐力、有氧耐力、燃脂和热身统计训练分钟数</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-56 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : heartRateZoneData.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">今日暂无可分析的心率区间数据</div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr] lg:items-center">
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={heartRateZoneData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                        labelLine={false}
                        label={renderPieLabel}
                      >
                        {heartRateZoneData.map((item) => (
                          <Cell key={item.key} fill={item.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value} 分钟`, '区间时长']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {heartRateZoneData.map((item) => (
                    <div key={item.key} className="rounded-xl border p-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-medium text-slate-900">{item.name}</span>
                        </div>
                        <span className="text-sm text-slate-600">{item.value} 分钟</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">最近一次配速变化</CardTitle>
            <CardDescription>使用折线图展示最近一次运动的配速变化趋势</CardDescription>
          </CardHeader>
          <CardContent>
            {latestPaceTrend.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">最近记录暂无配速曲线数据</div>
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={latestPaceTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${Number(value).toFixed(1)}′`}
                      domain={latestPaceDomain}
                      allowDecimals
                      width={44}
                    />
                    <Tooltip formatter={(value: number) => [`${formatPace(value)}/km`, '配速']} />
                    <Line type="monotone" dataKey="pace" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">最近 7 次训练时长</CardTitle>
            <CardDescription>按训练日期查看最近记录的时长变化</CardDescription>
          </CardHeader>
          <CardContent>
            {recentSessionChartData.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">当前暂无可展示的训练柱状图数据</div>
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={recentSessionChartData} barGap={10}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} unit="分" width={36} />
                    <Tooltip
                      formatter={(value: number, name: string, item) => {
                        if (name === 'duration') {
                          return [`${value} 分钟`, '训练时长'];
                        }
                        const payload = item.payload as { calories?: number; sportName?: string };
                        return [`${payload.calories || 0} kcal`, payload.sportName || '热量'];
                      }}
                    />
                    <Bar dataKey="duration" name="duration" radius={[8, 8, 0, 0]}>
                      {recentSessionChartData.map((item) => (
                        <Cell key={item.key} fill={item.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr] xl:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">今日概况</CardTitle>
              <CardDescription>围绕时长、距离、速度、心率和体能年龄快速查看</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock3 className="h-4 w-4 text-slate-600" />
                  总时长
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900">{formatDuration(todaySummary.total_duration_min)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  记录次数
                </div>
                <p className="mt-2 text-2xl font-bold text-emerald-700">{todaySummary.record_count}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Route className="h-4 w-4 text-sky-600" />
                  总距离
                </div>
                <p className="mt-2 text-2xl font-bold text-sky-700">{(todaySummary.total_distance_km || 0).toFixed(1)} km</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Gauge className="h-4 w-4 text-violet-600" />
                  平均配速
                </div>
                <p className="mt-2 text-2xl font-bold text-violet-700">{formatPace(todayAveragePace)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Route className="h-4 w-4 text-cyan-600" />
                  平均速度
                </div>
                <p className="mt-2 text-2xl font-bold text-cyan-700">{formatSpeed(todaySummary.avg_speed_kmh)} km/h</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <HeartPulse className="h-4 w-4 text-rose-600" />
                  平均心率
                </div>
                <p className="mt-2 text-2xl font-bold text-rose-700">{formatHeartRate(todaySummary.avg_heart_rate)} bpm</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2 xl:col-span-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  最近体能年龄
                </div>
                <p className="mt-2 text-2xl font-bold text-emerald-700">{formatFitnessAge(todaySummary.latest_fitness_age)} 岁</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">训练建议</CardTitle>
              <CardDescription>根据今日记录自动生成</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-emerald-900">{suggestion}</div>
              {latestRecord && (
                <div className="rounded-xl border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="outline" className={SPORT_TYPES[latestSportType].badgeClass}>
                      {SPORT_TYPES[latestSportType].icon} {SPORT_TYPES[latestSportType].name}
                    </Badge>
                    <span className="text-xs text-muted-foreground">最近一次</span>
                  </div>
                  <div className="grid gap-2 text-sm text-slate-700">
                    <span>开始于 {new Date(getRecordStartTime(latestRecord)).toLocaleString('zh-CN')}</span>
                    <span>时长 {formatDuration(latestRecord.duration_min)}</span>
                    <span>距离 {(latestRecord.distance_km || 0).toFixed(1)} km</span>
                    <span>平均心率 {formatHeartRate(latestRecord.average_heart_rate)} bpm</span>
                    <span>体能年龄 {formatFitnessAge(latestRecord.fitness_age)} 岁</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="text-base">历史记录</CardTitle>
              <CardDescription>支持按运动类型和开始时间筛选，可单个删除或全选删除</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1">
                <span className="text-xs text-slate-500">运动类型</span>
                <Select
                  value={historySportFilter}
                  onValueChange={(value) => setHistorySportFilter(value as 'all' | SportType)}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    {Object.entries(SPORT_TYPES).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.icon} {config.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-500">开始时间</span>
                <div className="flex items-center gap-2">
                  <Input type="date" value={historyStartDate} onChange={(event) => setHistoryStartDate(event.target.value)} />
                  {historyStartDate && (
                    <Button variant="outline" size="sm" onClick={() => setHistoryStartDate('')}>
                      清除
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isReadOnly ? (
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-muted-foreground">
              当前页面为只读模式，运动数据由模拟程序自动同步。
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-2.5">
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} aria-label="全选当前筛选结果" />
                  <span>全选当前筛选结果</span>
                </div>
                <span className="text-muted-foreground">共 {filteredRecords.length} 条，已选 {selectedIds.length} 条</span>
              </div>
              <Button variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={selectedIds.length === 0 || deleting}>
                <Trash2 className="mr-2 h-4 w-4" />
                删除已选
              </Button>
            </div>
          )}

          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
              当前筛选条件下暂无运动记录
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredRecords.map((record) => {
                const sportType = resolveSportType(record.sport_type);
                const sportConfig = SPORT_TYPES[sportType];
                const pace = record.pace_min_per_km || calculatePace(record.distance_km || 0, record.duration_min);
                const speed = record.average_speed_kmh || (pace ? 60 / pace : null);
                const startedAt = getRecordStartTime(record);

                return (
                  <div key={record.id} className="rounded-2xl border p-3 transition-colors hover:bg-slate-50/70">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex gap-3">
                        {!isReadOnly ? (
                          <Checkbox
                            checked={selectedIds.includes(record.id)}
                            onCheckedChange={() => toggleSelectOne(record.id)}
                            aria-label={`选择记录 ${record.id}`}
                          />
                        ) : null}
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={sportConfig.badgeClass}>
                              {sportConfig.icon} {sportConfig.name}
                            </Badge>
                            <span className="text-sm font-medium text-slate-900">
                              {formatDuration(record.duration_min)} · {(record.distance_km || 0).toFixed(1)} km
                            </span>
                          </div>
                          <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-6">
                            <span className="flex items-center gap-1">
                              <CalendarRange className="h-4 w-4 text-slate-400" />
                              {new Date(startedAt).toLocaleString('zh-CN')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Flame className="h-4 w-4 text-orange-500" />
                              {record.calories} kcal
                            </span>
                            <span className="flex items-center gap-1">
                              <Gauge className="h-4 w-4 text-violet-500" />
                              {formatPace(pace)}/km
                            </span>
                            <span className="flex items-center gap-1">
                              <Route className="h-4 w-4 text-sky-500" />
                              {formatSpeed(speed)} km/h
                            </span>
                            <span className="flex items-center gap-1">
                              <HeartPulse className="h-4 w-4 text-rose-500" />
                              {formatHeartRate(record.average_heart_rate)} bpm
                            </span>
                            <span className="flex items-center gap-1">
                              <Activity className="h-4 w-4 text-emerald-500" />
                              体能年龄 {formatFitnessAge(record.fitness_age)} 岁
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock3 className="h-4 w-4 text-slate-400" />
                              暂停 {record.pause_count || 0} 次
                            </span>
                          </div>
                          {record.notes && <p className="text-sm text-muted-foreground">备注：{record.notes}</p>}
                        </div>
                      </div>
                      {!isReadOnly ? (
                        <Button variant="ghost" size="sm" onClick={() => void handleDeleteOne(record.id)} disabled={deleting}>
                          <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                          删除
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
