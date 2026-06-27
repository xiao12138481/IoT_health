import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { getAiRuntimeConfig } from '@/lib/ai-runtime-config';

export const dynamic = 'force-dynamic';

/*按快捷范围计算压力报告时间区间*/
function resolveDateRange(rangeKey) {
  const end = new Date();
  const start = new Date();

  if (rangeKey === '3d') {
    start.setDate(start.getDate() - 3);
  } else if (rangeKey === '7d') {
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

/*按人员条件查询压力情绪报告*/
export async function GET(request) {
  try {
    db.initDB();

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('person_id');
    const reportId = searchParams.get('id');
    const limit = searchParams.get('limit');
    const stressLevel = searchParams.get('stress_level');
    const generatedBy = searchParams.get('generated_by');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (reportId) {
      const report = await db.stressMoodReports.getById(Number(reportId));
      if (!report) {
        return NextResponse.json({ report });
      }
      return NextResponse.json({ error: '报告不存在' }, { status: 404 });
    }

    if (!personId) {
      return NextResponse.json({ error: '缺少 person_id 参数' }, { status: 400 });
    }

    const pid = Number(personId);
    if (Number.isNaN(pid)) {
      return NextResponse.json({ error: 'person_id 参数无效' }, { status: 400 });
    }

    const reports = await db.stressMoodReports.getByPersonId(pid, {
      limit: limit ? Number(limit) : undefined,
      stressLevel: stressLevel || undefined,
      generatedBy: generatedBy || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });

    return NextResponse.json({ reports, data: reports });
  } catch (error) {
    console.error('获取压力与情绪报告失败:', error);
    return NextResponse.json({ error: error.message || '获取压力与情绪报告失败' }, { status: 500 });
  }
}

/*调用 AI 生成压力情绪报告正文*/
async function generateReportWithAI(personId, heartRateRecords, person, reportStart, reportEnd) {
  const config = await getAiRuntimeConfig();
  const ollamaHost = config.host;
  const model = config.selectedModel;

  // 格式化数据供 AI 使用
  const stats = {
    total: heartRateRecords.length,
    avgHr: heartRateRecords.length > 0 
      ? Math.round(heartRateRecords.reduce((a, r) => a + (r.heart_rate || 0), 0) / heartRateRecords.length) 
      : 0,
    minHr: heartRateRecords.length > 0 
      ? Math.min(...heartRateRecords.map(r => r.heart_rate || 0)) 
      : 0,
    maxHr: heartRateRecords.length > 0 
      ? Math.max(...heartRateRecords.map(r => r.heart_rate || 0)) 
      : 0,
  };

  const systemPrompt = `你是一位专业的健康管理师和压力评估专家。请根据提供的心率数据和用户信息，生成一份专业、友好且实用的压力与情绪健康报告。

请以 JSON 格式返回报告，格式如下：
{
  "report_title": "压力与情绪健康报告",
  "report_summary": "简短的总结，约 100-150 字",
  "analysis": "详细的分析内容，约 300-400 字",
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

心率数据统计：
- 采样数量：${stats.total} 条
- 平均心率：${stats.avgHr} bpm
- 最低心率：${stats.minHr} bpm
- 最高心率：${stats.maxHr} bpm

请根据以上信息生成一份专业的压力与情绪健康报告。`;

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
      // 如果解析失败，尝试提取 JSON
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

    // 使用现有的规则引擎生成基础报告数据结构，然后用 AI 结果覆盖文本部分
    const baseReport = await db.stressMoodReports.createFromHeartRateRecords(personId, heartRateRecords, {
      reportStart,
      reportEnd,
      generatedBy: 'ai'
    });

    // 更新报告的文本内容为 AI 生成的内容
    const updates = {
      report_title: aiReport.report_title || baseReport.report_title,
      report_summary: aiReport.report_summary || baseReport.report_summary,
      analysis: aiReport.analysis || baseReport.analysis,
      recommendations: Array.isArray(aiReport.recommendations) 
        ? aiReport.recommendations 
        : baseReport.recommendations,
      risk_flags: Array.isArray(aiReport.risk_flags) 
        ? aiReport.risk_flags 
        : baseReport.risk_flags
    };

    // 更新数据库中的报告
    await db.stressMoodReports.update(baseReport.id, updates);
    
    // 更新返回的对象
    Object.assign(baseReport, updates);

    return baseReport;
  } catch (error) {
    console.error('AI 生成报告失败:', error);
    throw error;
  }
}

/*基于心率记录生成规则版或 AI 版压力报告*/
export async function POST(request) {
  try {
    db.initDB();

    const body = await request.json();
    const personId = Number(body.person_id);

    if (Number.isNaN(personId)) {
      return NextResponse.json({ error: '缺少有效的 person_id 参数' }, { status: 400 });
    }

    const useAI = body.use_ai === true;
    const requestedRange = typeof body.range === 'string' ? body.range : '1d';
    const { start, end } = resolveDateRange(requestedRange);
    const heartRateRecords = await db.healthRecords.getByPersonId(personId, {
      type: 'heart_rate',
      startDate: start,
      endDate: end,
      limit: 1000,
    });

    if (!heartRateRecords.length) {
      return NextResponse.json({ error: '当前时间范围内暂无可用于生成报告的心率数据' }, { status: 400 });
    }

    let report;
    if (useAI) {
      // 获取用户信息供 AI 使用
      const person = await db.monitoredPersons.getById(personId);
      report = await generateReportWithAI(personId, heartRateRecords, person, start, end);
    } else {
      // 使用现有的规则引擎
      report = await db.stressMoodReports.createFromHeartRateRecords(personId, heartRateRecords, {
        reportStart: start,
        reportEnd: end,
        generatedBy: 'rules'
      });
    }

    return NextResponse.json({
      success: true,
      message: useAI ? 'AI 生成压力与情绪报告成功' : '压力与情绪报告生成成功',
      report,
    });
  } catch (error) {
    console.error('生成压力与情绪报告失败:', error);
    return NextResponse.json({ error: error.message || '生成压力与情绪报告失败' }, { status: 500 });
  }
}

/*删除单条压力报告或清空指定人员全部报告*/
export async function DELETE(request) {
  try {
    db.initDB();

    const { searchParams } = new URL(request.url);
    const deleteAll = searchParams.get('deleteAll') === 'true';
    const personId = Number(searchParams.get('personId'));
    const reportId = Number(searchParams.get('id'));

    if (deleteAll) {
      if (Number.isNaN(personId)) {
        return NextResponse.json({ error: '缺少有效的 personId 参数' }, { status: 400 });
      }

      const deletedCount = await db.stressMoodReports.deleteByPersonId(personId);
      return NextResponse.json({
        success: true,
        message: '该用户的全部压力与情绪报告已删除',
        deletedCount,
      });
    }

    if (Number.isNaN(reportId)) {
      return NextResponse.json({ error: '缺少有效的 id 参数' }, { status: 400 });
    }

    await db.stressMoodReports.delete(reportId);
    return NextResponse.json({ success: true, message: '报告删除成功' });
  } catch (error) {
    console.error('删除压力与情绪报告失败:', error);
    return NextResponse.json({ error: error.message || '删除压力与情绪报告失败' }, { status: 500 });
  }
}
