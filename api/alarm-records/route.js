import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

export const dynamic = 'force-dynamic';

/*按条件查询报警记录并返回分页结果*/
export async function GET(request) {
  try {
    // 初始化数据库
    db.initDB();

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('person_id');
    const alarmType = searchParams.get('alarm_type');
    const alarmLevel = searchParams.get('alarm_level');
    const acknowledged = searchParams.get('acknowledged');
    const limit = searchParams.get('limit');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('page_size') || '15', 10);

    const ackFilter =
      acknowledged === 'true'
        ? true
        : acknowledged === 'false'
          ? false
          : undefined;

    let records;
    if (personId) {
      records = await db.alarms.getByPersonId(parseInt(personId, 10), {
        acknowledged: ackFilter,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
    } else {
      records = await db.alarms.getAll({
        acknowledged: ackFilter,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
    }

    if (ackFilter === true) {
      records = records.filter((record) => record.is_acknowledged);
    } else if (ackFilter === false) {
      records = records.filter((record) => !record.is_acknowledged);
    }

    if (alarmType) {
      records = records.filter((record) => record.alarm_type === alarmType);
    }

    if (alarmLevel) {
      records = records.filter((record) => record.alarm_level === alarmLevel);
    }

    const total = records.length;
    const startIndex = Math.max(0, (page - 1) * pageSize);
    const pagedRecords = await Promise.all(
      records.slice(startIndex, startIndex + pageSize).map(async (record) => {
        const person = await db.monitoredPersons.getById(record.person_id);
        return {
          ...record,
          monitored_persons: person ? { name: person.name } : null,
        };
      })
    );

    return NextResponse.json({ records: pagedRecords, total });
  } catch (error) {
    console.error('Alarm records error:', error);
    return NextResponse.json({ error: error.message || '未知错误' }, { status: 500 });
  }
}

/*确认单条报警或批量确认全部报警*/
export async function PUT(request) {
  try {
    db.initDB();

    const body = await request.json();
    const { id, person_id, is_acknowledged, acknowledge_all } = body;

    if (acknowledge_all) {
      let updated;
      if (person_id) {
        updated = await db.alarms.acknowledgeAllByPersonId(Number(person_id), 'user');
      } else {
        updated = await db.alarms.acknowledgeAll('user');
      }
      return NextResponse.json({ success: true, updated });
    }

    if (!id) {
      return NextResponse.json({ error: '缺少 id 参数' }, { status: 400 });
    }

    if (is_acknowledged) {
      await db.alarms.acknowledge(id, 'user');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update alarm error:', error);
    return NextResponse.json({ error: error.message || '未知错误' }, { status: 500 });
  }
}
