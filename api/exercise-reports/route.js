import { NextResponse } from 'next/server';
import * as db from '@/lib/db';

export const dynamic = 'force-dynamic';

/*按快捷范围计算运动报告时间区间*/
function resolveDateRange(rangeKey) {
  const end = new Date();
  const start = new Date();

  if (rangeKey === '30d') {
    start.setDate(start.getDate() - 29);
  } else {
    start.setDate(start.getDate() - 6);
  }

  start.setHours(0, 0, 0, 0);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/*按人员条件查询运动报告*/
export async function GET(request) {
  try {
    db.initDB();

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('person_id');
    const reportId = searchParams.get('id');
    const limit = searchParams.get('limit');
    const activityLevel = searchParams.get('activity_level');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (reportId) {
      const report = await db.exerciseReports.getById(Number(reportId));
      if (!report) {
        return NextResponse.json({ error: '报告不存在' }, { status: 404 });
      }

      return NextResponse.json({ report });
    }

    if (!personId) {
      return NextResponse.json({ error: '缺少 person_id 参数' }, { status: 400 });
    }

    const pid = Number(personId);
    if (Number.isNaN(pid)) {
      return NextResponse.json({ error: 'person_id 参数无效' }, { status: 400 });
    }

    const reports = await db.exerciseReports.getByPersonId(pid, {
      limit: limit ? Number(limit) : undefined,
      activityLevel: activityLevel || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });

    return NextResponse.json({ reports, data: reports });
  } catch (error) {
    console.error('获取运动报告失败:', error);
    return NextResponse.json({ error: error.message || '获取运动报告失败' }, { status: 500 });
  }
}

/*基于步数记录生成运动报告*/
export async function POST(request) {
  try {
    db.initDB();

    const body = await request.json();
    const personId = Number(body.person_id);

    if (Number.isNaN(personId)) {
      return NextResponse.json({ error: '缺少有效的 person_id 参数' }, { status: 400 });
    }

    const range = typeof body.range === 'string' ? body.range : '7d';
    const { start, end } = resolveDateRange(range);
    const healthRecords = await db.healthRecords.getByPersonId(personId, {
      startDate: start,
      endDate: end,
      limit: 2000,
    });
    const stepRecords = healthRecords.filter((record) => typeof record.steps === 'number' && record.steps > 0);

    if (!stepRecords.length) {
      return NextResponse.json({ error: '当前时间范围内暂无可用于生成报告的运动数据' }, { status: 400 });
    }

    const threshold = await db.thresholds.get(personId);
    const report = await db.exerciseReports.createFromHealthRecords(personId, stepRecords, {
      reportStart: start,
      reportEnd: end,
      goalSteps: threshold.steps_goal,
    });

    return NextResponse.json({
      success: true,
      message: '运动报告生成成功',
      report,
    });
  } catch (error) {
    console.error('生成运动报告失败:', error);
    return NextResponse.json({ error: error.message || '生成运动报告失败' }, { status: 500 });
  }
}

/*删除单条运动报告或清空指定人员全部报告*/
export async function DELETE(request) {
  try {
    db.initDB();

    const { searchParams } = new URL(request.url);
    const deleteAll = searchParams.get('deleteAll') === 'true';
    const personId = searchParams.get('personId');
    const reportId = Number(searchParams.get('id'));

    if (deleteAll) {
      if (!personId || Number.isNaN(Number(personId))) {
        return NextResponse.json({ error: '缺少有效的 personId 参数' }, { status: 400 });
      }

      const deletedCount = await db.exerciseReports.deleteByPersonId(Number(personId));
      return NextResponse.json({
        success: true,
        deletedCount,
        message: `成功删除 ${deletedCount} 条运动报告`,
      });
    }

    if (Number.isNaN(reportId)) {
      return NextResponse.json({ error: '缺少有效的 id 参数' }, { status: 400 });
    }

    await db.exerciseReports.delete(reportId);
    return NextResponse.json({ success: true, message: '报告删除成功' });
  } catch (error) {
    console.error('删除运动报告失败:', error);
    return NextResponse.json({ error: error.message || '删除运动报告失败' }, { status: 500 });
  }
}
