'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts';

/*心率趋势图表组件属性*/
interface HeartRateTrendProps {
  /** 心率数据数组，包含心率值和记录时间 */
  data: { heart_rate: number; recorded_at: string }[];
  /** 心率阈值配置，包含最小值和最大值 */
  threshold: {
    heart_rate_min: number;
    heart_rate_max: number;
  } | null;
}

/**
 * 心率趋势图表组件
 * 功能：
 * - 显示24小时心率变化趋势
 * - 支持心率阈值参考线显示
 * - 提供交互式工具提示
 * - 使用渐变填充增强可视化效果
 * @param {HeartRateTrendProps} props - 组件属性
 * @returns {JSX.Element} 心率趋势图表组件
 */
export function HeartRateTrend({ data, threshold }: HeartRateTrendProps) {
  /*把原始心率记录转换为图表展示数据*/
  const chartData = data.map((d) => ({
    time: new Date(d.recorded_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    value: d.heart_rate,
    fullTime: new Date(d.recorded_at).toLocaleString('zh-CN'),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">24小时心率趋势</CardTitle>
          <span className="text-xs text-muted-foreground">
            最近更新: {data.length > 0 ? chartData[chartData.length - 1]?.fullTime : '--'}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="heartRateGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                interval="preserveStartEnd"
                tickCount={8}
              />
              <YAxis
                domain={[40, 160]}
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                tickCount={7}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelFormatter={(label: string) => `时间: ${label}`}
                formatter={(value: number) => [`${value} bpm`, '心率']}
              />
              {threshold?.heart_rate_max && (
                <ReferenceLine
                  y={threshold.heart_rate_max}
                  stroke="#EF4444"
                  strokeDasharray="6 3"
                  label={{ value: '上限', position: 'right', fill: '#EF4444', fontSize: 11 }}
                />
              )}
              {threshold?.heart_rate_min && (
                <ReferenceLine
                  y={threshold.heart_rate_min}
                  stroke="#F97316"
                  strokeDasharray="6 3"
                  label={{ value: '下限', position: 'right', fill: '#F97316', fontSize: 11 }}
                />
              )}
              <Area
                type="monotone"
                dataKey="value"
                stroke="#EF4444"
                strokeWidth={2}
                fill="url(#heartRateGradient)"
                animationDuration={600}
                animationEasing="ease-out"
                dot={false}
                activeDot={{ r: 4, fill: '#EF4444', strokeWidth: 2, stroke: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
