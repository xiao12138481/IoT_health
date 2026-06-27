'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, AlertTriangle, ChevronRight, Clock } from 'lucide-react';

/*报警记录数据结构*/
interface Alarm {
  /** 报警记录ID */
  id: number;
  /** 报警类型标识符 */
  alarm_type: string;
  /** 报警等级：critical（紧急）或 warning（警告） */
  alarm_level: string;
  /** 报警消息内容 */
  message: string;
  /** 触发报警的实际测量值 */
  value: string;
  /** 触发报警的阈值 */
  threshold: string;
  /** 是否已确认处理 */
  is_acknowledged: boolean;
  /** 报警创建时间 */
  created_at: string;
}

/*报警摘要组件属性接口*/
interface AlarmSummaryProps {
  /** 要显示的报警记录数组 */
  alarms: Alarm[];
  /** 未处理报警总数 */
  total: number;
}

/*报警类型中文标签映射*/
const alarmTypeLabels: Record<string, string> = {
  heart_rate_high: '心率过高',
  heart_rate_low: '心率过低',
  blood_oxygen_low: '血氧过低',
  fever: '体温偏高',
};

/*报警等级样式配置*/
const levelConfig = {
  critical: { color: 'bg-red-500', text: '紧急', badge: 'bg-red-100 text-red-700 border-red-200' },
  warning: { color: 'bg-orange-500', text: '警告', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
};

/**
 * 报警摘要组件
 * 功能：
 * - 显示最新的未处理报警记录
 * - 展示未处理报警总数
 * - 提供查看全部报警的链接
 * - 根据报警等级显示不同的样式
 * @param {AlarmSummaryProps} props - 组件属性
 * @returns {JSX.Element} 报警摘要组件
 */
export function AlarmSummary({ alarms, total }: AlarmSummaryProps) {
  /*汇总展示当前未处理报警列表和总数*/
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5 text-red-500" />
            报警摘要
          </CardTitle>
          {total > 0 && (
            <Badge className="bg-red-500 text-white hover:bg-red-600">{total} 条未处理</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {alarms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
              <Bell className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-sm text-muted-foreground">暂无未处理报警</p>
            <p className="text-xs text-muted-foreground mt-1">所有指标均在正常范围</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alarms.map((alarm, index) => {
              const cfg = levelConfig[alarm.alarm_level as keyof typeof levelConfig] || levelConfig.warning;
              return (
                <div
                  key={`${alarm.id}-${alarm.alarm_type}-${index}`}
                  className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-slate-50"
                >
                  <div className={cn('mt-0.5 h-2 w-2 shrink-0 rounded-full', cfg.color, 'animate-pulse')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {alarmTypeLabels[alarm.alarm_type] || alarm.alarm_type}
                      </span>
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', cfg.badge)}>
                        {cfg.text}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{alarm.message}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(alarm.created_at).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Link href="/alarms">
          <Button variant="ghost" className="w-full mt-4 text-teal-600 hover:text-teal-700 hover:bg-teal-50">
            查看全部报警
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

/**
 * 条件类名拼接函数
 * 功能：
 * - 过滤掉假值（undefined、false、空字符串等）
 * - 将有效的类名字符串拼接成一个字符串
 * - 常用于动态类名生成
 * @param {...(string | undefined | false)} inputs - 类名字符串或条件值
 * @returns {string} 拼接后的类名字符串
 */
function cn(...inputs: (string | undefined | false)[]) {
  /*拼接条件类名字符串*/
  return inputs.filter(Boolean).join(' ');
}
