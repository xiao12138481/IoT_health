import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { getAiRuntimeConfig } from '@/lib/ai-runtime-config';

export const dynamic = 'force-dynamic';

/*调用 AI 生成睡眠分析报告正文*/
async function generateSleepReportWithAI(personId, sleepRecord, person) {
  const config = await getAiRuntimeConfig();
  const ollamaHost = config.host;
  const model = config.selectedModel;

  const systemPrompt = `你是一位专业的睡眠健康专家。请根据提供的睡眠数据，生成一份专业、友好且实用的睡眠分析报告。

请以 JSON 格式返回报告，格式如下：
{
  "report_title": "睡眠分析报告",
  "report_summary": "简短的总结，约 100-150 字，必须包含具体的睡眠质量评估、时长分析和改进建议",
  "analysis": "详细的分析内容，约 200-300 字",
  "suggestions": ["建议1", "建议2", "建议3", "建议4", "建议5"],
  "risks": ["风险1", "风险2"]
}

要求：
1. report_summary 必须包含具体内容：睡眠质量评分、总时长、深睡占比、主要问题和改进方向
2. 分析要客观，基于数据给出合理判断
3. 建议要具体、可操作，每条约 30-50 字
4. 风险提示要清晰明确，无明显风险时返回空数组
5. 整体语言要专业但友好，避免使用过于生硬的医学术语
6. 必须严格返回 JSON 格式，不要包含任何额外说明文字`;

  const userPrompt = `用户信息：
姓名：${person?.name || '未知'}
年龄：${person?.age || '未知'}
性别：${person?.gender || '未知'}

睡眠数据详情：
- 入睡时间：${sleepRecord.start_time || '未知'}
- 起床时间：${sleepRecord.end_time || '未知'}
- 总睡眠时长：${sleepRecord.deep_sleep_min + sleepRecord.light_sleep_min + sleepRecord.rem_sleep_min + sleepRecord.awake_min || 0} 分钟 (约 ${Math.round((sleepRecord.deep_sleep_min + sleepRecord.light_sleep_min + sleepRecord.rem_sleep_min + sleepRecord.awake_min) / 60)} 小时)
- 深度睡眠：${sleepRecord.deep_sleep_min || 0} 分钟 (占比 ${Math.round(sleepRecord.deep_sleep_min / (sleepRecord.deep_sleep_min + sleepRecord.light_sleep_min + sleepRecord.rem_sleep_min + sleepRecord.awake_min) * 100)}%)
- 浅度睡眠：${sleepRecord.light_sleep_min || 0} 分钟
- REM睡眠：${sleepRecord.rem_sleep_min || 0} 分钟 (占比 ${Math.round(sleepRecord.rem_sleep_min / (sleepRecord.deep_sleep_min + sleepRecord.light_sleep_min + sleepRecord.rem_sleep_min + sleepRecord.awake_min) * 100)}%)
- 清醒时长：${sleepRecord.awake_min || 0} 分钟 (占比 ${Math.round(sleepRecord.awake_min / (sleepRecord.deep_sleep_min + sleepRecord.light_sleep_min + sleepRecord.rem_sleep_min + sleepRecord.awake_min) * 100)}%)
- 睡眠质量评分：${sleepRecord.score || 0} 分
- 睡眠质量等级：${sleepRecord.score >= 85 ? '优秀' : sleepRecord.score >= 75 ? '良好' : sleepRecord.score >= 60 ? '一般' : '较差'}

请根据以上信息生成一份专业的睡眠分析报告。特别注意：
1. report_summary 必须包含具体的睡眠质量评估、时长分析和改进建议
2. 分析要基于提供的具体数据
3. 建议要实用、可操作`;

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
      throw new Error(`AI 服务调用失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const aiOutput = result.response || '';
    console.log('AI原始输出:', aiOutput.substring(0, 500)); // 只显示前500字符
    
    let aiReport;
    try {
      // 首先尝试直接解析
      aiReport = JSON.parse(aiOutput);
      console.log('直接JSON解析成功:', aiReport);
    } catch (parseError) {
      console.log('直接解析失败，尝试提取JSON:', parseError.message);
      
      // 尝试从输出中提取JSON
      const jsonMatch = aiOutput.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          aiReport = JSON.parse(jsonMatch[0]);
          console.log('提取JSON解析成功:', aiReport);
        } catch (extractError) {
          console.error('提取的JSON解析失败:', extractError.message);
          console.error('提取的内容:', jsonMatch[0]);
          throw new Error('AI 无法生成报告，返回格式无效');
        }
      } else {
        console.error('无法从AI输出中找到JSON格式内容');
        console.error('AI输出内容:', aiOutput);
        throw new Error('AI 无法生成报告，未返回有效格式');
      }
    }

    // 验证必需的字段
    if (!aiReport.report_title || !aiReport.report_summary) {
      throw new Error('AI 无法生成完整的报告内容');
    }

    return {
      report_title: aiReport.report_title || '睡眠分析报告',
      report_summary: aiReport.report_summary || '',
      analysis: aiReport.analysis || '',
      suggestions: Array.isArray(aiReport.suggestions) ? aiReport.suggestions : [],
      risks: Array.isArray(aiReport.risks) ? aiReport.risks : [],
      generated_by: 'ai'
    };
  } catch (error) {
    console.error('AI 生成报告失败:', error);
    throw error;
  }
}

/*按人员或报告编号查询睡眠报告*/
export async function GET(request) {
  try {
    db.initDB();

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('person_id');
    const reportId = searchParams.get('id');
    const sleepLevel = searchParams.get('sleep_level');
    const generatedBy = searchParams.get('generated_by');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const limit = Number(searchParams.get('limit') || '30');

    if (reportId) {
      const report = await db.sleepReports.getById(Number(reportId));
      if (!report) {
        return NextResponse.json({ error: '报告不存在' }, { status: 404 });
      }
      return NextResponse.json({ report });
    }

    if (!personId) {
      return NextResponse.json({ error: '缺少 person_id 参数' }, { status: 400 });
    }

    const reports = await db.sleepReports.getByPersonId(Number(personId), {
      sleepLevel: sleepLevel || undefined,
      generatedBy: generatedBy || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      limit,
    });

    return NextResponse.json({ reports, data: reports });
  } catch (error) {
    return NextResponse.json({ error: error.message || '获取睡眠报告失败' }, { status: 500 });
  }
}

/*基于睡眠记录生成规则版或 AI 版报告*/
export async function POST(request) {
  try {
    db.initDB();
    const body = await request.json();
    const personId = Number(body.person_id);
    const sourceSleepRecordId = Number(body.sleep_record_id);
    const useAI = body.use_ai === true;

    if (Number.isNaN(personId)) {
      return NextResponse.json({ error: '缺少有效的 person_id 参数' }, { status: 400 });
    }

    const sleepRecords = await db.sleepRecords.getByPersonId(personId, { limit: 200 });
    const targetRecord = !Number.isNaN(sourceSleepRecordId)
      ? sleepRecords.find((record) => record.id === sourceSleepRecordId)
      : sleepRecords[0];

    if (!targetRecord) {
      return NextResponse.json({ error: '缺少可用于生成报告的睡眠记录' }, { status: 400 });
    }

    if (useAI) {
      // 使用AI生成报告
      const person = await db.monitoredPersons.getById(personId);
      const aiContent = await generateSleepReportWithAI(personId, targetRecord, person);
      console.log('AI生成的内容成功:', aiContent);
      
      // 先创建报告
      const report = await db.sleepReports.createFromSleepRecord(personId, targetRecord, {
        generatedBy: 'ai'
      });
      
      // 更新报告内容
      const updates = {
        report_title: aiContent.report_title || report.report_title,
        report_summary: aiContent.report_summary || report.report_summary,
        analysis: aiContent.analysis || report.analysis,
        suggestions: aiContent.suggestions || report.suggestions,
        risk_flags: aiContent.risks || report.risk_flags || []
      };
      
      await db.sleepReports.update(report.id, updates);
      Object.assign(report, updates);
      
      return NextResponse.json({ 
        success: true, 
        report, 
        message: 'AI生成睡眠分析报告成功' 
      });
    } else {
      // 使用规则引擎生成报告
      const report = await db.sleepReports.createFromSleepRecord(personId, targetRecord, {
        generatedBy: 'rules'
      });
      
      return NextResponse.json({ 
        success: true, 
        report, 
        message: '睡眠报告生成成功' 
      });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message || '生成睡眠报告失败' }, { status: 500 });
  }
}

/*删除单条睡眠报告或清空指定人员全部报告*/
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

      const deletedCount = await db.sleepReports.deleteByPersonId(Number(personId));
      return NextResponse.json({
        success: true,
        deletedCount,
        message: `成功删除 ${deletedCount} 条睡眠报告`,
      });
    }

    if (Number.isNaN(reportId)) {
      return NextResponse.json({ error: '缺少有效的 id 参数' }, { status: 400 });
    }

    await db.sleepReports.delete(reportId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || '删除睡眠报告失败' }, { status: 500 });
  }
}
