# แผนการปรับปรุง Requisition Menu (Smooth Spring & Liquid Glass Animation)

ปรับปรุง Requisition Dropdown Menu สำหรับเลือกโหมดการเบิกสินค้าใน `src/App.tsx` ให้มีอนิเมชันเปิด-ปิดแบบสปริงนุ่มนวล พร้อมดีไซน์กระจกฝ้า (Liquid Glass) เข้ากับ Design Language ของแอป

---

## 1. การเปลี่ยนแปลงที่วางแผนไว้

### 1.1 ผสาน Framer Motion (`AnimatePresence` + `motion.div`)
* ใช้คอมโพเนนต์ `<AnimatePresence>` หุ้มเงื่อนไขการเปิด-ปิดเมนู เพื่อให้อนิเมชันแสดงผลได้อย่างราบรื่นทั้งตอน **เปิด (Mount)** และ **ปิด (Unmount)**
* กำหนดจุดกำเนิดการขยาย `transformOrigin: 'top right'` ให้ขยายและหดตัวออกจากปุ่มลูกศร dropdown อย่างเป็นธรรมชาติ
* ตั้งค่า Transition ฟิสิกส์สปริง (Spring Physics):
  * `initial`: `{ opacity: 0, scale: 0.9, y: -6 }`
  * `animate`: `{ opacity: 1, scale: 1, y: 0 }`
  * `exit`: `{ opacity: 0, scale: 0.92, y: -4 }`
  * `transition`: `{ type: 'spring', damping: 25, stiffness: 380, mass: 0.8 }`

### 1.2 ปรับแต่งพื้นหลังและการจัดวางตามดีไซน์ Liquid Glass
* ประยุกต์ใช้คลาส `liquid-glass-card backdrop-blur-2xl` พร้อมขอบนีออน/ไฮไลต์บางเบา `border border-white/60 dark:border-white/10`
* เพิ่มมิติแสงเงาแบบ Soft Ambient Shadow `shadow-2xl shadow-indigo-500/10 dark:shadow-black/50`
* ปรับปรุง Micro-interaction เมื่อชี้ (Hover) บนแต่ละตัวเลือก ให้มี transition สีพื้นหลังและไอคอนตอบสนองอย่างนุ่มนวล

---

## 2. ไฟล์ที่เกี่ยวข้อง
* `src/App.tsx`: อัปเดตส่วน Dropdown ของ Requisition Menu (บรรทัด ~1745-1785) ให้ใช้งาน `AnimatePresence` และ `motion.div`

---

## 3. การตรวจสอบความถูกต้อง (Verification)
1. ตรวจสอบการคอมไพล์ผ่าน `lint_applet` และ `compile_applet`
2. ทดสอบการคลิกเปิดและปิดเมนู Requisition ทั้งจากการคลิกปุ่มซ้ำ และการคลิกพื้นที่ภายนอก (Click Outside)
3. ตรวจสอบความลื่นไหลในโหมดธีมสว่าง (Light Mode) และธีมมืด (Dark Mode)
