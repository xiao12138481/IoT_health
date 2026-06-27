import { NextResponse } from 'next/server';
import * as db from '@/lib/db';

export const dynamic = 'force-dynamic';

const PERSONS = [
  { name: '张伟', age: 35, gender: '男', phone: '138****1234', emergency_contact: '张丽', emergency_phone: '139****5678' },
  { name: '李娜', age: 28, gender: '女', phone: '137****2345', emergency_contact: '李明', emergency_phone: '136****6789' },
  { name: '王强', age: 52, gender: '男', phone: '135****3456', emergency_contact: '王芳', emergency_phone: '134****7890' },
  { name: '赵敏', age: 41, gender: '女', phone: '133****4567', emergency_contact: '赵磊', emergency_phone: '132****8901' },
  { name: '陈静', age: 63, gender: '女', phone: '131****5678', emergency_contact: '陈刚', emergency_phone: '130****9012' },
  { name: '刘洋', age: 30, gender: '男', phone: '139****6789', emergency_contact: '刘华', emergency_phone: '138****0123' },
];

const DEVICE_MODELS = ['华为 Band 8', '小米手环 8 Pro', 'Apple Watch SE', 'OPPO 手环 2', '荣耀 Band 7', 'vivo Watch 3'];

/*根据固定种子生成可复现的随机数序列*/
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/*按小时生成模拟心率值*/
function generateHeartRate(hour, rand) {
  const base = hour >= 23 || hour < 6 ? 58 : hour >= 7 && hour < 9 ? 75 : hour >= 17 && hour < 19 ? 85 : 72;
  const variation = Math.floor(rand * 15) - 7;
  return Math.max(48, Math.min(155, base + variation));
}

/*按昼夜生成模拟血氧值*/
function generateBloodOxygen(rand, isNight) {
  const base = isNight ? 95 : 97;
  const variation = Math.floor(rand * 4) - 2;
  return Math.max(88, Math.min(100, base + variation));
}

/*按时段生成模拟体温值*/
function generateBodyTemp(hour, rand) {
  const base = 36.4 + (hour >= 14 && hour < 18 ? 0.3 : 0);
  const variation = (rand * 0.6 - 0.3);
  return (base + variation).toFixed(1);
}

/*按时段生成模拟步数值*/
function generateSteps(hour, rand) {
  if (hour < 6 || hour >= 23) return Math.floor(rand * 5);
  if (hour >= 7 && hour < 9) return Math.floor(rand * 800 + 200);
  if (hour >= 17 && hour < 19) return Math.floor(rand * 1200 + 300);
  return Math.floor(rand * 300 + 50);
}

/*按时段生成模拟血压值*/
function generateBloodPressure(hour, rand, rand2) {
  let baseSystolic = 115;
  let baseDiastolic = 75;
  
  if (hour >= 6 && hour < 9) {
    baseSystolic += 5;
    baseDiastolic += 3;
  } else if (hour >= 17 && hour < 20) {
    baseSystolic += 10;
    baseDiastolic += 5;
  } else if (hour >= 23 || hour < 6) {
    baseSystolic -= 10;
    baseDiastolic -= 5;
  }
  
  const systolic = baseSystolic + Math.floor(rand * 30) - 15;
  const diastolic = baseDiastolic + Math.floor(rand2 * 20) - 10;
  
  return {
    systolic_bp: Math.max(80, Math.min(180, systolic)),
    diastolic_bp: Math.max(50, Math.min(120, diastolic))
  };
}

/*初始化演示人员、设备、健康记录和报警数据*/
export async function POST(request) {
  try {
    // 初始化数据库
    db.initDB();

    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    
    const existingPersons = await db.monitoredPersons.getAllActive();
    if (existingPersons.length > 0 && !force) {
      return NextResponse.json({
        message: '数据已存在，无需重新初始化',
        stats: { persons: existingPersons.length }
      });
    }
    
    await db.truncateAllTables();
    
    const personResult = await db.monitoredPersons.insert(PERSONS);
    const persons = await db.monitoredPersons.getAllActive();

    const deviceInserts = persons.map((p, i) => ({
      name: `${PERSONS[i].name}的手环`,
      model: DEVICE_MODELS[i],
      firmware_version: `v${1 + Math.floor(i / 2)}.${i % 3}.0`,
      battery_level: 60 + Math.floor(Math.random() * 35),
      status: i % 5 === 4 ? 'offline' : 'online',
      person_id: p.id,
      last_sync_at: new Date(Date.now() - Math.floor(Math.random() * 600000)).toISOString()
    }));
    await db.devices.insert(deviceInserts);

    const DAYS = 7;
    const allHealthRecords = [];
    const allAlarmRecords = [];
    const allStressMoodRecords = [];
    const allBloodPressureByPerson = new Map();

    for (const person of persons) {
      const rng = seededRandom(person.id * 1337);
      const personThresholds = await db.thresholds.get(person.id);
      const thr = {
        hrMin: Number(personThresholds.heart_rate_min ?? 55),
        hrMax: Number(personThresholds.heart_rate_max ?? 100),
        spo2Min: Number(personThresholds.blood_oxygen_min ?? 94),
        tempMax: Number(personThresholds.body_temp_max ?? 37.3),
        sbpMax: Number(personThresholds.systolic_bp_max ?? 140),
        sbpMin: Number(personThresholds.systolic_bp_min ?? 90),
        dbpMax: Number(personThresholds.diastolic_bp_max ?? 90),
        dbpMin: Number(personThresholds.diastolic_bp_min ?? 60),
      };
      
      const heartRateDataByTime = new Map();
      const personBpData = [];
      
      for (let d = 0; d < DAYS; d++) {
        const dayKey = new Date();
        dayKey.setDate(dayKey.getDate() - d);
        const dayDateStr = dayKey.toISOString().split('T')[0];
        
        const dayBpData = [];
        
        let dailySteps = 0;
        for (let h = 0; h < 24; h++) {
          for (let m = 0; m < 60; m += 30) {
            const rand1 = rng();
            const rand2 = rng();
            const rand3 = rng();
            const rand4 = rng();
            const rand5 = rng();
            const rand6 = rng();

            const hr = generateHeartRate(h, rand1);
            const spo2 = generateBloodOxygen(rand2, h < 6 || h >= 23);
            const temp = generateBodyTemp(h, rand3);
            const steps = generateSteps(h, rand4);
            const bp = generateBloodPressure(h, rand5, rand6);
            dailySteps += steps;
            
            dayBpData.push(bp);

            const recordedAt = new Date();
            recordedAt.setDate(recordedAt.getDate() - d);
            recordedAt.setHours(h, m, 0, 0);
            
            const timeKey = `${recordedAt.getHours()}:${recordedAt.getMinutes()}`;
            if (!heartRateDataByTime.has(timeKey)) {
              heartRateDataByTime.set(timeKey, { 
                heartRate: hr, 
                date: recordedAt 
              });
            }

            allHealthRecords.push({
              person_id: person.id,
              heart_rate: hr,
              blood_oxygen: spo2,
              body_temp: parseFloat(temp),
              steps: d === 0 ? steps : 0,
              systolic_bp: bp.systolic_bp,
              diastolic_bp: bp.diastolic_bp,
              recorded_at: recordedAt.toISOString()
            });

            if (hr > thr.hrMax) {
              allAlarmRecords.push({
                person_id: person.id,
                alarm_type: 'heart_rate_high',
                alarm_level: hr > 120 ? 'critical' : 'warning',
                message: `心率过高: ${hr} bpm`,
                value: hr,
                threshold: thr.hrMax,
                is_acknowledged: d > 1,
                acknowledged_at: d > 1 ? new Date(recordedAt.getTime() + 300000).toISOString() : null,
                acknowledged_by: null,
                created_at: recordedAt.toISOString()
              });
            }
            if (hr < thr.hrMin) {
              allAlarmRecords.push({
                person_id: person.id,
                alarm_type: 'heart_rate_low',
                alarm_level: hr < 45 ? 'critical' : 'warning',
                message: `心率过低: ${hr} bpm`,
                value: hr,
                threshold: thr.hrMin,
                is_acknowledged: d > 1,
                acknowledged_at: d > 1 ? new Date(recordedAt.getTime() + 300000).toISOString() : null,
                acknowledged_by: null,
                created_at: recordedAt.toISOString()
              });
            }
            if (spo2 < thr.spo2Min) {
              allAlarmRecords.push({
                person_id: person.id,
                alarm_type: 'blood_oxygen_low',
                alarm_level: spo2 < 90 ? 'critical' : 'warning',
                message: `血氧过低: ${spo2}%`,
                value: spo2,
                threshold: thr.spo2Min,
                is_acknowledged: d > 1,
                acknowledged_at: d > 1 ? new Date(recordedAt.getTime() + 600000).toISOString() : null,
                acknowledged_by: null,
                created_at: recordedAt.toISOString()
              });
            }
            if (parseFloat(temp) > thr.tempMax) {
              allAlarmRecords.push({
                person_id: person.id,
                alarm_type: 'fever',
                alarm_level: 'warning',
                message: `体温偏高: ${temp}°C`,
                value: parseFloat(temp),
                threshold: thr.tempMax,
                is_acknowledged: d > 1,
                acknowledged_at: d > 1 ? new Date(recordedAt.getTime() + 600000).toISOString() : null,
                acknowledged_by: null,
                created_at: recordedAt.toISOString()
              });
            }
            if (bp.systolic_bp > thr.sbpMax) {
              allAlarmRecords.push({
                person_id: person.id,
                alarm_type: 'systolic_bp_high',
                alarm_level: bp.systolic_bp > 160 ? 'critical' : 'warning',
                message: `收缩压过高: ${bp.systolic_bp} mmHg`,
                value: bp.systolic_bp,
                threshold: thr.sbpMax,
                is_acknowledged: d > 1,
                acknowledged_at: d > 1 ? new Date(recordedAt.getTime() + 600000).toISOString() : null,
                acknowledged_by: null,
                created_at: recordedAt.toISOString()
              });
            }
            if (bp.systolic_bp < thr.sbpMin) {
              allAlarmRecords.push({
                person_id: person.id,
                alarm_type: 'systolic_bp_low',
                alarm_level: bp.systolic_bp < 85 ? 'critical' : 'warning',
                message: `收缩压过低: ${bp.systolic_bp} mmHg`,
                value: bp.systolic_bp,
                threshold: thr.sbpMin,
                is_acknowledged: d > 1,
                acknowledged_at: d > 1 ? new Date(recordedAt.getTime() + 600000).toISOString() : null,
                acknowledged_by: null,
                created_at: recordedAt.toISOString()
              });
            }
            if (bp.diastolic_bp > thr.dbpMax) {
              allAlarmRecords.push({
                person_id: person.id,
                alarm_type: 'diastolic_bp_high',
                alarm_level: bp.diastolic_bp > 100 ? 'critical' : 'warning',
                message: `舒张压过高: ${bp.diastolic_bp} mmHg`,
                value: bp.diastolic_bp,
                threshold: thr.dbpMax,
                is_acknowledged: d > 1,
                acknowledged_at: d > 1 ? new Date(recordedAt.getTime() + 600000).toISOString() : null,
                acknowledged_by: null,
                created_at: recordedAt.toISOString()
              });
            }
            if (bp.diastolic_bp < thr.dbpMin) {
              allAlarmRecords.push({
                person_id: person.id,
                alarm_type: 'diastolic_bp_low',
                alarm_level: bp.diastolic_bp < 55 ? 'critical' : 'warning',
                message: `舒张压过低: ${bp.diastolic_bp} mmHg`,
                value: bp.diastolic_bp,
                threshold: thr.dbpMin,
                is_acknowledged: d > 1,
                acknowledged_at: d > 1 ? new Date(recordedAt.getTime() + 600000).toISOString() : null,
                acknowledged_by: null,
                created_at: recordedAt.toISOString()
              });
            }
          }
        }
        
        personBpData.push({ day: dayDateStr, data: dayBpData });
        
        if (d > 0) {
          const dayEnd = new Date();
          dayEnd.setDate(dayEnd.getDate() - d);
          dayEnd.setHours(23, 0, 0, 0);
          allHealthRecords.push({
            person_id: person.id,
            heart_rate: null,
            blood_oxygen: null,
            body_temp: null,
            steps: Math.floor(dailySteps),
            recorded_at: dayEnd.toISOString()
          });
        }
      }
      
      allBloodPressureByPerson.set(person.id, personBpData);

      const stressRng = seededRandom(person.id * 7777);
      for (let d = 0; d < DAYS; d++) {
        const day = new Date();
        day.setDate(day.getDate() - d);
        
        const getHR = (hour, minute) => {
          const key = `${hour}:${minute}`;
          const data = heartRateDataByTime.get(key);
          if (data) {
            return data.heartRate;
          }
          return generateHeartRate(hour, stressRng());
        };
        
        const times = [
          { h: 8, m: 0 },
          { h: 12, m: 30 },
          { h: 19, m: 0 },
          { h: 23, m: 0 }
        ];
        
        for (const { h, m } of times) {
          const time = new Date(day);
          time.setHours(h, m, 0, 0);
          const hr = getHR(h, m);
          await db.stressMoodRecords.createFromHeartRate(person.id, hr, time.toISOString());
        }
      }
    }

    for (let i = 0; i < allHealthRecords.length; i += 500) {
      const batch = allHealthRecords.slice(i, i + 500);
      await db.healthRecords.insert(batch);
    }

    if (allAlarmRecords.length > 0) {
      for (let i = 0; i < allAlarmRecords.length; i += 500) {
        const batch = allAlarmRecords.slice(i, i + 500);
        await db.alarms.insert(batch);
      }
    }

    const allSleepRecords = [];
    for (const person of persons) {
      const rng = seededRandom(person.id * 1000 + 42);
      for (let d = 0; d < DAYS; d++) {
        const date = new Date();
        date.setDate(date.getDate() - d);
        const bedHour = 22 + Math.floor(rng() * 2);
        const bedMin = Math.floor(rng() * 60);
        const start = new Date(date);
        start.setHours(bedHour, bedMin, 0, 0);
        const wakeHour = 6 + Math.floor(rng() * 2);
        const wakeMin = Math.floor(rng() * 60);
        const end = new Date(date);
        end.setDate(end.getDate() + 1);
        end.setHours(wakeHour, wakeMin, 0, 0);
        const totalMin = Math.floor((end.getTime() - start.getTime()) / 60000);
        const deepMin = Math.floor(totalMin * (0.15 + rng() * 0.1));
        const remMin = Math.floor(totalMin * (0.2 + rng() * 0.05));
        const awakeMin = Math.floor(rng() * 30 + 5);
        const lightMin = totalMin - deepMin - remMin - awakeMin;
        const score = Math.min(100, Math.max(40, Math.floor(60 + (deepMin + remMin) / totalMin * 40 + rng() * 10)));
        allSleepRecords.push({
          person_id: person.id,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          deep_sleep_min: deepMin,
          light_sleep_min: lightMin,
          rem_sleep_min: remMin,
          awake_min: awakeMin,
          score,
          recorded_at: end.toISOString()
        });
      }
    }
    for (let i = 0; i < allSleepRecords.length; i += 500) {
      const batch = allSleepRecords.slice(i, i + 500);
      await db.sleepRecords.insert(batch);
    }

    for (const person of persons) {
      const personData = allBloodPressureByPerson.get(person.id) || [];
      for (const { day, data } of personData) {
        const bpReadings = data.map(b => ({ 
          systolic_bp: b.systolic_bp, 
          diastolic_bp: b.diastolic_bp 
        }));
        
        const dayDate = new Date(day);
        await db.vascularAssessments.createFromBloodPressures(person.id, bpReadings, dayDate.toISOString());
      }
    }

    const finalPersons = await db.monitoredPersons.getAllActive();
    const finalDevices = await db.devices.getAllWithPersons();

    return NextResponse.json({
      message: '种子数据创建成功',
      stats: {
        persons: finalPersons.length,
        devices: finalDevices.length,
        healthRecords: allHealthRecords.length,
        alarmRecords: allAlarmRecords.length,
        sleepRecords: allSleepRecords.length
      }
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: error.message || '未知错误' }, { status: 500 });
  }
}
