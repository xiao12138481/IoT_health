import { NextResponse } from 'next/server';
import { DEFAULT_OLLAMA_MODEL, getAiRuntimeConfig, setAiRuntimeConfig } from '@/lib/ai-runtime-config';

export const dynamic = 'force-dynamic';

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

/*返回当前 AI 连接状态和模型列表*/
export async function GET() {
  try {
    const config = await getAiRuntimeConfig();

    try {
      const availableModels = await fetchOllamaModels(config.host);
      const currentModel = availableModels.includes(config.selectedModel)
        ? config.selectedModel
        : availableModels[0] || config.selectedModel || DEFAULT_OLLAMA_MODEL;

      return NextResponse.json({
        success: true,
        connected: true,
        host: config.host,
        currentModel,
        availableModels,
      });
    } catch (error) {
      return NextResponse.json({
        success: true,
        connected: false,
        host: config.host,
        currentModel: config.selectedModel,
        availableModels: [],
        error: error instanceof Error ? error.message : '无法连接 Ollama',
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '读取 AI 模型配置失败' },
      { status: 500 }
    );
  }
}

/*保存当前选中的本地 AI 模型配置*/
export async function POST(request) {
  try {
    const body = await request.json();
    const model = String(body?.model || '').trim();

    if (!model) {
      return NextResponse.json({ error: '请选择要切换的模型' }, { status: 400 });
    }

    const currentConfig = await getAiRuntimeConfig();
    const availableModels = await fetchOllamaModels(currentConfig.host);

    if (!availableModels.includes(model)) {
      return NextResponse.json({ error: '所选模型未安装或已不可用' }, { status: 400 });
    }

    const savedConfig = await setAiRuntimeConfig({
      host: currentConfig.host,
      selectedModel: model,
    });

    return NextResponse.json({
      success: true,
      connected: true,
      host: savedConfig.host,
      currentModel: savedConfig.selectedModel,
      availableModels,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '保存 AI 模型配置失败' },
      { status: 500 }
    );
  }
}
