'use client';

/**
 * 管理员专项运动训练页面
 * 功能描述：
 * - 多用户运动数据总览与管理
 * - 按用户、运动类型、时间筛选记录
 * - 批量删除运动记录
 * - 查看运动时长、距离、热量、心率区间等统计图表
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CalendarRange,
  Flame,
  Footprints,
  Gauge,
  HeartPulse,
  Loader2,
  Route,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { useApp } from '@/components/layout/app-provider';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type SportType = 'running' | 'swimming' | 'cycling' | 'other';

interface ManagedExerciseRecord {
  id: number;
  person_id: number;
  person_name: string;
  sport_type: string;
  duration_min: number;
  distance_km?: number | null;
  calories: number;
  pace_min_per_km?: number | null;
  average_speed_kmh?: number | null;
  average_heart_rate?: number | null;
  fitness_age?: number | null;
  heart_rate_zones?: Record<string, number> | null;
  pace_segments?: Array<{ minute: number; pace_min_per_km: number }> | null;
  notes: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  pause_count?: number | null;
  recorded_at: string;
}

interface SportBreakdown {
  name: string;
  icon: string;
  duration_min: number;
  calories: number;
  distance_km?: number;
  count: number;
}

interface TodaySummary {
  total_duration_min: number;
  total_calories: number;
  total_distance_km?: number;
  avg_speed_kmh?: number;
  avg_heart_rate?: number;
  latest_fitness_age?: number | null;
  heart_rate_zone_breakdown?: Record<string, { key: string; name: string; color: string; duration_min: number }>;
  sport_breakdown: Record<string, SportBreakdown>;
  record_count: number;
}

interface PersonExerciseSnapshot {
  personId: number;
  personName: string;
  records: ManagedExerciseRecord[];
  todaySummary: TodaySummary;
}

const SPORT_TYPES: Record<SportType, { name: string; icon: string; color: string; badgeClass: string }> = {
  running: {
    name: '跑步',
    icon: '🏃',
    color: '#ef4444',
    badgeClass: 'border-red-200 bg-red-50 text-red-700',
  },
  swimming: {
    name: '游泳',
    icon: '🏊',
    color: '#3b82f6',
    badgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  cycling: {
    name: '骑行',
    icon: '🚴',
    color: '#06b6d4',
    badgeClass: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  },
  other: {
    name: '其他',
    icon: '🏅',
    color: '#f59e0b',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
  },
};

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

const HEART_RATE_ZONES: Record<string, { name: string; color: string }> = {
  extreme: { name: '极限', color: '#ef4444' },
  anaerobic: { name: '无氧耐力', color: '#f97316' },
  aerobic: { name: '有氧耐力', color: '#22c55e' },
  fat_burn: { name: '燃脂', color: '#3b82f6' },
  warm_up: { name: '热身', color: '#a855f7' },
};

function resolveSportType(type: string | null | undefined): SportType {
  if (type === 'running' || type === 'swimming' || type === 'cycling' || type === 'other') {
    return type;
  }
  return 'other';
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

function calculatePace(distanceKm: number, durationMin: number) {
  if (distanceKm <= 0 || durationMin <= 0) {
    return null;
  }
  return durationMin / distanceKm;
}

function getRecordStartTime(record: ManagedExerciseRecord) {
  return record.started_at || record.recorded_at;
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

export default function AdminSportTrainingPage() {
  const { persons, currentPersonId, setCurrentPersonId, alarmCount } = useApp();
  /*页面核心状态*/
  const [snapshots, setSnapshots] = useState<PersonExerciseSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [personFilter, setPersonFilter] = useState<string>('all');
  const [sportFilter, setSportFilter] = useState<'all' | SportType>('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  /*加载所有人员的专项运动记录和汇总数据*/
  const loadSnapshots = async () => {
    if (persons.length === 0) {
      setSnapshots([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.all(
        persons.map(async (person) => {
          const [recordsResponse, summaryResponse] = await Promise.all([
            fetch(`/api/exercise-records?person_id=${person.id}&limit=200`, { cache: 'no-store' }),
            fetch(`/api/exercise-records?person_id=${person.id}&summary=true`, { cache: 'no-store' }),
          ]);

          const recordsJson = await recordsResponse.json();
          const summaryJson = await summaryResponse.json();

          const records = Array.isArray(recordsJson.records)
            ? recordsJson.records.map((record: Omit<ManagedExerciseRecord, 'person_name'>) => ({
                ...record,
                person_name: person.name,
              }))
            : [];

          return {
            personId: person.id,
            personName: person.name,
            records,
            todaySummary: {
              ...EMPTY_SUMMARY,
              ...(summaryJson || {}),
              sport_breakdown: summaryJson?.sport_breakdown || {},
            },
          } satisfies PersonExerciseSnapshot;
        })
      );

      setSnapshots(results);
    } catch (error) {
      console.error('Failed to load admin sport training data:', error);
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  };

  /*人员列表变化后重新汇总运动数据*/
  useEffect(() => {
    void loadSnapshots();
  }, [persons]);

  /*合并所有人员的运动记录并按时间倒序排列*/
  const allRecords = useMemo(
    () =>
      snapshots
        .flatMap((snapshot) => snapshot.records)
        .sort((a, b) => new Date(getRecordStartTime(b)).getTime() - new Date(getRecordStartTime(a)).getTime()),
    [snapshots]
  );

  /*按人员、运动类型、日期和关键字筛选记录*/
  const filteredRecords = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();

    return allRecords.filter((record) => {
      if (personFilter !== 'all' && String(record.person_id) !== personFilter) {
        return false;
      }

      if (sportFilter !== 'all' && resolveSportType(record.sport_type) !== sportFilter) {
        return false;
      }

      if (startDateFilter) {
        const start = new Date(startDateFilter);
        start.setHours(0, 0, 0, 0);
        if (new Date(getRecordStartTime(record)) < start) {
          return false;
        }
      }

      if (!normalizedKeyword) {
        return true;
      }

      const keywordFields = [
        record.person_name,
        SPORT_TYPES[resolveSportType(record.sport_type)].name,
        record.notes || '',
      ];

      return keywordFields.some((field) => field.toLowerCase().includes(normalizedKeyword));
    });
  }, [allRecords, personFilter, sportFilter, startDateFilter, searchKeyword]);

  /*筛选结果变化后清理无效勾选项*/
  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => filteredRecords.some((record) => record.id === id)));
  }, [filteredRecords]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allFilteredSelected =
    filteredRecords.length > 0 && filteredRecords.every((record) => selectedIdSet.has(record.id));

  /*计算页面顶部总览统计数据*/
  const overview = useMemo(() => {
    const todayActiveUsers = snapshots.filter((snapshot) => snapshot.todaySummary.record_count > 0).length;
    const totalTodayDuration = snapshots.reduce((sum, snapshot) => sum + snapshot.todaySummary.total_duration_min, 0);
    const totalTodayCalories = snapshots.reduce((sum, snapshot) => sum + snapshot.todaySummary.total_calories, 0);
    const totalTodayDistance = snapshots.reduce((sum, snapshot) => sum + (snapshot.todaySummary.total_distance_km || 0), 0);
    return {
      managedUsers: persons.length,
      todayActiveUsers,
      totalTodayDuration,
      totalTodayCalories,
      totalTodayDistance,
      totalRecords: allRecords.length,
    };
  }, [allRecords.length, persons.length, snapshots]);

  /*整理运动类型饼图数据*/
  const pieChartData = useMemo(() => {
    const bucket = new Map<SportType, { value: number; calories: number }>();

    for (const snapshot of snapshots) {
      if (personFilter !== 'all' && String(snapshot.personId) !== personFilter) {
        continue;
      }

      Object.entries(snapshot.todaySummary.sport_breakdown).forEach(([key, item]) => {
        const sportType = resolveSportType(key);
        const current = bucket.get(sportType) || { value: 0, calories: 0 };
        bucket.set(sportType, {
          value: current.value + item.duration_min,
          calories: current.calories + item.calories,
        });
      });
    }

    return Array.from(bucket.entries()).map(([sportType, value]) => ({
      key: sportType,
      name: SPORT_TYPES[sportType].name,
      icon: SPORT_TYPES[sportType].icon,
      color: SPORT_TYPES[sportType].color,
      value: value.value,
      calories: value.calories,
    }));
  }, [personFilter, snapshots]);

  /*整理心率区间分布数据*/
  const heartRateZoneData = useMemo(() => {
    const bucket = new Map<string, { value: number; color: string; name: string }>();

    for (const snapshot of snapshots) {
      if (personFilter !== 'all' && String(snapshot.personId) !== personFilter) {
        continue;
      }

      Object.entries(snapshot.todaySummary.heart_rate_zone_breakdown || {}).forEach(([key, item]) => {
        const current = bucket.get(key) || {
          value: 0,
          color: item.color || HEART_RATE_ZONES[key]?.color || '#94a3b8',
          name: item.name || HEART_RATE_ZONES[key]?.name || key,
        };
        bucket.set(key, {
          ...current,
          value: current.value + (item.duration_min || 0),
        });
      });
    }

    return Array.from(bucket.entries())
      .map(([key, item]) => ({ key, ...item }))
      .filter((item) => item.value > 0);
  }, [personFilter, snapshots]);

  const latestFilteredRecord = filteredRecords[0] || null;
  /*整理最近一条记录的配速趋势数据*/
  const latestPaceTrend = useMemo(
    () =>
      (latestFilteredRecord?.pace_segments || [])
        .map((item, index) => ({
          minute: item.minute || index + 1,
          pace: item.pace_min_per_km,
          label: `${item.minute || index + 1}分`,
        }))
        .filter((item) => item.pace && Number.isFinite(item.pace)),
    [latestFilteredRecord?.pace_segments]
  );
  const latestPaceDomain = useMemo(
    () => getChartDomain(latestPaceTrend.map((item) => item.pace), 0.4),
    [latestPaceTrend]
  );
  /*整理最近 7 条训练记录的图表数据*/
  const recentTrainingChartData = useMemo(
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

  /*补充每个人的最近一条训练记录信息*/
  const personCards = useMemo(
    () =>
      snapshots.map((snapshot) => {
        const latestRecord = snapshot.records[0] || null;
        return {
          ...snapshot,
          latestRecord,
        };
      }),
    [snapshots]
  );

  /*切换当前筛选结果的全选状态*/
  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      const filteredIdSet = new Set(filteredRecords.map((record) => record.id));
      setSelectedIds((current) => current.filter((id) => !filteredIdSet.has(id)));
      return;
    }

    const next = new Set(selectedIds);
    filteredRecords.forEach((record) => next.add(record.id));
    setSelectedIds(Array.from(next));
  };

  /*切换单条运动记录的勾选状态*/
  const toggleSelectOne = (id: number, checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(id) ? current : [...current, id];
      }
      return current.filter((item) => item !== id);
    });
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
      setSelectedIds((current) => current.filter((item) => item !== id));
      await loadSnapshots();
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
      if (!response.ok) {
        throw new Error('批量删除失败');
      }
      setSelectedIds([]);
      await loadSnapshots();
    } catch {
      alert('批量删除运动记录失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <Header
        persons={persons}
        currentPersonId={currentPersonId}
        onPersonChange={setCurrentPersonId}
        alarmCount={alarmCount}
      />

      <div className="mx-auto w-full max-w-7xl space-y-4 p-4 lg:p-5">
        <div className="rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-cyan-50 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                <Activity className="h-7 w-7 text-violet-600" />
                专项运动管理
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                管理员视角统一管理所有用户的专项运动数据，支持查看总览、筛选记录和执行删除操作。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:w-[320px]">
              <div className="rounded-xl bg-white/80 p-3">
                <p className="text-xs text-muted-foreground">当前视图</p>
                <p className="mt-1 font-semibold text-slate-900">多用户管理</p>
              </div>
              <div className="rounded-xl bg-white/80 p-3">
                <p className="text-xs text-muted-foreground">管理重点</p>
                <p className="mt-1 font-semibold text-slate-900">统计 + 筛选 + 删除</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 text-violet-600" />
                管理用户
              </div>
              <p className="mt-3 text-3xl font-bold text-violet-700">{overview.managedUsers}</p>
              <p className="mt-2 text-xs text-muted-foreground">今日活跃 {overview.todayActiveUsers} 人</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Footprints className="h-4 w-4 text-emerald-600" />
                今日总时长
              </div>
              <p className="mt-3 text-3xl font-bold text-emerald-700">{Math.round(overview.totalTodayDuration)}</p>
              <p className="mt-2 text-xs text-muted-foreground">分钟</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Flame className="h-4 w-4 text-orange-600" />
                今日总消耗
              </div>
              <p className="mt-3 text-3xl font-bold text-orange-700">{overview.totalTodayCalories}</p>
              <p className="mt-2 text-xs text-muted-foreground">kcal</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Route className="h-4 w-4 text-sky-600" />
                今日总距离
              </div>
              <p className="mt-3 text-3xl font-bold text-sky-700">{overview.totalTodayDistance.toFixed(1)}</p>
              <p className="mt-2 text-xs text-muted-foreground">km，累计 {overview.totalRecords} 条记录</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">用户专项运动概览</CardTitle>
              <CardDescription>按用户查看今日运动情况，并快速切换到对应用户筛选</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-56 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {personCards.map((snapshot) => (
                    <div key={snapshot.personId} className="rounded-2xl border p-3 transition-colors hover:bg-slate-50/70">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-slate-900">{snapshot.personName}</p>
                          <p className="text-xs text-muted-foreground">
                            今日 {snapshot.todaySummary.record_count} 条，累计 {formatDuration(snapshot.todaySummary.total_duration_min)}
                          </p>
                        </div>
                        <Button
                          variant={personFilter === String(snapshot.personId) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            setPersonFilter((current) => (current === String(snapshot.personId) ? 'all' : String(snapshot.personId)));
                            setCurrentPersonId(snapshot.personId);
                          }}
                        >
                          {personFilter === String(snapshot.personId) ? '已筛选' : '筛选此人'}
                        </Button>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm xl:grid-cols-3">
                        <div className="rounded-xl bg-slate-50 p-2.5">
                          <p className="text-xs text-muted-foreground">时长</p>
                          <p className="mt-1 font-semibold text-emerald-700">{Math.round(snapshot.todaySummary.total_duration_min)} 分</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2.5">
                          <p className="text-xs text-muted-foreground">消耗</p>
                          <p className="mt-1 font-semibold text-orange-700">{snapshot.todaySummary.total_calories} kcal</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2.5">
                          <p className="text-xs text-muted-foreground">距离</p>
                          <p className="mt-1 font-semibold text-sky-700">{(snapshot.todaySummary.total_distance_km || 0).toFixed(1)} km</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2.5">
                          <p className="text-xs text-muted-foreground">平均心率</p>
                          <p className="mt-1 font-semibold text-rose-700">{formatHeartRate(snapshot.todaySummary.avg_heart_rate)} bpm</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2.5">
                          <p className="text-xs text-muted-foreground">平均速度</p>
                          <p className="mt-1 font-semibold text-cyan-700">{formatSpeed(snapshot.todaySummary.avg_speed_kmh)} km/h</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2.5">
                          <p className="text-xs text-muted-foreground">体能年龄</p>
                          <p className="mt-1 font-semibold text-emerald-700">{formatFitnessAge(snapshot.todaySummary.latest_fitness_age)} 岁</p>
                        </div>
                      </div>
                      {snapshot.latestRecord && (
                        <div className="mt-3 text-xs text-muted-foreground">
                          最近记录：{new Date(getRecordStartTime(snapshot.latestRecord)).toLocaleString('zh-CN')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">今日运动时间分布</CardTitle>
                <CardDescription>{personFilter === 'all' ? '所有用户汇总' : '当前筛选用户'}的专项运动时长分布</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex h-48 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : pieChartData.length === 0 ? (
                  <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">今日暂无专项运动数据</div>
                ) : (
                  <div className="space-y-3">
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieChartData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={50}
                            outerRadius={84}
                            paddingAngle={3}
                            labelLine={false}
                            label={renderPieLabel}
                          >
                            {pieChartData.map((item) => (
                              <Cell key={item.key} fill={item.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => [`${value} 分钟`, '运动时长']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {pieChartData.map((item) => (
                        <div key={item.key} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block h-3 w-3 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span>
                              {item.icon} {item.name}
                            </span>
                          </span>
                          <span className="text-muted-foreground">
                            {item.value} 分钟
                          </span>
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
                <CardDescription>统计极限、无氧耐力、有氧耐力、燃脂、热身的累计分钟数</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex h-48 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : heartRateZoneData.length === 0 ? (
                  <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">当前暂无心率区间数据</div>
                ) : (
                  <div className="space-y-3">
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={heartRateZoneData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={50}
                            outerRadius={84}
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
                    <div className="grid gap-2 sm:grid-cols-2">
                      {heartRateZoneData.map((item) => (
                        <div key={item.key} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
                          <span className="flex items-center gap-2">
                            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                            <span>{item.name}</span>
                          </span>
                          <span className="text-muted-foreground">{item.value} 分钟</span>
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
                <CardDescription>基于当前筛选结果中的最新记录展示配速折线图</CardDescription>
              </CardHeader>
              <CardContent>
                {latestPaceTrend.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">当前筛选结果暂无配速曲线数据</div>
                ) : (
                  <div className="h-40">
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
                <CardDescription>结合当前筛选结果查看最近训练时长变化</CardDescription>
              </CardHeader>
              <CardContent>
                {recentTrainingChartData.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">当前筛选结果暂无柱状图数据</div>
                ) : (
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={recentTrainingChartData} barGap={10}>
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
                          {recentTrainingChartData.map((item) => (
                            <Cell key={item.key} fill={item.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
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
                <CardTitle className="text-base">用户运动数据管理</CardTitle>
                <CardDescription>管理员可按用户、运动类型、开始时间和备注关键词筛选，并删除记录</CardDescription>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500">用户</span>
                  <Select value={personFilter} onValueChange={setPersonFilter}>
                    <SelectTrigger className="w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部用户</SelectItem>
                      {persons.map((person) => (
                        <SelectItem key={person.id} value={String(person.id)}>
                          {person.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-slate-500">运动类型</span>
                  <Select value={sportFilter} onValueChange={(value) => setSportFilter(value as 'all' | SportType)}>
                    <SelectTrigger className="w-[150px]">
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
                  <Input type="date" value={startDateFilter} onChange={(event) => setStartDateFilter(event.target.value)} className="w-[170px]" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-slate-500">关键词</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={searchKeyword}
                      onChange={(event) => setSearchKeyword(event.target.value)}
                      placeholder="搜索用户或备注"
                      className="w-[190px] pl-9"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-2.5">
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                    aria-label="全选当前筛选结果"
                  />
                  <span>全选当前筛选结果</span>
                </div>
                <span className="text-muted-foreground">共 {filteredRecords.length} 条，已选 {selectedIds.length} 条</span>
              </div>
              <div className="flex gap-2">
                {(personFilter !== 'all' || sportFilter !== 'all' || startDateFilter || searchKeyword) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPersonFilter('all');
                      setSportFilter('all');
                      setStartDateFilter('');
                      setSearchKeyword('');
                    }}
                  >
                    清空筛选
                  </Button>
                )}
                <Button variant="destructive" size="sm" disabled={selectedIds.length === 0 || deleting} onClick={handleDeleteSelected}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除已选
                </Button>
              </div>
            </div>

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
                  const startedAt = getRecordStartTime(record);
                  const pace = record.pace_min_per_km || calculatePace(record.distance_km || 0, record.duration_min);
                  const speed = record.average_speed_kmh || (pace ? 60 / pace : null);

                  return (
                    <div key={record.id} className="rounded-2xl border p-3 transition-colors hover:bg-slate-50/70">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex gap-3">
                          <Checkbox
                            checked={selectedIdSet.has(record.id)}
                            onCheckedChange={(checked) => toggleSelectOne(record.id, checked === true)}
                            aria-label={`选择记录 ${record.id}`}
                          />
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={sportConfig.badgeClass}>
                                {sportConfig.icon} {sportConfig.name}
                              </Badge>
                              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                                {record.person_name}
                              </Badge>
                              <span className="text-sm font-medium text-slate-900">
                                {formatDuration(record.duration_min)} · {(record.distance_km || 0).toFixed(1)} km
                              </span>
                            </div>
                            <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-7">
                              <span className="flex items-center gap-1">
                                <CalendarRange className="h-4 w-4 text-slate-400" />
                                {new Date(startedAt).toLocaleString('zh-CN')}
                              </span>
                              <span className="flex items-center gap-1">
                                <Flame className="h-4 w-4 text-orange-500" />
                                {record.calories} kcal
                              </span>
                              <span className="flex items-center gap-1">
                                <Route className="h-4 w-4 text-sky-500" />
                                {(record.distance_km || 0).toFixed(1)} km
                              </span>
                              <span className="flex items-center gap-1">
                                <Gauge className="h-4 w-4 text-violet-500" />
                                {formatPace(pace)}/km
                              </span>
                              <span className="flex items-center gap-1">
                                <Route className="h-4 w-4 text-cyan-500" />
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
                                <Activity className="h-4 w-4 text-emerald-500" />
                                暂停 {record.pause_count || 0} 次
                              </span>
                            </div>
                            {record.notes && <p className="text-sm text-muted-foreground">备注：{record.notes}</p>}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" disabled={deleting} onClick={() => void handleDeleteOne(record.id)}>
                          <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                          删除
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
