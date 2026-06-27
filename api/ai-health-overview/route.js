//业务逻辑实现
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

  return rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json/gi, '```')
    .replace(/```/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

/*规范化单个文本字段内容*/
function normalizeText(value) {
  return String(value || '')
    .replace(/^["'{[\s]+/, '')
    .replace(/["'}\],\s]+$/, '')
    .replace(/\\"/g, '"')
    .trim();
}

/*规范化风险项和建议项列表*/
function normalizeList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeText(item))
    .filter((item) => item && !/^summary$/i.test(item) && !/^risks$/i.test(item) && !/^suggestions$/i.test(item))
    .slice(0, 3);
}

/*把解析出的对象整理成统一解读结构*/
function buildInsightFromObject(parsed) {
  return {
    summary: normalizeText(parsed.summary) || '当前健康数据整体较稳定，请继续保持规律监测。',
    risks: normalizeList(parsed.risks),
    suggestions: normalizeList(parsed.suggestions),
    disclaimer: normalizeText(parsed.disclaimer) || DEFAULT_DISCLAIMER,
  };
}

/*优先尝试把模型输出按 JSON 解析*/
function tryParseJsonCandidates(cleanedText) {
  const candidates = [cleanedText];
  const firstBraceIndex = cleanedText.indexOf('{');
  const lastBraceIndex = cleanedText.lastIndexOf('}');

  if (firstBraceIndex !== -1 && lastBraceIndex > firstBraceIndex) {
    candidates.push(cleanedText.slice(firstBraceIndex, lastBraceIndex + 1));
  }

  for (const candidate of candidates) {
    try {
      return buildInsightFromObject(JSON.parse(candidate));
    } catch {
      // Continue trying other candidates
    }
  }

  return null;
}

/*从半结构化文本中提取带引号的列表项*/
function extractQuotedItems(blockText) {
  const items = [];
  const quotedPattern = /"([^"]+)"/g;
  let match = quotedPattern.exec(blockText);

  while (match) {
    const value = normalizeText(match[1]);
    if (value) {
      items.push(value);
    }
    match = quotedPattern.exec(blockText);
  }

  if (items.length > 0) {
    return items.slice(0, 3);
  }

  return blockText
    .split(/[,，\n]/)
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, 3);
}

/*按字段名从文本中提取指定内容*/
function extractFieldByRegex(cleanedText, fieldName) {
  const stringFieldPattern = new RegExp(`"${fieldName}"\\s*:\\s*"([\\s\\S]*?)"(?=\\s*,\\s*"(?:risks|suggestions|disclaimer)"|\\s*\\}$)`, 'i');
  const arrayFieldPattern = new RegExp(`"${fieldName}"\\s*:\\s*\\[([\\s\\S]*?)\\]`, 'i');

  if (fieldName === 'summary' || fieldName === 'disclaimer') {
    const match = cleanedText.match(stringFieldPattern);
    return match ? normalizeText(match[1]) : '';
  }

  const match = cleanedText.match(arrayFieldPattern);
  return match ? extractQuotedItems(match[1]) : [];
}

/*从半结构化文本里兜底提取解读字段*/
function extractInsightFromSemiStructuredText(cleanedText) {
  const summary = extractFieldByRegex(cleanedText, 'summary');
  const risks = extractFieldByRegex(cleanedText, 'risks');
  const suggestions = extractFieldByRegex(cleanedText, 'suggestions');
  const disclaimer = extractFieldByRegex(cleanedText, 'disclaimer');

  if (summary || risks.length > 0 || suggestions.length > 0) {
    return {
      summary: summary || '当前健康数据整体较稳定，请继续保持规律监测。',
      risks,
      suggestions,
      disclaimer: disclaimer || DEFAULT_DISCLAIMER,
    };
  }

  return null;
}

/*把模型原始输出解析成前端可直接展示的解读结果*/
function parseInsightResponse(rawText) {
  const cleanedText = stripModelArtifacts(rawText);
  const jsonResult = tryParseJsonCandidates(cleanedText);

  if (jsonResult) {
    return jsonResult;
  }

  const semiStructuredResult = extractInsightFromSemiStructuredText(cleanedText);
  if (semiStructuredResult) {
    return semiStructuredResult;
  }

  const lines = cleanedText
    .split('\n')
    .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
    .map((line) => normalizeText(line))
    .filter((line) => line && line !== '{' && line !== '}' && !/^"?(summary|risks|suggestions|disclaimer)"?\s*:?\s*$/i.test(line));

  return {
    summary: lines[0] || '当前健康数据整体较稳定，请继续保持规律监测。',
    risks: lines.slice(1, 4),
    suggestions: lines.slice(4, 7),
    disclaimer: DEFAULT_DISCLAIMER,
  };
}

/*构造健康总览 AI 解读提示词*/
function buildPrompt(payload) {
  return `你是一名健康管理助手。请基于用户提供的实时健康数据，生成简洁、谨慎、易懂的中文健康解读。

要求：
1. 只基于提供的数据回答，不要编造不存在的指标。
2. 语气专业但温和，不要使用恐吓式表达。
3. 不要给出医疗诊断结论，只给健康管理建议。
4. 输出必须是 JSON，对象字段固定为：
{
  "summary": "1-2 句总体解读",
  "risks": ["重点关注 1", "重点关注 2", "重点关注 3"],
  "suggestions": ["建议 1", "建议 2", "建议 3"],
  "disclaimer": "固定一句免责声明"
}
5. "risks" 和 "suggestions" 最多各 3 条；没有明显风险时也要给出观察重点。
6. "disclaimer" 固定写：以上内容仅供健康管理参考，不替代医生诊断。
7. 不要输出 Markdown、不要输出项目符号、不要输出解释文字，只返回单个 JSON 对象。

健康数据如下：
${JSON.stringify(payload, null, 2)}`;
}

/*生成健康总览 AI 解读结果*/
export async function POST(request) {
  try {
    const body = await request.json();
    const payload = body?.data ?? body;
    const requestedModel = String(body?.model || '').trim();

    if (!payload?.person?.name) {
      return NextResponse.json({ error: '缺少健康总览 AI 解读所需数据' }, { status: 400 });
    }
//获取Ollama配置
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

    const prompt = buildPrompt(payload);
// 关键转发代码
    const response = await fetch(`${ollamaHost}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: 'json',
        options: {
          temperature: 0.2,
          num_predict: 500,
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
//处理Ollama响应
    const result = await response.json();
    const insight = parseInsightResponse(result.response || '');

    return NextResponse.json({
      success: true,
      model,
      insight,
    });
  } catch (error) {
    console.error('健康总览 AI 解读生成失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '健康总览 AI 解读生成失败' },
      { status: 500 }
    );
  }
}
