
import React, { useState, useEffect } from 'react';
import { User as UserIcon, AlertCircle, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, setDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { User } from '../types';
import { initialUsers } from '../data/users';
import { EngLogo } from './EngLogo';

interface LoginViewProps {
  onLogin: (user: User) => void;
}

// Build instant offline/initial users list
const getInitialDbUsers = (): User[] => {
  try {
    const cached = localStorage.getItem('warehouse_cached_users');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (_) {}

  const defaultList: User[] = initialUsers.map((u) => ({
    id: u.id,
    username: u.id,
    name: u.name,
    nickname: u.nickname,
    role: 'user',
    createdAt: '2026-08-01T00:00:00.000Z',
  }));

  defaultList.push({
    id: 'Admininmad',
    username: 'Admininmad',
    name: 'Administrator',
    role: 'admin',
    createdAt: '2026-08-01T00:00:00.000Z',
  });

  return defaultList;
};

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [loginInput, setLoginInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dbUsers, setDbUsers] = useState<User[]>(getInitialDbUsers);

  // Background silent sync: fetch fresh users and seed if necessary without blocking the UI
  useEffect(() => {
    let isMounted = true;
    const syncUsersSilently = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        let loadedUsers: User[] = [];
        const existingIds = new Set<string>();

        usersSnapshot.forEach((docSnap) => {
          existingIds.add(docSnap.id);
          loadedUsers.push(docSnap.data() as User);
        });

        const batch = [];
        let needsUpdate = false;

        // Seed missing initial users if Firestore collection is fresh
        for (const u of initialUsers) {
          if (!existingIds.has(u.id)) {
            const newUser: User = {
              id: u.id,
              username: u.id,
              name: u.name,
              nickname: u.nickname,
              role: 'user',
              createdAt: new Date().toISOString(),
            };
            batch.push(setDoc(doc(db, 'users', u.id), newUser));
            loadedUsers.push(newUser);
            needsUpdate = true;
          }
        }

        // Ensure admin exists
        if (!existingIds.has('Admininmad')) {
          const defaultAdmin: User = {
            id: 'Admininmad',
            username: 'Admininmad',
            name: 'Administrator',
            role: 'admin',
            createdAt: new Date().toISOString(),
          };
          batch.push(setDoc(doc(db, 'users', 'Admininmad'), defaultAdmin));
          loadedUsers.push(defaultAdmin);
          needsUpdate = true;
        }

        if (needsUpdate && batch.length > 0) {
          await Promise.all(batch);
        }

        if (isMounted && loadedUsers.length > 0) {
          setDbUsers(loadedUsers);
          try {
            localStorage.setItem('warehouse_cached_users', JSON.stringify(loadedUsers));
          } catch (_) {}
        }
      } catch (err) {
        console.warn('Silent users sync (offline fallback active):', err);
      }
    };

    syncUsersSilently();
    return () => {
      isMounted = false;
    };
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
      // 1. Find user locally from instant loaded list
      let foundUser = dbUsers.find(
        (u) =>
          u.id.toLowerCase() === cleanInput ||
          (u.username && u.username.toLowerCase() === cleanInput) ||
          u.name.toLowerCase().includes(cleanInput)
      );

      // 2. If not found in local memory, search live in Firestore doc directly
      if (!foundUser) {
        try {
          const directDoc = await getDoc(doc(db, 'users', loginInput.trim()));
          if (directDoc.exists()) {
            foundUser = directDoc.data() as User;
          } else {
            // Check by ID, username or name in collection
            const snap = await getDocs(collection(db, 'users'));
            snap.forEach((d) => {
              const u = d.data() as User;
              if (
                u.id.toLowerCase() === cleanInput ||
                (u.username && u.username.toLowerCase() === cleanInput) ||
                u.name.toLowerCase().includes(cleanInput)
              ) {
                foundUser = u;
              }
            });
          }
        } catch (_) {}
      }

const generateSafeUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (_) {}
  }
  return 'id-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
};

      if (foundUser) {
        // Handle persistent device lock
        let deviceId: string | null = null;
        try {
          deviceId = localStorage.getItem('device_id');
        } catch (_) {}

        if (!deviceId) {
          deviceId = generateSafeUUID();
          try {
            localStorage.setItem('device_id', deviceId);
          } catch (_) {}
        }

        // Fetch fresh user data to check if already active on another device
        const userRef = doc(db, 'users', foundUser.id);
        try {
          const userSnap = await getDoc(userRef);
          if (userSnap.exists() && foundUser.id !== 'Admininmad') {
            const freshData = userSnap.data() as User;
            if (freshData.activeDeviceId && freshData.activeDeviceId !== deviceId) {
              setError('ไม่สามารถเข้าสู่ระบบได้ เนื่องจากมีการเข้าสู่ระบบอยู่แล้ว กรุณาเข้าสู่ระบบด้วย User ของตนเอง');
              setLoading(false);
              return;
            }
          }
        } catch (_) {}

        const newToken = generateSafeUUID();
        const updateData: any = { sessionToken: newToken };
        if (foundUser.id !== 'Admininmad') {
          updateData.activeDeviceId = deviceId;
        } else {
          updateData.activeDeviceId = ''; // Never lock Admininmad
        }

        // Update active device token
        updateDoc(userRef, updateData).catch((err) => {
          console.warn('Failed to update session token in Firestore:', err);
        });

        const updatedUser = {
          ...foundUser,
          sessionToken: newToken,
          activeDeviceId: foundUser.id !== 'Admininmad' ? deviceId : '',
        };
        localStorage.setItem('warehouse_user', JSON.stringify(updatedUser));
        onLogin(updatedUser);
      } else {
        setError('ไม่พบข้อมูลผู้ใช้ในระบบ กรุณาตรวจสอบรหัสพนักงานหรือชื่อจริง');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-900 dark:bg-slate-950 flex items-center justify-center p-3.5 sm:p-6 pl-safe pr-safe selection:bg-blue-500 selection:text-white transition-colors overflow-y-auto relative">
      {/* iOS 27 Ambient Light Orbs for Liquid Glass Refraction */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-2/3 right-1/4 w-72 h-72 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md my-auto liquid-glass rounded-[32px] sm:rounded-[38px] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] flex flex-col p-6 sm:p-9 pt-safe-content justify-center relative overflow-hidden border border-white/70 dark:border-white/12 transition-all">
        {/* Specular top rim shine */}
        <div className="absolute top-0 left-10 right-10 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/30 to-transparent pointer-events-none rounded-full" />
        
        {/* Ambient top liquid tint */}
        <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-blue-500/15 via-blue-500/5 to-transparent rounded-b-[40px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center mb-5 sm:mb-7">
          <div className="w-full max-w-[500px] h-20 sm:h-[130px] flex items-center justify-center mb-3 sm:mb-5 overflow-hidden rounded-2xl">
            <EngLogo
              alt="ENG Smart Store Logo"
              style={{ width: '500px', maxWidth: '100%', height: '100%', maxHeight: '130px' }}
              className="object-contain drop-shadow-md rounded-2xl"
            />
          </div>
          <h1
            style={{ fontSize: '21px', fontStyle: 'normal', fontFamily: "'Fredericka the Great', cursive", textDecorationLine: 'none', textAlign: 'center' }}
            className="font-bold text-slate-900 dark:text-white mb-1 tracking-tight drop-shadow-xs"
          >
            ENG Smart Store App
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium">เข้าสู่ระบบเพื่อจัดการคลังสินค้า</p>
        </div>

        {error && (
          <div className="mb-4 sm:mb-6 p-3.5 sm:p-4 bg-red-50/90 dark:bg-red-950/60 border border-red-200/80 dark:border-red-800/80 rounded-2xl flex items-start gap-3 text-red-700 dark:text-red-300 relative z-10 backdrop-blur-md shadow-xs">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
            <span className="text-sm font-medium leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="relative z-10 flex flex-col gap-4 sm:gap-5">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 ml-1">รหัสพนักงาน หรือ ชื่อจริง</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                className="block w-full pl-11 pr-4 py-3.5 bg-white/60 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-slate-900 dark:text-white outline-none placeholder:text-slate-400 backdrop-blur-md shadow-xs text-base"
                placeholder="กรอกรหัสพนักงาน หรือ ชื่อจริง"
                disabled={loading}
                autoFocus
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] disabled:opacity-70 text-white font-bold py-4 px-4 rounded-2xl shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer border border-blue-400/40 relative overflow-hidden"
          >
            {/* Liquid specular shine overlay */}
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin relative z-10" />
            ) : (
              <span className="relative z-10 text-base">เข้าสู่ระบบ</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

