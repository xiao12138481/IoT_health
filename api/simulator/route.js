import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import {
  DEFAULT_SIMULATOR_CONFIG,
  getSimulatorStatus,
  normalizeSimulatorConfig,
  simulatorMeta,
  startSimulator,
  stopSimulator,
} from '@/lib/health-simulator';

export const dynamic = 'force-dynamic';

/*读取模拟器当前运行状态和默认配置*/
export async function GET() {
  try {
    // 初始化数据库
    db.initDB();
    
    return NextResponse.json({
      success: true,
      status: getSimulatorStatus(),
      meta: simulatorMeta,
      defaults: DEFAULT_SIMULATOR_CONFIG,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || '获取模拟器状态失败' },
      { status: 500 }
    );
  }
}

/*启动或停止后台健康数据模拟任务*/
export async function POST(request) {
  try {
    // 初始化数据库
    db.initDB();

    const body = await request.json();
    const action = body.action;

    if (action === 'start') {
      const config = normalizeSimulatorConfig(body.config || {});
      const status = await startSimulator(config);
      return NextResponse.json({ success: true, message: '模拟已启动', status });
    }

    if (action === 'stop') {
      const status = stopSimulator();
      return NextResponse.json({ success: true, message: '模拟已停止', status });
    }

    return NextResponse.json({ error: '不支持的操作' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || '模拟接口执行失败' },
      { status: 500 }
    );
  }
}
