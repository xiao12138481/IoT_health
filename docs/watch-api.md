# 手表接口文档

## 文档说明

- 项目名称：IoT Health
- 基础地址：`http://localhost:5000`
- 数据格式：`application/json`
- 时间格式：ISO 8601，例如 `2026-06-19T12:00:00.000Z`
- 当前文档基于项目中**已经实现并可调用**的接口整理，不包含未落地的纸面设计接口

## 对接目标

本项目当前支持以下典型对接流程：

1. 查询设备信息，确认 `device_id`
2. 手表调用 `POST /api/health-records` 上报健康数据
3. 平台自动写入 `health_records`
4. 平台自动更新设备最后同步时间
5. 平台按阈值自动生成报警
6. 前端通过总览、历史、报警接口读取最新状态

## 1. 健康数据上报

### 接口

- 方法：`POST`
- 路径：`/api/health-records`

### 功能

用于手表、手环等设备向平台主动上报健康数据。

### 请求头

```http
Content-Type: application/json
```

### 请求体字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `person_id` | number | 是 | 监测对象 ID |
| `device_id` | number | 否 | 设备 ID |
| `heart_rate` | number | 否 | 心率，单位 bpm，范围 `20~260` |
| `blood_oxygen` | number | 否 | 血氧，单位 `%`，范围 `50~100` |
| `systolic_bp` | number | 否 | 收缩压，单位 mmHg，范围 `40~260` |
| `diastolic_bp` | number | 否 | 舒张压，单位 mmHg，范围 `30~180` |
| `body_temp` | number | 否 | 体温，单位 `°C`，范围 `30~45` |
| `steps` | number | 否 | 步数，范围 `0~200000` |
| `battery_level` | number | 否 | 电量，范围 `0~100` |
| `recorded_at` | string | 否 | 数据采集时间，不传则使用服务端当前时间 |

### 校验规则

- 至少需要提供一项健康数据：`heart_rate`、`blood_oxygen`、`systolic_bp`、`diastolic_bp`、`body_temp`、`steps`
- 血压必须成对上传：`systolic_bp` 和 `diastolic_bp` 必须同时存在
- `person_id` 必须存在且对应系统内真实监测对象
- `device_id` 如果传入，必须对应系统内真实设备
- `device_id` 如果已绑定人员，则该人员必须与 `person_id` 一致

### 成功后联动

- 写入 `health_records`
- 更新对应设备：
  - `last_sync_at`
  - `status = online`
  - `battery_level`，仅在传入时更新
- 根据当前阈值自动触发报警：
  - 高心率
  - 低心率
  - 低血氧
  - 高体温
  - 低体温
  - 高收缩压
  - 低收缩压
  - 高舒张压
  - 低舒张压

### 请求示例

```json
{
  "person_id": 1,
  "device_id": 1,
  "heart_rate": 78,
  "blood_oxygen": 97,
  "systolic_bp": 124,
  "diastolic_bp": 80,
  "body_temp": 36.6,
  "steps": 135,
  "battery_level": 82,
  "recorded_at": "2026-06-19T11:05:00.000Z"
}
```

### 成功响应示例

```json
{
  "success": true,
  "record": {
    "id": 2137,
    "person_id": 1,
    "device_id": 1,
    "heart_rate": 78,
    "blood_oxygen": 97,
    "systolic_bp": 124,
    "diastolic_bp": 80,
    "body_temp": 36.6,
    "steps": 135,
    "recorded_at": "2026-06-19T11:05:00.000Z",
    "created_at": "2026-06-19T11:05:01.000Z"
  },
  "alarm_count": 0,
  "alarms": [],
  "device_updated": true
}
```

### 触发报警响应示例

```json
{
  "success": true,
  "record": {
    "id": 2138,
    "person_id": 1,
    "device_id": 1,
    "heart_rate": 130,
    "blood_oxygen": 88,
    "systolic_bp": 170,
    "diastolic_bp": 105,
    "body_temp": 38.8,
    "steps": 0,
    "recorded_at": "2026-06-19T12:00:00.000Z",
    "created_at": "2026-06-19T12:00:01.000Z"
  },
  "alarm_count": 5,
  "alarms": [
    {
      "id": 2058,
      "person_id": 1,
      "device_id": 1,
      "alarm_type": "heart_rate_high",
      "alarm_level": "critical",
      "message": "心率过高: 130 bpm",
      "value": 130,
      "threshold": 100,
      "is_acknowledged": false,
      "acknowledged_at": null,
      "acknowledged_by": null,
      "created_at": "2026-06-19T12:00:00.000Z"
    }
  ],
  "device_updated": true
}
```

### 错误响应示例

```json
{
  "error": "血压数据必须同时提供 systolic_bp 和 diastolic_bp"
}
```

### 常见状态码

| 状态码 | 说明 |
| --- | --- |
| `200` | 上报成功 |
| `400` | 参数错误 |
| `404` | 监测对象或设备不存在 |
| `500` | 服务端异常 |

## 2. 健康记录查询

### 接口

- 方法：`GET`
- 路径：`/api/health-records`

### 功能

查询某个监测对象的历史健康数据。

### 查询参数

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `person_id` | 是 | 监测对象 ID |
| `type` | 否 | 数据类型，可选：`heart_rate`、`blood_pressure`、`blood_oxygen`、`body_temp` |
| `start` | 否 | 开始时间 |
| `end` | 否 | 结束时间 |
| `limit` | 否 | 返回条数，默认 `500` |

### 请求示例

```http
GET /api/health-records?person_id=1&type=heart_rate&limit=100
```

### 响应示例

```json
{
  "records": [
    {
      "id": 2137,
      "person_id": 1,
      "device_id": 1,
      "heart_rate": 78,
      "blood_oxygen": 97,
      "systolic_bp": 124,
      "diastolic_bp": 80,
      "body_temp": 36.6,
      "steps": 135,
      "recorded_at": "2026-06-19T11:05:00.000Z",
      "created_at": "2026-06-19T11:05:01.000Z"
    }
  ]
}
```

## 3. 设备查询

### 接口

- 方法：`GET`
- 路径：`/api/devices`

### 功能

查询设备列表及其关联人员信息。

### 响应示例

```json
{
  "devices": [
    {
      "id": 1,
      "name": "智能手表 A01",
      "model": "Watch Pro",
      "firmware_version": "1.0.0",
      "battery_level": 82,
      "status": "online",
      "person_id": 1,
      "last_sync_at": "2026-06-19T11:05:00.000Z",
      "created_at": "2026-06-18T08:00:00.000Z",
      "person_name": "张三"
    }
  ]
}
```

## 4. 设备状态更新

### 接口

- 方法：`PUT`
- 路径：`/api/devices`

### 功能

手动更新设备状态、设备名称、电量、绑定人员。

### 请求体字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 设备 ID |
| `status` | 否 | 设备状态，例如 `online`、`offline` |
| `battery_level` | 否 | 电量 |
| `person_id` | 否 | 绑定人员 ID |
| `name` | 否 | 设备名称 |

### 请求示例

```json
{
  "id": 1,
  "status": "online",
  "battery_level": 80,
  "person_id": 1,
  "name": "智能手表 A01"
}
```

### 响应示例

```json
{
  "success": true
}
```

## 5. 健康总览查询

### 接口

- 方法：`GET`
- 路径：`/api/dashboard`

### 功能

获取前端总览页需要的综合数据，包括最新健康值、今日步数、趋势、报警和阈值。

### 查询参数

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `person_id` | 是 | 监测对象 ID |

### 请求示例

```http
GET /api/dashboard?person_id=1
```

### 响应字段摘要

| 字段 | 说明 |
| --- | --- |
| `person` | 监测对象信息 |
| `latestRecord` | 最新健康记录 |
| `latestBloodPressure` | 最新血压记录 |
| `totalSteps` | 今日总步数 |
| `hrTrend` | 24 小时心率趋势 |
| `bpTrend` | 24 小时血压趋势 |
| `recentAlarms` | 最近未确认报警 |
| `unacknowledgedAlarmCount` | 未确认报警数量 |
| `latestSleep` | 最新睡眠记录 |
| `threshold` | 当前阈值配置 |

## 6. 阈值查询

### 接口

- 方法：`GET`
- 路径：`/api/thresholds`

### 功能

查询系统当前生效的健康阈值配置。

### 查询参数

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `person_id` | 是 | 监测对象 ID |

### 响应示例

```json
{
  "threshold": {
    "heart_rate_min": 55,
    "heart_rate_max": 100,
    "blood_oxygen_min": 94,
    "blood_oxygen_max": 100,
    "body_temp_min": 36,
    "body_temp_max": 37.3,
    "steps_goal": 8000,
    "sleep_goal_min": 420,
    "systolic_bp_max": 140,
    "systolic_bp_min": 90,
    "diastolic_bp_max": 90,
    "diastolic_bp_min": 60
  }
}
```

## 7. 阈值更新

### 接口

- 方法：`PUT`
- 路径：`/api/thresholds`

### 功能

更新当前系统使用的阈值配置。

### 请求体示例

```json
{
  "person_id": 1,
  "heart_rate_min": 60,
  "heart_rate_max": 100,
  "blood_oxygen_min": 95,
  "body_temp_min": 36.0,
  "body_temp_max": 37.3,
  "steps_goal": 8000,
  "sleep_goal_min": 420,
  "systolic_bp_max": 140,
  "systolic_bp_min": 90,
  "diastolic_bp_max": 90,
  "diastolic_bp_min": 60
}
```

### 响应示例

```json
{
  "success": true
}
```

## 8. 报警记录查询

### 接口

- 方法：`GET`
- 路径：`/api/alarm-records`

### 功能

查询报警记录、报警分页和过滤结果。

### 查询参数

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `person_id` | 是 | 监测对象 ID |
| `alarm_type` | 否 | 报警类型 |
| `alarm_level` | 否 | 报警等级 |
| `acknowledged` | 否 | 是否已确认，`true` 或 `false` |
| `limit` | 否 | 限制条数 |
| `page` | 否 | 页码，默认 `1` |
| `page_size` | 否 | 每页条数，默认 `15` |

### 请求示例

```http
GET /api/alarm-records?person_id=1&acknowledged=false&page=1&page_size=15
```

### 响应示例

```json
{
  "records": [
    {
      "id": 2058,
      "person_id": 1,
      "device_id": 1,
      "alarm_type": "heart_rate_high",
      "alarm_level": "critical",
      "message": "心率过高: 130 bpm",
      "value": 130,
      "threshold": 100,
      "is_acknowledged": false,
      "acknowledged_at": null,
      "acknowledged_by": null,
      "created_at": "2026-06-19T12:00:00.000Z",
      "monitored_persons": {
        "name": "张三"
      }
    }
  ],
  "total": 1
}
```

## 9. 报警确认

### 接口

- 方法：`PUT`
- 路径：`/api/alarm-records`

### 功能

支持单条报警确认和某用户全部报警确认。

### 单条确认请求示例

```json
{
  "id": 2058,
  "is_acknowledged": true
}
```

### 全部确认请求示例

```json
{
  "person_id": 1,
  "acknowledge_all": true
}
```

### 响应示例

```json
{
  "success": true
}
```

## 报警类型说明

| `alarm_type` | 说明 |
| --- | --- |
| `heart_rate_high` | 心率过高 |
| `heart_rate_low` | 心率过低 |
| `blood_oxygen_low` | 血氧过低 |
| `fever` | 体温过高 |
| `body_temp_low` | 体温过低 |
| `systolic_bp_high` | 收缩压过高 |
| `systolic_bp_low` | 收缩压过低 |
| `diastolic_bp_high` | 舒张压过高 |
| `diastolic_bp_low` | 舒张压过低 |

## 推荐对接顺序

1. 使用 `GET /api/devices` 确认设备信息
2. 使用 `POST /api/health-records` 周期性上报健康数据
3. 使用 `GET /api/dashboard` 获取最新聚合状态
4. 使用 `GET /api/health-records` 查询历史趋势
5. 使用 `GET /api/alarm-records` 查询报警
6. 使用 `GET /api/thresholds` 获取阈值

## 备注

- 当前 `POST /api/health-records` 已经是真实可调用接口
- 当前阈值为系统统一阈值配置，接口层需要传 `person_id`，但阈值实际按系统当前配置生效
- 文档基于当前代码实现整理，如后续接口扩展，应同步更新本文件
