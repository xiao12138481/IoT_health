-- 创建压力与情绪记录表
-- 用于存储基于HRV的压力与情绪状态评估结果

USE iot_health;

CREATE TABLE IF NOT EXISTS stress_mood_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  
  -- HRV 相关数据
  hrv_mean INT COMMENT '平均HRV值（毫秒）',
  hrv_sdnn INT COMMENT 'SDNN（正常NN间隔标准差，毫秒）',
  hrv_rmssd INT COMMENT 'RMSSD（相邻NN间隔差值的均方根，毫秒）',
  hrv_pnn50 INT COMMENT 'pNN50（NN50占比，百分比）',
  
  -- 压力与情绪评估
  stress_score INT NOT NULL COMMENT '压力评分（0-100）',
  stress_level VARCHAR(20) NOT NULL COMMENT '压力等级：low/moderate/high/severe',
  mood_state VARCHAR(20) NOT NULL COMMENT '情绪状态：calm/relaxed/neutral/stressed/anxious',
  autonomic_balance VARCHAR(20) NOT NULL COMMENT '自主神经平衡：balanced/parasympathetic/sympathetic',
  
  -- 建议与分析
  analysis TEXT COMMENT 'AI分析结果',
  recommendations TEXT COMMENT '建议内容',
  
  -- 时间戳
  recorded_at TIMESTAMP NOT NULL COMMENT '记录时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- 索引
  INDEX idx_person_id (person_id),
  INDEX idx_recorded_at (recorded_at),
  INDEX idx_person_recorded (person_id, recorded_at),
  INDEX idx_stress_level (stress_level)
);
