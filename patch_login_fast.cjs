const fs = require('fs');
let code = fs.readFileSync('src/components/LoginView.tsx', 'utf8');

const target = `  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }`;

const buttonTarget = `          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-70 text-white font-bold py-4 px-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'เข้าสู่ระบบ'
            )}`;

const buttonReplacement = `          <button
            type="submit"
            disabled={loading || initializing}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-70 text-white font-bold py-4 px-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2"
          >
            {loading || initializing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'เข้าสู่ระบบ'
            )}`;

if (code.includes(target) && code.includes(buttonTarget)) {
  code = code.replace(target, '');
  code = code.replace(buttonTarget, buttonReplacement);
  fs.writeFileSync('src/components/LoginView.tsx', code);
  console.log('Login fast patched.');
} else {
  console.log('Target not found!');
}
