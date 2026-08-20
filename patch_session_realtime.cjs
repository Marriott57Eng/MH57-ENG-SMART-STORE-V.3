const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldSessionTarget = `  // Check session token to prevent concurrent logins
  useEffect(() => {
    if (!currentUser) return;

    const checkSession = async () => {
      try {
        const userRef = doc(db, 'users', currentUser.id);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data() as User;
          if (userData.sessionToken && currentUser.sessionToken && userData.sessionToken !== currentUser.sessionToken) {
            alert('เซสชั่นหมดอายุ เนื่องจากมีการเข้าสู่ระบบจากเครื่องอื่น');
            localStorage.removeItem('warehouse_user');
            setCurrentUser(null);
          }
        }
      } catch (err) {
        console.error("Error checking session:", err);
      }
    };
    
    // Check initially and then every 30 seconds
    checkSession();
    const interval = setInterval(checkSession, 30000);
    return () => clearInterval(interval);
  }, [currentUser?.id, currentUser?.sessionToken]);`;

const newSessionTarget = `  // Real-time listener for session token and role changes
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

if (code.includes(oldSessionTarget)) {
  code = code.replace(oldSessionTarget, newSessionTarget);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Realtime session patch applied.');
} else {
  console.log('Session target not found.');
}
