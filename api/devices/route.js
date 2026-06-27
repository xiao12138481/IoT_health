import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

export const dynamic = 'force-dynamic';

class DeviceValidationError extends Error {}
class DeviceNotFoundError extends Error {}

/*解析必填文本字段*/
function parseRequiredText(value, fieldName) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    throw new DeviceValidationError(`${fieldName} 不能为空`);
  }

  return text;
}

/*解析可选文本字段*/
function parseOptionalText(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const text = value.trim();
  return text || null;
}

/*解析可选时间字段并转成 ISO 字符串*/
function parseOptionalDateTime(value, fieldName) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new DeviceValidationError(`${fieldName} 参数无效`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new DeviceValidationError(`${fieldName} 参数无效`);
  }

  return parsed.toISOString();
}

/*解析可选整数参数并校验上下限*/
function parseOptionalInteger(value, fieldName, options = {}) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed)) {
    throw new DeviceValidationError(`${fieldName} 必须为整数`);
  }

  if (options.min !== undefined && parsed < options.min) {
    throw new DeviceValidationError(`${fieldName} 不能小于 ${options.min}`);
  }

  if (options.max !== undefined && parsed > options.max) {
    throw new DeviceValidationError(`${fieldName} 不能大于 ${options.max}`);
  }

  return parsed;
}

/*解析设备在线状态参数*/
function parseStatus(value) {
  if (value === undefined || value === null || value === '') {
    return 'offline';
  }

  if (value === 'online' || value === 'offline') {
    return value;
  }

  throw new DeviceValidationError('status 参数无效');
}

/*解析并校验单个设备 ID*/
function parseDeviceId(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new DeviceValidationError('id 参数无效');
  }

  return parsed;
}

/*解析并校验批量设备 ID 列表*/
function parseDeviceIds(values) {
  const ids = Array.isArray(values)
    ? values
        .map((item) => Number.parseInt(String(item), 10))
        .filter((item) => Number.isInteger(item) && item > 0)
    : [];

  if (ids.length === 0) {
    throw new DeviceValidationError('ids 参数无效');
  }

  return ids;
}

/*校验绑定的人员是否存在*/
async function ensurePersonExists(personId) {
  if (personId === null) {
    return;
  }

  const person = await db.monitoredPersons.getById(personId);
  if (!person) {
    throw new DeviceNotFoundError('绑定人员不存在');
  }
}

/*查询设备列表或单个设备详情*/
export async function GET(request) {
  try {
    db.initDB();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const deviceId = parseDeviceId(id);
      const healthPage = parseOptionalInteger(searchParams.get('health_page'), 'health_page', { min: 1 }) ?? 1;
      const healthPageSize = parseOptionalInteger(searchParams.get('health_page_size'), 'health_page_size', { min: 1, max: 20 }) ?? 5;
      const alarmPage = parseOptionalInteger(searchParams.get('alarm_page'), 'alarm_page', { min: 1 }) ?? 1;
      const alarmPageSize = parseOptionalInteger(searchParams.get('alarm_page_size'), 'alarm_page_size', { min: 1, max: 20 }) ?? 5;
      const device = await db.devices.getDetailById(deviceId, {
        healthPage,
        healthPageSize,
        alarmPage,
        alarmPageSize,
      });
      if (!device) {
        return NextResponse.json({ error: '设备不存在' }, { status: 404 });
      }

      return NextResponse.json({ device });
    }

    const devices = await db.devices.getAllWithPersons();
    return NextResponse.json({ devices });
  } catch (error) {
    console.error('Devices error:', error);
    const status = error instanceof DeviceValidationError ? 400 : error instanceof DeviceNotFoundError ? 404 : 500;
    return NextResponse.json({ error: error.message || '未知错误' }, { status });
  }
}

/*新增一台设备并可选绑定人员*/
export async function POST(request) {
  try {
    db.initDB();

    const body = await request.json();
    const name = parseRequiredText(body.name, 'name');
    const model = parseRequiredText(body.model, 'model');
    const firmwareVersion = parseOptionalText(body.firmware_version);
    const batteryLevel = parseOptionalInteger(body.battery_level, 'battery_level', { min: 0, max: 100 });
    const personId = parseOptionalInteger(body.person_id, 'person_id', { min: 1 });
    const status = parseStatus(body.status);

    await ensurePersonExists(personId);

    const inserted = await db.devices.insert([{
      name,
      model,
      firmware_version: firmwareVersion,
      battery_level: batteryLevel ?? 100,
      status,
      person_id: personId,
      last_sync_at: status === 'online' ? new Date().toISOString() : null,
    }]);

    return NextResponse.json({
      success: true,
      device: inserted?.[0] ?? null,
    });
  } catch (error) {
    console.error('Create device error:', error);
    const status = error instanceof DeviceValidationError ? 400 : error instanceof DeviceNotFoundError ? 404 : 500;
    return NextResponse.json({ error: error.message || '新增设备失败' }, { status });
  }
}

/*更新单台或多台设备信息*/
export async function PUT(request) {
  try {
    db.initDB();
    const body = await request.json();
    const ids = Array.isArray(body.ids) ? parseDeviceIds(body.ids) : null;
    const id = ids ? null : parseDeviceId(body.id);
    const name = body.name === undefined ? undefined : parseRequiredText(body.name, 'name');
    const model = body.model === undefined ? undefined : parseRequiredText(body.model, 'model');
    const firmwareVersion = body.firmware_version === undefined ? undefined : parseOptionalText(body.firmware_version);
    const batteryLevel = body.battery_level === undefined
      ? undefined
      : parseOptionalInteger(body.battery_level, 'battery_level', { min: 0, max: 100 });
    const personId = body.person_id === undefined
      ? undefined
      : parseOptionalInteger(body.person_id, 'person_id', { min: 1 });
    const status = body.status === undefined ? undefined : parseStatus(body.status);
    const lastSyncAt = parseOptionalDateTime(body.last_sync_at, 'last_sync_at');

    if (personId !== undefined) {
      await ensurePersonExists(personId);
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (model !== undefined) updates.model = model;
    if (firmwareVersion !== undefined) updates.firmware_version = firmwareVersion;
    if (batteryLevel !== undefined) updates.battery_level = batteryLevel;
    if (personId !== undefined) updates.person_id = personId;
    if (status !== undefined) updates.status = status;
    if (lastSyncAt !== undefined) updates.last_sync_at = lastSyncAt;

    if (ids) {
      const updated = await db.devices.updateByIds(ids, updates);
      return NextResponse.json({ success: true, updated });
    }

    const existing = await db.devices.getById(id);
    if (!existing) {
      return NextResponse.json({ error: '设备不存在' }, { status: 404 });
    }

    await db.devices.update(id, updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update device error:', error);
    const status = error instanceof DeviceValidationError ? 400 : error instanceof DeviceNotFoundError ? 404 : 500;
    return NextResponse.json({ error: error.message || '未知错误' }, { status });
  }
}

/*删除单台或多台设备记录*/
export async function DELETE(request) {
  try {
    db.initDB();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const deviceId = parseDeviceId(id);
      const existing = await db.devices.getById(deviceId);
      if (!existing) {
        return NextResponse.json({ error: '设备不存在' }, { status: 404 });
      }

      const bindingSummary = db.devices.getBindingSummaryByIds([deviceId]);
      const deleted = await db.devices.delete(deviceId);
      return NextResponse.json({ success: true, deleted, binding_summary: bindingSummary });
    }

    const body = await request.json();
    const ids = parseDeviceIds(body.ids);
    const bindingSummary = db.devices.getBindingSummaryByIds(ids);
    const deleted = await db.devices.deleteByIds(ids);
    return NextResponse.json({ success: true, deleted, binding_summary: bindingSummary });
  } catch (error) {
    console.error('Delete device error:', error);
    const status = error instanceof DeviceValidationError ? 400 : error instanceof DeviceNotFoundError ? 404 : 500;
    return NextResponse.json({ error: error.message || '删除设备失败' }, { status });
  }
}
