'use client';

/**
 * 管理员系统设置页面
 * 功能描述：
 * - 配置监测阈值、通知偏好与个人信息
 * - 支持人员切换（管理员独有）
 * - 健康监测模拟控制台
 */

import { useEffect, useState } from 'react';
import { useApp } from '@/components/layout/app-provider';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Settings, Shield, Bell, User, Save, RotateCcw, Play, Square, Brain, Loader2, Database, HardDrive, Download } from 'lucide-react';

/*阈值配置数据类型*/
interface ThresholdData {
  id: number;
  person_id: number;
  heart_rate_min: number;
  heart_rate_max: number;
  blood_oxygen_min: number;
  body_temp_max: string;
  body_temp_min: string;
  steps_goal: number;
  sleep_goal_min: number;
  systolic_bp_max: number;
  systolic_bp_min: number;
  diastolic_bp_max: number;
  diastolic_bp_min: number;
}

/*人员基本信息数据类型*/
interface PersonData {
  id: number;
  name: string;
  age: number;
  gender: string;
  phone: string;
  emergency_contact: string;
  emergency_phone: string;
}

/*模拟器场景类型*/
type SimulatorScenario = 'normal' | 'exercise' | 'stress' | 'night' | 'sleep' | 'sleep_anomaly' | 'critical' | 'mixed';
/*异常类型*/
type AnomalyType = 'none' | 'tachycardia' | 'bradycardia' | 'hypoxia' | 'fever' | 'hypertension' | 'hypotension' | 'combined';
/*异常严重程度*/
type AnomalySeverity = 'mild' | 'moderate' | 'severe';
/*模拟器运动类型*/
type SimulatorSportType = 'auto' | 'running' | 'swimming' | 'cycling' | 'other';

/*模拟器配置数据类型*/
interface SimulatorConfig {
  personIds: number[] | 'all';
  cycles: number;
  intervalMs: number;
  stepMinutes: number;
  scenario: SimulatorScenario;
  sportPriorityMode: boolean;
  selectedSportType: SimulatorSportType;
  anomalyMode: boolean;
  anomalyType: AnomalyType;
  anomalySeverity: AnomalySeverity;
}

/*模拟器摘要项数据类型*/
interface SimulatorSummaryItem {
  personId: number;
  personName: string;
  scenario: string;
  alarmCount: number;
  metrics: {
    heartRate: number;
    bloodOxygen: number;
    bodyTemp: number;
    bloodPressure: string;
    steps: number;
  };
  exercise: {
    id: number;
    sportType: 'running' | 'swimming' | 'cycling' | 'other';
    durationMin: number;
    distanceKm: number;
    calories: number;
    paceMinPerKm: number;
    pauseCount: number;
  } | null;
  vascularScore: number | null;
  sleep: {
    score: number | null;
    durationMinutes: number;
    currentStage?: string;
    progressPercent?: number;
    status?: 'running' | 'completed';
    reportGenerated?: boolean;
  } | null;
}

/*模拟器运动类型标签*/
const simulatorExerciseTypeLabels: Record<'running' | 'swimming' | 'cycling' | 'other', string> = {
  running: '跑步',
  swimming: '游泳',
  cycling: '骑行',
  other: '其他',
};

/*模拟器运动选项*/
const simulatorSportOptions: Array<{ value: SimulatorSportType; label: string; description: string }> = [
  { value: 'auto', label: '自动识别', description: '按时段自动切换运动类型' },
  { value: 'running', label: '跑步', description: '固定生成跑步数据' },
  { value: 'swimming', label: '游泳', description: '固定生成游泳数据' },
  { value: 'cycling', label: '骑行', description: '固定生成骑行数据' },
  { value: 'other', label: '其他', description: '固定生成其他运动数据' },
];

/*模拟器状态数据类型*/
interface SimulatorStatus {
  running: boolean;
  config: SimulatorConfig;
  cyclesCompleted: number;
  startedAt: string | null;
  lastRunAt: string | null;
  currentTime: string | null;
  lastSummary: {
    simulatedAt: string;
    personCount: number;
    totalAlarms: number;
    summaries: SimulatorSummaryItem[];
  } | null;
  lastError: string | null;
}

interface AiModelStatus {
  connected: boolean;
  host: string;
  currentModel: string;
  availableModels: string[];
  error?: string;
}

interface DatabaseConfig {
  current_type: 'json' | 'mysql';
  mysql_configured: boolean;
  env: {
    MYSQL_HOST: string;
    MYSQL_PORT: string;
    MYSQL_USER: string;
    MYSQL_DATABASE: string;
  };
  config: {
    database_type: 'json' | 'mysql';
    migrated?: boolean;
    migrated_at?: string;
  };
}

const scenarioOptions: Array<{ value: SimulatorScenario; label: string; description: string }> = [
  { value: 'mixed', label: '混合场景', description: '按时间自动切换正常、运动、压力与夜间状态' },
  { value: 'normal', label: '日常监测', description: '平稳生成日常健康数据' },
  { value: 'exercise', label: '运动模式', description: '提高心率、步数和血压波动' },
  { value: 'stress', label: '高压模式', description: '模拟精神紧张与血压偏高' },
  { value: 'night', label: '夜间模式', description: '生成低活动、低心率的夜间数据' },
  { value: 'sleep', label: '睡眠测试', description: '生成一晚睡眠记录并验证睡眠分析页面与数据存储' },
  { value: 'sleep_anomaly', label: '睡眠异常测试', description: '生成睡眠不足、清醒偏多、评分偏低的异常睡眠记录' },
  { value: 'critical', label: '危险模式', description: '持续生成高风险监测数据' },
];

const anomalyOptions: Array<{ value: AnomalyType; label: string }> = [
  { value: 'none', label: '无异常' },
  { value: 'tachycardia', label: '心动过速' },
  { value: 'bradycardia', label: '心动过缓' },
  { value: 'hypoxia', label: '低血氧' },
  { value: 'fever', label: '发热' },
  { value: 'hypertension', label: '高血压' },
  { value: 'hypotension', label: '低血压' },
  { value: 'combined', label: '复合异常' },
];

export default function AdminSettingsPage() {
  const { persons, currentPersonId, setCurrentPersonId, alarmCount } = useApp();
  const [threshold, setThreshold] = useState<ThresholdData | null>(null);
  const [person, setPerson] = useState<PersonData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notifications, setNotifications] = useState({
    heartRate: true,
    bloodOxygen: true,
    bloodPressure: true,
    fever: true,
    stepsReminder: false,
    sleepReminder: true,
  });
  const [simulatorStatus, setSimulatorStatus] = useState<SimulatorStatus | null>(null);
  const [simulatorSubmitting, setSimulatorSubmitting] = useState(false);
  const [simulatorConfig, setSimulatorConfig] = useState<Omit<SimulatorConfig, 'personIds'>>({
    cycles: 0,
    intervalMs: 2000,
    stepMinutes: 15,
    scenario: 'mixed',
    sportPriorityMode: false,
    selectedSportType: 'auto',
    anomalyMode: false,
    anomalyType: 'none',
    anomalySeverity: 'moderate',
  });
  const [simulatorConfigInitialized, setSimulatorConfigInitialized] = useState(false);
  const [aiModelStatus, setAiModelStatus] = useState<AiModelStatus | null>(null);
  const [selectedAiModel, setSelectedAiModel] = useState('');
  const [aiModelsLoading, setAiModelsLoading] = useState(false);
  const [aiModelSaving, setAiModelSaving] = useState(false);
  
  // 数据库配置状态
  const [databaseConfig, setDatabaseConfig] = useState<DatabaseConfig | null>(null);
  const [databaseLoading, setDatabaseLoading] = useState(false);
  const [databaseSaving, setDatabaseSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);

  // Form state
  const [form, setForm] = useState({
    heart_rate_min: 60,
    heart_rate_max: 100,
    blood_oxygen_min: 95,
    body_temp_max: '37.3',
    body_temp_min: '36.0',
    steps_goal: 8000,
    sleep_goal_min: 420,
    systolic_bp_max: 140,
    systolic_bp_min: 90,
    diastolic_bp_max: 90,
    diastolic_bp_min: 60,
  });

  /*切换人员后加载阈值和人员信息*/
  useEffect(() => {
    if (!currentPersonId) return;
    async function loadSettings() {
      try {
        const [thRes, pRes] = await Promise.all([
          fetch(`/api/thresholds?person_id=${currentPersonId}`),
          fetch(`/api/dashboard?person_id=${currentPersonId}`),
        ]);
        const thData = await thRes.json();
        const pData = await pRes.json();
        if (thData.threshold) {
          setThreshold(thData.threshold);
          setForm({
            heart_rate_min: thData.threshold.heart_rate_min ?? 60,
            heart_rate_max: thData.threshold.heart_rate_max ?? 100,
            blood_oxygen_min: thData.threshold.blood_oxygen_min ?? 95,
            body_temp_max: thData.threshold.body_temp_max ?? '37.3',
            body_temp_min: thData.threshold.body_temp_min ?? '36.0',
            steps_goal: thData.threshold.steps_goal ?? 8000,
            sleep_goal_min: thData.threshold.sleep_goal_min ?? 420,
            systolic_bp_max: thData.threshold.systolic_bp_max ?? 140,
            systolic_bp_min: thData.threshold.systolic_bp_min ?? 90,
            diastolic_bp_max: thData.threshold.diastolic_bp_max ?? 90,
            diastolic_bp_min: thData.threshold.diastolic_bp_min ?? 60,
          });
        }
        if (pData.person) {
          setPerson(pData.person);
        }
      } catch { /* */ }
    }
    loadSettings();
  }, [currentPersonId]);

  /*读取当前模拟器运行状态和配置*/
  const loadSimulatorStatus = async () => {
    try {
      const res = await fetch('/api/simulator');
      const data = await res.json();
      if (data.status) {
        setSimulatorStatus(data.status);
        /*只在首次进入页面时用服务端配置初始化表单*/
        if (!simulatorConfigInitialized && data.status.config) {
          setSimulatorConfig({
            cycles: data.status.config?.cycles ?? 0,
            intervalMs: data.status.config?.intervalMs ?? 2000,
            stepMinutes: data.status.config?.stepMinutes ?? 15,
            scenario: data.status.config?.scenario ?? 'mixed',
            sportPriorityMode: data.status.config?.sportPriorityMode ?? false,
            selectedSportType: data.status.config?.selectedSportType ?? 'auto',
            anomalyMode: data.status.config?.anomalyMode ?? false,
            anomalyType: data.status.config?.anomalyType ?? 'none',
            anomalySeverity: data.status.config?.anomalySeverity ?? 'moderate',
          });
          setSimulatorConfigInitialized(true);
        }
      }
    } catch {
      // Ignore polling errors in settings page
    }
  };

  /*页面首次进入时加载模拟器状态*/
  useEffect(() => {
    loadSimulatorStatus();
  }, []);

  /*读取当前可用的 AI 模型列表*/
  const loadAiModels = async () => {
    setAiModelsLoading(true);
    try {
      const response = await fetch('/api/ai-models');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '加载 AI 模型列表失败');
      }

      setAiModelStatus(data);
      setSelectedAiModel(data.currentModel || '');
    } catch (error) {
      setAiModelStatus({
        connected: false,
        host: 'http://127.0.0.1:11434',
        currentModel: '',
        availableModels: [],
        error: error instanceof Error ? error.message : '加载 AI 模型列表失败',
      });
    } finally {
      setAiModelsLoading(false);
    }
  };

  /*页面首次进入时加载 AI 模型列表*/
  useEffect(() => {
    void loadAiModels();
  }, []);

  /*读取当前数据库配置和连接状态*/
  const loadDatabaseConfig = async () => {
    setDatabaseLoading(true);
    try {
      const response = await fetch('/api/database');
      const data = await response.json();
      
      if (response.ok) {
        setDatabaseConfig(data);
      }
    } catch (error) {
      console.error('Failed to load database config:', error);
    } finally {
      setDatabaseLoading(false);
    }
  };

  /*页面首次进入时加载数据库配置*/
  useEffect(() => {
    void loadDatabaseConfig();
  }, []);

  /*按运行状态轮询模拟器信息*/
  useEffect(() => {
    const timer = setInterval(() => {
      loadSimulatorStatus();
    }, simulatorStatus?.running ? 2000 : 5000);

    return () => clearInterval(timer);
  }, [simulatorStatus?.running]);

  /*保存健康阈值配置*/
  const handleSaveThresholds = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: currentPersonId, ...form }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* */ } finally { setSaving(false); }
  };

  /*恢复阈值表单到最近一次加载的数据*/
  const handleResetThresholds = () => {
    if (threshold) {
      setForm({
        heart_rate_min: threshold.heart_rate_min ?? 60,
        heart_rate_max: threshold.heart_rate_max ?? 100,
        blood_oxygen_min: threshold.blood_oxygen_min ?? 95,
        body_temp_max: threshold.body_temp_max ?? '37.3',
        body_temp_min: threshold.body_temp_min ?? '36.0',
        steps_goal: threshold.steps_goal ?? 8000,
        sleep_goal_min: threshold.sleep_goal_min ?? 420,
        systolic_bp_max: threshold.systolic_bp_max ?? 140,
        systolic_bp_min: threshold.systolic_bp_min ?? 90,
        diastolic_bp_max: threshold.diastolic_bp_max ?? 90,
        diastolic_bp_min: threshold.diastolic_bp_min ?? 60,
      });
    }
  };

  /*启动健康数据模拟器*/
  const handleStartSimulation = async () => {
    setSimulatorSubmitting(true);
    try {
      const response = await fetch('/api/simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          config: {
            ...simulatorConfig,
            personIds: currentPersonId ? [currentPersonId] : 'all',
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '启动模拟失败');
      setSimulatorStatus(data.status);
    } catch {
      // Ignore and rely on status polling
    } finally {
      setSimulatorSubmitting(false);
      loadSimulatorStatus();
    }
  };

  /*停止健康数据模拟器*/
  const handleStopSimulation = async () => {
    setSimulatorSubmitting(true);
    try {
      const response = await fetch('/api/simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '停止模拟失败');
      setSimulatorStatus(data.status);
    } catch {
      // Ignore and rely on status polling
    } finally {
      setSimulatorSubmitting(false);
      loadSimulatorStatus();
    }
  };

  /*一键套用睡眠演示场景参数*/
  const applySleepDemoPreset = (scenario: Extract<SimulatorScenario, 'sleep' | 'sleep_anomaly'>) => {
    setSimulatorConfig({
      cycles: 24,
      intervalMs: 800,
      stepMinutes: 20,
      scenario,
      sportPriorityMode: false,
      selectedSportType: 'auto',
      anomalyMode: scenario === 'sleep_anomaly',
      anomalyType: scenario === 'sleep_anomaly' ? 'hypoxia' : 'none',
      anomalySeverity: scenario === 'sleep_anomaly' ? 'moderate' : 'moderate',
    });
  };

  /*保存当前选中的 AI 模型配置*/
  const handleSaveAiModel = async () => {
    if (!selectedAiModel) {
      alert('请先选择一个本地模型');
      return;
    }

    setAiModelSaving(true);
    try {
      const response = await fetch('/api/ai-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedAiModel }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '保存 AI 模型失败');
      }

      setAiModelStatus(data);
      setSelectedAiModel(data.currentModel || selectedAiModel);
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存 AI 模型失败');
    } finally {
      setAiModelSaving(false);
    }
  };

  /*切换系统当前使用的数据库类型*/
  const handleSwitchDatabase = async (newType: 'json' | 'mysql') => {
    if (newType === 'mysql' && !databaseConfig?.mysql_configured) {
      alert('MySQL 未配置，请先在 .env 文件中配置 MySQL 连接信息');
      return;
    }
    
    setDatabaseSaving(true);
    try {
      const response = await fetch('/api/database', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ database_type: newType }),
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '切换数据库失败');
      }
      
      await loadDatabaseConfig();
      alert(`数据库已切换为 ${newType === 'mysql' ? 'MySQL' : 'JSON'}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : '切换数据库失败');
    } finally {
      setDatabaseSaving(false);
    }
  };

  /*将 JSON 数据迁移到 MySQL*/
  const handleMigrateData = async () => {
    if (!confirm('确定要将 JSON 数据库中的数据迁移到 MySQL 吗？')) {
      return;
    }
    
    setMigrating(true);
    try {
      const response = await fetch('/api/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'migrate' }),
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '数据迁移失败');
      }
      
      await loadDatabaseConfig();
      alert(data.message || '数据迁移完成！');
    } catch (error) {
      alert(error instanceof Error ? error.message : '数据迁移失败');
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="flex flex-col">
      <Header persons={persons.map((p) => ({ id: p.id, name: p.name }))} currentPersonId={currentPersonId} onPersonChange={setCurrentPersonId} alarmCount={alarmCount} />
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="h-7 w-7 text-slate-600" /> 系统设置
          </h2>
          <p className="text-sm text-muted-foreground mt-1">配置监测阈值、通知偏好与个人信息（管理员版）</p>
        </div>

        <Tabs defaultValue="thresholds" className="space-y-6">
          <TabsList>
            <TabsTrigger value="thresholds" className="gap-2">
              <Shield className="h-4 w-4" /> 阈值配置
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" /> 通知偏好
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" /> 个人信息
            </TabsTrigger>
            <TabsTrigger value="simulation" className="gap-2">
              <Settings className="h-4 w-4" /> 模拟测试
            </TabsTrigger>
            <TabsTrigger value="database" className="gap-2">
              <Database className="h-4 w-4" /> 数据库
            </TabsTrigger>
          </TabsList>

          {/* Thresholds Tab */}
          <TabsContent value="thresholds" className="space-y-6">
            {/* Heart Rate Threshold */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">心率报警阈值</CardTitle>
                <CardDescription>当心率超出设定范围时触发报警</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="hr-min">最低心率 (bpm)</Label>
                    <Input
                      id="hr-min"
                      type="number"
                      value={form.heart_rate_min}
                      onChange={(e) => setForm({ ...form, heart_rate_min: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hr-max">最高心率 (bpm)</Label>
                    <Input
                      id="hr-max"
                      type="number"
                      value={form.heart_rate_max}
                      onChange={(e) => setForm({ ...form, heart_rate_max: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Blood Oxygen Threshold */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">血氧报警阈值</CardTitle>
                <CardDescription>当血氧低于设定值时触发报警</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="spo2-min">最低血氧 (%)</Label>
                    <Input
                      id="spo2-min"
                      type="number"
                      value={form.blood_oxygen_min}
                      onChange={(e) => setForm({ ...form, blood_oxygen_min: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Body Temperature Threshold */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">体温报警阈值</CardTitle>
                <CardDescription>当体温超出设定范围时触发报警</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="temp-min">最低体温 (°C)</Label>
                    <Input
                      id="temp-min"
                      type="number"
                      step="0.1"
                      value={form.body_temp_min}
                      onChange={(e) => setForm({ ...form, body_temp_min: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="temp-max">最高体温 (°C)</Label>
                    <Input
                      id="temp-max"
                      type="number"
                      step="0.1"
                      value={form.body_temp_max}
                      onChange={(e) => setForm({ ...form, body_temp_max: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Blood Pressure Threshold */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">血压报警阈值</CardTitle>
                <CardDescription>当血压超出设定范围时触发报警</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="systolic-min">最低收缩压 (mmHg)</Label>
                    <Input
                      id="systolic-min"
                      type="number"
                      value={form.systolic_bp_min}
                      onChange={(e) => setForm({ ...form, systolic_bp_min: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="systolic-max">最高收缩压 (mmHg)</Label>
                    <Input
                      id="systolic-max"
                      type="number"
                      value={form.systolic_bp_max}
                      onChange={(e) => setForm({ ...form, systolic_bp_max: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="diastolic-min">最低舒张压 (mmHg)</Label>
                    <Input
                      id="diastolic-min"
                      type="number"
                      value={form.diastolic_bp_min}
                      onChange={(e) => setForm({ ...form, diastolic_bp_min: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="diastolic-max">最高舒张压 (mmHg)</Label>
                    <Input
                      id="diastolic-max"
                      type="number"
                      value={form.diastolic_bp_max}
                      onChange={(e) => setForm({ ...form, diastolic_bp_max: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Goals */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">健康目标</CardTitle>
                <CardDescription>设定每日运动和睡眠目标</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="steps-goal">每日步数目标</Label>
                    <Input
                      id="steps-goal"
                      type="number"
                      value={form.steps_goal}
                      onChange={(e) => setForm({ ...form, steps_goal: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sleep-goal">每日睡眠目标 (分钟)</Label>
                    <Input
                      id="sleep-goal"
                      type="number"
                      value={form.sleep_goal_min}
                      onChange={(e) => setForm({ ...form, sleep_goal_min: parseInt(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">{Math.floor(form.sleep_goal_min / 60)}小时{form.sleep_goal_min % 60}分钟</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Save buttons */}
            <div className="flex items-center gap-3">
              <Button onClick={handleSaveThresholds} disabled={saving} className="bg-teal-600 hover:bg-teal-700">
                <Save className="h-4 w-4 mr-2" />
                {saving ? '保存中...' : saved ? '已保存' : '保存配置'}
              </Button>
              <Button variant="outline" onClick={handleResetThresholds}>
                <RotateCcw className="h-4 w-4 mr-2" /> 重置
              </Button>
            </div>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">报警通知</CardTitle>
                <CardDescription>选择需要接收通知的报警类型</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: 'heartRate' as const, label: '心率异常通知', desc: '心率超出阈值范围时通知' },
                  { key: 'bloodOxygen' as const, label: '血氧异常通知', desc: '血氧低于阈值时通知' },
                  { key: 'bloodPressure' as const, label: '血压异常通知', desc: '收缩压或舒张压超出阈值范围时通知' },
                  { key: 'fever' as const, label: '体温异常通知', desc: '体温超出正常范围时通知' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      checked={notifications[item.key]}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, [item.key]: checked })}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">健康提醒</CardTitle>
                <CardDescription>日常健康习惯提醒</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: 'stepsReminder' as const, label: '运动提醒', desc: '久坐时提醒起身活动' },
                  { key: 'sleepReminder' as const, label: '睡眠提醒', desc: '到睡觉时间时提醒入睡' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      checked={notifications[item.key]}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, [item.key]: checked })}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">监测对象信息</CardTitle>
                <CardDescription>当前监测对象的基本信息</CardDescription>
              </CardHeader>
              <CardContent>
                {person ? (
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>姓名</Label>
                      <Input value={person.name ?? '--'} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>年龄</Label>
                      <Input value={person.age ?? '--'} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>性别</Label>
                      <Input value={person.gender ?? '--'} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>联系电话</Label>
                      <Input value={person.phone || '--'} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>紧急联系人</Label>
                      <Input value={person.emergency_contact || '--'} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>紧急联系电话</Label>
                      <Input value={person.emergency_phone || '--'} disabled />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">加载中...</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="simulation" className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Brain className="h-4 w-4 text-violet-600" />
                      本地 AI 模型配置
                    </CardTitle>
                    <CardDescription>直接读取 Ollama 已安装模型，并切换健康总览 AI 解读所使用的大模型</CardDescription>
                  </div>
                  <Badge className={aiModelStatus?.connected ? 'bg-emerald-600' : 'bg-slate-500'}>
                    {aiModelStatus?.connected ? 'Ollama 已连接' : '未连接'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-4">
                  <div className="rounded-xl border bg-violet-50/70 p-4">
                    <p className="text-sm text-muted-foreground">服务地址</p>
                    <p className="mt-1 break-all text-sm font-medium">{aiModelStatus?.host || 'http://127.0.0.1:11434'}</p>
                    <p className="mt-3 text-sm text-muted-foreground">当前模型</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">{aiModelStatus?.currentModel || '未选择'}</p>
                  </div>
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-sm text-muted-foreground">已安装模型数</p>
                    <p className="mt-1 text-2xl font-semibold">{aiModelStatus?.availableModels.length ?? 0}</p>
                    <p className="mt-2 text-xs text-muted-foreground">切换后，健康总览 AI 解读会直接使用新模型，无需修改 `.env.local`。</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 items-end">
                  <div className="space-y-2">
                    <Label>选择 Ollama 模型</Label>
                    <Select value={selectedAiModel} onValueChange={setSelectedAiModel} disabled={aiModelsLoading || (aiModelStatus?.availableModels.length ?? 0) === 0}>
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder={aiModelsLoading ? '正在读取模型列表' : '请选择模型'} />
                      </SelectTrigger>
                      <SelectContent>
                        {(aiModelStatus?.availableModels || []).map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" variant="outline" onClick={() => void loadAiModels()} disabled={aiModelsLoading}>
                    {aiModelsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                    刷新列表
                  </Button>
                  <Button type="button" onClick={handleSaveAiModel} disabled={aiModelSaving || !selectedAiModel} className="bg-violet-600 hover:bg-violet-700">
                    {aiModelSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    保存切换
                  </Button>
                </div>

                {aiModelStatus?.connected ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    当前已连接本地 Ollama。你可以随时下载新模型，点击“刷新列表”后即可在这里切换。
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {aiModelStatus?.error || '当前无法连接本地 Ollama，请确认服务已启动。'}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">健康监测模拟控制台</CardTitle>
                    <CardDescription>基于当前选中的监测对象启动/停止实时模拟，并支持异常注入测试</CardDescription>
                  </div>
                  <Badge className={simulatorStatus?.running ? 'bg-green-600' : 'bg-slate-500'}>
                    {simulatorStatus?.running ? '运行中' : '已停止'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-xl border p-4 bg-slate-50">
                    <p className="text-sm text-muted-foreground">目标对象</p>
                    <p className="text-lg font-semibold mt-1">{persons.find((item) => item.id === currentPersonId)?.name || '全部对象'}</p>
                    <p className="text-xs text-muted-foreground mt-1">模拟仅作用于当前顶部切换选中的对象</p>
                  </div>
                  <div className="rounded-xl border p-4 bg-slate-50">
                    <p className="text-sm text-muted-foreground">已执行轮次</p>
                    <p className="text-lg font-semibold mt-1">{simulatorStatus?.cyclesCompleted ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">0 表示尚未开始或刚刚重置</p>
                  </div>
                  <div className="rounded-xl border p-4 bg-slate-50">
                    <p className="text-sm text-muted-foreground">最近执行时间</p>
                    <p className="text-sm font-semibold mt-1">
                      {simulatorStatus?.lastRunAt ? new Date(simulatorStatus.lastRunAt).toLocaleString('zh-CN') : '--'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">用于确认模拟是否持续推送数据</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">可视化场景切换面板</p>
                    <p className="text-xs text-muted-foreground mt-1">选择一套基础生命体征行为模式</p>
                  </div>
                  <div className="flex flex-wrap gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => applySleepDemoPreset('sleep')}>
                      快速整晚睡眠演示
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => applySleepDemoPreset('sleep_anomaly')}>
                      快速异常睡眠演示
                    </Button>
                    <p className="w-full text-xs text-indigo-700">
                      预设为 24 轮、每轮 20 分钟、每 800ms 推进一次，约 20 秒完成一整晚睡眠过程并自动生成报告。
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {scenarioOptions.map((scenario) => (
                      <button
                        key={scenario.value}
                        type="button"
                        onClick={() => setSimulatorConfig({ ...simulatorConfig, scenario: scenario.value })}
                        className={`rounded-xl border p-4 text-left transition-all ${
                          simulatorConfig.scenario === scenario.value
                            ? 'border-teal-500 bg-teal-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{scenario.label}</span>
                          {simulatorConfig.scenario === scenario.value ? (
                            <Badge className="bg-teal-600">已选中</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">{scenario.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-xl border p-4 bg-violet-50">
                    <div>
                      <p className="text-sm font-medium">专项运动优先模式</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        开启后，白天会优先按运动场景生成数据，更频繁写入跑步、游泳、骑行、其他等专项运动记录。
                      </p>
                    </div>
                    <Switch
                      checked={simulatorConfig.sportPriorityMode}
                      onCheckedChange={(checked) => setSimulatorConfig({ ...simulatorConfig, sportPriorityMode: checked })}
                    />
                  </div>

                  <div className="space-y-2 rounded-xl border p-4 bg-sky-50">
                    <Label>模拟运动类型</Label>
                    <Select
                      value={simulatorConfig.selectedSportType}
                      onValueChange={(value: SimulatorSportType) => setSimulatorConfig({ ...simulatorConfig, selectedSportType: value })}
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="选择运动类型" />
                      </SelectTrigger>
                      <SelectContent>
                        {simulatorSportOptions.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {simulatorSportOptions.find((item) => item.value === simulatorConfig.selectedSportType)?.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border p-4 bg-amber-50">
                    <div>
                      <p className="text-sm font-medium">异常注入测试模式</p>
                      <p className="text-xs text-muted-foreground mt-1">开启后会对基础场景施加异常偏移，用于验证报警、趋势图和分析页面</p>
                    </div>
                    <Switch
                      checked={simulatorConfig.anomalyMode}
                      onCheckedChange={(checked) => setSimulatorConfig({ ...simulatorConfig, anomalyMode: checked, anomalyType: checked ? simulatorConfig.anomalyType : 'none' })}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>异常类型</Label>
                      <Select
                        value={simulatorConfig.anomalyType}
                        onValueChange={(value: AnomalyType) => setSimulatorConfig({ ...simulatorConfig, anomalyType: value })}
                        disabled={!simulatorConfig.anomalyMode}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="选择异常类型" />
                        </SelectTrigger>
                        <SelectContent>
                          {anomalyOptions.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>异常强度</Label>
                      <Select
                        value={simulatorConfig.anomalySeverity}
                        onValueChange={(value: AnomalySeverity) => setSimulatorConfig({ ...simulatorConfig, anomalySeverity: value })}
                        disabled={!simulatorConfig.anomalyMode}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="选择强度" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mild">轻度</SelectItem>
                          <SelectItem value="moderate">中度</SelectItem>
                          <SelectItem value="severe">重度</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sim-cycles">执行轮次 (0 为持续运行)</Label>
                    <Input
                      id="sim-cycles"
                      type="number"
                      value={simulatorConfig.cycles}
                      onChange={(e) => setSimulatorConfig({ ...simulatorConfig, cycles: parseInt(e.target.value, 10) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sim-interval">执行间隔 (ms)</Label>
                    <Input
                      id="sim-interval"
                      type="number"
                      value={simulatorConfig.intervalMs}
                      onChange={(e) => setSimulatorConfig({ ...simulatorConfig, intervalMs: parseInt(e.target.value, 10) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sim-step-minutes">虚拟时间步长 (分钟)</Label>
                    <Input
                      id="sim-step-minutes"
                      type="number"
                      value={simulatorConfig.stepMinutes}
                      onChange={(e) => setSimulatorConfig({ ...simulatorConfig, stepMinutes: parseInt(e.target.value, 10) || 1 })}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleStartSimulation}
                    disabled={simulatorSubmitting || simulatorStatus?.running}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    开始模拟
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleStopSimulation}
                    disabled={simulatorSubmitting || !simulatorStatus?.running}
                  >
                    <Square className="h-4 w-4 mr-2" />
                    停止模拟
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">最近一次模拟结果</CardTitle>
                <CardDescription>用于观察异常注入后是否成功触发告警、压力记录、血管评估以及睡眠记录刷新</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {simulatorStatus?.lastError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {simulatorStatus.lastError}
                  </div>
                ) : null}

                {simulatorStatus?.lastSummary ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">模拟时间 {new Date(simulatorStatus.lastSummary.simulatedAt).toLocaleString('zh-CN')}</Badge>
                      <Badge variant="outline">对象数 {simulatorStatus.lastSummary.personCount}</Badge>
                      <Badge variant="outline">告警数 {simulatorStatus.lastSummary.totalAlarms}</Badge>
                    </div>
                    <div className="space-y-3">
                      {simulatorStatus.lastSummary.summaries.map((item) => (
                        <div key={`${item.personId}-${item.personName}`} className="rounded-xl border p-4 bg-slate-50">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-medium">{item.personName}</p>
                              <p className="text-xs text-muted-foreground mt-1">场景: {item.scenario}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">告警 {item.alarmCount}</Badge>
                              <Badge variant="outline">血管评分 {item.vascularScore ?? '--'}</Badge>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 text-sm">
                            <div><span className="text-muted-foreground">心率</span><p className="font-medium">{item.metrics.heartRate} bpm</p></div>
                            <div><span className="text-muted-foreground">血氧</span><p className="font-medium">{item.metrics.bloodOxygen}%</p></div>
                            <div><span className="text-muted-foreground">体温</span><p className="font-medium">{item.metrics.bodyTemp}°C</p></div>
                            <div><span className="text-muted-foreground">血压</span><p className="font-medium">{item.metrics.bloodPressure}</p></div>
                            <div><span className="text-muted-foreground">步数</span><p className="font-medium">{item.metrics.steps}</p></div>
                          </div>
                          {item.exercise ? (
                            <div className="mt-3 rounded-lg border bg-white p-3 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">专项运动</span>
                                <Badge variant="outline">
                                  {simulatorExerciseTypeLabels[item.exercise.sportType]}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
                                <div><span className="text-muted-foreground">时长</span><p className="font-medium">{item.exercise.durationMin} 分钟</p></div>
                                <div><span className="text-muted-foreground">距离</span><p className="font-medium">{item.exercise.distanceKm.toFixed(2)} km</p></div>
                                <div><span className="text-muted-foreground">卡路里</span><p className="font-medium">{item.exercise.calories} kcal</p></div>
                                <div><span className="text-muted-foreground">配速</span><p className="font-medium">{item.exercise.paceMinPerKm.toFixed(2)} 分/km</p></div>
                                <div><span className="text-muted-foreground">暂停次数</span><p className="font-medium">{item.exercise.pauseCount}</p></div>
                              </div>
                            </div>
                          ) : null}
                          {item.sleep ? (
                            <div className="mt-3 rounded-lg border bg-white p-3 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">睡眠记录</span>
                                <Badge variant="outline">
                                  {item.sleep.status === 'completed' ? `评分 ${item.sleep.score ?? '--'}` : `${item.sleep.currentStage || '睡眠中'} ${item.sleep.progressPercent ?? 0}%`}
                                </Badge>
                              </div>
                              <p className="mt-1 font-medium">
                                时长 {Math.floor(item.sleep.durationMinutes / 60)}小时{item.sleep.durationMinutes % 60}分钟
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.sleep.status === 'completed'
                                  ? `会话已完成${item.sleep.reportGenerated ? '，报告已自动生成' : ''}`
                                  : `当前阶段：${item.sleep.currentStage || '--'}，进度 ${item.sleep.progressPercent ?? 0}%`}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">尚未执行模拟。点击上方“开始模拟”后，这里会显示最近一次推送结果。</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Database Tab */}
          <TabsContent value="database" className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Database className="h-4 w-4 text-blue-600" />
                      数据库配置
                    </CardTitle>
                    <CardDescription>选择使用内存 JSON 数据库或 MySQL 数据库，并支持数据迁移</CardDescription>
                  </div>
                  <Badge className={databaseConfig?.current_type === 'mysql' ? 'bg-blue-600' : 'bg-slate-500'}>
                    当前: {databaseConfig?.current_type === 'mysql' ? 'MySQL' : 'JSON'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 当前数据库状态 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {databaseConfig?.current_type === 'mysql' ? (
                        <Database className="h-5 w-5 text-blue-600" />
                      ) : (
                        <HardDrive className="h-5 w-5 text-amber-600" />
                      )}
                      <span className="font-medium">当前数据库</span>
                    </div>
                    <p className="text-lg font-semibold">
                      {databaseConfig?.current_type === 'mysql' ? 'MySQL' : 'JSON (内存数据库)'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {databaseConfig?.config.migrated 
                        ? `已迁移: ${databaseConfig.config.migrated_at ? new Date(databaseConfig.config.migrated_at).toLocaleString('zh-CN') : ''}`
                        : '使用默认数据库'}
                    </p>
                  </div>
                  
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-sm text-muted-foreground mb-2">MySQL 连接状态</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${databaseConfig?.mysql_configured ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className="font-medium">
                        {databaseConfig?.mysql_configured ? '已配置' : '未配置'}
                      </span>
                    </div>
                    {databaseConfig?.mysql_configured && (
                      <div className="mt-3 text-xs text-muted-foreground space-y-1">
                        <p>主机: {databaseConfig.env.MYSQL_HOST || '--'}</p>
                        <p>端口: {databaseConfig.env.MYSQL_PORT || '--'}</p>
                        <p>数据库: {databaseConfig.env.MYSQL_DATABASE || '--'}</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* 数据库选择 */}
                <div className="space-y-4">
                  <Label>选择数据库</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => void handleSwitchDatabase('json')}
                      disabled={databaseSaving || databaseConfig?.current_type === 'json'}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        databaseConfig?.current_type === 'json'
                          ? 'border-amber-500 bg-amber-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      } ${databaseSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-5 w-5 text-amber-600" />
                          <span className="font-medium">JSON 数据库</span>
                        </div>
                        {databaseConfig?.current_type === 'json' && (
                          <Badge className="bg-amber-600">当前使用</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        使用本地 JSON 文件存储，开发和测试方便，适合小规模部署
                      </p>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => void handleSwitchDatabase('mysql')}
                      disabled={databaseSaving || databaseConfig?.current_type === 'mysql' || !databaseConfig?.mysql_configured}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        databaseConfig?.current_type === 'mysql'
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      } ${databaseSaving || !databaseConfig?.mysql_configured ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <Database className="h-5 w-5 text-blue-600" />
                          <span className="font-medium">MySQL 数据库</span>
                        </div>
                        {databaseConfig?.current_type === 'mysql' && (
                          <Badge className="bg-blue-600">当前使用</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        使用 MySQL 数据库存储，适合生产环境和大规模部署
                      </p>
                      {!databaseConfig?.mysql_configured && (
                        <p className="text-xs text-red-600 mt-2">
                          请先在 .env 文件中配置 MySQL 连接信息
                        </p>
                      )}
                    </button>
                  </div>
                </div>
                
                {/* 数据迁移 */}
                {databaseConfig?.current_type === 'json' && databaseConfig?.mysql_configured && (
                  <div className="rounded-xl border bg-sky-50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">数据迁移</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          将 JSON 数据库中的现有数据迁移到 MySQL 数据库
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={handleMigrateData}
                        disabled={migrating}
                        className="bg-sky-600 hover:bg-sky-700"
                      >
                        {migrating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            迁移中...
                          </>
                        ) : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            迁移数据
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* 初始化脚本 */}
                <div className="rounded-xl border bg-slate-50 p-4">
                  <p className="font-medium mb-2">MySQL 初始化</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    如需使用 MySQL 数据库，请先运行初始化脚本创建数据库和表：
                  </p>
                  <div className="bg-slate-100 rounded-lg p-3 font-mono text-xs">
                    <p className="text-slate-700"># 在 MySQL 中执行以下脚本：</p>
                    <p className="text-blue-600">database/init_mysql_complete.sql</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    同时请确保在 .env 文件中配置了正确的 MySQL 连接信息。
                  </p>
                </div>
                
                {/* 操作按钮 */}
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={loadDatabaseConfig}
                    disabled={databaseLoading}
                  >
                    {databaseLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        刷新中...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        刷新状态
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
