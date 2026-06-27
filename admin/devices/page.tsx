'use client';

/**
 * 管理员设备管理页面
 * 功能描述：
 * - 查看所有设备信息
 * - 支持编辑、删除设备功能
 * - 使用 AdminHeader，支持设备状态管理
 */

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/layout/app-provider';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Watch, Wifi, WifiOff, Battery, RefreshCw, User, Plus, Trash2, Pencil, Link2, Search, Users } from 'lucide-react';

interface DeviceStats {
  health_record_count: number;
  alarm_count: number;
  unacknowledged_alarm_count: number;
  latest_health_record_at: string | null;
  latest_alarm_at: string | null;
}

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
/*定义了设备编辑表单的数据结构*/
interface DeviceFormState {
  name: string;
  model: string;
  firmware_version: string;
  battery_level: string;
  status: 'online' | 'offline';
  person_id: string;
}
/*表单打开时的默认值*/
const initialFormState: DeviceFormState = {
  name: '',
  model: '',
  firmware_version: '',
  battery_level: '100',
  status: 'offline',
  person_id: 'unassigned',
};
/*日期时间格式化工具*/
function formatShortDateTime(value: string | null) {
  if (!value) return '--';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getBatteryColor(level: number) {
  if (level > 60) return 'text-green-600';
  if (level > 20) return 'text-yellow-600';
  return 'text-red-600';
}

function getBatteryBg(level: number) {
  if (level > 60) return 'bg-green-100';
  if (level > 20) return 'bg-yellow-100';
  return 'bg-red-100';
}

/**
 * 从设备对象获取表单状态
 * 功能：
 * - 将设备数据转换为表单可用的状态对象
 * - 处理各种字段的空值和类型转换
 * - 确保电池电量有默认值（100%）
 * - 标准化设备状态为"online"或"offline"
 * - 处理未分配人员的情况，使用"unassigned"标识
 * @param {Device} device - 设备对象
 * @returns {DeviceFormState} 表单状态对象
 */
function getFormStateFromDevice(device: Device): DeviceFormState {
  return {
    name: String(device.name || ''),
    model: String(device.model || ''),
    firmware_version: String(device.firmware_version || ''),
    battery_level: String(device.battery_level ?? 100),
    status: device.status === 'online' ? 'online' : 'offline',
    person_id: device.person_id == null ? 'unassigned' : String(device.person_id),
  };
}

export default function AdminDevicesPage() {
  const { persons, currentPersonId, setCurrentPersonId, alarmCount } = useApp();
  /*设备列表和全局选择状态*/
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [mounted, setMounted] = useState(false);

  /*避免首屏水合不一致*/
  useEffect(() => {
    setMounted(true);
  }, []);

  /*编辑设备弹窗状态*/
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editFormState, setEditFormState] = useState<DeviceFormState>(initialFormState);

  /*删除和批量绑定弹窗状态*/
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<Device[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [bindDialogOpen, setBindDialogOpen] = useState(false);
  const [bindingPersonId, setBindingPersonId] = useState<string>('unassigned');
  const [binding, setBinding] = useState(false);
  const [bindError, setBindError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [bindingFilter, setBindingFilter] = useState<string>('all');

  /*判断设备当前是否已经绑定人员*/
  const isDeviceBound = (device: Device) => device.person_id != null;

  /*加载管理员可见的全部设备列表*/
  const loadDevices = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/devices', { cache: 'no-store' });
      const data = await res.json();
      const nextDevices = data.devices || [];
      setDevices(nextDevices);
      setSelectedIds((prev) => prev.filter((id) => nextDevices.some((device: Device) => device.id === id)));
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  /*页面首次进入时加载设备列表*/
  useEffect(() => {
    void loadDevices();
  }, []);

  /*根据勾选结果生成已选设备列表*/
  const selectedDevices = useMemo(
    () => devices.filter((device) => selectedIds.includes(device.id)),
    [devices, selectedIds]
  );

  /*按关键字、状态和绑定关系筛选设备*/
  const filteredDevices = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return devices.filter((device) => {
      const matchesKeyword = keyword
        ? [device.name, device.model, device.firmware_version, device.person_name, device.monitored_persons?.name]
            .map((value) => String(value ?? '').toLowerCase())
            .some((value) => value.includes(keyword))
        : true;
      const matchesStatus = statusFilter === 'all' ? true : device.status === statusFilter;
      const matchesBinding =
        bindingFilter === 'all'
          ? true
          : bindingFilter === 'bound'
            ? isDeviceBound(device)
            : bindingFilter === 'unbound'
              ? !isDeviceBound(device)
              : String(device.person_id) === bindingFilter;

      return matchesKeyword && matchesStatus && matchesBinding;
    });
  }, [devices, searchKeyword, statusFilter, bindingFilter]);

  /*统计待删除设备影响到的记录和报警数量*/
  const deleteSummary = useMemo(() => {
    const targets = deleteTargets;
    const bindingNames = Array.from(new Set(targets.map((device) => device.person_name || device.monitored_persons?.name || '').filter(Boolean)));
    return {
      deviceCount: targets.length,
      healthRecordCount: targets.reduce((sum, device) => sum + (device.stats?.health_record_count || 0), 0),
      alarmCount: targets.reduce((sum, device) => sum + (device.stats?.alarm_count || 0), 0),
      unacknowledgedAlarmCount: targets.reduce((sum, device) => sum + (device.stats?.unacknowledged_alarm_count || 0), 0),
      bindingNames,
      boundDeviceCount: targets.filter((device) => isDeviceBound(device)).length,
    };
  }, [deleteTargets]);

  /*判断当前筛选结果是否已全部勾选*/
  const allSelected = filteredDevices.length > 0 && filteredDevices.every((device) => selectedIds.includes(device.id));

  /*批量切换当前筛选结果的勾选状态*/
  const handleToggleSelectAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, ...filteredDevices.map((device) => device.id)]));
      }

      return prev.filter((id) => !filteredDevices.some((device) => device.id === id));
    });
  };

  /*切换单个设备勾选状态*/
  const handleToggleSelect = (deviceId: number, checked: boolean) => {
    setSelectedIds((prev) => (
      checked ? Array.from(new Set([...prev, deviceId])) : prev.filter((id) => id !== deviceId)
    ));
  };

  /*把表单状态转换成接口请求体*/
  const buildPayload = (formState: DeviceFormState) => ({
    name: formState.name.trim(),
    model: formState.model.trim(),
    firmware_version: formState.firmware_version.trim() || null,
    battery_level: Number(formState.battery_level),
    status: formState.status,
    person_id: formState.person_id === 'unassigned' ? null : Number(formState.person_id),
  });

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
          person_id: device.person_id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '更新设备状态失败');
      }

      await loadDevices();
    } catch (error) {
      console.error('Toggle admin device status error:', error);
      alert('更新设备状态失败，请稍后重试');
    }
  };

  /*打开编辑设备弹窗并回填表单*/
  const openEditDialog = (device: Device) => {
    setEditingDevice(device);
    setEditFormState(getFormStateFromDevice(device));
    setEditError(null);
    setEditDialogOpen(true);
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
          ...buildPayload(editFormState),
          last_sync_at: editFormState.status === 'online' ? new Date().toISOString() : null,
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
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
      await loadDevices();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : '删除设备失败');
    } finally {
      setDeleting(false);
    }
  };

  /*批量更新设备绑定人员*/
  const handleBatchBind = async () => {
    if (selectedIds.length === 0) return;

    setBinding(true);
    setBindError(null);

    try {
      const res = await fetch('/api/devices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedIds,
          person_id: bindingPersonId === 'unassigned' ? null : Number(bindingPersonId),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '批量更新绑定人员失败');
      }

      setBindDialogOpen(false);
      setBindError(null);
      await loadDevices();
    } catch (error) {
      setBindError(error instanceof Error ? error.message : '批量更新绑定人员失败');
    } finally {
      setBinding(false);
    }
  };

  /*打开批量绑定弹窗时重置表单状态*/
  useEffect(() => {
    if (bindDialogOpen) {
      setBindingPersonId('unassigned');
      setBindError(null);
    }
  }, [bindDialogOpen]);

  if (!mounted) {
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
              <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                <Watch className="h-7 w-7 text-teal-600" /> 设备管理
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">管理智能手表设备，支持编辑、状态切换与批量删除。（管理员视图）</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="gap-2 text-red-600 hover:text-red-700"
                disabled
              >
                <Trash2 className="h-4 w-4" /> 批量删除
              </Button>
              <Button disabled variant="outline" className="gap-2">
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
                    <p className="text-2xl font-bold">0</p>
                    <p className="text-xs text-muted-foreground">设备总数</p>
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
                    <p className="text-2xl font-bold">0</p>
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
                    <p className="text-2xl font-bold">0</p>
                    <p className="text-xs text-muted-foreground">离线设备</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="grid grid-cols-1 gap-3 py-4 lg:grid-cols-[2fr_1fr_1fr_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  disabled
                  value=""
                  readOnly
                  placeholder="搜索设备名称、型号、固件版本、绑定人员"
                  className="pl-9"
                />
              </div>
              <Button variant="outline" disabled>状态筛选</Button>
              <Button variant="outline" disabled>绑定筛选</Button>
              <Button variant="outline" disabled>
                <Users className="mr-1.5 h-4 w-4" /> 批量改绑
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <Checkbox disabled aria-label="全选设备" />
                <span className="text-sm font-medium">全选当前设备</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>已选择 0 台</span>
                <span>当前筛选结果 0 台</span>
                <span>关联历史 0 条</span>
                <span>关联报警 0 条</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">加载中...</CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
            <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <Watch className="h-7 w-7 text-teal-600" /> 设备管理
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">管理智能手表设备，支持编辑、状态切换与批量删除。（管理员视图）</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
                  <p className="text-xs text-muted-foreground">设备总数</p>
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
          <CardContent className="grid grid-cols-1 gap-3 py-4 lg:grid-cols-[2fr_1fr_1fr_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchKeyword ?? ''}
                onChange={(event) => setSearchKeyword(event.target.value)}
                placeholder="搜索设备名称、型号、固件版本、绑定人员"
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
            <Select value={bindingFilter ?? 'all'} onValueChange={setBindingFilter}>
              <SelectTrigger>
                <SelectValue placeholder="绑定筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部绑定状态</SelectItem>
                <SelectItem value="bound">已绑定</SelectItem>
                <SelectItem value="unbound">未绑定</SelectItem>
                {persons.map((person) => (
                  <SelectItem key={person.id} value={String(person.id)}>
                    绑定 {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={selectedIds.length === 0} onClick={() => setBindDialogOpen(true)}>
              <Users className="mr-1.5 h-4 w-4" /> 批量改绑
            </Button>
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
              <CardContent className="py-10 text-center text-sm text-muted-foreground">没有符合当前搜索或筛选条件的设备。</CardContent>
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
                      <span className="font-medium">{device.monitored_persons?.name || device.person_name || '未绑定'}</span>
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
                      variant={device.status === 'online' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => void handleToggleDeviceStatus(device)}
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
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(device)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> 编辑
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



      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>编辑设备信息</DialogTitle>
            <DialogDescription>修改设备名称、型号、状态、绑定人员和电量信息。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-device-name">设备名称</Label>
              <Input
                id="edit-device-name"
                value={editFormState.name ?? ''}
                onChange={(event) => setEditFormState((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-device-model">设备型号</Label>
              <Input
                id="edit-device-model"
                value={editFormState.model ?? ''}
                onChange={(event) => setEditFormState((prev) => ({ ...prev, model: event.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-device-firmware">固件版本</Label>
                <Input
                  id="edit-device-firmware"
                  value={editFormState.firmware_version ?? ''}
                  onChange={(event) => setEditFormState((prev) => ({ ...prev, firmware_version: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-device-battery">当前电量</Label>
                <Input
                  id="edit-device-battery"
                  type="number"
                  min={0}
                  max={100}
                  value={editFormState.battery_level ?? ''}
                  onChange={(event) => setEditFormState((prev) => ({ ...prev, battery_level: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              <div className="grid gap-2">
                <Label>绑定人员</Label>
                <Select
                  value={editFormState.person_id ?? 'unassigned'}
                  onValueChange={(value) => setEditFormState((prev) => ({ ...prev, person_id: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择绑定人员" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">暂不绑定</SelectItem>
                    {persons.map((person) => (
                      <SelectItem key={person.id} value={String(person.id)}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editingDevice && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                当前关联历史 {editingDevice.stats.health_record_count} 条，关联报警 {editingDevice.stats.alarm_count} 条。
              </div>
            )}
            {editError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{editError}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={editing}>取消</Button>
            <Button onClick={() => void handleEditDevice()} disabled={editing}>{editing ? '保存中...' : '保存修改'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bindDialogOpen} onOpenChange={setBindDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>批量编辑绑定人员</DialogTitle>
            <DialogDescription>将选中的设备批量绑定到指定用户，或统一改为未绑定。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
              已选择 {selectedDevices.length} 台设备
            </div>
            <div className="grid gap-2">
              <Label>绑定人员</Label>
              <Select value={bindingPersonId ?? 'unassigned'} onValueChange={setBindingPersonId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择目标绑定人员" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">设为未绑定</SelectItem>
                  {persons.map((person) => (
                    <SelectItem key={person.id} value={String(person.id)}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {bindError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{bindError}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBindDialogOpen(false)} disabled={binding}>取消</Button>
            <Button onClick={() => void handleBatchBind()} disabled={binding}>{binding ? '保存中...' : '确认修改'}</Button>
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
