'use client';

/**
 * 用户设置页面
 * 功能描述：
 * - 查看和修改个人资料
 * - 修改登录密码
 * - 设置个人健康监测阈值
 */

import { useEffect, useState } from 'react';
import { useApp } from '@/components/layout/app-provider';
import { UserHeader } from '@/components/layout/user-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings, User, Lock, Save, CheckCircle2, Shield, RotateCcw, Brain, Loader2 } from 'lucide-react';

/**
 * 健康阈值配置数据结构
 * 用于设置触发报警的各项健康指标阈值
 */
interface ThresholdData {
  /** 配置ID */
  id: number;
  /** 所属人员ID */
  person_id: number;
  /** 心率最低值 */
  heart_rate_min: number;
  /** 心率最高值 */
  heart_rate_max: number;
  /** 血氧最低值 */
  blood_oxygen_min: number;
  /** 体温最高值 */
  body_temp_max: string;
  /** 体温最低值 */
  body_temp_min: string;
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
}

/**
 * 人员基本信息数据结构
 */
interface PersonData {
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
  /** 紧急联系人姓名 */
  emergency_contact: string;
  /** 紧急联系电话 */
  emergency_phone: string;
}

/**
 * 用户个人资料数据结构
 * 用于用户信息编辑表单
 */
interface ProfileData {
  /** 登录用户名 */
  username: string;
  /** 电子邮箱（可选） */
  email?: string;
  /** 姓名 */
  name: string;
  /** 年龄 */
  age: number;
  /** 性别 */
  gender: string;
  /** 联系电话 */
  phone: string;
  /** 紧急联系人姓名 */
  emergency_contact: string;
  /** 紧急联系电话 */
  emergency_phone: string;
}

/**
 * AI模型状态数据结构
 * 描述Ollama服务连接状态和可用模型
 */
interface AiModelStatus {
  /** 是否已连接到Ollama服务 */
  connected: boolean;
  /** Ollama服务地址 */
  host: string;
  /** 当前使用的模型 */
  currentModel: string;
  /** 可用的模型列表 */
  availableModels: string[];
  /** 错误信息（可选） */
  error?: string;
}

const USER_AI_MODEL_STORAGE_KEY = 'user-ai-model';

export default function UserSettingsPage() {
  const { currentPersonId } = useApp();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Profile form
  const [profileForm, setProfileForm] = useState<ProfileData>({
    username: '',
    email: '',
    name: '',
    age: 0,
    gender: '',
    phone: '',
    emergency_contact: '',
    emergency_phone: '',
  });

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Threshold form
  const [threshold, setThreshold] = useState<ThresholdData | null>(null);
  const [person, setPerson] = useState<PersonData | null>(null);
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [thresholdSaved, setThresholdSaved] = useState(false);
  const [aiModelStatus, setAiModelStatus] = useState<AiModelStatus | null>(null);
  const [selectedAiModel, setSelectedAiModel] = useState('');
  const [aiModelsLoading, setAiModelsLoading] = useState(false);
  const [aiModelSaving, setAiModelSaving] = useState(false);
  /*健康阈值表单状态*/
  const [thresholdForm, setThresholdForm] = useState({
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

  /*生成当前用户专属的 AI 模型缓存键名*/
  const getUserAiModelStorageKey = (personId: number) => `${USER_AI_MODEL_STORAGE_KEY}:${personId}`;

  /*加载用户资料、阈值配置和账号信息*/
  useEffect(() => {
    if (!currentPersonId) return;
    async function loadSettings() {
      try {
        /*并行请求阈值、总览和人员列表数据*/
        const [thRes, pRes, usersRes] = await Promise.all([
          fetch(`/api/thresholds?person_id=${currentPersonId}`),
          fetch(`/api/dashboard?person_id=${currentPersonId}`),
          fetch('/api/persons'),
        ]);
        const thData = await thRes.json();
        const pData = await pRes.json();
        const usersData = await usersRes.json();

        /*匹配当前登录用户对应的账号信息*/
        const currentUser = usersData.persons?.find((p: any) => p.id === currentPersonId);

        /*回填个人资料表单*/
        if (pData.person) {
          setPerson(pData.person);
          setProfileForm({
            username: currentUser?.account_username || 'user',
            email: currentUser?.email || '',
            name: pData.person.name || '',
            age: pData.person.age || 0,
            gender: pData.person.gender || '',
            phone: pData.person.phone || '',
            emergency_contact: pData.person.emergency_contact || '',
            emergency_phone: pData.person.emergency_phone || '',
          });
        }
        
        if (thData.threshold) {
          setThreshold(thData.threshold);
          setThresholdForm({
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
      } catch (error) {
        console.error('加载设置失败:', error);
      }
    }
    loadSettings();
  }, [currentPersonId]);

  /*加载 AI 模型列表并恢复用户上次选择*/
  useEffect(() => {
    if (!currentPersonId) {
      return;
    }

    const loadAiModels = async () => {
      setAiModelsLoading(true);
      try {
        const response = await fetch('/api/ai-models');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || '加载 AI 模型列表失败');
        }

        const storageKey = getUserAiModelStorageKey(currentPersonId);
        const savedModel = window.localStorage.getItem(storageKey);
        const nextSelectedModel =
          savedModel && data.availableModels.includes(savedModel)
            ? savedModel
            : data.currentModel || data.availableModels[0] || '';

        if (savedModel && !data.availableModels.includes(savedModel)) {
          window.localStorage.removeItem(storageKey);
        }

        setAiModelStatus(data);
        setSelectedAiModel(nextSelectedModel);
      } catch (loadError) {
        setAiModelStatus({
          connected: false,
          host: 'http://127.0.0.1:11434',
          currentModel: '',
          availableModels: [],
          error: loadError instanceof Error ? loadError.message : '加载 AI 模型列表失败',
        });
        setSelectedAiModel('');
      } finally {
        setAiModelsLoading(false);
      }
    };

    void loadAiModels();
  }, [currentPersonId]);

  /*保存个人资料表单*/
  const handleSaveProfile = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!currentPersonId) {
        throw new Error('未找到当前用户');
      }

      /*先读取当前账号数据，避免更新资料时覆盖密码*/
      const usersResponse = await fetch('/api/persons');
      const usersData = await usersResponse.json();
      const currentUser = usersData.persons?.find((p: any) => p.id === currentPersonId);
      
      const updateData = {
        name: profileForm.name,
        age: profileForm.age,
        gender: profileForm.gender,
        phone: profileForm.phone,
        emergency_contact: profileForm.emergency_contact,
        emergency_phone: profileForm.emergency_phone,
        account_username: profileForm.username,
        account_password: currentUser?.account_password || 'password123', // 保持现有密码
        status: 'active'
      };

      /*调用人员接口保存资料*/
      const response = await fetch(`/api/persons?id=${currentPersonId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '保存失败');
      }

      setSuccess('个人资料已保存');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.message || '保存失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  /*校验并修改当前用户密码*/
  const handleChangePassword = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    /*先校验密码表单是否填写完整*/
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setError('请填写所有字段');
      setLoading(false);
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('两次输入的新密码不一致');
      setLoading(false);
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setError('新密码长度至少6位');
      setLoading(false);
      return;
    }

    try {
      if (!currentPersonId) {
        throw new Error('未找到当前用户');
      }

      // First, verify current password by trying to login
      const loginResponse = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: profileForm.username,
          password: passwordForm.currentPassword,
        }),
      });

      if (!loginResponse.ok) {
        throw new Error('当前密码不正确');
      }

      // Prepare data for persons API to update password
      const updateData = {
        name: profileForm.name,
        age: profileForm.age,
        gender: profileForm.gender,
        phone: profileForm.phone,
        emergency_contact: profileForm.emergency_contact,
        emergency_phone: profileForm.emergency_phone,
        account_username: profileForm.username,
        account_password: passwordForm.newPassword, // 更新为新密码
        status: 'active'
      };

      // Call persons API to update password
      const response = await fetch(`/api/persons?id=${currentPersonId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '密码修改失败');
      }

      // Reset form
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      setSuccess('密码修改成功');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.message || '修改失败，请检查当前密码是否正确');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 保存健康阈值配置
   * 功能：
   * - 调用API更新用户的健康报警阈值
   * - 显示保存成功状态
   */
  const handleSaveThresholds = async () => {
    setThresholdSaving(true);
    setThresholdSaved(false);
    try {
      await fetch('/api/thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: currentPersonId, ...thresholdForm }),
      });
      setThresholdSaved(true);
      setTimeout(() => setThresholdSaved(false), 3000);
    } catch { /* */ } finally { setThresholdSaving(false); }
  };

  /**
   * 重置阈值配置
   * 功能：
   * - 恢复到加载时的原始阈值
   * - 清空用户所做的修改
   */
  const handleResetThresholds = () => {
    if (threshold) {
      setThresholdForm({
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

  /**
   * 保存用户选择的AI模型
   * 功能：
   * - 验证模型选择的有效性
   * - 将用户选择的模型保存到localStorage
   * - 显示成功提示
   */
  const handleSaveAiModel = async () => {
    if (!currentPersonId) {
      setError('未找到当前用户');
      return;
    }

    if (!selectedAiModel) {
      setError('请先选择一个本地模型');
      return;
    }

    if (!(aiModelStatus?.availableModels || []).includes(selectedAiModel)) {
      setError('当前模型不可用，请重新选择');
      return;
    }

    setAiModelSaving(true);
    setError(null);
    setSuccess(null);

    try {
      window.localStorage.setItem(getUserAiModelStorageKey(currentPersonId), selectedAiModel);
      setSuccess('用户端 AI 模型已保存，健康总览将优先使用该模型进行解读');
      setTimeout(() => setSuccess(null), 3000);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存用户端 AI 模型失败');
    } finally {
      setAiModelSaving(false);
    }
  };

  /**
   * 重置AI模型选择
   * 功能：
   * - 删除localStorage中保存的模型选择
   * - 恢复使用系统默认模型
   * - 显示成功提示
   */
  const handleResetAiModel = () => {
    if (!currentPersonId) {
      return;
    }

    const defaultModel = aiModelStatus?.currentModel || aiModelStatus?.availableModels[0] || '';
    window.localStorage.removeItem(getUserAiModelStorageKey(currentPersonId));
    setSelectedAiModel(defaultModel);
    setSuccess('已恢复为跟随系统默认模型');
    setTimeout(() => setSuccess(null), 3000);
  };

  return (
    <div className="flex flex-col">
      <UserHeader />

      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="h-7 w-7 text-slate-600" /> 用户设置
          </h2>
          <p className="text-sm text-muted-foreground mt-1">管理您的账户信息、安全设置和健康监测阈值</p>
        </div>

        {/* Success/Error alerts */}
        {success && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="bg-red-50 border-red-200">
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" /> 个人资料
            </TabsTrigger>
            <TabsTrigger value="thresholds" className="gap-2">
              <Shield className="h-4 w-4" /> 阈值设置
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Lock className="h-4 w-4" /> 安全设置
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Brain className="h-4 w-4" /> AI 设置
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">基本信息</CardTitle>
                <CardDescription>查看和编辑您的个人基本信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">用户名</Label>
                    <Input
                      id="username"
                      value={profileForm.username}
                      onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">电子邮箱</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">姓名</Label>
                    <Input
                      id="name"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="age">年龄</Label>
                    <Input
                      id="age"
                      type="number"
                      value={profileForm.age}
                      onChange={(e) => setProfileForm({ ...profileForm, age: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">性别</Label>
                    <Input
                      id="gender"
                      value={profileForm.gender}
                      onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">联系电话</Label>
                    <Input
                      id="phone"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact">紧急联系人</Label>
                    <Input
                      id="emergency_contact"
                      value={profileForm.emergency_contact}
                      onChange={(e) => setProfileForm({ ...profileForm, emergency_contact: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergency_phone">紧急联系电话</Label>
                    <Input
                      id="emergency_phone"
                      value={profileForm.emergency_phone}
                      onChange={(e) => setProfileForm({ ...profileForm, emergency_phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={loading}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {loading ? '保存中...' : '保存修改'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

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
                      value={thresholdForm.heart_rate_min}
                      onChange={(e) => setThresholdForm({ ...thresholdForm, heart_rate_min: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hr-max">最高心率 (bpm)</Label>
                    <Input
                      id="hr-max"
                      type="number"
                      value={thresholdForm.heart_rate_max}
                      onChange={(e) => setThresholdForm({ ...thresholdForm, heart_rate_max: parseInt(e.target.value) || 0 })}
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
                      value={thresholdForm.blood_oxygen_min}
                      onChange={(e) => setThresholdForm({ ...thresholdForm, blood_oxygen_min: parseInt(e.target.value) || 0 })}
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
                      value={thresholdForm.body_temp_min}
                      onChange={(e) => setThresholdForm({ ...thresholdForm, body_temp_min: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="temp-max">最高体温 (°C)</Label>
                    <Input
                      id="temp-max"
                      type="number"
                      step="0.1"
                      value={thresholdForm.body_temp_max}
                      onChange={(e) => setThresholdForm({ ...thresholdForm, body_temp_max: e.target.value })}
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
                      value={thresholdForm.systolic_bp_min}
                      onChange={(e) => setThresholdForm({ ...thresholdForm, systolic_bp_min: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="systolic-max">最高收缩压 (mmHg)</Label>
                    <Input
                      id="systolic-max"
                      type="number"
                      value={thresholdForm.systolic_bp_max}
                      onChange={(e) => setThresholdForm({ ...thresholdForm, systolic_bp_max: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="diastolic-min">最低舒张压 (mmHg)</Label>
                    <Input
                      id="diastolic-min"
                      type="number"
                      value={thresholdForm.diastolic_bp_min}
                      onChange={(e) => setThresholdForm({ ...thresholdForm, diastolic_bp_min: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="diastolic-max">最高舒张压 (mmHg)</Label>
                    <Input
                      id="diastolic-max"
                      type="number"
                      value={thresholdForm.diastolic_bp_max}
                      onChange={(e) => setThresholdForm({ ...thresholdForm, diastolic_bp_max: parseInt(e.target.value) || 0 })}
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
                      value={thresholdForm.steps_goal}
                      onChange={(e) => setThresholdForm({ ...thresholdForm, steps_goal: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sleep-goal">每日睡眠目标 (分钟)</Label>
                    <Input
                      id="sleep-goal"
                      type="number"
                      value={thresholdForm.sleep_goal_min}
                      onChange={(e) => setThresholdForm({ ...thresholdForm, sleep_goal_min: parseInt(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">{Math.floor(thresholdForm.sleep_goal_min / 60)}小时{thresholdForm.sleep_goal_min % 60}分钟</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Save buttons */}
            <div className="flex items-center gap-3">
              <Button onClick={handleSaveThresholds} disabled={thresholdSaving} className="bg-teal-600 hover:bg-teal-700">
                <Save className="h-4 w-4 mr-2" />
                {thresholdSaving ? '保存中...' : thresholdSaved ? '已保存' : '保存配置'}
              </Button>
              <Button variant="outline" onClick={handleResetThresholds}>
                <RotateCcw className="h-4 w-4 mr-2" /> 重置
              </Button>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">修改密码</CardTitle>
                <CardDescription>定期更换密码可以提高账户安全性</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">当前密码</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      placeholder="请输入当前密码"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-password">新密码</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      placeholder="请输入新密码（至少6位）"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">确认新密码</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      placeholder="请再次输入新密码"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={handleChangePassword}
                    disabled={loading}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    {loading ? '修改中...' : '修改密码'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">账户安全提示</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>• 请使用复杂密码，包含大小写字母、数字和特殊字符</p>
                <p>• 不要在多个平台使用相同的密码</p>
                <p>• 建议每3-6个月更换一次密码</p>
                <p>• 如果发现账户异常，请立即修改密码并联系管理员</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Brain className="h-4 w-4 text-violet-600" />
                      用户端 AI 模型
                    </CardTitle>
                    <CardDescription>仅影响当前用户健康总览中的 AI 解读，不会修改管理员后台的全局模型</CardDescription>
                  </div>
                  <Badge className={aiModelStatus?.connected ? 'bg-emerald-600' : 'bg-slate-500'}>
                    {aiModelStatus?.connected ? 'Ollama 已连接' : '未连接'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-xs text-muted-foreground">服务地址</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{aiModelStatus?.host || 'http://127.0.0.1:11434'}</p>
                  </div>
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-xs text-muted-foreground">系统默认模型</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{aiModelStatus?.currentModel || '未设置'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-ai-model">当前用户专属模型</Label>
                  <Select
                    value={selectedAiModel}
                    onValueChange={setSelectedAiModel}
                    disabled={aiModelsLoading || (aiModelStatus?.availableModels.length ?? 0) === 0}
                  >
                    <SelectTrigger id="user-ai-model" className="w-full bg-white">
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
                  <p className="text-xs text-muted-foreground">
                    保存后，用户端健康总览中的 AI 解读会优先使用这里选择的模型；未设置时跟随系统默认模型。
                  </p>
                </div>

                {aiModelStatus?.error ? (
                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertDescription className="text-amber-700">{aiModelStatus.error}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleSaveAiModel}
                    disabled={aiModelSaving || aiModelsLoading || !selectedAiModel}
                    className="bg-violet-600 hover:bg-violet-700"
                  >
                    {aiModelSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {aiModelSaving ? '保存中...' : '保存模型'}
                  </Button>
                  <Button variant="outline" onClick={handleResetAiModel} disabled={aiModelsLoading}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    恢复默认
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
