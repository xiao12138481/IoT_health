import { NextResponse } from 'next/server';
import * as db from '@/lib/db';

/*查询血管弹性评估记录*/
export async function GET(request) {
  try {
    // 初始化数据库
    db.initDB();

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('person_id');
    const limit = searchParams.get('limit');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!personId) {
      return NextResponse.json(
        { error: '缺少人员ID参数' },
        { status: 400 }
      );
    }

    const pid = parseInt(personId, 10);
    if (Number.isNaN(pid)) {
      return NextResponse.json(
        { error: '人员ID参数无效' },
        { status: 400 }
      );
    }

    let assessments;

    if (startDate && endDate) {
      assessments = await db.vascularAssessments.getByDateRange(pid, startDate, endDate);
    } else {
      assessments = await db.vascularAssessments.getByPersonId(pid, { limit: limit ? parseInt(limit, 10) : 30 });
    }

    return NextResponse.json({ success: true, data: assessments });
  } catch (error) {
    console.error('获取血管评估记录失败:', error);
    return NextResponse.json(
      { error: '获取血管评估记录失败' },
      { status: 500 }
    );
  }
}

/*根据血压数据创建血管弹性评估记录*/
export async function POST(request) {
  try {
    const body = await request.json();
    const pid = parseInt(String(body.person_id), 10);

    // 根据血压数据进行评估
    if (body.assess_from_records && !Number.isNaN(pid) && body.assessment_date) {
      const result = await db.vascularAssessments.assessFromHealthRecords(
        pid,
        body.assessment_date
      );

      if (!result) {
        return NextResponse.json(
          { error: '血压数据不足，至少需要3次测量才能进行评估' },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, message: '血管弹性评估成功', data: result });
    }

    // 直接创建评估记录
    if (!Number.isNaN(pid) && Array.isArray(body.systolic_readings) && Array.isArray(body.diastolic_readings)) {
      const bpReadings = body.systolic_readings.map((systolic, index) => ({
        systolic_bp: systolic,
        diastolic_bp: body.diastolic_readings[index]
      })).filter((item) => item.systolic_bp !== undefined && item.diastolic_bp !== undefined);

      const assessment = db.vascularAssessments.calculateFromBloodPressures(
        bpReadings
      );

      if (!assessment) {
        return NextResponse.json(
          { error: '血压数据不足，至少需要3次测量才能进行评估' },
          { status: 400 }
        );
      }

      const record = {
        person_id: pid,
        assessment_date: body.assessment_date || new Date().toISOString().split('T')[0],
        systolic_max: assessment.systolic_max,
        systolic_min: assessment.systolic_min,
        systolic_range: assessment.systolic_range,
        diastolic_max: assessment.diastolic_max,
        diastolic_min: assessment.diastolic_min,
        diastolic_range: assessment.diastolic_range,
        health_score: assessment.health_score,
        elasticity_level: assessment.elasticity_level,
        assessment_result: assessment.assessment_result,
        findings: assessment.findings,
        recommendations: assessment.recommendations,
        bp_measurement_count: assessment.bp_measurement_count
      };

      const [inserted] = await db.vascularAssessments.insert([record]);

      return NextResponse.json({ success: true, message: '血管弹性评估成功', data: inserted });
    }

    return NextResponse.json(
      { error: '缺少必要参数' },
      { status: 400 }
    );
  } catch (error) {
    console.error('创建血管评估记录失败:', error);
    return NextResponse.json(
      { error: '创建血管评估记录失败' },
      { status: 500 }
    );
  }
}

/*删除指定血管弹性评估记录*/
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '缺少记录ID参数' },
        { status: 400 }
      );
    }

    const recordId = parseInt(id, 10);
    if (Number.isNaN(recordId)) {
      return NextResponse.json(
        { error: '记录ID参数无效' },
        { status: 400 }
      );
    }

    await db.vascularAssessments.delete(recordId);

    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除血管评估记录失败:', error);
    return NextResponse.json(
      { error: '删除血管评估记录失败' },
      { status: 500 }
    );
  }
}
