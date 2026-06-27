/**
 * 用户登录API
 * 
 * 功能说明：
 * 1. 验证用户名和密码
 * 2. 返回用户信息和角色
 * 3. 支持管理员和普通用户登录
 */
import { NextResponse } from 'next/server';
import * as db from '@/lib/db';

export const dynamic = 'force-dynamic';

/*标记登录请求参数校验错误*/
class LoginValidationError extends Error {}

/*解析登录接口必填文本字段*/
function parseRequiredText(value, fieldName) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    throw new LoginValidationError(`${fieldName} 不能为空`);
  }
  return text;
}

/*校验用户名和密码并返回登录结果*/
export async function POST(request) {
  try {
    db.initDB();
    const body = await request.json();
    const username = parseRequiredText(body.username, '用户名');
    const password = parseRequiredText(body.password, '密码');

    const user = await db.users.authenticate(username, password);
    if (!user) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Login error:', error);
    const status = error instanceof LoginValidationError ? 400 : 500;
    return NextResponse.json({ error: error.message || '登录失败' }, { status });
  }
}
