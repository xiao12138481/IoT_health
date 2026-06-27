-- IoT 健康监测系统 - MySQL 数据库结构
-- 创建时间: 2026-06-18

USE iot_health;

-- 1. 系统健康检查表
CREATE TABLE IF NOT EXISTS health_check (
  id INT AUTO_INCREMENT PRIMARY KEY,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. 被监测人员表
CREATE TABLE IF NOT EXISTS monitored_persons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  age INT NOT NULL,
  gender VARCHAR(10) NOT NULL,
  avatar_url VARCHAR(512),
  phone VARCHAR(20),
  emergency_contact VARCHAR(64),
  emergency_phone VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- 3. 设备表
CREATE TABLE IF NOT EXISTS devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  model VARCHAR(64) NOT NULL,
  firmware_version VARCHAR(32),
  battery_level INT DEFAULT 100,
  status VARCHAR(20) NOT NULL DEFAULT 'offline',
  last_sync_at TIMESTAMP NULL,
  person_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_person_id (person_id),
  INDEX idx_status (status)
);

-- 4. 健康记录表
CREATE TABLE IF NOT EXISTS health_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  heart_rate INT,
  blood_oxygen INT,
  body_temp DECIMAL(4, 1),
  steps INT,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_person_id (person_id),
  INDEX idx_recorded_at (recorded_at),
  INDEX idx_person_recorded (person_id, recorded_at)
);

-- 5. 睡眠记录表
CREATE TABLE IF NOT EXISTS sleep_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  deep_sleep_min INT DEFAULT 0,
  light_sleep_min INT DEFAULT 0,
  rem_sleep_min INT DEFAULT 0,
  awake_min INT DEFAULT 0,
  score INT DEFAULT 0,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_person_id (person_id),
  INDEX idx_recorded_at (recorded_at)
);

-- 6. 报警记录表
CREATE TABLE IF NOT EXISTS alarm_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  alarm_type VARCHAR(32) NOT NULL,
  alarm_level VARCHAR(20) NOT NULL DEFAULT 'warning',
  message VARCHAR(512) NOT NULL,
  value DECIMAL(10, 2),
  threshold DECIMAL(10, 2),
  is_acknowledged BOOLEAN DEFAULT FALSE NOT NULL,
  acknowledged_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_person_id (person_id),
  INDEX idx_alarm_type (alarm_type),
  INDEX idx_alarm_level (alarm_level),
  INDEX idx_is_acknowledged (is_acknowledged),
  INDEX idx_created_at (created_at),
  INDEX idx_person_created (person_id, created_at)
);

-- 7. 阈值配置表
CREATE TABLE IF NOT EXISTS threshold_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  heart_rate_min INT DEFAULT 60,
  heart_rate_max INT DEFAULT 100,
  blood_oxygen_min INT DEFAULT 95,
  body_temp_max DECIMAL(4, 1) DEFAULT 37.3,
  body_temp_min DECIMAL(4, 1) DEFAULT 36.0,
  steps_goal INT DEFAULT 8000,
  sleep_goal_min INT DEFAULT 480,
  systolic_bp_max INT DEFAULT 140,
  systolic_bp_min INT DEFAULT 90,
  diastolic_bp_max INT DEFAULT 90,
  diastolic_bp_min INT DEFAULT 60,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_person_id (person_id)
);

-- 8. 血管弹性评估表
CREATE TABLE IF NOT EXISTS vascular_assessments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  assessment_date DATE NOT NULL COMMENT '评估日期',
  systolic_max INT NOT NULL COMMENT '当日最高收缩压',
  systolic_min INT NOT NULL COMMENT '当日最低收缩压',
  systolic_range INT NOT NULL COMMENT '收缩压极差',
  diastolic_max INT NOT NULL COMMENT '当日最高舒张压',
  diastolic_min INT NOT NULL COMMENT '当日最低舒张压',
  diastolic_range INT NOT NULL COMMENT '舒张压极差',
  health_score INT NOT NULL COMMENT '血管健康评分 (0-100)',
  elasticity_level VARCHAR(20) NOT NULL COMMENT '弹性等级: excellent, good, moderate, poor, critical',
  assessment_result TEXT COMMENT '评估结果说明',
  recommendations TEXT COMMENT '健康建议',
  bp_measurement_count INT DEFAULT 0 COMMENT '当日血压测量次数',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_person_id (person_id),
  INDEX idx_assessment_date (assessment_date),
  INDEX idx_person_date (person_id, assessment_date),
  INDEX idx_health_score (health_score)
);

-- 验证表创建
SELECT '数据库表创建完成!' AS message;
SHOW TABLES;
