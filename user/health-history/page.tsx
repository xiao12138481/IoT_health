'use client';

/**
 * 用户健康历史页面
 * 功能描述：
 * - 查看当前用户的所有健康历史数据
 * - 支持按时间范围、指标类型筛选
 * - 用户独有，不显示人员切换功能
 */

import { HealthHistoryView } from '@/components/history/health-history-view';

export default function UserHealthHistoryPage() {
  /*渲染用户端健康历史公共视图*/
  return <HealthHistoryView mode="user" />;
}
