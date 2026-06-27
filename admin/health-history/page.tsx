'use client';

/**
 * 管理员健康历史页面
 * 功能描述：
 * - 查看指定人员的所有健康历史数据
 * - 支持按时间范围、指标类型筛选
 * - 支持人员切换查看不同人的数据
 */

import { HealthHistoryView } from '@/components/history/health-history-view';

export default function AdminHealthHistoryPage() {
  /*渲染管理员端健康历史公共视图*/
  return <HealthHistoryView mode="admin" />;
}
