/**
 * 人员管理API
 * 功能描述：
 * - 人员增删改查
 * - 人员账号管理
 * - 验证账号密码唯一性
 * 
 * 关联页面：
 * - 管理员人员管理页面
 * 
 * HTTP方法：
 * - GET - 获取人员列表
 * - POST - 新增人员
 * - PUT - 更新人员
 * - DELETE - 删除人员
 */

import { NextResponse } from 'next/server';
import * as db from '@/lib/db';

export const dynamic = 'force-dynamic';

class PersonValidationError extends Error {}

/*解析并校验人员主键 ID*/
function parsePersonId(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new PersonValidationError('人员 id 无效');
  }
  return parsed;
}

/*解析必填文本字段*/
function parseRequiredText(value, fieldName) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    throw new PersonValidationError(`${fieldName} 不能为空`);
  }
  return text;
}

/*解析可选文本字段*/
function parseOptionalText(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

/*解析并校验年龄字段*/
function parseAge(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new PersonValidationError('年龄必须为正整数');
  }
  return parsed;
}

/*拼装包含登录账号信息的人员列表*/
async function buildPersonsWithAccounts() {
  const persons = await db.monitoredPersons.getAllActive();
  return Promise.all(persons.map(async (person) => {
    const account = await db.users.getByPersonId(person.id);
    return {
      ...person,
      account_username: account?.username || '',
      account_password: account?.password || '',
      email: account?.email || null,
    };
  }));
}

/*校验人员账号和密码是否与其他用户重复*/
async function validateAccountUniqueness(username, password, excludeUserId = null) {
  if (await db.users.isUsernameTaken(username, excludeUserId)) {
    throw new PersonValidationError('账号不能与其他用户重复');
  }

  if (await db.users.isPasswordTaken(password, excludeUserId)) {
    throw new PersonValidationError('密码不能与其他用户重复');
  }
}

/*查询人员列表并附带账号信息*/
export async function GET() {
  try {
    // 初始化数据库
    db.initDB();

    const persons = await buildPersonsWithAccounts();
    return NextResponse.json({ persons });
  } catch (error) {
    console.error('Persons error:', error);
    return NextResponse.json({ error: error.message || '未知错误' }, { status: 500 });
  }
}

/*新增人员并同步创建对应用户账号*/
export async function POST(request) {
  try {
    db.initDB();
    const body = await request.json();
    const username = parseRequiredText(body.account_username, '账号');
    const password = parseRequiredText(body.account_password, '密码');

    await validateAccountUniqueness(username, password);

    const inserted = await db.monitoredPersons.insert([{
      name: parseRequiredText(body.name, '姓名'),
      age: parseAge(body.age),
      gender: parseRequiredText(body.gender, '性别'),
      avatar_url: null,
      phone: parseOptionalText(body.phone) ?? null,
      emergency_contact: parseOptionalText(body.emergency_contact) ?? null,
      emergency_phone: parseOptionalText(body.emergency_phone) ?? null,
      status: parseRequiredText(body.status, '状态'),
    }]);

    const createdPerson = inserted?.[0] ?? null;
    if (createdPerson) {
      await db.users.insert({
        username,
        password,
        role: 'user',
        name: createdPerson.name,
        email: null,
        person_id: createdPerson.id,
        status: createdPerson.status === 'inactive' ? 'inactive' : 'active',
      });
    }

    const persons = await buildPersonsWithAccounts();
    const person = createdPerson ? persons.find((item) => item.id === createdPerson.id) ?? createdPerson : null;

    return NextResponse.json({ success: true, person });
  } catch (error) {
    console.error('Create person error:', error);
    const status = error instanceof PersonValidationError ? 400 : 500;
    return NextResponse.json({ error: error.message || '添加失败' }, { status });
  }
}

/*更新人员信息并同步更新账号信息*/
export async function PUT(request) {
  try {
    db.initDB();
    const { searchParams } = new URL(request.url);
    const id = parsePersonId(searchParams.get('id'));
    const body = await request.json();

    const existing = await db.monitoredPersons.getById(id);
    if (!existing) {
      return NextResponse.json({ error: '人员不存在' }, { status: 404 });
    }

    const existingUser = await db.users.getByPersonId(id);
    if (!existingUser) {
      return NextResponse.json({ error: '该人员未找到对应账号' }, { status: 404 });
    }

    const username = parseRequiredText(body.account_username, '账号');
    const password = parseRequiredText(body.account_password, '密码');
    await validateAccountUniqueness(username, password, existingUser.id);

    const updated = await db.monitoredPersons.update(id, {
      name: parseRequiredText(body.name, '姓名'),
      age: parseAge(body.age),
      gender: parseRequiredText(body.gender, '性别'),
      phone: parseOptionalText(body.phone) ?? null,
      emergency_contact: parseOptionalText(body.emergency_contact) ?? null,
      emergency_phone: parseOptionalText(body.emergency_phone) ?? null,
      status: parseRequiredText(body.status, '状态'),
    });

    await db.users.update(existingUser.id, {
      username,
      password,
      name: updated?.name || existing.name,
      status: updated?.status === 'inactive' ? 'inactive' : 'active',
    });

    const persons = await buildPersonsWithAccounts();
    const person = persons.find((item) => item.id === id) ?? updated;
    return NextResponse.json({ success: true, person });
  } catch (error) {
    console.error('Update person error:', error);
    const status = error instanceof PersonValidationError ? 400 : 500;
    return NextResponse.json({ error: error.message || '更新失败' }, { status });
  }
}

/*删除指定人员及其关联信息*/
export async function DELETE(request) {
  try {
    db.initDB();
    const { searchParams } = new URL(request.url);
    const id = parsePersonId(searchParams.get('id'));

    const deleted = await db.monitoredPersons.delete(id);
    if (deleted === 0) {
      return NextResponse.json({ error: '人员不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete person error:', error);
    const status = error instanceof PersonValidationError ? 400 : 500;
    return NextResponse.json({ error: error.message || '删除失败' }, { status });
  }
}
