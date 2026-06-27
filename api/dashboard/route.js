/**
 * 仪表板API
 * 功能描述：
 * - 获取仪表板数据
 * - 返回健康评分、各指标最新值等
 * - 支持按人员查询
 * 
 * 关联页面：
 * - 管理员健康总览
 * - 用户健康总览
 * 
 * HTTP方法：
 * - GET - 获取仪表板数据
 */

import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

export const dynamic = 'force-dynamic';

/*聚合返回健康总览页所需的全部数据*/
export async function GET(request) {
  try {
    // 初始化数据库
    db.initDB();
    
    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('person_id');

    if (!personId) {
      return NextResponse.json({ error: '缺少 person_id 参数' }, { status: 400 });
    }

    const pid = parseInt(personId, 10);

    // 获取人员信息
    const person = await db.monitoredPersons.getById(pid);
    if (!person) {
      return NextResponse.json({ error: '人员不存在' }, { status: 404 });
    }

    // 获取最新健康记录
    const latestRecord = await db.healthRecords.getLatestByPersonId(pid);
    
    // 发送调试日志
    try {
      await fetch('http://localhost:9321/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'dashboard_query_result',
          level: 'info',
          message: `Dashboard查询结果: person_id=${pid}`,
          data: {
            personId: pid,
            latestRecord: latestRecord ? {
              id: latestRecord.id,
              recorded_at: latestRecord.recorded_at,
              heart_rate: latestRecord.heart_rate,
              systolic_bp: latestRecord.systolic_bp,
              diastolic_bp: latestRecord.diastolic_bp
            } : null,
            recordCount: latestRecord ? 1 : 0
          }
        })
      });
    } catch (err) {
      console.warn('调试日志发送失败:', err.message);
    }
    
    // 获取最新血压记录
    const latestBloodPressure = await db.healthRecords.getLatestBloodPressureByPersonId(pid);

    // 获取今日步数
    const totalSteps = await db.healthRecords.getTodaySteps(pid);

    // 获取24小时心率趋势
    const hrTrend = await db.healthRecords.get24hHeartRate(pid);
    
    // 获取24小时血压趋势
    const bpTrend = await db.healthRecords.get24hBloodPressure(pid);

    // 获取未确认报警
    const recentAlarms = await db.alarms.getByPersonId(pid, { acknowledged: false, limit: 5 });

    // 获取未确认报警数量
    const unacknowledgedAlarmCount = await db.alarms.countUnacknowledged(pid);

    // 获取最新睡眠记录
    const latestSleep = await db.sleepRecords.getLatest(pid);

    // 获取阈值配置
    const threshold = await db.thresholdConfigs.getByPersonId(pid);

    return NextResponse.json({
      person,
      latestRecord,
      latestBloodPressure,
      totalSteps,
      hrTrend,
      bpTrend,
      recentAlarms,
      unacknowledgedAlarmCount,
      latestSleep,
      threshold
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: error.message || '未知错误' }, { status: 500 });
  }
}
