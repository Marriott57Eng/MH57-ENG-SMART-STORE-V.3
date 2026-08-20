const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const oldCheck = "} else if (isReportRequestStr.includes('ใกล้หมด') || isReportRequestStr.includes('หมดสต็อก') || isReportRequestStr.includes('สั่งซื้อ') || isReportRequestStr.includes('low') || isReportRequestStr.includes('out')) {";
const newCheck = "} else if (isReportRequestStr.includes('ใกล้หมด') || isReportRequestStr.includes('หมดสต็อก') || isReportRequestStr.includes('หมดสต็อค') || isReportRequestStr.includes('สั่งซื้อ') || isReportRequestStr.includes('low') || isReportRequestStr.includes('out')) {";

code = code.replace(oldCheck, newCheck);
fs.writeFileSync('server.ts', code);
