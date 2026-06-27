import { NextResponse } from 'next/server';
import { initDB, exerciseRecords } from '@/lib/db';

initDB();

/*按人员条件查询运动记录或今日运动汇总*/
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const personId = url.searchParams.get('person_id');
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')) : null;
    const sportType = url.searchParams.get('sport_type') || null;
    const startDate = url.searchParams.get('start_date') || null;
    const endDate = url.searchParams.get('end_date') || null;
    const summary = url.searchParams.get('summary') === 'true';

    if (!personId) {
      return NextResponse.json({ 
        error: 'person_id is required' 
      }, { status: 400 });
    }

    if (summary) {
      // 获取今日运动汇总
      const todaySummary = await exerciseRecords.getTodaySummary(parseInt(personId));
      return NextResponse.json(todaySummary);
    }

    // 获取运动记录列表
    const records = await exerciseRecords.getByPersonId(parseInt(personId), {
      limit,
      sportType,
      startDate,
      endDate
    });

    return NextResponse.json({ records });
  } catch (error) {
    console.error('Failed to get exercise records:', error);
    return NextResponse.json({ 
      error: 'Failed to get exercise records' 
    }, { status: 500 });
  }
}

/*新增一条专项运动记录*/
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      person_id,
      sport_type,
      duration_min,
      distance_km,
      notes,
      started_at,
      ended_at,
      pause_count,
      calories,
      average_speed_kmh,
      average_heart_rate,
      fitness_age,
      heart_rate_zones,
      pace_segments,
    } = body;

    if (!person_id || !sport_type || !duration_min) {
      return NextResponse.json({ 
        error: 'person_id, sport_type and duration_min are required' 
      }, { status: 400 });
    }

    if (typeof duration_min !== 'number' || duration_min <= 0) {
      return NextResponse.json({ 
        error: 'duration_min must be a positive number' 
      }, { status: 400 });
    }

    const record = await exerciseRecords.create({
      personId: parseInt(person_id, 10),
      sportType: sport_type,
      durationMin: duration_min,
      distanceKm: typeof distance_km === 'number' ? distance_km : 0,
      notes: notes || null,
      startedAt: started_at || null,
      endedAt: ended_at || null,
      pauseCount: typeof pause_count === 'number' ? pause_count : 0,
      calories: typeof calories === 'number' ? calories : null,
      averageSpeedKmh: typeof average_speed_kmh === 'number' ? average_speed_kmh : null,
      averageHeartRate: typeof average_heart_rate === 'number' ? average_heart_rate : null,
      fitnessAge: typeof fitness_age === 'number' ? fitness_age : null,
      heartRateZones: heart_rate_zones && typeof heart_rate_zones === 'object' ? heart_rate_zones : null,
      paceSegments: Array.isArray(pace_segments) ? pace_segments : null,
    });

    return NextResponse.json({ record });
  } catch (error) {
    console.error('Failed to create exercise record:', error);
    return NextResponse.json({ 
      error: 'Failed to create exercise record' 
    }, { status: 500 });
  }
}

/*删除单条或多条专项运动记录*/
export async function DELETE(request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      await exerciseRecords.delete(parseInt(id, 10));
      return NextResponse.json({ success: true });
    }

    const body = await request.json().catch(() => null);
    const ids = Array.isArray(body?.ids) ? body.ids : [];

    if (ids.length === 0) {
      return NextResponse.json({ 
        error: 'id or ids is required' 
      }, { status: 400 });
    }

    await exerciseRecords.deleteByIds(ids.map((item) => parseInt(item, 10)).filter((item) => !Number.isNaN(item)));

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error('Failed to delete exercise record:', error);
    return NextResponse.json({ 
      error: 'Failed to delete exercise record' 
    }, { status: 500 });
  }
}
