'use client';

/**
 * 管理员健康总览页面
 * 功能描述：
 * 1. 显示所有被监测人员的健康数据概览
 * 2. 支持人员切换功能
 * 3. 实时显示各项健康指标
 * 4. 包含心率、血氧、体温、血压、步数等指标
 * 5. 显示报警记录和睡眠、运动分析
 */

import { useEffect, useState } from 'react';
import { useApp } from '@/components/layout/app-provider';
import { Header } from '@/components/layout/header';
import { MetricCard } from '@/components/dashboard/metric-card';
import { HeartRateTrend } from '@/components/dashboard/heart-rate-trend';
import { AlarmSummary } from '@/components/dashboard/alarm-summary';
import { SleepSummary } from '@/components/dashboard/sleep-summary';
import { HealthScore } from '@/components/dashboard/health-score';
import { HealthAiInsight } from '@/components/dashboard/health-ai-insight';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardData {
  person: {
    id: number;
    name: string;
    age: number;
    gender: string;
    phone: string;
    emergency_contact: string;
    emergency_phone: string;
    status: string;
  } | null;
  latestRecord: {
    heart_rate: number | null;
    blood_oxygen: number | null;
    body_temp: string | null;
    steps: number | null;
    recorded_at: string;
  } | null;
  latestBloodPressure: {
    systolic_bp: number | null;
    diastolic_bp: number | null;
    recorded_at: string;
  } | null;
  totalSteps: number;
  hrTrend: { heart_rate: number; recorded_at: string }[];
  bpTrend: { systolic_bp: number; diastolic_bp: number; recorded_at: string }[];
  recentAlarms: {
    id: number;
    alarm_type: string;
    alarm_level: string;
    message: string;
    value: string;
    threshold: string;
    is_acknowledged: boolean;
    created_at: string;
  }[];
  unacknowledgedAlarmCount: number;
  latestSleep: {
    id: number;
    start_time: string;
    end_time: string;
    deep_sleep_min: number;
    light_sleep_min: number;
    rem_sleep_min: number;
    awake_min: number;
    score: number;
    recorded_at: string;
  } | null;
  threshold: {
    heart_rate_min: number;
    heart_rate_max: number;
    blood_oxygen_min: number;
    blood_oxygen_max: number;
    body_temp_min: string;
    body_temp_max: string;
    steps_goal: number;
    sleep_goal_min: number;
    systolic_bp_max: number;
    systolic_bp_min: number;
    diastolic_bp_max: number;
    diastolic_bp_min: number;
  } | null;
}

export default function AdminDashboardPage() {
  const { persons, currentPersonId, setCurrentPersonId, alarmCount, setAlarmCount, isLoading } = useApp();
  /*页面核心数据状态*/
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [stressData, setStressData] = useState<any>(null);
  const [vascularData, setVascularData] = useState<any>(null);

  /*加载管理员当前选中人员的总览数据*/
  async function loadDashboard(showLoading = true) {
    if (!currentPersonId) return;
    if (showLoading) setLoading(true);

    try {
      const [dashboardRes, stressRes, vascularRes] = await Promise.all([
        fetch(`/api/dashboard?person_id=${currentPersonId}`),
        fetch(`/api/stress-mood?person_id=${currentPersonId}&limit=1`),
        fetch(`/api/vascular-assessments?person_id=${currentPersonId}&limit=1`)
      ]);

      const dashboardJson = await dashboardRes.json();
      if (dashboardJson.error) {
        console.error('Dashboard error:', dashboardJson.error);
      } else {
        setData(dashboardJson);
        setAlarmCount(dashboardJson.unacknowledgedAlarmCount || 0);
      }

      const stressJson = await stressRes.json();
      if (!stressJson.error && stressJson.data?.length > 0) {
        setStressData(stressJson.data[0]);
      }

      const vascularJson = await vascularRes.json();
      if (!vascularJson.error && vascularJson.data?.length > 0) {
        setVascularData(vascularJson.data[0]);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  /*页面加载和切换人员后自动刷新数据*/
  useEffect(() => {
    if (!currentPersonId) return;

    loadDashboard();
    // 每5秒自动刷新数据
    const timer = setInterval(() => {
      void loadDashboard(false);
    }, 5000);

    return () => clearInterval(timer);
  }, [currentPersonId, setAlarmCount]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">正在初始化数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* 管理员头部组件 - 支持人员切换 */}
      <Header
        persons={persons.map((p) => ({ id: p.id, name: p.name }))}
        currentPersonId={currentPersonId}
        onPersonChange={setCurrentPersonId}
        alarmCount={alarmCount}
      />

      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* 页面标题和欢迎区域 */}
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl p-6 border border-violet-100">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                健康总览
                <span className="text-lg font-normal text-muted-foreground">
                  · 实时监测
                </span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {data?.person
                  ? `${data.person.name}，${data.person.age}岁，${data.person.gender} — 实时健康数据监测`
                  : '加载中...'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>系统正常运行</span>
            </div>
          </div>
        </div>

        {/* 健康评分 */}
        {loading ? (
          <Skeleton className="h-48 rounded-2xl" />
        ) : (
          <HealthScore
            heartRate={data?.latestRecord?.heart_rate ?? null}
            bloodOxygen={data?.latestRecord?.blood_oxygen ?? null}
            bodyTemp={data?.latestRecord?.body_temp ? parseFloat(data.latestRecord.body_temp) : null}
            steps={data?.totalSteps ?? null}
            sleepScore={data?.latestSleep?.score ?? null}
            hasActiveAlarms={(data?.unacknowledgedAlarmCount ?? 0) > 0}
          />
        )}

        {loading ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : (
          <HealthAiInsight
            person={data?.person ?? null}
            latestRecord={data?.latestRecord ?? null}
            latestBloodPressure={data?.latestBloodPressure ?? null}
            totalSteps={data?.totalSteps ?? 0}
            unacknowledgedAlarmCount={data?.unacknowledgedAlarmCount ?? 0}
            latestSleep={data?.latestSleep ?? null}
            threshold={data?.threshold ?? null}
            stressData={stressData}
            vascularData={vascularData}
          />
        )}

        {/* 健康指标卡片 */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard
              title="心率"
              value={data?.latestRecord?.heart_rate ?? '--'}
              unit="bpm"
              icon="heart"
              color="red"
              status={
                data?.latestRecord?.heart_rate && data?.threshold
                  ? data.latestRecord.heart_rate > data.threshold.heart_rate_max
                    ? 'high'
                    : data.latestRecord.heart_rate < data.threshold.heart_rate_min
                      ? 'low'
                      : 'normal'
                  : 'normal'
              }
              min={data?.threshold?.heart_rate_min}
              max={data?.threshold?.heart_rate_max}
              recordedAt={data?.latestRecord?.recorded_at}
            />
            <MetricCard
              title="血氧"
              value={data?.latestRecord?.blood_oxygen ?? '--'}
              unit="%"
              icon="oxygen"
              color="blue"
              status={
                data?.latestRecord?.blood_oxygen && data?.threshold
                  ? data.latestRecord.blood_oxygen < data.threshold.blood_oxygen_min
                    ? 'low'
                    : 'normal'
                  : 'normal'
              }
              min={data?.threshold?.blood_oxygen_min}
              max={data?.threshold?.blood_oxygen_max ?? 100}
              recordedAt={data?.latestRecord?.recorded_at}
            />
            <MetricCard
              title="体温"
              value={data?.latestRecord?.body_temp ?? '--'}
              unit="°C"
              icon="temperature"
              color="orange"
              status={
                data?.latestRecord?.body_temp && data?.threshold
                  ? parseFloat(data.latestRecord.body_temp) > parseFloat(data.threshold.body_temp_max)
                    ? 'high'
                    : parseFloat(data.latestRecord.body_temp) < parseFloat(data.threshold.body_temp_min)
                      ? 'low'
                      : 'normal'
                  : 'normal'
              }
              min={data?.threshold?.body_temp_min ? parseFloat(data.threshold.body_temp_min) : 36.0}
              max={data?.threshold?.body_temp_max ? parseFloat(data.threshold.body_temp_max) : undefined}
              recordedAt={data?.latestRecord?.recorded_at}
            />
            <MetricCard
              title="血压"
              value={data?.latestBloodPressure?.systolic_bp ?? '--'}
              value2={data?.latestBloodPressure?.diastolic_bp ?? '--'}
              unit="mmHg"
              icon="bloodpressure"
              color="purple"
              status={
                data?.latestBloodPressure?.systolic_bp && data?.latestBloodPressure?.diastolic_bp && data?.threshold
                  ? data.latestBloodPressure.systolic_bp > data.threshold.systolic_bp_max ||
                    data.latestBloodPressure.diastolic_bp > data.threshold.diastolic_bp_max
                    ? 'high'
                    : data.latestBloodPressure.systolic_bp < data.threshold.systolic_bp_min ||
                      data.latestBloodPressure.diastolic_bp < data.threshold.diastolic_bp_min
                      ? 'low'
                      : 'normal'
                  : 'normal'
              }
              isBloodPressure
              min={data?.threshold?.systolic_bp_min}
              max={data?.threshold?.systolic_bp_max}
              min2={data?.threshold?.diastolic_bp_min}
              max2={data?.threshold?.diastolic_bp_max}
              recordedAt={data?.latestBloodPressure?.recorded_at}
            />
            <MetricCard
              title="今日步数"
              value={data?.totalSteps ?? 0}
              unit="步"
              icon="steps"
              color="green"
              status="normal"
              goal={data?.threshold?.steps_goal}
              isSteps
              recordedAt={data?.latestRecord?.recorded_at}
            />
          </div>
        )}

        {/* 中下区域：左侧心率趋势 + 睡眠分析，右侧报警记录 */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.7fr_1fr]">
          <div className="space-y-6">
            {loading ? (
              <Skeleton className="h-80 rounded-2xl" />
            ) : (
              <HeartRateTrend data={data?.hrTrend || []} threshold={data?.threshold ?? null} />
            )}

            {loading ? (
              <Skeleton className="h-64 rounded-2xl" />
            ) : (
              <div className="max-w-3xl">
                <SleepSummary sleep={data?.latestSleep || null} goal={data?.threshold?.sleep_goal_min} />
              </div>
            )}
          </div>

          <div>
            {loading ? (
              <Skeleton className="h-[620px] rounded-2xl" />
            ) : (
              <AlarmSummary alarms={data?.recentAlarms || []} total={data?.unacknowledgedAlarmCount || 0} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
