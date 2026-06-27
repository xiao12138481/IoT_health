'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Bell, Battery, Link2, RefreshCw, User, Watch, Wifi, WifiOff } from 'lucide-react';
import { useApp } from '@/components/layout/app-provider';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DeviceStats {
  health_record_count: number;
  alarm_count: number;
  unacknowledged_alarm_count: number;
  latest_health_record_at: string | null;
  latest_alarm_at: string | null;
}

interface HealthRecord {
  id: number;
  heart_rate: number | null;
  blood_oxygen: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  body_temp: number | null;
  steps: number | null;
  recorded_at: string;
}

interface AlarmRecord {
  id: number;
  alarm_type: string;
  alarm_level: string;
  message: string;
  is_acknowledged: boolean;
  created_at: string;
}

interface DeviceDetail {
  id: number;
  name: string;
  model: string;
  firmware_version: string | null;
  battery_level: number;
  status: string;
  last_sync_at: string | null;
  person_id: number | null;
  person_name: string | null;
  monitored_persons: { name: string } | null;
  stats: DeviceStats;
  recent_health_records: HealthRecord[];
  recent_alarms: AlarmRecord[];
  health_pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
  alarm_pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

function formatDateTime(value: string | null) {
  if (!value) return '--';
  return new Date(value).toLocaleString('zh-CN');
}

function formatMetric(record: HealthRecord) {
  const segments = [];
  if (record.heart_rate !== null) segments.push(`心率 ${record.heart_rate} bpm`);
  if (record.blood_oxygen !== null) segments.push(`血氧 ${record.blood_oxygen}%`);
  if (record.systolic_bp !== null && record.diastolic_bp !== null) segments.push(`血压 ${record.systolic_bp}/${record.diastolic_bp}`);
  if (record.body_temp !== null) segments.push(`体温 ${record.body_temp}°C`);
  if (record.steps !== null) segments.push(`步数 ${record.steps}`);
  return segments.length > 0 ? segments.join(' / ') : '无指标数据';
}

export default function DeviceDetailPage() {
  /*路由参数、分页和设备详情状态*/
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { persons, currentPersonId, setCurrentPersonId, alarmCount } = useApp();
  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthPage, setHealthPage] = useState(1);
  const [alarmPage, setAlarmPage] = useState(1);

  /*按设备编号加载详情、健康记录和报警数据*/
  const loadDevice = async () => {
    setLoading(true);
    setError(null);

    try {
      const paramsQuery = new URLSearchParams({
        id: String(params.id),
        health_page: String(healthPage),
        health_page_size: '5',
        alarm_page: String(alarmPage),
        alarm_page_size: '5',
      });
      const res = await fetch(`/api/devices?${paramsQuery.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '获取设备详情失败');
      }

      setDevice(data.device || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取设备详情失败');
      setDevice(null);
    } finally {
      setLoading(false);
    }
  };

  /*设备编号或分页变化后重新加载详情*/
  useEffect(() => {
    if (params.id) {
      void loadDevice();
    }
  }, [params.id, healthPage, alarmPage]);

  return (
    <div className="flex flex-col">
      <Header
        persons={persons.map((p) => ({ id: p.id, name: p.name }))}
        currentPersonId={currentPersonId}
        onPersonChange={setCurrentPersonId}
        alarmCount={alarmCount}
      />

      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2">
              <Button variant="outline" size="sm" onClick={() => router.push('/devices-page')}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> 返回设备管理
              </Button>
            </div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <Watch className="h-7 w-7 text-teal-600" /> 设备详情
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">查看设备基础信息、关联历史记录和报警情况。</p>
          </div>
          <Button variant="outline" onClick={() => void loadDevice()}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> 刷新页面
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center text-red-600">{error}</CardContent>
          </Card>
        ) : !device ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">未找到该设备。</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100">
                      <Watch className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{device.name}</p>
                      <p className="text-xs text-muted-foreground">{device.model}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${device.status === 'online' ? 'bg-green-100' : 'bg-red-100'}`}>
                      {device.status === 'online' ? <Wifi className="h-5 w-5 text-green-600" /> : <WifiOff className="h-5 w-5 text-red-600" />}
                    </div>
                    <div>
                      <p className="text-lg font-bold">{device.status === 'online' ? '在线' : '离线'}</p>
                      <p className="text-xs text-muted-foreground">最后同步 {formatDateTime(device.last_sync_at)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
                      <Battery className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{device.battery_level}%</p>
                      <p className="text-xs text-muted-foreground">当前电量</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                      <Bell className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{device.stats.unacknowledged_alarm_count}</p>
                      <p className="text-xs text-muted-foreground">未处理报警</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>基础信息</CardTitle>
                  <CardDescription>设备身份信息与当前关联状态</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex items-center justify-between border-b pb-3">
                    <span className="text-muted-foreground">设备名称</span>
                    <span className="font-medium">{device.name}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-3">
                    <span className="text-muted-foreground">设备型号</span>
                    <span className="font-medium">{device.model}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-3">
                    <span className="text-muted-foreground">固件版本</span>
                    <span className="font-medium">{device.firmware_version || '--'}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>绑定人员</span>
                    </div>
                    <span className="font-medium">{device.monitored_persons?.name || device.person_name || '未绑定'}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Link2 className="h-4 w-4" />
                      <span>关联历史记录</span>
                    </div>
                    <span className="font-medium">{device.stats.health_record_count} 条</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-3">
                    <span className="text-muted-foreground">关联报警</span>
                    <span className="font-medium">{device.stats.alarm_count} 条</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">最近报警时间</span>
                    <span className="font-medium">{formatDateTime(device.stats.latest_alarm_at)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>统计概览</CardTitle>
                  <CardDescription>设备关联数据的数量统计</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 text-sm">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-muted-foreground">历史记录总数</p>
                    <p className="mt-2 text-2xl font-bold">{device.stats.health_record_count}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-muted-foreground">报警总数</p>
                    <p className="mt-2 text-2xl font-bold">{device.stats.alarm_count}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-muted-foreground">最近历史时间</p>
                    <p className="mt-2 font-medium">{formatDateTime(device.stats.latest_health_record_at)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>最近健康记录</CardTitle>
                  <CardDescription>按页查看该设备写入的健康记录</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {device.recent_health_records.length === 0 ? (
                    <div className="py-6 text-sm text-muted-foreground">暂无关联健康记录</div>
                  ) : (
                    device.recent_health_records.map((record) => (
                      <div key={record.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="mb-2 text-xs text-muted-foreground">{formatDateTime(record.recorded_at)}</div>
                        <div className="text-sm">{formatMetric(record)}</div>
                      </div>
                    ))
                  )}
                  <div className="flex items-center justify-between border-t pt-3 text-sm">
                    <span className="text-muted-foreground">
                      第 {device.health_pagination.page} / {device.health_pagination.total_pages} 页，共 {device.health_pagination.total} 条
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={device.health_pagination.page <= 1}
                        onClick={() => setHealthPage((prev) => Math.max(1, prev - 1))}
                      >
                        上一页
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={device.health_pagination.page >= device.health_pagination.total_pages}
                        onClick={() => setHealthPage((prev) => Math.min(device.health_pagination.total_pages, prev + 1))}
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>最近报警</CardTitle>
                  <CardDescription>按页查看该设备触发的报警记录</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {device.recent_alarms.length === 0 ? (
                    <div className="py-6 text-sm text-muted-foreground">暂无关联报警</div>
                  ) : (
                    device.recent_alarms.map((alarm) => (
                      <div key={alarm.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <Badge
                            variant="outline"
                            className={alarm.is_acknowledged ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-red-200 bg-red-50 text-red-700'}
                          >
                            {alarm.is_acknowledged ? '已处理' : '未处理'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{formatDateTime(alarm.created_at)}</span>
                        </div>
                        <div className="text-sm font-medium">{alarm.message}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{alarm.alarm_type} / {alarm.alarm_level}</div>
                      </div>
                    ))
                  )}
                  <div className="flex items-center justify-between border-t pt-3 text-sm">
                    <span className="text-muted-foreground">
                      第 {device.alarm_pagination.page} / {device.alarm_pagination.total_pages} 页，共 {device.alarm_pagination.total} 条
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={device.alarm_pagination.page <= 1}
                        onClick={() => setAlarmPage((prev) => Math.max(1, prev - 1))}
                      >
                        上一页
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={device.alarm_pagination.page >= device.alarm_pagination.total_pages}
                        onClick={() => setAlarmPage((prev) => Math.min(device.alarm_pagination.total_pages, prev + 1))}
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
