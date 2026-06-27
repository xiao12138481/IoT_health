// 数据库初始化脚本 - 创建所有表
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  multipleStatements: true
};

const createTablesSQL = `
USE iot_health;

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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_person_id (person_id)
);
`;

async function initDatabase() {
  let connection;
  try {
    console.log('🔌 连接到 MySQL 服务器...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('✅ 连接成功！');
    console.log('📋 开始创建数据表...');
    
    await connection.query(createTablesSQL);
    
    console.log('🎉 所有数据表创建成功！');
    
    // 检查已创建的表
    const [tables] = await connection.query('SHOW TABLES;');
    console.log('📊 已创建的表:');
    tables.forEach((t) => console.log(`  - ${Object.values(t)[0]}`));
    
    console.log('\n✅ 数据库初始化完成！');
    
  } catch (error) {
    console.error('❌ 初始化失败:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initDatabase();