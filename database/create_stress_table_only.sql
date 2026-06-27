-- 创建压力与情绪记录表
-- 用于存储基于HRV的压力与情绪状态评估结果

USE iot_health;

CREATE TABLE IF NOT EXISTS stress_mood_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  hrv_mean INT,
  hrv_sdnn INT,
  hrv_rmssd INT,
  hrv_pnn50 INT,
  stress_score INT NOT NULL,
  stress_level VARCHAR(20) NOT NULL,
  mood_state VARCHAR(20) NOT NULL,
  autonomic_balance VARCHAR(20) NOT NULL,
  analysis TEXT,
  recommendations TEXT,
  recorded_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
