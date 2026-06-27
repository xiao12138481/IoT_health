/**
 * 健康记录API
 * 功能描述：
 * - 健康记录查询和新增
 * - 自动生成报警
 * - 验证健康数据阈值
 * 
 * 关联页面：
 * - 各指标详情页面
 * - 健康历史页面
 * 
 * HTTP方法：
 * - GET - 查询健康记录
 * - POST - 新增健康记录
 */

import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { createHealthAlarms } from '@/lib/health-alerts';

export const dynamic = 'force-dynamic';

class RequestValidationError extends Error {}

/*按人员和时间范围查询健康记录*/
export async function GET(request) {
  try {
    // 初始化数据库
    db.initDB();

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('person_id');
    const type = searchParams.get('type');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const limit = parseInt(searchParams.get('limit') || '500', 10);

    if (!personId) {
      return NextResponse.json({ error: '缺少 person_id 参数' }, { status: 400 });
    }

    const pid = parseInt(personId, 10);
    const records = await db.healthRecords.getByPersonId(pid, {
      type,
      startDate: start,
      endDate: end,
      limit,
    });

    return NextResponse.json({ records });
  } catch (error) {
    console.error('Health records error:', error);
    return NextResponse.json({ error: error.message || '未知错误' }, { status: 500 });
  }
}

/*解析必填正整数参数*/
function parseRequiredInteger(value, fieldName) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RequestValidationError(`${fieldName} 参数无效`);
  }

  return parsed;
}

/*解析可选数值参数并校验范围*/
function parseOptionalNumber(value, fieldName, options = {}) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new RequestValidationError(`${fieldName} 参数无效`);
  }

  if (options.integer && !Number.isInteger(parsed)) {
    throw new RequestValidationError(`${fieldName} 必须为整数`);
  }

  if (options.min !== undefined && parsed < options.min) {
    throw new RequestValidationError(`${fieldName} 不能小于 ${options.min}`);
  }

  if (options.max !== undefined && parsed > options.max) {
    throw new RequestValidationError(`${fieldName} 不能大于 ${options.max}`);
  }

  return parsed;
}

/*规范化健康记录采集时间*/
function parseRecordedAt(value) {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new RequestValidationError('recorded_at 参数无效');
  }

  return parsed.toISOString();
}

/*写入一条健康记录并自动触发报警*/
export async function POST(request) {
  try {
    db.initDB();

    const body = await request.json();
    const personId = parseRequiredInteger(body.person_id, 'person_id');
    const deviceId = body.device_id === undefined || body.device_id === null || body.device_id === ''
      ? null
      : parseRequiredInteger(body.device_id, 'device_id');

    const measurements = {
      heart_rate: parseOptionalNumber(body.heart_rate, 'heart_rate', { integer: true, min: 20, max: 260 }),
      blood_oxygen: parseOptionalNumber(body.blood_oxygen, 'blood_oxygen', { integer: true, min: 50, max: 100 }),
      systolic_bp: parseOptionalNumber(body.systolic_bp, 'systolic_bp', { integer: true, min: 40, max: 260 }),
      diastolic_bp: parseOptionalNumber(body.diastolic_bp, 'diastolic_bp', { integer: true, min: 30, max: 180 }),
      body_temp: parseOptionalNumber(body.body_temp, 'body_temp', { min: 30, max: 45 }),
      steps: parseOptionalNumber(body.steps, 'steps', { integer: true, min: 0, max: 200000 }),
    };

    const batteryLevel = parseOptionalNumber(body.battery_level, 'battery_level', { integer: true, min: 0, max: 100 });
    const recordedAt = parseRecordedAt(body.recorded_at);

    const hasMetric = Object.values(measurements).some((value) => value !== null);
    if (!hasMetric) {
      return NextResponse.json({ error: '至少需要提供一项健康数据' }, { status: 400 });
    }

    const hasSystolic = measurements.systolic_bp !== null;
    const hasDiastolic = measurements.diastolic_bp !== null;
    if (hasSystolic !== hasDiastolic) {
      return NextResponse.json({ error: '血压数据必须同时提供 systolic_bp 和 diastolic_bp' }, { status: 400 });
    }

    const person = await db.monitoredPersons.getById(personId);
    if (!person) {
      return NextResponse.json({ error: '监测对象不存在' }, { status: 404 });
    }

    let device = null;
    if (deviceId !== null) {
      device = await db.devices.getById(deviceId);
      if (!device) {
        return NextResponse.json({ error: '设备不存在' }, { status: 404 });
      }

      if (device.person_id != null && device.person_id !== personId) {
        return NextResponse.json({ error: '设备未绑定到当前监测对象' }, { status: 400 });
      }
    }

    const insertedRecords = await db.healthRecords.insert([{
      person_id: personId,
      device_id: deviceId,
      heart_rate: measurements.heart_rate,
      blood_oxygen: measurements.blood_oxygen,
      systolic_bp: measurements.systolic_bp,
      diastolic_bp: measurements.diastolic_bp,
      body_temp: measurements.body_temp,
      steps: measurements.steps,
      recorded_at: recordedAt,
    }]);

    const insertedRecord = insertedRecords?.[0] ?? null;

    if (deviceId !== null) {
      const deviceUpdates = {
        last_sync_at: recordedAt,
        status: 'online',
      };

      if (batteryLevel !== null) {
        deviceUpdates.battery_level = batteryLevel;
      }

      await db.devices.update(deviceId, deviceUpdates);
    }

    const thresholds = await db.thresholds.get(personId);
    const createdAlarms = await createHealthAlarms({
      personId,
      deviceId,
      recordedAt,
      thresholds,
      measurements,
    });

    return NextResponse.json({
      success: true,
      record: insertedRecord,
      alarm_count: createdAlarms.length,
      alarms: createdAlarms,
      device_updated: deviceId !== null,
    });
  } catch (error) {
    console.error('Create health record error:', error);
    const status = error instanceof RequestValidationError ? 400 : 500;
    return NextResponse.json({ error: error.message || '创建健康记录失败' }, { status });
  }
}
