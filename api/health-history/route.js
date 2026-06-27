import { NextResponse } from 'next/server';
import * as db from '@/lib/db';

export const dynamic = 'force-dynamic';

const METRIC_SET = new Set(['heart_rate', 'blood_oxygen', 'blood_pressure', 'body_temp', 'steps']);
const GRANULARITY_SET = new Set(['raw', 'hour', 'day']);
const STATUS_SET = new Set(['all', 'normal', 'abnormal']);

const alarmTypeLabelMap = {
  heart_rate_high: '心率过高',
  heart_rate_low: '心率过低',
  blood_oxygen_low: '血氧过低',
  fever: '体温偏高',
  body_temp_low: '体温偏低',
  systolic_bp_high: '收缩压过高',
  systolic_bp_low: '收缩压过低',
  diastolic_bp_high: '舒张压过高',
  diastolic_bp_low: '舒张压过低',
};

/*解析正整数参数并提供默认值*/
function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/*规范化历史指标类型参数*/
function normalizeMetric(metric) {
  return METRIC_SET.has(metric) ? metric : 'heart_rate';
}

/*规范化趋势聚合粒度参数*/
function normalizeGranularity(granularity) {
  return GRANULARITY_SET.has(granularity) ? granularity : 'day';
}

/*规范化正常异常筛选状态*/
function normalizeStatus(status) {
  return STATUS_SET.has(status) ? status : 'all';
}

/*把开始日期转成当天零点时间*/
function toDateStart(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/*把结束日期转成当天结束时间*/
function toDateEnd(value) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/*格式化趋势分桶的横轴标签*/
function formatBucketLabel(date, granularity) {
  if (granularity === 'raw') {
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (granularity === 'hour') {
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
    });
  }

  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
}

/*格式化完整时间标签文本*/
function formatFullLabel(date, granularity) {
  if (granularity === 'day') {
    return date.toLocaleDateString('zh-CN');
  }

  return date.toLocaleString('zh-CN');
}

/*生成按粒度聚合时使用的分桶键名*/
function getBucketKey(date, granularity) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  if (granularity === 'hour') {
    const hour = String(date.getHours()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:00`;
  }

  return `${year}-${month}-${day}`;
}

/*返回指定指标对应的报警类型集合*/
function getMetricAlarmTypes(metric) {
  if (metric === 'heart_rate') {
    return ['heart_rate_high', 'heart_rate_low'];
  }

  if (metric === 'blood_oxygen') {
    return ['blood_oxygen_low'];
  }

  if (metric === 'body_temp') {
    return ['fever', 'body_temp_low'];
  }

  if (metric === 'blood_pressure') {
    return ['systolic_bp_high', 'systolic_bp_low', 'diastolic_bp_high', 'diastolic_bp_low'];
  }

  return [];
}

/*判断记录是否包含当前指标的有效值*/
function isMetricRecordValid(record, metric) {
  if (metric === 'blood_pressure') {
    return record.systolic_bp !== null && record.diastolic_bp !== null;
  }

  return record[metric] !== null && record[metric] !== undefined;
}

/*根据阈值判断当前记录是否异常*/
function isRecordAbnormal(record, metric, thresholds) {
  if (metric === 'heart_rate') {
    if (record.heart_rate === null) return false;
    return record.heart_rate < thresholds.heart_rate_min || record.heart_rate > thresholds.heart_rate_max;
  }

  if (metric === 'blood_oxygen') {
    if (record.blood_oxygen === null) return false;
    return record.blood_oxygen < thresholds.blood_oxygen_min;
  }

  if (metric === 'body_temp') {
    if (record.body_temp === null) return false;
    return record.body_temp < thresholds.body_temp_min || record.body_temp > thresholds.body_temp_max;
  }

  if (metric === 'blood_pressure') {
    if (record.systolic_bp === null || record.diastolic_bp === null) return false;
    return (
      record.systolic_bp < thresholds.systolic_bp_min ||
      record.systolic_bp > thresholds.systolic_bp_max ||
      record.diastolic_bp < thresholds.diastolic_bp_min ||
      record.diastolic_bp > thresholds.diastolic_bp_max
    );
  }

  return false;
}

/*生成记录异常原因说明列表*/
function buildAbnormalReason(record, metric, thresholds) {
  const reasons = [];

  if (metric === 'heart_rate' && record.heart_rate !== null) {
    if (record.heart_rate < thresholds.heart_rate_min) reasons.push('低于心率下限');
    if (record.heart_rate > thresholds.heart_rate_max) reasons.push('高于心率上限');
  }

  if (metric === 'blood_oxygen' && record.blood_oxygen !== null && record.blood_oxygen < thresholds.blood_oxygen_min) {
    reasons.push('低于血氧下限');
  }

  if (metric === 'body_temp' && record.body_temp !== null) {
    if (record.body_temp < thresholds.body_temp_min) reasons.push('低于体温下限');
    if (record.body_temp > thresholds.body_temp_max) reasons.push('高于体温上限');
  }

  if (metric === 'blood_pressure' && record.systolic_bp !== null && record.diastolic_bp !== null) {
    if (record.systolic_bp < thresholds.systolic_bp_min) reasons.push('收缩压偏低');
    if (record.systolic_bp > thresholds.systolic_bp_max) reasons.push('收缩压偏高');
    if (record.diastolic_bp < thresholds.diastolic_bp_min) reasons.push('舒张压偏低');
    if (record.diastolic_bp > thresholds.diastolic_bp_max) reasons.push('舒张压偏高');
  }

  return reasons;
}

/*把原始记录映射成统一展示值结构*/
function mapRecordValue(record, metric) {
  if (metric === 'blood_pressure') {
    return {
      value: record.systolic_bp,
      secondaryValue: record.diastolic_bp,
      displayValue: `${record.systolic_bp ?? '--'}/${record.diastolic_bp ?? '--'} mmHg`,
    };
  }

  if (metric === 'heart_rate') {
    return {
      value: record.heart_rate,
      secondaryValue: null,
      displayValue: `${record.heart_rate ?? '--'} bpm`,
    };
  }

  if (metric === 'blood_oxygen') {
    return {
      value: record.blood_oxygen,
      secondaryValue: null,
      displayValue: `${record.blood_oxygen ?? '--'} %`,
    };
  }

  if (metric === 'body_temp') {
    return {
      value: record.body_temp,
      secondaryValue: null,
      displayValue: `${record.body_temp ?? '--'} °C`,
    };
  }

  return {
    value: record.steps,
    secondaryValue: null,
    displayValue: `${record.steps ?? '--'} 步`,
  };
}

/*按时间把报警记录整理成快速索引表*/
function buildAlarmMap(alarms) {
  const alarmMap = new Map();

  alarms.forEach((alarm) => {
    const key = String(alarm.created_at);
    if (!alarmMap.has(key)) {
      alarmMap.set(key, []);
    }

    alarmMap.get(key).push({
      id: alarm.id,
      type: alarm.alarm_type,
      label: alarmTypeLabelMap[alarm.alarm_type] || alarm.alarm_type,
      level: alarm.alarm_level,
      message: alarm.message,
      createdAt: alarm.created_at,
    });
  });

  return alarmMap;
}

/*给健康记录补充展示值和异常标记*/
function decorateRecord(record, metric, thresholds, alarmMap) {
  const mapped = mapRecordValue(record, metric);
  const abnormalReasons = buildAbnormalReason(record, metric, thresholds);
  const relatedAlarms = alarmMap.get(String(record.recorded_at)) || [];

  return {
    ...record,
    mappedValue: mapped,
    abnormalReasons,
    abnormal: abnormalReasons.length > 0,
    relatedAlarms,
    alarmRelated: relatedAlarms.length > 0,
  };
}

/*按状态条件筛选处理后的历史记录*/
function filterDecoratedRecords(records, status, alarmRelatedOnly) {
  return records.filter((record) => {
    if (status === 'abnormal' && !record.abnormal) {
      return false;
    }

    if (status === 'normal' && record.abnormal) {
      return false;
    }

    if (alarmRelatedOnly && !record.alarmRelated) {
      return false;
    }

    return true;
  });
}

/*统计历史记录摘要数据*/
function buildSummary(validRecords, metric, thresholds) {
  if (validRecords.length === 0) {
    return {
      recordCount: 0,
      abnormalCount: 0,
      alarmRelatedCount: 0,
      latestAt: null,
      latestValue: null,
      latestSecondaryValue: null,
      averageValue: null,
      averageSecondaryValue: null,
      maxValue: null,
      maxSecondaryValue: null,
      minValue: null,
      minSecondaryValue: null,
      totalValue: null,
    };
  }

  const latest = [...validRecords].sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))[0];
  const abnormalCount = validRecords.filter((record) => isRecordAbnormal(record, metric, thresholds)).length;
  const alarmRelatedCount = validRecords.filter((record) => record.alarmRelated).length;

  if (metric === 'blood_pressure') {
    const systolicValues = validRecords.map((record) => record.systolic_bp);
    const diastolicValues = validRecords.map((record) => record.diastolic_bp);
    return {
      recordCount: validRecords.length,
      abnormalCount,
      alarmRelatedCount,
      latestAt: latest.recorded_at,
      latestValue: latest.systolic_bp,
      latestSecondaryValue: latest.diastolic_bp,
      averageValue: Math.round(systolicValues.reduce((sum, value) => sum + value, 0) / systolicValues.length),
      averageSecondaryValue: Math.round(diastolicValues.reduce((sum, value) => sum + value, 0) / diastolicValues.length),
      maxValue: Math.max(...systolicValues),
      maxSecondaryValue: Math.max(...diastolicValues),
      minValue: Math.min(...systolicValues),
      minSecondaryValue: Math.min(...diastolicValues),
      totalValue: null,
    };
  }

  const values = validRecords.map((record) => record[metric]);
  const totalValue = metric === 'steps' ? values.reduce((sum, value) => sum + value, 0) : null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    recordCount: validRecords.length,
    abnormalCount,
    alarmRelatedCount,
    latestAt: latest.recorded_at,
    latestValue: latest[metric],
    latestSecondaryValue: null,
    averageValue: metric === 'body_temp' ? Number(average.toFixed(1)) : Math.round(average),
    averageSecondaryValue: null,
    maxValue: Math.max(...values),
    maxSecondaryValue: null,
    minValue: Math.min(...values),
    minSecondaryValue: null,
    totalValue,
  };
}

/*构建原始粒度的趋势数据*/
function buildRawTrend(validRecords, metric) {
  return [...validRecords]
    .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))
    .map((record) => {
      const recordedAt = new Date(record.recorded_at);
      return {
        key: `${record.id}-${record.recorded_at}`,
        label: formatBucketLabel(recordedAt, 'raw'),
        fullLabel: formatFullLabel(recordedAt, 'raw'),
        recordedAt: record.recorded_at,
        value: record.mappedValue.value,
        secondaryValue: record.mappedValue.secondaryValue,
        abnormal: record.abnormal,
        alarmRelated: record.alarmRelated,
      };
    });
}

/*按小时或天聚合趋势数据*/
function buildGroupedTrend(validRecords, metric, granularity) {
  const sortedRecords = [...validRecords].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
  const buckets = new Map();

  sortedRecords.forEach((record) => {
    const recordedAt = new Date(record.recorded_at);
    const bucketKey = getBucketKey(recordedAt, granularity);

    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, {
        key: bucketKey,
        label: formatBucketLabel(recordedAt, granularity),
        fullLabel: formatFullLabel(recordedAt, granularity),
        recordedAt: record.recorded_at,
        count: 0,
        sumValue: 0,
        sumSecondaryValue: 0,
      });
    }

    const bucket = buckets.get(bucketKey);
    bucket.recordedAt = record.recorded_at;
    bucket.count += 1;

    if (metric === 'blood_pressure') {
      bucket.sumValue += record.systolic_bp;
      bucket.sumSecondaryValue += record.diastolic_bp;
      return;
    }

    bucket.sumValue += record[metric];
  });

  return Array.from(buckets.values()).map((bucket) => {
    if (metric === 'blood_pressure') {
      return {
        key: bucket.key,
        label: bucket.label,
        fullLabel: bucket.fullLabel,
        recordedAt: bucket.recordedAt,
        value: Math.round(bucket.sumValue / bucket.count),
        secondaryValue: Math.round(bucket.sumSecondaryValue / bucket.count),
      };
    }

    const aggregatedValue = metric === 'steps'
      ? bucket.sumValue
      : metric === 'body_temp'
        ? Number((bucket.sumValue / bucket.count).toFixed(1))
        : Math.round(bucket.sumValue / bucket.count);

    return {
      key: bucket.key,
      label: bucket.label,
      fullLabel: bucket.fullLabel,
      recordedAt: bucket.recordedAt,
      value: aggregatedValue,
      secondaryValue: null,
    };
  });
}

/*查询健康历史列表、趋势和摘要信息*/
export async function GET(request) {
  try {
    db.initDB();

    const { searchParams } = new URL(request.url);
    const personId = Number.parseInt(searchParams.get('person_id') || '', 10);
    const metric = normalizeMetric(searchParams.get('metric'));
    const granularity = normalizeGranularity(searchParams.get('granularity'));
    const status = normalizeStatus(searchParams.get('status'));
    const alarmRelatedOnly = searchParams.get('alarm_related') === 'true';
    const page = parsePositiveInt(searchParams.get('page'), 1);
    const pageSize = parsePositiveInt(searchParams.get('page_size'), 20);
    const startDate = toDateStart(searchParams.get('start_date'));
    const endDate = toDateEnd(searchParams.get('end_date'));

    if (!Number.isInteger(personId) || personId <= 0) {
      return NextResponse.json({ error: '缺少有效的 person_id 参数' }, { status: 400 });
    }

    if (startDate && endDate && startDate > endDate) {
      return NextResponse.json({ error: '开始时间不能晚于结束时间' }, { status: 400 });
    }

    const person = await db.monitoredPersons.getById(personId);
    if (!person) {
      return NextResponse.json({ error: '监测对象不存在' }, { status: 404 });
    }

    const thresholds = await db.thresholds.get(personId);
    const allRecords = await db.healthRecords.getByPersonId(personId, {
      startDate: startDate ? startDate.toISOString() : null,
      endDate: endDate ? endDate.toISOString() : null,
    });

    const metricAlarmTypes = getMetricAlarmTypes(metric);
    const personAlarms = metricAlarmTypes.length > 0
      ? await db.alarms.getByPersonId(personId)
      : [];
    const filteredAlarms = personAlarms.filter((alarm) => {
      if (!metricAlarmTypes.includes(alarm.alarm_type)) {
        return false;
      }

      const alarmDate = new Date(alarm.created_at);
      if (startDate && alarmDate < startDate) {
        return false;
      }
      if (endDate && alarmDate > endDate) {
        return false;
      }
      return true;
    });
    const alarmMap = buildAlarmMap(filteredAlarms);

    const decoratedRecords = allRecords
      .filter((record) => isMetricRecordValid(record, metric))
      .map((record) => decorateRecord(record, metric, thresholds, alarmMap));
    const filteredRecords = filterDecoratedRecords(decoratedRecords, status, alarmRelatedOnly);

    const summary = buildSummary(filteredRecords, metric, thresholds);
    const trend = granularity === 'raw'
      ? buildRawTrend(filteredRecords, metric)
      : buildGroupedTrend(filteredRecords, metric, granularity);

    const sortedDescRecords = [...filteredRecords].sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
    const total = sortedDescRecords.length;
    const startIndex = (page - 1) * pageSize;
    const pagedRecords = sortedDescRecords.slice(startIndex, startIndex + pageSize).map((record) => {
      return {
        id: record.id,
        recordedAt: record.recorded_at,
        deviceId: record.device_id ?? null,
        value: record.mappedValue.value,
        secondaryValue: record.mappedValue.secondaryValue,
        displayValue: record.mappedValue.displayValue,
        abnormal: record.abnormal,
        abnormalReasons: record.abnormalReasons,
        alarmRelated: record.alarmRelated,
        relatedAlarms: record.relatedAlarms,
      };
    });

    return NextResponse.json({
      person: {
        id: person.id,
        name: person.name,
      },
      metric,
      granularity,
      filters: {
        status,
        alarmRelatedOnly,
      },
      threshold: thresholds,
      summary,
      trend,
      records: pagedRecords,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    console.error('Health history error:', error);
    return NextResponse.json({ error: error.message || '历史健康数据获取失败' }, { status: 500 });
  }
}
