import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

export const dynamic = 'force-dynamic';

/*按人员条件查询睡眠记录和睡眠会话信息*/
export async function GET(request) {
  try {
    // 初始化数据库
    db.initDB();

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('person_id');
    const limit = parseInt(searchParams.get('limit') || '30', 10);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const scoreLevel = searchParams.get('score_level');
    const includeSession = searchParams.get('include_session') === 'true';

    if (!personId) {
      return NextResponse.json({ error: '缺少 person_id 参数' }, { status: 400 });
    }

    const pid = parseInt(personId, 10);
    const records = await db.sleepRecords.getByPersonId(pid, {
      limit,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      scoreLevel: scoreLevel || undefined,
    });

    if (!includeSession) {
      return NextResponse.json({ records });
    }

    const session =
      (await db.sleepSessions.getActiveByPersonId(pid)) ||
      (await db.sleepSessions.getLatestByPersonId(pid));
    const events = session ? await db.sleepStageEvents.getBySessionId(session.id) : [];

    return NextResponse.json({ records, session, events });
  } catch (error) {
    console.error('Sleep records error:', error);
    return NextResponse.json({ error: error.message || '未知错误' }, { status: 500 });
  }
}

/*删除单条或多条睡眠记录*/
export async function DELETE(request) {
  try {
    db.initDB();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const deleted = await db.sleepRecords.delete(parseInt(id, 10));
      return NextResponse.json({ success: true, deleted });
    }

    const body = await request.json();
    if (Array.isArray(body.ids) && body.ids.length > 0) {
      const deleted = await db.sleepRecords.deleteByIds(body.ids.map((item) => Number(item)).filter((item) => !Number.isNaN(item)));
      return NextResponse.json({ success: true, deleted });
    }

    return NextResponse.json({ error: '缺少 id 或 ids 参数' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message || '删除睡眠记录失败' }, { status: 500 });
  }
}
