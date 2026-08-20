import React, { useState, useEffect } from 'react';
import { 
  User, 
  Shield, 
  ShieldAlert, 
  Trash2, 
  Plus, 
  AlertCircle, 
  Loader2, 
  AlertTriangle, 
  Key, 
  Edit3, 
  X, 
  Check, 
  Search,
  CheckCircle2,
  Unlock
} from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, doc, deleteDoc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { User as UserType } from '../types';
import { initialUsers } from '../data/users';

interface UserManagementViewProps {
  currentUser: UserType;
  onUpdateCurrentUser?: (user: UserType) => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ 
  currentUser,
  onUpdateCurrentUser 
}) => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Add Form states
  const [newId, setNewId] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  // Edit Modal states
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [editId, setEditId] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editName, setEditName] = useState('');
  const [editNickname, setEditNickname] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      let usersData: UserType[] = [];
      const existingIds = new Set<string>();
      
      snapshot.forEach(docSnap => {
        existingIds.add(docSnap.id);
        const data = docSnap.data() as UserType;
        // ensure id and username exist
        usersData.push({
          ...data,
          id: data.id || docSnap.id,
          username: data.username || data.id || docSnap.id,
        });
      });

      // Quick seed check
      let needsUpdate = false;
      const batch = [];
      for (const u of initialUsers) {
        if (!existingIds.has(u.id)) {
          const newUser: UserType = {
            id: u.id,
            username: u.id,
            name: u.name,
            nickname: u.nickname,
            role: 'user',
            createdAt: new Date().toISOString()
          };
          batch.push(setDoc(doc(db, 'users', u.id), newUser));
          usersData.push(newUser);
          needsUpdate = true;
        }
      }

      // Ensure Admininmad exists
      if (!existingIds.has('Admininmad')) {
        const defaultAdmin: UserType = {
          id: 'Admininmad',
          username: 'Admininmad',
          name: 'Administrator',
          role: 'admin',
          createdAt: new Date().toISOString(),
        };
        batch.push(setDoc(doc(db, 'users', 'Admininmad'), defaultAdmin));
        usersData.push(defaultAdmin);
        needsUpdate = true;
      }

      if (needsUpdate && batch.length > 0) {
        await Promise.all(batch);
      }

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
    const cleanId = newId.trim();
    const cleanName = newName.trim();
    const cleanUsername = newUsername.trim() || cleanId;
    const cleanNickname = newNickname.trim();

    if (!cleanId || !cleanName) {
      setError('กรุณากรอกรหัสพนักงานและชื่อ-นามสกุล');
      return;
    }

    setAdding(true);
    setError('');
    setSuccessMsg('');

    try {
      // Check if ID already exists
      const existingDoc = await getDoc(doc(db, 'users', cleanId));
      if (existingDoc.exists()) {
        setError(`รหัสพนักงาน (ID) "${cleanId}" มีในระบบแล้ว กรุณาใช้รหัสอื่น`);
        setAdding(false);
        return;
      }

      const newUser: UserType = {
        id: cleanId,
        username: cleanUsername,
        name: cleanName,
        nickname: cleanNickname,
        role: newRole,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', cleanId), newUser);
      
      setUsers(prev => [newUser, ...prev].sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return a.id.localeCompare(b.id);
      }));
      
      setNewId('');
      setNewUsername('');
      setNewName('');
      setNewNickname('');
      setNewRole('user');
      setShowAddForm(false);
      setSuccessMsg(`เพิ่มผู้ใช้ "${cleanName}" เรียบร้อยแล้ว`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error("Error adding user:", err);
      setError('เกิดข้อผิดพลาดในการเพิ่มผู้ใช้งาน');
    } finally {
      setAdding(false);
    }
  };

  const openEditModal = (user: UserType) => {
    setEditingUser(user);
    setEditId(user.id);
    setEditUsername(user.username || user.id);
    setEditName(user.name);
    setEditNickname(user.nickname || '');
    setEditRole(user.role);
    setEditError('');
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditError('');
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const trimmedId = editId.trim();
    const trimmedUsername = editUsername.trim();
    const trimmedName = editName.trim();
    const trimmedNickname = editNickname.trim();

    if (!trimmedId) {
      setEditError('กรุณากรอกรหัสพนักงาน (ID)');
      return;
    }
    if (!trimmedUsername) {
      setEditError('กรุณากรอกชื่อผู้ใช้งาน (Username)');
      return;
    }
    if (!trimmedName) {
      setEditError('กรุณากรอกชื่อ-นามสกุล (ชื่อจริง)');
      return;
    }

    setSavingEdit(true);
    setEditError('');

    try {
      const oldId = editingUser.id;
      const isIdChanged = trimmedId !== oldId;

      // Check if new ID collides with another existing user
      if (isIdChanged) {
        const idCheckSnap = await getDoc(doc(db, 'users', trimmedId));
        if (idCheckSnap.exists()) {
          setEditError(`รหัส ID "${trimmedId}" มีผู้ใช้งานอื่นใช้อยู่แล้ว กรุณาระบุรหัสอื่น`);
          setSavingEdit(false);
          return;
        }
      }

      const updatedUser: UserType = {
        ...editingUser,
        id: trimmedId,
        username: trimmedUsername,
        name: trimmedName,
        nickname: trimmedNickname,
        role: editRole,
      };

      if (isIdChanged) {
        // 1. Create document with new ID
        await setDoc(doc(db, 'users', trimmedId), updatedUser);
        
        // 2. If editing self, update current session before deleting old doc
        if (oldId === currentUser.id) {
          onUpdateCurrentUser?.(updatedUser);
          try {
            localStorage.setItem('warehouse_user', JSON.stringify(updatedUser));
          } catch (_) {}
        }

        // 3. Delete old document
        await deleteDoc(doc(db, 'users', oldId));
      } else {
        // ID is unchanged: simple update
        await setDoc(doc(db, 'users', oldId), updatedUser, { merge: true });

        if (oldId === currentUser.id) {
          onUpdateCurrentUser?.(updatedUser);
          try {
            localStorage.setItem('warehouse_user', JSON.stringify(updatedUser));
          } catch (_) {}
        }
      }

      // Update local list
      setUsers(prev => {
        const next = prev.map(u => (u.id === oldId ? updatedUser : u));
        return next.sort((a, b) => {
          if (a.role === 'admin' && b.role !== 'admin') return -1;
          if (a.role !== 'admin' && b.role === 'admin') return 1;
          return a.id.localeCompare(b.id);
        });
      });

      // Update cached users in localStorage
      try {
        const cached = localStorage.getItem('warehouse_cached_users');
        if (cached) {
          const list = JSON.parse(cached) as UserType[];
          const nextList = list.map(u => (u.id === oldId ? updatedUser : u));
          localStorage.setItem('warehouse_cached_users', JSON.stringify(nextList));
        }
      } catch (_) {}

      setSuccessMsg(`บันทึกข้อมูลของ "${trimmedName}" เรียบร้อยแล้ว`);
      setTimeout(() => setSuccessMsg(''), 4000);
      closeEditModal();
    } catch (err: any) {
      console.error("Error updating user:", err);
      setEditError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (userId === currentUser.id) {
      alert('ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่ได้');
      return;
    }
    if (window.confirm(`คุณแน่ใจหรือไม่ที่จะลบผู้ใช้ "${userName}" (ID: ${userId}) ออกจากระบบ?`)) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        setUsers(users.filter(u => u.id !== userId));
        setSuccessMsg(`ลบผู้ใช้ "${userName}" เรียบร้อยแล้ว`);
        setTimeout(() => setSuccessMsg(''), 4000);
      } catch (err) {
        console.error("Error deleting user:", err);
        alert('เกิดข้อผิดพลาดในการลบผู้ใช้');
      }
    }
  };

  const handleRoleChange = async (user: UserType, newRole: 'admin' | 'user') => {
    if (user.id === currentUser.id) {
      alert('ไม่สามารถเปลี่ยนสิทธิ์ของตนเองผ่านปุ่มลัดได้ (กรุณาใช้เมนูแก้ไขข้อมูล)');
      return;
    }
    
    if (user.role === newRole) return;

    const confirmMessage = newRole === 'admin' 
      ? `ต้องการตั้งค่า ${user.name} เป็น "ผู้ดูแลระบบ (Admin)" ใช่หรือไม่?`
      : `ต้องการเปลี่ยน ${user.name} เป็น "ผู้ใช้ทั่วไป (User)" ใช่หรือไม่?`;

    if (window.confirm(confirmMessage)) {
      setUpdating(user.id);
      try {
        await updateDoc(doc(db, 'users', user.id), { role: newRole });
        setUsers(users.map(u => u.id === user.id ? { ...u, role: newRole } : u));
        setSuccessMsg(`เปลี่ยนสิทธิ์ของ ${user.name} เป็น ${newRole.toUpperCase()} เรียบร้อยแล้ว`);
        setTimeout(() => setSuccessMsg(''), 4000);
      } catch (err) {
        console.error("Error updating role:", err);
        alert('เกิดข้อผิดพลาดในการเปลี่ยนสิทธิ์');
      } finally {
        setUpdating(null);
      }
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      u.name.toLowerCase().includes(term) ||
      u.id.toLowerCase().includes(term) ||
      (u.username && u.username.toLowerCase().includes(term)) ||
      (u.nickname && u.nickname.toLowerCase().includes(term))
    );
  });

  if (currentUser.role !== 'admin') {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 flex flex-col items-center justify-center text-center transition-colors">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
        <p className="text-slate-500 dark:text-slate-400">เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถจัดการผู้ใช้งานได้</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 pb-28 sm:pb-24 transition-colors">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 px-4 pt-safe-header pb-3.5 flex items-center justify-between shadow-xs transition-colors">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            จัดการรายชื่อ & สิทธิ์ผู้ใช้งาน
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            แก้ไข ID, Username, ชื่อจริง, ชื่อเล่น และสิทธิ์ของทุกคน
          </p>
        </div>
        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setError('');
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddForm ? 'ปิดฟอร์ม' : 'เพิ่มผู้ใช้'}
        </button>
      </div>

      <div className="p-4 max-w-5xl mx-auto space-y-4">
        {/* Success / Error Alerts */}
        {successMsg && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 p-3.5 rounded-xl text-sm flex items-center gap-2.5 border border-emerald-200 dark:border-emerald-800/60 animate-in fade-in duration-200">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 p-3.5 rounded-xl text-sm flex items-start gap-2.5 border border-red-200 dark:border-red-800/60 animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Add User Form */}
        {showAddForm && (
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 mb-4 animate-in slide-in-from-top-3 duration-200 transition-colors">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-base">
                <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" /> เพิ่มผู้ใช้งานใหม่
              </h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    รหัสพนักงาน (ID) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newId}
                    onChange={(e) => {
                      setNewId(e.target.value);
                      if (!newUsername) setNewUsername(e.target.value);
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors"
                    placeholder="เช่น 1912 หรือ 9999"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    ชื่อผู้ใช้งาน (Username)
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors"
                    placeholder="ค่าเริ่มต้นใช้เดียวกับ ID"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    ชื่อ-นามสกุล (ชื่อจริง) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors"
                    placeholder="เช่น สมชาย ใจดี"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    ชื่อเล่น (Nickname)
                  </label>
                  <input
                    type="text"
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors"
                    placeholder="เช่น ชาย"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    สิทธิ์การใช้งาน (Role)
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium cursor-pointer transition-colors"
                  >
                    <option value="user">User (ผู้ใช้ทั่วไป)</option>
                    <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-5 py-2.5 text-sm transition-all disabled:opacity-70 flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  บันทึกผู้ใช้ใหม่
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search & Stats Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อ, Username, ID..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 self-end sm:self-auto">
            <span>ทั้งหมด {users.length} คน</span>
            <span>•</span>
            <span className="text-indigo-600 dark:text-indigo-400">
              Admin {users.filter(u => u.role === 'admin').length} คน
            </span>
            <span>•</span>
            <span>
              User {users.filter(u => u.role !== 'admin').length} คน
            </span>
          </div>
        </div>

        {/* User Cards List */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-sm text-slate-500 dark:text-slate-400">กำลังโหลดรายชื่อผู้ใช้...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <User className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-slate-600 dark:text-slate-400 font-medium">ไม่พบผู้ใช้งานที่ตรงกับคำค้นหา</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredUsers.map((user) => {
              const isSelf = user.id === currentUser.id;
              const isAdmin = user.role === 'admin';

              return (
                <div 
                  key={user.id} 
                  className={`bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-xs border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 ${
                    isSelf 
                      ? 'border-blue-300 dark:border-blue-800/80 bg-blue-50/20 dark:bg-blue-950/20' 
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* User Details */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-bold text-sm shadow-xs ${
                      isAdmin 
                        ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60' 
                        : 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60'
                    }`}>
                      {isAdmin ? <ShieldAlert className="w-5 h-5" /> : <User className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base truncate">
                          {user.name}
                        </h4>
                        {user.nickname && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {user.nickname}
                          </span>
                        )}
                        {isSelf && (
                          <span className="text-[11px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                            บัญชีของคุณ
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 mt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap font-mono">
                        <span>ID: <strong className="text-slate-700 dark:text-slate-300">{user.id}</strong></span>
                        <span>•</span>
                        <span>User: <strong className="text-slate-700 dark:text-slate-300">{user.username || user.id}</strong></span>
                        <span>•</span>
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded uppercase tracking-wider ${
                          isAdmin 
                            ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          {user.role}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
                    {/* EDIT BUTTON (Admin can edit ANY user, including himself!) */}
                    <button
                      onClick={() => openEditModal(user)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-300 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-blue-200 dark:border-blue-800/60 transition-all active:scale-95 cursor-pointer"
                      title="แก้ไข ชื่อจริง, Username, ID, Role"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      แก้ไขข้อมูล
                    </button>

                    {/* Fast Role Selector for other users */}
                    {!isSelf && (
                      <div className="relative">
                        {updating === user.id ? (
                          <div className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-1.5 h-8">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                          </div>
                        ) : (
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user, e.target.value as 'admin' | 'user')}
                            className={`appearance-none outline-none text-xs font-bold px-2.5 py-1.5 pr-7 rounded-xl border cursor-pointer transition-colors ${
                              isAdmin 
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' 
                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                        {updating !== user.id && (
                          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                            <Key className={`w-3 h-3 ${isAdmin ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400'}`} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Unlock / Force logout button */}
                    {!isSelf && user.activeDeviceId && (
                      <button
                        onClick={async () => {
                          if (window.confirm(`ปลดล็อกเซสชั่นของ ${user.name} หรือไม่? (ใช้กรณีที่ผู้ใช้ออกจากระบบจากเครื่องเดิมไม่ได้)`)) {
                            try {
                              await updateDoc(doc(db, 'users', user.id), { activeDeviceId: '', sessionToken: '' });
                              setSuccessMsg(`ปลดล็อกเซสชั่นของ ${user.name} เรียบร้อยแล้ว`);
                              setTimeout(() => setSuccessMsg(''), 4000);
                            } catch (err) {
                              console.error('Unlock error:', err);
                            }
                          }
                        }}
                        className="w-8 h-8 flex items-center justify-center text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-xl transition-colors border border-transparent hover:border-amber-200 dark:hover:border-amber-800 cursor-pointer"
                        title="ปลดล็อกเซสชั่น (Force Logout)"
                      >
                        <Unlock className="w-4 h-4" />
                      </button>
                    )}

                    {/* Delete button (except self) */}
                    {!isSelf && user.id !== 'Admininmad' && (
                      <button
                        onClick={() => handleDeleteUser(user.id, user.name)}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800 cursor-pointer"
                        title="ลบผู้ใช้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:rounded-3xl shadow-2xl overflow-hidden border-0 sm:border border-slate-200/80 dark:border-slate-800 animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200 transition-colors flex flex-col">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    แก้ไขข้อมูลผู้ใช้งาน
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    แก้ไข ID, Username, ชื่อจริง, ชื่อเล่น และสิทธิ์
                  </p>
                </div>
              </div>
              <button
                onClick={closeEditModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveEditUser} className="p-5 space-y-4 flex-1 overflow-y-auto">
              {editError && (
                <div className="bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-300 p-3 rounded-xl text-xs flex items-start gap-2 border border-red-200 dark:border-red-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* ID Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    รหัสพนักงาน (ID) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editId}
                    onChange={(e) => setEditId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors"
                    placeholder="เช่น 1912 หรือ Admininmad"
                    required
                  />
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    (ใช้เป็น Key หลักในการค้นหาและระบุตัวตน)
                  </p>
                </div>

                {/* Username Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    ชื่อผู้ใช้งาน (Username) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors"
                    placeholder="เช่น 1912 หรือ custom_user"
                    required
                  />
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    (ใช้สำหรับกรอกเข้าสู่ระบบ)
                  </p>
                </div>

                {/* Real Name Field */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    ชื่อ-นามสกุล (ชื่อจริง) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors"
                    placeholder="เช่น Chanayood Wongsunthon"
                    required
                  />
                </div>

                {/* Nickname Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    ชื่อเล่น (Nickname)
                  </label>
                  <input
                    type="text"
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors"
                    placeholder="เช่น Mild, ชาย, บู"
                  />
                </div>

                {/* Role Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    ระดับสิทธิ์ (Role)
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as 'admin' | 'user')}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer transition-colors"
                  >
                    <option value="user">User (ผู้ใช้ทั่วไป)</option>
                    <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                  </select>
                </div>
              </div>

              {editingUser.id === currentUser.id && (
                <div className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 p-3 rounded-xl text-xs border border-amber-200 dark:border-amber-800/60">
                  ⚠️ คุณกำลังแก้ไขบัญชีของตัวเอง หากเปลี่ยน ID ระบบจะอัปเดตเซสชั่นปัจจุบันให้โดยอัตโนมัติ
                </div>
              )}

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5 shrink-0 pb-[max(16px,calc(env(safe-area-inset-bottom,16px)+12px))]">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-5 py-2.5 text-sm transition-all disabled:opacity-70 flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
                >
                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
