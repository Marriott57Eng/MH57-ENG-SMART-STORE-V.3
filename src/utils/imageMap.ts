// High quality, exact curated product and category images for Store FL.6 Warehouse

import imgPpr from '../assets/images/ppr_pipe_fittings_1786654873602.jpg';
import imgThw from '../assets/images/thw_wire_roll_1786654886199.jpg';
import imgChem from '../assets/images/chemical_gallon_1786654904864.jpg';
import imgSpray from '../assets/images/bidet_rinsing_spray_1786654920735.jpg';
import imgSmoke from '../assets/images/smoke_detector_1786654936005.jpg';
import imgLock from '../assets/images/door_lock_onity_1786654964783.jpg';
import imgLan from '../assets/images/cat6_rj45_1786654981025.jpg';
import imgLed from '../assets/images/led_tube_light_1786655002723.jpg';

// New requested images
import imgAhu from '../assets/images/hvac_ahu_unit_1786678649362.jpg';
import imgToaPaint from '../assets/images/toa_paint_can_1786678665881.jpg';
import imgPanasonicBattery from '../assets/images/panasonic_aa_battery_1786678635889.jpg';

export interface CategoryInfo {
  name: string;
  image: string;
  description: string;
  iconName: string;
}

// Category Banners - High-definition direct visual representation of each category
export const CATEGORY_IMAGE_MAP: Record<string, { image: string; description: string }> = {
  'เคมี': {
    image: imgChem,
    description: 'ทินเนอร์, คลอรีนผง, คลอรีนน้ำ, น้ำยาล้างคอยล์แอร์, น้ำยาล้างดักแอร์, กรดเกลือ',
  },
  'ท่อ': {
    image: imgPpr,
    description: 'ท่อ PPR 20-63mm, ข้อต่อตรง PPR, ข้องอ 90° PPR, อุปกรณ์ระบบท่อ',
  },
  'ไฟฟ้า': {
    image: imgThw,
    description: 'สายไฟ THW (แดง/เขียว/ขาว/เหลือง), NYY, VCT, ปลั๊ก Schneider, แมกเนติก, รีเลย์, เทปพันสายไฟ',
  },
  'Lighting': {
    image: imgLed,
    description: 'หลอด LED T8, ปิงปอง A45, MR16, AR111, CANDLE, โคมดาวน์ไลท์, ไฟเส้น LED Strip, หม้อแปลง Mean Well',
  },
  'แอร์': {
    image: imgAhu,
    description: 'สายพาน AHU/PAU, ลูกปืนแอร์, มอเตอร์ไดร์วาล์ว, ท่ออินซู, อินซูแผ่นกันความร้อน',
  },
  'สุขภัณฑ์': {
    image: imgSpray,
    description: 'สายฉีดชำระ, หัวฝักบัว, สายฝักบัว, GROHE Rain Shower, ก๊อก P-Tap, ฝารองนั่ง, ปุ่มกดฟลัช, กระจกโกนหนวด',
  },
  'สี+Grouting': {
    image: imgToaPaint,
    description: 'สีทาอาคาร TOA, ซิลิโคน, แดป, กาวยาง Dunlop, ยาแนว, โป๊วเหลือง',
  },
  'Fire Alarm': {
    image: imgSmoke,
    description: 'Smoke Detector SIGA-OSD, ฐาน Standard Base, Sounder Base, กล่องโมดูล SIGA-CR/CC1/CT2, ตัวดึงแจ้งเหตุ Pull Down',
  },
  'ประตู': {
    image: imgLock,
    description: 'ชุดล็อค Onity Card Reader/Board/Lock, บานพับประตูกระจก Shower Hinge, มือจับประตู, โซ่คล้อง, ตาแมว',
  },
  'เน็ต+โทรศัพท์': {
    image: imgLan,
    description: 'สาย LAN CAT6, หัวต่อ RJ45 modular plug, สายโทรศัพท์ 2-core/4-core',
  },
  'Battery': {
    image: imgPanasonicBattery,
    description: 'ถ่าน Panasonic AA, AAA, 9V, D-Size, ถ่านกระดุม CR2032',
  }
};

/**
 * Get accurate category image URL
 */
export function getCategoryImageUrl(categoryName: string): string {
  const trimmed = (categoryName || '').trim();
  if (CATEGORY_IMAGE_MAP[trimmed]) {
    return CATEGORY_IMAGE_MAP[trimmed].image;
  }

  for (const [key, val] of Object.entries(CATEGORY_IMAGE_MAP)) {
    if (trimmed.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(trimmed.toLowerCase())) {
      return val.image;
    }
  }

  return 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80';
}

