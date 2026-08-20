const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetListener = `  // Real-time listener for session token, role changes, and Heartbeat
  useEffect(() => {
    if (!currentUser) return;

    // --- HEARTBEAT ---
    const updateActivity = async () => {
      try {
        await updateDoc(doc(db, 'users', currentUser.id), { 
          lastActiveAt: Date.now() 
        });
      } catch (err) {}
    };

    // Initial ping and interval
    updateActivity();
    const pingInterval = setInterval(updateActivity, 15000);

    const userRef = doc(db, 'users', currentUser.id);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data() as User;
        
        // 1. Check Concurrent Login
        if (userData.sessionToken && currentUser.sessionToken && userData.sessionToken !== currentUser.sessionToken) {
          alert('เซสชั่นหมดอายุ เนื่องจากมีการเข้าสู่ระบบจากเครื่องอื่น หรือคุณออกจากระบบจากเครื่องอื่น');
          localStorage.removeItem('warehouse_user');
          setCurrentUser(null);
          return;
        }

        // 2. Check Role changes
        if (userData.role !== currentUser.role) {
          const updatedUser = { ...currentUser, role: userData.role };
          setCurrentUser(updatedUser);
          localStorage.setItem('warehouse_user', JSON.stringify(updatedUser));
        }
      } else {
        // User deleted
        alert('ผู้ใช้งานนี้ถูกลบออกจากระบบ');
        localStorage.removeItem('warehouse_user');
        setCurrentUser(null);
      }
    });

    return () => {
      clearInterval(pingInterval);
      unsubscribe();
    };
  }, [currentUser?.id, currentUser?.sessionToken, currentUser?.role]);`;

const replacementListener = `  // Real-time listener for device lock and role changes
  useEffect(() => {
    if (!currentUser) return;

    const deviceId = localStorage.getItem('device_id');
    const userRef = doc(db, 'users', currentUser.id);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data() as User;
        
        // 1. Check if device lock changed to another device
        if (userData.activeDeviceId && deviceId && userData.activeDeviceId !== deviceId) {
          alert('บัญชีนี้ถูกเข้าสู่ระบบจากเครื่องอื่น หรือผู้ดูแลระบบได้ปลดล็อกบัญชีของคุณ');
          localStorage.removeItem('warehouse_user');
          setCurrentUser(null);
          return;
        }

        // 2. Check Role changes
        if (userData.role !== currentUser.role) {
          const updatedUser = { ...currentUser, role: userData.role };
          setCurrentUser(updatedUser);
          localStorage.setItem('warehouse_user', JSON.stringify(updatedUser));
        }
      } else {
        // User deleted
        alert('ผู้ใช้งานนี้ถูกลบออกจากระบบ');
        localStorage.removeItem('warehouse_user');
        setCurrentUser(null);
      }
    });

    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.sessionToken, currentUser?.role]);`;

const targetLogout = `                  <button
                    onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'users', currentUser.id), {
                          sessionToken: '',
                          lastActiveAt: 0
                        });
                      } catch (err) {}
                      localStorage.removeItem('warehouse_user');
                      setCurrentUser(null);
                    }}
                    className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all flex items-center border border-slate-200/80"
                    title="ออกจากระบบ"
                  >`;

const replacementLogout = `                  <button
                    onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'users', currentUser.id), {
                          sessionToken: '',
                          activeDeviceId: ''
                        });
                      } catch (err) {}
                      localStorage.removeItem('warehouse_user');
                      setCurrentUser(null);
                    }}
                    className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all flex items-center border border-slate-200/80"
                    title="ออกจากระบบ"
                  >`;

if (code.includes(targetListener)) {
  code = code.replace(targetListener, replacementListener);
} else {
  console.log('App device listener target not found.');
}
if (code.includes(targetLogout)) {
  code = code.replace(targetLogout, replacementLogout);
} else {
  console.log('App logout target not found.');
}
fs.writeFileSync('src/App.tsx', code);
console.log('App device lock patched.');
