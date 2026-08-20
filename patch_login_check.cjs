const fs = require('fs');
let code = fs.readFileSync('src/components/LoginView.tsx', 'utf8');

const importTarget = `import { collection, query, getDocs, setDoc, doc, updateDoc } from 'firebase/firestore';`;
const importReplacement = `import { collection, query, getDocs, setDoc, doc, updateDoc, getDoc } from 'firebase/firestore';`;

const target = `      let foundUser = dbUsers.find(u => 
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
      }`;

const replacement = `      let foundUser = dbUsers.find(u => 
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

if (code.includes(target)) {
  code = code.replace(importTarget, importReplacement);
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/LoginView.tsx', code);
  console.log('Login logic patched.');
} else {
  console.log('Login logic target not found.');
}
