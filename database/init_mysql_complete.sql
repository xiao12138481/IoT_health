-- IoT 健康监测系统 - MySQL 完整数据库初始化脚本
-- 创建时间: 2026-06-23
-- 与 schema.ts 完全一致
-- 使用方式: mysql -u root -p < database/init_mysql_complete.sql

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS iot_health DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE iot_health;

-- ============================================
-- 0. 系统健康检查表
-- ============================================
CREATE TABLE IF NOT EXISTS health_check (
  id INT AUTO_INCREMENT PRIMARY KEY,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 1. 用户表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password VARCHAR(256) NOT NULL,
  email VARCHAR(128) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  person_id INT,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX users_username_idx (username),
  INDEX users_role_idx (role),
  INDEX users_person_id_idx (person_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. 会话表
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(256) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX sessions_user_id_idx (user_id),
  INDEX sessions_token_idx (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. 被监测人员表
-- ============================================
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX monitored_persons_status_idx (status),
  INDEX monitored_persons_created_at_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. 设备表
-- ============================================
CREATE TABLE IF NOT EXISTS devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  model VARCHAR(64) NOT NULL,
  firmware_version VARCHAR(32),
  battery_level INT DEFAULT 100,
  status VARCHAR(20) NOT NULL DEFAULT 'offline',
  last_sync_at TIMESTAMP NULL,
  person_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX devices_person_id_idx (person_id),
  INDEX devices_status_idx (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. 健康记录表
-- ============================================
CREATE TABLE IF NOT EXISTS health_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  heart_rate INT,
  blood_oxygen INT,
  systolic_bp INT,
  diastolic_bp INT,
  body_temp DECIMAL(4,1),
  steps INT,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX health_records_person_id_idx (person_id),
  INDEX health_records_recorded_at_idx (recorded_at),
  INDEX health_records_person_recorded_idx (person_id, recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. 睡眠记录表
-- ============================================
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
  source_sleep_session_id INT,
  source_scenario VARCHAR(50),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX sleep_records_person_id_idx (person_id),
  INDEX sleep_records_recorded_at_idx (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 7. 睡眠报告表
-- ============================================
CREATE TABLE IF NOT EXISTS sleep_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  source_sleep_record_id INT,
  report_no VARCHAR(64),
  report_title VARCHAR(256),
  report_summary TEXT,
  score INT DEFAULT 0,
  sleep_level VARCHAR(20),
  analysis TEXT,
  recommendations TEXT,
  risk_flags TEXT,
  generated_by VARCHAR(20) DEFAULT 'rules',
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  expires_at TIMESTAMP,
  INDEX sleep_reports_person_id_idx (person_id),
  INDEX sleep_reports_recorded_at_idx (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 8. 睡眠会话表
-- ============================================
CREATE TABLE IF NOT EXISTS sleep_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  scenario VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  demo_mode BOOLEAN DEFAULT FALSE,
  planned_epochs INT DEFAULT 0,
  completed_epochs INT DEFAULT 0,
  epoch_minutes INT DEFAULT 20,
  session_start_time TIMESTAMP,
  session_end_time TIMESTAMP,
  current_stage VARCHAR(20),
  stage_plan TEXT,
  report_generated BOOLEAN DEFAULT FALSE,
  source_scenario VARCHAR(50),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX sleep_sessions_person_id_idx (person_id),
  INDEX sleep_sessions_status_idx (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 9. 睡眠阶段事件表
-- ============================================
CREATE TABLE IF NOT EXISTS sleep_stage_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  person_id INT NOT NULL,
  epoch_index INT DEFAULT 0,
  stage VARCHAR(20) NOT NULL,
  simulated_at TIMESTAMP,
  heart_rate INT,
  blood_oxygen INT,
  body_temp DECIMAL(4,1),
  movement_level INT,
  respiratory_rate INT,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX sleep_stage_events_session_id_idx (session_id),
  INDEX sleep_stage_events_person_id_idx (person_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 10. 运动记录表
-- ============================================
CREATE TABLE IF NOT EXISTS exercise_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  sport_type VARCHAR(20) NOT NULL,
  duration_min INT DEFAULT 0,
  distance_km DECIMAL(5,2) DEFAULT 0,
  calories INT DEFAULT 0,
  average_speed_kmh DECIMAL(5,2),
  average_heart_rate INT,
  fitness_age INT,
  heart_rate_zones TEXT,
  pace_segments TEXT,
  pace_min_per_km DECIMAL(4,2),
  pause_count INT DEFAULT 0,
  notes TEXT,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX exercise_records_person_id_idx (person_id),
  INDEX exercise_records_recorded_at_idx (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 11. 运动报告表
-- ============================================
CREATE TABLE IF NOT EXISTS exercise_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  report_no VARCHAR(64),
  report_title VARCHAR(256),
  report_summary TEXT,
  activity_level VARCHAR(20),
  total_steps INT,
  goal_reached_days INT,
  active_days INT,
  low_activity_days INT,
  peak_day_steps INT,
  peak_day_date TIMESTAMP,
  total_calories INT,
  total_distance_km DECIMAL(6,2),
  total_active_min INT,
  sample_count INT,
  analysis TEXT,
  recommendations TEXT,
  risk_flags TEXT,
  daily_breakdown TEXT,
  report_start TIMESTAMP,
  report_end TIMESTAMP,
  generated_by VARCHAR(20) DEFAULT 'rules',
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  expires_at TIMESTAMP,
  INDEX exercise_reports_person_id_idx (person_id),
  INDEX exercise_reports_recorded_at_idx (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 12. 压力情绪记录表
-- ============================================
CREATE TABLE IF NOT EXISTS stress_mood_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  hrv_mean INT,
  hrv_sdnn INT,
  hrv_rmssd INT,
  hrv_pnn50 INT,
  stress_score INT,
  stress_level VARCHAR(20),
  mood_state VARCHAR(20),
  autonomic_balance VARCHAR(20),
  analysis TEXT,
  recommendations TEXT,
  heart_rate INT,
  blood_oxygen INT,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX stress_mood_records_person_id_idx (person_id),
  INDEX stress_mood_records_recorded_at_idx (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 13. 压力情绪报告表
-- ============================================
CREATE TABLE IF NOT EXISTS stress_mood_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  report_no VARCHAR(64),
  report_title VARCHAR(256),
  report_summary TEXT,
  analysis TEXT,
  recommendations TEXT,
  risk_flags TEXT,
  generated_by VARCHAR(20) DEFAULT 'rules',
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  expires_at TIMESTAMP,
  INDEX stress_mood_reports_person_id_idx (person_id),
  INDEX stress_mood_reports_recorded_at_idx (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 14. 血管评估表
-- ============================================
CREATE TABLE IF NOT EXISTS vascular_assessments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  systolic_min INT DEFAULT 0,
  systolic_max INT DEFAULT 0,
  diastolic_min INT DEFAULT 0,
  diastolic_max INT DEFAULT 0,
  systolic_range INT DEFAULT 0,
  diastolic_range INT DEFAULT 0,
  health_score INT DEFAULT 0,
  elasticity_level VARCHAR(20),
  assessment_result TEXT,
  findings TEXT,
  recommendations TEXT,
  bp_measurement_count INT DEFAULT 0,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX vascular_assessments_person_id_idx (person_id),
  INDEX vascular_assessments_recorded_at_idx (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 15. 血管评估报告表
-- ============================================
CREATE TABLE IF NOT EXISTS vascular_assessment_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  source_vascular_assessment_id INT,
  report_no VARCHAR(64),
  report_title VARCHAR(256),
  report_summary TEXT,
  findings TEXT,
  assessment_result VARCHAR(256),
  recommendations TEXT,
  risk_flags TEXT,
  generated_by VARCHAR(20) DEFAULT 'rules',
  blood_pressure_summary TEXT,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  expires_at TIMESTAMP,
  INDEX vascular_assessment_reports_person_id_idx (person_id),
  INDEX vascular_assessment_reports_recorded_at_idx (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 16. 报警记录表
-- ============================================
CREATE TABLE IF NOT EXISTS alarm_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  device_id INT,
  alarm_type VARCHAR(32) NOT NULL,
  alarm_level VARCHAR(20) NOT NULL DEFAULT 'warning',
  message VARCHAR(512) NOT NULL,
  value DECIMAL(10,2),
  threshold DECIMAL(10,2),
  is_acknowledged BOOLEAN DEFAULT FALSE NOT NULL,
  acknowledged_at TIMESTAMP,
  acknowledged_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX alarm_records_person_id_idx (person_id),
  INDEX alarm_records_alarm_type_idx (alarm_type),
  INDEX alarm_records_alarm_level_idx (alarm_level),
  INDEX alarm_records_is_acknowledged_idx (is_acknowledged),
  INDEX alarm_records_created_at_idx (created_at),
  INDEX alarm_records_person_created_idx (person_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 17. 阈值配置表
-- ============================================
CREATE TABLE IF NOT EXISTS threshold_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL UNIQUE,
  heart_rate_min INT DEFAULT 60,
  heart_rate_max INT DEFAULT 100,
  blood_oxygen_min INT DEFAULT 95,
  blood_oxygen_max INT DEFAULT 100,
  body_temp_max DECIMAL(4,1) DEFAULT 37.3,
  body_temp_min DECIMAL(4,1) DEFAULT 36.0,
  steps_goal INT DEFAULT 8000,
  sleep_goal_min INT DEFAULT 480,
  systolic_bp_max INT DEFAULT 140,
  systolic_bp_min INT DEFAULT 90,
  diastolic_bp_max INT DEFAULT 90,
  diastolic_bp_min INT DEFAULT 60,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX threshold_configs_person_id_idx (person_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 18. 系统配置表
-- ============================================
CREATE TABLE IF NOT EXISTS system_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(128) NOT NULL UNIQUE,
  config_value TEXT,
  config_type VARCHAR(20) DEFAULT 'string',
  description VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX system_configs_config_key_idx (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 插入默认数据
-- ============================================

-- 插入默认系统配置
INSERT INTO system_configs (config_key, config_value, config_type, description) 
VALUES 
('database_type', 'json', 'string', '当前使用的数据库类型：json 或 mysql'),
('database_migrated', 'false', 'boolean', '是否已完成数据迁移')
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);

-- ============================================
-- 完成！
-- ============================================
SELECT '✅ 所有数据表创建成功！数据库结构完整！' AS message;
SELECT CONCAT('📊 共创建 ', COUNT(*), ' 个数据表') AS summary FROM information_schema.tables WHERE table_schema = 'iot_health';
