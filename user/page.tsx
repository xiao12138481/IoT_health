'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/components/layout/app-provider';
import { UserHeader } from '@/components/layout/user-header';
import { useAuth } from '@/components/layout/auth-provider';
import { MetricCard } from '@/components/dashboard/metric-card';
import { HeartRateTrend } from '@/components/dashboard/heart-rate-trend';
import { AlarmSummary } from '@/components/dashboard/alarm-summary';
import { SleepSummary } from '@/components/dashboard/sleep-summary';
import { HealthScore } from '@/components/dashboard/health-score';
import { HealthAiInsight } from '@/components/dashboard/health-ai-insight';
import { Skeleton } from '@/components/ui/skeleton';

const USER_AI_MODEL_STORAGE_KEY = 'user-ai-model';

/**
 * 用户健康总览页面
 * 功能描述：
 * 1. 显示当前登录用户的健康数据概览
 * 2. 实时显示各项健康指标
 * 3. 包含心率、血氧、体温、血压、步数等指标
 * 4. 显示报警记录和睡眠、运动分析
 * 5. 不需要人员切换功能，只显示当前用户的数据
 */
/**
 * 仪表盘数据结构
 * 包含用户健康总览所需的所有数据
 */
interface DashboardData {
  /** 当前人员信息 */
  person: {
    /** 人员ID */
    id: number;
    /** 姓名 */
    name: string;
    /** 年龄 */
    age: number;
    /** 性别 */
    gender: string;
    /** 联系电话 */
    phone: string;
    /** 紧急联系人 */
    emergency_contact: string;
    /** 紧急联系电话 */
    emergency_phone: string;
    /** 状态 */
    status: string;
  } | null;
  /** 最新健康记录 */
  latestRecord: {
    /** 心率 */
    heart_rate: number | null;
    /** 血氧 */
    blood_oxygen: number | null;
    /** 体温 */
    body_temp: string | null;
    /** 步数 */
    steps: number | null;
    /** 记录时间 */
    recorded_at: string;
  } | null;
  /** 最新血压记录 */
  latestBloodPressure: {
    /** 收缩压 */
    systolic_bp: number | null;
    /** 舒张压 */
    diastolic_bp: number | null;
    /** 记录时间 */
    recorded_at: string;
  } | null;
  /** 今日总步数 */
  totalSteps: number;
  /** 心率趋势数据 */
  hrTrend: { 
    /** 心率值 */
    heart_rate: number; 
    /** 记录时间 */
    recorded_at: string 
  }[];
  /** 血压趋势数据 */
  bpTrend: { 
    /** 收缩压 */
    systolic_bp: number; 
    /** 舒张压 */
    diastolic_bp: number; 
    /** 记录时间 */
    recorded_at: string 
  }[];
  /** 最近报警记录 */
  recentAlarms: {
    /** 报警ID */
    id: number;
    /** 报警类型 */
    alarm_type: string;
    /** 报警等级 */
    alarm_level: string;
    /** 报警信息 */
    message: string;
    /** 实际值 */
    value: string;
    /** 阈值 */
    threshold: string;
    /** 是否已确认 */
    is_acknowledged: boolean;
    /** 创建时间 */
    created_at: string;
  }[];
  /** 未确认的报警数量 */
  unacknowledgedAlarmCount: number;
  /** 最新睡眠记录 */
  latestSleep: {
    /** 记录ID */
    id: number;
    /** 睡眠开始时间 */
    start_time: string;
    /** 睡眠结束时间 */
    end_time: string;
    /** 深度睡眠时长（分钟） */
    deep_sleep_min: number;
    /** 轻度睡眠时长（分钟） */
    light_sleep_min: number;
    /** REM睡眠时长（分钟） */
    rem_sleep_min: number;
    /** 清醒时长（分钟） */
    awake_min: number;
    /** 睡眠评分 */
    score: number;
    /** 记录时间 */
    recorded_at: string;
  } | null;
  /** 健康阈值配置 */
  threshold: {
    /** 心率最低值 */
    heart_rate_min: number;
    /** 心率最高值 */
    heart_rate_max: number;
    /** 血氧最低值 */
    blood_oxygen_min: number;
    /** 血氧最高值 */
    blood_oxygen_max: number;
    /** 体温最低值 */
    body_temp_min: string;
    /** 体温最高值 */
    body_temp_max: string;
    /** 每日步数目标 */
    steps_goal: number;
    /** 每日睡眠目标（分钟） */
    sleep_goal_min: number;
    /** 收缩压最高值 */
    systolic_bp_max: number;
    /** 收缩压最低值 */
    systolic_bp_min: number;
    /** 舒张压最高值 */
    diastolic_bp_max: number;
    /** 舒张压最低值 */
    diastolic_bp_min: number;
  } | null;
}

export default function UserDashboardPage() {
  const { currentPersonId, alarmCount, setAlarmCount, isLoading } = useApp();

  /*页面核心数据状态*/
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [stressData, setStressData] = useState<any>(null);
  const [vascularData, setVascularData] = useState<any>(null);
  const [preferredAiModel, setPreferredAiModel] = useState('');

  /*从本地缓存读取用户偏好的 AI 模型*/
  const readPreferredAiModel = (personId: number | null) => {
    if (typeof window === 'undefined' || !personId) {
      return '';
    }

    return window.localStorage.getItem(`${USER_AI_MODEL_STORAGE_KEY}:${personId}`) || '';
  };

  /*加载用户健康总览、压力情绪和血管评估数据*/
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

  /*页面加载后首次请求数据并开启自动刷新*/
  useEffect(() => {
    if (!currentPersonId) return;

    loadDashboard();
    // 每5秒自动刷新数据
    const timer = setInterval(() => {
      void loadDashboard(false);
    }, 5000);

    return () => clearInterval(timer);
  }, [currentPersonId, setAlarmCount]);

  /*同步当前用户保存的 AI 模型偏好*/
  useEffect(() => {
    if (!currentPersonId) {
      setPreferredAiModel('');
      return;
    }

    const syncPreferredAiModel = () => {
      setPreferredAiModel(readPreferredAiModel(currentPersonId));
    };

    syncPreferredAiModel();
    window.addEventListener('focus', syncPreferredAiModel);

    return () => {
      window.removeEventListener('focus', syncPreferredAiModel);
    };
  }, [currentPersonId]);

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
      {/* 用户头部组件 - 不显示人员切换 */}
      <UserHeader />

      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* 页面标题和欢迎区域 */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-100">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                健康总览
                <span className="text-lg font-normal text-muted-foreground">
                  · 今日状态
                </span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {data?.person
                  ? `${data.person.name}，${data.person.age}岁，${data.person.gender} — 您的实时健康数据`
                  : '加载中...'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>实时同步中</span>
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
            preferredModel={preferredAiModel || null}
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
