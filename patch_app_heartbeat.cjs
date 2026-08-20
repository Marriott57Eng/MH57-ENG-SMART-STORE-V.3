const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  // Real-time listener for session token and role changes
  useEffect(() => {
    if (!currentUser) return;

    const userRef = doc(db, 'users', currentUser.id);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data() as User;
        
        // 1. Check Concurrent Login
        if (userData.sessionToken && currentUser.sessionToken && userData.sessionToken !== currentUser.sessionToken) {
          alert('เซสชั่นหมดอายุ เนื่องจากมีการเข้าสู่ระบบจากเครื่องอื่น');
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

const replacement = `  // Real-time listener for session token, role changes, and Heartbeat
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

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log('App heartbeat patched.');
} else {
  console.log('App heartbeat target not found.');
}
