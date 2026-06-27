import { NextResponse } from 'next/server';
import * as db from '@/lib/db';

export const dynamic = 'force-dynamic';

/*查询压力与情绪记录列表*/
export async function GET(request) {
  try {
    // 初始化数据库
    db.initDB();

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('person_id');
    const limit = searchParams.get('limit');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    
    if (!personId) {
      return NextResponse.json({ error: '缺少 person_id 参数' }, { status: 400 });
    }

    const pid = parseInt(personId, 10);
    if (Number.isNaN(pid)) {
      return NextResponse.json({ error: 'person_id 参数无效' }, { status: 400 });
    }
    
    let records;
    if (startDate && endDate) {
      records = await db.stressMoodRecords.getByPersonId(pid, { 
        startDate, 
        endDate,
        limit: limit ? parseInt(limit, 10) : undefined 
      });
    } else {
      records = await db.stressMoodRecords.getByPersonId(pid, { limit: limit ? parseInt(limit, 10) : undefined });
    }
    
    return NextResponse.json({ data: records, records });
  } catch (error) {
    console.error('获取压力与情绪记录失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/*创建单条或批量生成压力与情绪记录*/
export async function POST(request) {
  try {
    const body = await request.json();
    
    // 如果是根据心率创建压力记录
    if (body.create_from_heart_rate && body.person_id && body.heart_rate !== undefined) {
      const record = await db.stressMoodRecords.createFromHeartRate(
        body.person_id,
        body.heart_rate,
        body.recorded_at
      );
      return NextResponse.json({ success: true, message: '根据心率数据创建压力记录成功', record });
    }
    
    // 如果是根据现有心率数据批量生成压力记录
    if (body.generate_from_existing_heart_rate && body.person_id) {
      const healthRecords = await db.healthRecords.getByPersonId(body.person_id, { type: 'heart_rate', limit: 1000 });
      const createdRecords = [];
      
      // 每天选择几个时间点生成压力记录（避免生成太多记录）
      // 使用小时范围而不是精确时间匹配
      const timeSlots = [
        { start: 7, end: 9 },   // 早上
        { start: 11, end: 13 }, // 中午
        { start: 18, end: 20 }, // 晚上
        { start: 22, end: 24 }  // 睡前
      ];
      const processedDates = new Set();
      
      for (const record of healthRecords) {
        if (record.heart_rate) {
          const recordDate = new Date(record.recorded_at);
          const hour = recordDate.getHours();
          const dateKey = recordDate.toDateString();
          
          // 检查是否在某个时间段内
          let selectedSlot = null;
          for (const slot of timeSlots) {
            if (hour >= slot.start && hour < slot.end) {
              selectedSlot = slot;
              break;
            }
          }
          
          if (selectedSlot && !processedDates.has(`${dateKey}-${selectedSlot.start}`)) {
            processedDates.add(`${dateKey}-${selectedSlot.start}`);
            const stressRecord = await db.stressMoodRecords.createFromHeartRate(
              body.person_id,
              record.heart_rate,
              record.recorded_at
            );
            createdRecords.push(stressRecord);
          }
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        message: '根据现有心率数据生成压力记录成功', 
        count: createdRecords.length,
        records: createdRecords 
      });
    }
    
    // 正常创建压力记录
    if (!body.person_id || body.stress_score === undefined || !body.stress_level || !body.mood_state || !body.autonomic_balance) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }
    
    // 如果没有提供 recorded_at，使用当前时间
    const recordData = {
      ...body,
      recorded_at: body.recorded_at || new Date().toISOString()
    };
    
    await db.stressMoodRecords.insert([recordData]);
    
    return NextResponse.json({ success: true, message: '记录创建成功' });
  } catch (error) {
    console.error('创建压力与情绪记录失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/*删除指定压力与情绪记录*/
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: '缺少 id 参数' }, { status: 400 });
    }

    const recordId = parseInt(id, 10);
    if (Number.isNaN(recordId)) {
      return NextResponse.json({ error: 'id 参数无效' }, { status: 400 });
    }
    
    await db.stressMoodRecords.delete(recordId);
    
    return NextResponse.json({ success: true, message: '记录删除成功' });
  } catch (error) {
    console.error('删除压力与情绪记录失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
