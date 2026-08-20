const fs = require('fs');

const code = `
import React, { useState, useEffect } from 'react';
import { User, Shield, ShieldAlert, Trash2, Plus, AlertCircle, Loader2, AlertTriangle, Key } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, doc, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { User as UserType } from '../types';

interface UserManagementViewProps {
  currentUser: UserType;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const usersData: UserType[] = [];
      snapshot.forEach(doc => {
        usersData.push(doc.data() as UserType);
      });
      // Sort: admins first, then by id
      usersData.sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return a.id.localeCompare(b.id);
      });
      setUsers(usersData);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ใช้งาน');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId || !newName) {
      setError('กรุณากรอกรหัสพนักงานและชื่อ-นามสกุล');
      return;
    }

    setAdding(true);
    setError('');

    try {
      const newUser: UserType = {
        id: newId,
        username: newId,
        name: newName,
        nickname: newNickname,
        role: newRole,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', newId), newUser);
      
      setUsers(prev => [newUser, ...prev].sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return a.id.localeCompare(b.id);
      }));
      
      setNewId('');
      setNewName('');
      setNewNickname('');
      setNewRole('user');
      setShowAddForm(false);
    } catch (err) {
      console.error("Error adding user:", err);
      setError('เกิดข้อผิดพลาดในการเพิ่มผู้ใช้งาน');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('คุณแน่ใจหรือไม่ที่จะลบผู้ใช้นี้?')) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        setUsers(users.filter(u => u.id !== userId));
      } catch (err) {
        console.error("Error deleting user:", err);
        alert('เกิดข้อผิดพลาดในการลบผู้ใช้');
      }
    }
  };

  const handleToggleRole = async (user: UserType) => {
    if (user.id === currentUser.id) {
      alert('ไม่สามารถเปลี่ยนสิทธิ์ของตนเองได้');
      return;
    }

    const newRole = user.role === 'admin' ? 'user' : 'admin';
    const confirmMessage = newRole === 'admin' 
      ? \`ต้องการเลื่อนขั้น \${user.name} เป็น "ผู้ดูแลระบบ" ใช่หรือไม่?\`
      : \`ต้องการลดขั้น \${user.name} เป็น "ผู้ใช้ทั่วไป" ใช่หรือไม่?\`;

    if (window.confirm(confirmMessage)) {
      setUpdating(user.id);
      try {
        await updateDoc(doc(db, 'users', user.id), { role: newRole });
        setUsers(users.map(u => u.id === user.id ? { ...u, role: newRole } : u));
      } catch (err) {
        console.error("Error updating role:", err);
        alert('เกิดข้อผิดพลาดในการเปลี่ยนสิทธิ์');
      } finally {
        setUpdating(null);
      }
    }
  };

  if (currentUser.role !== 'admin') {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6 flex flex-col items-center justify-center text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
        <p className="text-slate-500">เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถจัดการผู้ใช้งานได้</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            จัดการสิทธิ์ผู้ใช้งาน
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">กำหนดสิทธิ์ Admin / User</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-colors"
        >
          {showAddForm ? <User className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddForm ? 'ปิดฟอร์ม' : 'เพิ่มผู้ใช้'}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm flex items-start gap-2 border border-red-100">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {showAddForm && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 mb-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" /> เพิ่มผู้ใช้งานใหม่
            </h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 ml-1">รหัสพนักงาน (ID)</label>
                  <input
                    type="text"
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="เช่น 1912"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 ml-1">ชื่อ-นามสกุล</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="เช่น สมชาย ใจดี"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 ml-1">ชื่อเล่น (ไม่บังคับ)</label>
                  <input
                    type="text"
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="เช่น ชาย"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 ml-1">สิทธิ์การใช้งาน</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none font-medium"
                  >
                    <option value="user">User (ผู้ใช้ทั่วไป)</option>
                    <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                  </select>
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={adding}
                  className="w-full bg-blue-600 text-white font-bold rounded-xl py-3 text-sm hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-70 flex justify-center items-center gap-2"
                >
                  {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : 'บันทึกผู้ใช้ใหม่'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/60 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={\`w-10 h-10 rounded-full flex items-center justify-center shrink-0 \${user.role === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-50 text-blue-600'}\`}>
                    {user.role === 'admin' ? <ShieldAlert className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">
                      {user.name} {user.nickname ? \`(\${user.nickname})\` : ''} 
                      {user.id === currentUser.id && <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded ml-1 font-medium">ฉัน</span>}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">ID: {user.id}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                      <span className={\`text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider \${user.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}\`}>
                        {user.role}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  {user.id !== currentUser.id && (
                    <button
                      onClick={() => handleToggleRole(user)}
                      disabled={updating === user.id}
                      className={\`px-2 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 \${
                        user.role === 'admin' 
                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                          : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                      }\`}
                    >
                      {updating === user.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Key className="w-3.5 h-3.5" />
                      )}
                      {user.role === 'admin' ? 'ลดเป็น User' : 'ตั้งเป็น Admin'}
                    </button>
                  )}
                  {user.id !== currentUser.id && user.id !== 'admin' && (
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
`
fs.writeFileSync('src/components/UserManagementView.tsx', code);
