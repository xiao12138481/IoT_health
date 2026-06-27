'use client';

/**
 * 管理员人员管理页面
 * 功能描述：
 * - 添加、编辑、删除监测人员
 * - 查看人员详情
 * - 管理所有监测对象（管理员独有）
 */

import { useState } from 'react';
import { useApp } from '@/components/layout/app-provider';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Edit,
  Trash2,
  User,
  Phone,
  UserPlus,
  Search,
  AlertCircle,
  Lock,
  KeyRound,
} from 'lucide-react';

/**
 * 人员信息数据结构
 * 表示一个被监测人员的完整信息
 */
interface Person {
  /** 人员ID */
  id: number;
  /** 姓名 */
  name: string;
  /** 年龄 */
  age: number;
  /** 性别 */
  gender: string;
  /** 联系电话 */
  phone: string;
  /** 紧急联系人姓名 */
  emergency_contact: string;
  /** 紧急联系电话 */
  emergency_phone: string;
  /** 头像URL */
  avatar_url: string | null;
  /** 状态：活跃/非活跃/高危 */
  status: string;
  /** 登录账号用户名 */
  account_username?: string;
  /** 登录账号密码 */
  account_password?: string;
}

/**
 * 人员表单数据结构
 * 用于添加/编辑人员时的表单数据
 */
interface PersonFormData {
  /** 姓名 */
  name: string;
  /** 年龄（字符串格式用于表单） */
  age: string;
  /** 性别 */
  gender: string;
  /** 联系电话 */
  phone: string;
  /** 紧急联系人姓名 */
  emergency_contact: string;
  /** 紧急联系电话 */
  emergency_phone: string;
  /** 状态 */
  status: string;
  /** 登录账号用户名 */
  account_username: string;
  /** 登录账号密码 */
  account_password: string;
}

const initialFormData: PersonFormData = {
  name: '',
  age: '',
  gender: 'male',
  phone: '',
  emergency_contact: '',
  emergency_phone: '',
  status: 'active',
  account_username: '',
  account_password: '',
};

/**
/**
 * 标准化性别值
 * 功能：
 * - 将各种格式的性别输入标准化为统一的英文值
 * - 支持中文"女"和英文"female"都转换为"female"
 * - 其他所有值（包括"男"、"male"或无效值）都转换为"male"
 * - 确保性别数据在系统中的一致性
 * @param {string} gender - 原始性别值
 * @returns {'female' | 'male'} 标准化后的性别值
 */
function normalizeGenderValue(gender: string) {
  return gender === 'female' || gender === '女' ? 'female' : 'male';
}

/**
 * 获取性别显示文本
 * @param gender - 性别值
 * @returns 性别显示文本（'男' 或 '女'）
 */
function getGenderText(gender: string) {
  return normalizeGenderValue(gender) === 'male' ? '男' : '女';
}

export default function AdminPersonsPage() {
  const { persons, currentPersonId, setCurrentPersonId, alarmCount } = useApp();
  /*页面核心状态*/
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentPerson, setCurrentPerson] = useState<Person | null>(null);
  const [formData, setFormData] = useState<PersonFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);

  /*按姓名或手机号筛选人员列表*/
  const filteredPersons = persons.filter(person =>
    person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    person.phone.includes(searchQuery)
  );

  /**
   * 获取人员状态的颜色样式类
   * @param status - 人员状态
   * @returns Tailwind CSS颜色类名
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  /**
   * 获取人员状态的显示文本
   * @param status - 人员状态
   * @returns 状态显示文本
   */
  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '活跃';
      case 'inactive':
        return '非活跃';
      case 'critical':
        return '高危';
      default:
        return status;
    }
  };

  /**
   * 获取姓名的首字母缩写（用于头像显示）
   * @param name - 人员姓名
   * @returns 姓名首字母缩写（最多2个字符）
   */
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  /*打开新增人员弹窗并重置表单*/
  const handleAddPerson = () => {
    setFormData(initialFormData);
    setIsAddDialogOpen(true);
  };

  /*打开编辑人员弹窗并回填表单*/
  const handleEditPerson = (person: Person) => {
    setCurrentPerson(person);
    setFormData({
      name: person.name,
      age: String(person.age),
      gender: normalizeGenderValue(person.gender),
      phone: person.phone,
      emergency_contact: person.emergency_contact,
      emergency_phone: person.emergency_phone,
      status: person.status,
      account_username: person.account_username || '',
      account_password: person.account_password || '',
    });
    setIsEditDialogOpen(true);
  };

  /*打开删除人员确认弹窗*/
  const handleDeletePerson = (person: Person) => {
    setCurrentPerson(person);
    setIsDeleteDialogOpen(true);
  };

  /*保存新增或编辑后的人员信息*/
  const handleSavePerson = async (isEdit = false) => {
    setSubmitting(true);
    try {
      const url = isEdit
        ? `/api/persons?id=${currentPerson?.id}`
        : '/api/persons';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          age: parseInt(formData.age),
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || (isEdit ? '更新失败' : '添加失败'));
      }

      /*保存成功后刷新页面同步上下文数据*/
      const res = await fetch('/api/persons');
      const data = await res.json();
      if (data.persons) {
        window.location.reload();
      }

      setIsAddDialogOpen(false);
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Error saving person:', error);
      alert(error instanceof Error ? error.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  /*确认删除当前选中的人员*/
  const handleConfirmDelete = async () => {
    if (!currentPerson) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/persons?id=${currentPerson.id}`, {
        method: 'DELETE',
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || '删除失败');
      }

      /*删除成功后刷新页面同步上下文数据*/
      window.location.reload();
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error deleting person:', error);
      alert(error instanceof Error ? error.message : '删除失败');
    } finally {
      setSubmitting(false);
    }
  };

  /*切换当前查看的人员*/
  const handleSelectPerson = (personId: number) => {
    setCurrentPersonId(personId);
  };

  return (
    <div className="flex flex-col">
      <Header
        persons={persons.map((p) => ({ id: p.id, name: p.name }))}
        currentPersonId={currentPersonId}
        onPersonChange={setCurrentPersonId}
        alarmCount={alarmCount}
      />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <User className="h-7 w-7 text-slate-600" /> 人员管理
            </h2>
            <p className="text-sm text-muted-foreground mt-1">管理所有监测对象</p>
          </div>
          <Button onClick={handleAddPerson} className="bg-blue-600 hover:bg-blue-700">
            <UserPlus className="h-4 w-4 mr-2" />
            添加人员
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="搜索人员姓名或手机号..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Persons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPersons.map((person) => (
            <Card
              key={person.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                person.id === currentPersonId ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => handleSelectPerson(person.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={person.avatar_url || undefined} alt={person.name} />
                      <AvatarFallback className="bg-blue-100 text-blue-800">
                        {getInitials(person.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{person.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <span>{person.age}岁</span>
                        <span>•</span>
                        <span>{getGenderText(person.gender)}</span>
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className={getStatusColor(person.status)}>
                    {getStatusText(person.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="h-4 w-4" />
                    <span>{person.phone || '未设置'}</span>
                  </div>
                  {person.emergency_contact && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <User className="h-4 w-4" />
                      <span>紧急联系人: {person.emergency_contact}</span>
                    </div>
                  )}
                  {person.emergency_phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="h-4 w-4" />
                      <span>紧急电话: {person.emergency_phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-gray-600">
                    <Lock className="h-4 w-4" />
                    <span>账号: {person.account_username || '--'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <KeyRound className="h-4 w-4" />
                    <span>密码: {person.account_password || '--'}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditPerson(person);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    编辑
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePerson(person);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    删除
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredPersons.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center">
              <User className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                {searchQuery ? '未找到匹配的人员' : '暂无监测人员'}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchQuery
                  ? '请尝试其他搜索关键词'
                  : '点击上方按钮添加第一个监测人员'}
              </p>
              {!searchQuery && (
                <Button onClick={handleAddPerson} className="bg-blue-600 hover:bg-blue-700">
                  <UserPlus className="h-4 w-4 mr-2" />
                  添加人员
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加监测人员</DialogTitle>
            <DialogDescription>填写新监测人员的基本信息</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="name">姓名</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入姓名"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="age">年龄</Label>
              <Input
                id="age"
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                placeholder="请输入年龄"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">性别</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => setFormData({ ...formData, gender: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择性别" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">男</SelectItem>
                  <SelectItem value="female">女</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="phone">联系电话</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="请输入联系电话"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="emergency_contact">紧急联系人</Label>
              <Input
                id="emergency_contact"
                value={formData.emergency_contact}
                onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                placeholder="请输入紧急联系人姓名"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="emergency_phone">紧急联系电话</Label>
              <Input
                id="emergency_phone"
                value={formData.emergency_phone}
                onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                placeholder="请输入紧急联系电话"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">状态</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">活跃</SelectItem>
                  <SelectItem value="inactive">非活跃</SelectItem>
                  <SelectItem value="critical">高危</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="account_username">账号</Label>
              <Input
                id="account_username"
                value={formData.account_username}
                onChange={(e) => setFormData({ ...formData, account_username: e.target.value })}
                placeholder="请输入登录账号"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="account_password">密码</Label>
              <Input
                id="account_password"
                value={formData.account_password}
                onChange={(e) => setFormData({ ...formData, account_password: e.target.value })}
                placeholder="请输入登录密码"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              onClick={() => handleSavePerson(false)}
              disabled={submitting || !formData.name || !formData.account_username || !formData.account_password}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? '保存中...' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑人员信息</DialogTitle>
            <DialogDescription>修改监测人员的基本信息</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-name">姓名</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入姓名"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-age">年龄</Label>
              <Input
                id="edit-age"
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                placeholder="请输入年龄"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-gender">性别</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => setFormData({ ...formData, gender: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择性别" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">男</SelectItem>
                  <SelectItem value="female">女</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-phone">联系电话</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="请输入联系电话"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-emergency_contact">紧急联系人</Label>
              <Input
                id="edit-emergency_contact"
                value={formData.emergency_contact}
                onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                placeholder="请输入紧急联系人姓名"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-emergency_phone">紧急联系电话</Label>
              <Input
                id="edit-emergency_phone"
                value={formData.emergency_phone}
                onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                placeholder="请输入紧急联系电话"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">状态</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">活跃</SelectItem>
                  <SelectItem value="inactive">非活跃</SelectItem>
                  <SelectItem value="critical">高危</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-account_username">账号</Label>
              <Input
                id="edit-account_username"
                value={formData.account_username}
                onChange={(e) => setFormData({ ...formData, account_username: e.target.value })}
                placeholder="请输入登录账号"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-account_password">密码</Label>
              <Input
                id="edit-account_password"
                value={formData.account_password}
                onChange={(e) => setFormData({ ...formData, account_password: e.target.value })}
                placeholder="请输入登录密码"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              onClick={() => handleSavePerson(true)}
              disabled={submitting || !formData.name || !formData.account_username || !formData.account_password}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              确认删除
            </AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 <strong>{currentPerson?.name}</strong> 吗？此操作无法撤销，
              该人员的所有监测数据也将被删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {submitting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
