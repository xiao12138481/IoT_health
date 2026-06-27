import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

export const dynamic = 'force-dynamic';

/*读取全局或指定人员的健康阈值配置*/
export async function GET(request) {
  try {
    // 初始化数据库
    db.initDB();

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('person_id');

    if (!personId) {
      return NextResponse.json({ error: '缺少 person_id 参数' }, { status: 400 });
    }

    const pid = parseInt(personId, 10);
    const threshold = await db.thresholdConfigs.getByPersonId(pid);

    return NextResponse.json({ threshold: threshold || null });
  } catch (error) {
    console.error('Thresholds error:', error);
    return NextResponse.json({ error: error.message || '未知错误' }, { status: 500 });
  }
}

/*更新全局或指定人员的健康阈值配置*/
export async function PUT(request) {
  try {
    const body = await request.json();
    console.log('📩 收到更新请求 body:', body);
    const { person_id, ...updates } = body;
    console.log('🧩 解析后 person_id:', person_id, ', updates:', updates);

    if (!person_id) {
      return NextResponse.json({ error: '缺少 person_id 参数' }, { status: 400 });
    }

    const pid = typeof person_id === 'number' ? person_id : parseInt(person_id, 10);
    console.log('🚀 准备更新，pid:', pid);
    await db.thresholdConfigs.update(pid, updates);
    console.log('✅ 更新完成');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Update threshold error:', error);
    return NextResponse.json({ error: error.message || '未知错误' }, { status: 500 });
  }
}
