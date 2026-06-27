'use client';

import { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/components/layout/app-provider';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, AlertTriangle, CheckCircle2, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

interface AlarmRecord {
  id: number;
  person_id: number;
  alarm_type: string;
  alarm_level: string;
  message: string;
  value: string;
  threshold: string;
  is_acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
  monitored_persons: { name: string } | null;
}

const typeLabels: Record<string, string> = {
  heart_rate_high: '心率过高',
  heart_rate_low: '心率过低',
  blood_oxygen_low: '血氧过低',
  fever: '体温偏高',
  systolic_bp_high: '收缩压过高',
  systolic_bp_low: '收缩压过低',
  diastolic_bp_high: '舒张压过高',
  diastolic_bp_low: '舒张压过低',
};

const levelConfig = {
  critical: { text: '紧急', badge: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  warning: { text: '警告', badge: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
};

export default function AlarmsPage() {
  const { persons, currentPersonId, setCurrentPersonId, alarmCount, setAlarmCount } = useApp();
  /*页面核心数据状态*/
  const [records, setRecords] = useState<AlarmRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterAck, setFilterAck] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  /*加载当前人员的报警记录和未确认数量*/
  const loadAlarms = useCallback(async () => {
    if (!currentPersonId) return;
    setLoading(true);
    try {
      const unackParams = new URLSearchParams({
        person_id: currentPersonId.toString(),
        acknowledged: 'false',
        page_size: '0',
      });
      const params = new URLSearchParams({
        person_id: currentPersonId.toString(),
        page: page.toString(),
        page_size: pageSize.toString(),
      });
      if (filterType !== 'all') params.set('alarm_type', filterType);
      if (filterLevel !== 'all') params.set('alarm_level', filterLevel);
      if (filterAck !== 'all') params.set('acknowledged', filterAck);

      const [res, unackRes] = await Promise.all([
        fetch(`/api/alarm-records?${params.toString()}`, { cache: 'no-store' }),
        fetch(`/api/alarm-records?${unackParams.toString()}`, { cache: 'no-store' }),
      ]);
      const [data, unackData] = await Promise.all([res.json(), unackRes.json()]);
      setRecords(data.records || []);
      setTotal(data.total || 0);
      setAlarmCount(unackData.total || 0);
    } catch { /* */ } finally { setLoading(false); }
  }, [currentPersonId, page, pageSize, filterType, filterLevel, filterAck, setAlarmCount]);

  /*筛选条件或分页变化后重新拉取报警数据*/
  useEffect(() => { loadAlarms(); }, [loadAlarms]);

  /*确认单条报警记录*/
  const handleAcknowledge = async (id: number) => {
    try {
      await fetch('/api/alarm-records', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_acknowledged: true }),
      });
      loadAlarms();
    } catch { /* */ }
  };

  /*一键确认当前人员全部未确认报警*/
  const handleAcknowledgeAll = async () => {
    if (!currentPersonId) return;

    try {
      await fetch('/api/alarm-records', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_id: currentPersonId,
          acknowledge_all: true,
          is_acknowledged: true,
        }),
      });
      setAlarmCount(0);
      loadAlarms();
    } catch { /* */ }
  };

  /*计算分页总页数*/
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex flex-col">
      <Header persons={persons.map((p) => ({ id: p.id, name: p.name }))} currentPersonId={currentPersonId} onPersonChange={setCurrentPersonId} alarmCount={alarmCount} />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Bell className="h-7 w-7 text-red-500" /> 报警记录
            </h2>
            <p className="text-sm text-muted-foreground mt-1">查看和管理所有健康报警记录</p>
          </div>
          {records.some((r) => !r.is_acknowledged) && (
            <Button onClick={handleAcknowledgeAll} className="bg-teal-600 hover:bg-teal-700">
              <CheckCircle2 className="h-4 w-4 mr-2" /> 全部确认
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">筛选:</span>
              </div>
              <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1); }}>
                <SelectTrigger className="w-36"><SelectValue placeholder="报警类型" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="heart_rate_high">心率过高</SelectItem>
                  <SelectItem value="heart_rate_low">心率过低</SelectItem>
                  <SelectItem value="blood_oxygen_low">血氧过低</SelectItem>
                  <SelectItem value="fever">体温偏高</SelectItem>
                  <SelectItem value="systolic_bp_high">收缩压过高</SelectItem>
                  <SelectItem value="systolic_bp_low">收缩压过低</SelectItem>
                  <SelectItem value="diastolic_bp_high">舒张压过高</SelectItem>
                  <SelectItem value="diastolic_bp_low">舒张压过低</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterLevel} onValueChange={(v) => { setFilterLevel(v); setPage(1); }}>
                <SelectTrigger className="w-28"><SelectValue placeholder="报警级别" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部级别</SelectItem>
                  <SelectItem value="critical">紧急</SelectItem>
                  <SelectItem value="warning">警告</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterAck} onValueChange={(v) => { setFilterAck(v); setPage(1); }}>
                <SelectTrigger className="w-28"><SelectValue placeholder="处理状态" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="false">未处理</SelectItem>
                  <SelectItem value="true">已处理</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground ml-auto">共 {total} 条记录</span>
            </div>
          </CardContent>
        </Card>

        {/* Alarm list */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
            </div>
          ) : records.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">暂无符合条件的报警记录</p>
              </CardContent>
            </Card>
          ) : (
            records.map((record) => {
              const cfg = levelConfig[record.alarm_level as keyof typeof levelConfig] || levelConfig.warning;
              return (
                <Card key={record.id} className={`transition-colors ${!record.is_acknowledged ? 'border-l-4 border-l-red-400' : 'opacity-70'}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${!record.is_acknowledged ? cfg.dot + ' animate-pulse' : 'bg-slate-300'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{typeLabels[record.alarm_type] || record.alarm_type}</span>
                          <Badge variant="outline" className={cfg.badge}>{cfg.text}</Badge>
                          <Badge variant="outline" className={record.is_acknowledged ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                            {record.is_acknowledged ? '已处理' : '未处理'}
                          </Badge>
                          {record.monitored_persons && (
                            <span className="text-xs text-muted-foreground">{record.monitored_persons.name}</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{record.message}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>触发时间: {new Date(record.created_at).toLocaleString('zh-CN')}</span>
                          {record.is_acknowledged && record.acknowledged_at && (
                            <span>处理时间: {new Date(record.acknowledged_at).toLocaleString('zh-CN')}</span>
                          )}
                        </div>
                      </div>
                      {!record.is_acknowledged && (
                        <Button variant="outline" size="sm" onClick={() => handleAcknowledge(record.id)} className="shrink-0">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> 确认
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              第 {page} / {totalPages} 页
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
