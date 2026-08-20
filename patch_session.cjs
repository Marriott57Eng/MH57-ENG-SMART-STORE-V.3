const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const importTarget = `import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, onSnapshot, limit } from 'firebase/firestore';`;
const importReplacement = `import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, onSnapshot, limit, getDoc } from 'firebase/firestore';`;

code = code.replace(importTarget, importReplacement);

const sessionTarget = `  useEffect(() => {
    // Check for saved user session
    const savedUser = localStorage.getItem('warehouse_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {}
    }
    fetchInventory();
  }, []);`;

const sessionReplacement = `  useEffect(() => {
    // Check for saved user session
    const savedUser = localStorage.getItem('warehouse_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {}
    }
    fetchInventory();
  }, []);

  // Check session token to prevent concurrent logins
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

if (code.includes(sessionTarget)) {
  code = code.replace(sessionTarget, sessionReplacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Session patch applied.');
} else {
  console.log('Session target not found.');
}
