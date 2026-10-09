export interface SystemEmployee {
  id: string;             // รหัสพนักงาน เช่น "1847", "1906", "1213"
  name: string;           // ชื่อ-นามสกุลภาษาอังกฤษ ในระบบ
  nickname: string;       // ชื่อเล่นภาษาอังกฤษ
  thaiName: string;       // ชื่อ-นามสกุลภาษาไทย
  thaiNickname: string;   // ชื่อเล่นภาษาไทย
  role?: 'admin' | 'user';
  aliases?: string[];     // คำเรียกขาน/เสียงอ่านเพิ่มเติม
}

/**
 * ทำเนียบพนักงานจริงในระบบ Store FL.6 (ENG Smart Store)
 * แมปชื่อภาษาอังกฤษ รหัสพนักงาน และชื่อเรียกภาษาไทยให้สอดคล้องกัน 100%
 */
export const SYSTEM_EMPLOYEES: SystemEmployee[] = [
  {
    id: "1847",
    name: "Chanayood Wongsunthon",
    nickname: "Mild",
    thaiName: "ชานะยุทธ วงศ์สุนทร",
    thaiNickname: "มายด์",
    role: "admin",
    aliases: ["ชานะยุทธ", "ชานยุทธ", "มาย", "มายด์", "chanayood", "mild", "1847"]
  },
  {
    id: "1906",
    name: "Kiattisak Ninsang",
    nickname: "Jame",
    thaiName: "เกียรติศักดิ์ นิลแสง",
    thaiNickname: "เจมส์",
    aliases: ["เกียรติศักดิ์", "เจมส์", "เจม", "kiattisak", "jame", "james", "1906"]
  },
  {
    id: "1213",
    name: "Nattawut Khiaosod",
    nickname: "Boy",
    thaiName: "ณัฐวุฒิ เขียวสด",
    thaiNickname: "บอย",
    aliases: ["ณัฐวุฒิ", "บอย", "nattawut", "boy", "1213"]
  },
  {
    id: "1532",
    name: "Somphong Thitsomboon",
    nickname: "Aek",
    thaiName: "สมพงษ์ ทิศสมบูรณ์",
    thaiNickname: "เอก",
    aliases: ["สมพงษ์", "สมพงศ์", "เอก", "somphong", "aek", "1532"]
  },
  {
    id: "1912",
    name: "Umpon Na-Sulong",
    nickname: "Umpon",
    thaiName: "อัมพร ณ สุหลง",
    thaiNickname: "อัมพร",
    aliases: ["อัมพร", "umpon", "1912"]
  },
  {
    id: "1987",
    name: "Phaiboon Ruechai",
    nickname: "Phaiboon",
    thaiName: "ไพบูลย์ ฤาชัย",
    thaiNickname: "ไพบูลย์",
    aliases: ["ไพบูลย์", "phaiboon", "1987"]
  },
  {
    id: "1321",
    name: "Kwanpirom Teapun",
    nickname: "JJ",
    thaiName: "ขวัญภิรมย์ ธีปั้น",
    thaiNickname: "เจเจ",
    aliases: ["ขวัญภิรมย์", "เจเจ", "kwanpirom", "jj", "1321"]
  },
  {
    id: "25",
    name: "Thawatchai Thukthay",
    nickname: "Wat",
    thaiName: "ธวัชชัย ทุกข์ทวย",
    thaiNickname: "วัฒน์",
    aliases: ["ธวัชชัย", "วัฒน์", "thawatchai", "wat", "25", "025"]
  },
  {
    id: "63",
    name: "Amornsak Phantorn",
    nickname: "Gig",
    thaiName: "อมรศักดิ์ พันธุ์ทอน",
    thaiNickname: "กิ๊ก",
    aliases: ["อมรศักดิ์", "กิ๊ก", "amornsak", "gig", "63", "063"]
  },
  {
    id: "64",
    name: "Boonta Libutdee",
    nickname: "Ta",
    thaiName: "บุญตา ลิบุตรดี",
    thaiNickname: "ตา",
    aliases: ["บุญตา", "ตา", "boonta", "ta", "64", "064"]
  },
  {
    id: "105",
    name: "Suphawat Phutthapong",
    nickname: "Auan",
    thaiName: "ศุภวัฒน์ พุทธพงษ์",
    thaiNickname: "อ้วน",
    aliases: ["ศุภวัฒน์", "อ้วน", "suphawat", "auan", "105"]
  },
  {
    id: "154",
    name: "Thanapat Kunakul",
    nickname: "Tong",
    thaiName: "ธนภัทร กุลกุล",
    thaiNickname: "โต้ง",
    aliases: ["ธนภัทร", "โต้ง", "thanapat", "tong", "154"]
  },
  {
    id: "303",
    name: "Wattana Wong-nagm",
    nickname: "Bu",
    thaiName: "วัฒนา วงศ์งาม",
    thaiNickname: "บุ๊",
    aliases: ["วัฒนา", "บุ๊", "wattana", "bu", "303"]
  },
  {
    id: "410",
    name: "Chai Chuyram",
    nickname: "Duang",
    thaiName: "ชัย ช่วยรัมย์",
    thaiNickname: "ดวง",
    aliases: ["ชัย", "ช่วยรัมย์", "ดวง", "chai", "duang", "410"]
  },
  {
    id: "507",
    name: "Sayan Janpag",
    nickname: "Yan",
    thaiName: "สายัณห์ จันทร์พัก",
    thaiNickname: "ยันต์",
    aliases: ["สายัณห์", "สายัณ", "ยันต์", "sayan", "yan", "507"]
  },
  {
    id: "1115",
    name: "Aphirut Phummaka",
    nickname: "Nice",
    thaiName: "อภิรุจ ภูมิมากะ",
    thaiNickname: "ไนซ์",
    aliases: ["อภิรุจ", "ไนซ์", "aphirut", "nice", "1115"]
  },
  {
    id: "1224",
    name: "Worachet Boonwong",
    nickname: "Loy",
    thaiName: "วรเชษฐ์ บุญวงศ์",
    thaiNickname: "ลอย",
    aliases: ["วรเชษฐ์", "ลอย", "worachet", "loy", "1224"]
  },
  {
    id: "1228",
    name: "Roongrote Numkaew",
    nickname: "Rote",
    thaiName: "รุ่งโรจน์ นุ่มแก้ว",
    thaiNickname: "โรจน์",
    aliases: ["รุ่งโรจน์", "โรจน์", "roongrote", "rote", "1228"]
  },
  {
    id: "1262",
    name: "Nat Samruamchit",
    nickname: "Nat",
    thaiName: "นัท สำรวมจิตต์",
    thaiNickname: "นัท",
    aliases: ["นัท", "สำรวมจิตต์", "nat", "1262"]
  },
  {
    id: "1565",
    name: "Kumpol Meekumlang",
    nickname: "Tum",
    thaiName: "กัมพล มีกำลัง",
    thaiNickname: "ตั้ม",
    aliases: ["กัมพล", "ตั้ม", "kumpol", "tum", "1565"]
  },
  {
    id: "1574",
    name: "Thanasak Jansod",
    nickname: "Tingnoom",
    thaiName: "ธนศักดิ์ จันทร์สด",
    thaiNickname: "ติ่งหนุ่ม",
    aliases: ["ธนศักดิ์", "ติ่งหนุ่ม", "หนุ่ม", "thanasak", "tingnoom", "1574"]
  },
  {
    id: "1639",
    name: "Pattana Kotamalee",
    nickname: "Pat",
    thaiName: "พัฒนา โคตมะลี",
    thaiNickname: "พัฒน์",
    aliases: ["พัฒนา", "พัฒน์", "pattana", "pat", "1639"]
  },
  {
    id: "1648",
    name: "Sooksan Wongson",
    nickname: "Tar",
    thaiName: "สุขสันต์ วงษ์สน",
    thaiNickname: "ต้าร์",
    aliases: ["สุขสันต์", "ต้าร์", "sooksan", "tar", "1648"]
  },
  {
    id: "1705",
    name: "Chainapong Kongkiaw",
    nickname: "Hart",
    thaiName: "ชัยณพงศ์ คงเขียว",
    thaiNickname: "ฮาร์ท",
    aliases: ["ชัยณพงศ์", "ฮาร์ท", "chainapong", "hart", "1705"]
  },
  {
    id: "1706",
    name: "Chokchai Chaunkhunthod",
    nickname: "Oh",
    thaiName: "โชคชัย ชวนขุนทด",
    thaiNickname: "โอ๋",
    aliases: ["โชคชัย", "โอ๋", "chokchai", "oh", "1706"]
  },
  {
    id: "1759",
    name: "Rangsanti Kaithip",
    nickname: "Santi",
    thaiName: "รังสรรค์ ไกรทิพย์",
    thaiNickname: "สันติ",
    aliases: ["รังสรรค์", "สันติ", "rangsanti", "santi", "1759"]
  },
  {
    id: "1783",
    name: "Khanitsorn Sangsuriwong",
    nickname: "Pea",
    thaiName: "ขนิษฐ์ศร แสงสุริยวงศ์",
    thaiNickname: "เพีย",
    aliases: ["ขนิษฐ์ศร", "เพีย", "khanitsorn", "pea", "1783"]
  },
  {
    id: "1784",
    name: "Surawut Silpragob",
    nickname: "Noom",
    thaiName: "สุรวุฒิ ศิลปะประกอบ",
    thaiNickname: "หนุ่ม",
    aliases: ["สุรวุฒิ", "หนุ่ม", "surawut", "noom", "1784"]
  },
  {
    id: "1800",
    name: "Chaichat Saengarun",
    nickname: "Tum",
    thaiName: "ชัยฉัตร แสงอรุณ",
    thaiNickname: "ตั้ม",
    aliases: ["ชัยฉัตร", "ตั้ม", "chaichat", "tum", "1800"]
  },
  {
    id: "1810",
    name: "Suriya Aomsin",
    nickname: "Mourd",
    thaiName: "สุริยา ออมสิน",
    thaiNickname: "เหมือด",
    aliases: ["สุริยา", "เหมือด", "suriya", "mourd", "1810"]
  },
  {
    id: "1853",
    name: "Thirasak Chaisri",
    nickname: "Aek",
    thaiName: "ธีรศักดิ์ ชัยศรี",
    thaiNickname: "เอก",
    aliases: ["ธีรศักดิ์", "เอก", "thirasak", "aek", "1853"]
  },
  {
    id: "1904",
    name: "Chanon Sriwongrako",
    nickname: "Jack",
    thaiName: "ชานนท์ ศรีวงษ์รักษ์",
    thaiNickname: "แจ็ค",
    aliases: ["ชานนท์", "แจ็ค", "chanon", "jack", "1904"]
  }
];

/**
 * ตรวจสอบว่าชื่อหรือคำค้นหาเป็นหนึ่งในพนักงาน 32 คนที่กำหนดหรือไม่
 */
export function isDesignatedEmployee(query?: string): boolean {
  return Boolean(findEmployeeInSystem(query));
}

/**
 * ค้นหาและจับคู่พนักงานจริงในระบบ จากข้อความคำสั่ง (ทั้งเสียงพูดภาษาไทย, รหัสพนักงาน, หรือชื่อภาษาอังกฤษ)
 * @param query ข้อความที่ผู้ใช้พูดหรือกรอก เช่น "ชานะยุทธ", "1847", "รหัส 1906", "เจมส์", "Mild"
 * @param extraUsers ข้อมูลผู้ใช้เพิ่มเติมจาก Firestore (ถ้ามี)
 */
export function findEmployeeInSystem(
  query?: string,
  extraUsers?: any[]
): SystemEmployee | null {
  if (!query || typeof query !== 'string') return null;

  const raw = query.trim();
  if (!raw) return null;
  const clean = raw.toLowerCase().replace(/^(คุณ|ช่าง|นาย|นางสาว|นาง|พี่|น้อง|รหัส|พนักงาน|เบอร์)\s*/gi, '').trim();

  // ปฏิเสธแผนก/หน่วยงานภายนอกที่ไม่ใช่พนักงาน 32 คนที่กำหนด เช่น "ฝ่ายจัดซื้อ", "จัดซื้อ", PO
  if (/จัดซื้อ|ฝ่ายจัดซื้อ|purchasing|procurement|supplier|vendor|po-\d+/i.test(clean)) {
    return null;
  }

  // PASS 1: ตรวจสอบค้นหาด้วย "รหัสพนักงาน" ตัวเลขล้วนๆ (เช่น "1705", "1847", "1906", "410", "25")
  const idDigitsMatch = raw.match(/\b\d{2,5}\b/);
  if (idDigitsMatch) {
    const idDigits = idDigitsMatch[0];
    const foundById = SYSTEM_EMPLOYEES.find(e => e.id === idDigits || e.id.padStart(4, '0') === idDigits.padStart(4, '0'));
    if (foundById) return foundById;
  }

  const cleanStripped = clean.replace(/[()\[\]\-._,]/g, ' ').replace(/\s+/g, ' ').trim();

  // PASS 2: EXACT Match บนชื่อเต็มภาษาอังกฤษ, ชื่อภาษาไทย, ชื่อเล่นภาษาอังกฤษ, ชื่อเล่นภาษาไทย หรือ Alias ตรงกัน 100%
  for (const emp of SYSTEM_EMPLOYEES) {
    const nameLower = emp.name.toLowerCase();
    const thaiNameLower = emp.thaiName.toLowerCase();
    const nickLower = emp.nickname.toLowerCase();
    const thaiNickLower = emp.thaiNickname.toLowerCase();

    if (
      clean === emp.id ||
      cleanStripped === emp.id ||
      cleanStripped === nameLower ||
      cleanStripped === thaiNameLower ||
      cleanStripped === nickLower ||
      cleanStripped === thaiNickLower
    ) {
      return emp;
    }

    if (emp.aliases && emp.aliases.some(alias => alias.toLowerCase() === cleanStripped || alias.toLowerCase() === clean)) {
      return emp;
    }
  }

  // PASS 3: EXACT TOKEN / WORD Match (คำแรกหรือคำใดคำหนึ่งตรงกันเป๊ะ เช่น "Chainapong", "Kongkiaw", "Hart", "ชัยณพงศ์", "ฮาร์ท")
  const tokens = cleanStripped.split(' ').filter(t => t.length > 0);
  for (const emp of SYSTEM_EMPLOYEES) {
    const nameLower = emp.name.toLowerCase();
    const thaiNameLower = emp.thaiName.toLowerCase();
    const nickLower = emp.nickname.toLowerCase();
    const thaiNickLower = emp.thaiNickname.toLowerCase();
    const nameParts = nameLower.split(' ');
    const thaiNameParts = thaiNameLower.split(' ');

    for (const token of tokens) {
      if (token.length < 2) continue;
      if (nameParts.includes(token) || thaiNameParts.includes(token) || token === nickLower || token === thaiNickLower) {
        return emp;
      }
      if (emp.aliases && emp.aliases.some(a => a.toLowerCase() === token)) {
        return emp;
      }
    }
  }

  // PASS 4: Substring / Phrase Contains Match (เฉพาะเมื่อข้อความยาวพอ >= 3 ตัวอักษร)
  for (const emp of SYSTEM_EMPLOYEES) {
    const nameLower = emp.name.toLowerCase();
    const thaiNameLower = emp.thaiName.toLowerCase();

    if (cleanStripped.length >= 3 && (cleanStripped.includes(nameLower) || nameLower.includes(cleanStripped))) {
      return emp;
    }
    if (cleanStripped.length >= 3 && (cleanStripped.includes(thaiNameLower) || thaiNameLower.includes(cleanStripped))) {
      return emp;
    }
  }

  // PASS 5: ตรวจสอบกับ extraUsers จาก Firestore
  if (Array.isArray(extraUsers) && extraUsers.length > 0) {
    for (const u of extraUsers) {
      const uId = String(u.id || u.username || '').toLowerCase();
      const uName = String(u.name || '').toLowerCase();
      const uNick = String(u.nickname || '').toLowerCase();

      if (uId === cleanStripped || uName === cleanStripped || uNick === cleanStripped || uName.includes(cleanStripped) || cleanStripped.includes(uName)) {
        return {
          id: u.id || u.username || '',
          name: u.name || u.username || '',
          nickname: u.nickname || u.name || '',
          thaiName: u.name || '',
          thaiNickname: u.nickname || '',
          role: u.role || 'user'
        };
      }
    }
  }

  return null;
}

/**
 * สร้างข้อความแค็ตตาล็อกรายชื่อพนักงานสำหรับส่งให้ Gemini AI ทั้ง Text และ Live Speech
 * เพื่อให้ AI รู้จักชื่อไทย รหัสพนักงาน และชื่ออังกฤษที่ตรงกัน 100%
 */
export function getSystemEmployeeCatalogForAi(): string {
  return SYSTEM_EMPLOYEES.map(e => 
    `- รหัส [${e.id}]: คุณ${e.name} (ชื่อเล่น: ${e.nickname} / ${e.thaiNickname}, ภาษาไทย: ${e.thaiName})`
  ).join('\n');
}
