#!/usr/bin/env node

/**
 * 清理血管评估数据脚本
 * 用于删除 vascular_assessments 表中的旧数据
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'database.json');

function cleanupVascularData(personId = null) {
  try {
    console.log('正在加载数据库...');
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    
    console.log('\n=== 清理前统计 ===');
    console.log('vascular_assessments 记录数:', data.vascular_assessments.length);
    console.log('vascular_assessment_reports 记录数:', data.vascular_assessment_reports.length);
    
    // 按person_id分组统计
    const assessmentsByPerson = {};
    data.vascular_assessments.forEach(a => {
      const pid = a.person_id;
      assessmentsByPerson[pid] = (assessmentsByPerson[pid] || 0) + 1;
    });
    
    console.log('\n=== 按人员统计评估记录 ===');
    Object.keys(assessmentsByPerson).sort((a,b) => a-b).forEach(pid => {
      console.log(`人员ID ${pid}: ${assessmentsByPerson[pid]} 条记录`);
    });
    
    // 执行清理
    let deletedCount = 0;
    if (personId) {
      console.log(`\n正在删除人员ID ${personId} 的评估记录...`);
      const beforeLen = data.vascular_assessments.length;
      data.vascular_assessments = data.vascular_assessments.filter(
        a => a.person_id !== personId
      );
      deletedCount = beforeLen - data.vascular_assessments.length;
      console.log(`已删除 ${deletedCount} 条记录`);
    } else {
      console.log('\n正在删除所有评估记录...');
      deletedCount = data.vascular_assessments.length;
      data.vascular_assessments = [];
      console.log(`已删除 ${deletedCount} 条记录`);
    }
    
    // 保存数据库
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    
    console.log('\n=== 清理后统计 ===');
    console.log('vascular_assessments 记录数:', data.vascular_assessments.length);
    console.log('vascular_assessment_reports 记录数:', data.vascular_assessment_reports.length);
    
    console.log('\n✅ 清理完成！');
    return deletedCount;
    
  } catch (error) {
    console.error('清理失败:', error);
    process.exit(1);
  }
}

// 解析命令行参数
const args = process.argv.slice(2);
let personId = null;

if (args.length > 0) {
  if (args[0] === '--help' || args[0] === '-h') {
    console.log(`
清理血管评估数据脚本

用法:
  node cleanup-vascular-data.js [personId]
  
参数:
  personId   可选，指定要清理的人员ID。如果不提供，则清理所有记录
  
示例:
  node cleanup-vascular-data.js          # 清理所有评估记录
  node cleanup-vascular-data.js 1        # 清理人员ID 1 的评估记录
    `);
    process.exit(0);
  }
  
  const pid = parseInt(args[0], 10);
  if (!isNaN(pid)) {
    personId = pid;
  } else {
    console.error('错误: personId 必须是数字');
    process.exit(1);
  }
}

// 执行清理
cleanupVascularData(personId);