const fs = require('fs');
let code = fs.readFileSync('src/components/UserManagementView.tsx', 'utf8');

const targetButtons = `                  {user.id !== currentUser.id && user.id !== 'admin' && (
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 border border-transparent hover:border-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}`;

const replacementButtons = `                  {user.id !== currentUser.id && (
                    <>
                      {user.activeDeviceId && (
                        <button
                          onClick={async () => {
                            if (window.confirm(\`ปลดล็อกเซสชั่นของ \${user.name} หรือไม่? (ใช้กรณีที่ผู้ใช้ออกจากระบบจากเครื่องเดิมไม่ได้)\`)) {
                              try {
                                await updateDoc(doc(db, 'users', user.id), { activeDeviceId: '', sessionToken: '' });
                                alert('ปลดล็อกบัญชีเรียบร้อยแล้ว');
                              } catch (err) {
                                console.error('Unlock error:', err);
                              }
                            }
                          }}
                          className="w-8 h-8 flex items-center justify-center text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors shrink-0 border border-transparent hover:border-amber-100"
                          title="ปลดล็อกบัญชี (Force Logout)"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
                        </button>
                      )}
                      {user.id !== 'admin' && (
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 border border-transparent hover:border-red-100"
                          title="ลบผู้ใช้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}`;

if (code.includes(targetButtons)) {
  code = code.replace(targetButtons, replacementButtons);
  fs.writeFileSync('src/components/UserManagementView.tsx', code);
  console.log('User management patched.');
} else {
  console.log('User management target not found.');
}
