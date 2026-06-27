import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { getAiRuntimeConfig } from '@/lib/ai-runtime-config';

export const dynamic = 'force-dynamic';

/*调用 AI 生成血管弹性评估报告正文*/
async function generateVascularReportWithAI(personId, bpRecords, assessment, person, reportStart, reportEnd) {
  const config = await getAiRuntimeConfig();
  const ollamaHost = config.host;
  const model = config.selectedModel;

  const systemPrompt = `你是一位专业的心血管健康专家。请根据提供的血压数据和血管弹性评估，生成一份专业、友好且实用的血管健康报告。

请以 JSON 格式返回报告，格式如下：
{
  "report_title": "血管弹性评估报告",
  "report_summary": "简短的总结，约 100-150 字",
  "findings": "详细的分析结果，约 200-300 字",
  "assessment_result": "评估结论，约 100 字",
  "recommendations": ["建议1", "建议2", "建议3", "建议4", "建议5"],
  "risk_flags": ["风险1", "风险2"]
}

要求：
1. 分析要客观，基于数据给出合理判断
2. 建议要具体、可操作，每条约 30-50 字
3. 风险提示要清晰明确，无明显风险时返回空数组
4. 整体语言要专业但友好，避免使用过于生硬的医学术语
5. 必须严格返回 JSON 格式，不要包含任何额外说明文字`;

  const userPrompt = `用户信息：
姓名：${person?.name || '未知'}
年龄：${person?.age || '未知'}
性别：${person?.gender || '未知'}

数据时间范围：${new Date(reportStart).toLocaleString('zh-CN')} - ${new Date(reportEnd).toLocaleString('zh-CN')}

血压数据统计：
- 测量次数：${bpRecords.length} 次
- 收缩压：${assessment.systolic_min} ~ ${assessment.systolic_max} mmHg，极差：${assessment.systolic_range} mmHg
- 舒张压：${assessment.diastolic_min} ~ ${assessment.diastolic_max} mmHg，极差：${assessment.diastolic_range} mmHg
- 血管健康评分：${assessment.health_score} 分
- 弹性等级：${assessment.elasticity_level}

请根据以上信息生成一份专业的血管健康评估报告。`;

  try {
    // 首先检查AI服务是否可用
    console.log('检查AI服务可用性:', ollamaHost, '模型:', model);
    
    const healthCheck = await fetch(`${ollamaHost}/api/tags`, { method: 'GET' }).catch(() => null);
    if (!healthCheck || !healthCheck.ok) {
      throw new Error('AI 服务不可用，请检查 Ollama 服务是否运行');
    }

    const response = await fetch(`${ollamaHost}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        stream: false,
        format: 'json',
        options: {
          temperature: 0.3,
          num_predict: 1500,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`AI 服务调用失败: ${response.status}`);
    }

    const result = await response.json();
    const aiOutput = result.response || '';
    
    let aiReport;
    try {
      aiReport = JSON.parse(aiOutput);
    } catch {
      const jsonMatch = aiOutput.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          aiReport = JSON.parse(jsonMatch[0]);
        } catch {
          throw new Error('AI 无法生成报告，返回格式无效');
        }
      } else {
        throw new Error('AI 无法生成报告，未返回有效格式');
      }
    }

    // 验证必需的字段
    if (!aiReport.report_title || !aiReport.report_summary) {
      throw new Error('AI 无法生成完整的报告内容');
    }

    return {
      ...assessment,
      report_title: aiReport.report_title || '血管弹性评估报告',
      report_summary: aiReport.report_summary || assessment.findings || '',
      findings: aiReport.findings || assessment.findings || '',
      assessment_result: aiReport.assessment_result || assessment.assessment_result || '',
      recommendations: Array.isArray(aiReport.recommendations) ? aiReport.recommendations : assessment.recommendations || [],
      risk_flags: Array.isArray(aiReport.risk_flags) ? aiReport.risk_flags : assessment.risk_flags || [],
      generated_by: 'ai'
    };
  } catch (error) {
    console.error('AI 生成报告失败:', error);
    throw error;
  }
}

/*按快捷范围计算血管评估报告时间区间*/
function resolveDateRange(rangeKey) {
  const end = new Date();
  const start = new Date();

  if (rangeKey === '7d') {
    start.setDate(start.getDate() - 7);
  } else if (rangeKey === '30d') {
    start.setDate(start.getDate() - 30);
  } else {
    start.setDate(start.getDate() - 1);
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/*按人员条件查询血管评估报告*/
export async function GET(request) {
  try {
    db.initDB();

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('person_id');
    const reportId = searchParams.get('id');
    const limit = searchParams.get('limit');
    const elasticityLevel = searchParams.get('elasticity_level');
    const generatedBy = searchParams.get('generated_by');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (reportId) {
      const report = await db.vascularAssessmentReports.getById(Number(reportId));
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

    const reports = await db.vascularAssessmentReports.getByPersonId(pid, {
      limit: limit ? Number(limit) : undefined,
      elasticityLevel: elasticityLevel || undefined,
      generatedBy: generatedBy || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });

    return NextResponse.json({ reports, data: reports });
  } catch (error) {
    console.error('获取血管评估报告失败:', error);
    return NextResponse.json({ error: error.message || '获取血管评估报告失败' }, { status: 500 });
  }
}

/*基于血压记录生成规则版或 AI 版血管评估报告*/
export async function POST(request) {
  try {
    db.initDB();

    const body = await request.json();
    const personId = Number(body.person_id);
    const useAI = body.use_ai === true;

    if (Number.isNaN(personId)) {
      return NextResponse.json({ error: '缺少有效的 person_id 参数' }, { status: 400 });
    }

    const range = typeof body.range === 'string' ? body.range : '30d';
    const { start, end } = resolveDateRange(range);
    const bpRecords = await db.healthRecords.getByPersonId(personId, {
      type: 'blood_pressure',
      startDate: start,
      endDate: end,
      limit: 1000,
    });

    if (bpRecords.length < 3) {
      return NextResponse.json({ error: '当前时间范围内血压数据不足，至少需要 3 次测量才能生成报告' }, { status: 400 });
    }

    let assessment = db.vascularAssessments.calculateFromBloodPressures(bpRecords);
    if (!assessment) {
      return NextResponse.json({ error: '血压数据不足，无法生成评估报告' }, { status: 400 });
    }

    const person = await db.monitoredPersons.getById(personId);
    
    if (useAI) {
      assessment = await generateVascularReportWithAI(personId, bpRecords, assessment, person, start, end);
    } else {
      assessment.generated_by = 'rules';
    }

    const assessmentDate = new Date().toISOString().split('T')[0];
    const [insertedAssessment] = await db.vascularAssessments.insert([
      {
        person_id: personId,
        assessment_date: assessmentDate,
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
        bp_measurement_count: assessment.bp_measurement_count,
        recorded_at: end,
      },
    ]);

    const report = await db.vascularAssessmentReports.createFromAssessment(personId, insertedAssessment, {
      reportStart: start,
      reportEnd: end,
      generatedBy: assessment.generated_by || 'rules'
    });

    // 如果是 AI 生成的，还需要更新报告的文本内容
    if (assessment.generated_by === 'ai') {
      const updates = {};
      if (assessment.report_title) updates.report_title = assessment.report_title;
      if (assessment.report_summary) updates.report_summary = assessment.report_summary;
      if (assessment.findings) updates.findings = assessment.findings;
      if (assessment.assessment_result) updates.assessment_result = assessment.assessment_result;
      if (assessment.recommendations) updates.recommendations = assessment.recommendations;
      if (assessment.risk_flags) updates.risk_flags = assessment.risk_flags;
      
      // 确保 blood_pressure_summary 是数组格式
      if (assessment.blood_pressure_summary) {
        if (!Array.isArray(assessment.blood_pressure_summary)) {
          // 如果不是数组，使用默认的数组格式
          updates.blood_pressure_summary = [
            `收缩压范围 ${assessment.systolic_min}~${assessment.systolic_max} mmHg，极差 ${assessment.systolic_range} mmHg`,
            `舒张压范围 ${assessment.diastolic_min}~${assessment.diastolic_max} mmHg，极差 ${assessment.diastolic_range} mmHg`,
            `共纳入 ${assessment.bp_measurement_count ?? 0} 次血压测量`,
          ];
        } else {
          updates.blood_pressure_summary = assessment.blood_pressure_summary;
        }
      }
      
      if (Object.keys(updates).length > 0) {
        await db.vascularAssessmentReports.update(report.id, updates);
        Object.assign(report, updates);
      }
    }

    return NextResponse.json({
      success: true,
      message: useAI ? 'AI生成血管弹性评估报告成功' : '血管弹性评估报告生成成功',
      report,
      assessment: insertedAssessment,
    });
  } catch (error) {
    console.error('生成血管评估报告失败:', error);
    return NextResponse.json({ error: error.message || '生成血管评估报告失败' }, { status: 500 });
  }
}

/*删除单条血管评估报告或清空指定人员全部报告*/
export async function DELETE(request) {
  try {
    db.initDB();

    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('id');
    const deleteAll = searchParams.get('deleteAll') === 'true';
    const personId = searchParams.get('personId');

    if (deleteAll) {
      if (!personId || Number.isNaN(Number(personId))) {
        return NextResponse.json({ error: '缺少有效的 personId 参数' }, { status: 400 });
      }
      
      const result = await db.vascularAssessmentReports.deleteAllByPersonId(Number(personId));
      return NextResponse.json({ 
        success: true, 
        deletedCount: result.totalDeleted,
        reportsDeleted: result.reportsDeleted,
        assessmentsDeleted: result.assessmentsDeleted,
        message: `成功删除 ${result.reportsDeleted} 条报告和 ${result.assessmentsDeleted} 条评估记录，总计 ${result.totalDeleted} 条数据` 
      });
    }

    // 检查是否是批量删除
    if (request.headers.get('content-type')?.includes('application/json')) {
      const body = await request.json();
      if (body.ids && Array.isArray(body.ids)) {
        const deletedCount = await db.vascularAssessmentReports.deleteByIds(body.ids);
        return NextResponse.json({ 
          success: true, 
          deletedCount,
          message: `成功删除 ${deletedCount} 条报告和对应的评估记录` 
        });
      }
    }

    // 单个删除
    if (!reportId || Number.isNaN(Number(reportId))) {
      return NextResponse.json({ error: '缺少有效的 id 参数' }, { status: 400 });
    }

    const deleted = await db.vascularAssessmentReports.delete(Number(reportId));
    return NextResponse.json({ 
      success: deleted, 
      message: deleted ? '报告删除成功' : '报告不存在' 
    });
  } catch (error) {
    console.error('删除血管评估报告失败:', error);
    return NextResponse.json({ error: error.message || '删除血管评估报告失败' }, { status: 500 });
  }
}
