#!/usr/bin/env node
console.log('🚀 开始清空 MySQL 数据库健康数据...');

const fs = require('fs');
const path = require('path');

// 加载环境变量
require('dotenv').config();

console.log('📋 当前 MySQL 配置:');
console.log('   - Host:', process.env.MYSQL_HOST || 'localhost');
console.log('   - Port:', process.env.MYSQL_PORT || '3306');
console.log('   - User:', process.env.MYSQL_USER || 'root');
console.log('   - Database:', process.env.MYSQL_DATABASE || 'iot_health');

// 检查 MySQL 配置
if (!process.env.MYSQL_HOST) {
  console.error('❌ 错误: 请先配置 MySQL 环境变量（.env 文件）');
  process.exit(1);
}

const mysql = require('mysql2/promise');

async function clearMySQLData() {
  let connection = null;
  
  try {
    // 1. 创建连接
    console.log('\n🔗 正在连接 MySQL 数据库...');
    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'iot_health',
      multipleStatements: true,
    });
    
    console.log('✅ MySQL 数据库连接成功！');
    
    // 2. 获取所有表名
    console.log('\n📊 获取数据库表列表...');
    const [tablesResult] = await connection.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = '${process.env.MYSQL_DATABASE || 'iot_health'}'
    `);
    
    const tables = tablesResult.map(row => row.table_name);
    console.log('   找到', tables.length, '个表:', tables.join(', '));
    
    // 3. 清空所有表（按依赖关系顺序）
    console.log('\n🗑️  正在清空表数据...');
    
    const deleteOrder = [
      'vascular_assessment_reports',
      'vascular_assessments',
      'stress_mood_reports',
      'stress_mood_records',
      'exercise_reports',
      'exercise_records',
      'sleep_reports',
      'sleep_stage_events',
      'sleep_sessions',
      'sleep_records',
      'alarm_records',
      'health_records',
      'devices',
      'users',
      'monitored_persons'
    ];
    
    let totalRows = 0;
    
    for (const table of deleteOrder) {
      if (tables.includes(table)) {
        try {
          const [result] = await connection.execute(`DELETE FROM ${table}`);
          console.log(`   ✅ ${table}: 删除了 ${result.affectedRows} 行`);
          totalRows += result.affectedRows;
        } catch (error) {
          console.log(`   ⚠️  ${table}: 跳过 - ${error.message}`);
        }
      }
    }
    
    // 4. 保留阈值配置
    console.log('\n💾 保留阈值配置表（threshold_configs）');
    
    console.log(`\n🎉 清空完成！总共删除了 ${totalRows} 行数据！`);
    
  } catch (error) {
    console.error('\n❌ 清空失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 执行清空操作
clearMySQLData().catch(console.error);
