'use client';

/**
 * 用户设备管理页面
 * 功能描述：
 * - 查看当前用户绑定的设备
 * - 支持添加、编辑、删除设备功能
 * - 支持设备上线/下线状态切换
 * - 使用 UserHeader，无人员切换功能
 */

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/layout/app-provider';
import { UserHeader } from '@/components/layout/user-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Watch, Wifi, WifiOff, Battery, RefreshCw, User, Link2, Search, Plus, Trash2, Pencil } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/*设备统计信息数据类型*/
interface DeviceStats {
  health_record_count: number;
  alarm_count: number;
  unacknowledged_alarm_count: number;
  latest_health_record_at: string | null;
  latest_alarm_at: string | null;
}

/*设备数据类型*/
interface Device {
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
}

/*设备表单状态数据类型*/
interface DeviceFormState {
  name: string;
  model: string;
  firmware_version: string;
  battery_level: string;
  status: 'online' | 'offline';
}

/*表单初始状态*/
const initialFormState: DeviceFormState = {
  name: '',
  model: '',
  firmware_version: '',
  battery_level: '100',
  status: 'offline',
};

/**
 * 格式化短日期时间显示
 * 功能：
 * - 将ISO格式的日期时间字符串转换为"MM/DD HH:mm"格式
 * - 处理空值情况，返回"--"占位符
 * - 使用中文区域设置，确保月份和日期格式符合中文习惯
 * - 示例："2024-06-24T14:30:00Z" → "06/24 14:30"
 * @param {string | null} value - ISO格式的日期时间字符串或null
 * @returns {string} 格式化后的短日期时间字符串或"--"
 */
function formatShortDateTime(value: string | null) {
  if (!value) return '--';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 获取电池电量对应的文字颜色类名
 * 功能：
 * - 根据电池电量百分比返回相应的Tailwind CSS文字颜色类名
 * - 电量>60%：绿色（text-green-600）
 * - 电量20-60%：黄色（text-yellow-600）
 * - 电量<20%：红色（text-red-600）
 * - 用于在UI中直观显示电池状态
 * @param {number} level - 电池电量百分比（0-100）
 * @returns {string} Tailwind CSS文字颜色类名
 */
function getBatteryColor(level: number) {
  if (level > 60) return 'text-green-600';
  if (level > 20) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * 获取电池电量对应的背景颜色类名
 * 功能：
 * - 根据电池电量百分比返回相应的Tailwind CSS背景颜色类名
 * - 电量>60%：浅绿色背景（bg-green-100）
 * - 电量20-60%：浅黄色背景（bg-yellow-100）
 * - 电量<20%：浅红色背景（bg-red-100）
 * - 用于在UI中为电池状态提供视觉背景提示
 * @param {number} level - 电池电量百分比（0-100）
 * @returns {string} Tailwind CSS背景颜色类名
 */
function getBatteryBg(level: number) {
  if (level > 60) return 'bg-green-100';
  if (level > 20) return 'bg-yellow-100';
  return 'bg-red-100';
}

export default function UserDevicesPage() {
  const { currentPersonId, alarmCount } = useApp();
  /*设备列表和筛选状态*/
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');

  /*新增设备弹窗状态*/
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createFormState, setCreateFormState] = useState<DeviceFormState>(initialFormState);

  /*编辑和删除弹窗状态*/
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editFormState, setEditFormState] = useState<DeviceFormState>(initialFormState);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<Device[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /*加载当前用户已绑定的设备列表*/
  const loadDevices = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/devices', { cache: 'no-store' });
      const data = await res.json();
      /*只保留当前用户绑定的设备*/
      const userDevices = (data.devices || []).filter((device: Device) => 
        device.person_id === currentPersonId
      );
      setDevices(userDevices);
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  /*把表单状态转换成接口需要的请求体*/
  const buildPayload = (formState: DeviceFormState) => ({
    name: formState.name.trim(),
    model: formState.model.trim(),
    firmware_version: formState.firmware_version.trim() || null,
    battery_level: Number(formState.battery_level),
    status: formState.status,
    person_id: currentPersonId, // 自动绑定当前用户
  });

  /*新增一台并自动绑定到当前用户*/
  const handleCreateDevice = async () => {
    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(createFormState)),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '新增设备失败');
      }

      setCreateDialogOpen(false);
      setCreateFormState(initialFormState);
      await loadDevices();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : '新增设备失败');
    } finally {
      setCreating(false);
    }
  };

  /*根据勾选结果生成已选设备列表*/
  const selectedDevices = useMemo(
    () => devices.filter((device) => selectedIds.includes(device.id)),
    [devices, selectedIds]
  );

  /*统计待删除设备的影响范围*/
  const deleteSummary = useMemo(() => {
    const targets = deleteTargets;
    const bindingNames = Array.from(new Set(targets.map((device) => device.person_name || device.monitored_persons?.name || '').filter(Boolean)));
    return {
      deviceCount: targets.length,
      healthRecordCount: targets.reduce((sum, device) => sum + (device.stats?.health_record_count || 0), 0),
      alarmCount: targets.reduce((sum, device) => sum + (device.stats?.alarm_count || 0), 0),
      unacknowledgedAlarmCount: targets.reduce((sum, device) => sum + (device.stats?.unacknowledged_alarm_count || 0), 0),
      bindingNames,
      boundDeviceCount: targets.filter((device) => device.person_id !== null).length,
    };
  }, [deleteTargets]);

  /*切换单个设备的勾选状态*/
  const handleToggleSelect = (deviceId: number, checked: boolean) => {
    setSelectedIds((prev) => (
      checked ? Array.from(new Set([...prev, deviceId])) : prev.filter((id) => id !== deviceId)
    ));
  };

  /*切换设备在线和离线状态*/
  const handleToggleDeviceStatus = async (device: Device) => {
    const newStatus = device.status === 'online' ? 'offline' : 'online';
    
    try {
      const res = await fetch('/api/devices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: device.id,
          status: newStatus,
          last_sync_at: newStatus === 'online' ? new Date().toISOString() : null,
          person_id: device.person_id, // 保持原有的绑定关系
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '更新设备状态失败');
      }

      await loadDevices();
    } catch (error) {
      console.error('Toggle device status error:', error);
      alert('更新设备状态失败，请稍后重试');
    }
  };

  /*打开编辑设备弹窗并回填数据*/
  const openEditDialog = (device: Device) => {
    setEditingDevice(device);
    setEditFormState({
      name: device.name,
      model: device.model,
      firmware_version: device.firmware_version || '',
      battery_level: device.battery_level.toString(),
      status: device.status as 'online' | 'offline',
    });
    setEditError(null);
    setEditDialogOpen(true);
  };

  /*打开删除确认弹窗*/
  const openDeleteDialog = (targets: Device[]) => {
    setDeleteTargets(targets);
    setDeleteError(null);
    setDeleteDialogOpen(true);
  };

  /*删除单个或多个设备*/
  const handleDeleteDevices = async () => {
    if (deleteTargets.length === 0) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const ids = deleteTargets.map((device) => device.id);
      const requestInit =
        ids.length === 1
          ? { method: 'DELETE' }
          : {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids }),
            };
      const res = await fetch(ids.length === 1 ? `/api/devices?id=${ids[0]}` : '/api/devices', requestInit);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '删除设备失败');
      }

      setDeleteDialogOpen(false);
      setDeleteTargets([]);
      setSelectedIds((prev) => prev.filter((id) => ids.includes(id)));
      await loadDevices();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : '删除设备失败');
    } finally {
      setDeleting(false);
    }
  };

  /*保存编辑后的设备信息*/
  const handleEditDevice = async () => {
    if (!editingDevice) return;

    setEditing(true);
    setEditError(null);

    try {
      const res = await fetch('/api/devices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingDevice.id,
          name: editFormState.name.trim(),
          model: editFormState.model.trim(),
          firmware_version: editFormState.firmware_version.trim() || null,
          battery_level: Number(editFormState.battery_level),
          status: editFormState.status,
          last_sync_at: editFormState.status === 'online' ? new Date().toISOString() : null,
          /*保持原来的绑定人员不变*/
          person_id: editingDevice.person_id,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '更新设备失败');
      }

      setEditDialogOpen(false);
      setEditingDevice(null);
      await loadDevices();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : '更新设备失败');
    } finally {
      setEditing(false);
    }
  };

  /*切换用户时重新加载设备列表*/
  useEffect(() => {
    void loadDevices();
  }, [currentPersonId]);

  useEffect(() => {
    if (createDialogOpen) {
      setCreateFormState(initialFormState);
      setCreateError(null);
    }
  }, [createDialogOpen]);

  useEffect(() => {
    if (editDialogOpen && editingDevice) {
      setEditFormState({
        name: editingDevice.name,
        model: editingDevice.model,
        firmware_version: editingDevice.firmware_version || '',
        battery_level: editingDevice.battery_level.toString(),
        status: editingDevice.status as 'online' | 'offline',
      });
      setEditError(null);
    }
  }, [editDialogOpen, editingDevice]);

  const filteredDevices = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return devices.filter((device) => {
      const matchesKeyword = keyword
        ? [device.name, device.model, device.firmware_version]
            .map((value) => String(value ?? '').toLowerCase())
            .some((value) => value.includes(keyword))
        : true;
      const matchesStatus = statusFilter === 'all' ? true : device.status === statusFilter;

      return matchesKeyword && matchesStatus;
    });
  }, [devices, searchKeyword, statusFilter]);

  const allSelected = filteredDevices.length > 0 && filteredDevices.every((device) => selectedIds.includes(device.id));

  const handleToggleSelectAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, ...filteredDevices.map((device) => device.id)]));
      }

      return prev.filter((id) => !filteredDevices.some((device) => device.id === id));
    });
  };

  return (
    <div className="flex flex-col">
      <UserHeader />

      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <Watch className="h-7 w-7 text-teal-600" /> 我的设备
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">查看您绑定的智能手表设备信息。</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> 添加设备
            </Button>
            <Button
              variant="outline"
              className="gap-2 text-red-600 hover:text-red-700"
              disabled={selectedIds.length === 0}
              onClick={() => openDeleteDialog(selectedDevices)}
            >
              <Trash2 className="h-4 w-4" /> 批量删除{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
            </Button>
            <Button onClick={() => void loadDevices()} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" /> 刷新状态
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100">
                  <Watch className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{devices.length}</p>
                  <p className="text-xs text-muted-foreground">我的设备</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                  <Wifi className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{devices.filter((d) => d.status === 'online').length}</p>
                  <p className="text-xs text-muted-foreground">在线设备</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                  <WifiOff className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{devices.filter((d) => d.status === 'offline').length}</p>
                  <p className="text-xs text-muted-foreground">离线设备</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="grid grid-cols-1 gap-3 py-4 lg:grid-cols-[2fr_1fr]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchKeyword ?? ''}
                onChange={(event) => setSearchKeyword(event.target.value)}
                placeholder="搜索设备名称、型号"
                className="pl-9"
              />
            </div>
            <Select value={statusFilter ?? 'all'} onValueChange={(value: 'all' | 'online' | 'offline') => setStatusFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="online">在线</SelectItem>
                <SelectItem value="offline">离线</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => handleToggleSelectAll(checked === true)}
                aria-label="全选设备"
              />
              <span className="text-sm font-medium">全选当前设备</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>已选择 {selectedIds.length} 台</span>
              <span>当前筛选结果 {filteredDevices.length} 台</span>
              <span>关联历史 {selectedDevices.reduce((sum, item) => sum + item.stats.health_record_count, 0)} 条</span>
              <span>关联报警 {selectedDevices.reduce((sum, item) => sum + item.stats.alarm_count, 0)} 条</span>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          </div>
        ) : (
          filteredDevices.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">暂无绑定的设备。</CardContent>
            </Card>
          ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredDevices.map((device) => (
              <Card key={device.id} className="overflow-hidden transition-shadow hover:shadow-md">
                <div className={device.status === 'online' ? 'h-1.5 bg-green-500' : 'h-1.5 bg-red-400'} />
                <CardContent className="space-y-4 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedIds.includes(device.id)}
                        onCheckedChange={(checked) => handleToggleSelect(device.id, checked === true)}
                        aria-label={`选择设备 ${device.name}`}
                        className="mt-1"
                      />
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                          <Watch className="h-6 w-6 text-slate-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">{device.name}</h3>
                          <p className="text-xs text-muted-foreground">{device.model}</p>
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={device.status === 'online' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}
                    >
                      {device.status === 'online' ? '在线' : '离线'}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Battery className={`h-4 w-4 ${getBatteryColor(device.battery_level || 0)}`} />
                        <span className="text-xs text-muted-foreground">电量</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-16 rounded-full ${getBatteryBg(device.battery_level || 0)}`}>
                          <div
                            className={`h-2 rounded-full ${device.battery_level > 20 ? 'bg-green-500' : 'bg-red-500'}`}
                            style={{ width: `${device.battery_level || 0}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium tabular-nums ${getBatteryColor(device.battery_level || 0)}`}>
                          {device.battery_level}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">固件版本</span>
                      <span className="font-medium">{device.firmware_version || '--'}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">绑定人员</span>
                      </div>
                      <span className="font-medium">{device.monitored_persons?.name || device.person_name || '--'}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">关联历史/报警</span>
                      </div>
                      <span className="font-medium">
                        {device.stats.health_record_count} / {device.stats.alarm_count}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">最后同步</span>
                      <span>{formatShortDateTime(device.last_sync_at)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(device)}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> 编辑
                    </Button>
                    <Button
                      variant={device.status === 'online' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleToggleDeviceStatus(device)}
                      className={device.status === 'online' ? 'bg-green-600 hover:bg-green-700' : 'border-red-300 hover:border-red-400 hover:text-red-700'}
                    >
                      {device.status === 'online' ? (
                        <>
                          <Wifi className="mr-1.5 h-3.5 w-3.5" /> 下线
                        </>
                      ) : (
                        <>
                          <WifiOff className="mr-1.5 h-3.5 w-3.5" /> 上线
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => openDeleteDialog([device])}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> 删除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          )
        )}
      </div>

      {/* 添加设备对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>添加设备</DialogTitle>
            <DialogDescription>添加新的智能手表设备，设备将自动绑定到您的账户。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="create-device-name">设备名称</Label>
              <Input
                id="create-device-name"
                value={createFormState.name ?? ''}
                onChange={(event) => setCreateFormState((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="例如：华为 Watch Fit 3"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-device-model">设备型号</Label>
              <Input
                id="create-device-model"
                value={createFormState.model ?? ''}
                onChange={(event) => setCreateFormState((prev) => ({ ...prev, model: event.target.value }))}
                placeholder="例如：Watch Fit 3"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="create-device-firmware">固件版本</Label>
                <Input
                  id="create-device-firmware"
                  value={createFormState.firmware_version ?? ''}
                  onChange={(event) => setCreateFormState((prev) => ({ ...prev, firmware_version: event.target.value }))}
                  placeholder="例如：v1.0.0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-device-battery">初始电量</Label>
                <Input
                  id="create-device-battery"
                  type="number"
                  min={0}
                  max={100}
                  value={createFormState.battery_level ?? ''}
                  onChange={(event) => setCreateFormState((prev) => ({ ...prev, battery_level: event.target.value }))}
                  placeholder="0-100"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>设备状态</Label>
              <Select
                value={createFormState.status ?? 'offline'}
                onValueChange={(value: 'online' | 'offline') => setCreateFormState((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="offline">离线</SelectItem>
                  <SelectItem value="online">在线</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {createError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={creating}>取消</Button>
            <Button onClick={() => void handleCreateDevice()} disabled={creating}>{creating ? '添加中...' : '确认添加'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑设备对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>编辑设备信息</DialogTitle>
            <DialogDescription>修改设备名称、型号、固件版本和电量信息。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-device-name">设备名称</Label>
              <Input
                id="edit-device-name"
                value={editFormState.name ?? ''}
                onChange={(event) => setEditFormState((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="例如：华为 Watch Fit 3"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-device-model">设备型号</Label>
              <Input
                id="edit-device-model"
                value={editFormState.model ?? ''}
                onChange={(event) => setEditFormState((prev) => ({ ...prev, model: event.target.value }))}
                placeholder="例如：Watch Fit 3"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-device-firmware">固件版本</Label>
                <Input
                  id="edit-device-firmware"
                  value={editFormState.firmware_version ?? ''}
                  onChange={(event) => setEditFormState((prev) => ({ ...prev, firmware_version: event.target.value }))}
                  placeholder="例如：v1.0.0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-device-battery">电量</Label>
                <Input
                  id="edit-device-battery"
                  type="number"
                  min={0}
                  max={100}
                  value={editFormState.battery_level ?? ''}
                  onChange={(event) => setEditFormState((prev) => ({ ...prev, battery_level: event.target.value }))}
                  placeholder="0-100"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>设备状态</Label>
              <Select
                value={editFormState.status ?? 'offline'}
                onValueChange={(value: 'online' | 'offline') => setEditFormState((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="offline">离线</SelectItem>
                  <SelectItem value="online">在线</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{editError}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={editing}>取消</Button>
            <Button onClick={() => void handleEditDevice()} disabled={editing}>{editing ? '更新中...' : '确认更新'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteSummary.deviceCount > 1 ? '批量删除设备' : '删除设备'}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteSummary.deviceCount > 1
                ? `确认删除选中的 ${deleteSummary.deviceCount} 台设备吗？`
                : `确认删除设备"${deleteTargets[0]?.name || deleteTargets[0]?.model || ''}"吗？`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <div>关联历史记录：{deleteSummary.healthRecordCount} 条</div>
            <div>关联报警记录：{deleteSummary.alarmCount} 条</div>
            <div>未处理报警：{deleteSummary.unacknowledgedAlarmCount} 条</div>
            <div>
              将解除绑定：
              {deleteSummary.bindingNames.length > 0 ? ` ${deleteSummary.bindingNames.join('、')}` : ' 无绑定用户'}
            </div>
            <div>受影响的已绑定设备：{deleteSummary.boundDeviceCount} 台</div>
            <div className="text-muted-foreground">删除后设备会从列表中移除，但已有历史记录和报警会保留，仅解除与该设备的关联。</div>
          </div>

          {deleteError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</div>}

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteTargets([]);
                setDeleteError(null);
              }}
              disabled={deleting}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteDevices();
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
            >
              {deleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
