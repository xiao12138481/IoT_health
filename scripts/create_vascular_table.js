const mysql = require('mysql2/promise');
require('dotenv').config();

async function createVascularTable() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'iot_health'
    });

    console.log('✅ 数据库连接成功！');

    // 创建血管弹性评估表
    const createTableSQL = `
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await connection.execute(createTableSQL);
    console.log('✅ 血管弹性评估表创建成功！');

    const [tables] = await connection.execute('SHOW TABLES LIKE "vascular_assessments"');
    if (tables.length > 0) {
      console.log('✅ 表已成功创建！');
    }

    await connection.end();
    console.log('✅ 操作完成！');
  } catch (error) {
    console.error('❌ 操作失败：', error);
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

createVascularTable();
