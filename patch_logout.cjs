const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetLogout = `                  <button
                    onClick={() => {
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
                          lastActiveAt: 0
                        });
                      } catch (err) {}
                      localStorage.removeItem('warehouse_user');
                      setCurrentUser(null);
                    }}
                    className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all flex items-center border border-slate-200/80"
                    title="ออกจากระบบ"
                  >`;

if (code.includes(targetLogout)) {
  code = code.replace(targetLogout, replacementLogout);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Logout patched.');
} else {
  console.log('Logout target not found.');
}
