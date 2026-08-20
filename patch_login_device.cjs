const fs = require('fs');
let code = fs.readFileSync('src/components/LoginView.tsx', 'utf8');

const target = `      let foundUser = dbUsers.find(u => 
        u.id.toLowerCase() === cleanInput || 
        u.name.toLowerCase().includes(cleanInput)
      );

      if (foundUser) {
        // Fetch fresh user data to check if already active
        const userRef = doc(db, 'users', foundUser.id);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const freshData = userSnap.data() as User;
          
          // Check if session token exists and was active in the last 45 seconds (15s heartbeat + 30s buffer)
          if (freshData.sessionToken && freshData.lastActiveAt) {
            const timeSinceLastActive = Date.now() - freshData.lastActiveAt;
            if (timeSinceLastActive < 45000) {
              setError('บัญชีนี้กำลังถูกใช้งานอยู่บนเครื่องอื่น');
              setLoading(false);
              return;
            }
          }
        }

        // Proceed with login (stealing session if it was considered dead)
        const newToken = crypto.randomUUID();
        await updateDoc(userRef, { sessionToken: newToken, lastActiveAt: Date.now() });
        
        const updatedUser = { ...foundUser, sessionToken: newToken, lastActiveAt: Date.now() };
        localStorage.setItem('warehouse_user', JSON.stringify(updatedUser));
        onLogin(updatedUser);
      } else {
        setError('ไม่พบข้อมูลผู้ใช้ในระบบ');
      }`;

const replacement = `      let foundUser = dbUsers.find(u => 
        u.id.toLowerCase() === cleanInput || 
        u.name.toLowerCase().includes(cleanInput)
      );

      if (foundUser) {
        // Handle persistent device lock
        let deviceId = localStorage.getItem('device_id');
        if (!deviceId) {
          deviceId = crypto.randomUUID();
          localStorage.setItem('device_id', deviceId);
        }

        // Fetch fresh user data to check if already active
        const userRef = doc(db, 'users', foundUser.id);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const freshData = userSnap.data() as User;
          
          if (freshData.activeDeviceId && freshData.activeDeviceId !== deviceId) {
            setError('บัญชีนี้เข้าสู่ระบบค้างไว้ที่เครื่องอื่น (ให้ Admin ปลดล็อก หรือกดยกเลิกที่เครื่องเดิม)');
            setLoading(false);
            return;
          }
        }

        const newToken = crypto.randomUUID();
        await updateDoc(userRef, { sessionToken: newToken, activeDeviceId: deviceId });
        
        const updatedUser = { ...foundUser, sessionToken: newToken, activeDeviceId: deviceId };
        localStorage.setItem('warehouse_user', JSON.stringify(updatedUser));
        onLogin(updatedUser);
      } else {
        setError('ไม่พบข้อมูลผู้ใช้ในระบบ');
      }`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/LoginView.tsx', code);
  console.log('Login device lock patched.');
} else {
  console.log('Login device lock target not found.');
}
