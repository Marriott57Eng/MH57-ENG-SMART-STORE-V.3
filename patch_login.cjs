const fs = require('fs');

const loginCode = `
import React, { useState, useEffect } from 'react';
import { Package, User as UserIcon, AlertCircle, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, getDocs, setDoc, doc, updateDoc } from 'firebase/firestore';
import { User } from '../types';
import { initialUsers } from '../data/users';

interface LoginViewProps {
  onLogin: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [loginInput, setLoginInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [initializing, setInitializing] = useState(true);
  const [dbUsers, setDbUsers] = useState<User[]>([]);

  useEffect(() => {
    const initUsers = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        let loadedUsers: User[] = [];
        
        const existingIds = new Set<string>();
        usersSnapshot.forEach(doc => {
          existingIds.add(doc.id);
          loadedUsers.push(doc.data() as User);
        });
        
        const batch = [];
        let needsUpdate = false;
        
        // Seed any missing initial users
        for (const u of initialUsers) {
          if (!existingIds.has(u.id)) {
            const newUser: User = {
              id: u.id,
              username: u.id,
              name: u.name,
              nickname: u.nickname,
              role: 'user',
              createdAt: new Date().toISOString()
            };
            batch.push(setDoc(doc(db, 'users', u.id), newUser));
            loadedUsers.push(newUser);
            needsUpdate = true;
          }
        }
        
        // Ensure admin exists
        if (!existingIds.has('admin')) {
           const defaultAdmin: User = {
            id: 'admin',
            username: 'admin',
            name: 'Administrator',
            role: 'admin',
            createdAt: new Date().toISOString()
          };
          batch.push(setDoc(doc(db, 'users', 'admin'), defaultAdmin));
          loadedUsers.push(defaultAdmin);
          needsUpdate = true;
        }
        
        if (needsUpdate && batch.length > 0) {
          await Promise.all(batch);
          console.log('Missing initial users seeded');
        }
        
        setDbUsers(loadedUsers);
      } catch (err) {
        console.error("Error checking users:", err);
      } finally {
        setInitializing(false);
      }
    };
    initUsers();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = loginInput.trim().toLowerCase();
    
    if (!cleanInput) {
      setError('กรุณากรอกรหัสพนักงาน หรือชื่อจริง');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Find user locally from loaded DB users
      // ALLOW ONLY ID or NAME (no nickname, no generic username)
      let foundUser = dbUsers.find(u => 
        u.id.toLowerCase() === cleanInput || 
        u.name.toLowerCase().includes(cleanInput)
      );

      if (foundUser) {
        // Generate a new session token to prevent concurrent logins on different browsers
        const newToken = crypto.randomUUID();
        const userRef = doc(db, 'users', foundUser.id);
        await updateDoc(userRef, { sessionToken: newToken });
        
        const updatedUser = { ...foundUser, sessionToken: newToken };
        localStorage.setItem('warehouse_user', JSON.stringify(updatedUser));
        onLogin(updatedUser);
      } else {
        setError('ไม่พบข้อมูลผู้ใช้ในระบบ');
      }
    } catch (err) {
      console.error("Login error:", err);
      setError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex justify-center selection:bg-blue-500 selection:text-white">
      <div className="w-full max-w-md bg-white min-h-screen sm:min-h-[auto] sm:rounded-3xl sm:my-10 sm:h-fit shadow-2xl flex flex-col p-8 justify-center relative overflow-hidden">
        
        {/* Decorative background */}
        <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-b-[40px] opacity-10 blur-xl"></div>
        
        <div className="relative z-10 flex flex-col items-center mb-8">
          <div className="w-40 h-40 flex items-center justify-center mb-6">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-full h-full object-contain drop-shadow-md"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/400x400/2563eb/ffffff.png?text=Store+Logo';
              }}
            />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">ENG Smart Store App</h1>
          <p className="text-slate-500 text-sm">เข้าสู่ระบบเพื่อจัดการคลังสินค้า</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700 relative z-10">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="relative z-10 flex flex-col gap-5">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 ml-1">รหัสพนักงาน หรือ ชื่อจริง</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all text-slate-900 outline-none"
                placeholder="กรอกรหัสพนักงาน หรือ ชื่อจริง"
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-70 text-white font-bold py-4 px-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'เข้าสู่ระบบ'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
`
fs.writeFileSync('src/components/LoginView.tsx', loginCode);
