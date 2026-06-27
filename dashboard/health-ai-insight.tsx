'use client';

/**
 * AI健康解读组件
 * 功能描述：
 * - 显示AI健康解读
 * - 大模型名称显示
 * - 刷新解读功能
 * - AI健康问答对话框
 * - 常用问题快捷按钮
 * - 支持结合/不结合健康数据回答
 * 
 * 关联页面：
 * - 管理员健康总览
 * - 用户健康总览
 * 
 * 关联API：
 * - POST /api/ai-health-overview
 * - POST /api/ai-health-chat
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Brain, Loader2, MessageSquare, RefreshCw, RotateCcw, SendHorizonal, ShieldAlert, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const AUTO_REFRESH_INTERVAL_MS = 3 * 60 * 1000;
const COMMON_QUESTIONS = [
  '我今天最需要优先关注哪项指标？',
  '结合当前数据，我今天适合运动吗？',
  '我的睡眠和心率情况说明了什么？',
  '如果想改善今天状态，最先该怎么做？',
];

/*AI健康洞察组件属性*/
interface HealthAiInsightProps {
  /** 人员基本信息 */
  person: {
    name: string;
    age?: number;
    gender?: string;
  } | null;
  /** 最新健康记录数据 */
  latestRecord: {
    heart_rate: number | null;
    blood_oxygen: number | null;
    body_temp: string | null;
    steps: number | null;
    recorded_at: string;
  } | null;
  /** 最新血压数据 */
  latestBloodPressure: {
    systolic_bp: number | null;
    diastolic_bp: number | null;
    recorded_at: string;
  } | null;
  /** 总步数统计 */
  totalSteps: number;
  /** 未确认报警数量 */
  unacknowledgedAlarmCount: number;
  /** 最新睡眠数据 */
  latestSleep: {
    score: number;
    start_time: string;
    end_time: string;
    deep_sleep_min: number;
    light_sleep_min: number;
    rem_sleep_min: number;
    awake_min: number;
    recorded_at: string;
  } | null;
  /** 健康指标阈值配置 */
  threshold: Record<string, unknown> | null;
  /** 压力数据 */
  stressData?: {
    stress_score?: number | null;
    stress_level?: string | null;
    mood_state?: string | null;
    autonomic_balance?: string | null;
    hrv_mean?: number | null;
    recorded_at?: string | null;
  } | null;
  /** 血管健康数据 */
  vascularData?: {
    health_score?: number | null;
    elasticity_level?: string | null;
    assessment_date?: string | null;
    recorded_at?: string | null;
  } | null;
  /** 首选AI模型名称 */
  preferredModel?: string | null;
}

/*AI健康洞察结果数据结构*/
interface HealthAiInsightResult {
  /** 健康总结文本 */
  summary: string;
  /** 风险关注点列表 */
  risks: string[];
  /** 健康建议列表 */
  suggestions: string[];
  /** 免责声明 */
  disclaimer: string;
}

/*聊天消息数据结构*/
interface ChatMessage {
  /** 消息唯一标识 */
  id: string;
  /** 消息角色：user（用户）或 assistant（AI助手） */
  role: 'user' | 'assistant';
  /** 消息内容 */
  content: string;
}

export function HealthAiInsight({
  person,
  latestRecord,
  latestBloodPressure,
  totalSteps,
  unacknowledgedAlarmCount,
  latestSleep,
  threshold,
  stressData,
  vascularData,
  preferredModel,
}: HealthAiInsightProps) {
  /*AI 解读和问答状态*/
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modelName, setModelName] = useState('');
  const [insight, setInsight] = useState<HealthAiInsightResult | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<number | null>(null);
  const [lastGeneratedKey, setLastGeneratedKey] = useState('');
  const [lastPersonName, setLastPersonName] = useState('');
  const [lastPreferredModel, setLastPreferredModel] = useState('');
  const [question, setQuestion] = useState('');
  const [chatError, setChatError] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [chatUseHealthData, setChatUseHealthData] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  /*汇总当前页面可提供给 AI 的健康数据*/
  const payload = useMemo(
    () => ({
      person,
      latestRecord,
      latestBloodPressure,
      totalSteps,
      unacknowledgedAlarmCount,
      latestSleep,
      threshold,
      stressData,
      vascularData,
    }),
    [latestBloodPressure, latestRecord, latestSleep, person, stressData, threshold, totalSteps, unacknowledgedAlarmCount, vascularData]
  );

  /*生成 AI 健康总览接口的请求体*/
  const requestBody = useMemo(
    () => ({
      data: payload,
      model: preferredModel || undefined,
    }),
    [payload, preferredModel]
  );

  /*生成当前数据版本的唯一标识*/
  const requestKey = useMemo(
    () =>
      JSON.stringify({
        personName: person?.name || '',
        latestRecordedAt: latestRecord?.recorded_at || '',
        latestBpAt: latestBloodPressure?.recorded_at || '',
        sleepAt: latestSleep?.recorded_at || '',
        alarmCount: unacknowledgedAlarmCount,
        stressAt: stressData?.recorded_at || '',
        vascularAt: vascularData?.assessment_date || vascularData?.recorded_at || '',
        preferredModel: preferredModel || '',
      }),
    [latestBloodPressure?.recorded_at, latestRecord?.recorded_at, latestSleep?.recorded_at, person?.name, preferredModel, stressData?.recorded_at, unacknowledgedAlarmCount, vascularData?.assessment_date, vascularData?.recorded_at]
  );

  /**
   * 请求AI生成健康总览解读
   * 功能：
   * - 调用AI健康总览API生成健康解读
   * - 处理加载状态和错误状态
   * - 更新AI解读结果和模型信息
   * - 记录生成时间和数据版本
   * @param {boolean} showLoading - 是否显示加载状态
   * @returns {Promise<void>}
   */

  //刷新解读
  async function loadInsight(showLoading = true) {
    if (!person?.name) {
      return;
    }

    if (showLoading) {
      setLoading(true);
    }
    setError('');

    try {
      const response = await fetch('/api/ai-health-overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'AI 解读生成失败');
      }

      setInsight(result.insight);
      setModelName(result.model || '');
      setLastGeneratedAt(Date.now());
      setLastGeneratedKey(requestKey);
      setLastPersonName(person?.name || '');
      setLastPreferredModel(preferredModel || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 解读生成失败');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }

  /*根据人员、模型和数据变化自动刷新 AI 解读*/
  useEffect(() => {
    if (!person?.name) {
      return;
    }

    const personChanged = lastPersonName !== '' && lastPersonName !== person.name;
    const modelChanged = lastPreferredModel !== (preferredModel || '');
    const shouldLoadImmediately = !insight || personChanged || modelChanged;
    const hasNewData = requestKey !== lastGeneratedKey;
    const reachedCooldown = lastGeneratedAt === null || Date.now() - lastGeneratedAt >= AUTO_REFRESH_INTERVAL_MS;

    if (shouldLoadImmediately) {
      void loadInsight(true);
      return;
    }

    if (hasNewData && reachedCooldown) {
      void loadInsight(false);
    }
  }, [insight, lastGeneratedAt, lastGeneratedKey, lastPersonName, lastPreferredModel, person?.name, preferredModel, requestKey]);

  /*切换人员后重置问答输入和历史消息*/
  useEffect(() => {
    setQuestion('');
    setChatError('');
    setChatMessages([]);
  }, [person?.name]);

  /*问答弹窗打开后自动滚动到底部*/
  useEffect(() => {
    if (!dialogOpen) {
      return;
    }

    const timer = window.requestAnimationFrame(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });

    return () => {
      window.cancelAnimationFrame(timer);
    };
  }, [chatLoading, chatMessages, dialogOpen]);

  /**
   * 清空问答记录和输入内容
   * 功能：
   * - 清空聊天消息历史
   * - 重置问题输入框
   * - 清除聊天错误信息
   * - 在聊天加载时阻止操作
   */
  function clearChat() {
    if (chatLoading) {
      return;
    }

    setQuestion('');
    setChatError('');
    setChatMessages([]);
  }

  /**
   * 向AI聊天接口发送问题并追加回答
   * 功能：
   * - 发送用户问题到AI健康聊天API
   * - 支持结合健康数据或普通问答模式
   * @param {string} nextQuestion - 用户输入的问题
   * @returns {Promise<void>}
   */
  async function askQuestion(nextQuestion: string) {
    const trimmedQuestion = nextQuestion.trim();

    if (!trimmedQuestion || chatLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: trimmedQuestion,
    };

    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);
    setQuestion('');
    setChatError('');
    setChatLoading(true);

    try {
      const response = await fetch('/api/ai-health-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: chatUseHealthData ? payload : undefined,
          model: preferredModel || undefined,
          question: trimmedQuestion,
          useHealthData: chatUseHealthData,
          history: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'AI 问答失败');
      }

      setModelName(result.model || modelName);
      setChatMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          content: result.answer || '当前暂时无法生成回答，请稍后重试。',
        },
      ]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'AI 问答失败');
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <Card className="border-violet-100 bg-gradient-to-r from-violet-50/80 via-white to-cyan-50/80">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-violet-600" />
              健康总览 AI 解读
            </CardTitle>
            <CardDescription className="mt-1">
              生成今日健康总结、关注重点和管理建议。
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {modelName ? (
              <Badge variant="outline" className="border-violet-200 bg-white text-violet-700">
                {modelName}
              </Badge>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => void loadInsight(true)} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              刷新解读
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !insight ? (
          <div className="flex items-center gap-2 rounded-xl border bg-white/80 px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在调用本地模型生成健康解读...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {error}
          </div>
        ) : insight ? (
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr_0.85fr]">
            <div className="rounded-xl border bg-white/80 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Sparkles className="h-4 w-4 text-violet-500" />
                总体判断
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{insight.summary}</p>
            </div>

            <div className="rounded-xl border bg-white/80 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                重点关注
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {insight.risks.length > 0 ? (
                  insight.risks.map((item, index) => (
                    <li key={`${item}-${index}`} className="flex gap-2">
                      <span className="text-amber-500">•</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-muted-foreground">当前没有明显异常风险。</li>
                )}
              </ul>
            </div>

            <div className="rounded-xl border bg-white/80 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <RefreshCw className="h-4 w-4 text-emerald-500" />
                今日建议
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {insight.suggestions.length > 0 ? (
                  insight.suggestions.map((item, index) => (
                    <li key={`${item}-${index}`} className="flex gap-2">
                      <span className="text-emerald-500">•</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-muted-foreground">继续保持当前的健康管理节奏。</li>
                )}
              </ul>
            </div>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          {insight?.disclaimer || '以上内容仅供健康管理参考，不替代医生诊断。'}
        </p>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-white/80 p-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <MessageSquare className="h-4 w-4 text-violet-500" />
              健康问答
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" className="bg-violet-600 hover:bg-violet-700">
                <MessageSquare className="mr-2 h-4 w-4" />
                打开健康问答
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[min(92vw,880px)] max-w-[880px] p-0 sm:max-w-[880px]">
              <DialogHeader className="border-b px-6 py-4">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4 text-violet-500" />
                  健康问答
                </DialogTitle>
                <DialogDescription>
                  你可以直接普通提问，也可以打开“请根据我今日的健康数据回答”后再结合当前总览数据问答。
                </DialogDescription>
              </DialogHeader>

              <div className="flex max-h-[78vh] flex-col">
                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
                  {chatMessages.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-muted-foreground">
                      还没有提问记录，先试试下面的常用问题，或直接输入你关心的健康问题。
                    </div>
                  ) : (
                    chatMessages.map((message) => (
                      <div
                        key={message.id}
                        className={message.role === 'assistant'
                          ? 'rounded-2xl border border-violet-100 bg-violet-50/70 p-4'
                          : 'rounded-2xl border border-slate-200 bg-white p-4'}
                      >
                        <div className="mb-2 text-xs font-medium text-slate-500">
                          {message.role === 'assistant' ? 'AI 解答' : '我的提问'}
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.content}</p>
                      </div>
                    ))
                  )}

                  {chatLoading ? (
                    <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-sm text-slate-700">
                      <div className="mb-2 text-xs font-medium text-slate-500">AI 解答</div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {chatUseHealthData ? '正在结合当前健康数据生成回答...' : '正在生成回答...'}
                      </div>
                    </div>
                  ) : null}
                  <div ref={chatBottomRef} />
                </div>

                <div className="border-t bg-slate-50/70 px-6 py-4">
                  <div className="flex items-start justify-between gap-4 rounded-xl border bg-white px-4 py-3">
                    <div className="space-y-1">
                      <Label htmlFor="chat-use-health-data">请根据我今日的健康数据回答：</Label>
                      <p className="text-xs text-muted-foreground">
                        关闭时为普通 AI 问答；打开后才会结合今日健康总览中的指标、睡眠和风险信息回答。
                      </p>
                    </div>
                    <Switch
                      id="chat-use-health-data"
                      checked={chatUseHealthData}
                      onCheckedChange={setChatUseHealthData}
                      disabled={chatLoading}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {COMMON_QUESTIONS.map((item) => (
                      <Button
                        key={item}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto whitespace-normal rounded-full bg-white px-3 py-1.5 text-left"
                        disabled={chatLoading}
                        onClick={() => void askQuestion(item)}
                      >
                        {item}
                      </Button>
                    ))}
                  </div>

                  {chatError ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      {chatError}
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-3 rounded-2xl border bg-white p-3">
                    <Textarea
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      placeholder={chatUseHealthData ? '例如：请根据我今天的数据，最该注意什么？' : '例如：你好；你能帮我做什么；最近适合怎么减脂？'}
                      className="min-h-24 resize-none border-slate-200 bg-white"
                      disabled={chatLoading}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        {chatUseHealthData ? '' : ''}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" onClick={clearChat} disabled={chatLoading || (chatMessages.length === 0 && !question && !chatError)}>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          清空对话
                        </Button>
                        <Button
                          type="button"
                          onClick={() => void askQuestion(question)}
                          disabled={chatLoading || !question.trim()}
                          className="bg-violet-600 hover:bg-violet-700"
                        >
                          {chatLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SendHorizonal className="mr-2 h-4 w-4" />}
                          发送问题
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
