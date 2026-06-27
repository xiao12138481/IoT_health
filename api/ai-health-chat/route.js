/**
 * AI健康对话API
 * 功能描述：
 * - 处理用户健康问题
 * - 调用Ollama中的大模型生成回答
 * - 支持结合健康数据回答
 * - 清理和标准化AI输出
 * 
 * 关联页面：
 * - 管理员健康总览
 * - 用户健康总览
 * 
 * 关联组件：
 * - HealthAiInsight
 */

import { NextResponse } from 'next/server';
import { getAiRuntimeConfig } from '@/lib/ai-runtime-config';

export const dynamic = 'force-dynamic';

const DEFAULT_DISCLAIMER = '以上内容仅供健康管理参考，不替代医生诊断。';

/*读取 Ollama 当前可用的模型列表*/
async function fetchOllamaModels(host) {
  const response = await fetch(`${host}/api/tags`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `模型列表获取失败（${response.status}）`);
  }

  const result = await response.json();
  return Array.isArray(result.models)
    ? result.models
      .map((item) => String(item?.name || '').trim())
      .filter(Boolean)
    : [];
}

/*清理模型返回中的思维链和格式残留*/
function stripModelArtifacts(rawText) {
  if (!rawText) {
    return '';
  }

  return String(rawText)
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```(?:json)?/gi, '').replace(/```/g, ''))
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

/*去重回答里的重复行*/
function dedupeLines(lines) {
  const seen = new Set();
  return lines.filter((line) => {
    const key = line.replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/*去重回答里的重复句子*/
function dedupeSentences(text) {
  const parts = text
    .split(/(?<=[。！？!?])/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return text.trim();
  }

  const seen = new Set();
  const uniqueParts = parts.filter((part) => {
    const key = part.replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  return uniqueParts.join('');
}

/*清洗并标准化 AI 最终回答文本*/
function normalizeAnswer(rawText) {
  const cleanedLines = dedupeLines(
    stripModelArtifacts(rawText)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  );

  const cleanedText = cleanedLines
    .join('\n')
    .replace(/^(根据(?:当前)?健康数据[，,:：\s]*)+/u, '')
    .replace(/^(结合(?:当前)?健康数据[，,:：\s]*)+/u, '')
    .replace(/(根据(?:当前)?健康数据[，,:：\s]*){2,}/gu, '根据当前健康数据，')
    .trim();

  const normalizedText = dedupeSentences(cleanedText)
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return normalizedText || '我可以结合当前健康总览回答你的问题，也可以直接和你自然交流。';
}

/*把最近对话历史整理成提示词上下文*/
function buildConversation(history) {
  if (!Array.isArray(history) || history.length === 0) {
    return '无历史对话。';
  }

  return history
    .slice(-6)
    .map((item) => {
      const role = item?.role === 'assistant' ? '助手' : '用户';
      const content = String(item?.content || '').trim();
      return `${role}：${content}`;
    })
    .filter(Boolean)
    .join('\n');
}

/*根据是否结合健康数据构造问答提示词*/
function buildPrompt(payload, question, history, useHealthData) {
  if (!useHealthData) {
    return `你是一名中文 AI 助手。请自然、简洁、友好地回答用户问题。

要求：
1. 优先直接回答用户真正想问的内容，不要主动提及健康数据。
2. 语气自然、口语化，像正常大模型聊天。
3. 可以回答寒暄、常识性问题、生活方式建议、运动减脂建议等普通问题。
4. 不要编造个人健康指标，不要假装看到了用户的实时数据。
5. 回答控制在 2-4 句话，避免重复、套话和机械表达。
6. 不要输出 Markdown 标题，不要输出代码块。

最近对话：
${buildConversation(history)}

用户当前问题：
${question}`;
  }

  return `你是一名健康管理助手。请基于用户提供的实时健康数据和当前提问，用简洁、谨慎、易懂的中文回答。

要求：
1. 只基于提供的数据回答，不要编造不存在的指标。
2. 语气专业但温和，不要使用恐吓式表达。
3. 如果用户只是打招呼、寒暄、问你是谁、问你能做什么，先自然简短地回答，不要强行分析健康数据；可以顺带说明你能结合当前健康总览回答问题。
4. 如果问题和健康有关，先直接回答用户真正关心的点，再决定是否需要引用健康数据。
5. 除非用户明确询问某项指标数值、趋势或原因，否则不要主动重复步数、心率、血压、睡眠分数等原始数据，也不要机械地把所有回答都写成“根据当前健康数据”开头。
6. 只有当某个健康指标与问题直接相关时，才简要提 1-2 个关键数据，不要把无关指标一起堆出来。
7. 如果用户问的是减肥、运动、饮食、作息等泛化建议，可以结合当前状态给更自然的建议，不必硬性复述指标。
8. 不要给出医疗诊断结论，只给健康管理建议。
9. 回答控制在 2-4 句话，尽量口语化，像正常大模型聊天，不要车轱辘话，不要重复整句或整段。
10. 不要输出 Markdown 标题，不要输出代码块。
11. 只有在回答涉及健康分析、风险提醒、运动/睡眠/指标建议时，才在最后补一句：${DEFAULT_DISCLAIMER}

当前健康数据：
${JSON.stringify(payload, null, 2)}

最近对话：
${buildConversation(history)}

用户当前问题：
${question}`;
}

/*生成健康问答回复内容*/
export async function POST(request) {
  try {
    const body = await request.json();
    const payload = body?.data ?? null;
    const question = String(body?.question || '').trim();
    const history = Array.isArray(body?.history) ? body.history : [];
    const requestedModel = String(body?.model || '').trim();
    const useHealthData = Boolean(body?.useHealthData);

    if (useHealthData && !payload?.person?.name) {
      return NextResponse.json({ error: '缺少健康总览 AI 问答所需数据' }, { status: 400 });
    }

    if (!question) {
      return NextResponse.json({ error: '请输入想咨询的问题' }, { status: 400 });
    }

    const runtimeConfig = await getAiRuntimeConfig();
    const ollamaHost = runtimeConfig.host;
    let model = runtimeConfig.selectedModel;

    if (requestedModel) {
      const availableModels = await fetchOllamaModels(ollamaHost);

      if (!availableModels.includes(requestedModel)) {
        return NextResponse.json({ error: '所选模型未安装或已不可用' }, { status: 400 });
      }

      model = requestedModel;
    }
//AI健康问答API转发位置
    const prompt = buildPrompt(payload, question, history, useHealthData);
    const response = await fetch(`${ollamaHost}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 400,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Ollama 调用失败：${errorText || response.statusText}` },
        { status: 502 }
      );
    }

    const result = await response.json();
    const answer = normalizeAnswer(result.response || '');

    return NextResponse.json({
      success: true,
      model,
      answer,
    });
  } catch (error) {
    console.error('健康总览 AI 问答失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '健康总览 AI 问答失败' },
      { status: 500 }
    );
  }
}
